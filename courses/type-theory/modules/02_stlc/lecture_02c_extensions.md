---
title: "Lecture 02c: Extensions --- Products, Sums, Unit, Void"
tags:
  - type-theory
  - stlc
  - lecture
---
# Lecture 02c: Extensions --- Products, Sums, Unit, Void

> **Module 02 --- Simply Typed Lambda Calculus (Weeks 3-4)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define product types with their typing rules, evaluation rules, and prove progress and preservation for the extended system.
2. Define sum types with their typing rules, evaluation rules, and prove progress and preservation for the extended system.
3. Define the Unit type and the Void type, state their typing rules, and explain their roles as the trivial and empty types.
4. Define let-bindings and ascription as syntactic sugar and derived forms.
5. Define general records and variants as generalizations of products and sums.
6. Explain the categorical interpretation of products, sums, Unit, and Void.
7. Extend the substitution lemma to cover all new constructs.

---

## 1. Motivation

The simply typed lambda calculus with booleans and natural numbers (Lectures 02a-02b) is a useful starting point, but it lacks fundamental data structures. In this lecture, we extend STLC with:

- **Product types** ($T_1 \times T_2$): pairs that bundle two values together.
- **Sum types** ($T_1 + T_2$): tagged unions that represent a choice between two alternatives.
- **Unit type**: the trivial type with exactly one value.
- **Void type**: the empty type with no values.

These extensions are interesting both practically (they correspond to fundamental data structures in programming) and theoretically (they correspond to logical connectives under the Curry-Howard correspondence, as discussed in Lecture 02d).

### 1.1 The Bigger Picture

| Type Constructor | Data Structure | Logic | Category Theory |
|-----------------|---------------|-------|----------------|
| $T_1 \to T_2$ | Function | Implication $\implies$ | Exponential |
| $T_1 \times T_2$ | Pair / struct | Conjunction $\land$ | Product |
| $T_1 + T_2$ | Tagged union / variant | Disjunction $\lor$ | Coproduct |
| $\text{Unit}$ | Void / null (in C) | Truth $\top$ | Terminal object |
| $\text{Void}$ | Empty / never type | Falsity $\bot$ | Initial object |

Together with the arrow type, these constructors make STLC into a language corresponding to full intuitionistic propositional logic (via Curry-Howard) and to a bicartesian closed category.

---

## 2. Product Types

### 2.1 Syntax

We extend the syntax of types:

$$T ::= \ldots \mid T_1 \times T_2$$

and the syntax of terms:

$$t ::= \ldots \mid (t_1, t_2) \mid \text{fst}\; t \mid \text{snd}\; t$$

and the syntax of values:

$$v ::= \ldots \mid (v_1, v_2)$$

A pair $(t_1, t_2)$ bundles two terms together. The projections $\text{fst}$ and $\text{snd}$ extract the first and second components.

**Convention.** $\times$ binds more tightly than $\to$, so $A \times B \to C$ means $(A \times B) \to C$.

### 2.2 Typing Rules

$$\frac{\Gamma \vdash t_1 : T_1 \quad \Gamma \vdash t_2 : T_2}{\Gamma \vdash (t_1, t_2) : T_1 \times T_2} \quad \text{(T-Pair)}$$

$$\frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash \text{fst}\; t : T_1} \quad \text{(T-Fst)}$$

$$\frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash \text{snd}\; t : T_2} \quad \text{(T-Snd)}$$

**Reading the rules:**
- T-Pair (introduction): To construct a pair, provide terms of the component types.
- T-Fst (elimination): From a pair, extract the first component.
- T-Snd (elimination): From a pair, extract the second component.

### 2.3 Evaluation Rules

$$\frac{t_1 \to t_1'}{(t_1, t_2) \to (t_1', t_2)} \quad \text{(E-Pair1)}$$

$$\frac{t_2 \to t_2'}{(v_1, t_2) \to (v_1, t_2')} \quad \text{(E-Pair2)}$$

$$\frac{t \to t'}{\text{fst}\; t \to \text{fst}\; t'} \quad \text{(E-Fst)}$$

$$\frac{t \to t'}{\text{snd}\; t \to \text{snd}\; t'} \quad \text{(E-Snd)}$$

$$\frac{}{\text{fst}\; (v_1, v_2) \to v_1} \quad \text{(E-FstPair)}$$

$$\frac{}{\text{snd}\; (v_1, v_2) \to v_2} \quad \text{(E-SndPair)}$$

The pair evaluates left-to-right: first $t_1$ to a value $v_1$, then $t_2$ to a value $v_2$. The projections evaluate their argument to a pair value, then extract the corresponding component.

### 2.4 Type Safety for Products

We must extend the Canonical Forms lemma, progress, substitution lemma, and preservation.

**Lemma 2.1 (Canonical Forms for Products).** If $v$ is a value and $\vdash v : T_1 \times T_2$, then $v = (v_1, v_2)$ for some values $v_1, v_2$ with $\vdash v_1 : T_1$ and $\vdash v_2 : T_2$.

*Proof.* By enumeration of value forms. The only value form with a product type is a pair $(v_1, v_2)$. By inversion on T-Pair, $\vdash v_1 : T_1$ and $\vdash v_2 : T_2$. $\square$

**Theorem 2.2 (Progress --- Product Cases).** The new cases in the progress proof:

*Case T-Pair*: $t = (t_1, t_2)$ with $\vdash t_1 : T_1$ and $\vdash t_2 : T_2$. By IH, either $t_1$ is a value or $t_1 \to t_1'$.
- If $t_1 \to t_1'$: by E-Pair1, $(t_1, t_2) \to (t_1', t_2)$.
- If $t_1$ is a value: by IH on $t_2$, either $t_2$ is a value or $t_2 \to t_2'$.
  - If $t_2 \to t_2'$: by E-Pair2, $(v_1, t_2) \to (v_1, t_2')$.
  - If $t_2$ is a value: $(v_1, v_2)$ is a value.

*Case T-Fst*: $t = \text{fst}\; t_1$ with $\vdash t_1 : T_1 \times T_2$. By IH, either $t_1$ is a value or $t_1 \to t_1'$.
- If $t_1 \to t_1'$: by E-Fst, $\text{fst}\; t_1 \to \text{fst}\; t_1'$.
- If $t_1$ is a value: by Canonical Forms (Lemma 2.1), $t_1 = (v_1, v_2)$. By E-FstPair, $\text{fst}\; (v_1, v_2) \to v_1$.

*Case T-Snd*: Analogous to T-Fst.

**Theorem 2.3 (Preservation --- Product Cases).**

