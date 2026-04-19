---
title: "Lecture 07c: Bounded Quantification (F-sub)"
tags:
  - type-theory
  - lambda-cube
  - lecture
---
# Lecture 07c: Bounded Quantification (F-sub)

> **Module 07 --- Higher-Order Types & the Lambda Cube (Weeks 13--14)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Motivate bounded quantification as the combination of parametric polymorphism with subtyping.
2. Define the syntax, typing rules, and subtyping rules of System $F_{<:}$ (F-sub).
3. Distinguish kernel $F_{<:}$ from full $F_{<:}$ and explain the consequences for decidability.
4. Prove key metatheoretic properties: type safety (progress and preservation) for $F_{<:}$.
5. State Pierce's undecidability result for full $F_{<:}$ and explain its proof strategy.
6. Connect bounded quantification to bounded type parameters in Java, C\#, and Scala.
7. Analyze variance (covariance, contravariance, invariance) in the presence of bounded quantification.
8. Formalize the interaction between bounded quantification and existential types.

---

## 1. Motivation

### 1.1 The Tension Between Polymorphism and Subtyping

Modules 04 and 06 developed two powerful mechanisms independently:

- **Subtyping** (Module 04): if $S <: T$, then any term of type $S$ can be used where type $T$ is expected. This models the "is-a" relationship in object-oriented programming and enables code reuse through subsumption.

- **Parametric polymorphism** (Module 06): a term of type $\forall X.\; T$ works uniformly for all types $X$. This ensures strong abstraction guarantees (parametricity, free theorems).

But these two features interact poorly when combined naively. Consider a function that should work for "any type with a comparison method":

$$
\text{sort} : \forall X.\; \text{List}\;X \to \text{List}\;X
$$

This type says nothing about the requirement that $X$ supports comparison. In a system with only parametric polymorphism, the function body cannot use any operations on values of type $X$ --- it can only shuffle them around.

In a system with only subtyping, we might write:

$$
\text{sort} : \text{List}\;\text{Comparable} \to \text{List}\;\text{Comparable}
$$

But this loses precision: we put in a list of integers and get back a list of "some comparable thing." The type system forgets the specific type.

### 1.2 Bounded Quantification: The Best of Both Worlds

*Bounded quantification* resolves this tension:

$$
\text{sort} : \forall X <: \text{Comparable}.\; \text{List}\;X \to \text{List}\;X
$$

This says: "for any type $X$ that is a subtype of $\text{Comparable}$, given a list of $X$'s, return a list of $X$'s." The bound $X <: \text{Comparable}$ ensures that comparison operations are available, while the universal quantification ensures that the return type preserves the specific input type.

### 1.3 Historical Context

| Year | Contribution | Significance |
|------|-------------|--------------|
| 1985 | Cardelli & Wegner, "On Understanding Types" | First discussion of bounded quantification |
| 1990 | Cardelli, Martini, Mitchell & Scedrov | Formal study of $F_{<:}$ (kernel and full) |
| 1991 | Curien & Ghelli | Subtyping algorithms for $F_{<:}$ |
| 1994 | Pierce | Undecidability of full $F_{<:}$ subtyping |
| 1997 | Castagna & Pierce | Decidable fragments and alternatives |
| 2004 | Igarashi, Pierce & Wadler | Featherweight Java: $F_{<:}$ in practice |

---

## 2. Core Theory: System $F_{<:}$

### 2.1 Syntax

**Definition 2.1 (Types).**

$$
T ::= X \mid \text{Top} \mid T_1 \to T_2 \mid \forall X <: T_1.\; T_2 \mid \{l_i : T_i\}_{i \in I}
$$

where:

- $X$ is a type variable.
- $\text{Top}$ is the maximal type (supertype of every type).
- $T_1 \to T_2$ is the function type.
- $\forall X <: T_1.\; T_2$ is *bounded universal quantification*: the type variable $X$ is constrained to be a subtype of the *bound* $T_1$.
- $\{l_i : T_i\}$ is a record type (included for concreteness; much of the theory works without records).

**Definition 2.2 (Terms).**

$$
e ::= x \mid \lambda x : T.\; e \mid e_1\; e_2 \mid \Lambda X <: T.\; e \mid e\;[T]
$$

where $\Lambda X <: T.\; e$ is *bounded type abstraction* and $e\;[T]$ is type application.

**Definition 2.3 (Values).**

$$
v ::= \lambda x : T.\; e \mid \Lambda X <: T.\; e \mid \{l_i = v_i\}_{i \in I}
$$

**Definition 2.4 (Contexts).** A typing context $\Gamma$ now contains two kinds of bindings:

$$
\Gamma ::= \emptyset \mid \Gamma, x : T \mid \Gamma, X <: T
$$

The binding $X <: T$ records both that $X$ is a type variable and that its *upper bound* is $T$.

### 2.2 Subtyping Rules

The subtyping judgment $\Gamma \vdash S <: T$ is defined by:

$$
\frac{}{\Gamma \vdash T <: \text{Top}} \quad (\text{S-Top})
$$

$$
\frac{}{\Gamma \vdash T <: T} \quad (\text{S-Refl})
$$

$$
\frac{\Gamma \vdash S <: U \qquad \Gamma \vdash U <: T}{\Gamma \vdash S <: T} \quad (\text{S-Trans})
$$

$$
\frac{X <: T \in \Gamma}{\Gamma \vdash X <: T} \quad (\text{S-TVar})
$$

$$
\frac{\Gamma \vdash T_1 <: S_1 \qquad \Gamma \vdash S_2 <: T_2}{\Gamma \vdash S_1 \to S_2 <: T_1 \to T_2} \quad (\text{S-Arrow})
$$

Note the *contravariance* in the first premise of S-Arrow: the domain is contravariant, the codomain is covariant.

