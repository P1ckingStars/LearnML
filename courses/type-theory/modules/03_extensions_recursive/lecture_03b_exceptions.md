---
title: "Lecture 03b: Exceptions & Error Handling"
tags:
  - type-theory
  - extensions
  - lecture
---
# Lecture 03b: Exceptions & Error Handling

> **Module 03 -- Extensions & Recursive Types (Weeks 5-6)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** the motivation for adding exceptional control flow to a typed lambda calculus and articulate why normal evaluation rules are insufficient for modeling errors.
2. **Define** a simple exception mechanism with $\text{error}$ as a term of any type, and state its typing and evaluation rules.
3. **Formalize** the $\text{try}$-$\text{with}$ construct for catching exceptions, including its typing and evaluation rules.
4. **Extend** the system to exceptions that carry values, with $\text{raise}\;t$ and pattern-matching handlers.
5. **Prove** progress and preservation for STLC extended with exceptions, identifying how the proofs change relative to the pure case.
6. **Analyze** how exceptions interact with other language features, including references and continuations.
7. **Relate** exceptions to sum types, understanding exceptions as a "failure branch" in the type-theoretic sense.
8. **Compare** the exception mechanism with other error-handling approaches, including option types and result monads.

---

## 1. Motivation

Consider a function that divides two natural numbers:

$$\textit{div} : \text{Nat} \to \text{Nat} \to \text{Nat}$$

What should $\textit{div}\;5\;0$ return? In a total language, we might define $\textit{div}\;m\;0 = 0$ (a common convention in some proof assistants), but this silently produces a meaningless result. In most practical languages, division by zero is a runtime error.

More broadly, many computations can fail:

- Array index out of bounds
- File not found
- Pattern match failure
- Stack overflow
- Assertion violations

We need a systematic way to signal and handle such failures within our typed framework. The key desiderata are:

1. **Type safety must be preserved.** Errors should not cause the type system to be circumvented.
2. **Errors should propagate automatically.** We should not need to explicitly check for errors after every operation.
3. **Errors should be catchable.** Some errors are recoverable, and the program should be able to handle them gracefully.

We present three progressively more expressive approaches: (a) a simple $\text{error}$ term, (b) exceptions with $\text{try}$-$\text{with}$, and (c) exceptions carrying values. This development follows Pierce (TAPL, Chapter 14).

---

## 2. Core Theory

### 2.1 Approach 1: The $\text{error}$ Term

The simplest approach is to add a single term $\text{error}$ that represents an unrecoverable error. This term can be given any type -- it is a term that "never returns," so it is safe to use in any context.

**Syntax extension:**

$$t ::= \ldots \mid \text{error}$$

**Typing rule:**

$$\frac{}{\Gamma \vdash \text{error} : T} \quad \text{(T-Error)}$$

The rule T-Error has no premises and assigns an arbitrary type $T$ to $\text{error}$. This may seem dangerous -- how can a single term have every type? The answer is that $\text{error}$ will never produce a value, so no actual value of type $T$ is ever constructed. This is analogous to the typing of $\text{Void}$ elimination: $\text{absurd} : \text{Void} \to T$ for any $T$.

**Evaluation rules:**

Errors propagate outward through all term constructors. We need one propagation rule for each evaluation context:

$$\frac{}{\text{error}\;t_2 \to \text{error}} \quad \text{(E-AppErr1)}$$

$$\frac{}{v_1\;\text{error} \to \text{error}} \quad \text{(E-AppErr2)}$$

More generally, for any evaluation context $E[\cdot]$:

$$\frac{}{E[\text{error}] \to \text{error}} \quad \text{(E-Error)}$$

where $E[\cdot]$ ranges over all evaluation contexts. Written out explicitly for our term forms:

$$\frac{}{\text{error}\;t_2 \to \text{error}} \quad \text{(E-AppErr1)}$$

$$\frac{}{v_1\;\text{error} \to \text{error}} \quad \text{(E-AppErr2)}$$

$$\frac{}{\text{if } \text{error} \text{ then } t_2 \text{ else } t_3 \to \text{error}} \quad \text{(E-IfErr)}$$

$$\frac{}{\text{succ}\;\text{error} \to \text{error}} \quad \text{(E-SuccErr)}$$

$$\frac{}{\text{pred}\;\text{error} \to \text{error}} \quad \text{(E-PredErr)}$$

$$\frac{}{\text{iszero}\;\text{error} \to \text{error}} \quad \text{(E-IsZeroErr)}$$

For references (combining with Lecture 03a):

$$\frac{}{\text{ref}\;\text{error} \mid \mu \to \text{error} \mid \mu} \quad \text{(E-RefErr)}$$

$$\frac{}{!\;\text{error} \mid \mu \to \text{error} \mid \mu} \quad \text{(E-DerefErr)}$$

$$\frac{}{\text{error} := t_2 \mid \mu \to \text{error} \mid \mu} \quad \text{(E-AssignErr1)}$$

$$\frac{}{v_1 := \text{error} \mid \mu \to \text{error} \mid \mu} \quad \text{(E-AssignErr2)}$$

**Remark.** Note that $\text{error}$ is *not* a value. It is a stuck-like term, except that instead of being truly stuck (which would violate progress), we have explicit rules for its propagation.

**Remark on the "any type" aspect of T-Error.** The fact that $\text{error}$ can be given any type is a consequence of the principle of **ex falso quodlibet** ("from falsehood, anything follows"). Since $\text{error}$ represents a computation that will never produce a result, it is vacuously safe to claim that its (nonexistent) result has any type. This is the same reasoning that justifies the typing rule for $\text{absurd} : \text{Void} \to T$ (the elimination form for the empty type).

Formally, $\text{error}$ inhabits every type but produces no value. This does not violate the soundness of the type system because the progress theorem will be modified to account for the possibility that evaluation reaches $\text{error}$.

**Formal summary of error propagation.** We can express the error propagation rules more compactly using evaluation contexts. Define the set of evaluation contexts $E$ as:

$$E ::= [\cdot] \mid E\;t \mid v\;E \mid \text{if}\;E\;\text{then}\;t\;\text{else}\;t \mid \text{succ}\;E \mid \text{pred}\;E \mid \text{iszero}\;E$$

$$\quad \mid\; (E, t) \mid (v, E) \mid \pi_1\;E \mid \pi_2\;E \mid \text{inl}\;E \mid \text{inr}\;E$$

$$\quad \mid\; \text{case}\;E\;\text{of}\;\ldots \mid \text{ref}\;E \mid \;!\,E \mid E := t \mid v := E$$

Then all the error propagation rules can be captured by the single rule:

$$\frac{}{E[\text{error}] \to \text{error}} \quad \text{(E-ErrorCtx)}$$

This is more elegant but less explicit. In the proof of type safety, we work with the individual rules to enable case analysis.

### 2.2 Type Safety with $\text{error}$

With $\text{error}$ in the language, we must revise the statement of progress. A well-typed closed term is no longer guaranteed to step to a value or take a step -- it might also be $\text{error}$.

**Theorem 2.1 (Progress with errors).** If $\vdash t : T$, then either:

1. $t$ is a value, or
2. $t = \text{error}$, or
3. there exists $t'$ such that $t \to t'$.

*Proof.* By induction on the derivation of $\vdash t : T$.

**Case T-Error:** $t = \text{error}$, which is case (2).

All other cases proceed as in the standard progress proof, with the additional observation that when a subexpression is $\text{error}$ (rather than a value or steppable term), the appropriate error propagation rule applies. For example:

