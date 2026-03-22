# Lecture 02c: Proof Methods -- rule, blast, auto

> **Module 02 — First-Order Logic in Isabelle (Weeks 3-4)**
> Estimated study time: 5-7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain in detail how the `rule` method resolves a goal against a theorem using higher-order unification.
2. Describe how `blast` works as a tableau prover and when it excels.
3. Explain how `auto` combines simplification with classical reasoning.
4. Configure `auto` and `simp` with `intro:`, `elim:`, `dest:`, `simp add:` modifiers.
5. Choose the appropriate proof method for a given goal.
6. Debug proof failures using method modifiers and proof state inspection.

---

## 1. The `rule` Method in Depth

### 1.1 Resolution

At its core, `rule thm` performs *resolution* — the fundamental operation of Isabelle's kernel. Given a goal $G$ and a theorem $thm$ with conclusion $C$:

1. Isabelle attempts to *unify* $C$ with $G$ using higher-order unification.
2. If unification succeeds with substitution $\sigma$, the goal $G$ is replaced by the premises of $thm$, all with $\sigma$ applied.

**Example.** Goal: `P(a) & Q(b)`. Applying `rule conjI`:

```
conjI: [| ?P; ?Q |] ==> ?P & ?Q
```

Unification: `?P & ?Q` with `P(a) & Q(b)` gives `?P = P(a)`, `?Q = Q(b)`.

New subgoals: `P(a)` and `Q(b)`.

### 1.2 Higher-Order Unification Details

Because Isabelle's terms are in the simply-typed lambda calculus, unification is *higher-order*. This means schematic variables can be instantiated with lambda terms.

**Example.** Goal: `EX x. x = a & P(x)`. Applying `rule exI`:

```
exI: ?P(?a) ==> EX x. ?P(x)
```

Unification: `EX x. ?P(x)` with `EX x. x = a & P(x)`. This requires `?P = %x. x = a & P(x)`. Then the premise becomes `?a = a & P(?a)`, and `?a` is left as a schematic (to be determined by subsequent proof steps).

### 1.3 The Default Rule Selection

When `rule` is called without an argument, Isabelle selects a default introduction rule based on the goal's outermost connective. The defaults for FOL:

| Goal shape | Default rule |
|-----------|-------------|
| `?P & ?Q` | `conjI` |
| `?P --> ?Q` | `impI` |
| `ALL x. ?P(x)` | `allI` |
| `?P <-> ?Q` | `iffI` |
| `~?P` | `notI` |
| `True` | `TrueI` |

For HOL, additional defaults include `subsetI`, `equalityI`, etc.

### 1.4 Multiple Matches and Backtracking

When a rule has multiple possible unifications with the goal or assumptions, Isabelle explores them in order. If the first match leads to a dead end (a later step fails), Isabelle backtracks and tries the next match.

In Isar, backtracking is limited: `by (rule thm)` tries all matches and succeeds if any of them solves the goal completely. In apply-script style, `apply (rule thm)` commits to the first match.

---

## 2. The `blast` Method

### 2.1 How `blast` Works

`blast` implements a *tableau prover* for classical first-order logic. The algorithm:

1. **Negate the goal** and add it to the set of formulas.
2. **Apply tableau expansion rules** that decompose formulas:
   - $\alpha$-rules (conjunctive): $A \land B$ produces $A$ and $B$ on the same branch.
   - $\beta$-rules (disjunctive): $A \lor B$ splits into two branches, one with $A$ and one with $B$.
   - $\gamma$-rules (universal): $\forall x.\, P(x)$ can be instantiated with any term.
   - $\delta$-rules (existential): $\exists x.\, P(x)$ introduces a fresh Skolem constant.
3. **Close branches**: a branch is closed when it contains both $A$ and $\neg A$.
4. **Backtrack** when a branch cannot be closed.

If all branches are closed, the original goal is proved.

### 2.2 What `blast` Is Good At

- **Pure logical reasoning**: propositional and first-order tautologies.
- **Deep quantifier nesting**: `blast` handles alternating quantifiers well.
- **Large search spaces**: its tableau strategy is systematic about backtracking.

### 2.3 What `blast` Cannot Do

- **Equational reasoning**: `blast` does not rewrite equations. Use `simp` for that.
- **Arithmetic**: `blast` has no notion of numbers. Use `arith` or `linarith`.
- **Induction**: `blast` works only within the proof theory of first-order logic.
- **Higher-order reasoning**: `blast` is fundamentally first-order; for HOL goals with higher-order features, other methods may be needed.

### 2.4 Configuring `blast`

```isabelle
apply (blast intro: thms dest: thms elim: thms)
```

- `intro: thms` — add theorems as introduction rules.
- `dest: thms` — add theorems as destruction rules.
- `elim: thms` — add theorems as elimination rules.

`blast` does not use the simplifier, so `simp add:` has no effect.

### 2.5 Example

```isabelle
lemma "(ALL x. P(x) --> Q(x)) --> (ALL x. Q(x) --> R(x)) --> (ALL x. P(x) --> R(x))"
  by blast
```

