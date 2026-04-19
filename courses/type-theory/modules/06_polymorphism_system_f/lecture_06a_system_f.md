---
title: "Lecture 06a: System F -- Universal Types"
tags:
  - type-theory
  - system-f
  - lecture
---
# Lecture 06a: System F -- Universal Types

> **Module 06 --- Polymorphism & System F (Weeks 11--12)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Articulate** the limitations of the simply typed lambda calculus that motivate polymorphism.
2. **Distinguish** ad hoc polymorphism from parametric polymorphism and explain why the latter is the focus of System F.
3. **Write** the formal syntax of System F, including type abstraction ($\Lambda X.\, t$) and type application ($t\;[T]$).
4. **State and apply** the typing rules T-TAbs, T-TApp, and the associated evaluation rules for System F.
5. **Construct** polymorphic terms such as the polymorphic identity, polymorphic pairs, and polymorphic Church encodings.
6. **Encode** booleans, natural numbers, pairs, and lists as pure System F terms using universal types.
7. **Demonstrate** that System F is strictly more expressive than the STLC by exhibiting terms typable in System F but not in the STLC.
8. **Describe** the independent discovery of System F by Girard (1972) and Reynolds (1974) and the distinct motivations of each.

---

## 1. Motivation

### 1.1 The Repetition Problem in STLC

In the simply typed lambda calculus, every function has a fixed, monomorphic type. Consider the identity function. To apply it to a boolean, we need:

$$\text{id}_{\text{Bool}} = \lambda x : \text{Bool}.\, x \quad:\quad \text{Bool} \to \text{Bool}$$

To apply it to a natural number, we need a separate definition:

$$\text{id}_{\text{Nat}} = \lambda x : \text{Nat}.\, x \quad:\quad \text{Nat} \to \text{Nat}$$

And to apply it to a function type:

$$\text{id}_{\text{Bool} \to \text{Bool}} = \lambda x : \text{Bool} \to \text{Bool}.\, x \quad:\quad (\text{Bool} \to \text{Bool}) \to (\text{Bool} \to \text{Bool})$$

Each of these terms is syntactically identical except for the type annotation, yet the STLC provides no mechanism to abstract over this pattern. We are forced to duplicate code for every type at which we wish to use the identity function. This is not merely an inconvenience; it represents a fundamental limitation of the type system's expressive power.

### 1.2 What We Want

We want a single term that behaves as the identity function at every type:

$$\text{id} : \forall X.\, X \to X$$

The type $\forall X.\, X \to X$ says: "for every type $X$, this term accepts a value of type $X$ and returns a value of type $X$." The $\forall$ quantifies over types, not over values.

More generally, we want the ability to:

1. **Abstract over types**: write a term parameterized by a type variable $X$.
2. **Instantiate type abstractions**: apply a polymorphic term to a specific type.
3. **Quantify universally**: express that a term works for all types.

### 1.3 Polymorphism in Practice

Polymorphism is ubiquitous in modern programming languages:

- **ML/OCaml**: `let id x = x` has type `'a -> 'a`.
- **Haskell**: `id :: a -> a`.
- **Rust**: `fn id<T>(x: T) -> T { x }`.
- **Java**: `<T> T id(T x) { return x; }`.

In each case, the language provides some mechanism for abstracting over types. System F is the foundational calculus that makes this precise.

### 1.4 Ad Hoc vs. Parametric Polymorphism

There are two fundamentally different notions of polymorphism:

**Ad hoc polymorphism** (Strachey, 1967) allows a function to have different implementations for different types. The canonical example is overloaded arithmetic: `+` might denote integer addition on `Int` arguments and floating-point addition on `Float` arguments. The behavior changes depending on the type. Type classes (Haskell), traits (Rust), and method overloading (Java) are all mechanisms for ad hoc polymorphism.

**Parametric polymorphism** (Strachey, 1967) requires a function to behave uniformly across all types. The function cannot inspect the type at which it is instantiated; it must treat values of the type parameter as opaque. The identity function is parametrically polymorphic: it returns its argument unchanged regardless of its type.

System F formalizes parametric polymorphism. The uniformity constraint is not merely a convention; it is enforced by the type system. As we shall see in Lecture 06d, this enforcement yields powerful reasoning principles (parametricity, free theorems).

**Remark.** The distinction matters for reasoning. If $f : \forall X.\, X \to X$ is parametrically polymorphic, then $f$ must be the identity function (we prove this in Lecture 06d). If $f$ were ad hoc polymorphic, it could be any function of the appropriate type at each instantiation, and no such conclusion would follow.

---

## 2. Core Theory

### 2.1 Syntax of System F

System F extends the simply typed lambda calculus with two new term forms and one new type form.

**Definition 2.1 (System F syntax).** The syntax of System F is defined by the following grammar:

*Types:*

$$T \;::=\; X \;\mid\; T_1 \to T_2 \;\mid\; \forall X.\, T$$

where $X$ ranges over a countably infinite set of type variables.

*Terms:*

$$t \;::=\; x \;\mid\; \lambda x : T.\, t \;\mid\; t_1\; t_2 \;\mid\; \Lambda X.\, t \;\mid\; t\;[T]$$

*Values:*

$$v \;::=\; \lambda x : T.\, t \;\mid\; \Lambda X.\, t$$

The three syntactic categories are:

1. **Types**: type variables $X$, function types $T_1 \to T_2$, and universal types $\forall X.\, T$.
2. **Terms**: variables $x$, lambda abstractions $\lambda x : T.\, t$, applications $t_1\; t_2$, type abstractions $\Lambda X.\, t$, and type applications $t\;[T]$.
3. **Values**: lambda abstractions and type abstractions.

Note the two levels of abstraction and application:

| Level | Abstraction | Application | Binding |
|-------|------------|-------------|---------|
| Term level | $\lambda x : T.\, t$ | $t_1\; t_2$ | Binds term variable $x$ |
| Type level | $\Lambda X.\, t$ | $t\;[T]$ | Binds type variable $X$ |

**Notation.** We write $\Lambda$ (capital lambda) for type abstraction to distinguish it from $\lambda$ (lowercase lambda) for term abstraction. Some authors write $\lambda X.\, t$ for type abstraction and rely on context to disambiguate; we follow TAPL in using distinct symbols.

**Convention.** As with term-level lambda, we identify types and terms up to alpha-equivalence. The type variable $X$ in $\forall X.\, T$ and $\Lambda X.\, t$ is a binding occurrence; we may rename it freely. For instance, $\forall X.\, X \to X$ and $\forall Y.\, Y \to Y$ are the same type.

**Remark.** System F is also called the **polymorphic lambda calculus** or the **second-order lambda calculus**. Girard called it "System F" (systeme F) in his thesis; the "F" is thought to stand for "fonctionnel" (functional). Reynolds independently called his version the "second-order typed lambda calculus."

### 2.2 Free and Bound Type Variables

**Definition 2.2 (Free type variables).** The set of free type variables of a type $T$, denoted $\text{FTV}(T)$, is defined by:

$$\text{FTV}(X) = \{X\}$$

$$\text{FTV}(T_1 \to T_2) = \text{FTV}(T_1) \cup \text{FTV}(T_2)$$

$$\text{FTV}(\forall X.\, T) = \text{FTV}(T) \setminus \{X\}$$

The free type variables of a term are defined by:

$$\text{FTV}(x) = \emptyset$$

