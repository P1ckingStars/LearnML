---
title: "Lecture 05d: Constraint-Based Type Inference"
tags:
  - type-theory
  - type-inference
  - lecture
---
# Lecture 05d: Constraint-Based Type Inference

> **Module 05 --- Type Inference & Reconstruction (Weeks 9--10)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain the two-phase approach to type inference: constraint generation followed by constraint solving, and articulate its advantages over Algorithm W.
2. Define the constraint language for HM-style type inference, including equality constraints, instantiation constraints, and let-constraints.
3. Derive the constraint generation algorithm for HM from the declarative typing rules.
4. Describe how constraint solving reduces to unification, and how let-constraints introduce generalization.
5. Explain how the constraint-based approach yields better error messages and supports modularity.
6. Outline the extension to type classes and qualified types via constrained type schemes.
7. Describe local type inference and bidirectional type checking as alternatives to global inference.
8. Identify the boundaries of decidability: when type inference becomes undecidable and why.

---

## 1. Motivation

Algorithm W (Lecture 05c) interleaves constraint generation and constraint solving: at each application site, it immediately calls the unification algorithm, threading the resulting substitution through subsequent computations. This design has several practical drawbacks:

1. **Error localization.** When unification fails, the error is reported at the point where unification is called, which may be far from the actual source of the type error. The accumulated substitution makes it difficult to trace back to the programmer's mistake.

2. **Modularity.** Algorithm W processes terms in a fixed order (left to right, top to bottom). Changing the order can change which error is reported first. The algorithm cannot easily be decomposed into independent phases for separate compilation.

3. **Extensibility.** Adding new language features (type classes, subtyping, GADTs) requires invasive changes to the algorithm, because generation and solving are entangled.

The **constraint-based** approach, developed by Pottier and Remy (2005) building on work by Odersky, Sulzmann, and Wehr (1999), cleanly separates these concerns:

**Phase 1: Constraint generation.** Traverse the term and emit constraints. No solving occurs; the output is a set (or tree) of constraints.

**Phase 2: Constraint solving.** Solve the constraints using unification (and generalization for let-polymorphism). Report errors with full provenance information.

This separation yields better error messages, supports incremental and parallel processing, and provides a clean framework for extending the type system.

---

## 2. Core Theory

### 2.1 The Constraint Language

We define a language of constraints tailored to HM-style type inference.

**Definition 2.1 (Constraint Syntax).** The constraint language is:

$$C ::= \text{true} \mid \text{false} \mid \tau_1 = \tau_2 \mid C_1 \wedge C_2 \mid \exists \alpha.\; C \mid \text{def}\; x : \forall \bar{\alpha}[C_1].\;\tau\; \text{in}\; C_2 \mid x \preceq \tau$$

where:

- $\text{true}$ is the trivially satisfiable constraint.
- $\text{false}$ is the unsatisfiable constraint.
- $\tau_1 = \tau_2$ is an equality constraint between monotypes.
- $C_1 \wedge C_2$ is conjunction.
- $\exists \alpha.\; C$ introduces a fresh type variable $\alpha$ scoped over $C$.
- $\text{def}\; x : \forall \bar{\alpha}[C_1].\;\tau\; \text{in}\; C_2$ is a let-constraint: it defines $x$ with the constrained type scheme $\forall \bar{\alpha}[C_1].\;\tau$ and uses it in $C_2$.
- $x \preceq \tau$ is an instantiation constraint: the type $\tau$ must be an instance of the scheme bound to $x$.

**Definition 2.2 (Constrained Type Scheme).** A constrained type scheme has the form:

$$\forall \bar{\alpha}[C].\; \tau$$

where $\bar{\alpha}$ are quantified variables, $C$ is a constraint (the "guard" or "side condition"), and $\tau$ is the body. This represents the set of types $\sigma(\tau)$ such that $\sigma$ satisfies $C$ and $\sigma$ is the identity on variables outside $\bar{\alpha}$.

When $C = \text{true}$, this reduces to the standard type scheme $\forall \bar{\alpha}.\; \tau$.

### 2.2 Constraint Semantics

**Definition 2.3 (Satisfaction).** A ground substitution $\phi$ (mapping all type variables to ground types) satisfies a constraint $C$, written $\phi \models C$, as follows:

$$\phi \models \text{true} \quad \text{always}$$

$$\phi \not\models \text{false} \quad \text{never}$$

$$\phi \models (\tau_1 = \tau_2) \quad \text{iff} \quad \phi(\tau_1) = \phi(\tau_2)$$

$$\phi \models (C_1 \wedge C_2) \quad \text{iff} \quad \phi \models C_1 \text{ and } \phi \models C_2$$

$$\phi \models (\exists \alpha.\; C) \quad \text{iff} \quad \text{there exists a ground type } T \text{ such that } \phi[\alpha \mapsto T] \models C$$

$$\phi \models (\text{def}\; x : \forall \bar{\alpha}[C_1].\;\tau\; \text{in}\; C_2) \quad \text{iff} \quad \phi \models C_2[\text{with } x \text{ bound to } \forall \bar{\alpha}[C_1].\;\tau]$$

$$\phi \models (x \preceq \tau) \quad \text{iff} \quad \text{there exist ground types } T_1, \ldots, T_n \text{ such that}$$

$$\phi[\bar{\alpha} \mapsto \bar{T}] \models C_1 \text{ and } \phi(\tau) = \phi[\bar{\alpha} \mapsto \bar{T}](\tau_0)$$

where $x$ is bound to $\forall \alpha_1 \cdots \alpha_n[C_1].\; \tau_0$.

**Definition 2.4 (Satisfiability and Equivalence).** A constraint $C$ is satisfiable if there exists $\phi$ with $\phi \models C$. Two constraints $C_1$ and $C_2$ are equivalent ($C_1 \equiv C_2$) if for all $\phi$: $\phi \models C_1$ iff $\phi \models C_2$.

### 2.3 Constraint Generation for HM

**Algorithm 2.5 (Constraint Generation).** The function $\lbrack\!\lbrack \Gamma \vdash t : \tau \rbrack\!\rbrack$ generates a constraint $C$ such that $C$ is satisfiable if and only if $t$ is typable with type $\tau$ under $\Gamma$.

**Case** $t = x$ (variable):

If $x$ has a type scheme in the environment (i.e., $x$ was introduced by a let-binding):

$$\lbrack\!\lbrack \Gamma \vdash x : \tau \rbrack\!\rbrack = (x \preceq \tau)$$

If $x$ has a monotype $\tau_x$ in the environment (i.e., $x$ was introduced by a lambda):

$$\lbrack\!\lbrack \Gamma \vdash x : \tau \rbrack\!\rbrack = (\tau = \tau_x)$$

