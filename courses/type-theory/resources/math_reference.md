---
title: "Mathematical Reference for Type Theory"
tags:
  - type-theory
  - reference
---
# Mathematical Reference for Type Theory

A concise reference for the notation, inference rules, proof techniques, and key theorems most frequently encountered in type theory and programming language theory.

---

## Table of Contents

1. [Notation and Conventions](#notation-and-conventions)
2. [Inference Rule Notation](#inference-rule-notation)
3. [Lambda Calculus Reference](#lambda-calculus-reference)
4. [Typing Rule Schemas](#typing-rule-schemas)
5. [Substitution and Binding](#substitution-and-binding)
6. [Structural Induction Templates](#structural-induction-templates)
7. [Key Theorems and Proof Patterns](#key-theorems-and-proof-patterns)
8. [Subtyping Rules](#subtyping-rules)
9. [Logical Relations and Parametricity](#logical-relations-and-parametricity)
10. [Proof Theory Correspondence](#proof-theory-correspondence)

---

## Notation and Conventions

### Metavariables

| Symbol | Ranges Over |
|---|---|
| x, y, z | Term variables |
| a, b, c | Type variables |
| e, e', e1, e2 | Terms / expressions |
| v, v1, v2 | Values |
| T, S, U | Types |
| Gamma, Delta | Typing contexts |
| sigma, tau | Type substitutions |
| kappa | Kinds |

### Type Constructors

| Notation | Meaning |
|---|---|
| T1 -> T2 | Function type (arrow type) |
| T1 x T2 | Product type (pair) |
| T1 + T2 | Sum type (disjoint union) |
| Unit | Unit type (single value) |
| Void | Empty type (bottom) |
| forall a. T | Universal type (polymorphism) |
| exists a. T | Existential type (abstraction) |
| mu a. T | Recursive type |
| Pi(x : A). B | Dependent function type |
| Sigma(x : A). B | Dependent pair type |
| {x : T \| phi} | Refinement type |
| T1 -o T2 | Linear function type |
| !T | Of-course modality (linear logic) |
| Ref T | Mutable reference type |

### Judgments

| Notation | Meaning |
|---|---|
| Gamma |- e : T | e has type T in context Gamma |
| Gamma |- T type | T is a well-formed type |
| Gamma |- S <: T | S is a subtype of T |
| Gamma |- e1 =_beta e2 : T | e1 and e2 are beta-equal at type T |
| e ~> e' | e steps to e' (small-step) |
| e =>* v | e evaluates to v (big-step / multi-step) |
| |- e : T | e has type T in the empty context |
| Gamma |- J | Generic judgment J holds in context Gamma |

### Context Operations

| Notation | Meaning |
|---|---|
| . (or empty) | Empty context |
| Gamma, x : T | Extend Gamma with binding x : T |
| dom(Gamma) | Set of variables bound in Gamma |
| Gamma(x) | Type of x in Gamma (lookup) |
| Gamma1, Gamma2 | Concatenation of contexts |

---

## Inference Rule Notation

### General Form

```
    P1    P2    ...    Pn
    ----------------------  [RuleName]
             C
```

Read: from premises P1 through Pn, conclude C. Side conditions are written to the right or below the rule.

### Common Rule Patterns

**Axiom (no premises):**

```
    ----------------  [T-Unit]
    Gamma |- () : Unit
```

**Single premise:**

```
    Gamma |- e : T1 -> T2    Gamma |- e' : T1
    -------------------------------------------  [T-App]
                Gamma |- e e' : T2
```

**Binding rule (extending context):**

```
    Gamma, x : T1 |- e : T2
    ---------------------------  [T-Abs]
    Gamma |- (lam x. e) : T1 -> T2
```

**Lookup rule:**

```
    x : T in Gamma
    ----------------  [T-Var]
    Gamma |- x : T
```

### Derivation Trees

A derivation is a tree of rule applications. Leaves are axioms; each internal node is a rule application with the premises above and the conclusion below. A term is well-typed if and only if it has at least one derivation.

---

## Lambda Calculus Reference

### Syntax of the Untyped Lambda Calculus

```
e ::= x            (variable)
    | lam x. e     (abstraction)
    | e1 e2        (application)
```

### Syntax of the Simply Typed Lambda Calculus (STLC)

```
Types:    T ::= B | T1 -> T2

Terms:    e ::= x | lam x : T. e | e1 e2 | c

Values:   v ::= lam x : T. e | c

Contexts: Gamma ::= . | Gamma, x : T
```

### Beta-Reduction

```
(lam x. e1) e2  ~>_beta  e1[x := e2]
```

### Reduction Strategies

| Strategy | Redex Selection |
|---|---|
| Full beta | Any redex, anywhere |
| Normal order | Leftmost, outermost redex first |
| Call-by-name (CBN) | Leftmost, outermost redex; no reduction under lambda |
| Call-by-value (CBV) | Leftmost, outermost redex; argument must be a value; no reduction under lambda |

### CBV Evaluation Rules

```
    e1 ~> e1'
    ---------------  [E-App1]
    e1 e2 ~> e1' e2

    e2 ~> e2'
    ---------------  [E-App2]
    v1 e2 ~> v1 e2'

    --------------------------------  [E-Beta]
    (lam x : T. e) v ~> e[x := v]
```

---

## Typing Rule Schemas

### Simply Typed Lambda Calculus

```
    x : T in Gamma
    ----------------  [T-Var]
    Gamma |- x : T

    Gamma, x : T1 |- e : T2
    ---------------------------  [T-Abs]
    Gamma |- (lam x : T1. e) : T1 -> T2

    Gamma |- e1 : T1 -> T2    Gamma |- e2 : T1
    ---------------------------------------------  [T-App]
    Gamma |- e1 e2 : T2
```

### Products and Sums

```
    Gamma |- e1 : T1    Gamma |- e2 : T2
    --------------------------------------  [T-Pair]
    Gamma |- (e1, e2) : T1 x T2

    Gamma |- e : T1 x T2
    ----------------------  [T-Fst]
    Gamma |- fst e : T1

    Gamma |- e : T1 x T2
    ----------------------  [T-Snd]
    Gamma |- snd e : T2

    Gamma |- e : T1
    -------------------------  [T-Inl]
    Gamma |- inl e : T1 + T2

    Gamma |- e : T2
    -------------------------  [T-Inr]
    Gamma |- inr e : T1 + T2

    Gamma |- e : T1 + T2    Gamma, x : T1 |- e1 : T    Gamma, y : T2 |- e2 : T
    -------------------------------------------------------------------------------  [T-Case]
    Gamma |- case e of inl x => e1 | inr y => e2 : T
```

### System F (Polymorphism)

```
    Gamma, a type |- e : T
    --------------------------------  [T-TAbs]
    Gamma |- (Lam a. e) : forall a. T

    Gamma |- e : forall a. T
    -------------------------  [T-TApp]
    Gamma |- e [S] : T[a := S]
```

### Let-Polymorphism (Hindley-Milner)

```
    Gamma |- e1 : S    Gamma, x : Gen(S, Gamma) |- e2 : T
    -------------------------------------------------------  [T-Let]
    Gamma |- let x = e1 in e2 : T
```

where Gen(S, Gamma) = forall a1 ... an. S, generalizing over type variables a1, ..., an that are free in S but not free in Gamma.

### Recursive Types (Iso-Recursive)

```
    Gamma |- e : T[a := mu a. T]
    --------------------------------  [T-Fold]
    Gamma |- fold e : mu a. T

    Gamma |- e : mu a. T
    --------------------------------  [T-Unfold]
    Gamma |- unfold e : T[a := mu a. T]
```

### Existential Types

```
    Gamma |- e : T[a := S]
    -----------------------------------  [T-Pack]
    Gamma |- pack (S, e) : exists a. T

    Gamma |- e1 : exists a. T    Gamma, a type, x : T |- e2 : U    a not in FV(U)
    ----------------------------------------------------------------------------------  [T-Unpack]
    Gamma |- let (a, x) = unpack e1 in e2 : U
```

### Dependent Function Types

```
    Gamma, x : A |- B : Type
    Gamma, x : A |- e : B
    ----------------------------------  [T-DLam]
    Gamma |- (lam x : A. e) : Pi(x : A). B

    Gamma |- e1 : Pi(x : A). B    Gamma |- e2 : A
    ------------------------------------------------  [T-DApp]
    Gamma |- e1 e2 : B[x := e2]
```

---

## Substitution and Binding

### Substitution Definition (Capture-Avoiding)

```
x[x := e]           = e
y[x := e]           = y                          (if y != x)
(e1 e2)[x := e]     = (e1[x := e]) (e2[x := e])
(lam x. e')[x := e] = lam x. e'                  (x is bound; no substitution)
(lam y. e')[x := e] = lam y. (e'[x := e])        (if y != x and y not in FV(e))
(lam y. e')[x := e] = lam z. (e'[y := z][x := e]) (if y in FV(e); z fresh)
```

### De Bruijn Index Notation

Variables are replaced by natural numbers counting the number of enclosing binders:

```
lam x. x              =>  lam. 0
lam x. lam y. x       =>  lam. lam. 1
lam x. lam y. y x     =>  lam. lam. 0 1
```

### De Bruijn Substitution and Shifting

Shift operation (increment free variables by d above cutoff c):

```
shift(d, c, k)       = k        if k < c
shift(d, c, k)       = k + d    if k >= c
shift(d, c, lam. e)  = lam. shift(d, c+1, e)
shift(d, c, e1 e2)   = shift(d, c, e1)  shift(d, c, e2)
```

Substitution with de Bruijn indices:

```
subst(j, s, k)       = s        if k = j
subst(j, s, k)       = k        if k != j
subst(j, s, lam. e)  = lam. subst(j+1, shift(1, 0, s), e)
subst(j, s, e1 e2)   = subst(j, s, e1)  subst(j, s, e2)
```

Beta-reduction with de Bruijn indices:

```
(lam. e1) e2  ~>  shift(-1, 0, subst(0, shift(1, 0, e2), e1))
```

---

## Structural Induction Templates

### Induction on Term Structure

To prove a property P(e) for all terms e:

1. **Base case (variable):** Show P(x) for all variables x.
2. **Inductive case (abstraction):** Assuming P(e) (induction hypothesis), show P(lam x : T. e).
3. **Inductive case (application):** Assuming P(e1) and P(e2), show P(e1 e2).
4. (Additional cases for other term constructors as needed.)

### Induction on Typing Derivations

To prove a property P(D) for all typing derivations D of Gamma |- e : T:

1. **Case T-Var:** D concludes with rule T-Var. Show P(D).
2. **Case T-Abs:** D concludes with rule T-Abs, with sub-derivation D' for the body. Assuming P(D') (induction hypothesis), show P(D).
3. **Case T-App:** D concludes with rule T-App, with sub-derivations D1 and D2. Assuming P(D1) and P(D2), show P(D).
4. (One case per typing rule in the system.)

### Induction on Reduction Sequences

To prove a property P(e ~>* e') for all multi-step reductions:

1. **Base case (reflexivity):** Show P(e ~>* e) for all e.
2. **Inductive case (transitivity):** If e ~> e'' and P(e'' ~>* e'), show P(e ~>* e').

---

## Key Theorems and Proof Patterns

### Type Safety (Progress + Preservation)

**Progress:** If |- e : T, then either e is a value or there exists e' such that e ~> e'.

*Proof pattern:* Induction on the typing derivation. In the T-App case, use the canonical forms lemma (if |- v : T1 -> T2, then v = lam x : T1. e for some e) to obtain the redex.

**Preservation (Subject Reduction):** If Gamma |- e : T and e ~> e', then Gamma |- e' : T.

*Proof pattern:* Induction on the typing derivation, with case analysis on the evaluation rule used. The key lemma is the substitution lemma: if Gamma, x : S |- e : T and Gamma |- v : S, then Gamma |- e[x := v] : T.

### Substitution Lemma

If Gamma, x : S |- e : T and Gamma |- e' : S, then Gamma |- e[x := e'] : T.

*Proof pattern:* Induction on the derivation of Gamma, x : S |- e : T.

### Canonical Forms Lemma

For each type T, characterize the possible values:

| Type T | Canonical Form |
|---|---|
| Bool | true or false |
| T1 -> T2 | lam x : T1. e |
| T1 x T2 | (v1, v2) |
| T1 + T2 | inl v or inr v |
| Unit | () |
| forall a. T | Lam a. e |
| mu a. T | fold v |

### Strong Normalization (Tait's Method)

**Theorem:** Every well-typed term in the simply typed lambda calculus is strongly normalizing.

*Proof sketch:*

1. Define a family of sets R_T (reducibility candidates) indexed by types:
   - R_B = {e : e is strongly normalizing} for base types B.
   - R_{T1 -> T2} = {e : for all e' in R_{T1}, (e e') in R_{T2}}.
2. Show that every reducibility candidate contains only strongly normalizing terms (CR1), is closed under reduction (CR2), and is closed under neutral expansion (CR3).
3. Show that every well-typed term e of type T belongs to R_T (the fundamental lemma), by induction on the typing derivation.
4. Conclude that e is strongly normalizing.

### Parametricity (Reynolds' Abstraction Theorem)

**Theorem:** If |- e : forall a. T, then for any types A, B and any relation R between A and B, the terms e[A] and e[B] are related by the relational interpretation of T at R.

The relational interpretation [[T]]_rho maps type-indexed relations to relations on terms:

| Type | Relational Interpretation |
|---|---|
| a | rho(a) (the relation assigned to variable a) |
| T1 -> T2 | (f, g) in [[T1 -> T2]] iff for all (x, y) in [[T1]], (f x, g y) in [[T2]] |
| forall a. T | (f, g) in [[forall a. T]] iff for all A, B, R, (f[A], g[B]) in [[T]]_{rho, a := R} |

---

## Subtyping Rules

### Standard Subtyping Rules

```
    ----------  [S-Refl]
    T <: T

    S <: U    U <: T
    ------------------  [S-Trans]
    S <: T

    ----------  [S-Top]
    T <: Top

    ----------  [S-Bot]
    Bot <: T

    T1 <: S1    S2 <: T2
    ----------------------  [S-Arrow]
    S1 -> S2 <: T1 -> T2

    (note: contravariant in domain, covariant in codomain)
```

### Record Subtyping

```
    {l1 : T1, ..., ln : Tn, l_{n+1} : T_{n+1}, ..., lm : Tm} <: {l1 : T1, ..., ln : Tn}
    [S-RcdWidth]
    (wider records are subtypes: more fields is more specific)

    for each i: Si <: Ti
    -----------------------------------------------  [S-RcdDepth]
    {l1 : S1, ..., ln : Sn} <: {l1 : T1, ..., ln : Tn}
    (subtypes in each field: deeper refinement)

    {l1 : T1, ..., ln : Tn} is a permutation of {k1 : S1, ..., kn : Sn}
    -----------------------------------------------------------------------  [S-RcdPerm]
    {l1 : T1, ..., ln : Tn} <: {k1 : S1, ..., kn : Sn}
```

### Subsumption Rule

```
    Gamma |- e : S    S <: T
    -------------------------  [T-Sub]
    Gamma |- e : T
```

---

## Logical Relations and Parametricity

### Logical Relations for Type Safety

Define the logical relation V[[T]] (value relation) and E[[T]] (expression relation):

```
V[[Bool]]     = {true, false}
V[[T1 -> T2]] = {lam x. e : for all v in V[[T1]], e[x := v] in E[[T2]]}
V[[T1 x T2]]  = {(v1, v2) : v1 in V[[T1]] and v2 in V[[T2]]}
E[[T]]        = {e : e ~>* v and v in V[[T]]}
```

**Fundamental Theorem:** If Gamma |- e : T and sigma models Gamma (i.e., sigma(x) in V[[Gamma(x)]] for all x in dom(Gamma)), then sigma(e) in E[[T]].

### Logical Relations for Equivalence

Two terms are logically related at type T (written e1 ~_T e2) if they are observationally indistinguishable at that type:

```
e1 ~_{T1 -> T2} e2  iff  for all v1 ~_{T1} v2, (e1 v1) ~_{T2} (e2 v2)
e1 ~_{forall a. T} e2  iff  for all types A, B, relation R, (e1[A]) ~_{T[R/a]} (e2[B])
```

---

## Proof Theory Correspondence

### Curry-Howard Correspondence Table

| Logic | Type Theory |
|---|---|
| Proposition | Type |
| Proof | Term (program) |
| Implication (A => B) | Function type (A -> B) |
| Conjunction (A and B) | Product type (A x B) |
| Disjunction (A or B) | Sum type (A + B) |
| Truth | Unit type |
| Falsity | Void (empty type) |
| Universal quantification (forall x. P(x)) | Dependent function type (Pi(x:A). B(x)) |
| Existential quantification (exists x. P(x)) | Dependent pair type (Sigma(x:A). B(x)) |
| Modus ponens | Function application |
| Lambda abstraction | Implication introduction |
| Proof of A and B | Pair (a, b) |
| Case analysis | Disjunction elimination |
| Proof normalization (cut elimination) | Beta-reduction (evaluation) |
| Hypothesis | Variable |
| Consistency (not everything provable) | Strong normalization (all programs terminate) |

### Natural Deduction Rules and Their Type-Theoretic Counterparts

| Natural Deduction Rule | Typing Rule |
|---|---|
| Implication introduction | T-Abs (lambda abstraction) |
| Implication elimination (modus ponens) | T-App (function application) |
| Conjunction introduction | T-Pair |
| Conjunction elimination (left/right) | T-Fst / T-Snd |
| Disjunction introduction (left/right) | T-Inl / T-Inr |
| Disjunction elimination | T-Case |
| Universal introduction | T-TAbs (type abstraction) |
| Universal elimination | T-TApp (type application) |
| Existential introduction | T-Pack |
| Existential elimination | T-Unpack |
