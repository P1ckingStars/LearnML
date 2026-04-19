---
title: "Recitation 10: Proof Assistants Tour"
tags:
  - type-theory
  - frontiers
  - recitation
---
# Recitation 10: Proof Assistants Tour

> **Module 10 --- Frontiers (Weeks 19--20)**
> Estimated study time: 4--5 hours

---

## Overview

This recitation provides a hands-on tour of three major proof assistants: **Coq/Rocq**, **Lean 4**, and **Agda** (including Cubical Agda). The goal is not to make you an expert in any single system, but to give you enough facility to (a) read and understand formalizations in each system, (b) carry out simple proofs and definitions, and (c) make an informed choice about which system to use for your own work.

Each section follows the same structure: we introduce the basic mechanics (defining types, writing functions, proving theorems), work through a small formalization exercise, and highlight the system's distinctive strengths and weaknesses.

---

## 1. Coq/Rocq

### 1.1 Overview

Coq (recently rebranded as Rocq) is the oldest of the three systems, with development beginning in 1984. It is based on the **Calculus of Inductive Constructions (CIC)**, a dependent type theory with:

- A hierarchy of universes: $\text{Prop}$, $\text{Set}$, $\text{Type}_0$, $\text{Type}_1$, \ldots
- Inductive types (natural numbers, lists, trees, etc.) with dependent elimination.
- A distinction between computational content ($\text{Set}$, $\text{Type}$) and logical content ($\text{Prop}$, with proof irrelevance for some purposes).

Coq's proof language is **Ltac** (and its successor **Ltac2**), a domain-specific tactic language for interactive proof construction. Users also have access to the **Gallina** term language for direct term construction and the **SSReflect** tactic language from the Mathematical Components library.

### 1.2 Basic Definitions

**Inductive types.**

```coq
Inductive nat : Set :=
  | O : nat
  | S : nat -> nat.

Inductive list (A : Type) : Type :=
  | nil : list A
  | cons : A -> list A -> list A.

Arguments nil {A}.
Arguments cons {A} _ _.
Notation "x :: xs" := (cons x xs).
Notation "[]" := nil.
```

**Recursive functions.**

```coq
Fixpoint plus (n m : nat) : nat :=
  match n with
  | O => m
  | S n' => S (plus n' m)
  end.

Fixpoint length {A : Type} (xs : list A) : nat :=
  match xs with
  | [] => O
  | _ :: xs' => S (length xs')
  end.

Fixpoint append {A : Type} (xs ys : list A) : list A :=
  match xs with
  | [] => ys
  | x :: xs' => x :: append xs' ys
  end.
Notation "xs ++ ys" := (append xs ys).
```

**Dependent types.**

```coq
Inductive Vec (A : Type) : nat -> Type :=
  | vnil : Vec A O
  | vcons : forall n, A -> Vec A n -> Vec A (S n).

Definition vhead {A : Type} {n : nat} (v : Vec A (S n)) : A :=
  match v with
  | vcons _ a _ => a
  end.
```

The type of `vhead` guarantees that it is only called on non-empty vectors --- the `(S n)` index ensures this statically.

### 1.3 The Proof Object

Unlike Lean and Agda, Coq maintains a strict separation between the *proof term* (the underlying lambda calculus term) and the *tactic script* (the sequence of commands used to construct it). The tactic script is not stored; only the resulting proof term is type-checked and saved.

This has important consequences:

- **Proof irrelevance (in Prop):** Proofs of propositions in $\text{Prop}$ are erased during extraction. Two proofs of the same proposition are considered equal for extraction purposes.
- **Proof terms can be inspected:** The command `Print` shows the underlying proof term, which can be large and unreadable but is the ultimate source of truth.
- **Tactics vs. terms:** Simple proofs can be written directly as terms (`exact`, `refine`), while complex proofs use tactics for convenience.