**Case** $t = \lambda x.\; t_1$ (abstraction):

$$\lbrack\!\lbrack \Gamma \vdash \lambda x.\; t_1 : \tau \rbrack\!\rbrack = \exists \alpha_1.\; \exists \alpha_2.\; (\tau = \alpha_1 \to \alpha_2) \wedge \lbrack\!\lbrack \Gamma, x : \alpha_1 \vdash t_1 : \alpha_2 \rbrack\!\rbrack$$

where $\alpha_1, \alpha_2$ are fresh.

**Case** $t = t_1\; t_2$ (application):

$$\lbrack\!\lbrack \Gamma \vdash t_1\; t_2 : \tau \rbrack\!\rbrack = \exists \alpha.\; \lbrack\!\lbrack \Gamma \vdash t_1 : \alpha \to \tau \rbrack\!\rbrack \wedge \lbrack\!\lbrack \Gamma \vdash t_2 : \alpha \rbrack\!\rbrack$$

where $\alpha$ is fresh.

**Case** $t = \text{let}\; x = t_1\; \text{in}\; t_2$ (let-binding):

$$\lbrack\!\lbrack \Gamma \vdash \text{let}\; x = t_1\; \text{in}\; t_2 : \tau \rbrack\!\rbrack = \text{def}\; x : \forall \bar{\alpha}[C_1].\;\alpha_0\; \text{in}\; C_2$$

where $\alpha_0$ is fresh, $C_1 = \lbrack\!\lbrack \Gamma \vdash t_1 : \alpha_0 \rbrack\!\rbrack$, $\bar{\alpha} = \text{FTV}(C_1, \alpha_0) \setminus \text{FTV}(\Gamma)$ (the variables to be generalized), and $C_2 = \lbrack\!\lbrack \Gamma, x : \forall \bar{\alpha}[C_1].\;\alpha_0 \vdash t_2 : \tau \rbrack\!\rbrack$.

**Theorem 2.6 (Correctness of Constraint Generation).** The constraint $\lbrack\!\lbrack \Gamma \vdash t : \tau \rbrack\!\rbrack$ is satisfiable by substitution $\phi$ if and only if $\phi(\Gamma) \vdash t : \phi(\tau)$ in the declarative HM system.

*Proof sketch.* By induction on the structure of $t$, showing that each constraint generation rule corresponds exactly to the declarative typing rule.

- The abstraction case: $\exists \alpha_1 \alpha_2.\; (\tau = \alpha_1 \to \alpha_2) \wedge C_1$ is satisfiable iff there exist types for $\alpha_1, \alpha_2$ such that $\tau$ is an arrow type and the body is typable. This corresponds exactly to the $(\text{Abs})$ rule.

- The let case: the $\text{def}$ constraint binds $x$ to a constrained type scheme. The instantiation constraint $x \preceq \tau$ in $C_2$ ensures that each use of $x$ gets a fresh instance of the scheme, corresponding to the $(\text{Var})$ rule with instantiation. $\square$

### 2.4 Constraint Solving

The constraint solver transforms a constraint into a substitution (or reports failure). The key insight is that the constraint language can be solved by a combination of unification (for equality constraints) and generalization (for let-constraints).

**Algorithm 2.7 (Constraint Solver).** The function $\text{solve}(C)$ returns a substitution $\sigma$ or fails.

**Case** $C = \text{true}$: Return $\text{id}$.

**Case** $C = \text{false}$: Fail.

**Case** $C = (\tau_1 = \tau_2)$: Return $\text{unify}(\tau_1, \tau_2)$.

**Case** $C = (C_1 \wedge C_2)$:

Let $\sigma_1 = \text{solve}(C_1)$.

Let $\sigma_2 = \text{solve}(\sigma_1(C_2))$.

Return $\sigma_2 \circ \sigma_1$.

**Case** $C = (\exists \alpha.\; C')$: Return $\text{solve}(C')$ (the existential is witnessed by the substitution for $\alpha$ that the solver finds).

**Case** $C = (\text{def}\; x : \forall \bar{\alpha}[C_1].\;\tau\; \text{in}\; C_2)$:

Let $\sigma_1 = \text{solve}(C_1)$.

Compute the solved type: $\tau' = \sigma_1(\tau)$.

