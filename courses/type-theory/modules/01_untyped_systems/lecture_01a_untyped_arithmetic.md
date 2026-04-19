---
title: "Lecture 01a: Untyped Arithmetic Expressions"
tags:
  - type-theory
  - untyped
  - lecture
---
# Lecture 01a: Untyped Arithmetic Expressions

> **Module 01 -- Untyped Systems (Weeks 1-2)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the syntax of a small language of booleans and natural numbers using BNF grammar and inductive definitions.
2. **Distinguish** between concrete syntax, abstract syntax, and abstract syntax trees.
3. **Prove** properties of terms using structural induction over the inductive definition.
4. **Formulate** small-step operational semantics as a binary relation on terms.
5. **Define** the notions of values, normal forms, and stuck terms precisely.
6. **State and prove** the determinacy of evaluation for the arithmetic expression language.
7. **Compare** the three major styles of formal semantics: operational, denotational, and axiomatic.
8. **Trace** multi-step evaluation sequences for arithmetic expressions by hand.

---

## 1. Motivation

Programming language theory begins with the simplest possible question: how do we give precise meaning to programs? Before we can study type systems, we need a formal framework for describing what programs are (syntax) and what they do (semantics). This lecture introduces both concepts through a language so small that we can completely specify it in a few pages, yet rich enough to illustrate all the essential ideas.

The language we study here -- a calculus of booleans and natural numbers drawn from Chapter 3 of Pierce's *Types and Programming Languages* -- is a pedagogical instrument. No one would write real programs in it. But every concept we introduce (inductive definitions, evaluation relations, normal forms, determinacy) will reappear in increasingly sophisticated settings throughout this course. Master them here, where the combinatorial complexity is trivial, and the transition to the lambda calculus, the simply typed lambda calculus, and beyond will be far smoother.

A secondary motivation is methodological. Formal semantics is not merely an academic exercise. The practice of defining languages precisely enough to prove theorems about them is exactly the same practice that produces reliable compilers, verified software, and trustworthy proof assistants. The tools of this lecture -- inference rules, induction principles, derivation trees -- are the daily bread of the working language theorist.

---

## 2. Core Theory

### 2.1 Syntax: Informal Description

Our language has two sorts of values: booleans ($\text{true}$, $\text{false}$) and natural numbers ($0, 1, 2, \ldots$). It provides:

- Boolean constants $\text{true}$ and $\text{false}$.
- A conditional expression $\text{if } t_1 \text{ then } t_2 \text{ else } t_3$.
- The natural number zero: $0$.
- The successor of a natural number: $\text{succ } t$.
- The predecessor of a natural number: $\text{pred } t$.
- A test for zero: $\text{iszero } t$.

We intentionally omit addition, multiplication, and other arithmetic operations. The language is designed to be minimal -- just complex enough to illustrate the key ideas without burying them in cases.

### 2.2 Syntax: BNF Grammar

The **concrete syntax** of the language is given by the following BNF grammar:

$$
t ::= \text{true} \mid \text{false} \mid \text{if } t \text{ then } t \text{ else } t \mid 0 \mid \text{succ } t \mid \text{pred } t \mid \text{iszero } t
$$

Here $t$ is a **metavariable** ranging over terms. The grammar is recursive: the term $\text{succ } t$ contains a subterm $t$, which is itself described by the same grammar.

**Remark.** This grammar is ambiguous about parsing: does $\text{succ pred } 0$ mean $\text{succ}(\text{pred } 0)$ or $(\text{succ pred}) 0$? Since we work with abstract syntax trees rather than strings, this ambiguity does not arise in the formal treatment. We adopt the convention that each syntactic form binds as tightly as possible to its immediate argument.

### 2.3 Syntax: Inductive Definition of Terms

For formal work, we replace the BNF grammar with an equivalent but more precise inductive definition.

**Definition 2.1 (Terms).** The set of terms $\mathcal{T}$ is the smallest set satisfying the following conditions:

1. $\text{true} \in \mathcal{T}$
2. $\text{false} \in \mathcal{T}$
3. $0 \in \mathcal{T}$
4. If $t_1 \in \mathcal{T}$, then $\text{succ } t_1 \in \mathcal{T}$
5. If $t_1 \in \mathcal{T}$, then $\text{pred } t_1 \in \mathcal{T}$
6. If $t_1 \in \mathcal{T}$, then $\text{iszero } t_1 \in \mathcal{T}$
7. If $t_1 \in \mathcal{T}$ and $t_2 \in \mathcal{T}$ and $t_3 \in \mathcal{T}$, then $\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \in \mathcal{T}$

The phrase "smallest set" is doing essential work. Without it, the definition would be satisfied by many sets -- for example, any set containing $\mathcal{T}$ as a subset. Requiring minimality ensures that $\mathcal{T}$ contains *only* the terms constructible by finite applications of rules 1-7.

### 2.4 Three Equivalent Formulations

There are three standard ways to define $\mathcal{T}$, and they are provably equivalent. Understanding all three is important because different formulations are convenient in different proof contexts.

**Formulation 1: Induction on generation (Definition 2.1 above).**

The set $\mathcal{T}$ is defined as the closure of the base cases $\{\text{true}, \text{false}, 0\}$ under the constructors $\text{succ}$, $\text{pred}$, $\text{iszero}$, and $\text{if-then-else}$.

**Formulation 2: Inference rules.**

We write the same definition using inference rules:

$$
\frac{}{\text{true} \in \mathcal{T}} \qquad \frac{}{\text{false} \in \mathcal{T}} \qquad \frac{}{0 \in \mathcal{T}}
$$

$$
\frac{t_1 \in \mathcal{T}}{\text{succ } t_1 \in \mathcal{T}} \qquad \frac{t_1 \in \mathcal{T}}{\text{pred } t_1 \in \mathcal{T}} \qquad \frac{t_1 \in \mathcal{T}}{\text{iszero } t_1 \in \mathcal{T}}
$$

$$
\frac{t_1 \in \mathcal{T} \quad t_2 \in \mathcal{T} \quad t_3 \in \mathcal{T}}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \in \mathcal{T}}
$$

Rules with no premises above the line are called **axioms**. The set $\mathcal{T}$ is defined as the smallest set closed under these rules.

**Formulation 3: Iterative construction.**

Define a sequence of sets $\mathcal{S}_0 \subseteq \mathcal{S}_1 \subseteq \mathcal{S}_2 \subseteq \cdots$ by:

$$
\mathcal{S}_0 = \emptyset
$$

$$
\mathcal{S}_{i+1} = \{\text{true}, \text{false}, 0\} \cup \{\text{succ } t \mid t \in \mathcal{S}_i\} \cup \{\text{pred } t \mid t \in \mathcal{S}_i\} \cup \{\text{iszero } t \mid t \in \mathcal{S}_i\}
$$

