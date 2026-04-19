# Lecture 09a: Functional Programming Languages

## Prerequisites

- Lambda calculus (Module 01/02), type theory basics, familiarity with at least one functional language (Haskell, OCaml, or SML).

---

## 1. Pure Functional Programming and Referential Transparency

### 1.1 Definitions

A language is **purely functional** if every expression denotes a value and evaluation has no observable side effects. The central property is **referential transparency**:

> An expression $e$ is referentially transparent if, for all program contexts $C[\cdot]$, replacing $e$ with any other expression $e'$ that has the same value preserves the meaning of $C[e]$.

Formally, if $[\![ e ]\!] = [\![ e' ]\!]$, then $[\![ C[e] ]\!] = [\![ C[e'] ]\!]$.

### 1.2 Consequences

1. **Equational reasoning**: Programs can be understood by substituting equals for equals, exactly as in algebra.
2. **Parallelism**: Since subexpressions have no side effects, they may be evaluated in any order or in parallel.
3. **Memoization**: Any function call with the same arguments always returns the same result and may be cached.

### 1.3 The Challenge of Effects

Pure languages must account for I/O, mutable state, exceptions, and nondeterminism without breaking referential transparency. The principal mechanism in Haskell is the **monad** (Section 4).

---

## 2. Lazy vs. Strict Evaluation Strategies

### 2.1 Strict (Eager) Evaluation

Under **strict evaluation** (call-by-value), the arguments to a function are fully evaluated before the function body executes.

**Reduction rule (call-by-value beta):**

$$
(\lambda x.\, e)\; v \;\longrightarrow_{\beta_v}\; e[v/x]
$$

where $v$ is a value (already fully evaluated).

### 2.2 Lazy Evaluation

Under **lazy evaluation** (call-by-need), an argument is not evaluated until its value is actually required, and once evaluated, the result is shared (memoized).

**Reduction rule (call-by-name beta):**

$$
(\lambda x.\, e_1)\; e_2 \;\longrightarrow_{\beta_n}\; e_1[e_2/x]
$$

Call-by-need adds **sharing** on top of call-by-name: each thunk is evaluated at most once.

### 2.3 Comparison

| Property | Strict | Lazy |
|----------|--------|------|
| Terminates when argument diverges but is unused | No | Yes |
| Space behavior | Predictable | Potential space leaks from unevaluated thunks |
| Time complexity | Each argument evaluated once | Each argument evaluated at most once (sharing) |
| Interaction with effects | Natural | Requires monadic sequencing |

**Theorem (Normalization ordering).** If a lambda term has a normal form, the leftmost-outermost (normal order) reduction strategy will find it. Strict evaluation may diverge on terms that have a normal form.

*Proof sketch.* By the standardization theorem for the lambda calculus (Curry & Feys, 1958), if $e \twoheadrightarrow_\beta v$ for some normal form $v$, then there exists a leftmost-outermost reduction sequence from $e$ to $v$. Strict evaluation corresponds to a rightmost-innermost strategy, which may enter a non-terminating sub-reduction that the leftmost strategy avoids. $\square$

### 2.4 Strictness Analysis

Compilers for lazy languages (e.g., GHC) perform **strictness analysis** to determine when an argument will definitely be evaluated, allowing the compiler to use the more efficient call-by-value convention.

A function $f$ is **strict** in its $i$-th argument if $f(\ldots, \bot, \ldots) = \bot$, where $\bot$ denotes non-termination.

The analysis is typically formulated as an **abstract interpretation** over a two-point domain $\{0, 1\}$ where $0$ represents $\bot$ and $1$ represents "defined."

---

## 3. Algebraic Data Types and Pattern Matching

### 3.1 Algebraic Data Types (ADTs)

An algebraic data type is formed from **sum types** (tagged unions) and **product types** (tuples/records).

$$
T = C_1\; \tau_{1,1}\; \ldots\; \tau_{1,k_1} \;\mid\; C_2\; \tau_{2,1}\; \ldots\; \tau_{2,k_2} \;\mid\; \ldots \;\mid\; C_n\; \tau_{n,1}\; \ldots\; \tau_{n,k_n}
$$

Each $C_i$ is a **constructor**. The type $T$ is the **least fixed point** of the defining equation when the definition is recursive.

**Example.** The type of lists over $\alpha$:

$$
\text{List}\;\alpha = \text{Nil} \mid \text{Cons}\;\alpha\;(\text{List}\;\alpha)
$$

