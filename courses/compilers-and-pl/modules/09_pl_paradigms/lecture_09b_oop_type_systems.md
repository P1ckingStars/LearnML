# Lecture 09b: Object-Oriented Languages & Advanced Type Systems

## Prerequisites

- Type theory basics, subtyping (Module 03), basic familiarity with Java/C++/Scala.

---

## 1. Objects, Classes, and Inheritance

### 1.1 The Object Model

An **object** encapsulates:
- **State**: a collection of mutable (or immutable) fields.
- **Behavior**: a collection of methods that operate on that state.
- **Identity**: each object is a distinct entity, even if its state matches another's.

A **class** is a blueprint for objects, defining the layout of fields and the implementation of methods.

### 1.2 Subtyping and Inheritance

**Subtype relation.** We write $\tau <: \sigma$ if a value of type $\tau$ can be used wherever a value of type $\sigma$ is expected (Liskov substitution principle).

**Inheritance** is an implementation mechanism: class $B$ extends class $A$ means $B$ inherits $A$'s fields and methods and may override or extend them.

**Key distinction:** Subtyping is a semantic relation on types; inheritance is a syntactic/implementation relation on classes. They often coincide (e.g., in Java, `B extends A` implies `B <: A`), but they are conceptually independent.

### 1.3 Formal Typing Rules for Objects

In Featherweight Java (Igarashi, Pierce, Wadler, 2001), the typing rule for method invocation is:

$$
\frac{\Gamma \vdash e_0 : C_0 \quad \text{mtype}(m, C_0) = \overline{D} \to C \quad \Gamma \vdash \overline{e} : \overline{C'} \quad \overline{C'} <: \overline{D}}{\Gamma \vdash e_0.m(\overline{e}) : C}
$$

where $\text{mtype}(m, C_0)$ looks up method $m$ in class $C_0$ (or its ancestors).

---

## 2. Virtual Dispatch and VTable Implementation

### 2.1 The Dispatch Problem

When a method is called on an object whose dynamic type may differ from its static type (due to subtyping), the runtime must determine which implementation to invoke. This is **dynamic dispatch**.

### 2.2 VTable Layout

The standard implementation (C++, Java) uses a **virtual method table (vtable)**.

**Object layout:**

```
+------------------+
| vptr             | ---> VTable for the dynamic class
+------------------+
| field_1          |
| field_2          |
| ...              |
| field_n          |
+------------------+
```

**VTable layout:**

```
VTable for class B (extends A):
+------------------+
| &B::method_0     |   (possibly inherited from A, or overridden)
| &B::method_1     |
| ...              |
| &B::method_k     |   (new methods added by B)
+------------------+
```

### 2.3 Dispatch Mechanism

A virtual method call `obj.method_i(args)` compiles to:

```
load vptr from obj          // obj->vptr
load fptr from vptr[i]      // vtable[i]
call fptr(obj, args)        // indirect call
```

**Time complexity:** $O(1)$ -- a constant number of memory loads regardless of the class hierarchy depth.

**Space complexity:** One vtable per class (shared by all instances), one vptr per object.

### 2.4 Devirtualization

When the compiler can statically determine the target of a virtual call (e.g., the object was just constructed, or the method is `final`), it can replace the indirect call with a direct call. This enables **inlining**, which is critical for performance.

---

## 3. Multiple Inheritance and the Diamond Problem

### 3.1 Multiple Inheritance

A class $C$ inherits from multiple parent classes $A_1, A_2, \ldots, A_k$:

$$
C <: A_1, \quad C <: A_2, \quad \ldots, \quad C <: A_k
$$

### 3.2 The Diamond Problem

```
        A
       / \
      B   C
       \ /
        D
```

Class $D$ inherits from both $B$ and $C$, which both inherit from $A$. Questions arise:

1. **Which copy of $A$'s fields does $D$ have?** One (shared) or two (replicated)?
2. **If $B$ and $C$ both override a method $m$ from $A$, which does $D$ inherit?**

### 3.3 C++ Virtual Inheritance

C++ resolves the diamond via **virtual inheritance**:

```cpp
class B : virtual public A { ... };
class C : virtual public A { ... };
class D : public B, public C { ... };
```

With virtual inheritance, $D$ contains a single shared $A$ sub-object. The vtable includes **virtual base offsets** so that casting from $D$ to $A$ can be performed at runtime.

**Object layout with virtual inheritance (simplified):**