```coq
(* A proof written as a term *)
Definition plus_O_n (n : nat) : 0 + n = n := eq_refl n.

(* The same proof written with tactics *)
Theorem plus_O_n' : forall n : nat, 0 + n = n.
Proof. intros n. simpl. reflexivity. Qed.
```

### 1.4 Proving Theorems with Ltac

Coq proofs are constructed interactively using *tactics*. A tactic transforms the current *goal* (a type to be inhabited) into zero or more subgoals. When all subgoals are discharged, the proof is complete.

**Example: associativity of addition.**

```coq
Theorem plus_assoc : forall n m k : nat,
  plus n (plus m k) = plus (plus n m) k.
Proof.
  intros n m k.          (* introduce universally quantified variables *)
  induction n as [| n' IHn'].
  - (* Base case: n = O *)
    simpl.               (* simplify plus O x = x *)
    reflexivity.         (* goal is now m + k = m + k *)
  - (* Inductive case: n = S n' *)
    simpl.               (* simplify plus (S n') x = S (plus n' x) *)
    rewrite IHn'.        (* apply induction hypothesis *)
    reflexivity.
Qed.
```

**Common tactics:**

| Tactic | Effect |
|--------|--------|
| `intros x y z` | Move hypotheses from goal to context |
| `simpl` | Simplify (unfold definitions, reduce matches) |
| `reflexivity` | Prove `x = x` |
| `rewrite H` | Rewrite goal using hypothesis `H : a = b` |
| `induction x` | Perform structural induction on `x` |
| `destruct x` | Case analysis on `x` |
| `apply H` | Apply hypothesis or lemma `H` |
| `exact t` | Provide the exact proof term `t` |
| `auto` | Automated proof search (first-order) |
| `omega` / `lia` | Linear integer arithmetic decision procedure |
| `unfold f` | Unfold the definition of `f` |
| `assert (H : P)` | Introduce a subgoal for intermediate claim `P` |

**Example: length of append.**

```coq
Theorem length_append : forall (A : Type) (xs ys : list A),
  length (xs ++ ys) = plus (length xs) (length ys).
Proof.
  intros A xs ys.
  induction xs as [| x xs' IHxs'].
  - simpl. reflexivity.
  - simpl. rewrite IHxs'. reflexivity.
Qed.
```

**Example: the map-append distributivity law.**

```coq
Fixpoint map {A B : Type} (f : A -> B) (xs : list A) : list B :=
  match xs with
  | [] => []
  | x :: xs' => f x :: map f xs'
  end.

Theorem map_append : forall (A B : Type) (f : A -> B) (xs ys : list A),
  map f (xs ++ ys) = map f xs ++ map f ys.
Proof.
  intros A B f xs ys.
  induction xs as [| x xs' IHxs'].
  - (* Base case: xs = [] *)
    simpl. reflexivity.
  - (* Inductive case: xs = x :: xs' *)
    simpl.                     (* unfold map and append *)
    rewrite IHxs'.             (* apply induction hypothesis *)
    reflexivity.
Qed.
```

**Example: a proof using automation.**

```coq
Require Import Arith.
Require Import Lia.

(* lia handles linear integer arithmetic automatically *)
Theorem example_lia : forall n m : nat,
  n + m = m + n.
Proof.
  intros. lia.
Qed.

(* ring handles ring equalities *)
Require Import Ring.
Theorem example_ring : forall n m : nat,
  (n + m) * (n + m) = n*n + 2*n*m + m*m.
Proof.
  intros. ring.
Qed.
```

### 1.5 SSReflect Style

The Mathematical Components library uses SSReflect, a tactic language that emphasizes small, composable steps and avoids naming intermediate terms.

```coq
From mathcomp Require Import ssreflect ssrbool ssrnat.

Lemma addnA : associative addn.
Proof. by elim=> // n IHn m k; rewrite /= IHn. Qed.
```

SSReflect's `elim` performs induction, `//` discharges trivial subgoals, `/=` simplifies, and `rewrite` applies equalities. The style is more concise but has a steeper learning curve.