$$
\frac{\Gamma \vdash T_1 <: S_1 \qquad \Gamma, X <: T_1 \vdash S_2 <: T_2}{\Gamma \vdash (\forall X <: S_1.\; S_2) <: (\forall X <: T_1.\; T_2)} \quad (\text{S-All}, \text{kernel})
$$

This is the **kernel $F_{<:}$** rule for bounded quantification. The bound on the left must be a *supertype* of the bound on the right (contravariance in the bound), and the body must be covariant.

**The full $F_{<:}$ variant** replaces S-All with:

$$
\frac{\Gamma \vdash T_1 <: S_1 \qquad \Gamma, X <: T_1 \vdash S_2 <: T_2}{\Gamma \vdash (\forall X <: S_1.\; S_2) <: (\forall X <: T_1.\; T_2)} \quad (\text{S-All}, \text{full})
$$

The crucial difference in the full version is that in the premise for the body, $X$ is bounded by $T_1$ (the *right-hand* bound), not $S_1$. This is more permissive because it allows the body comparison to use the tighter bound.

**Remark.** The difference between kernel and full $F_{<:}$ is subtle but has profound consequences for decidability (Section 5).

**Record subtyping (for completeness):**

$$
\frac{\{l_j\}_{j \in J} \supseteq \{l_i\}_{i \in I} \qquad \forall i \in I.\; \Gamma \vdash S_{l_i} <: T_{l_i}}{\Gamma \vdash \{l_j : S_j\}_{j \in J} <: \{l_i : T_i\}_{i \in I}} \quad (\text{S-Rcd})
$$

A record with more fields is a subtype of a record with fewer fields (width subtyping), and fields can be covariant (depth subtyping).

### 2.3 Typing Rules

$$
\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \quad (\text{T-Var})
$$

$$
\frac{\Gamma, x : T_1 \vdash e : T_2}{\Gamma \vdash (\lambda x : T_1.\; e) : T_1 \to T_2} \quad (\text{T-Abs})
$$

$$
\frac{\Gamma \vdash e_1 : T_1 \to T_2 \qquad \Gamma \vdash e_2 : T_1}{\Gamma \vdash e_1\; e_2 : T_2} \quad (\text{T-App})
$$

$$
\frac{\Gamma, X <: T_1 \vdash e : T_2}{\Gamma \vdash (\Lambda X <: T_1.\; e) : \forall X <: T_1.\; T_2} \quad (\text{T-TAbs})
$$

$$
\frac{\Gamma \vdash e : \forall X <: T_1.\; T_2 \qquad \Gamma \vdash S <: T_1}{\Gamma \vdash e\;[S] : [X \mapsto S]T_2} \quad (\text{T-TApp})
$$

Note in T-TApp: the type argument $S$ must be a *subtype* of the bound $T_1$, not merely equal to it. This is the key interaction between polymorphism and subtyping.

$$
\frac{\Gamma \vdash e : S \qquad \Gamma \vdash S <: T}{\Gamma \vdash e : T} \quad (\text{T-Sub})
$$

The subsumption rule allows implicit upcasting.

### 2.4 Operational Semantics

$$
(\lambda x : T.\; e)\; v \longrightarrow [x \mapsto v]e \quad (\text{E-Beta})
$$

$$
(\Lambda X <: T.\; e)\;[S] \longrightarrow [X \mapsto S]e \quad (\text{E-TBeta})
$$

Plus the standard congruence rules for evaluation under application and type application.

---

## 3. Examples

### 3.1 Bounded Identity

The simplest bounded polymorphic function:

$$
\text{id}_{<:} = \Lambda X <: \text{Top}.\; \lambda x : X.\; x \quad : \quad \forall X <: \text{Top}.\; X \to X
$$

Since every type is a subtype of $\text{Top}$, this is equivalent to the unbounded polymorphic identity. In general, $\forall X <: \text{Top}.\; T$ is equivalent to $\forall X.\; T$.

### 3.2 Bounded Application

$$
\text{apply} = \Lambda X <: \{m : \text{Nat}\}.\; \lambda x : X.\; x.m
$$

$$
: \forall X <: \{m : \text{Nat}\}.\; X \to \text{Nat}
$$

This function accepts any record type with at least a field $m : \text{Nat}$, and extracts that field. We can call it with:

$$
\text{apply}\;[\{m : \text{Nat}, n : \text{Bool}\}]\;\{m = 42, n = \text{true}\}
$$

This type-checks because $\{m : \text{Nat}, n : \text{Bool}\} <: \{m : \text{Nat}\}$ by S-Rcd.

### 3.3 The Sort Example Revisited

Define a "comparable" record type:

$$
\text{Comparable} = \{
  \text{leq} : \text{Self} \to \text{Bool}
\}
$$

Properly handling this requires recursive types or $F$-bounded quantification (see Section 6). For now, consider a simpler version:

$$
\text{Ord} = \{
  \text{val} : \text{Nat},\;
  \text{leq} : \text{Nat} \to \text{Nat} \to \text{Bool}
\}
$$

$$
\text{min} : \forall X <: \text{Ord}.\; X \to X \to X
$$

$$
\text{min} = \Lambda X <: \text{Ord}.\; \lambda a : X.\; \lambda b : X.\;
  \text{if}\; a.\text{leq}\; a.\text{val}\; b.\text{val}\; \text{then}\; a\; \text{else}\; b
$$

The return type is $X$, not $\text{Ord}$: we preserve the precise type of the input.

### 3.4 Polymorphic Update

$$
\text{update} : \forall X <: \{x : \text{Nat}\}.\; X \to \text{Nat} \to X
$$

This takes any record with at least an $x$ field and returns the *same type* with the field updated. Note: implementing this correctly requires a record update operation that preserves extra fields, which goes beyond the basic calculus.

### 3.5 Higher-Order Bounded Quantification

We can combine higher-kinded polymorphism with bounded quantification. Consider:

$$
\text{transform} : \forall F <: \text{Functor}.\; \forall A.\; \forall B.\; (A \to B) \to F\;A \to F\;B
$$