*Case T-Pair*: $t = (t_1, t_2)$ with $\Gamma \vdash t_1 : T_1$ and $\Gamma \vdash t_2 : T_2$.
- E-Pair1: $t_1 \to t_1'$. By IH, $\Gamma \vdash t_1' : T_1$. By T-Pair, $\Gamma \vdash (t_1', t_2) : T_1 \times T_2$.
- E-Pair2: $t_2 \to t_2'$. By IH, $\Gamma \vdash t_2' : T_2$. By T-Pair, $\Gamma \vdash (v_1, t_2') : T_1 \times T_2$.

*Case T-Fst*: $t = \text{fst}\; t_1$ with $\Gamma \vdash t_1 : T_1 \times T_2$.
- E-Fst: $t_1 \to t_1'$. By IH, $\Gamma \vdash t_1' : T_1 \times T_2$. By T-Fst, $\Gamma \vdash \text{fst}\; t_1' : T_1$.
- E-FstPair: $t_1 = (v_1, v_2)$ and $t' = v_1$. By inversion on $\Gamma \vdash (v_1, v_2) : T_1 \times T_2$: $\Gamma \vdash v_1 : T_1$. Done.

*Case T-Snd*: Analogous.

**Substitution Lemma --- Product Cases.** In the substitution lemma, the new cases are:

*Case T-Pair*: $t = (t_1, t_2)$. Then $[x \mapsto s](t_1, t_2) = ([x \mapsto s]t_1, [x \mapsto s]t_2)$. By IH, $\Gamma \vdash [x \mapsto s]t_1 : T_1$ and $\Gamma \vdash [x \mapsto s]t_2 : T_2$. By T-Pair, $\Gamma \vdash ([x \mapsto s]t_1, [x \mapsto s]t_2) : T_1 \times T_2$.

*Case T-Fst*: $t = \text{fst}\; t_1$. By IH, $\Gamma \vdash [x \mapsto s]t_1 : T_1 \times T_2$. By T-Fst, $\Gamma \vdash \text{fst}\; ([x \mapsto s]t_1) : T_1$.

*Case T-Snd*: Analogous.

### 2.5 Uniqueness of Types with Products

Adding products preserves the uniqueness of types property, provided we maintain the Church-style presentation. The T-Pair rule determines the type uniquely from the types of the components. The T-Fst and T-Snd rules determine the type uniquely from the type of the argument (which must be a product type).

**Proposition 2.4.** If $\Gamma \vdash t : T$ and $\Gamma \vdash t : T'$ in STLC with products, then $T = T'$.

*Proof.* Extend the uniqueness proof from Lecture 02a with three new cases:
- T-Pair: $T = T_1 \times T_2$ where $\Gamma \vdash t_1 : T_1$ and $\Gamma \vdash t_2 : T_2$. By IH, these types are unique, so $T$ is unique.
- T-Fst: $T = T_1$ where $\Gamma \vdash t : T_1 \times T_2$ for a unique $T_1 \times T_2$ (by IH). Hence $T_1$ is unique.
- T-Snd: Analogous. $\square$

### 2.6 Examples

**Example 2.1.** The swap function:

$$\text{swap} = \lambda p : A \times B.\, (\text{snd}\; p,\; \text{fst}\; p) : A \times B \to B \times A$$

Type derivation (in context $\Gamma = p : A \times B$):

$$\frac{\frac{\Gamma \vdash p : A \times B}{\Gamma \vdash \text{snd}\; p : B} \text{(T-Snd)} \quad \frac{\Gamma \vdash p : A \times B}{\Gamma \vdash \text{fst}\; p : A} \text{(T-Fst)}}{\Gamma \vdash (\text{snd}\; p,\; \text{fst}\; p) : B \times A} \quad \text{(T-Pair)}$$

**Example 2.2.** Function from pairs to curried functions:

$$\text{curry} = \lambda f : (A \times B) \to C.\, \lambda a : A.\, \lambda b : B.\, f\; (a, b) : ((A \times B) \to C) \to A \to B \to C$$

**Example 2.3.** The associativity of products:

$$\text{assoc} = \lambda t : (A \times B) \times C.\, (\text{fst}\; (\text{fst}\; t),\; (\text{snd}\; (\text{fst}\; t),\; \text{snd}\; t)) : (A \times B) \times C \to A \times (B \times C)$$

**Example 2.4.** Nested pair construction and destructuring:

$$\text{flatten} = \lambda p : (A \times B) \times C.\, (\text{fst}\; (\text{fst}\; p),\; \text{snd}\; (\text{fst}\; p),\; \text{snd}\; p)$$

Wait --- STLC does not have triples as a primitive. We encode them as nested pairs:

$$\text{flatten} = \lambda p : (A \times B) \times C.\, (\text{fst}\; (\text{fst}\; p),\; (\text{snd}\; (\text{fst}\; p),\; \text{snd}\; p))$$

Type: $(A \times B) \times C \to A \times (B \times C)$

This is the associativity isomorphism for products, corresponding to the logical tautology $(A \land B) \land C \iff A \land (B \land C)$.

**Example 2.5.** Using pairs to return multiple values:

$$\text{divmod} = \lambda n : \text{Nat}.\, (n,\; 0)$$

Type: $\text{Nat} \to \text{Nat} \times \text{Nat}$

(This is a trivial example since we cannot implement real division without recursion, but it illustrates the pattern of returning pairs.)

### 2.7 Eta-Equivalence for Products

Two values of a product type are eta-equivalent if their components are equal:

$$t =_\eta (\text{fst}\; t,\; \text{snd}\; t) \quad \text{when } t : T_1 \times T_2$$

This corresponds to the **surjective pairing** principle: every pair is determined by its projections.

Note that eta-equivalence for products is not built into our evaluation rules --- adding it would mean that any term $t : T_1 \times T_2$ can step to $(\text{fst}\; t,\; \text{snd}\; t)$, which would break the subterm property (the reduct is larger than the original). Instead, eta is typically treated as a definitional equality in the type theory or as an extensionality principle used in reasoning about programs.

### 2.8 Inversion for Products

The **inversion lemma** (also called the **generation lemma**) for products states:

**Lemma 2.5 (Inversion for Products).** The following hold:

1. If $\Gamma \vdash (t_1, t_2) : R$, then $R = T_1 \times T_2$ for some $T_1, T_2$ with $\Gamma \vdash t_1 : T_1$ and $\Gamma \vdash t_2 : T_2$.

2. If $\Gamma \vdash \text{fst}\; t : R$, then there exists $T_2$ such that $\Gamma \vdash t : R \times T_2$.

3. If $\Gamma \vdash \text{snd}\; t : R$, then there exists $T_1$ such that $\Gamma \vdash t : T_1 \times R$.

*Proof.* Each statement follows from the fact that only one typing rule can derive a judgment for each term form.

For (1): the only rule with conclusion $\Gamma \vdash (t_1, t_2) : R$ is T-Pair, which requires $R = T_1 \times T_2$ and gives the premises.

For (2): the only rule with conclusion $\Gamma \vdash \text{fst}\; t : R$ is T-Fst, which requires $\Gamma \vdash t : R \times T_2$ for some $T_2$.

For (3): analogous. $\square$

Inversion is crucial in preservation proofs: when we know that a term has a certain type and takes a step, inversion lets us "read off" the premises of the typing derivation.

### 2.9 Products and the Category of Types

From a categorical perspective, the product type $T_1 \times T_2$ together with projections $\text{fst}$ and $\text{snd}$ forms a **categorical product** in the category where:

- Objects are types.
- Morphisms from $A$ to $B$ are (equivalence classes of) closed terms of type $A \to B$.

The universal property says: for any type $C$ and terms $f : C \to T_1$ and $g : C \to T_2$, there is a unique (up to extensional equality) term $\langle f, g \rangle : C \to T_1 \times T_2$ such that $\text{fst} \circ \langle f, g \rangle = f$ and $\text{snd} \circ \langle f, g \rangle = g$. The pairing is:

$$\langle f, g \rangle = \lambda c : C.\, (f\; c,\; g\; c)$$

This universal property uniquely characterizes the product type up to isomorphism.

---

## 3. Sum Types

### 3.1 Syntax

We extend the syntax of types:

$$T ::= \ldots \mid T_1 + T_2$$

and the syntax of terms:

$$t ::= \ldots \mid \text{inl}\; t \mid \text{inr}\; t \mid \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2$$

and the syntax of values:

$$v ::= \ldots \mid \text{inl}\; v \mid \text{inr}\; v$$

$\text{inl}\; t$ (inject left) tags a term as belonging to the left component of a sum. $\text{inr}\; t$ (inject right) tags it as belonging to the right component. The $\text{case}$ expression performs pattern matching on the tag.

**Convention.** $+$ binds less tightly than $\times$ but more tightly than $\to$, so $A + B \times C$ means $A + (B \times C)$ and $A + B \to C$ means $(A + B) \to C$.

### 3.2 Typing Rules

$$\frac{\Gamma \vdash t : T_1}{\Gamma \vdash \text{inl}\; t : T_1 + T_2} \quad \text{(T-Inl)}$$

$$\frac{\Gamma \vdash t : T_2}{\Gamma \vdash \text{inr}\; t : T_1 + T_2} \quad \text{(T-Inr)}$$

$$\frac{\Gamma \vdash t : T_1 + T_2 \quad \Gamma, x : T_1 \vdash t_1 : T \quad \Gamma, y : T_2 \vdash t_2 : T}{\Gamma \vdash \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 : T} \quad \text{(T-Case)}$$

**Important note on T-Inl and T-Inr.** In the rules as stated, the type $T_2$ in T-Inl and $T_1$ in T-Inr are not determined by the term alone. For example, $\text{inl}\; \text{true}$ could have type $\text{Bool} + \text{Nat}$ or $\text{Bool} + \text{Bool}$ or $\text{Bool} + (\text{Nat} \to \text{Nat})$, etc.

This is a **loss of uniqueness of types**: the injection terms are the first constructs we have seen where the type is not uniquely determined by the term. In practice, we resolve this by either:
1. Adding type annotations: $\text{inl}_{T_1 + T_2}\; t$ or $(\text{inl}\; t) \;\text{as}\; T_1 + T_2$.
2. Using type inference to determine the missing type from context (Module 05).

For the theoretical development, we assume the type annotation is present (though we often omit it for readability).

### 3.3 Evaluation Rules

$$\frac{t \to t'}{\text{inl}\; t \to \text{inl}\; t'} \quad \text{(E-Inl)}$$

$$\frac{t \to t'}{\text{inr}\; t \to \text{inr}\; t'} \quad \text{(E-Inr)}$$

$$\frac{t \to t'}{\text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 \to \text{case}\; t'\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2} \quad \text{(E-Case)}$$

$$\frac{}{\text{case}\; (\text{inl}\; v)\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 \to [x \mapsto v]\, t_1} \quad \text{(E-CaseInl)}$$

$$\frac{}{\text{case}\; (\text{inr}\; v)\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 \to [y \mapsto v]\, t_2} \quad \text{(E-CaseInr)}$$

### 3.4 Type Safety for Sums

**Lemma 3.1 (Canonical Forms for Sums).** If $v$ is a value and $\vdash v : T_1 + T_2$, then either $v = \text{inl}\; v_1$ with $\vdash v_1 : T_1$, or $v = \text{inr}\; v_2$ with $\vdash v_2 : T_2$.

*Proof.* By enumeration of value forms. The only values with a sum type are $\text{inl}\; v_1$ and $\text{inr}\; v_2$. By inversion on the typing, $\vdash v_1 : T_1$ or $\vdash v_2 : T_2$ respectively. $\square$

**Theorem 3.2 (Progress --- Sum Cases).**

*Case T-Inl*: $t = \text{inl}\; t_1$ with $\vdash t_1 : T_1$. By IH, either $t_1$ is a value (so $\text{inl}\; t_1$ is a value) or $t_1 \to t_1'$ (so $\text{inl}\; t_1 \to \text{inl}\; t_1'$ by E-Inl).

*Case T-Inr*: Analogous.

*Case T-Case*: $t = \text{case}\; t_0\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2$ with $\vdash t_0 : T_1 + T_2$. By IH on $t_0$:
- If $t_0 \to t_0'$: by E-Case, $t \to \text{case}\; t_0'\; \text{of}\; \ldots$
- If $t_0$ is a value: by Canonical Forms (Lemma 3.1):
  - $t_0 = \text{inl}\; v_1$: by E-CaseInl, $t \to [x \mapsto v_1]\, t_1$.
  - $t_0 = \text{inr}\; v_2$: by E-CaseInr, $t \to [y \mapsto v_2]\, t_2$.

**Theorem 3.3 (Preservation --- Sum Cases).**

*Case T-Case, E-CaseInl*: $t_0 = \text{inl}\; v_1$ and $t' = [x \mapsto v_1]\, t_1$.

By inversion on $\Gamma \vdash \text{inl}\; v_1 : T_1 + T_2$ (via T-Inl): $\Gamma \vdash v_1 : T_1$.

We have $\Gamma, x : T_1 \vdash t_1 : T$ (from the T-Case premises).

By the Substitution Lemma: $\Gamma \vdash [x \mapsto v_1]\, t_1 : T$.

*Case T-Case, E-CaseInr*: Analogous, using $y$ and $t_2$.

*Case T-Case, E-Case*: $t_0 \to t_0'$. By IH, $\Gamma \vdash t_0' : T_1 + T_2$. By T-Case, $\Gamma \vdash \text{case}\; t_0'\; \text{of}\; \ldots : T$.

**Substitution Lemma --- Sum Cases.** The case for T-Case is the most interesting:

$t = \text{case}\; t_0\; \text{of}\; \text{inl}\; z \Rightarrow t_1 \mid \text{inr}\; w \Rightarrow t_2$.

We need $\Gamma \vdash [x \mapsto s](\text{case}\; t_0\; \text{of}\; \text{inl}\; z \Rightarrow t_1 \mid \text{inr}\; w \Rightarrow t_2) : T$.

Assuming $z \neq x$, $w \neq x$, and $z, w \notin \text{FV}(s)$ (by alpha-renaming):

$[x \mapsto s](\text{case}\; t_0\; \text{of}\; \text{inl}\; z \Rightarrow t_1 \mid \text{inr}\; w \Rightarrow t_2) = \text{case}\; [x \mapsto s]t_0\; \text{of}\; \text{inl}\; z \Rightarrow [x \mapsto s]t_1 \mid \text{inr}\; w \Rightarrow [x \mapsto s]t_2$

By IH on each subterm:
- $\Gamma \vdash [x \mapsto s]t_0 : T_1 + T_2$
- $\Gamma, z : T_1 \vdash [x \mapsto s]t_1 : T$ (using weakening to get $\Gamma, z : T_1 \vdash s : S$)
- $\Gamma, w : T_2 \vdash [x \mapsto s]t_2 : T$

By T-Case, the result has type $T$. $\square$

### 3.5 Examples

**Example 3.1.** Commutativity of sums:

$$\text{comm} = \lambda s : A + B.\, \text{case}\; s\; \text{of}\; \text{inl}\; a \Rightarrow \text{inr}\; a \mid \text{inr}\; b \Rightarrow \text{inl}\; b : (A + B) \to (B + A)$$

**Example 3.2.** Distributing functions over sums (the "universal property"):

$$\lambda p : (A \to C) \times (B \to C).\, \lambda s : A + B.\, \text{case}\; s\; \text{of}\; \text{inl}\; a \Rightarrow (\text{fst}\; p)\; a \mid \text{inr}\; b \Rightarrow (\text{snd}\; p)\; b$$

Type: $(A \to C) \times (B \to C) \to (A + B) \to C$

**Example 3.3.** Either-map: applying different functions to each branch.

$$\text{eitherMap} = \lambda f : A \to C.\, \lambda g : B \to D.\, \lambda s : A + B.\, \text{case}\; s\; \text{of}\; \text{inl}\; a \Rightarrow \text{inl}\; (f\; a) \mid \text{inr}\; b \Rightarrow \text{inr}\; (g\; b)$$

Type: $(A \to C) \to (B \to D) \to (A + B) \to (C + D)$

### 3.6 Eta-Equivalence for Sums

The eta principle for sums is:

$$t =_\eta \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow \text{inl}\; x \mid \text{inr}\; y \Rightarrow \text{inr}\; y \quad \text{when } t : T_1 + T_2$$

This says that case-splitting on a sum and re-injecting each branch is the identity. Like eta for products, this is not built into our evaluation rules but is used as an extensionality principle.

### 3.7 Sums and the Category of Types

Dually to products, the sum type $T_1 + T_2$ with injections $\text{inl}$ and $\text{inr}$ forms a **categorical coproduct**. The universal property says: for any type $C$ and terms $f : T_1 \to C$ and $g : T_2 \to C$, there is a unique term $[f, g] : T_1 + T_2 \to C$ such that $[f, g] \circ \text{inl} = f$ and $[f, g] \circ \text{inr} = g$. The copairing is:

$$[f, g] = \lambda s : T_1 + T_2.\, \text{case}\; s\; \text{of}\; \text{inl}\; x \Rightarrow f\; x \mid \text{inr}\; y \Rightarrow g\; y$$

### 3.8 Inversion for Sums

**Lemma 3.4 (Inversion for Sums).**

1. If $\Gamma \vdash \text{inl}\; t : R$, then $R = T_1 + T_2$ for some $T_1, T_2$ with $\Gamma \vdash t : T_1$.

2. If $\Gamma \vdash \text{inr}\; t : R$, then $R = T_1 + T_2$ for some $T_1, T_2$ with $\Gamma \vdash t : T_2$.

3. If $\Gamma \vdash \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 : R$, then there exist $T_1, T_2$ such that $\Gamma \vdash t : T_1 + T_2$, $\Gamma, x : T_1 \vdash t_1 : R$, and $\Gamma, y : T_2 \vdash t_2 : R$.

*Proof.* Direct from syntax-directedness of the typing rules. $\square$

### 3.9 Sums and Error Handling

Sums provide a type-safe mechanism for error handling. The type $A + B$ can represent a computation that either succeeds with a value of type $A$ (injected left) or fails with an error of type $B$ (injected right). This is exactly the pattern behind OCaml's `result` type and Haskell's `Either`.

**Example 3.4.** Safe predecessor with error reporting:

$$\text{safePred} = \lambda n : \text{Nat}.\, \text{if}\; (\text{iszero}\; n)\; \text{then}\; (\text{inr}\; \text{unit})\; \text{else}\; (\text{inl}\; (\text{pred}\; n))$$

Type: $\text{Nat} \to \text{Nat} + \text{Unit}$

The left injection carries the result; the right injection signals an error (predecessor of zero).

---

## 4. Unit Type

### 4.1 Syntax

$$T ::= \ldots \mid \text{Unit}$$

$$t ::= \ldots \mid \text{unit}$$

$$v ::= \ldots \mid \text{unit}$$

The Unit type has exactly one value: $\text{unit}$.

### 4.2 Typing Rules

$$\frac{}{\Gamma \vdash \text{unit} : \text{Unit}} \quad \text{(T-Unit)}$$

There is no elimination rule for Unit. Knowing that something is $\text{unit}$ provides no new information.

### 4.3 Evaluation Rules

No evaluation rules are needed for $\text{unit}$, since it is already a value.

### 4.4 Properties

The Unit type is trivial from a computational perspective: there is only one closed value of type Unit, so a function $f : T \to \text{Unit}$ always returns $\text{unit}$ (it "discards" its argument), and a function $g : \text{Unit} \to T$ is essentially a constant (it always gets the same input).

**Uses of Unit:**

1. **Return type for side-effecting functions.** In languages with effects, a function that performs an action but returns no meaningful value has return type Unit (like `void` in C or `unit` in OCaml/Haskell).

2. **Encoding nullary products.** The 0-ary product (product of zero types) is Unit: it is the identity for $\times$ up to isomorphism:

$$T \times \text{Unit} \cong T \cong \text{Unit} \times T$$

The isomorphism is witnessed by:

Forward: $\lambda p : T \times \text{Unit}.\, \text{fst}\; p : T \times \text{Unit} \to T$

Backward: $\lambda t : T.\, (t, \text{unit}) : T \to T \times \text{Unit}$

3. **Curry-Howard.** Unit corresponds to truth ($\top$): the trivially provable proposition.

### 4.5 Type Safety for Unit

The additions to the proofs are minimal:

- **Canonical Forms**: If $v$ is a value and $\vdash v : \text{Unit}$, then $v = \text{unit}$.
- **Progress**: T-Unit: $t = \text{unit}$, which is a value.
- **Preservation**: No evaluation rules to consider.
- **Substitution Lemma**: $[x \mapsto s]\,\text{unit} = \text{unit}$, and $\Gamma \vdash \text{unit} : \text{Unit}$ by T-Unit.

---

## 5. Void Type

### 5.1 Syntax

$$T ::= \ldots \mid \text{Void}$$

$$t ::= \ldots \mid \text{absurd}\; t$$

There are no values of type Void:

$$v ::= \ldots \quad \text{(no new value forms)}$$

### 5.2 Typing Rules

$$\frac{\Gamma \vdash t : \text{Void}}{\Gamma \vdash \text{absurd}\; t : T} \quad \text{(T-Absurd)}$$

The $\text{absurd}$ eliminator can produce a term of any type $T$, given a term of type Void. This is sound because no closed value of type Void exists, so $\text{absurd}$ can never actually be evaluated on a value.

There is no introduction rule for Void: it is impossible to construct a value of type Void.

### 5.3 Evaluation Rules

$$\frac{t \to t'}{\text{absurd}\; t \to \text{absurd}\; t'} \quad \text{(E-Absurd)}$$

There is no "computation" rule for $\text{absurd}$: since there is no value of type Void, the term $\text{absurd}\; t$ can only step by evaluating $t$. If $t$ ever reaches a value (which it cannot, by type safety and the emptiness of Void), we would be stuck --- but this situation never arises.

### 5.4 Properties

1. **Emptiness.** There is no closed value (or even closed normal form) of type Void.

2. **Initial object.** For every type $T$, there exists a unique function $\text{Void} \to T$ (up to extensional equality), namely $\lambda x : \text{Void}.\, \text{absurd}\; x$. This makes Void the **initial object** in the category of types.

3. **Identity for sums.** Void is the identity for $+$ up to isomorphism:

$$T + \text{Void} \cong T \cong \text{Void} + T$$

Forward ($T + \text{Void} \to T$): $\lambda s : T + \text{Void}.\, \text{case}\; s\; \text{of}\; \text{inl}\; t \Rightarrow t \mid \text{inr}\; v \Rightarrow \text{absurd}\; v$

Backward ($T \to T + \text{Void}$): $\lambda t : T.\, \text{inl}\; t$

4. **Annihilator for products.**

$$T \times \text{Void} \cong \text{Void}$$

If we could construct a pair $(t, v)$ of type $T \times \text{Void}$, we would need $v : \text{Void}$, which is impossible. The isomorphism is:

Forward ($T \times \text{Void} \to \text{Void}$): $\lambda p : T \times \text{Void}.\, \text{snd}\; p$

Backward ($\text{Void} \to T \times \text{Void}$): $\lambda v : \text{Void}.\, \text{absurd}\; v$

5. **Curry-Howard.** Void corresponds to falsity ($\bot$). The $\text{absurd}$ eliminator corresponds to *ex falso quodlibet* (from a contradiction, anything follows). The absence of an introduction rule corresponds to the unprovability of $\bot$ in a consistent logic.

### 5.5 Type Safety for Void

- **Canonical Forms**: There is no value of type Void, so the canonical forms lemma has no case for Void (or equivalently, the claim "if $v$ is a value and $\vdash v : \text{Void}$, then ..." is vacuously true).

- **Progress**: *Case T-Absurd*: $t = \text{absurd}\; t_1$ with $\vdash t_1 : \text{Void}$. By IH, either $t_1$ is a value or $t_1 \to t_1'$. If $t_1 \to t_1'$, then by E-Absurd, $\text{absurd}\; t_1 \to \text{absurd}\; t_1'$. If $t_1$ is a value: by Canonical Forms, there is no value of type Void. So this subcase is vacuously true (it cannot arise).

- **Preservation**: *Case T-Absurd, E-Absurd*: $t_1 \to t_1'$. By IH, $\Gamma \vdash t_1' : \text{Void}$. By T-Absurd, $\Gamma \vdash \text{absurd}\; t_1' : T$.

- **Substitution**: $[x \mapsto s](\text{absurd}\; t_1) = \text{absurd}\; ([x \mapsto s]t_1)$. By IH, $\Gamma \vdash [x \mapsto s]t_1 : \text{Void}$. By T-Absurd, the result has type $T$.

**Note on uniqueness of types.** The T-Absurd rule breaks uniqueness of types: $\text{absurd}\; t$ can have any type $T$. However, in the annotated version $\text{absurd}_T\; t$, where the target type is specified, uniqueness is restored.

---

## 6. Let-Bindings

### 6.1 Syntax

$$t ::= \ldots \mid \text{let}\; x = t_1\; \text{in}\; t_2$$

### 6.2 Typing Rule

$$\frac{\Gamma \vdash t_1 : T_1 \quad \Gamma, x : T_1 \vdash t_2 : T_2}{\Gamma \vdash \text{let}\; x = t_1\; \text{in}\; t_2 : T_2} \quad \text{(T-Let)}$$

### 6.3 Evaluation Rules

$$\frac{t_1 \to t_1'}{\text{let}\; x = t_1\; \text{in}\; t_2 \to \text{let}\; x = t_1'\; \text{in}\; t_2} \quad \text{(E-Let)}$$

$$\frac{}{\text{let}\; x = v\; \text{in}\; t_2 \to [x \mapsto v]\, t_2} \quad \text{(E-LetVal)}$$

### 6.4 Let as Syntactic Sugar

Let-bindings can be **desugared** (expressed as derived forms):

$$\text{let}\; x = t_1\; \text{in}\; t_2 \quad \equiv \quad (\lambda x : T_1.\, t_2)\; t_1$$

where $T_1$ is the type of $t_1$.

This encoding preserves both typing and evaluation:
- **Typing**: T-Let corresponds to a combination of T-Abs and T-App.
- **Evaluation**: E-LetVal corresponds to E-AppAbs.

However, let-bindings are preferred in practice for several reasons:
1. They avoid the need for type annotations (the type of $x$ is inferred from $t_1$).
2. In systems with let-polymorphism (Module 05, Hindley-Milner), $\text{let}$ allows more polymorphism than the lambda encoding.
3. They are more readable.

### 6.5 Type Safety for Let-Bindings

**Progress**: $t = \text{let}\; x = t_1\; \text{in}\; t_2$ with $\vdash t_1 : T_1$ and $x : T_1 \vdash t_2 : T_2$. By IH on $t_1$:

- If $t_1 \to t_1'$: by E-Let, $\text{let}\; x = t_1\; \text{in}\; t_2 \to \text{let}\; x = t_1'\; \text{in}\; t_2$.
- If $t_1$ is a value: by E-LetVal, $\text{let}\; x = v_1\; \text{in}\; t_2 \to [x \mapsto v_1]\, t_2$.

**Preservation**: Two subcases.

- E-Let: $t_1 \to t_1'$. By IH, $\Gamma \vdash t_1' : T_1$. By T-Let, $\Gamma \vdash \text{let}\; x = t_1'\; \text{in}\; t_2 : T_2$.

- E-LetVal: $t_1 = v_1$ and $t' = [x \mapsto v_1]\, t_2$. We have $\Gamma \vdash v_1 : T_1$ and $\Gamma, x : T_1 \vdash t_2 : T_2$. By the Substitution Lemma, $\Gamma \vdash [x \mapsto v_1]\, t_2 : T_2$.

### 6.6 Let-Binding Examples

**Example 6.1.** Sequencing a computation:

$$\text{let}\; x = \text{succ}\; (\text{succ}\; 0)\; \text{in}\; \text{let}\; y = \text{succ}\; x\; \text{in}\; (x, y)$$

Evaluation trace:

$$\text{let}\; x = 2\; \text{in}\; \text{let}\; y = \text{succ}\; x\; \text{in}\; (x, y)$$

$$\to \text{let}\; y = \text{succ}\; 2\; \text{in}\; (2, y)$$

$$\to \text{let}\; y = 3\; \text{in}\; (2, y)$$

$$\to (2, 3)$$

**Example 6.2.** Destructuring with let:

Let-bindings combined with projections provide pattern-matching-like functionality:

$$\text{let}\; a = \text{fst}\; p\; \text{in}\; \text{let}\; b = \text{snd}\; p\; \text{in}\; (b, a)$$

This swaps the components of a pair $p : A \times B$.

---

## 7. Ascription

### 7.1 Syntax

$$t ::= \ldots \mid t\; \text{as}\; T$$

### 7.2 Typing Rule

$$\frac{\Gamma \vdash t : T}{\Gamma \vdash t\; \text{as}\; T : T} \quad \text{(T-Ascribe)}$$

Ascription checks that a term has a particular type, and returns it at that type. It has no runtime effect.

### 7.3 Evaluation Rules

$$\frac{t \to t'}{t\; \text{as}\; T \to t'\; \text{as}\; T} \quad \text{(E-Ascribe)}$$

$$\frac{}{v\; \text{as}\; T \to v} \quad \text{(E-AscribeVal)}$$

At runtime, ascription is erased: $v\; \text{as}\; T \to v$.

### 7.4 Type Safety for Ascription

**Progress**: $t = t_0\; \text{as}\; T$ with $\vdash t_0 : T$. By IH on $t_0$:
- If $t_0 \to t_0'$: by E-Ascribe, $t_0\; \text{as}\; T \to t_0'\; \text{as}\; T$.
- If $t_0$ is a value: by E-AscribeVal, $v\; \text{as}\; T \to v$.

**Preservation**: Two subcases.
- E-Ascribe: $t_0 \to t_0'$. By IH, $\Gamma \vdash t_0' : T$. By T-Ascribe, $\Gamma \vdash t_0'\; \text{as}\; T : T$.
- E-AscribeVal: $t_0 = v$ and $t' = v$. We have $\Gamma \vdash v : T$ directly.

### 7.5 Uses of Ascription

1. **Documentation**: Making the intended type explicit for readers.
2. **Resolving ambiguity**: When the type is not uniquely determined (e.g., for sum injections): $(\text{inl}\; \text{true})\; \text{as}\; \text{Bool} + \text{Nat}$.
3. **Restricting types**: In systems with subtyping, ascription can be used to upcast a term to a supertype.

### 7.6 Ascription as Syntactic Sugar

Like let-bindings, ascription can be encoded:

$$t\; \text{as}\; T \quad \equiv \quad (\lambda x : T.\, x)\; t$$

This encoding works because the identity function at type $T$ checks that its argument has type $T$ and returns it unchanged. The evaluation behavior matches: both reduce to $t$ when $t$ is a value.

---

## 8. General Records and Variants

### 8.1 Records (Generalized Products)

A **record** is a product with named fields instead of positional access:

$$T ::= \ldots \mid \{l_1 : T_1, \ldots, l_n : T_n\}$$

$$t ::= \ldots \mid \{l_1 = t_1, \ldots, l_n = t_n\} \mid t.l$$

$$v ::= \ldots \mid \{l_1 = v_1, \ldots, l_n = v_n\}$$

**Typing rules:**

$$\frac{\Gamma \vdash t_i : T_i \quad \text{for each } i \in 1..n}{\Gamma \vdash \{l_1 = t_1, \ldots, l_n = t_n\} : \{l_1 : T_1, \ldots, l_n : T_n\}} \quad \text{(T-Rcd)}$$

$$\frac{\Gamma \vdash t : \{l_1 : T_1, \ldots, l_n : T_n\} \quad j \in 1..n}{\Gamma \vdash t.l_j : T_j} \quad \text{(T-Proj)}$$

**Evaluation rules:**

$$\frac{t_j \to t_j'}{\{l_1 = v_1, \ldots, l_{j-1} = v_{j-1}, l_j = t_j, \ldots\} \to \{l_1 = v_1, \ldots, l_{j-1} = v_{j-1}, l_j = t_j', \ldots\}} \quad \text{(E-Rcd)}$$