```
D object:
+------------------+
| D::vptr          | ---> D's vtable (includes vbase offsets)
| D's own fields   |
+------------------+
| B::vptr          | ---> B-in-D vtable
| B's own fields   |
+------------------+
| C::vptr          | ---> C-in-D vtable
| C's own fields   |
+------------------+
| A's fields       |   <-- shared A sub-object (at variable offset)
+------------------+
```

### 3.4 Cardelli's Semantics

Cardelli (1984) provided a denotational semantics for multiple inheritance treating records as functions from labels to values. If $A$ and $B$ both provide label $l$, the inheriting class must explicitly resolve the conflict. This is formalized as:

$$
\text{override}(r_1, r_2)(l) = \begin{cases} r_2(l) & \text{if } l \in \text{dom}(r_2) \\ r_1(l) & \text{otherwise} \end{cases}
$$

---

## 4. Mixins, Traits, and Structural Typing

### 4.1 Mixins

A **mixin** is a class fragment intended to be composed with other classes. It provides methods but does not stand alone. Linearization determines the order in which mixins are applied.

**C3 linearization** (used by Python, Scala): Given class $C$ extending $B_1, \ldots, B_n$:

$$
L(C) = C + \text{merge}(L(B_1), \ldots, L(B_n), [B_1, \ldots, B_n])
$$

where $\text{merge}$ selects heads that do not appear in the tail of any other list.

### 4.2 Traits

**Traits** (Scharli et al., 2003) are like mixins but with explicit conflict resolution:
- Traits provide methods but no state (in the pure form).
- If two traits provide the same method, the composing class must explicitly resolve the conflict.
- Traits support **symmetric composition** (order does not matter, unlike mixins).

### 4.3 Structural Typing

In **structural typing** (also called duck typing in a type-safe form), type compatibility is based on the structure (set of methods/fields) rather than declared class names.

**Typing rule for structural subtyping:**