**Case T-App:** $t = t_1\;t_2$ with $\vdash t_1 : T_{11} \to T$ and $\vdash t_2 : T_{11}$.

By IH on $t_1$: either $t_1$ is a value, $t_1 = \text{error}$, or $t_1 \to t_1'$.

- If $t_1 \to t_1'$, then $t_1\;t_2 \to t_1'\;t_2$ by E-App1.
- If $t_1 = \text{error}$, then $\text{error}\;t_2 \to \text{error}$ by E-AppErr1.
- If $t_1$ is a value $v_1$, by IH on $t_2$: either $t_2$ is a value, $t_2 = \text{error}$, or $t_2 \to t_2'$.
  - If $t_2 \to t_2'$, then $v_1\;t_2 \to v_1\;t_2'$ by E-App2.
  - If $t_2 = \text{error}$, then $v_1\;\text{error} \to \text{error}$ by E-AppErr2.
  - If $t_2$ is a value $v_2$, then $v_1 = \lambda x : T_{11}.\, t_{12}$ by canonical forms, and $(\lambda x : T_{11}.\, t_{12})\;v_2 \to [x \mapsto v_2]\,t_{12}$ by E-AppAbs. $\square$

**Theorem 2.2 (Preservation with errors).** If $\vdash t : T$ and $t \to t'$, then $\vdash t' : T$.

*Proof.* By induction on the derivation of $t \to t'$.

**Case E-AppErr1:** $\text{error}\;t_2 \to \text{error}$. From typing, $\vdash \text{error}\;t_2 : T$. We need $\vdash \text{error} : T$, which holds by T-Error.

**Case E-AppErr2:** $v_1\;\text{error} \to \text{error}$. Same argument.

All error propagation cases are trivially handled by T-Error, since $\text{error}$ has any type. The remaining cases are identical to the standard STLC preservation proof. $\square$

**Remark on the significance of T-Error for preservation.** The T-Error rule is what makes preservation for error propagation cases trivial. Without it, we would need to show that $\text{error}$ has the specific type $T$ -- but T-Error gives us this for free. This is a general pattern: when a term form can have any type (polymorphic in the result type), preservation for rules that produce that term form is trivially satisfied.

### 2.2.1 Detailed Example: Error Propagation Through Application

Consider the typing and evaluation of:

$$(\lambda x : \text{Nat}.\, \text{succ}\;x)\;\text{error}$$

**Typing:**

1. $\vdash \lambda x : \text{Nat}.\, \text{succ}\;x : \text{Nat} \to \text{Nat}$ (standard).
2. $\vdash \text{error} : \text{Nat}$ (by T-Error, choosing $T = \text{Nat}$).
3. $\vdash (\lambda x : \text{Nat}.\, \text{succ}\;x)\;\text{error} : \text{Nat}$ (by T-App).

**Evaluation:** The function is already a value. The argument $\text{error}$ is not a value. Normally, we would evaluate the argument, but $\text{error}$ cannot step normally. Instead, E-AppErr2 applies:

$$(\lambda x : \text{Nat}.\, \text{succ}\;x)\;\text{error} \to \text{error}$$

**Preservation check:** The original term has type $\text{Nat}$. The result $\text{error}$ has type $\text{Nat}$ by T-Error. Preservation holds.

### 2.2.2 Error vs. Nontermination

It is important to distinguish error from nontermination. Both prevent a computation from producing a value, but they differ in observational behavior:

- **Error** ($\text{error}$): The computation halts immediately. The program is "stuck" in a controlled way -- it signals failure.
- **Nontermination** ($\Omega$): The computation runs forever. The program never halts.

From a denotational semantics perspective, both correspond to the bottom element $\bot$ of the domain, but they differ operationally. Error is a **finite** failure; nontermination is an **infinite** failure.

In some formulations (e.g., Harper's PFPL), error and nontermination are distinguished in the semantics: error is a special outcome alongside values, while nontermination is the absence of any outcome.

### 2.3 Approach 2: Exceptions with $\text{try}$-$\text{with}$

The simple $\text{error}$ term is unrecoverable -- once an error occurs, it propagates to the top level. To model recoverable errors, we add exception handling.

**Syntax extension:**

$$t ::= \ldots \mid \text{error} \mid \text{try } t_1 \text{ with } t_2$$

The term $\text{try } t_1 \text{ with } t_2$ evaluates $t_1$. If $t_1$ evaluates to a value $v$, the result is $v$. If $t_1$ raises an error, the handler $t_2$ is evaluated instead.

**Typing rule:**

$$\frac{\Gamma \vdash t_1 : T \quad \Gamma \vdash t_2 : T}{\Gamma \vdash \text{try } t_1 \text{ with } t_2 : T} \quad \text{(T-Try)}$$

Both $t_1$ and $t_2$ must have the same type $T$. This makes sense: the result of the $\text{try}$ expression is either the value produced by $t_1$ (if no error) or the value produced by $t_2$ (if error), and these must be compatible.

**Evaluation rules:**

$$\frac{t_1 \to t_1'}{\text{try } t_1 \text{ with } t_2 \to \text{try } t_1' \text{ with } t_2} \quad \text{(E-TryStep)}$$

$$\frac{}{\text{try } v \text{ with } t_2 \to v} \quad \text{(E-TryV)}$$

$$\frac{}{\text{try } \text{error} \text{ with } t_2 \to t_2} \quad \text{(E-TryError)}$$

The first rule says that we evaluate $t_1$ inside the $\text{try}$. The second says that if $t_1$ reaches a value, the handler is discarded. The third says that if $t_1$ raises an error, we switch to the handler.

**Crucial observation.** The error propagation rules from Section 2.1 are still needed for propagation within $t_1$, *except* that error never propagates past the $\text{try}$ boundary. The $\text{try}$ acts as a "firewall" -- it intercepts the error before it can propagate further.

The evaluation rules are carefully ordered so that error propagation within $t_1$ (via E-AppErr1, E-AppErr2, etc.) brings $\text{error}$ up to the immediate subterm position of $\text{try}$, and then E-TryError catches it.

**Example:**

$$\text{try } ((\lambda x : \text{Nat}.\, x)\;\text{error}) \text{ with } 42$$

Evaluation proceeds:

$$\text{try } ((\lambda x : \text{Nat}.\, x)\;\text{error}) \text{ with } 42$$

$$\to \text{try } \text{error} \text{ with } 42 \quad \text{(by E-AppErr2 inside try)}$$

$$\to 42 \quad \text{(by E-TryError)}$$

### 2.4 Type Safety with $\text{try}$-$\text{with}$

**Theorem 2.3 (Progress with try-with).** If $\vdash t : T$, then either $t$ is a value, $t = \text{error}$, or there exists $t'$ such that $t \to t'$.

*Proof.* Extended from Theorem 2.1 with one new case.

**Case T-Try:** $t = \text{try } t_1 \text{ with } t_2$ with $\vdash t_1 : T$ and $\vdash t_2 : T$.

By IH on $t_1$: either $t_1$ is a value, $t_1 = \text{error}$, or $t_1 \to t_1'$.

- If $t_1$ is a value $v$, then $\text{try } v \text{ with } t_2 \to v$ by E-TryV.
- If $t_1 = \text{error}$, then $\text{try } \text{error} \text{ with } t_2 \to t_2$ by E-TryError.
- If $t_1 \to t_1'$, then $\text{try } t_1 \text{ with } t_2 \to \text{try } t_1' \text{ with } t_2$ by E-TryStep. $\square$

**Theorem 2.4 (Preservation with try-with).** If $\vdash t : T$ and $t \to t'$, then $\vdash t' : T$.

*Proof.* Extended from Theorem 2.2 with three new cases.

**Case E-TryStep:** $\text{try } t_1 \text{ with } t_2 \to \text{try } t_1' \text{ with } t_2$ where $t_1 \to t_1'$. By inversion of T-Try, $\vdash t_1 : T$ and $\vdash t_2 : T$. By IH, $\vdash t_1' : T$. By T-Try, $\vdash \text{try } t_1' \text{ with } t_2 : T$.

**Case E-TryV:** $\text{try } v \text{ with } t_2 \to v$. By inversion of T-Try, $\vdash v : T$, which is exactly what we need.

**Case E-TryError:** $\text{try } \text{error} \text{ with } t_2 \to t_2$. By inversion of T-Try, $\vdash t_2 : T$, which is exactly what we need. $\square$

### 2.5 Approach 3: Exceptions with Values

The simple $\text{error}$ mechanism does not distinguish between different kinds of errors, nor does it carry any information about what went wrong. We now extend the system so that exceptions carry values.

**Syntax extension:**

$$t ::= \ldots \mid \text{raise}\;t \mid \text{try } t_1 \text{ with } t_2$$

Here, $\text{raise}\;t$ evaluates $t$ to a value and raises it as an exception. The handler $t_2$ in $\text{try } t_1 \text{ with } t_2$ is now a function that receives the exception value.

We introduce an exception type $T_{\text{exn}}$ (which could be a fixed type like $\text{String}$, or an extensible variant type as in ML).

**Typing rules:**

$$\frac{\Gamma \vdash t : T_{\text{exn}}}{\Gamma \vdash \text{raise}\;t : T} \quad \text{(T-Raise)}$$

$$\frac{\Gamma \vdash t_1 : T \quad \Gamma \vdash t_2 : T_{\text{exn}} \to T}{\Gamma \vdash \text{try } t_1 \text{ with } t_2 : T} \quad \text{(T-TryWith)}$$

The rule T-Raise says that $\text{raise}\;t$ can be given any type $T$ (since it never returns), provided $t$ has the exception type. The rule T-TryWith says that the handler $t_2$ is a function from exceptions to the result type.

**Evaluation rules:**

First, $\text{raise}\;t$ must evaluate its argument:

$$\frac{t \to t'}{\text{raise}\;t \to \text{raise}\;t'} \quad \text{(E-Raise)}$$

A fully evaluated raise is a "raised exception value":

$$\frac{}{\text{raise}\;v \text{ is an exception}} \quad \text{(exception form)}$$

Exceptions propagate through evaluation contexts:

$$\frac{}{(\text{raise}\;v)\;t_2 \to \text{raise}\;v} \quad \text{(E-AppRaise1)}$$

$$\frac{}{v_1\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-AppRaise2)}$$

