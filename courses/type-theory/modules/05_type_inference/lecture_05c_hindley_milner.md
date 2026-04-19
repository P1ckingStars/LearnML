---
title: "Lecture 05c: The Hindley--Milner Type System"
tags:
  - type-theory
  - type-inference
  - lecture
---
# Lecture 05c: The Hindley--Milner Type System

> **Module 05 --- Type Inference & Reconstruction (Weeks 9--10)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define the Hindley--Milner (HM) type system, distinguishing monotypes from type schemes and explaining the role of let-polymorphism.
2. State and explain the typing rules for HM, including the critical distinction between the $(\text{Let})$ and $(\text{App})$ rules with respect to generalization.
3. Describe Algorithm W in full detail: input, output, fresh variable generation, unification at application sites, generalization at let-bindings.
4. Prove the soundness of Algorithm W: if it succeeds, the result is a valid typing.
5. Prove the completeness of Algorithm W: if a typing exists, Algorithm W finds a principal one.
6. Explain the value restriction and why unrestricted generalization is unsound in the presence of mutable references.
7. Situate HM as a decidable fragment of System F and explain why full System F type inference is undecidable.
8. Trace Algorithm W on non-trivial examples including polymorphic let-bindings, higher-order functions, and recursive definitions.

---

## 1. Motivation

The STLC, even with type inference (Lecture 05a), lacks polymorphism. The identity function $\lambda x.\; x$ receives the principal type $\alpha \to \alpha$, but this $\alpha$ is a schematic variable---it stands for a single unknown type. If we write:

```
let id = \x. x in (id 3, id true)
```

the STLC would require $\alpha$ to be simultaneously $\text{Int}$ (from `id 3`) and $\text{Bool}$ (from `id true`), which is a unification failure.

What we want is **polymorphism**: the ability to use `id` at different types in different contexts. System F (Module 06) provides full impredicative polymorphism, but at the cost of undecidable type inference (Wells 1999). The Hindley--Milner type system (HM) strikes a remarkable balance: it allows polymorphism at `let`-bindings, which covers the vast majority of practical polymorphic programs, while retaining decidable and complete type inference with principal types.

HM is the type system of ML (Milner 1978), OCaml, Haskell (before type classes and extensions), and many other functional languages. Understanding HM is essential for any serious study of type systems.

### 1.1 Key Idea: Let-Polymorphism

The central insight of HM is the distinction between two binding mechanisms:

- **Lambda binding** ($\lambda x.\; t$): the bound variable $x$ receives a monomorphic type. All uses of $x$ in $t$ must use the same type.
- **Let binding** ($\text{let}\; x = t_1\; \text{in}\; t_2$): the bound variable $x$ receives a polymorphic type scheme. Different uses of $x$ in $t_2$ may use different instantiations.

This asymmetry is the heart of HM. It is justified by the observation that `let x = t1 in t2` is semantically equivalent to $(\lambda x.\; t_2)\; t_1$ (in a call-by-value semantics), but the type system treats them differently: the let-form allows generalization, while the lambda-application form does not.

### 1.2 Historical Development

- Curry and Feys (1958): principal type schemes for combinators.
- Hindley (1969): principal type theorem for the simply typed lambda calculus.
- Milner (1978): Algorithm W for ML, with let-polymorphism.
- Damas and Milner (1982): formal proof of soundness and completeness of Algorithm W.
- The system is variously called "Hindley--Milner," "Damas--Milner," or "ML type inference."

---

## 2. Core Theory

### 2.1 Types and Type Schemes

**Definition 2.1 (Monotypes).** The set of monotypes (or simple types) $\tau$ is:

$$\tau ::= \alpha \mid \tau_1 \to \tau_2$$

where $\alpha$ ranges over type variables.

**Definition 2.2 (Type Schemes / Polytypes).** The set of type schemes $\sigma$ is:

$$\sigma ::= \tau \mid \forall \alpha.\; \sigma$$

A type scheme $\forall \alpha_1.\; \forall \alpha_2.\; \cdots \forall \alpha_n.\; \tau$ is abbreviated as $\forall \alpha_1 \alpha_2 \cdots \alpha_n.\; \tau$ or $\forall \bar{\alpha}.\; \tau$ where $\bar{\alpha} = \alpha_1, \ldots, \alpha_n$.

**Example 2.3.**
- $\alpha \to \alpha$ is a monotype.
- $\forall \alpha.\; \alpha \to \alpha$ is a type scheme (the type of the polymorphic identity).
- $\forall \alpha.\; \forall \beta.\; (\alpha \to \beta) \to (\beta \to \gamma) \to (\alpha \to \gamma)$ is a type scheme with $\gamma$ free (not bound by a $\forall$).

**Definition 2.4 (Free Type Variables in Schemes).** Free type variables are defined as:

$$\text{FTV}(\alpha) = \{\alpha\}$$

$$\text{FTV}(\tau_1 \to \tau_2) = \text{FTV}(\tau_1) \cup \text{FTV}(\tau_2)$$

$$\text{FTV}(\forall \alpha.\; \sigma) = \text{FTV}(\sigma) \setminus \{\alpha\}$$

A type scheme $\forall \bar{\alpha}.\; \tau$ is **closed** if $\text{FTV}(\forall \bar{\alpha}.\; \tau) = \emptyset$.

**Convention.** We identify type schemes that differ only by alpha-renaming of bound variables: $\forall \alpha.\; \alpha \to \alpha$ and $\forall \beta.\; \beta \to \beta$ are the same type scheme.

### 2.2 Instantiation and Generalization

**Definition 2.5 (Instantiation).** A monotype $\tau'$ is an instance of a type scheme $\forall \alpha_1 \cdots \alpha_n.\; \tau$ if there exist monotypes $\tau_1, \ldots, \tau_n$ such that:

$$\tau' = [\alpha_1 \mapsto \tau_1, \ldots, \alpha_n \mapsto \tau_n](\tau)$$

We write $\forall \bar{\alpha}.\; \tau \sqsupseteq \tau'$ (the scheme is "more general than" the instance).

**Example 2.6.** The type scheme $\forall \alpha.\; \alpha \to \alpha$ has instances:
- $\text{Int} \to \text{Int}$ (via $[\alpha \mapsto \text{Int}]$)
- $\text{Bool} \to \text{Bool}$ (via $[\alpha \mapsto \text{Bool}]$)
- $(\beta \to \gamma) \to (\beta \to \gamma)$ (via $[\alpha \mapsto \beta \to \gamma]$)
- $\alpha \to \alpha$ (via $[\alpha \mapsto \alpha]$, the identity substitution on $\alpha$---but this $\alpha$ in the instance is a fresh copy)

**Definition 2.7 (Generalization).** Given a context $\Gamma$ and a monotype $\tau$, the generalization of $\tau$ with respect to $\Gamma$ is:

$$\text{Gen}(\Gamma, \tau) = \forall \alpha_1 \cdots \alpha_n.\; \tau$$

where $\{\alpha_1, \ldots, \alpha_n\} = \text{FTV}(\tau) \setminus \text{FTV}(\Gamma)$.

The variables that are generalized are exactly those that appear in $\tau$ but not in $\Gamma$. Variables that appear in $\Gamma$ are constrained by the surrounding context and must not be generalized.