### 1.5 Formalization Exercise: Reverse is Involutive

```coq
Fixpoint rev {A : Type} (xs : list A) : list A :=
  match xs with
  | [] => []
  | x :: xs' => rev xs' ++ [x]
  end.

(* Helper lemma *)
Lemma rev_append : forall (A : Type) (xs ys : list A),
  rev (xs ++ ys) = rev ys ++ rev xs.
Proof.
  intros A xs ys.
  induction xs as [| x xs' IHxs'].
  - simpl. (* rev [] ++ rev ys = rev ys *)
    (* need: rev ys ++ [] = rev ys *)
    rewrite app_nil_r. reflexivity.
  - simpl. rewrite IHxs'.
    rewrite app_assoc. reflexivity.
Qed.

Theorem rev_involutive : forall (A : Type) (xs : list A),
  rev (rev xs) = xs.
Proof.
  intros A xs.
  induction xs as [| x xs' IHxs'].
  - simpl. reflexivity.
  - simpl. rewrite rev_append. simpl.
    rewrite IHxs'. reflexivity.
Qed.
```

### 1.7 Extraction

Coq can extract verified programs to OCaml, Haskell, or Scheme:

```coq
(* A verified sorting function *)
Require Import Extraction.
Extraction Language OCaml.

(* Extract insertion sort to OCaml *)
Extraction "sort.ml" insertionSort.
```

The extracted code is guaranteed to satisfy its specification (as proved in Coq), but may not be the most efficient implementation. CompCert uses this mechanism to produce a verified C compiler: the compiler is written and verified in Coq, then extracted to OCaml for execution.

### 1.8 Strengths and Weaknesses of Coq

**Strengths:**
- Mature and battle-tested (40+ years of development).
- Rich tactic language (Ltac, Ltac2, SSReflect).
- Large libraries: Mathematical Components, the HoTT library, CompCert, Iris.
- Strong automation via `omega`/`lia`, `ring`, `field`, and custom decision procedures.
- Extraction to OCaml, Haskell, and Scheme.

**Weaknesses:**
- Steep learning curve, especially for tactic-based proof.
- The proof term language (Gallina) is relatively low-level.
- Universe management can be cumbersome.
- Performance issues for large developments (slow type checking, large proof terms).
- The Prop/Set distinction can be confusing and occasionally limiting.

---

## 2. Lean 4

### 2.1 Overview

Lean 4 is a dependently typed language developed by Leonardo de Moura at Microsoft Research (now at AWS). It serves both as a proof assistant and as a general-purpose programming language. Lean 4 is the foundation of the **Mathlib** project, the largest unified library of formalized mathematics.

Key features:
- Based on the **Calculus of Inductive Constructions** (similar to Coq).
- A modern, functional programming surface syntax with pattern matching, `do` notation, and type class inference.
- Powerful **metaprogramming** via the `Lean.Elab` and `Lean.Meta` monads.
- Compiled to C for efficient execution.

### 2.2 Basic Definitions

```lean
-- Natural numbers (built-in, but we could define them)
-- inductive Nat where
--   | zero : Nat
--   | succ : Nat -> Nat

-- Lists
inductive MyList (A : Type) where
  | nil : MyList A
  | cons : A -> MyList A -> MyList A

-- Recursive function
def MyList.append {A : Type} : MyList A -> MyList A -> MyList A
  | .nil, ys => ys
  | .cons x xs, ys => .cons x (xs.append ys)

-- Dependent types: Vectors
inductive Vec (A : Type) : Nat -> Type where
  | nil : Vec A 0
  | cons : {n : Nat} -> A -> Vec A n -> Vec A (n + 1)

def Vec.head {A : Type} {n : Nat} : Vec A (n + 1) -> A
  | .cons a _ => a
```

### 2.3 Proving Theorems in Lean 4

Lean 4 supports both **term-mode** proofs (directly constructing proof terms) and **tactic-mode** proofs (interactive goal-directed proving).