Internally, `blast` negates the goal, Skolemizes the existentials, and searches for a contradiction. For this example, it finds:

1. Assume $\forall x.\, P(x) \to Q(x)$ and $\forall x.\, Q(x) \to R(x)$.
2. Assume $P(c)$ for a Skolem constant $c$ (from the negated conclusion).
3. Instantiate the universals with $c$: $P(c) \to Q(c)$ and $Q(c) \to R(c)$.
4. Chain: $P(c) \to Q(c) \to R(c)$, contradicting the assumption $\neg R(c)$.

---

## 3. The `auto` Method

### 3.1 How `auto` Works

`auto` combines two engines:

1. **The simplifier** (`simp`): rewrites terms using oriented equations.
2. **The classical reasoner**: applies safe and unsafe introduction/elimination rules.

The algorithm interleaves:

1. Apply all *safe* rules (those that cannot lose information): `conjI`, `impI`, `allI`, `conjE`, `disjE`, `exE`, etc.
2. Simplify using the current `simp` set.
3. If the goal is not solved, try *unsafe* rules with limited backtracking: `disjI1`, `disjI2`, `exI`, `allE`, `impE`.
4. Repeat.

### 3.2 The Safe/Unsafe Distinction

**Safe rules** (applied eagerly, no backtracking):

- Introduction: `conjI`, `impI`, `allI`, `notI`, `iffI`, `TrueI`
- Elimination: `conjE`, `disjE`, `exE`, `FalseE`

**Unsafe rules** (applied with backtracking):

- Introduction: `disjI1`, `disjI2`, `exI`
- Elimination: `allE`, `impE`

Users can add rules to these sets using the `intro!:` (safe intro), `intro:` (unsafe intro) modifiers, and analogously for `elim!:`, `elim:`, `dest!:`, `dest:`.

### 3.3 Configuring `auto`

The full modifier syntax:

```isabelle
apply (auto intro: thms intro!: thms
            elim: thms elim!: thms
            dest: thms dest!: thms
            simp add: thms simp del: thms
            split: thms)
```

**Common patterns:**

```isabelle
(* Add a lemma as a simp rule for this call only *)
by (auto simp add: my_def)

(* Add an introduction rule *)
by (auto intro: exI [of _ "a"])

(* Remove a problematic simp rule *)
by (auto simp del: some_looping_rule)

(* Add a split rule for case expressions *)
by (auto split: if_splits)
```

### 3.4 Partial Success

Unlike `blast`, `auto` can *partially* solve a goal. If it solves some subgoals but not all, the unsolved subgoals remain. This is useful for reducing a complex goal to a simpler core:

```isabelle
apply auto   (* solves 3 of 5 subgoals *)
(* now manually solve the remaining 2 *)
```

### 3.5 When `auto` Loops

`auto` can enter an infinite loop if:

- A `simp` rule is non-terminating (e.g., `x = x + 0` combined with `x + 0 = x`).
- An unsafe intro/elim rule creates an ever-growing proof state.

To debug, try `simp` alone first (to isolate whether the simplifier is looping), or use `auto simp del:` to remove suspect simp rules.

---

## 4. `force` and `fastforce`

### 4.1 Relationship to `auto`

`force` and `fastforce` are strengthened versions of `auto`:

- **`fastforce`** uses a more aggressive search strategy than `auto`. It backtracks more thoroughly over unsafe rules.
- **`force`** is even more aggressive: it uses a *best-first search* strategy that can solve goals requiring deeper search.

The tradeoff is runtime:

$$\text{auto (fast, weak)} \longrightarrow \text{fastforce} \longrightarrow \text{force (slow, strong)}$$

### 4.2 When to Use Each

- **`auto`**: First attempt for any goal. Handles most routine goals.
- **`fastforce`**: When `auto` almost succeeds but leaves one or two subgoals. Often solving them individually with `fastforce` works.
- **`force`**: Last resort before manual reasoning. Useful for goals that require deep case analysis.
- **`blast`**: When the goal is purely logical (no equational content). Complement to `simp`/`auto`.

---

## 5. The `simp` Method in Depth

### 5.1 Rewriting

`simp` applies rewrite rules left-to-right until no more rules apply. A rewrite rule is an equation `l = r` (or a conditional equation `P ==> l = r`), interpreted as "replace occurrences of $l$ with $r$."

### 5.2 The Simplification Loop

```
repeat:
  for each simp rule l = r:
    for each subterm t of the goal:
      if t matches l (by higher-order matching):
        replace t with r (under the matching substitution)
        if the rule is conditional (P ==> l = r):
          try to prove P using the simplifier recursively
          if P is not provable, do not apply the rule
until no rule applies
```

### 5.3 Conditional Rewriting

A conditional rewrite rule like:

```isabelle
lemma [simp]: "x ~= 0 ==> (x * y) / x = y"
```

is applied only when the simplifier can verify the condition `x ~= 0` from the current assumptions.

### 5.4 Congruence Rules

Congruence rules control how the simplifier traverses term structure. For example, the congruence rule for `if-then-else`:

