---
title: "Lecture 04d: Records, Variants & Object Types"
tags:
  - type-theory
  - subtyping
  - lecture
---
# Lecture 04d: Records, Variants & Object Types

> **Module 04 -- Subtyping (Weeks 7-8)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** record types formally and state their typing and evaluation rules.
2. **Prove** width, depth, and permutation subtyping for records and justify each rule operationally.
3. **Define** variant types and derive their subtyping rules (dual to records).
4. **Connect** record subtyping to the foundations of object-oriented type systems.
5. **Explain** how structural subtyping relates to TypeScript's type system and OCaml's polymorphic variants.
6. **Distinguish** structural subtyping from nominal subtyping and analyze the trade-offs.
7. **Formulate** bounded polymorphism as a combination of subtyping and parametric polymorphism.
8. **Analyze** the complications introduced by mutable fields and method override in object-oriented settings.

---

## 1. Motivation

### 1.1 From Tuples to Records

In Modules 02-03, we worked with product types $T_1 \times T_2$ (pairs) where components are accessed by position: $t.1$ and $t.2$. This is adequate for small tuples but does not scale: a 10-component tuple where you access $t.7$ is unreadable and error-prone.

**Record types** name each component with a label, allowing access by name rather than position: $t.\text{name}$, $t.\text{age}$, $t.\text{email}$. Labels make programs self-documenting and enable a rich subtyping structure that positional tuples lack.

### 1.2 Why Records Matter for Subtyping

Records are where subtyping shows its full power. The three dimensions of record subtyping -- width, depth, and permutation -- capture natural notions of compatibility:

- **Width**: a record with more fields can be used where fewer are needed. This models the "interface" concept in OOP: if I need an object with method `.draw()`, I accept any object that has `.draw()` and possibly more.

- **Depth**: a record whose field types are more specific can be used where less specific field types are needed. This models covariant method return types.

- **Permutation**: the order of fields does not matter. This is natural for named access.

### 1.3 Records and Objects

Record types provide a type-theoretic foundation for object-oriented programming. An object can be modeled as a record of methods (functions) and fields (data). Subtyping for records then corresponds to the notion of interface compatibility in OOP.

This lecture develops the theory of records and their subtyping in detail, then explores the connection to objects, variants, and real-world type systems.

---

## 2. Record Types

### 2.1 Syntax

**Record types:**

$$T ::= \cdots \mid \{l_1 : T_1, l_2 : T_2, \ldots, l_n : T_n\}$$

where $l_1, \ldots, l_n$ are pairwise distinct labels drawn from a countable set $\mathcal{L}$.

We write $\{l_i : T_i\}_{i \in 1..n}$ as shorthand for $\{l_1 : T_1, \ldots, l_n : T_n\}$.

**Record terms:**

$$t ::= \cdots \mid \{l_1 = t_1, l_2 = t_2, \ldots, l_n = t_n\} \mid t.l$$

**Record values:**

$$v ::= \cdots \mid \{l_1 = v_1, l_2 = v_2, \ldots, l_n = v_n\}$$

A record value is a record where every component is a value.

### 2.2 Typing Rules

$$\frac{\Gamma \vdash t_i : T_i \quad \text{for each } i \in 1..n}{\Gamma \vdash \{l_i = t_i\}_{i \in 1..n} : \{l_i : T_i\}_{i \in 1..n}} \quad \text{(T-Rcd)}$$

$$\frac{\Gamma \vdash t : \{l_i : T_i\}_{i \in 1..n} \qquad j \in 1..n}{\Gamma \vdash t.l_j : T_j} \quad \text{(T-Proj)}$$

### 2.3 Evaluation Rules

$$\frac{t_j \to t_j' \qquad \text{all } t_i \text{ with } i < j \text{ are values}}{\{l_1 = v_1, \ldots, l_{j-1} = v_{j-1}, l_j = t_j, \ldots, l_n = t_n\} \to \{l_1 = v_1, \ldots, l_{j-1} = v_{j-1}, l_j = t_j', \ldots, l_n = t_n\}} \; \text{(E-Rcd)}$$

$$\frac{t \to t'}{t.l \to t'.l} \quad \text{(E-Proj)}$$

$$\frac{j \in 1..n}{\{l_i = v_i\}_{i \in 1..n}.l_j \to v_j} \quad \text{(E-ProjRcd)}$$

Records are evaluated left-to-right: each field is evaluated in order, and projection of a record value extracts the field.

### 2.4 The Empty Record

The empty record $\{\ \}$ has type $\{\ \}$ and is a value. Every record type is a subtype of $\{\ \}$ (by width subtyping). Note that $\{\ \} <: \top$ by S-Top, and $\{l_i : T_i\} <: \{\ \}$ by S-RcdWidth (or S-Rcd with $n = 0$).

If we identify $\{\ \}$ with the unit type $\text{Unit}$, then the empty record serves as the trivial value.

---

## 3. Record Subtyping in Detail

### 3.1 Width Subtyping

$$\frac{}{\{l_i : T_i\}_{i \in 1..n+k} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-RcdWidth)} \qquad (k \geq 0)$$

A record with additional fields is a subtype. The extra fields ($l_{n+1}, \ldots, l_{n+k}$) are simply "forgotten" when the record is viewed at the supertype.

**Operational justification.** If a context expects $\{l_i : T_i\}_{i \in 1..n}$ and receives $\{l_i = v_i\}_{i \in 1..n+k}$, it will only project fields $l_1, \ldots, l_n$. The extra fields $l_{n+1}, \ldots, l_{n+k}$ are never accessed, so their presence causes no harm.

**Example 3.1.**

$$\{name : \text{String}, age : \text{Nat}, email : \text{String}\} <: \{name : \text{String}, age : \text{Nat}\}$$

A "person" record with all three fields can be used where only "name" and "age" are needed.

### 3.2 Depth Subtyping

$$\frac{S_1 <: T_1 \quad \cdots \quad S_n <: T_n}{\{l_i : S_i\}_{i \in 1..n} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-RcdDepth)}$$

Individual field types may be refined. If each $S_i <: T_i$, then the record with more specific field types is a subtype.

