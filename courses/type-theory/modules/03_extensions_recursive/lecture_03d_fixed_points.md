---
title: "Lecture 03d: Fixed Points & the Y Combinator"
tags:
  - type-theory
  - extensions
  - lecture
---
# Lecture 03d: Fixed Points & the Y Combinator

> **Module 03 -- Extensions & Recursive Types (Weeks 5-6)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the $\text{fix}$ operator as a primitive of the simply typed lambda calculus and state its typing and evaluation rules.
2. **Demonstrate** how $\text{fix}$ enables the definition of recursive functions in a language without built-in recursion.
3. **Derive** the untyped Y combinator $Y = \lambda f.\, (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$ and prove that $Y\;f =_\beta f\;(Y\;f)$.
4. **Explain** why the Y combinator is untypable in STLC but becomes typable with recursive types.
5. **Construct** the call-by-value Z combinator and explain why it is necessary for strict evaluation.
6. **Encode** mutual recursion using $\text{fix}$ applied to tuples of functions.
7. **Analyze** the impact of $\text{fix}$ on normalization: prove that STLC $+$ $\text{fix}$ is Turing-complete and non-normalizing.
8. **Articulate** the trade-off between expressiveness (general recursion) and totality (guaranteed termination).

---

## 1. Motivation

### 1.1 The Problem of Recursion in STLC

In the simply typed lambda calculus, there is no way to define a recursive function. Consider the factorial function. Informally, we want:

$$\textit{fact} = \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times \textit{fact}\;(\text{pred}\;n)$$

But this is not a valid definition in STLC: the right-hand side refers to $\textit{fact}$ itself. The STLC binds variables via $\lambda$-abstraction, and a $\lambda$-abstraction cannot refer to itself -- there is no name for the function being defined within its own body.

In the untyped lambda calculus, this is solved by the Y combinator, which computes fixed points of functions. We will study the Y combinator in detail, then introduce the typed $\text{fix}$ operator, and finally connect the two via recursive types.

### 1.2 Fixed Points in Mathematics

**Definition 1.1 (Fixed point).** Given a function $f : A \to A$, a **fixed point** of $f$ is an element $x \in A$ such that $f(x) = x$.

For defining recursive functions, we want a fixed-point operator at the level of terms: an operator $\text{fix}$ such that $\text{fix}\;f = f\;(\text{fix}\;f)$. Given a "template" function $f$ that takes a "recursive call" as its first argument, $\text{fix}\;f$ produces the function that satisfies the recursive equation.

**Example.** For factorial, define:

$$F = \lambda f : \text{Nat} \to \text{Nat}.\, \lambda n : \text{Nat}.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times f\;(\text{pred}\;n)$$

Then $\text{fix}\;F$ is the factorial function. Indeed:

$$\text{fix}\;F = F\;(\text{fix}\;F) = \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times (\text{fix}\;F)\;(\text{pred}\;n)$$

---

## 2. The $\text{fix}$ Operator as a Primitive

### 2.1 Syntax

We extend the syntax with a single new term form:

$$t ::= \ldots \mid \text{fix}\;t$$

### 2.2 Typing Rule

$$\frac{\Gamma \vdash t : T \to T}{\Gamma \vdash \text{fix}\;t : T} \quad \text{(T-Fix)}$$

The argument to $\text{fix}$ must be a function from $T$ to $T$ for some type $T$. The result is a value of type $T$ -- a fixed point of the function.

**Remark.** The type $T$ is typically itself a function type. For example, to define factorial:

- $F : (\text{Nat} \to \text{Nat}) \to (\text{Nat} \to \text{Nat})$, so $T = \text{Nat} \to \text{Nat}$.
- $\text{fix}\;F : \text{Nat} \to \text{Nat}$.

### 2.3 Evaluation Rules

$$\frac{t \to t'}{\text{fix}\;t \to \text{fix}\;t'} \quad \text{(E-Fix)}$$

$$\frac{}{\text{fix}\;(\lambda x : T.\, t) \to [x \mapsto \text{fix}\;(\lambda x : T.\, t)]\,t} \quad \text{(E-FixBeta)}$$

The key rule is E-FixBeta: evaluating $\text{fix}\;(\lambda x : T.\, t)$ substitutes the entire $\text{fix}$ expression for $x$ in $t$. This "unrolls" the recursion by one step: the body $t$ receives the $\text{fix}$ expression as its "recursive call."

**Remark.** The term $\text{fix}\;(\lambda x : T.\, t)$ is **not** a value. Each time it is demanded, it unrolls the recursion by one step. This means that $\text{fix}\;(\lambda x : T.\, x)$ diverges: it reduces to itself.

### 2.4 Derived Form: $\text{letrec}$

Many languages provide a $\text{letrec}$ construct for defining recursive bindings. This is syntactic sugar for $\text{fix}$:

$$\text{letrec } f : T = t_1 \text{ in } t_2 \;\;\stackrel{\text{def}}{=}\;\; \text{let } f = \text{fix}\;(\lambda f : T.\, t_1) \text{ in } t_2$$

For example:

$$\text{letrec } \textit{fact} : \text{Nat} \to \text{Nat} = \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times \textit{fact}\;(\text{pred}\;n) \text{ in } \textit{fact}\;5$$

desugars to:

$$\text{let } \textit{fact} = \text{fix}\;(\lambda \textit{fact} : \text{Nat} \to \text{Nat}.\, \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times \textit{fact}\;(\text{pred}\;n)) \text{ in } \textit{fact}\;5$$

---

## 3. Examples with $\text{fix}$

### 3.1 Factorial

$$\textit{fact} = \text{fix}\;(\lambda f : \text{Nat} \to \text{Nat}.\, \lambda n : \text{Nat}.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times f\;(\text{pred}\;n))$$

**Evaluation of $\textit{fact}\;3$:**

$$\textit{fact}\;3$$

$$= (\text{fix}\;F)\;3 \quad \text{where } F = \lambda f.\, \lambda n.\, \ldots$$

$$\to (F\;(\text{fix}\;F))\;3 \quad \text{(E-FixBeta)}$$

$$= (\lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times (\text{fix}\;F)\;(\text{pred}\;n))\;3$$

$$\to \text{if } (\text{iszero}\;3) \text{ then } 1 \text{ else } 3 \times (\text{fix}\;F)\;(\text{pred}\;3)$$

$$\to 3 \times (\text{fix}\;F)\;2$$

$$\to 3 \times (F\;(\text{fix}\;F))\;2$$

$$\to 3 \times 2 \times (\text{fix}\;F)\;1$$

$$\to 3 \times 2 \times 1 \times (\text{fix}\;F)\;0$$

$$\to 3 \times 2 \times 1 \times 1$$

$$= 6$$

### 3.2 Fibonacci

$$\textit{fib} = \text{fix}\;(\lambda f : \text{Nat} \to \text{Nat}.\, \lambda n : \text{Nat}.$$

$$\quad \text{if } (\text{iszero}\;n) \text{ then } 0$$

$$\quad \text{else if } (\text{iszero}\;(\text{pred}\;n)) \text{ then } 1$$

$$\quad \text{else } f\;(\text{pred}\;n) + f\;(\text{pred}\;(\text{pred}\;n)))$$

### 3.3 List Operations

Using the recursive type $\text{List}\;T = \mu X.\, \text{Unit} + (T \times X)$ from Lecture 03c:

**Sum of a list of naturals:**

$$\textit{sum} = \text{fix}\;(\lambda f : \text{List}\;\text{Nat} \to \text{Nat}.\, \lambda l : \text{List}\;\text{Nat}.$$

$$\quad \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow 0$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow \pi_1\;p + f\;(\pi_2\;p))$$

**Append:**

$$\textit{append} = \text{fix}\;(\lambda f : \text{List}\;T \to \text{List}\;T \to \text{List}\;T.\, \lambda l_1.\, \lambda l_2.$$

$$\quad \text{case}\;(\text{unfold}\;l_1)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow l_2$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow \text{cons}\;(\pi_1\;p)\;(f\;(\pi_2\;p)\;l_2))$$

---

## 4. The Untyped Y Combinator

### 4.1 Definition

In the untyped lambda calculus, fixed points can be computed without any primitive:

$$Y = \lambda f.\, (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$$

### 4.2 Fixed-Point Property

**Theorem 4.1.** For any term $f$, $Y\;f =_\beta f\;(Y\;f)$.

*Proof.*

$$Y\;f$$

$$= (\lambda f'.\, (\lambda x.\, f'\;(x\;x))\,(\lambda x.\, f'\;(x\;x)))\;f$$

$$\to_\beta (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$$

$$\to_\beta f\;((\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x)))$$

Now observe that $(\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$ is exactly the result of reducing $Y\;f$ by one step. Therefore:

$$Y\;f \to_\beta f\;(Y\;f) \quad \square$$

More precisely, let $\omega_f = \lambda x.\, f\;(x\;x)$. Then $Y\;f \to_\beta \omega_f\;\omega_f \to_\beta f\;(\omega_f\;\omega_f)$. And $\omega_f\;\omega_f$ is the result of reducing $Y\;f$, so $Y\;f \to_\beta^* f\;(Y\;f)$.

### 4.3 Why Y Is Untypable in STLC

The subterm $\lambda x.\, f\;(x\;x)$ requires $x$ to be used both as a function (in $x\;x$, where $x$ is in function position) and as an argument (in $x\;x$, where $x$ is in argument position). If $x : A$, then $x\;x$ requires $A = A \to B$ for some $B$, which has no finite solution in the simple type system.

**Theorem 4.2.** The Y combinator $\lambda f.\, (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$ has no type in STLC.

*Proof.* Suppose for contradiction that $\Gamma \vdash Y : S$ for some $\Gamma, S$. Then $\Gamma, f : A \vdash (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x)) : B$ for some $A, B$ with $S = A \to B$. For this application to type-check, the two copies of $\lambda x.\, f\;(x\;x)$ must have types $C \to B$ and $C$ for some $C$. In particular, $\Gamma, f : A, x : C \vdash x\;x : D$ for some $D$. This requires $C = C \to D$. Since types in STLC are finite trees, there is no type $C$ satisfying $C = C \to D$. Contradiction. $\square$

### 4.4 Typing Y with Recursive Types

With recursive types, we can solve $C = C \to D$. Let $D_f = \mu X.\, X \to B$ where $B$ is the desired result type. Then:

$$\text{unfold}\;D_f = D_f \to B$$

A term of type $D_f$ can be unfolded to obtain a function from $D_f$ to $B$, enabling the self-application pattern.

**The typed Y combinator:**

$$Y_T = \lambda f : (T \to T).\, (\lambda x : D_T.\, f\;((\text{unfold}\;x)\;x))\,(\text{fold}\;(\lambda x : D_T.\, f\;((\text{unfold}\;x)\;x)))$$

where $D_T = \mu X.\, X \to T$.

**Typing derivation:**

Let $\omega = \lambda x : D_T.\, f\;((\text{unfold}\;x)\;x)$.

1. $x : D_T \vdash \text{unfold}\;x : D_T \to T$ (by T-Unfold, since $[X \mapsto D_T](X \to T) = D_T \to T$).
2. $x : D_T \vdash (\text{unfold}\;x)\;x : T$ (by T-App, since $\text{unfold}\;x : D_T \to T$ and $x : D_T$).
3. $f : T \to T, x : D_T \vdash f\;((\text{unfold}\;x)\;x) : T$ (by T-App).
4. $f : T \to T \vdash \omega : D_T \to T$ (by T-Abs).
5. $f : T \to T \vdash \text{fold}\;\omega : D_T$ (by T-Fold, since $D_T \to T = [X \mapsto D_T](X \to T)$).
6. $f : T \to T \vdash \omega\;(\text{fold}\;\omega) : T$ (by T-App).
7. $\vdash Y_T : (T \to T) \to T$ (by T-Abs).

**Verification of the fixed-point property:**

$$Y_T\;g$$

$$\to \omega\;(\text{fold}\;\omega) \quad \text{where } \omega = \lambda x.\, g\;((\text{unfold}\;x)\;x)$$

$$\to g\;((\text{unfold}\;(\text{fold}\;\omega))\;(\text{fold}\;\omega))$$

$$\to g\;(\omega\;(\text{fold}\;\omega))$$

And $\omega\;(\text{fold}\;\omega)$ is the result of evaluating $Y_T\;g$, so $Y_T\;g \to^* g\;(Y_T\;g)$.

---

## 5. The Call-by-Value Z Combinator

### 5.1 The Problem with Y under Strict Evaluation

The Y combinator works correctly under lazy (call-by-name or normal-order) evaluation. Under strict (call-by-value) evaluation, $Y\;f$ diverges:

$$Y\;f \to (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$$

$$\to f\;((\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x)))$$

At this point, under call-by-value, we must evaluate the argument $(\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$ before applying $f$. But this is the same expression we started with, leading to infinite regress.

### 5.2 The Z Combinator

The solution is to "eta-expand" the recursive call, delaying it under a lambda:

$$Z = \lambda f.\, (\lambda x.\, f\;(\lambda v.\, x\;x\;v))\,(\lambda x.\, f\;(\lambda v.\, x\;x\;v))$$

The key change is replacing $x\;x$ with $\lambda v.\, x\;x\;v$. This wraps the self-application in a lambda, preventing immediate evaluation.

### 5.3 Fixed-Point Property of Z

**Theorem 5.1.** Under call-by-value evaluation, for any value $g$:

$$Z\;g \to^* g\;(\lambda v.\, Z\;g\;v)$$

and $\lambda v.\, Z\;g\;v$ is extensionally equal to $Z\;g$ (they produce the same result when applied to any argument).

*Proof.*

Let $\omega_g = \lambda x.\, g\;(\lambda v.\, x\;x\;v)$.

$$Z\;g \to \omega_g\;\omega_g$$

$$\to g\;(\lambda v.\, \omega_g\;\omega_g\;v)$$

Now $\lambda v.\, \omega_g\;\omega_g\;v$ is a value (a lambda), so $g$ can be applied to it. When this value is eventually applied to some argument $a$:

$$(\lambda v.\, \omega_g\;\omega_g\;v)\;a \to \omega_g\;\omega_g\;a$$

And $\omega_g\;\omega_g$ is $Z\;g$ (after one step of reduction), so the recursive call proceeds. $\square$

### 5.4 Typed Z Combinator

In the typed setting with recursive types:

$$Z_T = \lambda f : (T \to S) \to (T \to S).\,$$

$$\quad (\lambda x : D.\, f\;(\lambda v : T.\, (\text{unfold}\;x)\;x\;v))\;(\text{fold}\;(\lambda x : D.\, f\;(\lambda v : T.\, (\text{unfold}\;x)\;x\;v)))$$

where $D = \mu X.\, X \to T \to S$.

This has type $((T \to S) \to (T \to S)) \to T \to S$.

### 5.5 Relationship to $\text{fix}$

The $\text{fix}$ primitive and the Z combinator serve the same purpose but differ in implementation:

- $\text{fix}$ is a primitive that the evaluator handles directly via E-FixBeta.
- $Z$ is a lambda term that computes fixed points using self-application, requiring recursive types for typing.

In a language with recursive types, $\text{fix}$ can be defined as a derived form using $Z$ (or the typed Y combinator). Conversely, $\text{fix}$ can be taken as primitive, and recursive types provide an independent mechanism for the same expressiveness.

**Encoding $\text{fix}$ via $Z$:**

$$\text{fix}\;f \;\;\stackrel{\text{def}}{=}\;\; Z\;(\lambda g.\, \lambda v.\, f\;g\;v)\;\text{unit}$$

(This encoding is somewhat simplified; the exact form depends on the types involved.)

**Encoding $Z$ via $\text{fix}$:**

$$Z\;f \;\;\stackrel{\text{def}}{=}\;\; \text{fix}\;(\lambda g.\, f\;g)$$

This is trivial: $\text{fix}\;(\lambda g.\, f\;g)$ reduces to $f\;(\text{fix}\;(\lambda g.\, f\;g))$, which is $f\;(Z\;f)$.

### 5.6 Why Call-by-Value Needs Z, Not Y

To understand concretely why Y fails under call-by-value, let us trace the evaluation of $Y\;F$ where $F = \lambda f.\, \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } 1 \text{ else } n \times f\;(\text{pred}\;n)$ (the factorial template).

Under call-by-value, we must evaluate the argument to a value before applying a function.

$$Y\;F$$

$$= (\lambda f.\, (\lambda x.\, f\;(x\;x))\;(\lambda x.\, f\;(x\;x)))\;F$$

$$\to (\lambda x.\, F\;(x\;x))\;(\lambda x.\, F\;(x\;x))$$

$$\to F\;((\lambda x.\, F\;(x\;x))\;(\lambda x.\, F\;(x\;x)))$$

Now we must evaluate the argument $(\lambda x.\, F\;(x\;x))\;(\lambda x.\, F\;(x\;x))$ before applying $F$. But this is exactly the same expression we just obtained two steps ago! We are in an infinite loop:

$$(\lambda x.\, F\;(x\;x))\;(\lambda x.\, F\;(x\;x))$$

$$\to F\;((\lambda x.\, F\;(x\;x))\;(\lambda x.\, F\;(x\;x)))$$

$$\to \ldots$$

The Z combinator avoids this by wrapping the self-application in a lambda: $\lambda v.\, x\;x\;v$ is a value (it is a lambda), so it does not trigger further evaluation. The self-application $x\;x$ is deferred until $v$ is supplied.

### 5.7 Other Fixed-Point Combinators

The Y and Z combinators are not the only fixed-point combinators. In the untyped lambda calculus, there are infinitely many:

- **Turing's combinator:** $\Theta = (\lambda x.\, \lambda y.\, y\;(x\;x\;y))\;(\lambda x.\, \lambda y.\, y\;(x\;x\;y))$

  This is a call-by-name fixed-point combinator with the property that $\Theta\;f \to_\beta f\;(\Theta\;f)$ in just one step (unlike Y, which takes two).

- **Klop's combinator:** A combinator using 27 copies of a subterm, notable for demonstrating that fixed-point combinators can have arbitrary complexity.

In the typed setting (STLC + recursive types), all of these can be typed using the same technique: the type $\mu X.\, X \to T$ enables the self-application pattern.

---

## 6. Mutual Recursion

### 6.1 The Problem

Some functions are naturally defined in terms of each other. The classic example:

$$\textit{iseven} = \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } \text{true} \text{ else } \textit{isodd}\;(\text{pred}\;n)$$

$$\textit{isodd} = \lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } \text{false} \text{ else } \textit{iseven}\;(\text{pred}\;n)$$

Neither function can be defined independently using $\text{fix}$ applied to a single function.

### 6.2 Encoding via Products

The standard encoding packages mutually recursive functions into a single tuple and uses $\text{fix}$ on the tuple:

$$\text{fix}\;(\lambda p : (\text{Nat} \to \text{Bool}) \times (\text{Nat} \to \text{Bool}).$$

$$\quad (\lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } \text{true} \text{ else } (\pi_2\;p)\;(\text{pred}\;n),$$

$$\quad \;\lambda n.\, \text{if } (\text{iszero}\;n) \text{ then } \text{false} \text{ else } (\pi_1\;p)\;(\text{pred}\;n)))$$

Let $P = (\text{Nat} \to \text{Bool}) \times (\text{Nat} \to \text{Bool})$. The template function has type $P \to P$, taking a pair of functions (the "recursive calls") and producing a pair of functions (the "definitions").

After taking the fixed point:

$$\text{fix}\;F : P$$

we extract the components:

$$\textit{iseven} = \pi_1\;(\text{fix}\;F) : \text{Nat} \to \text{Bool}$$

$$\textit{isodd} = \pi_2\;(\text{fix}\;F) : \text{Nat} \to \text{Bool}$$

### 6.3 General Mutual Recursion

For $n$ mutually recursive functions $f_1, \ldots, f_n$ of types $T_1, \ldots, T_n$, we use:

$$\text{fix}\;(\lambda p : T_1 \times \cdots \times T_n.\, (b_1, \ldots, b_n)) : T_1 \times \cdots \times T_n$$

where each $b_i$ is the body of $f_i$ with recursive calls to $f_j$ replaced by $\pi_j\;p$.

### 6.4 Derived Form: $\text{letrec}$ with Multiple Bindings

$$\text{letrec } f_1 : T_1 = b_1 \text{ and } f_2 : T_2 = b_2 \text{ in } t$$

desugars to:

$$\text{let } p = \text{fix}\;(\lambda p : T_1 \times T_2.\, ([f_1 \mapsto \pi_1\;p, f_2 \mapsto \pi_2\;p]\,b_1, [f_1 \mapsto \pi_1\;p, f_2 \mapsto \pi_2\;p]\,b_2))$$

$$\text{in } [f_1 \mapsto \pi_1\;p, f_2 \mapsto \pi_2\;p]\,t$$

### 6.5 Example: Even and Odd Evaluation Trace

Let us trace the evaluation of $\textit{iseven}\;2$ using the encoding from Section 6.2.

Let $P = (\text{Nat} \to \text{Bool}) \times (\text{Nat} \to \text{Bool})$ and:

$$F = \lambda p : P.\, (\lambda n.\, \text{if}\;(\text{iszero}\;n)\;\text{then}\;\text{true}\;\text{else}\;(\pi_2\;p)\;(\text{pred}\;n),$$

$$\quad\quad\quad\quad\quad \lambda n.\, \text{if}\;(\text{iszero}\;n)\;\text{then}\;\text{false}\;\text{else}\;(\pi_1\;p)\;(\text{pred}\;n))$$

Then $\textit{iseven} = \pi_1\;(\text{fix}\;F)$ and $\textit{isodd} = \pi_2\;(\text{fix}\;F)$.

$$\textit{iseven}\;2 = \pi_1\;(\text{fix}\;F)\;2$$

First, $\text{fix}\;F$ unrolls:

$$\text{fix}\;F \to F\;(\text{fix}\;F) = (\textit{even\_body}, \textit{odd\_body})$$

where $\textit{even\_body}$ and $\textit{odd\_body}$ use $\text{fix}\;F$ for recursive calls. Then:

$$\pi_1\;(\textit{even\_body}, \textit{odd\_body})\;2 \to \textit{even\_body}\;2$$

$$= (\lambda n.\, \text{if}\;(\text{iszero}\;n)\;\text{then}\;\text{true}\;\text{else}\;\textit{isodd}\;(\text{pred}\;n))\;2$$

$$\to \text{if}\;(\text{iszero}\;2)\;\text{then}\;\text{true}\;\text{else}\;\textit{isodd}\;(\text{pred}\;2)$$

$$\to \text{if}\;\text{false}\;\text{then}\;\text{true}\;\text{else}\;\textit{isodd}\;1$$

$$\to \textit{isodd}\;1$$

$$= (\lambda n.\, \text{if}\;(\text{iszero}\;n)\;\text{then}\;\text{false}\;\text{else}\;\textit{iseven}\;(\text{pred}\;n))\;1$$

$$\to \text{if}\;(\text{iszero}\;1)\;\text{then}\;\text{false}\;\text{else}\;\textit{iseven}\;0$$

$$\to \textit{iseven}\;0$$

$$= (\lambda n.\, \text{if}\;(\text{iszero}\;n)\;\text{then}\;\text{true}\;\text{else}\;\ldots)\;0$$

$$\to \text{if}\;\text{true}\;\text{then}\;\text{true}\;\text{else}\;\ldots$$

$$\to \text{true}$$

So $\textit{iseven}\;2 = \text{true}$, as expected.

---

## 7. Type Safety

### 7.1 Progress

**Theorem 7.1 (Progress for STLC + $\text{fix}$).** If $\vdash t : T$, then either $t$ is a value or there exists $t'$ such that $t \to t'$.

*Proof.* By induction on the derivation of $\vdash t : T$. The only new case is:

**Case T-Fix:** $t = \text{fix}\;t_1$ with $\vdash t_1 : T \to T$.

By IH, either $t_1$ is a value or $t_1 \to t_1'$.

- If $t_1 \to t_1'$, then $\text{fix}\;t_1 \to \text{fix}\;t_1'$ by E-Fix.
- If $t_1$ is a value, then by the canonical forms lemma for function types, $t_1 = \lambda x : T.\, t_{12}$ for some $t_{12}$. Then $\text{fix}\;(\lambda x : T.\, t_{12}) \to [x \mapsto \text{fix}\;(\lambda x : T.\, t_{12})]\,t_{12}$ by E-FixBeta. $\square$

### 7.2 Preservation

**Theorem 7.2 (Preservation for STLC + $\text{fix}$).** If $\vdash t : T$ and $t \to t'$, then $\vdash t' : T$.

*Proof.* By induction on $t \to t'$. The only new cases are:

**Case E-Fix:** $\text{fix}\;t_1 \to \text{fix}\;t_1'$ where $t_1 \to t_1'$. By inversion of T-Fix, $\vdash t_1 : T \to T$. By IH, $\vdash t_1' : T \to T$. By T-Fix, $\vdash \text{fix}\;t_1' : T$.

**Case E-FixBeta:** $\text{fix}\;(\lambda x : T.\, t_{12}) \to [x \mapsto \text{fix}\;(\lambda x : T.\, t_{12})]\,t_{12}$.

By inversion of T-Fix, $\vdash \lambda x : T.\, t_{12} : T \to T$. By inversion of T-Abs, $x : T \vdash t_{12} : T$.

We need $\vdash [x \mapsto \text{fix}\;(\lambda x : T.\, t_{12})]\,t_{12} : T$. By the substitution lemma, it suffices to show $\vdash \text{fix}\;(\lambda x : T.\, t_{12}) : T$. By T-Abs, $\vdash \lambda x : T.\, t_{12} : T \to T$. By T-Fix, $\vdash \text{fix}\;(\lambda x : T.\, t_{12}) : T$. $\square$

---

## 8. Impact on Normalization and Expressiveness

### 8.1 Loss of Strong Normalization

**Theorem 8.1.** STLC $+$ $\text{fix}$ is not strongly normalizing.

*Proof.* Consider the term:

$$\text{fix}\;(\lambda x : \text{Unit}.\, x) : \text{Unit}$$

Evaluation:

$$\text{fix}\;(\lambda x : \text{Unit}.\, x) \to [x \mapsto \text{fix}\;(\lambda x : \text{Unit}.\, x)]\,x = \text{fix}\;(\lambda x : \text{Unit}.\, x) \to \ldots$$

This term is well typed but reduces to itself, hence diverges. $\square$

A simpler diverging term at any type $T$:

$$\Omega_T = \text{fix}\;(\lambda x : T.\, x) : T$$

### 8.2 Turing Completeness

**Theorem 8.2.** STLC $+$ $\text{fix}$ $+$ $\text{Nat}$ (with the standard arithmetic primitives) is Turing-complete.

*Proof sketch.* We can encode any partial recursive function using $\text{fix}$ for general recursion and the arithmetic primitives for basic operations. The encoding of $\mu$-recursion (unbounded search) uses $\text{fix}$:

$$\mu\text{-search}\;f = \text{fix}\;(\lambda g : \text{Nat} \to \text{Nat}.\, \lambda n : \text{Nat}.$$

$$\quad \text{if } (\text{iszero}\;(f\;n)) \text{ then } n \text{ else } g\;(\text{succ}\;n))\;0$$

Since the partial recursive functions are exactly the Turing-computable functions, the system is Turing-complete. $\square$

### 8.3 The Expressiveness-Totality Trade-off

There is a fundamental tension in type system design:

| Property | STLC | STLC + fix | STLC + $\mu$ |
|----------|------|------------|--------------|
| Strong normalization | Yes | No | No |
| Turing-complete | No | Yes | Yes |
| Type inference decidable | Yes | Yes | Depends |
| All programs terminate | Yes | No | No |
| Can express all algorithms | No | Yes | Yes |
| Logical consistency (Curry-Howard) | Yes | No | No |

**The dilemma:**

- **Total languages** (like STLC, System F, Agda, Coq) guarantee termination but cannot express all computable functions. They maintain the Curry-Howard correspondence: every type is a provable proposition.

- **Partial languages** (like STLC + $\text{fix}$, PCF, ML, Haskell) can express all computable functions but cannot guarantee termination. From the Curry-Howard perspective, $\text{fix}$ is unsound: it can "prove" any proposition (since $\text{fix}\;(\lambda x.\, x) : T$ for any $T$, including $\text{Void}$).

Most practical programming languages choose expressiveness (partial) over totality. Some proof assistants (Agda, Coq) choose totality but provide escape hatches for general recursion.

### 8.4 Taming General Recursion

Several approaches attempt to recover some guarantees while retaining expressiveness:

1. **Sized types** (Abel, 2004): Type indices track the "size" of recursive arguments, ensuring that recursion is structurally decreasing.

2. **Type-and-effect systems**: Effects (nontermination, exceptions, I/O) are tracked in the type, separating total and partial functions.

3. **Partiality monad**: General recursion is encapsulated in a monad, keeping the base language total:

$$\text{partial}\;T = \mu X.\, T + X$$

A partial computation is either a completed result ($\text{inl}\;v$) or a "step" that defers to a further computation ($\text{inr}\;k$).

4. **Guarded recursion** (Nakano, 2000): A modality $\triangleright$ ("later") ensures that recursive references are only accessed "later," guaranteeing productivity of corecursive definitions.

---

## 9. Historical Perspective

### 9.1 Curry's Paradox

The fixed-point combinator reveals a deep connection to logic. Under the Curry-Howard correspondence, $\text{fix} : (T \to T) \to T$ corresponds to the logical principle:

$$(P \implies P) \implies P$$

This is not a valid logical principle -- it allows deriving any proposition $P$ from the tautology $P \implies P$. This is known as **Curry's paradox** and is why $\text{fix}$ breaks the logical interpretation of types.

### 9.2 Turing's Fixed-Point Theorem

The existence of a fixed-point combinator in the untyped lambda calculus is related to **Turing's fixed-point theorem**: in any Turing-complete system, every computable function has a fixed point. This is also connected to the recursion theorem in computability theory, Kleene's second recursion theorem, and Godel's self-reference lemma.

### 9.3 Domain Theory

The mathematical semantics of $\text{fix}$ is given by domain theory (Scott, 1969). In a domain-theoretic model:

- Types denote pointed CPOs (complete partial orders with a bottom element $\bot$).
- $\text{fix}\;f$ denotes the least fixed point of the continuous function $\lbrack\!\lbrack f \rbrack\!\rbrack$:

$$\lbrack\!\lbrack \text{fix}\;f \rbrack\!\rbrack = \bigsqcup_{n \geq 0} \lbrack\!\lbrack f \rbrack\!\rbrack^n(\bot)$$

This is well-defined by the Kleene fixed-point theorem: every continuous function on a pointed CPO has a least fixed point, which is the supremum of the ascending chain $\bot \sqsubseteq f(\bot) \sqsubseteq f^2(\bot) \sqsubseteq \ldots$

The bottom element $\bot$ represents nontermination, and $\text{fix}\;(\lambda x.\, x) = \bot$ -- the "least defined" element.

---

## 10. Advanced: Fixed Points in Other Type Systems

### 10.1 System F

In System F (polymorphic lambda calculus, Module 06), the Y combinator is still untypable without recursive types. However, System F can encode many recursive data types using Church encodings:

$$\text{Nat}_F = \forall X.\, (X \to X) \to X \to X$$

This encoding provides structural recursion (iteration) but not general recursion. Adding $\text{fix}$ to System F gives System F + $\text{fix}$ (essentially the core of ML/Haskell).

### 10.2 Dependent Type Theory

In dependent type theories used as proof assistants (Coq, Agda, Lean), $\text{fix}$ is not available because it would destroy logical consistency. Instead, these systems provide:

- **Structural recursion** over inductively defined types, with a termination checker ensuring that recursive calls are on structurally smaller arguments.
- **Well-founded recursion** over arbitrary well-founded relations.

These mechanisms are weaker than $\text{fix}$ (they cannot express all computable functions) but preserve the logical interpretation.

### 10.3 PCF

Plotkin's PCF (Programming Computable Functions, 1977) is essentially STLC + $\text{Nat}$ + $\text{fix}$. It is one of the most studied programming languages in semantics, serving as a canonical example of a Turing-complete typed language. Much of the theory of domain semantics, full abstraction, and logical relations was developed in the context of PCF.

---

## Summary

- The **$\text{fix}$ operator** provides general recursion in the typed lambda calculus: $\text{fix}\;f$ computes a fixed point of $f$, satisfying $\text{fix}\;f = f\;(\text{fix}\;f)$.
- The **typing rule** T-Fix requires $f : T \to T$ and yields $\text{fix}\;f : T$.
- The **evaluation rule** E-FixBeta unrolls the recursion: $\text{fix}\;(\lambda x.\, t) \to [x \mapsto \text{fix}\;(\lambda x.\, t)]\,t$.
- The **Y combinator** $Y = \lambda f.\, (\lambda x.\, f\;(x\;x))\,(\lambda x.\, f\;(x\;x))$ computes fixed points in the untyped lambda calculus but is untypable in STLC.
- With **recursive types**, Y becomes typable via $D = \mu X.\, X \to T$.
- The **Z combinator** is the call-by-value variant of Y, using eta-expansion to delay self-application.
- **Mutual recursion** is encoded via $\text{fix}$ applied to tuples.
- Adding $\text{fix}$ to STLC destroys **strong normalization** and **logical consistency** but provides **Turing completeness**.
- The **expressiveness-totality trade-off** is fundamental: practical languages choose expressiveness; proof assistants choose totality.

---

## Exercises

### Exercise E1

Define the Ackermann function using $\text{fix}$:

$$A(0, n) = n + 1$$

$$A(m+1, 0) = A(m, 1)$$

$$A(m+1, n+1) = A(m, A(m+1, n))$$

(Hint: you will need to use $\text{fix}$ on a function of type $\text{Nat} \to \text{Nat} \to \text{Nat}$.)

Verify that $A(1, 1) = 3$ by tracing the evaluation.

### Exercise E2

Using the product-based encoding of mutual recursion, define the following three mutually recursive functions:

$$f(n) = \text{if } n = 0 \text{ then } 1 \text{ else } g(n - 1)$$

$$g(n) = \text{if } n = 0 \text{ then } 2 \text{ else } h(n - 1)$$

$$h(n) = \text{if } n = 0 \text{ then } 3 \text{ else } f(n - 1)$$

What is $f(5)$?

### Exercise E3

Prove that the term $\text{fix}\;(\lambda f : T \to T.\, \lambda x : T.\, f\;(f\;x))$ diverges for any $T$ and any argument.

(Hint: show that $(\text{fix}\;F)\;v$ reduces to $(\text{fix}\;F)\;((\text{fix}\;F)\;v)$, which requires evaluating $(\text{fix}\;F)\;v$ again.)

### Exercise E4

The **Curry-Howard** interpretation of $\text{fix} : (T \to T) \to T$ says that for any proposition $P$, if $P \implies P$ then $P$. This is clearly unsound logically.

**(a)** Construct a term of type $\text{Void}$ (the empty type) using $\text{fix}$.

**(b)** Explain why this does not actually produce a value of type $\text{Void}$ (even though the term is well typed).

**(c)** How do proof assistants like Coq and Agda prevent this unsoundness?

### Exercise E5 (Challenging)

Define the **McCarthy 91 function** using $\text{fix}$:

$$M(n) = \begin{cases} n - 10 & \text{if } n > 100 \\ M(M(n + 11)) & \text{if } n \leq 100 \end{cases}

$$
Verify by evaluation that $M(99) = 91$ and $M(101) = 91$.

### Exercise E6 (Challenging)

Show that $\text{fix}$ can simulate a $\text{while}$ loop. Define:

$$\text{while}\;b\;\text{do}\;c$$

as syntactic sugar using $\text{fix}$, where $b : \text{Unit} \to \text{Bool}$ is the loop condition and $c : \text{Unit} \to \text{Unit}$ is the loop body (both are thunked to ensure they are re-evaluated at each iteration). The result has type $\text{Unit}$.

---

## 11. Denotational Semantics of $\text{fix}$

### 11.1 Least Fixed Points

In domain theory, the denotation of $\text{fix}\;f$ is the **least fixed point** of $\lbrack\!\lbrack f \rbrack\!\rbrack$ in the domain $\lbrack\!\lbrack T \rbrack\!\rbrack$:

$$\lbrack\!\lbrack \text{fix}\;f \rbrack\!\rbrack = \text{lfp}(\lbrack\!\lbrack f \rbrack\!\rbrack) = \bigsqcup_{n \geq 0} \lbrack\!\lbrack f \rbrack\!\rbrack^n(\bot)$$

where $\bot$ is the bottom element of the domain (representing nontermination) and $\lbrack\!\lbrack f \rbrack\!\rbrack^n$ denotes $n$-fold iteration of $\lbrack\!\lbrack f \rbrack\!\rbrack$:

$$\lbrack\!\lbrack f \rbrack\!\rbrack^0(\bot) = \bot$$

$$\lbrack\!\lbrack f \rbrack\!\rbrack^1(\bot) = \lbrack\!\lbrack f \rbrack\!\rbrack(\bot)$$

$$\lbrack\!\lbrack f \rbrack\!\rbrack^2(\bot) = \lbrack\!\lbrack f \rbrack\!\rbrack(\lbrack\!\lbrack f \rbrack\!\rbrack(\bot))$$

$$\vdots$$

### 11.2 Kleene's Fixed-Point Theorem

**Theorem 11.1 (Kleene).** Let $(D, \sqsubseteq)$ be a pointed CPO and $f : D \to D$ a continuous function. Then $f$ has a least fixed point, which equals $\bigsqcup_{n \geq 0} f^n(\bot)$.

*Proof sketch.*

1. The chain $\bot \sqsubseteq f(\bot) \sqsubseteq f^2(\bot) \sqsubseteq \ldots$ is ascending because $\bot$ is the least element and $f$ is monotone.
2. The supremum $d^* = \bigsqcup_{n \geq 0} f^n(\bot)$ exists because $D$ is a CPO.
3. $f(d^*) = f(\bigsqcup_n f^n(\bot)) = \bigsqcup_n f^{n+1}(\bot) = \bigsqcup_{n \geq 1} f^n(\bot) = d^*$ (using continuity of $f$ and the fact that adding $\bot$ to the front of the chain does not change its supremum).
4. If $d$ is any fixed point of $f$, then $\bot \sqsubseteq d$, so $f(\bot) \sqsubseteq f(d) = d$, so $f^n(\bot) \sqsubseteq d$ for all $n$, so $d^* \sqsubseteq d$. $\square$

### 11.3 Example: Factorial as Iteration

For the factorial function, $f = F = \lambda g.\, \lambda n.\, \text{if } n = 0 \text{ then } 1 \text{ else } n \times g(n-1)$.

$$F^0(\bot) = \bot \quad \text{(undefined everywhere)}$$

$$F^1(\bot) = \lambda n.\, \text{if } n = 0 \text{ then } 1 \text{ else } n \times \bot(n-1) = \lambda n.\, \begin{cases} 1 & n = 0 \\ \bot & n > 0 \end{cases}

$$

$$F^2(\bot) = F(F^1(\bot)) = \lambda n.\, \begin{cases} 1 & n = 0 \\ 1 & n = 1 \\ \bot & n > 1 \end{cases}

$$

$$F^3(\bot) = \lambda n.\, \begin{cases} 1 & n = 0 \\ 1 & n = 1 \\ 2 & n = 2 \\ \bot & n > 2 \end{cases}

$$
The supremum is the factorial function defined on all natural numbers.

### 11.4 Fixed Points and Types as Propositions

Under the Curry-Howard correspondence, the type of $\text{fix}$ is:

$$\text{fix} : (P \implies P) \implies P$$

Logically, this says: "from $P \implies P$ (which is a tautology for any $P$), conclude $P$." This is unsound -- it allows proving any proposition $P$. For example:

$$\text{fix}\;(\lambda x : \text{Void}.\, x) : \text{Void}$$

This gives us a term of type $\text{Void}$ (the empty type, corresponding to falsehood). Under Curry-Howard, this means we have a proof of falsehood -- the system is inconsistent.

This is why proof assistants (Coq, Agda, Lean) do not include an unrestricted $\text{fix}$. They only allow recursion that provably terminates (structural recursion, well-founded recursion), preserving logical consistency.

---

## 12. Connections to Computability Theory

### 12.1 The Recursion Theorem

The existence of fixed-point combinators in the lambda calculus is closely related to Kleene's **recursion theorem** in computability theory.

**Theorem 12.1 (Kleene's Recursion Theorem).** For any total computable function $f$, there exists an index $n$ such that $\varphi_n = \varphi_{f(n)}$, where $\varphi_n$ denotes the $n$-th partial recursive function.

In other words, every "transformation" of programs ($f$) has a "fixed point" -- a program $n$ that computes the same function as $f(n)$. The Y combinator is the lambda calculus analogue: for every $f$, $Y\;f$ computes the same function as $f\;(Y\;f)$.

### 12.2 Rice's Theorem

**Theorem 12.2 (Rice).** Every nontrivial extensional property of programs is undecidable.

This is a consequence of the recursion theorem and is related to the fact that $\text{fix}$ produces nonterminating programs: if we could decide whether a program terminates, we could decide nontrivial properties. But $\text{fix}$ allows constructing arbitrary nonterminating programs, making such decisions impossible.

### 12.3 Godel's Incompleteness and Self-Reference

The Y combinator encodes **self-reference**: $Y\;f$ is a program that "knows its own code" (it can pass itself as an argument). This is the computational analogue of the self-referential sentence in Godel's incompleteness theorem:

"This sentence is not provable."

In the lambda calculus: $Y\;(\lambda x.\, \neg\;x)$ is a "term that says it is not a normal form" -- it reduces to the negation of itself. This is the source of nontermination, just as Godel's sentence is the source of incompleteness.

---

## 13. Practical Implementation Strategies

### 13.1 Implementing $\text{fix}$ in Interpreters

There are several strategies for implementing $\text{fix}$ in an interpreter:

**Strategy 1: Explicit unrolling (substitution-based).**

Implement E-FixBeta directly: when evaluating $\text{fix}\;(\lambda x.\, t)$, substitute the entire $\text{fix}$ expression for $x$ in $t$ and evaluate the result.

```
eval (Fix (Abs(x, body))) = eval (subst x (Fix (Abs(x, body))) body)
```

This is simple but may be inefficient for deeply recursive calls, as each unrolling creates a new copy of the $\text{fix}$ expression.

**Strategy 2: Recursive closures (environment-based).**

When evaluating $\text{fix}\;(\lambda x.\, t)$, create a closure for $\lambda x.\, t$ whose environment binds $x$ to the closure itself (tying the knot).

```ocaml
let rec env' = (x, VClosure(x, body, env')) :: env in
eval env' body
```

This is more efficient because no copying occurs -- the closure simply references itself.

**Strategy 3: Mutable reference (Landin's knot).**

Allocate a mutable cell, store a dummy value, create the closure with the cell in its environment, and then update the cell to point to the closure:

```ocaml
let cell = ref (VUnit) in
let clos = VClosure(x, body, (x, VRef cell) :: env) in
cell := clos;
eval ((x, clos) :: env) body
```

This is essentially what Lecture 03a's Landin's knot does.

### 13.2 Implementing $\text{fix}$ in Compilers

In compiled languages, recursive functions are typically implemented using the call stack. The function's code is stored at a fixed address, and recursive calls are ordinary function calls to that address. No explicit $\text{fix}$ or Y combinator is needed at runtime.

The compiler transforms:

```
let rec f x = ... f ... in ...
```

into:

1. Allocate a closure for `f` (with a placeholder for the recursive reference).
2. Backpatch the closure to point to itself.
3. Continue with the body.

This is essentially Strategy 3 above, implemented at the machine code level.

---

## Further Reading

- Pierce, B. C. (2002). *Types and Programming Languages*, Sections 11.11 (fix) and Chapter 20 (recursive types).
- Plotkin, G. D. (1977). LCF considered as a programming language. *Theoretical Computer Science*, 5(3), 223-255.
- Gunter, C. A. (1992). *Semantics of Programming Languages: Structures and Techniques*, Chapter 5: Fixed Points.
- Barendregt, H. P. (1984). *The Lambda Calculus: Its Syntax and Semantics*, Chapter 6: Fixed-point combinators.
- Abramsky, S., & Ong, C.-H. L. (1993). Full abstraction in the lazy lambda calculus. *Information and Computation*, 105(2), 159-267.
- Abel, A. (2004). Termination checking with types. *RAIRO -- Theoretical Informatics and Applications*, 38(4), 277-319.
- Nakano, H. (2000). A modality for recursion. *LICS 2000*, pp. 255-266.
- Scott, D. S. (1993). A type-theoretical alternative to ISWIM, CUCH, OWHY. *Theoretical Computer Science*, 121(1-2), 411-440. (Written 1969, published 1993.)
- Gunter, C. A. (1992). *Semantics of Programming Languages: Structures and Techniques*. MIT Press.
- Stoy, J. E. (1977). *Denotational Semantics: The Scott-Strachey Approach to Programming Language Theory*. MIT Press.

---

## Appendix A: Complete Inference Rules for $\text{fix}$

**Typing rule:**

$$\frac{\Gamma \vdash t : T \to T}{\Gamma \vdash \text{fix}\;t : T} \quad \text{(T-Fix)}$$

**Evaluation rules:**

$$\frac{t \to t'}{\text{fix}\;t \to \text{fix}\;t'} \quad \text{(E-Fix)}$$

$$\frac{}{\text{fix}\;(\lambda x : T.\, t) \to [x \mapsto \text{fix}\;(\lambda x : T.\, t)]\,t} \quad \text{(E-FixBeta)}$$

**Derived form ($\text{letrec}$):**

$$\text{letrec } f : T = t_1 \text{ in } t_2 \;\;\stackrel{\text{def}}{=}\;\; (\lambda f : T.\, t_2)\;(\text{fix}\;(\lambda f : T.\, t_1))$$

**Derived form (mutual recursion):**

$$\text{letrec } f_1 : T_1 = b_1 \text{ and } f_2 : T_2 = b_2 \text{ in } t$$

$$\stackrel{\text{def}}{=}\;\; \text{let}\;p = \text{fix}\;(\lambda p : T_1 \times T_2.\, ([f_1 \mapsto \pi_1\;p, f_2 \mapsto \pi_2\;p]\;b_1, [f_1 \mapsto \pi_1\;p, f_2 \mapsto \pi_2\;p]\;b_2))$$

$$\text{in}\;[f_1 \mapsto \pi_1\;p, f_2 \mapsto \pi_2\;p]\;t$$

## Appendix B: Common Recursive Function Patterns

### B.1 Accumulator Pattern

Many recursive functions can be written more efficiently using an accumulator that builds up the result incrementally:

$$\textit{sum\_acc} = \text{fix}\;(\lambda f : \text{List}\;\text{Nat} \to \text{Nat} \to \text{Nat}.\, \lambda l.\, \lambda acc.$$

$$\quad \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow acc$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow f\;(\pi_2\;p)\;(acc + \pi_1\;p))$$

$$\textit{sum} = \lambda l.\, \textit{sum\_acc}\;l\;0$$

The accumulator version is tail-recursive: the recursive call is the last operation, which enables compilers to optimize it into a loop.

### B.2 CPS Pattern

Continuation-passing style can also be used to make recursive functions tail-recursive:

$$\textit{sum\_cps} = \text{fix}\;(\lambda f : \text{List}\;\text{Nat} \to (\text{Nat} \to \text{Nat}) \to \text{Nat}.\, \lambda l.\, \lambda k.$$

$$\quad \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow k\;0$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow f\;(\pi_2\;p)\;(\lambda n.\, k\;(n + \pi_1\;p)))$$

$$\textit{sum} = \lambda l.\, \textit{sum\_cps}\;l\;(\lambda n.\, n)$$

### B.3 Map-Reduce Pattern

The combination of map and fold (reduce) over a recursive type is a common pattern:

$$\textit{map\_reduce} = \Lambda A.\, \Lambda B.\, \lambda f : A \to B.\, \lambda g : B \to B \to B.\, \lambda z : B.$$

$$\quad \text{fix}\;(\lambda h : \text{List}\;A \to B.\, \lambda l.$$

$$\quad\quad \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad\quad \text{inl}\;\_ \Rightarrow z$$

$$\quad\quad\quad \mid\; \text{inr}\;p \Rightarrow g\;(f\;(\pi_1\;p))\;(h\;(\pi_2\;p)))$$

### B.4 Church Encoding of Recursion

An alternative to $\text{fix}$ for recursion over data structures is the **Church encoding** (or **Scott encoding**), which represents data as their own eliminator:

$$\text{ChurchNat} = \forall R.\, (R \to R) \to R \to R$$

$$\text{ChurchList}\;T = \forall R.\, (T \to R \to R) \to R \to R$$

With Church-encoded data, recursion is built into the data type itself -- no separate $\text{fix}$ is needed for structurally recursive functions. However, Church encodings do not support constant-time destructors (e.g., predecessor on naturals) and cannot express general (non-structural) recursion without $\text{fix}$.

The Scott encoding provides constant-time case analysis:

$$\text{ScottNat} = \forall R.\, R \to (\text{ScottNat} \to R) \to R$$

but requires recursive types (note that $\text{ScottNat}$ appears in its own definition), bringing us back to the recursive type framework of Lecture 03c.

## Appendix C: Summary of Expressiveness Results

| System | Strongly Normalizing | Turing-Complete | Has $\text{fix}$ | Has $\mu$ Types |
|--------|---------------------|-----------------|-------------------|-----------------|
| STLC | Yes | No | No | No |
| STLC + $\text{fix}$ | No | Yes | Yes (primitive) | No |
| STLC + $\mu$ | No | Yes | Derivable via $Y$ | Yes |
| STLC + $\text{fix}$ + $\mu$ | No | Yes | Yes | Yes |
| System F | Yes | No | No | No (Church enc.) |
| System F + $\text{fix}$ | No | Yes | Yes | No |
| CoC (Coq/Lean) | Yes | No | Restricted | Inductive only |
| PCF | No | Yes | Yes | No |

Key observations:

1. Either $\text{fix}$ or unrestricted $\mu$ types alone suffice for Turing completeness (given basic arithmetic).
2. Both destroy strong normalization and logical consistency.
3. System F without $\text{fix}$ is more expressive than STLC (it can encode naturals, lists, etc.) but is still strongly normalizing.
4. Proof assistants (CoC) restrict both recursion (structural only) and recursive types (strictly positive only) to maintain consistency.

## Appendix D: Detailed Evaluation of Fibonacci

We trace the evaluation of $\textit{fib}\;4$ where:

$$\textit{fib} = \text{fix}\;(\lambda f.\, \lambda n.\, \text{if}\;(\text{iszero}\;n)\;\text{then}\;0\;\text{else if}\;(\text{iszero}\;(\text{pred}\;n))\;\text{then}\;1\;\text{else}\;f\;(\text{pred}\;n) + f\;(\text{pred}\;(\text{pred}\;n)))$$

Let $F$ denote the lambda body. Then $\textit{fib} = \text{fix}\;F$.

$$\textit{fib}\;4 = (\text{fix}\;F)\;4$$

$$\to (F\;(\text{fix}\;F))\;4 = (\lambda n.\, \ldots)\;4 \quad \text{(E-FixBeta)}$$

$$\to \text{if}\;(\text{iszero}\;4)\;\text{then}\;0\;\text{else if}\;\ldots\;\text{else}\;\textit{fib}\;3 + \textit{fib}\;2$$

$$\to \textit{fib}\;3 + \textit{fib}\;2$$

For $\textit{fib}\;3$:

$$\textit{fib}\;3 \to \textit{fib}\;2 + \textit{fib}\;1$$

For $\textit{fib}\;2$:

$$\textit{fib}\;2 \to \textit{fib}\;1 + \textit{fib}\;0$$

For $\textit{fib}\;1$:

$$\textit{fib}\;1 \to \text{if}\;(\text{iszero}\;1)\;\text{then}\;0\;\text{else if}\;(\text{iszero}\;0)\;\text{then}\;1\;\text{else}\;\ldots$$

$$\to \text{if}\;\text{false}\;\text{then}\;0\;\text{else if}\;\text{true}\;\text{then}\;1\;\text{else}\;\ldots$$

$$\to 1$$

For $\textit{fib}\;0$:

$$\textit{fib}\;0 \to \text{if}\;\text{true}\;\text{then}\;0\;\text{else}\;\ldots \to 0$$

Assembling:

$$\textit{fib}\;2 = 1 + 0 = 1$$

$$\textit{fib}\;3 = 1 + 1 = 2$$

$$\textit{fib}\;4 = 2 + 1 = 3$$

This demonstrates the tree-recursive nature of the naive Fibonacci: $\textit{fib}\;4$ makes 9 recursive calls. The exponential blowup is a well-known issue; it can be addressed by memoization (using references from Lecture 03a!) or by rewriting the algorithm to use an accumulator.

## Appendix E: Memoized Fibonacci via References

Using references (Lecture 03a), we can implement a memoized Fibonacci:

$$\textit{fib\_memo} = \text{let}\;\textit{cache} = \text{ref}\;(\text{nil}) \text{ in}$$

$$\quad \text{fix}\;(\lambda f.\, \lambda n.\,$$

$$\quad\quad \text{case}\;(\text{lookup}\;n\;(!\,\textit{cache}))\;\text{of}$$

$$\quad\quad\quad \text{some}\;v \Rightarrow v$$

$$\quad\quad\quad \mid\; \text{none} \Rightarrow$$

$$\quad\quad\quad\quad \text{let}\;r = \text{if}\;n \leq 1\;\text{then}\;n\;\text{else}\;f\;(n-1) + f\;(n-2)\;\text{in}$$

$$\quad\quad\quad\quad \textit{cache} := \text{cons}\;(n, r)\;(!\,\textit{cache});\;r)$$

This combines three features from Module 03: references (for the cache), recursive types (for the cache list), and $\text{fix}$ (for the recursive function). The memoized version computes $\textit{fib}\;n$ in $O(n)$ time instead of $O(2^n)$.

This example demonstrates the power of combining the language features studied in this module.

## Appendix F: Fixed Points in Denotational Semantics

The denotational semantics of recursive definitions relies fundamentally on least fixed points of continuous functions on complete partial orders (CPOs).

**Definition (Complete Partial Order).** A *CPO* $(D, \sqsubseteq)$ is a partial order with a least element $\bot$ such that every $\omega$-chain $d_0 \sqsubseteq d_1 \sqsubseteq d_2 \sqsubseteq \ldots$ has a least upper bound $\bigsqcup_{i \geq 0} d_i$.

**Definition (Scott Continuity).** A function $f : D \to E$ between CPOs is *Scott-continuous* if it preserves least upper bounds of $\omega$-chains:

$$f\left(\bigsqcup_{i \geq 0} d_i\right) = \bigsqcup_{i \geq 0} f(d_i)$$

Every Scott-continuous function is monotone: $d \sqsubseteq d'$ implies $f(d) \sqsubseteq f(d')$.

**Theorem (Kleene's Fixed Point Theorem).** If $f : D \to D$ is a Scott-continuous function on a CPO $D$, then $f$ has a least fixed point:

$$\text{fix}(f) = \bigsqcup_{i \geq 0} f^i(\bot)$$

*Proof.* The chain $\bot \sqsubseteq f(\bot) \sqsubseteq f^2(\bot) \sqsubseteq \ldots$ is an $\omega$-chain (by induction using monotonicity of $f$ and $\bot \sqsubseteq f(\bot)$). Its least upper bound $d^* = \bigsqcup_{i \geq 0} f^i(\bot)$ exists by completeness. By continuity, $f(d^*) = f(\bigsqcup_i f^i(\bot)) = \bigsqcup_i f^{i+1}(\bot) = \bigsqcup_{i \geq 1} f^i(\bot) = d^*$, so $d^*$ is a fixed point. For leastness, if $f(d) = d$, then $\bot \sqsubseteq d$ and by induction $f^i(\bot) \sqsubseteq d$ for all $i$, so $d^* = \bigsqcup_i f^i(\bot) \sqsubseteq d$. $\square$

**Connection to operational semantics.** The denotational meaning of $\text{fix}\;(\lambda f.\, M)$ is $\bigsqcup_{i \geq 0} F^i(\bot)$ where $F = \lbrack\!\lbrack \lambda f.\, M \rbrack\!\rbrack$. Each approximant $F^i(\bot)$ corresponds to allowing at most $i$ recursive unfoldings. The operational rule E-FixBeta ($\text{fix}\;(\lambda f.\, M) \to [\text{fix}\;(\lambda f.\, M) / f]\,M$) implements the "one more unfolding" step.

**Example.** For factorial, $F = \lambda g.\, \lambda n.\, \text{if}\;n = 0\;\text{then}\;1\;\text{else}\;n \cdot g(n-1)$:

| Approximant | Behavior |
|---|---|
| $F^0(\bot) = \bot$ | Diverges on all inputs |
| $F^1(\bot) = \lambda n.\, \text{if}\;n = 0\;\text{then}\;1\;\text{else}\;\bot$ | Defined only at $0$ |
| $F^2(\bot) = \lambda n.\, \text{if}\;n = 0\;\text{then}\;1\;\text{else}\;n \cdot F^1(\bot)(n-1)$ | Defined at $0, 1$ |
| $F^k(\bot)$ | Defined at $0, 1, \ldots, k-1$ |
| $\bigsqcup_{k} F^k(\bot)$ | Total factorial function |

This chain of approximants makes precise the intuition that recursion "builds up" a function by considering progressively more inputs.

## Appendix G: Historical Notes

The study of fixed-point operators has a rich history intertwined with the foundations of computability and logic.

- **1930s:** Haskell Curry discovered the $Y$ combinator in the context of combinatory logic. Curry's paradox ($Y\;(\lambda x.\, \neg x)$) showed that naive systems with unrestricted self-application are inconsistent.

- **1936:** Alan Turing independently discovered the fixed-point combinator $\Theta$ (the *Turing combinator*). Unlike $Y$, Turing's $\Theta$ satisfies $\Theta\;f \to^* f\;(\Theta\;f)$ directly, without needing $\eta$-expansion.

- **1937:** Stephen Kleene proved the *recursion theorem* (also called the *fixed-point theorem* or *second recursion theorem*), establishing that every computable operator on partial recursive functions has a fixed point. This is the computability-theoretic analogue of our semantic fixed-point theorem.

- **1969:** Dana Scott constructed the first model of the untyped lambda calculus using lattice theory, resolving the longstanding question of whether $D \cong D \to D$ has a nontrivial solution. Scott's $D_\infty$ construction used inverse limits of finite lattices.

- **1972:** Gordon Plotkin introduced PCF (Programming Computable Functions), a typed lambda calculus with a $\text{fix}$ operator, providing the canonical example of a language where fixed points are primitives rather than definable.

- **1993:** The development of *step-indexing* by Appel and McAllester provided an alternative to domain-theoretic techniques for reasoning about recursive definitions, using natural number indices to stratify the recursion.

These developments illustrate the deep connection between fixed-point theory, computability, and programming language semantics. The $\text{fix}$ operator we study in this lecture is the direct descendant of these foundational ideas, now embedded in a typed setting that ensures the fixed points we compute are meaningful.

## Appendix H: Summary of Key Results

We conclude with a concise summary of the main results established in this lecture.

| Result | Statement | Section |
|---|---|---|
| **Type safety of fix** | Progress and Preservation hold for STLC + $\text{fix}$ | Section 5 |
| **Loss of normalization** | $\text{fix}\;(\lambda x : T.\, x) : T$ diverges for any $T$ | Section 6.1 |
| **Turing completeness** | STLC + $\text{fix}$ can encode all partial recursive functions | Section 6.2 |
| **Y untypable in STLC** | The $Y$ combinator has no STLC type | Section 3.1 |
| **Y typable with $\mu$-types** | $Y : (\mu X.\, X \to T) \to T$ in STLC + recursive types | Section 3.2 |
| **Expressiveness hierarchy** | STLC $\subset$ System T $\subset$ System F $\subset$ STLC+fix | Section 6.2 |
| **Kleene's theorem** | Least fixed points exist for Scott-continuous functions | Appendix F |
| **Curry's paradox** | Unrestricted self-application yields inconsistency | Section 6.3 |

**Connections to other modules:**

- **Module 02** (Subtyping): The $\text{fix}$ rule does not require subtyping, but in a system with subtyping, one must ensure that $\text{fix}\;f$ has the same type as $f$'s fixed point, not a supertype.
- **Module 03, Lectures a-c** (References, Exceptions, Recursive Types): As the memoized Fibonacci example (Appendix E) demonstrates, these features combine naturally with $\text{fix}$.
- **Module 05** (Polymorphism): In System F, the polymorphic fixed-point combinator has type $\text{fix} : \forall X.\, (X \to X) \to X$, but this destroys parametricity and strong normalization.
- **Module 08** (Dependent Types): In dependently typed languages, general recursion is typically excluded in favor of structurally recursive definitions, preserving logical consistency.
