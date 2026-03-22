# Lecture 01c: Proof Methods & Automation

> **Module 01 — Isabelle/Pure & the Isar Language (Weeks 1-2)**
> Estimated study time: 5-7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain the method concept in Isabelle and how methods transform proof states.
2. Apply basic methods: `rule`, `erule`, `drule`, `assumption`.
3. Use the rewriting engine: `simp`, `subst`, `unfold`.
4. Deploy automation: `auto`, `blast`, `force`, `fastforce`.
5. Declare rule attributes: `[simp]`, `[intro]`, `[elim]`, `[dest]`.
6. Use rule attributes `OF`, `of`, `THEN` to specialize and compose theorems.
7. Find relevant theorems using `find_theorems`.

---

## 1. What Is a Proof Method?

### 1.1 Proof States

At any point during a proof, Isabelle maintains a *proof state* consisting of:

- A list of *subgoals* (formulas to be proved).
- A set of *assumptions* (facts available from `assume`, `have`, etc.).

A proof method transforms the proof state by modifying, solving, or splitting subgoals.

### 1.2 The Method Concept

A *method* is a function that takes the current proof state and returns a (possibly empty) sequence of new proof states. If the sequence is empty, the method has *failed* (no applicable transformation was found). If it contains multiple states, the method has produced *alternatives* (backtracking points).

Methods are invoked via `by (method)` (terminal), `apply (method)` (non-terminal), or `proof (method)` (opening a proof block).

---

## 2. Basic Methods

### 2.1 `rule` — Applying Introduction Rules

The `rule` method applies an inference rule backward: it matches the rule's conclusion against the current goal and replaces the goal with the rule's premises.

```isabelle
lemma "P & Q --> Q & P"
  apply (rule impI)     (* goal becomes: P & Q ==> Q & P *)
  apply (rule conjI)    (* goal splits into: Q and P *)
```

When called without an argument, `rule` uses the default introduction rule for the goal's outermost connective:

- Goal `P & Q`: applies `conjI`
- Goal `P --> Q`: applies `impI`
- Goal `ALL x. P(x)`: applies `allI`
- Goal `P <-> Q`: applies `iffI`

With an explicit argument, `rule thm` applies the specified theorem:

```isabelle
apply (rule conjunct1)   (* applies the first conjunction elimination *)
apply (rule mp)          (* applies modus ponens *)
```

### 2.2 `erule` — Elimination Rules Consuming an Assumption

`erule thm` applies an elimination rule: it unifies the rule's first premise with an assumption (consuming it) and the rule's conclusion with the goal.

```isabelle
(* Goal: [| P & Q |] ==> Q & P *)
apply (erule conjE)
(* Now the goal becomes: [| P; Q |] ==> Q & P *)
```

The `conjE` rule is:

$$\llbracket P \land Q;\; \llbracket P;\; Q \rrbracket \Longrightarrow R \rrbracket \Longrightarrow R$$

When `erule conjE` is applied, Isabelle:

1. Finds an assumption matching $P \land Q$.
2. Removes that assumption.
3. Adds $P$ and $Q$ as separate assumptions.

### 2.3 `drule` — Destruction Rules

`drule thm` applies a *destruction rule*: it matches the rule's first premise with an assumption, replaces that assumption with the rule's conclusion, and leaves the goal unchanged.

```isabelle
(* Goal: [| P & Q |] ==> R *)
apply (drule conjunct1)
(* Goal: [| P |] ==> R *)
```

Distinction from `erule`: `erule` unifies with both an assumption and the goal; `drule` only unifies with an assumption and adds the conclusion as a new assumption.

### 2.4 `assumption`

The `assumption` method solves a goal that exactly matches one of the current assumptions:

```isabelle
(* Goal: [| P; Q |] ==> P *)
apply assumption
(* Goal solved *)
```

---

## 3. The Rewriting Engine

### 3.1 `simp` — The Simplifier

The simplifier is Isabelle's rewriting engine. It applies a set of *rewrite rules* (equations oriented left-to-right) repeatedly until no more rules apply.

```isabelle
lemma "x + 0 = (x :: nat)"
  by simp
```

