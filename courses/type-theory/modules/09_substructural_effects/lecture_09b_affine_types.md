---
title: "Lecture 09b: Affine Types and Ownership"
tags:
  - type-theory
  - substructural
  - lecture
---
# Lecture 09b: Affine Types and Ownership

> **Module 09 --- Substructural & Effect Types (Weeks 17--18)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define affine and relevant type systems by specifying which structural rules are retained and which are dropped.
2. State the substructural hierarchy (unrestricted, affine, linear, ordered) and explain the inclusion relationships between the corresponding logics.
3. Formulate the typing rules for the affine lambda calculus, identifying the differences from the linear lambda calculus.
4. Explain Rust's ownership model as an instance of affine typing, relating ownership, borrowing, and lifetimes to the formal framework.
5. Describe uniqueness types as used in the Clean language and contrast them with linear types.
6. Apply type-state programming to encode resource protocols in types.
7. State and prove type safety for the affine lambda calculus.
8. Connect affine types to separation logic and explain how both enforce non-aliasing properties.

---

## 1. Motivation: Linearity Is Too Strict

Linear types (Lecture 09a) enforce that every variable is used *exactly once*. This is a powerful discipline, but it is often too restrictive for practical programming. Consider:

```
let x = open_file("data.txt") in
  if error_condition then
    close(x)       (* use x once on this branch *)
  else
    let data = read(x) in
    close(x)        (* use x once on this branch *)
```

In a linear type system, we must use $x$ exactly once on *every* execution path. The above program is fine---$x$ is used once on each branch. But what about:

```
let x = allocate_resource() in
  if not_needed then
    discard(x)      (* explicit discard --- annoying! *)
  else
    use(x)
```

In a linear system, we cannot simply drop $x$; we must explicitly consume it, even when we do not need it. This leads to verbose code with explicit disposal patterns.

**Affine types** offer a pragmatic relaxation: every variable may be used *at most once*. Weakening is permitted (unused variables are silently dropped), but contraction remains forbidden (no variable may be used twice). This "use at most once" discipline is sufficient to prevent double-free, use-after-free, and data races, while allowing the convenience of implicit resource cleanup (via destructors, finalizers, or RAII patterns).

This is precisely the discipline adopted by Rust's ownership system, which has demonstrated the practical viability of substructural typing at industrial scale.

---

## 2. Core Theory

### 2.1 The Substructural Hierarchy

Recall from Lecture 09a that a substructural logic is obtained by restricting the structural rules of exchange, weakening, and contraction. We now give a systematic classification.

**Definition 2.1.1 (Substructural type systems).** The principal substructural type systems are:

| Type System | Exchange | Weakening | Contraction | Usage |
|---|---|---|---|---|
| Unrestricted (STLC) | Yes | Yes | Yes | $\geq 0$ times |
| Affine | Yes | Yes | No | $\leq 1$ time |
| Relevant | Yes | No | Yes | $\geq 1$ time |
| Linear | Yes | No | No | Exactly 1 time |
| Ordered (Lambek) | No | No | No | Exactly 1, in order |

**Definition 2.1.2 (Usage lattice).** We define a *usage qualifier* $q$ drawn from a lattice:

$$q ::= \mathsf{Un} \mid \mathsf{Aff} \mid \mathsf{Rel} \mid \mathsf{Lin}$$

with the ordering $\mathsf{Un} \sqsubseteq \mathsf{Aff} \sqsubseteq \mathsf{Lin}$ and $\mathsf{Un} \sqsubseteq \mathsf{Rel} \sqsubseteq \mathsf{Lin}$, forming a diamond:

$$
\begin{array}{c}
\mathsf{Lin} \\
\diagup \quad \diagdown \\
\mathsf{Aff} \qquad \mathsf{Rel} \\
\diagdown \quad \diagup \\
\mathsf{Un}
\end{array}
$$

A type at qualifier $q$ supports the structural rules allowed by $q$:
- $\mathsf{Un}$: weakening and contraction (use any number of times).
- $\mathsf{Aff}$: weakening only (use at most once).
- $\mathsf{Rel}$: contraction only (use at least once).
- $\mathsf{Lin}$: neither (use exactly once).

**Proposition 2.1.3 (Subsumption).** If $q_1 \sqsubseteq q_2$, then any term of type $A^{q_2}$ (qualified at $q_2$) can be used wherever a type $A^{q_1}$ is expected. Equivalently, the type system at qualifier $q_2$ is *more restrictive* than at $q_1$.

*Proof.* If $q_1$ allows a structural rule and $q_2 \sqsubseteq q_1$, then... wait, the direction is: $\mathsf{Un} \sqsubseteq \mathsf{Aff}$ means that unrestricted is *less restrictive* than affine. But subsumption should go from more capability to less: an unrestricted value can be used in an affine context (it has more permissions). We formalize:

A value of qualifier $q_1$ can be used where $q_2$ is expected if $q_2 \sqsubseteq q_1$ (the expected qualifier is less demanding). Unrestricted values ($\mathsf{Un}$) can be used anywhere; linear values ($\mathsf{Lin}$) can only be used where exactly-once usage is enforced. $\square$

### 2.2 The Affine Lambda Calculus

We now formalize the affine type system. The key difference from the linear lambda calculus is that the variable rule does not require all other variables to be unrestricted --- leftover linear variables are simply discarded.

**Definition 2.2.1 (Syntax).** The terms of the affine lambda calculus are the same as the STLC:

$$M, N ::= x \mid \lambda x.\, M \mid M\; N \mid (M, N) \mid \pi_1\, M \mid \pi_2\, M \mid \mathsf{inl}\, M \mid \mathsf{inr}\, M \mid \mathsf{case}\; M \;\mathsf{of}\; \ldots \mid () \mid \ldots$$

We do not need explicit $\mathsf{discard}$ or $\mathsf{copy}$ constructs: discarding is implicit (weakening is allowed), and copying is simply forbidden (contraction is disallowed).

**Definition 2.2.2 (Types).** The types of the affine lambda calculus are:

$$A, B ::= \alpha \mid A \multimap B \mid A \otimes B \mid \mathbf{1} \mid A \mathbin{\&} B \mid A \oplus B \mid \;!A$$

