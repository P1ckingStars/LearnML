---
title: "Lecture 09d: Effect Systems and Algebraic Effects"
tags:
  - type-theory
  - substructural
  - lecture
---
# Lecture 09d: Effect Systems and Algebraic Effects

> **Module 09 --- Substructural & Effect Types (Weeks 17--18)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain the problem of tracking computational effects in types and motivate effect systems as a solution.
2. Define effect annotations on function types and explain effect polymorphism and effect rows.
3. Describe Moggi's monadic approach to effects and explain its limitations that motivate algebraic effects.
4. Define algebraic effects as operations paired with handlers, and state the typing rules for effect operations and handlers.
5. Encode standard computational effects (exceptions, state, nondeterminism, async) as algebraic effects with handlers.
6. Explain the connection between effect handlers and delimited continuations.
7. Relate algebraic effects to free monads and explain the trade-offs between the two approaches.
8. Identify real-world languages that support algebraic effects (Eff, Koka, OCaml 5) and describe their type systems.

---

## 1. Motivation: The Effect Problem

A *pure* function $f : A \to B$ maps every input of type $A$ to an output of type $B$, and does nothing else. It does not raise exceptions, mutate state, perform I/O, spawn threads, or make nondeterministic choices. The type $A \to B$ tells us exactly what $f$ does.

But most useful computations have *effects*: they read and write mutable state, throw and catch exceptions, send and receive messages, interact with the operating system, or make choices that branch the execution. The type $A \to B$ does not distinguish a pure function from one that launches missiles.

This is the *effect problem*: how can we track, at the type level, which effects a computation may perform, and how can we give programmers control over the semantics of those effects?

There have been three major approaches:

1. **Monads** (Moggi, 1991; Wadler, 1992): wrap effectful computations in a monad $M$. A function $A \to M\; B$ explicitly marks its effectfulness. But composing different effects requires monad transformers, which are cumbersome and do not compose well.

2. **Effect systems** (Gifford and Lucassen, 1986; Talpin and Jouvelot, 1994): annotate the function type with an *effect set* $\varepsilon$: the type $A \xrightarrow{\varepsilon} B$ means "a function from $A$ to $B$ that may perform effects in $\varepsilon$." This is lightweight but does not provide a mechanism for *handling* effects.

3. **Algebraic effects and handlers** (Plotkin and Power, 2003; Plotkin and Pretnar, 2009): effects are *operations* (like `raise`, `get`, `put`), and *handlers* provide their semantics. This approach combines the expressiveness of monads with the composability of effect systems.

This lecture develops all three approaches, with emphasis on algebraic effects.

---

## 2. Core Theory

### 2.1 Effect Systems: The Basic Idea

**Definition 2.1.1 (Effect-annotated function type).** An *effect system* extends the type language with effect annotations on function types:

$$A \xrightarrow{\varepsilon} B$$

where $\varepsilon$ is a set (or row) of *effect labels* drawn from some set $\mathcal{E}$ of effect names. The annotation $\varepsilon$ describes the effects that the function may perform when applied.

**Example 2.1.2.**

$$\mathsf{readFile} : \mathsf{String} \xrightarrow{\{\mathsf{IO}, \mathsf{Exn}\}} \mathsf{String}$$

This type says: `readFile` takes a string (filename), may perform I/O and may throw an exception, and (if it succeeds) returns a string.

$$\mathsf{add} : \mathsf{Int} \times \mathsf{Int} \xrightarrow{\emptyset} \mathsf{Int}$$

This type says: `add` is a pure function (no effects).

**Definition 2.1.3 (Effect ordering).** Effects are ordered by inclusion: if $\varepsilon_1 \subseteq \varepsilon_2$, then a function with effects $\varepsilon_1$ can be used where effects $\varepsilon_2$ are expected (it performs fewer effects, which is safe). This induces a subtyping relation:

$$\frac{\varepsilon_1 \subseteq \varepsilon_2}{A \xrightarrow{\varepsilon_1} B <: A \xrightarrow{\varepsilon_2} B} \; (\text{Sub-Eff})$$

**Definition 2.1.4 (Typing rules with effects).** The key rules are:

**Abstraction:**

$$\frac{\Gamma, x : A \vdash M : B \mathbin{!} \varepsilon}{\Gamma \vdash \lambda x.\, M : A \xrightarrow{\varepsilon} B \mathbin{!} \emptyset} \; (\text{Abs})$$

The judgment $\Gamma \vdash M : A \mathbin{!} \varepsilon$ means: "under $\Gamma$, $M$ has type $A$ and may perform effects $\varepsilon$." The lambda abstraction captures the effect in its type annotation; the abstraction itself is a value and performs no effect ($\emptyset$).

**Application:**

$$\frac{\Gamma \vdash M : A \xrightarrow{\varepsilon_f} B \mathbin{!} \varepsilon_1 \quad \Gamma \vdash N : A \mathbin{!} \varepsilon_2}{\Gamma \vdash M\; N : B \mathbin{!} \varepsilon_1 \cup \varepsilon_2 \cup \varepsilon_f} \; (\text{App})$$

The effects of an application are the union of: the effects of evaluating the function ($\varepsilon_1$), the effects of evaluating the argument ($\varepsilon_2$), and the effects of the function body ($\varepsilon_f$).

**Variable:**

$$\frac{x : A \in \Gamma}{\Gamma \vdash x : A \mathbin{!} \emptyset} \; (\text{Var})$$

Variables are values; they perform no effects.

**Subsumption:**

$$\frac{\Gamma \vdash M : A \mathbin{!} \varepsilon_1 \quad \varepsilon_1 \subseteq \varepsilon_2}{\Gamma \vdash M : A \mathbin{!} \varepsilon_2} \; (\text{Sub})$$

A computation with fewer effects can be used where more effects are expected.

### 2.2 Effect Polymorphism

**Definition 2.2.1 (Effect-polymorphic types).** Just as we have type polymorphism ($\forall \alpha.\, \ldots$), we need *effect polymorphism* ($\forall \epsilon.\, \ldots$) to write generic higher-order functions:

$$\mathsf{map} : \forall \alpha.\, \forall \beta.\, \forall \epsilon.\, (\alpha \xrightarrow{\epsilon} \beta) \to \mathsf{List}(\alpha) \xrightarrow{\epsilon} \mathsf{List}(\beta)$$

This type says: `map` takes a function with any effects $\epsilon$ and applies it to each element of a list, producing the same effects $\epsilon$.

Without effect polymorphism, we would need separate versions of `map` for pure functions, for functions with state, for functions with exceptions, etc.

**Definition 2.2.2 (Effect rows).** Some effect systems (notably Koka and Eff) use *rows* rather than sets for effect annotations. An effect row is an ordered sequence of effect labels, possibly with a *row variable* $\mu$ representing an unknown tail:

$$\varepsilon ::= \langle \rangle \mid \langle l \mid \varepsilon \rangle \mid \mu$$

The row $\langle \mathsf{Exn} \mid \langle \mathsf{State} \mid \mu \rangle \rangle$ means "effects include at least Exn and State, plus whatever $\mu$ represents."

Row polymorphism allows expressing "all effects except $l$" and supports *effect handler scoping*: a handler for effect $l$ removes $l$ from the row, leaving the remaining effects unchanged.

### Background: Monads and Computational Effects

This subsection provides a self-contained review of monads for readers who have not encountered them before. Readers familiar with monads may skip ahead to Section 2.3.

**Definition (Monad).** A *monad* on a category (or, in programming terms, on a type system) is a triple $(M, \mathsf{return}, \mathsf{bind})$ consisting of:

1. A *type constructor* $M : \mathsf{Type} \to \mathsf{Type}$, which lifts an ordinary type $A$ into an "effectful" type $M\; A$.
2. A *unit* (or *return*) operation:

$$\mathsf{return} : A \to M\; A$$

which embeds a pure value into the effectful type.

3. A *bind* (or *extend*) operation:

$$\mathsf{bind} : M\; A \to (A \to M\; B) \to M\; B$$

which sequences two effectful computations: it runs the first, feeds the result to the second, and combines their effects.

These must satisfy three laws:

$$\mathsf{bind}\; (\mathsf{return}\; a)\; f = f\; a \quad \text{(left unit)}$$

$$\mathsf{bind}\; m\; \mathsf{return} = m \quad \text{(right unit)}$$

$$\mathsf{bind}\; (\mathsf{bind}\; m\; f)\; g = \mathsf{bind}\; m\; (\lambda x.\, \mathsf{bind}\; (f\; x)\; g) \quad \text{(associativity)}$$

Left unit says that injecting a pure value and immediately binding is the same as applying the function directly. Right unit says that binding with $\mathsf{return}$ is the identity. Associativity says that the order of grouping sequential binds does not matter.

**Example (Maybe/Option monad).** The *Maybe* monad models partial computations---functions that may fail to return a result. The type constructor is:

$$M\; A = A + \mathsf{Unit}$$

A value is either $\mathsf{Some}\; a$ or $\mathsf{None}$. The $\mathsf{return}$ wraps a value in $\mathsf{Some}$, and $\mathsf{bind}$ propagates $\mathsf{None}$ automatically: if the first computation fails, the entire sequence fails without running subsequent steps.

**Example (State monad).** The *State* monad models computations that read and modify a mutable state of type $S$. The type constructor is:

$$M\; A = S \to A \times S$$

A stateful computation takes an initial state and produces a result paired with an updated state. The $\mathsf{bind}$ threads the state through sequentially, feeding the output state of the first computation as the input state of the second.

**Example (IO monad).** In Haskell, *all* side effects (file I/O, network access, mutable references, concurrency) are mediated through the $\mathsf{IO}$ monad. A value of type $\mathsf{IO}\; A$ is an "action" that, when executed by the runtime, may interact with the outside world and produce a result of type $A$. The type system enforces that I/O actions can only be sequenced inside $\mathsf{IO}$, keeping the rest of the language pure.

**Remark (Monads as structuring effects).** Moggi's key insight (1991) was that monads provide a *uniform* framework for computational effects. In a purely typed lambda calculus, a function $f : A \to B$ is referentially transparent. To account for effects, we replace this with $f : A \to M\; B$: the codomain is wrapped in a monad $M$ that describes what kind of effect $f$ may perform. Different choices of $M$ capture different effects (partiality, state, I/O, nondeterminism, continuations), but the same $\mathsf{return}$/$\mathsf{bind}$ interface structures their composition. Wadler (1992) popularized this idea as a practical programming technique, leading to Haskell's adoption of monadic I/O.

**Remark (Monad transformers).** A natural question arises: what if a computation needs *multiple* effects simultaneously (e.g., both state and exceptions)? Given monads $M$ and $N$, their composition $M \circ N$ is generally *not* a monad. The standard workaround is *monad transformers*: type constructors that layer one monad on top of another. For example:

$$\mathsf{StateT}\; S\; M\; A = S \to M\; (A \times S)$$

adds state to any monad $M$, and:

$$\mathsf{ExceptT}\; E\; M\; A = M\; (A + E)$$

adds exceptions. However, the ordering of transformers matters semantically: $\mathsf{StateT}\; S\; (\mathsf{ExceptT}\; E\; \mathsf{Identity})$ and $\mathsf{ExceptT}\; E\; (\mathsf{StateT}\; S\; \mathsf{Identity})$ are *different* monads. In the first, an exception rolls back state changes; in the second, state changes persist through exceptions. This ordering sensitivity is a fundamental consequence of the non-commutativity of monad composition.

**Remark (Limitations motivating algebraic effects).** While monads are a powerful organizing principle, they have well-known practical limitations that motivate the development of algebraic effects:

1. *Monads do not compose freely.* Combining $n$ effects requires choosing a specific transformer stack, and the stack order affects semantics.
2. *Lift boilerplate.* Operations must be explicitly lifted through each transformer layer. In a stack of depth $n$, an operation at the base requires $n - 1$ lifts.
3. *Rigidity.* Adding or removing an effect from a transformer stack requires modifying every type signature in the affected code.
4. *Effect semantics is fixed.* A monadic type $M\; A$ bakes in a *single* interpretation of the effect. In contrast, algebraic effects separate the *interface* (operations) from the *implementation* (handlers), allowing the same effectful code to be run under different handlers with different semantics.

Algebraic effects address all four limitations: effects compose via row polymorphism without transformers, no lifting is needed, effects can be added or removed locally, and handlers provide pluggable semantics. Section 2.3 reviews the monadic approach more concisely in the context of this lecture, and Sections 2.4 onward develop the algebraic alternative.

### 2.3 Monads as an Approach to Effects

Before algebraic effects, the dominant approach to tracking effects in typed functional programming was *monads* (Moggi, 1991; Wadler, 1992).

**Definition 2.3.1 (Monad).** A *monad* consists of:
- A type constructor $M : \mathsf{Type} \to \mathsf{Type}$,
- $\mathsf{return} : A \to M\; A$ (inject a pure value),
- $\mathsf{bind} : M\; A \to (A \to M\; B) \to M\; B$ (sequence effectful computations),

satisfying the monad laws:

$$\mathsf{bind}\; (\mathsf{return}\; a)\; f = f\; a \quad \text{(left identity)}$$

$$\mathsf{bind}\; m\; \mathsf{return} = m \quad \text{(right identity)}$$

$$\mathsf{bind}\; (\mathsf{bind}\; m\; f)\; g = \mathsf{bind}\; m\; (\lambda x.\, \mathsf{bind}\; (f\; x)\; g) \quad \text{(associativity)}$$