```isabelle
[| b = b'; b' ==> x = x'; ~b' ==> y = y' |]
  ==> (if b then x else y) = (if b' then x' else y')
```

This tells the simplifier: when simplifying `if b then x else y`, simplify `b` first; then simplify `x` under the assumption `b'` and `y` under the assumption `~b'`. This prevents the simplifier from simplifying both branches without knowing the condition.

### 5.5 Tracing

To debug `simp`, enable tracing:

```isabelle
using [[simp_trace]]
```

This prints every rule application, showing exactly what `simp` is doing. The output can be verbose but is invaluable for understanding failures and loops.

---

## 6. Decision Procedures

### 6.1 `arith`

The `arith` method decides linear arithmetic over natural numbers, integers, and reals:

```isabelle
lemma "(x :: nat) + y < z ==> x < z"
  by arith

lemma "(x :: int) < y ==> y < z ==> x < z"
  by arith
```

It handles: $=$, $<$, $\le$, $+$, $-$, multiplication by constants, and Boolean combinations.

### 6.2 `presburger`

Presburger arithmetic extends `arith` with quantifiers over integers:

```isabelle
lemma "EX (x :: int). 2 * x = y \<longleftrightarrow> 2 dvd y"
  by presburger
```

### 6.3 Choosing the Right Decision Procedure

| Goal | Method |
|------|--------|
| Linear inequality without quantifiers | `arith` or `linarith` |
| Quantified integer arithmetic | `presburger` |
| Polynomial equations over rings | `algebra` |
| General purpose | `auto`, `blast`, `force` |

---

## 7. Method Selection Strategy

When faced with a goal, try methods in this order:

1. **`by auto`** — works for most routine goals.
2. **`by simp`** — when the goal is purely equational.
3. **`by blast`** — when the goal is purely logical (no equations).
4. **`by fastforce`** or **`by force`** — when `auto` nearly works.
5. **`by arith`** — when the goal involves arithmetic.
6. **Manual Isar proof** — when automation fails, decompose the proof into steps.

When automation fails on a step in your manual proof, try:

```isabelle
by (auto intro: relevant_lemma simp add: relevant_def)
```

Adding the right lemma or definition unfolding often makes `auto` succeed.

---

## 8. Debugging Techniques

### 8.1 Inspecting the Proof State

Use `apply` temporarily to see what a method produces:

```isabelle
lemma "..."
  apply auto
  (* Output panel shows remaining subgoals *)
```

### 8.2 Using `simp only:`

When `simp` loops or produces unexpected results, restrict it:

```isabelle
apply (simp only: rule1 rule2)
```

This uses only the specified rules, isolating the problem.

### 8.3 Using `rule` to Decompose

When `auto` fails, try decomposing manually:

```isabelle
apply (rule conjI)    (* split a conjunction goal *)
apply (rule impI)     (* introduce an assumption *)
apply (erule disjE)   (* case-split a disjunction *)
```

Then apply `auto`/`blast`/`simp` to each subgoal individually.

### 8.4 Adding Missing Lemmas

If `auto` fails, it often means a key lemma is missing from its search space:

```isabelle
apply (auto intro: key_lemma dest: another_lemma simp add: definition_thm)
```

Use `find_theorems` to discover relevant lemmas.

---

## 9. Exercises

**Exercise 9.1.** For the goal `"(P | Q) & (P | R) --> P | (Q & R)"`, manually apply `rule impI`, then `erule conjE`, then try each of `auto`, `blast`, `simp`, and `force`. Which succeed? Why?

**Exercise 9.2.** Prove `"ALL x. EX y. x = y"` using: (a) `rule`/`rule`, (b) `auto`, (c) `blast`. Compare the proof states at each step for approach (a).

**Exercise 9.3.** Create a simp rule that causes `simp` to loop. Demonstrate the loop (with `simp_trace`) and explain how to fix it.

**Exercise 9.4.** Prove `"(ALL x. P(x) <-> Q(x)) ==> (EX x. P(x)) <-> (EX x. Q(x))"` using `auto`. Then prove it manually using only named rules. Which proof is shorter? Which is more informative?

**Exercise 9.5.** The Drinker's Paradox: `"EX x. P(x) --> (ALL y. P(y))"`. Try `blast` and `auto`. If they fail, why? Add the `classical` rule or `excluded_middle` to help: `by (blast intro: classical)`. Explain why classical reasoning is essential.

---

## References

- Paulson, L.C. "A Generic Tableau Prover and its Integration with Isabelle." *JUCSS* 5(3), 1999.
- Nipkow, T. "Winskel is (Almost) Right: Towards a Mechanized Semantics Textbook." *Formal Aspects of Computing*, 1998.
- Wenzel, M. *The Isabelle/Isar Reference Manual*. Chapters on Proof Methods and the Simplifier.
- Nipkow, T. and Klein, G. *Concrete Semantics with Isabelle/HOL*. Chapter 2.

---

*Previous: [Lecture 02b: Natural Deduction Rules in Isabelle](lecture_02b_natural_deduction_rules.md)*
*Next: [Lecture 02d: Locales & Structured Theory Development](lecture_02d_locales_structured_development.md)*