**Example: associativity of addition.**

```lean
-- Tactic mode
theorem Nat.add_assoc (n m k : Nat) :
    n + (m + k) = (n + m) + k := by
  induction n with
  | zero => simp
  | succ n' ih => simp [Nat.succ_add, ih]

-- Term mode (for simple proofs)
theorem Nat.zero_add (n : Nat) : 0 + n = n :=
  rfl  -- holds by definition
```

**Common tactics:**

| Tactic | Effect |
|--------|--------|
| `intro x` / `intros` | Introduce hypotheses |
| `rfl` | Prove `x = x` |
| `simp [lemmas]` | Simplification using lemma database |
| `rw [h]` | Rewrite using hypothesis or lemma `h` |
| `induction x with` | Structural induction |
| `cases x with` | Case analysis |
| `apply h` | Apply hypothesis or lemma |
| `exact t` | Provide exact proof term |
| `omega` | Linear arithmetic |
| `ring` | Ring arithmetic |
| `constructor` | Apply the constructor of the goal type |
| `have h : P := proof` | Introduce an intermediate claim |
| `calc` | Calculational proof |

**Example: calculational proof.**

```lean
theorem add_comm (n m : Nat) : n + m = m + n := by
  induction n with
  | zero => simp
  | succ n' ih =>
    calc n'.succ + m
        = (n' + m).succ := by rfl
      _ = (m + n').succ := by rw [ih]
      _ = m + n'.succ   := by rw [Nat.add_succ]
```

### 2.4 Type Classes in Lean 4

Lean 4 makes extensive use of type classes for ad hoc polymorphism and mathematical structures.

```lean
-- Defining a type class
class Group (G : Type) extends Mul G, One G, Inv G where
  mul_assoc : forall a b c : G, a * b * c = a * (b * c)
  one_mul : forall a : G, 1 * a = a
  inv_mul_cancel : forall a : G, a⁻¹ * a = 1

-- Defining an instance
instance : Group Int where
  mul := Int.mul
  one := 1
  inv := Int.neg
  mul_assoc := Int.mul_assoc
  one_mul := Int.one_mul
  inv_mul_cancel := Int.neg_add_cancel
```

### 2.5 Mathlib Tour

Mathlib is organized into a deep hierarchy of mathematical structures. A brief tour:

```lean
import Mathlib.GroupTheory.Sylow
import Mathlib.Analysis.NormedSpace.Basic
import Mathlib.Topology.MetricSpace.Basic

-- Mathlib has Sylow's theorems
#check Sylow.exists_subgroup_card_pow_prime

-- Normed spaces
#check NormedSpace
-- A normed space over a field k is a module M over k with a norm
-- satisfying the triangle inequality and compatibility with scalar multiplication.

-- Metric spaces
#check MetricSpace
-- Includes complete metric spaces, Baire category theorem, etc.
```

Mathlib contains formalizations of:
- Group theory (Sylow theorems, solvable groups, group actions)
- Ring theory (Noetherian rings, PIDs, DVRs)
- Linear algebra (eigenvalues, Jordan normal form)
- Analysis (Lebesgue integration, Fourier analysis, distributions)
- Topology (compactness, connectedness, fundamental group)
- Number theory (quadratic reciprocity, analytic number theory)
- Category theory (adjunctions, limits, Yoneda lemma)
- Combinatorics (Ramsey theory, extremal graph theory)

### 2.6 Formalization Exercise: List Reversal in Lean 4

```lean
def myReverse {A : Type} : List A -> List A
  | [] => []
  | x :: xs => myReverse xs ++ [x]

theorem reverse_append {A : Type} (xs ys : List A) :
    myReverse (xs ++ ys) = myReverse ys ++ myReverse xs := by
  induction xs with
  | nil => simp [myReverse]
  | cons x xs' ih =>
    simp [myReverse]
    rw [ih]
    rw [List.append_assoc]

theorem reverse_reverse {A : Type} (xs : List A) :
    myReverse (myReverse xs) = xs := by
  induction xs with
  | nil => simp [myReverse]
  | cons x xs' ih =>
    simp [myReverse]
    rw [reverse_append]
    simp [myReverse, ih]
```

