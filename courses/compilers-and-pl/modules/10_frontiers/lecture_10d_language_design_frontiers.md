# Lecture 10d: Language Design Frontiers

## Prerequisites

- Type theory (Modules 03--04), functional programming (Lecture 09a), familiarity with at least one statically typed language.

---

## 1. Effect Handlers and Algebraic Effects

### 1.1 The Problem with Monads

Monads (Lecture 09a) are powerful but have limitations:
- **Monad transformers do not commute**: `StateT s (ExceptT e m)` differs from `ExceptT e (StateT s m)` in behavior.
- **Rigid stack**: Adding or removing an effect requires restructuring the entire monad stack.
- **No handler polymorphism**: Code written for `State s` cannot be used in a context with additional effects without lifting.

### 1.2 Algebraic Effects (Plotkin & Power, 2003)

An **algebraic effect** is defined by a set of **operations** (effect signatures):

$$
\text{effect}\;\text{State}(s) = \{\text{Get} : \text{unit} \to s, \quad \text{Put} : s \to \text{unit}\}
$$

$$
\text{effect}\;\text{Exc}(e) = \{\text{Raise} : e \to \text{void}\}
$$

Effects are algebraic in the sense that effectful computations form a **free algebra** over the operations.

### 1.3 Effect Handlers (Plotkin & Pretnar, 2009)

An **effect handler** gives semantics to effect operations, analogous to how an exception handler gives semantics to `throw`:

```
handle computation() with
| return x     -> ...             // what to do with the final value
| Get ()    k  -> ... k(state) ...   // resume with state value
| Put s     k  -> ... k(()) ...      // resume with unit, update state
```

The variable $k$ is the **continuation** (the rest of the computation after the effect operation). The handler can:
- Resume the computation: $k(v)$.
- Not resume (like catching an exception).
- Resume multiple times (for nondeterminism).
- Resume in a modified context.

### 1.4 Formal Semantics

**Syntax:**

$$
e ::= \text{return}\;v \mid \text{op}(v, \lambda x.\;e) \mid \text{handle}\;e\;\text{with}\;h
$$

where $h$ is a handler mapping operations to handler clauses.

**Reduction rules:**

$$
\text{handle}\;(\text{return}\;v)\;\text{with}\;h \;\longrightarrow\; h_{\text{ret}}(v)
$$

$$
\text{handle}\;(\text{op}(v, \kappa))\;\text{with}\;h \;\longrightarrow\; h_{\text{op}}(v, \lambda x.\;\text{handle}\;(\kappa\;x)\;\text{with}\;h)
$$

The second rule is the key: when the handled computation performs operation $\text{op}$, the handler clause $h_{\text{op}}$ receives the argument $v$ and a **delimited continuation** $\lambda x.\;\text{handle}\;(\kappa\;x)\;\text{with}\;h$ that, when called, resumes the computation with the handler still installed.

### 1.5 Typing Algebraic Effects

**Effect row types** track which effects a computation may perform:

$$
\Gamma \vdash e : \tau \;!\; \{\text{State}(s), \text{Exc}(e), \ldots\}
$$

The type $\tau \;!\; \varepsilon$ means "a computation that produces a value of type $\tau$ and may perform effects in the set $\varepsilon$."

**Typing rule for handle:**

$$
\frac{\Gamma \vdash e : \tau \;!\; \{\text{op}_1, \ldots, \text{op}_n\} \cup \varepsilon \quad \text{handler clauses well-typed}}{\Gamma \vdash \text{handle}\;e\;\text{with}\;h : \sigma \;!\; \varepsilon}
$$

The handler eliminates effects $\{\text{op}_1, \ldots, \text{op}_n\}$ from the effect set.

### 1.6 Languages with Effect Handlers

- **Koka** (Leijen, 2014): First practical language with full algebraic effects and handlers.
- **Eff** (Bauer & Pretnar, 2015): Research language exploring effect handlers.
- **OCaml 5.0**: Adds effect handlers for multicore programming.
- **Unison**: Uses abilities (algebraic effects) for I/O and other effects.