$$\frac{t \to t'}{t.l \to t'.l} \quad \text{(E-ProjRcd)}$$

$$\frac{}{\{l_1 = v_1, \ldots, l_n = v_n\}.l_j \to v_j} \quad \text{(E-ProjBeta)}$$

Records generalize pairs: $T_1 \times T_2$ is the record $\{1 : T_1, 2 : T_2\}$ with numeric labels. The Unit type is the empty record $\{\}$.

**Example 8.1.** A record representing a 2D point:

$$\text{origin} = \{x = 0,\; y = 0\} : \{x : \text{Nat},\; y : \text{Nat}\}$$

$$\text{getX} = \lambda p : \{x : \text{Nat},\; y : \text{Nat}\}.\, p.x : \{x : \text{Nat},\; y : \text{Nat}\} \to \text{Nat}$$

Records are particularly important in practice because they support named access (which is less error-prone than positional access) and can be extended with subtyping to support width subtyping (Module 04): a record with more fields can be used where a record with fewer fields is expected.

### 8.2 Variants (Generalized Sums)

A **variant** is a sum with named alternatives:

$$T ::= \ldots \mid \langle l_1 : T_1, \ldots, l_n : T_n \rangle$$

$$t ::= \ldots \mid \langle l_j = t \rangle \mid \text{case}\; t\; \text{of}\; \langle l_1 = x_1 \rangle \Rightarrow t_1 \mid \cdots \mid \langle l_n = x_n \rangle \Rightarrow t_n$$