More generally, for any evaluation context $E[\cdot]$ with $E \neq [\cdot]$:

$$\frac{}{E[\text{raise}\;v] \to \text{raise}\;v} \quad \text{(E-PropRaise)}$$

Exception handling:

$$\frac{t_1 \to t_1'}{\text{try } t_1 \text{ with } t_2 \to \text{try } t_1' \text{ with } t_2} \quad \text{(E-TryStep)}$$

$$\frac{}{\text{try } v \text{ with } t_2 \to v} \quad \text{(E-TryV)}$$

$$\frac{}{\text{try } (\text{raise}\;v) \text{ with } t_2 \to t_2\;v} \quad \text{(E-TryCatch)}$$

The crucial rule is E-TryCatch: when an exception reaches the $\text{try}$ boundary, the handler $t_2$ is applied to the exception value $v$.

### 2.6 Detailed Example

Consider typing and evaluating the following term:

$$
\text{try } (\text{raise}\;\text{"div-by-zero"}) + 1 \text{ with } (\lambda e : \text{String}.\, 0)
$$

**Typing derivation (bottom-up):**

1. $\vdash \text{"div-by-zero"} : \text{String}$ (by T-String).
2. $\vdash \text{raise}\;\text{"div-by-zero"} : \text{Nat}$ (by T-Raise, taking $T = \text{Nat}$ and $T_{\text{exn}} = \text{String}$).
3. $\vdash (\text{raise}\;\text{"div-by-zero"}) + 1 : \text{Nat}$ (by the typing rule for addition, since both subterms have type $\text{Nat}$).
4. $e : \text{String} \vdash 0 : \text{Nat}$ (by T-Nat).
5. $\vdash \lambda e : \text{String}.\, 0 : \text{String} \to \text{Nat}$ (by T-Abs).
6. $\vdash \text{try } \ldots \text{ with } (\lambda e : \text{String}.\, 0) : \text{Nat}$ (by T-TryWith, since $T = \text{Nat}$ and $T_{\text{exn}} = \text{String}$).

**Evaluation:**

$$\text{try } ((\text{raise}\;\text{"div-by-zero"}) + 1) \text{ with } (\lambda e.\, 0)$$

$$\to \text{try } (\text{raise}\;\text{"div-by-zero"}) \text{ with } (\lambda e.\, 0) \quad \text{(E-PropRaise for }+\text{)}$$

$$\to (\lambda e.\, 0)\;\text{"div-by-zero"} \quad \text{(E-TryCatch)}$$

$$\to 0 \quad \text{(E-AppAbs)}$$

### 2.7 Exception Safety Proofs

**Theorem 2.5 (Progress with exception values).** If $\vdash t : T$, then either:

1. $t$ is a value, or
2. $t = \text{raise}\;v$ for some value $v$ (an uncaught exception), or
3. there exists $t'$ such that $t \to t'$.

*Proof.* By induction on the derivation of $\vdash t : T$.

**Case T-Raise:** $t = \text{raise}\;t_1$ with $\vdash t_1 : T_{\text{exn}}$.

By IH on $t_1$: either $t_1$ is a value, $t_1 = \text{raise}\;v$ for some $v$, or $t_1 \to t_1'$.

- If $t_1$ is a value $v$, then $t = \text{raise}\;v$, which is case (2).
- If $t_1 = \text{raise}\;v$, then $\text{raise}\;(\text{raise}\;v) \to \text{raise}\;v$ by E-PropRaise.
- If $t_1 \to t_1'$, then $\text{raise}\;t_1 \to \text{raise}\;t_1'$ by E-Raise.

**Case T-TryWith:** $t = \text{try } t_1 \text{ with } t_2$ with $\vdash t_1 : T$ and $\vdash t_2 : T_{\text{exn}} \to T$.

By IH on $t_1$:

- If $t_1$ is a value $v$, apply E-TryV.
- If $t_1 = \text{raise}\;v$, apply E-TryCatch.
- If $t_1 \to t_1'$, apply E-TryStep.

All other cases are analogous to the standard proof, with additional subcases for when a subexpression is $\text{raise}\;v$. $\square$

**Theorem 2.6 (Preservation with exception values).** If $\vdash t : T$ and $t \to t'$, then $\vdash t' : T$.

*Proof.* By induction on $t \to t'$.

**Case E-AppRaise1:** $(\text{raise}\;v)\;t_2 \to \text{raise}\;v$.

