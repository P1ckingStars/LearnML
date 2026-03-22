# Lecture 01a: The Pure Metalogic

> **Module 01 — Isabelle/Pure & the Isar Language (Weeks 1-2)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe Isabelle/Pure as a fragment of intuitionistic higher-order logic serving as a metalogic.
2. State and explain the three primitive connectives of Pure: meta-implication ($\Longrightarrow$), meta-universal quantification ($\bigwedge$), and meta-equality ($\equiv$).
3. Explain how object logics (FOL, HOL, ZF) are built on top of Pure by declaring types, constants, and axioms.
4. Distinguish schematic variables from fixed variables and explain their roles in proof.
5. Read and write Isabelle theory files with the correct structure.
6. Explain the simply-typed lambda calculus that underlies Isabelle's term language.

---

## 1. Motivation: Why a Metalogic?

Isabelle is not a theorem prover for one specific logic. It is a *logical framework* — a system for defining and reasoning within arbitrary logics. The key enabler is the separation between:

- **The metalogic (Pure):** A fixed, minimal logic built into Isabelle's kernel. It provides the infrastructure for stating inference rules, managing assumptions, and handling variable binding.
- **Object logics (FOL, HOL, ZF, ...):** Specific logical systems defined within Pure. Each object logic declares its own types, connectives, and inference rules as Pure axioms.

This design means that Isabelle's kernel need not change when we switch from classical first-order logic to set theory to higher-order logic. The kernel only understands Pure; everything else is a user-level definition.

---

## 2. The Simply-Typed Lambda Calculus

### 2.1 Types

Isabelle's term language is based on the simply-typed lambda calculus (Church 1940). Every term has a type. The type system is:

**Type syntax:**

$$\tau ::= \alpha \mid c \mid \tau_1 \Rightarrow \tau_2 \mid (\tau_1, \ldots, \tau_n) c$$

where:

- $\alpha, \beta, \gamma, \ldots$ are *type variables* (polymorphism).
- $c$ is a *type constructor* (e.g., `bool`, `nat`, `prop`).
- $\tau_1 \Rightarrow \tau_2$ is the function type (right-associative: $\alpha \Rightarrow \beta \Rightarrow \gamma$ means $\alpha \Rightarrow (\beta \Rightarrow \gamma)$).
- $(\tau_1, \ldots, \tau_n) c$ is a type constructor applied to arguments (e.g., $(\alpha)\text{list}$, written `'a list` in Isabelle syntax).

**Key types in Pure:**

| Type | Isabelle syntax | Meaning |
|------|----------------|---------|
| `prop` | `prop` | The type of propositions (metalogical) |
| `'a => 'b` | `'a => 'b` | Function type |

### 2.2 Terms

**Term syntax:**

$$t ::= x \mid c \mid \lambda x :: \tau.\, t \mid t_1 \; t_2$$

where:

- $x$ is a variable (with a type annotation).
- $c$ is a constant (declared with a fixed type).
- $\lambda x :: \tau.\, t$ is lambda abstraction (binding $x$ of type $\tau$ in body $t$).
- $t_1 \; t_2$ is function application (left-associative).

**Beta reduction:** $(\lambda x.\, t) \; s \longrightarrow_\beta t[s/x]$.

**Eta conversion:** $\lambda x.\, f \; x = f$ when $x$ is not free in $f$.

Isabelle uses beta-eta equality as definitional equality — two terms that are beta-eta equivalent are considered identical.

### 2.3 Type Inference

Isabelle uses Hindley-Milner-style type inference (extended for type classes). Users rarely need to write explicit type annotations. When you write:

```isabelle
term "f x"
```

Isabelle infers the most general type: if `f :: 'a => 'b` and `x :: 'a`, then `f x :: 'b`.

---

## 3. The Three Primitives of Pure

Isabelle/Pure has exactly three logical primitives. Everything else — in every object logic — is built from these.

### 3.1 Meta-Implication ($\Longrightarrow$)

```isabelle
Pure.imp :: prop => prop => prop    (infixr "==>" 1)
```

The term $A \Longrightarrow B$ means "assuming $A$, conclude $B$" at the meta-level. It is used to express inference rules. For example, modus ponens in FOL is the Pure theorem:

$$\llbracket P \longrightarrow Q;\; P \rrbracket \Longrightarrow Q$$

