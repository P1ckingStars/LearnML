---
title: "Lecture 02a: The Simply Typed Lambda Calculus"
tags:
  - type-theory
  - stlc
  - lecture
---
# Lecture 02a: The Simply Typed Lambda Calculus

> **Module 02 --- Simply Typed Lambda Calculus (Weeks 3-4)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain why untyped lambda calculus admits "stuck" terms and motivate the need for a static type discipline.
2. Define the syntax of simple types, including base types and arrow types, and parse arrow types using right-associativity.
3. Define typing contexts and the typing relation $\Gamma \vdash t : T$ for the simply typed lambda calculus.
4. State and apply all typing rules (T-Var, T-Abs, T-App, T-True, T-False, T-If, T-Zero, T-Succ, T-Pred, T-IsZero) as formal inference rules.
5. Construct complete type derivation trees for given terms.
6. Prove the uniqueness of types theorem for the simply typed lambda calculus.
7. Explain the syntax-directed nature of the typing relation and why it matters for implementation.
8. Define type erasure and state the relationship between typed and untyped evaluation.

---

## 1. Motivation: Why Types?

### 1.1 The Problem with Stuck Terms

In Module 01, we studied the untyped lambda calculus and untyped arithmetic expressions. Recall that the untyped arithmetic language admits terms such as:

$$\text{succ}(\text{true})$$

$$\text{if}\; 0\; \text{then}\; \text{true}\; \text{else}\; \text{false}$$

$$\text{iszero}(\text{false})$$

None of these terms is a value, yet no evaluation rule applies to any of them. They are **stuck**: they have reached a state from which evaluation cannot proceed, but they have not produced a final answer.

In the full untyped lambda calculus, the situation is even worse. The term

$$(\lambda x.\, x\; x)(\lambda x.\, x\; x)$$

reduces to itself, producing an infinite loop. And a term like

$$\text{true}\; (\lambda x.\, x)$$

is stuck because we are trying to apply a non-function to an argument.

**Definition 1.1 (Stuck Term).** A closed term $t$ is **stuck** if $t$ is not a value and there is no $t'$ such that $t \to t'$.

Stuck terms represent **runtime errors**: the program has reached a meaningless state. In a real programming language, this corresponds to a segmentation fault, a "method not found" error, or undefined behavior.

### 1.2 The Goal of a Type System

A type system is a **static analysis** that classifies terms according to the kind of value they will produce, rejecting at compile time those programs that might get stuck at runtime.

The fundamental property we seek is **type safety** (also called **soundness**): well-typed terms do not get stuck. We will prove this precisely in Lecture 02b.

More precisely, a type system provides:

1. **Error detection**: Programs that would get stuck are rejected before execution.
2. **Abstraction**: Types serve as a form of documentation and specification, describing the interface of a term.
3. **Modularity**: Type annotations at function boundaries allow separate checking of program components.
4. **Optimization**: The compiler can exploit type information to generate more efficient code (e.g., unboxing, monomorphization).

### 1.3 Conservative Approximation

A fundamental limitation of type systems follows from Rice's theorem: for any nontrivial semantic property of programs, there is no algorithm that decides the property exactly for all programs. Any decidable type system must therefore be **conservative**: it will reject some programs that would in fact run without error.

For example, the term

$$\text{if}\; \text{true}\; \text{then}\; 0\; \text{else}\; \text{true}$$

always evaluates to $0$ (a natural number) and never gets stuck, but a simple type system will reject it because the two branches of the conditional have different types.

This is the **expressiveness trade-off**: a more permissive type system accepts more programs but is harder to check (and its metatheory is more complex). The simply typed lambda calculus represents the simplest point on this spectrum --- it rejects many useful programs (e.g., the Y combinator), but its type system is decidable, has unique types, and enjoys strong normalization.

### 1.4 A Taxonomy of Runtime Errors

It is useful to distinguish several kinds of runtime misbehavior that a type system might address:

1. **Stuck terms** (as defined above): the program reaches a state where no evaluation rule applies but no value has been produced. In STLC, type safety will guarantee the absence of stuck terms.

2. **Divergence** (non-termination): the program runs forever without producing a result. In STLC, the strong normalization theorem guarantees termination. In most practical languages (with general recursion), the type system does not prevent divergence.

3. **Unchecked errors**: in languages with features like null pointers, array bounds violations, or unchecked casts, the program may exhibit undefined behavior even though the type system considers it well-typed. These represent holes in the type system.

4. **Checked errors**: in languages with exceptions or error types, a well-typed program may signal an error at runtime. This is not a type error but a deliberate control flow mechanism.

The simply typed lambda calculus eliminates category (1) completely and category (2) as a bonus (via strong normalization). Categories (3) and (4) do not arise because STLC has no null pointers, arrays, or exceptions.

### 1.5 Types as Specifications

Beyond preventing errors, types serve as lightweight specifications. The type $\text{Nat} \to \text{Nat}$ tells us that a function takes a natural number and returns a natural number, but it says nothing about *which* function it is (it could be the identity, the successor, the constant zero function, etc.).

Richer type systems provide more informative types:

- **Polymorphic types** (System F, Module 06): $\forall X.\, X \to X$ has exactly one inhabitant (the identity function), up to observational equivalence. The type fully specifies the behavior.
- **Dependent types** (Module 08): $\Pi(n : \text{Nat}).\, \text{Vec}\; A\; n \to \text{Vec}\; A\; n$ specifies not only the input-output types but that the output vector has the same length as the input.
- **Refinement types**: $\{n : \text{Nat} \mid n > 0\} \to \text{Nat}$ restricts the domain to positive naturals.

STLC sits at the simplest end of this spectrum: its types are informative enough to prevent stuck terms but too coarse to distinguish between different functions of the same type.

### 1.6 Historical Context

The simply typed lambda calculus was introduced by Alonzo Church in 1940, building on earlier work by Church (1936) on the untyped lambda calculus. Church's motivation was to avoid the paradoxes that arise when the lambda calculus is used as a foundation for logic --- the untyped lambda calculus is logically inconsistent (every proposition is provable via the Curry paradox), but the simply typed version is consistent.

Haskell Curry independently developed a related system in the 1930s using combinatory logic. The connection between Church-style (explicitly typed) and Curry-style (implicitly typed) presentations remains important in modern type theory.

Church's 1940 paper was remarkably prescient. It introduced not only simple types but also higher-order types (types of types), anticipating the kind systems that would be developed decades later. The restriction to simple types (as opposed to the full higher-order system Church considered) was later identified as a natural and well-behaved fragment, and it became the standard starting point for the study of type systems.

### 1.7 Roadmap

The rest of this lecture proceeds as follows. Section 2 defines the syntax of simple types. Section 3 defines the term language. Section 4 introduces typing contexts and the typing relation. Section 5 presents all ten typing rules. Section 6 gives extensive examples of type derivation trees. Section 7 proves the fundamental properties of the typing relation (syntax-directedness, inversion, uniqueness of types). Section 8 establishes structural properties (permutation, weakening, strengthening). Section 9 discusses type erasure and normalization. Section 10 describes the type-checking algorithm. Section 11 compares STLC with the untyped lambda calculus. Section 12 provides worked exercises.

---

## 2. Simple Types

### 2.1 Syntax of Types

We define the set of **simple types** by the following grammar:

$$T ::= \text{Bool} \mid \text{Nat} \mid T_1 \to T_2$$

where:
- $\text{Bool}$ is the type of boolean values.
- $\text{Nat}$ is the type of natural numbers.
- $T_1 \to T_2$ is the type of functions that take an argument of type $T_1$ and return a result of type $T_2$.

**Convention.** The arrow type constructor $\to$ is **right-associative**:

$$T_1 \to T_2 \to T_3 \quad \text{means} \quad T_1 \to (T_2 \to T_3)$$

This convention is natural because it matches currying: a function of two arguments $T_1$ and $T_2$ returning $T_3$ is represented as a function from $T_1$ to functions from $T_2$ to $T_3$.

**Example 2.1.** The following are well-formed types:

| Type | Meaning |
|------|---------|
| $\text{Bool}$ | Booleans |
| $\text{Nat} \to \text{Nat}$ | Functions from naturals to naturals |
| $\text{Bool} \to \text{Nat} \to \text{Bool}$ | Curried two-argument function $\text{Bool} \to (\text{Nat} \to \text{Bool})$ |
| $(\text{Nat} \to \text{Nat}) \to \text{Nat}$ | Higher-order function taking a function and returning a natural |

