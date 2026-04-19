---
title: "Lecture 05a: Type Inference for the Simply Typed Lambda Calculus"
tags:
  - type-theory
  - type-inference
  - lecture
---
# Lecture 05a: Type Inference for the Simply Typed Lambda Calculus

> **Module 05 --- Type Inference & Reconstruction (Weeks 9--10)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Formalize the type reconstruction problem: given an unannotated term $t$, find a substitution $\sigma$ and type $T$ such that $\sigma(\Gamma) \vdash t : T$.
2. Define type variables, type substitutions, and their algebra (composition, domain, support).
3. Derive constraint generation rules systematically from the typing rules of the STLC.
4. State and prove the existence of principal types for simply typed terms.
5. Distinguish between type checking, type inference, and type reconstruction, and identify the computational complexity of each.
6. Explain why the STLC admits decidable type inference while richer systems may not.
7. Formalize the notion of a principal type and prove that every typable STLC term possesses one.
8. Construct explicit examples of constraint generation and trace the inference process end to end.

---

## 1. Motivation

In the simply typed lambda calculus as developed in Module 02, every lambda abstraction carries an explicit type annotation:

$$\lambda x : T.\; t$$

This is the **Church-style** (or **explicitly typed**) presentation. The programmer must supply the type $T$ of each bound variable. For a term like

$$\lambda f : A \to B.\; \lambda g : B \to C.\; \lambda x : A.\; g\;(f\;x)$$

this is tolerable, but in real programs with dozens or hundreds of bindings, the annotation burden becomes oppressive. Worse, annotations obscure the logical structure of the program.

The **Curry-style** (or **implicitly typed**) presentation drops annotations:

$$\lambda f.\; \lambda g.\; \lambda x.\; g\;(f\;x)$$

The question that drives this entire module is: **can the machine reconstruct the types that the programmer omitted?**

This question has a beautiful affirmative answer for the STLC and its extension to ML-style polymorphism (Hindley--Milner), and the theory behind it---unification, principal types, constraint solving---is one of the great intellectual achievements of programming language theory.

### 1.1 Historical Context

The study of type assignment to untyped terms has a rich history that intertwines logic, combinatory algebra, and programming language design.

Curry and Feys (1958) initiated the study of principal type schemes for combinators, establishing that every typable combinatory term has a most general type. Hindley (1969) extended this result to the lambda calculus, proving the **principal type theorem**: if a term is typable, it has a principal (most general) type from which all other valid types can be obtained by substitution. This result was rediscovered independently by Milner (1978) in the context of the ML programming language, where the type inference algorithm became known as **Algorithm W**.

The key algorithmic ingredient---the unification algorithm---was introduced by Robinson (1965) in the context of resolution-based theorem proving. Robinson showed that first-order unification is decidable and that most general unifiers exist and are unique up to variable renaming.

The constraint-based reformulation of type inference was developed by Wand (1987), who showed that type inference can be cleanly decomposed into constraint generation (a syntax-directed traversal) and constraint solving (unification). This perspective was later refined by Pottier and Remy (2005) into a comprehensive framework for ML-style type inference.

### 1.2 Type Checking vs. Type Inference vs. Type Reconstruction

These three problems are often conflated but are computationally distinct. Understanding their differences is essential for appreciating the theoretical contributions of this module.

**Type checking.** Given a context $\Gamma$, a term $t$, and a type $T$, decide whether $\Gamma \vdash t : T$. This is the simplest problem: we merely verify that a claimed typing is valid. For the STLC, type checking is decidable and runs in time linear in the size of the derivation.

**Type inference.** Given a context $\Gamma$ and a term $t$ (with type annotations on binders), compute a type $T$ such that $\Gamma \vdash t : T$, or report that no such $T$ exists. This is more difficult than type checking because we must construct $T$ rather than merely verify it. For the Church-style STLC, type inference is decidable and runs in linear time: we propagate type information through the term structure, computing the type of each subterm bottom-up.

**Type reconstruction.** Given a raw term $t$ (without annotations), find a context $\Gamma$, a substitution $\sigma$, and a type $T$ such that $\sigma(\Gamma) \vdash t : T$, or report that no such triple exists. This is the hardest of the three problems. The central result of this module is that type reconstruction is decidable for the STLC and for the Hindley--Milner type system, but becomes undecidable for System F (Wells 1999).

**Remark.** In much of the literature, "type inference" is used loosely to mean any of these three problems. We will use the term "type reconstruction" when precision matters, but follow common usage otherwise.

### 1.3 A Preview of the Algorithm

Before diving into the formal development, let us sketch the high-level structure of the type reconstruction algorithm for the STLC:

1. **Introduce fresh type variables** for every unknown type: the argument type of each lambda abstraction and the result type of each application.

2. **Generate constraints** by traversing the term. Each application $t_1\; t_2$ generates a constraint saying that the type of $t_1$ must be a function type from the type of $t_2$ to the result type.

3. **Solve the constraints** using the unification algorithm. If the constraints are solvable, the most general unifier gives the most general (principal) type. If they are unsolvable, the term is untypable.

The beauty of this approach is that it cleanly separates the question "what constraints must the types satisfy?" from the question "is there a type assignment satisfying these constraints?" This separation is the foundation of the constraint-based approach developed in Lecture 05d.

---

## 2. Core Theory

### 2.1 Syntax of the Unannotated STLC

We begin by defining the Curry-style STLC. The term language drops type annotations from lambda abstractions.

**Definition 2.1 (Raw Terms).** The set of raw terms is defined by the grammar:

$$t ::= x \mid \lambda x.\; t \mid t_1\; t_2$$

where $x$ ranges over a countably infinite set of term variables $\mathcal{X} = \{x, y, z, f, g, x_1, x_2, \ldots\}$.

We use $\text{FV}(t)$ to denote the set of free term variables in $t$, defined as usual:

$$\text{FV}(x) = \{x\}$$

$$\text{FV}(\lambda x.\; t) = \text{FV}(t) \setminus \{x\}$$

$$\text{FV}(t_1\; t_2) = \text{FV}(t_1) \cup \text{FV}(t_2)$$

A term is **closed** if $\text{FV}(t) = \emptyset$.

**Definition 2.2 (Size of a Term).** The size $|t|$ of a raw term is the number of nodes in its abstract syntax tree:

$$|x| = 1$$

$$|\lambda x.\; t| = 1 + |t|$$

$$|t_1\; t_2| = 1 + |t_1| + |t_2|$$

This measure will be important for complexity analysis.

### 2.2 Type Expressions with Type Variables

**Definition 2.3 (Type Expressions).** The set of type expressions $\mathcal{T}$ is defined by:

$$T ::= \alpha \mid T_1 \to T_2$$

where $\alpha$ ranges over a countably infinite set of type variables $\mathcal{V} = \{\alpha, \beta, \gamma, \alpha_1, \alpha_2, \ldots\}$, disjoint from the set of term variables $\mathcal{X}$.

We may also include base types (constants) $b \in \mathcal{B}$ such as $\text{Int}$, $\text{Bool}$, $\text{Unit}$, etc. These are type expressions with no type variables:

$$T ::= \alpha \mid b \mid T_1 \to T_2$$

For most of the theoretical development, we work with the minimal syntax $T ::= \alpha \mid T_1 \to T_2$. Base types are easily accommodated and do not change the theory.

**Definition 2.4 (Free Type Variables).** The set of free type variables $\text{FTV}(T)$ in a type expression is:

$$\text{FTV}(\alpha) = \{\alpha\}$$

$$\text{FTV}(b) = \emptyset$$

$$\text{FTV}(T_1 \to T_2) = \text{FTV}(T_1) \cup \text{FTV}(T_2)$$

**Definition 2.5 (Size of a Type).** The size $|T|$ of a type expression is:

$$|\alpha| = 1$$

$$|b| = 1$$

$$|T_1 \to T_2| = 1 + |T_1| + |T_2|$$

**Example 2.6.** Some type expressions and their free type variables:

- $\alpha \to \beta$: $\text{FTV} = \{\alpha, \beta\}$, $|T| = 3$.
- $(\alpha \to \alpha) \to \beta$: $\text{FTV} = \{\alpha, \beta\}$, $|T| = 5$.
- $\text{Int} \to \text{Bool}$: $\text{FTV} = \emptyset$, $|T| = 3$.
- $(\alpha \to \beta) \to (\gamma \to \delta) \to \alpha \to \delta$: $\text{FTV} = \{\alpha, \beta, \gamma, \delta\}$, $|T| = 11$.

A type expression with no free type variables is called a **ground type** or **closed type**.

### 2.3 Type Contexts

**Definition 2.7 (Type Context).** A type context $\Gamma$ is a finite partial function from term variables to type expressions:

$$\Gamma = x_1 : T_1, \ldots, x_n : T_n$$

where $x_i$ are distinct term variables and $T_i$ are type expressions. We write $\text{dom}(\Gamma)$ for the set $\{x_1, \ldots, x_n\}$.

We extend $\text{FTV}$ to contexts:

$$\text{FTV}(\Gamma) = \bigcup_{(x:T) \in \Gamma} \text{FTV}(T)$$

**Notation.** We write $\Gamma, x : T$ for the context obtained by extending $\Gamma$ with the binding $x : T$. If $x \in \text{dom}(\Gamma)$, the new binding shadows the old one.

### 2.4 Type Substitutions

Type substitutions are the central algebraic tool of type inference. They formalize the idea of "filling in" unknown types.

**Definition 2.8 (Type Substitution).** A type substitution $\sigma$ is a function from type variables to type expressions that is the identity on all but finitely many variables. We represent $\sigma$ as a finite mapping:

$$\sigma = [\alpha_1 \mapsto T_1, \ldots, \alpha_n \mapsto T_n]$$