The $!A$ modality marks types as unrestricted (may be used any number of times, including duplication). Types without $!$ are affine (use at most once).

**Definition 2.2.3 (Typing judgments).** A *context* $\Gamma$ is a finite map from variables to types. We write $\Gamma \vdash M : A \dashv \Delta$ in an *output context* style, where $\Gamma$ is the input context and $\Delta$ is the *leftover context* containing the affine variables that were not used. Alternatively, we can use the declarative style $\Gamma \vdash M : A$ with the convention that $\Gamma$ may contain unused affine variables.

We present both styles.

**Definition 2.2.4 (Declarative typing rules, affine lambda calculus).**

**Variable:**

$$\frac{}{\Gamma, x : A \vdash x : A} \; (\text{Var})$$

where $\Gamma$ may contain arbitrary (including affine) bindings. This is the key difference from the linear calculus, where leftover variables in $\Gamma$ must be unrestricted.

**Abstraction:**

$$\frac{\Gamma, x : A \vdash M : B}{\Gamma \vdash \lambda x.\, M : A \multimap B} \; (\multimap\text{-I})$$

Note: $x$ may or may not appear free in $M$. If it does not appear, $x$ is implicitly weakened away.

**Application:**

$$\frac{\Gamma_1 \vdash M : A \multimap B \quad \Gamma_2 \vdash N : A}{\Gamma_1, \Gamma_2 \vdash M\; N : B} \; (\multimap\text{-E})$$

The context-splitting rule remains. However, the split need not be exhaustive in the sense of covering all linear variables, because unused affine variables in either $\Gamma_1$ or $\Gamma_2$ are implicitly dropped.

**Weakening (implicit):**

$$\frac{\Gamma \vdash M : B}{\Gamma, x : A \vdash M : B} \; (\text{Weak})$$

This rule is admissible and applied implicitly: any affine variable can be added to the context without affecting well-typedness.

All other rules ($\otimes$-I/E, $\mathbin{\&}$-I/E, $\oplus$-I/E, $!$-I/E) are identical to the linear lambda calculus.

**Remark 2.2.5.** The contraction rule is *not* present:

$$\frac{\Gamma, x : A, y : A \vdash M : B}{\Gamma, z : A \vdash M[z/x, z/y] : B} \quad \text{(NOT admissible for affine types)}$$

If $A$ is not of the form $!B$, then $z$ would be used twice (once in place of $x$ and once in place of $y$), violating the at-most-once restriction.

### 2.3 Algorithmic Typing with Output Contexts

The declarative rules are not directly implementable as an algorithm because of the nondeterministic context split in the application rule. We give an algorithmic formulation using *output contexts*.

**Definition 2.3.1 (Algorithmic typing).** The judgment $\Gamma \vdash M : A \dashv \Delta$ means: "under input context $\Gamma$, the term $M$ has type $A$, and the remaining (unconsumed) affine variables are in $\Delta$."

**Variable:**

$$\frac{x : A \in \Gamma}{\Gamma \vdash x : A \dashv \Gamma \setminus \{x\}} \; (\text{Var-Alg})$$

The variable $x$ is consumed; all other bindings remain.

**Abstraction:**

$$\frac{\Gamma, x : A \vdash M : B \dashv \Delta, (x : A)?}{\Gamma \vdash \lambda x.\, M : A \multimap B \dashv \Delta} \; (\multimap\text{-I-Alg})$$

If $x$ remains in $\Delta$ (unused), it is simply dropped (weakening). The output $\Delta$ does not include $x$.

**Application:**

$$\frac{\Gamma \vdash M : A \multimap B \dashv \Delta \quad \Delta \vdash N : A \dashv \Theta}{\Gamma \vdash M\; N : B \dashv \Theta} \; (\multimap\text{-E-Alg})$$

No nondeterministic split: the output context of the first subterm becomes the input context of the second.

**Theorem 2.3.2 (Soundness and completeness).** $\Gamma \vdash M : A \dashv \Delta$ if and only if there exists a split $\Gamma = \Gamma_{\text{used}}, \Delta$ such that $\Gamma_{\text{used}} \vdash M : A$ in the declarative system. Moreover, for any split $\Gamma = \Gamma_1, \Gamma_2$ used in a declarative derivation, there is a corresponding algorithmic derivation that threads the context appropriately.

*Proof.* Soundness: each algorithmic rule produces a valid declarative derivation by taking $\Gamma_1 = \Gamma \setminus \Delta$ as the consumed portion. Completeness: given a declarative derivation with a particular split, we can reorder the checking to process subterms left-to-right, threading the leftover context. The key observation is that weakening is admissible, so any "extra" variables in the declarative context can simply be carried along. $\square$

### 2.4 Type Safety for the Affine Lambda Calculus

**Theorem 2.4.1 (Preservation).** If $\Gamma \vdash M : A$ and $M \longrightarrow M'$, then $\Gamma \vdash M' : A$.

*Proof.* The proof follows the same structure as for the linear lambda calculus (Theorem 2.9.1 of Lecture 09a), with the simplification that the substitution lemma does not need to track exhaustive usage.

**Case $(\beta_{\multimap})$:** We have $\Gamma_1, \Gamma_2 \vdash (\lambda x.\, M_0)\; N : B$ from $\Gamma_1, x : A \vdash M_0 : B$ and $\Gamma_2 \vdash N : A$. By the affine substitution lemma (below), $\Gamma_1, \Gamma_2 \vdash M_0[N/x] : B$. If $x$ does not appear free in $M_0$, then $M_0[N/x] = M_0$ and the resources of $\Gamma_2$ are simply weakened in (they are unused, which is permitted in the affine system).

The other cases are analogous. $\square$

**Lemma 2.4.2 (Affine substitution).** If $\Gamma, x : A \vdash M : B$ and $\Delta \vdash N : A$, then $\Gamma, \Delta \vdash M[N/x] : B$.

*Proof.* By induction on the derivation of $\Gamma, x : A \vdash M : B$. The proof is simpler than the linear version because:
1. If $x \notin \mathrm{FV}(M)$, then $M[N/x] = M$ and $\Gamma \vdash M : B$. Since weakening is admissible, $\Gamma, \Delta \vdash M : B$.
2. If $x \in \mathrm{FV}(M)$, then $x$ appears at most once (by the affine typing discipline), and the substitution is handled as in the linear case. $\square$

