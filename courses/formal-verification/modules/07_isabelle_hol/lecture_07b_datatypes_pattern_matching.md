# Lecture 07b: Datatypes and Pattern Matching

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** algebraic datatypes in Isabelle/HOL using the `datatype` command.
2. **Use** pattern matching with `case` expressions and function definitions.
3. **Explain** the properties the datatype package derives automatically: distinctness, injectivity, exhaustiveness, and structural induction.
4. **Define** records and type synonyms for structured data.
5. **Compare** datatype definitions in HOL with their ZF analogues.

---

## 2. Algebraic Datatypes

### 2.1 The datatype Command

The `datatype` command defines an algebraic datatype (also called an inductive datatype or freely generated type). The syntax is:

```isabelle
datatype 'a mylist = Nil | Cons 'a "'a mylist"
```

This declares a new type `'a mylist` with two constructors:
- `Nil :: 'a mylist` (the empty list)
- `Cons :: 'a => 'a mylist => 'a mylist` (prepending an element)

### 2.2 Standard Examples

**Natural numbers:**

```isabelle
datatype nat = Zero | Suc nat
```

The built-in `nat` type is essentially this, though it is defined via typedef from the natural numbers axiomatized in `Nat.thy`.

**Binary trees:**

```isabelle
datatype 'a tree = Leaf | Node "'a tree" 'a "'a tree"
```

**Option type:**

```isabelle
datatype 'a option = None | Some 'a
```

**Expression trees (for a simple language):**

```isabelle
datatype expr =
    Const int
  | Var string
  | Plus expr expr
  | Times expr expr
```

### 2.3 Mutual Recursion

Datatypes can be mutually recursive:

```isabelle
datatype
  even_tree = ELeaf | ENode odd_forest
and
  odd_forest = Single even_tree | OCons even_tree odd_forest
```

### 2.4 Nested Recursion

Datatypes can use other type constructors in recursive positions, provided those constructors are functorial (covariant):

```isabelle
datatype 'a rose_tree = RNode 'a "'a rose_tree list"
```

Here the recursive occurrence `'a rose_tree` appears inside the `list` constructor, which is allowed because `list` is a covariant functor.

---

## 3. Properties Derived by the Datatype Package

### 3.1 What You Get for Free

When you write `datatype 'a mylist = Nil | Cons 'a "'a mylist"`, the datatype package automatically derives and registers the following:

**Distinctness:** Different constructors produce different values.

```isabelle
theorem mylist.distinct: "Nil \<noteq> Cons x xs"
```

In general, for constructors $C_i \ne C_j$, the package generates $C_i(\bar{x}) \ne C_j(\bar{y})$.

**Injectivity:** A constructor is injective in its arguments.

```isabelle
theorem mylist.inject: "(Cons x xs = Cons y ys) = (x = y \<and> xs = ys)"
```

**Exhaustiveness:** Every value is produced by some constructor.

```isabelle
theorem mylist.exhaust:
  "(y = Nil ==> P) ==> (\<And>x xs. y = Cons x xs ==> P) ==> P"
```

**Structural induction:**

```isabelle
theorem mylist.induct:
  "P Nil ==> (\<And>x xs. P xs ==> P (Cons x xs)) ==> P ys"
```

**Case combinator:**

```isabelle
theorem mylist.case:
  "case_mylist f1 f2 Nil = f1"
  "case_mylist f1 f2 (Cons x xs) = f2 x xs"
```

**Size function:**

```isabelle
theorem mylist.size:
  "size Nil = 0"
  "size (Cons x xs) = Suc (size xs)"
```

### 3.2 How These Are Used

These properties are registered as simplification rules (`[simp]`), which means Isabelle's `simp` method can use them automatically:

```isabelle
lemma "Cons a xs \<noteq> Nil"
  by simp

lemma "Cons a xs = Cons b ys ==> a = b"
  by simp
```

The induction rule is used via the `induct` proof method:

```isabelle
lemma "length (append xs ys) = length xs + length ys"
  by (induct xs) auto
```

---

## 4. Pattern Matching

### 4.1 Case Expressions

Pattern matching in expressions uses the `case` construct:

```isabelle
definition is_empty :: "'a mylist => bool" where
  "is_empty xs = (case xs of Nil => True | Cons _ _ => False)"
```

### 4.2 Function Definitions with Patterns

The `fun` command allows pattern matching directly in function definitions:

```isabelle
fun length :: "'a mylist => nat" where
  "length Nil = 0"
| "length (Cons _ xs) = Suc (length xs)"
```

Multiple equations define the function by cases. The patterns must be:

1. **Exhaustive:** Every possible input is covered by some pattern.
2. **Non-overlapping** (for `fun`; `function` allows overlapping with a proof obligation for consistency).

### 4.3 Nested Patterns

Patterns can be nested:

```isabelle
fun zip :: "'a mylist => 'b mylist => ('a * 'b) mylist" where
  "zip Nil _ = Nil"
| "zip _ Nil = Nil"
| "zip (Cons x xs) (Cons y ys) = Cons (x, y) (zip xs ys)"
```

### 4.4 Wildcard Patterns

The underscore `_` matches anything and binds no variable:

```isabelle
fun hd :: "'a mylist => 'a" where
  "hd (Cons x _) = x"
```

Note that `hd Nil` is not defined by the equations. Since HOL functions are total, `hd Nil` still has a value --- it is just unspecified. The `fun` command generates a `domintros` attribute and the function is defined everywhere, but nothing is known about `hd Nil`.

---

## 5. Records

### 5.1 Record Syntax

Records provide named fields:

```isabelle
record point =
  xcoord :: int
  ycoord :: int

record colored_point = point +
  color :: string
```

The second definition extends `point` with an additional field.

### 5.2 Record Operations

```isabelle
definition origin :: point where
  "origin = \<lparr> xcoord = 0, ycoord = 0 \<rparr>"

definition move_right :: "point => point" where
  "move_right p = p\<lparr> xcoord := xcoord p + 1 \<rparr>"
```

Key operations:

| Operation | Syntax | Example |
|---|---|---|
| Construction | `\<lparr> f1 = v1, f2 = v2 \<rparr>` | `\<lparr> xcoord = 3, ycoord = 4 \<rparr>` |
| Field access | `field_name r` | `xcoord origin` |
| Field update | `r\<lparr> field := val \<rparr>` | `p\<lparr> xcoord := 5 \<rparr>` |

### 5.3 Record Extensibility

Records in Isabelle are extensible: the `point` type actually has an implicit "more" field that allows extension. The type of `origin` is `point` (shorthand for `unit point_ext`), but a `colored_point` value can be used wherever a `point` is expected.

---

## 6. Type Synonyms and Abbreviations

### 6.1 type_synonym

A type synonym introduces a new name for an existing type:

```isabelle
type_synonym matrix = "real list list"
type_synonym 'a multiset = "'a => nat"
```

Type synonyms are purely syntactic; `matrix` and `real list list` are interchangeable.

### 6.2 Difference from datatype

A `type_synonym` creates no new constructors, induction principles, or distinctness rules. It is just an alias. A `datatype` creates a genuinely new type with its own constructors and properties.

---

## 7. Quotient Types (Brief)

### 7.1 Motivation

Sometimes we want a type whose elements are equivalence classes. For example, integers as pairs $(m, n)$ representing $m - n$, modulo the equivalence $(m_1, n_1) \sim (m_2, n_2) \iff m_1 + n_2 = m_2 + n_1$.

### 7.2 The quotient_type Command

```isabelle
quotient_type int = "nat * nat" / "intrel"
  by (rule equivp_intrel)
```

where `intrel` is the equivalence relation. The quotient type package generates:

- An abstraction function `abs_int :: nat * nat => int`
- A representation function `rep_int :: int => nat * nat`
- Transfer rules for lifting operations from the base type to the quotient

### 7.3 The Transfer Method

After defining a quotient, the `transfer` proof method automatically lifts lemmas from the raw type to the quotient:

```isabelle
lemma "a + b = b + (a :: int)"
  by transfer auto
```

---

## 8. Comparison with ZF

### 8.1 Datatypes in ZF

In Isabelle/ZF, algebraic datatypes are constructed using the machinery of `Univ.thy` and least/greatest fixed points:

```isabelle
(* ZF approach: lists as a least fixed point *)
consts list :: "i => i"
inductive
  domains "list(A)" \<subseteq> "univ(A)"
  intros
    Nil:  "[] \<in> list(A)"
    Cons: "[| a \<in> A; l \<in> list(A) |] ==> Cons(a, l) \<in> list(A)"
  type_intros ...
```

This is significantly more verbose than the HOL `datatype` command. In ZF:

- Constructors must be explicitly shown to produce elements of the right set.
- Distinctness and injectivity must be proved from the encoding.
- Induction must be derived from the fixed-point characterization.

### 8.2 The Advantage of HOL

In HOL, the `datatype` package handles all of this internally:

```isabelle
datatype 'a list = Nil | Cons 'a "'a list"
(* Done. All properties derived automatically. *)
```

The package internally constructs the type via typedef, proves the free algebra properties, and registers everything. The user sees only the clean interface.

### 8.3 When ZF Is Needed

ZF datatypes are necessary when the construction must live inside a specific ZF set (e.g., `list(A)` for a set $A$) or when the type system of HOL cannot express the desired structure (e.g., a set of all sets).

---

## 9. Advanced Datatype Features

### 9.1 BNF Datatypes (Isabelle 2014+)

Modern Isabelle uses the *BNF (Bounded Natural Functor)* datatype package, which supports:

- Nested recursion through any BNF (not just `list`).
- Automatic generation of map functions, set functions, and relators.
- Codatatypes (coinductive types) for potentially infinite structures.

**Codatatype example:**

```isabelle
codatatype 'a stream = SCons 'a "'a stream"
```

A stream is an infinite sequence. Unlike datatypes, codatatypes allow infinite objects and come with a *coinduction* principle rather than induction.

### 9.2 Map and Set Functions

For each datatype, the BNF package generates:

```isabelle
(* For datatype 'a tree = Leaf | Node "'a tree" 'a "'a tree" *)
fun map_tree :: "('a => 'b) => 'a tree => 'b tree" where ...
fun set_tree :: "'a tree => 'a set" where ...
fun rel_tree :: "('a => 'b => bool) => 'a tree => 'b tree => bool" where ...
```

These enable generic programming over the datatype.

---

## 10. Key Takeaways

1. The `datatype` command defines algebraic datatypes with automatic derivation of distinctness, injectivity, exhaustiveness, and induction.
2. Pattern matching works via `case` expressions and multi-equation `fun` definitions.
3. Records provide named fields with construction, access, and update operations.
4. Type synonyms are aliases; datatypes are genuinely new types.
5. HOL datatypes are dramatically simpler to define and use than their ZF counterparts.
6. The BNF package extends datatypes to support nested recursion, codatatypes, and generic operations.

---

## 11. Exercises

**Exercise 7b.1.** Define a datatype for propositional logic formulas with constructors for `Var string`, `Not`, `And`, `Or`, and `Implies`. Write a function `eval` that evaluates a formula given a valuation `string => bool`.

**Exercise 7b.2.** Define a datatype for red-black trees (a binary search tree where each node is colored red or black). Include a color datatype and a tree datatype parameterized by key and value types.

**Exercise 7b.3.** Using records, define a type for 2D geometric shapes with fields for position (a point record) and area (a real number). Define a function that scales a shape by a given factor.

**Exercise 7b.4.** Define a mutually recursive datatype for a simple typed lambda calculus:
- Types: `TBool`, `TArrow type type`
- Terms: `TTrue`, `TFalse`, `TVar nat`, `TAbs type term`, `TApp term term`

**Exercise 7b.5.** Compare the HOL definition of binary trees with the ZF definition. How many lines of proof does each require to establish the basic properties (distinctness, injectivity, induction)?

---

## References

- Nipkow, T. and Klein, G. (2014). *Concrete Semantics*. Chapter 2: Types, functions, and datatypes.
- Blanchette, J.C., et al. (2014). Truly modular (co)datatypes for Isabelle/HOL. *ITP 2014*.
- Isabelle/HOL documentation: `datatypes.pdf` in the Isabelle distribution.
