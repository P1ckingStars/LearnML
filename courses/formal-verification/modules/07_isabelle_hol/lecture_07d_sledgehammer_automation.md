# Lecture 07d: Sledgehammer, Nitpick, and Automation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Use** Sledgehammer to call external ATPs and SMT solvers from within Isabelle.
2. **Interpret** Sledgehammer output and apply the suggested proof methods.
3. **Use** Nitpick and Quickcheck to find counterexamples.
4. **Navigate** the spectrum of Isabelle proof automation from manual to fully automatic.
5. **Explain** why type-based automation works better in HOL than in ZF.
6. **Write** custom proof methods using Eisbach.

---

## 2. The Automation Spectrum

### 2.1 Overview

Isabelle provides a spectrum of proof methods ranging from fully manual to fully automatic:

| Method | Automation level | Description |
|---|---|---|
| `rule`, `erule`, `drule` | Manual | Apply a single logical rule |
| `intro`, `elim` | Low | Apply introduction/elimination rules |
| `simp` | Medium | Conditional rewriting (simplifier) |
| `auto` | Medium-high | Combination of simp, classical reasoning, and more |
| `blast` | High | Tableau prover for first-order logic |
| `force`, `fastforce` | High | More aggressive versions of `auto` |
| `metis`, `meson` | High | First-order resolution |
| `smt` | Very high | Call an SMT solver directly |
| `sledgehammer` | Highest | External ATPs with proof reconstruction |

### 2.2 When to Use What

**Rules of thumb:**

- **Equational reasoning:** Start with `simp`. If that fails, try `auto`.
- **First-order logic:** Try `blast` or `auto`.
- **Arithmetic:** Try `auto` or `arith` (linear arithmetic) or `linarith`.
- **Stuck on a subgoal:** Try `sledgehammer`.
- **Suspect the goal is false:** Try `nitpick` or `quickcheck`.

---

## 3. Sledgehammer

### 3.1 What It Does

Sledgehammer is Isabelle's interface to external automatic theorem provers (ATPs) and SMT solvers. Given a goal, it:

1. **Filters** the current theory's lemma database for potentially relevant facts (using machine learning and heuristics based on types and symbols).
2. **Translates** the goal and selected facts into the prover's input format (TPTP for ATPs, SMT-LIB for SMT solvers).
3. **Calls** multiple provers in parallel.
4. **Reconstructs** the proof within Isabelle's kernel, using `metis`, `meson`, `smt`, or `presburger`.

### 3.2 Supported Provers

| Prover | Type | Strengths |
|---|---|---|
| E | ATP (superposition) | Equational reasoning, datatypes |
| Vampire | ATP (superposition) | General first-order, very fast |
| SPASS | ATP (superposition) | Equality-heavy problems |
| Z3 | SMT | Arithmetic, bit vectors, arrays |
| CVC4/CVC5 | SMT | Datatypes, strings, sets |
| Zipperposition | ATP (higher-order) | Higher-order goals |

### 3.3 Using Sledgehammer

**Interactive invocation.** In jEdit, place the cursor on a goal and type:

```isabelle
sledgehammer
```

or click the Sledgehammer panel button. Sledgehammer runs all configured provers and reports results.

**Typical output:**

```
Try this: by (metis (full_types) append_assoc length_append)
  (E, 0.3 s)
Try this: by (smt (verit) append_assoc length_append)
  (Z3, 0.1 s)
```

Each line suggests a proof method with the facts used. Copy the suggestion into your proof.

**With specific provers:**

```isabelle
sledgehammer [provers = e vampire z3, timeout = 60]
```

**Adding hints:**

```isabelle
sledgehammer [add: my_lemma1 my_lemma2]
```

### 3.4 How Relevance Filtering Works

The key challenge is selecting which of the (potentially hundreds of thousands of) available lemmas to send to the prover. Isabelle uses a multi-stage filtering pipeline:

1. **MeSH (Meng-Paulson):** Scores facts by symbol overlap with the goal. Facts sharing more constants/types with the goal score higher.

2. **MePo (Machine-learning Proof Ordering):** Uses a k-nearest-neighbor classifier trained on past proofs. If a fact was useful for proving similar goals, it scores higher.

3. **Iterative deepening:** Starts with a small set of highly relevant facts, then gradually expands. This finds short proofs first.

4. **Type-based filtering:** Facts involving types not present in the goal are deprioritized. This is the key advantage of HOL over ZF: in ZF, everything has type `i`, so this filter is useless.

### 3.5 Proof Reconstruction