$$
\phantom{\mathcal{S}_{i+1} = } \cup\ \{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \mid t_1, t_2, t_3 \in \mathcal{S}_i\}
$$

Then $\mathcal{T} = \bigcup_{i \ge 0} \mathcal{S}_i$.

**Proposition 2.2.** The three formulations define the same set $\mathcal{T}$.

*Proof sketch.* Formulation 1 and Formulation 2 are notational variants of each other. To show equivalence with Formulation 3, one proves (a) $\bigcup_i \mathcal{S}_i \subseteq \mathcal{T}$ by induction on $i$, noting that each $\mathcal{S}_i \subseteq \mathcal{T}$ since $\mathcal{T}$ is closed under the constructors; and (b) $\mathcal{T} \subseteq \bigcup_i \mathcal{S}_i$ by showing that $\bigcup_i \mathcal{S}_i$ is itself closed under all constructors and hence contains any set defined as the smallest such closure. $\square$

### 2.5 Abstract Syntax Trees

Every term has a unique **abstract syntax tree** (AST). The internal nodes are labeled with constructors ($\text{succ}$, $\text{pred}$, $\text{iszero}$, $\text{if-then-else}$) and the leaves are labeled with constants ($\text{true}$, $\text{false}$, $0$).

For example, the term $\text{if } (\text{iszero } 0) \text{ then } 0 \text{ else } (\text{pred } 0)$ has the AST:

```
        if-then-else
       /     |       \
   iszero    0      pred
     |                |
     0                0
```

We henceforth identify terms with their ASTs. When we say "term," we mean the tree, not the string.

### 2.6 Induction on Terms

The inductive definition of $\mathcal{T}$ gives us a powerful proof technique: **structural induction**.

**Theorem 2.3 (Principle of Structural Induction on Terms).** Let $P$ be a property of terms. To show that $P(t)$ holds for all $t \in \mathcal{T}$, it suffices to show:

1. $P(\text{true})$, $P(\text{false})$, and $P(0)$. *(Base cases.)*
2. If $P(t_1)$, then $P(\text{succ } t_1)$. *(Inductive step for succ.)*
3. If $P(t_1)$, then $P(\text{pred } t_1)$. *(Inductive step for pred.)*
4. If $P(t_1)$, then $P(\text{iszero } t_1)$. *(Inductive step for iszero.)*
5. If $P(t_1)$ and $P(t_2)$ and $P(t_3)$, then $P(\text{if } t_1 \text{ then } t_2 \text{ else } t_3)$. *(Inductive step for if-then-else.)*

*Proof.* The set $\{t \in \mathcal{T} \mid P(t)\}$ is closed under all constructors (by assumptions 1-5) and contains the base cases (by assumption 1). Since $\mathcal{T}$ is the smallest such set, $\{t \mid P(t)\} \supseteq \mathcal{T}$, i.e., $P$ holds for all terms. $\square$

### 2.7 Functions on Terms: Size, Depth, Constants

We can define functions on terms by structural recursion, following the same pattern as inductive proofs.

**Definition 2.4 (Size).** The **size** of a term, $|t|$, is defined by:

$$
|\text{true}| = 1 \qquad |\text{false}| = 1 \qquad |0| = 1
$$

$$
|\text{succ } t_1| = |t_1| + 1 \qquad |\text{pred } t_1| = |t_1| + 1 \qquad |\text{iszero } t_1| = |t_1| + 1
$$

$$
|\text{if } t_1 \text{ then } t_2 \text{ else } t_3| = |t_1| + |t_2| + |t_3| + 1
$$

**Definition 2.5 (Depth).** The **depth** of a term is:

$$
\text{depth}(\text{true}) = 1 \qquad \text{depth}(\text{false}) = 1 \qquad \text{depth}(0) = 1
$$

$$
\text{depth}(\text{succ } t_1) = \text{depth}(t_1) + 1
$$

$$
\text{depth}(\text{if } t_1 \text{ then } t_2 \text{ else } t_3) = \max(\text{depth}(t_1), \text{depth}(t_2), \text{depth}(t_3)) + 1
$$

(and similarly for $\text{pred}$ and $\text{iszero}$).

**Definition 2.6 (Constants).** The set of constants appearing in a term is:

$$
\text{Consts}(\text{true}) = \{\text{true}\} \qquad \text{Consts}(\text{false}) = \{\text{false}\} \qquad \text{Consts}(0) = \{0\}
$$

$$
\text{Consts}(\text{succ } t_1) = \text{Consts}(t_1) \qquad \text{Consts}(\text{pred } t_1) = \text{Consts}(t_1)
$$

$$
\text{Consts}(\text{iszero } t_1) = \text{Consts}(t_1)
$$

$$
\text{Consts}(\text{if } t_1 \text{ then } t_2 \text{ else } t_3) = \text{Consts}(t_1) \cup \text{Consts}(t_2) \cup \text{Consts}(t_3)
$$

**Proposition 2.7.** For every term $t$, $|\text{Consts}(t)| \le |t|$.

*Proof.* By structural induction on $t$.

- Base cases: $|\text{Consts}(\text{true})| = 1 = |\text{true}|$. Similarly for $\text{false}$ and $0$.
- Inductive step ($\text{succ}$): $|\text{Consts}(\text{succ } t_1)| = |\text{Consts}(t_1)| \le |t_1| < |t_1| + 1 = |\text{succ } t_1|$ by the induction hypothesis.
- Inductive step ($\text{if-then-else}$): $|\text{Consts}(\text{if } t_1 \text{ then } t_2 \text{ else } t_3)| = |\text{Consts}(t_1) \cup \text{Consts}(t_2) \cup \text{Consts}(t_3)| \le |\text{Consts}(t_1)| + |\text{Consts}(t_2)| + |\text{Consts}(t_3)| \le |t_1| + |t_2| + |t_3| < |t_1| + |t_2| + |t_3| + 1 = |\text{if } t_1 \text{ then } t_2 \text{ else } t_3|$ by the induction hypothesis applied to each subterm. $\square$

### 2.8 Semantic Styles: An Overview

Before defining the semantics of our language, we briefly survey the three major approaches to giving meaning to programming languages.

**Operational semantics** defines meaning by specifying how programs execute, step by step. The meaning of a program is the sequence of computational steps it takes to reach a result. This is the approach we will use throughout this course.

There are two variants:

- **Small-step** (structural) operational semantics: defines a single-step evaluation relation $t \to t'$, read "$t$ steps to $t'$." The meaning of $t$ is obtained by iterating the relation until no further steps are possible.
- **Big-step** (natural) semantics: defines a relation $t \Downarrow v$, read "$t$ evaluates to value $v$," which directly connects terms to their final values.