**Example 2.3.2 (Common monads for effects).**

| Effect | Monad $M\; A$ |
|---|---|
| Exceptions | $A + E$ (either a value or an error) |
| State | $S \to A \times S$ (state transformer) |
| Nondeterminism | $\mathsf{List}\; A$ (multiple results) |
| I/O | $\mathsf{IO}\; A$ (abstract I/O action) |
| Continuations | $(A \to R) \to R$ |

**Problem 2.3.3 (Composing monads).** Given two monads $M$ and $N$, their composition $M \circ N$ is generally *not* a monad. This is the *monad composition problem*. The standard solution is *monad transformers*:

$$\mathsf{StateT}\; S\; M\; A = S \to M\; (A \times S)$$

$$\mathsf{ExceptT}\; E\; M\; A = M\; (A + E)$$

But monad transformers have well-known drawbacks:

1. **Order dependence.** $\mathsf{StateT}\; S\; (\mathsf{ExceptT}\; E)$ and $\mathsf{ExceptT}\; E\; (\mathsf{StateT}\; S)$ behave differently: in the former, exceptions roll back state; in the latter, they preserve it. The programmer must choose the right order.

2. **Lift boilerplate.** Operations must be *lifted* through transformer layers. In a stack of $n$ transformers, an operation at the bottom requires $n-1$ lifts.

3. **Performance.** Monad transformer stacks incur runtime overhead from wrapping and unwrapping.

4. **Modularity.** Adding a new effect to an existing codebase requires threading the new transformer through the entire stack.

Algebraic effects solve all four problems.

### 2.4 Algebraic Effects: Operations and Handlers

**Definition 2.4.1 (Algebraic effect).** An *algebraic effect* (or simply an *effect*) $\ell$ consists of a set of *operations* $\mathsf{op}_1, \ldots, \mathsf{op}_n$, each with a parameter type and a return type:

$$\ell = \{ \mathsf{op}_i : A_i \to B_i \}_{i=1}^{n}$$

An operation $\mathsf{op}_i(v)$ is *performed* by a computation: it sends the parameter $v : A_i$ to the nearest enclosing handler and suspends until the handler provides a return value of type $B_i$.

**Example 2.4.2 (Standard effects as algebraic effects).**

**(1) Exceptions.** The exception effect $\mathsf{Exn}$ has one operation:

$$\mathsf{Exn} = \{ \mathsf{raise} : \mathsf{String} \to \mathsf{Void} \}$$

The return type is $\mathsf{Void}$ because `raise` never returns normally.

**(2) State.** The state effect $\mathsf{State}(S)$ has two operations:

$$\mathsf{State}(S) = \{ \mathsf{get} : \mathsf{Unit} \to S, \quad \mathsf{put} : S \to \mathsf{Unit} \}$$

**(3) Nondeterminism.** The nondeterminism effect $\mathsf{Nondet}$ has two operations:

$$\mathsf{Nondet} = \{ \mathsf{choose} : \mathsf{Unit} \to \mathsf{Bool}, \quad \mathsf{fail} : \mathsf{Unit} \to \mathsf{Void} \}$$

**(4) Async/Await.** The async effect:

$$\mathsf{Async} = \{ \mathsf{await} : \mathsf{Promise}(A) \to A, \quad \mathsf{yield} : \mathsf{Unit} \to \mathsf{Unit} \}$$

### 2.5 Syntax of a Language with Algebraic Effects

**Definition 2.5.1 (Terms).** We define a call-by-value lambda calculus with algebraic effects:

*Values:*

$$v, w ::= x \mid \lambda x.\, c \mid (v, w) \mid \mathsf{inl}\, v \mid \mathsf{inr}\, v \mid () \mid \mathsf{fun}\; f\, x = c$$

*Computations:*

$$c, d ::= \mathsf{return}\; v \mid \mathsf{let}\; x = c \;\mathsf{in}\; d \mid v\; w \mid \mathsf{op}(v; y.\, c)$$

$$\mid \; \mathsf{handle}\; c \;\mathsf{with}\; H \mid \mathsf{case}\; v \;\mathsf{of}\; \{\mathsf{inl}\, x \Rightarrow c_1; \mathsf{inr}\, y \Rightarrow c_2\}$$

*Handlers:*

$$H ::= \{ \mathsf{return}\; x \mapsto c_r, \quad \mathsf{op}_1(x; k) \mapsto c_1, \quad \ldots, \quad \mathsf{op}_n(x; k) \mapsto c_n \}$$

The critical constructs are:
- $\mathsf{op}(v; y.\, c)$: perform operation $\mathsf{op}$ with parameter $v$, bind the result to $y$, and continue with $c$. In lightweight syntax: $\mathsf{let}\; y = \mathsf{op}(v) \;\mathsf{in}\; c$.
- $\mathsf{handle}\; c \;\mathsf{with}\; H$: run computation $c$ under handler $H$. If $c$ performs an operation $\mathsf{op}_i(v)$, the handler clause $\mathsf{op}_i(x; k) \mapsto c_i$ is invoked, where $x$ is bound to the parameter $v$ and $k$ is the *continuation* representing the rest of $c$ after the operation.

**Remark 2.5.2 (The continuation $k$).** The variable $k$ in a handler clause is bound to the *delimited continuation* of the computation at the point of the effect operation. Invoking $k$ resumes the computation; not invoking $k$ aborts it. This is the key to the power of algebraic effects: the handler has full control over whether and how to resume the computation.

### 2.6 Types for Algebraic Effects

**Definition 2.6.1 (Types).** The type language extends the simply typed lambda calculus with effect annotations:

*Value types:*

$$A, B ::= \alpha \mid A \to C \mid A \times B \mid A + B \mid \mathsf{Unit}$$

*Computation types:*

$$C, D ::= A \mathbin{!} \varepsilon$$

where $\varepsilon$ is an *effect row*:

$$\varepsilon ::= \langle \rangle \mid \langle \ell \mid \varepsilon \rangle \mid \mu$$

A computation type $A \mathbin{!} \varepsilon$ means "a computation that may perform effects in $\varepsilon$ and returns a value of type $A$."

**Definition 2.6.2 (Typing rules).** We define two judgments:
- $\Gamma \vdash v : A$ for values (no effects).
- $\Gamma \vdash c : A \mathbin{!} \varepsilon$ for computations (with effects $\varepsilon$).

**Return:**

$$\frac{\Gamma \vdash v : A}{\Gamma \vdash \mathsf{return}\; v : A \mathbin{!} \varepsilon} \; (\text{T-Return})$$

A returned value is a computation with any effect annotation (it performs no effects, so any $\varepsilon$ is safe).

**Let-binding (sequencing):**