### 3.2 Catamorphisms (Folds)

Every algebraic data type $T$ admits a unique **catamorphism** (fold). For lists:

$$
\text{foldr} : (\alpha \to \beta \to \beta) \to \beta \to \text{List}\;\alpha \to \beta
$$

satisfying the universal property: $h = \text{foldr}\; f\; e$ if and only if $h\;\text{Nil} = e$ and $h\;(\text{Cons}\;x\;xs) = f\;x\;(h\;xs)$.

### 3.3 Pattern Match Compilation

Pattern matching is compiled to **decision trees** or **backtracking automata**.

**Algorithm: Compile pattern match to decision tree.**

```
function CompileMatch(clauses, variables):
    if clauses is empty:
        return FAIL
    if first clause has no patterns (all variables bound):
        return first clause's right-hand side
    choose a variable v to inspect (heuristic: column with most constructors)
    for each constructor C_i of v's type:
        sub_clauses = specialize(clauses, v, C_i)
        children[C_i] = CompileMatch(sub_clauses, updated_variables)
    default_clauses = default(clauses, v)
    children[DEFAULT] = CompileMatch(default_clauses, variables)
    return Switch(v, children)
```

**Theorem (Completeness and irredundancy checking).** Given an ADT with constructors $\{C_1, \ldots, C_n\}$, a set of patterns is **exhaustive** if, when viewed as a subset of the constructor space $\prod_i \{C_1, \ldots, C_{n_i}\}$, it covers the entire space. This is decidable and checked at compile time by languages like OCaml, Haskell, and Rust.

---

## 4. Monads: Definition, Laws, and Use for Effects

### 4.1 Definition

A **monad** in the context of functional programming is a type constructor $M$ together with two operations:

$$
\text{return} : \alpha \to M\;\alpha
$$

$$
(\gg\!\!=) : M\;\alpha \to (\alpha \to M\;\beta) \to M\;\beta
$$

(pronounced "bind").

### 4.2 Monad Laws

The operations must satisfy three laws:

**Left identity:**

$$
\text{return}\;a \gg\!\!= f \;=\; f\;a
$$

**Right identity:**

$$
m \gg\!\!= \text{return} \;=\; m
$$

**Associativity:**

$$
(m \gg\!\!= f) \gg\!\!= g \;=\; m \gg\!\!= (\lambda x.\; f\;x \gg\!\!= g)
$$

**Theorem.** The monad laws are equivalent to requiring that the **Kleisli composition**

$$
(f \circ_K g)(x) = g\;x \gg\!\!= f
$$

forms a category (the Kleisli category) with $\text{return}$ as the identity morphism.

*Proof.* Left identity of bind gives right identity of Kleisli composition: $\text{return} \circ_K f = f$. Right identity of bind gives left identity: $f \circ_K \text{return} = f$. Associativity of bind gives associativity of Kleisli composition. These are exactly the category axioms. $\square$

### 4.3 The Category-Theoretic View

In category theory, a monad on a category $\mathcal{C}$ is an endofunctor $T : \mathcal{C} \to \mathcal{C}$ equipped with natural transformations:

$$
\eta : \text{Id} \Rightarrow T \qquad (\text{unit, i.e., return})
$$

$$
\mu : T \circ T \Rightarrow T \qquad (\text{multiplication, i.e., join})
$$

satisfying coherence conditions (associativity and unit laws expressed as commutative diagrams). The programming notion relates via:

$$
\text{join} : M\;(M\;\alpha) \to M\;\alpha, \quad \text{join}\; m = m \gg\!\!= \text{id}
$$

$$
m \gg\!\!= f = \text{join}\;(\text{fmap}\;f\;m)
$$

### 4.4 Common Monads

| Monad | $M\;\alpha$ | return | bind |
|-------|------------|--------|------|
| Maybe | $\alpha + 1$ | $\text{Just}$ | Short-circuit on Nothing |
| State $s$ | $s \to (\alpha, s)$ | $\lambda a.\;\lambda s.\;(a,s)$ | Thread state |
| Reader $r$ | $r \to \alpha$ | $\lambda a.\;\lambda r.\;a$ | Pass environment |
| Writer $w$ | $(\alpha, w)$ ($w$ a monoid) | $\lambda a.\;(a, \epsilon)$ | Accumulate output |
| IO | Abstract; encapsulates real-world effects | Lift pure value | Sequence effects |
| List | $[\alpha]$ | $\lambda a.\;[a]$ | Concat-map (nondeterminism) |