**Denotational semantics** defines meaning by mapping programs to mathematical objects (typically elements of domains or other structured sets). The meaning of a program is not a sequence of steps but a static mathematical entity. The key tool is domain theory, developed by Dana Scott and Christopher Strachey in the late 1960s.

For our arithmetic language, a denotational semantics might map terms to elements of $\mathbb{N} \cup \mathbb{B} \cup \{\bot\}$, where $\bot$ represents "undefined" (a stuck computation). While elegant, denotational semantics becomes technically demanding for languages with recursion and higher-order functions, which is one reason operational semantics has become the dominant style in programming language theory.

**Axiomatic semantics** defines meaning indirectly by specifying laws (axioms) that the meaning must satisfy, typically as pre- and post-condition assertions in the style of Hoare logic:

$$
\{P\}\ C\ \{Q\}
$$

This reads: "If precondition $P$ holds before executing command $C$, then postcondition $Q$ holds after." Axiomatic semantics is primarily used for imperative programs and verification, and is less natural for functional languages.

**Our choice.** We adopt small-step operational semantics as our primary tool. It composes well (we can extend the language incrementally by adding new evaluation rules), and it makes the distinction between stuck terms and successfully evaluated terms crystal clear.

### 2.9 Values

Not every term is the "result" of a computation. We need to identify which terms represent completed computations -- the **values**.

**Definition 2.8 (Boolean values).**

$$
bv ::= \text{true} \mid \text{false}
$$

**Definition 2.9 (Numeric values).** Numeric values are defined inductively:

$$
nv ::= 0 \mid \text{succ } nv
$$

That is, a numeric value is either $0$ or $\text{succ}$ applied to a numeric value. The numeric values are $0, \text{succ } 0, \text{succ}(\text{succ } 0), \ldots$, representing the natural numbers $0, 1, 2, \ldots$ in unary.

**Definition 2.10 (Values).**

$$
v ::= bv \mid nv
$$

A value is either a boolean value or a numeric value.

**Remark.** The term $\text{succ } \text{true}$ is a well-formed term (it is in $\mathcal{T}$) but it is *not* a value. It is not a numeric value because $\text{true}$ is not a numeric value. And it is not a boolean value because it does not have the form $\text{true}$ or $\text{false}$. This term represents a "type error" in our untyped setting. We will return to this point when we discuss stuck terms.

### 2.10 Small-Step Evaluation Rules: Booleans

The **evaluation relation** for booleans is the smallest binary relation $\to$ on terms satisfying the following rules.

$$
\frac{}{\text{if } \text{true} \text{ then } t_2 \text{ else } t_3 \to t_2} \quad \text{(E-IfTrue)}
$$

$$
\frac{}{\text{if } \text{false} \text{ then } t_2 \text{ else } t_3 \to t_3} \quad \text{(E-IfFalse)}
$$

$$
\frac{t_1 \to t_1'}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \to \text{if } t_1' \text{ then } t_2 \text{ else } t_3} \quad \text{(E-If)}
$$

Rules E-IfTrue and E-IfFalse are **computation rules**: they perform actual work by eliminating the conditional. Rule E-If is a **congruence rule**: it specifies where evaluation can happen next (in the guard position), without doing any computation itself.

**Key design choice.** The congruence rule E-If evaluates only $t_1$ (the guard), not $t_2$ or $t_3$. This enforces a specific evaluation strategy: we evaluate the guard first, then select a branch. This is a deterministic, left-to-right, call-by-value-like strategy.

### 2.11 Small-Step Evaluation Rules: Natural Numbers

$$
\frac{t_1 \to t_1'}{\text{succ } t_1 \to \text{succ } t_1'} \quad \text{(E-Succ)}
$$

$$
\frac{}{\text{pred } 0 \to 0} \quad \text{(E-PredZero)}
$$

$$
\frac{}{\text{pred } (\text{succ } nv_1) \to nv_1} \quad \text{(E-PredSucc)}
$$

$$
\frac{t_1 \to t_1'}{\text{pred } t_1 \to \text{pred } t_1'} \quad \text{(E-Pred)}
$$

$$
\frac{}{\text{iszero } 0 \to \text{true}} \quad \text{(E-IszeroZero)}
$$

$$
\frac{}{\text{iszero } (\text{succ } nv_1) \to \text{false}} \quad \text{(E-IszeroSucc)}
$$

$$
\frac{t_1 \to t_1'}{\text{iszero } t_1 \to \text{iszero } t_1'} \quad \text{(E-Iszero)}
$$

**Observation about E-PredSucc and E-IszeroSucc.** These rules require that the argument to $\text{succ}$ be a *numeric value* $nv_1$, not an arbitrary term. This ensures that we fully evaluate the argument before applying pred or iszero.

### 2.12 Evaluation Derivations

An **evaluation derivation** (or derivation tree) is a tree of rule instances proving that $t \to t'$. Each leaf is an axiom (a rule with no premises), and each internal node is a rule whose children are derivations of its premises.

**Example 2.11.** Let us derive the first step of evaluating the term:

$$
\text{if } (\text{iszero } (\text{pred } (\text{succ } 0))) \text{ then } 0 \text{ else } (\text{succ } 0)
$$

We need to evaluate the guard. The innermost redex is $\text{pred } (\text{succ } 0)$.

Step 1:

$$
\frac{\frac{\frac{}{\text{pred } (\text{succ } 0) \to 0}\text{ E-PredSucc}}{\text{iszero } (\text{pred } (\text{succ } 0)) \to \text{iszero } 0}\text{ E-Iszero}}{\text{if } (\text{iszero } (\text{pred } (\text{succ } 0))) \text{ then } 0 \text{ else } (\text{succ } 0) \to \text{if } (\text{iszero } 0) \text{ then } 0 \text{ else } (\text{succ } 0)}\text{ E-If}
$$

Step 2:

$$
\frac{\frac{}{\text{iszero } 0 \to \text{true}}\text{ E-IszeroZero}}{\text{if } (\text{iszero } 0) \text{ then } 0 \text{ else } (\text{succ } 0) \to \text{if } \text{true} \text{ then } 0 \text{ else } (\text{succ } 0)}\text{ E-If}
$$

Step 3:

$$
\frac{}{\text{if } \text{true} \text{ then } 0 \text{ else } (\text{succ } 0) \to 0}\text{ E-IfTrue}
$$

The complete evaluation sequence is:

$$
\text{if } (\text{iszero } (\text{pred } (\text{succ } 0))) \text{ then } 0 \text{ else } (\text{succ } 0) \to \text{if } (\text{iszero } 0) \text{ then } 0 \text{ else } (\text{succ } 0)
$$