### 2.7 Strengths and Weaknesses of Lean 4

**Strengths:**
- Modern, clean syntax and a pleasant programming experience.
- Powerful `simp` tactic with a large database of lemmas (in Mathlib).
- Excellent metaprogramming capabilities.
- Active and rapidly growing community, especially around Mathlib.
- Good performance (compiled to C).
- Strong IDE support (VS Code extension with live feedback).

**Weaknesses:**
- Relatively young compared to Coq and Agda (less battle-tested).
- Mathlib is large and can be slow to compile.
- The tactic language is less mature than Coq's Ltac (though improving rapidly).
- Less support for HoTT (no native cubical mode; though some HoTT formalizations exist).

---

## 3. Agda

### 3.1 Overview

Agda is a dependently typed programming language and proof assistant developed primarily at Chalmers University (Gothenburg, Sweden). Unlike Coq and Lean, Agda emphasizes **direct term construction** over tactic-based proof. Programs and proofs are written in the same language, with no distinction between "proof mode" and "program mode."

Key features:
- Dependent pattern matching with **dot patterns** and **absurd patterns**.
- No tactics by default (though a reflection-based tactic framework exists).
- **Cubical Agda** mode for HoTT (see Section 3.5).
- Unicode-heavy syntax, enabling mathematical notation.
- Instance arguments (similar to type classes).

### 3.2 Basic Definitions

```agda
-- Natural numbers
data Nat : Set where
  zero : Nat
  suc  : Nat -> Nat

-- Addition
_+_ : Nat -> Nat -> Nat
zero  + m = m
suc n + m = suc (n + m)

-- Lists
data List (A : Set) : Set where
  []  : List A
  _::_ : A -> List A -> List A

-- Append
_++_ : {A : Set} -> List A -> List A -> List A
[]       ++ ys = ys
(x :: xs) ++ ys = x :: (xs ++ ys)

-- Vectors (dependent types)
data Vec (A : Set) : Nat -> Set where
  []  : Vec A zero
  _::_ : {n : Nat} -> A -> Vec A n -> Vec A (suc n)

-- Head of a non-empty vector (total!)
head : {A : Set} {n : Nat} -> Vec A (suc n) -> A
head (x :: _) = x
```

### 3.3 Proofs as Programs

In Agda, proofs are constructed by writing functions that have the appropriate type. The propositional equality type is:

```agda
data _==_ {A : Set} : A -> A -> Set where
  refl : {a : A} -> a == a

-- Symmetry
sym : {A : Set} {a b : A} -> a == b -> b == a
sym refl = refl

-- Transitivity
trans : {A : Set} {a b c : A} -> a == b -> b == c -> a == c
trans refl refl = refl

-- Congruence
cong : {A B : Set} {a b : A} (f : A -> B) -> a == b -> f a == f b
cong f refl = refl
```

**Example: associativity of addition.**

```agda
+-assoc : (n m k : Nat) -> (n + (m + k)) == ((n + m) + k)
+-assoc zero    m k = refl
+-assoc (suc n) m k = cong suc (+-assoc n m k)
```

This proof is a recursive function: the base case is trivial (both sides reduce to `m + k`), and the inductive case applies `cong suc` to the inductive hypothesis.

**Example: commutativity of addition.**

```agda
-- Helper lemma
+-suc : (n m : Nat) -> (n + suc m) == suc (n + m)
+-suc zero    m = refl
+-suc (suc n) m = cong suc (+-suc n m)

-- Helper lemma
+-zero : (n : Nat) -> (n + zero) == n
+-zero zero    = refl
+-zero (suc n) = cong suc (+-zero n)

-- Main theorem
+-comm : (n m : Nat) -> (n + m) == (m + n)
+-comm zero    m = sym (+-zero m)
+-comm (suc n) m = trans (cong suc (+-comm n m)) (sym (+-suc m n))
```