**Operational justification.** If a context projects field $l_j$ and expects a $T_j$, it gets a value of type $S_j$. Since $S_j <: T_j$, this value is safely usable as a $T_j$.

**Example 3.2.** Suppose $\text{Dog} <: \text{Animal}$ and $\text{Poodle} <: \text{Dog}$. Then:

$$\{pet : \text{Poodle}, toys : \text{Nat}\} <: \{pet : \text{Dog}, toys : \text{Nat}\} <: \{pet : \text{Animal}, toys : \text{Nat}\}$$

### 3.3 Permutation Subtyping

$$\frac{\{k_j : S_j\}_{j \in 1..n} \text{ is a permutation of } \{l_i : T_i\}_{i \in 1..n}}{\{k_j : S_j\}_{j \in 1..n} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-RcdPerm)}$$

The order of fields is irrelevant for typing purposes. Records are accessed by name, not by position.

**Example 3.3.**

$$\{age : \text{Nat}, name : \text{String}\} <: \{name : \text{String}, age : \text{Nat}\}$$

and vice versa (mutual subtypes, hence equivalent).

### 3.4 The Combined Rule

As noted in Lecture 04a, the three dimensions combine into a single rule:

$$\frac{\forall i \in 1..n.\; \exists j \in 1..m.\; k_j = l_i \wedge S_j <: T_i}{\{k_j : S_j\}_{j \in 1..m} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-Rcd)}$$

This subsumes width (the subtype may have more fields, $m \geq n$), depth (each field type may be refined, $S_j <: T_i$), and permutation (matching is by label, not position).

### 3.5 Formal Properties

**Proposition 3.4.** Record subtyping is a preorder (reflexive and transitive).

*Proof.* Reflexivity: for each $i$, take $j = i$; then $l_j = l_i$ and $T_i <: T_i$ by S-Refl. Transitivity: compose the witness functions from $S <: U$ and $U <: T$, using transitivity of component subtyping. $\square$

**Proposition 3.5.** $\{l_i : T_i\}_{i \in 1..n} <: \{\ \}$ for all record types.

*Proof.* The supertype $\{\ \}$ has no fields ($n = 0$), so the condition is vacuously satisfied. $\square$

**Proposition 3.6.** If $\{l_i : S_i\}_{i \in 1..m} <: \{l_j : T_j\}_{j \in 1..n}$, then the labels of the supertype are a subset of the labels of the subtype: $\{l_1, \ldots, l_n\} \subseteq \{l_1, \ldots, l_m\}$.

*Proof.* For each $l_i$ in the supertype, the rule requires a matching label $k_j = l_i$ in the subtype. $\square$

---

## 4. Variant Types and Their Subtyping

### 4.1 Variant Types

While records allow a value to contain all listed fields simultaneously (a conjunction), **variant types** allow a value to be one of several alternatives (a disjunction). We generalize binary sum types $T_1 + T_2$ to labeled variants.

**Syntax:**

$$T ::= \cdots \mid \langle l_1 : T_1, l_2 : T_2, \ldots, l_n : T_n \rangle$$

**Terms:**

$$t ::= \cdots \mid \langle l_j = t \rangle \text{ as } T \mid \text{case}\; t\; \text{of}\; \langle l_i = x_i \rangle \Rightarrow t_i \;_{i \in 1..n}$$

A variant value is tagged with a label: $\langle l_j = v \rangle$ indicates that the variant holds a value $v$ at alternative $l_j$.

### 4.2 Typing Rules for Variants

$$\frac{\Gamma \vdash t : T_j \qquad j \in 1..n}{\Gamma \vdash \langle l_j = t \rangle \text{ as } \langle l_i : T_i \rangle_{i \in 1..n} : \langle l_i : T_i \rangle_{i \in 1..n}} \quad \text{(T-Variant)}$$

$$\frac{\Gamma \vdash t : \langle l_i : T_i \rangle_{i \in 1..n} \qquad \Gamma, x_i : T_i \vdash t_i : T \quad \text{for each } i \in 1..n}{\Gamma \vdash \text{case}\; t\; \text{of}\; \langle l_i = x_i \rangle \Rightarrow t_i : T} \quad \text{(T-Case)}$$

### 4.3 Variant Subtyping: Duality with Records

Variant subtyping is **dual** to record subtyping:

- **Width**: a variant with **fewer** alternatives is a subtype. This is the opposite of records!
- **Depth**: individual alternative types may be refined (covariant), same as records.
- **Permutation**: order does not matter, same as records.

**Width subtyping for variants:**

$$\frac{}{\langle l_i : T_i \rangle_{i \in 1..n} <: \langle l_i : T_i \rangle_{i \in 1..n+k}} \quad \text{(S-VariantWidth)} \qquad (k \geq 0)$$

A variant with fewer alternatives is a subtype of one with more alternatives.

**Intuition.** If a context expects a variant $\langle l_i : T_i \rangle_{i \in 1..n+k}$ and provides a case analysis over all $n+k$ alternatives, then a value of type $\langle l_i : T_i \rangle_{i \in 1..n}$ (which can only be one of the first $n$ alternatives) is safely handled: the context's case analysis covers all possibilities and more.

**Depth subtyping for variants:**

$$\frac{S_1 <: T_1 \quad \cdots \quad S_n <: T_n}{\langle l_i : S_i \rangle_{i \in 1..n} <: \langle l_i : T_i \rangle_{i \in 1..n}} \quad \text{(S-VariantDepth)}$$

**Combined variant subtyping rule:**

$$\frac{\forall j \in 1..m.\; \exists i \in 1..n.\; l_i = k_j \wedge S_j <: T_i}{\langle k_j : S_j \rangle_{j \in 1..m} <: \langle l_i : T_i \rangle_{i \in 1..n}} \quad \text{(S-Variant)}$$

Note the direction: for each alternative $k_j$ in the **subtype**, there must be a matching alternative in the supertype. This is the opposite of the record rule (where each field in the supertype must match a field in the subtype).

### 4.4 The Duality Explained

Records and variants are categorically dual:

| | Records (products) | Variants (coproducts) |
|---|---|---|
| **Construction** | Provide all fields | Choose one alternative |
| **Elimination** | Project one field | Case-analyze all alternatives |
| **Width subtyping** | More fields = subtype | Fewer alternatives = subtype |
| **Subtype has** | At least the fields of the supertype | At most the alternatives of the supertype |

