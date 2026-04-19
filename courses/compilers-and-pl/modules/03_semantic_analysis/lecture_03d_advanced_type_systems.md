# Lecture 03d: Advanced Type Systems

## 1. Introduction

The Hindley-Milner type system, while remarkably expressive, has limitations. This lecture surveys advanced type system features that extend HM in various directions: richer polymorphism (System F), types that depend on values (dependent types), types that track resource usage (linear types), types that describe effects, gradual typing, and refinement types. Each extension addresses a class of program properties that simpler systems cannot express.

---

## 2. System F: The Polymorphic Lambda Calculus

### 2.1 Motivation

In HM, polymorphism is restricted to let-bindings. System F (independently discovered by Girard (1972) in logic and Reynolds (1974) in programming languages) allows **first-class polymorphism**: type abstractions and type applications are explicit terms.

### 2.2 Syntax

$$
\begin{aligned}
\tau &::= \alpha \mid \tau_1 \to \tau_2 \mid \forall \alpha.\; \tau \\
e &::= x \mid \lambda x:\tau.\; e \mid e_1\; e_2 \mid \Lambda \alpha.\; e \mid e\;[\tau]
\end{aligned}
$$

- $\Lambda \alpha.\; e$: **type abstraction** (abstracts over a type variable)
- $e\;[\tau]$: **type application** (instantiates a type abstraction)

### 2.3 Typing Rules

**Type Abstraction:**

$$\frac{\Gamma \vdash e : \tau \quad \alpha \notin \text{FV}(\Gamma)}{\Gamma \vdash \Lambda \alpha.\; e : \forall \alpha.\; \tau} \quad (\text{T-TAbs})$$

**Type Application:**

$$\frac{\Gamma \vdash e : \forall \alpha.\; \tau}{\Gamma \vdash e\;[\sigma] : [\alpha \mapsto \sigma]\tau} \quad (\text{T-TApp})$$

**Example:** The polymorphic identity function:

$$\texttt{id} = \Lambda \alpha.\; \lambda x:\alpha.\; x : \forall \alpha.\; \alpha \to \alpha$$

Usage: $\texttt{id}\;[\texttt{int}]\; 42 \rightsquigarrow (\lambda x:\texttt{int}.\; x)\; 42 \rightsquigarrow 42$.

### 2.4 Expressiveness: Church Encodings in System F

System F can encode many data types without built-in constructs:

**Booleans:**

$$\texttt{Bool} = \forall \alpha.\; \alpha \to \alpha \to \alpha$$
$$\texttt{true} = \Lambda \alpha.\; \lambda x:\alpha.\; \lambda y:\alpha.\; x$$
$$\texttt{false} = \Lambda \alpha.\; \lambda x:\alpha.\; \lambda y:\alpha.\; y$$

**Natural numbers (Church numerals):**

$$\texttt{Nat} = \forall \alpha.\; (\alpha \to \alpha) \to \alpha \to \alpha$$
$$\overline{n} = \Lambda \alpha.\; \lambda f:\alpha \to \alpha.\; \lambda z:\alpha.\; f^n(z)$$

**Existential types:**

$$\exists \alpha.\; \tau \triangleq \forall \beta.\; (\forall \alpha.\; \tau \to \beta) \to \beta$$

Existentials provide data abstraction: the implementation type $\alpha$ is hidden from the client.

### 2.5 Properties

**Theorem 2.1 (Strong Normalization).** Every well-typed term in System F is strongly normalizing: all reduction sequences terminate.

*Proof sketch.* By Girard's proof using *reducibility candidates* (also called logical relations). Define, for each type $\tau$, a set $[\![ \tau ]\!]$ of "reducible" terms. Show:
1. Every reducible term is strongly normalizing.
2. Every well-typed term is reducible (by induction on the typing derivation, with the $\forall$ case using parametricity over all candidate interpretations).