Sledgehammer proofs are *reconstructed* within Isabelle's LCF kernel. The external prover finds the proof, but Isabelle must verify it independently. Reconstruction methods:

- **`metis`:** First-order resolution with equality. Most reliable.
- **`smt`:** Replays Z3/CVC5 proofs using Isabelle's internal SMT module.
- **`meson`:** Model elimination. Less powerful than `metis` but sometimes faster.
- **`presburger`:** For linear arithmetic goals.

If reconstruction fails (the external prover found a proof but Isabelle cannot replay it), Sledgehammer reports this and suggests trying a different reconstruction method.

### 3.6 Limitations

Sledgehammer does not handle:

- **Induction.** It cannot discover induction schemes; you must apply `induct` first.
- **Higher-order goals** (well). Most ATPs are first-order; Zipperposition handles some higher-order reasoning.
- **Very large goals.** Performance degrades with many hypotheses or large terms.
- **Constructive proofs.** It may use classical reasoning even when a constructive proof exists.

---

## 4. Nitpick: Counterexample Finder

### 4.1 What It Does

Nitpick searches for *counterexamples* to a conjecture by encoding the problem as a SAT/SMT instance over finite domains.

### 4.2 How It Works

Given a universally quantified goal $\forall x.\, P(x)$, Nitpick:

1. Fixes a finite cardinality $k$ for each type (e.g., `nat` gets $\{0, 1, 2, 3\}$).
2. Encodes all functions and predicates as finite tables.
3. Searches for an assignment that falsifies $P$.
4. If found, displays a concrete counterexample.

### 4.3 Using Nitpick

```isabelle
lemma "rev xs = xs"
  nitpick
```

Output:

```
Nitpick found a counterexample for card 'a = 2:
  xs = [a1, a2]
where a1 \<noteq> a2
```

This tells you that `rev [a1, a2] = [a2, a1] \<noteq> [a1, a2]` when `a1 \<noteq> a2`.

### 4.4 Nitpick Options

```isabelle
nitpick [card nat = 10]           -- search with naturals up to 10
nitpick [card 'a = 3, timeout = 30]  -- 3 elements for type 'a
nitpick [expect = genuine]        -- assert that a counterexample exists
nitpick [expect = none]           -- assert no counterexample (for sanity checks)
```

### 4.5 When Nitpick Fails

Nitpick may fail to find a counterexample even when the goal is false:

- The counterexample may require types larger than the search bound.
- The counterexample may involve infinite structures.
- The encoding may exceed the SAT/SMT solver's capacity.

"No counterexample found" does *not* mean the goal is true.

---

## 5. Quickcheck: Random Testing

### 5.1 What It Does

Quickcheck tests a conjecture by generating random inputs and checking whether they satisfy the property. It is faster but less thorough than Nitpick.

### 5.2 Using Quickcheck

```isabelle
lemma "xs @ ys = ys @ xs"
  quickcheck
```

Output:

```
Quickcheck found a counterexample:
  xs = [0]
  ys = [1]
```

### 5.3 Generators

Quickcheck uses three generators:

| Generator | Method | Completeness |
|---|---|---|
| `random` | Random generation | Low |
| `exhaustive` | Enumerate all values up to a size | Higher |
| `narrowing` | Lazy narrowing (symbolic) | Highest |

```isabelle
quickcheck [generator = exhaustive, size = 8]
```

---

## 6. Why Automation Works Better in HOL

### 6.1 The Type System Advantage

The single most important reason HOL automation outperforms ZF automation is the type system:

1. **Relevance filtering.** In HOL, a lemma about `nat list` is unlikely to be relevant for a goal about `int set`. Types provide strong signals. In ZF, everything is type `i`, so all lemmas are equally "relevant" by type.

2. **Smaller search space.** Types constrain the terms that can appear in a proof. The prover explores far fewer possibilities.

3. **Type-based axiom selection.** SMT solvers can use type information to select relevant theory fragments (e.g., only load integer arithmetic axioms when integers appear in the goal).

### 6.2 Empirical Evidence

Studies by Blanchette and colleagues show that Sledgehammer succeeds on approximately 50--70% of goals in typical HOL formalizations, compared to much lower rates in untyped settings.

### 6.3 Isabelle/ZF Automation

In Isabelle/ZF, the main automation tools are:

- `auto` and `simp` (similar to HOL but with fewer simplification rules).
- `blast` (works well for pure logic).
- Sledgehammer *can* be used in ZF but is less effective due to poor relevance filtering.

For the constructibility proof (Module 06), Paulson relied primarily on manual proofs with targeted use of `auto` and `simp`.

