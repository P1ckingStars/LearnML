---
title: "Lecture 10d: The Future of Type Theory"
tags:
  - type-theory
  - frontiers
  - lecture
---
# Lecture 10d: The Future of Type Theory

> **Module 10 --- Frontiers (Weeks 19--20)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Survey the landscape of dependent types in mainstream and research programming languages (Idris, Lean, dependent Haskell) and articulate the key design tradeoffs.
2. Define refinement types and explain how Liquid Haskell and F* use SMT solvers to automate verification of refinement predicates.
3. Describe type-directed program synthesis and its connection to the Curry--Howard correspondence and proof search.
4. Explain modal type theories and their applications to staged computation, distributed systems, and information-flow control.
5. Articulate the goals of observational type theory and explain how it reconciles extensional and intensional equality.
6. Describe the state of large-scale formalization projects (Lean Mathlib, Coq Mathematical Components) and assess their impact on mathematics and software verification.
7. Discuss emerging connections between type theory and quantum computing, differentiable programming, and machine learning.
8. Identify open problems in type theory and evaluate their potential impact on programming language design and mathematical foundations.

---

## 1. Motivation

This course has taken us from the untyped lambda calculus through simple types, polymorphism, dependent types, substructural types, and into the homotopy-theoretic frontier. In this final lecture, we survey the broader landscape of type theory research and its applications, looking at both the directions that are actively being pursued and the open problems that remain.

