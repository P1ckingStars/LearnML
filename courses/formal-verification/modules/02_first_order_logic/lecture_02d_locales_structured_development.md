# Lecture 02d: Locales & Structured Theory Development

> **Module 02 — First-Order Logic in Isabelle (Weeks 3-4)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Declare locales with parameters, assumptions, and derived definitions.
2. Establish sublocale relationships and explain their implications.
3. Interpret locales for concrete structures, proving that assumptions hold.
4. Formalize algebraic structures (groups, rings) as locales.
5. Use context blocks for local scope management.
6. Manage named theorems and facts effectively in large developments.
7. Explain how Isabelle's theory graph organizes a formal library.

---

## 1. Locales in Depth

### 1.1 Review and Motivation

We introduced locales briefly in Lecture 01d. Now we develop them thoroughly. The fundamental problem locales solve: mathematical theories are parameterized. Group theory applies to any group; topology applies to any topological space. We need a mechanism to:

1. Declare the parameters and assumptions of a theory once.
2. Develop results within those assumptions.
3. Instantiate the results for specific structures.
4. Compose and extend parameterized theories.

Locales provide exactly this.

### 1.2 Locale Declaration Syntax

```isabelle
locale name =
  fixes param1 :: "type1"
    and param2 :: "type2"
  assumes assumption_name1: "statement1"
      and assumption_name2: "statement2"
```

Each component:

- **`fixes`**: declares parameters (constants local to the locale). These are like the signature of an algebraic structure.
- **`assumes`**: declares properties that the parameters must satisfy. These are the axioms of the theory.

### 1.3 Locale Body

Theorems proved inside a locale are implicitly qualified by the locale's assumptions:

```isabelle
locale partial_order =
  fixes le :: "'a => 'a => bool" (infix "\<sqsubseteq>" 50)
  assumes refl:     "x \<sqsubseteq> x"
      and antisym:  "\<lbrakk> x \<sqsubseteq> y; y \<sqsubseteq> x \<rbrakk> \<Longrightarrow> x = y"
      and trans:    "\<lbrakk> x \<sqsubseteq> y; y \<sqsubseteq> z \<rbrakk> \<Longrightarrow> x \<sqsubseteq> z"
begin

definition lt :: "'a => 'a => bool" (infix "\<sqsubset>" 50) where
  "x \<sqsubset> y \<longleftrightarrow> x \<sqsubseteq> y \<and> x \<noteq> y"

lemma lt_irrefl: "\<not> (x \<sqsubset> x)"
  unfolding lt_def by auto

lemma lt_trans: "\<lbrakk> x \<sqsubset> y; y \<sqsubset> z \<rbrakk> \<Longrightarrow> x \<sqsubset> z"
  unfolding lt_def using trans by blast

lemma le_lt_or_eq: "x \<sqsubseteq> y \<Longrightarrow> x \<sqsubset> y \<or> x = y"
  unfolding lt_def by auto

end
```

Outside the locale, these are accessed as:

```
partial_order.lt_irrefl:   partial_order ?le ==> ~(?le ?x ?x & ?x ~= ?x)
```

The locale's assumptions appear as premises.

### 1.4 Definitions Inside Locales

Definitions inside a locale can use the locale's parameters:

```isabelle
context partial_order
begin

definition is_upper_bound :: "'a => 'a set => bool" where
  "is_upper_bound b S \<longleftrightarrow> (\<forall>x \<in> S. x \<sqsubseteq> b)"

definition is_lub :: "'a => 'a set => bool" where
  "is_lub b S \<longleftrightarrow> is_upper_bound b S \<and> (\<forall>c. is_upper_bound c S \<longrightarrow> b \<sqsubseteq> c)"

lemma lub_unique: "\<lbrakk> is_lub b S; is_lub c S \<rbrakk> \<Longrightarrow> b = c"
  unfolding is_lub_def is_upper_bound_def
  using antisym by blast

end
```

The theorem `lub_unique` states that least upper bounds are unique in any partial order. It uses the `antisym` assumption from the locale.

---

## 2. Sublocale Relationships

### 2.1 Declaration

A `sublocale` declaration establishes that one locale is a special case of another:

```isabelle
locale total_order = partial_order +
  assumes total: "x \<sqsubseteq> y \<or> y \<sqsubseteq> x"
```