### 4.5 Proof: Maybe Satisfies the Monad Laws

Define $\text{return}\;a = \text{Just}\;a$ and:

$$
m \gg\!\!= f = \begin{cases} \text{Nothing} & \text{if } m = \text{Nothing} \\ f\;a & \text{if } m = \text{Just}\;a \end{cases}
$$

**Left identity:** $\text{return}\;a \gg\!\!= f = \text{Just}\;a \gg\!\!= f = f\;a$. Holds.

**Right identity:** Case $m = \text{Nothing}$: $\text{Nothing} \gg\!\!= \text{return} = \text{Nothing} = m$. Case $m = \text{Just}\;a$: $\text{Just}\;a \gg\!\!= \text{return} = \text{return}\;a = \text{Just}\;a = m$. Holds.

**Associativity:** Case $m = \text{Nothing}$: both sides reduce to $\text{Nothing}$. Case $m = \text{Just}\;a$: LHS $= f\;a \gg\!\!= g$, RHS $= (\lambda x.\; f\;x \gg\!\!= g)\;a = f\;a \gg\!\!= g$. Equal. $\square$

---

## 5. Monad Transformers

### 5.1 The Problem of Combining Monads

Given monads $M_1$ and $M_2$, their composition $M_1 \circ M_2$ is not in general a monad. **Monad transformers** solve this by providing a systematic way to layer monadic effects.

### 5.2 Definition

A **monad transformer** $T$ takes a monad $M$ and produces a new monad $T\;M$. It comes with:

$$
\text{lift} : M\;\alpha \to T\;M\;\alpha
$$

which embeds computations from the inner monad into the combined monad.

### 5.3 Example: StateT

$$
\text{StateT}\;s\;m\;\alpha = s \to m\;(\alpha, s)
$$

```
return a = StateT (\s -> return_m (a, s))

(StateT f) >>= k = StateT (\s -> do
    (a, s') <- f s
    let (StateT g) = k a
    g s')

lift m = StateT (\s -> do
    a <- m
    return_m (a, s))
```

### 5.4 Transformer Laws

A monad transformer $T$ with $\text{lift}$ must satisfy:

1. $\text{lift} \circ \text{return}_M = \text{return}_{T\,M}$
2. $\text{lift}\;(m \gg\!\!=_M f) = \text{lift}\;m \gg\!\!=_{T\,M} (\text{lift} \circ f)$

These ensure that lifting preserves the monadic structure of the inner monad.

---

## 6. Continuation-Passing Style (CPS) and CPS Transformation

### 6.1 Definition

In **continuation-passing style**, every function takes an extra argument -- the **continuation** -- representing "what to do next" with the result. No function ever returns; instead it passes its result to the continuation.

A direct-style function $f : \alpha \to \beta$ becomes $f_{\text{cps}} : \alpha \to (\beta \to \text{Ans}) \to \text{Ans}$ for some answer type $\text{Ans}$.

### 6.2 The CPS Transformation

Given a source language of the simply-typed lambda calculus, the CPS transform $\mathcal{C}[\![ \cdot ]\!]$ is defined inductively.

**Type translation:**

$$
\mathcal{C}[\![ \alpha ]\!]^+ = \alpha \quad \text{(base types unchanged)}
$$

$$
\mathcal{C}[\![ \alpha \to \beta ]\!]^+ = \mathcal{C}[\![ \alpha ]\!]^+ \to (\mathcal{C}[\![ \beta ]\!]^+ \to \text{Ans}) \to \text{Ans}
$$

**Term translation:**

$$
\mathcal{C}[\![ x ]\!]\;k = k\;x
$$

$$
\mathcal{C}[\![ \lambda x.\;e ]\!]\;k = k\;(\lambda x.\;\lambda k'.\;\mathcal{C}[\![ e ]\!]\;k')
$$

$$
\mathcal{C}[\![ e_1\;e_2 ]\!]\;k = \mathcal{C}[\![ e_1 ]\!]\;(\lambda f.\;\mathcal{C}[\![ e_2 ]\!]\;(\lambda a.\;f\;a\;k))
$$

### 6.3 Example

Direct style: $(\lambda x.\;x + 1)\;42$

CPS transform:

$$
\mathcal{C}[\![ (\lambda x.\;x + 1)\;42 ]\!]\;k = (\lambda f.\;(\lambda a.\;f\;a\;k)\;42)\;(\lambda x.\;\lambda k'.\;x +_{\text{cps}} 1\;k')
$$

