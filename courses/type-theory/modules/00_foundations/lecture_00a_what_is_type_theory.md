---
title: "Lecture 00a: What Is Type Theory?"
tags:
  - type-theory
  - foundations
  - lecture
---
# Lecture 00a: What Is Type Theory?

> **Module 00 --- Mathematical Foundations (Pre-Work)**
> Estimated study time: 3-4 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain what type theory is and how it differs from set theory as a foundation.
2. Identify the central question of type theory: "what programs are well-formed?"
3. Read a simple typing judgment $\Gamma \vdash e : \tau$ and explain each component.
4. Trace through a small example of the simply typed lambda calculus.
5. State the Curry-Howard correspondence informally: types are propositions, programs are proofs.
6. Describe the arc of this course and what each module contributes to the overall picture.

---

## 1. The Central Idea

Type theory studies **classification**. Given a program, what can we say about its behavior *without running it*?

Consider this expression in a hypothetical programming language:

```
if true then 42 else "hello"
```

Should this be allowed? A human can see it always returns `42`, but what *type* does it have --- `Int` or `String`? A type system is a set of rules that answers questions like this at compile time, before execution.

At its heart, type theory asks:

> **Given a term $t$ and a type $T$, can we determine whether $t$ has type $T$?**

This sounds simple. The depth comes from three directions:

1. **What types do we allow?** Simple types like `Int -> Bool`? Polymorphic types like `forall a. a -> a`? Types that depend on values, like `Vec n` (a vector of exactly $n$ elements)?
2. **What can we prove about well-typed programs?** Do they always terminate? Do they never crash? Do they satisfy a specification?
3. **What is the relationship between types and logic?** This turns out to be the deepest question of all.

---

## 2. A First Example: Why Types?

### 2.1 The Untyped World

In the *untyped lambda calculus* (Module 01), every expression is built from just three forms:

$$x \qquad \lambda x.\, e \qquad e_1\; e_2$$

Variables, functions, and function application. That is the entire language. There are no numbers, no booleans, no types --- just functions. You can write:

$$(\lambda x.\, x)\; (\lambda y.\, y)$$

This applies the identity function to itself. It evaluates to $\lambda y.\, y$. Fine.

But you can also write:

$$(\lambda x.\, x\; x)\; (\lambda x.\, x\; x)$$

This is the infamous $\Omega$ combinator. It tries to apply $x$ to itself, and when you substitute, you get the same expression back. **It runs forever.** There is no way to know this without trying to run it.

Worse, you can write things like:

$$\text{true}\; 42$$

Applying a boolean to a number --- nonsensical, but the untyped calculus has no mechanism to reject it. It just gets *stuck*: evaluation reaches a point where no rule applies, and the program is broken.

### 2.2 The Typed World

The *simply typed lambda calculus* (Module 02) adds types to prevent these problems. Now every function declares what type it expects and what type it returns:

$$\lambda x : \text{Nat}.\, x + 1 \quad : \quad \text{Nat} \to \text{Nat}$$

The expression $\text{true}\; 42$ is **rejected** because `true` has type `Bool`, not a function type, and so it cannot be applied to anything. The self-application $x\; x$ is also rejected: if $x : A$, then to apply $x$ to itself we would need $x : A \to B$ simultaneously, which means $A = A \to B$ --- an infinite type with no finite solution.

**This is the fundamental bargain of type theory**: we give up some expressiveness (we can no longer write $\Omega$) and gain safety guarantees about all programs that survive type-checking.

### 2.3 Type Safety

The central theorem of simple type theory is **type safety**, which says:

> **Well-typed programs do not get stuck.**

This is made precise by two lemmas:

- **Progress**: If $\vdash e : T$ (the term $e$ has type $T$ in the empty context), then either $e$ is already a value, or it can take a step $e \longrightarrow e'$.
- **Preservation**: If $\Gamma \vdash e : T$ and $e \longrightarrow e'$, then $\Gamma \vdash e' : T$. Evaluation preserves types.

Together they say: start with a well-typed closed term, keep evaluating, and you will either reach a value or keep evaluating forever --- but you will **never** get stuck. (In the simply typed lambda calculus, you always reach a value, because all well-typed terms terminate. This is *normalization*.)

Proving these two theorems for increasingly rich type systems is the central technical activity of this course.

---

## 3. Reading a Typing Judgment

A typing judgment has the form:

$$\Gamma \vdash e : T$$

Read this as: "In context $\Gamma$, expression $e$ has type $T$."

- **$\Gamma$** (the context) is a list of assumptions about variables: $x_1 : T_1, x_2 : T_2, \ldots$ It says "assume $x_1$ has type $T_1$, $x_2$ has type $T_2$, etc."
- **$e$** (the term) is the expression being typed.
- **$T$** (the type) is the type assigned to $e$.
- **$\vdash$** (the turnstile) means "entails" or "proves."