The `+` notation means `total_order` extends `partial_order`. Every total order is automatically a partial order, and all theorems from `partial_order` are available in `total_order`.

### 2.2 Non-Trivial Sublocale Relationships

More interesting sublocale declarations prove that a locale satisfies another's assumptions via a non-trivial construction.

**Example: The dual of a partial order is a partial order.**

```isabelle
sublocale partial_order \<subseteq> dual: partial_order "\<lambda>x y. le y x"
proof
  fix x show "le x x" by (rule refl)
next
  fix x y assume "le y x" "le x y"
  thus "x = y" by (rule antisym)
next
  fix x y z assume "le y x" "le z y"
  thus "le z x" by (rule trans)
qed
```

After this declaration, every theorem proved in `partial_order` is also available with the reversed order, prefixed by `dual.`:

```
partial_order.dual.lt_irrefl:  (* lt for the dual order is irreflexive *)
```

### 2.3 The Sublocale DAG

Sublocale relationships form a DAG. Isabelle tracks these and propagates theorems accordingly. When a new theorem is proved in a locale, it is automatically available in all sublocales (via the established interpretations).

---

## 3. Interpretation

### 3.1 Global Interpretation

An *interpretation* proves that a specific structure satisfies a locale's assumptions, making all locale theorems available for that structure:

```isabelle
interpretation nat_order: partial_order "(\<le>) :: nat \<Rightarrow> nat \<Rightarrow> bool"
proof
  fix x :: nat show "x \<le> x" by simp
next
  fix x y :: nat assume "x \<le> y" "y \<le> x" thus "x = y" by simp
next
  fix x y z :: nat assume "x \<le> y" "y \<le> z" thus "x \<le> z" by simp
qed
```

Now all `partial_order` theorems are available for `nat`:

```
nat_order.lt_irrefl:   "\<not> ((x::nat) < x \<and> x \<noteq> x)"
nat_order.lub_unique:  "\<lbrakk> nat_order.is_lub b S; nat_order.is_lub c S \<rbrakk> \<Longrightarrow> b = c"
```

### 3.2 Interpretation with Renaming

When the locale uses a generic operation name that conflicts with existing names, the interpretation prefixes theorem names:

```isabelle
interpretation int_order: total_order "(\<le>) :: int \<Rightarrow> int \<Rightarrow> bool"
proof
  (* ... proof obligations ... *)
qed

thm int_order.total     (* "\<forall>x y::int. x \<le> y \<or> y \<le> x" *)
```

### 3.3 Conditional Interpretation

Interpretations can be conditional — they hold only under additional assumptions:

```isabelle
interpretation product_order: partial_order
  "\<lambda>(a,b) (c,d). le1 a c \<and> le2 b d"
  if "partial_order le1" and "partial_order le2"
proof -
  (* uses assumptions about le1 and le2 *)
qed
```

---

## 4. Extended Example: Algebraic Hierarchy

### 4.1 Building the Hierarchy

```isabelle
locale semigroup =
  fixes f :: "'a \<Rightarrow> 'a \<Rightarrow> 'a" (infixl "\<cdot>" 70)
  assumes assoc: "(x \<cdot> y) \<cdot> z = x \<cdot> (y \<cdot> z)"

locale comm_semigroup = semigroup +
  assumes comm: "x \<cdot> y = y \<cdot> x"

locale monoid = semigroup +
  fixes e :: "'a" ("\<one>")
  assumes left_neutral:  "\<one> \<cdot> x = x"
      and right_neutral: "x \<cdot> \<one> = x"

locale comm_monoid = monoid + comm_semigroup

locale group = monoid +
  fixes inv :: "'a \<Rightarrow> 'a" ("_\<inverse>" [1000] 999)
  assumes left_inverse: "x\<inverse> \<cdot> x = \<one>"

locale abelian_group = group + comm_monoid
```

This gives us the hierarchy:

```
semigroup
   |      \
   |    comm_semigroup
   |       |
 monoid    |
   |  \   /
   |  comm_monoid
   |       |
 group     |
   |      /
abelian_group
```

### 4.2 Theorems in the Group Locale

