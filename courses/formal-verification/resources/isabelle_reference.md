# Idiomatic Isabelle Patterns for Formal Verification

Production-tested patterns for formal verification research in Isabelle. This guide covers both Isabelle/ZF (for set-theoretic formalization) and Isabelle/HOL (for program verification with AutoCorres).

---

## Table of Contents

1. [Theory File Templates](#theory-file-templates)
2. [Common Isar Proof Patterns](#common-isar-proof-patterns)
3. [Useful Commands](#useful-commands)
4. [Tactic Cheatsheet](#tactic-cheatsheet)
5. [Debugging Proofs](#debugging-proofs)
6. [Common Error Messages](#common-error-messages)
7. [Rule Attributes](#rule-attributes)
8. [Locale Patterns](#locale-patterns)
9. [AutoCorres Usage Patterns](#autocorres-usage-patterns)
10. [Proof Style Guidelines](#proof-style-guidelines)

---

## Theory File Templates

### Isabelle/ZF Theory File

```isabelle
theory My_ZF_Development
  imports ZF.Ordinal ZF.Cardinal
begin

section \<open>Overview\<close>

text \<open>
  This theory formalizes [topic]. The main result is [theorem name],
  which states [informal statement].

  We build on the ordinal infrastructure from @{theory ZF.Ordinal}
  and the cardinal arithmetic from @{theory ZF.Cardinal}.
\<close>

section \<open>Definitions\<close>

text \<open>Informal explanation of the key definition.\<close>

definition my_function :: "[i, i] \<Rightarrow> i" where
  "my_function(A, B) \<equiv> {x \<in> A . x \<subseteq> B}"

text \<open>Alternative: recursive definition using transfinite recursion.\<close>

definition my_recursive :: "i \<Rightarrow> i" where
  "my_recursive(alpha) \<equiv> transrec(alpha, \<lambda>x f. \<Union>{f`y . y \<in> x})"

section \<open>Basic Properties\<close>

lemma my_function_mono:
  assumes "A \<subseteq> A'" "B \<subseteq> B'"
  shows "my_function(A, B) \<subseteq> my_function(A', B')"
  unfolding my_function_def
  by blast

section \<open>Main Result\<close>

theorem main_theorem:
  assumes "Ord(alpha)"
  shows "[conclusion]"
proof -
  \<comment> \<open>Step 1: ...\<close>
  have step1: "[intermediate result]"
    sorry
  \<comment> \<open>Step 2: ...\<close>
  then show ?thesis
    sorry
qed

end
```

### Isabelle/HOL Theory File

```isabelle
theory My_HOL_Development
  imports Main
begin

section \<open>Functional Specification\<close>

text \<open>
  Pure functional specification for [module].
  This defines the abstract behavior independent of the C implementation.
\<close>

fun sort_spec :: "nat list \<Rightarrow> nat list" where
  "sort_spec [] = []"
| "sort_spec (x # xs) = insort x (sort_spec xs)"

definition sorted :: "nat list \<Rightarrow> bool" where
  "sorted xs \<equiv> \<forall>i j. i < j \<longrightarrow> j < length xs
                     \<longrightarrow> xs ! i \<le> xs ! j"

section \<open>Properties of the Specification\<close>

lemma sort_spec_sorted: "sorted (sort_spec xs)"
  sorry

lemma sort_spec_perm: "mset (sort_spec xs) = mset xs"
  sorry

end
```

### ROOT File Template

```
session My_Project = ZF +
  description \<open>
    Formalization of [topic].
    Author: [name], [date].
  \<close>
  theories
    Definitions
    Auxiliary_Lemmas
    Main_Theorem
  document_files
    "root.tex"
```

---

## Common Isar Proof Patterns

### Direct Proof

```isabelle
lemma "A \<longrightarrow> B"
proof
  assume "A"
  then show "B"
    by simp
qed
```

### Proof by Contradiction

```isabelle
lemma "P"
proof (rule ccontr)
  assume "\<not> P"
  then show False
    by auto
qed
```

### Proof by Cases

```isabelle
lemma "P(x)"
proof (cases x)
  case 0
  then show ?thesis by simp
next
  case (Suc n)
  then show ?thesis by simp
qed
```

### Proof by Induction (Natural Numbers)

```isabelle
lemma "P(n)"
proof (induction n)
  case 0
  then show ?case by simp
next
  case (Suc n)
  then show ?case by simp
qed
```

### Proof by Induction (Isabelle/ZF Ordinals)

```isabelle
lemma assumes "Ord(alpha)" shows "P(alpha)"
using assms
proof (induct alpha rule: trans_induct)
  case (step alpha)
  \<comment> \<open>IH: \<forall>beta \<in> alpha. P(beta)\<close>
  then show ?case
    sorry
qed
```

### Existential Witness

```isabelle
lemma "\<exists>x. P(x)"
proof
  show "P(some_concrete_term)"
    by simp
qed
```

### Obtaining/Destructing Existentials

```isabelle
lemma assumes "\<exists>x. P(x)" shows "Q"
proof -
  from assms obtain x where "P(x)" by auto
  then show "Q"
    sorry
qed
```

### Chain of Equalities

```isabelle
lemma "a = d"
proof -
  have "a = b" by simp
  also have "... = c" by simp
  also have "... = d" by simp
  finally show ?thesis .
qed
```

### Chain of Inequalities

```isabelle
lemma "a \<le> d"
proof -
  have "a \<le> b" by simp
  also have "... \<le> c" by simp
  also have "... \<le> d" by simp
  finally show ?thesis .
qed
```

### Fix and Assume Pattern

```isabelle
lemma "\<forall>x. P(x) \<longrightarrow> Q(x)"
proof (intro allI impI)
  fix x
  assume "P(x)"
  then show "Q(x)"
    by auto
qed
```

### Set Equality by Double Inclusion

```isabelle
lemma "A = B"
proof
  show "A \<subseteq> B"
  proof
    fix x assume "x \<in> A"
    then show "x \<in> B" by auto
  qed
next
  show "B \<subseteq> A"
  proof
    fix x assume "x \<in> B"
    then show "x \<in> A" by auto
  qed
qed
```

---

## Useful Commands

### Searching for Theorems

```isabelle
(* Find theorems matching a pattern *)
find_theorems "_ \<union> _ = _ \<union> _"

(* Find theorems by name *)
find_theorems name: "Un_commute"

(* Find theorems with specific type *)
find_theorems "_ \<Rightarrow> nat"

(* Find introduction rules for a constant *)
find_theorems intro: "_ \<in> Pow(_)"

(* Find simp rules about a constant *)
find_theorems simp: "card"

(* Limit the number of results *)
find_theorems 20 "Ord(_) \<Longrightarrow> _"
```

### Inspecting Terms and Types

```isabelle
(* Display the type of a term *)
term "op \<union>"
(* Output: "op \<union>" :: "i \<Rightarrow> i \<Rightarrow> i" *)

(* Display a type *)
typ "nat list"

(* Display a theorem *)
thm conjI
thm Ord_linear_lt

(* Display all theorems in the current theory *)
print_theorems

(* Display the current simpset *)
print_simps

(* Display the current claset (classical rules) *)
print_claset

(* Display locale information *)
print_locale group
```

### Evaluating Expressions (HOL only)

```isabelle
(* Evaluate a term *)
value "sort [3, 1, 4, 1, 5]"
(* Output: "[1, 1, 3, 4, 5]" *)

value "card {1::nat, 2, 3}"
(* Output: "3" *)
```

---

## Tactic Cheatsheet

### When to Use Each Method

| Method | Use When | Strengths | Weaknesses |
|---|---|---|---|
| **simp** | Goal can be solved by rewriting | Fast, predictable, compositional | Cannot handle logical structure, loops on bad rules |
| **auto** | Goal needs rewriting + logic | Combines simp + classical reasoner | Can be slow, sometimes does too much or too little |
| **blast** | Goal is pure first-order logic | Handles quantifiers, set theory well | No rewriting, no arithmetic |
| **force** | Like auto but need to try harder | More aggressive than auto on single goals | Slower, can timeout |
| **fastforce** | Like force but with time limit | Good default "try hard" method | May not find longer proofs |
| **simp add: X** | Need specific rewrite rules | Targeted simplification | Must know which rules to add |
| **auto intro: X** | Need specific introduction rules | Targeted reasoning with automation | Must know which rules to add |
| **rule X** | Know the exact rule to apply | Precise, predictable | Requires knowing the right rule |
| **erule X** | Decompose a hypothesis with rule X | Precise elimination | Requires knowing the right rule |
| **drule X** | Derive new fact from hypothesis | Forward reasoning within backward proof | Requires knowing the right rule |
| **induct** | Goal follows by induction | Automatic induction principle selection | May need custom induction rule |
| **cases** | Goal follows by case analysis | Automatic case distinction | May need custom case rule |
| **subst** | Need to substitute an equation | Direct substitution | Must have the equation as a fact |
| **assumption** | Goal matches a hypothesis exactly | Closes trivial goals | Must match exactly |
| **sledgehammer** | Other methods fail | Access to external provers | Slow, may not reconstruct proof |

### Common Method Combinations

```isabelle
(* Simplify, then use classical reasoning *)
by (simp, blast)

(* Simplify with extra rules, then auto *)
by (simp add: my_def, auto)

(* Apply a rule, then solve subgoals *)
by (rule my_rule, simp_all)

(* Unfold a definition, then simplify *)
by (unfold my_def, simp)

(* Rewrite with a specific equation, then continue *)
apply (subst my_equation)
apply simp

(* Introduction then automation *)
by (intro conjI impI allI, auto)
```

### Simplifier Control

```isabelle
(* Add rules to the simpset for this call *)
by (simp add: rule1 rule2)

(* Remove rules from the simpset for this call *)
by (simp del: rule1)

(* Use only the specified rules (no default simpset) *)
by (simp only: rule1 rule2)

(* Unfold definitions *)
by (simp add: my_def)

(* Split conditional expressions *)
by (simp split: if_splits)

(* Split option type *)
by (simp split: option.splits)

(* Add congruence rules *)
by (simp cong: if_cong)
```

---

## Debugging Proofs

### Reading the Proof State

The proof state in Isabelle/jEdit shows:

```
proof (state)
goal (2 subgoals):
 1. \<And>x. \<lbrakk>x \<in> A; P(x)\<rbrakk> \<Longrightarrow> Q(x)
 2. R
```

- `goal (2 subgoals)`: there are 2 remaining obligations
- `\<And>x`: universally quantified variable (corresponds to `fix x` in Isar)
- `\<lbrakk>...; ...\<rbrakk>`: assumptions (hypotheses)
- `\<Longrightarrow>`: separates assumptions from the conclusion
- Goal 1 is the current focus; methods apply to goal 1 by default

### Using Sorry Strategically

```isabelle
(* Mark a proof as incomplete during development *)
lemma "P" sorry

(* Use sorry to skip a subgoal and continue with others *)
proof -
  have step1: "A" sorry  (* come back to this later *)
  then have step2: "B" by simp
  then show ?thesis by auto
qed
```

### Using Oops to Abandon

```isabelle
(* Try a proof approach without committing *)
lemma "P"
  apply auto
  (* inspect the remaining goals *)
  oops  (* abandon -- this lemma is not recorded *)
```

### Inspecting Intermediate State

```isabelle
(* In Isar: name intermediate results to inspect them *)
proof -
  have h1: "A" by simp
  thm h1  (* inspect what was proved *)
  show ?thesis using h1 by auto
qed

(* In apply-scripts: use back to try alternative proofs *)
apply (rule disjE)
  apply auto  (* see what remains *)
  back         (* try alternative unification *)
```

### Tracing the Simplifier

```isabelle
(* Enable simplifier trace to see which rules fire *)
using [[simp_trace]]
apply simp

(* More detailed trace *)
using [[simp_trace_depth_limit = 5]]
apply simp

(* Trace a specific rule *)
declare my_rule [simp_trace]
```

### Testing Conjectures

```isabelle
(* Use Quickcheck to test (HOL only) *)
lemma "sort (xs @ ys) = sort xs @ sort ys"
  quickcheck  (* will find a counterexample *)

(* Use Nitpick for small counterexample search (HOL only) *)
lemma "\<forall>f :: nat \<Rightarrow> nat. surj f"
  nitpick  (* will find a countermodel *)
```

---

## Common Error Messages

### "Failed to apply proof method"

**Cause:** The method does not apply to the current goal. Common reasons: (1) the goal does not match the rule's conclusion, (2) type mismatch, (3) extra assumptions.

**Fix:** Inspect the goal carefully. Use `thm rule_name` to see the rule's statement. Check types with `term`.

### "Ambiguous input"

**Cause:** Isabelle cannot determine the type of a term from context alone.

**Fix:** Add type annotations: `(x :: nat)` or `(A :: i)`.

### "Proof failed for goal" (after `by`)

**Cause:** The method closed some subgoals but not all.

**Fix:** Use `apply` instead of `by` to see remaining subgoals, or add more rules: `by (auto intro: ... simp add: ...)`.

### "Undeclared variable"

**Cause:** Using a free variable that is not bound by `fix`, `let`, or `obtain`.

**Fix:** Add `fix x` before using x, or use schematic variables `?x`.

### "Type unification failed" / "Clash of types"

**Cause:** Isabelle cannot unify two types that should match.

**Fix:** Check that you are working in the right logic (ZF vs HOL). In ZF, everything has type `i`; in HOL, types must match exactly. Add type annotations to disambiguate.

### "Simplifier looping"

**Cause:** A simp rule rewrites A to B while another rewrites B to A (or a longer cycle).

**Fix:** Remove one of the conflicting rules with `simp del:`, or use `simp only:` to control exactly which rules fire. Check for rules of the form `f(x) = ... f(x) ...`.

### "Tactic failed" / "Empty result sequence"

**Cause:** The tactic produced no results (no applicable rules).

**Fix:** Try alternative methods. Use `find_theorems` to discover applicable rules. Check if you need additional assumptions.

### "Illegal application of proof command in state"

**Cause:** Using a proof command in the wrong context (e.g., `show` without a pending goal, `qed` without closing all goals).

**Fix:** Check the proof structure. Every `proof` needs a matching `qed`. Every subgoal from a `proof` block needs a `show` or `next`.

---

## Rule Attributes

### Declaring Rules

```isabelle
(* Permanent simp rule *)
declare my_lemma [simp]

(* Permanent intro rule *)
declare my_lemma [intro]

(* Permanent elim rule *)
declare my_lemma [elim]

(* Permanent dest rule *)
declare my_lemma [dest]

(* Declare at proof time *)
lemma my_lemma [simp, intro]: "P" by auto

(* Type class instance rule *)
declare my_lemma [TC]
```

### Using Rules in Proofs

```isabelle
(* Instantiate universally quantified rule *)
thm spec [of "my_term"]

(* Apply rule to a specific fact *)
thm my_rule [OF other_fact]

(* Chain: apply rule to another rule *)
thm rule1 [THEN rule2]

(* Symmetric version of an equation *)
thm my_eq [symmetric]

(* Simplified version of a theorem *)
thm my_thm [simplified]

(* Combine: instantiate and chain *)
thm my_rule [of "x" "y", OF fact1 fact2, simplified]
```

### Attribute Reference

| Attribute | Effect |
|---|---|
| `[simp]` | Added to the default simpset; used by `simp`, `auto`, `force` |
| `[intro]` | Added as safe introduction rule for the classical reasoner |
| `[intro!]` | Added as unsafe introduction rule (tried more eagerly) |
| `[elim]` | Added as safe elimination rule |
| `[elim!]` | Added as unsafe elimination rule |
| `[dest]` | Added as safe destruction rule |
| `[dest!]` | Added as unsafe destruction rule |
| `[iff]` | Added as both a simp rule and intro/elim pair |
| `[cong]` | Added as a congruence rule for the simplifier |
| `[OF x]` | Instantiates the first premise with fact x |
| `[of "t"]` | Instantiates the first schematic variable with term t |
| `[THEN r]` | Applies rule r to the conclusion |
| `[symmetric]` | Swaps sides of an equation |
| `[simplified]` | Simplifies the theorem statement |

---

## Locale Patterns

### Defining a Locale

```isabelle
locale group =
  fixes G :: "'a set" and mult :: "'a \<Rightarrow> 'a \<Rightarrow> 'a" and e :: "'a"
  assumes closed: "\<lbrakk>a \<in> G; b \<in> G\<rbrakk> \<Longrightarrow> mult a b \<in> G"
      and assoc: "\<lbrakk>a \<in> G; b \<in> G; c \<in> G\<rbrakk>
                  \<Longrightarrow> mult (mult a b) c = mult a (mult b c)"
      and identity: "a \<in> G \<Longrightarrow> mult e a = a"
      and inverse: "a \<in> G \<Longrightarrow> \<exists>b \<in> G. mult b a = e"
begin

lemma identity_unique: "\<lbrakk>e' \<in> G; \<forall>a \<in> G. mult e' a = a\<rbrakk> \<Longrightarrow> e' = e"
  sorry

end
```

### Interpreting a Locale

```isabelle
interpretation int_group: group "UNIV :: int set" "(+)" "0 :: int"
  by unfold_locales auto
```

### Locale Inheritance

```isabelle
locale abelian_group = group +
  assumes commutative: "\<lbrakk>a \<in> G; b \<in> G\<rbrakk> \<Longrightarrow> mult a b = mult b a"
```

---

## AutoCorres Usage Patterns

### Basic Setup

```isabelle
theory My_Verification
  imports AutoCorres2.AutoCorres
begin

(* Parse and lift the C source *)
install_C_file "my_program.c"
autocorres [ts_rules = nondet] "my_program.c"

context my_program begin

(* Now you can refer to lifted functions *)
thm my_function'_def

end

end
```

### Verifying a Simple Function

```isabelle
(* C source:
   unsigned add(unsigned a, unsigned b) {
     return a + b;
   }
*)

lemma add_correct:
  "\<lbrace> \<lambda>s. a + b < 2^32 \<rbrace>
     add' a b
   \<lbrace> \<lambda>rv s. rv = a + b \<rbrace>!"
  unfolding add'_def
  by wp auto
```

### Loop Verification Pattern

```isabelle
(* C source:
   unsigned sum_array(unsigned *arr, unsigned n) {
     unsigned s = 0;
     unsigned i = 0;
     while (i < n) { s += arr[i]; i++; }
     return s;
   }
*)

lemma sum_array_correct:
  "\<lbrace> \<lambda>s. is_valid_w32 s arr n \<and> no_overflow s arr n \<rbrace>
     sum_array' arr n
   \<lbrace> \<lambda>rv s. rv = list_sum (heap_to_list s arr n) \<rbrace>!"
  unfolding sum_array'_def
  apply (wp_once)  (* unfold the loop *)
  apply (rule_tac I="\<lambda>i s. i \<le> n
    \<and> partial_sum s arr i = list_sum (take i (heap_to_list s arr n))"
    in whileLoop_rule)
     apply wp  (* loop body preserves invariant *)
      apply auto
     apply auto (* invariant + negated guard implies postcondition *)
    apply auto (* precondition implies initial invariant *)
   apply (rule wf_measure[of "\<lambda>(i, _). unat (n - i)"])  (* termination *)
  done
```

### Separation Logic Patterns

```isabelle
(* Prove that a function only modifies specified heap locations *)
lemma my_func_modifies:
  "\<forall>s. \<Gamma> \<turnstile>\<^bsub>/UNIV\<^esub>
    {s} Call my_func_'proc
    {t. t may_only_modify_globals s in [heap_w32]}"
  by (vcg_step, auto)+
```

### Common AutoCorres Proof Steps

```isabelle
(* Unfold the lifted definition *)
apply (unfold my_func'_def)

(* Apply weakest precondition calculus *)
apply wp

(* Apply wp for a single step *)
apply wp_once

(* Solve word arithmetic goals *)
apply (simp add: word_bits_def)
apply unat_arith

(* Handle heap access *)
apply (simp add: heap_update_def h_val_def)
```

---

## Proof Style Guidelines

### General Principles

1. **Use Isar for main theorems.** The main results of your development should have readable structured proofs. Apply-scripts are acceptable for auxiliary lemmas.

2. **Factor lemmas aggressively.** If a proof step is used more than once, extract it as a named lemma. Reusable lemmas are the mark of good proof engineering.

3. **Name intermediate results.** In Isar proofs, give meaningful names to intermediate `have` statements. This makes the proof self-documenting.

4. **Match the mathematical structure.** If the textbook proof has three cases, your Isar proof should have three cases with explicit case labels.

5. **Comment non-obvious steps.** Use `\<comment> \<open>...\<close>` for inline comments explaining why a particular tactic works or why a particular approach was chosen.

6. **Keep the simpset clean.** Only add rules to `[simp]` if they are universally useful rewrite rules (the right side is simpler than the left). Rules that sometimes loop or apply in unwanted contexts should be added locally with `simp add:`.

7. **Test automation early.** Before writing a long Isar proof, try `by auto` or `by blast`. If automation solves the goal, use it (unless readability requires a structured proof).

8. **Use `sorry` during development, never in final code.** Mark incomplete proofs with sorry as you explore, but remove all sorry before submission.

### Naming Conventions

- Definitions: `my_concept_def`
- Basic properties: `my_concept_mono`, `my_concept_empty`, `my_concept_insert`
- Main theorems: `main_theorem`, `cantor_theorem`
- Type/set membership: `my_functionI` (introduction), `my_functionD` (destruction), `my_functionE` (elimination)
- Follow existing Isabelle conventions in the theories you import