which reduces to: $42 +_{\text{cps}} 1\;k$, i.e., $k\;43$.

### 6.4 Properties of CPS

**Theorem (CPS simulation).** If $e \longrightarrow^* v$ in the direct-style operational semantics, then $\mathcal{C}[\![ e ]\!]\;(\lambda x.\;x) \longrightarrow^* v'$ where $v'$ corresponds to $v$ under the type translation.

**Theorem (Plotkin, 1975).** The CPS transformation is a full abstraction for the call-by-value lambda calculus: two terms are observationally equivalent in direct style if and only if their CPS translations are observationally equivalent.

### 6.5 Applications

- **Compiler IR**: CPS is used as an intermediate representation in compilers (SML/NJ, early GHC).
- **Control flow**: Continuations naturally represent jumps, exceptions, and coroutines.
- **The Cont monad**: $\text{Cont}\;r\;\alpha = (\alpha \to r) \to r$ is itself a monad, and it is the "mother of all monads" -- every monad can be embedded into it.

---

## 7. Defunctionalization

### 7.1 Motivation

Higher-order functions pose challenges for whole-program analysis and compilation to low-level targets. **Defunctionalization** (Reynolds, 1972) converts a higher-order program into a first-order one.

### 7.2 The Transformation

1. For each lambda abstraction $\lambda x.\;e$ in the program, create a data constructor $C_i$ that captures the free variables of $e$.
2. Replace each function application $f\;x$ with a call to a single dispatch function $\text{apply}(f, x)$.
3. The $\text{apply}$ function pattern-matches on the constructor to determine which body to execute.

### 7.3 Algorithm

```
function Defunctionalize(program):
    constructors = {}
    for each lambda (\x -> body) with free variables fv1, ..., fvn at label L:
        constructors[L] = DataConstructor("Lam_L", fv1, ..., fvn)
        replace (\x -> body) with Lam_L(fv1, ..., fvn)

    define apply(f, x):
        match f with
            for each L in constructors:
                case Lam_L(fv1, ..., fvn) -> body_L[x, fv1, ..., fvn]

    replace all applications (f x) with apply(f, x)
    return transformed program
```

### 7.4 Example

Source (higher-order):

```
let compose f g = fun x -> f (g x)
let inc = fun x -> x + 1
let dbl = fun x -> x * 2
let h = compose inc dbl
h 3
```

Defunctionalized:

```
data Fun = Compose Fun Fun | Inc | Dbl

apply (Compose f g) x = apply f (apply g x)
apply Inc x            = x + 1
apply Dbl x            = x * 2

let h = Compose Inc Dbl
apply h 3    -- = apply Inc (apply Dbl 3) = apply Inc 6 = 7
```

### 7.5 Relationship to CPS

Defunctionalizing a CPS-transformed program yields a program in which continuations are represented as data structures -- essentially an abstract machine. Defunctionalizing the CPS of the lambda calculus yields the **CEK machine**.

---

## 8. Compiling Functional Languages

### 8.1 The STG Machine (Spineless Tagless G-Machine)

GHC compiles Haskell via the **STG language** (Peyton Jones, 1992), a small functional language that serves as an intermediate representation.

**Key design decisions:**

1. **Spineless**: There is no "spine" of application nodes; instead, function applications are saturated or partial-application objects (PAPs).
2. **Tagless**: Constructor tags are not inspected directly; instead, each closure has an **entry code pointer** and evaluation proceeds by jumping to it (eval/apply or push/enter model).

**STG expression syntax (simplified):**

$$
e ::= \text{let}\; x = \text{obj}\; \text{in}\; e \mid \text{case}\; e\; \text{of}\; \text{alts} \mid x\; a_1\;\ldots\;a_n
$$

$$
\text{obj} ::= \text{FUN}(x_1\;\ldots\;x_n \to e) \mid \text{THUNK}(e) \mid \text{CON}(C\; a_1\;\ldots\;a_n) \mid \text{PAP}(f\; a_1\;\ldots\;a_k)
$$

**Heap objects:**

| Object | Header | Payload | Entry code behavior |
|--------|--------|---------|-------------------|
| FUN | Info pointer | Free variables | Apply arguments |
| THUNK | Info pointer | Free variables | Evaluate; overwrite with result (update) |
| CON | Info pointer | Fields | Return to continuation |
| PAP | Info pointer | Function + partial args | Apply remaining arguments |

### 8.2 Thunk Evaluation and Updating

When a thunk is entered:

```
function EnterThunk(thunk):
    push update frame onto stack  (saves return address)
    evaluate thunk's body
    when body produces a value v:
        overwrite thunk in heap with an indirection to v (or directly with v)
        pop update frame, return v to original continuation
```

This implements **call-by-need**: the thunk is evaluated once, then overwritten so future accesses go directly to the value.

### 8.3 Closure Representation

A **closure** is a heap-allocated record containing:

1. An **info pointer** (pointing to the entry code and metadata).
2. **Free variables** of the function/thunk body.

```
struct Closure {
    InfoTable* info;      // points to entry code, type, arity, layout info
    Word      payload[];  // free variables
};
```

### 8.4 Compiling Pattern Matching in STG

The `case` expression in STG is the sole mechanism for evaluation and branching:

```
case e of
    C1 x1 ... xk -> e1
    C2 y1 ... ym -> e2
    ...
    _            -> e_default
```

The operational meaning: evaluate $e$ to weak head normal form (WHNF), then branch on the constructor tag.

### 8.5 Garbage Collection Considerations

GHC uses a **generational, copying garbage collector**. The STG design aids GC:

- Every heap object has a uniform layout (info pointer + payload).
- The info table contains a **layout bitmap** or **pointer/non-pointer counts** so the GC knows which payload words are pointers.
- Thunk update frames are recognized by the GC, enabling **stack squeezing**.

---

## 9. Advanced Topics

### 9.1 The Cont Monad as Universal

**Theorem (Filinski, 1994).** Any expressible monad can be implemented using continuations and mutable state. Specifically, in a language with `shift`/`reset` (delimited continuations), any monadic effect can be represented.

This suggests that **delimited continuations** are a universal effect mechanism, a theme we revisit in Module 10 with algebraic effects.

### 9.2 Free Monads

A **free monad** over a functor $F$ is:

$$
\text{Free}\;F\;\alpha = \text{Pure}\;\alpha \mid \text{Free}\;(F\;(\text{Free}\;F\;\alpha))
$$

Free monads allow building monadic computations as data (syntax trees) that can be interpreted in multiple ways. They are the basis for many effect system libraries.

### 9.3 Fusion and Deforestation

**Stream fusion** and **short-cut deforestation** (Gill, Launchbury, Peyton Jones, 1993) eliminate intermediate data structures in compositions of list operations:

$$
\text{map}\;f \circ \text{map}\;g = \text{map}\;(f \circ g)
$$

Generalized via **foldr/build** fusion:

$$
\text{foldr}\;c\;n\;(\text{build}\;g) = g\;c\;n
$$

where $\text{build}\;g = g\;\text{Cons}\;\text{Nil}$. GHC implements this via rewrite rules.

---

## 10. Summary

| Concept | Key Insight |
|---------|------------|
| Referential transparency | Enables equational reasoning and safe parallelism |
| Lazy evaluation | More expressive but harder to reason about space usage |
| ADTs + pattern matching | Foundation of data modeling in functional languages |
| Monads | Structure effects while preserving purity; obey algebraic laws |
| Monad transformers | Compose multiple effects via layered monads |
| CPS | Makes control flow explicit; foundation for compiler IRs |
| Defunctionalization | Eliminates higher-order functions; yields abstract machines |
| STG machine | GHC's compilation target; uniform closure representation with lazy evaluation |

---

## References

1. Wadler, P. (1992). "Monads for functional programming." In *Advanced Functional Programming*, LNCS 925.
2. Peyton Jones, S. L. (1992). "Implementing lazy functional languages on stock hardware: the Spineless Tagless G-machine." *Journal of Functional Programming*, 2(2), 127--202.
3. Plotkin, G. (1975). "Call-by-name, call-by-value and the lambda calculus." *Theoretical Computer Science*, 1(2), 125--159.
4. Reynolds, J. C. (1972). "Definitional interpreters for higher-order programming languages." *Proceedings of the ACM Annual Conference*.
5. Moggi, E. (1991). "Notions of computation and monads." *Information and Computation*, 93(1), 55--92.
6. Filinski, A. (1994). "Representing monads." *POPL '94*.
7. Gill, A., Launchbury, J., & Peyton Jones, S. L. (1993). "A short cut to deforestation." *FPCA '93*.
8. Curry, H. B. & Feys, R. (1958). *Combinatory Logic*, Vol. I. North-Holland.
9. Liang, S., Hudak, P., & Jones, M. (1995). "Monad transformers and modular interpreters." *POPL '95*.