### 1.7 Theorem: Effects Subsume Monads

**Theorem (Forster et al., 2019).** Algebraic effect handlers can simulate any monad. Conversely, any algebraic effect can be implemented using the free monad. Thus, effects and monads are **equi-expressive**, but effects offer better ergonomics (no transformer stacks, natural composition).

---

## 2. Capabilities and Object Capabilities

### 2.1 Capability-Based Security

A **capability** is an unforgeable token that grants access to a resource. In capability-safe languages, access to a resource requires possessing a capability for it.

**Principle of Least Authority (POLA):** Each component should have only the capabilities it needs to perform its task.

### 2.2 Object Capabilities (Mark Miller, 2006)

In an **object-capability (ocap) language**, objects are capabilities. Access to an object is controlled by the reference graph:
- An object can only interact with objects it has a reference to.
- References cannot be forged (no ambient authority, no global mutable state).
- Capabilities are granted by passing references as arguments.

**Languages:** E, Monte, Pony, Wasm (partially).

### 2.3 Formal Model

An object capability system satisfies:
1. **No ambient authority**: No global variables or static methods provide access to resources.
2. **Memory safety**: No pointer forging or out-of-bounds access.
3. **Encapsulation**: Objects can only be accessed via their public interface.
4. **Reference passing**: The only way to obtain a reference is to (a) create the object, (b) receive it as an argument, or (c) receive it as a return value.

**Theorem (Miller, 2006).** In a language satisfying properties 1--4, the **reference graph** at any point in time is a sound over-approximation of the authority graph. Static analysis of the reference graph can verify security properties.

### 2.4 Capabilities in Rust and Scala

**Scala 3 Capture Checking** (2023): Scala 3 tracks capabilities in the type system using **capture sets**:

$$
\text{def}\;\text{readFile}(f: \text{File})\text{(using}\;\text{cap}: \text{CanRead}): \text{String}^{\{cap\}}
$$

The return type tracks which capabilities were used, enabling the compiler to verify that capabilities are not leaked.

---

## 3. Gradual Typing at Scale

### 3.1 The Idea (Siek & Taha, 2006)

**Gradual typing** allows mixing statically-typed and dynamically-typed code within the same program. The **dynamic type** $\star$ (or `Any`) is compatible with any type:

$$
\frac{}{\tau \sim \star} \quad \frac{}{\star \sim \tau} \quad \frac{\tau_1 \sim \tau_1' \quad \tau_2 \sim \tau_2'}{\tau_1 \to \tau_2 \sim \tau_1' \to \tau_2'}
$$

where $\sim$ is the **consistency** relation (replaces subtyping for gradual types).

### 3.2 Runtime Casts

When a value crosses a type boundary (from dynamic to static or vice versa), a **cast** is inserted:

$$
\text{cast}^{\tau_1 \Rightarrow \tau_2}(v)
$$

Casts are checked at runtime. A cast from $\text{Int}$ to $\text{String}$ raises a runtime error.

### 3.3 Blame Calculus (Wadler & Findler, 2009)

**Blame** tracks which part of the program is responsible for a cast failure. The **blame theorem** guarantees:

**Theorem (Wadler & Findler, 2009).** A cast inserted at the boundary between typed and untyped code can only fail if the untyped side violated the type contract. Well-typed code is never blamed.

### 3.4 The Gradual Guarantee (Siek et al., 2015)

A gradually typed language satisfies the **gradual guarantee** if:
1. **Static gradual guarantee**: Replacing a type annotation with $\star$ (making it less precise) preserves well-typedness.
2. **Dynamic gradual guarantee**: Replacing a type annotation with $\star$ preserves behavior (modulo additional cast errors).

### 3.5 Performance Challenges

The naive implementation of gradual typing inserts casts at every type boundary. In programs with many boundaries (common in practice), this introduces significant overhead.

**Solutions:**
- **Transient semantics** (Vitousek et al., 2017): Replace higher-order casts with shallow tag checks. Faster but weaker guarantees.
- **Monotonic references**: Track types of mutable references to avoid repeated checking.
- **JIT compilation**: Specialize code based on observed types (similar to dynamic language JITs).