$$
\frac{\forall (m_i : \tau_i) \in \sigma.\; \exists (m_i : \tau_i') \in \tau.\; \tau_i' <: \tau_i}{\tau <: \sigma}
$$

Languages: Go (interfaces), TypeScript (object types), OCaml (object types).

Contrast with **nominal typing** (Java, C#): $\tau <: \sigma$ only if $\tau$ is explicitly declared to extend/implement $\sigma$.

---

## 5. Generics and Parametric Polymorphism

### 5.1 Parametric Polymorphism

A **parametrically polymorphic** function has a type of the form $\forall \alpha.\; \tau(\alpha)$ and behaves uniformly for all instantiations of $\alpha$.

**Theorems for free (Wadler, 1989).** From the type alone, one can derive properties. For example, any function $f : \forall \alpha.\; [\alpha] \to [\alpha]$ must satisfy:

$$
\text{map}\;g \circ f = f \circ \text{map}\;g
$$

for all $g$. This follows from the **parametricity theorem** (Reynolds, 1983).

### 5.2 Bounded Quantification

**F-bounded polymorphism** (Canning et al., 1989) allows quantification over types that satisfy a bound:

$$
\forall \alpha <: \sigma.\; \tau(\alpha)
$$

Example (Java): `<T extends Comparable<T>> T max(T a, T b)`.

The typing rule:

$$
\frac{\Gamma, \alpha <: \sigma \vdash e : \tau}{\Gamma \vdash \Lambda \alpha <: \sigma.\; e : \forall \alpha <: \sigma.\; \tau}
$$

### 5.3 Type Classes (Wadler & Blott, 1989)

Haskell uses **type classes** as an alternative to bounded quantification:

$$
\text{class Eq}\;\alpha\;\text{where}\; (==) : \alpha \to \alpha \to \text{Bool}
$$

A type class constraint $\text{Eq}\;\alpha \Rightarrow \tau$ is compiled to an extra **dictionary argument**: a record of method implementations passed at runtime.

**Dictionary-passing translation:**

```
-- Source
elem :: Eq a => a -> [a] -> Bool

-- Compiled (approximately)
elem :: EqDict a -> a -> [a] -> Bool
elem dict x []     = False
elem dict x (y:ys) = eqMethod dict x y || elem dict x ys
```

---

## 6. Variance in Generics

### 6.1 Definitions

Given a parameterized type $F[\alpha]$ and the subtype relation $A <: B$:

- **Covariant** ($F$ is covariant in $\alpha$, written $F[+\alpha]$): $A <: B \implies F[A] <: F[B]$
- **Contravariant** ($F[-\alpha]$): $A <: B \implies F[B] <: F[A]$
- **Invariant**: Neither covariant nor contravariant.

### 6.2 The Function Type

The function type constructor $\to$ is **contravariant in the argument** and **covariant in the result**:

$$
\frac{A' <: A \quad B <: B'}{A \to B \;<:\; A' \to B'}
$$

*Proof.* If $f : A \to B$ and we need $f' : A' \to B'$, given $x : A'$, since $A' <: A$, we can pass $x$ to $f$. Since $f(x) : B$ and $B <: B'$, the result has type $B'$. $\square$

### 6.3 Java Arrays: The Covariance Bug

Java arrays are **covariantly typed**: if $A <: B$ then $A[] <: B[]$. This is unsound:

```java
Integer[] ints = new Integer[]{1, 2, 3};
Object[] objs = ints;        // allowed by covariance
objs[0] = "hello";           // compiles, but throws ArrayStoreException at runtime
```

Java generics are **invariant** by default, with **use-site variance** via wildcards:

- `List<? extends B>` -- covariant usage (read-only)
- `List<? super A>` -- contravariant usage (write-only)

### 6.4 Declaration-Site Variance

Scala, Kotlin, and C# support **declaration-site variance**:

```scala
trait List[+A]           // covariant
trait Function1[-A, +B]  // contravariant in A, covariant in B
```

The compiler enforces that covariant parameters appear only in "positive" (output) positions and contravariant parameters only in "negative" (input) positions.

**Formal rule.** A type parameter $\alpha$ is in **positive position** in:
- The return type of a method
- The type argument of a covariant type parameter of an enclosing type

And in **negative position** in:
- The parameter type of a method
- The type argument of a contravariant type parameter of an enclosing type

Positions compose: negative of negative = positive, etc.

---

## 7. Type Erasure vs. Reification

### 7.1 Type Erasure (Java)

Java generics are implemented via **type erasure**: generic type information is removed at compile time.

$$
\text{List}<\text{Integer}> \;\xrightarrow{\text{erasure}}\; \text{List}
$$

Consequences:
- Cannot use `instanceof` with generic types.
- Cannot create generic arrays: `new T[]` is illegal.
- All instantiations share the same bytecode (space-efficient).

### 7.2 Reification (C#, .NET)

C# generics are **reified**: type parameters exist at runtime.

$$
\text{List}<\text{int}> \neq \text{List}<\text{string}> \quad \text{at runtime}
$$

Consequences:
- `typeof(T)` is available at runtime.
- Value types (e.g., `int`) are not boxed -- the runtime generates specialized code.
- More runtime overhead per distinct instantiation (code specialization).

### 7.3 C++ Templates: Monomorphization

C++ templates are **monomorphized**: a separate copy of the code is generated for each instantiation at compile time. This provides maximum optimization opportunities but leads to code bloat and long compile times.

### 7.4 Comparison

| Approach | Runtime type info | Specialization | Code sharing | Compilation |
|----------|------------------|----------------|-------------|-------------|
| Erasure (Java) | No | No | Yes (one copy) | Fast |
| Reification (C#) | Yes | Partial (value types) | Partial | Moderate |
| Monomorphization (C++) | N/A (static) | Full | No | Slow |

---

## 8. Existential Types

### 8.1 Definition

An **existential type** $\exists \alpha.\; \tau(\alpha)$ hides the concrete type, exposing only the interface.

$$
\frac{\Gamma \vdash e : \tau[S/\alpha]}{\Gamma \vdash \text{pack}\;(S, e) : \exists \alpha.\;\tau(\alpha)} \quad (\text{Pack / Introduction})
$$

$$
\frac{\Gamma \vdash e_1 : \exists \alpha.\;\tau(\alpha) \quad \Gamma, \alpha, x : \tau(\alpha) \vdash e_2 : \sigma \quad \alpha \notin \text{FTV}(\sigma)}{\Gamma \vdash \text{unpack}\;(\alpha, x) = e_1\;\text{in}\;e_2 : \sigma} \quad (\text{Unpack / Elimination})
$$

### 8.2 Objects as Existentials

Mitchell and Plotkin (1988) showed that objects can be modeled as existential types:

$$
\text{Object} = \exists \alpha.\; (\alpha \times (\alpha \to \text{Int}) \times (\alpha \to \alpha))
$$

Here $\alpha$ is the hidden representation type, and the tuple contains the state and methods. The consumer cannot inspect $\alpha$ directly -- only use it through the provided methods.

### 8.3 Existentials in Practice

In Haskell (with extensions):

```haskell
data Showable = forall a. Show a => MkShowable a
-- MkShowable :: forall a. Show a => a -> Showable
-- (this is existential quantification)

showAll :: [Showable] -> [String]
showAll = map (\(MkShowable x) -> show x)
```

---

## 9. Generalized Algebraic Data Types (GADTs)

### 9.1 Definition

A **GADT** (Generalized Algebraic Data Type) allows constructors to produce different instantiations of the type being defined.

Standard ADT:

$$
\text{data}\;\text{Expr}\;a = \text{Lit}\;\text{Int} \mid \text{Add}\;(\text{Expr}\;a)\;(\text{Expr}\;a)
$$

GADT:

$$
\text{data}\;\text{Expr}\;a\;\text{where}
$$
$$
\text{Lit} : \text{Int} \to \text{Expr}\;\text{Int}
$$
$$
\text{BLit} : \text{Bool} \to \text{Expr}\;\text{Bool}
$$
$$
\text{Add} : \text{Expr}\;\text{Int} \to \text{Expr}\;\text{Int} \to \text{Expr}\;\text{Int}
$$
$$
\text{If} : \text{Expr}\;\text{Bool} \to \text{Expr}\;a \to \text{Expr}\;a \to \text{Expr}\;a
$$

### 9.2 Type Refinement via Pattern Matching

When pattern matching on a GADT constructor, the type parameter is **refined**:

```haskell
eval :: Expr a -> a
eval (Lit n)      = n        -- here a ~ Int
eval (BLit b)     = b        -- here a ~ Bool
eval (Add e1 e2)  = eval e1 + eval e2
eval (If c t e)   = if eval c then eval t else eval e
```

The key property: pattern matching on `Lit n` introduces the constraint $a \sim \text{Int}$, allowing the right-hand side to return an `Int` where an `a` is expected.

### 9.3 Typing GADTs

**Typing rule for GADT pattern matching:**

$$
\frac{C : \forall \overline{b}.\; \overline{\tau} \to T\;\overline{\sigma} \quad \theta = \text{unify}(\overline{\sigma}, \overline{\alpha}) \quad \Gamma, \overline{b}, \overline{x : \theta(\tau_i)} \vdash e_i : \theta(\rho)}{\text{branch } C\;\overline{x} \to e_i \text{ well-typed at type } \rho \text{ in case on } T\;\overline{\alpha}}
$$

### 9.4 Type Inference Challenges

GADTs make type inference **undecidable** in general. Practical systems (GHC) require type annotations on functions that perform GADT pattern matching:

**Theorem (Peyton Jones et al., 2006).** Type inference for GADTs without annotations is undecidable. With annotations on GADT-matching functions, inference is decidable using **OutsideIn(X)** constraint solving.

---

## 10. Summary

| Concept | Key Mechanism | Trade-off |
|---------|--------------|-----------|
| Virtual dispatch | VTable + indirect call | Flexibility vs. call overhead |
| Multiple inheritance | Virtual base classes / C3 linearization | Expressiveness vs. complexity |
| Traits | Symmetric composition, explicit conflict resolution | Safer than mixins |
| Generics variance | Co/contra/invariant positions | Expressiveness vs. type safety |
| Type erasure | Remove type params at compile time | Efficiency vs. runtime info |
| Reification | Retain type params at runtime | Runtime info vs. code bloat |
| Existential types | Hide representation type | Abstraction vs. restricted use |
| GADTs | Refine type via pattern matching | Expressiveness vs. inference complexity |

---

## References

1. Cardelli, L. (1984). "A semantics of multiple inheritance." *Semantics of Data Types*, LNCS 173, 51--67.
2. Wadler, P. & Blott, S. (1989). "How to make ad-hoc polymorphism less ad hoc." *POPL '89*, 60--76.
3. Igarashi, A., Pierce, B. C., & Wadler, P. (2001). "Featherweight Java: A minimal core calculus for Java and GJ." *ACM TOPLAS*, 23(3), 396--450.
4. Wadler, P. (1989). "Theorems for free!" *FPCA '89*.
5. Reynolds, J. C. (1983). "Types, abstraction and parametric polymorphism." *Information Processing '83*.
6. Mitchell, J. C. & Plotkin, G. D. (1988). "Abstract types have existential type." *ACM TOPLAS*, 10(3), 470--502.
7. Peyton Jones, S., Vytiniotis, D., Weirich, S., & Shields, M. (2006). "Practical type inference for arbitrary-rank types." *JFP*, 17(1).
8. Scharli, N., Ducasse, S., Nierstrasz, O., & Black, A. (2003). "Traits: Composable units of behavior." *ECOOP '03*.
9. Canning, P., Cook, W., Hill, W., Olthoff, W., & Mitchell, J. (1989). "F-bounded polymorphism for object-oriented programming." *FPCA '89*.
10. Liskov, B. (1987). "Data abstraction and hierarchy." *OOPSLA '87 Addendum*.