The mnemonic: **a subtype carries at least as much obligation for records (must have all requested fields) and at most as much freedom for variants (can only be alternatives the context handles)**.

### 4.5 Example: Variant Subtyping

$$\langle circle : \text{Nat}, square : \text{Nat} \rangle <: \langle circle : \text{Nat}, square : \text{Nat}, triangle : \text{Nat} \times \text{Nat} \rangle$$

A shape that can only be a circle or a square is a subtype of a shape that can be a circle, square, or triangle. Any handler that handles all three alternatives certainly handles the first two.

---

## 5. Connection to Object-Oriented Programming

### 5.1 Objects as Records of Methods

The simplest type-theoretic model of an object is a record whose fields are methods (functions):

$$\text{point} = \{x = 3, y = 4, dist = \lambda p : \{x : \text{Nat}, y : \text{Nat}\}.\, \ldots\}$$

with type:

$$\text{Point} = \{x : \text{Nat}, y : \text{Nat}, dist : \{x : \text{Nat}, y : \text{Nat}\} \to \text{Nat}\}$$

Under this model:
- **Fields** are record components of non-function type.
- **Methods** are record components of function type.
- **Subtyping** between objects is just record subtyping.

### 5.2 Interface Compatibility

Record subtyping naturally captures the OOP notion that an object with more methods can be used where fewer are expected:

$$\text{ColorPoint} = \{x : \text{Nat}, y : \text{Nat}, color : \text{Color}, dist : \ldots\}$$

Then $\text{ColorPoint} <: \text{Point}$ by width subtyping (extra $\text{color}$ field). This matches the OOP intuition: a colored point "is a" point.

### 5.3 Method Override and Depth Subtyping

If a subclass overrides a method, the override's type must be compatible. Consider:

$$\text{Shape} = \{area : \text{Unit} \to \text{Float}, name : \text{Unit} \to \text{String}\}$$

$$\text{Circle} = \{area : \text{Unit} \to \text{Float}, name : \text{Unit} \to \text{String}, radius : \text{Nat}\}$$

Here $\text{Circle} <: \text{Shape}$ by width subtyping. But suppose we want the $\text{area}$ method to return a more specific type in the subclass:

$$\text{PreciseCircle} = \{area : \text{Unit} \to \text{PositiveFloat}, name : \text{Unit} \to \text{String}, radius : \text{Nat}\}$$

If $\text{PositiveFloat} <: \text{Float}$, then by depth subtyping:

$$\{area : \text{Unit} \to \text{PositiveFloat}, \ldots\} <: \{area : \text{Unit} \to \text{Float}, \ldots\}$$

The method return type is covariant: a more specific return type in the subtype is safe.

### 5.4 Method Parameter Types and Contravariance

What about method parameter types? Consider a method:

$$\text{compare} : \text{Shape} \to \text{Bool}$$

Can we override this in a subclass with:

$$\text{compare} : \text{Circle} \to \text{Bool}$$

Is $\{compare : \text{Circle} \to \text{Bool}\} <: \{compare : \text{Shape} \to \text{Bool}\}$?

By depth subtyping, we need $\text{Circle} \to \text{Bool} <: \text{Shape} \to \text{Bool}$. By S-Arrow, this requires $\text{Shape} <: \text{Circle}$ (contravariance in domain). But $\text{Circle} <: \text{Shape}$, not the reverse. So this override is **unsound**!

The correct covariant override would be:

$$\text{compare} : \text{Animal} \to \text{Bool}$$

where $\text{Shape} <: \text{Animal}$ (accepting a more general argument type). This is contravariance at work.

**Remark 5.1.** Many OOP languages get this wrong (or compromise). Java allows covariant return types (since Java 5) but does not allow contravariant parameter types. Eiffel historically allowed covariant parameter types, which is unsound (the "catcall" problem). C# uses explicit `in` and `out` annotations on generic type parameters to control variance.

### 5.5 The Self-Type Problem

In OOP, methods often refer to the type of the object itself (the "self" or "this" type). For example:

$$\text{Comparable} = \{compareTo : \text{Self} \to \text{Int}\}$$

The `Self` type creates a challenge for subtyping: if $\text{Integer} <: \text{Comparable}$, then `Integer`'s `compareTo` method has type $\text{Integer} \to \text{Int}$, but the interface expects $\text{Self} \to \text{Int}$ where `Self` refers to the concrete type. This leads to the **binary method problem**.

The type-theoretic solution involves bounded quantification (Section 8) or recursive types for self-reference.

### 5.6 Mutable Fields and Invariance

If record fields can be updated (mutated), subtyping must become **invariant** for mutable fields.

Consider a mutable field type $\text{Ref}\; T$. A reference cell supports both reading (covariant: read returns a $T$) and writing (contravariant: write accepts a $T$). The combination requires $S <: T$ and $T <: S$, which together imply $S = T$ (up to subtype equivalence). Hence mutable fields must be invariant.

**Example 5.2.** Java's covariant arrays illustrate the danger of getting this wrong:

```
// Java
Object[] arr = new String[3];  // covariant: String[] <: Object[]
arr[0] = new Integer(42);      // compiles, but throws ArrayStoreException at runtime!
```

The assignment is unsound because we are writing an `Integer` to a `String[]`. Java catches this at runtime with a type check, but a sound type system would reject it statically.

**The rule:** Read-only fields can be covariant. Write-only fields can be contravariant. Read-write fields must be invariant.

---

## 6. Row Polymorphism

### 6.1 The Problem with Width Subtyping

Width subtyping loses information: when we view $\{x : \text{Nat}, y : \text{Bool}\}$ at type $\{x : \text{Nat}\}$, we forget that $y$ exists. If we pass this record to a function $f : \{x : \text{Nat}\} \to T$ and $f$ returns the record, the caller cannot recover the $y$ field.

**Example 6.1.**

$$\text{id}_R : \{x : \text{Nat}\} \to \{x : \text{Nat}\}$$

$$\text{id}_R = \lambda r : \{x : \text{Nat}\}.\; r$$

