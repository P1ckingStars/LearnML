# Lecture 03a: ZF_Base --- Type `i` and Membership

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Trace** the import chain Pure -> IFOL -> FOL -> ZF_Base and explain what each layer contributes to the Isabelle/ZF logic.
2. **Explain** why Isabelle/ZF uses a single type `i` for all sets and a separate type `o` for object-level propositions.
3. **State** the primitive constants of ZF_Base (`mem`, `zero`, `Pow`, `Inf`, `Union`, `PrimReplace`) and their types.
4. **Compare** the Isabelle/ZF type discipline with Isabelle/HOL polymorphism and explain the trade-offs.
5. **Use** the `[TC]` attribute for type-checking rules and explain its role in the Isabelle/ZF workflow.
6. **Write** basic Isabelle/ZF theory files that import `ZF` and work with the membership relation.

---

## 2. Motivation and Context

### 2.1 Why Formalize Set Theory?

Zermelo-Fraenkel set theory with the Axiom of Choice (ZFC) is the standard foundation for most of modern mathematics. Every mathematical object --- a natural number, a function, a topological space --- can in principle be encoded as a set. Formalizing ZFC inside a proof assistant gives us two things:

- **A machine-checked foundation.** We can verify proofs about sets, ordinals, cardinals, and ultimately the consistency and independence results of set theory itself (constructibility, forcing).
- **A stress test for the proof assistant.** ZFC formalization exercises the most fundamental reasoning patterns: first-order logic, the axiom schemas, and transfinite arguments. If a proof assistant can handle ZFC, it can handle anything.

Larry Paulson began the Isabelle/ZF formalization in the early 1990s, and it remains one of the most ambitious formalizations of set theory in any proof assistant. The formalization includes ordinals, cardinals, the Axiom of Choice equivalences, and even the relative consistency of AC via the constructible universe.

### 2.2 The Import Chain

Isabelle is a generic proof assistant: it provides a metalogic (Pure) on top of which specific object logics are defined. The ZF logic is built in layers:

```
Pure          -- The metalogic: ==> (meta-implication), /\x (meta-forall), == (meta-equality)
  |
IFOL          -- Intuitionistic first-order logic: -->, &, |, True, False, All, Ex
  |
FOL           -- Classical FOL: adds excluded middle (P | ~P)
  |
ZF_Base       -- Primitive ZF: type i, mem, zero, Pow, Inf, Union, PrimReplace
  |
upair         -- Derived pairing, singletons, successor, basic set operations
  |
...           -- func, equalities, WF, Ordinal, Cardinal, AC, ...
```

Each layer builds strictly on the one above it, never introducing new axioms except where mathematically necessary. This is the LCF architecture at work: the trusted kernel is minimal, and everything else is derived.

---

## 3. Core Theory

### 3.1 Type `i`: The Universe of Sets

In Isabelle/ZF, there is a single object-level type for all mathematical objects:

```isabelle
typedecl i
```

This declares `i` as a type with no internal structure visible to the type system. Every set --- the empty set, the natural numbers, the reals (if encoded), a function, an ordinal --- has type `i`. There is no type-level distinction between a natural number and a set of sets.

**Definition 3.1 (Type `i`).** The type `i` is the type of all sets in Isabelle/ZF. Every term of type `i` denotes a set, and every set is a term of type `i`.

This is in stark contrast to Isabelle/HOL, where natural numbers have type `nat`, lists have type `'a list`, and so on. In Isabelle/ZF, the type system provides no information about what kind of mathematical object a term represents.

### 3.2 Type `o`: Object-Level Propositions

From IFOL, we inherit the type of object-level propositions:

```isabelle
typedecl o
```

A term of type `o` is a truth value in the object logic. The connectives `-->`, `&`, `|`, `~`, `All`, `Ex` all produce terms of type `o`. The bridge between the object logic and the metalogic is `Trueprop`:

```isabelle
judgment Trueprop :: "o => prop"
```

When we write `x \<in> A` in a goal, Isabelle internally represents it as `Trueprop(mem(x, A))`. The `Trueprop` coercion is usually invisible, but understanding it is essential for reading error messages and understanding how proof methods work.

### 3.3 The Membership Relation

