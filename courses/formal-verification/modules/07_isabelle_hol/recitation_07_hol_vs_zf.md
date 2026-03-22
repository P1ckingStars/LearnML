# Recitation 07: HOL vs. ZF

## 1. Overview

This recitation is a hands-on comparison of Isabelle/HOL and Isabelle/ZF. We formalize the same theorem in both logics, compare the proof structure and length, and discuss the tradeoffs between expressiveness and automation.

**Outline:**

1. The theorem: composition of injections is an injection.
2. Formalization in Isabelle/HOL.
3. Formalization in Isabelle/ZF.
4. Side-by-side comparison.
5. Discussion of tradeoffs.
6. Practice problems.

---

## 2. The Theorem

**Theorem.** If $f : A \to B$ and $g : B \to C$ are injective functions, then $g \circ f : A \to C$ is injective.

This is a standard result from elementary mathematics. We will formalize it in both Isabelle/HOL and Isabelle/ZF to illustrate the differences.

---

## 3. Formalization in Isabelle/HOL

### 3.1 Statement

In HOL, functions are simply typed lambda terms, and injectivity is a predicate on functions:

```isabelle
theory Injection_HOL
  imports Main
begin

definition injective :: "('a => 'b) => bool" where
  "injective f \<longleftrightarrow> (\<forall>x y. f x = f y \<longrightarrow> x = y)"

theorem comp_injective:
  assumes "injective f" and "injective g"
  shows "injective (g \<circ> f)"
```

### 3.2 Proof

```isabelle
proof (unfold injective_def comp_def)
  show "\<forall>x y. g (f x) = g (f y) \<longrightarrow> x = y"
  proof (intro allI impI)
    fix x y
    assume "g (f x) = g (f y)"
    then have "f x = f y"
      using assms(2) unfolding injective_def by blast
    then show "x = y"
      using assms(1) unfolding injective_def by blast
  qed
qed
```

### 3.3 Short Proof

With automation:

```isabelle
theorem comp_injective_auto:
  assumes "injective f" and "injective g"
  shows "injective (g \<circ> f)"
  using assms unfolding injective_def comp_def by blast
```

Or even shorter, using the library definition `inj`:

```isabelle
theorem comp_inj: "inj f \<Longrightarrow> inj g \<Longrightarrow> inj (g \<circ> f)"
  by (auto simp: inj_def)
```

**Total: 3--8 lines of proof.**

---

## 4. Formalization in Isabelle/ZF

### 4.1 Statement

In ZF, functions are sets of ordered pairs, and we must state the types explicitly:

```isabelle
theory Injection_ZF
  imports ZF
begin

definition injection :: "[i, i, i] => o" where
  "injection(A, B, f) \<longleftrightarrow>
    f : A -> B \<and>
    (\<forall>x \<in> A. \<forall>y \<in> A. f ` x = f ` y \<longrightarrow> x = y)"

theorem comp_injection:
  assumes "injection(A, B, f)" and "injection(B, C, g)"
  shows "injection(A, C, g O f)"
```

### 4.2 Proof

The proof must handle the set-theoretic details:

```isabelle
proof (unfold injection_def, intro conjI)
  -- First show g O f : A -> C
  show "g O f : A -> C"
  proof -
    have "f : A -> B" using assms(1) unfolding injection_def by auto
    moreover have "g : B -> C" using assms(2) unfolding injection_def by auto
    ultimately show ?thesis by (rule comp_fun)
  qed
next
  -- Then show injectivity
  show "\<forall>x \<in> A. \<forall>y \<in> A. (g O f) ` x = (g O f) ` y \<longrightarrow> x = y"
  proof (intro ballI impI)
    fix x y
    assume xA: "x \<in> A" and yA: "y \<in> A"
    assume eq: "(g O f) ` x = (g O f) ` y"
    have f_fun: "f : A -> B"
      using assms(1) unfolding injection_def by auto
    have g_fun: "g : B -> C"
      using assms(2) unfolding injection_def by auto
    -- Rewrite composition application
    have "(g O f) ` x = g ` (f ` x)"
      using comp_fun_apply[OF f_fun g_fun xA] .
    moreover have "(g O f) ` y = g ` (f ` y)"
      using comp_fun_apply[OF f_fun g_fun yA] .
    ultimately have "g ` (f ` x) = g ` (f ` y)"
      using eq by simp
    -- Use injectivity of g
    moreover have "f ` x \<in> B" using f_fun xA by (rule apply_type)
    moreover have "f ` y \<in> B" using f_fun yA by (rule apply_type)
    ultimately have "f ` x = f ` y"
      using assms(2) unfolding injection_def by auto
    -- Use injectivity of f
    then show "x = y"
      using assms(1) xA yA unfolding injection_def by auto
  qed