### 3.4 Dependent Pattern Matching

Agda's dependent pattern matching is one of its most powerful features. It allows patterns to refine the types of other variables in scope.

```agda
-- Fin n: type of natural numbers less than n
data Fin : Nat -> Set where
  zero : {n : Nat} -> Fin (suc n)
  suc  : {n : Nat} -> Fin n -> Fin (suc n)

-- Safe lookup in a vector
lookup : {A : Set} {n : Nat} -> Vec A n -> Fin n -> A
lookup (x :: xs) zero    = x
lookup (x :: xs) (suc i) = lookup xs i
-- No case for [] because Fin zero is empty (no constructors)
```

The empty case for `[]` is implicit: since there is no constructor for `Fin zero`, Agda knows the case is impossible and does not require it.

**Absurd patterns.**

```agda
-- The empty type has no inhabitants
data Bot : Set where

-- Ex falso quodlibet
absurd : {A : Set} -> Bot -> A
absurd ()
```

The `()` is an *absurd pattern*, indicating that the argument cannot be constructed. Agda accepts this as a complete definition.

### 3.5 Cubical Agda

Cubical Agda extends Agda with cubical type theory primitives, enabling HoTT with computational univalence (as discussed in Lecture 10b).

```agda
{-# OPTIONS --cubical #-}

open import Cubical.Foundations.Prelude
open import Cubical.Foundations.Univalence
open import Cubical.Foundations.Isomorphism

-- Function extensionality is trivial in cubical Agda
funExt' : {A B : Type} {f g : A -> B}
        -> ((x : A) -> f x ≡ g x) -> f ≡ g
funExt' h i x = h x i

-- Univalence: constructing a path from an equivalence
boolAutoPath : Bool ≡ Bool
boolAutoPath = ua (isoToEquiv notIso)
  where
    notIso : Iso Bool Bool
    Iso.fun notIso = not
    Iso.inv notIso = not
    Iso.rightInv notIso true  = refl
    Iso.rightInv notIso false = refl
    Iso.leftInv notIso true   = refl
    Iso.leftInv notIso false  = refl

-- Transport computes!
test : transport boolAutoPath true ≡ false
test = refl   -- definitional equality
```

### 3.6 Formalization Exercise: Reverse is Involutive (Agda)

```agda
-- Reverse
reverse : {A : Set} -> List A -> List A
reverse []       = []
reverse (x :: xs) = reverse xs ++ (x :: [])

-- Helper: append with nil
++-nil : {A : Set} (xs : List A) -> (xs ++ []) == xs
++-nil []       = refl
++-nil (x :: xs) = cong (x ::_) (++-nil xs)

-- Helper: append is associative
++-assoc : {A : Set} (xs ys zs : List A)
         -> ((xs ++ ys) ++ zs) == (xs ++ (ys ++ zs))
++-assoc []       ys zs = refl
++-assoc (x :: xs) ys zs = cong (x ::_) (++-assoc xs ys zs)

-- Helper: reverse distributes over append
reverse-++ : {A : Set} (xs ys : List A)
           -> reverse (xs ++ ys) == (reverse ys ++ reverse xs)
reverse-++ [] ys = sym (++-nil (reverse ys))
reverse-++ (x :: xs) ys =
  trans (cong (_++ (x :: [])) (reverse-++ xs ys))
        (sym (++-assoc (reverse ys) (reverse xs) (x :: [])))

-- Main theorem
reverse-involutive : {A : Set} (xs : List A)
                   -> reverse (reverse xs) == xs
reverse-involutive []       = refl
reverse-involutive (x :: xs) =
  trans (reverse-++ (reverse xs) (x :: []))
        (cong (x ::_) (reverse-involutive xs))
```

### 3.7 Strengths and Weaknesses of Agda

