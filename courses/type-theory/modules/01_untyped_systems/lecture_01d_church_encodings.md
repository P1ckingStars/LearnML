---
title: "Lecture 01d: Church Encodings and Computability"
tags:
  - type-theory
  - untyped
  - lecture
---
# Lecture 01d: Church Encodings and Computability

> **Module 01 -- Untyped Systems (Weeks 1-2)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Encode** booleans, natural numbers, pairs, and lists as pure lambda terms using Church's technique.
2. **Implement** arithmetic operations (successor, predecessor, addition, multiplication, exponentiation) on Church numerals.
3. **Derive** the predecessor function on Church numerals and explain why it is significantly more complex than successor.
4. **Construct** fixed-point combinators (Y and Theta) and use them to define recursive functions.
5. **Prove** that the Y combinator satisfies the fixed-point equation $Y\; f =_\beta f\; (Y\; f)$.
6. **Explain** the Church-Turing thesis and the sense in which the lambda calculus is equivalent to Turing machines.
7. **Articulate** the "untyped = uni-typed" perspective and its implications for the relationship between the untyped and typed lambda calculi.
8. **Recognize** the limitations of Church encodings and understand why typed settings require different approaches to data.

---

## 1. Motivation

In Lecture 01b, we defined the untyped lambda calculus as a language with only three syntactic forms: variables, abstractions, and applications. There are no built-in numbers, booleans, data structures, or control flow constructs. Yet we claimed that the lambda calculus is Turing-complete -- capable of expressing any computable function.

How is this possible? The answer lies in **Church encodings**: a technique for representing data and operations as pure lambda terms. Named after Alonzo Church, who developed them in the 1930s as part of his effort to build a foundation for mathematics, Church encodings demonstrate that the lambda calculus is not merely a theory of functions but a complete model of computation.

This lecture develops Church encodings systematically, culminating in the Y combinator and the proof that the lambda calculus can express all computable functions.

---

## 2. Core Theory

### 2.1 Church Booleans

The idea behind Church encodings is to represent each datum by its **elimination form** -- a function that performs the data's characteristic operation.

A boolean has two possible values and is used to choose between two alternatives. We encode it as a function of two arguments that selects one of them.

**Definition 2.1 (Church booleans).**

$$
\text{tru} = \lambda t.\, \lambda f.\, t
$$

$$
\text{fls} = \lambda t.\, \lambda f.\, f
$$

The term $\text{tru}$ takes two arguments and returns the first; $\text{fls}$ takes two arguments and returns the second. This directly captures the behavior of a boolean in a conditional expression: $\text{if } b \text{ then } t \text{ else } f$ is simply $b\; t\; f$.

**Definition 2.2 (Conditional).**

$$
\text{test} = \lambda b.\, \lambda t.\, \lambda f.\, b\; t\; f
$$

This is operationally trivial: $\text{test}$ merely applies the boolean $b$ to the two branches. We can verify:

$$
\text{test}\; \text{tru}\; v\; w = (\lambda b.\, \lambda t.\, \lambda f.\, b\; t\; f)\; \text{tru}\; v\; w
$$

$$
\to_\beta^* \text{tru}\; v\; w = (\lambda t.\, \lambda f.\, t)\; v\; w \to_\beta^* v
$$

$$
\text{test}\; \text{fls}\; v\; w \to_\beta^* \text{fls}\; v\; w = (\lambda t.\, \lambda f.\, f)\; v\; w \to_\beta^* w
$$

### 2.2 Boolean Operations

**Definition 2.3 (Logical operations).**

$$
\text{and} = \lambda b.\, \lambda c.\, b\; c\; \text{fls}
$$

If $b$ is true, the result is $c$ (which may be true or false). If $b$ is false, the result is false regardless of $c$.

$$
\text{or} = \lambda b.\, \lambda c.\, b\; \text{tru}\; c
$$

If $b$ is true, the result is true. If $b$ is false, the result is $c$.

$$
\text{not} = \lambda b.\, b\; \text{fls}\; \text{tru}
$$

We swap the two arguments: if $b$ selects the first, it gets false; if it selects the second, it gets true.

**Verification of $\text{not}$:**

$$
\text{not}\; \text{tru} = (\lambda b.\, b\; \text{fls}\; \text{tru})\; \text{tru} \to_\beta \text{tru}\; \text{fls}\; \text{tru} \to_\beta^* \text{fls} \quad \checkmark
$$

$$
\text{not}\; \text{fls} = (\lambda b.\, b\; \text{fls}\; \text{tru})\; \text{fls} \to_\beta \text{fls}\; \text{fls}\; \text{tru} \to_\beta^* \text{tru} \quad \checkmark
$$

**Verification of $\text{and}$:**

$$
\text{and}\; \text{tru}\; \text{tru} \to_\beta^* \text{tru}\; \text{tru}\; \text{fls} \to_\beta^* \text{tru} \quad \checkmark
$$

$$
\text{and}\; \text{tru}\; \text{fls} \to_\beta^* \text{tru}\; \text{fls}\; \text{fls} \to_\beta^* \text{fls} \quad \checkmark
$$

$$
\text{and}\; \text{fls}\; \text{tru} \to_\beta^* \text{fls}\; \text{tru}\; \text{fls} \to_\beta^* \text{fls} \quad \checkmark
$$

$$
\text{and}\; \text{fls}\; \text{fls} \to_\beta^* \text{fls}\; \text{fls}\; \text{fls} \to_\beta^* \text{fls} \quad \checkmark
$$

### 2.3 Church Numerals

Natural numbers are encoded by their **iteration behavior**: the number $n$ is represented by the function that applies a given function $n$ times.

**Definition 2.4 (Church numerals).**

$$
c_0 = \lambda s.\, \lambda z.\, z
$$

$$
c_1 = \lambda s.\, \lambda z.\, s\; z
$$

$$
c_2 = \lambda s.\, \lambda z.\, s\; (s\; z)
$$

$$
c_3 = \lambda s.\, \lambda z.\, s\; (s\; (s\; z))
$$