$$
\to \text{if } \text{true} \text{ then } 0 \text{ else } (\text{succ } 0) \to 0
$$

The final result, $0$, is a value (specifically, a numeric value).

### 2.13 Normal Forms and Stuck Terms

**Definition 2.12 (Normal form).** A term $t$ is in **normal form** if there is no $t'$ such that $t \to t'$.

In other words, $t$ is in normal form if no evaluation rule applies to it. Evaluation has "finished," whether or not the result makes sense.

**Proposition 2.13.** Every value is in normal form.

*Proof.* We verify that no evaluation rule has a value as its left-hand side (its "redex").

- $\text{true}$ and $\text{false}$: no evaluation rule applies to bare boolean constants.
- $0$: no evaluation rule applies to $0$.
- $\text{succ } nv$: the only rule with $\text{succ}$ on the left is E-Succ, which requires $t_1 \to t_1'$. But $nv$ is a numeric value, and by an inner induction on the definition of numeric values, no evaluation rule applies to $nv$. Hence E-Succ does not apply. $\square$

The converse, however, is *false*. Not every normal form is a value.

**Definition 2.14 (Stuck term).** A term $t$ is **stuck** if $t$ is in normal form but $t$ is not a value.

**Example 2.15.** The following terms are stuck:

- $\text{succ } \text{true}$: This is in normal form (E-Succ requires the argument to take a step, but $\text{true}$ cannot step). But it is not a value: it is not a boolean value, and it is not a numeric value because $\text{true}$ is not a numeric value.
- $\text{if } 0 \text{ then } \text{true } \text{ else } \text{false}$: E-IfTrue and E-IfFalse do not apply because the guard is $0$, not $\text{true}$ or $\text{false}$. E-If does not apply because $0$ is in normal form.
- $\text{iszero } \text{false}$: No evaluation rule for iszero matches.

Stuck terms represent "runtime errors" -- meaningless computations. In the untyped setting, there is no mechanism to prevent them. This is precisely the problem that type systems will solve: a well-typed term in a sound type system will never get stuck.

### 2.14 Multi-Step Evaluation

**Definition 2.16 (Multi-step evaluation).** The **multi-step evaluation relation** $\to^*$ is the reflexive-transitive closure of $\to$. That is, $t \to^* t'$ if and only if there exist terms $t_0, t_1, \ldots, t_n$ (for some $n \ge 0$) such that:

$$
t = t_0 \to t_1 \to t_2 \to \cdots \to t_n = t'
$$

When $n = 0$, we have $t \to^* t$ (reflexivity). When $n = 1$, we have $t \to^* t'$ whenever $t \to t'$.

Equivalently, $\to^*$ is the smallest relation satisfying:

$$
\frac{}{t \to^* t} \quad \text{(Multi-Refl)}
$$

$$
\frac{t \to t' \quad t' \to^* t''}{t \to^* t''} \quad \text{(Multi-Step)}
$$

### 2.15 Determinacy of Evaluation

The most important metatheoretic property of our evaluation relation is **determinacy**: each term can take at most one step.

**Theorem 2.17 (Determinacy of one-step evaluation).** If $t \to t'$ and $t \to t''$, then $t' = t''$.

*Proof.* By structural induction on the derivation of $t \to t'$.

We proceed by case analysis on the last rule used in the derivation of $t \to t'$, and in each case, we examine which rules could derive $t \to t''$.

**Case E-IfTrue:** $t = \text{if } \text{true} \text{ then } t_2 \text{ else } t_3$ and $t' = t_2$.

The rules that could derive $t \to t''$ are:
- E-IfTrue: then $t'' = t_2 = t'$. Done.
- E-IfFalse: impossible, since the guard is $\text{true}$, not $\text{false}$.
- E-If: requires $\text{true} \to t_1'$ for some $t_1'$, but $\text{true}$ is a value and hence in normal form. Impossible.

**Case E-IfFalse:** Symmetric to E-IfTrue.

**Case E-If:** $t = \text{if } t_1 \text{ then } t_2 \text{ else } t_3$, where $t_1 \to t_1'$ and $t' = \text{if } t_1' \text{ then } t_2 \text{ else } t_3$.

The rules that could derive $t \to t''$ are:
- E-IfTrue: requires $t_1 = \text{true}$, but $\text{true}$ is in normal form and we assumed $t_1 \to t_1'$. Contradiction.
- E-IfFalse: requires $t_1 = \text{false}$, similarly impossible.
- E-If: $t_1 \to t_1''$ and $t'' = \text{if } t_1'' \text{ then } t_2 \text{ else } t_3$. By the induction hypothesis applied to the derivation of $t_1 \to t_1'$, we get $t_1' = t_1''$, and hence $t' = t''$.

**Case E-Succ:** $t = \text{succ } t_1$, where $t_1 \to t_1'$ and $t' = \text{succ } t_1'$.

The only rule with $\text{succ}$ on the left is E-Succ, so $t \to t''$ must also be derived by E-Succ: $t_1 \to t_1''$ and $t'' = \text{succ } t_1''$. By induction, $t_1' = t_1''$, so $t' = t''$.

**Case E-PredZero:** $t = \text{pred } 0$ and $t' = 0$.

- E-PredZero: $t'' = 0 = t'$. Done.
- E-PredSucc: requires the argument to be $\text{succ } nv_1$, but it is $0$. Impossible.
- E-Pred: requires $0 \to t_1'$, but $0$ is in normal form. Impossible.

**Case E-PredSucc:** $t = \text{pred } (\text{succ } nv_1)$ and $t' = nv_1$.

- E-PredZero: requires the argument to be $0$, but it is $\text{succ } nv_1$. Impossible.
- E-PredSucc: $t'' = nv_1 = t'$. Done.
- E-Pred: requires $\text{succ } nv_1 \to t_1'$. By E-Succ, this would require $nv_1 \to t_1''$ for some $t_1''$. But $nv_1$ is a numeric value and hence in normal form. Impossible.

**Case E-Pred:** $t = \text{pred } t_1$, where $t_1 \to t_1'$ and $t' = \text{pred } t_1'$.

- E-PredZero: requires $t_1 = 0$, but $0$ is in normal form. Contradiction.
- E-PredSucc: requires $t_1 = \text{succ } nv_1$, where $nv_1$ is a numeric value. Then $\text{succ } nv_1$ is also a numeric value, hence in normal form. But we assumed $t_1 \to t_1'$. Contradiction.
- E-Pred: $t_1 \to t_1''$ and $t'' = \text{pred } t_1''$. By induction, $t_1' = t_1''$, so $t' = t''$.

The cases for E-IszeroZero, E-IszeroSucc, and E-Iszero are analogous to the pred cases. $\square$

