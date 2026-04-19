---
title: "Lecture 01b: The Untyped Lambda Calculus"
tags:
  - type-theory
  - untyped
  - lecture
---
# Lecture 01b: The Untyped Lambda Calculus

> **Module 01 -- Untyped Systems (Weeks 1-2)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the syntax of the untyped lambda calculus and identify its three term forms: variables, abstractions, and applications.
2. **Compute** the sets of free and bound variables for any lambda term.
3. **Determine** when two terms are alpha-equivalent and perform alpha-renaming.
4. **Apply** capture-avoiding substitution correctly, identifying and avoiding variable capture.
5. **Perform** beta-reduction by hand, applying the substitution operation to reduce redexes.
6. **Explain** eta-reduction and the principle of extensionality it embodies.
7. **Translate** between named variable representations and de Bruijn index representations.
8. **Articulate** why the lambda calculus, despite having only three syntactic forms, is a universal model of computation.

---

## 1. Motivation

The lambda calculus, invented by Alonzo Church in the 1930s, is one of the most remarkable formal systems in the history of mathematics and computer science. It was originally designed as a foundation for mathematics -- an alternative to set theory -- though this program encountered paradoxes (the Kleene-Rosser paradox, 1935). What survived is something arguably more important: a universal theory of computable functions.

The lambda calculus is the theoretical foundation of functional programming. Every functional language -- ML, Haskell, OCaml, Scheme, and in a certain sense even JavaScript and Python -- is an elaboration of the lambda calculus with additional features (types, pattern matching, side effects, etc.). Understanding the lambda calculus is understanding the core of computation itself.

What makes the lambda calculus extraordinary is its minimalism. The entire language has exactly three syntactic forms:

1. **Variables**: $x$
2. **Abstractions** (anonymous functions): $\lambda x.\, t$
3. **Applications** (function calls): $t_1\; t_2$

That is all. There are no numbers, no booleans, no conditionals, no loops, no data structures. Yet as we will see in Lecture 01d, all of these can be *encoded* within the calculus itself. The lambda calculus is Turing-complete: it can express any computable function.

This lecture establishes the syntax and basic operations of the lambda calculus. The semantics (evaluation strategies, reduction rules) are developed further in Lecture 01c.

---

## 2. Core Theory

### 2.1 Syntax

**Definition 2.1 (Lambda terms).** Let $\mathcal{V}$ be a countably infinite set of **variable names** $\{x, y, z, x_1, x_2, \ldots\}$. The set $\Lambda$ of **lambda terms** is defined inductively by:

$$
t ::= x \mid \lambda x.\, t \mid t\; t
$$

where $x \in \mathcal{V}$.

In full:

1. If $x \in \mathcal{V}$, then $x \in \Lambda$. *(Variable.)*
2. If $x \in \mathcal{V}$ and $t \in \Lambda$, then $(\lambda x.\, t) \in \Lambda$. *(Abstraction.)*
3. If $t_1 \in \Lambda$ and $t_2 \in \Lambda$, then $(t_1\; t_2) \in \Lambda$. *(Application.)*

**Notation conventions.** To reduce the number of parentheses, we adopt the following conventions:

- **Application is left-associative:** $t_1\; t_2\; t_3$ means $(t_1\; t_2)\; t_3$.
- **The body of an abstraction extends as far right as possible:** $\lambda x.\, t_1\; t_2$ means $\lambda x.\, (t_1\; t_2)$, not $(\lambda x.\, t_1)\; t_2$.
- **Multiple abstractions can be collapsed:** $\lambda x.\, \lambda y.\, \lambda z.\, t$ is written $\lambda x\, y\, z.\, t$.
- **Application binds more tightly than abstraction:** $\lambda x.\, x\; y$ means $\lambda x.\, (x\; y)$.

**Examples of lambda terms:**

| Term | Description |
|------|-------------|
| $x$ | A variable |
| $\lambda x.\, x$ | The identity function |
| $\lambda x.\, \lambda y.\, x$ | A function that takes two arguments and returns the first |
| $(\lambda x.\, x)\; y$ | The identity function applied to $y$ |
| $\lambda f.\, \lambda x.\, f\; (f\; x)$ | A function that applies $f$ twice to $x$ |
| $(\lambda x.\, x\; x)\; (\lambda x.\, x\; x)$ | The self-application "omega" term |

### 2.2 Abstract Syntax Trees

Like the arithmetic expressions of Lecture 01a, lambda terms are abstract syntax trees. A variable $x$ is a leaf. An abstraction $\lambda x.\, t$ is a node with one child (the body $t$) and a label (the bound variable $x$). An application $t_1\; t_2$ is a node with two children.

The AST for $\lambda f.\, \lambda x.\, f\; (f\; x)$:

```
       lam f
         |
       lam x
         |
        app
       /   \
      f    app
          /   \
         f     x
```

### 2.3 Scope and Binding

The abstraction $\lambda x.\, t$ **binds** the variable $x$ in $t$. The term $t$ is called the **body** of the abstraction, and $x$ is the **bound variable**. The **scope** of the binder $\lambda x$ is the body $t$.

An occurrence of a variable $x$ in a term $t$ is **bound** if it falls within the scope of a $\lambda x$ binder. An occurrence is **free** if it is not bound by any enclosing $\lambda$.

**Example 2.2.** In the term $\lambda x.\, x\; y$:
- $x$ is bound (it is within the scope of $\lambda x$).
- $y$ is free (no $\lambda y$ binder encloses it).

**Example 2.3.** In the term $(\lambda x.\, x)\; x$:
- The first occurrence of $x$ (inside the abstraction) is bound.
- The second occurrence of $x$ (the argument to the application) is free.

The same variable name can have both free and bound occurrences in the same term. This is a source of potential confusion and is one reason the formal treatment of substitution must be handled with care.

### 2.4 Free Variables

**Definition 2.4 (Free variables).** The set $\text{FV}(t)$ of **free variables** of a term $t$ is defined inductively:

$$
\text{FV}(x) = \{x\}
$$

$$
\text{FV}(\lambda x.\, t) = \text{FV}(t) \setminus \{x\}
$$

$$
\text{FV}(t_1\; t_2) = \text{FV}(t_1) \cup \text{FV}(t_2)
$$

**Examples:**

$$
\text{FV}(\lambda x.\, x) = \{x\} \setminus \{x\} = \emptyset
$$

$$
\text{FV}(\lambda x.\, x\; y) = (\{x\} \cup \{y\}) \setminus \{x\} = \{y\}
$$