The full proof is technical; see Girard, Lafont & Taylor (1989). $\square$

**Corollary.** System F is not Turing-complete: it cannot express all computable functions.

**Theorem 2.2 (Wells, 1999).** Type checking (and type inference) for System F is undecidable.

This is why practical languages (Haskell, ML) use restricted forms of polymorphism or require annotations.

### 2.6 System $F_\omega$ and the Lambda Cube

System $F_\omega$ adds **type operators** (functions from types to types):

$$\kappa ::= * \mid \kappa_1 \to \kappa_2$$

where $*$ is the kind of proper types and $\kappa_1 \to \kappa_2$ is the kind of type-level functions.

The **Lambda Cube** (Barendregt, 1991) classifies eight type systems along three axes:
1. Terms depending on terms (ordinary functions): $\lambda\!\to$
2. Terms depending on types (polymorphism): System F
3. Types depending on types (type operators): $\lambda\omega$
4. Types depending on terms (dependent types): $\lambda P$

The most expressive corner is the **Calculus of Constructions** (CoC), combining all three.

---

## 3. Dependent Types

### 3.1 Motivation

Dependent types allow types to depend on *values*. This enables types to express precise specifications:

$$\text{Vec}(n, \alpha) \quad \text{-- a vector of exactly } n \text{ elements of type } \alpha$$

The type of `append` becomes:

$$\texttt{append} : \forall \alpha.\; \forall m\, n : \texttt{Nat}.\; \text{Vec}(m, \alpha) \to \text{Vec}(n, \alpha) \to \text{Vec}(m + n, \alpha)$$

### 3.2 The Dependent Function Type ($\Pi$-type)

The **dependent function type** $\Pi x:A.\; B(x)$ generalizes $A \to B$: the return type $B$ may depend on the argument value $x$.

$$\frac{\Gamma \vdash A : \text{Type} \quad \Gamma, x:A \vdash B : \text{Type}}{\Gamma \vdash \Pi x:A.\; B : \text{Type}} \quad (\text{K-Pi})$$

$$\frac{\Gamma, x:A \vdash e : B}{\Gamma \vdash \lambda x:A.\; e : \Pi x:A.\; B} \quad (\text{T-Lam-Dep})$$

$$\frac{\Gamma \vdash f : \Pi x:A.\; B \quad \Gamma \vdash a : A}{\Gamma \vdash f\; a : [x \mapsto a]B} \quad (\text{T-App-Dep})$$

When $B$ does not depend on $x$, $\Pi x:A.\; B$ degenerates to $A \to B$.

### 3.3 The Dependent Pair Type ($\Sigma$-type)

$$\Sigma x:A.\; B(x) \quad \text{-- a pair } (a, b) \text{ where } a : A \text{ and } b : B(a)$$

This generalizes product types and existential types.

### 3.4 Type Checking with Dependent Types

Type checking dependent types requires **definitional equality** of terms at the type level, which involves evaluating expressions during type checking.

**Key challenge:** Decidability of type checking depends on decidability of the definitional equality. For a Turing-complete term language, this is undecidable in general. Practical systems (Coq, Agda, Lean, Idris) ensure decidability by:
- Requiring all functions to be total (terminating)
- Using a restricted computation model at the type level

### 3.5 Practical Systems

| System | Based On | Key Features |
|--------|----------|--------------|
| Coq | Calculus of Inductive Constructions | Proof assistant, extraction to OCaml |
| Agda | Martin-Lof Type Theory | Dependently typed programming |
| Idris | Quantitative Type Theory | General-purpose with dependent types |
| Lean 4 | CIC variant | Metaprogramming, tactic framework |
| F\* | Refinement + dependent types | Verification of effectful programs |

---

## 4. Linear and Affine Types

### 4.1 Motivation

Standard type systems allow values to be used any number of times: zero (discarded), once, or many (shared/aliased). **Substructural type systems** restrict these structural rules of the sequent calculus:

| Structural Rule | What it permits | If absent |
|----------------|-----------------|-----------|
| Weakening | Discarding unused values | *Relevant* types |
| Contraction | Duplicating values | *Affine* / *Linear* types |
| Exchange | Reordering assumptions | *Ordered* types |

- **Linear types**: Each value must be used *exactly once* (no weakening, no contraction).
- **Affine types**: Each value must be used *at most once* (weakening allowed, no contraction).

### 4.2 Linear Logic and Linear Types

Girard's linear logic (1987) provides the logical foundation. The linear function type $A \multimap B$ consumes its argument exactly once.

**Linear typing rules:**

$$\frac{x : A \in \Gamma \quad \Gamma = \{x : A\}}{\Gamma \vdash x : A} \quad (\text{T-Var-Lin})$$

The context $\Gamma$ is treated as a *multiset*, and using a variable removes it:

$$\frac{\Gamma_1 \vdash e_1 : A \multimap B \quad \Gamma_2 \vdash e_2 : A \quad \Gamma_1 \cap \Gamma_2 = \emptyset}{\Gamma_1 \cup \Gamma_2 \vdash e_1\; e_2 : B} \quad (\text{T-App-Lin})$$

The **context split** $\Gamma = \Gamma_1 \cup \Gamma_2$ with $\Gamma_1 \cap \Gamma_2 = \emptyset$ ensures each linear resource is used in exactly one subexpression.

### 4.3 Rust's Ownership Model

Rust's type system is based on **affine types** with extensions:

1. **Ownership:** Each value has exactly one owner. When ownership is transferred (**moved**), the original binding becomes invalid.
2. **Borrowing:** References allow temporary access without ownership transfer.
   - `&T`: shared (immutable) reference, many allowed simultaneously.
   - `&mut T`: exclusive (mutable) reference, at most one at a time.
3. **Lifetimes:** Region-based type parameters that track how long references are valid.

**Formal model (simplified):**

$$\frac{\Gamma, x : \tau \vdash e : \sigma \quad x \notin \text{FV}(e)}{\Gamma \vdash \texttt{let}\; x = v\; \texttt{in}\; e : \sigma} \quad (\text{T-Drop: affine weakening})$$

$$\frac{\Gamma_1 \vdash e_1 : \tau \quad \Gamma_2, x : \tau \vdash e_2 : \sigma \quad \Gamma_1 \cap \Gamma_2 = \emptyset}{\Gamma_1 \cup \Gamma_2 \vdash \texttt{let}\; x = e_1\; \texttt{in}\; e_2 : \sigma} \quad (\text{T-Move})$$

The **borrow checker** statically enforces:

$$\text{At any program point: } (\text{one } \texttt{\&mut T}) \oplus (\text{any number of } \texttt{\&T}) \text{, never both.}$$

### 4.4 Benefits of Linearity

- **Memory safety without GC:** Deterministic deallocation when ownership expires.
- **Data race freedom:** The borrow checker prevents concurrent mutable access.
- **Protocol enforcement:** Linear types can encode session types for communication protocols.
- **Resource management:** File handles, network sockets, etc., are used exactly once (opened and closed).

---

## 5. Effect Systems

### 5.1 Motivation

Standard type systems describe *what* a computation produces but not *how* it computes (its side effects). **Effect systems** augment types with information about computational effects.

### 5.2 Formal Framework

A typing judgment with effects has the form:

$$\Gamma \vdash e : \tau\; !\; \varepsilon$$

where $\varepsilon$ is a set of effects. Common effects include:
- $\texttt{IO}$: performs I/O
- $\texttt{State}$: reads/writes mutable state
- $\texttt{Exn}$: may raise an exception
- $\texttt{Div}$: may diverge (non-termination)
- $\texttt{Alloc}(\rho)$: allocates in region $\rho$

**Typing rules:**