**Strengths:**
- Elegant, proof-relevant style: proofs are programs, no tactic overhead.
- Excellent dependent pattern matching with dot patterns and absurd patterns.
- Cubical Agda provides computational HoTT.
- Beautiful Unicode syntax, close to mathematical notation.
- Good for teaching type theory and dependently typed programming.

**Weaknesses:**
- No built-in tactic language (must construct proof terms explicitly, which can be verbose for complex proofs).
- Smaller standard library compared to Coq and Lean.
- Weaker automation than Coq or Lean (no `simp`, no `omega` by default; though the `agda2hs` and `agda-stdlib` projects are improving this).
- Termination and positivity checking can be restrictive.
- Performance can be poor for large developments.

---

## 4. Comparison

| Feature | Coq/Rocq | Lean 4 | Agda |
|---------|----------|--------|------|
| **Foundation** | CIC | CIC variant | MLTT + extensions |
| **Proof style** | Tactic-based | Tactic + term | Term-based |
| **Tactic language** | Ltac, Ltac2, SSReflect | Lean tactic framework | Reflection (limited) |
| **Automation** | Strong (omega, ring, auto) | Strong (simp, omega, ring) | Limited (auto, C-n C-a) |
| **HoTT support** | HoTT library (axiom-based) | Limited | Cubical Agda (native) |
| **Library size** | Large (MathComp, CompCert) | Very large (Mathlib) | Moderate (stdlib, 1Lab) |
| **Programming** | Extraction to OCaml/Haskell | Native compilation to C | Compilation via GHC |
| **Metaprogramming** | Ltac, OCaml plugins | Lean meta, macros | Reflection |
| **Learning curve** | Steep | Moderate | Moderate |
| **Community** | Established, stable | Rapidly growing | Smaller, focused |

### 4.1 When to Use Which System

- **Use Coq** when you need the most mature verification infrastructure, access to CompCert or Iris, or want to use SSReflect for algebraic proofs.
- **Use Lean 4** when you want to formalize mathematics (Mathlib is unmatched in breadth), need good programming language features, or want modern tooling and a growing community.
- **Use Agda** when you are doing HoTT research (Cubical Agda), want the cleanest dependently typed programming experience, or are teaching type theory.

---

## 5. Extended Exercise: Formalizing a Simple Theorem

Choose one of the three systems and formalize the following:

**Theorem (Pigeonhole Principle, finite version).** If $f : \text{Fin}(n+1) \to \text{Fin}(n)$ is any function, then $f$ is not injective.

**Hints:**

*In Coq:*
```coq
(* Define Fin as an inductive type or use the standard library *)
(* Use induction on n, with case analysis on f(0) *)
(* The key step: construct a function Fin(n) -> Fin(n-1) from f *)
```

*In Lean 4:*
```lean
-- Use Fin from Mathlib or define your own
-- Lean's omega tactic is useful for the arithmetic
-- Consider using Finset.card_lt_card for a high-level proof
```

*In Agda:*
```agda
-- Define Fin and injective
-- Use dependent pattern matching for the case analysis
-- The proof will be a direct recursive construction
```

This exercise is intentionally open-ended. The point is to experience the workflow of each system: defining types, constructing proofs, and dealing with the system's idiosyncrasies.

---

## 6. Installation and Setup

### Coq/Rocq

```bash
# Using opam (OCaml package manager)
opam install coq

# Verify installation
coqc --version

# IDE: CoqIDE (bundled) or VS Code with VsCoq extension
```

### Lean 4

```bash
# Using elan (Lean version manager)
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh

# Create a new project
lake new my_project

# IDE: VS Code with lean4 extension (recommended)
```

### Agda

```bash
# Using cabal (Haskell package manager)
cabal install Agda

# Install standard library
# See: https://github.com/agda/agda-stdlib

# For cubical Agda, install the cubical library:
# See: https://github.com/agda/cubical

# IDE: Emacs with agda-mode (traditional) or VS Code with agda-mode extension
```