The fundamental relation of set theory is membership. In ZF_Base, it is declared as a constant:

```isabelle
consts
  mem :: "[i, i] => o"    (infixl "\<in>" 50)
```

This says: `mem` takes two arguments of type `i` and produces a proposition of type `o`. The notation `x \<in> A` is syntactic sugar for `mem(x, A)`.

**Remark.** Membership is the *only* primitive relation of ZF. Equality, subset, and all other relations are derived from membership (via the extensionality axiom and logical connectives).

### 3.4 Primitive Constants

ZF_Base declares five additional constants beyond `mem`:

```isabelle
consts
  zero     :: "i"                 -- The empty set, written "0"
  Pow      :: "i => i"            -- Power set operation
  Inf      :: "i"                 -- The infinite set (Infinity axiom)
  Union    :: "i => i"            -- Union of a set of sets
  PrimReplace :: "[i, [i, i] => o] => i"  -- Primitive replacement
```

Let us examine each one.

**The empty set (zero).** The constant `0` of type `i` denotes the empty set. The axiom of the empty set is not stated separately; instead, it is derivable from the other axioms. In practice, Isabelle/ZF defines `0` and proves `x \<notin> 0` as a theorem.

**The power set (Pow).** Given a set `A`, `Pow(A)` is the set of all subsets of `A`. Its characterization is given by the Power Set axiom.

**The infinite set (Inf).** The constant `Inf` denotes a specific infinite set satisfying the Infinity axiom. It is *not* the set of natural numbers `nat` directly; rather, `nat` is defined as the smallest inductive subset of `Inf`.

**Union.** Given a set `C` of sets, `Union(C)` is the union of all members of `C`. If `C = {A, B}`, then `Union(C) = A \<union> B`.

**Primitive replacement (PrimReplace).** This is the most subtle constant. It takes a set `A` and a binary predicate `P :: [i, i] => o`, and produces the set of all `b` such that `P(x, b)` holds for some `x \<in> A`, provided `P` is functional on `A`.

### 3.5 The Type of PrimReplace

The type of `PrimReplace` deserves special attention:

```isabelle
PrimReplace :: "[i, [i, i] => o] => i"
```

The second argument `[i, i] => o` is a *meta-level function* that takes two set variables and returns a proposition. This is how Isabelle/ZF handles the axiom schema of replacement: instead of quantifying over all formulas (which would require a reflection principle or Godel coding), Isabelle uses the polymorphism of the metalogic. The meta-variable `P` ranges over all formulas of two set variables.

This is a key architectural decision. In textbook ZFC, the Replacement Schema is:

$$\forall x \in A.\, \exists! y.\, \varphi(x, y) \implies \exists B.\, \forall y.\, (y \in B \iff \exists x \in A.\, \varphi(x, y))$$

In Isabelle, we replace the quantification over formulas $\varphi$ with a meta-level higher-order variable `P`. Each instantiation of `P` with a concrete formula gives a concrete instance of the replacement axiom. The metalogic ensures that this is sound.

### 3.6 Comparison with HOL

The following table summarizes the key differences between Isabelle/ZF and Isabelle/HOL:

| Feature | Isabelle/ZF | Isabelle/HOL |
|---------|-------------|--------------|
| Object types | Single type `i` | Rich polymorphic types (`nat`, `'a list`, ...) |
| Propositions | Type `o` (object-level) | Type `bool` (also a datatype) |
| Sets | First-class objects of type `i` | Predicates: `'a set = 'a => bool` |
| Functions | Sets of ordered pairs | Terms of type `'a => 'b` |
| Type classes | None | Extensive (`ord`, `ring`, `topological_space`, ...) |
| Automation | `auto`, `blast`, `force` (no `sledgehammer`) | `auto`, `simp`, `sledgehammer`, `nitpick` |
| Foundation | ZFC axioms | HOL axioms (Andrews/Church) |

The fundamental trade-off is:

- **Isabelle/HOL** has a richer type system that catches many errors statically and enables powerful automation (Sledgehammer can call external ATPs). But its sets are predicates over a fixed type, which means there is no "set of all sets" and no direct formalization of ZFC.
- **Isabelle/ZF** has a single untyped universe, which is faithful to the ZFC foundations but requires manual "type-checking" via membership proofs. There is no Sledgehammer.

