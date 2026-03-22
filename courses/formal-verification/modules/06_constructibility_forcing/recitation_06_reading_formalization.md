# Recitation 06: Reading a Large Formalization

## 1. Overview

This recitation is a hands-on guided tour of Paulson's `Constructible/` session in Isabelle/ZF. The goal is to develop the practical skill of navigating, reading, and understanding a large-scale formalization --- one that spans approximately 12,500 lines across dozens of theory files.

**Outline:**

1. Session structure and theory dependencies.
2. Reading a relativized definition and its absoluteness proof.
3. Tracing through a separation instance.
4. Tools for exploration: `find_theorems`, theory panel, grep.
5. Practice exercises.

---

## 2. Session Structure

### 2.1 Loading the Session

The `Constructible` session is part of the Isabelle distribution (since Isabelle2003). To open it:

```
isabelle jedit -d '$ISABELLE_HOME/src/ZF' -l ZF Constructible/ROOT
```

Alternatively, in the Isabelle/jEdit IDE, open the `ROOT` file in the `Constructible` directory and let the session build.

### 2.2 Theory Dependency Graph

The session has a layered structure. The dependency order (simplified) is:

```
Formula.thy
    |
Satisfies.thy
    |
Datatype_absolute.thy
    |
Relative.thy -- Normal.thy
    |               |
Separation.thy  Reflection.thy
    |
Rec_Separation.thy -- WF_absolute.thy -- WFrec.thy
    |
Rank_Separation.thy
    |
L_axioms.thy
    |
AC_in_L.thy
```

You can view the full dependency graph in jEdit via **Theories** panel, or generate it:

```
isabelle build -d . -D Constructible -o browser_info
```

This produces an HTML session graph you can view in a browser.

### 2.3 How to Read the Graph

- **Vertical arrows** indicate imports: lower theories depend on upper ones.
- **Horizontal clusters** indicate theories developed in parallel (e.g., `Normal.thy` and `Relative.thy` are largely independent).
- **The critical path** runs from `Formula.thy` down through `Separation.thy` to `AC_in_L.thy`.

---

## 3. Reading a Relativized Definition

### 3.1 Exercise: The Cartesian Product

Let us trace the relativized definition of the Cartesian product through the formalization.

**Step 1.** Open `Relative.thy` and search for `cartprod`:

```isabelle
definition
  cartprod :: "[i => o, i, i, i] => o" where
  "cartprod(M, A, B, z) ==
    \<forall>u[M]. u \<in> z \<longleftrightarrow>
      (\<exists>x[M]. x \<in> A & (\<exists>y[M]. y \<in> B & pair(M, x, y, u)))"
```

This says: $z$ is the Cartesian product of $A$ and $B$ relative to $M$ if $z$ contains exactly those elements $u \in M$ that are ordered pairs $\langle x, y \rangle$ with $x \in A$ and $y \in B$.

**Step 2.** Find the absoluteness lemma:

```isabelle
lemma (in M_trivial) cartprod_abs [simp]:
  "[| M(A); M(B); M(z) |] ==> cartprod(M, A, B, z) \<longleftrightarrow> z = A \<times> B"
```

**Step 3.** Read the proof:

```isabelle
apply (simp add: cartprod_def)
apply (rule iffI)
 apply (rule equality_iffI)
  apply (simp add: pair_abs)
  ...
```

The proof unfolds the definition, applies the `pair_abs` lemma (absoluteness of ordered pairs), and uses extensionality to conclude $z = A \times B$.

### 3.2 The Pattern

Every relativized concept follows this pattern:

1. A **definition** in `Relative.thy` parameterized by a class $M$.
2. An **absoluteness lemma** proving equivalence with the standard concept when $M$ is transitive and the arguments are in $M$.
3. A **closure lemma** proving that the concept's output is in $M$ (under appropriate assumptions on $M$).

---

## 4. Tracing a Separation Instance

### 4.1 What Separation Instances Look Like

Each separation instance proves that a specific set comprehension can be performed in $L$. The general form is:

```isabelle
lemma some_separation:
  "[| L(a); L(b); ... |] ==> separation(L, \<lambda>x. \<phi>(x, a, b, ...))"
```

where `separation(M, P)` means: for every set $A \in M$, the subset $\{x \in A \mid P(x)\}$ exists in $M$.

### 4.2 Walkthrough: Domain Separation

Open `Separation.thy` and locate `domain_separation`:

```isabelle
lemma domain_separation:
  "L(r) ==> separation(L, \<lambda>x. \<exists>y[L]. \<exists>p[L]. pair(L,x,y,p) & p \<in> r)"
```

The proof has several stages:

**Stage 1: Construct the internal formula.** The proof provides a formula in the `formula` datatype that corresponds to $\exists y.\, \exists p.\, p = \langle x, y \rangle \wedge p \in r$:

```isabelle
apply (rule separation_CollectI)
apply (rule_tac p="Exists(Exists(And(pair_fm(2,1,0), Member(0, r#+3))))"
       in separation_lemma)
```

Here `pair_fm(2,1,0)` is the internal formula asserting that variable 0 is the ordered pair of variables 2 and 1, and `Member(0, r#+3)` asserts that variable 0 is in the parameter $r$ (whose index is shifted by 3 due to the three quantified variables).

**Stage 2: Prove the arity bound.** The formula must have arity at most $1 + |\text{parameters}|$:

```isabelle
apply (simp add: pair_fm_def upair_fm_def)
```

**Stage 3: Prove satisfaction equivalence.** The internal formula, when evaluated via `sats`, must yield the same result as the meta-level property:

```isabelle
apply (simp add: sats_pair_fm)
```

### 4.3 What Makes This Hard

The difficulty is not conceptual but mechanical:

- De Bruijn index arithmetic is error-prone. The `#+` operator shifts indices, and getting the shifts right requires careful tracking.
- Each new quantifier increments all free variable indices.
- The `pair_fm` definition itself has nested quantifiers, adding further index complexity.
- Arity bounds must be checked for the composite formula.

---

## 5. Tools for Navigation

### 5.1 find_theorems

The `find_theorems` command searches for theorems by pattern:

```isabelle
find_theorems "cartprod"
find_theorems "_ \<in> Lset(_)"
find_theorems name: "abs"  -- find lemmas with "abs" in the name
find_theorems "sats(_, _, pair_fm(_, _, _))"
```

In jEdit, use Ctrl+F (or the Query panel) for interactive search.

### 5.2 The Theory Panel

The **Theories** panel in jEdit shows:

- All loaded theories and their build status (green = proven, red = error).
- Clickable navigation to any definition or lemma.
- The dependency graph.

### 5.3 Ctrl+Click Navigation

Ctrl+click on any identifier to jump to its definition. This is the fastest way to trace through a chain of definitions.

### 5.4 Command-Line grep

For finding patterns across theory files:

```bash
cd $ISABELLE_HOME/src/ZF/Constructible
grep -n "separation" Separation.thy | head -30
grep -rn "pair_fm" *.thy
```

### 5.5 thm and term Commands

In the Isabelle buffer, use:

```isabelle
thm cartprod_abs     -- display a named theorem
term "Lset(i)"       -- display the type of a term
print_statement domain_separation  -- display with assumptions
```

---

## 6. Practice Exercises

### Exercise R6.1: Find and Read

Open `Relative.thy` and find the relativized definition of `is_function`. Write down the definition in mathematical notation.

### Exercise R6.2: Trace an Absoluteness Proof

Find the absoluteness lemma for `big_union` (the union operation). Read the proof and identify which other absoluteness lemmas it depends on.

### Exercise R6.3: Count Separation Instances

Using grep or `find_theorems`, count the number of `separation` lemmas in `Separation.thy`, `Rec_Separation.thy`, and `Rank_Separation.thy`. Which file has the most?

### Exercise R6.4: Read an Internal Formula

Find `union_fm` in `Formula.thy` (or its associated theory). Write down the de Bruijn representation and decode it into a standard formula with named variables.

### Exercise R6.5: Dependency Tracing

Starting from `AC_in_L.thy`, trace backward through the imports to identify every theory file that is transitively required. Draw a simplified dependency diagram.

### Exercise R6.6: Modification Experiment

In a scratch theory, try changing the definition of `pair_fm` to use a wrong index (e.g., change a `2` to a `3`). Observe which downstream proofs break and explain why.

---

## 7. Discussion Questions

1. Paulson's formalization has approximately 70 separation instances. If you were redesigning the proof, how might you reduce this number? What are the tradeoffs?

2. The formalization uses de Bruijn indices throughout. What alternative variable binding representations exist (e.g., locally nameless, nominal), and what would be the advantages and disadvantages of each for this particular formalization?

3. The `Constructible` session was developed over approximately two years. Based on your reading, which parts of the formalization seem most amenable to automation, and which seem to require the most human insight?

---

## References

- Paulson, L.C. (2003). The relative consistency of the axiom of choice --- mechanized using Isabelle/ZF. Section 7: Discussion.
- Wenzel, M. (2019). *The Isabelle/Isar Reference Manual*. Chapter on `find_theorems`.
- Isabelle documentation: `$ISABELLE_HOME/src/ZF/Constructible/ROOT`.