### 2.2 The Type Tree

Types have a natural tree structure. The type $(\text{Nat} \to \text{Bool}) \to \text{Nat} \to \text{Bool}$ is parsed as $(\text{Nat} \to \text{Bool}) \to (\text{Nat} \to \text{Bool})$, giving the tree:

```
         ->
        /  \
      ->    ->
     / \   / \
   Nat Bool Nat Bool
```

This tree structure will be important when we define algorithms on types (e.g., type equality checking, unification in Module 05).

### 2.3 Size and Depth of Types

**Definition 2.2.** The **size** of a type $T$, written $|T|$, is defined inductively:

$$|B| = 1 \quad \text{for base types } B \in \{\text{Bool}, \text{Nat}\}$$

$$|T_1 \to T_2| = |T_1| + |T_2| + 1$$

**Definition 2.3.** The **depth** of a type $T$, written $\text{depth}(T)$, is:

$$\text{depth}(B) = 0 \quad \text{for base types } B$$

$$\text{depth}(T_1 \to T_2) = 1 + \max(\text{depth}(T_1), \text{depth}(T_2))$$

These measures are used in inductive proofs over types.

**Example 2.4.** Some examples of size and depth:

| Type | Size | Depth |
|------|------|-------|
| $\text{Bool}$ | 1 | 0 |
| $\text{Nat} \to \text{Bool}$ | 3 | 1 |
| $(\text{Nat} \to \text{Nat}) \to \text{Nat}$ | 5 | 2 |
| $\text{Bool} \to \text{Bool} \to \text{Bool}$ | 5 | 2 |
| $(\text{Bool} \to \text{Bool}) \to (\text{Bool} \to \text{Bool})$ | 7 | 2 |

### 2.4 The Set of Types is Infinite and Countable

**Proposition 2.5.** The set of simple types (over base types $\text{Bool}$ and $\text{Nat}$) is countably infinite.

*Proof.* It is infinite because for any type $T$, the type $T \to T$ is a strictly larger type. It is countable because the types are generated by a context-free grammar with a finite alphabet, and the set of derivation trees of a context-free grammar is countable. $\square$

### 2.5 Type Equality

**Definition 2.6.** Two types $T$ and $S$ are **equal**, written $T = S$, if and only if they have the same tree structure. Formally:

- $\text{Bool} = \text{Bool}$
- $\text{Nat} = \text{Nat}$
- $T_1 \to T_2 = S_1 \to S_2$ if and only if $T_1 = S_1$ and $T_2 = S_2$

Type equality is decidable (it is a structural comparison of finite trees) and can be checked in time linear in the size of the types. This decidability is essential for the type-checking algorithm (Section 10).

In systems with subtyping (Module 04) or type-level computation (Module 07), type equality becomes more complex. In STLC, it is trivially decidable.

---

## 3. Terms of the Simply Typed Lambda Calculus

### 3.1 Syntax

The terms of the simply typed lambda calculus extend the untyped lambda calculus with type annotations on lambda abstractions:

$$t ::= x \mid \lambda x : T.\, t \mid t_1\; t_2 \mid \text{true} \mid \text{false} \mid \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 \mid 0 \mid \text{succ}\; t \mid \text{pred}\; t \mid \text{iszero}\; t$$

**Key difference from the untyped calculus.** In the untyped lambda calculus, we wrote $\lambda x.\, t$. In the simply typed lambda calculus, we write $\lambda x : T.\, t$, annotating the parameter with its type. This is the **Church-style** (or **explicitly typed**) presentation.

An alternative is the **Curry-style** (or **implicitly typed**) presentation, where lambda abstractions remain unannotated ($\lambda x.\, t$) and types are inferred. We study type inference in Module 05.

### 3.2 Values

The values of the simply typed lambda calculus are the same as in the untyped case:

$$v ::= \text{true} \mid \text{false} \mid \text{nv} \mid \lambda x : T.\, t$$

where numeric values are:

$$\text{nv} ::= 0 \mid \text{succ}\; \text{nv}$$

### 3.3 Evaluation Rules

The evaluation rules (small-step operational semantics) are unchanged from the untyped case. We use a **call-by-value** strategy:

$$\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)}$$

$$\frac{t_2 \to t_2'}{v_1\; t_2 \to v_1\; t_2'} \quad \text{(E-App2)}$$

$$\frac{}{(\lambda x : T.\, t)\; v \to [x \mapsto v]\, t} \quad \text{(E-AppAbs)}$$

$$\frac{t_1 \to t_1'}{\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 \to \text{if}\; t_1'\; \text{then}\; t_2\; \text{else}\; t_3} \quad \text{(E-If)}$$

$$\frac{}{\text{if}\; \text{true}\; \text{then}\; t_2\; \text{else}\; t_3 \to t_2} \quad \text{(E-IfTrue)}$$

$$\frac{}{\text{if}\; \text{false}\; \text{then}\; t_2\; \text{else}\; t_3 \to t_3} \quad \text{(E-IfFalse)}$$

$$\frac{t \to t'}{\text{succ}\; t \to \text{succ}\; t'} \quad \text{(E-Succ)}$$

$$\frac{t \to t'}{\text{pred}\; t \to \text{pred}\; t'} \quad \text{(E-Pred)}$$

$$\frac{}{\text{pred}\; 0 \to 0} \quad \text{(E-PredZero)}$$

$$\frac{}{\text{pred}\; (\text{succ}\; \text{nv}) \to \text{nv}} \quad \text{(E-PredSucc)}$$

$$\frac{t \to t'}{\text{iszero}\; t \to \text{iszero}\; t'} \quad \text{(E-IsZero)}$$

$$\frac{}{\text{iszero}\; 0 \to \text{true}} \quad \text{(E-IsZeroZero)}$$

$$\frac{}{\text{iszero}\; (\text{succ}\; \text{nv}) \to \text{false}} \quad \text{(E-IsZeroSucc)}$$

**Observation.** The evaluation rules make no reference to types. Types are used only during static analysis (type checking); at runtime, evaluation proceeds exactly as in the untyped system. This is a fundamental design principle: **types are erased before execution**.

### 3.4 Free Variables and Substitution

We recall the key definitions from Module 01, now adapted for the typed setting.

**Definition 3.1 (Free Variables).** The set of **free variables** of a term $t$, written $\text{FV}(t)$, is defined inductively:

$$\text{FV}(x) = \{x\}$$

$$\text{FV}(\lambda x : T.\, t) = \text{FV}(t) \setminus \{x\}$$

$$\text{FV}(t_1\; t_2) = \text{FV}(t_1) \cup \text{FV}(t_2)$$

$$\text{FV}(\text{true}) = \text{FV}(\text{false}) = \text{FV}(0) = \emptyset$$

$$\text{FV}(\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3) = \text{FV}(t_1) \cup \text{FV}(t_2) \cup \text{FV}(t_3)$$

$$\text{FV}(\text{succ}\; t) = \text{FV}(\text{pred}\; t) = \text{FV}(\text{iszero}\; t) = \text{FV}(t)$$

A term $t$ is **closed** if $\text{FV}(t) = \emptyset$.

**Definition 3.2 (Capture-Avoiding Substitution).** The substitution of term $s$ for variable $x$ in term $t$, written $[x \mapsto s]\, t$, is defined inductively:

$$[x \mapsto s]\, x = s$$

$$[x \mapsto s]\, y = y \quad \text{if } y \neq x$$

$$[x \mapsto s]\, (\lambda y : T.\, t) = \lambda y : T.\, [x \mapsto s]\, t \quad \text{if } y \neq x \text{ and } y \notin \text{FV}(s)$$

$$[x \mapsto s]\, (t_1\; t_2) = ([x \mapsto s]\, t_1)\; ([x \mapsto s]\, t_2)$$

The remaining cases (booleans, naturals, conditionals) are homomorphic: substitution is applied to all subterms.

The condition $y \notin \text{FV}(s)$ in the lambda case prevents **variable capture**. If $y \in \text{FV}(s)$, we must first alpha-rename the bound variable $y$ to a fresh name before substituting. This is the same definition as in Module 01.

### 3.5 Alpha-Equivalence