---

## 7. Exercises

**Exercise 10r.1.** In Coq, prove that `map f (xs ++ ys) = map f xs ++ map f ys` for any function `f` and lists `xs`, `ys`.

**Exercise 10r.2.** In Lean 4, define the type of sorted lists (as a dependent type or a subtype with a proof of sortedness) and implement an insertion function that preserves sortedness.

**Exercise 10r.3.** In Agda, define the type `Even : Nat -> Set` (a predicate asserting that a natural number is even) and prove that the sum of two even numbers is even.

**Exercise 10r.4.** In Cubical Agda, prove that `Bool` is a set (i.e., all paths between booleans are equal) using the encode-decode method.

**Exercise 10r.5.** Choose one system and formalize the proof that every natural number is either even or odd. Compare the proof complexity and readability across the three systems by sketching (but not necessarily completing) the proof in the other two.

**Exercise 10r.6.** In your chosen system, define a simple expression language (with natural number literals, addition, and variables), define an evaluation function, and prove a simple property (e.g., evaluation is deterministic, or a constant-folding optimization is correct).

**Exercise 10r.7 (Extended).** Formalize the pigeonhole principle as described in Section 5. Write a brief (1--2 paragraph) reflection on the experience: what was easy, what was hard, and what would be different in the other systems.

---

## Summary

- **Coq/Rocq** is the most established proof assistant, with powerful tactics (Ltac, SSReflect), strong automation, and battle-tested libraries (CompCert, MathComp, Iris). It is the system of choice for program verification and formalized algebra.
- **Lean 4** combines a proof assistant with a practical programming language, featuring modern syntax, powerful metaprogramming, and the rapidly growing Mathlib library. It is the system of choice for large-scale formalization of mathematics.
- **Agda** emphasizes direct term construction and dependent pattern matching, with Cubical Agda providing native support for HoTT. It is the system of choice for type theory research and HoTT.
- All three systems are based on variants of the Calculus of Inductive Constructions (or closely related dependent type theories) and share the same foundational principles studied throughout this course.
- The choice of proof assistant depends on the application: verification (Coq), mathematics (Lean), or type theory research (Agda).

---

## Further Reading

1. **Bertot, Y. and Cast\'eran, P.** *Interactive Theorem Proving and Program Development: Coq'Art.* Springer, 2004.

2. **Chlipala, A.** *Certified Programming with Dependent Types.* MIT Press, 2013. Available at [adam.chlipala.net/cpdt](http://adam.chlipala.net/cpdt/).

3. **Avigad, J., de Moura, L., Kong, S., and Ullrich, S.** *Theorem Proving in Lean 4.* Available at [leanprover.github.io/theorem_proving_in_lean4](https://leanprover.github.io/theorem_proving_in_lean4/).

4. **Moura, L. de and Ullrich, S.** "The Lean 4 Theorem Prover and Programming Language." *CADE*, 2021.

5. **Norell, U.** "Dependently Typed Programming in Agda." *AFP*, 2009. Available at [wiki.portal.chalmers.se/agda](https://wiki.portal.chalmers.se/agda/).

6. **Vezzosi, A., M\"ortberg, A., and Abel, A.** "Cubical Agda: A Dependently Typed Programming Language with Univalence and Higher Inductive Types." *ICFP*, 2019.

7. **The 1Lab.** [1lab.dev](https://1lab.dev). A literate Cubical Agda library with extensive commentary.

8. **Mathlib documentation.** [leanprover-community.github.io/mathlib4_docs](https://leanprover-community.github.io/mathlib4_docs/).

9. **Gonthier, G. and Mahboubi, A.** "An Introduction to Small Scale Reflection in Coq." *Journal of Formalized Reasoning* 3(2), 2010.

10. **The Software Foundations series.** [softwarefoundations.cis.upenn.edu](https://softwarefoundations.cis.upenn.edu/). A comprehensive, interactive Coq textbook covering logic, programming languages, and verification.