**Corollary 2.18 (Uniqueness of normal forms).** If $t \to^* u$ and $t \to^* u'$, where $u$ and $u'$ are both in normal form, then $u = u'$.

*Proof.* By induction on the combined length of the two evaluation sequences, using determinacy at each step. If $t$ is already in normal form, then both sequences have length zero and $u = t = u'$. Otherwise, $t \to t_1$ for a unique $t_1$ (by determinacy), and both $u$ and $u'$ are reachable from $t_1$. Apply the induction hypothesis. $\square$

### 2.16 Termination

**Theorem 2.19 (Termination).** For every term $t$, there exists a term $t'$ in normal form such that $t \to^* t'$.

*Proof.* By structural induction on $t$, showing that evaluation always terminates. More precisely, define the size $|t|$ as in Definition 2.4. We claim that if $t \to t'$, then $|t'| < |t|$... but this is actually *not* true in general! Consider E-IfTrue: $|\text{if } \text{true} \text{ then } t_2 \text{ else } t_3| = 1 + 1 + |t_2| + |t_3|$ but $|t'| = |t_2|$, so indeed $|t'| < |t|$.

However, E-Succ is problematic: $|\text{succ } t_1| = |t_1| + 1$ and $|\text{succ } t_1'| = |t_1'| + 1$. The size decreases only within the subterm.

A cleaner argument: define a well-founded measure and show it decreases. Let $\mu(t)$ be the number of $\text{if}$, $\text{pred}$, and $\text{iszero}$ constructors in $t$ that are *not* under a value position. One can verify that $\mu(t) > \mu(t')$ whenever $t \to t'$. Since $\mu$ takes values in $\mathbb{N}$, evaluation must terminate.

Alternatively, observe that no evaluation rule increases the size of any subterm, and each application of a computation rule (as opposed to a congruence rule) strictly decreases the size of the term. Since congruence rules must eventually bottom out at a computation rule (or get stuck), evaluation terminates. $\square$

### 2.17 Big-Step Semantics for Arithmetic Expressions

As a preview of the material in Lecture 01c, we give the big-step evaluation relation for our arithmetic language. The big-step judgment $t \Downarrow v$ relates a term directly to its final value, without exposing intermediate steps.

**Definition 2.20 (Big-step evaluation).**

$$
\frac{}{v \Downarrow v} \quad \text{(B-Value)} \qquad \text{where } v \text{ is a value}
$$

$$
\frac{t_1 \Downarrow \text{true} \quad t_2 \Downarrow v_2}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \Downarrow v_2} \quad \text{(B-IfTrue)}
$$

$$
\frac{t_1 \Downarrow \text{false} \quad t_3 \Downarrow v_3}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \Downarrow v_3} \quad \text{(B-IfFalse)}
$$

$$
\frac{t_1 \Downarrow nv_1}{\text{succ } t_1 \Downarrow \text{succ } nv_1} \quad \text{(B-Succ)}
$$

$$
\frac{t_1 \Downarrow 0}{\text{pred } t_1 \Downarrow 0} \quad \text{(B-PredZero)}
$$

$$
\frac{t_1 \Downarrow \text{succ } nv_1}{\text{pred } t_1 \Downarrow nv_1} \quad \text{(B-PredSucc)}
$$

$$
\frac{t_1 \Downarrow 0}{\text{iszero } t_1 \Downarrow \text{true}} \quad \text{(B-IszeroZero)}
$$

$$
\frac{t_1 \Downarrow \text{succ } nv_1}{\text{iszero } t_1 \Downarrow \text{false}} \quad \text{(B-IszeroSucc)}
$$

**Example 2.21.** Derive the big-step judgment for the term from Example 2.11:

$$
\text{if } (\text{iszero } (\text{pred } (\text{succ } 0))) \text{ then } 0 \text{ else } (\text{succ } 0) \Downarrow 0
$$

The derivation tree is:

$$
\frac{
  \frac{
    \frac{
      \frac{}{0 \Downarrow 0} \text{ B-Value}
    }{\text{succ } 0 \Downarrow \text{succ } 0} \text{ B-Succ}
  }{\text{pred } (\text{succ } 0) \Downarrow 0} \text{ B-PredSucc}
}{\text{iszero } (\text{pred } (\text{succ } 0)) \Downarrow \text{true}} \text{ B-IszeroZero}
\qquad
\frac{}{0 \Downarrow 0} \text{ B-Value}
$$

Combined:

$$
\frac{
  \text{iszero } (\text{pred } (\text{succ } 0)) \Downarrow \text{true} \quad 0 \Downarrow 0
}{\text{if } (\text{iszero } (\text{pred } (\text{succ } 0))) \text{ then } 0 \text{ else } (\text{succ } 0) \Downarrow 0} \text{ B-IfTrue}
$$

Observe that the big-step derivation reaches the same result ($0$) as the small-step derivation from Example 2.11, but in a single tree rather than a sequence of steps.

**Proposition 2.22 (Equivalence of small-step and big-step).** For values $v$:

$$
t \to^* v \text{ (with } v \text{ a value)} \quad \iff \quad t \Downarrow v
$$

The proof proceeds by induction on the derivation in each direction. This equivalence will be established in full generality in Lecture 01c.

### 2.18 Induction on Derivations

An important variant of structural induction is **induction on the derivation** of a judgment. Instead of performing induction on the structure of a term, we induct on the structure of the derivation tree.

**Theorem 2.23 (Induction on evaluation derivations).** Let $P(t, t')$ be a property of pairs of terms. To show that $P(t, t')$ holds whenever $t \to t'$, it suffices to show that $P$ holds in each case of the evaluation rules, assuming $P$ holds for all sub-derivations.

This principle is stronger than structural induction on terms in certain situations. For instance, the derivation tree for $\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \to t'$ may have a sub-derivation for $t_1 \to t_1'$ (via E-If), which is a derivation about a *subterm* of the original. In contrast, structural induction on $t$ directly would require reasoning about all subterms $t_1$, $t_2$, $t_3$.

**Example 2.24 (Using induction on derivations).** We can reprove determinacy (Theorem 2.17) by induction on the derivation of $t \to t'$. The proof structure is the same, but the induction hypothesis is phrased differently:

- Structural induction on $t$: "For all $t'$ and $t''$, if $t \to t'$ and $t \to t''$, then $t' = t''$."
- Induction on derivation of $t \to t'$: "For all derivations $\mathcal{D}$ of $t \to t'$ and all $t''$ with $t \to t''$, we have $t' = t''$."

The second formulation is more natural when the proof logic follows the shape of the derivation rather than the shape of the term.

### 2.19 The "Evaluation Contexts" Perspective