As in the untyped calculus, we identify terms that differ only in the names of their bound variables. The terms $\lambda x : T.\, x$ and $\lambda y : T.\, y$ are **alpha-equivalent**, written $\lambda x : T.\, x =_\alpha \lambda y : T.\, y$. We always work up to alpha-equivalence.

In implementation, alpha-equivalence can be handled by:
1. Renaming bound variables to canonical names during comparison.
2. Using de Bruijn indices (replacing named variables with numeric indices).
3. Using locally nameless representation (a hybrid approach).

We discuss these representations in Recitation 02.

### 3.6 The Size of Terms

**Definition 3.3.** The **size** of a term $t$, written $|t|$, counts the total number of nodes in the abstract syntax tree:

$$|x| = 1 \qquad |\text{true}| = 1 \qquad |\text{false}| = 1 \qquad |0| = 1$$

$$|\lambda x : T.\, t| = 1 + |t|$$

$$|t_1\; t_2| = 1 + |t_1| + |t_2|$$

$$|\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3| = 1 + |t_1| + |t_2| + |t_3|$$

$$|\text{succ}\; t| = |\text{pred}\; t| = |\text{iszero}\; t| = 1 + |t|$$

The size of a term provides a natural well-founded measure for structural induction. We use it in proofs throughout the metatheory.

---

## 4. Typing Contexts and the Typing Relation

### 4.1 Typing Contexts

A **typing context** (also called a **type environment**) is a sequence of variable-type bindings:

$$\Gamma ::= \emptyset \mid \Gamma, x : T$$

**Definition 4.1 (Typing Context).** A typing context $\Gamma$ is a finite sequence of bindings $x_1 : T_1, x_2 : T_2, \ldots, x_n : T_n$ where all the $x_i$ are distinct.

We write $\emptyset$ or $\cdot$ for the empty context. We write $\Gamma, x : T$ for the context obtained by extending $\Gamma$ with a binding for $x$. We write $x : T \in \Gamma$ to mean that $\Gamma$ contains the binding $x : T$. We write $\text{dom}(\Gamma) = \{x_1, \ldots, x_n\}$ for the set of variables bound in $\Gamma$.

**Convention.** When we write $\Gamma, x : T$, we implicitly require $x \notin \text{dom}(\Gamma)$ --- that is, $x$ is fresh with respect to $\Gamma$. This can always be arranged by alpha-renaming.

**Example 4.1.** The context $x : \text{Bool}, f : \text{Bool} \to \text{Nat}$ binds $x$ to type $\text{Bool}$ and $f$ to type $\text{Bool} \to \text{Nat}$.

### 4.2 The Typing Relation

The **typing relation** is a ternary relation between typing contexts, terms, and types, written:

$$\Gamma \vdash t : T$$

Read: "Under context $\Gamma$, term $t$ has type $T$." When $\Gamma$ is empty, we write simply $\vdash t : T$ and say that $t$ is a **closed** well-typed term.

The typing relation is defined inductively by a set of **typing rules**, each of the form:

$$\frac{\text{premise}_1 \quad \text{premise}_2 \quad \cdots}{\text{conclusion}} \quad \text{(Rule-Name)}$$

The premises above the line are typing judgments that must hold; the conclusion below the line is the judgment being derived.

---

## 5. Typing Rules

We now present each typing rule of the simply typed lambda calculus with booleans and natural numbers.

### 5.1 Variables

$$\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \quad \text{(T-Var)}$$

A variable $x$ has type $T$ in context $\Gamma$ if $\Gamma$ contains the binding $x : T$. This is the base case for typing: it connects the typing judgment to the context.

### 5.2 Abstraction

$$\frac{\Gamma, x : T_1 \vdash t : T_2}{\Gamma \vdash \lambda x : T_1.\, t : T_1 \to T_2} \quad \text{(T-Abs)}$$

To type-check a lambda abstraction $\lambda x : T_1.\, t$: extend the context with the binding $x : T_1$, and check that the body $t$ has type $T_2$ in the extended context. The whole abstraction then has the arrow type $T_1 \to T_2$.

Note that the type $T_1$ is given explicitly in the term (Church-style). In Curry-style, $T_1$ would need to be inferred (see Module 05).

### 5.3 Application

$$\frac{\Gamma \vdash t_1 : T_1 \to T_2 \quad \Gamma \vdash t_2 : T_1}{\Gamma \vdash t_1\; t_2 : T_2} \quad \text{(T-App)}$$

To type-check an application $t_1\; t_2$: check that $t_1$ has an arrow type $T_1 \to T_2$, check that $t_2$ has the argument type $T_1$, and the application has the result type $T_2$.

The application rule is the only rule that "consumes" an arrow type, extracting the result type from it.

**Remark on type matching.** In the T-App rule, the type $T_1$ must be **exactly the same** in both premises. The type of $t_2$ must equal the domain type of $t_1$'s arrow type. There is no implicit coercion or conversion. In systems with subtyping (Module 04), this requirement is relaxed: the type of $t_2$ need only be a subtype of $T_1$.

### 5.4 Boolean Constants

$$\frac{}{\Gamma \vdash \text{true} : \text{Bool}} \quad \text{(T-True)}$$

$$\frac{}{\Gamma \vdash \text{false} : \text{Bool}} \quad \text{(T-False)}$$

These are axioms (no premises): the boolean constants have type $\text{Bool}$ in any context.

### 5.5 Conditional

$$\frac{\Gamma \vdash t_1 : \text{Bool} \quad \Gamma \vdash t_2 : T \quad \Gamma \vdash t_3 : T}{\Gamma \vdash \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 : T} \quad \text{(T-If)}$$

The guard $t_1$ must have type $\text{Bool}$. Both branches $t_2$ and $t_3$ must have the **same** type $T$, and that is the type of the whole conditional.

This rule is the source of the conservatism mentioned in Section 1.3: both branches must have the same type, even if only one branch is ever taken.

### 5.6 Natural Number Constants

$$\frac{}{\Gamma \vdash 0 : \text{Nat}} \quad \text{(T-Zero)}$$

$$\frac{\Gamma \vdash t : \text{Nat}}{\Gamma \vdash \text{succ}\; t : \text{Nat}} \quad \text{(T-Succ)}$$

$$\frac{\Gamma \vdash t : \text{Nat}}{\Gamma \vdash \text{pred}\; t : \text{Nat}} \quad \text{(T-Pred)}$$

$$\frac{\Gamma \vdash t : \text{Nat}}{\Gamma \vdash \text{iszero}\; t : \text{Bool}} \quad \text{(T-IsZero)}$$

Zero is a natural number. The successor and predecessor of a natural number are natural numbers. Testing whether a natural number is zero produces a boolean.

### 5.7 Summary of Typing Rules

For reference, here is the complete set of typing rules in compact form:

| Rule | Conclusion | Key Premises |
|------|-----------|--------------|
| T-Var | $\Gamma \vdash x : T$ | $x : T \in \Gamma$ |
| T-Abs | $\Gamma \vdash \lambda x:T_1.\,t : T_1 \to T_2$ | $\Gamma, x:T_1 \vdash t : T_2$ |
| T-App | $\Gamma \vdash t_1\;t_2 : T_2$ | $\Gamma \vdash t_1 : T_1 \to T_2$, $\Gamma \vdash t_2 : T_1$ |
| T-True | $\Gamma \vdash \text{true} : \text{Bool}$ | (none) |
| T-False | $\Gamma \vdash \text{false} : \text{Bool}$ | (none) |
| T-If | $\Gamma \vdash \text{if}\;t_1\;\text{then}\;t_2\;\text{else}\;t_3 : T$ | $\Gamma \vdash t_1 : \text{Bool}$, $\Gamma \vdash t_2 : T$, $\Gamma \vdash t_3 : T$ |
| T-Zero | $\Gamma \vdash 0 : \text{Nat}$ | (none) |
| T-Succ | $\Gamma \vdash \text{succ}\;t : \text{Nat}$ | $\Gamma \vdash t : \text{Nat}$ |
| T-Pred | $\Gamma \vdash \text{pred}\;t : \text{Nat}$ | $\Gamma \vdash t : \text{Nat}$ |
| T-IsZero | $\Gamma \vdash \text{iszero}\;t : \text{Bool}$ | $\Gamma \vdash t : \text{Nat}$ |

---

## 6. Type Derivation Trees

A **type derivation** (or **typing derivation**) is a tree-structured proof that a term is well-typed, built by composing instances of the typing rules.