### 3.6 Gradual Typing in Practice

| Language | Approach | Performance |
|----------|----------|-------------|
| TypeScript | Erased types (no runtime checking) | No overhead, no safety |
| Python (mypy) | External type checker, no runtime checks | No overhead, no safety |
| Typed Racket | Full contracts at boundaries | 1.5--100x slowdown |
| Dart | Sound gradual typing with runtime checks | Moderate overhead |
| C# nullable | Nullable reference types with warnings | Minimal |

---

## 4. Dependent Types in Practice

### 4.1 What Are Dependent Types?

In a **dependently typed** language, types can depend on values. The type of an expression may mention runtime values:

$$
\text{Vec} : \text{Nat} \to \text{Type} \to \text{Type}
$$

$\text{Vec}\;5\;\text{Int}$ is the type of integer vectors of length exactly 5.

### 4.2 The Calculus of Constructions

The theoretical foundation is the **Calculus of Constructions** (Coquand & Huet, 1988), which unifies types and terms:

$$
e ::= x \mid \lambda x : A.\; e \mid e_1\;e_2 \mid \Pi x : A.\; B \mid \text{Type}_i
$$

The dependent function type $\Pi x : A.\; B$ generalizes $A \to B$: the return type $B$ may mention the argument $x$.

**Typing rule:**

$$
\frac{\Gamma \vdash A : \text{Type}_i \quad \Gamma, x : A \vdash B : \text{Type}_j}{\Gamma \vdash \Pi x : A.\;B : \text{Type}_{\max(i,j)}}
$$

$$
\frac{\Gamma, x : A \vdash e : B}{\Gamma \vdash \lambda x : A.\;e : \Pi x : A.\;B}
$$

$$
\frac{\Gamma \vdash f : \Pi x : A.\;B \quad \Gamma \vdash a : A}{\Gamma \vdash f\;a : B[a/x]}
$$

### 4.3 Type Checking Requires Evaluation

In a dependently typed language, type checking requires evaluating expressions (since types contain terms). This means:

- Type checking is **undecidable** in general (if the language is Turing-complete).
- Practical systems use a **termination checker** to ensure all functions terminate, making type checking decidable.

### 4.4 Dependent Types in Idris (Brady, 2013)

**Idris** is a general-purpose dependently typed language designed for practical programming:

```idris
-- Vector type indexed by length
data Vect : Nat -> Type -> Type where
    Nil  : Vect 0 a
    (::) : a -> Vect n a -> Vect (S n) a

-- Type-safe head (cannot be called on empty vectors)
head : Vect (S n) a -> a
head (x :: _) = x

-- Length-preserving map
map : (a -> b) -> Vect n a -> Vect n b
map f Nil       = Nil
map f (x :: xs) = f x :: map f xs

-- Append with precise length
append : Vect n a -> Vect m a -> Vect (n + m) a
append Nil       ys = ys
append (x :: xs) ys = x :: append xs ys
```

### 4.5 Lean 4

**Lean 4** (de Moura et al., 2021) is both a theorem prover and a general-purpose programming language:
- Dependent types with a powerful tactic framework.
- Compiled to efficient native code (reference counting, no GC).
- Used for the Mathlib library (formalized mathematics).

### 4.6 Agda

**Agda** emphasizes the connection between programs and proofs:
- Pattern matching on indexed types performs **unification**.
- The coverage checker ensures all cases are handled.
- Termination checking ensures all recursive functions terminate.

### 4.7 The Curry-Howard Correspondence in Dependent Types

| Logic | Type Theory |
|-------|------------|
| Proposition $P$ | Type $P$ |
| Proof of $P$ | Term of type $P$ |
| $P \wedge Q$ | $P \times Q$ (pair type) |
| $P \vee Q$ | $P + Q$ (sum type) |
| $P \implies Q$ | $P \to Q$ (function type) |
| $\forall x : A.\; P(x)$ | $\Pi x : A.\; P(x)$ (dependent function) |
| $\exists x : A.\; P(x)$ | $\Sigma x : A.\; P(x)$ (dependent pair) |

