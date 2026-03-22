# Lecture 02a: IFOL & the Classical Extension

> **Module 02 — First-Order Logic in Isabelle (Weeks 3-4)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Read and understand the `IFOL.thy` theory file that axiomatizes intuitionistic first-order logic in Isabelle.
2. Explain how the `Trueprop` judgment connects object-level propositions (type `o`) to Pure's `prop` type.
3. Trace how each connective is axiomatized via natural deduction introduction and elimination rules.
4. State the quantifier rules (`allI`, `allE`, `exI`, `exE`) and their precise Isabelle formulations.
5. Explain how `FOL.thy` extends IFOL to classical logic by adding a single axiom.
6. Derive classical rules (excluded middle, double negation elimination) from the classical axiom.

---

## 1. Motivation

In Module 01, we learned Isabelle's metalogic (Pure) and the Isar proof language in the abstract. Now we study a specific object logic: first-order logic (FOL), as formalized in Isabelle.

Isabelle's FOL comes in two layers:

- **IFOL** (Intuitionistic First-Order Logic): the constructive core, containing all connectives and quantifiers with their natural deduction rules, but without the law of excluded middle.
- **FOL** (Classical First-Order Logic): IFOL extended with a single classical axiom that gives us excluded middle, double negation elimination, and proof by contradiction.

Understanding how IFOL is axiomatized reveals the general pattern for building any logic within Isabelle: declare types, declare constants, and assert axioms as Pure theorems.

---

## 2. The IFOL Theory

### 2.1 The Proposition Type

IFOL begins by declaring the type of object-level propositions:

```isabelle
typedecl o
```

This introduces `o` as a new type with no constructors — it is an abstract type whose elements are "FOL propositions." Compare with Pure's `prop`: while `prop` is the type of meta-level propositions, `o` is the type of object-level propositions.

### 2.2 The Trueprop Judgment

The bridge between `o` and `prop` is the `Trueprop` judgment:

```isabelle
judgment
  Trueprop :: "o => prop"    ("(_)" 5)
```

This declaration tells Isabelle:

1. There is a function `Trueprop :: o => prop` that lifts FOL propositions to Pure propositions.
2. The notation `(_)` means `Trueprop` is implicit — when you write `P` where a `prop` is expected, Isabelle silently wraps it as `Trueprop(P)`.

**Why this matters.** When you write:

```isabelle
lemma "P & Q --> Q & P"
```

Isabelle parses this as:

```isabelle
lemma "Trueprop(P & Q --> Q & P)"
```

And the meta-implication in an inference rule like `conjI`:

```
[| P; Q |] ==> P & Q
```

is actually:

```
[| Trueprop(P); Trueprop(Q) |] ==> Trueprop(P & Q)
```

Understanding this is essential for debugging type errors involving `prop` and `o`.

### 2.3 Connective Declarations

IFOL declares the logical connectives as constants on `o`:

```isabelle
consts
  True  :: "o"
  False :: "o"
  Not   :: "o => o"              ("~ _" [40] 40)
  conj  :: "[o, o] => o"         (infixr "&" 35)
  disj  :: "[o, o] => o"         (infixr "|" 30)
  imp   :: "[o, o] => o"         (infixr "-->" 25)
  iff   :: "[o, o] => o"         (infixr "<->" 25)
```

And the quantifiers as higher-order constants:

```isabelle
consts
  All  :: "('a => o) => o"       (binder "ALL " 10)
  Ex   :: "('a => o) => o"       (binder "EX " 10)
```

The type `('a => o) => o` is crucial. A quantifier takes a *predicate* (a function from some type to `o`) and returns a proposition. So `ALL x. P(x)` is actually `All(%x. P(x))` — the universal quantifier applied to the lambda abstraction `%x. P(x)`.

### 2.4 Equality

Equality is declared polymorphically:

```isabelle
consts
  eq :: "['a, 'a] => o"         (infixl "=" 50)
```

This gives us equality for any type, not just a specific type. The type variable `'a` is implicitly universally quantified.

---