In general:

$$
c_n = \lambda s.\, \lambda z.\, \underbrace{s\; (s\; (\cdots (s}_{n \text{ times}}\; z) \cdots))
$$

We write $s^n\; z$ as shorthand for $n$ applications of $s$ to $z$. So $c_n = \lambda s.\, \lambda z.\, s^n\; z$.

**Observation.** $c_0 = \lambda s.\, \lambda z.\, z = \text{fls}$. The Church numeral zero is the same term as the Church boolean false. This is a feature, not a bug -- it reflects the deep connection between data representations in the lambda calculus.

### 2.4 Successor

**Definition 2.5 (Successor).**

$$
\text{scc} = \lambda n.\, \lambda s.\, \lambda z.\, s\; (n\; s\; z)
$$

The successor of $n$ applies $s$ one more time: it first iterates $s$ a total of $n$ times (via $n\; s\; z$), then applies $s$ once more.

**Verification:**

$$
\text{scc}\; c_0 = (\lambda n.\, \lambda s.\, \lambda z.\, s\; (n\; s\; z))\; c_0
$$

$$
\to_\beta \lambda s.\, \lambda z.\, s\; (c_0\; s\; z)
$$

$$
= \lambda s.\, \lambda z.\, s\; ((\lambda s.\, \lambda z.\, z)\; s\; z)
$$

$$
\to_\beta^* \lambda s.\, \lambda z.\, s\; z = c_1 \quad \checkmark
$$

**Alternative definition:**

$$
\text{scc}' = \lambda n.\, \lambda s.\, \lambda z.\, n\; s\; (s\; z)
$$

This applies $s$ to $z$ first, then iterates $n$ more times. Both definitions are correct.

### 2.5 Addition

**Definition 2.6 (Addition).**

$$
\text{plus} = \lambda m.\, \lambda n.\, \lambda s.\, \lambda z.\, m\; s\; (n\; s\; z)
$$

The sum $m + n$ applies $s$ a total of $m + n$ times: first $n$ times (via $n\; s\; z$), then $m$ more times (via $m\; s$).

**Alternative definition using successor:**

$$
\text{plus}' = \lambda m.\, \lambda n.\, m\; \text{scc}\; n
$$

This says: to compute $m + n$, start with $n$ and apply the successor function $m$ times.

**Verification of $\text{plus}'\; c_2\; c_1$:**

$$
\text{plus}'\; c_2\; c_1 = c_2\; \text{scc}\; c_1 = (\lambda s.\, \lambda z.\, s\; (s\; z))\; \text{scc}\; c_1
$$

$$
\to_\beta^* \text{scc}\; (\text{scc}\; c_1) = \text{scc}\; c_2 = c_3 \quad \checkmark
$$

### 2.6 Multiplication

**Definition 2.7 (Multiplication).**

$$
\text{times} = \lambda m.\, \lambda n.\, \lambda s.\, m\; (n\; s)
$$

To apply $s$ a total of $m \times n$ times, we iterate "apply $s$ $n$ times" (i.e., $n\; s$) a total of $m$ times.

**Alternative:**

$$
\text{times}' = \lambda m.\, \lambda n.\, m\; (\text{plus}\; n)\; c_0
$$

This says: start with $0$ and add $n$ a total of $m$ times.

**Verification of $\text{times}\; c_2\; c_3$:**

$$
\text{times}\; c_2\; c_3 = (\lambda m.\, \lambda n.\, \lambda s.\, m\; (n\; s))\; c_2\; c_3
$$