---

## 7. Eisbach: Custom Proof Methods

### 7.1 Motivation

When you find yourself writing the same proof pattern repeatedly, you can encapsulate it as a custom proof method using Eisbach.

### 7.2 Basic Syntax

```isabelle
method my_method = (simp add: my_lemma1 my_lemma2, auto)
```

This defines `my_method` as: first try `simp` with two specific lemmas, then try `auto`.

### 7.3 A More Realistic Example

```isabelle
method solve_ineq =
  (auto simp: algebra_simps
   | linarith
   | (rule order_trans, auto))+
```

This tries three approaches in sequence, repeating until the goal is solved:

1. Simplify using algebraic rules.
2. Try linear arithmetic.
3. Apply transitivity and then `auto`.

### 7.4 Pattern Matching

Eisbach methods can match on the goal structure:

```isabelle
method cases_on for x :: "'a" =
  (cases x; simp_all)
```

Usage:

```isabelle
lemma "P (case opt of None => a | Some x => f x)"
  by (cases_on opt)
```

---

## 8. Transfer and Lifting

### 8.1 The Problem

When you define a type by quotient or typedef, you need to *transfer* lemmas between the raw representation and the abstract type. Doing this manually is tedious.

### 8.2 The Transfer Method

The `transfer` proof method automates this:

```isabelle
lift_definition abs_int :: "nat * nat => int" is "\<lambda>(a, b). a - b" .

lemma "a + b = b + (a :: int)"
  by transfer auto
```

The `transfer` method replaces the abstract-type goal with an equivalent goal on the raw type, which is often easier to prove.

### 8.3 Lifting Definitions

The `lift_definition` command defines operations on a typedef/quotient by specifying them on the raw type:

```isabelle
lift_definition int_add :: "int => int => int" is
  "\<lambda>(a1, b1) (a2, b2). (a1 + a2, b1 + b2)"
  by (auto simp: intrel_def)
```

The proof obligation verifies that the operation respects the equivalence relation.

---

## 9. Key Takeaways

1. Sledgehammer calls external ATPs (E, Vampire, SPASS) and SMT solvers (Z3, CVC5) and reconstructs proofs in Isabelle's kernel.
2. Relevance filtering, based heavily on type information, determines which facts are sent to provers.
3. Nitpick finds counterexamples via finite model search; Quickcheck uses random/exhaustive testing.
4. HOL automation vastly outperforms ZF automation because types provide strong relevance signals.
5. Eisbach enables user-defined proof methods for recurring proof patterns.
6. Transfer and lifting automate reasoning across typedef and quotient boundaries.
7. Sledgehammer cannot discover induction schemes --- you must apply `induct` before calling it.

---

## 10. Exercises

**Exercise 7d.1.** For each of the following lemmas, find a proof using Sledgehammer. Record which prover succeeded and what facts it used:
- `rev (rev xs) = xs`
- `length (filter P xs) \<le> length xs`
- `map f (xs @ ys) = map f xs @ map f ys`

**Exercise 7d.2.** Use Nitpick to find counterexamples for:
- `length xs = length ys ==> xs = ys`
- `sorted xs ==> sorted (tl xs)` (define `sorted` first if needed)
- `xs @ ys = ys @ xs`

**Exercise 7d.3.** Write an Eisbach method `list_induct` that performs induction on the first list variable in the goal and then calls `auto`. Test it on several list lemmas.

**Exercise 7d.4.** Try using Sledgehammer on a goal in Isabelle/ZF (e.g., a basic set-theoretic identity). Compare the success rate with a similar goal in Isabelle/HOL. Explain the difference.

**Exercise 7d.5.** The `smt` proof method can sometimes solve goals that `metis` cannot. Find an example involving integer arithmetic where `smt` succeeds but `metis` fails. Explain why.

---

## References

- Blanchette, J.C., Kaliszyk, C., Paulson, L.C., and Urban, J. (2016). Hammering towards QED. *JAR*, 56(3), 253--291.
- Blanchette, J.C. and Nipkow, T. (2010). Nitpick: A counterexample generator for higher-order logic based on a relational model finder. *ITP 2010*.
- Matichuk, D., Wenzel, M., and Murray, T. (2014). An Isabelle proof method language. *ITP 2014*. (Eisbach)
- Bulwahn, L. (2012). The new Quickcheck for Isabelle. *CPP 2012*.
- Paulson, L.C. and Blanchette, J.C. (2012). Three years of experience with Sledgehammer, a practical link between automatic and interactive theorem provers. *IWIL 2010*.