**Theorem 2.4.3 (Progress).** If $\vdash M : A$, then either $M$ is a value or $M \longrightarrow M'$.

*Proof.* Identical to the STLC progress theorem. The affine discipline does not affect the structure of reduction; it only constrains which terms are well-typed. $\square$

### 2.5 Operational Semantics and Reduction

**Definition 2.5.1 (Values).** The values of the affine lambda calculus are:

$$V ::= \lambda x.\, M \mid (V_1, V_2) \mid () \mid \langle V_1, V_2 \rangle \mid \mathsf{inl}\, V \mid \mathsf{inr}\, V \mid \mathsf{promote}\, V$$

These are the same as in the linear lambda calculus.

**Definition 2.5.2 (Reduction rules).** The $\beta$-reduction rules are identical to the linear lambda calculus:

$$(\lambda x.\, M)\; V \longrightarrow M[V/x] \quad (\beta_{\multimap})$$

$$\mathsf{let}\; (x, y) = (V_1, V_2) \;\mathsf{in}\; N \longrightarrow N[V_1/x, V_2/y] \quad (\beta_{\otimes})$$

$$\pi_i\, \langle V_1, V_2 \rangle \longrightarrow V_i \quad (\beta_{\mathbin{\&}})$$

$$\mathsf{case}\; (\mathsf{inl}\, V) \;\mathsf{of}\; \mathsf{inl}\, x \Rightarrow N_1;\; \mathsf{inr}\, y \Rightarrow N_2 \longrightarrow N_1[V/x] \quad (\beta_{\oplus_1})$$

$$\mathsf{case}\; (\mathsf{inr}\, V) \;\mathsf{of}\; \mathsf{inl}\, x \Rightarrow N_1;\; \mathsf{inr}\, y \Rightarrow N_2 \longrightarrow N_2[V/y] \quad (\beta_{\oplus_2})$$

**Remark 2.5.3.** The operational semantics of the affine lambda calculus is identical to that of the linear lambda calculus. The difference is entirely in *which terms are well-typed*: the affine system accepts a strictly larger set of terms (those that happen to not use some variables). At runtime, unused affine variables are simply garbage collected (or their destructors are run).

**Proposition 2.5.4 (Affine semantics and garbage collection).** In an affine type system with implicit weakening, unused values are not explicitly consumed by the program. Their cleanup must be handled by the runtime system:

1. **Garbage collection:** The standard approach in GC'd languages. Affine types guarantee that at most one reference exists, so reference counting suffices (no cycles possible for affine values).

2. **RAII / Drop:** As in Rust: when a value goes out of scope without being moved, its destructor (`drop`) is called. The affine type system guarantees that `drop` is called at most once.

3. **Region-based management:** The value is allocated in a region that is freed when the region is deallocated.

### 2.6 Rust's Ownership Model as Affine Typing

Rust is the most prominent programming language to adopt a substructural type discipline. Its *ownership system* can be understood as an affine type system with additional features for borrowing and lifetimes.

**Correspondence 2.6.1 (Rust and affine types).**

| Rust Concept | Affine Type System Concept |
|---|---|
| Owned value `T` | Affine type $A$ (use at most once) |
| `Copy` trait | Unrestricted type $!A$ (contraction allowed) |
| Move semantics | Consuming an affine variable |
| `drop` at end of scope | Implicit weakening |
| `&T` (shared reference) | Borrowing: read-only, duplicable view |
| `&mut T` (mutable reference) | Borrowing: read-write, unique view |
| Lifetime `'a` | Scope of a borrow |

**Definition 2.6.2 (Ownership).** In Rust, every value has a unique *owner*---the variable binding that is responsible for the value. When a non-`Copy` value is assigned to a new variable or passed to a function, ownership is *transferred* (the value is "moved"). The original variable becomes unusable.

In terms of the affine lambda calculus, a move is the consumption of an affine variable:

```rust
let x: String = String::from("hello");
let y = x;   // ownership moves from x to y
// x is no longer usable here --- affine variable consumed
```

corresponds to:

$$x : \mathsf{String} \vdash \mathsf{let}\; y = x \;\mathsf{in}\; M : B$$

where $x$ is consumed by the binding of $y$, and any subsequent use of $x$ would be a type error.

**Definition 2.6.3 (Copy types).** Types implementing the `Copy` trait in Rust correspond to unrestricted types $!A$. Values of these types are implicitly duplicated on assignment, regaining the full structural rules:

```rust
let x: i32 = 42;
let y = x;   // x is copied, not moved
let z = x;   // x can be used again --- unrestricted!
```

This corresponds to:

$$x : \;!\mathsf{Int} \vdash \ldots$$

where contraction and weakening are both available.

**Definition 2.6.4 (Borrowing).** Rust's *borrowing* system allows temporary, controlled access to a value without transferring ownership. There are two kinds:

**(1) Shared references ($\&T$).** Multiple shared references may coexist simultaneously, but none may mutate the value:

$$\frac{\Gamma, x : A \vdash M : B}{\Gamma, x : A \vdash \mathsf{borrow}_{\mathsf{shared}}(x, \lambda r.\, M) : B} \; (\text{Shared-Borrow})$$

where $r : \&A$ may be duplicated (shared references are $\mathsf{Copy}$), and $x : A$ is *not* consumed (it remains in the context after the borrow ends).

**(2) Mutable references ($\&\mathsf{mut}\; T$).** At most one mutable reference may exist at a time, and no shared references may coexist:

$$\frac{\Gamma \vdash M : B}{\Gamma, x : A \vdash \mathsf{borrow}_{\mathsf{mut}}(x, \lambda r.\, M) : B} \; (\text{Mut-Borrow})$$

where $r : \&\mathsf{mut}\; A$ is affine (cannot be duplicated) and $x : A$ is temporarily inaccessible (frozen) during the borrow.

**Proposition 2.6.5 (Aliasing XOR Mutation).** Rust's borrowing rules enforce the invariant: at any program point, a value is either *shared but immutable* (multiple $\&T$) or *unique but mutable* (single $\&\mathsf{mut}\; T$), but never both. This is the *aliasing XOR mutation* principle.

