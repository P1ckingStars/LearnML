# Lecture 07a: Simple Type Theory and Polymorphism

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Describe** Church's simple type theory as the logical foundation underlying Isabelle/HOL.
2. **Enumerate** the base types, type constructors, and function types in HOL's type system.
3. **Explain** parametric polymorphism (type variables) and type classes (sort constraints) in Isabelle/HOL.
4. **State** the HOL axioms: extensionality, the Hilbert choice operator, and typedef.
5. **Compare** HOL and ZF as foundations for formalization, identifying the tradeoffs.

---

## 2. From ZF to HOL

### 2.1 Why a New Foundation?

In Modules 01--06, we worked in Isabelle/ZF: an untyped set-theoretic foundation where everything is a set of type `i` and propositions have type `o`. This is maximally flexible --- any mathematical object can be encoded --- but the lack of types has costs:

1. **No type checking.** Nonsensical expressions like $3 \in \sin$ are syntactically valid (though provably false).
2. **Weak automation.** Without types, relevance filtering for automated provers is difficult.
3. **Encoding overhead.** Natural numbers, pairs, functions, etc. must be constructed from sets.

Isabelle/HOL uses *simple type theory* (Church 1940) as its foundation. Every term has a type, types are checked statically, and the type system enables powerful automation.

### 2.2 Historical Context

Church's simple type theory (STT) was introduced to avoid Russell's paradox by stratifying objects into types. The HOL line of provers (HOL4, HOL Light, Isabelle/HOL) builds on this foundation. Gordon's HOL (1988) established the LCF-style approach to HOL, and Isabelle/HOL (Nipkow, Paulson, Wenzel) is its most feature-rich descendant.

---

## 3. The HOL Type System

### 3.1 Base Types

HOL provides a small collection of base types:

| Type | Description | Example values |
|---|---|---|
| `bool` | Booleans | `True`, `False` |
| `nat` | Natural numbers | `0`, `1`, `Suc n` |
| `int` | Integers | `0`, `1`, `-1` |
| `unit` | Singleton type | `()` |

Additional types (rationals, reals, complex numbers) are constructed from these via typedef.

### 3.2 Type Constructors

HOL has built-in type constructors:

| Constructor | Syntax | Example |
|---|---|---|
| Function | `'a => 'b` | `nat => bool` |
| Product | `'a * 'b` | `nat * int` |
| Sum | `'a + 'b` | `nat + bool` |
| List | `'a list` | `nat list` |
| Set | `'a set` | `nat set` |
| Option | `'a option` | `nat option` |

### 3.3 Function Types

Function types `'a => 'b` are fundamental. In HOL, functions are *total*: every function of type `'a => 'b` is defined on every element of type `'a`. There are no partial functions at the type level (though partiality can be modeled using option types or predicates).

Functions are written in curried form:

```isabelle
definition add :: "nat => nat => nat" where
  "add x y = x + y"
```

The type `nat => nat => nat` is parsed as `nat => (nat => nat)` --- a function that takes a natural number and returns a function.

### 3.4 Comparison with ZF Types

| Feature | Isabelle/ZF | Isabelle/HOL |
|---|---|---|
| Terms | All have type `i` | Each has a specific type |
| Propositions | Type `o` | Type `bool` (also a term type) |
| Functions | Sets of pairs: $f \in A \to B$ | Lambda terms: `f :: 'a => 'b` |
| Natural numbers | Set $\omega \in i$ | Type `nat` |
| Sets | Elements of type `i` | Predicates: `'a set = 'a => bool` |
| Pairs | Kuratowski encoding | Primitive type `'a * 'b` |
| Type checking | None (runtime axioms) | Static (compile-time) |

---

## 4. Polymorphism

### 4.1 Type Variables

HOL supports *parametric polymorphism* via type variables, written with a leading quote: `'a`, `'b`, `'c`. A polymorphic definition works for any instantiation of the type variables.

**Example.** The identity function:

```isabelle
definition ident :: "'a => 'a" where
  "ident x = x"
```

This is a single definition that works for `nat`, `bool`, `int list`, or any other type. The type variable `'a` is implicitly universally quantified.

**Example.** The list append function:

```isabelle
fun append :: "'a list => 'a list => 'a list" where
  "append [] ys = ys"
| "append (x # xs) ys = x # append xs ys"
```

### 4.2 Polymorphism is Parametric

HOL's polymorphism is *parametric*: a polymorphic function must behave uniformly across all type instantiations. There is no ad-hoc overloading at the polymorphism level (that role is played by type classes, discussed below).

**Consequence (Free theorem, Wadler 1989).** Any function `f :: 'a => 'a` must be the identity. Proof sketch: since `f` cannot inspect the value of its argument (it knows nothing about type `'a`), it can only return the argument itself.