```isabelle
context group
begin

theorem right_inverse: "x \<cdot> x\<inverse> = \<one>"
proof -
  have "x \<cdot> x\<inverse> = \<one> \<cdot> (x \<cdot> x\<inverse>)"
    by (simp add: left_neutral)
  also have "\<dots> = ((x\<inverse>)\<inverse> \<cdot> x\<inverse>) \<cdot> (x \<cdot> x\<inverse>)"
    by (simp add: left_inverse)
  also have "\<dots> = (x\<inverse>)\<inverse> \<cdot> ((x\<inverse> \<cdot> x) \<cdot> x\<inverse>)"
    by (simp add: assoc)
  also have "\<dots> = (x\<inverse>)\<inverse> \<cdot> (\<one> \<cdot> x\<inverse>)"
    by (simp add: left_inverse)
  also have "\<dots> = (x\<inverse>)\<inverse> \<cdot> x\<inverse>"
    by (simp add: left_neutral)
  also have "\<dots> = \<one>"
    by (simp add: left_inverse)
  finally show ?thesis .
qed

theorem inv_unique:
  assumes "y \<cdot> x = \<one>"
  shows "y = x\<inverse>"
proof -
  have "y = y \<cdot> \<one>" by (simp add: right_neutral)
  also have "\<dots> = y \<cdot> (x \<cdot> x\<inverse>)" by (simp add: right_inverse)
  also have "\<dots> = (y \<cdot> x) \<cdot> x\<inverse>" by (simp add: assoc)
  also have "\<dots> = \<one> \<cdot> x\<inverse>" by (simp add: assms)
  also have "\<dots> = x\<inverse>" by (simp add: left_neutral)
  finally show ?thesis .
qed

theorem inv_inv: "(x\<inverse>)\<inverse> = x"
  by (rule sym, rule inv_unique, rule left_inverse)

theorem inv_product: "(x \<cdot> y)\<inverse> = y\<inverse> \<cdot> x\<inverse>"
proof (rule sym, rule inv_unique)
  have "(y\<inverse> \<cdot> x\<inverse>) \<cdot> (x \<cdot> y) = y\<inverse> \<cdot> ((x\<inverse> \<cdot> x) \<cdot> y)"
    by (simp add: assoc)
  also have "\<dots> = y\<inverse> \<cdot> (\<one> \<cdot> y)" by (simp add: left_inverse)
  also have "\<dots> = y\<inverse> \<cdot> y" by (simp add: left_neutral)
  also have "\<dots> = \<one>" by (simp add: left_inverse)
  finally show "(y\<inverse> \<cdot> x\<inverse>) \<cdot> (x \<cdot> y) = \<one>" .
qed

theorem left_cancel: "x \<cdot> y = x \<cdot> z \<Longrightarrow> y = z"
proof -
  assume eq: "x \<cdot> y = x \<cdot> z"
  have "y = \<one> \<cdot> y" by (simp add: left_neutral)
  also have "\<dots> = (x\<inverse> \<cdot> x) \<cdot> y" by (simp add: left_inverse)
  also have "\<dots> = x\<inverse> \<cdot> (x \<cdot> y)" by (simp add: assoc)
  also have "\<dots> = x\<inverse> \<cdot> (x \<cdot> z)" by (simp add: eq)
  also have "\<dots> = (x\<inverse> \<cdot> x) \<cdot> z" by (simp add: assoc)
  also have "\<dots> = \<one> \<cdot> z" by (simp add: left_inverse)
  also have "\<dots> = z" by (simp add: left_neutral)
  finally show "y = z" .
qed

end
```

### 4.3 Interpretations

```isabelle
interpretation int_add_group: group "(\<lambda>x y. x + y :: int)" "0" "\<lambda>x. -x"
proof unfold_locales
  fix x y z :: int
  show "(x + y) + z = x + (y + z)" by simp
  show "0 + x = x" by simp
  show "x + 0 = x" by simp
  show "(-x) + x = 0" by simp
qed

(* Now all group theorems are available for integer addition *)
thm int_add_group.right_inverse    (* "x + (- x) = 0" *)
thm int_add_group.inv_inv          (* "- (- x) = x" *)
thm int_add_group.inv_product      (* "- (x + y) = (- y) + (- x)" *)
```

---

## 5. Context Blocks

### 5.1 Syntax

A `context` block provides a local scope within a theory:

```isabelle
context
  fixes n :: nat
  assumes positive: "n > 0"
begin

lemma "n \<ge> 1"
  using positive by arith

lemma "2 * n > n"
  using positive by arith

end
```