By inversion, $\vdash (\text{raise}\;v)\;t_2 : T$ implies $\vdash \text{raise}\;v : S \to T$ for some $S$. By inversion of T-Raise, $\vdash v : T_{\text{exn}}$. By T-Raise (with result type $T$), $\vdash \text{raise}\;v : T$.

**Case E-TryCatch:** $\text{try } (\text{raise}\;v) \text{ with } t_2 \to t_2\;v$.

By inversion of T-TryWith, $\vdash \text{raise}\;v : T$ and $\vdash t_2 : T_{\text{exn}} \to T$. By inversion of T-Raise, $\vdash v : T_{\text{exn}}$. By T-App, $\vdash t_2\;v : T$.

All other cases follow the same pattern. $\square$

---

## 3. Exceptions and Evaluation Order

### 3.1 Left-to-Right vs. Right-to-Left

The interaction between exceptions and evaluation order is subtle. Consider:

$$(\text{raise}\;v_1)\;(\text{raise}\;v_2)$$

Under left-to-right evaluation, this reduces by E-AppRaise1 to $\text{raise}\;v_1$. Under right-to-left evaluation, the argument would be evaluated first, giving $\text{raise}\;v_2$. The two orders produce different exception values.

This is why the evaluation order matters for languages with exceptions: it determines which exception is raised when multiple subexpressions would raise exceptions. Most languages fix a specific evaluation order (left-to-right in Java, unspecified in C, right-to-left in OCaml).

### 3.2 Exceptions in Lazy Languages

In a lazy language, the interaction is even more complex. An expression like $\text{raise}\;v$ inside a thunk is not evaluated until the thunk is forced. This means exceptions can be "hidden" inside data structures and raised at unexpected times. Haskell addresses this with the distinction between **imprecise exceptions** (which can be raised by pure code) and **precise exceptions** (which are handled in the IO monad).

---

## 4. Connection to Sum Types

### 4.1 Exceptions as the "Failure Branch"

There is a deep connection between exceptions and sum types. Consider a function that might fail:

$$f : A \to B$$

If $f$ might raise an exception of type $E$, we can model this explicitly using a sum type:

$$f' : A \to B + E$$

Every application of $f'$ returns either $\text{inl}\;b$ (success with value $b : B$) or $\text{inr}\;e$ (failure with exception $e : E$).

The key difference is in **propagation**. With sum types, the caller must explicitly match on the result:

$$\text{case } f'(a) \text{ of } \text{inl}\;b \Rightarrow \ldots \mid \text{inr}\;e \Rightarrow \ldots$$

With exceptions, propagation is automatic. If $f(a)$ raises an exception and the caller does not catch it, the exception propagates to the caller's caller, and so on. This automatic propagation is the raison d'etre of exceptions: they separate the "normal" control flow from error handling.

### 4.2 The Monad Perspective

In the monadic view (due to Moggi, 1991), exceptions form a monad:

$$T_E(A) = A + E$$

with:

- $\text{return} : A \to T_E(A)$ defined as $\text{return}\;a = \text{inl}\;a$
- $\text{bind} : T_E(A) \to (A \to T_E(B)) \to T_E(B)$ defined as:

$$\text{bind}\;(\text{inl}\;a)\;f = f\;a$$

$$\text{bind}\;(\text{inr}\;e)\;f = \text{inr}\;e$$

The $\text{bind}$ operation implements automatic propagation: if the first computation fails, the failure is propagated without applying $f$.

This perspective makes explicit what exceptions do implicitly: they thread an error-handling mechanism through the computation via monadic composition.

### 4.3 Result Types in Modern Languages

Many modern languages adopt explicit result types instead of (or in addition to) exceptions:

- Rust's `Result<T, E>` type with `?` for propagation
- Haskell's `Either e a` type
- OCaml's `result` type (added in OCaml 4.03)
- Swift's `Result<Success, Failure>` type

These are essentially sum types $T + E$ with syntactic sugar for propagation. Rust's `?` operator, for example, is approximately:

```
match expr {
    Ok(v) => v,
    Err(e) => return Err(e),
}
```

This combines the explicitness of sum types (the type signature reveals that the function can fail) with the convenience of automatic propagation (via `?`).

---

## 5. Multiple Exception Types

### 5.1 Extensible Exception Types

In ML-family languages, the exception type is extensible: new exception constructors can be declared at any point in the program:

```
exception Not_found
exception Division_by_zero
exception Invalid_argument of string
```

This makes the exception type an open sum -- a sum type that can be extended with new variants without modifying existing code. From a type-theoretic perspective, extensible sums are more complex than closed sums and require special treatment in the type system.

### 5.2 Exception Hierarchies

In object-oriented languages like Java, exceptions form a class hierarchy:

```
Throwable
  |- Error (unrecoverable)
  |- Exception
       |- RuntimeException (unchecked)
       |- IOException (checked)
       |- ...
```

This uses subtyping to organize exceptions. A handler for `Exception` catches all exceptions that are subtypes of `Exception`. This is related to the interaction of exceptions and subtyping, which we will study in Module 04.

### 5.3 Checked vs. Unchecked Exceptions

Java distinguishes between **checked exceptions** (which must be declared in the method signature and handled by the caller) and **unchecked exceptions** (which need not be declared or handled). From a type-theoretic perspective:

- Checked exceptions are part of the function type: $f : A \to B \text{ throws } E$ is essentially $f : A \to B + E$.
- Unchecked exceptions are invisible in the type: $f : A \to B$ might raise any unchecked exception.

The advantage of checked exceptions is that the type system enforces exception handling. The disadvantage is verbosity and the "exception declaration explosion" problem, where changes deep in the call stack require updating exception declarations all the way up.

---

## 6. Exceptions and Other Features

### 6.1 Exceptions and References

When exceptions interact with mutable state, the question arises: should side effects be rolled back when an exception is raised? Consider:

$$
\text{let } r = \text{ref}\;0 \text{ in try } (r := 1;\; \text{raise}\;e) \text{ with } (\lambda \_.\, !\,r)
$$

After the assignment $r := 1$, the exception is raised. The handler reads $!\,r$, which returns $1$ (not $0$). The side effect persists even though the computation "failed."

This is the standard semantics in most languages. Some systems provide **transactional** exception handling, where side effects are rolled back on exception. This requires more complex runtime support (e.g., software transactional memory).

**Formal verification.** To verify that side effects persist, consider the program:

$$\text{let } r = \text{ref}\;0 \text{ in try } (r := 1;\; \text{raise}\;e) \text{ with } (\lambda \_.\, !\,r)$$

Evaluation trace:

| Step | Term (simplified) | Store |
|------|-------------------|-------|
| 0 | $\text{try } (r := 1;\; \text{raise}\;e) \text{ with } \ldots$ | $[l_0 \mapsto 0]$ |
| 1 | $\text{try } (\text{unit};\; \text{raise}\;e) \text{ with } \ldots$ | $[l_0 \mapsto 1]$ |
| 2 | $\text{try } (\text{raise}\;e) \text{ with } \ldots$ | $[l_0 \mapsto 1]$ |
| 3 | $(\lambda \_.\, !\,l_0)\;e$ | $[l_0 \mapsto 1]$ |
| 4 | $!\,l_0$ | $[l_0 \mapsto 1]$ |
| 5 | $1$ | $[l_0 \mapsto 1]$ |

The assignment at step 1 persists through the exception at step 2. The handler sees the modified store.

### 6.2 Exceptions and Continuations

Exceptions can be understood as a restricted form of **continuations**. Raising an exception is analogous to invoking a continuation that was captured at the $\text{try}$ boundary. The handler is the body of that continuation.