More formally, in the HOL metatheory: for any types $\alpha$ and function $g : \alpha \to \alpha$ satisfying the specification `'a => 'a`, and for any function $h : \alpha \to \beta$, we have $h \circ g = g' \circ h$ where $g'$ is the instantiation of the same polymorphic function at type $\beta$.

### 4.3 Type Inference

Isabelle infers types automatically in most cases. You can omit type annotations and let the system figure them out:

```isabelle
definition swap where "swap p = (snd p, fst p)"
-- Isabelle infers: swap :: "'a * 'b => 'b * 'a"
```

When the type is ambiguous, Isabelle reports an error and asks for annotation.

---

## 5. Type Classes

### 5.1 Motivation

Sometimes we want to define operations that work for many types but require specific structure. For example, sorting requires an ordering on elements. Type classes (inspired by Haskell) provide *constrained polymorphism*.

### 5.2 Declaring Type Classes

A type class declares a set of operations and axioms:

```isabelle
class semigroup =
  fixes mult :: "'a => 'a => 'a"  (infixl "\<cdot>" 70)
  assumes assoc: "(a \<cdot> b) \<cdot> c = a \<cdot> (b \<cdot> c)"

class monoid = semigroup +
  fixes unit :: 'a  ("\<one>")
  assumes left_unit: "\<one> \<cdot> a = a"
  assumes right_unit: "a \<cdot> \<one> = a"
```

### 5.3 Instantiating Type Classes

To show that a specific type belongs to a class, provide an instance:

```isabelle
instantiation nat :: monoid
begin
  definition mult_nat :: "nat => nat => nat" where
    "mult_nat = (+)"
  definition unit_nat :: nat where
    "unit_nat = 0"
  instance
    by (intro_classes) (auto simp: mult_nat_def unit_nat_def)
end
```

### 5.4 Sort Constraints

When a type variable appears with a class constraint, it restricts the polymorphism:

```isabelle
definition square :: "'a::monoid => 'a" where
  "square x = x \<cdot> x"
```

The notation `'a::monoid` means `square` only works for types that are instances of `monoid`.

### 5.5 The Class Hierarchy

Isabelle/HOL ships with a rich hierarchy of type classes:

```
type  <  ord  <  preorder  <  order  <  linorder
                                    <  lattice  <  complete_lattice
      <  zero  <  zero_neq_one
      <  plus  <  semigroup_add  <  monoid_add  <  group_add  <  ab_group_add
      <  times <  semigroup_mult <  monoid_mult <  comm_monoid_mult
                                                <  ring  <  comm_ring  <  field
```

This hierarchy enables polymorphic reasoning: a lemma proved for `linorder` automatically applies to `nat`, `int`, `real`, and any other linearly ordered type.

---

## 6. HOL Axioms

### 6.1 The Axiomatic Basis

Isabelle/HOL's logical kernel has a remarkably small axiomatic basis:

**Axiom 1 (Extensionality).** Two functions are equal iff they agree on all arguments:

```isabelle
axiom ext: "(\<And>x. f x = g x) ==> f = g"
```

In mathematical notation: $(\forall x.\, f(x) = g(x)) \implies f = g$.

**Axiom 2 (The Hilbert Choice Operator).** For any predicate $P$, if $\exists x.\, P(x)$, then $\varepsilon x.\, P(x)$ satisfies $P$:

```isabelle
axiom someI: "P x ==> P (SOME x. P x)"
```

The operator `SOME` (also written $\varepsilon$ or `Eps`) is Hilbert's epsilon. It selects an arbitrary witness. Unlike ZF's axiom of choice, this is built into the logic.

**Axiom 3 (Typedef).** Given a nonempty subset $S$ of an existing type, one can introduce a new type isomorphic to $S$:

```isabelle
axiom typedef:
  assumes "x \<in> S"
  shows "\<exists>(Rep :: 'b => 'a) (Abs :: 'a => 'b).
           type_definition Rep Abs S"
```

where `type_definition Rep Abs S` asserts that `Rep` and `Abs` form an isomorphism between the new type `'b` and the set `S`.

### 6.2 Derived Concepts

From these axioms, the standard logical connectives are defined:

```isabelle
definition True :: bool where "True \<equiv> ((\<lambda>x::bool. x) = (\<lambda>x. x))"
definition All  :: "('a => bool) => bool" where "All P \<equiv> (P = (\<lambda>x. True))"
definition Ex   :: "('a => bool) => bool" where "Ex P  \<equiv> \<not> All (\<lambda>x. \<not> P x)"
definition conj :: "[bool, bool] => bool" where "conj A B \<equiv> ..."
definition disj :: "[bool, bool] => bool" where "disj A B \<equiv> ..."
```