$$
\to_\beta^* \lambda s.\, c_2\; (c_3\; s) = \lambda s.\, (\lambda s'.\, \lambda z.\, s'\; (s'\; z))\; (c_3\; s)
$$

$$
\to_\beta \lambda s.\, \lambda z.\, (c_3\; s)\; ((c_3\; s)\; z)
$$

$$
= \lambda s.\, \lambda z.\, s^3\; (s^3\; z) = \lambda s.\, \lambda z.\, s^6\; z = c_6 \quad \checkmark
$$

### 2.7 Exponentiation

**Definition 2.8 (Exponentiation).**

$$
\text{exp} = \lambda m.\, \lambda n.\, n\; m
$$

This is delightfully simple. To compute $m^n$, we use $n$ (the exponent) as an iterator that takes $m$ (the base) and composes it $n$ times. Recalling that $c_n\; f = f^n$ (the $n$-fold composition of $f$), we have:

$$
\text{exp}\; c_m\; c_n = c_n\; c_m = c_m^n
$$

To see that $c_m^n = c_{m^n}$: $c_m$ maps any function $s$ to $s^m$. So $c_m^2 = c_m \circ c_m$ maps $s$ to $s^{m \cdot m} = s^{m^2}$. By induction, $c_m^n$ maps $s$ to $s^{m^n}$, which is $c_{m^n}$.

### 2.8 Testing for Zero

**Definition 2.9 (Test for zero).**

$$
\text{iszro} = \lambda m.\, m\; (\lambda x.\, \text{fls})\; \text{tru}
$$

If $m = c_0$, then $c_0\; f\; z = z$, so the result is $\text{tru}$. If $m = c_n$ for $n \ge 1$, then $c_n\; f\; z = f^n\; z$. Since $f = \lambda x.\, \text{fls}$, any application of $f$ returns $\text{fls}$, so $f^n\; z = \text{fls}$ for all $n \ge 1$.

**Verification:**

$$
\text{iszro}\; c_0 = c_0\; (\lambda x.\, \text{fls})\; \text{tru} = \text{tru} \quad \checkmark
$$

$$
\text{iszro}\; c_1 = c_1\; (\lambda x.\, \text{fls})\; \text{tru} = (\lambda x.\, \text{fls})\; \text{tru} = \text{fls} \quad \checkmark
$$

$$
\text{iszro}\; c_3 = c_3\; (\lambda x.\, \text{fls})\; \text{tru} = (\lambda x.\, \text{fls})\; ((\lambda x.\, \text{fls})\; ((\lambda x.\, \text{fls})\; \text{tru})) \to_\beta^* \text{fls} \quad \checkmark
$$

### 2.9 The Predecessor: A Difficult Encoding

The predecessor function is remarkably more difficult to encode than the successor. Church himself struggled with it, and it was first solved by Stephen Kleene in 1932 (reportedly while having a tooth extracted at the dentist).

The difficulty is that Church numerals are *iterators*: they apply a function $n$ times. Subtracting one application is not directly expressible as iteration.

**Kleene's trick.** The idea is to iterate on *pairs*. We maintain a pair $(i, i-1)$ and use the successor operation on pairs: $(i, i-1) \mapsto (i+1, i)$. Starting from $(0, 0)$ and iterating $n$ times, we get $(n, n-1)$. The predecessor is the second component.

**Definition 2.10 (Church pairs).**

$$
\text{pair} = \lambda f.\, \lambda s.\, \lambda b.\, b\; f\; s
$$

$$
\text{fst} = \lambda p.\, p\; \text{tru}
$$

$$
\text{snd} = \lambda p.\, p\; \text{fls}
$$

A pair $\text{pair}\; v\; w$ is a function that takes a boolean selector $b$ and applies it to $v$ and $w$. If $b = \text{tru}$, the result is $v$ (the first component). If $b = \text{fls}$, the result is $w$ (the second component).

**Verification:**

$$
\text{fst}\; (\text{pair}\; v\; w) = (\lambda p.\, p\; \text{tru})\; (\lambda b.\, b\; v\; w) \to_\beta (\lambda b.\, b\; v\; w)\; \text{tru} \to_\beta \text{tru}\; v\; w \to_\beta^* v \quad \checkmark
$$

**Definition 2.11 (Predecessor).**

$$
\text{zz} = \text{pair}\; c_0\; c_0
$$

$$
\text{ss} = \lambda p.\, \text{pair}\; (\text{snd}\; p)\; (\text{scc}\; (\text{snd}\; p))
$$

Wait -- we actually want the pair to track $(i-1, i)$ so that after $n$ iterations, the first component is $n - 1$. Let us correct:

$$
\text{ss} = \lambda p.\, \text{pair}\; (\text{scc}\; (\text{fst}\; p))\; (\text{fst}\; p)
$$

Hmm, this also has issues. Let us use the standard formulation:

$$
\text{zz} = \text{pair}\; c_0\; c_0
$$

$$
\text{ss} = \lambda p.\, \text{pair}\; (\text{scc}\; (\text{fst}\; p))\; (\text{fst}\; p)
$$

Starting from $\text{zz} = (c_0, c_0)$:

- After 1 iteration: $\text{ss}\; (c_0, c_0) = (\text{scc}\; c_0, c_0) = (c_1, c_0)$
- After 2 iterations: $\text{ss}\; (c_1, c_0) = (\text{scc}\; c_1, c_1) = (c_2, c_1)$
- After 3 iterations: $\text{ss}\; (c_2, c_1) = (\text{scc}\; c_2, c_2) = (c_3, c_2)$
- After $n$ iterations: $(c_n, c_{n-1})$

The predecessor is the second component:

$$
\text{prd} = \lambda m.\, \text{snd}\; (m\; \text{ss}\; \text{zz})
$$

**Verification:**

$$
\text{prd}\; c_0 = \text{snd}\; (c_0\; \text{ss}\; \text{zz}) = \text{snd}\; \text{zz} = \text{snd}\; (\text{pair}\; c_0\; c_0) =_\beta c_0 \quad \checkmark
$$

$$
\text{prd}\; c_3 = \text{snd}\; (c_3\; \text{ss}\; \text{zz}) = \text{snd}\; (\text{ss}\; (\text{ss}\; (\text{ss}\; \text{zz})))
$$

$$
= \text{snd}\; (\text{ss}\; (\text{ss}\; (c_1, c_0))) = \text{snd}\; (\text{ss}\; (c_2, c_1)) = \text{snd}\; (c_3, c_2) =_\beta c_2 \quad \checkmark
$$

**Complexity observation.** While successor runs in $O(1)$ (just wrapping one more application of $s$), predecessor runs in $O(n)$ -- it must iterate through all $n$ steps to compute $n - 1$. This is a fundamental limitation of the Church encoding.

### 2.10 Subtraction

With predecessor in hand, subtraction is straightforward:

$$
\text{sub} = \lambda m.\, \lambda n.\, n\; \text{prd}\; m
$$

To compute $m - n$: start with $m$ and apply the predecessor $n$ times. (If $n > m$, the result is $c_0$, since $\text{prd}\; c_0 = c_0$.)

### 2.11 Encoding Lists

Lists can be encoded similarly to pairs, using a fold-based representation.

**Definition 2.12 (Church lists).**

$$
\text{nil} = \lambda c.\, \lambda n.\, n
$$

$$
\text{cons} = \lambda h.\, \lambda t.\, \lambda c.\, \lambda n.\, c\; h\; (t\; c\; n)
$$

A list is its own fold: it takes a combining function $c$ and a base value $n$, and produces the result of folding $c$ over the list starting from $n$.

$$
\text{nil}\; c\; n = n
$$

$$
(\text{cons}\; a\; (\text{cons}\; b\; (\text{cons}\; c'\; \text{nil})))\; f\; n = f\; a\; (f\; b\; (f\; c'\; n))
$$

This is the right fold over the list $[a, b, c']$.

**Definition 2.13 (List operations).**

$$
\text{head} = \lambda l.\, l\; (\lambda h.\, \lambda t.\, h)\; \text{fls}
$$

The combining function $\lambda h.\, \lambda t.\, h$ discards the tail and returns the head. For a non-empty list, this returns the first element. For an empty list, the result is $\text{fls}$ (a conventional "error" value).

$$
\text{isnil} = \lambda l.\, l\; (\lambda h.\, \lambda t.\, \text{fls})\; \text{tru}
$$

For an empty list, the base case $\text{tru}$ is returned. For a non-empty list, the combining function returns $\text{fls}$.

### 2.12 The Y Combinator and Recursion

All the functions defined so far are non-recursive: they do not refer to themselves. But many interesting computations require recursion (factorial, Fibonacci, sorting, etc.). How do we express recursion in the lambda calculus, where functions are anonymous and have no way to refer to themselves by name?

The answer is the **fixed-point combinator**, also known as the **Y combinator** (due to Haskell Curry).

**Definition 2.14 (Fixed point).** A **fixed point** of a function $f$ is a value $x$ such that $f(x) = x$.

**Definition 2.15 (Fixed-point combinator).** A **fixed-point combinator** is a term $Y$ such that for every term $f$:

$$
Y\; f =_\beta f\; (Y\; f)
$$

That is, $Y\; f$ is a fixed point of $f$.

**Definition 2.16 (Curry's Y combinator).**

$$
Y = \lambda f.\, (\lambda x.\, f\; (x\; x))\; (\lambda x.\, f\; (x\; x))
$$

**Theorem 2.17.** For every term $f$, $Y\; f =_\beta f\; (Y\; f)$.

*Proof.* We compute:

$$
Y\; f = (\lambda f.\, (\lambda x.\, f\; (x\; x))\; (\lambda x.\, f\; (x\; x)))\; f
$$

$$
\to_\beta (\lambda x.\, f\; (x\; x))\; (\lambda x.\, f\; (x\; x))
$$

Let $\omega_f = \lambda x.\, f\; (x\; x)$. Then:

$$
Y\; f \to_\beta \omega_f\; \omega_f = (\lambda x.\, f\; (x\; x))\; \omega_f \to_\beta f\; (\omega_f\; \omega_f) = f\; (Y\; f \to_\beta \omega_f\; \omega_f)
$$

Wait, let us be more careful. We have:

$$
Y\; f \to_\beta \omega_f\; \omega_f \to_\beta f\; (\omega_f\; \omega_f)
$$

And $\omega_f\; \omega_f$ is exactly the term we started with (after the first beta-step from $Y\; f$). So:

$$
Y\; f \to_\beta \omega_f\; \omega_f \to_\beta f\; (\omega_f\; \omega_f)
$$

On the other hand:

$$
f\; (Y\; f) \to_\beta^* f\; (\omega_f\; \omega_f)
$$

So $Y\; f \twoheadrightarrow_\beta f\; (\omega_f\; \omega_f) \twoheadleftarrow_\beta f\; (Y\; f)$, hence $Y\; f =_\beta f\; (Y\; f)$. $\square$

**Caveat for call-by-value.** Under CBV, the Y combinator diverges. The term $Y\; f$ reduces to $\omega_f\; \omega_f$, which reduces to $f\; (\omega_f\; \omega_f)$. But under CBV, before applying $f$, we must evaluate the argument $\omega_f\; \omega_f$ to a value. This argument reduces to $f\; (\omega_f\; \omega_f)$, which again requires evaluating $\omega_f\; \omega_f$, and so on -- we loop forever.

### 2.13 The Call-by-Value Fixed-Point Combinator

For CBV, we need a modified combinator that delays the self-application using an eta-expansion.

**Definition 2.18 (CBV fixed-point combinator, Z combinator).**

$$
Z = \lambda f.\, (\lambda x.\, f\; (\lambda v.\, x\; x\; v))\; (\lambda x.\, f\; (\lambda v.\, x\; x\; v))
$$

The trick is wrapping $x\; x$ inside $\lambda v.\, x\; x\; v$, which is a value (a lambda abstraction) and thus not immediately evaluated under CBV.

**Verification.** Let $\omega_f' = \lambda x.\, f\; (\lambda v.\, x\; x\; v)$. Then:

$$
Z\; f \to_\beta \omega_f'\; \omega_f' = (\lambda x.\, f\; (\lambda v.\, x\; x\; v))\; \omega_f'
$$

$$
\to_\beta f\; (\lambda v.\, \omega_f'\; \omega_f'\; v)
$$

The argument $\lambda v.\, \omega_f'\; \omega_f'\; v$ is a value, so this does not diverge under CBV. When $f$ applies its argument to some value $a$:

$$
(\lambda v.\, \omega_f'\; \omega_f'\; v)\; a \to_\beta \omega_f'\; \omega_f'\; a
$$

And $\omega_f'\; \omega_f'$ is exactly $Z\; f$ (after one beta-step), so the recursive call unfolds correctly.

### 2.14 Turing's Fixed-Point Combinator

An alternative fixed-point combinator, due to Alan Turing:

**Definition 2.19 (Turing's Theta combinator).**

$$
\Theta = (\lambda x.\, \lambda y.\, y\; (x\; x\; y))\; (\lambda x.\, \lambda y.\, y\; (x\; x\; y))
$$

**Theorem 2.20.** For every term $f$, $\Theta\; f \to_\beta^* f\; (\Theta\; f)$ (not just $=_\beta$ but actual reduction).

*Proof.* Let $A = \lambda x.\, \lambda y.\, y\; (x\; x\; y)$. Then $\Theta = A\; A$.

$$
\Theta\; f = A\; A\; f = (\lambda x.\, \lambda y.\, y\; (x\; x\; y))\; A\; f
$$

$$
\to_\beta (\lambda y.\, y\; (A\; A\; y))\; f \to_\beta f\; (A\; A\; f) = f\; (\Theta\; f) \quad \square
$$

The advantage of $\Theta$ over $Y$ is that $\Theta\; f$ actually *reduces* to $f\; (\Theta\; f)$, rather than merely being beta-equivalent to it. This makes it more convenient in some proof contexts.

### 2.15 Recursive Functions via Fixed Points

To define a recursive function, we abstract the recursive call as a parameter and find its fixed point.

**Example 2.21 (Factorial).** Define the "pre-factorial" that takes its recursive self as a parameter:

$$
G = \lambda f.\, \lambda n.\, \text{test}\; (\text{iszro}\; n)\; c_1\; (\text{times}\; n\; (f\; (\text{prd}\; n)))
$$

Then $\text{factorial} = Y\; G$ (or $Z\; G$ under CBV). We have:

$$
\text{factorial}\; c_n = Y\; G\; c_n =_\beta G\; (Y\; G)\; c_n = G\; \text{factorial}\; c_n
$$

$$
= \text{test}\; (\text{iszro}\; c_n)\; c_1\; (\text{times}\; c_n\; (\text{factorial}\; (\text{prd}\; c_n)))
$$

For $n = 0$: $\text{iszro}\; c_0 = \text{tru}$, so the result is $c_1$. Correct: $0! = 1$.

For $n > 0$: $\text{iszro}\; c_n = \text{fls}$, so the result is $\text{times}\; c_n\; (\text{factorial}\; c_{n-1})$. This is $n \cdot (n-1)!$, the correct recursive definition.

**Example 2.22 (Addition via recursion).** An alternative definition of addition:

$$
H = \lambda f.\, \lambda m.\, \lambda n.\, \text{test}\; (\text{iszro}\; m)\; n\; (\text{scc}\; (f\; (\text{prd}\; m)\; n))
$$

$$
\text{add} = Y\; H
$$

This defines $m + n$ by: if $m = 0$, return $n$; otherwise, return $1 + ((m-1) + n)$.

### 2.16 The Existence of Infinitely Many Fixed-Point Combinators

The Y and Theta combinators are not the only fixed-point combinators. In fact, there are infinitely many.

**Proposition 2.23.** For every closed term $t$, the term $Y_t = (\lambda x.\, t\; (x\; x))\; (\lambda x.\, t\; (x\; x))$ satisfies $Y_t =_\beta t\; Y_t$. (This is just $Y\; t$ without the outer lambda.)

Moreover, Statman (1982) showed that in the lambda calculus modulo beta-eta, there are exactly $\aleph_1$ fixed-point combinators that are pairwise non-equivalent.

---

## 3. Computability and the Church-Turing Thesis

### 3.1 Lambda-Definability

**Definition 2.24 (Lambda-definable function).** A function $f : \mathbb{N}^k \to \mathbb{N}$ is **lambda-definable** if there exists a lambda term $F$ such that for all $n_1, \ldots, n_k \in \mathbb{N}$:

$$
F\; c_{n_1}\; \cdots\; c_{n_k} =_\beta c_{f(n_1, \ldots, n_k)}
$$

where $c_n$ denotes the Church numeral for $n$.

### 3.2 The Church-Turing Thesis

**Theorem 2.25 (Church, 1936; Turing, 1936).** The following classes of functions are identical:

1. Functions computable by a Turing machine.
2. Functions computable by the lambda calculus (lambda-definable functions).
3. The general recursive functions (Godel, Herbrand, Kleene).
4. Functions computable by a Post production system.

This equivalence is a mathematical theorem. The **Church-Turing thesis** is the additional philosophical claim that these equivalent classes capture the intuitive notion of "effectively computable function" -- that any function a human could compute by following a well-defined procedure is in one (and hence all) of these classes.

The lambda calculus side of this equivalence was established by Church and Kleene in 1936: they showed that every Turing-computable function is lambda-definable, and conversely.

### 3.3 Representing Turing Machines in the Lambda Calculus

The proof that every Turing-computable function is lambda-definable proceeds by encoding the state, tape, and transition function of a Turing machine as lambda terms, then simulating the machine's execution using the fixed-point combinator for looping. The converse -- that every lambda-definable function is Turing-computable -- is easier: one simply implements a lambda calculus evaluator as a Turing machine.

### 3.4 Consequences

1. **The lambda calculus is Turing-complete.** Any algorithm expressible in any programming language can also be expressed in the lambda calculus (though not necessarily efficiently).

2. **The halting problem is undecidable.** There is no lambda term $H$ such that $H\; M\; c_n = \text{tru}$ if $M\; c_n$ has a normal form, and $H\; M\; c_n = \text{fls}$ otherwise.

3. **The equivalence of lambda terms is undecidable.** There is no algorithm to determine whether two lambda terms are beta-equivalent.

---

## 4. Untyped = Uni-Typed

### 4.1 The Problem with Typing Self-Application

Consider the self-application term $\omega = \lambda x.\, x\; x$. What type should it have?

If $x$ has type $A$, then $x\; x$ requires $x$ to be both a function and its own argument, so $A = A \to B$ for some $B$. But this equation has no solution in a finite type -- $A$ would have to be an infinite type $A \to A \to A \to \cdots$.

The simply typed lambda calculus (Module 02) will reject $\omega$ as untypeable. More generally, the simply typed lambda calculus is strongly normalizing -- every well-typed term has a normal form -- which means it cannot express all computable functions (since it decides the halting problem for its own terms). Adding types gains safety but loses expressiveness.

### 4.2 The Uni-Typed Perspective

Dana Scott (1976) observed that the untyped lambda calculus can be viewed as a *typed* calculus with a single type $D$ satisfying the recursive equation:

$$
D \cong D \to D
$$

That is, $D$ is a type that is isomorphic to the space of functions from $D$ to $D$. Every term has type $D$, every function takes a $D$ and returns a $D$, and self-application is well-typed because $D$ and $D \to D$ are the same.

In this view, "untyped" does not mean "without types" but "with a single type that everything shares." This is why Dana Scott called it "uni-typed." The domain-theoretic construction of $D$ as a limit of an inverse system of approximations was one of the great achievements of denotational semantics.

### 4.3 Implications

This perspective clarifies the relationship between the untyped and typed lambda calculi:

- The untyped lambda calculus is not a "pre-typed" system awaiting the addition of types. It is a typed system in which the type structure is trivial (one type, one rule).
- Adding a richer type system does not add computational power -- the untyped calculus is already Turing-complete. Rather, it restricts the class of expressible programs to those satisfying certain discipline, in exchange for static guarantees (type safety, normalization, etc.).
- The progression through this course -- from the untyped lambda calculus to STLC to System F to dependent types -- is a progression of increasingly refined type disciplines, each ruling out more "bad" programs while still permitting (most of) the "good" ones.

### 4.4 Scott's Domain Equation $D \cong D \to D$

The "untyped = uni-typed" perspective can be made mathematically precise using domain theory. The key result, due to Dana Scott (1969-1976), is the construction of a non-trivial topological space $D$ satisfying:

$$
D \cong [D \to D]
$$

where $[D \to D]$ denotes the space of continuous functions from $D$ to $D$ (with the Scott topology).

In naive set theory, the equation $D = D^D$ has only trivial solutions (the one-element set). But in the category of domains (directed-complete partial orders with continuous maps), non-trivial solutions exist. Scott constructed them as inverse limits of sequences:

$$
D_0 = \{\bot\}, \quad D_{n+1} = [D_n \to D_n], \quad D = \varprojlim D_n
$$

The resulting domain $D_\infty$ is a reflexive domain: it contains a copy of its own function space. Every lambda term can be interpreted as an element of $D_\infty$, and beta-reduction corresponds to equality of denotations.

This construction was a major breakthrough: it provided the first mathematical model of the untyped lambda calculus and resolved longstanding questions about its consistency.

### 4.5 Other Fixed-Point Combinators

Beyond $Y$, $Z$, and $\Theta$, many other fixed-point combinators exist.

**The strict Turing combinator (CBV variant of Theta):**

$$
\Theta_v = (\lambda x.\, \lambda y.\, y\; (\lambda z.\, x\; x\; y\; z))\; (\lambda x.\, \lambda y.\, y\; (\lambda z.\, x\; x\; y\; z))
$$

This is the CBV analog of $\Theta$: the argument is wrapped in a lambda to delay evaluation, exactly as in the Z combinator.

**The Klop combinator.** Jan Willem Klop defined a fixed-point combinator using 26 copies of a term, one for each letter of the alphabet -- a humorous construction demonstrating that fixed-point combinators can take many forms.

**Theorem 2.28 (Every lambda term has a fixed point).** For every lambda term $f$, there exists a term $t$ such that $t =_\beta f\; t$.

*Proof.* Take $t = Y\; f$. Then $t = Y\; f =_\beta f\; (Y\; f) = f\; t$. $\square$

This has a startling consequence: unlike in most mathematical theories, the lambda calculus has no notion of "function without a fixed point." Every term has a fixed point. This is closely related to the fact that the untyped lambda calculus is inconsistent as a logic (via Curry's paradox).

### 4.6 Curry's Paradox

Fixed-point combinators reveal a deep connection between the lambda calculus and logic. Consider the term:

$$
Y\; (\lambda x.\, \text{not}\; x)
$$

Let $p = Y\; (\lambda x.\, \text{not}\; x)$. Then:

$$
p =_\beta (\lambda x.\, \text{not}\; x)\; p =_\beta \text{not}\; p
$$

So $p$ is equivalent to its own negation! If we interpret lambda terms as propositions (via the Curry-Howard correspondence), this means we have a proposition that is equivalent to its negation -- a contradiction. This is **Curry's paradox**.

The resolution is that the untyped lambda calculus is not a consistent logic. The typing discipline of the simply typed lambda calculus (and its extensions) restores consistency by ensuring that self-referential constructions like the Y combinator are untypeable.

---

## 5. Worked Examples

### 5.1 Computing with Church Numerals

Let us verify $\text{times}\; c_2\; c_2 = c_4$ step by step under full beta-reduction.

$$
\text{times}\; c_2\; c_2 = (\lambda m.\, \lambda n.\, \lambda s.\, m\; (n\; s))\; c_2\; c_2
$$

$$
\to_\beta (\lambda n.\, \lambda s.\, c_2\; (n\; s))\; c_2
$$

$$
\to_\beta \lambda s.\, c_2\; (c_2\; s)
$$

Now $c_2\; s = (\lambda s'.\, \lambda z.\, s'\; (s'\; z))\; s \to_\beta \lambda z.\, s\; (s\; z)$. So:

$$
c_2\; (c_2\; s) = (\lambda s'.\, \lambda z.\, s'\; (s'\; z))\; (\lambda z.\, s\; (s\; z))
$$

$$
\to_\beta \lambda z.\, (\lambda z'.\, s\; (s\; z'))\; ((\lambda z'.\, s\; (s\; z'))\; z)
$$

$$
\to_\beta \lambda z.\, (\lambda z'.\, s\; (s\; z'))\; (s\; (s\; z))
$$

$$
\to_\beta \lambda z.\, s\; (s\; (s\; (s\; z)))
$$

So $\text{times}\; c_2\; c_2 \to_\beta^* \lambda s.\, \lambda z.\, s\; (s\; (s\; (s\; z))) = c_4$. Correct.

### 5.2 The Predecessor in Detail

Trace $\text{prd}\; c_2$:

$$
\text{prd}\; c_2 = \text{snd}\; (c_2\; \text{ss}\; \text{zz})
$$

First, $c_2\; \text{ss}\; \text{zz} = \text{ss}\; (\text{ss}\; \text{zz})$.

Compute $\text{ss}\; \text{zz} = \text{ss}\; (\text{pair}\; c_0\; c_0)$:

$$
\text{ss}\; (\text{pair}\; c_0\; c_0) = (\lambda p.\, \text{pair}\; (\text{scc}\; (\text{fst}\; p))\; (\text{fst}\; p))\; (\text{pair}\; c_0\; c_0)
$$

$$
\to_\beta \text{pair}\; (\text{scc}\; (\text{fst}\; (\text{pair}\; c_0\; c_0)))\; (\text{fst}\; (\text{pair}\; c_0\; c_0))
$$

Now $\text{fst}\; (\text{pair}\; c_0\; c_0) \to_\beta^* c_0$, so:

$$
\to_\beta^* \text{pair}\; (\text{scc}\; c_0)\; c_0 = \text{pair}\; c_1\; c_0
$$

Now compute $\text{ss}\; (\text{pair}\; c_1\; c_0)$:

$$
\to_\beta^* \text{pair}\; (\text{scc}\; c_1)\; c_1 = \text{pair}\; c_2\; c_1
$$

Finally, $\text{snd}\; (\text{pair}\; c_2\; c_1) \to_\beta^* c_1$. So $\text{prd}\; c_2 = c_1$. Correct.

---

## 6. Exercises

**Exercise 6.1.** Define the Church encoding for the boolean operation $\text{xor}$ (exclusive or). Verify your encoding on all four input combinations.

**Exercise 6.2.** Define a Church encoding for "less than or equal" on Church numerals: $\text{leq}\; m\; n$ should return $\text{tru}$ if $m \le n$ and $\text{fls}$ otherwise. *(Hint: $m \le n$ iff $m - n = 0$, where subtraction is floored at 0.)*

**Exercise 6.3.** Verify by explicit reduction that $\text{exp}\; c_2\; c_3 = c_8$. You may abbreviate long intermediate terms but must show all beta-reduction steps.

**Exercise 6.4.** The Church encoding of the "maybe" type (like OCaml's `option`) can be defined as:

$$
\text{nothing} = \lambda n.\, \lambda j.\, n
$$

$$
\text{just} = \lambda v.\, \lambda n.\, \lambda j.\, j\; v
$$

Define a function $\text{fromMaybe}$ that takes a default value $d$ and a "maybe" value, returning the contained value if present and $d$ otherwise. Verify your definition on both $\text{nothing}$ and $\text{just}\; c_3$.

**Exercise 6.5.** Show that the Z combinator satisfies $Z\; f\; v =_\beta f\; (\lambda w.\, Z\; f\; w)\; v$ under call-by-value evaluation. Trace the reduction carefully.

**Exercise 6.6.** Using the Y combinator (or its CBV variant), define a function $\text{fib}$ that computes Fibonacci numbers on Church numerals. You will need subtraction and a "less than or equal" test. You do not need to trace the full reduction; simply define the function and argue informally that it computes the correct result.

**Exercise 6.7.** Prove that Church numerals satisfy the following identity for all $m, n$:

$$
\text{plus}\; c_m\; c_n =_\beta c_{m+n}
$$

*(Hint: induction on $m$, using the definition $\text{plus} = \lambda m.\, \lambda n.\, \lambda s.\, \lambda z.\, m\; s\; (n\; s\; z)$.)*

**Exercise 6.8.** Explain why the term $Y\; \mathbf{I}$ (where $\mathbf{I} = \lambda x.\, x$) diverges. What is $Y\; \mathbf{K}$?

**Exercise 6.9.** Scott encodings are an alternative to Church encodings that represent data by their *case analysis* behavior rather than their *fold* behavior. The Scott encoding of natural numbers is:

$$
\bar{0} = \lambda z.\, \lambda s.\, z
$$

$$
\overline{n+1} = \lambda z.\, \lambda s.\, s\; \bar{n}
$$

Compare this with the Church encoding. Show that the Scott predecessor is trivial ($\text{pred}_S\; \overline{n+1} = \bar{n}$) but that the Scott addition requires a fixed-point combinator. This is the opposite trade-off from Church numerals.

---

## 7. Limitations of Church Encodings

### 5.1 Efficiency

Church-encoded arithmetic is catastrophically inefficient:

- Addition of $m + n$ requires $O(m + n)$ beta-reductions.
- Multiplication of $m \times n$ requires $O(m \times n)$ reductions.
- Predecessor requires $O(n)$ reductions (the Kleene pair trick iterates from zero).
- Comparison and subtraction require $O(\min(m, n))$ predecessor operations, each costing $O(n)$.

In practice, any real language provides built-in numeric types with constant-time operations.

### 5.2 Typing Issues

Church numerals are not typeable in the simply typed lambda calculus: $c_n = \lambda s.\, \lambda z.\, s^n\; z$ has a different type for each $n$ (in STLC, $s$ must have type $A \to A$ for some fixed $A$, but different $c_n$ require different $A$). System F (Module 06) can type all Church numerals uniformly:

$$
c_n : \forall X.\, (X \to X) \to X \to X
$$

### 5.3 Intensionality

Church encodings represent data by its *behavior* (what it does), not its *structure* (what it is). This makes some operations awkward or impossible:

- We cannot inspect the structure of a Church numeral to determine if it "really" represents a number.
- We cannot distinguish $c_n$ from any other term that happens to behave like $c_n$ on all inputs.
- Pattern matching is cumbersome: each data type must be encoded with its own elimination function.

In typed settings, algebraic data types (sums and products) provide a more natural and efficient representation of data.

---

## Appendix: Complete Church Encoding Reference

### A.1 Church Booleans

| Term | Definition | Behavior |
|------|-----------|----------|
| $\text{tru}$ | $\lambda t.\, \lambda f.\, t$ | Select first argument |
| $\text{fls}$ | $\lambda t.\, \lambda f.\, f$ | Select second argument |
| $\text{test}$ | $\lambda b.\, \lambda t.\, \lambda f.\, b\; t\; f$ | Conditional |
| $\text{and}$ | $\lambda b.\, \lambda c.\, b\; c\; \text{fls}$ | Logical and |
| $\text{or}$ | $\lambda b.\, \lambda c.\, b\; \text{tru}\; c$ | Logical or |
| $\text{not}$ | $\lambda b.\, b\; \text{fls}\; \text{tru}$ | Logical negation |

### A.2 Church Numerals

| Term | Definition |
|------|-----------|
| $c_n$ | $\lambda s.\, \lambda z.\, s^n\; z$ |
| $\text{scc}$ | $\lambda n.\, \lambda s.\, \lambda z.\, s\; (n\; s\; z)$ |
| $\text{plus}$ | $\lambda m.\, \lambda n.\, \lambda s.\, \lambda z.\, m\; s\; (n\; s\; z)$ |
| $\text{times}$ | $\lambda m.\, \lambda n.\, \lambda s.\, m\; (n\; s)$ |
| $\text{exp}$ | $\lambda m.\, \lambda n.\, n\; m$ |
| $\text{iszro}$ | $\lambda m.\, m\; (\lambda x.\, \text{fls})\; \text{tru}$ |
| $\text{prd}$ | $\lambda m.\, \text{snd}\; (m\; \text{ss}\; \text{zz})$ |
| $\text{sub}$ | $\lambda m.\, \lambda n.\, n\; \text{prd}\; m$ |

### A.3 Church Pairs

| Term | Definition |
|------|-----------|
| $\text{pair}$ | $\lambda f.\, \lambda s.\, \lambda b.\, b\; f\; s$ |
| $\text{fst}$ | $\lambda p.\, p\; \text{tru}$ |
| $\text{snd}$ | $\lambda p.\, p\; \text{fls}$ |

### A.4 Church Lists

| Term | Definition |
|------|-----------|
| $\text{nil}$ | $\lambda c.\, \lambda n.\, n$ |
| $\text{cons}$ | $\lambda h.\, \lambda t.\, \lambda c.\, \lambda n.\, c\; h\; (t\; c\; n)$ |
| $\text{head}$ | $\lambda l.\, l\; (\lambda h.\, \lambda t.\, h)\; \text{fls}$ |
| $\text{isnil}$ | $\lambda l.\, l\; (\lambda h.\, \lambda t.\, \text{fls})\; \text{tru}$ |

### A.5 Fixed-Point Combinators

| Name | Definition | Works under |
|------|-----------|-------------|
| $Y$ (Curry) | $\lambda f.\, (\lambda x.\, f\; (x\; x))\; (\lambda x.\, f\; (x\; x))$ | CBN, full reduction |
| $Z$ (CBV) | $\lambda f.\, (\lambda x.\, f\; (\lambda v.\, x\; x\; v))\; (\lambda x.\, f\; (\lambda v.\, x\; x\; v))$ | CBV |
| $\Theta$ (Turing) | $(\lambda x.\, \lambda y.\, y\; (x\; x\; y))\; (\lambda x.\, \lambda y.\, y\; (x\; x\; y))$ | CBN, full reduction |

### A.6 Predecessor Helper Functions

| Term | Definition |
|------|-----------|
| $\text{zz}$ | $\text{pair}\; c_0\; c_0$ |
| $\text{ss}$ | $\lambda p.\, \text{pair}\; (\text{scc}\; (\text{fst}\; p))\; (\text{fst}\; p)$ |

The predecessor iterates $\text{ss}$ starting from $\text{zz}$:

$$
\text{prd}\; c_n = \text{snd}\; (c_n\; \text{ss}\; \text{zz}) = \text{snd}\; (\text{pair}\; c_n\; c_{n-1}) = c_{n-1}
$$

(with the convention that $\text{prd}\; c_0 = c_0$).

**Complexity:** $O(n)$ beta-reductions for predecessor of $c_n$, compared to $O(1)$ for successor.

### A.7 Identity Table

Notable identities between Church-encoded terms:

$$
c_0 = \text{fls} = \lambda s.\, \lambda z.\, z = \lambda t.\, \lambda f.\, f
$$

$$
c_1 = \lambda s.\, \lambda z.\, s\; z \neq_\alpha \text{tru} = \lambda t.\, \lambda f.\, t
$$

(Despite $c_0 = \text{fls}$, it is *not* the case that $c_1 = \text{tru}$.)

$$
\text{nil} = c_0 = \text{fls}
$$

---

## Summary

This lecture showed that the untyped lambda calculus, despite its extreme syntactic minimality, is a universal model of computation:

1. **Church booleans** encode truth values as selector functions: $\text{tru}$ picks the first argument, $\text{fls}$ picks the second.
2. **Church numerals** encode natural numbers as iterators: $c_n$ applies a function $n$ times.
3. **Arithmetic** (successor, addition, multiplication, exponentiation) is encoded using the iteration behavior of Church numerals. The **predecessor** requires the Kleene pair trick and is significantly more complex.
4. **Pairs and lists** are encoded using their elimination behavior (projection and fold, respectively).
5. **The Y combinator** provides recursion by computing fixed points: $Y\; f =_\beta f\; (Y\; f)$. The CBV variant (Z combinator) uses eta-expansion to avoid divergence.
6. The lambda calculus is **Turing-complete** (Church-Turing thesis): it can express every computable function.
7. The untyped lambda calculus can be viewed as a **uni-typed** system with a single type $D \cong D \to D$ (Scott's domain-theoretic model).

---

## Further Reading

- **Pierce, B. C.** *Types and Programming Languages* (2002), Chapter 5. Church encodings and the Y combinator.
- **Barendregt, H. P.** *The Lambda Calculus: Its Syntax and Semantics* (1984), Chapter 6. Definability of recursive functions.
- **Church, A.** "An Unsolvable Problem of Elementary Number Theory" (1936). The original paper on lambda-definability and the undecidability of the Entscheidungsproblem.
- **Kleene, S. C.** "Lambda-Definability and Recursiveness" (1936). The equivalence of lambda-definable functions and recursive functions.
- **Turing, A. M.** "On Computable Numbers, with an Application to the Entscheidungsproblem" (1936). Turing machines and their equivalence with the lambda calculus.
- **Scott, D. S.** "Data Types as Lattices" (1976). The domain-theoretic model $D \cong D \to D$ and the "untyped = uni-typed" observation.
- **Curry, H. B.** "Grundlagen der kombinatorischen Logik" (1930). Early work on combinators and fixed-point theory.
- **Rojas, R.** "A Tutorial Introduction to the Lambda Calculus" (2015). An accessible introduction to Church encodings.
- **Wadler, P.** "The Girard-Reynolds Isomorphism" (2003). On the typing of Church encodings in System F.