$$\frac{\Gamma \vdash c : A \mathbin{!} \varepsilon \quad \Gamma, x : A \vdash d : B \mathbin{!} \varepsilon}{\Gamma \vdash \mathsf{let}\; x = c \;\mathsf{in}\; d : B \mathbin{!} \varepsilon} \; (\text{T-Let})$$

Both $c$ and $d$ must have the same effect row $\varepsilon$. The effects of the sequencing are the union of the effects of $c$ and $d$, but since we use rows, both must be compatible with $\varepsilon$.

**Function application:**

$$\frac{\Gamma \vdash v : A \to B \mathbin{!} \varepsilon \quad \Gamma \vdash w : A}{\Gamma \vdash v\; w : B \mathbin{!} \varepsilon} \; (\text{T-App})$$

**Operation (performing an effect):**

$$\frac{\mathsf{op} : A_{\mathsf{op}} \to B_{\mathsf{op}} \in \ell \quad \ell \in \varepsilon \quad \Gamma \vdash v : A_{\mathsf{op}} \quad \Gamma, y : B_{\mathsf{op}} \vdash c : C \mathbin{!} \varepsilon}{\Gamma \vdash \mathsf{op}(v; y.\, c) : C \mathbin{!} \varepsilon} \; (\text{T-Op})$$

The operation $\mathsf{op}$ belongs to effect $\ell$, which must be in the current effect row $\varepsilon$. The parameter $v$ has the operation's parameter type $A_{\mathsf{op}}$. The continuation $y.\, c$ receives the operation's return type $B_{\mathsf{op}}$ and continues with computation $c$.

**Handler:**

$$\frac{\Gamma \vdash c : A \mathbin{!} \langle \ell \mid \varepsilon \rangle \quad \Gamma \vdash H : A \mathbin{!} \langle \ell \mid \varepsilon \rangle \Rightarrow B \mathbin{!} \varepsilon}{\Gamma \vdash \mathsf{handle}\; c \;\mathsf{with}\; H : B \mathbin{!} \varepsilon} \; (\text{T-Handle})$$

The handler $H$ transforms a computation with effects $\langle \ell \mid \varepsilon \rangle$ into a computation with effects $\varepsilon$: the effect $\ell$ is *handled* (removed from the row), while the remaining effects $\varepsilon$ pass through.

**Handler typing:**

$$\frac{\Gamma, x : A \vdash c_r : B \mathbin{!} \varepsilon \quad \forall \mathsf{op}_i \in \ell.\; \Gamma, x_i : A_i, k_i : B_i \to B \mathbin{!} \varepsilon \vdash c_i : B \mathbin{!} \varepsilon}{\Gamma \vdash \{ \mathsf{return}\; x \mapsto c_r, \; \mathsf{op}_i(x_i; k_i) \mapsto c_i \} : A \mathbin{!} \langle \ell \mid \varepsilon \rangle \Rightarrow B \mathbin{!} \varepsilon} \; (\text{T-Handler})$$

Each operation clause receives:
- $x_i : A_i$: the operation's parameter.
- $k_i : B_i \to B \mathbin{!} \varepsilon$: the continuation, a function from the operation's return type to the handler's overall result type (with residual effects $\varepsilon$).

The return clause $c_r$ handles the case where $c$ returns normally (without performing any operation of $\ell$).

### 2.7 Operational Semantics

**Definition 2.7.1 (Evaluation contexts).** We define *evaluation contexts* for call-by-value evaluation:

$$E ::= [\cdot] \mid \mathsf{let}\; x = E \;\mathsf{in}\; d \mid \mathsf{handle}\; E \;\mathsf{with}\; H$$

An evaluation context $E$ specifies the "rest of the computation" surrounding the current redex.

**Definition 2.7.2 (Reduction rules).**

**Beta-reduction:**

$$(\lambda x.\, c)\; v \longrightarrow c[v/x]$$

**Let-return:**

$$\mathsf{let}\; x = \mathsf{return}\; v \;\mathsf{in}\; d \longrightarrow d[v/x]$$

**Handle-return:**

$$\mathsf{handle}\; (\mathsf{return}\; v) \;\mathsf{with}\; H \longrightarrow c_r[v/x]$$

where $H = \{ \mathsf{return}\; x \mapsto c_r, \ldots \}$. When the handled computation returns a value, the return clause of the handler is invoked.

**Handle-operation:**

$$\mathsf{handle}\; E[\mathsf{op}(v; y.\, c)] \;\mathsf{with}\; H \longrightarrow c_i[v/x_i, (\lambda y.\, \mathsf{handle}\; E[c] \;\mathsf{with}\; H)/k_i]$$

where $H = \{ \ldots, \mathsf{op}(x_i; k_i) \mapsto c_i, \ldots \}$ and $\mathsf{op} \in \ell$ and $E$ does not contain a handler for $\ell$.

This is the key rule. When the computation performs an operation $\mathsf{op}(v)$:

1. The operation "bubbles up" through evaluation contexts until it reaches the nearest handler for effect $\ell$.
2. The handler clause $\mathsf{op}(x_i; k_i) \mapsto c_i$ is invoked.
3. $x_i$ is bound to the operation parameter $v$.
4. $k_i$ is bound to the *delimited continuation* $\lambda y.\, \mathsf{handle}\; E[c] \;\mathsf{with}\; H$: a function that, when applied to a value $w$, resumes the original computation $c[w/y]$ inside the context $E$, still under the same handler $H$ (so subsequent operations are also handled).

**Remark 2.7.3 (Deep vs. shallow handlers).** The continuation $k_i = \lambda y.\, \mathsf{handle}\; E[c] \;\mathsf{with}\; H$ includes the handler wrapping. This means that if the resumed computation performs another operation of $\ell$, it will be caught by the *same* handler. This is a *deep* handler. An alternative is a *shallow* handler, where the continuation does *not* include the handler: $k_i = \lambda y.\, E[c]$. Shallow handlers must be reinstalled explicitly.

### 2.8 Examples of Effect Handling

**Example 2.8.1 (Exceptions).** Define the exception effect:

$$\mathsf{Exn} = \{ \mathsf{raise} : \mathsf{String} \to \mathsf{Void} \}$$

A computation that may raise exceptions:

$$\mathsf{safeDivide} = \lambda x.\, \lambda y.\, \mathsf{if}\; y = 0 \;\mathsf{then}\; \mathsf{raise}(\text{"division by zero"}) \;\mathsf{else}\; \mathsf{return}\; (x / y)$$

A handler that catches exceptions:

$$H_{\mathsf{try}} = \{ \mathsf{return}\; x \mapsto \mathsf{return}\; (\mathsf{Some}\; x), \quad \mathsf{raise}(e; k) \mapsto \mathsf{return}\; \mathsf{None} \}$$