*Proof.* The shared borrow rule allows duplication of $\&T$ but does not grant write access. The mutable borrow rule grants write access through $\&\mathsf{mut}\; T$ but makes $\&\mathsf{mut}\; T$ affine (not duplicable) and freezes the original variable. Since the original is frozen and only one $\&\mathsf{mut}\; T$ exists, there is no aliasing of mutable data. $\square$

**Definition 2.6.6 (Lifetimes).** A *lifetime* $'a$ is a static approximation of the scope during which a reference is valid. The type $\&'a\, T$ means "a reference to $T$ that is valid for the lifetime $'a$." The type system enforces:

1. **Outlives relation:** If $r : \&'a\, T$ and $r$ is derived from $x : T$ with scope $'b$, then $'a \subseteq 'b$ (the reference does not outlive the referent).
2. **Lifetime subtyping:** $'a : 'b$ (read "$'a$ outlives $'b$") implies $\&'a\, T <: \&'b\, T$ (a longer-lived reference can be used where a shorter-lived one is expected).

In terms of the type theory, lifetimes are a form of *region typing* (Tofte and Talpin, 1997): types are parameterized by region variables that track the spatial and temporal extent of references.

### 2.7 Uniqueness Types

An alternative approach to substructural resource management is *uniqueness types*, as developed in the Clean programming language (Barendsen and Smetsers, 1993).

**Definition 2.7.1 (Uniqueness types).** A type $A^{\bullet}$ is *unique* if the runtime system guarantees that there is exactly one reference to the value at the point of use. The key typing rule is:

$$\frac{\Gamma \vdash M : A^{\bullet} \quad x \text{ occurs at most once in } N \quad \Gamma' \vdash N[x := M] : B}{\Gamma, \Gamma' \vdash \mathsf{let}\; x = M \;\mathsf{in}\; N : B} \; (\text{Unique-Let})$$

**Contrast 2.7.2 (Linear/affine vs. unique).** The key distinction is in the *direction of the guarantee*:

- **Linear/affine types** are a *demand*: "this value *must* be used at most once (affine) or exactly once (linear)." The type system restricts the *consumer*.
- **Uniqueness types** are a *guarantee*: "this value *is* referenced uniquely." The type system restricts the *producer* (ensures no aliases have been created).

These are dual perspectives:
- Linear/affine: the value has a *unique future* (at most one consumer).
- Unique: the value has a *unique past* (at most one producer/reference).

**Proposition 2.7.3.** In a system with both linear and unique types, a value of unique type $A^{\bullet}$ can be safely updated in place, because the uniqueness guarantee ensures no other reference observes the mutation. This is the basis for purely functional I/O in Clean: the "world" value $W^{\bullet}$ is unique, so it can be threaded through I/O operations and "destructively updated" without violating referential transparency.

### 2.8 Relevant Types

For completeness, we briefly discuss the remaining point in the substructural hierarchy.

**Definition 2.8.1 (Relevant types).** A *relevant type system* allows contraction but not weakening. Every variable must be used *at least once*, but may be used multiple times.

The typing rules are the same as the STLC, except the variable rule requires that all variables in the context are used:

$$\frac{}{\Gamma, x : A \vdash x : A} \; (\text{Var})$$

where $\Gamma$ is empty (or all variables in $\Gamma$ are used elsewhere in the derivation --- this is enforced globally, not locally).

**Proposition 2.8.2.** In a relevant type system, the following term is ill-typed:

$$\lambda x.\, 42 \quad : \quad A \to \mathsf{Int}$$

because $x$ is not used. However, $\lambda x.\, (x, x) : A \to A \times A$ is well-typed (contraction is allowed).

**Remark 2.8.3.** Relevant type systems have fewer practical applications than linear or affine systems. Their main use is in ensuring "no dead code"---every input to a function influences the output. They appear in some analyses related to information flow and partial evaluation.

### 2.9 Type-State Programming

One of the most powerful applications of substructural types is *type-state programming*: encoding state machines in the type system so that the compiler enforces protocol compliance.

**Definition 2.9.1 (Type-state).** A *type-state* system assigns different types to an object at different points in its lifecycle. Operations are typed so that they are only available in the appropriate state, and they produce the object in a new state.

**Example 2.9.2 (TCP connection protocol).** A TCP connection goes through states: $\mathsf{Closed} \to \mathsf{Listening} \to \mathsf{Connected} \to \mathsf{Closed}$ (simplified). We model this with distinct types:

$$\mathsf{socket} : \mathbf{1} \multimap \mathsf{TCP}_{\mathsf{Closed}}$$

$$\mathsf{bind} : \mathsf{TCP}_{\mathsf{Closed}} \otimes \mathsf{Addr} \multimap \mathsf{TCP}_{\mathsf{Bound}}$$

$$\mathsf{listen} : \mathsf{TCP}_{\mathsf{Bound}} \multimap \mathsf{TCP}_{\mathsf{Listening}}$$

$$\mathsf{accept} : \mathsf{TCP}_{\mathsf{Listening}} \multimap \mathsf{TCP}_{\mathsf{Connected}} \otimes \mathsf{TCP}_{\mathsf{Listening}}$$

$$\mathsf{send} : \mathsf{TCP}_{\mathsf{Connected}} \otimes \mathsf{Data} \multimap \mathsf{TCP}_{\mathsf{Connected}}$$

$$\mathsf{recv} : \mathsf{TCP}_{\mathsf{Connected}} \multimap \mathsf{Data} \otimes \mathsf{TCP}_{\mathsf{Connected}}$$

$$\mathsf{close} : \mathsf{TCP}_{\mathsf{Connected}} \multimap \mathbf{1}$$

Because each $\mathsf{TCP}_s$ type is linear (or affine), the type system enforces:
- A socket must progress through the correct sequence of states.
- $\mathsf{send}$ can only be called on a $\mathsf{Connected}$ socket, not on a $\mathsf{Closed}$ one.
- The socket must eventually be closed (in a linear system) or may be dropped (in an affine system with destructors).
- No double-close: the socket is consumed by $\mathsf{close}$.