**Typing rules:**

$$\frac{\Gamma \vdash t : T_j \quad j \in 1..n}{\Gamma \vdash \langle l_j = t \rangle : \langle l_1 : T_1, \ldots, l_n : T_n \rangle} \quad \text{(T-Variant)}$$

$$\frac{\Gamma \vdash t : \langle l_1 : T_1, \ldots, l_n : T_n \rangle \quad \Gamma, x_i : T_i \vdash t_i : T \quad \text{for each } i \in 1..n}{\Gamma \vdash \text{case}\; t\; \text{of}\; \langle l_1 = x_1 \rangle \Rightarrow t_1 \mid \cdots \mid \langle l_n = x_n \rangle \Rightarrow t_n : T} \quad \text{(T-VCase)}$$

Variants generalize sums: $T_1 + T_2$ is the variant $\langle \text{inl} : T_1, \text{inr} : T_2 \rangle$ with labels "inl" and "inr." The Void type is the empty variant $\langle \rangle$ with no alternatives.

### 8.3 Type Safety for Records

The type safety proofs extend straightforwardly.

**Canonical Forms for Records.** If $v$ is a value and $\vdash v : \{l_1 : T_1, \ldots, l_n : T_n\}$, then $v = \{l_1 = v_1, \ldots, l_n = v_n\}$ with $\vdash v_i : T_i$ for each $i$.

