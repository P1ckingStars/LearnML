# Lecture 01d: Locales, Theories & the Isabelle Ecosystem

> **Module 01 — Isabelle/Pure & the Isar Language (Weeks 1-2)**
> Estimated study time: 5-7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain theory organization in Isabelle: imports, sections, and the theory DAG.
2. Define and use locales to create parameterized theories with assumptions.
3. Instantiate locales via interpretation.
4. Navigate the Isabelle ecosystem: the Archive of Formal Proofs (AFP), documentation, and community resources.
5. Manage sessions using ROOT files and Isabelle's build system.
6. Describe Isabelle's available object logics and their relationships.

---

## 1. Theory Organization

### 1.1 The Theory DAG

Every Isabelle development consists of *theory files* organized into a directed acyclic graph (DAG) via imports. When theory `A` imports theory `B`, all definitions, theorems, and declarations from `B` (and transitively, all of `B`'s imports) are available in `A`.

The import mechanism ensures:

- **Monotonicity.** Adding imports never invalidates existing proofs.
- **Modularity.** Theories can be developed independently and composed.
- **Efficiency.** Isabelle caches compiled theories, so unchanged imports are not re-checked.

### 1.2 Standard Entry Points

Each object logic provides a standard entry point:

| Object Logic | Import | Provides |
|-------------|--------|----------|
| Isabelle/HOL | `imports Main` | Higher-order logic, sets, numbers, lists, etc. |
| Isabelle/FOL | `imports FOL` | Classical first-order logic |
| Isabelle/ZF | `imports ZF` | Zermelo-Fraenkel set theory |
| Pure | `imports Pure` | Only the metalogic (rarely used directly) |

### 1.3 Sections

Sections provide local scoping within a theory:

```isabelle
theory My_Theory
  imports Main
begin

section \<open>Basic Properties\<close>

(* declarations and proofs here *)

section \<open>Advanced Results\<close>

(* more declarations and proofs here *)

end
```

Sections in Isabelle are primarily for documentation and structuring the PDF output. They do not affect scoping of definitions (unlike, say, Coq's `Section` command). For local scoping of variables and assumptions, use `context` blocks or locales.

### 1.4 Context Blocks

A `context` block introduces local assumptions and fixed variables:

```isabelle
context
  fixes n :: nat
  assumes pos: "n > 0"
begin

lemma "n >= 1"
  using pos by arith

lemma "n * n >= n"
  using pos by arith

end
```

Facts proved inside the context are universally quantified over the fixed variables and have the context assumptions as premises when used outside.

---

## 2. Locales

### 2.1 Motivation

Many mathematical theories are parameterized: group theory applies to any set with an associative operation and identity element; topology applies to any set with a collection of open sets satisfying certain axioms. We want to develop theory *once* and instantiate it for specific structures.

Locales are Isabelle's mechanism for this. A locale is a named context with:

- **Fixed parameters** (types and terms).
- **Assumptions** about those parameters.
- **Derived facts** proved from the assumptions.

### 2.2 Declaring a Locale

```isabelle
locale semigroup =
  fixes f :: "'a => 'a => 'a"    (infixl "\<cdot>" 70)
  assumes assoc: "x \<cdot> (y \<cdot> z) = (x \<cdot> y) \<cdot> z"
```

This declares a locale `semigroup` parameterized by a binary operation `f` (with infix notation), with the assumption that `f` is associative.

### 2.3 Developing Theory Inside a Locale

Inside a locale, all theorems are proved relative to the locale's assumptions:

```isabelle
context semigroup
begin

lemma left_assoc_4: "a \<cdot> b \<cdot> c \<cdot> d = a \<cdot> (b \<cdot> (c \<cdot> d))"
  by (simp add: assoc)

end
```

This lemma is stored as `semigroup.left_assoc_4` and carries the locale's assumptions as premises.

### 2.4 Extending Locales

Locales can extend other locales:

```isabelle
locale monoid = semigroup +
  fixes e :: "'a"    ("\<one>")
  assumes left_id:  "\<one> \<cdot> x = x"
      and right_id: "x \<cdot> \<one> = x"
```

A monoid is a semigroup with an identity element. The `+` includes all of `semigroup`'s parameters and assumptions.

```isabelle
locale group = monoid +
  fixes inv :: "'a => 'a"    ("_\<inverse>" [1000] 999)
  assumes left_inv: "x\<inverse> \<cdot> x = \<one>"
```

Now we can build a hierarchy:

```
semigroup
    |
  monoid
    |
  group
```

### 2.5 Proving Results in Locales

```isabelle
context group
begin

lemma right_inv: "x \<cdot> x\<inverse> = \<one>"
proof -
  have "x \<cdot> x\<inverse> = \<one> \<cdot> (x \<cdot> x\<inverse>)" by (simp add: left_id)
  also have "... = ((x\<inverse>)\<inverse> \<cdot> x\<inverse>) \<cdot> (x \<cdot> x\<inverse>)" by (simp add: left_inv)
  also have "... = (x\<inverse>)\<inverse> \<cdot> (x\<inverse> \<cdot> x) \<cdot> x\<inverse>" by (simp add: assoc)
  also have "... = (x\<inverse>)\<inverse> \<cdot> \<one> \<cdot> x\<inverse>" by (simp add: left_inv)
  also have "... = (x\<inverse>)\<inverse> \<cdot> x\<inverse>" by (simp add: right_id)
  also have "... = \<one>" by (simp add: left_inv)
  finally show ?thesis .
qed

lemma inv_inv: "(x\<inverse>)\<inverse> = x"
proof -
  have "(x\<inverse>)\<inverse> = (x\<inverse>)\<inverse> \<cdot> \<one>" by (simp add: right_id)
  also have "... = (x\<inverse>)\<inverse> \<cdot> (x\<inverse> \<cdot> x)" by (simp add: left_inv)
  also have "... = ((x\<inverse>)\<inverse> \<cdot> x\<inverse>) \<cdot> x" by (simp add: assoc)
  also have "... = \<one> \<cdot> x" by (simp add: left_inv)
  also have "... = x" by (simp add: left_id)
  finally show ?thesis .
qed

end
```

The `also ... finally` pattern is Isabelle's calculational proof mode, which chains equalities or inequalities.

---

## 3. Locale Interpretation

### 3.1 The Concept

An *interpretation* demonstrates that a specific structure satisfies a locale's assumptions. After interpretation, all theorems proved in the locale are available for the specific structure.

### 3.2 Global Interpretation

```isabelle
interpretation nat_add: monoid "(\<lambda>x y. x + y :: nat)" "0"
proof
  fix x y z :: nat
  show "(x + y) + z = x + (y + z)" by simp
  show "0 + x = x" by simp
  show "x + 0 = x" by simp
qed
```

After this interpretation, theorems like `monoid.left_assoc_4` are available with `+` and `0` on natural numbers:

```isabelle
thm nat_add.left_assoc_4
(* "a + b + c + d = a + (b + (c + d))" *)
```

### 3.3 Sublocale Relationships

A `sublocale` declaration says that one locale is a special case of another:

```isabelle
sublocale group < monoid
  (* Every group is a monoid — this is automatic from the locale hierarchy *)
```

More interestingly:

```isabelle
sublocale group < opposite: group "(\<lambda>x y. y \<cdot> x)" "\<one>" "inv"
proof
  (* Prove that the opposite operation also forms a group *)
  ...
qed
```

This shows that the opposite operation of a group is also a group. After this declaration, all group theorems are automatically available for the opposite operation too.

### 3.4 Example: Integers Form a Group

```isabelle
interpretation int_add: group "(\<lambda>x y. x + y :: int)" "0" "(\<lambda>x. -x)"
proof
  fix x y z :: int
  show "(x + y) + z = x + (y + z)" by simp
  show "0 + x = x" by simp
  show "x + 0 = x" by simp
  show "(-x) + x = 0" by simp
qed
```

Now all group theorems apply to integer addition:

```isabelle
thm int_add.right_inv     (* "x + (-x) = 0" *)
thm int_add.inv_inv       (* "-(- x) = x" *)
```

---

## 4. The Isabelle Ecosystem

### 4.1 The Archive of Formal Proofs (AFP)

The AFP is a curated collection of Isabelle theories, analogous to a journal of formalized mathematics. Key facts:

- Contains 800+ entries (as of 2025) covering algebra, analysis, algorithms, security, programming languages, and more.
- Entries are peer-reviewed and maintained against new Isabelle releases.
- URL: https://www.isa-afp.org/
- Entries can be imported as dependencies in your own theories.

### 4.2 Documentation

Essential documentation (bundled with Isabelle):

| Document | Contents |
|---------|---------|
| *Isabelle/Isar Reference Manual* | Complete reference for the Isar language, proof methods, and system commands |
| *Isabelle/HOL Library Documentation* | Description of HOL theories: sets, numbers, lists, etc. |
| *What's in Main* | Overview of the `Main` theory and available lemmas |
| *Tutorial on Isabelle/HOL* | Introductory tutorial (Nipkow, Paulson, Wenzel) |
| *Concrete Semantics* | Textbook by Nipkow and Klein (free online) |

### 4.3 Community Resources

- **Mailing list:** `isabelle-users@cl.cam.ac.uk` — active, helpful community.
- **Zulip chat:** The Isabelle Zulip instance for real-time discussion.
- **Stack Overflow:** Tag `isabelle` for Q&A.
- **Isabelle release notes:** Important for tracking changes between versions.

---

## 5. Session Management

### 5.1 ROOT Files

When a project grows beyond a single theory file, Isabelle uses *sessions* managed by ROOT files:

```
session My_Project = HOL +
  options [document = pdf, document_output = "output"]
  sessions
    "HOL-Library"
  theories
    My_Theory_A
    My_Theory_B
    Main_Result
  document_files
    "root.tex"
```

Key components:

- **`session My_Project = HOL +`**: declares a session named `My_Project` extending the `HOL` session.
- **`options`**: session-level options (document generation, etc.).
- **`sessions`**: additional session dependencies.
- **`theories`**: the theory files in this session.
- **`document_files`**: LaTeX files for document generation.

### 5.2 Building Sessions

```bash
isabelle build -D .                    # build all sessions in the current directory
isabelle build -b My_Project           # build a specific session
isabelle build -o threads=4 -b My_Project  # parallel build with 4 threads
```

### 5.3 Navigating Large Developments

For large projects:

- Use the **theory panel** in jEdit to browse the import graph.
- Use `find_theorems` and `find_consts` to search across all loaded theories.
- Use Isabelle's document generation to produce a navigable PDF.

---

## 6. Isabelle's Object Logics

### 6.1 Overview

Isabelle ships with several object logics:

**Pure** — The metalogic itself. Provides only meta-implication, meta-quantification, and meta-equality. Not used directly for formalization.

**FOL (First-Order Logic)** — Classical first-order logic. Declares the type `o` of object-level propositions, all propositional and quantifier connectives, and natural deduction rules as axioms. IFOL is the intuitionistic fragment.

**ZF (Zermelo-Fraenkel Set Theory)** — Built on top of FOL. Adds the type `i` of sets, the membership relation, and the ZF axioms (extensionality, pairing, union, powerset, infinity, separation, replacement, regularity). Optionally includes the Axiom of Choice (ZFC). This is a genuine first-order set theory, unlike HOL's higher-order sets.

**HOL (Higher-Order Logic)** — Classical higher-order logic. The type `bool` serves as the proposition type. Built-in types include natural numbers, integers, reals, lists, sets, functions, and more. This is the most widely used object logic and the one we will primarily use later in the course.

**HOLCF** — An extension of HOL with domain theory (Scott's approach to denotational semantics). Provides complete partial orders, continuous functions, and fixed-point theorems.

### 6.2 Choosing an Object Logic

| If your goal is... | Use... |
|--------------------|--------|
| Formalizing mathematics | HOL (for most math) or ZF (for set-theoretic foundations) |
| Program verification | HOL (via Hoare logic libraries) |
| Studying logic itself | FOL or IFOL |
| Denotational semantics | HOLCF |
| New logic research | Define your own on top of Pure |

In this course, we will work with FOL in Module 02, then transition to HOL for the remainder.

---

## 7. Exercises

**Exercise 7.1.** Create a theory file that imports `FOL` and defines a locale `partial_order` with:

- A fixed type `'a` and a binary relation `le :: "'a => 'a => o"`.
- Assumptions: reflexivity, antisymmetry, and transitivity.

(You do not need to prove anything inside the locale yet.)

**Exercise 7.2.** Extend the `partial_order` locale to a `total_order` locale by adding the assumption that any two elements are comparable. Then prove inside the `total_order` locale that `le a b | le b a` holds.

**Exercise 7.3.** Provide an interpretation showing that the natural number ordering `(\<le>)` on `nat` satisfies the `partial_order` locale.

**Exercise 7.4.** The `also ... finally` calculational proof pattern was used in Section 2.5. Explain how it works: what does `also` do? What does `...` (the `\<dots>` symbol) refer to? What does `finally` do?

**Exercise 7.5.** Explain the difference between a `context` block and a `locale`. When would you use one over the other?

**Exercise 7.6.** Examine the ROOT file for a project in the AFP (pick any entry). Identify: the parent session, the list of theory files, and any document configuration. Summarize the project structure.

---

## References

- Ballarin, C. "Locales: A Module System for Mathematical Theories." *Journal of Automated Reasoning* 52(2):123-153, 2014.
- Ballarin, C. "Interpretation of Locales in Isabelle: Theories and Proof Contexts." *MKM 2006*, Springer LNCS 4108.
- Haftmann, F. and Wenzel, M. "Local Theory Specifications in Isabelle/Isar." *TYPES 2008*, Springer LNCS 5497.
- Nipkow, T. and Klein, G. *Concrete Semantics with Isabelle/HOL*. Springer, 2014.
- The Archive of Formal Proofs: https://www.isa-afp.org/

---

*Previous: [Lecture 01c: Proof Methods & Automation](lecture_01c_proof_methods_automation.md)*
*Next: Module 02 — [First-Order Logic in Isabelle](../02_first_order_logic/02_first_order_logic.md)*