### 5.2 Context within a Locale

```isabelle
context partial_order
begin

context
  fixes a b :: 'a
  assumes ab: "a \<sqsubseteq> b"
begin

lemma "a \<sqsubset> b \<or> a = b"
  using ab le_lt_or_eq by auto

end  (* closes the inner context *)

end  (* closes the locale context *)
```

### 5.3 Context vs Locale

| Feature | Context | Locale |
|---------|---------|--------|
| Named | No | Yes |
| Reusable | No | Yes (via interpretation) |
| Extendable | No | Yes (via sublocale) |
| Persistent | Results generalized at `end` | Results persist under locale name |

Use **context blocks** for temporary scoping within a theory. Use **locales** for reusable parameterized theories.

---

## 6. Named Theorems and Fact Management

### 6.1 Naming Conventions

Isabelle uses a hierarchical naming scheme:

```
theory_name.theorem_name
locale_name.theorem_name
```

Within a theory, theorems are accessed by their short names. Across theories, use qualified names.

### 6.2 Theorem Collections

```isabelle
lemmas group_simps = assoc left_neutral right_neutral
                     left_inverse right_inverse
```

This creates a named collection `group_simps` that can be used as:

```isabelle
by (simp add: group_simps)
```

### 6.3 Notes

The `note` command binds a name to a previously established fact:

```isabelle
note important_fact = conjunct1 [OF some_theorem]
```

### 6.4 `declare` for Global Attributes

```isabelle
declare my_lemma [simp]           (* add to the global simp set *)
declare my_lemma [simp del]       (* remove from the global simp set *)
declare my_lemma [intro]          (* add as a default intro rule *)
```

---

## 7. The Theory Graph

### 7.1 How It Works

Isabelle's theory graph is a DAG where nodes are theories and edges are import relationships. When you write `imports Main`, your theory becomes a child of `Main` in the graph.

The key properties:

- **Monotonicity**: importing more theories never breaks existing proofs.
- **Caching**: theories are compiled and cached; unchanged theories are not recompiled.
- **Dependency tracking**: Isabelle knows exactly which axioms every theorem depends on.

### 7.2 Viewing the Graph

In jEdit:

- The **Theories** panel shows all loaded theories and their status (green = processed, red = errors, yellow = processing).
- Session graphs can be visualized with `isabelle browser`.

### 7.3 Building a Library

For a significant development:

1. Organize theories into layers: foundational definitions, basic lemmas, main results, applications.
2. Keep each theory focused on one concept or closely related concepts.
3. Use locales for parameterized theories.
4. Use the AFP conventions if you plan to contribute.

---

## 8. Exercises

**Exercise 8.1.** Define a locale `lattice` extending `partial_order` with meet and join operations and their characteristic properties. Prove that meet and join are commutative and associative within the locale.

**Exercise 8.2.** Prove a sublocale relationship showing that every total order is a lattice (with meet = min and join = max).

**Exercise 8.3.** Define a locale `ring` with addition, multiplication, zero, one, and negation. State the ring axioms. Prove that $0 \cdot x = 0$ from the axioms.

**Exercise 8.4.** Provide an interpretation showing that the integers `(int)` with standard operations form a ring.

**Exercise 8.5.** Inside the `group` locale, prove the equation-solving property: for any $a$ and $b$, there exists a unique $x$ such that $a \cdot x = b$.

**Exercise 8.6.** Explain the difference between `interpretation` and `sublocale`. When should you use each?

---

## References

- Ballarin, C. "Locales: A Module System for Mathematical Theories." *Journal of Automated Reasoning* 52(2):123-153, 2014.
- Ballarin, C. "Interpretation of Locales in Isabelle: Theories and Proof Contexts." *MKM 2006*.
- Kammuller, F., Wenzel, M., and Paulson, L.C. "Locales: A Sectioning Concept for Isabelle." *TPHOLs 1999*.
- Haftmann, F. and Wenzel, M. "Local Theory Specifications in Isabelle/Isar." *TYPES 2008*.
- The Isabelle source: `src/HOL/Algebra/` (algebraic hierarchy examples).

---

*Previous: [Lecture 02c: Proof Methods -- rule, blast, auto](lecture_02c_proof_methods_deep_dive.md)*
*Next: Module 03 — ZFC Axioms*