Typing rules are written as *inference rules*:

$$\frac{\Gamma, x : T_1 \vdash e : T_2}{\Gamma \vdash (\lambda x : T_1.\, e) : T_1 \to T_2} \quad \text{(T-Abs)}$$

This says: "If, by assuming $x$ has type $T_1$, we can show that $e$ has type $T_2$, then the function $\lambda x : T_1.\, e$ has type $T_1 \to T_2$."

And for application:

$$\frac{\Gamma \vdash e_1 : T_1 \to T_2 \quad \Gamma \vdash e_2 : T_1}{\Gamma \vdash e_1\; e_2 : T_2} \quad \text{(T-App)}$$

"If $e_1$ is a function from $T_1$ to $T_2$, and $e_2$ has type $T_1$, then applying $e_1$ to $e_2$ gives a result of type $T_2$."

A **typing derivation** is a tree of such rules. Here is the derivation showing that the identity function on naturals has the expected type:

$$\frac{\frac{}{x : \text{Nat} \vdash x : \text{Nat}} \quad \text{(T-Var)}}{\vdash (\lambda x : \text{Nat}.\, x) : \text{Nat} \to \text{Nat}} \quad \text{(T-Abs)}$$

This is one of the simplest possible derivations. By the end of Module 02, you will build much larger ones and prove that the rules are sound.

---

## 4. The Curry-Howard Correspondence

The most profound insight of type theory is that **types and logical propositions are the same thing**, and **programs and proofs are the same thing**. This is the Curry-Howard correspondence (Module 02, Lecture 02d).

Here is a taste. Consider the logical proposition:

$$A \implies B \implies A$$

("If $A$, then if $B$, then $A$." This is true: the first hypothesis gives us $A$ regardless of $B$.)

A proof in natural deduction:

1. Assume $A$.
2. Assume $B$.
3. Conclude $A$ (by re-using assumption 1).

Now translate this to type theory. The proposition $A \implies B \implies A$ becomes the type $A \to B \to A$. A proof of this proposition becomes a *program* of this type:

$$\lambda a : A.\, \lambda b : B.\, a \quad : \quad A \to B \to A$$

The function takes an argument of type $A$, takes an argument of type $B$, and returns the first argument. **The proof IS the program.** Under this correspondence:

| Logic | Type Theory |
|-------|-------------|
| Proposition | Type |
| Proof | Program (term) |
| $A \implies B$ | $A \to B$ (function type) |
| $A \land B$ | $A \times B$ (pair type) |
| $A \lor B$ | $A + B$ (sum type) |
| True ($\top$) | Unit type |
| False ($\bot$) | Void type (empty type) |
| $\forall x.\, P(x)$ | $\Pi(x : A).\, B(x)$ (dependent function type) |
| $\exists x.\, P(x)$ | $\Sigma(x : A).\, B(x)$ (dependent pair type) |

This is not a metaphor. It is a precise, formal isomorphism. The typing rules for the simply typed lambda calculus ARE the inference rules for intuitionistic propositional logic, written in different notation.

This correspondence deepens through every module of the course. By Module 08, you will see that dependent type theory corresponds to full predicate logic, and that proof assistants like Coq and Lean are literally programming languages whose type checkers verify mathematical proofs.

---

## 5. The Arc of This Course

Here is how the modules fit together, and what each one adds to your understanding:

**Module 01: Untyped Systems.** We start without types. You build a lambda calculus interpreter and understand evaluation, substitution, and the Church-Rosser theorem. This is the *substrate* on which types are imposed.

**Module 02: Simply Typed Lambda Calculus.** We add simple types ($\text{Bool}$, $\text{Nat}$, $T_1 \to T_2$) and prove the first type safety theorem. You meet the Curry-Howard correspondence. This is the *heart* of the course --- everything else extends this foundation.

**Module 03: Extensions & Recursive Types.** Real languages need references (mutable state), exceptions, and recursive data structures (lists, trees). We extend the type system and re-prove safety for each addition. You learn to add features to a type system without breaking its guarantees.

**Module 04: Subtyping.** We add a relation $S <: T$ ("$S$ is a subtype of $T$") and a subsumption rule that lets you use an $S$ wherever a $T$ is expected. This models inheritance, structural typing, and record extension. Contravariance of function arguments is the key subtlety.

**Module 05: Type Inference.** Can the compiler figure out the types automatically? Yes, for Hindley-Milner (the type system of ML and Haskell). You implement Algorithm W, which infers the most general type of any expression. You also learn why type inference becomes undecidable for richer systems.

**Module 06: Polymorphism & System F.** Types themselves become parameters: $\forall X.\, X \to X$ is the type of the polymorphic identity function. System F (Girard-Reynolds) lets you abstract over types. Parametricity --- the idea that a polymorphic function must work uniformly for all types --- gives you "theorems for free."