meaning $\sigma(\alpha_i) = T_i$ for $i = 1, \ldots, n$ and $\sigma(\beta) = \beta$ for all $\beta \notin \{\alpha_1, \ldots, \alpha_n\}$.

**Definition 2.9 (Domain and Support).** The domain of a substitution $\sigma$ is:

$$\text{dom}(\sigma) = \{\alpha \in \mathcal{V} \mid \sigma(\alpha) \neq \alpha\}$$

The support (or range) of $\sigma$ is:

$$\text{ran}(\sigma) = \bigcup_{\alpha \in \text{dom}(\sigma)} \text{FTV}(\sigma(\alpha))$$

The variables introduced by $\sigma$ are the variables in $\text{ran}(\sigma) \setminus \text{dom}(\sigma)$.

**Definition 2.10 (Application of a Substitution to Types).** The application of $\sigma$ to a type expression is defined inductively:

$$\sigma(\alpha) = \begin{cases} T & \text{if } (\alpha \mapsto T) \in \sigma \\ \alpha & \text{otherwise} \end{cases}

$$

$$\sigma(b) = b$$

$$\sigma(T_1 \to T_2) = \sigma(T_1) \to \sigma(T_2)$$

This is well-defined by structural induction on $T$.

**Definition 2.11 (Application to Contexts).** We extend substitution application to contexts pointwise:

$$\sigma(\Gamma) = \{x : \sigma(T) \mid (x : T) \in \Gamma\}$$

That is, $\sigma(\Gamma)(x) = \sigma(\Gamma(x))$ for all $x \in \text{dom}(\Gamma)$.

**Lemma 2.12 (Substitution Preserves Structure).** For any substitution $\sigma$ and type $T$: if $T = T_1 \to T_2$, then $\sigma(T) = \sigma(T_1) \to \sigma(T_2)$. That is, substitution preserves the top-level constructor of a type.

*Proof.* Immediate from the definition. $\square$

**Example 2.13.** Let $\sigma = [\alpha \mapsto \text{Int} \to \text{Bool}, \beta \mapsto \gamma]$. Then:

$$\sigma(\alpha \to \beta) = (\text{Int} \to \text{Bool}) \to \gamma$$

$$\sigma(\alpha \to \alpha) = (\text{Int} \to \text{Bool}) \to (\text{Int} \to \text{Bool})$$

$$\sigma(\gamma \to \delta) = \gamma \to \delta$$

Note that $\gamma$ and $\delta$ are not in $\text{dom}(\sigma)$ (although $\gamma \in \text{ran}(\sigma)$), so they are unaffected.

### 2.5 Composition of Substitutions

**Definition 2.14 (Composition).** The composition $\sigma_2 \circ \sigma_1$ is defined by:

$$(\sigma_2 \circ \sigma_1)(\alpha) = \sigma_2(\sigma_1(\alpha))$$

for all type variables $\alpha$. Equivalently, $(\sigma_2 \circ \sigma_1)(T) = \sigma_2(\sigma_1(T))$ for all type expressions $T$.

**Lemma 2.15 (Explicit Representation of Composition).** The composition $\sigma_2 \circ \sigma_1$ can be computed explicitly as follows:

1. For each $(\alpha \mapsto T) \in \sigma_1$, include $(\alpha \mapsto \sigma_2(T))$ in the result.
2. For each $(\beta \mapsto S) \in \sigma_2$ where $\beta \notin \text{dom}(\sigma_1)$, include $(\beta \mapsto S)$ in the result.

*Proof.* For $\alpha \in \text{dom}(\sigma_1)$: $(\sigma_2 \circ \sigma_1)(\alpha) = \sigma_2(\sigma_1(\alpha)) = \sigma_2(T)$ where $\sigma_1(\alpha) = T$. This is covered by step 1.

For $\beta \notin \text{dom}(\sigma_1)$ but $\beta \in \text{dom}(\sigma_2)$: $(\sigma_2 \circ \sigma_1)(\beta) = \sigma_2(\beta) = S$ where $\sigma_2(\beta) = S$. This is covered by step 2.

For $\gamma \notin \text{dom}(\sigma_1) \cup \text{dom}(\sigma_2)$: $(\sigma_2 \circ \sigma_1)(\gamma) = \sigma_2(\gamma) = \gamma$, which is the identity, so $\gamma$ is correctly absent from the result. $\square$

**Lemma 2.16 (Associativity).** For all substitutions $\sigma_1, \sigma_2, \sigma_3$:

$$\sigma_3 \circ (\sigma_2 \circ \sigma_1) = (\sigma_3 \circ \sigma_2) \circ \sigma_1$$

*Proof.* For any type variable $\alpha$:

$$(\sigma_3 \circ (\sigma_2 \circ \sigma_1))(\alpha) = \sigma_3((\sigma_2 \circ \sigma_1)(\alpha)) = \sigma_3(\sigma_2(\sigma_1(\alpha)))$$

$$= (\sigma_3 \circ \sigma_2)(\sigma_1(\alpha)) = ((\sigma_3 \circ \sigma_2) \circ \sigma_1)(\alpha)$$

This extends to all type expressions by structural induction:

Base case ($T = \alpha$): shown above.

Base case ($T = b$): both sides equal $b$.

Inductive case ($T = T_1 \to T_2$):

$$(\sigma_3 \circ (\sigma_2 \circ \sigma_1))(T_1 \to T_2) = (\sigma_3 \circ (\sigma_2 \circ \sigma_1))(T_1) \to (\sigma_3 \circ (\sigma_2 \circ \sigma_1))(T_2)$$

By the induction hypothesis, this equals:

$$((\sigma_3 \circ \sigma_2) \circ \sigma_1)(T_1) \to ((\sigma_3 \circ \sigma_2) \circ \sigma_1)(T_2) = ((\sigma_3 \circ \sigma_2) \circ \sigma_1)(T_1 \to T_2)$$

$\square$

**Lemma 2.17 (Identity Substitution).** The empty substitution $\text{id} = []$ is a two-sided identity for composition:

$$\sigma \circ \text{id} = \text{id} \circ \sigma = \sigma$$

*Proof.* For any $\alpha$: $(\sigma \circ \text{id})(\alpha) = \sigma(\text{id}(\alpha)) = \sigma(\alpha)$ and $(\text{id} \circ \sigma)(\alpha) = \text{id}(\sigma(\alpha)) = \sigma(\alpha)$. $\square$

**Theorem 2.18 (Substitution Monoid).** The set of type substitutions forms a monoid $(\text{Subst}, \circ, \text{id})$: composition is associative (Lemma 2.16) and $\text{id}$ is the identity (Lemma 2.17). This monoid is not commutative.

*Proof of non-commutativity.* Let $\sigma_1 = [\alpha \mapsto \beta \to \gamma]$ and $\sigma_2 = [\beta \mapsto \text{Int}]$. Then:

$$(\sigma_2 \circ \sigma_1)(\alpha) = \sigma_2(\beta \to \gamma) = \text{Int} \to \gamma$$

$$(\sigma_1 \circ \sigma_2)(\alpha) = \sigma_1(\alpha) = \beta \to \gamma$$

These differ, so $\sigma_2 \circ \sigma_1 \neq \sigma_1 \circ \sigma_2$. $\square$

**Example 2.19.** A more complex composition. Let:

$$\sigma_1 = [\alpha \mapsto \beta \to \gamma, \delta \mapsto \text{Int}]$$

$$\sigma_2 = [\beta \mapsto \text{Bool}, \gamma \mapsto \varepsilon \to \varepsilon]$$

Then by Lemma 2.15:

Step 1: From $\sigma_1$:
- $\alpha \mapsto \sigma_2(\beta \to \gamma) = \text{Bool} \to (\varepsilon \to \varepsilon)$
- $\delta \mapsto \sigma_2(\text{Int}) = \text{Int}$

Step 2: From $\sigma_2$, excluding $\text{dom}(\sigma_1) = \{\alpha, \delta\}$:
- $\beta \mapsto \text{Bool}$
- $\gamma \mapsto \varepsilon \to \varepsilon$

Result: $\sigma_2 \circ \sigma_1 = [\alpha \mapsto \text{Bool} \to (\varepsilon \to \varepsilon), \delta \mapsto \text{Int}, \beta \mapsto \text{Bool}, \gamma \mapsto \varepsilon \to \varepsilon]$.

### 2.6 The Preorder on Substitutions

**Definition 2.20 (More General Than).** A substitution $\sigma$ is more general than a substitution $\sigma'$ (written $\sigma \leq \sigma'$) if there exists a substitution $\delta$ such that:

$$\sigma' = \delta \circ \sigma$$

Intuitively, $\sigma \leq \sigma'$ means that $\sigma'$ can be obtained from $\sigma$ by further instantiation (applying $\delta$ to the results of $\sigma$). The substitution $\sigma$ commits to less; $\sigma'$ commits to more.

**Lemma 2.21.** The relation $\leq$ is a preorder: it is reflexive and transitive but not antisymmetric.

*Proof.* Reflexivity: $\sigma = \text{id} \circ \sigma$, so $\sigma \leq \sigma$ with $\delta = \text{id}$.

Transitivity: if $\sigma \leq \sigma'$ via $\delta_1$ (i.e., $\sigma' = \delta_1 \circ \sigma$) and $\sigma' \leq \sigma''$ via $\delta_2$ (i.e., $\sigma'' = \delta_2 \circ \sigma'$), then:

$$\sigma'' = \delta_2 \circ \sigma' = \delta_2 \circ (\delta_1 \circ \sigma) = (\delta_2 \circ \delta_1) \circ \sigma$$

So $\sigma \leq \sigma''$ with $\delta = \delta_2 \circ \delta_1$.