Here $F$ is bounded by $\text{Functor}$ (a constraint at kind $* \Rightarrow *$). This requires extending $F_{<:}$ with higher-kinded bounds, yielding $F_{<:}^\omega$.

In Haskell, this pattern is expressed through type class constraints:

```haskell
transform :: Functor f => (a -> b) -> f a -> f b
transform = fmap
```

In Scala, through bounded type parameters at higher kind:

```scala
def transform[F[_] : Functor, A, B](f: A => B)(fa: F[A]): F[B]
```

### 3.6 An Extended Example: Container Abstraction

Define a "container" bound:

$$
\text{Container} = \{
  \text{empty} : \text{Self},\;
  \text{insert} : \text{Nat} \to \text{Self} \to \text{Self},\;
  \text{size} : \text{Self} \to \text{Nat}
\}
$$

A function that works for any container:

$$
\text{insertAll} : \forall X <: \text{Container}.\; \text{List}\;\text{Nat} \to X \to X
$$

$$
\text{insertAll} = \Lambda X <: \text{Container}.\; \lambda ns : \text{List}\;\text{Nat}.\; \lambda c : X.\;
  \text{foldr}\;(\lambda n.\; \lambda acc.\; acc.\text{insert}\;n\;acc)\;c\;ns
$$

The return type $X$ preserves the specific container type: if we pass a `TreeSet`, we get back a `TreeSet`, not a generic `Container`.

---

## 4. Metatheory of $F_{<:}$

### 4.1 Properties of Subtyping

**Lemma 4.1 (Reflexivity).** For any well-formed type $T$ and context $\Gamma$, $\Gamma \vdash T <: T$.

*Proof.* By S-Refl (given as a rule). Alternatively, provable by induction on the structure of $T$ without S-Refl or S-Trans. $\square$

**Lemma 4.2 (Transitivity).** If $\Gamma \vdash S <: U$ and $\Gamma \vdash U <: T$, then $\Gamma \vdash S <: T$.

*Proof.* By S-Trans (given as a rule). For the algorithmic version, transitivity must be proved as an *admissible* rule; this is nontrivial and is the crux of the decidability analysis. $\square$

**Lemma 4.3 (Narrowing).** If $\Gamma, X <: U, \Delta \vdash S <: T$ and $\Gamma \vdash U' <: U$, then $\Gamma, X <: U', \Delta \vdash S <: T$.

*Proof.* By induction on the derivation of $\Gamma, X <: U, \Delta \vdash S <: T$. The key case is when the derivation ends with S-TVar and the variable is $X$: we have $X <: U$ in the old context, and we need $X <: T$ in the new context. But $\Gamma \vdash X <: U'$ (by S-TVar in the new context) and $\Gamma \vdash U' <: U$ (by assumption), and then we need to proceed by transitivity. $\square$

### 4.2 Type Safety

**Theorem 4.4 (Preservation for $F_{<:}$).** If $\Gamma \vdash e : T$ and $e \longrightarrow e'$, then $\Gamma \vdash e' : T$.

*Proof.* By induction on the typing derivation.

**Case E-Beta:** $e = (\lambda x : T_1.\; e_0)\; v$ and $e' = [x \mapsto v]e_0$.

By inversion on the typing (accounting for possible uses of T-Sub):
- There exist $S_1, S_2$ such that $\Gamma \vdash \lambda x : T_1.\; e_0 : S_1 \to S_2$ and $\Gamma \vdash S_1 \to S_2 <: T_1' \to T_2'$ for some types where the overall type is $T = T_2'$.
- By T-Abs inversion: $\Gamma, x : T_1 \vdash e_0 : S$ for some $S$.
- By T-Sub: $\Gamma \vdash v : T_1$.
- By the Substitution Lemma: $\Gamma \vdash [x \mapsto v]e_0 : S$.
- By T-Sub with appropriate subtyping: $\Gamma \vdash e' : T$.

**Case E-TBeta:** $e = (\Lambda X <: T_1.\; e_0)\;[S]$ and $e' = [X \mapsto S]e_0$.

By inversion:
- $\Gamma \vdash (\Lambda X <: T_1.\; e_0) : \forall X <: T_1.\; T_0$.
- $\Gamma \vdash S <: T_1$.
- The result type is $[X \mapsto S]T_0$.

By T-TAbs inversion: $\Gamma, X <: T_1 \vdash e_0 : T_0$.
By the Type Substitution Lemma (substituting a type $S$ with $\Gamma \vdash S <: T_1$ for $X <: T_1$): $\Gamma \vdash [X \mapsto S]e_0 : [X \mapsto S]T_0$. $\square$

**Theorem 4.5 (Progress for $F_{<:}$).** If $\emptyset \vdash e : T$, then either $e$ is a value or there exists $e'$ such that $e \longrightarrow e'$.

*Proof.* By induction on the derivation. The canonical forms lemma must be extended:

- If $\emptyset \vdash v : T_1 \to T_2$, then $v = \lambda x : S.\; e$ for some $S, e$.
- If $\emptyset \vdash v : \forall X <: T_1.\; T_2$, then $v = \Lambda X <: S.\; e$ for some $S, e$.

The key subtlety is that T-Sub may intervene: a value of type $S$ may be given type $T$ via subsumption. The canonical forms lemma must account for this by following the chain of subtyping derivations back to the original typing rule for the value. $\square$

### 4.3 The Substitution Lemmas

**Lemma 4.6 (Term Substitution).** If $\Gamma, x : S \vdash e : T$ and $\Gamma \vdash v : S$, then $\Gamma \vdash [x \mapsto v]e : T$.

*Proof.* Standard induction on the typing derivation. $\square$

**Lemma 4.7 (Type Substitution).** If $\Gamma, X <: U \vdash e : T$ and $\Gamma \vdash S <: U$, then $\Gamma \vdash [X \mapsto S]e : [X \mapsto S]T$.