which is syntactic sugar for:

$$(P \longrightarrow Q) \Longrightarrow P \Longrightarrow Q$$

The bracket notation $\llbracket A_1;\; A_2;\; \ldots;\; A_n \rrbracket \Longrightarrow B$ stands for $A_1 \Longrightarrow A_2 \Longrightarrow \cdots \Longrightarrow A_n \Longrightarrow B$.

**Crucial distinction.** Meta-implication ($\Longrightarrow$) is *not* the same as object-level implication ($\longrightarrow$ in FOL, or $\longrightarrow$ in HOL). The former is part of Isabelle's infrastructure; the latter is a connective defined within a specific object logic. They obey different rules and have different types:

- $\Longrightarrow$ has type `prop => prop => prop` (Pure's `prop`)
- $\longrightarrow$ in FOL has type `o => o => o` (FOL's `o`, the type of object-logic propositions)

### 3.2 Meta-Universal Quantification ($\bigwedge$)

```isabelle
Pure.all :: ('a => prop) => prop    (binder "!!" 0)
```

Written `!!x. P(x)` in Isabelle ASCII or $\bigwedge x.\, P(x)$ in mathematical notation. It means "for every $x$, $P(x)$" at the meta-level.

The universal introduction rule for FOL is the Pure theorem:

$$\left(\bigwedge x.\, P(x)\right) \Longrightarrow \forall x.\, P(x)$$

This says: if $P(x)$ holds for an arbitrary $x$ (meta-universally), then $\forall x.\, P(x)$ holds (object-universally).

**Why two levels of "for all"?** The meta-level $\bigwedge$ expresses the schematic nature of a rule: the rule works for *any* instantiation of the variable. The object-level $\forall$ is a connective within the logic we are reasoning about. Conflating them would break the framework's generality.

### 3.3 Meta-Equality ($\equiv$)

```isabelle
Pure.eq :: 'a => 'a => prop    (infixr "==" 2)
```

Written `t == s` in Isabelle ASCII or $t \equiv s$ in mathematical notation. Meta-equality is used for *definitions* — it asserts that two terms are definitionally equal.

For example, when defining negation in FOL:

$$\neg P \equiv P \longrightarrow \bot$$

this is a meta-equality: it says that $\neg P$ *is defined to be* $P \longrightarrow \text{False}$. In FOL, conjunction is axiomatized via introduction/elimination rules rather than defined by meta-equality (a Church-style encoding like $P \land Q \equiv \forall R.\, (P \to Q \to R) \to R$ requires higher-order quantification, which FOL does not have).

### 3.4 Nothing Else

These three primitives — plus the simply-typed lambda calculus for terms — are *all* that Pure provides. There is no meta-level negation, no meta-level disjunction, no meta-level existential. This minimality is deliberate: it makes the kernel small and easy to trust.

---

## 4. How Object Logics Are Built

### 4.1 The Pattern

An object logic is defined by a theory file that:

1. **Declares a type** for object-level propositions (e.g., `o` in FOL, `bool` in HOL).
2. **Declares a coercion** (the `Trueprop` judgment) that lifts object-level propositions into Pure's `prop` type.
3. **Declares constants** for the object-level connectives.
4. **Asserts axioms** as Pure theorems, expressing the inference rules of the object logic.

### 4.2 Example: How FOL Defines Conjunction

In Isabelle/FOL, the setup looks roughly like:

```isabelle
typedecl o                              (* declare the type of FOL propositions *)

judgment
  Trueprop :: "o => prop"    ("(_)" 5)  (* coercion from o to prop *)

consts
  conj :: "o => o => o"      (infixr "&" 35)
  True :: "o"
  False :: "o"
  imp  :: "o => o => o"      (infixr "-->" 25)
  (* ... other connectives ... *)
```

The `Trueprop` coercion is what connects the object logic to Pure. When Isabelle sees a goal like:

```
P & Q ==> Q & P
```

it is actually parsing this as:

```
Trueprop(P & Q) ==> Trueprop(Q & P)
```

The `Trueprop` wrappers are hidden by Isabelle's notation mechanism, but they are there.

### 4.3 Axioms as Pure Theorems

The inference rules of FOL are declared as axioms in Pure. For conjunction:

```isabelle
axiomatization where
  conjI:  "[| P; Q |] ==> P & Q" and
  conjunct1: "P & Q ==> P" and
  conjunct2: "P & Q ==> Q"
```

Each of these is a Pure theorem with the declared name. The axiom `conjI` says: given (meta-implication) that `P` holds and `Q` holds, conclude `P & Q`. Isabelle's kernel stores these as primitive theorems; all subsequent proofs about conjunction ultimately reduce to applications of these axioms.

---

## 5. Schematic Variables vs Fixed Variables

### 5.1 Fixed Variables

A *fixed variable* (also called a *free variable*) is a specific but unspecified entity. In a proof context, fixed variables are introduced by `fix` in Isar or by the eigenvariable condition in $\forall$I. They represent "an arbitrary but fixed object."

In Isabelle, fixed variables are displayed in normal font: `x`, `y`, `P`.

### 5.2 Schematic Variables

A *schematic variable* (also called a *meta-variable* or *unknowns*) is a placeholder that can be instantiated. When a theorem is stored in the database, its free variables become schematic. In Isabelle, schematic variables are prefixed with `?`:

```
?P & ?Q ==> ?Q & ?P
```

This theorem can be instantiated: replacing `?P` with any formula $\varphi$ and `?Q` with any formula $\psi$ yields $\varphi \land \psi \Longrightarrow \psi \land \varphi$.

The distinction matters during proof:

- **Inside a proof**, variables are fixed. The statement `fix x` introduces a fixed variable that represents "an arbitrary $x$."
- **After the proof**, the fixed variables in the theorem statement become schematic, allowing the theorem to be applied to any instance.

### 5.3 Example

```isabelle
lemma swap: "P & Q ==> Q & P"
proof -
  assume pq: "P & Q"         (* P and Q are fixed here *)
  from pq have "Q" by (rule conjunct2)
  from pq have "P" by (rule conjunct1)
  then show "Q & P" using `Q` by (rule conjI)
qed
```

After the proof, Isabelle stores:

```
swap: ?P & ?Q ==> ?Q & ?P
```

with schematic variables, ready to be instantiated.

---

## 6. Theory Files

### 6.1 Structure

Every Isabelle development is organized into *theory files* with extension `.thy`. A theory file has the structure:

```isabelle
theory MyTheory
  imports Main
begin

(* declarations, definitions, lemmas, proofs *)

end
```

The key components:

- **`theory MyTheory`**: declares the theory name (must match the filename).
- **`imports Main`**: specifies parent theories. `Main` is the standard entry point for Isabelle/HOL; for FOL, use `imports FOL`.
- **`begin ... end`**: the theory body, containing all definitions, lemmas, and proofs.

### 6.2 Import Graph

Isabelle theories form a directed acyclic graph (DAG) via imports. A theory can access all definitions and theorems from its imports (transitively). The root of the graph is `Pure`.

```
Pure
 |
 +-- FOL
 |    +-- ZF
 |
 +-- HOL
      +-- Main
           +-- Your_Theory
```

### 6.3 A Complete Example

```isabelle
theory First_Example
  imports FOL
begin

(* A simple lemma about conjunction commutativity *)
lemma conj_comm: "P & Q --> Q & P"
proof (rule impI)
  assume "P & Q"
  hence "Q" by (rule conjunct2)
  from `P & Q` have "P" by (rule conjunct1)
  with `Q` show "Q & P" by (rule conjI)
qed

(* The same lemma, proved more concisely *)
lemma conj_comm': "P & Q --> Q & P"
  by (auto)

end
```

### 6.4 Key Declarations

| Declaration | Purpose | Example |
|------------|---------|---------|
| `lemma` / `theorem` | State and prove a result | `lemma foo: "P --> P"` |
| `definition` | Introduce a new constant with a defining equation | `definition square :: "nat => nat" where "square n = n * n"` |
| `primrec` | Primitive recursive definition | `primrec fact :: "nat => nat" where ...` |
| `fun` | General recursive definition (with termination proof) | `fun fib :: "nat => nat" where ...` |
| `datatype` | Define an algebraic datatype | `datatype 'a list = Nil \| Cons 'a "'a list"` |
| `locale` | Parameterized theory with assumptions | `locale group = ...` |
| `typedef` | Define a new type as a nonempty subset of an existing type | `typedef pos = "{n::nat. n > 0}"` |

---

## 7. The Type `prop` and the Judgment `Trueprop`

### 7.1 How It Works

Pure has a single type for propositions: `prop`. Every statement in Pure is a term of type `prop`.

Object logics have their own proposition type (e.g., `o` in FOL, `bool` in HOL). The `Trueprop` judgment bridges the gap:

```
Trueprop :: o => prop       (* in FOL *)
Trueprop :: bool => prop    (* in HOL *)
```

When you write `P & Q` in an FOL context, Isabelle implicitly wraps it: the actual Pure-level term is `Trueprop (P & Q)`. This coercion is what allows FOL propositions to appear in Pure-level judgments.

### 7.2 Why This Design?

Without `Trueprop`, every object-logic rule would need to explicitly mention the embedding. With it, the notation is clean: users write FOL formulas as if Pure didn't exist, and the coercion is invisible.

But understanding `Trueprop` is essential for debugging. When Isabelle reports a type error or a unification failure, the `Trueprop` wrapper sometimes surfaces, and you need to understand what it means.

---

## 8. Higher-Order Unification

### 8.1 The Role of Unification

When Isabelle applies a rule to a goal, it needs to match the rule's conclusion against the current goal. This matching is done by *unification* — finding a substitution for schematic variables that makes two terms equal.

In the simply-typed lambda calculus, unification is *higher-order*: variables can range over functions, not just first-order terms. Higher-order unification is undecidable in general (Huet, 1973), but Isabelle uses Huet's semi-algorithm, which works well in practice.

### 8.2 Example

Suppose the goal is:

```
P(a) & Q(b) ==> Q(b) & P(a)
```

and we apply the rule `conjI: [| ?P; ?Q |] ==> ?P & ?Q`. Isabelle needs to unify `?P & ?Q` with `Q(b) & P(a)`, finding `?P = Q(b)` and `?Q = P(a)`. This generates two subgoals: prove `Q(b)` and prove `P(a)`.

### 8.3 Flex-Flex Pairs

Higher-order unification can produce *flex-flex pairs* — equations between two schematic variables applied to arguments. These are always solvable and are left as constraints. In practice, they indicate that the proof is underdetermined (multiple instantiations would work), and Isabelle resolves them later.

---

## 9. Exercises

**Exercise 9.1.** Explain why Pure's meta-implication $\Longrightarrow$ is intuitionistic (not classical). What would be different if Pure had a classical meta-implication? Would this affect the object logics?

**Exercise 9.2.** Write a theory file that imports FOL and states (but does not prove) the following lemma:

```
"(P --> Q) --> (Q --> R) --> (P --> R)"
```

Identify which arrows are object-level ($\longrightarrow$) and which could alternatively be meta-level ($\Longrightarrow$). Rewrite the statement using $\Longrightarrow$ for as many arrows as possible.

**Exercise 9.3.** After proving the lemma `foo: "P & Q ==> Q & P"`, Isabelle stores it with schematic variables. When we later apply `foo` to the goal `A(x) & B(y) ==> B(y) & A(x)`, what substitution does unification find for `?P` and `?Q`?

**Exercise 9.4.** Explain why Isabelle uses beta-eta equality as the notion of definitional equality. What would go wrong if only beta equality were used? Give an example of two terms that are eta-equal but not beta-equal.

**Exercise 9.5.** Consider the type `('a => prop) => prop`. What kind of entity does a term of this type represent? Give an example related to Pure's meta-quantifier.

---

## References

- Paulson, L.C. "The Foundation of a Generic Theorem Prover." *Journal of Automated Reasoning* 5(3):363-397, 1989.
- Paulson, L.C. "Isabelle: The Next 700 Theorem Provers." In *Logic and Computer Science*, pp. 361-386. Academic Press, 1990.
- Nipkow, T., Paulson, L.C., and Wenzel, M. *Isabelle/HOL: A Proof Assistant for Higher-Order Logic*. Springer LNCS 2283, 2002. Chapters 1-3.
- Wenzel, M. *The Isabelle/Isar Reference Manual*. Included with the Isabelle distribution.
- Church, A. "A Formulation of the Simple Theory of Types." *Journal of Symbolic Logic* 5(2):56-68, 1940.

---

*Next: [Lecture 01b: Isar Structured Proofs](lecture_01b_isar_structured_proofs.md)*