**Example 2.8.** If $\Gamma = \{y : \beta\}$ and $\tau = \alpha \to \beta$, then:

$$\text{FTV}(\tau) \setminus \text{FTV}(\Gamma) = \{\alpha, \beta\} \setminus \{\beta\} = \{\alpha\}$$

$$\text{Gen}(\Gamma, \tau) = \forall \alpha.\; \alpha \to \beta$$

The variable $\beta$ is not generalized because it appears in the context (it is constrained by the type of $y$).

### 2.3 Type Contexts

**Definition 2.9 (Type Context in HM).** A type context $\Gamma$ maps term variables to type schemes:

$$\Gamma = x_1 : \sigma_1, \ldots, x_n : \sigma_n$$

We extend $\text{FTV}$ to contexts: $\text{FTV}(\Gamma) = \bigcup_{i} \text{FTV}(\sigma_i)$.

### 2.4 The Declarative Typing Rules

The HM type system is defined by the following rules. The judgment $\Gamma \vdash t : \tau$ asserts that term $t$ has monotype $\tau$ under context $\Gamma$.

$$\frac{(x : \sigma) \in \Gamma \quad \sigma \sqsupseteq \tau}{\Gamma \vdash x : \tau} \quad (\text{Var})$$

When we look up a variable in the context, we get a type scheme, which we instantiate to a monotype. Different occurrences of the same variable can instantiate the scheme differently.

$$\frac{\Gamma, x : \tau_1 \vdash t : \tau_2}{\Gamma \vdash \lambda x.\; t : \tau_1 \to \tau_2} \quad (\text{Abs})$$

Lambda-bound variables receive monotypes, not type schemes. This is the key restriction compared to System F.

$$\frac{\Gamma \vdash t_1 : \tau_1 \to \tau_2 \quad \Gamma \vdash t_2 : \tau_1}{\Gamma \vdash t_1\; t_2 : \tau_2} \quad (\text{App})$$

Standard function application.

$$\frac{\Gamma \vdash t_1 : \tau_1 \quad \Gamma, x : \text{Gen}(\Gamma, \tau_1) \vdash t_2 : \tau_2}{\Gamma \vdash \text{let}\; x = t_1\; \text{in}\; t_2 : \tau_2} \quad (\text{Let})$$

This is the crucial rule. The type $\tau_1$ of the definition $t_1$ is generalized (quantifying over variables not free in $\Gamma$), and the resulting type scheme is used for $x$ in the body $t_2$.

**Remark 2.10.** Some presentations include explicit $(\text{Gen})$ and $(\text{Inst})$ rules:

$$\frac{\Gamma \vdash t : \sigma \quad \alpha \notin \text{FTV}(\Gamma)}{\Gamma \vdash t : \forall \alpha.\; \sigma} \quad (\text{Gen})$$

$$\frac{\Gamma \vdash t : \forall \alpha.\; \sigma}{\Gamma \vdash t : [\alpha \mapsto \tau]\sigma} \quad (\text{Inst})$$

These are equivalent to the presentation above when generalization is restricted to let-bindings (the "syntax-directed" presentation we use is more amenable to algorithmic treatment).

### 2.5 Examples of HM Typing

**Example 2.11 (Polymorphic identity).** Type the term $\text{let}\; \text{id} = \lambda x.\; x\; \text{in}\; (\text{id}\; 3, \text{id}\; \text{true})$, assuming a product constructor and constants.

Step 1: Type $\lambda x.\; x$. Under $\Gamma, x : \alpha$, the body $x$ has type $\alpha$. So $\lambda x.\; x : \alpha \to \alpha$.

Step 2: Generalize $\alpha \to \alpha$ with respect to $\Gamma$. If $\alpha \notin \text{FTV}(\Gamma)$, we get $\text{Gen}(\Gamma, \alpha \to \alpha) = \forall \alpha.\; \alpha \to \alpha$.

Step 3: In the body, $\text{id} : \forall \alpha.\; \alpha \to \alpha$. For the first use $\text{id}\;3$: instantiate with $[\alpha \mapsto \text{Int}]$, so $\text{id} : \text{Int} \to \text{Int}$ and $\text{id}\;3 : \text{Int}$.

Step 4: For the second use $\text{id}\;\text{true}$: instantiate with $[\alpha \mapsto \text{Bool}]$, so $\text{id} : \text{Bool} \to \text{Bool}$ and $\text{id}\;\text{true} : \text{Bool}$.

Step 5: The pair has type $(\text{Int}, \text{Bool})$.

Without let-polymorphism, this would fail: $\alpha$ would be constrained to be both $\text{Int}$ and $\text{Bool}$.

**Example 2.12 (Polymorphic map).** Consider:

```
let map = \f. \xs. ... in
let ids = map id [1, 2, 3] in
let bools = map not [true, false] in
...
```

After typing the body of `map`, we get (assuming appropriate list operations):

$$\text{map} : \forall \alpha\; \beta.\; (\alpha \to \beta) \to \text{List}(\alpha) \to \text{List}(\beta)$$

The first use instantiates with $\alpha = \text{Int}, \beta = \text{Int}$; the second with $\alpha = \text{Bool}, \beta = \text{Bool}$.

**Example 2.13 (No polymorphism under lambda).** Consider:

```
\id. (id 3, id true)
```

Here `id` is lambda-bound, so it gets a monotype $\alpha$. From `id 3`, we get $\alpha = \text{Int} \to \beta_1$. From `id true`, we get $\alpha = \text{Bool} \to \beta_2$. Unifying $\text{Int} \to \beta_1$ and $\text{Bool} \to \beta_2$ fails (clash: $\text{Int} \neq \text{Bool}$). This term is **not typable** in HM.

This is the fundamental limitation of let-polymorphism: polymorphism is only available for let-bound variables, not lambda-bound ones.

### 2.6 Algorithm W

Algorithm W is the classic type inference algorithm for HM, due to Damas and Milner (1982). It takes a context and a term, and returns a substitution and a monotype.

**Algorithm 2.14 (Algorithm W).** The function $\mathcal{W}(\Gamma, t)$ returns a pair $(\sigma, \tau)$ or fails.

**Case** $t = x$:

If $(x : \sigma) \in \Gamma$, let $\forall \alpha_1 \cdots \alpha_n.\; \tau = \sigma$.

Let $\beta_1, \ldots, \beta_n$ be fresh type variables.

Return $(\text{id}, [\alpha_1 \mapsto \beta_1, \ldots, \alpha_n \mapsto \beta_n](\tau))$.

(Instantiate the type scheme with fresh variables.)

**Case** $t = \lambda x.\; t_1$:

Let $\beta$ be a fresh type variable.

Let $(\sigma_1, \tau_1) = \mathcal{W}(\Gamma \cup \{x : \beta\}, t_1)$.

Return $(\sigma_1, \sigma_1(\beta) \to \tau_1)$.

(The bound variable gets a fresh monotype; after inferring the body, the substitution may have constrained it.)

**Case** $t = t_1\; t_2$:

Let $(\sigma_1, \tau_1) = \mathcal{W}(\Gamma, t_1)$.

Let $(\sigma_2, \tau_2) = \mathcal{W}(\sigma_1(\Gamma), t_2)$.

Let $\beta$ be a fresh type variable.