Note: the continuation $k$ is *not invoked* in the raise clause. This means the computation is aborted when an exception is raised---exactly the semantics of try-catch.

$$\mathsf{handle}\; (\mathsf{safeDivide}\; 10\; 0) \;\mathsf{with}\; H_{\mathsf{try}} \longrightarrow^* \mathsf{return}\; \mathsf{None}$$

$$\mathsf{handle}\; (\mathsf{safeDivide}\; 10\; 2) \;\mathsf{with}\; H_{\mathsf{try}} \longrightarrow^* \mathsf{return}\; (\mathsf{Some}\; 5)$$

**Example 2.8.2 (Mutable state).** Define the state effect:

$$\mathsf{State}(\mathsf{Int}) = \{ \mathsf{get} : \mathsf{Unit} \to \mathsf{Int}, \quad \mathsf{put} : \mathsf{Int} \to \mathsf{Unit} \}$$

A stateful computation:

$$\mathsf{incr} = \mathsf{let}\; n = \mathsf{get}() \;\mathsf{in}\; \mathsf{put}(n + 1);\; \mathsf{return}\; n$$

A handler that implements state by threading a value:

$$H_{\mathsf{state}}(s) = \left\{ \begin{array}{l} \mathsf{return}\; x \mapsto \mathsf{return}\; (x, s), \\ \mathsf{get}(\_; k) \mapsto k\; s, \\ \mathsf{put}(s'; k) \mapsto H_{\mathsf{state}}(s')[\mathsf{handle}\; k\; () \;\mathsf{with}\; \ldots] \end{array} \right\}$$

More precisely, using a functional encoding:

$$\mathsf{runState} : \mathsf{Int} \to (\mathsf{Unit} \xrightarrow{\langle \mathsf{State}(\mathsf{Int}) \mid \varepsilon \rangle} A) \xrightarrow{\varepsilon} A \times \mathsf{Int}$$