### 3.7 The `[TC]` Attribute

Because Isabelle/ZF has no type system to enforce that a term belongs to a particular set, we must prove membership obligations manually. The `[TC]` attribute marks lemmas that the type-checking mechanism uses automatically.

For example, suppose we want to show that if `a \<in> A` and `b \<in> B`, then `<a, b> \<in> A \<times> B`. We would prove:

```isabelle
lemma pair_in_sigma [TC]:
  "\<lbrakk> a \<in> A; b \<in> B(a) \<rbrakk> \<Longrightarrow> <a, b> \<in> Sigma(A, B)"
```

The `[TC]` attribute tells Isabelle to use this lemma automatically when trying to prove membership goals. The type-checking system works by backward chaining: given a goal `t \<in> S`, it searches for `[TC]` rules whose conclusion matches `? \<in> S` and generates subgoals for the premises.

### 3.8 Working with the Type-Checking Discipline

In practice, working in Isabelle/ZF involves a constant back-and-forth between "mathematical" reasoning and "type-checking" reasoning. Here is a typical workflow:

```isabelle
theory Example
  imports ZF
begin

lemma example:
  assumes "f \<in> A \<rightarrow> B"  -- f is a function from A to B
  assumes "a \<in> A"           -- a is in the domain
  shows   "f ` a \<in> B"      -- applying f to a gives an element of B
proof -
  from assms show ?thesis
    by (rule apply_type)     -- uses the [TC] rule for function application
qed

end
```

The lemma `apply_type` (which carries the `[TC]` attribute) states:

```isabelle
lemma apply_type [TC]:
  "\<lbrakk> f \<in> A \<rightarrow> B; a \<in> A \<rbrakk> \<Longrightarrow> f ` a \<in> B"
```

Without this discipline, we would have no assurance that `f ` a` is meaningful. In HOL, the type system guarantees that applying a function of type `'a => 'b` to an argument of type `'a` produces a result of type `'b`. In ZF, we must prove this as a theorem each time.

---

## 4. The ZF_Base Theory File

### 4.1 Structure of ZF_Base.thy

The actual `ZF_Base.thy` file in the Isabelle distribution is surprisingly short. Its essential structure is:

```isabelle
theory ZF_Base
  imports FOL
begin

typedecl i

instance i :: "term" ..

consts
  mem     :: "[i, i] => o"           (infixl "\<in>" 50)
  zero    :: "i"                      ("0")
  Pow     :: "i => i"
  Inf     :: "i"
  Union   :: "i => i"                ("\<Union>_" [90] 90)
  PrimReplace :: "[i, [i, i] => o] => i"

(* Axioms *)
axiomatization where
  extension:     "A = B \<longleftrightarrow> (\<forall>x. x \<in> A \<longleftrightarrow> x \<in> B)"
and
  Union_iff:     "A \<in> \<Union>(C) \<longleftrightarrow> (\<exists>B\<in>C. A \<in> B)"
and
  power_set:     "A \<in> Pow(B) \<longleftrightarrow> A \<subseteq> B"
and
  infinity:      "0 \<in> Inf \<and> (\<forall>y \<in> Inf. succ(y) \<in> Inf)"
and
  foundation:    "A = 0 \<or> (\<exists>x\<in>A. \<forall>y\<in>x. y \<notin> A)"
and
  replacement:   "(\<forall>x\<in>A. \<forall>y z. P(x,y) \<and> P(x,z) \<longrightarrow> y = z)
                  \<Longrightarrow> b \<in> PrimReplace(A,P) \<longleftrightarrow> (\<exists>x\<in>A. P(x,b))"

end
```

### 4.2 Reading the Axioms

Let us read each axiom carefully, noting how Isabelle syntax maps to standard mathematical notation.

**Extension.** `A = B \<longleftrightarrow> (\<forall>x. x \<in> A \<longleftrightarrow> x \<in> B)` states that two sets are equal if and only if they have the same members. The `=` on the left is Isabelle's built-in meta-equality (lifted to the object level), and the `\<longleftrightarrow>` is the object-level biconditional. Note that the quantification `\<forall>x` is over all sets (type `i`).