A program that type-checks in a dependently typed language is simultaneously a proof of the proposition expressed by its type.

---

## 5. Quantum Programming Languages

### 5.1 Quantum Computing Basics

A quantum state of $n$ qubits is a unit vector in $\mathbb{C}^{2^n}$. Operations are **unitary matrices**. Measurement is **probabilistic** and **destructive**.

### 5.2 The No-Cloning Theorem and Linear Types

**Theorem (Wootters & Zurek, 1982).** It is impossible to create an identical copy of an arbitrary unknown quantum state.

This has direct implications for language design: quantum variables must be treated **linearly** (used exactly once). This connects to **linear type systems**:

$$
\frac{\Gamma_1 \vdash e_1 : \text{Qubit} \quad \Gamma_2 \vdash e_2 : \tau \quad \Gamma_1 \cap \Gamma_2 = \emptyset}{\Gamma_1 \cup \Gamma_2 \vdash \text{CNOT}(e_1, e_2) : \text{Qubit} \otimes \text{Qubit}}
$$

### 5.3 Quantum Programming Languages

- **Quipper** (Green et al., 2013): Circuit description language embedded in Haskell.
- **Q#** (Microsoft): Standalone language with quantum-specific types and operations.
- **Silq** (Bichsel et al., 2020): Automatically handles uncomputation (the reverse of quantum operations needed for correctness).

### 5.4 The Quantum Lambda Calculus (Selinger & Valiron, 2006)

A typed lambda calculus with quantum features:

$$
\tau ::= \text{Qubit} \mid \tau_1 \multimap \tau_2 \mid \tau_1 \otimes \tau_2 \mid !\tau
$$

- $\multimap$: Linear function type (argument used exactly once).
- $\otimes$: Tensor product (quantum entanglement).
- $!\tau$: Classical (duplicable) data embedded in the quantum world.

---

## 6. Differentiable Programming Languages

### 6.1 Motivation

**Differentiable programming** treats programs as differentiable functions, enabling gradient-based optimization (training neural networks, physics simulation, etc.).

### 6.2 Automatic Differentiation (AD)

Given a function $f : \mathbb{R}^n \to \mathbb{R}^m$ implemented as a program, AD computes the Jacobian $\frac{\partial f}{\partial x}$ exactly (up to floating-point precision).

**Forward mode AD:**

$$
\frac{\partial}{\partial x_i}\left[f(x)\right] \quad \text{computed alongside } f(x)
$$

For each input, propagate a **tangent** vector $\dot{x}$ forward through the computation:

$$
y = f(x), \quad \dot{y} = J_f(x) \cdot \dot{x}
$$

Cost: $O(n)$ passes for the full Jacobian (one per input dimension).

**Reverse mode AD (backpropagation):**

$$
\bar{x} = J_f(x)^T \cdot \bar{y}
$$

Propagate **adjoint** (gradient) values backward through the computation. Cost: $O(m)$ passes (one per output dimension). For $m = 1$ (scalar loss function), a single backward pass computes the full gradient.

### 6.3 AD as a Language Feature

- **JAX** (Google): Transforms Python/NumPy functions via `jax.grad`, `jax.jvp`, `jax.vjp`.
- **Swift for TensorFlow** (Abadi et al., 2016): First-class differentiable programming in Swift (now discontinued but influential).
- **Zygote/Enzyme**: Source-to-source AD for Julia / LLVM IR.

### 6.4 Correctness of AD

**Theorem (Correctness of reverse-mode AD).** For a program $P$ computing $f : \mathbb{R}^n \to \mathbb{R}$, the reverse-mode AD transformation $\overline{P}$ computes the gradient $\nabla f(x)$ exactly (in exact arithmetic). Formally:

$$
[\![ \overline{P} ]\!](x) = \nabla f(x) = \left(\frac{\partial f}{\partial x_1}, \ldots, \frac{\partial f}{\partial x_n}\right)
$$