### 6.1 Example: Identity Function on Booleans

Consider the term $\lambda x : \text{Bool}.\, x$. Its typing derivation is:

$$\frac{x : \text{Bool} \in (x : \text{Bool})}{\frac{x : \text{Bool} \vdash x : \text{Bool}}{\vdash \lambda x : \text{Bool}.\, x : \text{Bool} \to \text{Bool}} \quad \text{(T-Abs)}} \quad \text{(T-Var)}$$

Reading bottom-up: to show $\vdash \lambda x : \text{Bool}.\, x : \text{Bool} \to \text{Bool}$, by T-Abs we need $x : \text{Bool} \vdash x : \text{Bool}$, which holds by T-Var since $x : \text{Bool} \in (x : \text{Bool})$.

### 6.2 Example: Application

Consider the term $(\lambda x : \text{Bool}.\, x)\; \text{true}$. Its derivation:

$$\frac{\frac{\frac{x : \text{Bool} \in (x : \text{Bool})}{x : \text{Bool} \vdash x : \text{Bool}} \text{(T-Var)}}{\vdash \lambda x : \text{Bool}.\, x : \text{Bool} \to \text{Bool}} \text{(T-Abs)} \quad \frac{}{\vdash \text{true} : \text{Bool}} \text{(T-True)}}{\vdash (\lambda x : \text{Bool}.\, x)\; \text{true} : \text{Bool}} \quad \text{(T-App)}$$

### 6.3 Example: A Higher-Order Function

Let us type the term $\lambda f : \text{Nat} \to \text{Nat}.\, \lambda x : \text{Nat}.\, f\; (f\; x)$ (function composition with itself, i.e., "apply twice").

Let $\Gamma_0 = f : \text{Nat} \to \text{Nat}$ and $\Gamma_1 = \Gamma_0, x : \text{Nat}$.

First, we derive $\Gamma_1 \vdash f\; x : \text{Nat}$:

$$\frac{\frac{f : \text{Nat} \to \text{Nat} \in \Gamma_1}{\Gamma_1 \vdash f : \text{Nat} \to \text{Nat}} \text{(T-Var)} \quad \frac{x : \text{Nat} \in \Gamma_1}{\Gamma_1 \vdash x : \text{Nat}} \text{(T-Var)}}{\Gamma_1 \vdash f\; x : \text{Nat}} \quad \text{(T-App)}$$

Then, we derive $\Gamma_1 \vdash f\; (f\; x) : \text{Nat}$:

$$\frac{\frac{f : \text{Nat} \to \text{Nat} \in \Gamma_1}{\Gamma_1 \vdash f : \text{Nat} \to \text{Nat}} \text{(T-Var)} \quad \Gamma_1 \vdash f\; x : \text{Nat} \; \text{(from above)}}{\Gamma_1 \vdash f\; (f\; x) : \text{Nat}} \quad \text{(T-App)}$$

Two applications of T-Abs give us:

$$\vdash \lambda f : \text{Nat} \to \text{Nat}.\, \lambda x : \text{Nat}.\, f\; (f\; x) : (\text{Nat} \to \text{Nat}) \to \text{Nat} \to \text{Nat}$$

### 6.4 Example: Conditional with Natural Numbers

Type the term $\lambda x : \text{Nat}.\, \text{if}\; (\text{iszero}\; x)\; \text{then}\; 0\; \text{else}\; (\text{pred}\; x)$.

Let $\Gamma = x : \text{Nat}$.

$$\frac{\frac{\Gamma \vdash x : \text{Nat}}{\Gamma \vdash \text{iszero}\; x : \text{Bool}} \text{(T-IsZero)} \quad \frac{}{\Gamma \vdash 0 : \text{Nat}} \text{(T-Zero)} \quad \frac{\Gamma \vdash x : \text{Nat}}{\Gamma \vdash \text{pred}\; x : \text{Nat}} \text{(T-Pred)}}{\Gamma \vdash \text{if}\; (\text{iszero}\; x)\; \text{then}\; 0\; \text{else}\; (\text{pred}\; x) : \text{Nat}} \quad \text{(T-If)}$$

Then by T-Abs:

$$\vdash \lambda x : \text{Nat}.\, \text{if}\; (\text{iszero}\; x)\; \text{then}\; 0\; \text{else}\; (\text{pred}\; x) : \text{Nat} \to \text{Nat}$$

### 6.5 Example: An Ill-Typed Term

Consider the term $\lambda x : \text{Bool}.\, \text{succ}\; x$. Attempting to build a derivation:

By T-Abs, we need $x : \text{Bool} \vdash \text{succ}\; x : T$ for some $T$. By T-Succ, this requires $x : \text{Bool} \vdash x : \text{Nat}$. By T-Var, $x : \text{Bool} \vdash x : \text{Bool}$, but $\text{Bool} \neq \text{Nat}$. The derivation cannot be completed.

Similarly, the term $\text{true}\; \text{false}$ is ill-typed: by T-App we would need $\vdash \text{true} : T_1 \to T_2$, but by T-True, $\text{true}$ has type $\text{Bool}$, which is not an arrow type.

### 6.6 Example: Nested Conditionals

Type the term $\lambda x : \text{Nat}.\, \lambda y : \text{Nat}.\, \text{if}\; (\text{iszero}\; x)\; \text{then}\; y\; \text{else}\; (\text{if}\; (\text{iszero}\; y)\; \text{then}\; x\; \text{else}\; (\text{succ}\; x))$.

Let $\Gamma = x : \text{Nat},\; y : \text{Nat}$.

First, the inner conditional. We need:
- $\Gamma \vdash \text{iszero}\; y : \text{Bool}$ --- by T-IsZero applied to $\Gamma \vdash y : \text{Nat}$ (T-Var).
- $\Gamma \vdash x : \text{Nat}$ --- by T-Var.
- $\Gamma \vdash \text{succ}\; x : \text{Nat}$ --- by T-Succ applied to $\Gamma \vdash x : \text{Nat}$.

Both branches have type $\text{Nat}$, so by T-If:

$$\Gamma \vdash \text{if}\; (\text{iszero}\; y)\; \text{then}\; x\; \text{else}\; (\text{succ}\; x) : \text{Nat}$$

Now the outer conditional:
- $\Gamma \vdash \text{iszero}\; x : \text{Bool}$ --- by T-IsZero.
- $\Gamma \vdash y : \text{Nat}$ --- by T-Var.
- $\Gamma \vdash \text{if}\; (\text{iszero}\; y)\; \text{then}\; x\; \text{else}\; (\text{succ}\; x) : \text{Nat}$ --- from above.

Both branches have type $\text{Nat}$, so by T-If:

$$\Gamma \vdash \text{if}\; (\text{iszero}\; x)\; \text{then}\; y\; \text{else}\; (\text{if}\; (\text{iszero}\; y)\; \text{then}\; x\; \text{else}\; (\text{succ}\; x)) : \text{Nat}$$

Two applications of T-Abs give us the type $\text{Nat} \to \text{Nat} \to \text{Nat}$.

### 6.7 Example: Church-Style vs. Curry-Style

In the Church-style STLC, the identity function on $\text{Bool}$ and the identity function on $\text{Nat}$ are **different terms**:

$$\text{id}_\text{Bool} = \lambda x : \text{Bool}.\, x : \text{Bool} \to \text{Bool}$$

$$\text{id}_\text{Nat} = \lambda x : \text{Nat}.\, x : \text{Nat} \to \text{Nat}$$

These are syntactically distinct (the type annotations differ) and have different types. There is no single "identity function" in STLC --- we need a separate one for each type. This limitation is addressed by polymorphism in System F (Module 06), where we can write:

$$\text{id} = \Lambda X.\, \lambda x : X.\, x : \forall X.\, X \to X$$

### 6.8 Example: A Curried Two-Argument Function

Consider the addition function on natural numbers (using only successor):

$$\text{add1} = \lambda x : \text{Nat}.\, \text{succ}\; x : \text{Nat} \to \text{Nat}$$

We can apply it to $0$:

$$\text{add1}\; 0 = (\lambda x : \text{Nat}.\, \text{succ}\; x)\; 0 \to \text{succ}\; 0 : \text{Nat}$$

We cannot, however, define a general addition function in STLC without recursion (the $\text{fix}$ operator), because we have no way to iterate. This is a fundamental limitation of STLC.

---