If we apply $\text{id}_R$ to $\{x = 1, y = 2\}$, the result has type $\{x : \text{Nat}\}$ -- we have lost the $y$ field in the type, even though it is still present at runtime.

### 6.2 Row Polymorphism as an Alternative

**Row polymorphism** (Wand 1987, Remy 1989) is an alternative to record subtyping that avoids information loss. Instead of subtyping, it uses a type variable (called a **row variable**) to represent the "rest" of the record:

$$\text{id}_R : \forall \rho.\; \{x : \text{Nat} \mid \rho\} \to \{x : \text{Nat} \mid \rho\}$$

The row variable $\rho$ captures all fields beyond $x$. When we apply $\text{id}_R$ to $\{x = 1, y = 2\}$, the result type is $\{x : \text{Nat}, y : \text{Nat}\}$ (instantiating $\rho = y : \text{Nat}$).

This approach is used in OCaml for polymorphic record types and in PureScript for its record system.

### 6.3 Comparison

| Feature | Width Subtyping | Row Polymorphism |
|---------|----------------|-----------------|
| Information preservation | Loses extra fields | Preserves extra fields |
| Type inference | Hard (constraint-based) | Compatible with HM inference |
| Expressiveness for records | Natural | Natural |
| Needs subtyping? | Yes | No (uses polymorphism) |
| Language examples | TypeScript, Java | OCaml, PureScript, Elm |

Row polymorphism is often preferred in functional languages because it integrates well with Hindley-Milner type inference, whereas record subtyping requires constraint-based inference.

---

## 7. Real-World Type Systems

### 7.1 TypeScript: Structural Subtyping

TypeScript uses structural subtyping for its object types:

```typescript
interface Point {
  x: number;
  y: number;
}

interface ColorPoint {
  x: number;
  y: number;
  color: string;
}

function distance(p: Point): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

const cp: ColorPoint = { x: 3, y: 4, color: "red" };
distance(cp);  // OK: ColorPoint <: Point (width subtyping)
```

TypeScript's structural subtyping closely matches our formal system. Types are compared by structure, not by name. A value with more properties than required is always acceptable.

TypeScript also supports union types (`A | B`, our $A \sqcup B$) and intersection types (`A & B`, our $A \sqcap B$), giving it a rich subtyping structure.

### 7.2 OCaml: Polymorphic Variants

OCaml's polymorphic variants use row polymorphism with a subtyping-like coercion:

```ocaml
type shape = [ `Circle of float | `Square of float | `Triangle of float * float ]
type simple_shape = [ `Circle of float | `Square of float ]

let area : shape -> float = function
  | `Circle r -> Float.pi *. r *. r
  | `Square s -> s *. s
  | `Triangle (b, h) -> 0.5 *. b *. h

(* simple_shape values can be coerced to shape *)
let s : simple_shape = `Circle 5.0
let a = area (s :> shape)
```

Here `simple_shape` is a subtype of `shape` because it has fewer alternatives (variant width subtyping: fewer alternatives = subtype).

OCaml's object types also use structural subtyping:

```ocaml
class point x y = object
  method x = x
  method y = y
end

class color_point x y c = object
  inherit point x y
  method color = c
end