$$\text{FTV}(\lambda x : T.\, t) = \text{FTV}(T) \cup \text{FTV}(t)$$

$$\text{FTV}(t_1\; t_2) = \text{FTV}(t_1) \cup \text{FTV}(t_2)$$

$$\text{FTV}(\Lambda X.\, t) = \text{FTV}(t) \setminus \{X\}$$

$$\text{FTV}(t\;[T]) = \text{FTV}(t) \cup \text{FTV}(T)$$

A type $T$ is **closed** if $\text{FTV}(T) = \emptyset$. A term $t$ is **closed** if both $\text{FV}(t) = \emptyset$ (no free term variables) and $\text{FTV}(t) = \emptyset$ (no free type variables).

### 2.3 Type Substitution

**Definition 2.3 (Type substitution).** The capture-avoiding substitution of type $S$ for type variable $X$ in type $T$, written $[X \mapsto S]\,T$, is defined by:

$$[X \mapsto S]\,X = S$$

$$[X \mapsto S]\,Y = Y \quad\text{if } Y \neq X$$

$$[X \mapsto S]\,(T_1 \to T_2) = ([X \mapsto S]\,T_1) \to ([X \mapsto S]\,T_2)$$

$$[X \mapsto S]\,(\forall X.\, T) = \forall X.\, T$$

$$[X \mapsto S]\,(\forall Y.\, T) = \forall Y.\, [X \mapsto S]\,T \quad\text{if } Y \neq X \text{ and } Y \notin \text{FTV}(S)$$

The last clause requires the Barendregt convention: we assume bound variables are always chosen to be distinct from free variables in the types being substituted. If $Y \in \text{FTV}(S)$, we first alpha-rename $\forall Y.\, T$ to $\forall Z.\, [Y \mapsto Z]\,T$ for a fresh $Z$.

Type substitution extends to terms:

$$[X \mapsto S]\,x = x$$

$$[X \mapsto S]\,(\lambda x : T.\, t) = \lambda x : [X \mapsto S]\,T.\, [X \mapsto S]\,t$$

$$[X \mapsto S]\,(t_1\; t_2) = ([X \mapsto S]\,t_1)\; ([X \mapsto S]\,t_2)$$

$$[X \mapsto S]\,(\Lambda X.\, t) = \Lambda X.\, t$$

$$[X \mapsto S]\,(\Lambda Y.\, t) = \Lambda Y.\, [X \mapsto S]\,t \quad\text{if } Y \neq X$$

$$[X \mapsto S]\,(t\;[T]) = ([X \mapsto S]\,t)\;[[X \mapsto S]\,T]$$

### 2.4 Typing Contexts

In the STLC, a typing context $\Gamma$ maps term variables to types. In System F, we must also track which type variables are in scope.

**Definition 2.4 (System F typing context).** A typing context $\Gamma$ is a sequence of bindings of two kinds:

1. **Term variable bindings**: $x : T$ (as in the STLC).
2. **Type variable bindings**: $X$ (declares that $X$ is a type variable in scope).

Formally:

$$\Gamma \;::=\; \emptyset \;\mid\; \Gamma, x : T \;\mid\; \Gamma, X$$

A context is **well-formed** if:

- Each term variable $x$ appears at most once.
- Each type variable $X$ appears at most once.
- In a binding $x : T$, all free type variables of $T$ are bound earlier in $\Gamma$.

**Definition 2.5 (Well-formed types).** We write $\Gamma \vdash T$ to mean that type $T$ is well-formed under context $\Gamma$, defined by:

$$\frac{X \in \Gamma}{\Gamma \vdash X} \quad\text{(WF-Var)}$$

$$\frac{\Gamma \vdash T_1 \quad \Gamma \vdash T_2}{\Gamma \vdash T_1 \to T_2} \quad\text{(WF-Arrow)}$$

$$\frac{\Gamma, X \vdash T}{\Gamma \vdash \forall X.\, T} \quad\text{(WF-All)}$$

### 2.5 Typing Rules

**Definition 2.6 (System F typing rules).** The typing judgment $\Gamma \vdash t : T$ is defined by the following rules:

$$\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \quad\text{(T-Var)}$$

$$\frac{\Gamma, x : T_1 \vdash t : T_2}{\Gamma \vdash \lambda x : T_1.\, t : T_1 \to T_2} \quad\text{(T-Abs)}$$

$$\frac{\Gamma \vdash t_1 : T_1 \to T_2 \quad \Gamma \vdash t_2 : T_1}{\Gamma \vdash t_1\; t_2 : T_2} \quad\text{(T-App)}$$

$$\frac{\Gamma, X \vdash t : T}{\Gamma \vdash \Lambda X.\, t : \forall X.\, T} \quad\text{(T-TAbs)}$$

$$\frac{\Gamma \vdash t : \forall X.\, T}{\Gamma \vdash t\;[S] : [X \mapsto S]\,T} \quad\text{(T-TApp)}$$

The first three rules are inherited from the STLC. The two new rules are:

**T-TAbs (Type Abstraction).** If, in a context extended with type variable $X$, the term $t$ has type $T$, then the type abstraction $\Lambda X.\, t$ has the universal type $\forall X.\, T$. The type variable $X$ must not already appear in $\Gamma$ (ensured by our well-formedness convention).

**T-TApp (Type Application).** If $t$ has a universal type $\forall X.\, T$, then applying $t$ to type $S$ yields a term of type $[X \mapsto S]\,T$ --- the result of substituting $S$ for $X$ in $T$. This is the elimination rule for $\forall$: we "open" the universal quantifier by providing a specific type.

**Remark.** In T-TApp, we require $\Gamma \vdash S$ (the type $S$ is well-formed in $\Gamma$), though we omit this premise for readability. Some presentations make it explicit.

### 2.6 Evaluation Rules

**Definition 2.7 (System F evaluation).** The call-by-value evaluation relation $t \to t'$ is defined by:

$$\frac{}{(\lambda x : T.\, t)\; v \to [x \mapsto v]\,t} \quad\text{(E-AppAbs)}$$

$$\frac{}{(\Lambda X.\, t)\;[T] \to [X \mapsto T]\,t} \quad\text{(E-TAppTAbs)}$$

$$\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad\text{(E-App1)}$$

$$\frac{t_2 \to t_2'}{v_1\; t_2 \to v_1\; t_2'} \quad\text{(E-App2)}$$

$$\frac{t \to t'}{t\;[T] \to t'\;[T]} \quad\text{(E-TApp)}$$

The key new rule is E-TAppTAbs, the **type-level beta reduction**: applying a type abstraction $\Lambda X.\, t$ to a type $T$ substitutes $T$ for $X$ throughout $t$. This is the type-level analogue of the term-level beta reduction $(\lambda x : T.\, t)\; v \to [x \mapsto v]\,t$.

**Remark.** Type application is an operation on terms, not on types. The term $(\Lambda X.\, t)\;[T]$ reduces to $[X \mapsto T]\,t$, which is a term. At runtime, the type argument $T$ is "erased" --- it plays no computational role beyond guiding the type checker. This is the basis for **type erasure** in languages like ML and Haskell: polymorphic type information can be removed after type checking without changing the program's behavior.

### 2.7 The Polymorphic Identity Function

The simplest polymorphic term is the identity function:

$$\text{id} = \Lambda X.\, \lambda x : X.\, x$$

**Typing derivation.** We derive $\vdash \text{id} : \forall X.\, X \to X$:

$$\frac{\frac{\frac{x : X \in (X, x : X)}{X, x : X \vdash x : X}\;\text{T-Var}}{X \vdash \lambda x : X.\, x : X \to X}\;\text{T-Abs}}{\vdash \Lambda X.\, \lambda x : X.\, x : \forall X.\, X \to X}\;\text{T-TAbs}$$

**Instantiation.** To use $\text{id}$ at type $\text{Nat}$:

$$\text{id}\;[\text{Nat}]\; 5 \to (\lambda x : \text{Nat}.\, x)\; 5 \to 5$$

Step by step:

1. $\text{id}\;[\text{Nat}] = (\Lambda X.\, \lambda x : X.\, x)\;[\text{Nat}] \to [X \mapsto \text{Nat}]\,(\lambda x : X.\, x) = \lambda x : \text{Nat}.\, x$ (by E-TAppTAbs).
2. $(\lambda x : \text{Nat}.\, x)\; 5 \to [x \mapsto 5]\,x = 5$ (by E-AppAbs).

The typing of the full application:

$$\frac{\frac{\vdash \text{id} : \forall X.\, X \to X}{\vdash \text{id}\;[\text{Nat}] : \text{Nat} \to \text{Nat}}\;\text{T-TApp} \quad \vdash 5 : \text{Nat}}{\vdash \text{id}\;[\text{Nat}]\; 5 : \text{Nat}}\;\text{T-App}$$

### 2.8 More Polymorphic Examples

**Example 2.8 (Self-application).** In the untyped lambda calculus, the term $\omega = \lambda x.\, x\; x$ is well-formed but untypable in the STLC (typing it requires $T = T \to S$, leading to an infinite type). In System F, we can type a "controlled" form of self-application:

$$\text{selfApp} = \lambda x : (\forall X.\, X \to X).\, x\;[\forall X.\, X \to X]\; x$$

This has type $(\forall X.\, X \to X) \to (\forall X.\, X \to X)$. The key insight is that $x$ has universal type, so it can be instantiated at its own type.

**Derivation.** Let $\Gamma = x : \forall X.\, X \to X$.

$$\frac{\frac{\Gamma \vdash x : \forall X.\, X \to X}{\Gamma \vdash x\;[\forall X.\, X \to X] : (\forall X.\, X \to X) \to (\forall X.\, X \to X)}\;\text{T-TApp} \quad \Gamma \vdash x : \forall X.\, X \to X}{\Gamma \vdash x\;[\forall X.\, X \to X]\; x : \forall X.\, X \to X}\;\text{T-App}$$

Then by T-Abs:

$$\vdash \text{selfApp} : (\forall X.\, X \to X) \to (\forall X.\, X \to X)$$

This term is typable in System F but not in the STLC, demonstrating that System F is strictly more expressive.

**Example 2.9 (Polymorphic composition).** Function composition can be given a polymorphic type:

$$\text{compose} = \Lambda X.\, \Lambda Y.\, \Lambda Z.\, \lambda g : Y \to Z.\, \lambda f : X \to Y.\, \lambda x : X.\, g\;(f\;x)$$

$$\text{compose} : \forall X.\, \forall Y.\, \forall Z.\, (Y \to Z) \to (X \to Y) \to X \to Z$$

**Example 2.10 (Polymorphic apply).** The application combinator:

$$\text{apply} = \Lambda X.\, \Lambda Y.\, \lambda f : X \to Y.\, \lambda x : X.\, f\; x$$

$$\text{apply} : \forall X.\, \forall Y.\, (X \to Y) \to X \to Y$$

**Example 2.11 (Polymorphic flip).** Argument swapping:

$$\text{flip} = \Lambda X.\, \Lambda Y.\, \Lambda Z.\, \lambda f : X \to Y \to Z.\, \lambda y : Y.\, \lambda x : X.\, f\; x\; y$$

$$\text{flip} : \forall X.\, \forall Y.\, \forall Z.\, (X \to Y \to Z) \to Y \to X \to Z$$

**Example 2.12 (Polymorphic constant function).** The combinator $K$ (constant):

$$\text{const} = \Lambda X.\, \Lambda Y.\, \lambda x : X.\, \lambda y : Y.\, x$$

$$\text{const} : \forall X.\, \forall Y.\, X \to Y \to X$$

Under the Curry-Howard correspondence, this type corresponds to the tautology $A \implies B \implies A$ (a true statement is still true regardless of any additional hypothesis).

**Example 2.13 (Detailed derivation for composition).** Let us give the complete typing derivation for $\text{compose}$. Let $\Gamma_0 = X, Y, Z, g : Y \to Z, f : X \to Y, x : X$.

The innermost application $f\;x$:

$$\frac{\Gamma_0 \vdash f : X \to Y \quad \Gamma_0 \vdash x : X}{\Gamma_0 \vdash f\;x : Y}\;\text{T-App}$$

Then $g\;(f\;x)$:

$$\frac{\Gamma_0 \vdash g : Y \to Z \quad \Gamma_0 \vdash f\;x : Y}{\Gamma_0 \vdash g\;(f\;x) : Z}\;\text{T-App}$$

Now we abstract over $x$, $f$, $g$, $Z$, $Y$, $X$ (from inside out):

$$\frac{\Gamma_0 \vdash g\;(f\;x) : Z}{X, Y, Z, g : Y \to Z, f : X \to Y \vdash \lambda x : X.\, g\;(f\;x) : X \to Z}\;\text{T-Abs}$$

$$\frac{\vdots}{X, Y, Z, g : Y \to Z \vdash \lambda f : X \to Y.\, \lambda x : X.\, g\;(f\;x) : (X \to Y) \to X \to Z}\;\text{T-Abs}$$

$$\frac{\vdots}{X, Y, Z \vdash \lambda g : Y \to Z.\, \lambda f : X \to Y.\, \lambda x : X.\, g\;(f\;x) : (Y \to Z) \to (X \to Y) \to X \to Z}\;\text{T-Abs}$$

$$\frac{\vdots}{X, Y \vdash \Lambda Z.\, \cdots : \forall Z.\, (Y \to Z) \to (X \to Y) \to X \to Z}\;\text{T-TAbs}$$

$$\frac{\vdots}{X \vdash \Lambda Y.\, \Lambda Z.\, \cdots : \forall Y.\, \forall Z.\, (Y \to Z) \to (X \to Y) \to X \to Z}\;\text{T-TAbs}$$

$$\frac{\vdots}{\vdash \Lambda X.\, \Lambda Y.\, \Lambda Z.\, \cdots : \forall X.\, \forall Y.\, \forall Z.\, (Y \to Z) \to (X \to Y) \to X \to Z}\;\text{T-TAbs}$$

**Operational example for compose.** Let $\text{isPos} : \text{Nat} \to \text{Bool}$ and $\text{length} : \forall A.\, \text{List}\;A \to \text{Nat}$. Then:

$$\text{compose}\;[\text{List}\;\text{Nat}]\;[\text{Nat}]\;[\text{Bool}]\;\text{isPos}\;(\text{length}\;[\text{Nat}])$$

reduces to:

$$\lambda x : \text{List}\;\text{Nat}.\, \text{isPos}\;(\text{length}\;[\text{Nat}]\;x)$$

The three type applications instantiate $X = \text{List}\;\text{Nat}$, $Y = \text{Nat}$, $Z = \text{Bool}$, and the two term applications supply the functions. The result is a function that checks whether a list of natural numbers has positive length.