*Proof.* By induction on the typing derivation, using the Narrowing Lemma for subtyping. The key case is T-TApp, where we must show that the substituted bound is still respected. $\square$

---

## 5. Decidability

### 5.1 Algorithmic Subtyping

For type checking to be decidable, we need an algorithmic version of the subtyping rules that eliminates the non-syntax-directed rules S-Refl and S-Trans.

**Definition 5.1 (Algorithmic Subtyping for Kernel $F_{<:}$).**

$$
\frac{}{\Gamma \vdash_a T <: \text{Top}} \quad (\text{SA-Top})
$$

$$
\frac{X <: U \in \Gamma \qquad \Gamma \vdash_a U <: T}{\Gamma \vdash_a X <: T} \quad (\text{SA-TVar})
$$

$$
\frac{}{\Gamma \vdash_a X <: X} \quad (\text{SA-Refl-TVar})
$$

$$
\frac{\Gamma \vdash_a T_1 <: S_1 \qquad \Gamma \vdash_a S_2 <: T_2}{\Gamma \vdash_a S_1 \to S_2 <: T_1 \to T_2} \quad (\text{SA-Arrow})
$$

$$
\frac{\Gamma \vdash_a T_1 <: S_1 \qquad \Gamma, X <: T_1 \vdash_a S_2 <: T_2}{\Gamma \vdash_a (\forall X <: S_1.\; S_2) <: (\forall X <: T_1.\; T_2)} \quad (\text{SA-All}, \text{kernel})
$$

**Theorem 5.2 (Soundness and Completeness of Algorithmic Subtyping for Kernel $F_{<:}$).** $\Gamma \vdash_a S <: T$ if and only if $\Gamma \vdash S <: T$.

*Proof.* Soundness (algorithmic implies declarative) is straightforward: each algorithmic rule is derivable from the declarative rules plus S-Refl and S-Trans.

Completeness (declarative implies algorithmic) requires showing that S-Refl and S-Trans are *admissible* in the algorithmic system. This is proved by a simultaneous induction on the derivation, using the Narrowing Lemma. The proof is due to Curien and Ghelli (1992). $\square$

**Theorem 5.3 (Decidability of Kernel $F_{<:}$).** Subtyping in kernel $F_{<:}$ is decidable.

*Proof sketch.* The algorithmic rules are syntax-directed. Define the *size* of a subtyping problem $\Gamma \vdash_a S <: T$ as a suitable measure (e.g., the sum of sizes of $S$ and $T$ plus the sizes of all bounds in $\Gamma$). Each rule decreases this measure or keeps it bounded in a way that guarantees termination.

More precisely, the algorithm follows the structure of $S$ and $T$:
- If $T = \text{Top}$, accept.
- If $S = X$, look up the bound and recurse (bound look-up replaces $X$ with its bound, which is a fixed type from $\Gamma$).
- If $S = S_1 \to S_2$ and $T = T_1 \to T_2$, recurse on components.
- If both are $\forall$-types, recurse.
- Otherwise, reject.

The depth of recursion through variable bounds is bounded by the number of type variables in $\Gamma$. $\square$

### 5.2 Undecidability of Full $F_{<:}$

**Theorem 5.4 (Pierce, 1994).** Subtyping in full $F_{<:}$ is undecidable.

*Proof sketch.* Pierce shows a reduction from the halting problem for two-counter machines to the subtyping problem in full $F_{<:}$.

The key idea is that the full S-All rule, by using the right-hand bound $T_1$ in the body premise:

$$
\frac{\Gamma \vdash T_1 <: S_1 \qquad \Gamma, X <: T_1 \vdash S_2 <: T_2}{\Gamma \vdash (\forall X <: S_1.\; S_2) <: (\forall X <: T_1.\; T_2)}
$$

allows information to "flow" from the right-hand side ($T_1$) into the context, and then back into the left-hand side ($S_2$). This creates a feedback loop that can simulate the control flow of a counter machine.

The construction proceeds as follows:

1. **Encoding counters.** The values of the two counters are encoded as the nesting depth of type expressions.

2. **Encoding transitions.** Each transition of the counter machine is encoded as a subtyping constraint. The test for zero corresponds to a particular subtyping pattern, and increment/decrement correspond to wrapping/unwrapping a type constructor.

3. **Composing transitions.** The overall subtyping judgment $\Gamma \vdash S <: T$ encodes the question "does the counter machine halt?"

4. **Soundness of the encoding.** The subtyping derivation succeeds if and only if the counter machine halts.

Since the halting problem for two-counter machines is undecidable (Minsky, 1961), subtyping in full $F_{<:}$ is undecidable. $\square$

### 5.3 The Significance of Undecidability

Pierce's result has practical consequences:

- **Language designers** must choose between full $F_{<:}$ (undecidable, requiring ad hoc bounds on type checking) and kernel $F_{<:}$ (decidable but less expressive).
- **Java and C\#** use kernel $F_{<:}$ (or close approximations). Their generic type checking terminates because the bound comparison uses the simpler kernel rule.
- **Scala** historically had issues with non-terminating type checking due to features that approximate full $F_{<:}$ (e.g., path-dependent types with upper bounds). The DOT calculus was developed partly to address these issues.

The undecidability result also illustrates a general phenomenon: *subtyping and polymorphism interact badly*. Each is decidable in isolation; their combination can be undecidable.

### 5.4 Decidable Fragments

Several strategies restore decidability:

1. **Kernel $F_{<:}$** (Cardelli et al., 1994): use the kernel S-All rule. This is the most common approach.

2. **Bounded polymorphism with structural recursion** (Castagna & Pierce, 1997): restrict the subtyping algorithm to follow a structural recursion discipline.

3. **Step-indexed approaches**: bound the depth of the subtyping derivation by a fixed index. This gives a semi-decision procedure that is complete for "reasonable" programs.

4. **Practical type checkers** (Java, Scala): use a decidable fragment (typically kernel $F_{<:}$) and add special-purpose checks for common patterns.