An alternative way to specify where evaluation can occur is through **evaluation contexts**. This technique, due to Felleisen and Hieb (1992), factors the semantics into a notion of **reduction** (the computation rules) and a notion of **evaluation context** (where computation can happen).

**Definition 2.25 (Evaluation contexts for arithmetic expressions).**

$$
E ::= [\cdot] \mid \text{succ } E \mid \text{pred } E \mid \text{iszero } E \mid \text{if } E \text{ then } t_2 \text{ else } t_3
$$

Here $[\cdot]$ is the **hole** -- a placeholder indicating where the next computation step will occur. An evaluation context $E$ is a term with a single hole.

The **plug** operation $E[t]$ replaces the hole with $t$:

$$
[\cdot][t] = t
$$

$$
(\text{succ } E)[t] = \text{succ } (E[t])
$$

$$
(\text{if } E \text{ then } t_2 \text{ else } t_3)[t] = \text{if } E[t] \text{ then } t_2 \text{ else } t_3
$$

and so on.

The evaluation relation is then defined by two kinds of rules:

**Notion of reduction** (computation rules only, no context):

$$
\text{if } \text{true} \text{ then } t_2 \text{ else } t_3 \hookrightarrow t_2
$$

$$
\text{if } \text{false} \text{ then } t_2 \text{ else } t_3 \hookrightarrow t_3
$$

$$
\text{pred } 0 \hookrightarrow 0
$$

$$
\text{pred } (\text{succ } nv) \hookrightarrow nv
$$

$$
\text{iszero } 0 \hookrightarrow \text{true}
$$

$$
\text{iszero } (\text{succ } nv) \hookrightarrow \text{false}
$$

**Lifting to evaluation contexts:**

$$
\frac{t \hookrightarrow t'}{E[t] \to E[t']}
$$

This single rule replaces all the congruence rules. It says: find the unique evaluation context $E$ and redex $t$ such that the whole term is $E[t]$, then reduce $t$ to $t'$ and plug the result back in.

**Proposition 2.26.** The evaluation-context semantics defines the same relation $\to$ as the inference-rule semantics of Sections 2.10 and 2.11.

The evaluation-context style is particularly useful for more complex languages with binding and state, where writing out all congruence rules individually becomes tedious. We will revisit this technique in later modules.

### 2.20 The Role of Metatheory

The proofs in this lecture (determinacy, termination, uniqueness of normal forms) are examples of **metatheorems** -- theorems *about* the formal system rather than theorems *within* it. The language of arithmetic expressions is the **object language**; the mathematical language we use to state and prove properties about it is the **metalanguage**.

This distinction is fundamental in logic and programming language theory:

- The **object language** is the language being studied (our arithmetic expressions, and later, the lambda calculus).
- The **metalanguage** is the language used to reason about the object language (informal mathematics, or a formal proof assistant like Coq or Agda).
- **Metatheorems** are theorems about the object language proved in the metalanguage.

Throughout this course, we will prove metatheorems of increasing sophistication: type safety (progress + preservation), normalization, decidability of type checking, and others. The tools remain the same: induction (structural, on derivations, on types) and case analysis.

---

## 3. Extensions and Variations

### 3.1 What If We Change the Evaluation Strategy?

Our rules enforce a specific strategy: evaluate the guard of a conditional before choosing a branch, and evaluate under $\text{succ}$ before applying $\text{pred}$ or $\text{iszero}$. Alternative strategies are possible.

**Full beta-reduction (evaluate everywhere).** Add rules that evaluate inside all subterm positions, including the branches of conditionals:

$$
\frac{t_2 \to t_2'}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \to \text{if } t_1 \text{ then } t_2' \text{ else } t_3}
$$

$$
\frac{t_3 \to t_3'}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \to \text{if } t_1 \text{ then } t_2 \text{ else } t_3'}
$$

This makes the evaluation relation **non-deterministic**: from a term like $\text{if } (\text{iszero } 0) \text{ then } (\text{pred } (\text{succ } 0)) \text{ else } 0$, we can either step the guard or step inside the then-branch. Determinacy (Theorem 2.17) would fail.

However, the final normal form (if one exists) is still unique, by a confluence argument. We will study this carefully in Lecture 01c.

**Lazy evaluation (do not evaluate under succ).** Remove the congruence rule E-Succ entirely. Then $\text{succ } (\text{pred } 0)$ is in normal form -- we regard it as a value, even though its subterm could be further reduced. This is the approach taken by lazy languages like Haskell.

### 3.2 Extending the Language

Our language can be extended in many directions while preserving the same methodology:

- **Addition:** Add a term $\text{plus } t_1 \; t_2$ with appropriate evaluation rules. This requires deciding on an evaluation order (left-to-right? right-to-left?) and defining the computation rules by recursion on numeric values.

- **Let bindings:** Add $\text{let } x = t_1 \text{ in } t_2$, which introduces variables and substitution. This is the bridge to the lambda calculus (Lecture 01b).

- **Error terms:** Add an explicit $\text{error}$ term that propagates through all contexts. This gives us a way to handle stuck terms: instead of getting stuck, evaluation produces $\text{error}$.

### 3.3 Adding Error Propagation

A practical approach to handling stuck terms is to add an explicit **error** term to the language:

$$
t ::= \ldots \mid \text{error}
$$

with propagation rules:

$$
\frac{}{\text{if } \text{error} \text{ then } t_2 \text{ else } t_3 \to \text{error}} \quad \text{(E-IfError)}
$$

$$
\frac{}{\text{succ } \text{error} \to \text{error}} \quad \text{(E-SuccError)}
$$

$$
\frac{}{\text{pred } \text{error} \to \text{error}} \quad \text{(E-PredError)}
$$

$$
\frac{}{\text{iszero } \text{error} \to \text{error}} \quad \text{(E-IszeroError)}
$$

And we add rules that *detect* type errors and produce $\text{error}$:

$$
\frac{nv_1 \text{ is a numeric value}}{\text{if } nv_1 \text{ then } t_2 \text{ else } t_3 \to \text{error}} \quad \text{(E-IfTypeError)}
$$

$$
\frac{bv \text{ is a boolean value}}{\text{succ } bv \to \text{error}} \quad \text{(E-SuccTypeError)}
$$

and similarly for pred and iszero.

With these rules, evaluation never gets stuck -- every term either evaluates to a value or evaluates to $\text{error}$. This is the dynamic-typing approach: type errors are detected and reported at runtime. The static-typing approach (type systems) rejects programs *before* execution, which is the topic of the rest of this course.

**Proposition 3.1.** With the error propagation rules, for every closed term $t$ (in the extended language), either $t \to^* v$ for some value $v$, or $t \to^* \text{error}$.