**Union.** `A \<in> \<Union>(C) \<longleftrightarrow> (\<exists>B\<in>C. A \<in> B)` characterizes the big union operation. The bounded existential `\<exists>B\<in>C` is notation for `\<exists>B. B \<in> C \<and> ...`.

**Power set.** `A \<in> Pow(B) \<longleftrightarrow> A \<subseteq> B` says `Pow(B)` collects exactly the subsets of `B`. The subset relation `\<subseteq>` is defined as `A \<subseteq> B \<equiv> \<forall>x. x \<in> A \<longrightarrow> x \<in> B`.

**Infinity.** `0 \<in> Inf \<and> (\<forall>y \<in> Inf. succ(y) \<in> Inf)` asserts that `Inf` contains zero and is closed under successor. This is the minimal axiom for an inductive set; `nat` will be defined as the intersection of all inductive subsets of `Inf`.

**Foundation.** `A = 0 \<or> (\<exists>x\<in>A. \<forall>y\<in>x. y \<notin> A)` is the axiom of regularity. Every non-empty set has a member disjoint from itself. This prevents circular membership chains like `a \<in> b \<in> a`.

**Replacement.** The most complex axiom. The premise `\<forall>x\<in>A. \<forall>y z. P(x,y) \<and> P(x,z) \<longrightarrow> y = z` requires that `P` is *functional* on `A` (at most one `y` for each `x`). Under this condition, `PrimReplace(A,P)` is exactly the image of `A` under the "function" described by `P`.

---

## 5. First Steps in Isabelle/ZF

### 5.1 Setting Up a Theory File

Every Isabelle/ZF development begins with:

```isabelle
theory MyTheory
  imports ZF
begin

(* Your definitions and proofs go here *)

end
```

The import `ZF` brings in the full ZF library, including all derived operations (pairing, functions, ordinals, etc.). If you want only the bare axioms, import `ZF_Base`, but in practice you almost always want `ZF`.

### 5.2 Proving a Simple Membership Fact

Let us prove that the empty set is a subset of every set:

```isabelle
lemma empty_subset: "0 \<subseteq> A"
proof (rule subsetI)
  fix x
  assume "x \<in> 0"
  then show "x \<in> A"
    by (simp add: mem_not_refl)
qed
```

Wait --- this is actually even simpler. The fact `x \<in> 0` is contradictory, so anything follows:

```isabelle
lemma empty_subset: "0 \<subseteq> A"
  by blast
```

The `blast` method handles this because it knows `\<forall>x. x \<notin> 0` (which is derivable from the axioms) and can conclude the universal statement vacuously.

### 5.3 Working with Pow and Union

Here is a slightly more substantial example: proving `A \<subseteq> Pow(\<Union>(A))`:

```isabelle
lemma subset_Pow_Union: "A \<subseteq> Pow(\<Union>(A))"
proof (rule subsetI)
  fix x
  assume xA: "x \<in> A"
  show "x \<in> Pow(\<Union>(A))"
  proof (unfold Pow_iff, rule subsetI)
    fix y
    assume "y \<in> x"
    with xA show "y \<in> \<Union>(A)"
      by (rule UnionI)
  qed
qed
```

This proof demonstrates the typical Isabelle/ZF style: structured Isar reasoning with explicit rule applications. The key steps are:

1. Unfold `Pow` to reduce the goal to a subset claim.
2. Take an arbitrary `y \<in> x`.
3. Use `UnionI` (the introduction rule for Union) with the fact `x \<in> A` and `y \<in> x` to conclude `y \<in> \<Union>(A)`.

---

## 6. How Isabelle/ZF Differs from Textbook ZFC

### 6.1 No Axiom of Empty Set

Most textbooks include an axiom asserting the existence of the empty set. Isabelle/ZF does not: it declares `0` as a constant and derives the property `\<forall>x. x \<notin> 0` from the other axioms (specifically, from Infinity and Separation).

### 6.2 No Axiom of Pairing

Pairing is also derived, not axiomatized. The key insight (due to Suppes) is that pairing follows from Replacement and Power Set. We will see the construction in Lecture 03c.