$$
\text{FV}((\lambda x.\, x)\; y) = \emptyset \cup \{y\} = \{y\}
$$

$$
\text{FV}(\lambda x.\, \lambda y.\, x\; y\; z) = (\{x\} \cup \{y\} \cup \{z\}) \setminus \{y\} \setminus \{x\} = \{z\}
$$

**Definition 2.5 (Closed term / Combinator).** A term $t$ with $\text{FV}(t) = \emptyset$ is called **closed** or a **combinator**. Examples: $\lambda x.\, x$ (the identity combinator $\mathbf{I}$), $\lambda x.\, \lambda y.\, x$ (the combinator $\mathbf{K}$), $\lambda f.\, \lambda g.\, \lambda x.\, f\; x\; (g\; x)$ (the combinator $\mathbf{S}$).

### 2.5 Alpha-Equivalence

The names of bound variables are arbitrary. The terms $\lambda x.\, x$ and $\lambda y.\, y$ denote the same function (the identity). We formalize this with the notion of **alpha-equivalence**.

**Definition 2.6 (Alpha-equivalence).** Two terms $t$ and $s$ are **alpha-equivalent**, written $t =_\alpha s$, if $s$ can be obtained from $t$ by consistently renaming bound variables, avoiding capture.

More precisely, $=_\alpha$ is the smallest congruence relation on $\Lambda$ satisfying:

$$
\lambda x.\, t =_\alpha \lambda y.\, [x \mapsto y]\, t \qquad \text{provided } y \notin \text{FV}(t) \text{ and } y \neq x
$$

where $[x \mapsto y]\, t$ denotes the (syntactic) replacement of all free occurrences of $x$ in $t$ by $y$.

**Examples:**

$$
\lambda x.\, x =_\alpha \lambda y.\, y =_\alpha \lambda z.\, z
$$

$$
\lambda x.\, \lambda y.\, x\; y =_\alpha \lambda a.\, \lambda b.\, a\; b
$$

$$
\lambda x.\, \lambda x.\, x =_\alpha \lambda y.\, \lambda x.\, x =_\alpha \lambda y.\, \lambda z.\, z
$$

Note the last example: the inner $x$ is bound by the inner $\lambda x$, so renaming the outer $\lambda x$ to $\lambda y$ does not affect the inner $x$. After renaming, the inner $\lambda x.\, x$ can itself be renamed to $\lambda z.\, z$.