## 7. Properties of the Typing Relation

### 7.1 Syntax-Directedness

**Definition 7.1 (Syntax-Directed).** A typing relation is **syntax-directed** if, for each syntactic form of term, there is exactly one typing rule whose conclusion matches that form.

**Proposition 7.1.** The typing relation of the simply typed lambda calculus is syntax-directed.

*Proof.* By inspection of the rules:
- Variables are handled only by T-Var.
- Abstractions are handled only by T-Abs.
- Applications are handled only by T-App.
- $\text{true}$ is handled only by T-True.
- $\text{false}$ is handled only by T-False.
- Conditionals are handled only by T-If.
- $0$ is handled only by T-Zero.
- $\text{succ}\; t$ is handled only by T-Succ.
- $\text{pred}\; t$ is handled only by T-Pred.
- $\text{iszero}\; t$ is handled only by T-IsZero.

No two rules have the same syntactic form in their conclusion. $\square$

**Consequence.** Because the typing relation is syntax-directed, it can be read as a **type-checking algorithm**: given $\Gamma$ and $t$, there is a deterministic procedure that either finds the unique $T$ such that $\Gamma \vdash t : T$, or reports that no such $T$ exists. This is exactly what we implement in Recitation 02.

### 7.2 Inversion of the Typing Relation

The syntax-directed nature of the typing relation gives us powerful **inversion** lemmas that allow us to reason backwards from a typing conclusion to its premises.

**Lemma 7.2 (Inversion of the Typing Relation).** The following hold:

1. If $\Gamma \vdash x : T$ then $x : T \in \Gamma$.
2. If $\Gamma \vdash \lambda x : T_1.\, t : T$ then $T = T_1 \to T_2$ for some $T_2$ with $\Gamma, x : T_1 \vdash t : T_2$.
3. If $\Gamma \vdash t_1\; t_2 : T$ then there exists $T_1$ such that $\Gamma \vdash t_1 : T_1 \to T$ and $\Gamma \vdash t_2 : T_1$.
4. If $\Gamma \vdash \text{true} : T$ then $T = \text{Bool}$.
5. If $\Gamma \vdash \text{false} : T$ then $T = \text{Bool}$.
6. If $\Gamma \vdash \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 : T$ then $\Gamma \vdash t_1 : \text{Bool}$ and $\Gamma \vdash t_2 : T$ and $\Gamma \vdash t_3 : T$.
7. If $\Gamma \vdash 0 : T$ then $T = \text{Nat}$.
8. If $\Gamma \vdash \text{succ}\; t : T$ then $T = \text{Nat}$ and $\Gamma \vdash t : \text{Nat}$.
9. If $\Gamma \vdash \text{pred}\; t : T$ then $T = \text{Nat}$ and $\Gamma \vdash t : \text{Nat}$.
10. If $\Gamma \vdash \text{iszero}\; t : T$ then $T = \text{Bool}$ and $\Gamma \vdash t : \text{Nat}$.

*Proof.* Each case follows directly from the fact that only one typing rule applies to the given syntactic form. For example, in case (2), the only rule whose conclusion has the form $\Gamma \vdash \lambda x : T_1.\, t : T$ is T-Abs, which requires $T = T_1 \to T_2$ and $\Gamma, x : T_1 \vdash t : T_2$. The other cases are analogous. $\square$

### 7.3 Uniqueness of Types

**Theorem 7.3 (Uniqueness of Types).** In the simply typed lambda calculus, if $\Gamma \vdash t : T$ and $\Gamma \vdash t : T'$, then $T = T'$.

*Proof.* By induction on the structure of $t$.

**Case** $t = x$: By inversion, both $T$ and $T'$ are the type assigned to $x$ in $\Gamma$. Since $\Gamma$ assigns at most one type to each variable, $T = T'$.

**Case** $t = \lambda x : T_1.\, t_1$: By inversion, $T = T_1 \to T_2$ where $\Gamma, x : T_1 \vdash t_1 : T_2$, and $T' = T_1 \to T_2'$ where $\Gamma, x : T_1 \vdash t_1 : T_2'$. By the induction hypothesis, $T_2 = T_2'$, so $T = T_1 \to T_2 = T_1 \to T_2' = T'$.

**Case** $t = t_1\; t_2$: By inversion, there exist $S$ and $S'$ such that $\Gamma \vdash t_1 : S \to T$ and $\Gamma \vdash t_2 : S$, and $\Gamma \vdash t_1 : S' \to T'$ and $\Gamma \vdash t_2 : S'$. By the induction hypothesis on $t_1$, $S \to T = S' \to T'$, so $T = T'$.

**Case** $t = \text{true}$: By inversion, $T = \text{Bool} = T'$.

**Case** $t = \text{false}$: By inversion, $T = \text{Bool} = T'$.

**Case** $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$: By inversion, $\Gamma \vdash t_2 : T$ and $\Gamma \vdash t_2 : T'$. By the induction hypothesis on $t_2$, $T = T'$.

**Case** $t = 0$: By inversion, $T = \text{Nat} = T'$.

**Case** $t = \text{succ}\; t_1$: By inversion, $T = \text{Nat} = T'$.

**Case** $t = \text{pred}\; t_1$: By inversion, $T = \text{Nat} = T'$.

**Case** $t = \text{iszero}\; t_1$: By inversion, $T = \text{Bool} = T'$.

$\square$

**Remark.** Uniqueness of types is a special property of STLC that fails in richer type systems. In System F (Module 06), terms can have multiple types. In systems with subtyping (Module 04), a term can have many types related by the subtype relation. Uniqueness in STLC is a direct consequence of the Church-style (explicitly annotated) presentation and the absence of subtyping or polymorphism.

---

## 8. Structural Properties of the Typing Relation

The typing relation satisfies several structural properties that are essential for its metatheory.

### 8.1 Permutation

**Lemma 8.1 (Permutation).** If $\Gamma \vdash t : T$ and $\Delta$ is a permutation of $\Gamma$, then $\Delta \vdash t : T$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$. The only rule that inspects the context is T-Var, which uses membership ($x : T \in \Gamma$), and membership is invariant under permutation. In the T-Abs case, $\Gamma, x : T_1$ is permuted to $\Delta, x : T_1$ (with $x : T_1$ appended at the same position), and the result follows by the induction hypothesis. $\square$

### 8.2 Weakening

**Lemma 8.2 (Weakening).** If $\Gamma \vdash t : T$ and $x \notin \text{dom}(\Gamma)$, then $\Gamma, x : S \vdash t : T$ for any type $S$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$.

**Case** T-Var: $\Gamma \vdash y : T$ because $y : T \in \Gamma$. Since $\Gamma \subseteq (\Gamma, x : S)$, we have $y : T \in (\Gamma, x : S)$, so $\Gamma, x : S \vdash y : T$ by T-Var.

**Case** T-Abs: $\Gamma \vdash \lambda y : T_1.\, t_1 : T_1 \to T_2$ because $\Gamma, y : T_1 \vdash t_1 : T_2$. By the induction hypothesis (with context $\Gamma, y : T_1$ and fresh variable $x$), $\Gamma, y : T_1, x : S \vdash t_1 : T_2$. By permutation, $\Gamma, x : S, y : T_1 \vdash t_1 : T_2$. By T-Abs, $\Gamma, x : S \vdash \lambda y : T_1.\, t_1 : T_1 \to T_2$.

**Case** T-App: $\Gamma \vdash t_1\; t_2 : T_2$ because $\Gamma \vdash t_1 : T_1 \to T_2$ and $\Gamma \vdash t_2 : T_1$. By the induction hypothesis, $\Gamma, x : S \vdash t_1 : T_1 \to T_2$ and $\Gamma, x : S \vdash t_2 : T_1$. By T-App, $\Gamma, x : S \vdash t_1\; t_2 : T_2$.

The remaining cases are similar. $\square$

### 8.3 Strengthening (Free Variables)

**Lemma 8.3 (Strengthening).** If $\Gamma, x : S \vdash t : T$ and $x \notin \text{FV}(t)$, then $\Gamma \vdash t : T$.

*Proof sketch.* By induction on the derivation. The T-Var case for variable $y \neq x$ goes through because $y : T \in \Gamma$ (the binding for $x$ is not used). The variable $x$ itself cannot appear because $x \notin \text{FV}(t)$. $\square$

### 8.4 Context Containment