---

## 6. Extensions and Variations

### 6.1 Adding Bottom Type

Dually to $\text{Top}$, one can add a *bottom type* $\text{Bot}$ satisfying $\text{Bot} <: T$ for all $T$:

$$
\frac{}{\Gamma \vdash \text{Bot} <: T} \quad (\text{S-Bot})
$$

$\text{Bot}$ is the empty type: it has no values. Its presence makes the subtype order a bounded lattice ($\text{Bot}$ at the bottom, $\text{Top}$ at the top).

$\text{Bot}$ is useful for:
- Typing expressions that never return (e.g., infinite loops, exception throwing): $\text{throw} : \text{Bot}$.
- As the bound in unbounded quantification: $\forall X <: \text{Top}.\; T$ means $X$ can be anything; $\exists X.\; \text{Bot} <: X <: T$ means $X$ is some unknown subtype of $T$.

### 6.2 F-Bounded Quantification

In practice, bounded quantification often needs to refer to the type variable in its own bound. This is *F-bounded quantification* (Canning et al., 1989):

$$
\forall X <: F(X).\; T
$$

where the bound $F(X)$ mentions $X$. Example:

$$
\text{Comparable} = \lambda X :: *.\; \{
  \text{compareTo} : X \to \text{Int}
\}
$$

$$
\forall X <: \text{Comparable}(X).\; X \to X \to \text{Bool}
$$

This says: "$X$ must be a subtype of $\text{Comparable}(X)$," meaning $X$ must have a $\text{compareTo}$ method that takes an argument of the *same type* $X$.

This is how Java's `Comparable<T>` interface works:

```java
interface Comparable<T> {
    int compareTo(T other);
}

<T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
```

F-bounded quantification is more expressive than ordinary bounded quantification but requires careful handling in the metatheory to avoid circularities.

### 6.2 Existential Types with Bounds

Bounded existential types combine data abstraction with subtyping:

$$
\exists X <: T_1.\; T_2
$$

This represents a type that is hidden ($X$) but known to be a subtype of $T_1$, packaged with a value of type $T_2$.

**Pack:**

$$
\frac{\Gamma \vdash S <: T_1 \qquad \Gamma \vdash e : [X \mapsto S]T_2}{\Gamma \vdash \text{pack}\; [S, e]\; \text{as}\; \exists X <: T_1.\; T_2 : \exists X <: T_1.\; T_2}
$$

**Unpack:**

$$
\frac{\Gamma \vdash e_1 : \exists X <: T_1.\; T_2 \qquad \Gamma, X <: T_1, x : T_2 \vdash e_2 : T}{\Gamma \vdash \text{let}\; [X, x] = e_1\;\text{in}\; e_2 : T}
$$

(with the usual side condition that $X$ does not appear free in $T$).

Bounded existentials are essential for modeling objects and abstract data types in the presence of subtyping.

### 6.3 Intersection Types

An orthogonal extension is *intersection types*:

$$
T ::= \ldots \mid T_1 \wedge T_2
$$

with the subtyping rules:

$$
\Gamma \vdash T_1 \wedge T_2 <: T_1 \qquad \Gamma \vdash T_1 \wedge T_2 <: T_2
$$

$$
\frac{\Gamma \vdash S <: T_1 \qquad \Gamma \vdash S <: T_2}{\Gamma \vdash S <: T_1 \wedge T_2}
$$

Intersection types interact richly with bounded quantification. For instance, $\forall X <: T_1 \wedge T_2.\; S$ requires $X$ to satisfy both bounds simultaneously.

---

## 7. Variance

### 7.1 Definitions

In the presence of subtyping and parameterized types, *variance* describes how a type constructor's subtyping behavior relates to its arguments.

**Definition 7.1 (Variance Positions).** Let $F :: * \Rightarrow *$ be a type constructor. We say $F$ is:

- **Covariant**: if $A <: B$ implies $F\;A <: F\;B$.
- **Contravariant**: if $A <: B$ implies $F\;B <: F\;A$.
- **Invariant**: if $F$ is neither covariant nor contravariant.
- **Bivariant**: if $F$ is both covariant and contravariant (rare; usually means $F$ ignores its argument).

### 7.2 Examples

| Constructor | Variance | Explanation |
|------------|----------|-------------|
| $\lambda X.\; X$ (identity) | Covariant | $A <: B \Rightarrow A <: B$ |
| $\lambda X.\; X \to \text{Int}$ | Contravariant | Input position |
| $\lambda X.\; \text{Int} \to X$ | Covariant | Output position |
| $\lambda X.\; X \to X$ | Invariant | Both positions |
| $\lambda X.\; \text{Ref}\;X$ | Invariant | Read (covariant) + write (contravariant) |
| $\lambda X.\; \text{Int}$ (constant) | Bivariant | Ignores argument |

### 7.3 Variance and Function Types

The function type constructor $(\to) :: * \Rightarrow * \Rightarrow *$ is:

- **Contravariant** in its first argument (domain).
- **Covariant** in its second argument (codomain).

This is captured by the subtyping rule S-Arrow:

$$
\frac{\Gamma \vdash T_1 <: S_1 \qquad \Gamma \vdash S_2 <: T_2}{\Gamma \vdash S_1 \to S_2 <: T_1 \to T_2}
$$

The domain flips ($T_1 <: S_1$, note the reversal), while the codomain preserves ($S_2 <: T_2$).

### 7.4 Variance Annotations in Practice

Java uses *use-site variance* via wildcards:

```java
List<? extends Number>  // covariant use
List<? super Integer>   // contravariant use
List<?>                 // bivariant use
```

Scala and Kotlin use *declaration-site variance*:

```scala
class List[+A]          // covariant declaration
class Function1[-A, +B] // contravariant in A, covariant in B
class Cell[A]           // invariant (default)
```

C\# uses `in` and `out` keywords:

```csharp
interface IEnumerable<out T>    // covariant
interface IComparer<in T>       // contravariant
```

### 7.5 Variance Checking

Given a type constructor $F = \lambda X :: *.\; T$ and a declared variance annotation, the type checker must verify that $X$ appears only in positions consistent with the declared variance:

- **Covariant ($+$)**: $X$ appears only in covariant positions.
- **Contravariant ($-$)**: $X$ appears only in contravariant positions.
- **Invariant**: $X$ may appear anywhere.

Positions are determined by:
- The codomain of $\to$ is covariant; the domain is contravariant.
- Passing through a contravariant position flips the variance (covariant becomes contravariant and vice versa).
- Inside a $\forall X <: T.\; S$, the bound $T$ is contravariant and the body $S$ is covariant.

**Formal definition.** Define $\text{var}(X, T, p)$ where $p \in \{+, -\}$ is the current polarity:

$$
\text{var}(X, X, +) = + \qquad \text{var}(X, X, -) = -
$$

$$
\text{var}(X, Y, p) = \text{none} \quad (Y \neq X)
$$

$$
\text{var}(X, S \to T, p) = \text{var}(X, S, \overline{p}) \sqcup \text{var}(X, T, p)
$$

where $\overline{+} = -$, $\overline{-} = +$, and $\sqcup$ combines variances:

$$
+ \sqcup + = + \qquad - \sqcup - = - \qquad + \sqcup - = \text{invariant} \qquad \text{none} \sqcup v = v
$$

---

## 8. Connection to Java and C\# Generics

### 8.1 Java Bounded Type Parameters

Java's generic type parameters with bounds are a direct realization of bounded quantification:

```java
<T extends Comparable<T>> T max(T a, T b) { ... }
```

This corresponds to:

$$
\text{max} : \forall T <: \text{Comparable}(T).\; T \to T \to T
$$

Java also supports multiple bounds:

```java
<T extends Serializable & Comparable<T>> void process(T item) { ... }
```

This corresponds to intersection types in the bound: $\forall T <: \text{Serializable} \wedge \text{Comparable}(T).\; \ldots$

### 8.2 Wildcards as Bounded Existentials

Java's wildcard types correspond to bounded existential types:

```java
List<?> list;                      // exists X. List<X>
List<? extends Number> nums;       // exists X <: Number. List<X>
List<? super Integer> ints;        // exists X >: Integer. List<X>
```

The "super" variant requires *lower bounds*, which are the dual of upper bounds. In $F_{<:}$, we can encode lower bounds using Top and double negation, but the encoding is unwieldy. Modern presentations of $F_{<:}$ often include lower bounds directly.

### 8.3 Type Erasure

Java implements generics via *type erasure*: all type parameters are erased at runtime. This corresponds to the observation that in System F and $F_{<:}$, type abstractions and type applications are computationally irrelevant at runtime. The types guide the static analysis but do not affect the generated code (modulo boxing/unboxing).

Formally, there is an *erasure function* $|{-}|$ that maps $F_{<:}$ terms to an untyped lambda calculus:

$$
|x| = x \qquad |\lambda x : T.\; e| = \lambda x.\; |e| \qquad |e_1\; e_2| = |e_1|\; |e_2|
$$

$$
|\Lambda X <: T.\; e| = |e| \qquad |e\;[T]| = |e|
$$

---

## 9. Combining $F_{<:}$ with Type Operators: $F_{<:}^\omega$

### 9.1 The Full System

One can combine bounded quantification ($F_{<:}$) with type operators ($F_\omega$) to obtain $F_{<:}^\omega$:

$$
T ::= X \mid \text{Top} \mid T_1 \to T_2 \mid \forall X <: T :: K.\; T \mid \lambda X :: K.\; T \mid T_1\; T_2
$$

In this system, bounds carry kind annotations, type-level lambdas have kinded parameters, and the subtyping and kinding judgments coexist.

### 9.2 Challenges

The combination introduces significant complexity:

1. **Subtyping under type operators.** How do we compare $F\;A <: G\;B$ when $F$ and $G$ are type-level functions? We must normalize $F\;A$ and $G\;B$ before comparing.

2. **Higher-kinded bounds.** The bound in $\forall F <: G :: (* \Rightarrow *).\; T$ constrains a type operator, requiring subtyping to be extended to higher kinds.

3. **Decidability.** Even if we use kernel $F_{<:}$, the addition of type operators reintroduces normalization, and the interaction must be carefully controlled.

GHC's System FC is essentially $F_{<:}^\omega$ with type equality coercions, and it manages these interactions through a carefully designed core language.

---

## 10. Minimal and Maximal Types

### 10.1 The Role of Top and Bot

In $F_{<:}$, $\text{Top}$ serves as the maximal type: $T <: \text{Top}$ for every $T$. One can dually introduce a minimal type $\text{Bot}$ (or $\bot$): $\text{Bot} <: T$ for every $T$.

$$
\frac{}{\Gamma \vdash \text{Bot} <: T} \quad (\text{S-Bot})
$$

$\text{Bot}$ is the empty type (no values). A term of type $\text{Bot}$ represents an impossible case (dead code) and can be used in any context.

The combination of $\text{Top}$ and $\text{Bot}$ makes the subtype lattice complete: every set of types has a least upper bound and greatest lower bound.

### 10.2 Top and Bot in Bounded Quantification

With $\text{Bot}$, we can express *lower-bounded* quantification:

$$
\forall X.\; \text{Bot} <: X <: T.\; S
$$

This says $X$ is constrained to be between $\text{Bot}$ and $T$, i.e., $X <: T$. An upper bound alone suffices. But lower bounds become important for existential types and wildcards.

Java's `? super T` corresponds to a lower-bounded existential:

$$
\exists X.\; T <: X.\; \text{List}\;X
$$

### 10.3 Joins and Meets

The *join* $S \vee T$ is the least upper bound: the smallest type $U$ such that $S <: U$ and $T <: U$. The *meet* $S \wedge T$ is the greatest lower bound.