**Progress (Record Cases).**

*Case T-Rcd*: $t = \{l_1 = t_1, \ldots, l_n = t_n\}$. Let $j$ be the smallest index such that $t_j$ is not a value (if one exists). Then by IH, $t_j \to t_j'$, and we apply E-Rcd. If all $t_i$ are values, then $t$ is a value.

*Case T-Proj*: $t = t_0.l_j$ with $\vdash t_0 : \{l_1 : T_1, \ldots, l_n : T_n\}$. By IH, either $t_0 \to t_0'$ (apply E-ProjRcd) or $t_0$ is a value (by canonical forms, $t_0 = \{l_1 = v_1, \ldots, l_n = v_n\}$; apply E-ProjBeta).

**Preservation.** The computation case (E-ProjBeta) uses inversion: from $\Gamma \vdash \{l_1 = v_1, \ldots, l_n = v_n\} : \{l_1 : T_1, \ldots, l_n : T_n\}$ we extract $\Gamma \vdash v_j : T_j$.

### 8.4 Records with Subtyping (Preview)

Records become particularly interesting when combined with subtyping (Module 04). The key principle is **width subtyping**: a record with more fields is a subtype of a record with fewer fields.

$$\{l_1 : T_1, l_2 : T_2, l_3 : T_3\} <: \{l_1 : T_1, l_2 : T_2\}$$