More precisely, in continuation-passing style (CPS), a function with exceptions has two continuations: a normal continuation $k$ and an exception continuation $k_{\text{exn}}$:

$$f_{\text{CPS}} : A \to (B \to \text{Ans}) \to (E \to \text{Ans}) \to \text{Ans}$$

Normal return invokes $k$; raising an exception invokes $k_{\text{exn}}$.

### 6.3 Exceptions and the $\bot$ Type

In type theory, the bottom type $\bot$ (or $\text{Void}$) is the type with no inhabitants. An expression of type $\bot$ can never return a value. There is a connection to exceptions: $\text{raise}\;v$ has an arbitrary result type $T$ precisely because it never returns. In some formulations, the "raising" operation has type $E \to \bot$, and the arbitrary result type is recovered via the elimination rule for $\bot$.

---

## 7. Formal Comparison of Error-Handling Mechanisms

We summarize the spectrum of error-handling mechanisms:

| Mechanism | Type Safety | Propagation | Catchable | Type Reveals Errors |
|-----------|-------------|-------------|-----------|---------------------|
| $\text{error}$ | Yes | Automatic | No | No |
| $\text{try}$-$\text{with}$ (simple) | Yes | Automatic | Yes | No |
| $\text{raise}\;v$ + $\text{try}$-$\text{with}$ | Yes | Automatic | Yes | No (unchecked) |
| Checked exceptions | Yes | Declared | Yes | Yes |
| $\text{Option}\;T$ | Yes | Manual | Yes (pattern match) | Yes |
| $\text{Result}\;T\;E$ | Yes | Manual (or `?`) | Yes (pattern match) | Yes |

Each mechanism represents a different point in the design space, trading off between convenience (automatic propagation) and explicitness (error visibility in types).

---

## 8. Advanced: Algebraic Effects Preview

Exceptions are a specific instance of a more general concept: **algebraic effects** (Plotkin and Pretnar, 2009). In the algebraic effects framework, raising an exception is performing an effect operation:

$$\text{raise} : E \to \bot$$

and the handler provides an interpretation of this operation. The key insight is that while exceptions never resume the computation at the raise point, algebraic effects can. A handler can choose to:

- Abort the computation (as exceptions do),
- Resume the computation with a value (as "resumable exceptions" or "restartable conditions" in Common Lisp do),
- Resume the computation multiple times (for nondeterminism).

This generalization will be studied in detail in Module 09 (Lecture 09d).

For now, the essential point is that exceptions are the simplest and most widely deployed algebraic effect. Understanding their typing and semantics provides the foundation for the general theory.

---

## 9. Examples

### 9.1 Safe Division

$$\textit{safediv} = \lambda m : \text{Nat}.\, \lambda n : \text{Nat}.\, \text{if } (\text{iszero}\;n) \text{ then } (\text{raise}\;\text{"div-by-zero"}) \text{ else } (m / n)$$

Type: $\text{Nat} \to \text{Nat} \to \text{Nat}$ (the exception is invisible in the type).

### 9.2 List Lookup with Exception

$$\textit{nth} = \text{fix}\;(\lambda f : \text{List}\;\text{Nat} \to \text{Nat} \to \text{Nat}.\, \lambda l.\, \lambda n.\,$$

$$\text{case } l \text{ of } \text{nil} \Rightarrow \text{raise}\;\text{"index"} \mid \text{cons}(h, t) \Rightarrow \text{if } (\text{iszero}\;n) \text{ then } h \text{ else } f\;t\;(\text{pred}\;n))$$

### 9.3 Nested Exception Handling

$$\text{try } (\text{try } (\text{raise}\;1) \text{ with } (\lambda n.\, \text{raise}\;(n + 10))) \text{ with } (\lambda n.\, n)$$

Evaluation:

$$\to \text{try } ((\lambda n.\, \text{raise}\;(n + 10))\;1) \text{ with } (\lambda n.\, n)$$

$$\to \text{try } (\text{raise}\;(1 + 10)) \text{ with } (\lambda n.\, n)$$

$$\to \text{try } (\text{raise}\;11) \text{ with } (\lambda n.\, n)$$

$$\to (\lambda n.\, n)\;11$$

$$\to 11$$

The inner handler catches the exception, re-raises a modified value, and the outer handler catches the re-raised exception.

### 9.4 Exception-Based Backtracking

Exceptions can implement backtracking search. Consider a function that searches for a value satisfying a predicate in a list:

$$\textit{find} = \lambda p : \text{Nat} \to \text{Bool}.\, \text{fix}\;(\lambda f : \text{List}\;\text{Nat} \to \text{Nat}.$$

$$\quad \lambda l : \text{List}\;\text{Nat}.\, \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow \text{raise}\;\text{"not found"}$$

$$\quad\quad \mid\; \text{inr}\;c \Rightarrow \text{if}\;(p\;(\pi_1\;c))\;\text{then}\;(\pi_1\;c)\;\text{else}\;f\;(\pi_2\;c))$$

If no element satisfies the predicate, the exception propagates out. The caller can catch it:

$$\text{try}\;(\textit{find}\;(\lambda n.\, \text{iszero}\;n)\;l)\;\text{with}\;(\lambda \_.\, \text{-}1)$$

This pattern -- using exceptions for "not found" -- is common in ML-family languages. OCaml's standard library function `List.find` raises `Not_found` when no element matches.

### 9.5 Exception Safety in the Presence of State

When exceptions and references interact, maintaining invariants becomes challenging. Consider a function that temporarily modifies a reference and then restores it:

$$\lambda r : \text{Ref}\;\text{Nat}.\, \text{let}\;\textit{old} = \;!\,r\;\text{in}$$

$$\quad r := 0;\;$$

$$\quad \text{let}\;\textit{result} = f\;\text{unit}\;\text{in}$$

$$\quad r := \textit{old};\;$$

$$\quad \textit{result}$$

If $f$ raises an exception, the restoration $r := \textit{old}$ is never executed, and $r$ is left in a modified state. This is the **exception safety** problem: ensuring that invariants are maintained even when exceptions occur.

Solutions include:

1. **Finally blocks:** $\text{try}\;t_1\;\text{finally}\;t_2$ executes $t_2$ whether or not $t_1$ raises an exception.
2. **RAII (Resource Acquisition Is Initialization):** Resources are managed by objects whose destructors run automatically (used in C++ and Rust).
3. **Transactional exception handling:** Side effects are rolled back on exception (used in software transactional memory).

---

## 10. Formal Semantics with References and Exceptions Combined

### 10.1 Combined Evaluation Judgment

When exceptions and references are both present, the evaluation judgment has the form:

$$t \mid \mu \to t' \mid \mu'$$

Exception propagation rules must also thread the store. For example:

$$\frac{}{(\text{raise}\;v)\;t_2 \mid \mu \to \text{raise}\;v \mid \mu} \quad \text{(E-AppRaise1)}$$

$$\frac{}{v_1\;(\text{raise}\;v) \mid \mu \to \text{raise}\;v \mid \mu} \quad \text{(E-AppRaise2)}$$

$$\frac{}{\text{ref}\;(\text{raise}\;v) \mid \mu \to \text{raise}\;v \mid \mu} \quad \text{(E-RefRaise)}$$

$$\frac{}{!\,(\text{raise}\;v) \mid \mu \to \text{raise}\;v \mid \mu} \quad \text{(E-DerefRaise)}$$