Compute the generalized variables: $\bar{\beta} = \text{FTV}(\tau') \setminus \text{FTV}(\sigma_1(\Gamma))$ (where $\Gamma$ is the ambient context; in practice, this is tracked as part of the solver state).

Bind $x$ to the scheme $\forall \bar{\beta}.\; \tau'$.

Let $\sigma_2 = \text{solve}(\sigma_1(C_2))$ (with $x$ bound in the environment).

Return $\sigma_2 \circ \sigma_1$.

**Case** $C = (x \preceq \tau)$:

Look up $x$'s scheme $\forall \bar{\beta}.\; \tau'$.

Instantiate with fresh variables: $\tau'' = [\bar{\beta} \mapsto \bar{\gamma}](\tau')$ where $\bar{\gamma}$ are fresh.

Return $\text{unify}(\tau, \tau'')$.

**Theorem 2.8 (Soundness and Completeness of Constraint Solving).** The solver produces a most general satisfying substitution: if $C$ is satisfiable, the solver returns an MGU-like substitution from which all other satisfying substitutions can be obtained.

### 2.5 Comparison with Algorithm W

The constraint-based approach and Algorithm W compute the same result (principal types) but differ in structure.

| Aspect | Algorithm W | Constraint-based |
|--------|-------------|------------------|
| Structure | Interleaved generation and solving | Separated phases |
| Error location | Where unification fails | Tracked by constraint provenance |
| Order dependence | Left-to-right processing | Order-independent generation |
| Extensibility | Invasive changes | Modular extensions |
| Implementation complexity | Simpler for basic HM | More infrastructure, but scales better |

**Example 2.9 (Better error messages).** Consider the program:

```
let f x = x + 1 in
f true
```

Algorithm W processes left to right:
1. Types `f`: $\text{Int} \to \text{Int}$ (from the `+` operation).
2. Types `f true`: unifies $\text{Int}$ (expected argument type) with $\text{Bool}$ (actual). Error: "Cannot unify Int with Bool at line 2."

Constraint-based:
1. Generates constraint from `f x = x + 1`: $\alpha_x = \text{Int}$ (from `+`), $f : \text{Int} \to \text{Int}$.
2. Generates constraint from `f true`: $\text{Int} = \text{Bool}$.
3. Each constraint is annotated with its source location. The solver can report: "The function `f` expects an Int argument (inferred from the `+` on line 1), but is applied to a Bool on line 2."

The constraint-based approach can provide a richer explanation because it has access to the full constraint graph, not just the failure point.

### 2.6 Constraint Normalization and Simplification

Before solving, constraints can be normalized and simplified to improve efficiency and error reporting.

**Definition 2.10 (Flat Constraints).** A constraint is in flat form if all equality constraints are between a variable and a (possibly compound) type, or between two variables. Any constraint set can be flattened by introducing fresh variables.

**Example 2.11.** The constraint $(\alpha \to \beta) = (\gamma \to \delta) \to \varepsilon$ is flattened to:

$$\exists \phi_1 \phi_2.\; \alpha = \phi_1 \to \phi_2 \wedge \phi_1 = \gamma \to \delta \wedge \phi_2 = \varepsilon \wedge \beta = \varepsilon$$

Wait---that is not quite right. Let us be more careful. The original constraint equates $\alpha \to \beta$ with $(\gamma \to \delta) \to \varepsilon$. This decomposes to $\alpha = \gamma \to \delta$ and $\beta = \varepsilon$. No fresh variables are needed for this decomposition; flattening is only necessary when compound types are equated with other compound types in a way that does not directly decompose.

The point of flattening is to ensure that the solver processes constraints uniformly.

**Definition 2.12 (Constraint Graphs).** A constraint set can be represented as a graph where:
- Nodes represent type variables and type constructors.
- Edges represent equality constraints.
- Clusters represent let-scopes with their generalization boundaries.

This representation supports efficient graph-based solving algorithms and enables error diagnosis via graph analysis (finding the minimal unsatisfiable subgraph).

### 2.7 Type Error Diagnosis

The constraint-based framework enables sophisticated error diagnosis.

**Definition 2.13 (Minimum Error Source).** Given an unsatisfiable constraint set $C$, a minimum error source is a minimal subset $C' \subseteq C$ that is itself unsatisfiable. Removing any single constraint from $C'$ makes it satisfiable.

**Algorithm 2.14 (Error Slicing, sketch).** To find a minimum error source:

1. Solve the constraints incrementally, recording which constraints contribute to each unification step.
2. When a conflict is detected, trace back through the recorded dependencies to find the minimal set of constraints (and hence source locations) involved.
3. Report all involved locations, not just the point of failure.

**Example 2.15.** Consider:

```
let f x = x + 1 in       -- line 1: x : Int
let g y = f (y, y) in    -- line 2: y used as part of a pair, f expects Int
g "hello"                 -- line 3: g applied to String
```

The constraints include:
- From line 1: $\alpha_x = \text{Int}$ (from `+`).
- From line 2: $\alpha_y \to (\alpha_y, \alpha_y) = \text{Int}$ (from applying `f` to a pair). This is the conflict: a pair is not an Int.

The minimum error source involves the constraint from `f`'s definition (expects Int) and the constraint from `g`'s definition (passes a pair). The solver can report both locations.

### 2.8 Extension: Type Classes and Qualified Types

Haskell's type classes (Wadler and Blott 1989) extend HM with constrained polymorphism.

**Definition 2.16 (Qualified Type).** A qualified type has the form:

$$\forall \bar{\alpha}.\; \overline{C(\alpha_i)} \Rightarrow \tau$$

where $\overline{C(\alpha_i)}$ is a set of class constraints. For example:

$$\forall \alpha.\; \text{Eq}(\alpha) \Rightarrow \alpha \to \alpha \to \text{Bool}$$

is the type of the equality function: it works for any type $\alpha$ that is an instance of the $\text{Eq}$ class.

**Constraint generation for type classes.** The constraint language is extended with class constraints:

$$C ::= \ldots \mid \text{Class}(\tau)$$

When a class method is used (e.g., `==`), the constraint generator emits a class constraint on the relevant type variable. These constraints are collected and must be resolved either:

1. By the context (the class constraint is inherited by the enclosing function's type), or
2. By a specific instance (the type variable is instantiated to a type that has an instance for the class).

**Example 2.17.** For the function `member x xs = any (\y -> x == y) xs`:

Constraints generated:
- $\alpha_x = \alpha$ (fresh variable for the element type)
- $\text{Eq}(\alpha)$ (from the use of `==`)
- $\alpha_{xs} = \text{List}(\alpha)$ (from `any`)
- Result type: $\alpha \to \text{List}(\alpha) \to \text{Bool}$

After solving, the qualified type is:

$$\text{member} : \forall \alpha.\; \text{Eq}(\alpha) \Rightarrow \alpha \to \text{List}(\alpha) \to \text{Bool}$$

The class constraint $\text{Eq}(\alpha)$ becomes part of the type scheme.

### 2.9 Extension: Local Type Inference and Bidirectional Type Checking

**Definition 2.18 (Bidirectional Type Checking).** A bidirectional type system distinguishes two judgment forms:

- $\Gamma \vdash t \Rightarrow \tau$ --- synthesis (or inference): compute the type of $t$.
- $\Gamma \vdash t \Leftarrow \tau$ --- checking (or analysis): verify that $t$ has the expected type $\tau$.

The key rules are:

$$\frac{(x : \tau) \in \Gamma}{\Gamma \vdash x \Rightarrow \tau} \quad (\text{Var-Synth})$$

$$\frac{\Gamma, x : \tau_1 \vdash t \Leftarrow \tau_2}{\Gamma \vdash \lambda x.\; t \Leftarrow \tau_1 \to \tau_2} \quad (\text{Abs-Check})$$

$$\frac{\Gamma \vdash t_1 \Rightarrow \tau_1 \to \tau_2 \quad \Gamma \vdash t_2 \Leftarrow \tau_1}{\Gamma \vdash t_1\; t_2 \Rightarrow \tau_2} \quad (\text{App-Synth})$$

$$\frac{\Gamma \vdash t \Rightarrow \tau}{\Gamma \vdash t \Leftarrow \tau} \quad (\text{Sub})$$

The crucial difference from Algorithm W: in $(\text{Abs-Check})$, the expected type flows into the lambda, so no fresh type variable is needed for the argument. This provides better type information propagation and supports richer type systems.

**Definition 2.19 (Local Type Inference, Pierce and Turner 2000).** Local type inference combines bidirectional type checking with limited type argument synthesis. When a polymorphic function is applied, the type arguments are inferred locally from the argument types using a restricted form of unification (matching or local constraint solving), rather than requiring global unification.

**Example 2.20.** In a System F-like language with local type inference:

```
let id : forall a. a -> a = \x. x
id 42    -- type argument Int is inferred locally from the argument 42
```

Without local type inference, the programmer would need to write `id [Int] 42`.

Local type inference is the basis for type inference in Scala, Kotlin, Swift, Rust, and TypeScript (to varying degrees).

### 2.10 Bidirectional Typing and Higher-Rank Polymorphism

Bidirectional type checking is particularly valuable for higher-rank polymorphism, where global inference is undecidable but local checking is decidable.

**Example 2.21.** Consider a rank-2 function:

```
let apply_to_both : (forall a. a -> a) -> (Int, Bool) =
  \f. (f 42, f true)
```

The argument `f` has a polymorphic type $\forall \alpha.\; \alpha \to \alpha$. In the body, `f` is used at two different types. HM cannot type this (lambda-bound variables get monotypes), but bidirectional checking with a type annotation can:

1. Check $\lambda f.\; (f\; 42, f\; \text{true})$ against type $(\forall \alpha.\; \alpha \to \alpha) \to (\text{Int}, \text{Bool})$.
2. In checking mode, $f : \forall \alpha.\; \alpha \to \alpha$ (from the annotation).
3. At `f 42`: instantiate $\alpha = \text{Int}$.
4. At `f true`: instantiate $\alpha = \text{Bool}$.

The annotation is necessary: without it, the system cannot determine that $f$ should have a polymorphic type.

**Theorem 2.22 (Peyton Jones et al. 2007).** Type inference for a system with arbitrary-rank polymorphism and bidirectional type checking (with annotations at all rank-$n$ positions for $n \geq 2$) is decidable and produces principal types.

### 2.11 Limitations: When Type Inference Becomes Undecidable

Several extensions to HM make type inference undecidable.

**Theorem 2.23 (Undecidability of System F Typability, Wells 1999).** Given a term $t$ in the untyped lambda calculus, it is undecidable whether there exist type annotations that make $t$ a well-typed System F term.

*Proof sketch.* Wells reduces the semi-unification problem (which is undecidable, Kfoury et al. 1993) to System F typability. Semi-unification asks: given pairs $(S_1, T_1), \ldots, (S_n, T_n)$, does there exist a substitution $\sigma$ and substitutions $\rho_1, \ldots, \rho_n$ such that $\rho_i(\sigma(S_i)) = \sigma(T_i)$ for all $i$? This is a "one-sided" version of unification where one side is further instantiated. $\square$

**Theorem 2.24 (Undecidability of Subtyping + Polymorphism).** Type inference for a system combining subtyping and ML-style polymorphism is undecidable in general (Tiuryn and Urzyczyn 1996). Specifically, when subtyping includes both covariant and contravariant type constructors (like function types), and the subtyping relation generates constraints of the form $\tau_1 \leq \tau_2$ (in addition to equality constraints), the constraint solving problem becomes undecidable.

**Theorem 2.25 (Undecidability of Higher-Rank Inference).** Type inference for rank-$k$ polymorphism with $k \geq 3$ is undecidable (Kfoury and Wells 2004). However, rank-2 type inference is decidable.

**Practical implications.** These undecidability results explain why languages with rich type systems require more annotations:

- **Haskell with RankNTypes:** requires annotations at rank-2+ positions.
- **Scala/Kotlin:** require annotations on function parameters (no inference for parameter types of lambda arguments to higher-order functions without expected type).
- **Rust:** requires annotations in function signatures; infers types only within function bodies.
- **Dependent types (Agda, Coq, Lean):** use higher-order unification heuristics; inference is best-effort, not complete.

### 2.12 Constraint-Based Inference for Algebraic Data Types

Algebraic data types (ADTs) are a natural extension. The constraint language handles them through constructor types.

**Example 2.26.** Given the type definition:

```
type 'a list = Nil | Cons of 'a * 'a list
```

The constructors have types:
- $\text{Nil} : \forall \alpha.\; \text{List}(\alpha)$
- $\text{Cons} : \forall \alpha.\; \alpha \times \text{List}(\alpha) \to \text{List}(\alpha)$

Pattern matching generates constraints from the constructor types:

```
match xs with
| Nil -> 0
| Cons(hd, tl) -> 1 + length tl
```

Constraints:
- $\alpha_{xs} = \text{List}(\beta)$ for some $\beta$ (from matching against list constructors).
- First branch: result type $\text{Int}$.
- Second branch: $\alpha_{hd} = \beta$, $\alpha_{tl} = \text{List}(\beta)$, result type $\text{Int}$.
- Both branches must have the same result type: $\text{Int} = \text{Int}$ (trivially satisfied).

### 2.13 The Pottier--Remy Framework

Pottier and Remy (2005) developed a comprehensive constraint-based framework for HM type inference that serves as the theoretical foundation for many modern implementations.

**Key contributions:**

1. **Constraint language with let-binding.** The $\text{def}\; x : \sigma\; \text{in}\; C$ construct elegantly captures generalization within the constraint language itself, rather than as a side-condition.

2. **Efficient solving.** The solver uses a union-find data structure augmented with rank information (corresponding to let-nesting depth) to handle generalization efficiently. Type variables are assigned ranks; a variable can be generalized at a let-binding only if its rank exceeds the rank of the enclosing scope.

3. **Constraint simplification.** Before reporting errors, constraints are simplified (removing solved variables, collapsing trivial equalities) to produce minimal, human-readable error messages.

4. **Modular presentation.** The framework separates the constraint language (which can be extended with new constraint forms) from the solver (which can be optimized independently).

**Definition 2.27 (Ranks in Constraint Solving).** Each type variable is assigned a rank $r \in \mathbb{N}$. The rank of a variable represents the depth of the let-binding scope in which it was introduced. A variable $\alpha$ at rank $r$ can be generalized at a let-binding at depth $d$ only if $r > d$.

This rank-based approach avoids explicitly computing $\text{FTV}(\Gamma)$ at each generalization point, which would be expensive. Instead, the rank of each variable implicitly tracks whether it "escapes" the current let-scope.

**Algorithm 2.28 (Rank-Based Generalization).**

1. When entering a let-scope at depth $d$, create new type variables with rank $d + 1$.
2. During unification, when unifying two variables, take the minimum rank.
3. When leaving the let-scope, variables with rank $> d$ can be generalized; variables with rank $\leq d$ cannot (they appear in the outer context).

### 2.14 Implementation Considerations

**Efficient constraint representation.** In practice, constraints are not built as a tree and then traversed; instead, the constraint generator directly populates a mutable union-find structure. This blurs the line between generation and solving but maintains the conceptual separation.

**Incremental solving.** For IDE support (real-time error reporting), constraints can be solved incrementally: when the programmer edits a function body, only the constraints from that function need to be re-generated and re-solved.

**Constraint serialization.** For separate compilation, the constraints from one module can be serialized (as part of the module's interface) and solved when the module is used. This supports modular type inference.

### 2.15 Constraint Entailment and Simplification

In practice, constraint sets can be large and contain redundant constraints. Simplification reduces the constraint set while preserving its solution set.

**Definition 2.31 (Constraint Entailment).** A constraint $C_1$ entails $C_2$ (written $C_1 \models C_2$) if every substitution satisfying $C_1$ also satisfies $C_2$.

**Definition 2.32 (Constraint Simplification Rules).** The following rules simplify a constraint set while preserving satisfiability:

**Tautology elimination:** Remove constraints of the form $\tau = \tau$.

**Substitution propagation:** If $\alpha = \tau$ with $\alpha \notin \text{FTV}(\tau)$, replace all other occurrences of $\alpha$ with $\tau$ and remove the constraint.

**Decomposition:** Replace $f(\tau_1, \ldots, \tau_n) = f(\sigma_1, \ldots, \sigma_n)$ with $\{\tau_1 = \sigma_1, \ldots, \tau_n = \sigma_n\}$.

**Contradiction detection:** If the simplified set contains $f(\ldots) = g(\ldots)$ with $f \neq g$, mark the entire set as unsatisfiable.

These rules are exactly the Martelli--Montanari rules (Lecture 05b), but viewed from the constraint perspective rather than the unification perspective.

### 2.16 Error Recovery and Partial Typing

When type inference fails, it is often useful to provide a partial result rather than simply reporting failure. The constraint-based approach supports this naturally.

**Definition 2.33 (Partial Typing).** A partial typing assigns types to a subset of the subterms of a term, leaving some subterms untyped (or typed with error markers). A partial typing is valid if every typed subterm has a consistent type with respect to its typed children.

**Algorithm 2.34 (Error Recovery).**

1. Generate all constraints.
2. Attempt to solve them.
3. If solving fails, identify the minimal unsatisfiable subset (using error slicing).
4. Remove the constraints in the unsatisfiable subset and solve the remaining constraints.
5. Report the error with the unsatisfiable constraints and provide types for the successfully typed subterms.

This approach is used in modern IDEs to provide type information even in the presence of type errors, enabling features like auto-completion and refactoring on partially typed programs.

### 2.17 Constraint-Based Inference for Records and Row Polymorphism

Row polymorphism extends HM to handle record types with flexible field sets.

**Definition 2.35 (Row Types).** A row type is a mapping from field labels to types, optionally extended with a row variable:

$$\rho ::= \emptyset \mid \ell : \tau; \rho \mid \rho_\alpha$$

where $\ell$ is a label, $\tau$ is a type, and $\rho_\alpha$ is a row variable.

A record type $\{\rho\}$ is a record with the fields specified by $\rho$.

**Example 2.36.** The type $\{x : \text{Int}; y : \text{Bool}; \rho_\alpha\}$ describes records that have at least fields $x : \text{Int}$ and $y : \text{Bool}$, plus any additional fields described by the row variable $\rho_\alpha$.

**Constraint generation for field access:** For the expression $t.x$:

$$\lbrack\!\lbrack \Gamma \vdash t.x : \tau \rbrack\!\rbrack = \exists \rho_\alpha.\; \lbrack\!\lbrack \Gamma \vdash t : \{x : \tau; \rho_\alpha\} \rbrack\!\rbrack$$

The row variable $\rho_\alpha$ allows $t$ to have additional fields beyond $x$.

**Unification for rows.** Row unification extends standard unification with rules for row expressions:

- $\ell : \tau_1; \rho_1 \doteq \ell : \tau_2; \rho_2$: unify $\tau_1 \doteq \tau_2$ and $\rho_1 \doteq \rho_2$.
- $\ell : \tau_1; \rho_1 \doteq \ell' : \tau_2; \rho_2$ with $\ell \neq \ell'$: reorder and retry (rows are unordered sets of fields).
- $\rho_\alpha \doteq \ell : \tau; \rho$: bind $\rho_\alpha \mapsto \ell : \tau; \rho$ (with occurs check on the row variable).

Row polymorphism is the basis of record handling in OCaml (object types), PureScript, and Elm.

### 2.18 Type Inference for Effect Systems

Effect systems extend type systems to track computational effects (exceptions, I/O, state, etc.).

**Definition 2.37 (Effect-Annotated Types).** An effect-annotated function type has the form:

$$\tau_1 \xrightarrow{\varepsilon} \tau_2$$

where $\varepsilon$ is an effect set describing the side effects that may occur when the function is applied.

**Constraint generation for effects.** The constraint language is extended with effect constraints:

$$C ::= \ldots \mid \varepsilon_1 \subseteq \varepsilon_2$$

where $\varepsilon_1 \subseteq \varepsilon_2$ means that the effects in $\varepsilon_1$ are a subset of $\varepsilon_2$.

**Example 2.38.** For a function that may raise an exception:

```
let f x = if x = 0 then raise Division_by_zero else 1 / x
```

The inferred type might be $\text{Int} \xrightarrow{\{\text{exn}\}} \text{Int}$, indicating that calling $f$ may raise an exception.

Effect inference extends HM type inference with effect variables and effect constraints. The constraint-based approach handles this naturally: effect constraints are collected alongside type constraints and solved by a combination of unification (for types) and subset constraint solving (for effects).

### 2.19 Comparison of Type Inference Approaches Across Languages

Different programming languages make different trade-offs in their type inference:

| Language | System | Annotations Required | Polymorphism |
|----------|--------|---------------------|--------------|
| OCaml | HM + extensions | Minimal (at module boundaries) | Let-polymorphism, row polymorphism |
| Haskell | HM + type classes | Minimal (higher-rank needs annotations) | Let-polymorphism, type classes |
| Rust | HM-inspired, local | Function signatures required | Lifetime polymorphism, trait bounds |
| TypeScript | Local + contextual | Function parameters often annotated | No let-polymorphism (structural) |
| Scala | Local + bidirectional | Function parameters required | Subtyping + bounded polymorphism |
| Swift | Bidirectional | Function parameters required | Protocol-based polymorphism |
| Go | Minimal inference | Most types annotated | No parametric polymorphism (until 1.18) |

**Key observations:**

1. Languages with full HM inference (OCaml, Haskell) require the fewest annotations but have the most complex inference algorithms.
2. Languages with subtyping (Scala, TypeScript) require more annotations because subtyping interacts poorly with principal types.
3. Languages designed for large-scale engineering (Rust, Go) often require more annotations for readability and maintainability, even when inference could handle more.

### 2.20 Constraint-Based Inference for GADTs

Generalized Algebraic Data Types (GADTs) present a significant challenge for constraint-based inference because pattern matching on a GADT constructor refines the type of the scrutinee.

**Example 2.29.** Consider:

```
type _ expr =
  | IntLit : int -> int expr
  | BoolLit : bool -> bool expr
  | Add : int expr -> int expr -> int expr
  | If : bool expr -> 'a expr -> 'a expr -> 'a expr
```

The `eval` function:

```
let rec eval : type a. a expr -> a = function
  | IntLit n -> n
  | BoolLit b -> b
  | Add(e1, e2) -> eval e1 + eval e2
  | If(c, t, e) -> if eval c then eval t else eval e
```

In the `IntLit n` branch, the type variable $a$ is refined to $\text{Int}$, so the return type becomes $\text{Int}$ and returning $n : \text{Int}$ is valid. In the `BoolLit b` branch, $a$ is refined to $\text{Bool}$.

**Constraint generation for GADTs.** Each GADT constructor introduces local equality constraints. In the branch for constructor $K : \overline{\tau_i} \to T(\overline{\sigma_j})$, the constraint generator emits:

$$\alpha_{\text{scrutinee}} = T(\overline{\sigma_j}) \wedge \text{(constraints from the branch body)}$$

The local equality $\alpha = \sigma_j$ refines the type variable within the branch but must not "leak" outside.

**Theorem 2.30.** Type inference for GADTs is incomplete in the general case: there exist well-typed GADT programs that no inference algorithm can type without annotations. The fundamental issue is that the refined types in different branches may not have a common generalization.

In practice, OCaml and GHC require type annotations on functions that pattern-match on GADTs.

### 2.21 Constraint-Based Inference for GADTs

Generalized Algebraic Data Types (GADTs) present a significant challenge for constraint-based inference because pattern matching on a GADT constructor refines the type of the scrutinee.

**Example 2.39.** Consider:

```
type _ expr =
  | IntLit : int -> int expr
  | BoolLit : bool -> bool expr
  | Add : int expr -> int expr -> int expr
  | If : bool expr -> 'a expr -> 'a expr -> 'a expr
```

The `eval` function:

```
let rec eval : type a. a expr -> a = function
  | IntLit n -> n
  | BoolLit b -> b
  | Add(e1, e2) -> eval e1 + eval e2
  | If(c, t, e) -> if eval c then eval t else eval e
```

In the `IntLit n` branch, the type variable $a$ is refined to $\text{Int}$, so the return type becomes $\text{Int}$ and returning $n : \text{Int}$ is valid. In the `BoolLit b` branch, $a$ is refined to $\text{Bool}$.

**Constraint generation for GADTs.** Each GADT constructor introduces local equality constraints. In the branch for constructor $K : \overline{\tau_i} \to T(\overline{\sigma_j})$, the constraint generator emits:

$$\alpha_{\text{scrutinee}} = T(\overline{\sigma_j}) \wedge \text{(constraints from the branch body)}$$

The local equality $\alpha = \sigma_j$ refines the type variable within the branch but must not "leak" outside.

**Theorem 2.40.** Type inference for GADTs is incomplete in the general case: there exist well-typed GADT programs that no inference algorithm can type without annotations. The fundamental issue is that the refined types in different branches may not have a common generalization.

In practice, OCaml and GHC require type annotations on functions that pattern-match on GADTs.

### 2.22 The OutsideIn(X) Framework

Vytiniotis, Peyton Jones, and Schrijvers (2011) developed the **OutsideIn(X)** framework, which is the basis of type inference in GHC. The "X" is a parameter representing the constraint domain (which can be instantiated to type classes, type families, GADTs, etc.).

**Key ideas:**

1. **Outside-in solving:** Constraints are solved from the outside in, processing outermost let-bindings before inner ones. This ensures that type information flows from the enclosing context into local definitions.

2. **Implication constraints:** GADT branches generate implication constraints $Q \Rightarrow C$, where $Q$ is the set of type equalities introduced by the constructor and $C$ is the constraint from the branch body. The implication constraint is satisfied if, assuming $Q$, the constraint $C$ is satisfiable.

3. **Wanted vs. given constraints:** The framework distinguishes between "wanted" constraints (generated by the program and to be solved) and "given" constraints (provided by type annotations and GADT refinements). This distinction is crucial for deciding which constraints can be discharged and which must be deferred to the caller.

**Example 2.41 (Implication constraint from GADT).** For the `IntLit n -> n` branch of `eval`:

- Given: $a = \text{Int}$ (from the GADT constructor).
- Wanted: the result `n : int` must have type $a$ (the return type of `eval`).
- Under the given $a = \text{Int}$, the wanted $\text{Int} = a$ is trivially satisfied.

### 2.23 Constraint Entailment for Type Classes

Type class resolution can be viewed as constraint entailment in the constraint-based framework.

**Definition 2.42 (Type Class Constraint).** A type class constraint $C(\tau)$ asserts that the type $\tau$ is an instance of the class $C$. For example, $\text{Eq}(\alpha)$ asserts that $\alpha$ supports equality testing.

**Definition 2.43 (Instance Declaration).** An instance declaration provides a witness that a specific type is an instance of a class:

$$\text{instance}\; \text{Eq}(\text{Int})\; \text{where}\; (==) = \ldots$$

This can be viewed as an axiom in the constraint logic: $\text{Eq}(\text{Int})$ is always satisfiable.

**Definition 2.44 (Context Reduction).** Given a set of wanted constraints $W$ and a set of instance axioms $I$, context reduction attempts to simplify $W$ by applying instance axioms:

- If $\text{Eq}(\text{Int}) \in W$ and there is an instance for $\text{Eq}(\text{Int})$, remove it from $W$.
- If $\text{Eq}(\alpha \to \beta) \in W$ and there is an instance $\text{Eq}(a) \Rightarrow \text{Eq}(a \to b)$ (hypothetical), replace it with $\text{Eq}(\alpha)$.
- If $\text{Eq}(\alpha) \in W$ and $\alpha$ is a type variable, defer the constraint (it becomes part of the function's type signature).

**Termination of context reduction.** The Paterson conditions and the coverage condition in Haskell ensure that context reduction terminates. Without these conditions, overlapping or undecidable instances can cause non-termination.

### 2.24 Constraint-Based Inference and Separate Compilation

The constraint-based approach supports modular compilation naturally.

**Definition 2.45 (Module Signature with Constraints).** A module's type signature includes:
- The types (and type schemes) of exported definitions.
- Residual constraints that must be satisfied by users of the module.

When a module is compiled, its constraints are solved as far as possible. Unsolved constraints (involving type variables from the module's interface) are exported as part of the module's type signature. When the module is used, the remaining constraints are solved in the context of the use site.

**Example 2.46.** Consider a module that exports a function:

```
module M : sig
  val sort : 'a list -> 'a list  (* requires Ord('a) *)
end
```

The constraint $\text{Ord}(\alpha)$ is part of the module's interface. When a client calls `M.sort [3; 1; 2]`, the constraint $\text{Ord}(\text{Int})$ is generated and solved using the `Ord` instance for `Int`.

### 2.25 Constraint Generation with Source Locations

A practical constraint-based system annotates every constraint with its source location, enabling precise error reporting.

**Definition 2.48 (Located Constraint).** A located constraint is a triple $(\tau_1 = \tau_2, \ell, r)$ where $\ell$ is the source location that generated the constraint and $r$ is a human-readable reason.

**Example 2.49.** For the expression `f x + g y` at line 5, column 3:

- Constraint: $\alpha_f = \alpha_x \to \alpha_1$ with location $(5, 3)$ and reason "application of `f` to `x`."
- Constraint: $\alpha_g = \alpha_y \to \alpha_2$ with location $(5, 9)$ and reason "application of `g` to `y`."
- Constraint: $\alpha_1 = \text{Int}$ with location $(5, 7)$ and reason "left argument of `+` must be Int."
- Constraint: $\alpha_2 = \text{Int}$ with location $(5, 7)$ and reason "right argument of `+` must be Int."
- Constraint: result type is $\text{Int}$ with location $(5, 7)$ and reason "result of `+` is Int."

When unification fails (e.g., $\alpha_1 = \text{Bool}$ because $f$ returns Bool), the system can report:

```
Line 5, column 3: Type error in expression 'f x + g y'
  The function 'f' returns Bool (line 5, column 3)
  but '+' expects Int (line 5, column 7)
```

**Implementation.** The constraint solver maintains a provenance map from each type variable to the set of constraints that constrain it. When a unification fails, the solver traces back through the provenance map to identify all source locations involved.

### 2.26 Constraint-Based Inference with Type Annotations

Type annotations provided by the programmer generate additional constraints that the solver must respect.

**Definition 2.50 (Annotation Constraint).** A type annotation `(e : T)` generates the constraint:

$$\lbrack\!\lbrack \Gamma \vdash (e : T) : \tau \rbrack\!\rbrack = (\tau = T) \wedge \lbrack\!\lbrack \Gamma \vdash e : \tau \rbrack\!\rbrack$$

The annotation $T$ must match the inferred type of $e$.

**Example 2.51.** For the expression `let f (x : int) = x + 1`:

- The annotation `x : int` generates the constraint $\alpha_x = \text{Int}$.
- This constraint is added to the constraint set alongside the constraints from `x + 1`.
- Since `+` also requires $\alpha_x = \text{Int}$, the annotation is redundant but harmless.

**Subsumption with annotations.** In systems with subtyping or higher-rank polymorphism, the annotation may be more general than the inferred type. In this case, the constraint is a subsumption check rather than an equality check:

$$\lbrack\!\lbrack \Gamma \vdash (e : T) : \tau \rbrack\!\rbrack = (\tau \leq T) \wedge \lbrack\!\lbrack \Gamma \vdash e : \tau \rbrack\!\rbrack$$

### 2.27 Incremental Constraint Solving for IDE Support

Modern IDEs require real-time type feedback as the programmer edits code. The constraint-based approach supports incremental solving.

**Definition 2.52 (Incremental Constraint Update).** When the programmer modifies a function body:

1. Invalidate the constraints generated from the modified function.
2. Re-generate constraints for the modified function.
3. Merge the new constraints with the unchanged constraints from the rest of the program.
4. Re-solve incrementally, reusing solutions for unchanged parts.

**Implementation strategy.** The constraint set is organized as a tree mirroring the program's let-binding structure. Each node in the tree corresponds to a let-binding and contains the constraints generated from that binding's definition. When a binding is modified, only its subtree is re-generated and re-solved.

**Complexity.** If the modified function body has size $m$ and the total program has size $n$, incremental re-solving takes $O(m \cdot \alpha(m))$ rather than $O(n \cdot \alpha(n))$, which is a significant improvement for large programs.

### 2.28 Constraint Graphs and Type Error Visualization

The constraint graph provides a visual representation that aids in understanding and debugging type errors.

**Definition 2.53 (Constraint Hypergraph).** A constraint hypergraph $G = (V, E, H)$ consists of:

- **Vertices $V$:** one vertex for each type variable and each ground type.
- **Equality edges $E$:** one edge for each equality constraint, connecting the constrained types.
- **Hyperedges $H$:** one hyperedge for each decomposition (e.g., an arrow type $\alpha = \beta \to \gamma$ is a hyperedge connecting $\alpha$, $\beta$, and $\gamma$).

**Type error visualization.** When a type error occurs:

1. Identify the unsatisfiable constraint (the edge that causes a clash or occurs check failure).
2. Find the shortest path in the constraint graph from one endpoint of the failing constraint to the other, passing through the constraints that contributed to the failure.
3. Display this path to the programmer, with each edge annotated with its source location.

This approach is implemented in some form in Elm, Haskell (with the `-fshow-hole-constraints` flag), and experimental type error debugging tools.

**Example 2.54.** For the error in `let f x = x + 1 in f true`:

The constraint graph contains:
- $\alpha_x = \text{Int}$ (from `+`, at the definition of `f`).
- $\alpha_x = \text{Bool}$ (from `true`, at the call site).
- Path: $\text{Int} \leftarrow \alpha_x \rightarrow \text{Bool}$.

The visualization shows that $\alpha_x$ is constrained to be both `Int` and `Bool`, with links to the responsible source locations.

### 2.29 The Two-Level Approach: Constraint Generation as a Type System

Sulzmann (1997) observed that constraint generation can itself be formulated as a type system---a "constraint type system" that assigns constraint-annotated types to terms.

**Definition 2.55 (Constraint Typing Judgment).** A constraint typing judgment has the form:

$$\Gamma \vdash_C t : \tau$$

meaning "under context $\Gamma$ and constraint $C$, the term $t$ has type $\tau$." The constraint $C$ collects all the conditions that must be satisfied for the typing to be valid.

This two-level approach---a constraint type system on top of the object type system---provides a clean theoretical framework for proving properties like principal types and completeness.

**Theorem 2.56 (Two-Level Correspondence).** The constraint typing judgment $\Gamma \vdash_C t : \tau$ holds if and only if for every substitution $\sigma$ satisfying $C$: $\sigma(\Gamma) \vdash t : \sigma(\tau)$ in the original (unconstrained) type system.

This theorem formalizes the intuition that constraints are "deferred equalities": they record the conditions under which a typing is valid, deferring the actual checking to the constraint solver.

### 2.30 Type Inference for Algebraic Effects

Algebraic effects are a modern approach to computational effects that generalizes monads and effect systems. Type inference for algebraic effects extends the constraint-based framework.

**Definition 2.47 (Effect Row).** An effect row is a set of effect labels, optionally extended with an effect variable:

$$\varepsilon ::= \emptyset \mid \ell; \varepsilon \mid \varepsilon_\alpha$$

A function type with effects: $\tau_1 \xrightarrow{\varepsilon} \tau_2$ means the function may perform effects in $\varepsilon$.

**Constraint generation for effect handlers.** When a handler handles an effect $\ell$:

$$\lbrack\!\lbrack \Gamma \vdash \text{handle}\; t\; \text{with}\; h : \tau \rbrack\!\rbrack = \exists \varepsilon_\alpha.\; \lbrack\!\lbrack \Gamma \vdash t : \tau \rbrack\!\rbrack_{\varepsilon = \ell; \varepsilon_\alpha} \wedge \lbrack\!\lbrack \Gamma \vdash h : \ldots \rbrack\!\rbrack$$

The handler removes $\ell$ from the effect row, leaving the remaining effects $\varepsilon_\alpha$.

This area is actively researched, with systems like Koka (Leijen 2017) and Effekt (Brachthaeuser et al. 2020) implementing effect inference based on row-polymorphic constraint solving.

### 2.26 Exercises

**Exercise 2.48.** Write the constraint generation rules for a language with record types $\{l_1 : \tau_1, \ldots, l_n : \tau_n\}$ and field access $t.l$. Include row polymorphism to handle records with unknown additional fields.

**Exercise 2.49.** Consider the expression:

```
let f x y = if x then y + 1 else y * 2
```

Write out the complete constraint set generated by the constraint-based algorithm. Solve the constraints step by step and verify that the principal type is $\text{Bool} \to \text{Int} \to \text{Int}$.

**Exercise 2.50.** Explain why the following Haskell expression requires a type annotation:

```haskell
let f = \x -> (show x, x + 1)
```

What constraints are generated? Which constraints are unsatisfiable without an annotation? How does the constraint-based approach identify the issue?

**Exercise 2.51.** Design a constraint language for a type system with both subtyping and polymorphism. What constraints replace equality constraints? Why does constraint solving become harder? Give an example of a constraint set that is satisfiable in the subtyping system but would be unsatisfiable with equality constraints only.

**Exercise 2.52.** Consider bidirectional type checking for the term $\lambda x.\; x\;42$. Show the checking and synthesis steps. At what point is the expected type used to avoid generating a fresh type variable? Compare with the constraint-based approach.

**Exercise 2.53.** The GHC type checker uses the OutsideIn(X) algorithm. Explain why "outside-in" solving order is important for GADT type inference. Give an example where inside-out solving would fail to find a valid typing that outside-in solving discovers.

**Exercise 2.54.** Consider extending the constraint language with disjunctive constraints $C_1 \vee C_2$, meaning "either $C_1$ or $C_2$ must be satisfied." When would such constraints arise in type inference? How does disjunction affect the complexity of constraint solving? (Hint: think about overloaded operators or union types.)

**Exercise 2.55.** Implement a minimal constraint-based type inference engine for a language with integer and boolean types, function types, and let-polymorphism. Separate the implementation into a constraint generation phase and a constraint solving phase. Compare the error messages produced by your implementation with those produced by Algorithm W on the same error-containing programs.

---

## Summary

1. **Constraint-based type inference** separates type inference into two phases---constraint generation and constraint solving---yielding better modularity, error messages, and extensibility than Algorithm W.

2. **The constraint language** includes equality constraints ($\tau_1 = \tau_2$), instantiation constraints ($x \preceq \tau$), and let-constraints ($\text{def}\; x : \sigma\; \text{in}\; C$) that capture generalization within the constraint framework.

3. **Constraint solving** reduces to unification for equality constraints, augmented with generalization at let-constraints. The solver produces principal types.

4. **Error diagnosis** benefits from the constraint-based approach: the full constraint graph is available, enabling minimum error source identification and multi-location error reporting.

5. **Type classes** extend the constraint language with class constraints, producing qualified types $\overline{C(\alpha)} \Rightarrow \tau$.

6. **Bidirectional type checking** offers an alternative to global inference: type information flows both "down" (checking) and "up" (synthesis), requiring annotations only at specific positions. It supports higher-rank polymorphism.

7. **Decidability boundaries:** System F typability is undecidable; combining subtyping with polymorphism is undecidable; rank-3+ inference is undecidable. These results motivate the design of practical systems that balance expressiveness with decidability.

8. **The Pottier--Remy framework** provides a clean, efficient, and extensible foundation for constraint-based HM inference, using ranks to manage generalization efficiently.

---

## Further Reading

- Pottier, F. and Remy, D. (2005). "The essence of ML type inference." In *Advanced Topics in Types and Programming Languages*, B. C. Pierce, ed., MIT Press, Chapter 10. The definitive reference on constraint-based HM inference.

- Odersky, M., Sulzmann, M., and Wehr, M. (1999). "Type inference with constrained types." *Theory and Practice of Object Systems*, 5(1), 35--55.

- Pierce, B. C. and Turner, D. N. (2000). "Local type inference." *ACM Transactions on Programming Languages and Systems*, 22(1), 1--44.

- Wadler, P. and Blott, S. (1989). "How to make ad-hoc polymorphism less ad hoc." *Proceedings of POPL*, 60--76.

- Peyton Jones, S., Vytiniotis, D., Weirich, S., and Shields, M. (2007). "Practical type inference for arbitrary-rank types." *Journal of Functional Programming*, 17(1), 1--82.

- Wells, J. B. (1999). "Typability and type checking in System F are equivalent and undecidable." *Annals of Pure and Applied Logic*, 98(1--3), 111--156.

- Tiuryn, J. and Urzyczyn, P. (1996). "The subtyping problem for second-order types is undecidable." *Proceedings of LICS*, 74--85.

- Haack, C. and Wells, J. B. (2004). "Type error slicing in implicitly typed higher-order languages." *Science of Computer Programming*, 50(1--3), 189--224.

- Dunfield, J. and Krishnaswami, N. R. (2021). "Bidirectional typing." *ACM Computing Surveys*, 54(5), 1--38. Comprehensive survey of bidirectional type checking.

- Vytiniotis, D., Peyton Jones, S., and Schrijvers, T. (2011). "OutsideIn(X): Modular type inference with local assumptions." *Journal of Functional Programming*, 21(4--5), 333--412. GHC's approach to constraint-based inference with type classes and GADTs.