**Definition 2.9.3 (Indexed monads for type-state).** Type-state programming can be generalized using *indexed monads* (also called *parameterized monads* or *Atkey monads*):

$$\mathsf{IxMonad} : \mathsf{State} \to \mathsf{State} \to \mathsf{Type} \to \mathsf{Type}$$

where $\mathsf{IxMonad}\; s_1\; s_2\; A$ represents a computation that starts in state $s_1$, ends in state $s_2$, and produces a value of type $A$. The bind operation chains state transitions:

$$\mathsf{bind} : \mathsf{IxMonad}\; s_1\; s_2\; A \to (A \to \mathsf{IxMonad}\; s_2\; s_3\; B) \to \mathsf{IxMonad}\; s_1\; s_3\; B$$

This is related to the graded monads and effect systems of Lecture 09d.

### 2.10 Ordered Types (Lambek Calculus)

At the bottom of the substructural hierarchy lies the *ordered* (or *non-commutative*) type system, which drops exchange in addition to weakening and contraction.

**Definition 2.10.1 (Ordered types).** In an ordered type system, the context is a *list* (not a set or multiset), and variables must be used in the order they appear. The application rule becomes:

$$\frac{\Gamma_1 \vdash M : A \multimap B \quad \Gamma_2 \vdash N : A}{\Gamma_1, \Gamma_2 \vdash M\; N : B} \; (\multimap\text{-E})$$

where $\Gamma_1, \Gamma_2$ is *concatenation* (not union), and the order matters. We also distinguish left and right implication:

$$A \backslash B \quad \text{(left implication: "consume $A$ from the left to get $B$")}$$

$$B / A \quad \text{(right implication: "consume $A$ from the right to get $B$")}$$

**Remark 2.10.2.** Ordered types correspond to the *Lambek calculus* (1958), originally developed for the syntax of natural languages. The type $\mathsf{NP} \backslash \mathsf{S}$ is a verb phrase: something that, given a noun phrase to the left, produces a sentence. The ordered structure captures word order in syntax.

In computer science, ordered types are used in *stack-based* programming: the context represents a stack, and variables must be consumed in LIFO order.

### 2.11 Connection to Separation Logic