## 3. Axiomatization of IFOL

### 3.1 The Axiom Pattern

Each connective is characterized by its natural deduction rules, which are asserted as axioms (Pure theorems):

```isabelle
axiomatization where
  rule_name: "rule_statement"
```

### 3.2 Conjunction

```isabelle
axiomatization where
  conjI:     "[| P; Q |] ==> P & Q" and
  conjunct1: "P & Q ==> P" and
  conjunct2: "P & Q ==> Q"
```

**Reading these as natural deduction rules:**

- `conjI` is $\land$-Introduction: from premises $P$ and $Q$, conclude $P \land Q$.
- `conjunct1` is $\land$-Elimination (left): from $P \land Q$, conclude $P$.
- `conjunct2` is $\land$-Elimination (right): from $P \land Q$, conclude $Q$.

Note that Isabelle uses *destruction*-style elimination rules (projections) rather than the traditional Gentzen-style $\land$-Elimination that produces $R$ from $P \land Q$ and a subproof using both $P$ and $Q$. Isabelle also provides the Gentzen-style rule as a derived rule:

```isabelle
lemma conjE: "[| P & Q; [| P; Q |] ==> R |] ==> R"
  by (drule conjunct1, drule conjunct2, ...)
```

### 3.3 Disjunction

```isabelle
axiomatization where
  disjI1: "P ==> P | Q" and
  disjI2: "Q ==> P | Q" and
  disjE:  "[| P | Q; P ==> R; Q ==> R |] ==> R"
```

- `disjI1`: from $P$, conclude $P \lor Q$ (inject left).
- `disjI2`: from $Q$, conclude $P \lor Q$ (inject right).
- `disjE`: case analysis — if $P \lor Q$ holds, and $R$ follows from $P$, and $R$ follows from $Q$, then $R$.

### 3.4 Implication

```isabelle
axiomatization where
  impI: "(P ==> Q) ==> P --> Q" and
  mp:   "[| P --> Q; P |] ==> Q"
```

- `impI`: if $Q$ follows from $P$ (meta-implication), then $P \longrightarrow Q$ (object-implication).
- `mp` (modus ponens): from $P \longrightarrow Q$ and $P$, conclude $Q$.

**The subtle role of `impI`.** This rule converts a meta-implication ($\Longrightarrow$) into an object-implication ($\longrightarrow$). It is the bridge between Isabelle's proof infrastructure and the object logic's implication.

### 3.5 Negation and Falsehood

```isabelle
abbreviation Not :: "o => o" where
  "~P == P --> False"

axiomatization where
  FalseE: "False ==> P"
```

Negation is *defined* as an abbreviation for implication of falsehood: $\neg P \equiv P \longrightarrow \bot$. This is not an axiom — it is a definitional abbreviation. In the Isabelle source, `Not` is declared as a constant with `consts` and its meaning is given by an `abbreviation` (or definitional axiom `not_def`), not by the `definition` command.

`FalseE` (ex falso quodlibet): from $\bot$, anything follows.

Derived rules:

```
notI:  "(P ==> False) ==> ~P"        (* from impI and Not_def *)
notE:  "[| ~P; P |] ==> R"           (* from mp, Not_def, FalseE *)
```

### 3.6 Biconditional

```isabelle
definition iff :: "[o, o] => o" where
  "(P <-> Q) == (P --> Q) & (Q --> P)"
```

The biconditional is defined as the conjunction of both implications. Derived rules:

```
iffI:  "[| P ==> Q; Q ==> P |] ==> P <-> Q"
iffD1: "[| P <-> Q; P |] ==> Q"
iffD2: "[| P <-> Q; Q |] ==> P"
iffE:  "[| P <-> Q; [| P --> Q; Q --> P |] ==> R |] ==> R"
```

### 3.7 Truth

```isabelle
definition True :: "o" where
  "True == False --> False"

lemma TrueI: "True"
  unfolding True_def by (rule impI)
```

Truth is defined as $\bot \to \bot$, which is intuitionistically valid. The proof: assume $\bot$, conclude $\bot$ (trivially).