### 2.9 Polymorphic Data Structures

#### 2.9.1 Polymorphic Pairs

We can define a polymorphic pair type and its operations:

$$\text{Pair} = \Lambda X.\, \Lambda Y.\, \lambda x : X.\, \lambda y : Y.\, \Lambda R.\, \lambda f : X \to Y \to R.\, f\; x\; y$$

$$\text{Pair} : \forall X.\, \forall Y.\, X \to Y \to (\forall R.\, (X \to Y \to R) \to R)$$

The type $\forall R.\, (X \to Y \to R) \to R$ is the Church encoding of the pair type $X \times Y$ in System F. A pair is represented as a function that takes a "destructor" $f : X \to Y \to R$ and applies it to the two components.

The projections:

$$\text{fst} = \Lambda X.\, \Lambda Y.\, \lambda p : (\forall R.\, (X \to Y \to R) \to R).\, p\;[X]\; (\lambda x : X.\, \lambda y : Y.\, x)$$

$$\text{fst} : \forall X.\, \forall Y.\, (\forall R.\, (X \to Y \to R) \to R) \to X$$

$$\text{snd} = \Lambda X.\, \Lambda Y.\, \lambda p : (\forall R.\, (X \to Y \to R) \to R).\, p\;[Y]\; (\lambda x : X.\, \lambda y : Y.\, y)$$

$$\text{snd} : \forall X.\, \forall Y.\, (\forall R.\, (X \to Y \to R) \to R) \to Y$$

**Verification.** Let us check that $\text{fst}$ correctly extracts the first component:

$$\text{fst}\;[A]\;[B]\; (\text{Pair}\;[A]\;[B]\; a\; b)$$

First, $\text{Pair}\;[A]\;[B]\; a\; b$ reduces to:

$$\Lambda R.\, \lambda f : A \to B \to R.\, f\; a\; b$$

Then $\text{fst}\;[A]\;[B]$ applied to this pair gives:

$$(\Lambda R.\, \lambda f : A \to B \to R.\, f\; a\; b)\;[A]\; (\lambda x : A.\, \lambda y : B.\, x)$$

$$\to (\lambda f : A \to B \to A.\, f\; a\; b)\; (\lambda x : A.\, \lambda y : B.\, x)$$

$$\to (\lambda x : A.\, \lambda y : B.\, x)\; a\; b$$

$$\to (\lambda y : B.\, a)\; b$$

$$\to a$$

as expected.

#### 2.9.2 Polymorphic Lists

We can encode lists using the Church encoding. The type of lists with elements of type $X$ is:

$$\text{List}\;X = \forall R.\, R \to (X \to R \to R) \to R$$

This represents a list as its fold function: given a base case (of type $R$, corresponding to the empty list) and a combining function (of type $X \to R \to R$, corresponding to cons), produce a result of type $R$.

The constructors:

$$\text{nil} = \Lambda X.\, \Lambda R.\, \lambda n : R.\, \lambda c : X \to R \to R.\, n$$

$$\text{nil} : \forall X.\, \forall R.\, R \to (X \to R \to R) \to R$$

$$\text{cons} = \Lambda X.\, \lambda h : X.\, \lambda t : (\forall R.\, R \to (X \to R \to R) \to R).\, \Lambda R.\, \lambda n : R.\, \lambda c : X \to R \to R.\, c\; h\; (t\;[R]\; n\; c)$$

**Example.** The list $[3, 1, 2]$ is encoded as:

$$\text{cons}\;[\text{Nat}]\; 3\; (\text{cons}\;[\text{Nat}]\; 1\; (\text{cons}\;[\text{Nat}]\; 2\; (\text{nil}\;[\text{Nat}])))$$

We can define $\text{map}$:

$$\text{map} = \Lambda X.\, \Lambda Y.\, \lambda f : X \to Y.\, \lambda l : \text{List}\;X.\, \Lambda R.\, \lambda n : R.\, \lambda c : Y \to R \to R.\, l\;[R]\; n\; (\lambda x : X.\, \lambda r : R.\, c\; (f\; x)\; r)$$

$$\text{map} : \forall X.\, \forall Y.\, (X \to Y) \to \text{List}\;X \to \text{List}\;Y$$

---

## 3. Church Encodings in System F

### 3.1 Church Booleans

In the untyped lambda calculus, Church booleans are $\text{true} = \lambda t.\, \lambda f.\, t$ and $\text{false} = \lambda t.\, \lambda f.\, f$. In System F, we can give these precise types.

**Definition 3.1 (Church booleans in System F).**

$$\text{CBool} = \forall X.\, X \to X \to X$$

$$\text{tru} = \Lambda X.\, \lambda t : X.\, \lambda f : X.\, t \quad:\quad \text{CBool}$$

$$\text{fls} = \Lambda X.\, \lambda t : X.\, \lambda f : X.\, f \quad:\quad \text{CBool}$$

A Church boolean is a function that takes two arguments of the same type and returns one of them: $\text{tru}$ returns the first, $\text{fls}$ returns the second.

**Boolean operations:**

$$\text{not} = \lambda b : \text{CBool}.\, \Lambda X.\, \lambda t : X.\, \lambda f : X.\, b\;[X]\; f\; t$$

$$\text{not} : \text{CBool} \to \text{CBool}$$

$$\text{and} = \lambda a : \text{CBool}.\, \lambda b : \text{CBool}.\, \Lambda X.\, \lambda t : X.\, \lambda f : X.\, a\;[X]\; (b\;[X]\; t\; f)\; f$$

$$\text{and} : \text{CBool} \to \text{CBool} \to \text{CBool}$$

$$\text{or} = \lambda a : \text{CBool}.\, \lambda b : \text{CBool}.\, \Lambda X.\, \lambda t : X.\, \lambda f : X.\, a\;[X]\; t\; (b\;[X]\; t\; f)$$

$$\text{or} : \text{CBool} \to \text{CBool} \to \text{CBool}$$

**Conditional:**

$$\text{if} = \Lambda X.\, \lambda b : \text{CBool}.\, \lambda t : X.\, \lambda f : X.\, b\;[X]\; t\; f$$

$$\text{if} : \forall X.\, \text{CBool} \to X \to X \to X$$

**Verification.** $\text{not}\;\text{tru}$:

$$\text{not}\;\text{tru} = \Lambda X.\, \lambda t : X.\, \lambda f : X.\, \text{tru}\;[X]\; f\; t$$