*Proof sketch.* By induction on the structure of $P$, each elementary operation's adjoint correctly implements the chain rule. The composition of adjoints in reverse order corresponds to the chain rule applied to the full composition. $\square$

### 6.5 Challenges

- **Control flow**: Differentiating through loops, conditionals, and recursion requires careful handling.
- **Discrete operations**: Operations like `if`, `argmax`, indexing are not differentiable. Relaxations (Gumbel-softmax, straight-through estimator) are used.
- **Memory**: Reverse-mode AD requires storing intermediate values (the "tape"), consuming $O(\text{computation steps})$ memory.

---

## 7. Probabilistic Programming Languages

### 7.1 Concept

A **probabilistic programming language (PPL)** allows writing generative models as programs with random choices, then performing **inference** (computing posterior distributions given observed data).

### 7.2 Syntax (Conceptual)

```
x ~ Normal(0, 1)          // sample x from a normal distribution
y ~ Normal(x, 0.1)        // sample y from a normal centered at x
observe(y, 2.3)            // condition on observed data
return x                   // infer the posterior distribution of x
```

### 7.3 Formal Semantics

The semantics of a probabilistic program is a **measure** (probability distribution) over return values:

$$
[\![ P ]\!] : \text{Meas}(\tau)
$$

where $\text{Meas}(\tau)$ is the space of probability measures over type $\tau$.

For conditioning (observe), the semantics uses **disintegration** or **density functions**:

$$
[\![ \text{observe}(y, v); P ]\!] = \frac{p(y = v \mid \text{prior}) \cdot [\![ P ]\!]}{\int p(y = v \mid \text{prior}) \cdot d([\![ P ]\!])}
$$

### 7.4 Inference Algorithms

| Algorithm | Description | Exact/Approximate |
|-----------|-------------|-------------------|
| Enumeration | Enumerate all execution paths | Exact (finite programs) |
| MCMC (e.g., Metropolis-Hastings) | Random walk in the posterior | Approximate |
| Hamiltonian Monte Carlo | Use gradients of the log-density | Approximate (requires AD) |
| Variational inference | Optimize a parametric approximation | Approximate |
| Sequential Monte Carlo (particle filtering) | Weighted samples | Approximate |

### 7.5 Languages

- **Stan**: Imperative PPL with HMC inference. Widely used in statistics.
- **Pyro/NumPyro**: PPLs embedded in Python (PyTorch/JAX).
- **Church/WebPPL**: Functional PPLs based on Scheme/JavaScript.
- **Gen**: Julia-based PPL with programmable inference.
- **Hakaru**: Haskell PPL with exact symbolic inference.

### 7.6 The Compilation Challenge