The simplifier uses:

- **Built-in simp rules:** theorems declared with `[simp]` in the current theory and its imports.
- **Conditional rewrite rules:** rules of the form $P \Longrightarrow l = r$ that rewrite $l$ to $r$ only when $P$ can be proved.
- **Congruence rules:** rules that guide the simplifier through term structure (e.g., under binders).

### 3.2 Controlling the Simplifier

**Adding rules temporarily:**

```isabelle
apply (simp add: my_lemma)        (* add my_lemma as a simp rule *)
apply (simp del: some_rule)       (* remove some_rule from the simp set *)
apply (simp only: rule1 rule2)    (* use ONLY these rules *)
```

**Common simp options:**

| Option | Effect |
|--------|--------|
| `add: thms` | Add theorems as simp rules |
| `del: thms` | Remove theorems from simp set |
| `only: thms` | Use only specified rules |
| `split: thms` | Add split rules (for if-then-else, case) |

### 3.3 `subst` — Single Substitution

`subst thm` applies a single rewrite step using an equation:

```isabelle
have eq: "f(x) = g(x)" by some_method
then show "h(f(x)) = h(g(x))" by (subst eq)
```

Unlike `simp`, `subst` applies the equation exactly once and does not loop.

### 3.4 `unfold` — Definition Unfolding

`unfold` unfolds a definition:

```isabelle
definition square :: "nat => nat" where
  "square n = n * n"

lemma "square 3 = 9"
  by (unfold square_def) simp
```

Every definition `foo` generates a theorem `foo_def` that can be used with `unfold` or `simp`.

---

## 4. Automation

### 4.1 `auto` — The Workhorse

`auto` combines simplification with classical reasoning. It:

1. Applies safe introduction and elimination rules.
2. Rewrites using the simplifier.
3. Performs limited backtracking with unsafe rules.
4. Splits case distinctions (if-then-else, etc.).

```isabelle
lemma "(P | Q) & R --> (P & R) | (Q & R)"
  by auto
```

`auto` can solve many routine goals. It is the most commonly used method. When `auto` partially solves a goal (solving some subgoals but not all), it leaves the remaining subgoals.

**Configuring auto:**

```isabelle
apply (auto intro: rule1 elim: rule2 simp add: rule3 dest: rule4)
```

| Option | Effect |
|--------|--------|
| `intro: thms` | Add introduction rules |
| `elim: thms` | Add elimination rules |
| `dest: thms` | Add destruction rules |
| `simp add: thms` | Add simp rules |
| `simp del: thms` | Remove simp rules |
| `split: thms` | Add split rules |

### 4.2 `blast` — The Tableau Prover

`blast` is a tableau-based prover for classical logic. It is particularly good at:

- Pure propositional and first-order reasoning.
- Goals involving quantifiers.
- Goals that require extensive case splitting.

```isabelle
lemma "(ALL x. P(x) --> Q(x)) --> (ALL x. P(x)) --> (ALL x. Q(x))"
  by blast
```

`blast` does *not* use the simplifier. It works purely with logical rules. This makes it complementary to `simp`: use `simp` for equational reasoning, `blast` for logical reasoning.

**When to use `blast` over `auto`:**

- When simplification is not needed (pure logic).
- When `auto` goes into an infinite loop (rare but possible).
- When the goal requires deep search (blast is more systematic about backtracking).

### 4.3 `force` and `fastforce`

`force` and `fastforce` are strengthened versions of `auto`:

- `fastforce`: like `auto`, but tries harder. It uses a more aggressive search strategy.
- `force`: even more aggressive. It can solve goals that `fastforce` cannot but may be slower.

The ordering by strength and speed:

$$\text{simp} < \text{auto} < \text{fastforce} < \text{force} < \text{blast (for pure logic)}$$

### 4.4 Decision Procedures

For specific domains, Isabelle provides specialized methods:

| Method | Domain | Example |
|--------|--------|---------|
| `arith` | Linear arithmetic over naturals, integers, reals | `"(x::nat) + y > x ==> y > 0"` |
| `presburger` | Presburger arithmetic (quantified linear integer arithmetic) | `"EX x::int. 2*x = y"` |
| `linarith` | Linear arithmetic (combines arith with more power) | |
| `algebra` | Ring/field equations | |