$$\frac{}{(\text{raise}\;v) := t_2 \mid \mu \to \text{raise}\;v \mid \mu} \quad \text{(E-AssignRaise1)}$$

$$\frac{}{v_1 := (\text{raise}\;v) \mid \mu \to \text{raise}\;v \mid \mu} \quad \text{(E-AssignRaise2)}$$

Note that when an exception propagates, the store is **not** modified. The side effects that occurred before the exception are preserved (Section 9.5), but no new side effects occur during propagation.

### 10.2 Combined Type Safety

**Theorem 10.1 (Progress for STLC + Ref + Exn).** If $\emptyset \mid \Sigma \vdash t : T$ and $\emptyset \mid \Sigma \vdash \mu$, then either:

1. $t$ is a value, or
2. $t = \text{raise}\;v$ for some value $v$, or
3. there exist $t'$ and $\mu'$ such that $t \mid \mu \to t' \mid \mu'$.

**Theorem 10.2 (Preservation for STLC + Ref + Exn).** If $\emptyset \mid \Sigma \vdash t : T$ and $\emptyset \mid \Sigma \vdash \mu$ and $t \mid \mu \to t' \mid \mu'$, then there exists $\Sigma' \supseteq \Sigma$ such that $\emptyset \mid \Sigma' \vdash t' : T$ and $\emptyset \mid \Sigma' \vdash \mu'$.

The proofs combine the techniques from Lecture 03a (store typing extension) and this lecture (error/exception handling). The key observation is that exception propagation rules do not modify the store, so $\Sigma' = \Sigma$ in those cases.

---

## Summary

- **Simple errors** ($\text{error}$) provide a type-safe mechanism for signaling unrecoverable failures. The $\text{error}$ term has any type and propagates through all evaluation contexts.
- **Exception handling** ($\text{try}$-$\text{with}$) adds the ability to catch errors, with the handler providing an alternative computation.
- **Exceptions with values** ($\text{raise}\;t$ and typed handlers) allow exceptions to carry information about the failure.
- **Type safety** is preserved in all three approaches. Progress is modified to include exception forms as possible outcomes; preservation is typically straightforward since $\text{error}$ and $\text{raise}\;v$ have arbitrary types.
- **Exceptions vs. sum types:** exceptions provide automatic propagation at the cost of hiding error information in types. Sum types (and result monads) make errors explicit in types but require manual propagation.
- Exceptions are the simplest instance of **algebraic effects**, a more general framework for computational effects.

---

## Exercises

### Exercise E1

Prove preservation for the rule E-AppRaise2: $v_1\;(\text{raise}\;v) \to \text{raise}\;v$.

That is, show that if $\vdash v_1\;(\text{raise}\;v) : T$, then $\vdash \text{raise}\;v : T$.

### Exercise E2

Consider the term:

$$\text{try}\;((\lambda f : \text{Nat} \to \text{Nat}.\, f\;0)\;(\text{raise}\;42))\;\text{with}\;(\lambda n.\, n + 1)$$

**(a)** Give the complete typing derivation.

**(b)** Trace the evaluation, identifying which rule applies at each step.

**(c)** What is the final value?

### Exercise E3

Design typing and evaluation rules for a $\text{finally}$ construct:

$$\text{try}\;t_1\;\text{finally}\;t_2$$

The semantics should be: evaluate $t_1$. If $t_1$ produces a value $v$, evaluate $t_2$ for its side effects and return $v$. If $t_1$ raises an exception, evaluate $t_2$ for its side effects and re-raise the exception.

State the typing rule and evaluation rules. Prove that your rules preserve type safety.

### Exercise E4

In our formalization, $\text{raise}$ can appear at any type. Some type systems restrict where $\text{raise}$ can appear. Consider a system where $\text{raise}\;t$ has a dedicated type $\text{Exn}$ (rather than an arbitrary type $T$).

**(a)** Would type safety still hold?

**(b)** What programs would become untypable?

**(c)** How would this interact with the $\text{try}$-$\text{with}$ construct?

### Exercise E5 (Challenging)

Prove that the exception monad transformer and direct exception semantics are equivalent. Specifically, show that for any term $t$ in STLC + exceptions:

1. If $t \to^* v$ (normal termination), then the monadic translation $\lbrack\!\lbrack t \rbrack\!\rbrack$ evaluates to $\text{inl}\;v$.
2. If $t \to^* \text{raise}\;v$ (exceptional termination), then $\lbrack\!\lbrack t \rbrack\!\rbrack$ evaluates to $\text{inr}\;v$.

(Define the monadic translation and prove the correspondence by induction on the evaluation derivation.)

---

## 11. Continuation-Passing Style and Exceptions

### 11.1 CPS Transformation

The continuation-passing style (CPS) transformation provides an alternative view of exceptions. In CPS, every function takes an explicit continuation argument representing "what to do next." With exceptions, we add a second continuation for the exception case.

**Standard CPS (without exceptions):**

A function $f : A \to B$ becomes $f_{\text{CPS}} : A \to (B \to \text{Ans}) \to \text{Ans}$.

**CPS with exceptions:**

A function $f : A \to B$ that may raise exceptions of type $E$ becomes:

$$f_{\text{CPS}} : A \to (B \to \text{Ans}) \to (E \to \text{Ans}) \to \text{Ans}$$

where:
- The second argument is the **normal continuation** $k : B \to \text{Ans}$.
- The third argument is the **exception continuation** $k_{\text{exn}} : E \to \text{Ans}$.

**CPS translation of exception constructs:**

$$\lbrack\!\lbrack \text{raise}\;e \rbrack\!\rbrack = \lambda k.\, \lambda k_{\text{exn}}.\, k_{\text{exn}}\;e$$

$$\lbrack\!\lbrack \text{try}\;t\;\text{with}\;h \rbrack\!\rbrack = \lambda k.\, \lambda k_{\text{exn}}.\, \lbrack\!\lbrack t \rbrack\!\rbrack\;k\;(\lambda e.\, \lbrack\!\lbrack h \rbrack\!\rbrack\;e\;k\;k_{\text{exn}})$$

The $\text{try}$-$\text{with}$ construct installs a new exception continuation that invokes the handler $h$. If $h$ itself raises an exception, it propagates to the outer exception continuation $k_{\text{exn}}$.

### 11.2 CPS and Efficiency

The CPS view reveals why exceptions are efficient: raising an exception is just a function call (to $k_{\text{exn}}$), which can be implemented as a jump. The exception continuation is typically a pointer to the nearest enclosing handler, maintained on the call stack.

Modern implementations of exceptions use one of two strategies:

1. **Stack unwinding:** When an exception is raised, the runtime walks up the call stack, popping frames until it finds a handler. This makes raising exceptions expensive but has zero overhead for the non-exceptional case.

2. **Setjmp/longjmp:** The $\text{try}$ construct saves the current execution state (using `setjmp`), and $\text{raise}$ restores it (using `longjmp`). This has some overhead for $\text{try}$ but makes raising exceptions cheap.

### 11.3 Exceptions as Delimited Continuations

There is a precise correspondence between exceptions and **delimited continuations**. The $\text{try}$ construct acts as a **prompt** (delimiter), and $\text{raise}$ acts as an **abort** to the nearest prompt.

In the framework of delimited control operators (Felleisen, 1988):