$$\frac{}{\Gamma \vdash n : \texttt{int}\; !\; \emptyset} \quad (\text{T-Pure})$$

$$\frac{\Gamma \vdash e_1 : \tau_1 \xrightarrow{\varepsilon} \tau_2 \quad \Gamma \vdash e_2 : \tau_1\; !\; \varepsilon'}{\Gamma \vdash e_1\; e_2 : \tau_2\; !\; \varepsilon \cup \varepsilon'} \quad (\text{T-App-Eff})$$

**Effect subsumption:**

$$\frac{\Gamma \vdash e : \tau\; !\; \varepsilon \quad \varepsilon \subseteq \varepsilon'}{\Gamma \vdash e : \tau\; !\; \varepsilon'} \quad (\text{T-Sub-Eff})$$

### 5.3 Effect Handlers (Algebraic Effects)

**Algebraic effects** (Plotkin & Power, 2003; Plotkin & Pretnar, 2009) model effects as operations that can be intercepted by handlers:

```
effect State {
    get : unit -> int
    put : int -> unit
}

let stateful_comp () =
    let x = perform (get ()) in
    perform (put (x + 1));
    perform (get ())

let run_state init comp =
    handle (comp ()) with
    | return v -> fun s -> v
    | effect (get ()) k -> fun s -> (continue k s) s
    | effect (put s') k -> fun _ -> (continue k ()) s'
```

Languages with algebraic effects: Eff, Koka, OCaml 5.x (with domains), Unison.

### 5.4 Monads as an Alternative

Haskell uses **monads** to track effects in the type system:

$$\texttt{IO}\; \alpha \quad \text{-- a computation that may perform I/O and returns } \alpha$$

The monadic approach encodes effects in the return type rather than as a separate annotation. The monad laws ensure compositionality:

$$
\begin{aligned}
\texttt{return}\; a \mathbin{>\!\!>\!\!=} f &= f\; a \quad &\text{(left identity)} \\
m \mathbin{>\!\!>\!\!=} \texttt{return} &= m \quad &\text{(right identity)} \\
(m \mathbin{>\!\!>\!\!=} f) \mathbin{>\!\!>\!\!=} g &= m \mathbin{>\!\!>\!\!=} (\lambda x.\; f\; x \mathbin{>\!\!>\!\!=} g) \quad &\text{(associativity)}
\end{aligned}
$$

**Comparison:**

| Aspect | Effect Systems | Monads |
|--------|---------------|--------|
| Composition | Natural (set union) | Monad transformers (complex) |
| Inference | Often automatic | Requires explicit types |
| Handlers | User-definable | Fixed interpretation |
| Language support | Koka, Eff, OCaml 5 | Haskell, Scala |

---

## 6. Gradual Typing

### 6.1 Motivation

**Gradual typing** (Siek & Taha, 2006) allows mixing statically typed and dynamically typed code within a single program. The special type $?$ (or `Dynamic`, `Any`) represents an unknown type.

### 6.2 Consistency Relation

Gradual typing replaces type equality with **consistency** ($\sim$):

$$\frac{}{\tau \sim \tau} \quad \frac{}{\tau \sim\; ?} \quad \frac{}{? \;\sim \tau}$$

$$\frac{\tau_1 \sim \sigma_1 \quad \tau_2 \sim \sigma_2}{\tau_1 \to \tau_2 \sim \sigma_1 \to \sigma_2}$$

Consistency is *reflexive* and *symmetric* but **not transitive**. (If it were transitive, $\texttt{int} \sim\; ? \sim \texttt{bool}$ would imply $\texttt{int} \sim \texttt{bool}$, defeating the purpose.)

### 6.3 Runtime Casts

At the boundary between typed and untyped code, the compiler inserts **casts** (runtime checks):

$$\frac{\Gamma \vdash e : \tau_1 \quad \tau_1 \sim \tau_2}{\Gamma \vdash \langle \tau_2 \Leftarrow \tau_1 \rangle\; e : \tau_2} \quad (\text{T-Cast})$$