**Convention 2.7 (Barendregt's Variable Convention).** We identify alpha-equivalent terms. That is, we treat $=_\alpha$ as syntactic identity. Furthermore, when working with a term, we may always assume that all bound variables are distinct from each other and from all free variables. This can always be achieved by alpha-renaming.

This convention is enormously convenient: it allows us to write proofs without constantly checking that bound variable names do not conflict. Most textbooks adopt it implicitly.

### 2.6 Substitution: The Naive Attempt

The central operation of the lambda calculus is **substitution**: replacing a free variable with a term. We write $[x \mapsto s]\, t$ for the result of substituting $s$ for all free occurrences of $x$ in $t$.

The naive definition proceeds by structural recursion on $t$:

$$
[x \mapsto s]\, x = s
$$

$$
[x \mapsto s]\, y = y \qquad \text{if } y \neq x
$$

$$
[x \mapsto s]\, (t_1\; t_2) = ([x \mapsto s]\, t_1)\; ([x \mapsto s]\, t_2)
$$

$$
[x \mapsto s]\, (\lambda y.\, t) = \lambda y.\, [x \mapsto s]\, t
$$

The first three clauses are straightforward. The fourth, however, is **wrong** in general. It suffers from the problem of **variable capture**.

### 2.7 The Variable Capture Problem

**Example 2.8 (Variable capture).** Consider the substitution $[x \mapsto y]\, (\lambda y.\, x)$. Intuitively, the term $\lambda y.\, x$ is a constant function that always returns whatever $x$ is. If we substitute $y$ for $x$, we should get a constant function that always returns $y$ -- something like $\lambda z.\, y$.

But the naive definition gives:

$$
[x \mapsto y]\, (\lambda y.\, x) = \lambda y.\, [x \mapsto y]\, x = \lambda y.\, y
$$

This is the identity function, not a constant function! The free variable $y$ in the substituted term has been **captured** by the binder $\lambda y$. The meaning has changed.

The problem arises because the bound variable $y$ in $\lambda y.\, x$ happens to have the same name as the free variable $y$ in the term being substituted.

### 2.8 Capture-Avoiding Substitution

**Definition 2.9 (Capture-avoiding substitution).** The substitution $[x \mapsto s]\, t$ is defined by:

$$
[x \mapsto s]\, x = s
$$

$$
[x \mapsto s]\, y = y \qquad \text{if } y \neq x
$$

$$
[x \mapsto s]\, (t_1\; t_2) = ([x \mapsto s]\, t_1)\; ([x \mapsto s]\, t_2)
$$

$$
[x \mapsto s]\, (\lambda x.\, t) = \lambda x.\, t \qquad \text{($x$ is rebound; substitution stops)}
$$

$$
[x \mapsto s]\, (\lambda y.\, t) = \lambda y.\, [x \mapsto s]\, t \qquad \text{if } y \neq x \text{ and } y \notin \text{FV}(s)
$$

$$
[x \mapsto s]\, (\lambda y.\, t) = \lambda z.\, [x \mapsto s]\, [y \mapsto z]\, t \qquad \text{if } y \neq x \text{ and } y \in \text{FV}(s)
$$

where in the last clause, $z$ is a fresh variable not in $\text{FV}(t) \cup \text{FV}(s) \cup \{x\}$.

The key insight is in the last two clauses:

- If $y \neq x$ and $y$ does not appear free in $s$, then no capture can occur, and we simply recurse into the body.
- If $y \neq x$ and $y$ does appear free in $s$, then substituting would cause capture. We first alpha-rename the bound variable from $y$ to a fresh name $z$, then perform the substitution safely.

**Example 2.10.** Revisiting the problematic case:

$$
[x \mapsto y]\, (\lambda y.\, x)
$$

Here $y \in \text{FV}(y) = \{y\}$, so we need to alpha-rename. Pick a fresh variable $z$:

$$
[x \mapsto y]\, (\lambda y.\, x) = \lambda z.\, [x \mapsto y]\, [y \mapsto z]\, x = \lambda z.\, [x \mapsto y]\, x = \lambda z.\, y
$$

This is correct: the constant function that always returns $y$.

**Example 2.11.** A more complex example:

$$
[x \mapsto (\lambda z.\, z\; w)]\, (\lambda y.\, x\; y)
$$

Here $\text{FV}(\lambda z.\, z\; w) = \{w\}$ and $y \notin \{w\}$, so no capture occurs:

$$
[x \mapsto (\lambda z.\, z\; w)]\, (\lambda y.\, x\; y) = \lambda y.\, (\lambda z.\, z\; w)\; y
$$

**Example 2.12.** Now consider:

$$
[x \mapsto y\; z]\, (\lambda y.\, \lambda z.\, x)
$$

Here $y \in \text{FV}(y\; z)$, so we must rename $y$:

$$
[x \mapsto y\; z]\, (\lambda y.\, \lambda z.\, x) = \lambda w.\, [x \mapsto y\; z]\, [y \mapsto w]\, (\lambda z.\, x)
$$

Now $[y \mapsto w]\, (\lambda z.\, x) = \lambda z.\, [y \mapsto w]\, x = \lambda z.\, x$ (since $x \neq y$). So:

$$
= \lambda w.\, [x \mapsto y\; z]\, (\lambda z.\, x)
$$

Now $z \in \text{FV}(y\; z)$, so we must rename $z$ as well. Pick fresh $u$:

$$
= \lambda w.\, \lambda u.\, [x \mapsto y\; z]\, [z \mapsto u]\, x = \lambda w.\, \lambda u.\, [x \mapsto y\; z]\, x = \lambda w.\, \lambda u.\, y\; z
$$

### 2.9 Properties of Substitution

**Proposition 2.13.** Substitution is well-defined up to alpha-equivalence: if $t =_\alpha t'$ and $s =_\alpha s'$, then $[x \mapsto s]\, t =_\alpha [x \mapsto s']\, t'$.

**Proposition 2.14 (Substitution lemma).** If $x \neq y$ and $x \notin \text{FV}(s)$, then:

$$
[x \mapsto s]\, [y \mapsto r]\, t = [y \mapsto [x \mapsto s]\, r]\, [x \mapsto s]\, t
$$

This lemma is crucial for reasoning about multiple substitutions and will be used extensively when we prove properties of the lambda calculus.

**Proposition 2.15 (Substitution and free variables).** $\text{FV}([x \mapsto s]\, t) = (\text{FV}(t) \setminus \{x\}) \cup (x \in \text{FV}(t)\ ?\ \text{FV}(s) : \emptyset)$.

More precisely:

$$
\text{FV}([x \mapsto s]\, t) = \begin{cases} (\text{FV}(t) \setminus \{x\}) \cup \text{FV}(s) & \text{if } x \in \text{FV}(t) \\ \text{FV}(t) & \text{if } x \notin \text{FV}(t) \end{cases}
$$

### 2.10 Beta-Reduction

The computational content of the lambda calculus resides in a single rule: **beta-reduction**.

**Definition 2.16 (Redex).** A term of the form $(\lambda x.\, t)\; s$ is called a **beta-redex** (or simply **redex**). The term $\lambda x.\, t$ is the **function** and $s$ is the **argument**.

**Definition 2.17 (Beta-reduction).** The **beta-reduction** relation $\to_\beta$ is defined by:

$$
(\lambda x.\, t)\; s \to_\beta [x \mapsto s]\, t
$$

This rule says: to apply a function $\lambda x.\, t$ to an argument $s$, substitute $s$ for $x$ in the body $t$. The substitution is capture-avoiding.

**Example 2.18.**

$$
(\lambda x.\, x)\; y \to_\beta [x \mapsto y]\, x = y
$$

$$
(\lambda x.\, x\; x)\; (\lambda y.\, y) \to_\beta [x \mapsto (\lambda y.\, y)]\, (x\; x) = (\lambda y.\, y)\; (\lambda y.\, y)
$$

$$
(\lambda x.\, \lambda y.\, x)\; z \to_\beta [x \mapsto z]\, (\lambda y.\, x) = \lambda y.\, z
$$

**Example 2.19 (Non-termination).** The term $\Omega = (\lambda x.\, x\; x)\; (\lambda x.\, x\; x)$ reduces to itself:

$$
(\lambda x.\, x\; x)\; (\lambda x.\, x\; x) \to_\beta [x \mapsto (\lambda x.\, x\; x)]\, (x\; x) = (\lambda x.\, x\; x)\; (\lambda x.\, x\; x) = \Omega
$$

So $\Omega \to_\beta \Omega \to_\beta \Omega \to_\beta \cdots$. This term has no normal form: evaluation never terminates. This is the lambda calculus analogue of an infinite loop.

### 2.11 Compatible Closure and Reduction Relations

Beta-reduction as stated above applies only at the "top level" -- to terms of the form $(\lambda x.\, t)\; s$. To use it inside larger terms, we define the **compatible closure**.

**Definition 2.20 (One-step beta-reduction).** The relation $\to_\beta$ on $\Lambda$ is the smallest relation satisfying:

$$
\frac{}{(\lambda x.\, t)\; s \to_\beta [x \mapsto s]\, t} \quad \text{(Beta)}
$$

$$
\frac{t \to_\beta t'}{\lambda x.\, t \to_\beta \lambda x.\, t'} \quad \text{(Cong-Abs)}
$$

$$
\frac{t_1 \to_\beta t_1'}{t_1\; t_2 \to_\beta t_1'\; t_2} \quad \text{(Cong-App1)}
$$

$$
\frac{t_2 \to_\beta t_2'}{t_1\; t_2 \to_\beta t_1\; t_2'} \quad \text{(Cong-App2)}
$$

The congruence rules allow beta-reduction to occur anywhere inside a term -- inside an abstraction body, inside the function part of an application, or inside the argument part.

**Remark.** These four rules together define **full beta-reduction**, which is non-deterministic: a term with multiple redexes can step in multiple ways. In Lecture 01c, we will study restricted evaluation strategies that recover determinism.

### 2.12 Multi-Step Reduction and Conversion

**Definition 2.21.** The **multi-step beta-reduction** $\twoheadrightarrow_\beta$ is the reflexive-transitive closure of $\to_\beta$.

**Definition 2.22.** **Beta-equivalence** (or **beta-conversion**) $=_\beta$ is the reflexive-symmetric-transitive closure of $\to_\beta$. That is, $t =_\beta s$ if there is a finite sequence of forward and backward beta-reduction steps connecting $t$ and $s$:

$$
t = t_0 \leftrightarrow_\beta t_1 \leftrightarrow_\beta \cdots \leftrightarrow_\beta t_n = s
$$

where each $\leftrightarrow_\beta$ is either $\to_\beta$ or $\leftarrow_\beta$.

Beta-equivalence captures the idea that two terms "have the same computational content." It is the finest-grained notion of equality for the lambda calculus.

### 2.13 Normal Forms

**Definition 2.23.** A term $t$ is in **beta-normal form** (or simply **normal form**) if it contains no beta-redex. Equivalently, there is no $t'$ with $t \to_\beta t'$.

**Examples:**

- $x$ is in normal form.
- $\lambda x.\, x$ is in normal form.
- $\lambda x.\, \lambda y.\, x\; y$ is in normal form.
- $x\; (\lambda y.\, y)$ is in normal form.
- $(\lambda x.\, x)\; y$ is *not* in normal form (it is a redex).
- $\lambda x.\, (\lambda y.\, y)\; x$ is *not* in normal form (the body contains a redex).

Not every term has a normal form. The term $\Omega$ defined above does not.

### 2.14 Eta-Reduction and Extensionality

**Definition 2.24 (Eta-reduction).** If $x \notin \text{FV}(t)$, then:

$$
\lambda x.\, t\; x \to_\eta t
$$

This rule captures the principle of **extensionality**: two functions are equal if and only if they produce the same output on every input. If $f$ and $\lambda x.\, f\; x$ behave identically on all arguments (and $x$ is not free in $f$, so the abstraction is not capturing anything), then they should be considered equal.

**Example 2.25.**

$$
\lambda x.\, (\lambda y.\, y)\; x \to_\eta \lambda y.\, y
$$

But note: $\lambda x.\, x\; x$ cannot be eta-reduced, because the second occurrence of $x$ is not an application of the outer term to $x$ in the required pattern.

**Example 2.26.** Eta-reduction is particularly natural with combinators. Consider $\lambda f.\, \lambda x.\, f\; x$. We can eta-reduce the inner abstraction:

$$
\lambda f.\, \lambda x.\, f\; x \to_\eta \lambda f.\, f
$$

This is the identity function on functions -- which is just the identity function.

**Remark.** Whether to include eta-reduction depends on the intended semantics. In an **intensional** setting (where we distinguish functions by their definitions), we may not want eta. In an **extensional** setting (where we identify functions by their input-output behavior), eta is natural. Most typed settings include eta.

### 2.15 De Bruijn Indices

The complications of alpha-equivalence and capture-avoiding substitution arise because we use *names* for variables. An elegant alternative, introduced by Nicolaas Govert de Bruijn in 1972, replaces variable names with natural number **indices** that encode the binding structure directly.

**Definition 2.27 (De Bruijn terms).** The set of **nameless terms** is defined by:

$$
t ::= n \mid \lambda.\, t \mid t\; t
$$

where $n \in \mathbb{N}$ is a **de Bruijn index**.

The key idea: a de Bruijn index $n$ refers to the variable bound by the $n$-th enclosing lambda, counting from $0$. The abstraction $\lambda.\, t$ has no explicit variable name -- the binding is implicit.

**Examples of translation from named to nameless representation:**

| Named | De Bruijn |
|-------|-----------|
| $\lambda x.\, x$ | $\lambda.\, 0$ |
| $\lambda x.\, \lambda y.\, x$ | $\lambda.\, \lambda.\, 1$ |
| $\lambda x.\, \lambda y.\, y$ | $\lambda.\, \lambda.\, 0$ |
| $\lambda x.\, \lambda y.\, x\; y$ | $\lambda.\, \lambda.\, 1\; 0$ |
| $(\lambda x.\, x)\; (\lambda y.\, y)$ | $(\lambda.\, 0)\; (\lambda.\, 0)$ |
| $\lambda x.\, \lambda y.\, \lambda z.\, x\; z\; (y\; z)$ | $\lambda.\, \lambda.\, \lambda.\, 2\; 0\; (1\; 0)$ |

**Remark.** Free variables are represented by indices that "escape" all enclosing lambdas. For example, in the term $\lambda x.\, x\; y$ with $y$ free, if $y$ is the first free variable in some external naming context, the de Bruijn representation might be $\lambda.\, 0\; 1$ (where $0$ refers to the bound $x$ and $1$ escapes the single enclosing lambda to refer to the free variable in position $0$ of the context).

### 2.16 Shifting and Substitution for De Bruijn Terms

To define substitution on de Bruijn terms, we need an auxiliary operation called **shifting**, which adjusts indices when a term is moved across a binder.

**Definition 2.28 (Shifting).** The $d$-place shift of a term $t$ above cutoff $c$ is:

$$
\uparrow^d_c(k) = \begin{cases} k & \text{if } k < c \\ k + d & \text{if } k \ge c \end{cases}
$$

$$
\uparrow^d_c(\lambda.\, t) = \lambda.\, \uparrow^d_{c+1}(t)
$$

$$
\uparrow^d_c(t_1\; t_2) = \uparrow^d_c(t_1)\; \uparrow^d_c(t_2)
$$

The cutoff $c$ tracks how many binders we are currently inside. Indices below the cutoff are bound and should not be shifted; indices at or above the cutoff are free (relative to the current scope) and must be adjusted.

**Definition 2.29 (Substitution on de Bruijn terms).** The substitution $[j \mapsto s]\, t$ is defined by:

$$
[j \mapsto s]\, k = \begin{cases} s & \text{if } k = j \\ k & \text{if } k \neq j \end{cases}
$$

$$
[j \mapsto s]\, (\lambda.\, t) = \lambda.\, [j+1 \mapsto \uparrow^1_0(s)]\, t
$$

$$
[j \mapsto s]\, (t_1\; t_2) = ([j \mapsto s]\, t_1)\; ([j \mapsto s]\, t_2)
$$

When we go under a binder, we increment the target index $j$ (because the bound variable is now index $0$, pushing everything else up by one) and shift $s$ (because $s$ is being moved into a context with one more binder).

**Beta-reduction with de Bruijn indices.** The beta rule becomes:

$$
(\lambda.\, t)\; s \to_\beta \uparrow^{-1}_0([0 \mapsto \uparrow^1_0(s)]\, t)
$$

We substitute $s$ (shifted up by one, since it enters the scope of the lambda) for index $0$ in $t$, then shift down by one (since the lambda binder has been consumed, freeing one index level).

**Example 2.30.** The reduction $(\lambda x.\, x)\; (\lambda y.\, y) \to_\beta \lambda y.\, y$ in de Bruijn form:

$$
(\lambda.\, 0)\; (\lambda.\, 0)
$$

$$
\to_\beta \uparrow^{-1}_0([0 \mapsto \uparrow^1_0(\lambda.\, 0)]\, 0)
$$

$$
= \uparrow^{-1}_0([0 \mapsto \lambda.\, 0]\, 0)
$$

$$
= \uparrow^{-1}_0(\lambda.\, 0)
$$

$$
= \lambda.\, 0
$$

(The shift $\uparrow^1_0(\lambda.\, 0) = \lambda.\, 0$ because the only index $0$ in $\lambda.\, 0$ is below the cutoff $1$ (inside one binder), so it is not shifted. And $\uparrow^{-1}_0(\lambda.\, 0) = \lambda.\, 0$ for the same reason.)

### 2.17 Advantages and Disadvantages of De Bruijn Indices

**Advantages:**

- Alpha-equivalent terms have identical de Bruijn representations. There is no need for alpha-equivalence as a separate concept.
- Substitution is purely mechanical: no need to check for variable capture or perform renaming.
- Equality of terms reduces to syntactic equality.
- De Bruijn indices are the standard representation used in implementations of type checkers and proof assistants.

**Disadvantages:**

- De Bruijn terms are hard for humans to read. The term $\lambda.\, \lambda.\, \lambda.\, 2\; 0\; (1\; 0)$ is much less readable than $\lambda x\, y\, z.\, x\; z\; (y\; z)$.
- When modifying a term (e.g., inserting or removing a binder), all indices may need to be adjusted via shifting.
- Formal proofs about de Bruijn terms can be tedious due to the arithmetic on indices and cutoffs.

**In practice,** most implementations use de Bruijn indices (or the closely related **de Bruijn levels**, which count from the outermost binder rather than the innermost) internally, while presenting named terms to the user.

### 2.18 Higher-Order Abstract Syntax (HOAS)

A third approach to binding, called **higher-order abstract syntax** (HOAS), represents binders in the object language using binders in the metalanguage. In an OCaml implementation:

```ocaml
type term =
  | Var of string
  | App of term * term
  | Lam of (term -> term)   (* HOAS: metalanguage function *)
```

The identity function $\lambda x.\, x$ is represented as `Lam (fun x -> x)`. Substitution is handled automatically by the metalanguage. This approach is elegant but introduces complications: terms are not ordinary data structures and cannot be easily compared, printed, or serialized.

We will use first-order representations (named variables or de Bruijn indices) in this course, but HOAS is worth knowing about as an important technique in proof assistants like Twelf and Beluga.

---

## 3. The Lambda Calculus as a Programming Language

### 3.1 Currying and Multi-Argument Functions

The lambda calculus has only single-argument functions, but multi-argument functions can be simulated through **currying** (named after Haskell Curry, though the technique was known to Schonfinkel and Frege).

A "two-argument function" $f(x, y) = \text{body}$ is represented as:

$$
\lambda x.\, \lambda y.\, \text{body}
$$

Applying this to arguments $a$ and $b$:

$$
(\lambda x.\, \lambda y.\, \text{body})\; a\; b \to_\beta (\lambda y.\, [x \mapsto a]\, \text{body})\; b \to_\beta [y \mapsto b]\, [x \mapsto a]\, \text{body}
$$

The first application yields a function of one remaining argument (with $x$ already bound to $a$). The second application completes the process.

**Partial application** is a natural consequence: applying a "two-argument function" to only one argument yields a specialized "one-argument function." This is a fundamental feature of functional programming.

### 3.2 Combinators

Several lambda terms are so fundamental that they have standard names:

| Name | Term | Behavior |
|------|------|----------|
| $\mathbf{I}$ (Identity) | $\lambda x.\, x$ | Returns its argument |
| $\mathbf{K}$ (Constant) | $\lambda x.\, \lambda y.\, x$ | Returns first argument, ignores second |
| $\mathbf{K}_*$ (Flip constant) | $\lambda x.\, \lambda y.\, y$ | Returns second argument, ignores first |
| $\mathbf{S}$ (Substitution) | $\lambda f.\, \lambda g.\, \lambda x.\, f\; x\; (g\; x)$ | Distributes application |
| $\mathbf{B}$ (Composition) | $\lambda f.\, \lambda g.\, \lambda x.\, f\; (g\; x)$ | Composes two functions |
| $\mathbf{C}$ (Flip) | $\lambda f.\, \lambda x.\, \lambda y.\, f\; y\; x$ | Swaps arguments |
| $\omega$ (Self-application) | $\lambda x.\, x\; x$ | Applies argument to itself |
| $\Omega$ (Divergence) | $(\lambda x.\, x\; x)\; (\lambda x.\, x\; x)$ | Reduces to itself forever |

**Theorem 2.31 (Schonfinkel, 1924; Curry).** $\mathbf{S}$ and $\mathbf{K}$ form a basis for the lambda calculus: every closed lambda term is beta-equivalent to a term built from $\mathbf{S}$ and $\mathbf{K}$ alone (with application).

This result is the foundation of **combinatory logic**, an alternative formulation of computation without bound variables. Though less common than the lambda calculus, combinatory logic has applications in the implementation of functional languages (the SKI machine) and in theoretical computer science.

### 3.3 Divergence and the Absence of Normalization

The existence of $\Omega$ shows that the untyped lambda calculus does not have the **strong normalization** property: not every term has a normal form. Indeed, we can construct terms with arbitrarily complex reduction behavior.

**Example 2.32.** The term $(\lambda x.\, x\; x\; x)\; (\lambda x.\, x\; x\; x)$ reduces to a term with *more* redexes than the original, leading to divergent growth:

$$
(\lambda x.\, x\; x\; x)\; (\lambda x.\, x\; x\; x) \to_\beta (\lambda x.\, x\; x\; x)\; (\lambda x.\, x\; x\; x)\; (\lambda x.\, x\; x\; x)
$$

This term has two redexes where the original had one. Reducing either redex produces a term with even more redexes.

The absence of strong normalization is not a bug but a feature: it is precisely what makes the untyped lambda calculus Turing-complete. A calculus where every reduction sequence terminates cannot express all computable functions (it would decide the halting problem). Adding types will recover normalization but at the cost of expressiveness -- a fundamental tradeoff that runs through the entire course.

### 3.4 Size and Depth of Lambda Terms

As with arithmetic expressions, we can define useful functions on lambda terms by structural recursion.

**Definition 3.1 (Size of a lambda term).**

$$
|x| = 1
$$

$$
|\lambda x.\, t| = |t| + 1
$$

$$
|t_1\; t_2| = |t_1| + |t_2| + 1
$$

**Definition 3.2 (Depth of a lambda term).**

$$
\text{depth}(x) = 1
$$

$$
\text{depth}(\lambda x.\, t) = \text{depth}(t) + 1
$$

$$
\text{depth}(t_1\; t_2) = \max(\text{depth}(t_1), \text{depth}(t_2)) + 1
$$

**Definition 3.3 (Subterms).**

$$
\text{sub}(x) = \{x\}
$$

$$
\text{sub}(\lambda x.\, t) = \{\lambda x.\, t\} \cup \text{sub}(t)
$$

$$
\text{sub}(t_1\; t_2) = \{t_1\; t_2\} \cup \text{sub}(t_1) \cup \text{sub}(t_2)
$$

**Proposition 3.4.** For every lambda term $t$, $|\text{sub}(t)| \le |t|$.

*Proof.* By structural induction on $t$. The base case $t = x$ is immediate: $|\text{sub}(x)| = 1 = |x|$. For $t = \lambda x.\, t_1$: $|\text{sub}(t)| = 1 + |\text{sub}(t_1)| \le 1 + |t_1| = |t|$ by the induction hypothesis (where the inequality $|\text{sub}(t_1)| \le |t_1|$ uses the fact that the $+1$ accounts for the term $t$ itself being added to the set). For $t = t_1\; t_2$: $|\text{sub}(t)| \le 1 + |\text{sub}(t_1)| + |\text{sub}(t_2)| \le 1 + |t_1| + |t_2| = |t|$ by induction. $\square$

### 3.5 Lambda Calculus Variants

Several variants of the lambda calculus are studied in the literature:

**The pure lambda calculus** ($\lambda$) consists of only variables, abstractions, and applications. This is what we have defined above. It has no built-in constants.

**The applied lambda calculus** ($\lambda + \text{constants}$) extends the pure calculus with built-in constants (numbers, booleans, etc.) and delta-rules for their behavior. For example, adding integer arithmetic:

$$
t ::= x \mid \lambda x.\, t \mid t\; t \mid n \mid t + t
$$

with the delta-rule $n_1 + n_2 \to_\delta n_3$ where $n_3$ is the sum of $n_1$ and $n_2$. The combined reduction is $\to_{\beta\delta}$.

**The lambda-I calculus** (due to Church) restricts abstractions so that the bound variable must occur free in the body: $\lambda x.\, t$ is well-formed only if $x \in \text{FV}(t)$. This eliminates the combinator $\mathbf{K} = \lambda x.\, \lambda y.\, x$ (since $y \notin \text{FV}(x)$) and changes the theory in subtle ways. The lambda-I calculus is Church's original formulation; the unrestricted version is sometimes called the lambda-K calculus.

**The lambda calculus with explicit substitutions** ($\lambda\sigma$, $\lambda s_e$, etc.) makes substitution part of the syntax rather than a metalinguistic operation. A term like $t\langle x := s \rangle$ is a syntactic form meaning "the result of substituting $s$ for $x$ in $t$," with reduction rules that push the substitution through the term structure. This approach is important for implementations and for studying the complexity of normalization.

### 3.6 Historical Note: Combinatory Logic

Before Church introduced the lambda calculus, Moses Schonfinkel (1924) and Haskell Curry (from 1927 onwards) developed **combinatory logic**, an equivalent formulation of higher-order computation without bound variables.

Combinatory logic uses a fixed set of primitive combinators (typically $\mathbf{S}$ and $\mathbf{K}$, or $\mathbf{B}$, $\mathbf{C}$, and $\mathbf{K}$) with explicit reduction rules:

$$
\mathbf{K}\; x\; y \to x
$$

$$
\mathbf{S}\; f\; g\; x \to f\; x\; (g\; x)
$$

Every lambda term can be translated into an equivalent combinator expression (the bracket abstraction algorithm), and conversely, every combinator expression can be translated into a lambda term. The two systems have the same computational power.

Combinatory logic avoids the complications of binding and substitution entirely -- there are no bound variables, so there is no need for alpha-equivalence or capture-avoiding substitution. However, the translations between lambda terms and combinator expressions can cause a quadratic or even exponential blowup in size, making combinatory logic impractical as a source language (though it has been used as an intermediate representation in some compilers for functional languages, notably the G-machine for Haskell).

---

## 4. Worked Examples

### 4.1 Substitution Practice

Compute $[x \mapsto (\lambda y.\, y\; z)]\, (\lambda z.\, x\; z)$.

We have $\text{FV}(\lambda y.\, y\; z) = \{z\}$ and the bound variable of the outer lambda is $z$. Since $z \in \text{FV}(\lambda y.\, y\; z)$, we must alpha-rename before substituting:

$$
[x \mapsto (\lambda y.\, y\; z)]\, (\lambda z.\, x\; z) = [x \mapsto (\lambda y.\, y\; z)]\, (\lambda w.\, x\; w) \quad \text{(alpha-rename } z \to w\text{)}
$$

$$
= \lambda w.\, [x \mapsto (\lambda y.\, y\; z)]\, (x\; w) = \lambda w.\, (\lambda y.\, y\; z)\; w
$$

### 4.2 Reduction Sequences

Reduce $(\lambda x.\, \lambda y.\, x)\; ((\lambda z.\, z)\; w)$ under call-by-value (evaluate arguments before substituting).

Step 1: Evaluate the argument $(\lambda z.\, z)\; w$:

$$
(\lambda z.\, z)\; w \to_\beta w
$$

Step 2: Now apply:

$$
(\lambda x.\, \lambda y.\, x)\; w \to_\beta \lambda y.\, w
$$

Under call-by-name (substitute the unevaluated argument), we would instead do:

Step 1: Apply immediately:

$$
(\lambda x.\, \lambda y.\, x)\; ((\lambda z.\, z)\; w) \to_\beta \lambda y.\, (\lambda z.\, z)\; w
$$

Step 2: Reduce inside the body:

$$
\lambda y.\, (\lambda z.\, z)\; w \to_\beta \lambda y.\, w
$$

Both strategies reach the same normal form $\lambda y.\, w$, but via different intermediate terms.

### 4.3 De Bruijn Translation

Translate $\lambda f.\, \lambda x.\, f\; (f\; x)$ to de Bruijn indices.

Working from the inside out:
- $x$ is bound by the nearest enclosing $\lambda$ (the second one), so $x \mapsto 0$.
- $f$ is bound by the next enclosing $\lambda$ (the first one), so $f \mapsto 1$.

Result: $\lambda.\, \lambda.\, 1\; (1\; 0)$.

Verify: $(\lambda.\, \lambda.\, 1\; (1\; 0))\; (\lambda.\, 0)$

$$
\to_\beta \uparrow^{-1}_0([0 \mapsto \uparrow^1_0(\lambda.\, 0)]\, (\lambda.\, 1\; (1\; 0)))
$$

We need $\uparrow^1_0(\lambda.\, 0) = \lambda.\, 0$ (the $0$ inside is below cutoff $1$, inside the inner lambda).

Then $[0 \mapsto (\lambda.\, 0)]\, (\lambda.\, 1\; (1\; 0))$. Going under the inner $\lambda$:

$= \lambda.\, [1 \mapsto \uparrow^1_0(\lambda.\, 0)]\, (1\; (1\; 0))$

$= \lambda.\, [1 \mapsto (\lambda.\, 0)]\, (1\; (1\; 0))$

$= \lambda.\, (\lambda.\, 0)\; ((\lambda.\, 0)\; 0)$

Finally, $\uparrow^{-1}_0(\lambda.\, (\lambda.\, 0)\; ((\lambda.\, 0)\; 0)) = \lambda.\, (\lambda.\, 0)\; ((\lambda.\, 0)\; 0)$ (all indices are under binders, below their cutoffs).

The result $\lambda.\, (\lambda.\, 0)\; ((\lambda.\, 0)\; 0)$ corresponds to $\lambda x.\, (\lambda y.\, y)\; ((\lambda y.\, y)\; x)$, which is correct: applying "apply $f$ twice" to the identity gives "apply the identity twice."

### 4.4 Free Variable Computation

Compute $\text{FV}((\lambda x.\, y\; (\lambda y.\, x\; y))\; (\lambda z.\, z\; w))$.

For the function part:

$$
\text{FV}(\lambda x.\, y\; (\lambda y.\, x\; y)) = \text{FV}(y\; (\lambda y.\, x\; y)) \setminus \{x\}
$$

$$
= (\{y\} \cup \text{FV}(\lambda y.\, x\; y)) \setminus \{x\}
$$

$$
= (\{y\} \cup (\{x, y\} \setminus \{y\})) \setminus \{x\}
$$

$$
= (\{y\} \cup \{x\}) \setminus \{x\} = \{y\}
$$

For the argument part:

$$
\text{FV}(\lambda z.\, z\; w) = \{z, w\} \setminus \{z\} = \{w\}
$$

For the whole application:

$$
\text{FV}((\lambda x.\, y\; (\lambda y.\, x\; y))\; (\lambda z.\, z\; w)) = \{y\} \cup \{w\} = \{y, w\}
$$

### 4.5 Nested Substitution

Compute $[x \mapsto z]\, [y \mapsto x]\, (\lambda z.\, x\; y\; z)$.

First, apply the inner substitution $[y \mapsto x]$:

$$
[y \mapsto x]\, (\lambda z.\, x\; y\; z)
$$

Since $z \neq y$ and $z \notin \text{FV}(x) = \{x\}$ (assuming $z \neq x$), we can substitute under the lambda:

$$
= \lambda z.\, [y \mapsto x]\, (x\; y\; z) = \lambda z.\, x\; x\; z
$$

Now apply the outer substitution $[x \mapsto z]$:

$$
[x \mapsto z]\, (\lambda z.\, x\; x\; z)
$$

Here $z \in \text{FV}(z) = \{z\}$, so we must alpha-rename. Pick a fresh variable $w$:

$$
= \lambda w.\, [x \mapsto z]\, [z \mapsto w]\, (x\; x\; z) = \lambda w.\, [x \mapsto z]\, (x\; x\; w) = \lambda w.\, z\; z\; w
$$

---

## 5. Exercises

**Exercise 5.1.** Determine which of the following terms are alpha-equivalent. For those that are, exhibit the renaming. For those that are not, explain why.

- (a) $\lambda x.\, \lambda y.\, x\; y$ and $\lambda y.\, \lambda x.\, y\; x$
- (b) $\lambda x.\, x\; (\lambda x.\, x)$ and $\lambda y.\, y\; (\lambda z.\, z)$
- (c) $\lambda x.\, x\; y$ and $\lambda y.\, y\; y$

**Exercise 5.2.** Compute $\text{FV}(t)$ for each of the following terms:

- (a) $\lambda x.\, \lambda y.\, \lambda z.\, x\; z\; (y\; z)$
- (b) $(\lambda x.\, x\; x)\; (\lambda y.\, y\; z)$
- (c) $\lambda f.\, (\lambda x.\, f\; (x\; x))\; (\lambda x.\, f\; (x\; x))$

**Exercise 5.3.** Perform the following substitutions, showing all alpha-renamings:

- (a) $[x \mapsto \lambda y.\, y]\, (\lambda y.\, x\; y)$
- (b) $[f \mapsto \lambda x.\, x\; g]\, (\lambda g.\, f\; g)$
- (c) $[x \mapsto y\; z]\, (\lambda y.\, \lambda z.\, x\; y\; z)$

**Exercise 5.4.** Convert the following terms to de Bruijn index representation:

- (a) $\lambda f.\, \lambda g.\, \lambda x.\, f\; x\; (g\; x)$ (the $\mathbf{S}$ combinator)
- (b) $(\lambda x.\, \lambda y.\, x)\; (\lambda z.\, z)$
- (c) $\lambda x.\, (\lambda y.\, y\; x)\; (\lambda z.\, z)$

**Exercise 5.5.** Prove the substitution lemma (Proposition 2.14): if $x \neq y$ and $x \notin \text{FV}(s)$, then $[x \mapsto s]\, [y \mapsto r]\, t = [y \mapsto [x \mapsto s]\, r]\, [x \mapsto s]\, t$. *(Hint: structural induction on $t$.)*

**Exercise 5.6.** Prove that capture-avoiding substitution preserves alpha-equivalence: if $t_1 =_\alpha t_2$, then $[x \mapsto s]\, t_1 =_\alpha [x \mapsto s]\, t_2$.

**Exercise 5.7.** The **bracket abstraction** algorithm translates lambda terms into combinatory logic (using $\mathbf{S}$, $\mathbf{K}$, $\mathbf{I}$). Define:

$$
[x]^* M = \begin{cases} \mathbf{I} & \text{if } M = x \\ \mathbf{K}\; M & \text{if } x \notin \text{FV}(M) \\ \mathbf{S}\; ([x]^* M_1)\; ([x]^* M_2) & \text{if } M = M_1\; M_2 \end{cases}
$$

Use this algorithm to translate $\lambda x.\, \lambda y.\, x\; y$ into a combinator expression. Verify that the combinator expression has the same behavior by reducing $\text{result}\; a\; b$ and checking that it equals $a\; b$.

---

## Summary

The untyped lambda calculus is defined by three syntactic forms -- variables, abstractions, and applications -- and one computation rule -- beta-reduction. Despite this radical minimalism, the lambda calculus is a universal model of computation.

The main technical challenges of this lecture are:

1. **Alpha-equivalence**: Bound variable names do not matter; we identify terms that differ only in the names of their bound variables.
2. **Capture-avoiding substitution**: When substituting a term for a variable, we must rename bound variables as necessary to avoid capturing free variables.
3. **De Bruijn indices**: An alternative representation that eliminates naming issues by replacing variable names with numeric indices encoding the binding structure.

In the next lecture, we study the operational semantics of the lambda calculus in depth: evaluation strategies, the Church-Rosser theorem, and the question of normalization.

---

## Appendix: Complete Definition of the Untyped Lambda Calculus

For reference, we collect the complete formal definitions in one place.

### A.1 Syntax

$$
t ::= x \mid \lambda x.\, t \mid t\; t
$$

where $x$ ranges over a countably infinite set $\mathcal{V}$ of variable names.

**Conventions:** Application is left-associative. The body of an abstraction extends as far right as possible. Multiple abstractions may be collapsed: $\lambda x\, y\, z.\, t$ means $\lambda x.\, \lambda y.\, \lambda z.\, t$.

### A.2 Free Variables

$$
\text{FV}(x) = \{x\} \qquad \text{FV}(\lambda x.\, t) = \text{FV}(t) \setminus \{x\} \qquad \text{FV}(t_1\; t_2) = \text{FV}(t_1) \cup \text{FV}(t_2)
$$

### A.3 Alpha-Equivalence

$=_\alpha$ is the smallest congruence on $\Lambda$ containing:

$$
\lambda x.\, t =_\alpha \lambda y.\, [x \mapsto y]\, t \qquad \text{when } y \notin \text{FV}(t) \text{ and } y \neq x
$$

### A.4 Capture-Avoiding Substitution

$$
[x \mapsto s]\, x = s \qquad [x \mapsto s]\, y = y \text{ (}y \neq x\text{)}
$$

$$
[x \mapsto s]\, (t_1\; t_2) = ([x \mapsto s]\, t_1)\; ([x \mapsto s]\, t_2)
$$

$$
[x \mapsto s]\, (\lambda x.\, t) = \lambda x.\, t
$$

$$
[x \mapsto s]\, (\lambda y.\, t) = \lambda y.\, [x \mapsto s]\, t \quad \text{if } y \neq x,\ y \notin \text{FV}(s)
$$

$$
[x \mapsto s]\, (\lambda y.\, t) = \lambda z.\, [x \mapsto s]\, [y \mapsto z]\, t \quad \text{if } y \neq x,\ y \in \text{FV}(s),\ z \text{ fresh}
$$

### A.5 Beta-Reduction

$$
(\lambda x.\, t)\; s \to_\beta [x \mapsto s]\, t \qquad \text{(Beta)}
$$

Compatible closure rules: Cong-Abs, Cong-App1, Cong-App2 (see Section 2.11).

### A.6 Eta-Reduction

$$
\lambda x.\, t\; x \to_\eta t \qquad \text{when } x \notin \text{FV}(t)
$$

### A.7 De Bruijn Representation

$$
t ::= n \mid \lambda.\, t \mid t\; t \qquad (n \in \mathbb{N})
$$

Shifting: $\uparrow^d_c(k) = k$ if $k < c$, $k + d$ if $k \ge c$. Under lambda: $\uparrow^d_c(\lambda.\, t) = \lambda.\, \uparrow^d_{c+1}(t)$.

Substitution: $[j \mapsto s]\, k = s$ if $k = j$, $k$ otherwise. Under lambda: $[j \mapsto s]\, (\lambda.\, t) = \lambda.\, [j+1 \mapsto \uparrow^1_0(s)]\, t$.

Beta: $(\lambda.\, t)\; s \to_\beta \uparrow^{-1}_0([0 \mapsto \uparrow^1_0(s)]\, t)$.

### A.8 Key Properties

| Property | Holds? |
|----------|--------|
| Determinacy of full beta-reduction | No (non-deterministic) |
| Confluence (Church-Rosser) | Yes |
| Uniqueness of normal forms | Yes (up to $=_\alpha$) |
| Every term has a normal form | No ($\Omega$ does not) |
| Strong normalization | No |

---

## Further Reading

- **Pierce, B. C.** *Types and Programming Languages* (2002), Chapter 5. The primary reference for the untyped lambda calculus.
- **Barendregt, H. P.** *The Lambda Calculus: Its Syntax and Semantics* (1984). The encyclopedic reference on the lambda calculus. Chapters 1-3 cover the material of this lecture in full generality.
- **Church, A.** "An Unsolvable Problem of Elementary Number Theory" (1936). The original paper introducing the lambda calculus.
- **Church, A.** "A Formulation of the Simple Theory of Types" (1940). Introduces the typed lambda calculus.
- **de Bruijn, N. G.** "Lambda Calculus Notation with Nameless Dummies" (1972). The original paper on de Bruijn indices.
- **Hindley, J. R. and Seldin, J. P.** *Lambda-Calculus and Combinators: An Introduction* (2008). An excellent textbook covering both the lambda calculus and combinatory logic.
- **Barendregt, H. P.** "The Impact of the Lambda Calculus in Logic and Computer Science" (1997). A survey of the lambda calculus and its applications.
- **Curry, H. B. and Feys, R.** *Combinatory Logic, Volume I* (1958). The classic reference on combinatory logic.