### 6.3 No Separation Axiom

Separation (Aussonderung) is derivable from Replacement. Given `A` and a property `P`, the set `{x \<in> A. P(x)}` is obtained by applying Replacement with the predicate `Q(x, y) \<equiv> (x = y \<and> P(x))`.

### 6.4 Higher-Order Axiom Schemas

Textbook ZFC states Replacement and Separation as axiom *schemas*: one axiom for each first-order formula. Isabelle/ZF uses higher-order variables in the metalogic to achieve the same effect with a single axiom declaration. This is logically equivalent but much more elegant.

### 6.5 The Role of Foundation

Foundation (Regularity) is rarely used in everyday set theory proofs. Its main roles are:

- Ruling out pathological sets like $a \in a$ or circular membership chains.
- Enabling the rank function and the cumulative hierarchy $V_\alpha$.
- Proving that the membership relation on any set is well-founded, which enables $\in$-induction.

In Isabelle/ZF, Foundation is used primarily in the development of ordinals and transfinite recursion.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Module 01 (Pure/Isar)**: The metalogic Pure provides `==>`, `/\x`, and `==` which appear throughout the ZF axioms. Understanding the meta/object distinction is essential.
- **Module 02 (FOL)**: The connectives `-->`, `&`, `|`, `All`, `Ex` used in the ZF axioms come from FOL. The proof methods `rule`, `erule`, `blast`, `auto` also come from the FOL infrastructure.

### 7.2 Links to Future Modules

- **Lecture 03b**: We will examine each axiom in detail and compare with textbook presentations.
- **Lecture 03c**: We will see how pairing and separation are *derived* from the axioms in ZF_Base.
- **Module 04**: Functions and ordinals build on top of the basic set operations defined here.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1993).** "Set Theory for Verification: I. From Foundations to Functions." *Journal of Automated Reasoning*, 11(3), 353--389.
   - *The foundational paper on Isabelle/ZF. Read Sections 1--4 for the axiomatization and basic constructions.*

### Recommended

2. **Suppes, P. (1960).** *Axiomatic Set Theory.* Dover.
   - *Chapter 2 gives the textbook axioms. Compare with Isabelle's formulation.*

3. **Paulson, L. C. (2019).** "Zermelo Fraenkel Set Theory in Higher-Order Logic." *Archive of Formal Proofs*.
   - *A more recent ZF formalization in Isabelle/HOL, for comparison.*

---

## 9. Exercises

### Theory

**Exercise 3a.1.** Write out the type of each primitive constant in ZF_Base (`mem`, `zero`, `Pow`, `Inf`, `Union`, `PrimReplace`) and explain what each type signature means in mathematical terms.

**Exercise 3a.2.** The subset relation in Isabelle/ZF is defined as:
```isabelle
definition subset :: "[i, i] => o"  (infixl "\<subseteq>" 50)
  where "A \<subseteq> B \<equiv> \<forall>x. x \<in> A \<longrightarrow> x \<in> B"
```
Show that `\<subseteq>` is reflexive and transitive using only the definition and the FOL rules.

**Exercise 3a.3.** Explain why the Infinity axiom does not directly give us the set of natural numbers. What additional construction is needed? (Hint: inductive definition via intersection.)

**Exercise 3a.4.** Why does Isabelle/ZF not use `sledgehammer`? What would be needed to add it? (Think about what external ATPs require.)

### Isabelle

**Exercise 3a.5.** Create a theory file that imports `ZF` and prove the following:
```isabelle
lemma "0 \<subseteq> A"
lemma "A \<subseteq> A"
lemma "\<lbrakk> A \<subseteq> B; B \<subseteq> C \<rbrakk> \<Longrightarrow> A \<subseteq> C"
```

**Exercise 3a.6.** Prove that `A \<in> Pow(A)` using only the definition of `Pow` and the reflexivity of `\<subseteq>`.

**Exercise 3a.7.** Prove that `\<Union>(0) = 0` using the Extension axiom and the characterization of Union.

**Exercise 3a.8.** Prove that `\<Union>(Pow(A)) = A`. (This requires both directions of the Extension axiom and reasoning about Pow and Union.)