**Definition 8.4.** We say that context $\Gamma$ is **contained in** context $\Delta$, written $\Gamma \subseteq \Delta$, if for every $x : T \in \Gamma$, we have $x : T \in \Delta$.

**Lemma 8.5 (Monotonicity).** If $\Gamma \vdash t : T$ and $\Gamma \subseteq \Delta$, then $\Delta \vdash t : T$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$. This is a generalization of the Weakening Lemma (which is the special case where $\Delta = \Gamma, x : S$ for a single fresh variable $x$).

**Case** T-Var: $\Gamma \vdash y : T$ because $y : T \in \Gamma$. Since $\Gamma \subseteq \Delta$, $y : T \in \Delta$, so $\Delta \vdash y : T$ by T-Var.

**Case** T-Abs: $\Gamma \vdash \lambda y : T_1.\, t_1 : T_1 \to T_2$ because $\Gamma, y : T_1 \vdash t_1 : T_2$. We have $\Gamma, y : T_1 \subseteq \Delta, y : T_1$ (since $\Gamma \subseteq \Delta$). By IH, $\Delta, y : T_1 \vdash t_1 : T_2$. By T-Abs, $\Delta \vdash \lambda y : T_1.\, t_1 : T_1 \to T_2$.

The remaining cases are similar. $\square$

### 8.5 Well-Formedness of Contexts

For the metatheory to go through smoothly, we need contexts to be well-formed: all variables are distinct. This is an implicit side condition throughout.

**Definition 8.6 (Well-Formed Context).** A context $\Gamma = x_1 : T_1, \ldots, x_n : T_n$ is **well-formed** if all the $x_i$ are pairwise distinct: $x_i \neq x_j$ for $i \neq j$.

When we write $\Gamma, x : T$, we implicitly require $x \notin \text{dom}(\Gamma)$ to preserve well-formedness.

---

## 9. Type Erasure

### 9.1 The Erasure Function

**Definition 9.1 (Type Erasure).** The **erasure** function $\text{erase}$ maps simply typed terms to untyped terms by removing type annotations:

$$\text{erase}(x) = x$$

$$\text{erase}(\lambda x : T.\, t) = \lambda x.\, \text{erase}(t)$$

$$\text{erase}(t_1\; t_2) = \text{erase}(t_1)\; \text{erase}(t_2)$$

$$\text{erase}(\text{true}) = \text{true}$$

$$\text{erase}(\text{false}) = \text{false}$$

$$\text{erase}(\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3) = \text{if}\; \text{erase}(t_1)\; \text{then}\; \text{erase}(t_2)\; \text{else}\; \text{erase}(t_3)$$

and similarly for $0$, $\text{succ}$, $\text{pred}$, $\text{iszero}$.

### 9.2 Erasure Commutes with Evaluation

**Theorem 9.2 (Erasure and Evaluation).** Let $t$ be a well-typed term in the simply typed lambda calculus.