- $\text{try}\;t\;\text{with}\;h \approx \text{prompt}\;t$ (with the prompt's handler being $h$)
- $\text{raise}\;v \approx \text{abort}\;v$ (abort to the nearest prompt)

The difference from general delimited continuations is that exceptions do not capture the continuation -- they simply discard it. Algebraic effects (Module 09) will generalize this to also capture and resume continuations.

---

## 12. Formal Comparison: Exceptions vs. Option Types

### 12.1 Option Type Encoding

As discussed in Section 4, exceptions can be encoded using option types. We make this precise.

**Definition 12.1 (Exception-free translation).** Given a term $t$ of type $T$ in STLC + exceptions, define its translation $\lbrack\!\lbrack t \rbrack\!\rbrack$ in STLC + sum types as follows:

$$\lbrack\!\lbrack x \rbrack\!\rbrack = \text{inl}\;x$$

$$\lbrack\!\lbrack \lambda x : T.\, t \rbrack\!\rbrack = \text{inl}\;(\lambda x : T.\, \lbrack\!\lbrack t \rbrack\!\rbrack)$$

$$\lbrack\!\lbrack t_1\;t_2 \rbrack\!\rbrack = \text{case}\;\lbrack\!\lbrack t_1 \rbrack\!\rbrack\;\text{of}$$

$$\quad \text{inl}\;f \Rightarrow \text{case}\;\lbrack\!\lbrack t_2 \rbrack\!\rbrack\;\text{of}$$

$$\quad\quad \text{inl}\;a \Rightarrow f\;a$$

$$\quad\quad \mid\; \text{inr}\;e \Rightarrow \text{inr}\;e$$

$$\quad \mid\; \text{inr}\;e \Rightarrow \text{inr}\;e$$

$$\lbrack\!\lbrack \text{raise}\;v \rbrack\!\rbrack = \text{inr}\;v$$

$$\lbrack\!\lbrack \text{try}\;t_1\;\text{with}\;t_2 \rbrack\!\rbrack = \text{case}\;\lbrack\!\lbrack t_1 \rbrack\!\rbrack\;\text{of}$$

$$\quad \text{inl}\;v \Rightarrow \text{inl}\;v$$

$$\quad \mid\; \text{inr}\;e \Rightarrow t_2\;e$$

**Theorem 12.2 (Correctness of translation).** For any term $t$ of type $T$:

1. If $t \to^* v$ (normal evaluation), then $\lbrack\!\lbrack t \rbrack\!\rbrack \to^* \text{inl}\;v$.
2. If $t \to^* \text{raise}\;e$ (uncaught exception), then $\lbrack\!\lbrack t \rbrack\!\rbrack \to^* \text{inr}\;e$.

### 12.2 The Cost of Explicit Propagation

The translation in Section 12.1 reveals the cost of using option types instead of exceptions: every function application must check whether the function or argument is an error. This adds a constant factor of overhead to every operation.

With exceptions, propagation is handled by the runtime (via stack unwinding or setjmp/longjmp), and the non-exceptional path has zero overhead. This is a practical advantage of exceptions over option types for rare error conditions.

However, for errors that occur frequently (e.g., lookup failures in a search), the overhead of exceptions (stack unwinding) may be greater than the overhead of explicit checking. This is why many functional programs use option types for expected failures and exceptions for unexpected failures.

---

## 13. Denotational Semantics of Exceptions

### 13.1 The Exception Monad

The denotational semantics of exceptions uses the **exception monad**:

$$T_E(A) = A + E$$

A computation of type $A$ that may raise an exception of type $E$ denotes a value in $A + E$: either a successful result (left injection) or an exception value (right injection).

The monad operations are:

$$\text{return} : A \to A + E$$

$$\text{return}\;a = \text{inl}\;a$$

$$\text{bind} : (A + E) \to (A \to B + E) \to B + E$$

$$\text{bind}\;(\text{inl}\;a)\;f = f\;a$$

$$\text{bind}\;(\text{inr}\;e)\;f = \text{inr}\;e$$

**Verification of monad laws:**

1. **Left identity:** $\text{bind}\;(\text{return}\;a)\;f = \text{bind}\;(\text{inl}\;a)\;f = f\;a$. Holds.
2. **Right identity:** $\text{bind}\;m\;\text{return}$. If $m = \text{inl}\;a$, then $\text{return}\;a = \text{inl}\;a = m$. If $m = \text{inr}\;e$, then $\text{inr}\;e = m$. Holds.
3. **Associativity:** If $m = \text{inl}\;a$, then $\text{bind}\;(\text{bind}\;m\;f)\;g = \text{bind}\;(f\;a)\;g$ and $\text{bind}\;m\;(\lambda a'.\, \text{bind}\;(f\;a')\;g) = \text{bind}\;(f\;a)\;g$. If $m = \text{inr}\;e$, both sides equal $\text{inr}\;e$. Holds.

### 13.2 Combining State and Exceptions

When both references and exceptions are present, we need to compose the state monad and the exception monad. There are two natural compositions:

1. **State wrapping exceptions:** $\text{Store} \to (\text{Store} \times (A + E))$

   Side effects are rolled back when an exception is raised (the store from before the $\text{try}$ is restored).

2. **Exceptions wrapping state:** $\text{Store} \to ((A \times \text{Store}) + E)$

   Side effects persist even when an exception is raised (the handler sees the modified store).

Our operational semantics (Section 10) implements option (2): side effects persist. This is also the behavior of most practical languages (OCaml, Java, Python). Option (1) corresponds to transactional semantics.

The choice between (1) and (2) is a design decision with significant practical implications. Monad transformers (Liang, Hudak, and Jones, 1995) provide a systematic way to compose monads, but the order of composition matters and determines which semantics you get.

---

## Further Reading

- Pierce, B. C. (2002). *Types and Programming Languages*, Chapter 14: Exceptions.
- Harper, R. (2016). *Practical Foundations for Programming Languages*, Chapter 28: Exceptions.
- Leroy, X., & Pessaux, F. (2000). Type-based analysis of uncaught exceptions. *ACM Transactions on Programming Languages and Systems*, 22(2), 340-377.
- Moggi, E. (1991). Notions of computation and monads. *Information and Computation*, 93(1), 55-92.
- Plotkin, G., & Pretnar, M. (2009). Handlers of algebraic effects. *ESOP 2009*, LNCS 5502, pp. 80-94.
- Wadler, P. (1995). Monads for functional programming. In *Advanced Functional Programming*, LNCS 925, pp. 24-52.
- Benton, N., & Kennedy, A. (2001). Exceptional syntax. *Journal of Functional Programming*, 11(4), 395-410.
- Felleisen, M. (1988). The theory and practice of first-class prompts. *POPL 1988*, pp. 180-190.
- Liang, S., Hudak, P., & Jones, M. (1995). Monad transformers and modular interpreters. *POPL 1995*, pp. 333-343.
- Peyton Jones, S. L., Reid, A., Henderson, F., Hoare, C. A. R., & Marlow, S. (1999). A semantics for imprecise exceptions. *PLDI 1999*, pp. 25-36.
- Filinski, A. (1994). Representing monads. *POPL 1994*, pp. 446-457.
- Pretnar, M. (2015). An introduction to algebraic effects and handlers. *Electronic Notes in Theoretical Computer Science*, 319, 19-35.

---

## Appendix A: Complete Inference Rules for Exceptions

We collect all the typing and evaluation rules for STLC with exceptions (Approach 3: exceptions with values).

**Typing rules:**

$$\frac{\Gamma \vdash t : T_{\text{exn}}}{\Gamma \vdash \text{raise}\;t : T} \quad \text{(T-Raise)}$$