Separation logic (Reynolds, 2002; O'Hearn, 2019) is a program logic for reasoning about heap-manipulating programs. Its key connective, the *separating conjunction* $P * Q$, asserts that the heap can be split into two disjoint parts, one satisfying $P$ and the other satisfying $Q$.

**Correspondence 2.11.1 (Separation logic and linear types).**

| Separation Logic | Linear/Affine Types |
|---|---|
| Separating conjunction $P * Q$ | Tensor product $A \otimes B$ |
| Separating implication $P \mathrel{-*} Q$ | Linear implication $A \multimap B$ |
| Heap disjointness | Context splitting |
| Points-to assertion $x \mapsto v$ | Unique ownership of a pointer |
| Frame rule | Context weakening / framing |

**Proposition 2.11.2 (Frame rule).** The frame rule of separation logic states:

$$\frac{\{P\}\; C\; \{Q\}}{\{P * R\}\; C\; \{Q * R\}}$$

This says: if a command $C$ only needs resources described by $P$ and produces $Q$, then any additional resources $R$ (disjoint from what $C$ touches) are preserved unchanged. This is the analogue of the context-splitting principle in linear typing: resources not used by one subterm are available to others.

**Remark 2.11.3.** The deep connection between separation logic and linear types has been formalized by several researchers. Notably, Pottier (2008) showed how Hoare-style specifications with separation logic can be internalized as types in a linear type system: the assertion $\{P\}\; C\; \{Q\}$ becomes a function type $P \multimap Q$ (with appropriate refinement). This connection has influenced Rust's type system, which can be seen as enforcing separation logic invariants *statically* through affine types and the borrow checker.

### 2.12 Qualified Types: A Unified Framework

Walker (2004) proposed a unified framework for substructural type systems using *type qualifiers* that annotate each type with its structural properties.

**Definition 2.12.1 (Qualified types).** Each type is annotated with a qualifier $q \in \{\mathsf{Un}, \mathsf{Aff}, \mathsf{Lin}\}$:

$$\tau ::= q\; T \quad \text{where} \quad T ::= \alpha \mid \tau \to \tau \mid \tau \times \tau \mid \ldots$$

The typing rules are parameterized by the qualifier:

**Variable:**

$$\frac{q \text{ allows weakening}}{\Gamma, x : q\; T \vdash x : q\; T \dashv \Gamma} \; (\text{Var-W}) \qquad \frac{}{\Gamma, x : q\; T \vdash x : q\; T \dashv \Gamma \setminus \{x\}} \; (\text{Var-Use})$$

**Contraction:**

$$\frac{q \text{ allows contraction} \quad \Gamma, x : q\; T, y : q\; T \vdash M : A \dashv \Delta}{\Gamma, z : q\; T \vdash M[z/x, z/y] : A \dashv \Delta} \; (\text{Contr})$$

**Qualifier subsumption:**

$$\frac{\Gamma \vdash M : q_1\; T \quad q_2 \sqsubseteq q_1}{\Gamma \vdash M : q_2\; T} \; (\text{Sub-Q})$$

An unrestricted value ($\mathsf{Un}\; T$) can be used where an affine ($\mathsf{Aff}\; T$) or linear ($\mathsf{Lin}\; T$) value is expected, because unrestricted types support all structural rules.

**Theorem 2.12.2 (Type safety for qualified types).** The qualified type system satisfies preservation and progress. The proof is parameterized by the qualifier lattice and subsumes the type safety proofs for the affine, linear, and unrestricted fragments.

*Proof.* Preservation proceeds by induction on the typing derivation, with a case analysis on the reduction step. The substitution lemma is parameterized: for qualifier $q$:
- If $q$ allows weakening and $x \notin \mathrm{FV}(M)$, the substitute $N$ is discarded.
- If $q$ allows contraction and $x$ appears multiple times, $N$ is duplicated.
- The qualifier subsumption rule ensures that substitution respects the qualifier ordering.

Progress is independent of qualifiers (it depends only on the term structure, not on usage discipline). $\square$

### 2.12 Worked Examples: Affine Typing in Practice

**Example 2.12.1 (Safe resource cleanup).** Consider a database connection:

$$\mathsf{connect} : \mathsf{String} \multimap \mathsf{Connection}$$

$$\mathsf{query} : \mathsf{Connection} \otimes \mathsf{SQL} \multimap \mathsf{Result} \otimes \mathsf{Connection}$$

$$\mathsf{disconnect} : \mathsf{Connection} \multimap \mathbf{1}$$

In an affine system, we can write:

$$\lambda \mathsf{url}.\, \mathsf{let}\; c = \mathsf{connect}(\mathsf{url}) \;\mathsf{in}\; \mathsf{let}\; (r, c') = \mathsf{query}(c, \mathsf{sql}) \;\mathsf{in}\; \mathsf{disconnect}(c');\; r$$

But we can also write the "early exit" version:

$$\lambda \mathsf{url}.\, \mathsf{let}\; c = \mathsf{connect}(\mathsf{url}) \;\mathsf{in}\; \mathsf{if}\; \mathsf{error} \;\mathsf{then}\; \mathsf{disconnect}(c) \;\mathsf{else}\; \ldots$$

In the "error" branch, $c$ is consumed by `disconnect`. In the other branch, $c$ is used for queries. In an affine system, if neither branch uses $c$, it is implicitly dropped (the destructor runs). In a linear system, we would be *forced* to call `disconnect` on every path.

**Example 2.12.2 (Move semantics in Rust, formalized).** Consider the following Rust code:

```rust
fn consume(s: String) { /* ... */ }

fn example() {
    let s = String::from("hello");  // s : String (affine)
    consume(s);                      // s is moved to consume
    // println!("{}", s);            // ERROR: s has been moved
}
```

The typing derivation (in our formal system):

$$\frac{\frac{}{s : \mathsf{String} \vdash s : \mathsf{String}} \quad \vdash \mathsf{consume} : \mathsf{String} \multimap \mathbf{1}}{s : \mathsf{String} \vdash \mathsf{consume}(s) : \mathbf{1} \dashv \emptyset}$$

After typing $\mathsf{consume}(s)$, the output context is empty: $s$ has been consumed. Any subsequent use of $s$ would fail because $s$ is no longer in the context.

**Example 2.12.3 (Borrowing as a second-class resource).** The borrow $\&T$ can be modeled as a *second-class* value: it exists only within a lexically scoped region and cannot escape. In terms of our type system:

$$\frac{\Gamma, x : A \vdash M : B \quad r : \&A \text{ scoped within } M}{\Gamma, x : A \vdash \mathsf{borrow}(x, \lambda r.\, M) : B \dashv \Gamma', x : A}$$

The key point is that $x : A$ remains in the output context (it is *not* consumed by the borrow). The reference $r : \&A$ is scoped: it cannot outlive the borrow region.

**Example 2.12.4 (Type-state for a file handle).** We encode the file state machine:

$$
\begin{array}{l}
\mathsf{open} : \mathsf{Path} \multimap \mathsf{File}_{\mathsf{Open}} \\
\mathsf{read} : \mathsf{File}_{\mathsf{Open}} \multimap \mathsf{Data} \otimes \mathsf{File}_{\mathsf{Open}} \\
\mathsf{close} : \mathsf{File}_{\mathsf{Open}} \multimap \mathsf{File}_{\mathsf{Closed}} \\
\end{array}
$$

The type $\mathsf{File}_{\mathsf{Closed}}$ has no operations: once closed, the file handle is inert. In an affine system, $\mathsf{File}_{\mathsf{Closed}}$ can be silently dropped. In a linear system, we would need an explicit $\mathsf{dispose} : \mathsf{File}_{\mathsf{Closed}} \multimap \mathbf{1}$.

A program that tries to read from a closed file:

$$\mathsf{let}\; f = \mathsf{open}(\mathsf{p}) \;\mathsf{in}\; \mathsf{let}\; f' = \mathsf{close}(f) \;\mathsf{in}\; \mathsf{read}(f') \quad \text{--- TYPE ERROR}$$

The error: $\mathsf{read}$ expects $\mathsf{File}_{\mathsf{Open}}$ but $f'$ has type $\mathsf{File}_{\mathsf{Closed}}$.

### 2.13 Practical Considerations and Extensions

**Definition 2.13.1 (Destructors and drop).** In an affine system with implicit weakening, dropping a value may require running cleanup code (closing a file handle, freeing memory, sending a termination message). Rust's `Drop` trait provides this: when an owned value goes out of scope without being moved, the `drop` method is called automatically. This is RAII (Resource Acquisition Is Initialization):

$$\frac{\Gamma \vdash M : B \quad \mathsf{drop} : A \multimap \mathbf{1} \text{ is defined}}{\Gamma, x : A \vdash M : B} \; (\text{Affine-Drop})$$

The implicit weakening of $x : A$ is implemented by inserting a call to $\mathsf{drop}(x)$ at the end of $x$'s scope.

**Definition 2.13.2 (Reborrowing).** Rust allows *reborrowing*: creating a new reference from an existing reference. If $r : \&'\!a\, \mathsf{mut}\; T$, we can create $r' : \&'\!b\, \mathsf{mut}\; T$ where $'b \subseteq 'a$. During the lifetime of $r'$, $r$ is frozen (temporarily unusable). This is modeled as a temporary move of the mutable reference, with implicit restoration when $r'$ goes out of scope.

**Proposition 2.13.3.** The combination of affine types, borrowing, and lifetimes in Rust provides the following safety guarantees, all enforced statically:

1. **No use-after-free:** A moved value cannot be accessed.
2. **No double-free:** An affine value is dropped at most once.
3. **No data races:** Mutable references are unique; shared references are immutable.
4. **No dangling references:** Lifetimes ensure references do not outlive their referents.
5. **No null dereferences:** The `Option<T>` type replaces null pointers (orthogonal to substructural types, but complementary).

### 2.14 The Borrow Checker as a Type System

We give a more detailed formalization of Rust's borrow checker as a type system, following RustBelt (Jung et al., 2018).

**Definition 2.14.1 (Lifetime contexts).** A *lifetime context* $\mathcal{L}$ is a partial order on lifetime variables $'a, 'b, \ldots$ representing the "outlives" relation. We write $'a : 'b$ (read "$'a$ outlives $'b$") when every reference with lifetime $'a$ is valid whenever a reference with lifetime $'b$ is valid.

**Definition 2.14.2 (Borrow typing rules).** We extend the affine type system with borrow types:

**Shared borrow:**

$$\frac{\Gamma, x : T \vdash \mathsf{body} : A \dashv \Gamma', x : T \quad \Gamma, r : \&'a\, T \vdash \mathsf{body}' : A \dashv \Gamma'', r : \&'a\, T}{\Gamma, x : T \vdash \mathsf{let}\; r = \&x \;\mathsf{in}\; \mathsf{body}' : A \dashv \Gamma', x : T} \; (\text{T-SharedBorrow})$$

The key invariant: $x : T$ remains in the output context (it is not consumed). The reference $r : \&'a\, T$ is valid only within the borrow scope and has lifetime $'a$ bounded by $x$'s scope.

**Mutable borrow:**

$$\frac{\Gamma \vdash \mathsf{body}[r/x] : A \dashv \Gamma', r : \&'a\, \mathsf{mut}\; T}{\Gamma, x : T \vdash \mathsf{let}\; r = \&\mathsf{mut}\; x \;\mathsf{in}\; \mathsf{body} : A \dashv \Gamma', x : T} \; (\text{T-MutBorrow})$$

During the mutable borrow, $x$ is replaced by $r$ in the context (frozen). When $r$'s lifetime ends, $x$ is restored.

**Proposition 2.14.3 (Borrow safety).** The borrow typing rules enforce:

1. **No aliased mutation:** If $r : \&'a\, \mathsf{mut}\; T$ exists, no other reference to the same value exists.
2. **No dangling references:** $'a$ is bounded by the scope of the borrowed value.
3. **Shared references are immutable:** $\&'a\, T$ provides read-only access; $T$ cannot be mutated through it.

*Proof sketch.* (1) follows from the mutable borrow rule freezing $x$: no other access path to $x$ is available during the borrow. (2) follows from the lifetime constraint: $'a$ cannot outlive $x$'s scope, ensured by the type system. (3) follows from the type: $\&'a\, T$ offers no mutation operations. $\square$

**Definition 2.14.4 (Non-lexical lifetimes, NLL).** In modern Rust (since 2018 edition), lifetimes are *non-lexical*: a borrow's lifetime ends when the reference is last used, not when the enclosing scope ends. This is modeled by the output-context approach: once $r$ is no longer in the output context (all uses of $r$ are complete), the borrow ends and $x$ is unfrozen.

In the type system, NLL corresponds to computing the *live range* of each reference variable: the interval from its creation to its last use. Two borrows that have non-overlapping live ranges can coexist even within the same scope.

**Example 2.14.5 (NLL in practice).** The following code is accepted by NLL:

```rust
let mut v = vec![1, 2, 3];
let r = &v;         // shared borrow begins
println!("{:?}", r); // last use of r
v.push(4);           // mutable access to v: OK because r's lifetime ended
```

Without NLL (lexical lifetimes), this would be rejected because $r$ has the same scope as $v$, and $v.push(4)$ mutates $v$ while $r$ is in scope.

### 2.15 Formalization: Metatheory of the Affine Fragment

We conclude with a formal development of the key metatheoretic properties.

**Lemma 2.15.1 (Weakening).** If $\Gamma \vdash M : A$, then $\Gamma, x : B \vdash M : A$ (for any $B$ and fresh $x$).

*Proof.* By induction on the typing derivation. Each rule either directly accommodates the extra binding (it appears in a "don't care" position) or the inductive hypothesis carries it through. Importantly, no rule requires that all context variables are used, so the extra binding $x : B$ is never problematic. $\square$

**Lemma 2.15.2 (Non-contraction).** There exist terms $M$ and types $A, B$ such that $\Gamma, x : A, y : A \vdash M : B$ but there is no $M'$ with $\Gamma, z : A \vdash M' : B$ and $M'$ has the same operational behavior as $M[z/x, z/y]$.

*Proof.* Let $A$ be a linear file handle type and $M = \mathsf{close}(x);\; \mathsf{close}(y)$. Then $M[z/x, z/y] = \mathsf{close}(z);\; \mathsf{close}(z)$, which closes the file handle twice---a runtime error. No well-typed $M'$ with a single variable $z : A$ can close the handle twice. $\square$

**Theorem 2.15.3 (Strong normalization, affine lambda calculus).** The affine lambda calculus (without fixpoints) is strongly normalizing.

*Proof sketch.* The proof extends the reducibility candidates argument from the linear lambda calculus (Theorem 2.15.1, Lecture 09a). The affine setting is actually simpler: since weakening is allowed, we do not need to track "exhaustive usage" of all resources. The proof proceeds by defining $\mathsf{RED}_A$ for each type $A$ and showing that all well-typed terms are reducible, hence strongly normalizing. $\square$

### 2.16 Graded Types and Quantitative Type Theory

The substructural hierarchy can be generalized by replacing the discrete set $\{\mathsf{Un}, \mathsf{Aff}, \mathsf{Lin}\}$ with a *semiring* of usage annotations, leading to *quantitative type theory* (QTT).

**Definition 2.16.1 (Resource semiring).** A *resource semiring* $(R, +, \cdot, 0, 1)$ is a semiring where:
- $0$ represents "not used" (erased),
- $1$ represents "used exactly once" (linear),
- $+$ combines usages (e.g., $1 + 1 = \omega$ if we identify "more than once" with "unrestricted"),
- $\cdot$ scales usages under substitution.

**Definition 2.16.2 (Graded typing judgment).** The judgment takes the form:

$$x_1 :_{\rho_1} A_1, \ldots, x_n :_{\rho_n} A_n \vdash M : B$$

where each $\rho_i \in R$ specifies how many times $x_i$ is used in $M$. The key rules are:

**Variable:**

$$\frac{}{0 \cdot \Gamma, x :_1 A \vdash x : A}$$

All other variables have usage $0$.

**Application:**

$$\frac{\Gamma \vdash M : A \xrightarrow{\pi} B \quad \Delta \vdash N : A}{\Gamma + \pi \cdot \Delta \vdash M\; N : B}$$

The usage of each variable in the result is: its usage in $M$ plus $\pi$ times its usage in $N$ (because the function uses its argument $\pi$ times).

**Remark 2.16.3.** Specific choices of semiring recover specific substructural systems:

| Semiring | System |
|---|---|
| $\{0, 1, \omega\}$ with $1 + 1 = \omega$ | Quantitative Type Theory (Atkey, McBride) |
| $\{0, \omega\}$ | Irrelevance (erasure only, as in Coq/Agda) |
| $\{0, 1\}$ | Linear types |
| $\{0, 1, \omega\}$ with $0 \leq 1 \leq \omega$ | Graded linear types (Granule) |
| $\mathbb{N} \cup \{\omega\}$ | Bounded linear logic |

**Proposition 2.16.4.** The affine type system corresponds to the ordered semiring $(\{0, 1, \omega\}, \leq)$ with the constraint that usage annotations satisfy $\rho_i \leq 1$ for affine types (at most one use) and $\rho_i \leq \omega$ for unrestricted types (any number of uses).

### 2.17 Exercises

**Exercise 2.17.1.** Consider the following Rust program. Determine whether each line is a move, a borrow, or a copy, and explain in terms of the affine type system:

```rust
let s1 = String::from("hello");    // (a)
let s2 = s1;                        // (b)
let n1: i32 = 42;                   // (c)
let n2 = n1;                        // (d)
let r = &s2;                        // (e)
println!("{}", r);                   // (f)
println!("{}", s2);                  // (g)
```

**Exercise 2.17.2.** Prove formally that the affine lambda calculus (without $!$) cannot type the term $\lambda x.\, (x, x)$. What is the minimal extension needed to make this typable?

**Exercise 2.17.3.** Design a type-state API for a network socket in the style of Example 2.8.2. Include at least the states: Unbound, Bound, Listening, Connected, and Closed. Specify the types of all operations (bind, listen, accept, connect, send, recv, close) and verify that the type system prevents:
- Sending on an unconnected socket.
- Accepting on a non-listening socket.
- Using a closed socket.

**Exercise 2.17.4.** Prove that in the qualified type system of Section 2.11, the subsumption rule $q_2 \sqsubseteq q_1 \implies q_1\; T <: q_2\; T$ is sound: if a term is well-typed at qualifier $q_1$, it is also well-typed at any less restrictive qualifier $q_2$.

**Exercise 2.17.5.** In Idris 2's QTT, the type of `if-then-else` is:

$$\mathsf{if} : \mathsf{Bool} \to_1 A \to_1 A \to_1 A$$

Explain why this is problematic (both branches are evaluated?), and propose a corrected type using lazy evaluation or thunks.

---

## Summary

- **Affine types** allow each variable to be used *at most once* (weakening allowed, contraction disallowed). This is less restrictive than linear types (exactly once) but still prevents duplication of resources.

- **The substructural hierarchy** organizes type systems by which structural rules they admit: unrestricted (all rules) $\sqsupseteq$ affine (weakening) $\sqsupseteq$ linear (none) and unrestricted $\sqsupseteq$ relevant (contraction) $\sqsupseteq$ linear. Ordered types additionally drop exchange.

- **Rust's ownership model** is an affine type system in practice. Move semantics correspond to consuming an affine variable; `Copy` types correspond to unrestricted types; borrowing introduces temporary, scope-delimited references with the "aliasing XOR mutation" invariant enforced by lifetimes.

- **Uniqueness types** (Clean) take the dual perspective: instead of restricting how many times a value is *used*, they guarantee that a value has a *unique reference*, enabling safe in-place update.

- **Type-state programming** uses substructural types to encode state machines in the type system, ensuring that operations are only available in the appropriate state and that protocols are followed.

- **Separation logic** and linear/affine types share deep structural similarities: the separating conjunction $P * Q$ corresponds to the tensor product $A \otimes B$, and the frame rule corresponds to context splitting.

- **Qualified types** (Walker, 2004) provide a unified framework where each type is annotated with a usage qualifier from a lattice, subsuming linear, affine, relevant, and unrestricted disciplines.

## Further Reading

1. Walker, D. (2004). "Substructural type systems." In *Advanced Topics in Types and Programming Languages*, Chapter 1. MIT Press. The definitive survey of substructural type systems, including the qualified types framework.

2. Tov, J. A. and Pucella, R. (2011). "Practical affine types." In *POPL 2011*, pp. 447--458. ACM. A practical affine type system for a language with mutable state.

3. The Rust Programming Language. *The Rust Book*, Chapter 4: "Understanding Ownership." https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html. The official introduction to Rust's ownership system.

4. Jung, R., Jourdan, J.-H., Krebbers, R., and Dreyer, D. (2018). "RustBelt: Securing the foundations of the Rust programming language." *Proceedings of the ACM on Programming Languages*, 2(POPL), 66:1--66:34. Formal verification of the safety of Rust's type system using Iris (a higher-order concurrent separation logic).

5. Barendsen, E. and Smetsers, S. (1993). "Uniqueness typing for functional languages with graph rewriting semantics." *Mathematical Structures in Computer Science*, 6(6), 579--612. The theory of uniqueness types for the Clean language.

6. Tofte, M. and Talpin, J.-P. (1997). "Region-based memory management." *Information and Computation*, 132(2), 109--176. Region types for static memory management, a precursor to Rust's lifetimes.

7. Reynolds, J. C. (2002). "Separation logic: A logic for shared mutable data structures." In *LICS 2002*, pp. 55--74. IEEE. The foundational paper on separation logic.

8. O'Hearn, P. W. (2019). "Separation logic." *Communications of the ACM*, 62(2), 86--95. An accessible survey of separation logic and its applications.

9. Pottier, F. (2008). "Hiding local state in direct style: A higher-order anti-frame rule." In *LICS 2008*, pp. 331--340. IEEE. Connecting separation logic and type systems.

10. Lambek, J. (1958). "The mathematics of sentence structure." *The American Mathematical Monthly*, 65(3), 154--170. The original paper on the Lambek calculus (ordered types for natural language syntax).