In kernel $F_{<:}$, joins and meets do not always exist (the subtype relation is not a lattice in general). This complicates type inference, because conditional expressions like $\text{if}\; b\; \text{then}\; e_1\; \text{else}\; e_2$ require computing the join of the types of $e_1$ and $e_2$.

**Proposition 10.1.** In kernel $F_{<:}$ with records, the join of $\{a : \text{Int}, b : \text{Bool}\}$ and $\{a : \text{Int}, c : \text{String}\}$ is $\{a : \text{Int}\}$ (the common fields with compatible types).

---

## 11. Worked Subtyping Derivations

### 11.1 Record Width and Depth Subtyping

Show: $\{x : \text{Nat}, y : \text{Nat}, color : \text{String}\} <: \{x : \text{Nat}, y : \text{Nat}\}$.

By SA-Rcd:
- Fields of the right: $\{x, y\}$.
- Check: $\{x, y\} \subseteq \{x, y, \text{color}\}$. Yes.
- Check: $\text{Nat} <: \text{Nat}$ for $x$. Yes, by SA-Refl.
- Check: $\text{Nat} <: \text{Nat}$ for $y$. Yes, by SA-Refl.
- Conclusion: $\{x : \text{Nat}, y : \text{Nat}, \text{color} : \text{String}\} <: \{x : \text{Nat}, y : \text{Nat}\}$. $\checkmark$

### 11.2 Arrow Subtyping

Show: $(\text{Top} \to \text{Nat}) <: (\text{Nat} \to \text{Top})$.

By SA-Arrow:
- Check domain (contravariant): $\text{Nat} <: \text{Top}$. Yes, by SA-Top.
- Check codomain (covariant): $\text{Nat} <: \text{Top}$. Yes, by SA-Top.
- Conclusion: $(\text{Top} \to \text{Nat}) <: (\text{Nat} \to \text{Top})$. $\checkmark$

### 11.3 Bounded Quantification Subtyping

Show: $(\forall X <: \{a : \text{Int}\}.\; X \to X) <: (\forall X <: \{a : \text{Int}\}.\; X \to \text{Top})$.

By SA-All (kernel):
- Check bounds (contravariant): $\{a : \text{Int}\} <: \{a : \text{Int}\}$. Yes, by SA-Refl.
- Check body (covariant), under $X <: \{a : \text{Int}\}$: $X \to X <: X \to \text{Top}$.
  - By SA-Arrow: domain $X <: X$ (SA-Refl) and codomain $X <: \text{Top}$ (SA-Top). $\checkmark$

### 11.4 A Failed Derivation

Attempt: $(\{a : \text{Int}\} \to \text{Int}) <: (\text{Top} \to \text{Int})$.

By SA-Arrow:
- Check domain (contravariant): need $\text{Top} <: \{a : \text{Int}\}$. This requires $\text{Top}$ to have a field $a : \text{Int}$. But $\text{Top}$ is not a record type with any specific fields. Fails.

Intuitively: a function that can handle any input ($\text{Top}$) is more restrictive than one that only accepts records with an $a$ field. The direction of subtyping for function domains is contravariant.

---

## 12. Exercises

**Exercise 12.1.** Derive the subtyping judgment:

$$
\emptyset \vdash (\forall X <: \{a : \text{Nat}, b : \text{Bool}\}.\; X \to X) <: (\forall X <: \{a : \text{Nat}\}.\; X \to X)
$$

using the kernel $F_{<:}$ rules. Show every step.

**Exercise 12.2.** Consider the typing judgment:

$$
\Gamma \vdash (\Lambda X <: \{m : \text{Nat}\}.\; \lambda x : X.\; x.m)\;[\{m : \text{Nat}, n : \text{Bool}\}] : ?
$$

Derive the type and verify that the subtyping obligation in T-TApp is met.

**Exercise 12.3.** Prove the Canonical Forms Lemma for $F_{<:}$: if $\emptyset \vdash v : T_1 \to T_2$, then $v = \lambda x : S.\; e$ for some $S$ and $e$. Be careful about T-Sub.

**Exercise 12.4.** Show that the following subtyping is *not* derivable in kernel $F_{<:}$ but *is* derivable in full $F_{<:}$:

Let $\text{Pair}(X) = X \times X$. Show:

$$
\Gamma \vdash (\forall X <: \text{Top}.\; \text{Pair}(X)) <: (\forall X <: \text{Nat}.\; \text{Pair}(X))
$$

in full $F_{<:}$ but not kernel $F_{<:}$. (Hint: consider what bound $X$ receives in the body.)

**Exercise 12.5.** Determine the variance of each type parameter in the following type constructors:

(a) $\lambda X.\; X \to \text{Bool}$

(b) $\lambda X.\; (\text{Int} \to X) \to X$

(c) $\lambda X.\; (X \to X) \to \text{Int}$

(d) $\lambda X.\; \forall Y <: X.\; Y \to \text{Int}$

**Exercise 12.6.** Prove that if $\Gamma \vdash S <: T$ in kernel $F_{<:}$, then $\text{FTV}(S) \cup \text{FTV}(T) \subseteq \text{dom}(\Gamma)$, where $\text{FTV}$ denotes free type variables.

**Exercise 12.7.** Encode bounded existential types $\exists X <: T_1.\; T_2$ using bounded universal types $\forall$. (Hint: analogous to the System F encoding of existentials.) State the pack and unpack operations and verify the reduction behavior.

**Exercise 12.8.** Java allows the following:

```java
<T extends Comparable<T> & Serializable> void process(List<T> items) { ... }
```

Formalize this in $F_{<:}$ with intersection types. What are the subtyping obligations when calling `process` with `List<Integer>`?

---

## 13. Algorithmic Typing for $F_{<:}$

### 13.1 The Problem with T-Sub

The typing rules in Section 2.3 include the subsumption rule T-Sub:

$$
\frac{\Gamma \vdash e : S \qquad \Gamma \vdash S <: T}{\Gamma \vdash e : T}
$$

This rule is not syntax-directed: it can be applied at any point in a derivation, to any term, to "upcast" its type. An algorithm cannot decide when and where to apply T-Sub.

### 13.2 The Solution: Push-Down

The standard solution is to "push" subsumption into the other rules. Instead of a separate T-Sub rule, each rule that compares types incorporates a subtyping check:

**Algorithmic T-App:**

$$
\frac{\Gamma \vdash_a e_1 : T \qquad T \downarrow (T_1 \to T_2) \qquad \Gamma \vdash_a e_2 : S \qquad \Gamma \vdash S <: T_1}{\Gamma \vdash_a e_1\; e_2 : T_2}
$$

where $T \downarrow (T_1 \to T_2)$ means "$T$ is an arrow type (after normalization and exposure of the shape)." If $T$ is a type variable $X$ with bound $U$, we must *expose* the arrow shape by following the bound.

**Algorithmic T-TApp:**

$$
\frac{\Gamma \vdash_a e : T \qquad T \downarrow (\forall X <: T_1.\; T_2) \qquad \Gamma \vdash S <: T_1}{\Gamma \vdash_a e\;[S] : [X \mapsto S]T_2}
$$

### 13.3 Minimal Typing

The algorithmic type checker computes the *minimal type* of each expression --- the most specific type derivable without using T-Sub. The subsumption rule is then applied only at comparison points (function application, type application, etc.).

**Theorem 13.1.** Every well-typed $F_{<:}$ term has a unique minimal type, and the algorithmic type checker computes it.

*Proof sketch.* By induction on the term. For variables, the minimal type is the type assigned in the context. For abstractions, the annotation provides the domain type, and the body's minimal type provides the codomain. For applications, the argument's minimal type is checked against the function's domain via subtyping. $\square$

---

## 14. Connecting to the Rest of the Course

### 14.1 Backward: Subtyping Without Polymorphism

Module 04 introduced subtyping for the simply-typed lambda calculus: width and depth subtyping for records, covariance/contravariance for function types. $F_{<:}$ extends this with polymorphism, adding bounded quantification. The subtyping rules for records and arrows are unchanged; the new ingredient is S-All.

### 14.2 Backward: Polymorphism Without Subtyping

Module 06 introduced System F with parametric polymorphism. In System F, type variables range over *all* types without constraint. $F_{<:}$ adds the ability to constrain type variables with upper bounds, combining the flexibility of polymorphism with the expressiveness of subtyping.

### 14.3 Forward: The Lambda Cube

$F_{<:}$ does not appear directly in the lambda cube (which does not model subtyping). However, bounded quantification can be seen as a form of *qualified type* --- a type with a constraint. Lecture 07d discusses how systems like $F_{<:}$ fit into the broader landscape of type systems.

### 14.4 Forward: Dependent Types

In dependent type systems (Module 08), bounded quantification is subsumed by *subset types* and *sigma types*. Instead of $\forall X <: T.\; S$, one can write $\Pi X : T.\; S$ where $T$ itself constrains $X$ through its propositional content. However, the interaction between subtyping and dependent types is an active research area (e.g., coercive subtyping in Coq).

---

## Summary

- **Bounded quantification** ($\forall X <: T_1.\; T_2$) combines parametric polymorphism with subtyping, allowing type variables to be constrained by upper bounds.
- **System $F_{<:}$** extends System F with subtyping and bounded type variables. It has two variants: **kernel $F_{<:}$** (decidable) and **full $F_{<:}$** (undecidable subtyping, Pierce 1994).
- The **typing rules** require that type arguments satisfy their bounds (T-TApp checks $S <: T_1$), and the **subsumption rule** T-Sub allows implicit upcasting.
- **Type safety** (progress and preservation) holds for $F_{<:}$. The proofs require the Narrowing Lemma and careful handling of subsumption.
- **Decidability**: Kernel $F_{<:}$ has decidable subtyping; full $F_{<:}$ does not. The undecidability arises from the ability of the full S-All rule to create feedback loops that simulate counter machines.
- **Variance** (covariance, contravariance, invariance) describes how subtyping interacts with parameterized types. Practical languages (Java, Scala, C\#, Kotlin) provide variance annotations at use sites or declaration sites.
- **F-bounded quantification** ($\forall X <: F(X).\; T$) allows the bound to refer to the quantified variable, enabling patterns like Java's `Comparable<T>`.
- $F_{<:}$ directly models bounded generics in Java and C\#, wildcards as bounded existentials, and variance annotations.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapters 26 and 28. The primary textbook reference for $F_{<:}$.

2. **Cardelli, L. and Wegner, P.** (1985). "On Understanding Types, Data Abstraction, and Polymorphism." The paper that introduced bounded quantification.

3. **Cardelli, L., Martini, S., Mitchell, J. C., and Scedrov, A.** (1994). "An Extension of System F with Subtyping." The foundational paper on $F_{<:}$.

4. **Pierce, B. C.** (1994). "Bounded Quantification is Undecidable." The proof that full $F_{<:}$ subtyping is undecidable.

5. **Canning, P., Cook, W., Hill, W., Olthoff, W., and Mitchell, J. C.** (1989). "F-Bounded Polymorphism for Object-Oriented Programming." Introduces F-bounded quantification.

6. **Igarashi, A., Pierce, B. C., and Wadler, P.** (2001). "Featherweight Java: A Minimal Core Calculus for Java and GJ." A formal calculus for Java generics based on $F_{<:}$.

7. **Kennedy, A. and Pierce, B. C.** (2007). "On Decidability of Nominal Subtyping with Variance." Studies decidability for variance in generic type systems.

8. **Tate, R., Leung, A., and Lerner, S.** (2011). "Taming Wildcards in Java's Type System." A formal analysis of Java wildcards as bounded existentials.
