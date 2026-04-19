---
title: "Notation Reference"
tags:
  - type-theory
  - course-info
---
# Notation Reference

This document defines all notation used throughout the course. When in doubt, refer here.

## Terms and Variables

| Notation | Meaning |
|----------|---------|
| $x, y, z$ | Term variables |
| $t, s, u$ | Terms (metavariables ranging over terms) |
| $v, w$ | Values |
| $\lambda x. t$ | Lambda abstraction (function with parameter $x$ and body $t$) |
| $t_1\;t_2$ | Application of $t_1$ to $t_2$ |
| $\Lambda X. t$ | Type abstraction (System F) |
| $t\;[T]$ | Type application (System F) |
| $\text{let}\;x = t_1\;\text{in}\;t_2$ | Let binding |
| $\text{fix}\;t$ | Fixed-point operator |

## Types

| Notation | Meaning |
|----------|---------|
| $T, S, U$ | Types (metavariables) |
| $X, Y, Z$ | Type variables |
| $\text{Bool}$ | Boolean type |
| $\text{Nat}$ | Natural number type |
| $\text{Unit}$ | Unit type (single inhabitant $\text{unit}$) |
| $\text{Void}$ | Empty type (no inhabitants) |
| $T_1 \to T_2$ | Function (arrow) type |
| $T_1 \times T_2$ | Product type |
| $T_1 + T_2$ | Sum type |
| $\{l_1 : T_1, \ldots, l_n : T_n\}$ | Record type |
| $\langle l_1 : T_1, \ldots, l_n : T_n \rangle$ | Variant type |
| $\text{Ref}\;T$ | Reference type |
| $\mu X. T$ | Recursive type |
| $\forall X. T$ | Universal type (System F) |
| $\exists X. T$ | Existential type |
| $\forall X <: T_1. T_2$ | Bounded universal type (F-sub) |
| $\Pi(x : A). B$ | Dependent function type (Pi type) |
| $\Sigma(x : A). B$ | Dependent pair type (Sigma type) |
| $A \multimap B$ | Linear function type |
| $A \otimes B$ | Multiplicative conjunction (tensor) |
| $!A$ | Exponential modality ("of course") |

## Kinds

| Notation | Meaning |
|----------|---------|
| $K$ | Kind (metavariable) |
| $*$ | The kind of proper types |
| $K_1 \Rightarrow K_2$ | The kind of type operators from $K_1$ to $K_2$ |

## Contexts

| Notation | Meaning |
|----------|---------|
| $\Gamma$ | Typing context (maps variables to types) |
| $\emptyset$ or $\cdot$ | Empty context |
| $\Gamma, x : T$ | Context extended with binding $x : T$ |
| $\Delta$ | Kinding context (maps type variables to kinds) |
| $\Sigma$ | Store typing (maps locations to types) |
| $\text{dom}(\Gamma)$ | Domain of context $\Gamma$ |

## Judgments

| Notation | Meaning |
|----------|---------|
| $\Gamma \vdash t : T$ | Term $t$ has type $T$ in context $\Gamma$ |
| $\vdash t : T$ | Closed typing (empty context) |
| $\Delta \vdash T :: K$ | Type $T$ has kind $K$ in kinding context $\Delta$ |
| $t \longrightarrow t'$ | $t$ reduces to $t'$ in one step |
| $t \longrightarrow^* t'$ | $t$ reduces to $t'$ in zero or more steps |
| $t \Downarrow v$ | $t$ evaluates to value $v$ (big-step) |
| $S <: T$ | $S$ is a subtype of $T$ |
| $T \equiv S$ | Types $T$ and $S$ are definitionally equal |
| $A\;\text{type}$ | $A$ is a well-formed type |
| $a : A$ | $a$ is a term of type $A$ |

## Substitution