Non-antisymmetry: Let $\sigma_1 = [\alpha \mapsto \beta]$ and $\sigma_2 = [\alpha \mapsto \gamma]$. Then $\sigma_1 \leq \sigma_2$ via $\delta_1 = [\beta \mapsto \gamma]$ and $\sigma_2 \leq \sigma_1$ via $\delta_2 = [\gamma \mapsto \beta]$. But $\sigma_1 \neq \sigma_2$ (they differ on $\alpha$). The two substitutions are equivalent up to a renaming of variables. $\square$

**Definition 2.22 (Equivalence of Substitutions).** Two substitutions $\sigma_1$ and $\sigma_2$ are equivalent (written $\sigma_1 \sim \sigma_2$) if $\sigma_1 \leq \sigma_2$ and $\sigma_2 \leq \sigma_1$. Equivalently, they differ only by a renaming of variables not in their shared domain.

### 2.7 The Type Reconstruction Problem

We now state the central problem precisely.

**Definition 2.23 (Type Reconstruction Problem).** Given a raw term $t$ and a context $\Gamma$ (whose types may contain type variables), the type reconstruction problem asks:

Does there exist a substitution $\sigma$ and a type $T$ such that $\sigma(\Gamma) \vdash t : T$?

Here the judgment $\sigma(\Gamma) \vdash t : T$ uses the standard STLC typing rules, applied to the substituted context.

**Definition 2.24 (Solution to the Type Reconstruction Problem).** A pair $(\sigma, T)$ is a solution to the type reconstruction problem for $t$ under $\Gamma$ if $\sigma(\Gamma) \vdash t : T$.

**Remark 2.25.** When $\Gamma = \emptyset$ and $t$ is closed, the problem simplifies to: find $T$ such that $\emptyset \vdash t : T$. The substitution $\sigma$ is irrelevant (there is nothing to substitute in the empty context). The interest of including $\sigma$ and a non-empty $\Gamma$ is that it allows us to handle open terms and to compose the inference of subterms.

**Example 2.26.** Consider the term $t = \lambda f.\; \lambda x.\; f\;x$ under $\Gamma = \emptyset$.

The pair $(\text{id}, (\alpha \to \beta) \to \alpha \to \beta)$ is a solution, since:

$$\emptyset \vdash \lambda f.\; \lambda x.\; f\;x : (\alpha \to \beta) \to \alpha \to \beta$$

The pair $([\alpha \mapsto \text{Int}, \beta \mapsto \text{Int}], (\text{Int} \to \text{Int}) \to \text{Int} \to \text{Int})$ is also a solution, but it is less general: it commits to specific types where the first solution left variables free.

**Example 2.27.** Consider $t = \lambda x.\; x$ under $\Gamma = \{y : \alpha\}$.

The pair $(\text{id}, \beta \to \beta)$ is a solution (the type of $t$ does not depend on $y$, so $\alpha$ is unconstrained). The pair $([\alpha \mapsto \text{Int}], \beta \to \beta)$ is also a solution.

### 2.8 Principal Types

The notion of a principal type captures the idea of the "most general" or "best" type that a term can receive.

**Definition 2.28 (Principal Solution).** A solution $(\sigma_p, T_p)$ to the type reconstruction problem for $t$ under $\Gamma$ is principal if for every other solution $(\sigma', T')$, there exists a substitution $\delta$ such that:

1. $\sigma'(\alpha) = (\delta \circ \sigma_p)(\alpha)$ for all $\alpha \in \text{FTV}(\Gamma)$.
2. $T' = \delta(T_p)$.

In other words, every solution is an instance of the principal solution. The principal solution commits to the minimum necessary: it only identifies type variables that are forced to be equal, and leaves all other relationships unresolved.

**Definition 2.29 (Principal Type).** A type $T_p$ is a principal type for $t$ under $\Gamma$ if there exists a substitution $\sigma_p$ such that $(\sigma_p, T_p)$ is a principal solution.

**Theorem 2.30 (Principal Type Theorem for STLC).** If a raw term $t$ is typable under $\Gamma$, then it has a principal type. Moreover, the principal type is unique up to renaming of type variables.

We defer the full proof to Section 2.12, after developing constraint generation. The proof strategy is:

1. Show that constraint generation is sound and complete (Sections 2.10--2.11).
2. Show that the most general unifier of the generated constraints exists and is unique (Lecture 05b).
3. Compose these results to establish principality.

**Example 2.31.** Principal types of some standard combinators:

| Term | Principal Type |
|------|---------------|
| $\lambda x.\; x$ | $\alpha \to \alpha$ |
| $\lambda x.\; \lambda y.\; x$ | $\alpha \to \beta \to \alpha$ |
| $\lambda x.\; \lambda y.\; y$ | $\alpha \to \beta \to \beta$ |
| $\lambda f.\; \lambda x.\; f\;x$ | $(\alpha \to \beta) \to \alpha \to \beta$ |
| $\lambda f.\; \lambda g.\; \lambda x.\; f\;(g\;x)$ | $(\beta \to \gamma) \to (\alpha \to \beta) \to \alpha \to \gamma$ |
| $\lambda f.\; \lambda x.\; f\;(f\;x)$ | $(\alpha \to \alpha) \to \alpha \to \alpha$ |

**Example 2.32.** The self-application term $\lambda x.\; x\;x$ has no type in the STLC (as shown in Module 02). The type reconstruction problem for this term has no solution.

Informally: if $x : T$, then the application $x\;x$ requires $T = T \to S$ for some $S$, which means $T$ contains itself as a proper subterm---an impossibility for finite type expressions. We will see this formalized as an occurs check failure.

### 2.9 Typing Rules for the Curry-Style STLC

To perform type inference, we use the standard typing rules of the STLC, but applied to types that may contain type variables.

**Typing Rules (Declarative).** The typing judgment $\Gamma \vdash t : T$ for the Curry-style STLC is given by:

$$\frac{(x : T) \in \Gamma}{\Gamma \vdash x : T} \quad (\text{Var})$$

$$\frac{\Gamma, x : T_1 \vdash t : T_2}{\Gamma \vdash \lambda x.\; t : T_1 \to T_2} \quad (\text{Abs})$$

$$\frac{\Gamma \vdash t_1 : T_{11} \to T_{12} \quad \Gamma \vdash t_2 : T_{11}}{\Gamma \vdash t_1\; t_2 : T_{12}} \quad (\text{App})$$

The key difference from the Church-style rules is in $(\text{Abs})$: the type $T_1$ is not supplied by the programmer. In a derivation, it must be guessed. The constraint generation algorithm systematically transforms this guessing into constraint solving.

**Remark 2.33.** The rules are **not syntax-directed** in the abstraction case: to apply $(\text{Abs})$, we must choose $T_1$. This non-determinism is what makes type reconstruction harder than type checking. The constraint generation algorithm eliminates this non-determinism by introducing fresh type variables.

### 2.10 Constraint Generation

We now define the constraint generation algorithm, which transforms the type reconstruction problem into a constraint satisfaction problem.

**Definition 2.34 (Constraints).** A constraint is an equation $T_1 = T_2$ between two type expressions. A constraint set $C$ is a finite set of such equations.

**Definition 2.35 (Satisfiability).** A substitution $\sigma$ satisfies a constraint $T_1 = T_2$ (written $\sigma \models T_1 = T_2$) if $\sigma(T_1) = \sigma(T_2)$. It satisfies a constraint set $C$ (written $\sigma \models C$) if $\sigma \models c$ for every $c \in C$.

A constraint set $C$ is satisfiable if there exists a substitution $\sigma$ with $\sigma \models C$. It is unsatisfiable if no such $\sigma$ exists.

**Algorithm 2.36 (Constraint Generation).** The function $\mathcal{CG}(\Gamma, t)$ returns a pair $(T, C)$ where $T$ is a type expression and $C$ is a constraint set, defined inductively on $t$:

**Case** $t = x$:

If $(x : T) \in \Gamma$, return $(T, \emptyset)$.

Otherwise, the term contains a free variable not in the context; report an error.

**Case** $t = \lambda x.\; t_1$:

Let $\alpha$ be a fresh type variable (not occurring in $\Gamma$ or in any constraint generated so far).

Let $(T_1, C_1) = \mathcal{CG}(\Gamma \cup \{x : \alpha\}, t_1)$.

Return $(\alpha \to T_1, C_1)$.

**Case** $t = t_1\; t_2$:

Let $(T_1, C_1) = \mathcal{CG}(\Gamma, t_1)$.

Let $(T_2, C_2) = \mathcal{CG}(\Gamma, t_2)$.

Let $\alpha$ be a fresh type variable.

Return $(\alpha, C_1 \cup C_2 \cup \{T_1 = T_2 \to \alpha\})$.

**Convention.** We assume a global supply of fresh type variables, implemented as a counter producing $\alpha_1, \alpha_2, \alpha_3, \ldots$. Each call to "fresh" consumes the next available variable. This ensures that all fresh variables are distinct.

### 2.11 Worked Examples of Constraint Generation

**Example 2.37 (The apply function).** Let us trace constraint generation on $t = \lambda f.\; \lambda x.\; f\;x$ under $\Gamma = \emptyset$.