This corresponds to the intuition that additional information can always be safely discarded. Combined with **depth subtyping** (where field types can be covariant) and **permutation subtyping** (where field order does not matter), records provide a structural type system for objects. This is the basis of object-oriented type systems (Module 04).

### 8.5 Algebraic Data Types

In languages like OCaml and Haskell, **algebraic data types** combine variants (for the different constructors) with products (for the fields of each constructor) and recursion:

```
type expr =
  | Lit of int
  | Add of expr * expr
  | Neg of expr
```

This is a recursive variant type. Recursive types are the subject of Module 03.

### 8.6 Encoding Booleans and Naturals

With sums, products, Unit, and Void, we can encode many base types:

**Booleans.** $\text{Bool} \cong \text{Unit} + \text{Unit}$. The two values are:

- $\text{true} \cong \text{inl}\; \text{unit}$
- $\text{false} \cong \text{inr}\; \text{unit}$
- $\text{if}\; t\; \text{then}\; t_1\; \text{else}\; t_2 \cong \text{case}\; t\; \text{of}\; \text{inl}\; \_ \Rightarrow t_1 \mid \text{inr}\; \_ \Rightarrow t_2$

**Optional values.** $\text{Option}\; T \cong T + \text{Unit}$. This represents a value that may or may not be present:

- $\text{some}\; v \cong \text{inl}\; v$
- $\text{none} \cong \text{inr}\; \text{unit}$

These encodings show that products and sums, together with Unit and Void, are surprisingly expressive even without recursion.

---

## 9. Algebraic Laws of Types

Types under $\times$, $+$, Unit, and Void satisfy algebraic laws analogous to arithmetic with multiplication, addition, 1, and 0. These are all isomorphisms (bijections between the sets of inhabitants):

### 9.1 Product Laws

$$T \times \text{Unit} \cong T \cong \text{Unit} \times T \quad \text{(identity for } \times \text{)}$$

$$(T_1 \times T_2) \times T_3 \cong T_1 \times (T_2 \times T_3) \quad \text{(associativity)}$$

$$T_1 \times T_2 \cong T_2 \times T_1 \quad \text{(commutativity)}$$

$$T \times \text{Void} \cong \text{Void} \cong \text{Void} \times T \quad \text{(annihilation)}$$

### 9.2 Sum Laws

$$T + \text{Void} \cong T \cong \text{Void} + T \quad \text{(identity for } + \text{)}$$

$$(T_1 + T_2) + T_3 \cong T_1 + (T_2 + T_3) \quad \text{(associativity)}$$

$$T_1 + T_2 \cong T_2 + T_1 \quad \text{(commutativity)}$$

### 9.3 Distributivity