This provides a clean trichotomy for the original language without error terms: a term either evaluates to a value, gets stuck, or diverges (though our arithmetic language always terminates). Types eliminate the "stuck" case entirely.

### 3.4 The Role of Types (Preview)

Stuck terms like $\text{succ } \text{true}$ and $\text{iszero } \text{false}$ arise because we are freely mixing booleans and natural numbers. A type system assigns a type ($\text{Bool}$ or $\text{Nat}$) to each term and rejects terms where the types do not match.

The fundamental theorem of type safety, which we will prove in Module 02, states:

**Well-typed terms do not get stuck.**

More precisely, if $\Gamma \vdash t : T$ and $t \to^* t'$, then either $t'$ is a value or there exists $t''$ such that $t' \to t''$. This is proved in two parts:

- **Progress:** If $\vdash t : T$ (in the empty context), then either $t$ is a value or $t \to t'$ for some $t'$.
- **Preservation:** If $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$.

These theorems are the crown jewels of type theory. Every type system in this course will be judged by whether it satisfies them.

---

## 4. Worked Examples

### 4.1 Example: Complete Evaluation

Evaluate $\text{if } (\text{iszero } (\text{succ } (\text{pred } 0))) \text{ then } (\text{pred } (\text{succ } 0)) \text{ else } 0$.

Step 1: The guard is $\text{iszero } (\text{succ } (\text{pred } 0))$. We must evaluate its argument $\text{succ } (\text{pred } 0)$. By E-Succ, we need $\text{pred } 0 \to 0$ (by E-PredZero). So:

$$
\text{succ } (\text{pred } 0) \to \text{succ } 0 \quad \text{(E-Succ + E-PredZero)}
$$

By E-Iszero:

$$
\text{iszero } (\text{succ } (\text{pred } 0)) \to \text{iszero } (\text{succ } 0)
$$

By E-If, the whole term steps to:

$$
\text{if } (\text{iszero } (\text{succ } 0)) \text{ then } (\text{pred } (\text{succ } 0)) \text{ else } 0
$$

Step 2: Now $\text{succ } 0$ is a numeric value, so E-IszeroSucc applies:

$$
\text{iszero } (\text{succ } 0) \to \text{false}
$$

By E-If:

$$
\text{if } (\text{iszero } (\text{succ } 0)) \text{ then } (\text{pred } (\text{succ } 0)) \text{ else } 0 \to \text{if } \text{false} \text{ then } (\text{pred } (\text{succ } 0)) \text{ else } 0
$$

Step 3: By E-IfFalse:

$$
\text{if } \text{false} \text{ then } (\text{pred } (\text{succ } 0)) \text{ else } 0 \to 0
$$

The result is $0$, a numeric value.

### 4.2 Example: Getting Stuck

Evaluate $\text{succ } (\text{if } \text{true} \text{ then } \text{false} \text{ else } 0)$.

Step 1: By E-Succ, we evaluate the argument. By E-IfTrue:

$$
\text{if } \text{true} \text{ then } \text{false} \text{ else } 0 \to \text{false}
$$

So the term steps to $\text{succ } \text{false}$.

Step 2: $\text{succ } \text{false}$ is in normal form (E-Succ requires $\text{false} \to t'$, but $\text{false}$ is a value). But $\text{succ } \text{false}$ is not a value (it is not a numeric value, since $\text{false}$ is not a numeric value). Hence $\text{succ } \text{false}$ is stuck.

This is exactly the kind of "type error" that a type system would catch at compile time.

### 4.3 Example: Structural Induction Proof

**Proposition.** For every numeric value $nv$, $|nv| = \text{depth}(nv)$.

*Proof.* By induction on the structure of $nv$.

**Base case:** $nv = 0$. Then $|0| = 1 = \text{depth}(0)$.

**Inductive step:** $nv = \text{succ } nv'$ where $nv'$ is a numeric value and, by the induction hypothesis, $|nv'| = \text{depth}(nv')$. Then:

$$
|\text{succ } nv'| = |nv'| + 1 = \text{depth}(nv') + 1 = \text{depth}(\text{succ } nv')
$$

where the last equality uses the definition of depth for $\text{succ}$. $\square$

### 4.4 Example: Induction on Derivations

**Proposition.** If $t \to t'$, then $|t'| \le |t|$.

*Proof.* By induction on the derivation of $t \to t'$.

**Case E-IfTrue:** $t = \text{if } \text{true} \text{ then } t_2 \text{ else } t_3$ and $t' = t_2$.

$$
|t'| = |t_2| < 1 + 1 + |t_2| + |t_3| = |t|
$$

since $1 + |t_3| > 0$.

**Case E-IfFalse:** Symmetric.

**Case E-If:** $t = \text{if } t_1 \text{ then } t_2 \text{ else } t_3$, $t_1 \to t_1'$, $t' = \text{if } t_1' \text{ then } t_2 \text{ else } t_3$.

By the induction hypothesis, $|t_1'| \le |t_1|$. Then:

$$
|t'| = |t_1'| + |t_2| + |t_3| + 1 \le |t_1| + |t_2| + |t_3| + 1 = |t|
$$

**Case E-PredZero:** $t = \text{pred } 0$, $t' = 0$. $|t'| = 1 < 2 = |t|$.

**Case E-PredSucc:** $t = \text{pred } (\text{succ } nv_1)$, $t' = nv_1$. $|t'| = |nv_1| < |nv_1| + 1 + 1 = |t|$.

**Case E-Pred:** $t = \text{pred } t_1$, $t_1 \to t_1'$, $t' = \text{pred } t_1'$. By IH, $|t_1'| \le |t_1|$, so $|t'| = |t_1'| + 1 \le |t_1| + 1 = |t|$.

**Case E-Succ:** $t = \text{succ } t_1$, $t_1 \to t_1'$, $t' = \text{succ } t_1'$. By IH, $|t_1'| \le |t_1|$, so $|t'| = |t_1'| + 1 \le |t_1| + 1 = |t|$.

**Case E-IszeroZero:** $|t'| = |\text{true}| = 1 < 2 = |\text{iszero } 0| = |t|$.

**Case E-IszeroSucc:** $|t'| = |\text{false}| = 1 < |nv_1| + 2 = |t|$.

**Case E-Iszero:** By IH, as in the E-Pred case. $\square$

### 4.5 Example: Counting Evaluation Steps

**Proposition.** For every numeric value $\text{succ}^n\, 0$ (i.e., $n$ applications of $\text{succ}$ to $0$):

$$
\text{pred } (\text{succ } (\text{succ}^n\, 0)) \to^* \text{succ}^n\, 0
$$

in exactly $n + 1$ steps (one step to evaluate $\text{succ}^n\, 0$ to a numeric value via the E-Succ congruence rules, plus one E-PredSucc step).