Casts may fail at runtime, producing a **blame** error that identifies the source of the type mismatch.

### 6.4 The Gradual Guarantee

A well-designed gradual type system satisfies the **gradual guarantee** (Siek et al., 2015):

1. **Static guarantee:** Adding type annotations to a well-typed program does not introduce static type errors (as long as annotations are consistent).
2. **Dynamic guarantee:** Adding type annotations does not change the behavior of a program (beyond potentially causing blame errors sooner).

### 6.5 Practical Systems

- **TypeScript:** Structural gradual typing with `any`.
- **Python (mypy):** Gradual typing with `Any` and PEP 484 annotations.
- **Racket (Typed Racket):** Sound gradual typing with contracts at boundaries.
- **C\#:** `dynamic` keyword for dynamic dispatch.

---

## 7. Refinement Types

### 7.1 Definition

**Refinement types** extend base types with logical predicates:

$$\{x : \tau \mid \phi(x)\}$$

denotes the subset of values of type $\tau$ that satisfy the predicate $\phi$.

**Examples:**

$$\{x : \texttt{int} \mid x > 0\} \quad \text{(positive integers)}$$
$$\{x : \texttt{int} \mid x \geq 0 \wedge x < n\} \quad \text{(array indices)}$$

### 7.2 Subtyping with Refinements

$$\frac{\forall x.\; \phi_1(x) \Rightarrow \phi_2(x)}{\{x : \tau \mid \phi_1(x)\} <: \{x : \tau \mid \phi_2(x)\}} \quad (\text{S-Refine})$$

Subtyping reduces to **logical implication**, which is discharged by an SMT solver.

### 7.3 Typing Rules

**Function types with refinements:**

$$\frac{\Gamma, x : \{x : \tau_1 \mid \phi_1\} \vdash e : \{y : \tau_2 \mid \phi_2\}}{\Gamma \vdash \lambda x.\; e : (x : \{x : \tau_1 \mid \phi_1\}) \to \{y : \tau_2 \mid \phi_2\}} \quad (\text{T-Fun-Ref})$$

**Example:** Safe division:

$$\texttt{div} : \texttt{int} \to \{d : \texttt{int} \mid d \neq 0\} \to \texttt{int}$$

### 7.4 Liquid Types

**Liquid types** (Rondon, Kawaguchi, Jhala, 2008) restrict refinement predicates to a decidable fragment: conjunctions of *qualifiers* drawn from a finite, user-specified set.

$$\phi ::= q_1 \wedge q_2 \wedge \cdots \wedge q_k \quad \text{where } q_i \in Q$$

This ensures:
1. Type inference is decidable (reduces to predicate abstraction + fixpoint computation).
2. SMT queries are in decidable theories (linear arithmetic, uninterpreted functions).

**Liquid Haskell** applies this to Haskell, enabling verification of:
- Array bounds safety
- Termination
- Functional correctness (e.g., sorting produces a permutation)

### 7.5 Connection to Dependent Types

Refinement types can be viewed as a restricted form of dependent types where:
- The "dependency" is limited to predicates in a decidable logic.
- Type checking reduces to SMT solving rather than arbitrary term evaluation.

$$\{x : \texttt{int} \mid x > 0\} \quad \approx \quad \Sigma x : \texttt{int}.\; \text{Proof}(x > 0) \quad \text{(in dependent type theory)}$$

The advantage of refinement types is automation: the SMT solver handles proofs that would require manual effort in a fully dependent system.

---

## 8. Other Advanced Features

### 8.1 GADTs (Generalized Algebraic Data Types)

GADTs allow constructors to produce different type instantiations:

```haskell
data Expr a where
    Lit  :: Int -> Expr Int
    Bool :: Bool -> Expr Bool
    Add  :: Expr Int -> Expr Int -> Expr Int
    If   :: Expr Bool -> Expr a -> Expr a -> Expr a
```