$$T_1 \times (T_2 + T_3) \cong (T_1 \times T_2) + (T_1 \times T_3) \quad \text{(distributivity of } \times \text{ over } + \text{)}$$

### 9.4 Exponential Laws

$$T^{\text{Unit}} \cong T \quad \text{i.e., } \text{Unit} \to T \cong T$$

$$T^{\text{Void}} \cong \text{Unit} \quad \text{i.e., } \text{Void} \to T \cong \text{Unit}$$

$$\text{Unit}^T \cong \text{Unit} \quad \text{i.e., } T \to \text{Unit} \cong \text{Unit}$$

$$T^{S_1 + S_2} \cong T^{S_1} \times T^{S_2} \quad \text{i.e., } (S_1 + S_2) \to T \cong (S_1 \to T) \times (S_2 \to T)$$

$$T^{S_1 \times S_2} \cong (T^{S_2})^{S_1} \quad \text{i.e., } (S_1 \times S_2) \to T \cong S_1 \to (S_2 \to T)$$

The last law is the **currying isomorphism**.

### 9.5 Proofs of the Algebraic Laws

Each algebraic law is witnessed by a pair of functions (forward and backward) that compose to the identity. Let us prove one representative law in detail.

**Proposition 9.1 (Distributivity).** $T_1 \times (T_2 + T_3) \cong (T_1 \times T_2) + (T_1 \times T_3)$.

*Proof.* We construct the isomorphism:

Forward ($f$):

$$f = \lambda p : T_1 \times (T_2 + T_3).\, \text{case}\; (\text{snd}\; p)\; \text{of}$$

$$\quad \text{inl}\; b \Rightarrow \text{inl}\; (\text{fst}\; p,\; b)$$

$$\quad \mid\; \text{inr}\; c \Rightarrow \text{inr}\; (\text{fst}\; p,\; c)$$

Backward ($g$):

$$g = \lambda s : (T_1 \times T_2) + (T_1 \times T_3).\, \text{case}\; s\; \text{of}$$

$$\quad \text{inl}\; p \Rightarrow (\text{fst}\; p,\; \text{inl}\; (\text{snd}\; p))$$

$$\quad \mid\; \text{inr}\; q \Rightarrow (\text{fst}\; q,\; \text{inr}\; (\text{snd}\; q))$$

We verify $g \circ f = \text{id}$ and $f \circ g = \text{id}$ by case analysis.

For $g \circ f$: Given $p = (a, \text{inl}\; b)$ where $a : T_1$ and $b : T_2$:

$$f\; (a, \text{inl}\; b) = \text{inl}\; (a, b)$$

$$g\; (\text{inl}\; (a, b)) = (a, \text{inl}\; b) = p$$

The case for $p = (a, \text{inr}\; c)$ is symmetric. The verification of $f \circ g$ is analogous.

Under the Curry-Howard correspondence, this proof corresponds to the logical tautology $A \land (B \lor C) \iff (A \land B) \lor (A \land C)$, and the proof terms are the programs witnessing the equivalence.

### 9.6 Proof of the Currying Isomorphism

**Proposition 9.2 (Currying).** $(S_1 \times S_2) \to T \cong S_1 \to (S_2 \to T)$.

*Proof.* We construct the isomorphism:

Forward (curry):

$$\text{curry} = \lambda f : (S_1 \times S_2) \to T.\, \lambda a : S_1.\, \lambda b : S_2.\, f\; (a, b)$$

Type: $((S_1 \times S_2) \to T) \to S_1 \to S_2 \to T$.

Backward (uncurry):

$$\text{uncurry} = \lambda g : S_1 \to S_2 \to T.\, \lambda p : S_1 \times S_2.\, g\; (\text{fst}\; p)\; (\text{snd}\; p)$$

Type: $(S_1 \to S_2 \to T) \to (S_1 \times S_2) \to T$.

We verify $\text{uncurry} \circ \text{curry} = \text{id}$: Given $f : (S_1 \times S_2) \to T$ and $p : S_1 \times S_2$:

$$(\text{uncurry}\; (\text{curry}\; f))\; p = (\text{curry}\; f)\; (\text{fst}\; p)\; (\text{snd}\; p) = f\; (\text{fst}\; p,\; \text{snd}\; p) =_\eta f\; p$$

The last step uses eta for products: $(\text{fst}\; p,\; \text{snd}\; p) =_\eta p$.

We verify $\text{curry} \circ \text{uncurry} = \text{id}$: Given $g : S_1 \to S_2 \to T$ and $a : S_1$, $b : S_2$:

$$(\text{curry}\; (\text{uncurry}\; g))\; a\; b = (\text{uncurry}\; g)\; (a, b) = g\; (\text{fst}\; (a, b))\; (\text{snd}\; (a, b)) = g\; a\; b$$

Hence the isomorphism holds. Under Curry-Howard, this corresponds to the logical tautology $(A \land B \implies C) \iff (A \implies B \implies C)$, which is precisely the deduction theorem of propositional logic. $\square$

### 9.7 Counting Inhabitants

If we think of types as having a "cardinality" (the number of inhabitants), the algebraic laws become literal arithmetic:

| Type | Cardinality |
|------|------------|
| $\text{Void}$ | 0 |
| $\text{Unit}$ | 1 |
| $\text{Bool}$ | 2 |
| $T_1 + T_2$ | $\VertT_1\Vert + \VertT_2\Vert$ |
| $T_1 \times T_2$ | $\VertT_1\Vert \cdot \VertT_2\Vert$ |
| $T_1 \to T_2$ | $\VertT_2\Vert^{\VertT_1\Vert}$ |

For example:
- $\text{Bool} + \text{Unit}$ has $2 + 1 = 3$ inhabitants: $\text{inl}\;\text{true}$, $\text{inl}\;\text{false}$, $\text{inr}\;\text{unit}$.
- $\text{Bool} \times \text{Bool}$ has $2 \cdot 2 = 4$ inhabitants.
- $\text{Bool} \to \text{Bool}$ has $2^2 = 4$ inhabitants (the four functions from Bool to Bool).

---

## 10. Summary of All Typing Rules

For reference, here is the complete typing system after all extensions:

**Base types and functions** (from Lecture 02a):

$$\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \text{(T-Var)} \qquad \frac{\Gamma, x : T_1 \vdash t : T_2}{\Gamma \vdash \lambda x : T_1.\, t : T_1 \to T_2} \text{(T-Abs)} \qquad \frac{\Gamma \vdash t_1 : T_1 \to T_2 \quad \Gamma \vdash t_2 : T_1}{\Gamma \vdash t_1\; t_2 : T_2} \text{(T-App)}$$

**Booleans**: T-True, T-False, T-If (as in Lecture 02a).

**Natural numbers**: T-Zero, T-Succ, T-Pred, T-IsZero (as in Lecture 02a).

**Products**:

$$\frac{\Gamma \vdash t_1 : T_1 \quad \Gamma \vdash t_2 : T_2}{\Gamma \vdash (t_1, t_2) : T_1 \times T_2} \text{(T-Pair)} \qquad \frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash \text{fst}\; t : T_1} \text{(T-Fst)} \qquad \frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash \text{snd}\; t : T_2} \text{(T-Snd)}$$

**Sums**:

$$\frac{\Gamma \vdash t : T_1}{\Gamma \vdash \text{inl}\; t : T_1 + T_2} \text{(T-Inl)} \qquad \frac{\Gamma \vdash t : T_2}{\Gamma \vdash \text{inr}\; t : T_1 + T_2} \text{(T-Inr)}$$

$$\frac{\Gamma \vdash t : T_1 + T_2 \quad \Gamma, x : T_1 \vdash t_1 : T \quad \Gamma, y : T_2 \vdash t_2 : T}{\Gamma \vdash \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 : T} \text{(T-Case)}$$