$$\frac{\Gamma \vdash t_1 : T \quad \Gamma \vdash t_2 : T_{\text{exn}} \to T}{\Gamma \vdash \text{try } t_1 \text{ with } t_2 : T} \quad \text{(T-TryWith)}$$

**Evaluation rules (raise reduction):**

$$\frac{t \to t'}{\text{raise}\;t \to \text{raise}\;t'} \quad \text{(E-Raise)}$$

**Evaluation rules (exception propagation through application):**

$$\frac{}{(\text{raise}\;v)\;t_2 \to \text{raise}\;v} \quad \text{(E-AppRaise1)}$$

$$\frac{}{v_1\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-AppRaise2)}$$

**Evaluation rules (exception propagation through other constructs):**

$$\frac{}{\text{if}\;(\text{raise}\;v)\;\text{then}\;t_2\;\text{else}\;t_3 \to \text{raise}\;v} \quad \text{(E-IfRaise)}$$

$$\frac{}{\text{succ}\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-SuccRaise)}$$

$$\frac{}{\text{pred}\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-PredRaise)}$$

$$\frac{}{\text{iszero}\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-IsZeroRaise)}$$

$$\frac{}{(\text{raise}\;v, t_2) \to \text{raise}\;v} \quad \text{(E-PairRaise1)}$$

$$\frac{}{(v_1, \text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-PairRaise2)}$$

$$\frac{}{\pi_1\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-FstRaise)}$$

$$\frac{}{\pi_2\;(\text{raise}\;v) \to \text{raise}\;v} \quad \text{(E-SndRaise)}$$

$$\frac{}{\text{case}\;(\text{raise}\;v)\;\text{of}\;\ldots \to \text{raise}\;v} \quad \text{(E-CaseRaise)}$$

**Evaluation rules (try-with):**

$$\frac{t_1 \to t_1'}{\text{try } t_1 \text{ with } t_2 \to \text{try } t_1' \text{ with } t_2} \quad \text{(E-TryStep)}$$

$$\frac{}{\text{try } v \text{ with } t_2 \to v} \quad \text{(E-TryV)}$$

$$\frac{}{\text{try } (\text{raise}\;v) \text{ with } t_2 \to t_2\;v} \quad \text{(E-TryCatch)}$$

**General pattern.** All exception propagation rules follow the schema: when $\text{raise}\;v$ appears in an evaluation position (where the next step would normally reduce a subexpression), the entire enclosing construct reduces to $\text{raise}\;v$. The only construct that "catches" the exception (instead of propagating it) is $\text{try}$-$\text{with}$.

## Appendix B: Decision Tree for Exception Evaluation

Given a term $t$, the evaluator follows this decision tree:

1. Is $t$ a value? If yes, return $t$.
2. Is $t = \text{raise}\;v$ (a fully evaluated raise)? If yes, $t$ is an exception -- propagate or catch depending on context.
3. Is $t = \text{raise}\;t'$ where $t'$ is not a value? If yes, evaluate $t'$ (by E-Raise).
4. Is $t$ a compound term (application, conditional, etc.)?
   - Identify the leftmost non-value subterm in evaluation position.
   - If that subterm is $\text{raise}\;v$, apply the appropriate propagation rule.
   - Otherwise, step the subterm (by the appropriate congruence rule).
5. Is $t = \text{try}\;t_1\;\text{with}\;t_2$?
   - If $t_1$ is a value, apply E-TryV.
   - If $t_1 = \text{raise}\;v$, apply E-TryCatch.
   - Otherwise, step $t_1$ inside the try (by E-TryStep).

## Appendix C: Detailed Preservation Proof for E-TryCatch

**Goal:** If $\vdash \text{try}\;(\text{raise}\;v)\;\text{with}\;t_2 : T$ and $\text{try}\;(\text{raise}\;v)\;\text{with}\;t_2 \to t_2\;v$, then $\vdash t_2\;v : T$.

**Step 1: Invert T-TryWith.**

From $\vdash \text{try}\;(\text{raise}\;v)\;\text{with}\;t_2 : T$, by inversion of T-TryWith:

- $\vdash \text{raise}\;v : T$
- $\vdash t_2 : T_{\text{exn}} \to T$

**Step 2: Invert T-Raise.**

From $\vdash \text{raise}\;v : T$, by inversion of T-Raise:

- $\vdash v : T_{\text{exn}}$

(Note that the type $T$ in T-Raise is arbitrary -- it is the type of the enclosing context. The only constraint is that $v$ has type $T_{\text{exn}}$.)

**Step 3: Apply T-App.**

From $\vdash t_2 : T_{\text{exn}} \to T$ and $\vdash v : T_{\text{exn}}$, by T-App:

- $\vdash t_2\;v : T$

This is exactly what we needed. $\square$

**Remark.** This proof reveals the elegant interaction between the typing rules: T-Raise gives the exception value the exception type $T_{\text{exn}}$, T-TryWith requires the handler to accept $T_{\text{exn}}$, and E-TryCatch applies the handler to the exception value. The types mesh perfectly.

## Appendix D: Exception Semantics as a Free Monad

For readers familiar with algebraic effects (preview of Module 09), exceptions can be understood as the free monad for the signature:

$$\text{Exc}(X) = E + X$$

The operations are:

- $\text{raise} : E \to X$ (the effect operation, producing no result)
- $\text{return} : A \to \text{Free}(\text{Exc}, A)$ (pure computation)

A handler for this free monad is exactly a function $E \to A$ (what to do when an exception is raised) together with a function $A \to A$ (what to do when computation succeeds, usually the identity).

This perspective unifies our three approaches:

1. **Simple error** = free monad for $\text{Exc}(X) = 1 + X$ (no exception data).
2. **Exceptions with values** = free monad for $\text{Exc}(X) = E + X$.
3. **Algebraic effects** (Module 09) = free monad for an arbitrary signature, where handlers can choose to resume the computation.

The key insight is that the handler in $\text{try}\;t\;\text{with}\;h$ is exactly the algebra map $E \to A$ that gives semantics to the effect operation. This algebraic perspective explains why exception handlers compose naturally and why the typing rules have the form they do: $h : T_{\text{exn}} \to T$ is a morphism interpreting the effect in the result type $T$.

## Appendix E: Exceptions and Evaluation Order

The interaction between exceptions and evaluation order deserves careful attention, as it affects which exception is raised when multiple subexpressions can fail.

**Left-to-right evaluation.** In our calculus, application evaluates left-to-right: first $t_1$, then $t_2$, then the body. This means:

$$(\text{raise}\;e_1)\;(\text{raise}\;e_2) \to \text{raise}\;e_1$$

The exception from the function position is raised first, and $e_2$ is never evaluated.

**Right-to-left evaluation.** Some languages (e.g., OCaml, which does not specify evaluation order) might instead evaluate $t_2$ first:

$$(\text{raise}\;e_1)\;(\text{raise}\;e_2) \to \text{raise}\;e_2$$

**Non-deterministic evaluation.** If the evaluation order is unspecified, the result is non-deterministic: either $e_1$ or $e_2$ could be raised. This is one reason why languages like OCaml leave argument evaluation order unspecified -- it allows the compiler freedom to optimize, at the cost of making exception behavior less predictable.

**Theorem.** Regardless of evaluation order, type safety (Progress and Preservation) still holds. The choice of evaluation order affects *which* well-typed result is produced, but not *whether* the result is well-typed. $\square$