The type checker can use constructor information to refine types in pattern matching:

```haskell
eval :: Expr a -> a
eval (Lit n)      = n          -- here a ~ Int
eval (Bool b)     = b          -- here a ~ Bool
eval (Add e1 e2)  = eval e1 + eval e2
eval (If c t e)   = if eval c then eval t else eval e
```

GADTs require **local type equalities** and **type refinement** in pattern matches, extending HM inference significantly.

### 8.2 Type-Level Computation

Some systems allow computation at the type level:

- **Type families** (Haskell): Functions from types to types.
- **Associated types:** Type families tied to type classes.
- **Type-level natural numbers:** Enabling compile-time dimensional analysis.

### 8.3 Row Polymorphism

Row polymorphism (Wand, 1987) provides polymorphism over record field sets:

$$f : \forall \rho.\; \{x : \texttt{int} \mid \rho\} \to \texttt{int}$$

This function accepts any record with at least an `x : int` field, regardless of other fields. Used in OCaml's object system and PureScript.

---

## 9. Comparison of Type System Features

| Feature | Expressiveness | Decidability | Inference | Practical Use |
|---------|---------------|--------------|-----------|---------------|
| Simply typed | Low | Yes | Yes (linear) | Teaching |
| HM | Moderate | Yes | Yes (DEXPTIME) | ML, OCaml, Haskell core |
| System F | High | Yes (checking) | No | GHC Core, some PL research |
| Dependent | Very high | Conditional (totality) | Limited | Coq, Agda, Idris, Lean |
| Linear/Affine | Moderate + resources | Yes | Partial | Rust, Linear Haskell |
| Refinement | High + SMT | Yes (liquid) | Yes (liquid) | Liquid Haskell, F\* |
| Gradual | Flexible | Yes | Partial | TypeScript, Python |

---

## 10. Summary

| System | Key Contribution | Limitation |
|--------|-----------------|------------|
| System F | First-class polymorphism | Undecidable inference |
| Dependent types | Types express full specifications | Requires totality; complex |
| Linear types | Resource tracking | Annotation burden |
| Effect systems | Track computational effects | Effect polymorphism is complex |
| Gradual typing | Mix static and dynamic | Runtime overhead at boundaries |
| Refinement types | SMT-verified properties | Limited to decidable logic fragments |

---

## References

1. Girard, J.-Y. (1972). *Interpretation fonctionnelle et elimination des coupures de l'arithmetique d'ordre superieur*. PhD thesis, Universite Paris VII.
2. Reynolds, J.C. (1974). "Towards a Theory of Type Structure." *Colloque sur la Programmation*, LNCS 19, 408--425.
3. Wadler, P. (1990). "Linear Types Can Change the World!" *Programming Concepts and Methods*, 561--581.
4. Girard, J.-Y. (1987). "Linear Logic." *Theoretical Computer Science*, 50(1), 1--101.
5. Siek, J.G. & Taha, W. (2006). "Gradual Typing for Functional Languages." *Scheme Workshop*, 81--92.
6. Siek, J.G., Vitousek, M.M., Cimini, M., & Boyland, J.T. (2015). "Refined Criteria for Gradual Typing." *SNAPL*, 274--293.
7. Rondon, P.M., Kawaguchi, M., & Jhala, R. (2008). "Liquid Types." *PLDI*, 159--169.
8. Plotkin, G.D. & Pretnar, M. (2009). "Handlers of Algebraic Effects." *ESOP*, LNCS 5502, 80--94.
9. Barendregt, H. (1991). "Introduction to Generalized Type Systems." *Journal of Functional Programming*, 1(2), 125--154.
10. Wand, M. (1987). "Complete Type Inference for Simple Objects." *LICS*, 37--44.
11. Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press. Chapters 23--32.