Type theory is no longer a niche concern of logicians and proof assistant developers. It shapes the design of mainstream programming languages (Rust's ownership types, TypeScript's structural types, Kotlin's nullable types), underpins the verification revolution in systems software, and provides the conceptual vocabulary for new computational paradigms. Understanding where the field is heading is essential for anyone who wants to contribute to programming language design, formal verification, or the foundations of mathematics and computer science.

We organize the survey into thematic sections, each covering a research direction with enough depth to convey the key ideas, the current state of the art, and the open questions.

---

## 2. Core Theory

### 2.1 Dependent Types in Mainstream Languages

The vision of dependent types --- types that depend on values --- has been a staple of type theory since Martin-L\"of's work in the 1970s. For decades, dependent types were confined to proof assistants (Coq, Agda) and research languages (Epigram, Cayenne). In recent years, there has been a concerted effort to bring dependent types into languages designed for practical programming.

**Idris 2 (Brady, 2021).**

Idris 2 is a dependently typed language designed for general-purpose programming, not just theorem proving. Key design decisions:

- *Quantitative type theory (QTT)*: Idris 2 uses a type system based on McBride's (2016) quantitative type theory, where each variable binding carries a *multiplicity* annotation --- 0 (erased at runtime), 1 (used exactly once, enabling linear resource management), or $\omega$ (used without restriction). This unifies dependent types with linear types.

- *First-class types*: Types are ordinary values. One can write functions that compute types, pass types as arguments, and return types as results. This is the full dependent type experience.

- *Erasure*: The QTT framework enables precise control over what exists at runtime and what is erased. Proofs and type indices can be marked as 0-multiplicity, ensuring they have no runtime cost.

- *Type-driven development*: Idris emphasizes an interactive programming methodology where the type of a function guides its implementation, with the editor providing "holes" that can be filled incrementally.

**Lean 4 (Moura and Ullrich, 2021).**

Lean 4 is simultaneously a proof assistant and a general-purpose programming language. Key features:

- *Dependent types with a Calculus of Inductive Constructions (CIC) foundation*, similar to Coq but with a more ergonomic surface syntax.
- *Metaprogramming*: Lean 4 has a powerful metaprogramming framework (macros, elaboration monads, tactic frameworks) that allows users to extend the language.
- *Compilation to C*: Lean 4 compiles to efficient C code, making it practical for systems programming and data processing.
- *Mathlib*: The Lean mathematical library (discussed in Section 2.7) is the largest unified library of formalized mathematics.

**Dependent Haskell.**

The GHC Haskell compiler has been gradually acquiring dependent type features, driven by the work of Eisenberg (2016) and others:

- *Type-level computation*: GHC supports type families, GADTs, data kinds, and type-level natural numbers, providing a limited form of dependent types.
- *Singletons*: The `singletons` library (Eisenberg and Weirich, 2012) bridges the gap between types and values, simulating dependent types in current Haskell.
- *Full dependent Haskell*: The long-term goal is to unify the term and type languages, allowing types to depend on arbitrary terms. This requires resolving deep design questions about non-termination (Haskell is not total), type inference (dependent types make inference undecidable in general), and backward compatibility.

**Scala 3 / Dotty (Odersky et al., 2021).** Scala 3 incorporates dependent function types, match types, and opaque type aliases. While not fully dependently typed, these features enable sophisticated type-level programming:

```scala
// Match types: type-level pattern matching
type Elem[X] = X match
  case String => Char
  case Array[t] => t
  case Iterable[t] => t

// Dependent function types
val depFun: (b: Boolean) => (if b then Int else String) =
  (b: Boolean) => if b then 42 else "hello"
```

**Key tradeoffs.** The central tension in dependently typed programming is:

- **Decidability of type checking.** In a total language (all programs terminate), type checking is decidable. In a partial language (programs may diverge), type checking with dependent types is generally undecidable because it may require evaluating arbitrary terms to check type equality.
- **Totality.** Requiring totality enables strong reasoning but restricts expressiveness (general recursion is not available). Lean and Agda require totality by default; Idris has a totality checker but allows partial functions; Haskell does not require totality.
- **Inference.** Dependent types make type inference much harder. Lean and Idris use elaboration algorithms with sophisticated heuristics; Haskell relies heavily on unification-based inference.

### 2.2 Refinement Types

Refinement types enrich ordinary types with logical predicates, enabling specification and verification of program properties without the full complexity of dependent types.

**Definition 2.1 (Refinement type).** A refinement type has the form $\{x : \tau \mid \varphi(x)\}$, where $\tau$ is a base type and $\varphi(x)$ is a logical predicate over $x$. A value $v$ inhabits $\{x : \tau \mid \varphi(x)\}$ if $v : \tau$ and $\varphi(v)$ holds.

**Example 2.2.**

- $\{n : \text{Int} \mid n > 0\}$: the type of positive integers.
- $\{xs : \text{List}\;\text{Int} \mid \text{sorted}(xs)\}$: the type of sorted integer lists.
- $\{f : \text{Int} \to \text{Int} \mid \forall x.\, f(x) \geq x\}$: the type of non-decreasing integer functions.

**Liquid Haskell (Vazou, Seidel, Jhala, 2014).**

Liquid Haskell extends Haskell with refinement types, using SMT solvers (Z3) to automatically discharge verification conditions.

- *Liquid types*: Refinement predicates are drawn from a *decidable logic* (quantifier-free linear arithmetic, uninterpreted functions), so subtyping is decidable. This is the key innovation: by restricting the predicate language, verification becomes automatic.
- *Measures*: User-defined functions that can appear in refinement predicates. For example, one can define `measure len :: [a] -> Int` and write types like `{xs : [a] | len xs > 0}`.
- *Abstract refinements*: Polymorphism over refinement predicates, enabling generic specifications.

**Example 2.3 (Liquid Haskell).**

```haskell
{-@ divide :: Int -> {d:Int | d /= 0} -> Int @-}
divide :: Int -> Int -> Int
divide n d = n `div` d

{-@ head :: {xs:[a] | len xs > 0} -> a @-}
head :: [a] -> a
head (x:_) = x
```

The refinement type of `divide` guarantees that the divisor is non-zero, eliminating division-by-zero errors at compile time. The refinement type of `head` guarantees that the list is non-empty.

**F\* (Swamy et al., 2016).**

F\* is a dependently typed language with refinement types, effects, and support for extraction to OCaml, F\#, C, and WebAssembly. Key features:

- *Effect system*: F\* tracks computational effects (divergence, state, exceptions, I/O) in the type system. A function of type $\text{Pure}\;\tau\;\varphi$ is total and satisfies postcondition $\varphi$; a function of type $\text{ST}\;\tau\;\varphi$ may use mutable state.
- *SMT automation*: Like Liquid Haskell, F\* uses Z3 to discharge proof obligations, but with a richer logic (including quantifiers).
- *Verified cryptography*: Project Everest (Microsoft Research) used F\* to develop verified implementations of TLS 1.3 and related cryptographic protocols (HACL\*, EverCrypt).

**Remark 2.3 (SMT-based verification in detail).** The key insight of Liquid Haskell and F\* is that refinement predicates can be expressed in a logic that SMT solvers handle efficiently. The verification pipeline is:

1. **Type checking with refinements:** The type checker generates *verification conditions* (VCs) --- logical formulas that, if valid, ensure the program is well-typed.
2. **VC generation:** At each function call site, the VC asserts that the argument satisfies the function's precondition (given the current path condition). At each return site, the VC asserts that the return value satisfies the postcondition.
3. **SMT solving:** The VCs are discharged by an SMT solver (typically Z3). If all VCs are valid, the program is well-typed. If a VC is invalid, the solver produces a counterexample, which is reported as a type error.

**Example 2.4 (Verification condition generation).**

```haskell
{-@ abs :: Int -> {v:Int | v >= 0} @-}
abs :: Int -> Int
abs n = if n >= 0 then n else negate n
```

The VC for the `then` branch is: $n \geq 0 \implies n \geq 0$ (trivially valid).
The VC for the `else` branch is: $\neg(n \geq 0) \implies (-n) \geq 0$, i.e., $n < 0 \implies -n \geq 0$ (valid in integer arithmetic).

Both VCs are discharged by Z3, confirming that `abs` has the claimed refinement type.

**Remark 2.5 (Limitations of SMT-based verification).** SMT solvers are incomplete for many theories (nonlinear arithmetic, higher-order functions, inductive data types). When the solver cannot decide a VC, the programmer must provide additional annotations (loop invariants, inductive lemmas) or restructure the code. This is the main practical limitation of refinement type systems.

### 2.3 Type-Directed Program Synthesis

The Curry--Howard correspondence suggests a deep connection between type inhabitation and theorem proving: finding a term of a given type is equivalent to finding a proof of the corresponding proposition. **Type-directed program synthesis** exploits this connection to automatically generate programs from type specifications.

**Definition 2.4 (Type inhabitation problem).** Given a type $\tau$ and a context $\Gamma$, find a term $t$ such that $\Gamma \vdash t : \tau$, or determine that no such term exists.

In the simply typed lambda calculus, the type inhabitation problem is PSPACE-complete (Statman, 1979). In richer type systems, it becomes undecidable in general.

**Approaches to synthesis.**

1. **Proof search.** Treat the type as a proposition and search for a proof using tactics or automated theorem proving. This is the approach taken by Agsy (Agda's automatic proof search) and some Coq tactics (`auto`, `eauto`).

2. **Component-based synthesis.** Given a library of typed components (functions, constructors), search for a composition that has the desired type. SyPet (Feng et al., 2017) uses Petri-net-based reachability analysis to find well-typed compositions of Java methods.

3. **Refinement-type-guided synthesis.** Use refinement types to specify input-output behavior and synthesize programs that satisfy the specification. Synquid (Polikarpova and Sergey, 2019) synthesizes recursive programs with refinement types, using a combination of type-driven enumeration and SMT solving.

4. **Neural-guided synthesis.** Recent work combines neural language models with type-directed search. The language model provides a prior over likely programs, while the type system filters candidates. Copilot and similar tools use large language models for code generation, but without formal type-theoretic guarantees.

**Example 2.5 (Synthesis from types).**

Given the type:

$$\text{List}\;\alpha \to \text{List}\;\alpha \to \text{List}\;\alpha$$

and the hint that the function should interleave the two lists, a synthesis tool might produce:

```haskell
interleave [] ys = ys
interleave (x:xs) ys = x : interleave ys xs
```

by searching for a recursive definition that type-checks and satisfies the given examples or refinement.

**Theorem 2.6 (Inhabitation in System F is undecidable).** The type inhabitation problem for System F ($\lambda 2$) is undecidable (Wells, 1999). This means that fully automatic type-directed synthesis in polymorphic type systems is impossible in general.

### 2.4 Modal Type Theory

Modal logics extend classical or intuitionistic logic with modalities like "necessarily" ($\Box$) and "possibly" ($\Diamond$). Via the Curry--Howard correspondence, modal logics correspond to modal type theories, where the modalities become type constructors with specific computational interpretations.

**Definition 2.7 (Necessity modality $\Box$).** In the simplest modal type theory (S4), the type $\Box A$ represents a value of type $A$ that is available in *any* context --- it is a "portable" or "closed" value. The rules are:

$$\frac{\Delta \vdash t : A}{\Delta; \Gamma \vdash \text{box}\;t : \Box A} \quad (\Box\text{-I}) \qquad \frac{\Delta; \Gamma \vdash t : \Box A \quad \Delta, x : A; \Gamma \vdash u : B}{\Delta; \Gamma \vdash \text{let box}\;x = t\;\text{in}\;u : B} \quad (\Box\text{-E})$$

Here $\Delta$ is the *modal context* (variables available in any world) and $\Gamma$ is the *ordinary context* (variables available only in the current world).

**Applications of modal type theory.**

1. **Staged computation (MetaML, Davies and Pfenning, 2001).** The modality $\Box A$ represents a piece of code of type $A$ (a "future-stage" computation). The modal context contains variables bound at the current stage; the ordinary context contains variables bound at a later stage. This ensures that code is well-scoped across stages.

   Staged computation enables type-safe code generation: a program can construct, analyze, and optimize code fragments before executing them. This is useful for domain-specific language implementation, partial evaluation, and just-in-time compilation.

2. **Distributed systems (Murphy et al., 2004).** The modality $\Box_w A$ represents a value of type $A$ located at node $w$ in a distributed system. Modal type theory ensures that values are only accessed at the node where they reside, preventing unsafe remote access.

3. **Information-flow control (Abadi et al., 1999).** Modalities can represent security levels. A type $\Box_{\text{secret}} A$ represents secret data of type $A$; the type system ensures that secret data does not flow to public outputs.

4. **Guarded recursion (Nakano, 2000).** The modality $\triangleright A$ ("later $A$") represents a value of type $A$ that is available one step in the future. This enables productive definitions of infinite data structures (streams, processes) without requiring syntactic guardedness checks.

   $$\frac{\Gamma \vdash t : \triangleright A}{\Gamma \vdash \text{force}\;t : A} \quad (\triangleright\text{-E})$$

   is not a valid rule (it would allow extracting a value from the future). Instead, one can apply functions under $\triangleright$:

   $$\frac{\Gamma \vdash f : \triangleright(A \to B) \quad \Gamma \vdash x : \triangleright A}{\Gamma \vdash f \circledast x : \triangleright B} \quad (\triangleright\text{-App})$$

5. **Adjoint logic (Benton and Wadler, 1996; Licata and Shulman, 2016; Licata, Shulman, and Riley, 2017).** A general framework where multiple modes (corresponding to different structural rules or computational effects) are connected by modalities that form adjunctions. This subsumes linear logic, relevant logic, and many other substructural and modal systems.

**Remark 2.8 (Multimodal and fibered type theories).** Recent work by Gratzer, Kavvos, Nuyts, and Birkedal (2020) on *Multimodal Type Theory (MTT)* provides a general framework for type theories with multiple interacting modalities, parameterized by a *mode theory* (a 2-category specifying the modes and modalities). This framework unifies many of the specific modal type theories mentioned above.

**Example 2.9 (Guarded recursion in practice).** The guarded fixed point combinator has type:

$$\text{fix} : (\triangleright A \to A) \to A$$

This allows defining infinite data structures productively. For example, the stream of natural numbers:

$$\text{nats} :\equiv \text{fix}\;(\lambda s.\, (0, \text{map}\;(+1)\;s)) : \text{Stream}\;\mathbb{N}$$

where $\text{Stream}\;A \cong A \times \triangleright(\text{Stream}\;A)$. The $\triangleright$ modality ensures that the recursive reference is "guarded" --- we can only access the tail of the stream one step in the future. This is a type-theoretic replacement for syntactic guardedness checks (as in Coq's `cofix`).

The guarded recursion approach has been fruitfully combined with cubical type theory by Birkedal, Bizjak, et al. to develop *guarded cubical type theory*, which supports both homotopical reasoning and productive corecursion.

### 2.5 Formalization of Mathematics: Challenges and Methodology

Before discussing observational type theory and the broader formalization landscape, it is worth reflecting on the methodological challenges of large-scale formalization.

**The formalization gap.** There is a significant gap between informal mathematical proof (as published in journals) and formal proof (as checked by a proof assistant). Bridging this gap requires:

1. **Foundational choices.** Which type theory to use (CIC, MLTT, set theory in HOL)? Each choice affects which mathematics is natural to formalize and which is awkward.

2. **Library design.** Mathematical concepts form a vast hierarchy (monoids, groups, rings, modules, algebras, topological spaces, ...). The "diamond problem" of multiple inheritance must be solved: a topological group is both a topological space and a group. Different proof assistants handle this differently:
   - **Coq (MathComp):** Packed classes (canonical structures).
   - **Lean (Mathlib):** Type classes with instance synthesis.
   - **Agda:** Instance arguments (similar to type classes).

3. **Automation.** Without good automation, formalization is painfully slow. Key automation tools include:
   - Decision procedures for specific theories (linear arithmetic, ring equalities, Presburger arithmetic).
   - Rewriting systems (simp lemmas in Lean, autorewrite in Coq).
   - Proof search (auto, eauto in Coq; exact?, apply? in Lean).
   - SMT integration (Lean's interface with SMT solvers, Coq's SMTCoq plugin).

4. **Maintenance.** Large formal libraries must be maintained as the proof assistant evolves. Lean's Mathlib uses continuous integration and a bot system to keep the library up to date. Coq's MathComp is more conservatively maintained.

**The formalization challenge.** Buzzard, Commelin, and Massot (2020) formalized the definition of *perfectoid spaces* (a cutting-edge concept in algebraic geometry, introduced by Scholze) in Lean. The formalization required:

- Defining adic spaces, Huber rings, and the topology of perfectoid spaces.
- Over 12,000 lines of Lean code.
- Extensive use of Lean's type class inference for algebraic hierarchies.

This demonstrated that even very abstract and recent mathematics can be formalized, but at significant human effort. The challenge for the future is to reduce this effort through better automation and library design.

### 2.6 Observational Type Theory

Observational type theory (OTT), introduced by Altenkirch, McBride, and Swierstra (2007) and further developed by Pujet and Tabareau (2022), aims to combine the best features of *intensional* and *extensional* type theory.

**The problem.** In intensional type theory (MLTT, the basis of most proof assistants), propositional equality $a =_A b$ is distinct from judgmental equality $a \equiv b$. The J eliminator is the only way to use propositional equalities, and function extensionality is not provable. In extensional type theory (ETT), propositional and judgmental equality coincide: if $p : a =_A b$, then $a \equiv b$. This makes type checking undecidable (since deciding whether a propositional equality is inhabited amounts to theorem proving), but it makes extensional reasoning trivial.

**OTT's solution.** Define propositional equality type-by-type, by induction on the structure of types:

- For base types: $n =_\mathbb{N} m$ holds iff $n$ and $m$ are the same numeral (decidable).
- For function types: $f =_{A \to B} g$ iff $\forall x : A.\; f(x) =_B g(x)$ (function extensionality built in).
- For dependent pair types: $(a_1, b_1) =_{\Sigma(x:A). B(x)} (a_2, b_2)$ iff $a_1 =_A a_2$ and (transporting $b_1$ along this equality) $b_1 =_{B(a_2)} b_2$.
- For universe types: $A =_\mathcal{U} B$ iff $A$ and $B$ have the same structure (recursively defined).

**Key property.** OTT ensures:

1. Type checking remains decidable (unlike ETT).
2. Function extensionality and propositional uniqueness of identity proofs (UIP) hold by construction.
3. No axioms are needed; all equational reasoning is built into the definitional equality.

**Setoid Type Theory.** A related approach by Altenkirch (2021) defines types as *setoids* (types equipped with an equivalence relation) and ensures that all constructions respect the equivalence. This is more flexible than OTT in some respects but requires careful management of the setoid structure.

**Remark 2.10 (OTT vs. HoTT).** OTT and HoTT take opposite approaches to identity types. HoTT embraces the higher structure (types are spaces, paths are homotopies); OTT collapses it (all types are sets, identity proofs are unique). Both are valid and useful; the choice depends on the application. For program verification, OTT's simplicity is attractive. For synthetic homotopy theory, HoTT is essential.

**Remark 2.11 (XTT --- Extension Type Theory).** Sterling, Angiuli, and Gratzer (2019) developed *XTT* (eXtensional cubical Type Theory), which combines ideas from OTT and cubical type theory. XTT provides a type theory with:

- Extensional equality for types that are sets (no higher homotopy).
- Efficient normalization (the normal forms are simpler than in full cubical type theory).
- Computational univalence (inherited from the cubical foundation).

XTT can be seen as a practical compromise: it retains the computational benefits of cubical type theory while restricting attention to the 0-truncated world (sets), which is sufficient for most program verification applications.

### 2.7 Higher-Dimensional Type Theory and Synthetic Homotopy Theory

Building on the foundations of Lectures 10a and 10b, researchers are extending HoTT in several directions.

**Synthetic homotopy theory.** The program of *synthetic homotopy theory* (Brunerie, Licata, Lumsdaine, Shulman) uses HoTT as a language for homotopy theory, proving theorems about homotopy groups, fiber sequences, and spectral sequences entirely within type theory.

Key achievements:

- **$\pi_1(S^1) \cong \mathbb{Z}$**: The fundamental group of the circle (Licata and Shulman, 2013).
- **The Blakers--Massey theorem**: Connectivity of the join (Lumsdaine, Finster, Licata).
- **The Hopf fibration**: $S^1 \to S^3 \to S^2$ (Brunerie).
- **$\pi_4(S^3)$**: Brunerie (2016) computed $\pi_4(S^3) = \mathbb{Z}/2\mathbb{Z}$ in HoTT, though the formalization required novel techniques and exposed performance issues in proof assistants.

**Cohesive HoTT (Schreiber and Shulman, 2012).** Extends HoTT with modalities for *cohesion*: the ability to distinguish between discrete and continuous spaces. In cohesive HoTT, one can reason synthetically about differential geometry, gauge theory, and higher geometry.

**Directed type theory.** As mentioned in Lecture 10b, the passage from $\infty$-groupoids (symmetric paths) to $(\infty,1)$-categories (directed morphisms) is a major open challenge. Riehl and Shulman's simplicial type theory (2017) and recent work on directed univalence (Ahrens, North, and Shulman) aim to develop a type-theoretic framework for higher category theory.

### 2.7 Formalization of Mathematics

The formalization of mathematics in proof assistants has accelerated dramatically in recent years, driven by improved tools and community efforts.

**Lean Mathlib.**

Mathlib is a community-maintained library of formalized mathematics for the Lean proof assistant. As of 2025, it contains:

- Over 150,000 lemmas and theorems.
- Coverage of undergraduate and graduate mathematics: algebra (groups, rings, fields, modules), analysis (topology, measure theory, functional analysis), number theory, combinatorics, probability.
- The formalization of Fermat's Last Theorem for regular primes (Commelin et al.).
- Perfectoid spaces (Buzzard, Commelin, and Massot, 2020): a formalization of cutting-edge algebraic geometry.

**Coq Mathematical Components.**

The Mathematical Components library for Coq (Mahboubi and Tassi) provides formalized mathematics with an emphasis on finite and discrete structures:

- The Feit--Thompson (Odd Order) theorem (Gonthier et al., 2013): a monumental formalization of a 255-page proof in finite group theory.
- A mature algebra library with a distinctive "packed classes" methodology for structuring mathematical hierarchies.

**Impact on mathematics.**

Formalization is beginning to influence mathematical practice:

- **Verification of proofs**: Scholze's challenge to formalize a key lemma in condensed mathematics was completed in Lean (the "Liquid Tensor Experiment," Commelin et al., 2022).
- **Discovery of errors**: Formalization efforts have uncovered errors in published proofs (e.g., gaps found during the formalization of the Kepler conjecture by Hales et al.).
- **Education**: Formalized libraries serve as precise, machine-checkable references for definitions and theorem statements.

**The Xena Project (Buzzard).** An initiative to formalize the entire undergraduate mathematics curriculum in Lean, making formalized mathematics accessible to working mathematicians.

### 2.8 The Verification Revolution

Type theory and dependent types underpin a revolution in verified software.

**CompCert (Leroy, 2009).** A formally verified C compiler, written and verified in Coq. CompCert guarantees that the compiled machine code behaves exactly as specified by the C semantics, eliminating compiler bugs as a source of program errors. CompCert is used in safety-critical industries (aerospace, nuclear).

**seL4 (Klein et al., 2009).** A formally verified operating system microkernel, verified in Isabelle/HOL. The proof establishes that the C implementation correctly implements the abstract specification, covering functional correctness, information-flow security, and worst-case execution time.

**CertiKOS (Gu et al., 2016).** A certified OS kernel for concurrent systems, verified in Coq using layers of abstraction. CertiKOS demonstrates that full OS verification is feasible, even for concurrent, multicore systems.

**Everest and HACL\* (Microsoft Research).** Verified implementations of cryptographic protocols (TLS 1.3) and primitives (Curve25519, Poly1305, SHA-256), written in F\* and extracted to efficient C. The HACL\* library provides cryptographic implementations that are both formally verified and performance-competitive with hand-optimized C.

**Iris (Birkedal, Bizjak, Jung, Krebbers, et al., 2017).** A higher-order concurrent separation logic framework, mechanized in Coq. Iris enables the verification of fine-grained concurrent programs, including lock-free data structures, with composable specifications. It has been used to verify the RustBelt (Jung et al., 2018) formalization of Rust's type system, establishing that Rust's safety guarantees hold even in the presence of unsafe code.

### 2.9 Types in AI and Differentiable Programming

An emerging frontier is the intersection of type theory with machine learning and differentiable programming.

**Differentiable programming.**

Modern machine learning frameworks (PyTorch, JAX) implement automatic differentiation (AD), which computes derivatives of programs. From a type-theoretic perspective, AD can be understood as a program transformation that is well-typed in a suitable type system.

**Definition 2.10 (Differential type).** In a differentiable programming language, a function $f : \mathbb{R}^n \to \mathbb{R}^m$ has a derivative $Df : \mathbb{R}^n \to \mathbb{R}^{n \times m}$ (the Jacobian). A type system for differentiable programming tracks the smoothness class of functions:

$$f : C^k(\mathbb{R}^n, \mathbb{R}^m)$$

means $f$ is $k$-times continuously differentiable.

**Approaches:**

- **$\partial\lambda$-calculus** (Ehrhard and Regnier, 2003): A linear logic-based calculus with a derivative operator, where differentiation of functions corresponds to differentiation of power series.
- **$\Lambda_S$ (Smeding and Vakar, 2023)**: A type-safe language for automatic differentiation with support for higher-order functions and recursive types.
- **Typed AD in JAX/PyTorch**: Current frameworks lack formal type systems for AD. Research on typing AD (Shaikhha et al., Vakar, 2021) aims to provide guarantees about the correctness of derivatives, especially for complex transformations like gradient checkpointing and custom VJPs.

**Types for neural networks.**

Can types capture the structure of neural networks?

- *Tensor type systems*: Type systems that track the shapes (dimensions) of tensors, preventing shape mismatch errors. Libraries like `torch.jit`, TensorFlow's `tf.function`, and research systems like Dex (Paszke et al., 2021) use type-like mechanisms for tensor shape checking.
- *Dependent types for neural architectures*: In principle, dependent types can encode the architecture of a neural network in its type, ensuring that layers are composable (output dimensions match input dimensions). This is explored in Idris (Brady) and in Haskell libraries like `HLearn`.
- *Probabilistic type systems*: Languages like Anglican, Gen, and Pyro embed probabilistic models in typed programming languages. Staton et al. (2016) develop a measure-theoretic semantics for probabilistic programming languages.

### 2.10 Type Theory for Quantum Computing

Quantum computing introduces computational phenomena (superposition, entanglement, no-cloning) that require new type-theoretic tools.

**The no-cloning theorem.** Quantum states cannot be duplicated. This is naturally modeled by *linear types*: a quantum state has type $\text{Qubit}$ with multiplicity 1 (it must be used exactly once). The connection between linear types and quantum computing was recognized early by Abramsky (1996) and developed by Selinger (2004) and others.

**Quantum type systems.**

- **QWire (Paykin, Rand, and Zdancewic, 2017):** A quantum circuit language embedded in Coq, with a linear type system that enforces the no-cloning property and ensures that quantum circuits are well-formed.

- **Proto-Quipper (Ross, 2015; Rios and Selinger, 2017):** A typed quantum programming language based on linear logic, designed as a formal foundation for the Quipper quantum programming language.

- **Qunity (Voichick et al., 2023):** A recent quantum programming language with a type system that unifies quantum and classical computation, using a type system where classical types are quotients of quantum types.

**Definition 2.11 (Linear quantum type system, simplified).** Types include:

$$\tau ::= \text{Qubit} \mid \text{Bit} \mid \tau_1 \otimes \tau_2 \mid \tau_1 \multimap \tau_2 \mid !\tau$$

where $\otimes$ is the linear tensor, $\multimap$ is linear implication, and $!$ is the "of course" modality (allowing duplication, only applicable to classical data). The typing rules enforce:

- $\text{Qubit}$ variables are used exactly once (no cloning, no discarding).
- $\text{Bit}$ variables can be freely duplicated and discarded (classical data).
- Unitary operations are typed as linear functions: $U : \text{Qubit}^{\otimes n} \multimap \text{Qubit}^{\otimes n}$.
- Measurement is typed as $\text{meas} : \text{Qubit} \multimap \text{Bit}$ (consumes a qubit, produces a classical bit).

### 2.11 Open Problems in Type Theory

We conclude with a selection of open problems that represent active research frontiers.

**Problem 2.12 (Decidability of type checking for HoTT).** Type checking for HoTT with univalence (as an axiom) is believed to be decidable, but a complete proof has not been given. Cubical type theory provides decidable type checking for a system that validates univalence, but the relationship between the two systems is subtle.

**Problem 2.13 (General higher inductive types).** While specific HITs are well-understood, a general schema for defining arbitrary HITs --- with constructors at arbitrary dimensions, satisfying arbitrary equations --- and proving that they have the correct universal properties is still open. The work of Dybjer and Mohamadisinaki (2024) on "finitary higher inductive types" is a step, but the general case remains.

**Problem 2.14 (Homotopy canonicity).** Does HoTT (with the univalence axiom) satisfy canonicity: does every closed term of type $\mathbb{N}$ reduce to a numeral? Shulman (2015) proved a *homotopy canonicity* result (every closed term of type $\mathbb{N}$ is *propositionally* equal to a numeral), but full canonicity (judgmental reduction) is open for MLTT + univalence.

**Problem 2.15 (Directed univalence).** In a directed type theory (where paths are morphisms, not necessarily invertible), what is the correct formulation of univalence? Informally, directed univalence should say that the type of morphisms between types is equivalent to the type of functors between them, but making this precise is challenging.

**Problem 2.16 (Higher-dimensional rewriting).** Higher-dimensional type theory involves equalities between equalities between equalities, ad infinitum. Managing this tower of coherences is computationally expensive. Can we develop efficient algorithms for higher-dimensional rewriting that make proof assistants for HoTT practical for large-scale formalization?

**Problem 2.17 (Gradual dependent types).** As discussed in Lecture 10c, combining gradual typing with dependent types raises fundamental questions. Can we define a gradually typed version of CIC that satisfies the gradual guarantee, supports practical proof development, and has a sensible runtime semantics for partially verified programs?

**Problem 2.18 (Effect handlers and types).** Algebraic effects and handlers (Module 09) provide a modular approach to computational effects, but the interaction between effect handlers and advanced type features (polymorphism, subtyping, dependent types) is not fully understood. Can we design a type system that smoothly integrates all of these?

**Problem 2.19 (Machine learning and type theory).** Can type-theoretic methods help make machine learning systems more reliable? Specific questions include:
- Can types prevent shape errors in tensor computations?
- Can dependent types express and enforce safety constraints on neural network architectures?
- Can differentiable programming be given a fully satisfactory denotational semantics in a cartesian closed differential category?

**Problem 2.20 (Type-theoretic foundations and set-theoretic foundations).** What is the precise relationship between type-theoretic foundations (HoTT, cubical type theory) and set-theoretic foundations (ZFC, ETCS)? Can results be systematically translated between the two? Shulman's work on comparing material and structural set theory provides some answers, but many questions remain.

### 2.12 The Relationship Between Type-Theoretic and Set-Theoretic Foundations

The relationship between type theory and set theory as foundations for mathematics is a deep and ongoing question.

**Material vs. structural set theory.** Classical set theory (ZFC) is *material*: sets have intrinsic "membership structure," and equality of sets is extensional (two sets are equal iff they have the same elements). Type theory is *structural*: objects are characterized by their relationships (morphisms) rather than their internal constitution.

Shulman (2018) formalized this distinction and showed that:

1. Every model of ZFC gives rise to a model of MLTT (via setoids or the local universe model).
2. Every model of MLTT + univalence gives rise to a model of ETCS (Elementary Theory of the Category of Sets), a structural set theory.
3. The two foundations are "equiconsistent" in a precise sense: neither is strictly stronger than the other (modulo large cardinal axioms).

**Practical implications.** For the working mathematician:

- Type theory naturally handles *algebraic* and *category-theoretic* mathematics (where structures are defined up to isomorphism).
- Set theory naturally handles *combinatorial* and *point-set topological* mathematics (where membership and subset relations are primary).
- HoTT with univalence bridges the gap by making "up to isomorphism" a formal identity.

**The univalent foundations program.** Voevodsky's vision was that mathematics should be formalized in univalent foundations (HoTT), where the basic objects are homotopy types rather than sets. This program has been partially realized in the Unimath library (Coq), the HoTT library (Coq), and the 1Lab (Cubical Agda).

### 2.13 The Social Impact of Type Theory

Type theory is not only a theoretical discipline; it shapes the way millions of programmers write software.

**Language design.** Type-theoretic concepts have permeated mainstream language design:

- **Algebraic data types and pattern matching** (ML, Haskell, Rust, Swift, Kotlin): direct applications of sum types and eliminators.
- **Traits and type classes** (Haskell, Rust, Scala): coherent overloading, inspired by Wadler and Blott (1989).
- **Ownership and borrowing** (Rust): affine types ensuring memory safety without garbage collection (Module 09).
- **Nullable types and option types** (Kotlin, Swift, Rust): sum types replacing null pointers, inspired by ML's `option` type.
- **Async/await** (C\#, JavaScript, Python, Rust): computational effects managed by monadic (or effect-handler-based) type systems.

**Industry adoption.** Type-theoretic verification has moved from academia to industry:

- Amazon uses TLA+ (a formal specification language) to verify distributed system designs (Newcombe et al., 2015).
- Meta uses the Infer static analyzer, based on separation logic, to find bugs in Android and iOS code.
- Intel and ARM use formal verification for hardware design.
- The Ethereum community uses formal verification tools (Certora, Runtime Verification) to verify smart contracts.

**Education.** Type theory provides a unifying conceptual framework for programming language courses. The progression from untyped systems to simple types to polymorphism to dependent types --- the structure of this course --- mirrors the intellectual development of the field and provides students with a deep understanding of the principles underlying all programming languages.

---

## 3. Worked Examples

### Example 3.1: Refinement Types in Practice

Consider verifying that a binary search function only accesses valid array indices:

```fstar
val binary_search : #a:eqtype -> v:vector a -> key:a
  -> Pure (option (i:nat{i < length v}))
         (requires True)
         (ensures (fun r -> match r with
                          | Some i -> index v i = key
                          | None   -> forall j. j < length v ==> index v j <> key))
let rec binary_search #a v key = ...
```

The type of `binary_search` in F\* specifies: (1) the return index, if any, is within bounds; (2) if an index is returned, the element at that index equals the key; (3) if no index is returned, the key does not appear in the vector. The SMT solver verifies these properties automatically during type checking.

### Example 3.2: Modal Types for Staged Computation

In a two-stage MetaML-like language:

```
-- Stage 0 (compile time): generate code for a power function
power : Int -> <Int -> Int>
power 0 = <\x -> 1>
power n = <\x -> x * ~(power (n-1)) x>
```

The type `<Int -> Int>` is $\Box(\text{Int} \to \text{Int})$: a piece of code (available at the next stage) that computes a function from integers to integers. The splice operator `~` eliminates $\Box$, inserting the generated code. The type system ensures that stage-0 variables are not used inside brackets (at stage 1) and that stage-1 variables are not used outside brackets (at stage 0).

Evaluating `power 3` at stage 0 produces the code:

```
<\x -> x * x * x * 1>
```

which can then be compiled to efficient machine code, free of the overhead of a loop or recursive calls.

### Example 3.3: Linear Types for Quantum Computing

```
-- A quantum teleportation circuit (in QWire-like syntax)
teleport : Qubit -o Qubit -o Qubit
teleport q alice = let (a, b) = bell00 ()         -- create Bell pair
                   in let (q', a') = cnot (q, a)  -- entangle q with a
                   in let q'' = hadamard q'        -- apply Hadamard
                   in let (m1, m2) = (meas q'', meas a')  -- measure
                   in correct m1 m2 b              -- apply corrections
```

The linear type system ensures that each qubit is used exactly once: the Bell pair is created, entangled, measured, and the results are used to correct the output qubit. Any attempt to duplicate a qubit (e.g., using `q` twice) would be a type error.

---

## 4. Exercises

**Exercise 10d.1.** Compare and contrast the approaches to dependent types in Idris, Lean, and dependent Haskell. For each, describe: (a) whether the language is total or partial; (b) how type checking handles non-termination; (c) what level of type inference is supported.

**Exercise 10d.2.** Define refinement types for the following operations and state the verification conditions that an SMT solver would need to discharge: (a) `tail : {xs : List a | length xs > 0} -> List a`; (b) `lookup : Map k v -> k -> {v | k in dom(m)}`; (c) `sort : List Int -> {ys : List Int | sorted ys /\ permutation xs ys}`.

**Exercise 10d.3.** Formalize the typing rules for a simple two-stage MetaML-like language with staging annotations `<e>` (bracket) and `~e` (splice). State and prove type preservation for the staging reduction (splice elimination).

**Exercise 10d.4.** In the linear quantum type system of Section 2.10, type-check the following circuit: (a) Apply a Hadamard gate to a qubit, then measure it. (b) Create a Bell pair (two entangled qubits). (c) Attempt to clone a qubit (show that this is a type error).

**Exercise 10d.5.** Read the abstract and introduction of one of the following papers and write a one-page summary: (a) Gonthier et al., "A Machine-Checked Proof of the Odd Order Theorem" (2013); (b) Jung et al., "RustBelt: Securing the Foundations of the Rust Programming Language" (2018); (c) Brunerie, "On the homotopy groups of spheres in homotopy type theory" (2016).

**Exercise 10d.6.** The Lean 4 proof assistant uses *monadic programming* for effects (IO, State, etc.) while also supporting dependent types and theorem proving. Explain how Lean separates "computational" code (which may have effects) from "proof" code (which must be pure and total). What is the role of the `IO` monad and the `@[reducible]` attribute in this separation?

**Exercise 10d.7 (Challenging).** Sketch a design for a type system that combines dependent types, linear types, and algebraic effects. What are the key challenges? How would you handle the interaction between linear variables and effect handlers (e.g., can an effect handler duplicate a linear resource)?

**Exercise 10d.8 (Open-ended).** The Curry--Howard correspondence maps propositions to types and proofs to programs. But current machine learning models (neural networks) learn functions without constructing explicit proofs. Discuss: Could a type system for neural networks provide any of the guarantees that dependent types provide for ordinary programs? What would a "type-safe neural network architecture" look like? What fundamental limitations (undecidability, approximation) would such a system face?

---

## Summary

- **Dependent types** are being adopted in mainstream languages (Idris, Lean, Haskell) with careful tradeoffs between expressiveness, decidability, and inference.
- **Refinement types** (Liquid Haskell, F\*) combine types with logical predicates and SMT-based verification, providing practical automated verification.
- **Type-directed synthesis** exploits the Curry--Howard correspondence to generate programs from specifications, with applications ranging from proof search to component-based synthesis.
- **Modal type theories** provide type-theoretic foundations for staged computation, distributed systems, information-flow control, and guarded recursion.
- **Observational type theory** reconciles extensional and intensional equality, providing function extensionality and UIP without sacrificing decidable type checking.
- **Formalization of mathematics** (Lean Mathlib, Coq MathComp) is reaching a scale where it impacts mathematical practice, enabling verification of major theorems and discovery of proof gaps.
- **The verification revolution** (CompCert, seL4, CertiKOS, HACL\*) demonstrates that formal verification of real-world software is feasible and valuable.
- **Emerging frontiers** include types for differentiable programming, quantum computing, and machine learning, as well as deep open problems in higher-dimensional type theory, gradual dependent types, and the foundations of mathematics.
- Type theory has had a profound social impact, shaping the design of programming languages used by millions and driving the adoption of formal methods in industry.

---

## Further Reading

1. **Brady, E.** *Type-Driven Development with Idris.* Manning, 2017. And: "Idris 2: Quantitative Type Theory in Practice." *ECOOP*, 2021.

2. **Moura, L. de and Ullrich, S.** "The Lean 4 Theorem Prover and Programming Language." *CADE*, 2021.

3. **Vazou, N., Seidel, E.L., Jhala, R., Vytiniotis, D., and Peyton Jones, S.** "Refinement Types for Haskell." *ICFP*, 2014.

4. **Swamy, N. et al.** "Dependent Types and Multi-Monadic Effects in F\*." *POPL*, 2016.

5. **Garcia, R., Clark, A.M., and Tanter, E.** "Abstracting Gradual Typing." *POPL*, 2016.

6. **Altenkirch, T., McBride, C., and Swierstra, W.** "Observational Equality, Now!" *PLPV*, 2007.

7. **Pujet, L. and Tabareau, N.** "Observational Equality: Now For Good." *POPL*, 2022.

8. **Gonthier, G. et al.** "A Machine-Checked Proof of the Odd Order Theorem." *ITP*, 2013.

9. **Leroy, X.** "A Formally Verified Compiler Back-End." *Journal of Automated Reasoning* 43(4), 2009.

10. **Jung, R., Jourdan, J.-H., Krebbers, R., and Dreyer, D.** "RustBelt: Securing the Foundations of the Rust Programming Language." *POPL*, 2018.

11. **Paykin, J., Rand, R., and Zdancewic, S.** "QWIRE: A Core Language for Quantum Circuits." *POPL*, 2017.

12. **Davies, R. and Pfenning, F.** "A Modal Analysis of Staged Computation." *Journal of the ACM* 48(3), 2001.

13. **Polikarpova, N. and Sergey, I.** "Structuring the Synthesis of Heap-Manipulating Programs." *POPL*, 2019.

14. **Gratzer, D., Kavvos, G.A., Nuyts, A., and Birkedal, L.** "Multimodal Dependent Type Theory." *LICS*, 2020.

15. **Riehl, E. and Shulman, M.** "A Type Theory for Synthetic $\infty$-Categories." *Higher Structures* 1(1), 2017.

16. **Brunerie, G.** "On the homotopy groups of spheres in homotopy type theory." Ph.D. thesis, Universit\'e de Nice, 2016.

17. **Newcombe, C. et al.** "How Amazon Web Services Uses Formal Methods." *Communications of the ACM* 58(4), 2015.