**Module 07: Higher-Order Types & the Lambda Cube.** Types can take types as arguments (type operators, kinds). The lambda cube organizes eight type systems along three axes: terms depending on terms, types depending on types, and types depending on terms.

**Module 08: Dependent Types.** The most expressive axis: types that depend on values. The type $\text{Vec}(A, n)$ describes a vector of exactly $n$ elements of type $A$. Under Curry-Howard, this corresponds to full predicate logic. Proof assistants (Coq, Lean, Agda) are based on dependent type theory.

**Module 09: Substructural & Effect Types.** What if variables must be used exactly once? Linear types track resource usage (memory, file handles, network connections). Rust's ownership model is an affine type system. Session types enforce communication protocols. Effect systems track side effects.

**Module 10: Frontiers.** Homotopy type theory treats equality itself as a first-class concept, connecting type theory to algebraic topology. Cubical type theory makes this computational. Gradual typing bridges static and dynamic typing.

---

## 6. The Tools You Will Build

This is not a theory-only course. In every module, you implement the type system you are studying. By the end, you will have built:

1. **A lambda calculus interpreter** (Module 01) --- parsing, substitution, evaluation.
2. **A type checker** (Module 02) --- the core algorithm that checks typing derivations.
3. **Extensions** (Modules 03-04) --- references, exceptions, recursive types, subtyping.
4. **A type inference engine** (Module 05) --- unification, Algorithm W, let-polymorphism.
5. **A polymorphic type checker** (Module 06) --- System F with universal and existential types.
6. **A dependent type checker** (Module 08) --- Pi types, Sigma types, normalization.
7. **A linear type checker** (Module 09) --- tracking variable usage.
8. **A proof assistant core** (Mini-Project 2) --- a small language where types are theorems and programs are proofs.

All implementations are in OCaml, a statically-typed functional language that is itself a product of type theory research.

---

## 7. What Type Theory Is Not

A few common misconceptions:

**Type theory is not just "the type system of language X."** While Java, Haskell, Rust, and TypeScript all have type systems informed by type theory, the field is much broader. It is a branch of mathematical logic and foundations of mathematics, not just a programming tool.

**Type theory is not set theory.** In set theory, a set is a collection of objects, and membership ($x \in S$) is a proposition that is either true or false. In type theory, typing ($x : T$) is a *judgment* --- it is not something you prove or disprove after the fact, but something that is part of the definition of $x$. You cannot ask "does $3$ have type $\text{String}$?" in the same way you can ask "is $3 \in \mathbb{R}$?" --- the question is malformed if $3$ was introduced as a $\text{Nat}$.

**Type theory is not about preventing bugs.** Bug prevention is a *consequence*, not the *purpose*. The purpose is to give a precise, compositional account of what programs mean. Type safety is one such account. Parametricity is another. The Curry-Howard correspondence reveals that types are a theory of *truth* --- or more precisely, of *constructive evidence*.

---

## 8. How to Approach This Course

**Read actively.** When you see an inference rule, try to state it in English before reading the explanation. When you see a theorem, try to sketch a proof before reading ours.

**Implement everything.** The recitations give you complete, runnable OCaml implementations. Type them in, run them, modify them, break them. Understanding a type checker by reading about it is like understanding swimming by reading about it.

**Connect logic and types.** Whenever you learn a new type construct (products, sums, polymorphism, dependent types), ask: "What logical connective does this correspond to?" This single question will organize the entire subject for you.

**Do the proofs.** Progress and preservation proofs are the backbone of type theory. The first few feel tedious. By Module 04, they will feel like a superpower --- you will be able to add any feature to a type system and *know* it is safe.

---

## Summary

- Type theory classifies programs by their behavior, answering "what can this expression do?" without running it.
- A typing judgment $\Gamma \vdash e : T$ says "in context $\Gamma$, expression $e$ has type $T$."
- Type safety (progress + preservation) guarantees that well-typed programs do not get stuck.
- The Curry-Howard correspondence identifies types with propositions and programs with proofs.
- This course progresses from the untyped lambda calculus through simple types, polymorphism, dependent types, linear types, and homotopy type theory.
- Every type system is implemented in OCaml as a working type checker.

## Further Reading

- Pierce, *Types and Programming Languages*, Chapter 1 ("Introduction") --- an accessible overview of the field.
- Wadler, "Propositions as Types" (2015) --- a beautifully written survey of the Curry-Howard correspondence, accessible to anyone with programming experience.
- Harper, *Practical Foundations for Programming Languages*, Chapter 1 ("Judgments and Rules") --- a concise introduction to the judgmental method.
- Cardelli, "Type Systems" (2004) --- a survey article placing type theory in the context of programming language design.
- Thompson, *Type Theory and Functional Programming*, Chapter 1 (freely available online) --- a gentle introduction connecting types, logic, and programming.