(* color_point is a structural subtype of point *)
let distance (p : point) = sqrt (float_of_int (p#x * p#x + p#y * p#y))
let cp = new color_point 3 4 "red"
let d = distance (cp :> point)
```

### 7.3 Go: Interfaces as Structural Types

Go uses structural (duck) typing for interfaces:

```go
type Writer interface {
    Write(p []byte) (n int, err error)
}

// Any type with a Write method satisfies Writer
type MyWriter struct{}
func (w MyWriter) Write(p []byte) (int, error) { ... }

// MyWriter implicitly satisfies Writer -- no "implements" declaration needed
var w Writer = MyWriter{}
```

This is structural subtyping: `MyWriter <: Writer` because `MyWriter` has all the methods that `Writer` requires (and possibly more). Go does not require an explicit `implements` declaration.

### 7.4 Java and C#: Nominal Subtyping

In contrast, Java and C# use nominal subtyping:

```java
interface Drawable {
    void draw();
}

class Circle implements Drawable {  // explicit "implements" required
    void draw() { ... }
    double area() { ... }
}
```

Even if `Circle` had a `draw()` method, it would not be a subtype of `Drawable` unless it explicitly declares `implements Drawable`. The subtype relation is determined by declared relationships, not by structural compatibility.

### 7.5 Scala: Combining Nominal and Structural

Scala supports both nominal subtyping (through class hierarchy) and structural types:

```scala
type Closeable = { def close(): Unit }  // structural type

def withResource(r: Closeable)(f: Closeable => Unit): Unit = {
  try { f(r) } finally { r.close() }
}
```

Any object with a `close()` method satisfies the structural type `Closeable`, regardless of its class hierarchy.

---

## 8. Bounded Polymorphism Preview

### 8.1 The Motivation

Consider writing a function that takes a record with at least an $x$ field, increments $x$, and returns the record with the same type:

With subtyping alone, we would write:

$$\text{incX} : \{x : \text{Nat}\} \to \{x : \text{Nat}\}$$

But this loses information: if we pass $\{x = 1, y = 2\}$, the result type is $\{x : \text{Nat}\}$ -- the $y$ field is forgotten.

With parametric polymorphism alone (System F), we could write:

$$\text{incX} : \forall X.\; X \to X$$

But this is too general: $X$ could be anything, and we cannot access the $x$ field inside the function.

### 8.2 Bounded Quantification

**Bounded quantification** ($F_{<:}$) combines both:

$$\text{incX} : \forall X <: \{x : \text{Nat}\}.\; X \to X$$

This says: for any type $X$ that is a subtype of $\{x : \text{Nat}\}$ (i.e., has at least an $x$ field of type $\text{Nat}$), take a value of type $X$ and return a value of the same type $X$.

Inside the function body, we know $X <: \{x : \text{Nat}\}$, so we can access the $x$ field. The return type is $X$, preserving the full type information.

### 8.3 Formal Syntax

$$T ::= \cdots \mid \forall X <: T.\; T$$

$$t ::= \cdots \mid \Lambda X <: T.\; t \mid t\;[T]$$

**Typing rules:**

$$\frac{\Gamma, X <: T_1 \vdash t_2 : T_2}{\Gamma \vdash \Lambda X <: T_1.\; t_2 : \forall X <: T_1.\; T_2} \quad \text{(T-TAbs)}$$

$$\frac{\Gamma \vdash t_1 : \forall X <: T_{11}.\; T_{12} \qquad \Gamma \vdash T_2 <: T_{11}}{\Gamma \vdash t_1\;[T_2] : [X \mapsto T_2]\,T_{12}} \quad \text{(T-TApp)}$$

### 8.4 The Undecidability Result

**Theorem 8.1 (Pierce 1994).** Subtype checking in $F_{<:}$ is undecidable.

This is one of the most striking results in type theory. The combination of bounded quantification and subtyping is so expressive that no algorithm can decide the subtype relation in general. This motivates the study of restricted fragments (kernel $F_{<:}$, where subtyping is decidable) and alternative designs.

We will study $F_{<:}$ in detail in Module 07 (Lecture 07c).

---

---

## 9. Subtyping and Type Classes

### 9.1 The Relationship

Type classes (Haskell) and interfaces (Java, Go) both specify a set of operations that a type must support. Subtyping and type classes are often viewed as alternative solutions to the same problem: ad-hoc polymorphism.

| Feature | Subtyping | Type Classes |
|---------|-----------|-------------|
| Dispatch | Runtime (vtable) | Compile-time (dictionary passing) |
| Extensibility | Open (new subtypes anytime) | Open (new instances anytime) |
| Information loss | Yes (subsumption forgets) | No (parametric) |
| Multiple dispatch | Difficult | Natural (multi-parameter type classes) |
| Retroactive conformance | Structural only | Yes (orphan instances) |

### 9.2 Simulating Type Classes with Subtyping

A type class `Eq a` with method `eq : a -> a -> bool` can be simulated as a record type:

$$\text{EqDict}(A) = \{eq : A \to A \to \text{Bool}\}$$

A "type class instance" is a value of this record type. A function with a type class constraint `Eq a => a -> a -> Bool` becomes a function taking an explicit dictionary:

$$f : \text{EqDict}(A) \to A \to A \to \text{Bool}$$

This is essentially what Haskell compilers do (dictionary passing). The connection to subtyping is that with bounded quantification ($F_{<:}$), we can express the constraint more directly:

$$f : \forall A <: \{eq : A \to A \to \text{Bool}\}.\; A \to A \to \text{Bool}$$

The bound $A <: \{eq : \ldots\}$ plays a role analogous to the type class constraint.

---

## 10. Encoding Records as Functions

### 10.1 The Church Encoding

Records can be encoded in System F using polymorphism. A record $\{l_1 : T_1, \ldots, l_n : T_n\}$ is encoded as a function that takes a "selector" and returns the selected field:

$$\{l_1 = v_1, \ldots, l_n = v_n\} \triangleq \Lambda X.\; \lambda f_1 : T_1 \to X.\; \cdots \lambda f_n : T_n \to X.\; ?$$

This encoding is theoretically interesting but impractical. It demonstrates that records are not primitive -- they can be expressed in terms of polymorphism.

### 10.2 The Dot Encoding

A more practical encoding represents records as collections of "get" functions:

$$\{x = 3, y = 4\} \triangleq \{\text{get\_x} = \lambda u : \text{Unit}.\; 3, \; \text{get\_y} = \lambda u : \text{Unit}.\; 4\}$$

Under this encoding, field access becomes method invocation, which is the standard OOP perspective.

---

## 11. Pattern Matching and Variants

### 11.1 Exhaustiveness with Subtyping

Variant subtyping interacts with pattern matching in an important way. If $S <: T$ for variant types, then $S$ has fewer alternatives than $T$. A case analysis that is exhaustive for $T$ is also exhaustive for $S$, but a case analysis exhaustive for $S$ may not be exhaustive for $T$.

**Example 11.1.**

$$\text{match}\; (e : \langle circle : \text{Nat}, square : \text{Nat} \rangle)\; \text{with}\; \langle circle = r \rangle \Rightarrow \ldots \mid \langle square = s \rangle \Rightarrow \ldots$$

This is exhaustive for $\langle circle : \text{Nat}, square : \text{Nat} \rangle$ but not for $\langle circle : \text{Nat}, square : \text{Nat}, triangle : \text{Nat} \times \text{Nat} \rangle$.

### 11.2 Open and Closed Variants

Some languages distinguish:
- **Closed variants** (algebraic data types): a fixed set of alternatives, known at definition time. Pattern matching must be exhaustive.
- **Open variants** (extensible variants): new alternatives can be added. Pattern matching may include a default case.

OCaml's polymorphic variants are open; its algebraic data types are closed.

### 11.3 Subtyping Direction for Variants

The subtyping direction for variants can be confusing because it is opposite to records:

- Records: **more** fields = subtype (more specific)
- Variants: **fewer** alternatives = subtype (more specific)

The key is to think about what the consumer needs:
- For a record consumer (projecting a field): needs the field to exist. More fields means the requirement is easier to satisfy. Hence more fields = more acceptable = subtype.
- For a variant consumer (case analysis): needs to handle all alternatives. Fewer alternatives means the consumer's job is easier. Hence fewer alternatives = more acceptable = subtype.

---

## 12. Advanced: Recursive Object Types

### 12.1 Objects with Self-Reference

Real objects typically have methods that refer to the object itself:

```
counter = {
  val = 0,
  inc = fun (self) -> { val = self.val + 1, inc = self.inc, get = self.get },
  get = fun (self) -> self.val
}
```

The type of such an object involves recursion:

$$\text{Counter} = \mu X.\; \{val : \text{Nat}, inc : X \to X, get : X \to \text{Nat}\}$$

Subtyping for recursive object types requires the coinductive treatment mentioned in Lecture 04c.

### 12.2 Classes as Record Generators

A class can be modeled as a function that takes a "self" argument and produces a record of methods:

$$\text{class} = \lambda \text{self}.\; \{method_1 = \ldots \text{self} \ldots, \; method_2 = \ldots \text{self} \ldots\}$$

The actual object is obtained by taking the fixed point:

$$\text{object} = \text{fix}\;(\lambda \text{self}.\; \{method_1 = \ldots \text{self} \ldots, \; method_2 = \ldots \text{self} \ldots\})$$

This is the foundation of object encodings in the lambda calculus (Abadi and Cardelli 1996).

---

---

## 13. Summary of Key Insights

Before the formal summary, we highlight the most important takeaways from this lecture that connect to later modules and practical programming:

### 13.1 Records are the Foundation of Objects

Every OOP concept has a type-theoretic counterpart via record types:
- **Class** = Record type (or recursive record type with self-reference)
- **Object** = Record value
- **Method** = Record field of function type
- **Interface** = Record type used as an upper bound
- **Inheritance** = Record extension (adding fields) + method override (depth subtyping)
- **Polymorphism** = Subtyping (interface compatibility)

### 13.2 Variance is the Key Design Constraint

Every design decision in a type system with subtyping comes down to variance:
- Read-only positions are covariant (safe to specialize).
- Write-only positions are contravariant (safe to generalize).
- Read-write positions are invariant (must match exactly).
- Function parameters are contravariant; return types are covariant.

Getting variance wrong leads to unsoundness (Java arrays, Eiffel catcalls) or unnecessary rigidity (invariant when covariant would suffice).

---

## Summary

This lecture explored the rich structure of record and variant subtyping and its connections to object-oriented programming.

1. **Record subtyping** has three dimensions: width (more fields = subtype), depth (refine field types), and permutation (order-independent). The combined rule S-Rcd captures all three.

2. **Variant subtyping** is dual: fewer alternatives = subtype, with depth subtyping on each alternative.

3. **Object types** can be modeled as records of methods. Record subtyping then provides a foundation for interface compatibility in OOP.

4. **Contravariance of method parameters** is essential for soundness but often violated in practice (e.g., Eiffel's catcall problem, Java's covariant arrays).

5. **Mutable fields** require invariance, as they combine reading (covariant) and writing (contravariant).

6. **Row polymorphism** is an alternative to record subtyping that preserves more type information.

7. **Bounded quantification** ($F_{<:}$) combines subtyping with parametric polymorphism, enabling type-preserving operations on records. However, subtyping in $F_{<:}$ is undecidable.

8. **Real-world type systems** implement various combinations of structural subtyping (TypeScript, Go), nominal subtyping (Java, C#), and row polymorphism (OCaml, PureScript).

---

## Further Reading

### Primary Sources

- **Pierce, B. C. (2002)**. *Types and Programming Languages*, Chapters 11, 15, 17. Chapter 11 introduces records; Chapter 15 covers subtyping; Chapter 17 develops record subtyping and its applications.

- **Cardelli, L. (1988)**. "A Semantics of Multiple Inheritance." *Information and Computation*, 76(2-3), 138-164. The foundational paper on structural subtyping for records and objects.

### Supplementary

- **Abadi, M. and Cardelli, L. (1996)**. *A Theory of Objects*. Springer. The definitive treatment of object types, including subtyping, self-types, and method override.

- **Wand, M. (1987)**. "Complete Type Inference for Simple Objects." *LICS 1987*. The original paper on row polymorphism for record types.

- **Remy, D. (1989)**. "Type Checking Records and Variants in a Natural Extension of ML." *POPL 1989*. Row polymorphism as implemented in OCaml.

- **Pierce, B. C. (1994)**. "Bounded Quantification is Undecidable." *Information and Computation*, 112(1), 131-165. Proves the undecidability of subtyping in $F_{<:}$.

- **Dolan, S. (2017)**. "Algebraic Subtyping." PhD Thesis, University of Cambridge. A modern approach to subtyping that integrates cleanly with ML-style type inference.

- **Garrigue, J. (1998)**. "Programming with Polymorphic Variants." *ML Workshop 1998*. The design and implementation of OCaml's polymorphic variant types.

### Exercises for Self-Study

1. Prove that for record types, $\{l_1 : T_1, l_2 : T_2\} <: \{l_2 : T_2, l_1 : T_1\}$ and vice versa, using only the combined rule S-Rcd (not S-RcdPerm as a separate rule).

2. Construct a variant subtyping derivation showing $\langle a : \text{Nat} \rangle <: \langle a : \text{Nat}, b : \text{Bool}, c : \top \rangle$.

3. Explain why Java's generic types are invariant by default (`List<Dog>` is NOT a subtype of `List<Animal>`) while arrays are covariant (`Dog[]` IS a subtype of `Animal[]`). Which design is sound?

4. Define the join and meet operations for record types. Verify that $\{x : \text{Nat}, y : \text{Bool}\} \sqcup \{x : \text{Nat}, z : \top\} = \{x : \text{Nat}\}$ and $\{x : \text{Nat}, y : \text{Bool}\} \sqcap \{x : \text{Nat}, z : \top\} = \{x : \text{Nat}, y : \text{Bool}, z : \top\}$.

5. Consider a language with both mutable and immutable record fields. Design subtyping rules that are covariant for immutable fields and invariant for mutable fields. State and prove a type safety theorem.

---

## Appendix A: Record Implementation Strategies

### A.1 Positional Representation

The simplest runtime representation of records stores fields in a fixed positional order determined by the type. Projection $t.l$ is compiled to a positional access $t[i]$ where $i$ is the index of $l$ in the record type.

**Problem with subtyping.** If $\{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$, the two types may have different field orderings. When a value of the subtype is passed to a function expecting the supertype, the positional indices may not match. Solutions:

1. **Reordering coercion**: Insert code at subtyping boundaries that rearranges the fields. This is the coercion semantics approach.

2. **Canonical ordering**: Impose a fixed ordering on all record types (e.g., alphabetical by label). Then subtyping only involves dropping trailing fields, and the positional indices of shared fields are stable.

3. **Hash-based lookup**: Represent records as hash maps from labels to values. Projection is $O(1)$ amortized but has higher constant factors than positional access.

### A.2 Dictionary Representation

A more flexible approach represents records as dictionaries (association lists, hash maps, or balanced trees). This naturally supports:
- **Width subtyping**: extra entries are simply ignored.
- **Permutation subtyping**: key-based lookup is order-independent.
- **Depth subtyping**: no layout change needed (the value representation handles the subtype).

This is the approach used by JavaScript/TypeScript objects and Python dictionaries.

### A.3 Vtable Representation

In OOP languages, method dispatch typically uses a **virtual method table** (vtable). Each class has a vtable that maps method names to method implementations. Method invocation is a vtable lookup followed by a function call.

Subtyping corresponds to vtable compatibility: a subclass's vtable has entries for all methods in the superclass (and possibly more). The indices of shared methods are stable, so a superclass vtable pointer can be used to call any superclass method on a subclass object.

This is the approach used by C++ (vtable with virtual dispatch), Java (virtual dispatch by default), and C# (similar to Java).

### A.4 Performance Implications

| Strategy | Projection | Subtyping cost | Memory |
|----------|-----------|----------------|--------|
| Positional | $O(1)$ | Reordering coercion | Compact |
| Canonical | $O(1)$ | Field drop (truncation) | Compact |
| Dictionary | $O(1)$ amortized | None | Higher overhead |
| Vtable | $O(1)$ (indirect) | Vtable pointer swap | Compact + vtable |

In practice, modern JIT compilers (V8, HotSpot) use inline caches and hidden classes to approach the performance of positional representations while supporting structural typing.

---

## Appendix B: Formal Treatment of Variant Subtyping

### B.1 Typing Rules

We spell out the typing and evaluation rules for labeled variants in full, complementing the overview in Section 4.

**Syntax:**

$$T ::= \cdots \mid \langle l_1 : T_1, \ldots, l_n : T_n \rangle$$

$$t ::= \cdots \mid \langle l = t \rangle \text{ as } T \mid \text{match}\; t\; \text{with}\; \langle l_i = x_i \rangle \Rightarrow t_i \;_{i \in 1..n}$$

$$v ::= \cdots \mid \langle l = v \rangle$$

**Typing rules:**

$$\frac{\Gamma \vdash t_j : T_j \qquad j \in 1..n}{\Gamma \vdash \langle l_j = t_j \rangle \text{ as } \langle l_i : T_i \rangle_{i \in 1..n} : \langle l_i : T_i \rangle_{i \in 1..n}} \quad \text{(T-Variant)}$$

The type annotation $\text{as } T$ is necessary because the "other" alternatives cannot be inferred from the term alone.

$$\frac{\Gamma \vdash t : \langle l_i : T_i \rangle_{i \in 1..n} \qquad \forall i \in 1..n.\; \Gamma, x_i : T_i \vdash t_i : T}{\Gamma \vdash \text{match}\; t\; \text{with}\; \langle l_i = x_i \rangle \Rightarrow t_i \;_{i \in 1..n} : T} \quad \text{(T-Match)}$$

**Evaluation rules:**

$$\frac{t \to t'}{\langle l = t \rangle \text{ as } T \to \langle l = t' \rangle \text{ as } T} \quad \text{(E-Variant)}$$

$$\frac{t \to t'}{\text{match}\; t\; \text{with}\; \ldots \to \text{match}\; t'\; \text{with}\; \ldots} \quad \text{(E-Match)}$$

$$\frac{j \in 1..n}{\text{match}\; (\langle l_j = v \rangle \text{ as } T)\; \text{with}\; \langle l_i = x_i \rangle \Rightarrow t_i \;_{i \in 1..n} \to [x_j \mapsto v]\,t_j} \quad \text{(E-MatchVariant)}$$

### B.2 Variant Subtyping Rules (Detailed)

The combined variant subtyping rule:

$$\frac{\forall j \in 1..m.\; \exists i \in 1..n.\; l_i = k_j \wedge S_j <: T_i}{\langle k_j : S_j \rangle_{j \in 1..m} <: \langle l_i : T_i \rangle_{i \in 1..n}} \quad \text{(S-Variant)}$$

**Reading:** For each alternative $k_j$ in the **subtype**, there is a corresponding alternative $l_i$ in the supertype with $S_j <: T_i$. The supertype may have additional alternatives not present in the subtype.

### B.3 Canonical Forms for Variants

**Lemma.** If $v$ is a value and $\Gamma \vdash v : \langle l_i : T_i \rangle_{i \in 1..n}$, then $v = \langle l_j = w \rangle \text{ as } T'$ for some $j \in 1..n$, some value $w$, and some variant type $T'$ with $T' <: \langle l_i : T_i \rangle_{i \in 1..n}$, and $\Gamma \vdash w : S$ with $S <: T_j$.

### B.4 Progress and Preservation for Variants

The progress and preservation proofs extend to variants in a straightforward manner:

- **Progress for T-Match:** If $\Gamma \vdash \text{match}\; t_0\; \text{with}\; \ldots : T$ and $t_0$ is a value, then by canonical forms, $t_0 = \langle l_j = w \rangle$, so the match reduces by E-MatchVariant.

- **Preservation for E-MatchVariant:** $\text{match}\; (\langle l_j = v \rangle)\; \text{with}\; \ldots \to [x_j \mapsto v]\,t_j$. By inversion, $\Gamma \vdash \langle l_j = v \rangle : \langle l_i : T_i \rangle_{i \in 1..n}$ and $\Gamma, x_j : T_j \vdash t_j : U$ with $U <: T$. The variant value has $\Gamma \vdash v : S$ with $S <: T_j$. By T-Sub, $\Gamma \vdash v : T_j$. By the substitution lemma, $\Gamma \vdash [x_j \mapsto v]\,t_j : U$. By T-Sub, $\Gamma \vdash [x_j \mapsto v]\,t_j : T$.

---

## Appendix C: Object Encodings in Detail

### C.1 The Simple Object Encoding

We formalize the idea from Section 5.1 of modeling objects as records.

An **object** with methods $m_1, \ldots, m_n$ is a record:

$$\text{obj} = \{m_1 = v_1, \ldots, m_n = v_n\}$$

where each $v_i$ is a function (the method implementation).

An **interface** (or abstract type) is a record type:

$$I = \{m_1 : T_1, \ldots, m_n : T_n\}$$

**Method invocation** is record projection followed by application:

$$\text{obj}.m_i\;(\text{args})$$

**Interface satisfaction** is subtyping:

$$\text{typeof}(\text{obj}) <: I$$

This holds whenever $\text{obj}$ has all the methods required by $I$, with compatible types.

### C.2 Object Extension (Inheritance)

Suppose we have an object type:

$$\text{Point} = \{x : \text{Unit} \to \text{Nat}, y : \text{Unit} \to \text{Nat}\}$$

We can create an "extended" object:

$$\text{colorPoint} = \{x = \lambda u.\; 3, y = \lambda u.\; 4, color = \lambda u.\; \text{red}\}$$

with type:

$$\text{ColorPoint} = \{x : \text{Unit} \to \text{Nat}, y : \text{Unit} \to \text{Nat}, color : \text{Unit} \to \text{Color}\}$$

By width subtyping, $\text{ColorPoint} <: \text{Point}$, so $\text{colorPoint}$ can be used wherever a $\text{Point}$ is expected. This models single inheritance.

### C.3 Limitations of the Simple Encoding

The simple encoding has several limitations:

1. **No self-reference**: Methods cannot refer to the object itself (no `this` or `self`).

2. **No late binding**: When a method is inherited, it does not see overridden methods in the subclass.

3. **No state encapsulation**: All fields are visible; there is no notion of private state.

These limitations are addressed by more sophisticated encodings using recursive types (for self-reference) and existential types (for state encapsulation). See Abadi and Cardelli (1996) for a comprehensive treatment.

### C.4 The Object Calculus

Abadi and Cardelli developed a dedicated **object calculus** where objects are primitive rather than encoded. In their calculus:

- **Objects** have the form $[l_i = \varsigma(x_i) t_i]$ where $\varsigma$ (sigma) binds the self-variable.
- **Method invocation** $a.l_j$ extracts the method $l_j$ and substitutes the object $a$ for the self-variable.
- **Method override** $a.l_j \Leftarrow \varsigma(x) t$ replaces method $l_j$ with a new implementation.

The typing rules for the object calculus include a subtyping relation similar to our record subtyping, with additional complexity from the self-type.

---

## Appendix D: Variance in Real Programming Languages

### D.1 Java Wildcards

Java uses **use-site variance** through wildcards:

```java
// Covariant: can read, cannot write
List<? extends Animal> covariant;
Animal a = covariant.get(0);  // OK: reading produces Animal
// covariant.add(new Dog());  // ERROR: cannot write

// Contravariant: can write, cannot read
List<? super Dog> contravariant;
contravariant.add(new Dog());  // OK: writing Dog is safe
// Dog d = contravariant.get(0);  // ERROR: might not be Dog

// Invariant (default): can both read and write
List<Animal> invariant;
Animal a = invariant.get(0);  // OK
invariant.add(new Dog());      // OK
```

### D.2 Scala Declaration-Site Variance

Scala uses **declaration-site variance** with `+` (covariant) and `-` (contravariant) annotations:

```scala
trait List[+A]       // Covariant: List[Dog] <: List[Animal]
trait Function1[-A, +B]  // Contravariant in A, covariant in B

// The compiler checks that variance annotations are consistent
// with how type parameters are used
trait Container[+A] {
  def get: A         // OK: A in covariant position
  // def set(a: A): Unit  // ERROR: A in contravariant position
}
```

### D.3 TypeScript Structural Variance

TypeScript infers variance structurally. Object types are covariant in their properties (unsound for mutable properties, but accepted as a pragmatic compromise):

```typescript
interface Animal { name: string }
interface Dog extends Animal { breed: string }

let dogs: Dog[] = [{ name: "Rex", breed: "Shepherd" }];
let animals: Animal[] = dogs;  // OK: covariant arrays (unsound!)
animals[0] = { name: "Cat" };  // No breed! Runtime type is wrong
```

TypeScript's `strictFunctionTypes` flag (introduced in TS 2.6) makes function parameters contravariant rather than the previous bivariant behavior:

```typescript
// With strictFunctionTypes
type Handler<T> = (x: T) => void;
let animalHandler: Handler<Animal> = (a: Animal) => console.log(a.name);
let dogHandler: Handler<Dog> = animalHandler;  // OK: contravariant
// let animalHandler2: Handler<Animal> = dogHandler;  // ERROR
```

### D.4 Rust Ownership and Variance

Rust's variance is determined by the ownership/borrowing system:

- `&'a T` (shared reference): covariant in `T`, covariant in `'a`
- `&'a mut T` (mutable reference): **invariant** in `T`, covariant in `'a`
- `fn(T) -> U`: contravariant in `T`, covariant in `U`
- `*const T` (raw pointer): covariant in `T`
- `*mut T` (raw mutable pointer): invariant in `T`

The invariance of `&mut T` is essential for memory safety: it prevents creating aliased mutable references to incompatible types.

### D.5 OCaml Object Types and Polymorphic Variants

OCaml provides two distinct mechanisms that interact with subtyping:

**Object types** use structural subtyping. An object type `< x : int; y : bool >` is a subtype of `< x : int >` because it has all required methods:

```ocaml
(* OCaml uses :> for explicit coercion *)
let point = object method x = 3 method y = true end
let has_x = (point :> < x : int >)  (* Upcast: explicit coercion *)
```

**Polymorphic variants** use a dual form of subtyping. A variant type with fewer cases is a supertype of one with more cases (the opposite of records):

```ocaml
type color = [ `Red | `Green | `Blue ]
type extended_color = [ `Red | `Green | `Blue | `Yellow ]
(* color is a SUPERtype of extended_color for variants *)
(* A handler for color handles fewer cases, so it's less capable *)

let f : [< `Red | `Green | `Blue ] -> string = function
  | `Red -> "red" | `Green -> "green" | `Blue -> "blue"

(* f can accept a subtype: values drawn from fewer alternatives *)
let g : [< `Red | `Green ] -> string = f  (* Error: f expects up to 3 cases *)
```

This duality -- records have width subtyping where more fields = subtype, while variants have width subtyping where fewer alternatives = subtype -- is one of the deepest symmetries in type theory. It reflects the logical duality between conjunction and disjunction.

See Section 4 of the main lecture for the formal treatment of variant subtyping rules, which makes this duality precise.