Actually, since $\text{succ}^n\, 0$ is already a numeric value, E-PredSucc applies immediately:

$$
\text{pred } (\text{succ } (\text{succ}^n\, 0)) \to \text{succ}^n\, 0
$$

in exactly one step. The congruence rule E-Pred would only apply if the argument of $\text{pred}$ is not yet fully evaluated. This illustrates the importance of the value restriction in E-PredSucc: the argument to $\text{succ}$ must be a numeric value, not an arbitrary term.

Consider instead $\text{pred } (\text{succ } (\text{pred } (\text{succ } 0)))$. Here the argument to $\text{succ}$ is $\text{pred } (\text{succ } 0)$, which is not a numeric value. So we must first evaluate inside:

Step 1: $\text{pred } (\text{succ } 0) \to 0$ by E-PredSucc, propagated via E-Succ and then E-Pred:

$$
\text{pred } (\text{succ } (\text{pred } (\text{succ } 0))) \to \text{pred } (\text{succ } 0)
$$

Step 2: $\text{pred } (\text{succ } 0) \to 0$ by E-PredSucc.

Final result: $0$.

---

## 5. Exercises

**Exercise 5.1.** Prove by structural induction that for every term $t$, $\text{depth}(t) \le |t|$.

**Exercise 5.2.** Give an example of a term $t$ such that $t \to t'$ and $|t'| = |t|$ (the size does not strictly decrease in one step). *(Hint: consider the congruence rules.)*

**Exercise 5.3.** Define a well-founded measure $\mu(t) \in \mathbb{N}$ such that $t \to t'$ implies $\mu(t') < \mu(t)$, thereby giving an alternative proof of termination (Theorem 2.19). *(Hint: count the number of $\text{pred}$, $\text{iszero}$, and $\text{if}$ nodes, weighted appropriately.)*

**Exercise 5.4.** Add a $\text{double}$ operator to the language, with the intended semantics $\text{double } nv = nv + nv$ (in unary). Define appropriate evaluation rules and verify that your rules preserve determinacy.

**Exercise 5.5.** Consider adding a $\text{wrong}$ term (as in Harper's PFPL) that represents a type error. Define evaluation rules so that every term evaluates either to a value or to $\text{wrong}$, and prove this property by induction.

**Exercise 5.6.** Write out the complete derivation tree for:

$$
\text{if } (\text{iszero } (\text{pred } (\text{succ } (\text{succ } 0)))) \text{ then } (\text{succ } 0) \text{ else } (\text{pred } (\text{succ } 0))
$$

How many derivation steps are needed? What is the final value?

---

## 6. Formal Summary of the Language

For reference, we collect the complete definition of the language in one place.

### 5.1 Syntax

$$
t ::= \text{true} \mid \text{false} \mid \text{if } t \text{ then } t \text{ else } t \mid 0 \mid \text{succ } t \mid \text{pred } t \mid \text{iszero } t
$$

$$
v ::= \text{true} \mid \text{false} \mid nv
$$

$$
nv ::= 0 \mid \text{succ } nv
$$

### 5.2 Evaluation Rules ($t \to t'$)

**Booleans:**

$$
\text{if } \text{true} \text{ then } t_2 \text{ else } t_3 \to t_2 \quad \text{(E-IfTrue)}
$$

$$
\text{if } \text{false} \text{ then } t_2 \text{ else } t_3 \to t_3 \quad \text{(E-IfFalse)}
$$

$$
\frac{t_1 \to t_1'}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \to \text{if } t_1' \text{ then } t_2 \text{ else } t_3} \quad \text{(E-If)}
$$

**Natural numbers:**

$$
\frac{t_1 \to t_1'}{\text{succ } t_1 \to \text{succ } t_1'} \quad \text{(E-Succ)}
$$

$$
\text{pred } 0 \to 0 \quad \text{(E-PredZero)}
$$

$$
\text{pred } (\text{succ } nv_1) \to nv_1 \quad \text{(E-PredSucc)}
$$

$$
\frac{t_1 \to t_1'}{\text{pred } t_1 \to \text{pred } t_1'} \quad \text{(E-Pred)}
$$

$$
\text{iszero } 0 \to \text{true} \quad \text{(E-IszeroZero)}
$$

$$
\text{iszero } (\text{succ } nv_1) \to \text{false} \quad \text{(E-IszeroSucc)}
$$

$$
\frac{t_1 \to t_1'}{\text{iszero } t_1 \to \text{iszero } t_1'} \quad \text{(E-Iszero)}
$$

### 5.3 Metatheoretic Properties

| Property | Statement |
|----------|-----------|
| Determinacy | If $t \to t'$ and $t \to t''$, then $t' = t''$ |
| Values are normal forms | If $v$ is a value, then there is no $t$ with $v \to t$ |
| Normal forms need not be values | There exist stuck terms: normal forms that are not values |
| Uniqueness of normal forms | If $t \to^* u$ and $t \to^* u'$ with $u, u'$ normal, then $u = u'$ |
| Termination | For every $t$, there exists a normal form $t'$ with $t \to^* t'$ |

---

## Summary

This lecture established the foundational methodology we will use throughout the course:

1. **Syntax** is defined inductively, giving rise to the principle of structural induction for proving properties of terms.
2. **Semantics** is given by an evaluation relation $t \to t'$, defined by inference rules that decompose into computation rules and congruence rules.
3. **Values** are the intended results of evaluation; **normal forms** are terms where no rule applies; **stuck terms** are normal forms that are not values.
4. **Determinacy** guarantees that evaluation is a function (not a relation): each term can step in at most one way.
5. The existence of stuck terms motivates the study of type systems: the central goal of type theory is to statically ensure that well-typed programs never get stuck.

The language of this lecture is deliberately minimal. In the next lecture, we introduce the lambda calculus -- a language of extraordinary simplicity (just three syntactic forms) that is nonetheless Turing-complete.

---

## Further Reading

- **Pierce, B. C.** *Types and Programming Languages* (2002), Chapter 3. The primary reference for this lecture.
- **Pierce, B. C.** *Types and Programming Languages* (2002), Chapter 4. Extends the arithmetic expression language with an ML-style implementation.
- **Winskel, G.** *The Formal Semantics of Programming Languages* (1993), Chapters 2-3. A thorough treatment of operational semantics.
- **Plotkin, G. D.** "A Structural Approach to Operational Semantics" (1981, reprinted 2004). The foundational paper on structural operational semantics (SOS).
- **Kahn, G.** "Natural Semantics" (1987). Introduces big-step (natural) semantics.
- **Harper, R.** *Practical Foundations for Programming Languages* (2016), Chapter 2. An alternative development of the same material using a different notational style (abstract binding trees).