---

## 5. Rule Attributes

### 5.1 Declaring Rules

When a theorem is proved, it can be given *attributes* that tell Isabelle how to use it:

```isabelle
lemma my_rule [simp]: "f(f(x)) = x"
  by some_method

lemma my_intro [intro]: "P ==> Q ==> P & Q"
  by (rule conjI)
```

| Attribute | Effect |
|-----------|--------|
| `[simp]` | Added to the default simp set; used by `simp`, `auto` |
| `[intro]` | Used as an introduction rule by `auto`, `blast`, `force` |
| `[elim]` | Used as an elimination rule |
| `[dest]` | Used as a destruction rule |
| `[intro!]` | Used as a *safe* introduction rule (applied eagerly, no backtracking) |
| `[intro?]` | Used as an *unsafe* introduction rule (applied with backtracking) |

**Warning:** Declaring a non-terminating simp rule (e.g., `"x = x + 0"` which could loop with `"x + 0 = x"`) will cause the simplifier to loop. Always ensure simp rules are terminating (the left-hand side is "bigger" than the right-hand side in some sense).

### 5.2 Instantiation with `of` and `OF`

**`of` — instantiate schematic variables by position:**

```isabelle
thm conjI                      (* ?P ==> ?Q ==> ?P & ?Q *)
thm conjI [of "A" "B"]        (* A ==> B ==> A & B *)
thm exI [of _ "42"]           (* ?P 42 ==> EX x. ?P x *)
```

The underscore `_` leaves a schematic variable uninstantiated.

**`OF` — instantiate by providing premises:**

```isabelle
thm mp [OF my_implication]
(* If my_implication is "G |- P --> Q", then
   mp [OF my_implication] is "G, ?D |- ?P ==> Q"
   — the first premise of mp is filled by my_implication *)
```

### 5.3 Composition with `THEN`

`thm1 [THEN thm2]` composes two theorems: the conclusion of `thm1` is unified with the first premise of `thm2`.

```isabelle
thm conjunct1 [THEN mp]
(* conjunct1: ?P & ?Q ==> ?P
   mp:        ?P --> ?R ==> ?P ==> ?R
   Result:    ?P & (?P --> ?R) ==> ... (after unification) *)
```

---

## 6. Finding Theorems

### 6.1 `find_theorems`

The `find_theorems` command searches Isabelle's theorem database:

```isabelle
find_theorems "_ & _ --> _"           (* search by pattern *)
find_theorems name: "conj"            (* search by name *)
find_theorems "_ & _" "_ --> _"       (* multiple patterns (AND) *)
find_theorems intro                   (* find intro rules *)
find_theorems simp: "_ + 0"           (* find simp rules matching pattern *)
```

### 6.2 Search in jEdit

In Isabelle's jEdit IDE:

- **Ctrl+Click** on a theorem name jumps to its definition.
- The **Query** panel (under Plugins) provides a graphical search interface.
- **Sledgehammer** (discussed in later modules) automatically searches for applicable theorems and suggests proof methods.

### 6.3 `thm` — Displaying Theorems

```isabelle
thm conjI              (* display the theorem conjI *)
thm conjI conjunct1    (* display multiple theorems *)
```

### 6.4 `print_rules` and `print_simpset`

```isabelle
print_rules            (* show all declared intro/elim/dest rules *)
print_simpset          (* show all active simp rules — warning: long! *)
```

---

## 7. The Apply-Script Style

While Isar is preferred, understanding the apply-script style is necessary for reading older proofs and for debugging. A quick reference:

```isabelle
lemma "..."
  apply (rule thm)        (* backward: match conclusion with goal *)
  apply (erule thm)       (* match assumption and goal *)
  apply (drule thm)       (* match assumption, add conclusion *)
  apply assumption        (* goal matches an assumption *)
  apply (simp add: thms)  (* rewrite *)
  apply auto              (* automation *)
  apply blast             (* tableau *)
  apply (subst thm)       (* single rewrite step *)
  apply (intro thms)      (* apply intro rules repeatedly *)
  apply (elim thms)       (* apply elim rules repeatedly *)
  done                    (* all goals solved *)
```