Let $\sigma_3 = \text{unify}(\sigma_2(\tau_1), \tau_2 \to \beta)$.

Return $(\sigma_3 \circ \sigma_2 \circ \sigma_1, \sigma_3(\beta))$.

(Infer the function type and argument type separately, then unify the function type with an arrow from the argument type to a fresh result variable.)

**Case** $t = \text{let}\; x = t_1\; \text{in}\; t_2$:

Let $(\sigma_1, \tau_1) = \mathcal{W}(\Gamma, t_1)$.

Let $\sigma' = \text{Gen}(\sigma_1(\Gamma), \tau_1)$.

Let $(\sigma_2, \tau_2) = \mathcal{W}(\sigma_1(\Gamma) \cup \{x : \sigma'\}, t_2)$.

Return $(\sigma_2 \circ \sigma_1, \tau_2)$.

(Infer the type of the definition, generalize it, then infer the body with the generalized scheme.)

**Remark 2.15.** The threading of substitutions through subsequent computations is essential. After inferring the type of $t_1$, the substitution $\sigma_1$ may have constrained type variables in $\Gamma$, so we must apply $\sigma_1$ to $\Gamma$ before proceeding to $t_2$.

### 2.7 Detailed Trace of Algorithm W

**Example 2.16.** Trace $\mathcal{W}(\emptyset, \text{let}\; \text{id} = \lambda x.\; x\; \text{in}\; \text{id}\; \text{id})$.

**Step 1:** Type $t_1 = \lambda x.\; x$ under $\Gamma = \emptyset$.

$\mathcal{W}(\emptyset, \lambda x.\; x)$:
- Fresh $\beta_1$ for $x$.
- $\mathcal{W}(\{x : \beta_1\}, x) = (\text{id}, \beta_1)$.
- Return $(\text{id}, \beta_1 \to \beta_1)$.

So $\sigma_1 = \text{id}$, $\tau_1 = \beta_1 \to \beta_1$.

**Step 2:** Generalize. $\text{FTV}(\tau_1) \setminus \text{FTV}(\sigma_1(\emptyset)) = \{\beta_1\} \setminus \emptyset = \{\beta_1\}$.

$$\sigma' = \forall \beta_1.\; \beta_1 \to \beta_1$$

**Step 3:** Type $t_2 = \text{id}\; \text{id}$ under $\Gamma' = \{\text{id} : \forall \beta_1.\; \beta_1 \to \beta_1\}$.

$\mathcal{W}(\Gamma', \text{id}\; \text{id})$:

**Step 3a:** $\mathcal{W}(\Gamma', \text{id})$ (function position):
- Look up $\text{id} : \forall \beta_1.\; \beta_1 \to \beta_1$.
- Instantiate with fresh $\beta_2$: $\tau = \beta_2 \to \beta_2$.
- Return $(\text{id}, \beta_2 \to \beta_2)$.

$\sigma_{2a} = \text{id}$, $\tau_{2a} = \beta_2 \to \beta_2$.

**Step 3b:** $\mathcal{W}(\Gamma', \text{id})$ (argument position):
- Fresh $\beta_3$: $\tau = \beta_3 \to \beta_3$.
- Return $(\text{id}, \beta_3 \to \beta_3)$.

$\sigma_{2b} = \text{id}$, $\tau_{2b} = \beta_3 \to \beta_3$.

**Step 3c:** Unify $\beta_2 \to \beta_2$ with $(\beta_3 \to \beta_3) \to \beta_4$ (fresh $\beta_4$ for the result).

Decompose: $\beta_2 \doteq \beta_3 \to \beta_3$ and $\beta_2 \doteq \beta_4$.

From the first: $\sigma_3' = [\beta_2 \mapsto \beta_3 \to \beta_3]$.

Apply to second: $\beta_3 \to \beta_3 \doteq \beta_4$, so $\sigma_3'' = [\beta_4 \mapsto \beta_3 \to \beta_3]$.

$\sigma_3 = \sigma_3'' \circ \sigma_3' = [\beta_2 \mapsto \beta_3 \to \beta_3, \beta_4 \mapsto \beta_3 \to \beta_3]$.

Result type: $\sigma_3(\beta_4) = \beta_3 \to \beta_3$.

**Step 3 result:** $(\sigma_3, \beta_3 \to \beta_3)$.

**Final result:** $\mathcal{W}(\emptyset, \text{let}\; \text{id} = \lambda x.\; x\; \text{in}\; \text{id}\; \text{id}) = (\sigma_3 \circ \text{id}, \beta_3 \to \beta_3) = (\sigma_3, \beta_3 \to \beta_3)$.

The principal type is $\beta_3 \to \beta_3$, which (renaming) is $\alpha \to \alpha$. The application $\text{id}\; \text{id}$ returns the identity function---this makes sense.

**Example 2.17.** Trace $\mathcal{W}$ on $\text{let}\; f = \lambda x.\; x\; \text{in}\; (f\; 3, f\; \text{true})$.

After typing $\lambda x.\; x$: $\tau_1 = \beta_1 \to \beta_1$, generalized to $\forall \beta_1.\; \beta_1 \to \beta_1$.

In the body, the pair $(f\; 3, f\; \text{true})$:

- $f\;3$: instantiate $f$ with fresh $\beta_2$, get $f : \beta_2 \to \beta_2$. Unify $\beta_2$ with $\text{Int}$: $\sigma = [\beta_2 \mapsto \text{Int}]$. Result type: $\text{Int}$.
- $f\;\text{true}$: instantiate $f$ with fresh $\beta_3$, get $f : \beta_3 \to \beta_3$. Unify $\beta_3$ with $\text{Bool}$: $\sigma = [\beta_3 \mapsto \text{Bool}]$. Result type: $\text{Bool}$.

No conflict because $\beta_2$ and $\beta_3$ are independent instantiations of the scheme. The pair has type $(\text{Int}, \text{Bool})$.

### 2.8 Soundness of Algorithm W

**Theorem 2.18 (Soundness of Algorithm W).** If $\mathcal{W}(\Gamma, t) = (\sigma, \tau)$, then $\sigma(\Gamma) \vdash t : \tau$ in the declarative HM system.

*Proof.* By induction on the structure of $t$.

**Case** $t = x$: We have $(x : \forall \bar{\alpha}.\; \tau_0) \in \Gamma$ and $\tau = [\bar{\alpha} \mapsto \bar{\beta}](\tau_0)$ with $\bar{\beta}$ fresh. Then $\text{id}(\Gamma) = \Gamma$ and $\Gamma \vdash x : \tau$ by rule $(\text{Var})$ with the instantiation $[\bar{\alpha} \mapsto \bar{\beta}]$.

**Case** $t = \lambda x.\; t_1$: By the induction hypothesis, $\sigma_1(\Gamma \cup \{x : \beta\}) \vdash t_1 : \tau_1$, i.e., $\sigma_1(\Gamma), x : \sigma_1(\beta) \vdash t_1 : \tau_1$. By rule $(\text{Abs})$, $\sigma_1(\Gamma) \vdash \lambda x.\; t_1 : \sigma_1(\beta) \to \tau_1$.

**Case** $t = t_1\; t_2$: By the induction hypothesis applied to $t_1$: $\sigma_1(\Gamma) \vdash t_1 : \tau_1$. By the induction hypothesis applied to $t_2$: $\sigma_2(\sigma_1(\Gamma)) \vdash t_2 : \tau_2$. We can weaken the first judgment under substitution: $\sigma_2(\sigma_1(\Gamma)) \vdash t_1 : \sigma_2(\tau_1)$ (substitutions preserve typability). Now $\sigma_3$ unifies $\sigma_2(\tau_1)$ with $\tau_2 \to \beta$, so $\sigma_3(\sigma_2(\tau_1)) = \sigma_3(\tau_2 \to \beta) = \sigma_3(\tau_2) \to \sigma_3(\beta)$. Applying $\sigma_3$ to both judgments:

$$\sigma_3(\sigma_2(\sigma_1(\Gamma))) \vdash t_1 : \sigma_3(\tau_2) \to \sigma_3(\beta)$$

$$\sigma_3(\sigma_2(\sigma_1(\Gamma))) \vdash t_2 : \sigma_3(\tau_2)$$

By rule $(\text{App})$:

$$\sigma_3(\sigma_2(\sigma_1(\Gamma))) \vdash t_1\; t_2 : \sigma_3(\beta) \quad \square$$

**Case** $t = \text{let}\; x = t_1\; \text{in}\; t_2$: By the induction hypothesis on $t_1$: $\sigma_1(\Gamma) \vdash t_1 : \tau_1$. Let $\sigma' = \text{Gen}(\sigma_1(\Gamma), \tau_1)$. By the generalization property of the declarative system, $\sigma_1(\Gamma) \vdash t_1 : \sigma'$.

By the induction hypothesis on $t_2$: $\sigma_2(\sigma_1(\Gamma) \cup \{x : \sigma'\}) \vdash t_2 : \tau_2$. Since $\sigma_2$ may further constrain variables in $\sigma_1(\Gamma)$ but not the bound variables in $\sigma'$ (which are fresh), the generalization remains valid. By rule $(\text{Let})$:

$$\sigma_2(\sigma_1(\Gamma)) \vdash \text{let}\; x = t_1\; \text{in}\; t_2 : \tau_2 \quad \square$$

### 2.9 Completeness of Algorithm W

**Theorem 2.19 (Completeness of Algorithm W / Principal Type Property).** If $\sigma'(\Gamma) \vdash t : \tau'$ in the declarative HM system, then $\mathcal{W}(\Gamma, t)$ succeeds with some $(\sigma, \tau)$, and there exists a substitution $\delta$ such that:

1. $\sigma' = \delta \circ \sigma$ (on $\text{FTV}(\Gamma)$)
2. $\tau' = \delta(\tau)$

*Proof.* By induction on the derivation of $\sigma'(\Gamma) \vdash t : \tau'$. The proof is technically involved; we sketch the key cases.

**Case** $t = x$: If $\sigma'(\Gamma) \vdash x : \tau'$ by rule $(\text{Var})$, then $(x : \sigma_0) \in \Gamma$ and $\sigma'(\sigma_0) \sqsupseteq \tau'$. Algorithm W instantiates $\sigma_0$ with fresh variables $\bar{\beta}$, producing $\tau = [\bar{\alpha} \mapsto \bar{\beta}](\tau_0)$ where $\sigma_0 = \forall \bar{\alpha}.\; \tau_0$. Since $\tau'$ is an instance of $\sigma'(\sigma_0)$, there exists $\delta$ mapping $\bar{\beta}$ (and variables in $\sigma'$) such that $\delta(\tau) = \tau'$.

**Case** $t = t_1\; t_2$: By the induction hypothesis, $\mathcal{W}$ succeeds on $t_1$ and $t_2$, producing principal solutions. Since $\sigma'$ unifies the function type with the argument type (the declarative derivation requires $\tau_1 = \tau_2 \to \tau'$), and $\sigma_3 = \text{mgu}$ of the corresponding constraint, the MGU property ensures that $\sigma'$ factors through $\sigma_3$.

**Case** $t = \text{let}\; x = t_1\; \text{in}\; t_2$: By the induction hypothesis, $\mathcal{W}$ succeeds on $t_1$, giving a principal type $\tau_1$. Generalization produces a type scheme $\sigma'_x = \text{Gen}(\sigma_1(\Gamma), \tau_1)$. Since $\tau_1$ is principal, any type derivable for $t_1$ is an instance of $\tau_1$, so any scheme assigned to $x$ in a valid derivation is an instance of $\sigma'_x$. By the induction hypothesis on $t_2$, $\mathcal{W}$ succeeds and produces a principal type. $\square$

The complete proof is in Damas and Milner (1982) and in Pierce (2002), Chapter 22.

### 2.10 The Value Restriction

In the pure lambda calculus, unrestricted generalization at let-bindings is sound. But in the presence of side effects---particularly mutable references---it leads to unsoundness.

**Example 2.20 (Unsoundness without value restriction).** Consider (in ML-like syntax):

```
let r = ref [] in
let _ = r := [1] in
let x = hd (!r) in
x + "hello"
```

Without the value restriction, `ref []` would be typed as follows:
- `ref [] : ref (List alpha)` for a fresh $\alpha$.
- Generalize: `r : forall alpha. ref (List alpha)`.
- First use: instantiate $\alpha = \text{Int}$, so `r : ref (List Int)`. Store `[1]`.
- Second use: instantiate $\alpha = \text{String}$, so `r : ref (List String)`. Read `[1]` as `["hello"]`.
- Type safety violated at runtime.

The problem is that `ref []` is not a value---it is a computation that allocates a new reference cell. Generalizing the type of a computation that performs side effects is unsound because different instantiations can interact through shared state.

**Definition 2.21 (Value Restriction).** In the value-restricted HM system, generalization in the $(\text{Let})$ rule is restricted:

$$\frac{\Gamma \vdash v : \tau_1 \quad \Gamma, x : \text{Gen}(\Gamma, \tau_1) \vdash t_2 : \tau_2}{\Gamma \vdash \text{let}\; x = v\; \text{in}\; t_2 : \tau_2} \quad (\text{Let-Val})$$

where $v$ is a syntactic value (variable, lambda abstraction, or constructor application to values).

$$\frac{\Gamma \vdash t_1 : \tau_1 \quad t_1 \text{ is not a value} \quad \Gamma, x : \tau_1 \vdash t_2 : \tau_2}{\Gamma \vdash \text{let}\; x = t_1\; \text{in}\; t_2 : \tau_2} \quad (\text{Let-Mono})$$

When $t_1$ is not a syntactic value, its type is not generalized.

**Remark 2.22.** The value restriction was introduced by Wright (1995). It is conservative: some safe programs are rejected. For example:

```
let f = List.map (fun x -> x) in ...
```

Here `List.map (fun x -> x)` is not a syntactic value (it is an application), so `f` gets a monomorphic type, even though the expression is semantically pure. A workaround is eta-expansion:

```
let f = fun xs -> List.map (fun x -> x) xs in ...
```

Now `f` is a lambda abstraction (a value), so its type can be generalized.

**Alternative: The Relaxed Value Restriction.** Garrigue (2004) introduced a relaxed value restriction for OCaml that allows generalization of "positive" (covariant) type variables even in non-value expressions. This recovers some lost polymorphism while maintaining soundness.

### 2.11 Recursive Definitions

In practice, most languages allow recursive let-bindings:

```
let rec f = \x. ... f ... in ...
```

Algorithm W handles recursive definitions by:

1. Introducing a fresh type variable $\beta$ for $f$.
2. Typing the body $\lambda x.\; \ldots f \ldots$ under $\Gamma \cup \{f : \beta\}$.
3. Unifying the resulting type with $\beta$.
4. Generalizing the unified type.

**Algorithm 2.23 (Algorithm W for letrec).**

**Case** $t = \text{let rec}\; f = t_1\; \text{in}\; t_2$:

Let $\beta$ be a fresh type variable.

Let $(\sigma_1, \tau_1) = \mathcal{W}(\Gamma \cup \{f : \beta\}, t_1)$.

Let $\sigma_2 = \text{unify}(\sigma_1(\beta), \tau_1)$.

Let $\tau_f = \sigma_2(\tau_1)$.

Let $\sigma_f = \text{Gen}(\sigma_2(\sigma_1(\Gamma)), \tau_f)$.

Let $(\sigma_3, \tau_2) = \mathcal{W}(\sigma_2(\sigma_1(\Gamma)) \cup \{f : \sigma_f\}, t_2)$.

Return $(\sigma_3 \circ \sigma_2 \circ \sigma_1, \tau_2)$.

**Example 2.24.** Type `let rec length = \xs. match xs with [] -> 0 | _::tl -> 1 + length tl`.

Introduce $\beta$ for `length`. The body is a function $\lambda \text{xs}.\; \ldots$. After inference (assuming match and list operations are primitive), we get $\tau_1 = \text{List}(\alpha) \to \text{Int}$. Unify $\beta$ with $\text{List}(\alpha) \to \text{Int}$. Generalize: $\text{length} : \forall \alpha.\; \text{List}(\alpha) \to \text{Int}$.

### 2.12 Polymorphic Recursion

Standard HM recursive definitions are monomorphically recursive: within the body of `let rec f = ...`, the variable `f` has a monotype, not a type scheme. This means `f` cannot be used at different types within its own definition.

**Example 2.25 (Polymorphic recursion).** Consider:

```
let rec f x = if x = 0 then [] else (f (x-1)) :: (f true) :: []
```

This requires `f` to be used at type $\text{Int} \to \text{List}(\ldots)$ and $\text{Bool} \to \text{List}(\ldots)$ within its own body. HM cannot type this.

**Theorem 2.26 (Undecidability of Polymorphic Recursion).** Type inference for a system with polymorphic recursion (where the recursive binding has a type scheme rather than a monotype within its own body) is undecidable (Henglein 1993, Kfoury et al. 1993).

In practice, languages that support polymorphic recursion (e.g., Haskell with explicit type signatures on recursive functions) require the programmer to supply a type annotation on the recursive binding.

### 2.13 HM as a Fragment of System F

**Definition 2.27 (System F, preview).** System F (the polymorphic lambda calculus, Girard 1972, Reynolds 1974) extends the STLC with universal types:

$$T ::= \alpha \mid T_1 \to T_2 \mid \forall \alpha.\; T$$

$$t ::= x \mid \lambda x : T.\; t \mid t_1\; t_2 \mid \Lambda \alpha.\; t \mid t\; [T]$$

The terms include type abstraction $\Lambda \alpha.\; t$ and type application $t\; [T]$.

**Theorem 2.28.** Every HM typing derivation can be elaborated into a System F typing derivation. Specifically, if $\Gamma \vdash_{\text{HM}} t : \tau$, then there exists a System F term $t'$ (obtained by inserting type abstractions at let-bindings and type applications at variable uses) such that $|\Gamma| \vdash_{\text{F}} t' : \tau$, where $|\Gamma|$ erases the $\forall$-quantifiers in type schemes.

*Proof sketch.* The $(\text{Let})$ rule with generalization corresponds to introducing type abstractions; instantiation at variable lookup corresponds to type application. The restriction to let-polymorphism ensures that type abstractions and applications are in "prenex" form: type abstractions appear only at the top level of let-definitions, and type applications appear only at variable use sites. $\square$

**Theorem 2.29 (Undecidability of System F Type Inference, Wells 1999).** Type inference (and even type checking with partial annotations) for System F is undecidable.

This motivates the restriction to let-polymorphism: HM sacrifices the ability to pass polymorphic functions as arguments (rank-2 and higher polymorphism) in exchange for decidable type inference.

### 2.14 Detailed Trace: Polymorphic Map

Let us trace Algorithm W on a more substantial example to solidify understanding.

**Example 2.32.** Consider the term (using informal pattern matching and list syntax for clarity):

```
let rec map = \f. \xs.
  if null xs then nil
  else cons (f (hd xs)) (map f (tl xs))
in map
```

We model this with built-in functions: $\text{null} : \forall \alpha.\; \text{List}(\alpha) \to \text{Bool}$, $\text{nil} : \forall \alpha.\; \text{List}(\alpha)$, $\text{cons} : \forall \alpha.\; \alpha \to \text{List}(\alpha) \to \text{List}(\alpha)$, $\text{hd} : \forall \alpha.\; \text{List}(\alpha) \to \alpha$, $\text{tl} : \forall \alpha.\; \text{List}(\alpha) \to \text{List}(\alpha)$.

Step 1: Introduce $\beta_0$ for `map` (recursive binding).

Step 2: Infer type of the body $\lambda f.\; \lambda \text{xs}.\; \ldots$ under $\Gamma \cup \{\text{map} : \beta_0\}$.

- Introduce $\beta_1$ for $f$, $\beta_2$ for $\text{xs}$.

Step 3: Infer the if-then-else body.

- Condition: `null xs`. Instantiate $\text{null}$ with fresh $\beta_3$: $\text{null} : \text{List}(\beta_3) \to \text{Bool}$. Apply to $\text{xs} : \beta_2$. Unify $\text{List}(\beta_3) = \beta_2$, so $\sigma_1 = [\beta_2 \mapsto \text{List}(\beta_3)]$. Result type: $\text{Bool}$. Condition check: already Bool.

- Then-branch: `nil`. Instantiate with fresh $\beta_4$: $\text{nil} : \text{List}(\beta_4)$.

- Else-branch (under $\sigma_1$):
  - `hd xs`: instantiate with fresh $\beta_5$, $\text{hd} : \text{List}(\beta_5) \to \beta_5$. Apply to $\text{xs} : \text{List}(\beta_3)$. Unify $\text{List}(\beta_5) = \text{List}(\beta_3)$, so $\beta_5 = \beta_3$. Result: $\beta_3$.
  - `f (hd xs)`: apply $f : \beta_1$ to $\beta_3$. Introduce fresh $\beta_6$. Unify $\beta_1 = \beta_3 \to \beta_6$. Result: $\beta_6$.
  - `tl xs`: instantiate with fresh $\beta_7$, $\text{tl} : \text{List}(\beta_7) \to \text{List}(\beta_7)$. Unify $\text{List}(\beta_7) = \text{List}(\beta_3)$, so $\beta_7 = \beta_3$. Result: $\text{List}(\beta_3)$.
  - `map f (tl xs)`: apply $\text{map} : \beta_0$ to $f : \beta_3 \to \beta_6$. Introduce fresh $\beta_8$. Unify $\beta_0 = (\beta_3 \to \beta_6) \to \beta_8$. Then apply result to $\text{tl}(\text{xs}) : \text{List}(\beta_3)$. Introduce fresh $\beta_9$. Unify $\beta_8 = \text{List}(\beta_3) \to \beta_9$. Result: $\beta_9$.
  - `cons (f (hd xs)) (map f (tl xs))`: instantiate $\text{cons}$ with fresh $\beta_{10}$. Apply to $\beta_6$ and $\beta_9$. Unify $\beta_{10} = \beta_6$. Unify $\text{List}(\beta_6) = \beta_9$. So $\beta_9 = \text{List}(\beta_6)$. Result: $\text{List}(\beta_6)$.

- Unify then and else branches: $\text{List}(\beta_4) = \text{List}(\beta_6)$, so $\beta_4 = \beta_6$.

Step 4: Unify $\beta_0$ with the inferred function type. We had $\beta_0 = (\beta_3 \to \beta_6) \to \text{List}(\beta_3) \to \text{List}(\beta_6)$. Check against our earlier constraint $\beta_0 = (\beta_3 \to \beta_6) \to \beta_8$ and $\beta_8 = \text{List}(\beta_3) \to \beta_9$ and $\beta_9 = \text{List}(\beta_6)$: consistent.

Step 5: Generalize. The principal type of `map` is:

$$\forall \beta_3\; \beta_6.\; (\beta_3 \to \beta_6) \to \text{List}(\beta_3) \to \text{List}(\beta_6)$$

Renaming: $\forall \alpha\; \beta.\; (\alpha \to \beta) \to \text{List}(\alpha) \to \text{List}(\beta)$.

This is the standard type of `map`, confirming that Algorithm W correctly handles recursive polymorphic functions.

### 2.15 Algorithm J: An Optimized Variant

**Algorithm 2.33 (Algorithm J).** Algorithm J is a variant of Algorithm W that avoids explicit substitution threading by using mutable references for type variables. Instead of returning a substitution and composing it with subsequent results, Algorithm J performs unification in place, modifying type variables via side effects.

The key idea:
- Type variables are represented as mutable cells (references).
- When a type variable $\alpha$ is unified with a type $T$, the cell for $\alpha$ is updated to point to $T$.
- Looking up the current type of a variable follows the chain of references (with optional path compression).

Algorithm J produces the same results as Algorithm W but is more efficient in practice because it avoids the cost of explicit substitution composition. The trade-off is that the implementation is imperative (uses mutable state) and the correctness argument is more subtle.

**Remark 2.34.** Most production implementations of HM type inference (in OCaml, GHC, etc.) use an Algorithm J-like approach with union-find data structures, rather than the pure functional Algorithm W. The theoretical analysis, however, is typically done in terms of Algorithm W, which is easier to reason about.

### 2.16 Algorithm M: Checking Mode

**Algorithm 2.35 (Algorithm M, Lee and Yi 1998).** Algorithm M is a "top-down" variant that works in checking mode rather than synthesis mode. It takes an expected type as input (in addition to the context and term) and checks whether the term can have that type.

The advantage of Algorithm M is that it propagates type information from the outside in, which can provide better error messages. When a type error occurs, Algorithm M can report the error in terms of the programmer's expectations (the expected type) rather than in terms of the inferred type, which may be difficult to interpret.

**Comparison:**
- **Algorithm W:** bottom-up. Infers the most general type, then checks compatibility.
- **Algorithm M:** top-down. Takes an expected type, pushes it into subterms.
- **Bidirectional (Lecture 05d):** combines both directions, switching between synthesis and checking.

### 2.17 Type Inference with Mutual Recursion

Mutually recursive definitions require a generalization of the `let rec` case.

**Definition 2.36 (Mutual let-rec).** A mutual recursive binding has the form:

$$\text{let rec}\; f_1 = t_1\; \text{and}\; f_2 = t_2\; \text{and}\; \ldots\; \text{and}\; f_n = t_n\; \text{in}\; t$$

**Algorithm 2.37 (Algorithm W for Mutual Recursion).**

1. Introduce fresh type variables $\beta_1, \ldots, \beta_n$ for $f_1, \ldots, f_n$.
2. Extend the context: $\Gamma' = \Gamma \cup \{f_1 : \beta_1, \ldots, f_n : \beta_n\}$.
3. For each $i$, infer $(\sigma_i, \tau_i) = \mathcal{W}(\Gamma', t_i)$, threading substitutions.
4. For each $i$, unify $\sigma(\beta_i)$ with $\tau_i$ (where $\sigma$ is the accumulated substitution).
5. Generalize all types simultaneously: $\sigma_i' = \text{Gen}(\sigma(\Gamma), \sigma(\tau_i))$.
6. Extend the context with the generalized types and infer $t$.

The simultaneous generalization in step 5 is important: all mutually recursive functions are generalized together, at the same level.

**Remark 2.38.** Some languages (e.g., OCaml) perform a more refined analysis using **strongly connected components** of the call graph. Functions that are not mutually recursive are generalized independently, allowing earlier functions to be polymorphic when used by later ones.

### 2.18 Let-Bound vs. Lambda-Bound: The Deep Reason

The asymmetry between let-bound and lambda-bound variables in HM is often presented as a pragmatic design choice, but it has a deeper theoretical justification.

**Theorem 2.39 (Semantic Justification of Let-Polymorphism).** In a call-by-value semantics, $\text{let}\; x = v\; \text{in}\; t$ is semantically equivalent to $(\lambda x.\; t)\; v$ when $v$ is a value. However, the typing rules differ:

- In $(\lambda x.\; t)\; v$: $x$ receives a monotype, which must be compatible with all uses of $x$ in $t$.
- In $\text{let}\; x = v\; \text{in}\; t$: $x$ can be used polymorphically, because the typing rule implicitly "copies" $v$ to each use site, and each copy can be independently typed.

The let-typing rule is sound because let-expansion is semantics-preserving for values:

$$\text{let}\; x = v\; \text{in}\; t \equiv t[v/x]$$

Each copy of $v$ in $t[v/x]$ can be independently typed, giving it a different type at each use site. This is equivalent to instantiating a type scheme differently at each use.

**Remark 2.40.** This justification breaks down for effectful computations, which is why the value restriction (Section 2.10) is needed: $\text{let}\; x = t\; \text{in}\; e$ is NOT equivalent to $e[t/x]$ when $t$ has side effects (because the effects would be duplicated). Therefore, generalizing the type of a non-value $t$ is unsound.

### 2.19 Formal Syntax and Semantics of HM

For completeness, let us present the full formal syntax and operational semantics of the HM language.

**Definition 2.41 (HM Syntax).**

$$t ::= x \mid \lambda x.\; t \mid t_1\; t_2 \mid \text{let}\; x = t_1\; \text{in}\; t_2 \mid c$$

where $c$ ranges over constants (integer literals, boolean literals, primitive operations).

$$v ::= \lambda x.\; t \mid c$$

Values are lambda abstractions and constants.

**Definition 2.42 (Call-by-Value Reduction).**

$$\frac{}{(\lambda x.\; t)\; v \to t[v/x]} \quad (\beta_v)$$

$$\frac{}{E[\text{let}\; x = v\; \text{in}\; t] \to E[t[v/x]]} \quad (\text{Let})$$

$$\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad (\text{App-L})$$

$$\frac{t_2 \to t_2'}{v_1\; t_2 \to v_1\; t_2'} \quad (\text{App-R})$$

**Theorem 2.43 (Type Safety for HM).** If $\emptyset \vdash t : \tau$ and $t \to^* t'$, then either $t'$ is a value or there exists $t''$ with $t' \to t''$.

This is the standard progress + preservation argument. Type inference preserving the type safety property is essential: inferred types must be sound with respect to the operational semantics.

### 2.20 Extensions of HM

The basic HM system has been extended in many directions:

**Type classes (Wadler and Blott 1989).** Haskell's type classes add qualified types $C(\alpha) \Rightarrow \tau$ that constrain type variables to belong to certain classes. Type inference extends Algorithm W with an additional constraint-solving phase for class predicates.

**Rank-2 polymorphism.** Kfoury and Wells (1999) showed that type inference for rank-2 polymorphism (where function arguments can have polymorphic types, but not nested further) is decidable, extending HM's expressiveness without losing decidability.

**GADTs (Generalized Algebraic Data Types).** GADTs allow constructors to refine the type they construct. Type inference for GADTs is incomplete in general, requiring annotations at GADT pattern matches.

**Higher-rank polymorphism (Peyton Jones et al. 2007).** GHC extends HM with higher-rank polymorphism, using bidirectional type checking and requiring annotations at higher-rank positions.

### 2.15 Complexity of Algorithm W

**Theorem 2.30 (DEXPTIME-completeness of HM type inference).** HM type inference is DEXPTIME-complete (Mairson 1990).

*Proof sketch of hardness.* Mairson showed that the size of the principal type of certain HM terms can be exponential in the size of the term. For example:

```
let x1 = \a. (a, a) in
let x2 = \a. x1 (x1 a) in
let x3 = \a. x2 (x2 a) in
...
let xn = \a. x_{n-1} (x_{n-1} a) in
xn (\x. x)
```

The type of $x_k$ has size $\Theta(2^{2^k})$ (doubly exponential growth in the nesting depth). Writing down the principal type takes exponential space, so the algorithm requires at least exponential time.

*Proof sketch of membership.* The substitution computed by Algorithm W can be represented in polynomial space using DAG sharing. Each step (unification, generalization) takes time polynomial in the size of the DAG. The total number of steps is bounded by the term size. With careful sharing, the algorithm runs in single exponential time. $\square$

**Remark 2.31.** In practice, the exponential worst case is never encountered. Typical programs have types of size polynomial (usually linear) in the program size. The theoretical worst case is a curiosity, not a practical concern.

### 2.22 The Damas--Milner System: Formal Rules Revisited

For reference, let us present the complete set of typing rules for the Damas--Milner system in the syntax-directed formulation, which is the version directly implemented by Algorithm W.

**Definition 2.44 (Syntax-Directed HM Rules).**

$$\frac{(x : \sigma) \in \Gamma \quad \sigma \sqsupseteq \tau}{\Gamma \vdash x : \tau} \quad (\text{Var})$$

$$\frac{\Gamma, x : \tau_1 \vdash t : \tau_2}{\Gamma \vdash \lambda x.\; t : \tau_1 \to \tau_2} \quad (\text{Abs})$$

$$\frac{\Gamma \vdash t_1 : \tau_1 \to \tau_2 \quad \Gamma \vdash t_2 : \tau_1}{\Gamma \vdash t_1\; t_2 : \tau_2} \quad (\text{App})$$

$$\frac{\Gamma \vdash t_1 : \tau_1 \quad \Gamma, x : \text{Gen}(\Gamma, \tau_1) \vdash t_2 : \tau_2}{\Gamma \vdash \text{let}\; x = t_1\; \text{in}\; t_2 : \tau_2} \quad (\text{Let})$$

These rules are syntax-directed: at most one rule applies to each term form. This makes them directly amenable to algorithmic implementation (unlike the non-syntax-directed rules with explicit $\text{Gen}$ and $\text{Inst}$, where the choice of when to generalize or instantiate is non-deterministic).

### 2.23 Why Let-Polymorphism is Not Rank-1 Polymorphism

A common misconception is that HM's let-polymorphism is "rank-1 polymorphism." While related, these are distinct concepts.

**Definition 2.45 (Rank of a Type).** The rank of a type is defined as:

$$\text{rank}(\alpha) = 0$$

$$\text{rank}(\tau_1 \to \tau_2) = \max(\text{rank}(\tau_1) + 1_{\text{if } \tau_1 \text{ is polymorphic}}, \text{rank}(\tau_2))$$

Informally:
- **Rank 0:** monomorphic types.
- **Rank 1:** types where $\forall$ appears only at the outermost level. E.g., $\forall \alpha.\; \alpha \to \alpha$.
- **Rank 2:** types where $\forall$ may appear on the left of one arrow. E.g., $(\forall \alpha.\; \alpha \to \alpha) \to \text{Int}$.
- **Rank $k$:** $\forall$ may appear nested $k$ levels deep on the left side of arrows.

HM allows rank-1 type schemes in the type context (let-bound variables have polymorphic types), but function arguments always have monomorphic types (lambda-bound variables). This means:

- You CAN write: `let id = \x. x in (id 3, id true)` --- `id` has the rank-1 scheme $\forall \alpha.\; \alpha \to \alpha$.
- You CANNOT write: `\id. (id 3, id true)` --- `id` would need the rank-2 type $(\forall \alpha.\; \alpha \to \alpha)$ as a function parameter.

**Theorem 2.46 (Kfoury and Wells 1999).** Type inference for rank-2 polymorphism is decidable. Type inference for rank-$k$ with $k \geq 3$ is undecidable.

### 2.24 Type Inference and Parametricity

**Definition 2.47 (Parametricity, informal).** A polymorphic function is parametric if it behaves uniformly across all type instantiations. Formally, parametricity is captured by the abstraction theorem (Reynolds 1983): polymorphic functions commute with type-respecting mappings.

In the HM system, all polymorphism is parametric (as in System F). This has powerful consequences:

- The only function of type $\forall \alpha.\; \alpha \to \alpha$ is the identity.
- The only functions of type $\forall \alpha \beta.\; \alpha \to \beta \to \alpha$ are the constant function and its variants.
- The type $\forall \alpha.\; \alpha \to \alpha \to \alpha$ has exactly two inhabitants (the two projections), up to observational equivalence.

Parametricity constrains what functions can do: a function cannot inspect the type of its polymorphic arguments (there is no `typeOf` or `instanceof`). This is essential for type soundness and for reasoning about program behavior.

### 2.25 Algorithm W in Pseudocode (Recap)

For easy reference, we consolidate the complete Algorithm W pseudocode here.

**Input:** A context $\Gamma$ and a term $t$.

**Output:** A pair $(\sigma, \tau)$ where $\sigma$ is a substitution and $\tau$ is a monotype, or failure.

```
W(Gamma, x):
    let Forall(alphas, tau0) = lookup(x, Gamma)
    let betas = fresh variables, one per alpha
    return (id, [alphas -> betas](tau0))

W(Gamma, \x. t1):
    let beta = fresh variable
    let (s1, tau1) = W(Gamma + {x : beta}, t1)
    return (s1, s1(beta) -> tau1)

W(Gamma, t1 t2):
    let (s1, tau1) = W(Gamma, t1)
    let (s2, tau2) = W(s1(Gamma), t2)
    let beta = fresh variable
    let s3 = unify(s2(tau1), tau2 -> beta)
    return (s3 . s2 . s1, s3(beta))

W(Gamma, let x = t1 in t2):
    let (s1, tau1) = W(Gamma, t1)
    let sigma = Gen(s1(Gamma), tau1)
    let (s2, tau2) = W(s1(Gamma) + {x : sigma}, t2)
    return (s2 . s1, tau2)

W(Gamma, let rec f = t1 in t2):
    let beta = fresh variable
    let (s1, tau1) = W(Gamma + {f : beta}, t1)
    let s2 = unify(s1(beta), tau1)
    let tau_f = s2(tau1)
    let sigma = Gen(s2(s1(Gamma)), tau_f)
    let (s3, tau2) = W(s2(s1(Gamma)) + {f : sigma}, t2)
    return (s3 . s2 . s1, tau2)
```

### 2.26 Exercises

**Exercise 2.48.** Trace Algorithm W on the term $\lambda x.\; \lambda y.\; \lambda z.\; x\;z\;(y\;z)$ (the S combinator). Show all steps: fresh variables, recursive calls, unifications, and compositions. Verify that the principal type is $(\alpha \to \beta \to \gamma) \to (\alpha \to \beta) \to \alpha \to \gamma$.

**Exercise 2.49.** Consider the term:

$$\text{let}\; f = \lambda x.\; x\; \text{in}\; \text{let}\; g = \lambda y.\; f\;(f\;y)\; \text{in}\; g$$

Trace Algorithm W. What is the type of $g$? Is $g$'s type more or less general than $f$'s type?

**Exercise 2.50.** Show that the term $(\lambda x.\; \text{let}\; y = x\; \text{in}\; y\;y)$ is not typable in HM. Identify the exact step where Algorithm W fails.

*Hint:* The variable $x$ is lambda-bound, so $y = x$ receives a monomorphic type. Then $y\;y$ requires a self-application, which fails the occurs check.

**Exercise 2.51.** Prove directly (without using Damas and Milner's theorem) that Algorithm W is sound for the $(\text{Abs})$ case: if $\mathcal{W}(\Gamma, \lambda x.\; t_1) = (\sigma_1, \sigma_1(\beta) \to \tau_1)$, then $\sigma_1(\Gamma) \vdash \lambda x.\; t_1 : \sigma_1(\beta) \to \tau_1$.

**Exercise 2.52.** The Church encoding of pairs in the untyped lambda calculus is:

$$\text{pair} = \lambda a.\; \lambda b.\; \lambda f.\; f\;a\;b$$

$$\text{fst} = \lambda p.\; p\;(\lambda a.\; \lambda b.\; a)$$

$$\text{snd} = \lambda p.\; p\;(\lambda a.\; \lambda b.\; b)$$

Can all three of these be typed in HM? If so, give their principal types. If not, explain which ones fail and why.

**Exercise 2.53.** Consider adding recursive types to HM (i.e., removing the occurs check). What terms become typable that were previously untypable? Give two examples. Discuss the implications for type safety.

**Exercise 2.54.** Prove that in the HM system, if $\Gamma \vdash t : \tau$ and $\sigma$ is a type substitution that does not affect the variables in $\text{FTV}(\Gamma)$, then $\Gamma \vdash t : \sigma(\tau)$. This is a form of the "type instantiation" property that holds for HM but not for all type systems.

**Exercise 2.55.** The Mairson (1990) construction shows that HM type inference is DEXPTIME-complete. The key is the term:

$$\text{let}\; x_1 = \lambda a.\; (a, a)\; \text{in}\; \text{let}\; x_2 = \lambda a.\; x_1\;(x_1\;a)\; \text{in}\; \ldots$$

Compute the type of $x_1$, $x_2$, and $x_3$ explicitly. How does the type size grow? Express the size of the type of $x_n$ as a function of $n$.

---

## Summary

1. **Hindley--Milner** extends the STLC with let-polymorphism: let-bound variables receive type schemes, while lambda-bound variables receive monotypes. This allows the same function to be used at different types in different contexts.

2. **Type schemes** $\forall \bar{\alpha}.\; \tau$ generalize monotypes by quantifying over type variables not free in the context. Instantiation produces specific monotypes from schemes.

3. **Algorithm W** is the standard inference algorithm. It threads substitutions through the term, introduces fresh type variables, unifies at application sites, and generalizes at let-bindings.

4. **Soundness:** if Algorithm W succeeds, the result is a valid HM typing.

5. **Completeness:** if a typing exists, Algorithm W finds a principal one---the most general typing from which all others can be obtained by instantiation.

6. **The value restriction** prevents unsound generalization of effectful computations. Only syntactic values may have their types generalized.

7. **HM is a decidable fragment of System F.** Full System F type inference is undecidable, but restricting polymorphism to let-bindings recovers decidability.

8. **Complexity:** HM type inference is DEXPTIME-complete in theory, but fast in practice.

---

## Further Reading

- Milner, R. (1978). "A theory of type polymorphism in programming." *Journal of Computer and System Sciences*, 17(3), 348--375. The original ML type inference paper.

- Damas, L. and Milner, R. (1982). "Principal type-schemes for functional programs." *Proceedings of POPL*, 207--212. The formal soundness and completeness proof.

- Hindley, J. R. (1969). "The principal type-scheme of an object in combinatory logic." *Transactions of the American Mathematical Society*, 146, 29--60. The foundational result on principal types.

- Pierce, B. C. (2002). *Types and Programming Languages*, Chapter 22. Clear textbook treatment.

- Wright, A. K. (1995). "Simple imperative polymorphism." *Lisp and Symbolic Computation*, 8(4), 343--355. The value restriction.

- Garrigue, J. (2004). "Relaxing the value restriction." *Proceedings of FLOPS*, 196--213. The relaxed value restriction for OCaml.

- Wells, J. B. (1999). "Typability and type checking in System F are equivalent and undecidable." *Annals of Pure and Applied Logic*, 98(1--3), 111--156.

- Mairson, H. G. (1990). "Deciding ML typability is complete for deterministic exponential time." *Proceedings of POPL*, 382--401. The DEXPTIME-completeness result.

- Henglein, F. (1993). "Type inference with polymorphic recursion." *ACM Transactions on Programming Languages and Systems*, 15(2), 253--289. Undecidability of polymorphic recursion.

- Wadler, P. and Blott, S. (1989). "How to make ad-hoc polymorphism less ad hoc." *Proceedings of POPL*, 60--76. Type classes.

- Peyton Jones, S., Vytiniotis, D., Weirich, S., and Shields, M. (2007). "Practical type inference for arbitrary-rank types." *Journal of Functional Programming*, 17(1), 1--82.

- Kfoury, A. J. and Wells, J. B. (1999). "Principality and decidable type inference for finite-rank intersection types." *Proceedings of POPL*, 161--174.