$$\to \Lambda X.\, \lambda t : X.\, \lambda f : X.\, (\lambda t' : X.\, \lambda f' : X.\, t')\; f\; t$$

$$\to \Lambda X.\, \lambda t : X.\, \lambda f : X.\, f = \text{fls}$$

### 3.2 Church Numerals

**Definition 3.2 (Church numerals in System F).**

$$\text{CNat} = \forall X.\, (X \to X) \to X \to X$$

A Church numeral $n$ takes a function $s$ (successor) and a base value $z$ (zero) and applies $s$ to $z$ exactly $n$ times:

$$\bar{0} = \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, z$$

$$\bar{1} = \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, s\; z$$

$$\bar{2} = \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, s\; (s\; z)$$

$$\bar{n} = \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, \underbrace{s\; (s\; (\cdots (s}_{n}\; z) \cdots))$$

All of these have type $\text{CNat}$.

**Arithmetic operations:**

$$\text{succ} = \lambda n : \text{CNat}.\, \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, s\; (n\;[X]\; s\; z)$$

$$\text{succ} : \text{CNat} \to \text{CNat}$$

$$\text{plus} = \lambda m : \text{CNat}.\, \lambda n : \text{CNat}.\, \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, m\;[X]\; s\; (n\;[X]\; s\; z)$$

$$\text{plus} : \text{CNat} \to \text{CNat} \to \text{CNat}$$

$$\text{times} = \lambda m : \text{CNat}.\, \lambda n : \text{CNat}.\, \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, m\;[X]\; (n\;[X]\; s)\; z$$

$$\text{times} : \text{CNat} \to \text{CNat} \to \text{CNat}$$

**Verification.** $\text{plus}\;\bar{2}\;\bar{1}$:

Let $s, z$ be given (suppressing the type abstraction for clarity).

$$\text{plus}\;\bar{2}\;\bar{1}\;[X]\; s\; z = \bar{2}\;[X]\; s\; (\bar{1}\;[X]\; s\; z)$$

$$= \bar{2}\;[X]\; s\; (s\; z) = s\; (s\; (s\; z)) = \bar{3}\;[X]\; s\; z$$

**Exponentiation:** Church numerals have a remarkable property regarding exponentiation:

$$\text{exp} = \lambda m : \text{CNat}.\, \lambda n : \text{CNat}.\, n\;[\text{CNat}]\; (\text{times}\; m)\; \bar{1}$$

$$\text{exp} : \text{CNat} \to \text{CNat} \to \text{CNat}$$

Alternatively, using the observation that $m^n$ is computed by applying $n$ as a "higher-order function":

$$\text{exp}' = \lambda m : \text{CNat}.\, \lambda n : \text{CNat}.\, \Lambda X.\, n\;[X \to X]\; (m\;[X])\;(\lambda x : X.\, x)$$

### 3.3 Church-Encoded Sum Types

We can also encode sum types (disjoint unions) in System F.

**Definition 3.3 (Church sums).**

$$\text{Either}\;X\;Y = \forall R.\, (X \to R) \to (Y \to R) \to R$$

$$\text{inl} = \Lambda X.\, \Lambda Y.\, \lambda x : X.\, \Lambda R.\, \lambda l : X \to R.\, \lambda r : Y \to R.\, l\; x$$

$$\text{inl} : \forall X.\, \forall Y.\, X \to \text{Either}\;X\;Y$$

$$\text{inr} = \Lambda X.\, \Lambda Y.\, \lambda y : Y.\, \Lambda R.\, \lambda l : X \to R.\, \lambda r : Y \to R.\, r\; y$$

$$\text{inr} : \forall X.\, \forall Y.\, Y \to \text{Either}\;X\;Y$$

The case analysis function:

$$\text{case} = \Lambda X.\, \Lambda Y.\, \Lambda R.\, \lambda e : \text{Either}\;X\;Y.\, \lambda l : X \to R.\, \lambda r : Y \to R.\, e\;[R]\; l\; r$$

### 3.4 Church-Encoded Unit and Void

The unit type has exactly one inhabitant:

$$\text{CUnit} = \forall X.\, X \to X$$

$$\text{unit} = \Lambda X.\, \lambda x : X.\, x \quad:\quad \text{CUnit}$$

Note that $\text{CUnit}$ is the same type as $\forall X.\, X \to X$, which is the type of the identity function. This makes sense: the unit type carries no information, just as the identity function performs no computation.

The void type has no inhabitants:

$$\text{CVoid} = \forall X.\, X$$

There is no closed term of type $\forall X.\, X$ in System F (we cannot produce a value of an arbitrary type from nothing). This corresponds to the fact that the void type is empty. The elimination principle is:

$$\text{absurd} : \text{CVoid} \to T$$

for any type $T$: given an element of void (which cannot exist), we can produce anything. This is realized by $\text{absurd} = \Lambda T.\, \lambda v : \text{CVoid}.\, v\;[T]$.

### 3.5 The Expressiveness Theorem

**Theorem 3.4 (Church encodings are adequate).** In System F, every closed term of type $\text{CBool} = \forall X.\, X \to X \to X$ is beta-eta equivalent to either $\text{tru}$ or $\text{fls}$.

*Proof sketch.* Let $t : \forall X.\, X \to X \to X$ be a closed, normal-form term. By the structure of the type, $t$ must be of the form $\Lambda X.\, \lambda a : X.\, \lambda b : X.\, u$ where $u : X$ and the only variables in scope of type $X$ are $a$ and $b$. Since $X$ is abstract (there are no eliminators for an arbitrary type variable), $u$ cannot apply any function to $a$ or $b$ --- it can only be $a$ or $b$ itself. Therefore $t$ is either $\Lambda X.\, \lambda a : X.\, \lambda b : X.\, a = \text{tru}$ or $\Lambda X.\, \lambda a : X.\, \lambda b : X.\, b = \text{fls}$. $\square$

**Remark.** A similar argument shows that every closed term of type $\text{CNat} = \forall X.\, (X \to X) \to X \to X$ is beta-eta equivalent to some Church numeral $\bar{n}$. The proof is by induction on the normal form, using the fact that the only operation available on values of type $X$ is the function $s : X \to X$.

### 3.6 Church-Encoded Trees

Binary trees can also be encoded in System F.

**Definition 3.5 (Church trees).**

$$\text{Tree}\;A = \forall R.\, (A \to R) \to (R \to R \to R) \to R$$

A tree is represented by its fold: given a function for leaves ($A \to R$) and a function for internal nodes ($R \to R \to R$), produce a result.

$$\text{leaf} = \Lambda A.\, \lambda a : A.\, \Lambda R.\, \lambda l : A \to R.\, \lambda n : R \to R \to R.\, l\; a$$

$$\text{leaf} : \forall A.\, A \to \text{Tree}\;A$$

$$\text{node} = \Lambda A.\, \lambda t_1 : \text{Tree}\;A.\, \lambda t_2 : \text{Tree}\;A.\, \Lambda R.\, \lambda l : A \to R.\, \lambda n : R \to R \to R.\, n\; (t_1\;[R]\; l\; n)\; (t_2\;[R]\; l\; n)$$

$$\text{node} : \forall A.\, \text{Tree}\;A \to \text{Tree}\;A \to \text{Tree}\;A$$

We can compute the size of a tree:

$$\text{size} = \Lambda A.\, \lambda t : \text{Tree}\;A.\, t\;[\text{CNat}]\; (\lambda a : A.\, \bar{1})\; (\lambda m : \text{CNat}.\, \lambda n : \text{CNat}.\, \text{plus}\; m\; n)$$

### 3.7 Limitations of Church Encodings

While Church encodings are theoretically elegant, they have practical limitations:

1. **Predecessor is expensive.** Computing the predecessor of a Church numeral requires $O(n)$ time --- the entire numeral must be traversed. This is because Church numerals are inherently "fold-like": they expose iteration from zero, not pattern matching on successors.

2. **Pattern matching is simulated.** Church encodings represent data by their eliminators (fold/case functions). Direct pattern matching (as in ML or Haskell) must be simulated, often awkwardly. For instance, testing whether a Church numeral is zero requires applying it to appropriate arguments, which is less efficient than a direct comparison.

3. **Laziness complications.** In a strict (call-by-value) language, Church-encoded data structures are evaluated eagerly, which can cause performance issues. For example, a Church-encoded list must be fully evaluated when folded, preventing lazy streaming.

4. **No induction principle.** Church encodings represent data by their iteration principle (catamorphism), not their induction principle. This means we can compute with them but cannot prove properties about them within System F. Inductive types (as in the Calculus of Inductive Constructions) are needed for full reasoning.

5. **Type inhabitation.** While every closed term of type $\text{CNat}$ is equivalent to some $\bar{n}$ (as we proved), this relies on strong normalization. In a language with general recursion, there would be additional inhabitants (non-terminating terms).

### 3.8 The Adequacy of Church Encodings: Detailed Proof

**Theorem 3.6 (Church natural numbers are adequate).** Every closed term of type $\text{CNat} = \forall X.\, (X \to X) \to X \to X$ is $\beta\eta$-equivalent to $\bar{n}$ for some $n \in \mathbb{N}$.

*Proof.* Let $t : \text{CNat}$ be a closed term in normal form (which exists by strong normalization).

Since $t : \forall X.\, (X \to X) \to X \to X$, by the structure of normal forms at a universal type, $t$ must begin with $\Lambda X$:

$$t = \Lambda X.\, t_1 \quad\text{where } X \vdash t_1 : (X \to X) \to X \to X$$

Similarly, $t_1$ must be a lambda abstraction (since its type is an arrow type and it is in normal form):

$$t_1 = \lambda s : X \to X.\, t_2 \quad\text{where } X, s : X \to X \vdash t_2 : X \to X$$

And $t_2$ must also be a lambda:

$$t_2 = \lambda z : X.\, t_3 \quad\text{where } X, s : X \to X, z : X \vdash t_3 : X$$

Now $t_3 : X$ in the context $\Gamma = X, s : X \to X, z : X$. We must show $t_3$ is of the form $s^n\;z$ (i.e., $s$ applied $n$ times to $z$).

In $\Gamma$, the available terms of type $X$ are:
- $z : X$ (the variable).
- $s\; u : X$ for any $u : X$ (applying $s$ to a term of type $X$).

Since $X$ is abstract (a type variable), there are no other constructors for $X$. In particular, $s$ cannot be applied to something of a type other than $X$, and there are no other functions returning $X$.

We prove by induction on the structure of the normal form $t_3$ that $t_3 = s^n\;z$ for some $n$:

- If $t_3 = z$, then $n = 0$.
- If $t_3 = s\; t_3'$ for some $t_3' : X$ in normal form, then by IH $t_3' = s^m\; z$, so $t_3 = s^{m+1}\; z$ with $n = m + 1$.
- $t_3$ cannot be a lambda (since $X$ is not an arrow type).
- $t_3$ cannot be $s$ alone (since $s : X \to X$, not $s : X$).
- $t_3$ cannot be a type application (there are no universally-typed terms of type $X$ in $\Gamma$).

Therefore $t_3 = s^n\; z$, and $t = \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, s^n\; z = \bar{n}$. $\square$

---

## 4. System F vs. STLC: Expressiveness

### 4.1 Terms Typable in System F but Not in STLC

System F is strictly more expressive than the STLC. We have already seen one example: self-application (Example 2.8). Here we elaborate on the gap.

**Proposition 4.1.** The term $\lambda x : (\forall X.\, X \to X).\, x\;[\forall X.\, X \to X]\; x$ is typable in System F but not in the STLC.

*Proof.* The typing in System F was given in Example 2.8. In the STLC, the term $\lambda x.\, x\; x$ requires $x$ to have type $A$ and simultaneously $A \to B$ for some $B$. This requires $A = A \to B$, which has no finite solution (types in the STLC are finite trees). Therefore, no monomorphic type can be assigned. $\square$

**Proposition 4.2.** System F can type all terms typable in the STLC. That is, if $\Gamma \vdash_{\text{STLC}} t : T$, then there exists a System F context $\Gamma'$ and type $T'$ such that $\Gamma' \vdash_{\text{F}} t : T'$.

*Proof.* The STLC is a syntactic subset of System F (every STLC type is a System F type, and every STLC term is a System F term). The STLC typing rules T-Var, T-Abs, and T-App are included verbatim in System F. $\square$

### 4.2 The Power of Impredicativity

A key feature of System F is **impredicativity**: the type variable $X$ in $\forall X.\, T$ ranges over all types, including universal types themselves. In particular, $X$ can be instantiated with $\forall Y.\, S$ for any $S$. This is what makes self-application typable (Example 2.8): we instantiate $\forall X.\, X \to X$ at $X = \forall X.\, X \to X$.

A **predicative** system would restrict $X$ to range over a smaller universe (e.g., only monomorphic types, or types at a lower "level"). Predicative systems are less expressive but have better algorithmic properties (see Lecture 06b on decidability).

**Example 4.3 (Impredicative instantiation).** Consider:

$$f : \forall X.\, X \to X$$

We can form:

$$f\;[\forall Y.\, Y \to Y] : (\forall Y.\, Y \to Y) \to (\forall Y.\, Y \to Y)$$

Here, $X$ is instantiated with the universal type $\forall Y.\, Y \to Y$. The quantified type $\forall X.\, X \to X$ "contains itself" in the range of $X$. This circularity --- a quantified type instantiated with other quantified types --- is the hallmark of impredicativity.

### 4.3 Relationship to the Curry-Howard Correspondence

Under the Curry-Howard correspondence, System F corresponds to second-order propositional logic:

| System F | Second-order logic |
|----------|-------------------|
| $T_1 \to T_2$ | $P_1 \implies P_2$ |
| $\forall X.\, T$ | $\forall X.\, P$ |
| $\Lambda X.\, t$ | Universal introduction |
| $t\;[T]$ | Universal elimination (instantiation) |

A term $t : \forall X.\, T$ is a proof that $T$ holds for all propositions $X$. Instantiation $t\;[S]$ specializes the proof to a particular proposition $S$.

The Church encodings from Section 3 are logical encodings:

- $\text{CBool} = \forall X.\, X \to X \to X$ encodes $\forall X.\, X \implies (X \implies X)$, the proposition with exactly two proofs (select first or select second argument).
- $\text{CNat} = \forall X.\, (X \to X) \to X \to X$ encodes the proposition "given any $X$, if $X$ implies $X$ and $X$ holds, then $X$ holds," which has proofs corresponding to each natural number (how many times to apply the implication).
- $\text{CVoid} = \forall X.\, X$ encodes the proposition "everything is true," which is false (has no proof).

---

## 5. Type Erasure and Erasure Semantics

### 5.1 Type Erasure

**Definition 5.1 (Type erasure).** The erasure function $\text{erase}$ maps System F terms to untyped lambda calculus terms:

$$\text{erase}(x) = x$$

$$\text{erase}(\lambda x : T.\, t) = \lambda x.\, \text{erase}(t)$$

$$\text{erase}(t_1\; t_2) = \text{erase}(t_1)\; \text{erase}(t_2)$$

$$\text{erase}(\Lambda X.\, t) = \text{erase}(t)$$

$$\text{erase}(t\;[T]) = \text{erase}(t)$$

Type abstractions and type applications are simply erased. The computational content of a System F term lives entirely in the term-level lambda abstractions and applications.

**Theorem 5.2 (Erasure preserves semantics).** If $t \to^* v$ in System F, then $\text{erase}(t) \to^* \text{erase}(v)$ in the untyped lambda calculus (under an appropriate evaluation strategy).

*Proof sketch.* Each evaluation step in System F either corresponds to a term-level beta reduction (which maps directly to a beta reduction in the untyped calculus) or a type-level beta reduction (which maps to the identity, since type abstractions and applications are erased). The result follows by induction on the length of the reduction sequence. $\square$

### 5.2 Implications for Implementation

Type erasure has profound practical implications:

1. **Runtime efficiency**: Polymorphic programs need not carry type information at runtime. A polymorphic identity function compiles to the same machine code as a monomorphic one.
2. **Uniform representation**: Values of all types can be represented uniformly (e.g., as pointers). This is the implementation strategy of ML and Haskell.
3. **No runtime type dispatch**: Unlike ad hoc polymorphism (which requires runtime dispatch on types), parametric polymorphism is resolved entirely at compile time.

**Remark.** Some languages (C++, Rust) use **monomorphization** instead of type erasure: they generate specialized code for each type instantiation. This can produce faster code (due to specialization) but increases code size. System F's type erasure gives a theoretical foundation for the uniform-representation approach.

---

## 6. Historical Context

### 6.1 Girard's System F (1972)

Jean-Yves Girard introduced System F in his doctoral thesis *Interpretation fonctionnelle et elimination des coupures de l'arithmetique d'ordre superieur* (1972). His motivation was proof-theoretic: he sought a typed lambda calculus corresponding to second-order intuitionistic logic, in order to prove normalization (cut-elimination) for second-order arithmetic.

Girard's key contributions:

- The definition of System F as a formal system.
- The proof that all well-typed System F terms are strongly normalizing (every reduction sequence terminates). This was a major achievement; the proof required inventing the technique of **reducibility candidates** (candidats de reductibilite), a form of logical relations.
- The observation that System F can encode all functions provably total in second-order Peano arithmetic.

### 6.2 Reynolds' Polymorphic Lambda Calculus (1974)

John C. Reynolds independently introduced the same system in his paper *Towards a Theory of Type Structure* (1974). His motivation was programming-language-theoretic: he wanted a calculus in which functions like the identity and composition could be typed once and used at multiple types.

Reynolds' key contributions:

- The formulation of polymorphism as a programming language feature, with explicit type abstraction and application.
- The observation that parametric polymorphism is a form of data abstraction (prefiguring his later work on relational parametricity).
- The connection between universal types and representation independence.

### 6.3 Convergence

Despite arising from completely different traditions (proof theory vs. programming language theory), Girard's and Reynolds' systems turned out to be identical. This is a striking instance of the deep connection between logic and computation captured by the Curry-Howard correspondence.

**Timeline:**

- 1972: Girard's thesis (logic/proof theory).
- 1974: Reynolds' paper (programming languages).
- 1983: Reynolds' abstraction theorem (relational parametricity; see Lecture 06d).
- 1989: Wadler's "Theorems for Free!" (practical consequences of parametricity).
- 1994: Wells proves type inference for System F is undecidable (see Lecture 06b).
- 2000s: Rank-restricted polymorphism in practical languages (ML, Haskell, OCaml).

---

## 7. Confluence and Determinism

### 7.1 Confluence

**Theorem 7.0 (Confluence / Church-Rosser for System F).** If $t \to^* t_1$ and $t \to^* t_2$, then there exists $t_3$ such that $t_1 \to^* t_3$ and $t_2 \to^* t_3$.

*Proof sketch.* System F's reduction rules (E-AppAbs, E-TAppTAbs, and the congruence rules) are a subset of the general beta-reduction rules for the lambda calculus extended with type-level beta. Confluence follows from the same argument as for the untyped lambda calculus (the Tait-Martin-Lof proof using parallel reduction), extended to handle type-level beta reduction. The key observation is that term-level and type-level beta reductions do not interfere: they act on different syntactic categories. $\square$

### 7.2 Determinism of Call-by-Value

Under the call-by-value evaluation strategy (which evaluates arguments before substitution and uses the congruence rules E-App1, E-App2, E-TApp), evaluation is **deterministic**: at each step, at most one rule applies.

**Proposition 7.1 (Determinism).** If $t \to t_1$ and $t \to t_2$ under call-by-value evaluation, then $t_1 = t_2$.

*Proof.* By induction on the derivation of $t \to t_1$. The congruence rules specify an evaluation order (left-to-right, argument before body), so at most one rule applies at each step. $\square$

**Remark.** Under full beta-reduction (where any redex can be reduced), evaluation is non-deterministic but confluent. Call-by-value is a particular deterministic strategy.

---

## 8. Formal Properties: First Look

We state several key properties of System F here; their proofs are the subject of Lecture 06b.

**Theorem 8.1 (Type safety for System F).** System F enjoys both progress and preservation:

1. **Progress**: If $\vdash t : T$, then either $t$ is a value or there exists $t'$ such that $t \to t'$.
2. **Preservation**: If $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$.

**Theorem 8.2 (Strong normalization).** If $\Gamma \vdash t : T$ in System F, then every reduction sequence starting from $t$ is finite. In particular, evaluation of well-typed System F terms always terminates.

**Corollary 8.3.** System F is not Turing-complete. There exist total computable functions that cannot be expressed in System F.

However, System F is extremely expressive: it can encode all functions provably total in second-order Peano arithmetic, which includes essentially all "mathematically natural" total functions (e.g., the Ackermann function).

**Theorem 8.4 (Undecidability of type inference).** Type checking for System F (given a term with full type annotations, decide whether it is well-typed) is decidable. However, type inference (given an unannotated term, find a type) is undecidable (Wells, 1999).

---

## 9. System F in Practice

### 9.1 System F and ML

ML-family languages (OCaml, Standard ML, Haskell) use polymorphism extensively, but their type systems are not full System F. Instead, they use **let-polymorphism** (also called ML polymorphism or prenex polymorphism), which restricts universal quantifiers to the outermost position in type schemes.

In ML, the type $\forall X.\, X \to X$ is a **type scheme**, not a first-class type. You cannot write:

```ocaml
(* This is not valid ML *)
let f (x : forall 'a. 'a -> 'a) = x 3, x true
```

In System F, the equivalent is perfectly well-typed:

$$\lambda x : (\forall X.\, X \to X).\, \text{Pair}\;[\text{Nat}]\;[\text{Bool}]\;(x\;[\text{Nat}]\; 3)\;(x\;[\text{Bool}]\;\text{true})$$

This distinction --- whether universal types can appear in arbitrary positions (System F) or only at the top level of let-bindings (ML) --- is the difference between **impredicative** and **predicative** (or rank-1) polymorphism. ML's restriction buys decidable type inference (Algorithm W / Hindley-Milner), at the cost of some expressiveness.

### 9.2 Rank-n Polymorphism

The **rank** of a type measures the depth of $\forall$ quantifiers to the left of arrows:

- **Rank 0**: No quantifiers (monomorphic types).
- **Rank 1** (prenex): $\forall X_1 \cdots X_n.\, T$ where $T$ has no quantifiers. This is ML polymorphism.
- **Rank 2**: $\forall$ may appear to the left of at most one arrow. Example: $(\forall X.\, X \to X) \to \text{Nat}$.
- **Rank $k$**: $\forall$ may appear to the left of at most $k - 1$ nested arrows.
- **Rank $\omega$** (unrestricted): Full System F.

**Theorem 8.1 (Decidability hierarchy).**

- Type inference for rank-1 polymorphism (ML) is decidable (Hindley, 1969; Milner, 1978; Damas & Milner, 1982).
- Type inference for rank-2 polymorphism is decidable (Kfoury & Wells, 1999).
- Type inference for rank $k \geq 3$ polymorphism is undecidable (Wells, 1999).
- Type checking (with full annotations) for all ranks is decidable.

GHC Haskell supports rank-n polymorphism via the `RankNTypes` extension, requiring type annotations at rank $\geq 2$.

### 9.3 System F and Haskell's Core

GHC (the Glasgow Haskell Compiler) uses a variant of System F called **System FC** (System F with Coercions) as its intermediate language. Every Haskell program is elaborated into System FC during compilation. System FC extends System F with:

- Type equality coercions (for GADTs and type families).
- Coercion abstraction and application.
- Kind polymorphism.

Understanding System F is therefore directly relevant to understanding Haskell's compilation pipeline.

### 9.4 System F and Rust

Rust's generics are based on parametric polymorphism, though with key differences from System F:

- **Monomorphization**: Rust compiles each generic function separately for each type instantiation. The function `fn id<T>(x: T) -> T { x }` generates distinct machine code for `id::<i32>` and `id::<String>`. This contrasts with the type-erasure approach of ML/Haskell and gives zero-cost abstraction at the expense of larger binaries.

- **Trait bounds**: Rust's `where T: Clone` is a form of bounded polymorphism, analogous to bounded quantification in System F$_{<:}$. The function `fn f<T: Clone>(x: T) -> (T, T) { (x.clone(), x) }` requires that $T$ has a `Clone` implementation, restricting the range of type instantiation.

- **Lifetime polymorphism**: Rust extends parametric polymorphism to lifetimes. A function `fn longest<'a>(x: &'a str, y: &'a str) -> &'a str` is polymorphic in the lifetime `'a`. This has no direct counterpart in System F but can be understood as a restricted form of dependent types.

### 9.5 System F and Scala

Scala's type system is substantially richer than System F but includes it as a fragment. Key connections:

- **Type parameters**: Scala's `def id[A](x: A): A = x` corresponds to $\Lambda A.\, \lambda x : A.\, x$.
- **Higher-kinded types**: Scala supports type constructors as parameters, e.g., `def map[F[_], A, B](fa: F[A])(f: A => B): F[B]`. This goes beyond System F into System F$_\omega$ territory.
- **Local type inference**: Scala uses local type inference (Pierce & Turner, 2000) to recover some type annotations. The expression `id(42)` infers `A = Int` without annotation.

### 9.6 Exercises

**Exercise 9.1.** Give a typing derivation for the term $\text{compose}\;[\text{Bool}]\;[\text{Nat}]\;[\text{Bool}]\; (\lambda x : \text{Nat}.\, \text{isZero}\;x)\; (\lambda b : \text{Bool}.\, \text{if}\;b\;\bar{0}\;\bar{1})$.

**Exercise 9.2.** Define the Church encoding of **optional types** $\text{Maybe}\;A = \forall R.\, R \to (A \to R) \to R$. Give the constructors $\text{nothing} : \forall A.\, \text{Maybe}\;A$ and $\text{just} : \forall A.\, A \to \text{Maybe}\;A$. Verify that $\text{nothing}$ returns the default and $\text{just}\;a$ returns the wrapped value.

**Exercise 9.3.** Show that the type $\forall X.\, \forall Y.\, X \to Y \to X$ has exactly one closed inhabitant (up to beta-eta equivalence). What logical proposition does this type encode under the Curry-Howard correspondence?

**Exercise 9.4.** In the STLC, the term $\lambda f.\, \lambda g.\, \lambda x.\, f\;(g\;x)$ has type $(B \to C) \to (A \to B) \to A \to C$ for fixed types $A, B, C$. Show how System F generalizes this to a single term that works for all $A, B, C$. What is the operational difference?

**Exercise 9.5.** The Church encoding of products uses the type $\forall R.\, (A \to B \to R) \to R$. Why is $\forall$ needed here? What goes wrong if we try to define products using a fixed result type, i.e., $(A \to B \to R) \to R$ for some specific $R$?

**Exercise 9.6.** Consider the term $\text{double} = \Lambda X.\, \lambda f : X \to X.\, \lambda x : X.\, f\;(f\;x)$. What is its type? Show that $\text{double}\;[\text{CNat}]\;\text{succ}\;\bar{3}$ reduces to $\bar{5}$. Then show that $\text{double}\;[\text{CNat}]\;\text{double}\;[\text{CNat}]\;\text{succ}\;\bar{0}$ reduces to $\bar{4}$ (i.e., "doubling the doubling").

**Exercise 9.7.** Define a polymorphic function $\text{apply\_twice} : \forall X.\, (X \to X) \to X \to X$ that applies its function argument twice. Then define $\text{apply\_n}$ for arbitrary $n$ using Church numerals: show that $\bar{n}\;[X]\; f\; x = f^n\;x$.

**Exercise 9.8.** Prove that the term $\Lambda X.\, \Lambda Y.\, \lambda p : (\forall R.\, (X \to Y \to R) \to R).\, p\;[Y \times X]\; (\lambda a : X.\, \lambda b : Y.\, (b, a))$ has type $\forall X.\, \forall Y.\, (X \times Y) \to (Y \times X)$ (where $\times$ is the Church-encoded product). This is a polymorphic swap function.

---

## Summary

System F extends the simply typed lambda calculus with **type abstraction** ($\Lambda X.\, t$) and **type application** ($t\;[T]$), enabling **parametric polymorphism**. The key type construct is the **universal type** $\forall X.\, T$, which expresses that a term works uniformly for all types.

Key results:

1. **Syntax**: Two new term forms (type abstraction and application) and one new type form (universal type).
2. **Typing rules**: T-TAbs introduces $\forall$; T-TApp eliminates it via type substitution.
3. **Church encodings**: Booleans, naturals, pairs, sums, and lists can all be encoded as pure System F terms using universal types, demonstrating the expressive power of polymorphism.
4. **Expressiveness**: System F is strictly more expressive than the STLC. It can type self-application and encode all data types definable in the STLC.
5. **Type erasure**: Type-level information can be erased after type checking without affecting computation.
6. **Historical context**: Independently discovered by Girard (proof theory, 1972) and Reynolds (programming languages, 1974).

The metatheory of System F --- including type safety, strong normalization, and the undecidability of type inference --- is the subject of the next lecture.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapter 23: Universal Types. The primary reference for this lecture.
2. **Girard, J.-Y.** (1972). *Interpretation fonctionnelle et elimination des coupures de l'arithmetique d'ordre superieur*. These de doctorat d'etat, Universite Paris VII.
3. **Reynolds, J. C.** (1974). Towards a theory of type structure. In *Colloque sur la Programmation*, Lecture Notes in Computer Science, vol. 19, Springer.
4. **Girard, J.-Y., Lafont, Y., and Taylor, P.** (1989). *Proofs and Types*. Cambridge University Press. Chapters 11--14 cover System F and its normalization proof.
5. **Harper, R.** (2016). *Practical Foundations for Programming Languages*, 2nd ed. Cambridge University Press. Chapter 16: System F of Polymorphic Types.
6. **Wells, J. B.** (1999). Typability and type checking in System F are equivalent and undecidable. *Annals of Pure and Applied Logic*, 98(1--3), 111--156.
7. **Wadler, P.** (2015). Propositions as types. *Communications of the ACM*, 58(12), 75--84. A historical overview connecting System F to second-order logic.