$$\mathsf{runState}\; s_0\; c = \mathsf{handle}\; c\; () \;\mathsf{with}\; \left\{ \begin{array}{l} \mathsf{return}\; x \mapsto \lambda s.\, \mathsf{return}\; (x, s), \\ \mathsf{get}(\_; k) \mapsto \lambda s.\, k\; s\; s, \\ \mathsf{put}(s'; k) \mapsto \lambda \_.\, k\; ()\; s' \end{array} \right\}\; s_0$$

The handler transforms the stateful computation into a state-passing function.

**Example 2.8.3 (Nondeterminism).** Define the nondeterminism effect:

$$\mathsf{Nondet} = \{ \mathsf{choose} : \mathsf{Unit} \to \mathsf{Bool}, \quad \mathsf{fail} : \mathsf{Unit} \to \mathsf{Void} \}$$

A nondeterministic computation:

$$\mathsf{pythagorean} = \mathsf{let}\; a = \mathsf{amb}(1, 10) \;\mathsf{in}\; \mathsf{let}\; b = \mathsf{amb}(a, 10) \;\mathsf{in}\; \mathsf{let}\; c = \mathsf{amb}(b, 10) \;\mathsf{in}\;$$

$$\mathsf{if}\; a^2 + b^2 = c^2 \;\mathsf{then}\; \mathsf{return}\; (a, b, c) \;\mathsf{else}\; \mathsf{fail}()$$

A handler that collects all solutions:

$$H_{\mathsf{all}} = \left\{ \begin{array}{l} \mathsf{return}\; x \mapsto \mathsf{return}\; [x], \\ \mathsf{choose}(\_; k) \mapsto \mathsf{let}\; l_1 = k\; \mathsf{true} \;\mathsf{in}\; \mathsf{let}\; l_2 = k\; \mathsf{false} \;\mathsf{in}\; \mathsf{return}\; (l_1 \mathbin{@} l_2), \\ \mathsf{fail}(\_; k) \mapsto \mathsf{return}\; [] \end{array} \right\}$$

The choose handler invokes the continuation $k$ *twice*---once with $\mathsf{true}$ and once with $\mathsf{false}$---and concatenates the results. This is the power of algebraic effects: the handler can invoke the continuation any number of times (zero for exceptions, once for state, multiple times for nondeterminism).

### 2.9 Effect Handlers as Delimited Continuations

**Definition 2.9.1 (Delimited continuation).** A *delimited continuation* is a continuation that extends not to the end of the entire program, but only to a *delimiter* (prompt). In the setting of algebraic effects, the delimiter is the handler.

**Proposition 2.9.2.** Algebraic effect handlers are equivalent in expressiveness to *multi-prompt delimited continuations* (Filinski, 1994). Each effect label corresponds to a prompt; performing an operation captures the continuation up to the nearest handler for that effect; invoking the continuation in the handler resumes the computation from the capture point.

*Proof sketch.* The key reduction rule $\mathsf{handle}\; E[\mathsf{op}(v; y.\, c)] \;\mathsf{with}\; H$ captures $E[\cdot[y \mapsto \cdot]]$ as the continuation $k$. This is exactly a `shift`/`reset` (or `control`/`prompt`) operation:

- $\mathsf{handle}\; \ldots \;\mathsf{with}\; H$ corresponds to `reset` (establishing a delimiter).
- $\mathsf{op}(v)$ corresponds to `shift` (capturing the continuation up to the nearest `reset`).

The correspondence extends to multi-prompt settings: different effects correspond to different prompts, and an operation captures the continuation up to the handler for its specific effect. $\square$

**Definition 2.9.3 (One-shot vs. multi-shot continuations).** A continuation is:
- *One-shot* if it is invoked at most once (e.g., in exception and state handlers).
- *Multi-shot* if it is invoked multiple times (e.g., in nondeterminism handlers).

Multi-shot continuations are more expensive (they require copying the stack) and interact poorly with linear resources. Some effect systems restrict to one-shot continuations for efficiency and linearity.

**Remark 2.9.4.** The connection to delimited continuations reveals why algebraic effects subsume monads: Filinski (1994) showed that any monad expressible in a call-by-value language can be represented using delimited continuations. Since algebraic effects are equivalent to delimited continuations, they can represent any such monad.

### 2.10 Connection to Free Monads

**Definition 2.10.1 (Free monad).** Given a functor $F$, the *free monad* $\mathsf{Free}\; F$ is defined by:

$$\mathsf{Free}\; F\; A = A + F\; (\mathsf{Free}\; F\; A)$$

or equivalently, as a recursive type:

$$\mathsf{Free}\; F\; A = \mu X.\, A + F\; X$$

Values are either $\mathsf{Pure}\; a$ (a pure value) or $\mathsf{Op}\; (f : F\; (\mathsf{Free}\; F\; A))$ (an operation with a continuation).

**Proposition 2.10.2.** Algebraic effects with handlers correspond to free monads with interpreters. Specifically:

1. An effect signature $\ell = \{ \mathsf{op}_i : A_i \to B_i \}$ corresponds to a functor:

$$F_{\ell}\; X = \sum_{i} A_i \times (B_i \to X)$$

Each operation is a pair of a parameter ($A_i$) and a continuation ($B_i \to X$).

2. A computation $c : A \mathbin{!} \langle \ell \rangle$ corresponds to a value of type $\mathsf{Free}\; F_{\ell}\; A$.

3. A handler $H : A \mathbin{!} \langle \ell \mid \varepsilon \rangle \Rightarrow B \mathbin{!} \varepsilon$ corresponds to a *fold* (catamorphism) over the free monad:

$$\mathsf{fold} : (A \to B) \to (\forall i.\, A_i \to (B_i \to B) \to B) \to \mathsf{Free}\; F_{\ell}\; A \to B$$

**Remark 2.10.3 (Trade-offs).** Free monads and algebraic effects are isomorphic in expressiveness but differ in practical characteristics:

- **Free monads** build an explicit data structure (a tree of operations) that is then interpreted. This is conceptually simple but can be slow (quadratic in the number of binds due to left-associated trees, unless using techniques like the codensity monad or freer monads).
- **Algebraic effects** are typically implemented with native stack manipulation (capturing and restoring continuations), which is more efficient but requires runtime support.

### 2.11 Type Safety

**Theorem 2.11.1 (Preservation).** If $\Gamma \vdash c : A \mathbin{!} \varepsilon$ and $c \longrightarrow c'$, then $\Gamma \vdash c' : A \mathbin{!} \varepsilon$.

*Proof.* By case analysis on the reduction rule.

**Case (Handle-return):** We have $\mathsf{handle}\; (\mathsf{return}\; v) \;\mathsf{with}\; H \longrightarrow c_r[v/x]$.

From the typing: $\Gamma \vdash \mathsf{return}\; v : A \mathbin{!} \langle \ell \mid \varepsilon \rangle$ gives $\Gamma \vdash v : A$, and the handler typing gives $\Gamma, x : A \vdash c_r : B \mathbin{!} \varepsilon$. By substitution, $\Gamma \vdash c_r[v/x] : B \mathbin{!} \varepsilon$.

**Case (Handle-operation):** We have $\mathsf{handle}\; E[\mathsf{op}(v; y.\, c)] \;\mathsf{with}\; H \longrightarrow c_i[v/x_i, K/k_i]$ where $K = \lambda y.\, \mathsf{handle}\; E[c] \;\mathsf{with}\; H$.

From the operation typing: $\mathsf{op} : A_{\mathsf{op}} \to B_{\mathsf{op}} \in \ell$ and $\Gamma \vdash v : A_{\mathsf{op}}$. The handler clause typing gives $\Gamma, x_i : A_{\mathsf{op}}, k_i : B_{\mathsf{op}} \to B \mathbin{!} \varepsilon \vdash c_i : B \mathbin{!} \varepsilon$.

We must show $\Gamma \vdash K : B_{\mathsf{op}} \to B \mathbin{!} \varepsilon$. We have: for any $w : B_{\mathsf{op}}$, $E[c[w/y]]$ is a computation with effects $\langle \ell \mid \varepsilon \rangle$ (by typing of $c$ and the evaluation context), and $\mathsf{handle}\; E[c[w/y]] \;\mathsf{with}\; H$ has effects $\varepsilon$ (by the T-Handle rule). So $K : B_{\mathsf{op}} \to B \mathbin{!} \varepsilon$.

By substitution, $c_i[v/x_i, K/k_i] : B \mathbin{!} \varepsilon$. $\square$

**Theorem 2.11.2 (Progress).** If $\vdash c : A \mathbin{!} \langle \rangle$ (closed computation with empty effect row), then either $c = \mathsf{return}\; v$ for some value $v$, or $c \longrightarrow c'$.

*Proof.* Since the effect row is empty, no unhandled operations can occur. The proof proceeds by induction on the typing derivation. Every operation must have its effect in the row; since the row is empty, no T-Op rule can appear at the top level. The remaining cases (return, let, application, handle) either are values or reduce. $\square$

**Remark 2.11.3.** If the effect row is non-empty, a computation may get stuck on an unhandled operation. This is the analogue of an uncaught exception. The type system ensures that *all effects are handled* before a computation can be considered pure.

### 2.12 Effect Polymorphism and Row Polymorphism

**Definition 2.12.1 (Effect-polymorphic functions).** A function is *effect-polymorphic* if it works with any effect row:

$$\mathsf{map} : \forall \alpha.\, \forall \beta.\, \forall \mu.\, (\alpha \to \beta \mathbin{!} \mu) \to \mathsf{List}(\alpha) \to \mathsf{List}(\beta) \mathbin{!} \mu$$

The row variable $\mu$ ranges over all possible effect rows.

**Definition 2.12.2 (Row unification).** Effect inference uses *row unification* to solve constraints on effect rows. Row unification extends standard unification with the equation:

$$\langle l \mid \varepsilon_1 \rangle = \langle l \mid \varepsilon_2 \rangle \implies \varepsilon_1 = \varepsilon_2$$

and the *row rewriting* rule:

$$\langle l_1 \mid \langle l_2 \mid \varepsilon \rangle \rangle = \langle l_2 \mid \langle l_1 \mid \varepsilon \rangle \rangle$$

(effects are unordered within a row).

**Theorem 2.12.3 (Decidability of row unification).** Row unification is decidable and produces principal solutions, analogous to Robinson's unification for simple types.

*Proof sketch.* Row unification reduces to unification modulo the theory of commutative semigroups (for unordered rows) or to standard first-order unification (for ordered rows). Both are decidable with principal unifiers. See Remy (1993) for the details of row polymorphism. $\square$

### 2.13 Real-World Languages with Algebraic Effects

**Language 2.13.1 (Eff).** Eff (Bauer and Pretnar, 2012) was the first language designed around algebraic effects and handlers. It is a research language with:
- First-class effects and handlers.
- Effect inference.
- Both deep and shallow handlers.

**Language 2.13.2 (Koka).** Koka (Leijen, 2014) is a practical language with:
- Row-polymorphic effect types.
- Effect inference (the programmer rarely writes effect annotations).
- Efficient compilation of effect handlers using evidence-passing (Xie et al., 2020).
- Named effect handlers for scoped effects.

**Language 2.13.3 (OCaml 5).** OCaml 5 (Sivaramakrishnan et al., 2021) introduced:
- Untyped algebraic effects with shallow handlers.
- One-shot continuations (efficient, no copying).
- Used to implement multicore parallelism (domains) and lightweight concurrency (fibers).

The OCaml 5 effects are *untyped* in the sense that effect operations are not tracked in function types (unlike Koka and Eff). This is a pragmatic choice: retrofitting effect types into OCaml's existing type system would be a major undertaking.

**Language 2.13.4 (Multicore OCaml syntax).**

```ocaml
effect Ask : int           (* declare an operation *)

let double () =
  let x = perform Ask in   (* perform the operation *)
  x + x

let result =
  match double () with
  | x -> x                          (* return clause *)
  | effect Ask k -> continue k 21   (* handler clause *)
(* result = 42 *)
```

### 2.14 Effect Safety and the No-Escape Property

**Definition 2.14.1 (Effect safety).** A computation is *effect-safe* if every effect operation it performs is handled by an enclosing handler. Formally:

$$\Gamma \vdash c : A \mathbin{!} \langle \rangle$$

means $c$ is effect-safe: all effects have been handled, and $c$ can be executed as a pure computation.

**Theorem 2.14.2 (Effect encapsulation).** If $\Gamma \vdash \mathsf{handle}\; c \;\mathsf{with}\; H : B \mathbin{!} \varepsilon$ and $\ell \notin \varepsilon$, then no unhandled operation of $\ell$ can escape from $\mathsf{handle}\; c \;\mathsf{with}\; H$.

*Proof.* By the typing rule T-Handle, the handler $H$ handles all operations of effect $\ell$. By subject reduction (Theorem 2.11.1), the type is preserved under reduction, so the effect $\ell$ is never added back to the effect row. $\square$

**Remark 2.14.3 (Local reasoning).** Effect encapsulation enables *local reasoning*: the effect of a subcomputation is fully determined by its type and the enclosing handlers. A function with type $A \to B \mathbin{!} \langle \rangle$ is guaranteed pure, regardless of what effects its internal implementation uses---as long as all effects are handled internally.

This is a significant advantage over monads, where the monad type "leaks" into the function signature and cannot be locally discharged.

### 2.15 Combining Multiple Effects

**Definition 2.15.1 (Effect composition).** Multiple effects compose naturally: a computation $c : A \mathbin{!} \langle \ell_1 \mid \langle \ell_2 \mid \varepsilon \rangle \rangle$ uses both $\ell_1$ and $\ell_2$. Handlers compose by nesting:

$$\mathsf{handle}\; (\mathsf{handle}\; c \;\mathsf{with}\; H_1) \;\mathsf{with}\; H_2 : A \mathbin{!} \varepsilon$$

The inner handler removes $\ell_1$, the outer handler removes $\ell_2$.

**Proposition 2.15.2 (Handler ordering matters).** Unlike effect *sets*, handler *nesting* imposes an order. The semantics can differ:

1. $\mathsf{handle}_{\mathsf{State}}\; (\mathsf{handle}_{\mathsf{Exn}}\; c)$: exceptions are handled first; state changes persist even if an exception is raised.

2. $\mathsf{handle}_{\mathsf{Exn}}\; (\mathsf{handle}_{\mathsf{State}}\; c)$: state is handled first; exceptions roll back state changes.

This is the algebraic-effects analogue of the monad transformer ordering issue (Problem 2.3.3), but it arises naturally from the nesting structure rather than from a fixed transformer stack.

**Example 2.15.3 (State + exceptions).** Consider:

$$c = \mathsf{put}(10);\; \mathsf{raise}(\text{"error"});\; \mathsf{put}(20);\; \mathsf{return}\; ()$$

Under $\mathsf{handle}_{\mathsf{State}}\; (\mathsf{handle}_{\mathsf{Exn}}\; c)$:
- The exception handler catches the raise, returning $\mathsf{None}$.
- The state handler sees: $\mathsf{put}(10)$, then $\mathsf{return}\; \mathsf{None}$.
- Final state: $10$. Result: $(\mathsf{None}, 10)$.

Under $\mathsf{handle}_{\mathsf{Exn}}\; (\mathsf{handle}_{\mathsf{State}}\; c)$:
- The state handler processes: $\mathsf{put}(10)$, then $\mathsf{raise}(\text{"error"})$ (which is not a state operation, so it propagates).
- The exception handler catches the raise.
- The state handler's continuation is discarded (the exception aborts it).
- Final result: $\mathsf{None}$ (no final state, because the state was internal to the aborted computation).

### 2.16 Semantics of Algebraic Effects

**Definition 2.16.1 (Algebraic theory).** An *algebraic theory* $\mathcal{T} = (\Sigma, E)$ consists of:
- A *signature* $\Sigma$: a set of operation symbols with arities,
- A set $E$ of *equations* between terms over $\Sigma$.

An *algebraic effect* is an algebraic theory where the equations capture the expected laws of the effect. For example, the state effect satisfies:

$$\mathsf{get}();\; \mathsf{get}() = \mathsf{get}() \quad \text{(idempotence of get)}$$

$$\mathsf{put}(s);\; \mathsf{get}() = \mathsf{put}(s);\; \mathsf{return}\; s \quad \text{(get after put)}$$

$$\mathsf{put}(s_1);\; \mathsf{put}(s_2) = \mathsf{put}(s_2) \quad \text{(put is overwrite)}$$

**Definition 2.16.2 (Free model).** The *free model* of an algebraic theory $\mathcal{T}$ over a set $X$ is the initial algebra of $\Sigma$ modulo $E$. For effects, this is the free monad $\mathsf{Free}\; F_{\Sigma}$ modulo the equations $E$. Without equations, we get the *free* algebraic effect (the free monad); with equations, we get a *quotient* that captures the intended semantics.

**Remark 2.16.3.** The word "algebraic" in "algebraic effects" comes from universal algebra: an effect is "algebraic" if it can be presented as operations and equations, i.e., as an algebraic theory. Not all computational effects are algebraic: *continuations* and *backtracking with commit* are examples of non-algebraic effects (they cannot be presented by operations satisfying algebraic equations in the standard sense). Plotkin and Pretnar's handlers extend the algebraic framework to handle some non-algebraic effects by giving the handler explicit access to continuations.

### 2.17 Selective Effect Handling and Tunelling

**Definition 2.17.1 (Effect tunneling).** When a handler for effect $\ell$ is nested inside a handler for effect $\ell'$, operations of $\ell'$ performed inside the handler for $\ell$ must "tunnel through" the $\ell$-handler to reach the $\ell'$-handler. The T-Handle rule ensures this: the residual effect row $\varepsilon$ (after removing $\ell$) passes through to the continuation.

**Definition 2.17.2 (Shallow vs. deep handlers, revisited).**

- **Deep handlers** (Definition 2.7.3) wrap the continuation with the same handler, so the handler persists across multiple operations. This is the default in most languages (Eff, Koka).

- **Shallow handlers** do not wrap the continuation. After handling one operation, the programmer must explicitly reinstall the handler for subsequent operations. Shallow handlers are more flexible (the handler can change between operations) but more verbose.

- **Parameterized handlers** (as in Koka) combine the benefits: the handler carries a parameter that can be updated at each operation, providing state-like behavior without explicit reinstallation.

### 2.18 Exercises

**Exercise 2.18.1.** Implement the following effects as algebraic effects with handlers:

(a) A *logging* effect: $\mathsf{Log} = \{ \mathsf{log} : \mathsf{String} \to \mathsf{Unit} \}$. Write a handler that collects all log messages into a list.

(b) A *timeout* effect: $\mathsf{Timeout} = \{ \mathsf{tick} : \mathsf{Unit} \to \mathsf{Unit} \}$. Write a handler that counts ticks and aborts the computation if a limit is reached.

**Exercise 2.18.2.** Show that the exception effect ($\mathsf{raise} : A \to \mathsf{Void}$) can be encoded using the free monad $\mathsf{Free}\; F$ where $F\; X = A$ (ignoring the continuation). Write the fold (handler) that implements try-catch.

**Exercise 2.18.3.** Prove that $\mathsf{handle}\; (\mathsf{return}\; v) \;\mathsf{with}\; H \longrightarrow c_r[v/x]$ preserves types (the return case of Theorem 2.11.1).

**Exercise 2.18.4.** Consider a language with two effects: $\mathsf{State}(\mathsf{Int})$ and $\mathsf{Exn}$. Write a computation that uses both effects. Then give two different handler nesting orders and show that they produce different results.

**Exercise 2.18.5.** In Koka, the type of `map` is:

$$\mathsf{map} : \forall \langle e \rangle.\, \forall a.\, \forall b.\, \mathsf{list}\langle a \rangle \to (a \to e\; b) \to e\; \mathsf{list}\langle b \rangle$$

Explain the role of the effect variable $e$. What happens if we instantiate $e$ with $\langle \mathsf{Exn} \rangle$? With $\langle \rangle$ (pure)?

### 2.19 Graded Monads and Coeffects

**Definition 2.19.1 (Graded monad).** A *graded monad* (or *indexed monad* or *parameterized monad*) is a family of type constructors $M_{\varepsilon}$ indexed by an element $\varepsilon$ of a monoid $(\mathcal{E}, \cdot, e)$:

$$\mathsf{return} : A \to M_e\; A$$

$$\mathsf{bind} : M_{\varepsilon_1}\; A \to (A \to M_{\varepsilon_2}\; B) \to M_{\varepsilon_1 \cdot \varepsilon_2}\; B$$

The index $\varepsilon$ tracks effects: $\mathsf{return}$ has the identity effect $e$, and $\mathsf{bind}$ combines effects using the monoid operation.

**Remark 2.19.2.** Graded monads provide a bridge between effect systems and monads: the effect annotation is the monoid index. Ordinary monads are graded monads over the trivial (one-element) monoid.

**Definition 2.19.3 (Coeffects).** Dual to effects, *coeffects* (Petricek, Orchard, and Mycroft, 2014) track what a computation *requires* from its context rather than what it *does* to the context:

- Effects: "this computation *may produce* state changes, exceptions, I/O."
- Coeffects: "this computation *requires* specific resources, capabilities, or context."

Examples of coeffects include: data provenance (which data sources are accessed), implicit parameters, and resource requirements. Coeffects are modeled by *comonads*, dual to the monadic treatment of effects.

---

## Summary

- **Effect systems** annotate function types with the effects they may perform: $A \xrightarrow{\varepsilon} B$. Effect polymorphism ($\forall \epsilon$) and effect rows enable generic programming over effects.

- **Monads** (Moggi, Wadler) model effects by wrapping computations in a type constructor $M$. They are expressive but compose poorly (the monad transformer problem).

- **Algebraic effects** decompose effects into *operations* (performing an effect) and *handlers* (providing semantics). The handler receives the operation's parameter and the computation's *continuation*, giving full control over resumption.

- **The key reduction rule** for handlers captures a *delimited continuation*: $\mathsf{handle}\; E[\mathsf{op}(v)] \;\mathsf{with}\; H$ invokes the handler clause with $v$ and the continuation $\lambda y.\, \mathsf{handle}\; E[y] \;\mathsf{with}\; H$.

- **Standard effects** are naturally encoded: exceptions (don't resume), state (resume with updated value), nondeterminism (resume multiple times). The continuation's invocation pattern determines the effect's semantics.

- **Type safety** holds: preservation follows from substitution of the captured continuation; progress holds when all effects are handled (empty effect row).

- **Algebraic effects are equivalent to delimited continuations** (Filinski) and to **free monads** (with handlers as folds). They combine the modularity of effect systems with the expressiveness of monads.

- **Real-world languages** with algebraic effects include Eff, Koka, and OCaml 5. Koka features full row-polymorphic effect inference; OCaml 5 provides untyped effects with one-shot continuations.

## Further Reading

1. Plotkin, G. D. and Pretnar, M. (2009). "Handlers of algebraic effects." In *ESOP 2009*, LNCS 5502, pp. 80--94. Springer. The foundational paper on algebraic effect handlers.

2. Plotkin, G. D. and Power, J. (2003). "Algebraic operations and generic effects." *Applied Categorical Structures*, 11(1), 69--94. The algebraic theory of computational effects.

3. Moggi, E. (1991). "Notions of computation and monads." *Information and Computation*, 93(1), 55--92. The seminal paper on monads as a framework for computational effects.

4. Bauer, A. and Pretnar, M. (2015). "Programming with algebraic effects and handlers." *Journal of Logical and Algebraic Methods in Programming*, 84(1), 108--123. The Eff language and its effect system.

5. Leijen, D. (2017). "Type directed compilation of row-typed algebraic effects." In *POPL 2017*, pp. 486--499. ACM. Koka's compilation strategy for algebraic effects.

6. Kammar, O., Lindley, S., and Oury, N. (2013). "Handlers in action." In *ICFP 2013*, pp. 145--158. ACM. A practical account of programming with effect handlers.

7. Filinski, A. (1994). "Representing monads." In *POPL 1994*, pp. 446--457. ACM. The equivalence between monads and delimited continuations.

8. Hillerstr\"om, D. and Lindley, S. (2016). "Liberating effects with rows and handlers." In *TyDe 2016*, pp. 15--27. ACM. Row-based effect typing.

9. Sivaramakrishnan, K. C., Dolan, S., White, L., Jaffer, S., Madhavapeddy, A., and Krishnamurthi, S. (2021). "Retrofitting effect handlers onto OCaml." In *PLDI 2021*, pp. 206--221. ACM. The design and implementation of effects in OCaml 5.

10. Petricek, T., Orchard, D., and Mycroft, A. (2014). "Coeffects: A calculus of context-dependent computation." In *ICFP 2014*, pp. 123--135. ACM. The theory of coeffects as dual to effects.