---

## 4. The Quantifier Rules

### 4.1 Universal Quantifier

```isabelle
axiomatization where
  allI: "(!!x. P(x)) ==> ALL x. P(x)" and
  spec: "ALL x. P(x) ==> P(a)"
```

- `allI` ($\forall$-Introduction): if $P(x)$ holds for arbitrary $x$ (meta-universal), then $\forall x.\, P(x)$ holds (object-universal).
- `spec` ($\forall$-Elimination, specialization): from $\forall x.\, P(x)$, conclude $P(a)$ for any term $a$.

**The critical point about `allI`.** The premise uses Pure's meta-universal quantifier `!!x`. This means: the proof of `P(x)` must work for *any* `x`, without knowing anything about it. This corresponds to the eigenvariable condition in natural deduction.

In Isar, this manifests as:

```isabelle
show "ALL x. P(x)"
proof (rule allI)
  fix x
  show "P(x)" by ...
qed
```

The `fix x` introduces a fixed but arbitrary `x`, corresponding to the meta-universal in `allI`'s premise.

### 4.2 Existential Quantifier

```isabelle
axiomatization where
  exI: "P(a) ==> EX x. P(x)" and
  exE: "[| EX x. P(x); !!x. P(x) ==> Q |] ==> Q"
```

- `exI` ($\exists$-Introduction): if $P(a)$ holds for some specific $a$, then $\exists x.\, P(x)$.
- `exE` ($\exists$-Elimination): if $\exists x.\, P(x)$ and $Q$ follows from $P(x)$ for arbitrary $x$ (where $x$ does not occur in $Q$), then $Q$.

In Isar, existential elimination uses `obtain`:

```isabelle
from `EX x. P(x)` obtain a where "P(a)" by (rule exE)
```

### 4.3 Equality Rules

```isabelle
axiomatization where
  refl:  "a = a" and
  subst: "[| a = b; P(a) |] ==> P(b)"
```

From these two axioms, symmetry and transitivity are derived:

```isabelle
lemma sym: "a = b ==> b = a"
proof -
  assume eq: "a = b"
  have "a = a" by (rule refl)
  with eq show "b = a" by (rule subst)
qed

lemma trans: "[| a = b; b = c |] ==> a = c"
proof -
  assume "a = b" and "b = c"
  from `b = c` `a = b` show "a = c" by (rule subst)
qed
```

The proof of symmetry deserves attention. We instantiate `subst` with $P(z) \equiv (z = a)$. From $a = b$ and $P(a) \equiv (a = a)$ (which holds by `refl`), we get $P(b) \equiv (b = a)$.

---

## 5. The Classical Extension: FOL.thy

### 5.1 The Classical Axiom

FOL extends IFOL with a single axiom:

```isabelle
axiomatization where
  classical: "(~P ==> P) ==> P"
```

This is a form of *proof by contradiction*: if assuming $\neg P$ leads to $P$, then $P$ must hold.

Equivalently: if $P$ is the only alternative to $\neg P$ (i.e., $\neg P$ is untenable), then $P$.

### 5.2 Deriving Classical Rules

From the `classical` axiom, all standard classical principles follow.

**Excluded Middle:**

The `classical` axiom states `(~P ==> P) ==> P`. We derive `~P | P` by instantiating `P` with `~P | P`:

```isabelle
lemma excluded_middle: "~P | P"
proof (rule classical)
  assume h: "~(~P | P)"
  have np: "~P"
  proof (rule notI)
    assume p: "P"
    have "~P | P" by (rule disjI2) (rule p)
    with h show "False" by (rule notE)
  qed
  thus "~P | P" by (rule disjI1)
qed
```

The key insight: applying `classical`, we must show `~P | P` under the assumption `~(~P | P)`. We derive `~P` (since assuming `P` yields a contradiction with `h`), then use `disjI1` to conclude `~P | P`.

**Note:** In Isabelle/FOL, the library lemma is named `excluded_middle` and stated as `~P | P` (negation on the left). This matches the form that falls out naturally from the `classical` axiom.