**Key difference from Isar:** In apply-script style, you cannot see intermediate results in the proof text. You must run each step in Isabelle to see the proof state. This is why Isar is preferred for proofs that will be read by humans.

---

## 8. Method Combinators

Methods can be combined using combinators:

| Combinator | Syntax | Meaning |
|-----------|--------|---------|
| Sequence | `method1, method2` | Apply method1, then method2 |
| Alternative | `method1 \| method2` | Try method1; if it fails, try method2 |
| Repetition | `method+` | Apply method one or more times |
| Optional repetition | `method*` | Apply method zero or more times (never fails) |
| Try | `method?` | Apply method; if it fails, do nothing (never fails) |

**Example:**

```isabelle
apply (rule conjI, assumption, assumption)
(* Apply conjI, then solve both subgoals by assumption *)

apply ((rule allI)+)
(* Apply allI repeatedly until it fails *)

apply (simp | auto)
(* Try simp first; if it fails, try auto *)
```

---

## 9. Worked Example: A Complete Proof with Methods

```isabelle
theory Methods_Example
  imports FOL
begin

lemma example:
  assumes h1: "ALL x. P(x) --> Q(x)"
      and h2: "ALL x. Q(x) --> R(x)"
  shows "ALL x. P(x) --> R(x)"
proof (rule allI)
  fix a
  show "P(a) --> R(a)"
  proof (rule impI)
    assume pa: "P(a)"
    from h1 have "P(a) --> Q(a)" by (rule spec)
    from this pa have qa: "Q(a)" by (rule mp)
    from h2 have "Q(a) --> R(a)" by (rule spec)
    from this qa show "R(a)" by (rule mp)
  qed
qed

(* Alternative: just use blast *)
lemma "ALL x. P(x) --> Q(x) ==> ALL x. Q(x) --> R(x) ==> ALL x. P(x) --> R(x)"
  by blast

end
```

---

## 10. Exercises

**Exercise 10.1.** For each of the following goals, state which method(s) you would try first and why:

**(a)** `"P & Q ==> Q & P"`

**(b)** `"ALL x. P(x) | Q(x) ==> (ALL x. P(x)) | (EX x. Q(x))"`

**(c)** `"Suc n + m = Suc (n + m)"`

**(d)** `"A Int (B Un C) = (A Int B) Un (A Int C)"`

**Exercise 10.2.** Explain the difference between `simp`, `auto`, and `blast`. Give an example goal where each method succeeds but the other two fail (or are inappropriate).

**Exercise 10.3.** Write a lemma with a `[simp]` attribute that would cause the simplifier to loop. Explain why it loops and how to fix it.

**Exercise 10.4.** Use `find_theorems` to locate the theorem that states $P \lor Q \Longrightarrow (\llbracket P \rrbracket \Longrightarrow R) \Longrightarrow (\llbracket Q \rrbracket \Longrightarrow R) \Longrightarrow R$. What is its name? What method would you use to apply it?

**Exercise 10.5.** Given theorems `th1: "A ==> B"` and `th2: "B ==> C"`, use `OF` and `THEN` to produce a theorem `"A ==> C"`. Write the Isabelle expression.

---

## References

- Nipkow, T. and Klein, G. *Concrete Semantics with Isabelle/HOL*. Springer, 2014. Chapter 2.
- Nipkow, T., Paulson, L.C., and Wenzel, M. *Isabelle/HOL: A Proof Assistant for Higher-Order Logic*. Chapter 5: The Rules of the Game.
- Wenzel, M. *The Isabelle/Isar Reference Manual*. Chapter on proof methods.
- Paulson, L.C. "A Generic Tableau Prover and its Integration with Isabelle." *Journal of Universal Computer Science* 5(3):73-87, 1999. (The `blast` method.)

---

*Previous: [Lecture 01b: Isar Structured Proofs](lecture_01b_isar_structured_proofs.md)*
*Next: [Lecture 01d: Locales, Theories & the Isabelle Ecosystem](lecture_01d_locales_theories_ecosystem.md)*