1. If $t \to t'$ in the typed calculus, then $\text{erase}(t) \to \text{erase}(t')$ in the untyped calculus.
2. If $\text{erase}(t) \to u$ in the untyped calculus, then there exists $t'$ such that $t \to t'$ and $\text{erase}(t') = u$.

*Proof sketch.* Part (1): by induction on the derivation of $t \to t'$. Each typed evaluation rule corresponds to an untyped evaluation rule, and erasure preserves the syntactic structure. Part (2): by induction on the derivation of $\text{erase}(t) \to u$. $\square$

**Consequence.** The typed and untyped evaluation semantics agree: type annotations do not affect the runtime behavior of programs. This justifies the common compiler strategy of **erasing types after type checking**.

### 9.3 Typability

**Definition 9.3.** An untyped term $u$ is **typable** if there exists a simply typed term $t$ such that $\text{erase}(t) = u$ and $\vdash t : T$ for some type $T$.

Not all untyped terms are typable. The most famous example is the self-application combinator:

$$\omega = \lambda x.\, x\; x$$

If $\omega$ were typable, we would need $x : T_1 \vdash x\; x : T_2$. By T-App, $x : T_1 \vdash x : T_1 \to T_2$, but by T-Var, $x : T_1 \vdash x : T_1$, so $T_1 = T_1 \to T_2$. This equation has no finite solution (it would require an infinite type $T_1 = T_1 \to T_2 = (T_1 \to T_2) \to T_2 = \cdots$), so $\omega$ is not typable in STLC.

The non-typability of $\omega$ has a profound consequence: the **Y combinator** and all other fixed-point combinators are untypable in STLC. Since these are needed to define recursive functions, STLC cannot express general recursion. This is closely related to the normalization property (Theorem 9.4 below).

### 9.4 Normalization

**Theorem 9.4 (Strong Normalization of STLC).** Every well-typed term in the simply typed lambda calculus is strongly normalizing: every sequence of reductions starting from a well-typed term is finite.

This is one of the most important results about STLC. It means that:
- Every well-typed STLC program terminates.
- STLC is **not** Turing-complete.
- The Y combinator is correctly rejected by the type system: if it were typable, it could produce non-terminating computations, contradicting strong normalization.

The proof of strong normalization requires a technique called **logical relations** (also known as Tait's method or reducibility candidates). We sketch the idea in Lecture 02b; a full treatment requires Module 06 (System F), where strong normalization is proved for a more expressive language using Girard's reducibility candidates.

**Remark.** Strong normalization is lost when we add a fixed-point combinator $\text{fix}$ to the language (as in PCF or practical functional languages like Haskell and OCaml). The type system then no longer guarantees termination, but it still guarantees type safety.

---

## 10. The Type-Checking Algorithm

### 10.1 From Rules to Algorithm

Because the typing relation is syntax-directed, we can convert the inference rules directly into a recursive algorithm:

```
typeof(Gamma, x) =
  lookup x in Gamma; return its type or fail

typeof(Gamma, lambda x:T1. t) =
  let T2 = typeof(Gamma + {x:T1}, t)
  return T1 -> T2

typeof(Gamma, t1 t2) =
  let T = typeof(Gamma, t1)
  match T with
  | T1 -> T2 ->
      let T1' = typeof(Gamma, t2)
      if T1 = T1' then return T2 else fail
  | _ -> fail

typeof(Gamma, true) = Bool
typeof(Gamma, false) = Bool

typeof(Gamma, if t1 then t2 else t3) =
  check typeof(Gamma, t1) = Bool
  let T2 = typeof(Gamma, t2)
  let T3 = typeof(Gamma, t3)
  if T2 = T3 then return T2 else fail

typeof(Gamma, 0) = Nat
typeof(Gamma, succ t) =
  check typeof(Gamma, t) = Nat; return Nat
typeof(Gamma, pred t) =
  check typeof(Gamma, t) = Nat; return Nat
typeof(Gamma, iszero t) =
  check typeof(Gamma, t) = Nat; return Bool
```

This algorithm runs in time linear in the size of the term (assuming constant-time context lookup, e.g., using a hash map). We implement it in OCaml in Recitation 02.

### 10.2 Soundness and Completeness of the Algorithm

**Theorem 10.1 (Soundness).** If $\text{typeof}(\Gamma, t)$ returns $T$, then $\Gamma \vdash t : T$.

*Proof.* By induction on the structure of $t$. In each case, the algorithm returns a type $T$ only when the premises of the corresponding typing rule have been verified. For example, in the T-App case, the algorithm checks that $t_1$ has an arrow type and that the argument type matches, and returns the result type. $\square$

**Theorem 10.2 (Completeness).** If $\Gamma \vdash t : T$, then $\text{typeof}(\Gamma, t)$ returns $T$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$. In each case, the typing derivation provides exactly the information needed for the algorithm to succeed and return the correct type. For example, in the T-Abs case, the derivation provides $\Gamma, x : T_1 \vdash t_1 : T_2$, and by the induction hypothesis, $\text{typeof}(\Gamma + \{x : T_1\}, t_1)$ returns $T_2$, so the algorithm returns $T_1 \to T_2$. $\square$

### 10.3 Complexity Analysis

**Proposition 10.3.** The type-checking algorithm runs in $O(n \cdot d)$ time, where $n$ is the size of the term and $d$ is the maximum depth of the typing context.

*Proof sketch.* The algorithm makes one recursive call for each subterm (hence $O(n)$ calls). Each call performs at most one context lookup (which takes $O(d)$ time with a list-based context) and a constant number of type equality checks. With a hash-map-based context, the lookup is $O(1)$ amortized, giving $O(n)$ overall. Type equality checks take time proportional to the size of the types, but in STLC, types that appear in the program are bounded by the term size, so the total time remains $O(n)$ with appropriate sharing. $\square$

### 10.4 Decidability

**Theorem 10.4 (Decidability of Type Checking).** Given a context $\Gamma$ and a term $t$, it is decidable whether there exists a type $T$ such that $\Gamma \vdash t : T$.

*Proof.* The algorithm in Section 10.1 always terminates (it recurses on strict subterms, which is a well-founded recursion) and is sound and complete with respect to the typing rules (by Theorems 10.1 and 10.2). $\square$

**Theorem 10.5 (Decidability of Type Inhabitation).** Given a type $T$, it is decidable whether there exists a closed term $t$ such that $\vdash t : T$.

This is a much harder result. By the Curry-Howard correspondence (Lecture 02d), type inhabitation in STLC corresponds to provability in intuitionistic propositional logic, which is decidable. However, the problem is surprisingly difficult:

**Theorem 10.6 (Statman, 1979).** The type inhabitation problem for the simply typed lambda calculus is PSPACE-complete.

This means that while a type-checking algorithm is efficient (linear time), determining whether a given type has *any* inhabitant requires exponential time in the worst case (unless PSPACE = P).

For example, the type

$$((A \to B) \to C) \to ((C \to D) \to E) \to \cdots$$

with deeply nested implications can require exploring exponentially many proof strategies. The PSPACE-completeness result also implies that no compact certificates (polynomial-size proofs) exist for uninhabitability, unless NP = PSPACE.

### 10.5 Type Checking vs. Type Inference

It is important to distinguish two related but different problems:

1. **Type checking**: Given $\Gamma$, $t$, and $T$, decide whether $\Gamma \vdash t : T$. In STLC (Church-style, with type annotations on lambdas), this is decidable in linear time.

2. **Type inference** (or **type reconstruction**): Given $\Gamma$ and an *unannotated* term $t'$ (Curry-style), find $T$ such that $\Gamma \vdash t' : T$, or report that no such $T$ exists. This is the subject of Module 05. For STLC, type inference is decidable (and efficient via Algorithm W), but it becomes undecidable when the type system is extended sufficiently (e.g., System F without annotations).

In Church-style STLC, type checking and type inference coincide: the type annotations on lambda parameters provide all the information needed, and the type of every term is uniquely determined (Theorem 7.3). This is why the algorithm in Section 10.1 can be read as either a type checker or a type inferencer.

---

## 11. Comparison: Typed vs. Untyped Lambda Calculus

| Property | Untyped $\lambda$-calculus | Simply Typed $\lambda$-calculus |
|----------|---------------------------|-------------------------------|
| Self-application $x\;x$ | Allowed | Forbidden (untypable) |
| Fixed-point combinator | Expressible (Y, $\Theta$, etc.) | Untypable |
| General recursion | Yes | No (requires $\text{fix}$ extension) |
| Turing-complete | Yes | No |
| Termination | Not guaranteed | Guaranteed (strong normalization) |
| Stuck terms | Possible | Impossible (type safety) |
| Type annotations | None | On lambda parameters |
| Number of types per term | N/A | Exactly one (uniqueness) |

### 11.1 What STLC Can Express

Despite its limitations, STLC can express a rich class of functions. Every function that can be defined using composition, conditionals, and the arithmetic primitives (successor, predecessor, iszero) without recursion is expressible. Some examples:

- The identity function at any type: $\lambda x : T.\, x$.
- Constant functions: $\lambda x : T.\, c$ for any closed value $c$.
- Function composition: $\lambda f : B \to C.\, \lambda g : A \to B.\, \lambda x : A.\, f\; (g\; x)$.
- Boolean operations: $\lambda b : \text{Bool}.\, \text{if}\; b\; \text{then}\; \text{false}\; \text{else}\; \text{true}$ (negation).
- Predecessor: $\lambda n : \text{Nat}.\, \text{pred}\; n$.
- Sign testing: $\lambda n : \text{Nat}.\, \text{iszero}\; n$.

What STLC **cannot** express (without extensions):
- Recursive functions (factorial, Fibonacci, etc.) --- requires $\text{fix}$.
- Data structures (lists, trees) --- requires recursive types (Module 03).
- Polymorphic functions --- requires System F (Module 06).
- Self-interpreters --- provably impossible in any strongly normalizing language.

### 11.2 The Expressiveness Hierarchy

The STLC sits at a specific point in a hierarchy of lambda calculi, ordered by expressiveness:

$$\text{STLC} \subset \text{STLC} + \text{fix} \subset \text{System F} \subset \text{System F}_\omega \subset \text{CoC} \subset \text{CIC}$$

Each extension adds expressiveness:
- Adding $\text{fix}$: Turing-completeness, but loses strong normalization.
- System F: Polymorphism, but type inference becomes undecidable.
- System F$_\omega$: Type operators, higher kinds.
- Calculus of Constructions: Dependent types.
- Calculus of Inductive Constructions: Inductive types (the basis of Coq).

---

## 12. Worked Exercises

### Exercise 12.1

Give a type derivation for the term $\lambda f : \text{Bool} \to \text{Bool}.\, \lambda b : \text{Bool}.\, f\; (f\; b)$.

**Solution.** Let $\Gamma = f : \text{Bool} \to \text{Bool},\; b : \text{Bool}$.

Step 1: Derive $\Gamma \vdash f\; b : \text{Bool}$.

$$\frac{\frac{f : \text{Bool} \to \text{Bool} \in \Gamma}{\Gamma \vdash f : \text{Bool} \to \text{Bool}} \text{(T-Var)} \quad \frac{b : \text{Bool} \in \Gamma}{\Gamma \vdash b : \text{Bool}} \text{(T-Var)}}{\Gamma \vdash f\; b : \text{Bool}} \quad \text{(T-App)}$$

Step 2: Derive $\Gamma \vdash f\; (f\; b) : \text{Bool}$.

$$\frac{\Gamma \vdash f : \text{Bool} \to \text{Bool} \quad \Gamma \vdash f\; b : \text{Bool}}{\Gamma \vdash f\; (f\; b) : \text{Bool}} \quad \text{(T-App)}$$

Step 3: Two applications of T-Abs yield:

$$\vdash \lambda f : \text{Bool} \to \text{Bool}.\, \lambda b : \text{Bool}.\, f\; (f\; b) : (\text{Bool} \to \text{Bool}) \to \text{Bool} \to \text{Bool}$$

### Exercise 12.2

Show that $\lambda x : \text{Nat}.\, \text{if}\; x\; \text{then}\; 0\; \text{else}\; (\text{succ}\; 0)$ is ill-typed.

**Solution.** By T-If, the guard of the conditional must have type $\text{Bool}$. In the context $x : \text{Nat}$, we have $x : \text{Nat} \vdash x : \text{Nat}$ by T-Var. Since $\text{Nat} \neq \text{Bool}$, the T-If rule cannot be applied. Therefore the term is ill-typed.

### Exercise 12.3

Show that the term $\lambda x : T.\, x$ is typable for any type $T$, and give its type.

**Solution.** For any type $T$:

$$\frac{\frac{x : T \in (x : T)}{x : T \vdash x : T} \text{(T-Var)}}{\vdash \lambda x : T.\, x : T \to T} \quad \text{(T-Abs)}$$

The type is $T \to T$. Note that in STLC, each choice of $T$ gives a different term $\lambda x : T.\, x$ (because the annotation is part of the syntax). In System F, we can write a single polymorphic identity $\Lambda X.\, \lambda x : X.\, x : \forall X.\, X \to X$.

### Exercise 12.4

Prove that if $\Gamma \vdash t : T$ then $\text{FV}(t) \subseteq \text{dom}(\Gamma)$.

**Solution.** By induction on the derivation of $\Gamma \vdash t : T$.

**Case** T-Var: $t = x$ and $x : T \in \Gamma$. Then $\text{FV}(x) = \{x\} \subseteq \text{dom}(\Gamma)$.

**Case** T-Abs: $t = \lambda x : T_1.\, t_1$ and $\Gamma, x : T_1 \vdash t_1 : T_2$. By IH, $\text{FV}(t_1) \subseteq \text{dom}(\Gamma, x : T_1) = \text{dom}(\Gamma) \cup \{x\}$. Then $\text{FV}(\lambda x : T_1.\, t_1) = \text{FV}(t_1) \setminus \{x\} \subseteq \text{dom}(\Gamma)$.

**Case** T-App: $t = t_1\; t_2$ with $\Gamma \vdash t_1 : T_1 \to T_2$ and $\Gamma \vdash t_2 : T_1$. By IH, $\text{FV}(t_1) \subseteq \text{dom}(\Gamma)$ and $\text{FV}(t_2) \subseteq \text{dom}(\Gamma)$. Then $\text{FV}(t_1\; t_2) = \text{FV}(t_1) \cup \text{FV}(t_2) \subseteq \text{dom}(\Gamma)$.

The remaining cases are similar (constants have no free variables; compound forms are unions of their subterms' free variables). $\square$

### Exercise 12.5

Show that the term $(\lambda f : \text{Bool} \to \text{Bool}.\, f)\; (\lambda x : \text{Nat}.\, x)$ is ill-typed.

**Solution.** By T-App, we need:
- $\vdash \lambda f : \text{Bool} \to \text{Bool}.\, f : (\text{Bool} \to \text{Bool}) \to T$ for some $T$
- $\vdash \lambda x : \text{Nat}.\, x : \text{Bool} \to \text{Bool}$

For the first subterm, by T-Abs: $f : \text{Bool} \to \text{Bool} \vdash f : \text{Bool} \to \text{Bool}$ by T-Var, so $\vdash \lambda f : \text{Bool} \to \text{Bool}.\, f : (\text{Bool} \to \text{Bool}) \to (\text{Bool} \to \text{Bool})$. The domain type is $\text{Bool} \to \text{Bool}$.

For the second subterm, by T-Abs: $x : \text{Nat} \vdash x : \text{Nat}$ by T-Var, so $\vdash \lambda x : \text{Nat}.\, x : \text{Nat} \to \text{Nat}$.

The argument type is $\text{Nat} \to \text{Nat}$, but the parameter type is $\text{Bool} \to \text{Bool}$. Since $\text{Nat} \to \text{Nat} \neq \text{Bool} \to \text{Bool}$, the T-App rule fails. The term is ill-typed.

### Exercise 12.6

How many distinct closed values of type $\text{Bool} \to \text{Bool}$ exist?

**Solution.** A closed value of type $\text{Bool} \to \text{Bool}$ must be a lambda abstraction $\lambda x : \text{Bool}.\, t$ where $x : \text{Bool} \vdash t : \text{Bool}$. Since $t$ must evaluate to either $\text{true}$ or $\text{false}$ for each possible input ($\text{true}$ and $\text{false}$), there are $2^2 = 4$ extensionally distinct functions:

1. $\lambda x : \text{Bool}.\, \text{true}$ (constant true)
2. $\lambda x : \text{Bool}.\, \text{false}$ (constant false)
3. $\lambda x : \text{Bool}.\, x$ (identity)
4. $\lambda x : \text{Bool}.\, \text{if}\; x\; \text{then}\; \text{false}\; \text{else}\; \text{true}$ (negation)

There are infinitely many syntactically distinct terms of this type (e.g., $\lambda x : \text{Bool}.\, \text{if}\; x\; \text{then}\; \text{true}\; \text{else}\; \text{true}$), but they all reduce to one of the four normal forms above.

### Exercise 12.7

Prove that substitution is type-preserving for the T-True case: if $\Gamma, x : S \vdash \text{true} : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\, \text{true} : T$.

**Solution.** By inversion on $\Gamma, x : S \vdash \text{true} : T$, we get $T = \text{Bool}$ (since T-True is the only rule for $\text{true}$). Now $[x \mapsto s]\, \text{true} = \text{true}$ (substitution has no effect on constants). By T-True, $\Gamma \vdash \text{true} : \text{Bool} = T$. $\square$

### Exercise 12.8

State precisely what goes wrong if we try to type the term $(\lambda x : T.\, x\; x)$ for any type $T$.

**Solution.** Suppose $\vdash \lambda x : T.\, x\; x : S$ for some types $T, S$. By T-Abs, $S = T \to T'$ for some $T'$, and $x : T \vdash x\; x : T'$. By T-App, there exists $U$ such that $x : T \vdash x : U \to T'$ and $x : T \vdash x : U$. By T-Var (applied twice), $T = U \to T'$ and $T = U$. From these two equations: $U = U \to T'$. Substituting: $U = U \to T' = (U \to T') \to T' = ((U \to T') \to T') \to T' = \cdots$. This requires $U$ to be a solution of $U = U \to T'$, which has no finite solution. Therefore, no type $T$ makes this term typable.

This is precisely the argument from Section 9.3: self-application is untypable in STLC because it requires an infinite (recursive) type. Recursive types (Module 03) and equi-recursive systems do allow self-application, but at the cost of losing strong normalization.

---

## Summary

In this lecture, we introduced the **simply typed lambda calculus** (STLC), the foundational typed programming language:

- **Simple types** consist of base types ($\text{Bool}$, $\text{Nat}$) and arrow types ($T_1 \to T_2$).
- Terms are annotated with types on lambda parameters (**Church-style**), enabling decidable type checking.
- The **typing relation** $\Gamma \vdash t : T$ is defined by ten inference rules (T-Var, T-Abs, T-App, T-True, T-False, T-If, T-Zero, T-Succ, T-Pred, T-IsZero).
- The typing relation is **syntax-directed**: each syntactic form has exactly one rule, yielding a direct type-checking algorithm.
- STLC enjoys **uniqueness of types**: every well-typed term has exactly one type.
- **Type erasure** shows that evaluation is independent of types: types are a static discipline.
- STLC is **strongly normalizing**: every well-typed term terminates. Consequently, STLC is not Turing-complete, and fixed-point combinators are untypable.
- The type-checking problem is decidable (and efficiently so); type inhabitation is decidable but PSPACE-complete.

**Looking ahead.** In Lecture 02b, we prove the two fundamental theorems of type safety (progress and preservation), establishing that well-typed STLC programs never get stuck. In Lecture 02c, we extend STLC with products, sums, unit, and void. In Lecture 02d, we explore the deep connection between STLC and intuitionistic propositional logic via the Curry-Howard correspondence.

The metatheory of STLC --- particularly the proof techniques introduced in this module (induction on typing derivations, inversion, canonical forms) --- forms the backbone of type-theoretic reasoning. Every type system we study in later modules (subtyping, polymorphism, dependent types, linear types) will use these same proof patterns, generalized to richer settings.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*. MIT Press. Chapters 8-9. The primary reference for STLC and its metatheory.

2. **Church, A.** (1940). "A Formulation of the Simple Theory of Types." *Journal of Symbolic Logic*, 5(2), 56-68. The original paper introducing the simply typed lambda calculus.

3. **Barendregt, H.** (1992). "Lambda Calculi with Types." In *Handbook of Logic in Computer Science*, Vol. 2. A comprehensive survey of typed lambda calculi.

4. **Harper, R.** (2016). *Practical Foundations for Programming Languages*. 2nd ed. Cambridge University Press. Chapters 4-8. An alternative presentation emphasizing the judgmental approach.

5. **Curry, H. B. and Feys, R.** (1958). *Combinatory Logic*, Vol. I. North-Holland. The Curry-style approach to types.

6. **Hindley, J. R. and Seldin, J. P.** (2008). *Lambda-Calculus and Combinators: An Introduction*. Cambridge University Press. Covers both Church-style and Curry-style typed lambda calculi.

7. **Statman, R.** (1979). "The Typed Lambda-Calculus is not Elementary Recursive." *Theoretical Computer Science*, 9(1), 73-81. Complexity of type inhabitation.

8. **Gentzen, G.** (1935). "Untersuchungen uber das logische Schliessen." *Mathematische Zeitschrift*, 39, 176-210. The natural deduction system that STLC typing rules are modeled on.

9. **Tait, W. W.** (1967). "Intensional Interpretations of Functionals of Finite Type I." *Journal of Symbolic Logic*, 32(2), 198-212. The logical relations proof of strong normalization.

10. **Plotkin, G. D.** (1977). "LCF Considered as a Programming Language." *Theoretical Computer Science*, 5(3), 223-255. STLC extended with recursion (PCF), the canonical example of a typed language with general recursion.