| Notation | Meaning |
|----------|---------|
| $[x \mapsto s]\,t$ | Substitute $s$ for $x$ in $t$ |
| $[X \mapsto S]\,T$ | Substitute type $S$ for type variable $X$ in $T$ |
| $\sigma$ | A substitution (finite map from variables to terms) |
| $\sigma(t)$ | Apply substitution $\sigma$ to $t$ |
| $\text{FV}(t)$ | Free variables of $t$ |
| $\text{FTV}(T)$ | Free type variables of $T$ |

## Inference Rules

We write inference rules in the standard format:

$$\frac{\text{premise}_1 \quad \text{premise}_2 \quad \ldots \quad \text{premise}_n}{\text{conclusion}} \quad \text{(Rule-Name)}$$

An axiom (rule with no premises):

$$\frac{}{\text{conclusion}} \quad \text{(Axiom-Name)}$$

## Lambda Calculus

| Notation | Meaning |
|----------|---------|
| $\alpha$-equivalence | Terms equal up to renaming of bound variables |
| $\beta$-reduction | $(\lambda x. t)\;s \longrightarrow [x \mapsto s]\,t$ |
| $\eta$-reduction | $\lambda x. t\;x \longrightarrow t$ (when $x \notin \text{FV}(t)$) |
| NF | Normal form (no further reductions possible) |
| WHNF | Weak head normal form |
| HNF | Head normal form |
| CBV | Call-by-value evaluation strategy |
| CBN | Call-by-name evaluation strategy |

## Church Encodings

| Notation | Meaning |
|----------|---------|
| $c_n$ | Church numeral for $n$: $\lambda s.\lambda z. s^n\;z$ |
| $\text{tru}$ | Church true: $\lambda t.\lambda f. t$ |
| $\text{fls}$ | Church false: $\lambda t.\lambda f. f$ |

## Type Safety Theorems

| Theorem | Statement |
|---------|-----------|
| Progress | If $\vdash t : T$, then $t$ is a value or $\exists t'.\; t \longrightarrow t'$ |
| Preservation | If $\Gamma \vdash t : T$ and $t \longrightarrow t'$, then $\Gamma \vdash t' : T$ |
| Canonical Forms | If $\vdash v : T_1 \to T_2$, then $v = \lambda x. t$ for some $x, t$ |
| Substitution Lemma | If $\Gamma, x:S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\,t : T$ |
| Normalization | Every well-typed term in STLC reduces to a value (strong normalization) |

## Logic (Curry-Howard)

| Logic | Type Theory |
|-------|-------------|
| Proposition | Type |
| Proof | Term |
| Implication $A \to B$ | Function type $A \to B$ |
| Conjunction $A \land B$ | Product type $A \times B$ |
| Disjunction $A \lor B$ | Sum type $A + B$ |
| Truth $\top$ | Unit type |
| Falsity $\bot$ | Void type |
| Universal $\forall x. P(x)$ | Pi type $\Pi(x:A). B(x)$ |
| Existential $\exists x. P(x)$ | Sigma type $\Sigma(x:A). B(x)$ |
| Proof normalization | $\beta$-reduction |

## Session Types

| Notation | Meaning |
|----------|---------|
| $!T.S$ | Send a value of type $T$, continue as $S$ |
| $?T.S$ | Receive a value of type $T$, continue as $S$ |
| $S_1 \oplus S_2$ | Internal choice |
| $S_1 \mathbin{\&} S_2$ | External choice |
| $\text{end}$ | Session end |
| $\overline{S}$ | Dual of session type $S$ |

## Common Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| STLC | Simply typed lambda calculus |
| TAPL | *Types and Programming Languages* (Pierce) |
| PFPL | *Practical Foundations for Programming Languages* (Harper) |
| HM | Hindley-Milner type system |
| MGU | Most general unifier |
| PTS | Pure type system |
| CoC | Calculus of Constructions |
| CIC | Calculus of Inductive Constructions |
| HoTT | Homotopy type theory |
| NbE | Normalization by evaluation |
| ADT | Algebraic data type |
| GADT | Generalized algebraic data type |
| BHK | Brouwer-Heyting-Kolmogorov (interpretation) |
| ILL | Intuitionistic linear logic |
| CLL | Classical linear logic |