**Double Negation Elimination:**

```isabelle
lemma notnotD: "~~P ==> P"
proof -
  assume nnp: "~~P"
  show "P"
  proof (rule classical)
    assume np: "~P"
    from nnp np have "False" by (rule notE)
    thus "P" by (rule FalseE)
  qed
qed
```

The proof uses `classical` to reduce the goal `P` to showing that `~P` leads to a contradiction. Since we have `~~P` as an assumption, applying `notE` with `~P` yields `False`.

**Reductio ad Absurdum:**

```isabelle
lemma ccontr: "(~P ==> False) ==> P"
proof -
  assume h: "~P ==> False"
  show "P"
  proof (rule classical)
    assume "~P"
    with h have "False" by (rule mp [OF _ `~P`])
    thus "P" by (rule FalseE)
  qed
qed
```

### 5.3 The Relationship Between IFOL and FOL

| Principle | IFOL | FOL |
|-----------|------|-----|
| $P \to \neg\neg P$ | Yes | Yes |
| $\neg\neg P \to P$ | No | Yes |
| $P \lor \neg P$ | No | Yes |
| $((\neg P \to P) \to P)$ | No | Yes (the `classical` axiom) |
| $(\neg P \to \neg Q) \to (Q \to P)$ | No | Yes |
| Peirce's law: $((P \to Q) \to P) \to P$ | No | Yes |

Any theorem provable in IFOL is automatically provable in FOL (since FOL extends IFOL). The converse fails — the principles above separate them.

### 5.4 Which Logic to Use?

For formal verification, **classical logic (FOL or HOL) is standard**. Most mathematical reasoning uses excluded middle freely, and verification projects rarely need to avoid it.

Intuitionistic logic matters when:

- You want proofs to have computational content (program extraction).
- You are formalizing constructive mathematics.
- You are studying the logic itself and want to understand what classical principles "cost."

In Isabelle's FOL, you can freely use `classical`, `excluded_middle`, `notnotD`, and proof by contradiction. If you want to stay intuitionistic, simply avoid these rules — Isabelle will tell you if a proof is valid in IFOL by checking which axioms it depends on.

---

## 6. Exercises

**Exercise 6.1.** Trace the full axiom dependency for the theorem `P & Q --> Q & P`. Which axioms from IFOL are used? Is the `classical` axiom needed?

**Exercise 6.2.** Prove `notI: "(P ==> False) ==> ~P"` from the definition `~P == P --> False` and the rule `impI`. Show each step.

**Exercise 6.3.** Prove `notE: "[| ~P; P |] ==> R"` from the definition of negation, `mp`, and `FalseE`.

**Exercise 6.4.** Prove `"(P --> Q) --> (~Q --> ~P)"` (contrapositive) in IFOL (no classical axiom).

**Exercise 6.5.** Prove `"(~Q --> ~P) --> (P --> Q)"` in FOL (classical axiom required). Identify exactly where classical reasoning is used.

**Exercise 6.6.** Explain why `EX x. P(x)` has the type `o` while `!!x. P(x)` has the type `prop`. What goes wrong if you try to use them interchangeably?

**Exercise 6.7.** The Drinker's Paradox states: "There exists a person in the bar such that if that person is drinking, then everyone in the bar is drinking." Formalize this as `EX x. P(x) --> (ALL y. P(y))` and prove it in FOL. This requires classical logic.

---

## References

- Paulson, L.C. "Isabelle's Logics: FOL and ZF." Isabelle distribution documentation.
- Paulson, L.C. *Logic and Proof* (Cambridge lecture notes). Chapter on first-order logic.
- Troelstra, A.S. and van Dalen, D. *Constructivism in Mathematics*. Vol. 1. North-Holland, 1988.
- The Isabelle source: `src/FOL/IFOL.thy` and `src/FOL/FOL.thy`.

---

*Next: [Lecture 02b: Natural Deduction Rules in Isabelle](lecture_02b_natural_deduction_rules.md)*