**Unit and Void**:

$$\frac{}{\Gamma \vdash \text{unit} : \text{Unit}} \text{(T-Unit)} \qquad \frac{\Gamma \vdash t : \text{Void}}{\Gamma \vdash \text{absurd}\; t : T} \text{(T-Absurd)}$$

**Let-binding**: T-Let. **Ascription**: T-Ascribe.

---

## 11. Exercises

**Exercise 11.1.** Construct a complete type derivation tree for the term:

$$\vdash \lambda p : \text{Nat} \times \text{Bool}.\, \text{if}\; (\text{snd}\; p)\; \text{then}\; (\text{fst}\; p)\; \text{else}\; 0 : \;?$$

Show every application of a typing rule.

**Exercise 11.2.** Consider the term $t = \text{fst}\; (\text{inl}\; \text{true})$.

(a) Explain why this term is ill-typed. Identify the specific typing rule that fails.

(b) Give a well-typed modification of $t$ that extracts a boolean from a sum type.

**Exercise 11.3.** Prove that the following types are isomorphic by giving explicit witness terms in both directions:

$$(A \to B) \times (A \to C) \cong A \to (B \times C)$$

Argue informally that the compositions are extensionally equal to the identity.

**Exercise 11.4 (Uniqueness of Products).** Let $P$ be a type equipped with functions $\pi_1 : P \to A$ and $\pi_2 : P \to B$ satisfying the universal property of the product: for any type $C$ with $f : C \to A$ and $g : C \to B$, there exists a unique $h : C \to P$ such that $\pi_1 \circ h = f$ and $\pi_2 \circ h = g$. Show that $P \cong A \times B$ by constructing the isomorphism using the universal property.

*Hint.* Use the universal property of $P$ with $C = A \times B$, and the universal property of $A \times B$ with $C = P$.

**Exercise 11.5.** Prove the exponential law $T^{S_1 + S_2} \cong T^{S_1} \times T^{S_2}$ by constructing explicit witness terms:

$$f : (S_1 + S_2 \to T) \to (S_1 \to T) \times (S_2 \to T)$$

$$g : (S_1 \to T) \times (S_2 \to T) \to (S_1 + S_2 \to T)$$

Verify that $g \circ f$ and $f \circ g$ are extensionally equal to the identity.

**Exercise 11.6 (Void Elimination).** Consider the term:

$$t = \lambda f : \text{Void} \to \text{Nat}.\, \lambda g : \text{Void} \to \text{Bool}.\, \text{unit}$$

(a) What is the type of $t$?

(b) Define a different term $t'$ of type $(\text{Void} \to \text{Nat}) \to (\text{Void} \to \text{Bool}) \to \text{Unit}$.

(c) Are $t$ and $t'$ extensionally equal? Justify your answer.

**Exercise 11.7 (Substitution for Let).** Prove the substitution lemma case for T-Let:

If $\Gamma, x : S \vdash \text{let}\; y = t_1\; \text{in}\; t_2 : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s](\text{let}\; y = t_1\; \text{in}\; t_2) : T$.

Be careful about the variable $y$: state the freshness conditions needed and explain why alpha-renaming may be required.

**Exercise 11.8 (Record Encoding).** Show how to encode the record type $\{x : \text{Nat},\; y : \text{Bool},\; z : \text{Nat}\}$ using nested pair types. Give the encoding of:

(a) The type itself.

(b) A term constructing the record $\{x = 0,\; y = \text{true},\; z = \text{succ}\; 0\}$.

(c) The projection $t.y$ for an arbitrary term $t$ of the record type.

What are the advantages and disadvantages of named records versus positional pairs?

**Exercise 11.9 (Counting Inhabitants).** Determine the number of inhabitants (closed values) of each of the following types. Justify your answers.

(a) $\text{Bool} \times \text{Unit}$

(b) $\text{Bool} + \text{Bool}$

(c) $\text{Unit} \to \text{Bool}$

(d) $\text{Bool} \to \text{Unit}$

(e) $\text{Void} \to \text{Bool}$

(f) $\text{Bool} \to \text{Void}$

**Exercise 11.10 (Compilation Strategy).** Suppose you are compiling STLC with products and sums to a machine with a flat memory model. Describe how you would represent values of the following types in memory:

(a) $\text{Nat} \times \text{Bool}$ (assume Nat is a machine integer).

(b) $\text{Nat} + \text{Bool}$.

(c) $\{x : \text{Nat},\; y : \text{Nat},\; z : \text{Bool}\}$.

How does the tagged union representation of sums relate to the tag bits used in language runtimes like OCaml's?

---

## Summary

In this lecture, we extended the simply typed lambda calculus with fundamental type constructors:

- **Product types** ($T_1 \times T_2$) with pairs, projections (fst/snd), and left-to-right evaluation. Correspond to conjunction under Curry-Howard.
- **Sum types** ($T_1 + T_2$) with injections (inl/inr) and case analysis. Correspond to disjunction. Introduce a mild loss of uniqueness of types (resolved by annotations).
- **Unit type** with a single value $\text{unit}$. Corresponds to truth. Identity for products.
- **Void type** with no values and an $\text{absurd}$ eliminator. Corresponds to falsity. Identity for sums, annihilator for products.
- **Let-bindings** as syntactic sugar for application of an abstraction.
- **Ascription** for explicit type annotations.
- **Records and variants** as generalizations of products and sums with named fields.
- **Algebraic laws**: Types form a semiring under $+$ and $\times$, with Void as additive identity and Unit as multiplicative identity.

For each extension, we updated the type safety proof (canonical forms, progress, substitution lemma, preservation) to cover the new constructs.

The key takeaway is that each type constructor corresponds to a logical connective and a categorical construction. This three-way correspondence --- programming, logic, category theory --- is not a coincidence but a deep structural fact that persists across all the type systems we will study in this course.

### Looking Ahead

The extensions in this lecture complete the **simply typed** portion of our development. In Module 03, we add **recursive types** ($\mu X.\, T$), which allow us to define types like natural numbers and lists as fixed points. In Module 04, we add **subtyping**, which allows terms of a "more specific" type to be used where a "more general" type is expected. In Module 05, we add **polymorphism** ($\forall X.\, T$), which allows types to be parameterized by type variables. Each of these extensions interacts non-trivially with the constructs from this lecture: for instance, subtyping on records gives rise to object-oriented typing, and polymorphism applied to sums gives existential types.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*. MIT Press. Chapters 11 (pairs, records, variants, unit), 14 (ascription, let). The primary reference.

2. **Harper, R.** (2016). *Practical Foundations for Programming Languages*. 2nd ed. Chapters 10-12 (products, sums, pattern matching). An alternative presentation with emphasis on the judgmental method.

3. **Wadler, P.** (2015). "Propositions as Types." *Communications of the ACM*. The Curry-Howard perspective on products, sums, unit, and void.

4. **Lambek, J. and Scott, P. J.** (1986). *Introduction to Higher Order Categorical Logic*. Cambridge University Press. The categorical perspective on products and coproducts.

5. **Girard, J.-Y., Lafont, Y., and Taylor, P.** (1989). *Proofs and Types*. Cambridge University Press. Products and sums from the proof-theoretic perspective.

6. **Awodey, S.** (2010). *Category Theory*. 2nd ed. Oxford University Press. Chapter 5 (products and coproducts), Chapter 6 (exponentials). A gentle introduction to the categorical concepts underlying our type constructors.

7. **Chlipala, A.** (2013). *Certified Programming with Dependent Types*. MIT Press. Chapter 2 demonstrates how products and sums work in a dependently typed setting (Coq), showing how the ideas from this lecture generalize.