qed
```

**Total: ~25 lines of proof.**

---

## 5. Side-by-Side Comparison

| Aspect | Isabelle/HOL | Isabelle/ZF |
|---|---|---|
| Statement length | 3 lines | 5 lines |
| Proof length | 3--8 lines | ~25 lines |
| Type annotations | None (inferred) | Explicit ($A$, $B$, $C$) |
| Function application | `f x` | `f \` x` |
| Composition | `g \<circ> f` | `g O f` |
| Key proof burden | None (all automatic) | Type membership, composition application |
| Automation success | `blast` or `simp` suffices | `auto` handles parts; manual steps needed |
| Library support | `inj` predefined | `injection` user-defined |

### 5.1 Where the Extra Proof Goes in ZF

The ZF proof is longer because:

1. **Typing obligations.** We must prove `f \` x \<in> B` (function application preserves types) and `g O f : A -> C` (composition is well-typed). In HOL, the type system handles this automatically.

2. **Composition unfolding.** We must prove `(g O f) \` x = g \` (f \` x)`. In HOL, `(g \<circ> f) x = g (f x)` is true by definition.

3. **Membership assumptions.** Every universal statement requires explicit membership: `\<forall>x \<in> A` rather than `\<forall>x`. The ZF quantifiers are bounded.

---

## 6. Discussion: Tradeoffs

### 6.1 When HOL Wins

- **Everyday mathematics:** algebra, analysis, discrete math.
- **Program verification:** HOL's type system matches programming language types.
- **Automation-heavy proofs:** Sledgehammer is dramatically more effective.
- **Code generation:** HOL can extract executable programs.

### 6.2 When ZF Wins

- **Set theory proper:** independence proofs, large cardinals, constructibility.
- **Foundation-sensitive work:** reasoning about the cumulative hierarchy, ordinal arithmetic.
- **Mixed-type collections:** ZF naturally handles sets containing sets of different "types."
- **Flexibility:** no type-correctness constraints on term formation.

### 6.3 Can You Have Both?

Some approaches try to combine the advantages:

- **Isabelle/HOL set theory.** HOL has a `Set` type that provides set-theoretic reasoning within the typed framework. However, it cannot express proper classes or reason about the cumulative hierarchy.
- **Mizar.** Uses a soft type system over a set-theoretic foundation, providing some type checking without the rigidity of HOL.
- **Egal/HOL-ST.** Experimental systems that embed set theory into HOL.

---

## 7. Practice Problems

### Problem R7.1: Image of Union

Prove in both HOL and ZF: $f[A \cup B] = f[A] \cup f[B]$ (the image of a union is the union of images).

**HOL version:**

```isabelle
lemma "f ` (A \<union> B) = f ` A \<union> f ` B"
```

**ZF version:**

```isabelle
lemma "f : A \<union> B -> C ==>
  f `` (A \<union> B) = f `` A \<union> f `` B"
```

Compare the proof lengths.

### Problem R7.2: Surjection has Right Inverse

State and prove in HOL: if $f : A \to B$ is surjective, then there exists $g : B \to A$ with $f \circ g = \mathrm{id}_B$.

Then state the same theorem in ZF and discuss: does the proof require the Axiom of Choice? In which logic is this more apparent?

### Problem R7.3: Pigeonhole Principle

Prove in both HOL and ZF: if $f : A \to B$ and $|A| > |B|$ (both finite), then $f$ is not injective.

Compare the proof structure. Which logic makes the finiteness assumption easier to use?

### Problem R7.4: Cantor's Theorem

Prove Cantor's theorem ($|A| < |\mathcal{P}(A)|$) in both HOL and ZF. In HOL, this is stated as: there is no surjection `f :: 'a => 'a set`. In ZF, it is stated set-theoretically. Compare.

### Problem R7.5: Free Discussion

Consider a formalization project of your choice (e.g., the fundamental theorem of algebra, correctness of a sorting algorithm, a result from graph theory). Which logic would you choose and why? Write a one-paragraph justification.

---

## References

- Paulson, L.C. (1993). Set theory for verification: I. From foundations to functions. *JAR*, 11(3), 353--389.
- Paulson, L.C. (1995). Set theory for verification: II. Induction and recursion. *JAR*, 15(2), 167--215.
- Nipkow, T., Paulson, L.C., and Wenzel, M. (2002). *Isabelle/HOL*. LNCS 2283.
- Wiedijk, F. (2006). *The Seventeen Provers of the World*. LNAI 3600. Springer. (Comparison across provers.)