Compiling probabilistic programs requires:
1. **Trace management**: Recording the sequence of random choices.
2. **Density computation**: Computing the log-probability of a trace.
3. **Gradient computation**: For gradient-based inference (HMC, VI), computing gradients of the log-density with respect to continuous parameters.
4. **Symbolic simplification**: Reducing the model to a simpler form for more efficient inference (Hakaru's approach).

---

## 8. Language Support for Formal Verification

### 8.1 Contracts and Refinement Types

**Refinement types** (Xi & Pfenning, 1999) augment base types with predicates:

$$
\{x : \text{Int} \mid x > 0\}
$$

The type checker verifies that the predicate holds (often via an SMT solver).

**Liquid Haskell** (Rondon, Kawaguchi, Jhala, 2008) extends Haskell with refinement types:

```haskell
{-@ divide :: Int -> {v:Int | v /= 0} -> Int @-}
divide :: Int -> Int -> Int
divide x y = x `div` y
```

### 8.2 Separation Logic and Ownership Types

**Separation logic** (Reynolds, 2002) reasons about programs with mutable state:

$$
\{P_1 * P_2\}\; C \;\{Q_1 * Q_2\}
$$

The separating conjunction $*$ asserts that $P_1$ and $P_2$ hold on **disjoint** portions of the heap.

Rust's **ownership and borrowing** system is a practical realization of affine/linear types inspired by separation logic:
- Each value has a unique owner.
- Borrowing creates references with restricted lifetimes.
- The borrow checker ensures memory safety without a garbage collector.

### 8.3 Dafny and Verification-Aware Languages

**Dafny** (Leino, 2010) is a language designed for verification:

```dafny
method BinarySearch(a: array<int>, key: int) returns (index: int)
    requires forall i, j :: 0 <= i < j < a.Length ==> a[i] <= a[j]
    ensures 0 <= index < a.Length ==> a[index] == key
    ensures index == -1 ==> forall i :: 0 <= i < a.Length ==> a[i] != key
{
    var lo, hi := 0, a.Length;
    while lo < hi
        invariant 0 <= lo <= hi <= a.Length
        invariant forall i :: 0 <= i < lo ==> a[i] < key
        invariant forall i :: hi <= i < a.Length ==> a[i] > key
    {
        var mid := (lo + hi) / 2;
        if a[mid] < key { lo := mid + 1; }
        else if a[mid] > key { hi := mid; }
        else { return mid; }
    }
    return -1;
}
```

Dafny automatically generates verification conditions and discharges them with Z3.

---

## 9. Summary

| Frontier | Key Innovation | Status |
|----------|---------------|--------|
| Algebraic effects | Composable, modular effect handling | Koka, OCaml 5, research languages |
| Object capabilities | Security via reference graph control | Pony, Wasm, Scala 3 capture checking |
| Gradual typing | Mix static and dynamic typing safely | TypeScript (erased), Typed Racket (full) |
| Dependent types | Types that depend on values; proofs as programs | Idris, Lean 4, Agda |
| Quantum PLs | Linear types for quantum resources | Q#, Quipper, Silq |
| Differentiable PLs | Automatic differentiation as a language primitive | JAX, Enzyme, Swift for TF |
| Probabilistic PLs | Programs as generative models; inference as computation | Stan, Pyro, Gen |
| Verification-aware PLs | Contracts, refinement types, ownership | Rust, Dafny, Liquid Haskell |

---

## References

1. Plotkin, G. & Pretnar, M. (2009). "Handlers of algebraic effects." *ESOP '09*, LNCS 5502, 80--94.
2. Brady, E. (2013). "Idris, a general-purpose dependently typed programming language: Design and implementation." *JFP*, 23(5), 552--593.
3. Abadi, M., Barham, P., Chen, J., et al. (2016). "TensorFlow: A system for large-scale machine learning." *OSDI '16*.
4. Siek, J. G. & Taha, W. (2006). "Gradual typing for functional languages." *Scheme and Functional Programming Workshop*.
5. Wadler, P. & Findler, R. B. (2009). "Well-typed programs can't be blamed." *ESOP '09*.
6. Selinger, P. & Valiron, B. (2006). "A lambda calculus for quantum computation with classical control." *MSCS*, 16(3).
7. Coquand, T. & Huet, G. (1988). "The calculus of constructions." *Information and Computation*, 76(2-3), 95--120.
8. de Moura, L., Kong, S., Avigad, J., van Doorn, F., & von Raumer, J. (2021). "The Lean 4 theorem prover and programming language." *CADE '21*.
9. Leijen, D. (2014). "Koka: Programming with row polymorphic effect types." *MSFP '14*.
10. Bauer, A. & Pretnar, M. (2015). "Programming with algebraic effects and handlers." *JFP*, 25, e15.
11. Miller, M. (2006). "Robust composition: Towards a unified approach to access control and concurrency control." PhD dissertation, Johns Hopkins University.
12. Reynolds, J. C. (2002). "Separation logic: A logic for shared mutable data structures." *LICS '02*.
13. Leino, K. R. M. (2010). "Dafny: An automatic program verifier for functional correctness." *LPAR '10*.
14. Forster, Y., Kammar, O., Lindley, S., & Pretnar, M. (2019). "On the expressive power of user-defined effects." *JFP*, 29, e15.