### 6.3 Sets in HOL

In HOL, sets are *predicates*:

```isabelle
type_synonym 'a set = "'a => bool"
```

Membership is function application:

```isabelle
definition member :: "'a => 'a set => bool" where
  "member x S \<longleftrightarrow> S x"
```

This identification of sets with predicates means that HOL's sets are always typed: `nat set` is the type of sets of natural numbers, and you cannot form mixed-type sets.

**Key operations:**

```isabelle
definition union :: "'a set => 'a set => 'a set" where
  "union A B = (\<lambda>x. A x \<or> B x)"

definition inter :: "'a set => 'a set => 'a set" where
  "inter A B = (\<lambda>x. A x \<and> B x)"

definition image :: "('a => 'b) => 'a set => 'b set" where
  "image f A = (\<lambda>y. \<exists>x. A x \<and> f x = y)"
```

---

## 7. HOL vs. ZF: A Comparison

### 7.1 Expressiveness

**ZF advantages:**
- Can form sets of mixed "types" (e.g., $\{0, \{0\}, \{\{0\}\}\}$).
- Can reason about the cumulative hierarchy.
- Natural setting for set theory, ordinal arithmetic, and independence proofs.

**HOL advantages:**
- Type checking catches errors at definition time.
- Automation (Sledgehammer, simp, auto) is much more effective due to type information.
- Algebraic datatypes and pattern matching are built in.
- Code generation enables extraction of executable programs.

### 7.2 Automation

The type system is the single biggest factor in HOL's superior automation. When Sledgehammer searches for relevant lemmas, it can use type information to filter out irrelevant facts. In ZF, everything has type `i`, so relevance filtering must rely on syntactic heuristics.

### 7.3 Foundational Strength

ZF is stronger than HOL in foundational terms. Isabelle/HOL (with the axiom of infinity, which `Main` includes via `Nat.thy`) is equiconsistent with bounded Zermelo set theory --- stronger than Peano arithmetic but weaker than full ZF. In particular, HOL cannot express replacement-schema-dependent constructions. However, for most formalized mathematics (analysis, algebra, computer science), HOL is more than sufficient.

### 7.4 The Practical Verdict

Most formalization projects use HOL (or a similar typed foundation like CIC/Coq) because the automation advantage is overwhelming. ZF is reserved for set theory proper and foundational investigations.

---

## 8. Key Takeaways

1. Isabelle/HOL is based on Church's simple type theory with extensionality, Hilbert choice, and typedef as axioms.
2. The type system provides parametric polymorphism (type variables) and constrained polymorphism (type classes).
3. Sets in HOL are predicates: `'a set = 'a => bool`. All sets are typed.
4. Functions in HOL are total lambda terms, not sets of pairs.
5. HOL's type system enables dramatically better automation than ZF, at the cost of some expressiveness.
6. Type classes organize mathematical structures (groups, rings, orders) in a reusable hierarchy.

---

## 9. Exercises

**Exercise 7a.1.** Write the types of the following Isabelle/HOL expressions:
- `map (\<lambda>x. x + 1) [1, 2, 3]`
- `(\<lambda>f. f True)`
- `{x :: nat. x > 5}`
- `SOME n :: nat. prime n`

**Exercise 7a.2.** Define a type class `has_size` with a single operation `size :: 'a => nat`. Provide instances for `bool`, `nat option`, and `'a list`.

**Exercise 7a.3.** Explain why the type `'a set` in HOL cannot represent the class of all sets (unlike ZF's universe $V$). What is the HOL analogue of a proper class?

**Exercise 7a.4.** The Hilbert choice operator `SOME` is defined for all predicates, even unsatisfiable ones. What does `SOME x::nat. x < 0` evaluate to? Is it well-defined?

**Exercise 7a.5.** Compare the ZF formulation of "every surjection has a right inverse" with the HOL formulation. Which is simpler to state? Which is simpler to prove?

---

## References

- Church, A. (1940). A formulation of the simple theory of types. *Journal of Symbolic Logic*, 5(2), 56--68.
- Gordon, M.J.C. and Melham, T.F. (1993). *Introduction to HOL*. Cambridge University Press.
- Nipkow, T., Paulson, L.C., and Wenzel, M. (2002). *Isabelle/HOL --- A Proof Assistant for Higher-Order Logic*. LNCS 2283. Springer.
- Wadler, P. (1989). Theorems for free! *FPCA '89*.
- Haftmann, F. and Wenzel, M. (2006). Constructive type classes in Isabelle. *TYPES 2006*.