Step 1: $t = \lambda f.\; t'$ where $t' = \lambda x.\; f\;x$. Introduce fresh $\alpha_1$ for $f$. Recursively compute $\mathcal{CG}(\{f : \alpha_1\}, t')$.

Step 2: $t' = \lambda x.\; t''$ where $t'' = f\;x$. Introduce fresh $\alpha_2$ for $x$. Context is now $\Gamma' = \{f : \alpha_1, x : \alpha_2\}$. Recursively compute $\mathcal{CG}(\Gamma', t'')$.

Step 3: $t'' = f\;x$ (application).

- $\mathcal{CG}(\Gamma', f) = (\alpha_1, \emptyset)$.
- $\mathcal{CG}(\Gamma', x) = (\alpha_2, \emptyset)$.
- Introduce fresh $\alpha_3$ for the result type.
- Constraint: $\alpha_1 = \alpha_2 \to \alpha_3$.
- Return $(\alpha_3, \{\alpha_1 = \alpha_2 \to \alpha_3\})$.

Step 2 returns: $(\alpha_2 \to \alpha_3, \{\alpha_1 = \alpha_2 \to \alpha_3\})$.

Step 1 returns: $(\alpha_1 \to \alpha_2 \to \alpha_3, \{\alpha_1 = \alpha_2 \to \alpha_3\})$.

**Solving the constraints.** The single constraint $\alpha_1 = \alpha_2 \to \alpha_3$ is solved by the substitution $\sigma = [\alpha_1 \mapsto \alpha_2 \to \alpha_3]$. Applying $\sigma$ to the result type:

$$\sigma(\alpha_1 \to \alpha_2 \to \alpha_3) = (\alpha_2 \to \alpha_3) \to \alpha_2 \to \alpha_3$$

This is the principal type, with $\alpha_2$ and $\alpha_3$ as free parameters. Renaming $\alpha_2$ to $\alpha$ and $\alpha_3$ to $\beta$, we get $(\alpha \to \beta) \to \alpha \to \beta$.

**Example 2.38 (Self-application).** Consider $t = \lambda x.\; x\;x$ under $\Gamma = \emptyset$.

Step 1: $t = \lambda x.\; t'$ where $t' = x\;x$. Introduce $\alpha_1$ for $x$.

Step 2: $t' = x\;x$ (application).

- $\mathcal{CG}(\{x : \alpha_1\}, x) = (\alpha_1, \emptyset)$ (function position).
- $\mathcal{CG}(\{x : \alpha_1\}, x) = (\alpha_1, \emptyset)$ (argument position).
- Introduce $\alpha_2$.
- Constraint: $\alpha_1 = \alpha_1 \to \alpha_2$.
- Return $(\alpha_2, \{\alpha_1 = \alpha_1 \to \alpha_2\})$.

Step 1 returns: $(\alpha_1 \to \alpha_2, \{\alpha_1 = \alpha_1 \to \alpha_2\})$.

**Solving the constraints.** The constraint $\alpha_1 = \alpha_1 \to \alpha_2$ is unsolvable: $\alpha_1$ occurs on the left side and also within the right side $\alpha_1 \to \alpha_2$. Any substitution $\sigma$ with $\sigma(\alpha_1) = T$ would require $T = T \to \sigma(\alpha_2)$, but $|T| < |T \to \sigma(\alpha_2)|$, a contradiction. This is the **occurs check** failure.

**Example 2.39 (Function composition).** Consider $t = \lambda f.\; \lambda g.\; \lambda x.\; g\;(f\;x)$.

Constraint generation:

- Introduce $\alpha_1$ for $f$, $\alpha_2$ for $g$, $\alpha_3$ for $x$.
- Context: $\Gamma' = \{f : \alpha_1, g : \alpha_2, x : \alpha_3\}$.
- For subterm $f\;x$: introduce $\alpha_4$.
  - $\mathcal{CG}(\Gamma', f) = (\alpha_1, \emptyset)$
  - $\mathcal{CG}(\Gamma', x) = (\alpha_3, \emptyset)$
  - Constraint: $\alpha_1 = \alpha_3 \to \alpha_4$.
  - Result: $(\alpha_4, \{\alpha_1 = \alpha_3 \to \alpha_4\})$.
- For subterm $g\;(f\;x)$: introduce $\alpha_5$.
  - $\mathcal{CG}(\Gamma', g) = (\alpha_2, \emptyset)$
  - Subterm $f\;x$ has type $\alpha_4$, constraints $\{\alpha_1 = \alpha_3 \to \alpha_4\}$.
  - Constraint: $\alpha_2 = \alpha_4 \to \alpha_5$.
  - Result: $(\alpha_5, \{\alpha_1 = \alpha_3 \to \alpha_4, \alpha_2 = \alpha_4 \to \alpha_5\})$.
- Final result type: $\alpha_1 \to \alpha_2 \to \alpha_3 \to \alpha_5$.
- Final constraints: $\{\alpha_1 = \alpha_3 \to \alpha_4, \alpha_2 = \alpha_4 \to \alpha_5\}$.

**Solving.** Both constraints have a variable on the left and no occurrence of that variable on the right, so both are immediately solvable:

$$\sigma = [\alpha_1 \mapsto \alpha_3 \to \alpha_4,\; \alpha_2 \mapsto \alpha_4 \to \alpha_5]$$

Applying to the result type:

$$\sigma(\alpha_1 \to \alpha_2 \to \alpha_3 \to \alpha_5) = (\alpha_3 \to \alpha_4) \to (\alpha_4 \to \alpha_5) \to \alpha_3 \to \alpha_5$$

Renaming $\alpha_3 \to A$, $\alpha_4 \to B$, $\alpha_5 \to C$:

$$(A \to B) \to (B \to C) \to A \to C$$

This is the familiar type of function composition.

**Example 2.40 (The const function).** Consider $t = \lambda x.\; \lambda y.\; x$.

- Introduce $\alpha_1$ for $x$, $\alpha_2$ for $y$.
- Body is $x$: $\mathcal{CG}(\{x : \alpha_1, y : \alpha_2\}, x) = (\alpha_1, \emptyset)$.
- Result type: $\alpha_1 \to \alpha_2 \to \alpha_1$.
- Constraints: $\emptyset$.

No constraints to solve. The principal type is $\alpha_1 \to \alpha_2 \to \alpha_1$, or equivalently $\alpha \to \beta \to \alpha$.

**Example 2.41 (Twice).** Consider $t = \lambda f.\; \lambda x.\; f\;(f\;x)$.

- Introduce $\alpha_1$ for $f$, $\alpha_2$ for $x$.
- For $f\;x$: introduce $\alpha_3$, constraint $\alpha_1 = \alpha_2 \to \alpha_3$.
- For $f\;(f\;x)$: introduce $\alpha_4$, constraint $\alpha_1 = \alpha_3 \to \alpha_4$.
- Result type: $\alpha_1 \to \alpha_2 \to \alpha_4$.
- Constraints: $\{\alpha_1 = \alpha_2 \to \alpha_3, \alpha_1 = \alpha_3 \to \alpha_4\}$.

Solving: from the first constraint, $\sigma_1 = [\alpha_1 \mapsto \alpha_2 \to \alpha_3]$. Apply to the second: $\alpha_2 \to \alpha_3 = \alpha_3 \to \alpha_4$. Decompose: $\alpha_2 = \alpha_3$ and $\alpha_3 = \alpha_4$. So $\sigma_2 = [\alpha_2 \mapsto \alpha_3, \alpha_4 \mapsto \alpha_3]$.

Combined: $\sigma = [\alpha_1 \mapsto \alpha_3 \to \alpha_3, \alpha_2 \mapsto \alpha_3, \alpha_4 \mapsto \alpha_3]$.

$$\sigma(\alpha_1 \to \alpha_2 \to \alpha_4) = (\alpha_3 \to \alpha_3) \to \alpha_3 \to \alpha_3$$

The principal type of "twice" is $(\alpha \to \alpha) \to \alpha \to \alpha$. This makes sense: $f$ must be an endofunction because its output is fed back as its input.

**Example 2.42 (A non-typable term).** Consider $\lambda x.\; \lambda y.\; x\;y\;(x\;(\lambda z.\; z))$.

- Introduce $\alpha_1$ for $x$, $\alpha_2$ for $y$.
- For $x\;y$: introduce $\alpha_3$, constraint $C_1: \alpha_1 = \alpha_2 \to \alpha_3$.
- For $\lambda z.\; z$: introduce $\alpha_4$ for $z$, type is $\alpha_4 \to \alpha_4$.
- For $x\;(\lambda z.\; z)$: introduce $\alpha_5$, constraint $C_2: \alpha_1 = (\alpha_4 \to \alpha_4) \to \alpha_5$.
- For $(x\;y)\;(x\;(\lambda z.\; z))$: introduce $\alpha_6$, constraint $C_3: \alpha_3 = \alpha_5 \to \alpha_6$.

Constraints: $\{C_1, C_2, C_3\}$.

Solving $C_1$ and $C_2$: we need $\alpha_2 \to \alpha_3 = (\alpha_4 \to \alpha_4) \to \alpha_5$. Decomposing: $\alpha_2 = \alpha_4 \to \alpha_4$ and $\alpha_3 = \alpha_5$.

Now solving $C_3$: $\alpha_3 = \alpha_5 \to \alpha_6$. But $\alpha_3 = \alpha_5$ from above, so $\alpha_5 = \alpha_5 \to \alpha_6$. Occurs check failure: $\alpha_5$ occurs in $\alpha_5 \to \alpha_6$. The term is untypable.

### 2.12 Soundness and Completeness of Constraint Generation

**Theorem 2.43 (Soundness of Constraint Generation).** If $\mathcal{CG}(\Gamma, t) = (T, C)$ and $\sigma \models C$, then $\sigma(\Gamma) \vdash t : \sigma(T)$.

*Proof.* By induction on the structure of $t$.

**Case** $t = x$: We have $(T, C) = (\Gamma(x), \emptyset)$. Any $\sigma$ satisfies $\emptyset$. We need to show $\sigma(\Gamma) \vdash x : \sigma(\Gamma(x))$. Since $(x : \Gamma(x)) \in \Gamma$, we have $(x : \sigma(\Gamma(x))) \in \sigma(\Gamma)$, so the judgment follows by rule $(\text{Var})$.

**Case** $t = \lambda x.\; t_1$: We have $(T, C) = (\alpha \to T_1, C_1)$ where $\alpha$ is fresh and $\mathcal{CG}(\Gamma \cup \{x : \alpha\}, t_1) = (T_1, C_1)$.

Suppose $\sigma \models C = C_1$. By the induction hypothesis applied to $t_1$:

$$\sigma(\Gamma \cup \{x : \alpha\}) \vdash t_1 : \sigma(T_1)$$

This is the same as:

$$\sigma(\Gamma), x : \sigma(\alpha) \vdash t_1 : \sigma(T_1)$$

By rule $(\text{Abs})$:

$$\sigma(\Gamma) \vdash \lambda x.\; t_1 : \sigma(\alpha) \to \sigma(T_1) = \sigma(\alpha \to T_1) = \sigma(T)$$

**Case** $t = t_1\; t_2$: We have $(T, C) = (\alpha, C_1 \cup C_2 \cup \{T_1 = T_2 \to \alpha\})$ where:

- $\mathcal{CG}(\Gamma, t_1) = (T_1, C_1)$
- $\mathcal{CG}(\Gamma, t_2) = (T_2, C_2)$
- $\alpha$ is fresh.

Suppose $\sigma \models C$. Then $\sigma \models C_1$, $\sigma \models C_2$, and $\sigma(T_1) = \sigma(T_2 \to \alpha) = \sigma(T_2) \to \sigma(\alpha)$.

By the induction hypothesis:

$$\sigma(\Gamma) \vdash t_1 : \sigma(T_1) = \sigma(T_2) \to \sigma(\alpha)$$

$$\sigma(\Gamma) \vdash t_2 : \sigma(T_2)$$

By rule $(\text{App})$:

$$\sigma(\Gamma) \vdash t_1\; t_2 : \sigma(\alpha) = \sigma(T)$$

$\square$

**Theorem 2.44 (Completeness of Constraint Generation).** If $\sigma'(\Gamma) \vdash t : T'$ for some $\sigma'$ and $T'$, then $\mathcal{CG}(\Gamma, t)$ succeeds with some $(T, C)$, and there exists a substitution $\sigma$ with $\sigma \models C$, $\sigma(T) = T'$, and $\sigma(\alpha) = \sigma'(\alpha)$ for all $\alpha \in \text{FTV}(\Gamma)$.

*Proof.* By induction on the derivation of $\sigma'(\Gamma) \vdash t : T'$.

**Case** $(\text{Var})$: $t = x$ and $T' = \sigma'(\Gamma(x))$. We have $\mathcal{CG}(\Gamma, x) = (\Gamma(x), \emptyset)$. Take $\sigma$ to agree with $\sigma'$ on $\text{FTV}(\Gamma)$ and map fresh variables introduced by $\mathcal{CG}$ appropriately. Then $\sigma(\Gamma(x)) = \sigma'(\Gamma(x)) = T'$ and $\sigma \models \emptyset$ trivially.

**Case** $(\text{Abs})$: $t = \lambda x.\; t_1$ and we have $\sigma'(\Gamma), x : S_1 \vdash t_1 : S_2$ with $T' = S_1 \to S_2$. The constraint generation produces $\mathcal{CG}(\Gamma, \lambda x.\; t_1) = (\alpha \to T_1, C_1)$ with $\alpha$ fresh and $\mathcal{CG}(\Gamma \cup \{x : \alpha\}, t_1) = (T_1, C_1)$.

By the induction hypothesis (applied to the premise $\sigma'(\Gamma), x : S_1 \vdash t_1 : S_2$), there exists $\sigma$ with $\sigma \models C_1$, $\sigma(T_1) = S_2$, and $\sigma(\alpha) = S_1$. Then $\sigma(\alpha \to T_1) = S_1 \to S_2 = T'$.

**Case** $(\text{App})$: $t = t_1\; t_2$ and we have $\sigma'(\Gamma) \vdash t_1 : S_2 \to T'$ and $\sigma'(\Gamma) \vdash t_2 : S_2$. Constraint generation produces $(T_1, C_1)$ for $t_1$, $(T_2, C_2)$ for $t_2$, fresh $\alpha$, and constraint $T_1 = T_2 \to \alpha$.

By the induction hypothesis on $t_1$: $\sigma \models C_1$ and $\sigma(T_1) = S_2 \to T'$.

By the induction hypothesis on $t_2$: $\sigma \models C_2$ and $\sigma(T_2) = S_2$.

Setting $\sigma(\alpha) = T'$: $\sigma(T_1) = S_2 \to T' = \sigma(T_2) \to \sigma(\alpha) = \sigma(T_2 \to \alpha)$. So $\sigma \models \{T_1 = T_2 \to \alpha\}$. $\square$

### 2.13 From Constraints to Solutions

The constraint generation algorithm reduces type reconstruction to constraint solving: finding a substitution $\sigma$ that simultaneously satisfies a set of equations between type expressions. This is precisely the **unification problem**, which we study in Lecture 05b.

The key result (Robinson 1965) is:

**Theorem 2.45 (Existence of Most General Unifiers, Preview).** If a finite set of equations $C = \{T_1 = S_1, \ldots, T_n = S_n\}$ has any solution, then it has a most general solution---a substitution $\sigma$ such that every other solution $\sigma'$ satisfies $\sigma' = \delta \circ \sigma$ for some $\delta$. This most general solution is called the **most general unifier** (MGU) of $C$ and is unique up to variable renaming.

**Theorem 2.46 (Principal Types via Constraint Generation).** Let $\mathcal{CG}(\Gamma, t) = (T, C)$. If $\text{mgu}(C) = \sigma$ exists, then $(\sigma, \sigma(T))$ is a principal solution to the type reconstruction problem for $t$ under $\Gamma$.

*Proof.* We must show two things:

(1) $(\sigma, \sigma(T))$ is a solution: By Theorem 2.43 (soundness of $\mathcal{CG}$), since $\sigma \models C$, we have $\sigma(\Gamma) \vdash t : \sigma(T)$.

(2) It is principal: Let $(\sigma', T')$ be any other solution. By Theorem 2.44 (completeness of $\mathcal{CG}$), there exists $\tau$ with $\tau \models C$ and $\tau(T) = T'$. Since $\sigma$ is the MGU of $C$ and $\tau$ is also a unifier of $C$, by the MGU property there exists $\delta$ with $\tau = \delta \circ \sigma$. Therefore $T' = \tau(T) = \delta(\sigma(T))$. $\square$

### 2.14 Decidability of Type Inference for STLC

**Theorem 2.47 (Decidability).** The type reconstruction problem for the STLC is decidable.

*Proof.* Given $t$ and $\Gamma$:

1. Run $\mathcal{CG}(\Gamma, t)$ to obtain $(T, C)$. This always terminates: the recursion follows the structure of $t$ (a finite tree), and each recursive call processes a strictly smaller subterm.

2. Run Robinson's unification algorithm on $C$ to compute $\text{mgu}(C)$, or determine that $C$ is unsatisfiable. Robinson's algorithm always terminates (proved in Lecture 05b).

3. If $\text{mgu}(C) = \sigma$ exists, output $\sigma(T)$ as the principal type. If unification fails, report that $t$ is untypable.

Each step terminates, so the procedure is total. By soundness and completeness of constraint generation combined with the properties of the MGU, the output is correct. $\square$

**Corollary 2.48.** The type reconstruction problem for the STLC can be solved in $O(n \cdot \alpha(n))$ time, where $n = |t|$ is the size of the term and $\alpha$ is the inverse Ackermann function, assuming the unification algorithm uses the union-find optimization (Paterson and Wegman 1978).

*Proof sketch.* Constraint generation runs in $O(n)$ time: each node of the AST is visited once, and each visit does $O(1)$ work (introducing a fresh variable and emitting at most one constraint). The resulting constraint set $C$ has at most $n$ equations, and the total size of all type expressions in $C$ is $O(n)$ (each type expression produced by $\mathcal{CG}$ has size proportional to the depth of the term at that point, but the total is bounded by $O(n)$).

Unification with the union-find optimization runs in $O(m \cdot \alpha(m))$ where $m$ is the total size of the constraint set. Since $m = O(n)$, the total time is $O(n \cdot \alpha(n))$, which is effectively linear. $\square$

### 2.15 Properties of Fresh Variable Generation

The constraint generation algorithm relies on generating fresh type variables. The following properties are essential for correctness.

**Definition 2.49 (Freshness).** A type variable $\alpha$ is fresh with respect to a set of type variables $V$ if $\alpha \notin V$. We say $\alpha$ is fresh for $\mathcal{CG}$ at a given point in the execution if $\alpha$ has not been generated by any previous call to "fresh" and $\alpha \notin \text{FTV}(\Gamma)$ for the initial context $\Gamma$.

**Lemma 2.50 (Freshness Invariant).** At every recursive call of $\mathcal{CG}$, the fresh variables introduced are:

1. Distinct from all variables in the input context $\Gamma$.
2. Distinct from all previously introduced fresh variables.
3. Distinct from the free type variables in any constraint generated so far.

*Proof.* By the assumption of a global counter producing $\alpha_1, \alpha_2, \alpha_3, \ldots$ where the starting index exceeds the maximum index of any variable in $\Gamma$. Each call consumes the next available variable, which satisfies all three properties by construction. $\square$

**Lemma 2.51 (Constraint Independence).** In the application case $t = t_1\; t_2$, the constraint sets $C_1$ (from $t_1$) and $C_2$ (from $t_2$) share no type variables introduced by $\mathcal{CG}$: the fresh variables in $C_1$ and $C_2$ are disjoint.

*Proof.* The recursive calls for $t_1$ and $t_2$ consume different segments of the global fresh variable counter, so the sets of fresh variables they introduce are disjoint. The only shared type variables are those from the original context $\Gamma$, which appear in both $C_1$ and $C_2$ but are not "introduced" by $\mathcal{CG}$. $\square$

### 2.16 The Size of Generated Constraints

**Lemma 2.52.** For a term $t$ of size $n = |t|$, $\mathcal{CG}(\Gamma, t)$ generates:

- At most $\lfloor n/2 \rfloor$ constraints (only application nodes contribute constraints).
- At most $n$ fresh type variables (application and abstraction nodes each contribute one).
- The total size of all type expressions appearing in constraints is $O(n)$.
- The algorithm runs in $O(n)$ time (excluding the cost of unification).

*Proof.* Each node of the AST contributes at most one constraint (only application nodes) and at most one fresh variable (application and abstraction nodes). The type expression returned by $\mathcal{CG}$ for a subterm of depth $d$ involves at most the type variables of the context plus those introduced along the path. The total size of all generated type expressions is bounded by the sum of the sizes of all constraints, which is $O(n)$. Since we traverse the AST exactly once, the running time is $O(n)$. $\square$

### 2.17 Extended Example: Church Numerals

Let us trace type inference on Church numerals, which illustrate how the principal type can be more general than expected.

The Church numeral for zero: $\mathbf{0} = \lambda s.\; \lambda z.\; z$.

Constraint generation under $\Gamma = \emptyset$:

- Introduce $\alpha_1$ for $s$, $\alpha_2$ for $z$.
- Body is $z$, type is $\alpha_2$, no constraints.
- Result: $(\alpha_1 \to \alpha_2 \to \alpha_2, \emptyset)$.

No constraints to solve. Principal type: $\alpha_1 \to \alpha_2 \to \alpha_2$. This is more general than the "expected" Church numeral type $(\alpha \to \alpha) \to \alpha \to \alpha$: the first argument $s$ is not constrained at all, since $z$ is returned without applying $s$.

The Church numeral for one: $\mathbf{1} = \lambda s.\; \lambda z.\; s\;z$.

- Introduce $\alpha_1$ for $s$, $\alpha_2$ for $z$.
- Body $s\;z$: introduce $\alpha_3$, constraint $\alpha_1 = \alpha_2 \to \alpha_3$.
- Result: $(\alpha_1 \to \alpha_2 \to \alpha_3, \{\alpha_1 = \alpha_2 \to \alpha_3\})$.

Solving: $\sigma = [\alpha_1 \mapsto \alpha_2 \to \alpha_3]$. Principal type: $(\alpha_2 \to \alpha_3) \to \alpha_2 \to \alpha_3$.

Note the asymmetry: $\mathbf{0}$ has a more general type than $\mathbf{1}$. The type $(\alpha_2 \to \alpha_3) \to \alpha_2 \to \alpha_3$ does not require $\alpha_2 = \alpha_3$; the successor function will force this equality.

The Church numeral for two: $\mathbf{2} = \lambda s.\; \lambda z.\; s\;(s\;z)$.

- Introduce $\alpha_1$ for $s$, $\alpha_2$ for $z$.
- For $s\;z$: introduce $\alpha_3$, constraint $\alpha_1 = \alpha_2 \to \alpha_3$.
- For $s\;(s\;z)$: introduce $\alpha_4$, constraint $\alpha_1 = \alpha_3 \to \alpha_4$.
- Constraints: $\{\alpha_1 = \alpha_2 \to \alpha_3, \alpha_1 = \alpha_3 \to \alpha_4\}$.

Solving: from the two constraints, $\alpha_2 \to \alpha_3 = \alpha_3 \to \alpha_4$. Decompose: $\alpha_2 = \alpha_3$ and $\alpha_3 = \alpha_4$. So $\alpha_2 = \alpha_3 = \alpha_4$.

Principal type: $(\alpha_2 \to \alpha_2) \to \alpha_2 \to \alpha_2$. This is the standard Church numeral type: applying $s$ twice forces it to be an endofunction.

The successor function: $\mathbf{succ} = \lambda n.\; \lambda s.\; \lambda z.\; s\;(n\;s\;z)$.

- Introduce $\alpha_1$ for $n$, $\alpha_2$ for $s$, $\alpha_3$ for $z$.
- For $n\;s$: introduce $\alpha_4$, constraint $\alpha_1 = \alpha_2 \to \alpha_4$.
- For $(n\;s)\;z$: introduce $\alpha_5$, constraint $\alpha_4 = \alpha_3 \to \alpha_5$.
- For $s\;((n\;s)\;z)$: introduce $\alpha_6$, constraint $\alpha_2 = \alpha_5 \to \alpha_6$.
- Result type: $\alpha_1 \to \alpha_2 \to \alpha_3 \to \alpha_6$.
- Constraints: $\{\alpha_1 = \alpha_2 \to \alpha_4,\; \alpha_4 = \alpha_3 \to \alpha_5,\; \alpha_2 = \alpha_5 \to \alpha_6\}$.

Solving: from $\alpha_4 = \alpha_3 \to \alpha_5$ and $\alpha_1 = \alpha_2 \to \alpha_4$:

$$\alpha_1 = \alpha_2 \to (\alpha_3 \to \alpha_5)$$

From $\alpha_2 = \alpha_5 \to \alpha_6$:

$$\alpha_1 = (\alpha_5 \to \alpha_6) \to (\alpha_3 \to \alpha_5)$$

The principal type of $\mathbf{succ}$ is:

$$\sigma(\alpha_1 \to \alpha_2 \to \alpha_3 \to \alpha_6) = ((\alpha_5 \to \alpha_6) \to \alpha_3 \to \alpha_5) \to (\alpha_5 \to \alpha_6) \to \alpha_3 \to \alpha_6$$

Renaming: $((B \to C) \to A \to B) \to (B \to C) \to A \to C$. This is more general than the standard type $((\alpha \to \alpha) \to \alpha \to \alpha) \to (\alpha \to \alpha) \to \alpha \to \alpha$. The additional generality reflects the fact that the STLC (without polymorphism) does not force $\mathbf{succ}$ to preserve the Church numeral type; only composition with specific numerals introduces that constraint.

### 2.18 The Omega Combinator and Non-Typable Terms

**Example 2.53.** The term $\Omega = (\lambda x.\; x\;x)\;(\lambda x.\; x\;x)$ is not typable.

For the subterm $\lambda x.\; x\;x$: as shown in Example 2.38, constraint generation produces the unsolvable constraint $\alpha_1 = \alpha_1 \to \alpha_2$. Since this subterm is untypable, the full term $\Omega$ is also untypable.

Even if we consider $\Omega$ directly as an application, the constraints from both the function and argument positions are identical (both are $\lambda x.\; x\;x$), and both produce occurs check failures.

**Remark 2.54.** The untypability of $\Omega$ in the STLC is closely related to the strong normalization theorem: every well-typed STLC term terminates under any evaluation strategy. Since $\Omega$ diverges (it reduces to itself), it cannot be well-typed.

### 2.19 Relationship to the Curry--Howard Correspondence

Under the Curry--Howard correspondence (Module 02), the STLC corresponds to intuitionistic propositional logic (with implication only). Type inference for the STLC thus corresponds to a particular form of proof search: given a raw term (a proof sketch without formula annotations), reconstruct the formulas that make it a valid proof.

More precisely:
- **Terms** correspond to proofs.
- **Types** correspond to propositions.
- **Type inference** corresponds to determining which proposition a given proof proves.

The principal type theorem says that every valid proof sketch proves a "most general" proposition---one from which all other propositions proved by the same sketch can be obtained by substitution.

The decidability of type inference corresponds to the decidability of this form of proof search. Note that this is different from the question of whether a given proposition is provable (the inhabitation problem), which is also decidable for the STLC but PSPACE-complete (Statman 1979).

### 2.20 Comparison with Bidirectional Type Checking

An alternative approach to reducing annotation burden is **bidirectional type checking** (Pierce and Turner 2000), which we will revisit in Lecture 05d. The idea is to distinguish two judgment forms:

- **Checking mode** ($\Gamma \vdash t \Leftarrow T$): verify that $t$ has the expected type $T$.
- **Synthesis mode** ($\Gamma \vdash t \Rightarrow T$): compute the type of $t$.

The key rules are:

$$\frac{\Gamma, x : T_1 \vdash t \Leftarrow T_2}{\Gamma \vdash \lambda x.\; t \Leftarrow T_1 \to T_2} \quad (\text{Abs-Check})$$

$$\frac{\Gamma \vdash t_1 \Rightarrow T_{11} \to T_{12} \quad \Gamma \vdash t_2 \Leftarrow T_{11}}{\Gamma \vdash t_1\; t_2 \Rightarrow T_{12}} \quad (\text{App-Synth})$$

In $(\text{Abs-Check})$, the expected type $T_1 \to T_2$ flows into the lambda, eliminating the need for a fresh type variable for the argument. This approach requires annotations only at specific positions (typically at the boundary between checking and synthesis) and scales to richer type systems where full inference is undecidable.

Bidirectional type checking is less powerful than full type reconstruction: some annotations are still needed. But it is more predictable, produces better error messages, and extends naturally to System F, dependent types, and other systems where full inference is undecidable.

### 2.21 Alternative Formulation: Bottom-Up Type Inference

An alternative to constraint generation is the **direct** or **bottom-up** approach, which computes the principal type of each subterm before proceeding to the parent. This is essentially what Algorithm W does (Lecture 05c), but restricted to the STLC (without let-polymorphism).

**Algorithm 2.55 (Bottom-Up Type Inference for STLC).** The function $\mathcal{W}_0(\Gamma, t)$ returns a pair $(\sigma, T)$ or fails:

**Case** $t = x$:

If $(x : T) \in \Gamma$, return $(\text{id}, T)$.

**Case** $t = \lambda x.\; t_1$:

Let $\alpha$ be fresh.

Let $(\sigma_1, T_1) = \mathcal{W}_0(\Gamma \cup \{x : \alpha\}, t_1)$.

Return $(\sigma_1, \sigma_1(\alpha) \to T_1)$.

**Case** $t = t_1\; t_2$:

Let $(\sigma_1, T_1) = \mathcal{W}_0(\Gamma, t_1)$.

Let $(\sigma_2, T_2) = \mathcal{W}_0(\sigma_1(\Gamma), t_2)$.

Let $\alpha$ be fresh.

Let $\sigma_3 = \text{unify}(\sigma_2(T_1), T_2 \to \alpha)$.

Return $(\sigma_3 \circ \sigma_2 \circ \sigma_1, \sigma_3(\alpha))$.

This is equivalent to constraint generation followed by unification, but performs the unification eagerly at each application site rather than collecting all constraints first. The advantage is simplicity; the disadvantage is that error messages are harder to localize (errors are reported at the point where unification fails, which may be far from the source of the problem).

**Theorem 2.56 (Equivalence).** For the STLC (without let-polymorphism), $\mathcal{W}_0$ and $\mathcal{CG}$ followed by $\text{mgu}$ produce the same principal type (up to variable renaming).

*Proof sketch.* Both approaches compute the same set of constraints and solve them with the same unification algorithm. The only difference is timing: $\mathcal{W}_0$ solves constraints eagerly, while $\mathcal{CG}$ + $\text{mgu}$ collects them first. Since the order of unification does not affect the result (the MGU is unique up to renaming), the outputs are equivalent. $\square$

### 2.22 Type Inference as Proof Search

The Curry--Howard correspondence gives us another perspective on type inference. Under this correspondence:

- A term $t$ of type $T$ corresponds to a proof of the proposition $T$ in intuitionistic propositional logic.
- A type variable $\alpha$ corresponds to a propositional variable.
- The arrow type $T_1 \to T_2$ corresponds to implication $T_1 \Rightarrow T_2$.

Type inference, then, corresponds to the following question: given a proof term (with some propositions omitted), fill in the missing propositions to make the proof valid.

**Definition 2.57 (Inhabitation Problem).** Given a type $T$ and a context $\Gamma$, the inhabitation problem asks: does there exist a term $t$ such that $\Gamma \vdash t : T$?

This is the converse of type inference: instead of finding the type of a given term, we find a term of a given type. The inhabitation problem for the STLC is decidable (it corresponds to provability in intuitionistic propositional logic) but is PSPACE-complete (Statman 1979).

**Remark 2.58.** Type inference and inhabitation are logically independent problems:
- Type inference: given $t$, find $T$ such that $\vdash t : T$.
- Inhabitation: given $T$, find $t$ such that $\vdash t : T$.
- Type checking: given $t$ and $T$, decide whether $\vdash t : T$.

All three are decidable for the STLC. For System F, type checking is decidable but both type inference and type-checking-with-partial-annotations are undecidable (Wells 1999).

### 2.23 Type Inference with Base Types and Constants

In practice, the STLC includes base types ($\text{Int}$, $\text{Bool}$, $\text{Unit}$, etc.) and constants ($0, 1, 2, \ldots$, $\text{true}$, $\text{false}$, $+$, $\text{if}$, etc.). Type inference extends naturally:

**Constants.** Each constant $c$ has a fixed type $\text{typeof}(c)$. For example:

$$\text{typeof}(n) = \text{Int} \quad \text{for integer literals } n$$

$$\text{typeof}(\text{true}) = \text{typeof}(\text{false}) = \text{Bool}$$

$$\text{typeof}(+) = \text{Int} \to \text{Int} \to \text{Int}$$

$$\text{typeof}(\text{not}) = \text{Bool} \to \text{Bool}$$

Constraint generation for constants is trivial: $\mathcal{CG}(\Gamma, c) = (\text{typeof}(c), \emptyset)$.

**Conditionals.** The term $\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$ generates constraints:

- $(T_1, C_1) = \mathcal{CG}(\Gamma, t_1)$: the condition.
- $(T_2, C_2) = \mathcal{CG}(\Gamma, t_2)$: the then-branch.
- $(T_3, C_3) = \mathcal{CG}(\Gamma, t_3)$: the else-branch.
- Additional constraints: $T_1 = \text{Bool}$ (condition must be boolean) and $T_2 = T_3$ (branches must agree).
- Result: $(T_2, C_1 \cup C_2 \cup C_3 \cup \{T_1 = \text{Bool}, T_2 = T_3\})$.

**Binary operators.** For $t_1 \oplus t_2$ where $\oplus : S_1 \to S_2 \to S_3$:

- $(T_1, C_1) = \mathcal{CG}(\Gamma, t_1)$, $(T_2, C_2) = \mathcal{CG}(\Gamma, t_2)$.
- Additional constraints: $T_1 = S_1$, $T_2 = S_2$.
- Result: $(S_3, C_1 \cup C_2 \cup \{T_1 = S_1, T_2 = S_2\})$.

These extensions do not change the fundamental theory: constraint generation remains syntax-directed and linear-time, and unification remains the solving mechanism.

### 2.24 Visualization of the Constraint Graph

A constraint set can be visualized as a graph, which aids in understanding and debugging.

**Definition 2.59 (Constraint Graph).** Given a constraint set $C = \{T_1^{(i)} = T_2^{(i)}\}_{i=1}^n$ and a result type $T$:

- **Nodes:** one node for each type expression appearing in $C$ or $T$.
- **Edges:** one undirected edge for each constraint $T_1^{(i)} = T_2^{(i)}$, connecting the corresponding nodes.
- **Structure edges:** directed edges from each compound type to its components (e.g., $T_1 \to T_2$ has edges to $T_1$ and $T_2$).

The constraint graph makes several properties visible:

1. **Connected components** of the equality edges correspond to groups of type expressions that must be equal.
2. **Cycles** involving structure edges indicate occurs check failures.
3. **Contradictions** are visible as connected components containing incompatible constants (e.g., $\text{Int}$ and $\text{Bool}$ in the same component).

**Example 2.60.** For the term $\lambda x.\; x\;x$, the constraint graph contains:

- Nodes: $\alpha_1$ (type of $x$), $\alpha_2$ (result of $x\;x$).
- Constraint edge: $\alpha_1 = \alpha_1 \to \alpha_2$.
- Structure edge: $\alpha_1 \to \alpha_2$ has children $\alpha_1$ and $\alpha_2$.

The cycle $\alpha_1 \to \alpha_1 \to \alpha_2 \to$ (structure edge) $\to \alpha_1$ indicates an occurs check failure.

### 2.25 Complexity Boundaries

The STLC sits at a fortunate point in the landscape of type systems: type inference is nearly linear. As we add features, the complexity can increase dramatically:

| System | Type Inference Complexity |
|--------|--------------------------|
| STLC | $O(n \cdot \alpha(n))$ (nearly linear) |
| Hindley--Milner (ML) | DEXPTIME-complete (Mairson 1990) |
| System F | Undecidable (Wells 1999) |
| System $F_\omega$ | Undecidable |
| Dependent types | Undecidable in general |

The jump from the STLC to HM is dramatic: let-polymorphism with generalization can cause types to grow exponentially. The jump from HM to System F is even more dramatic: type inference becomes undecidable. Understanding these boundaries is one of the main themes of this module.

### 2.26 The Substitution Lemma for Type Inference

The following lemma is fundamental: it shows that type substitutions preserve typing judgments. This is the key property that makes constraint-based inference sound.

**Lemma 2.61 (Substitution on Typing Judgments).** If $\Gamma \vdash t : T$ and $\sigma$ is any type substitution, then $\sigma(\Gamma) \vdash t : \sigma(T)$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$.

**Case** $(\text{Var})$: $(x : T) \in \Gamma$, so $\Gamma \vdash x : T$. Then $(x : \sigma(T)) \in \sigma(\Gamma)$, so $\sigma(\Gamma) \vdash x : \sigma(T)$.

**Case** $(\text{Abs})$: $\Gamma, x : T_1 \vdash t : T_2$ and the conclusion is $\Gamma \vdash \lambda x.\; t : T_1 \to T_2$. By the induction hypothesis, $\sigma(\Gamma), x : \sigma(T_1) \vdash t : \sigma(T_2)$. By $(\text{Abs})$: $\sigma(\Gamma) \vdash \lambda x.\; t : \sigma(T_1) \to \sigma(T_2) = \sigma(T_1 \to T_2)$.

**Case** $(\text{App})$: $\Gamma \vdash t_1 : T_{11} \to T_{12}$ and $\Gamma \vdash t_2 : T_{11}$. By the induction hypothesis: $\sigma(\Gamma) \vdash t_1 : \sigma(T_{11}) \to \sigma(T_{12})$ and $\sigma(\Gamma) \vdash t_2 : \sigma(T_{11})$. By $(\text{App})$: $\sigma(\Gamma) \vdash t_1\; t_2 : \sigma(T_{12})$. $\square$

This lemma justifies the key step in soundness of Algorithm W: after inferring a typing, applying a further substitution (from subsequent unification) preserves the typing.

### 2.27 Uniqueness and Canonicity of Principal Types

The principal type property guarantees existence, but we should also address uniqueness. Two principal solutions can differ only by a renaming of type variables.

**Definition 2.62 (Renaming).** A substitution $\rho$ is a *renaming* if it maps variables to variables and is bijective. We write $\sigma_1 \sim \sigma_2$ if there exists a renaming $\rho$ such that $\rho \circ \sigma_1 = \sigma_2$.

**Proposition 2.63.** If $(\sigma_1, T_1)$ and $(\sigma_2, T_2)$ are both principal solutions to the type reconstruction problem for $(\Gamma, t)$, then $T_1 \sim T_2$ (i.e., $T_1$ and $T_2$ differ only by a consistent renaming of type variables).

*Proof.* Since $(\sigma_1, T_1)$ is principal, there exists $\rho_1$ with $\rho_1(T_1) = T_2$. Since $(\sigma_2, T_2)$ is principal, there exists $\rho_2$ with $\rho_2(T_2) = T_1$. Then $\rho_2 \circ \rho_1$ maps $T_1$ to $T_1$, and similarly $\rho_1 \circ \rho_2$ maps $T_2$ to $T_2$. By considering the action on individual type variables, one can verify that $\rho_1$ restricted to $\text{FTV}(T_1)$ is injective: if $\rho_1(\alpha) = \rho_1(\beta)$, then $\rho_2(\rho_1(\alpha)) = \rho_2(\rho_1(\beta))$, so $\alpha = \beta$. Hence $\rho_1|_{\text{FTV}(T_1)}$ is a renaming. $\square$

To obtain a truly canonical representative, one can normalize the principal type by renaming type variables in order of first occurrence (left-to-right, depth-first traversal of the type). For example, the canonical principal type of $\lambda x.\; x$ is $\alpha_1 \to \alpha_1$, not $\alpha_{17} \to \alpha_{17}$.

### 2.28 Multiple Constraint Solutions and the Lattice of Types

Given a constraint set $C$ generated from a term $t$, the set of all solutions $\{\sigma \mid \sigma \models C\}$ forms a rich structure. The MGU $\sigma_0$ is the least element with respect to the instantiation preorder.

**Proposition 2.64.** Let $\sigma_0$ be the MGU of $C$, and let $T_0 = \sigma_0(\alpha_t)$ where $\alpha_t$ is the type variable assigned to $t$. Then the set of valid types for $t$ under $\Gamma$ is exactly:

$$\{S(T_0) \mid S \text{ is any substitution}\}$$

This set is downward-closed under the instantiation preorder: if $T$ is a valid type and $T' \sqsubseteq T$ (meaning $T'$ is an instance of $T$), then $T'$ is also a valid type.

**Remark 2.65.** In the presence of base types alone (no type variables in the context), the principal type of a closed term is unique up to renaming. But for open terms (terms with free variables), the principal type depends on the context. For the open term $x\;y$ in context $\Gamma = \{x : \alpha_1, y : \alpha_2\}$, constraint generation yields the constraint $\alpha_1 = \alpha_2 \to \alpha_3$ with principal type $\alpha_3$. Different contexts lead to different principal types.

### 2.29 The Constraint-Based View as a Factoring Theorem

The constraint-based approach to type inference can be understood as a factoring theorem: the typing relation $\Gamma \vdash t : T$ is factored through an intermediate constraint language.

**Theorem 2.66 (Factoring).** Define $\text{Solve}(C)$ as the MGU of $C$ (if it exists). Then:

$$\Gamma \vdash t : T \quad \iff \quad \exists \sigma.\; \text{let}\; (\alpha_t, C) = \mathcal{CG}(\Gamma, t);\; \sigma = \text{Solve}(C) \circ \sigma_0;\; T = \sigma(\alpha_t) \wedge \sigma(\Gamma) = \Gamma$$

The factoring is:
1. $\mathcal{CG}$ extracts the "shape" of the typing problem as constraints.
2. $\text{Solve}$ reduces constraints to substitutions.
3. The result is instantiated to obtain concrete types.

Each factor is independently verifiable: $\mathcal{CG}$ can be shown correct by structural induction, $\text{Solve}$ reduces to the correctness of unification, and instantiation is trivially correct. This modularity is the key engineering advantage.

### 2.30 Inference with Let-Expressions in the STLC

Although the STLC does not have polymorphism, it can still include let-expressions as syntactic sugar:

$$\text{let}\; x = t_1\; \text{in}\; t_2 \quad \stackrel{\text{def}}{=} \quad (\lambda x.\; t_2)\; t_1$$

However, treating let as desugaring versus treating it as a primitive affects type inference. With desugaring, the type of $x$ is a monotype inferred from $t_1$, and the constraint for the application $(\lambda x.\; t_2)\; t_1$ introduces a single type variable for $x$ that is shared across all uses in $t_2$.

**Constraint generation for let (desugared):**

$$\mathcal{CG}(\Gamma, \text{let}\; x = t_1\; \text{in}\; t_2) = \mathcal{CG}(\Gamma, (\lambda x.\; t_2)\; t_1)$$

This yields fresh $\alpha_x$ and the constraints from both $t_1$ and $t_2$, plus the equation $\alpha_x = T_1$ where $T_1$ is the inferred type of $t_1$.

**Remark 2.67.** In the STLC, there is no difference between let-as-sugar and let-as-primitive: both produce the same principal type. The distinction becomes critical in the Hindley--Milner system (Lecture 05c), where let-bound variables are generalized but lambda-bound variables are not.

### 2.31 Exercises

**Exercise 2.62.** Trace the constraint generation algorithm on the term $\lambda x.\; \lambda y.\; \lambda z.\; x\;z\;(y\;z)$ (the S combinator). Verify that the constraints are solvable and that the principal type is $(\alpha \to \beta \to \gamma) \to (\alpha \to \beta) \to \alpha \to \gamma$.

**Exercise 2.63.** Show that the term $\lambda x.\; \lambda y.\; x\;y\;y$ is typable in the STLC. Find its principal type. (Hint: the two uses of $y$ as arguments to $x\;y$ impose a constraint between the domain and the first argument of $x$.)

**Exercise 2.64.** Consider the term $\lambda f.\; \lambda g.\; \lambda x.\; f\;x\;(g\;x)$ (the S combinator restricted to the case where the first argument is applied to the result of the second). Trace constraint generation and solve the constraints. Compare with the full S combinator.

**Exercise 2.65.** Prove that if $t$ is a closed term (no free term variables) and $\mathcal{CG}(\emptyset, t) = (T, C)$ and $C$ is satisfiable, then $T$ has no free type variables from $\Gamma$ (since $\Gamma = \emptyset$). All free type variables in $T$ are fresh variables introduced by $\mathcal{CG}$.

**Exercise 2.66.** Show that the number of constraints generated by $\mathcal{CG}$ equals the number of application nodes in the abstract syntax tree of $t$. Conclude that the number of constraints is at most $|t| / 2$.

**Exercise 2.67.** Consider adding a fixed-point combinator $\text{fix}$ with typing rule:

$$\frac{\Gamma \vdash t : T \to T}{\Gamma \vdash \text{fix}\; t : T}$$

How does constraint generation extend for $\text{fix}\; t$? What constraint is generated? Trace the algorithm on $\text{fix}\;(\lambda f.\; \lambda n.\; \text{if}\; n = 0\; \text{then}\; 1\; \text{else}\; n \times f\;(n-1))$ and verify that the result has type $\text{Int} \to \text{Int}$.

---

## Summary

1. **The type reconstruction problem** asks: given an unannotated term, find a substitution and type that make the term well-typed. This is the theoretical foundation of type inference as implemented in ML, OCaml, Haskell, and many other languages.

2. **Type variables and substitutions** form an algebraic framework for expressing unknown types. Substitutions compose associatively with the identity substitution as the unit, forming a monoid. The preorder on substitutions captures the notion of "more general."

3. **Constraint generation** systematically transforms the type reconstruction problem into a set of equations between type expressions. The algorithm traverses the term once, introducing a fresh type variable for each unknown and emitting one equation per application.

4. **Soundness** of constraint generation means: if the constraints are satisfiable, the corresponding typing is valid. **Completeness** means: if a typing exists, the constraints are satisfiable.

5. **Principal types** exist for the STLC: if a term is typable, it has a most general type from which all other valid types can be obtained by substitution.

6. **Decidability** follows from the termination of constraint generation (structural recursion on terms) and unification (Lecture 05b). The complexity is nearly linear.

7. **Non-typable terms** are identified by unsolvable constraints, typically involving the occurs check (a type variable would need to equal a type containing itself).

8. **The substitution lemma** ensures that type substitutions preserve typing judgments, providing the foundational link between constraint solving and type correctness.

---

## Further Reading

- Pierce, B. C. (2002). *Types and Programming Languages*, Chapter 22. The primary textbook reference for type inference in the STLC.

- Hindley, J. R. (1969). "The principal type-scheme of an object in combinatory logic." *Transactions of the American Mathematical Society*, 146, 29--60. The original result on principal types.

- Curry, H. B. and Feys, R. (1958). *Combinatory Logic*, Vol. I. North-Holland. The foundational work on type assignment for combinators.

- Robinson, J. A. (1965). "A machine-oriented logic based on the resolution principle." *Journal of the ACM*, 12(1), 23--41. The unification algorithm.

- Wand, M. (1987). "A simple algorithm and proof for type inference." *Fundamenta Informaticae*, 10, 115--122. A clean constraint-based presentation.

- Wells, J. B. (1999). "Typability and type checking in System F are equivalent and undecidable." *Annals of Pure and Applied Logic*, 98(1-3), 111--156. The undecidability result for System F.

- Statman, R. (1979). "Intuitionistic propositional logic is polynomial-space complete." *Theoretical Computer Science*, 9(1), 67--72. Complexity of inhabitation.

- Paterson, M. S. and Wegman, M. N. (1978). "Linear unification." *Journal of Computer and System Sciences*, 16(2), 158--167. Nearly-linear-time unification.

- Pierce, B. C. and Turner, D. N. (2000). "Local type inference." *ACM Transactions on Programming Languages and Systems*, 22(1), 1--44. Bidirectional type checking.

- Mairson, H. G. (1990). "Deciding ML typability is complete for deterministic exponential time." *Proceedings of POPL*, 382--401. The DEXPTIME-completeness result for HM.
