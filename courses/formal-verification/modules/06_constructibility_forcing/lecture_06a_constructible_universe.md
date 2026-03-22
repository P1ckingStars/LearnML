# Lecture 06a: Godel's Constructible Universe L

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** the motivation for Godel's constructible universe: establishing relative consistency results such as Con(ZF) implies Con(ZFC + GCH).
2. **Define** the constructible hierarchy $L_\alpha$ by transfinite recursion and state the key properties of each stage.
3. **Formalize** the definable powerset operator $\mathrm{Def}(A)$ and distinguish it from the full powerset $\mathcal{P}(A)$.
4. **Navigate** the `Constructible/` session in Isabelle/ZF, identifying the roles of `Formula.thy`, `Satisfies.thy`, and `DPow.thy`.
5. **Describe** how first-order formulas are internalized using de Bruijn indices and why this encoding avoids variable capture.

---

## 2. Motivation: Relative Consistency

### 2.1 The Central Question

Set theory's two most famous independent statements are the Axiom of Choice (AC) and the Continuum Hypothesis (CH). Godel (1938, 1940) showed that if ZF is consistent, then so is ZF + AC + GCH. Cohen (1963) completed the picture by showing the independence of AC and CH from ZF. This lecture covers Godel's half.

The strategy is *inner models*: construct, inside any model $V$ of ZF, a subclass $L \subseteq V$ that is itself a model of ZF and additionally satisfies AC and GCH. If ZF were inconsistent with AC, we could derive a contradiction in ZF alone via the interpretation into $L$, contradicting Con(ZF).

### 2.2 The Idea: Restricting to "Definable" Sets

The cumulative hierarchy $V_\alpha$ is built by iterating the full powerset:

$$V_0 = \emptyset, \quad V_{\alpha+1} = \mathcal{P}(V_\alpha), \quad V_\lambda = \bigcup_{\beta < \lambda} V_\beta$$

The constructible hierarchy replaces $\mathcal{P}$ with the *definable powerset* $\mathrm{Def}$:

$$L_0 = \emptyset, \quad L_{\alpha+1} = \mathrm{Def}(L_\alpha), \quad L_\lambda = \bigcup_{\beta < \lambda} L_\beta$$

where $\mathrm{Def}(A)$ collects only those subsets of $A$ that are first-order definable over $(A, \in)$ with parameters from $A$. Since $\mathrm{Def}(A) \subseteq \mathcal{P}(A)$, we always have $L_\alpha \subseteq V_\alpha$, and consequently $L \subseteq V$.

---

## 3. The Definable Powerset

### 3.1 First-Order Definability Over a Structure

**Definition 3.1 (Definability).** Let $(A, \in)$ be a structure. A set $X \subseteq A$ is *definable over $A$ with parameters* if there exists a first-order formula $\varphi(x, y_1, \ldots, y_n)$ in the language $\{\in\}$ and elements $a_1, \ldots, a_n \in A$ such that:

$$X = \{ x \in A \mid (A, \in) \models \varphi(x, a_1, \ldots, a_n) \}$$

**Definition 3.2 (Definable Powerset).** For a set $A$:

$$\mathrm{Def}(A) = \{ X \subseteq A \mid X \text{ is definable over } (A, \in) \text{ with parameters from } A \}$$

### 3.2 Key Properties

**Proposition 3.3.** For any set $A$:

1. $A \in \mathrm{Def}(A)$ (take $\varphi(x) \equiv x = x$).
2. Every element of $A$ belongs to $\mathrm{Def}(A)$: if $a \in A$ then $\{a\} \in \mathrm{Def}(A)$ (take $\varphi(x, y) \equiv x = y$ with parameter $a$).
3. $\mathrm{Def}(A)$ is closed under boolean operations and bounded quantification over $A$.
4. $|\mathrm{Def}(A)| \le \max(|A|, \aleph_0)$, since there are only countably many formulas.
5. $\mathrm{Def}(A) \subseteq \mathcal{P}(A) \cup \{A\}$.

*Proof of (4).* A first-order formula is a finite string over a finite alphabet. The number of formulas is $\aleph_0$. Each formula can take at most $|A|^n$ parameter tuples. Thus $|\mathrm{Def}(A)| \le \aleph_0 \cdot \sum_n |A|^n = \max(|A|, \aleph_0)$. $\blacksquare$

### 3.3 Why Def(A) Can Be Strictly Smaller Than P(A)

When $A$ is uncountable, $|\mathcal{P}(A)| > |A|$ by Cantor's theorem, but $|\mathrm{Def}(A)| \le |A|$ (for $|A| \ge \aleph_0$). So most subsets of an uncountable set are *not* first-order definable. This is precisely how $L$ avoids "wild" sets and ensures CH holds.

---

## 4. The Constructible Hierarchy

### 4.1 Formal Definition

**Definition 4.1 (Constructible hierarchy).** Define by transfinite recursion on ordinals:

$$L_0 = \emptyset$$
$$L_{\alpha+1} = \mathrm{Def}(L_\alpha)$$
$$L_\lambda = \bigcup_{\beta < \lambda} L_\beta \quad \text{for limit } \lambda$$

**Definition 4.2 (Constructible universe).** $L = \bigcup_{\alpha \in \mathrm{Ord}} L_\alpha$.

### 4.2 Basic Properties

**Proposition 4.3.** The constructible hierarchy satisfies:

1. *Monotonicity*: $\alpha \le \beta \implies L_\alpha \subseteq L_\beta$.
2. *Transitivity*: each $L_\alpha$ is transitive ($x \in y \in L_\alpha \implies x \in L_\alpha$).
3. *Containment*: $L_\alpha \subseteq V_\alpha$ for all $\alpha$.
4. *Ordinals*: $\alpha \subseteq L_\alpha$ for all ordinals $\alpha$ (every ordinal is constructible).
5. *Closure*: $L$ is a transitive class containing all ordinals.

*Proof sketch of (2).* By transfinite induction. $L_0 = \emptyset$ is vacuously transitive. If $L_\alpha$ is transitive, then any $X \in L_{\alpha+1} = \mathrm{Def}(L_\alpha)$ satisfies $X \subseteq L_\alpha$. If $x \in X$ then $x \in L_\alpha \subseteq L_{\alpha+1}$. The limit case follows from the union. $\blacksquare$

### 4.3 L at Small Ordinals

To build intuition, let us trace the first few levels:

- $L_0 = \emptyset$.
- $L_1 = \mathrm{Def}(\emptyset) = \{\emptyset\}$ (the only definable subset of $\emptyset$ is $\emptyset$ itself, and $\emptyset \subseteq \emptyset$).
- $L_2 = \mathrm{Def}(\{\emptyset\}) = \{\emptyset, \{\emptyset\}\}$.
- $L_3 = \mathrm{Def}(\{\emptyset, \{\emptyset\}\}) = \{\emptyset, \{\emptyset\}, \{\{\emptyset\}\}, \{\emptyset, \{\emptyset\}\}\}$.
- $L_\omega = \bigcup_{n < \omega} L_n$. This is a countable transitive set containing all hereditarily finite sets.

**Remark.** At finite and countable levels, $L_\alpha = V_\alpha$ because every subset of a finite or countable set is definable (one can list elements explicitly via parameters). The divergence begins at uncountable stages.

---

## 5. Internalized Formulas in Isabelle/ZF

### 5.1 The Constructible/ Session

Paulson's formalization of $L$ in Isabelle/ZF lives in the session `Constructible`. The key theories are:

| Theory file | Purpose |
|---|---|
| `Formula.thy` | Internalized first-order formulas as a ZF set |
| `Satisfies.thy` | The satisfaction relation `sats` |
| `DPow.thy` | The definable powerset operator |
| `Relative.thy` | Relativized set-theoretic concepts |
| `Separation.thy` | Separation instances for L |
| `L_axioms.thy` | Proof that L satisfies ZF axioms |
| `AC_in_L.thy` | The axiom of choice in L |

### 5.2 Formula.thy: Internalized Formulas

In the metatheory, we reason about formulas as syntactic objects. To formalize $\mathrm{Def}(A)$ *inside* ZF, we need formulas to be ZF sets. Paulson defines an inductive datatype of *internalized* first-order formulas:

```isabelle
consts
  Member :: "[i, i] => i"
  Equal  :: "[i, i] => i"
  Nand   :: "[i, i] => i"
  Forall :: "i => i"

definition formula :: i where
  "formula == lfp(univ(0), formula_functor)"
```

Each constructor takes natural-number indices as arguments, representing variables via **de Bruijn indices** rather than named variables:

- `Member(n, m)` represents $x_n \in x_m$.
- `Equal(n, m)` represents $x_n = x_m$.
- `Nand(p, q)` represents $\neg(p \wedge q)$ (NAND is functionally complete with Forall).
- `Forall(p)` binds the variable with index 0 in $p$; all other indices shift down.

### 5.3 Why De Bruijn Indices

Named variables require $\alpha$-equivalence: $\forall x.\, x \in y$ and $\forall z.\, z \in y$ should be the same formula. De Bruijn indices eliminate this issue entirely. In a de Bruijn representation:

- $\forall.\, \mathrm{Member}(0, 1)$ means "for all $x_0$, $x_0 \in x_1$" where $x_0$ is the bound variable and $x_1$ is free.
- Variable 0 always refers to the innermost binder.
- Under a binder, free variable indices increment by 1.

**Example.** The formula $\forall x.\, \exists y.\, x \in y$ becomes:

$$\mathrm{Forall}(\mathrm{Forall}(\mathrm{Nand}(\mathrm{Nand}(\mathrm{Member}(1, 0), \mathrm{Member}(1, 0)), \mathrm{Forall}(\ldots))))$$

In practice, Paulson defines derived connectives and the existential quantifier as abbreviations:

```isabelle
definition Neg :: "i => i" where
  "Neg(p) == Nand(p, p)"

definition And :: "[i, i] => i" where
  "And(p, q) == Neg(Nand(p, q))"

definition Or :: "[i, i] => i" where
  "Or(p, q) == Nand(Neg(p), Neg(q))"

definition Implies :: "[i, i] => i" where
  "Implies(p, q) == Nand(p, Neg(q))"

definition Exists :: "i => i" where
  "Exists(p) == Neg(Forall(Neg(p)))"
```

### 5.4 The Satisfaction Relation

The satisfaction relation `sats(A, env, p)` determines whether formula $p$ holds in the structure $(A, \in)$ under environment `env`, which maps variable indices to elements of $A$:

```isabelle
primrec sats :: "[i, i, i] => o" where
  "sats(A, env, Member(x, y)) <-> nth(x, env) \<in> nth(y, env)"
| "sats(A, env, Equal(x, y))  <-> nth(x, env) = nth(y, env)"
| "sats(A, env, Nand(p, q))   <-> ~(sats(A, env, p) & sats(A, env, q))"
| "sats(A, env, Forall(p))    <-> (\<forall>x \<in> A. sats(A, Cons(x, env), p))"
```

Here `env` is a list (ZF finite sequence) and `nth(n, env)` retrieves the $n$-th element. Under `Forall`, the new bound variable is prepended via `Cons(x, env)`, which is why index 0 refers to the innermost binder.

### 5.5 The Definable Powerset: DPow

With internalized formulas and satisfaction in hand, we can define $\mathrm{Def}(A)$:

```isabelle
definition DPow :: "i => i" where
  "DPow(A) == { X \<in> Pow(A) .
      \<exists>env \<in> list(A). \<exists>p \<in> formula.
        arity(p) \<le> succ(length(env)) &
        X = { x \<in> A . sats(A, Cons(x, env), p) } }"
```

This says: $X \in \mathrm{DPow}(A)$ if and only if $X \subseteq A$ and there exists a formula $p$ and a list of parameters `env` drawn from $A$ such that $X$ is exactly the set of elements of $A$ satisfying $p$ under that environment.

---

## 6. The Constructible Hierarchy, Formalized

### 6.1 Lset: The Constructible Levels

Paulson defines the constructible hierarchy using well-founded recursion on ordinals:

```isabelle
definition Lset :: "i => i" where
  "Lset(i) == transrec(i, %x f. \<Union>y \<in> x. DPow(f`y))"
```

This mirrors the mathematical definition: $L_\alpha = \bigcup_{\beta < \alpha} \mathrm{DPow}(L_\beta)$. Note that at successor stages, this gives $L_{\alpha+1} = \mathrm{DPow}(L_\alpha)$ as expected, since $\bigcup_{\beta \le \alpha} \mathrm{DPow}(L_\beta) = \mathrm{DPow}(L_\alpha)$ by monotonicity.

### 6.2 Key Lemmas About Lset

```isabelle
lemma Lset_0: "Lset(0) = 0"

lemma Lset_succ: "Ord(i) ==> Lset(succ(i)) = DPow(Lset(i))"

lemma Lset_Union: "Limit(i) ==> Lset(i) = (\<Union>j<i. Lset(j))"

lemma Lset_mono: "i \<le> j ==> Lset(i) \<subseteq> Lset(j)"

lemma Transset_Lset: "Transset(Lset(i))"
```

### 6.3 The Class L

The constructible universe $L$ is the union of all $L_\alpha$:

```isabelle
definition L :: "i => o" where
  "L(x) == \<exists>i. Ord(i) & x \<in> Lset(i)"
```

Here `L` is a *class predicate* `i => o`, since classes in ZF are predicates on sets, not sets themselves (to avoid Russell-type paradoxes).

---

## 7. Encoding Set-Theoretic Operations

### 7.1 The Challenge

To prove that $L$ satisfies ZF axioms, we must show that standard set-theoretic operations (pairing, union, powerset, etc.) produce constructible sets when applied to constructible inputs. This requires showing that the relevant defining formulas are *absolute* --- a concept we develop fully in Lecture 06b.

As a preview, consider pairing. We need to show that if $a, b \in L$, then $\{a, b\} \in L$. The key is that $\{a, b\}$ is definable: $\{a, b\} = \{x \mid x = a \lor x = b\}$, and this defining formula is simple enough to be absolute.

### 7.2 Internal Formulas for Set Operations

Paulson encodes a library of internal formulas corresponding to set-theoretic operations:

```isabelle
definition pair_fm :: "[i, i, i] => i" where
  "pair_fm(x, y, z) ==
    Exists(Exists(
      And(upair_fm(x#+2, x#+2, 1),
      And(upair_fm(x#+2, y#+2, 0),
          upair_fm(1, 0, z#+2)))))"
```

Each `_fm` definition mirrors the corresponding set-theoretic concept but expressed as an internalized formula. The `#+2` notation adjusts de Bruijn indices to account for the two existential quantifiers.

---

## 8. The Road Ahead

This lecture established the core definitions. The next three lectures complete the picture:

- **Lecture 06b**: Absoluteness and the reflection theorem --- the tools needed to show that set-theoretic concepts have the same meaning inside $L$ as outside.
- **Lecture 06c**: The proof that $L$ satisfies all ZF axioms plus AC, establishing Con(ZF) implies Con(ZFC + GCH).
- **Lecture 06d**: Forcing and the independence of CH, completing the independence proof.

---

## 9. Key Takeaways

1. The constructible universe $L$ is built by iterating the *definable powerset* rather than the full powerset.
2. $\mathrm{Def}(A)$ collects only first-order definable subsets of $A$ with parameters, which is at most $\max(|A|, \aleph_0)$ --- crucially smaller than $\mathcal{P}(A)$ for uncountable $A$.
3. Formalizing $\mathrm{Def}$ in ZF requires internalizing first-order formulas as ZF sets, using de Bruijn indices for variable binding.
4. The satisfaction relation `sats(A, env, p)` evaluates an internalized formula $p$ in structure $(A, \in)$ under environment `env`.
5. Paulson's `DPow.thy` combines these ingredients to give $\mathrm{Def}(A)$ as a ZF set, enabling the definition of `Lset(i)` by transfinite recursion.

---

## 10. Exercises

**Exercise 6a.1.** Compute $L_4$ explicitly. How many elements does it have?

**Exercise 6a.2.** Show that $\omega \subseteq L_\omega$ by arguing that every natural number $n$ is in $L_{n+1}$.

**Exercise 6a.3.** Show that $\mathrm{Def}(A) = \mathcal{P}(A)$ when $A$ is finite.

**Exercise 6a.4.** Explain why `Nand` and `Forall` together are functionally complete for first-order logic. Which connectives can you define from them?

**Exercise 6a.5.** In Isabelle, load `Constructible/Formula.thy` and use `thm formula.intros` to list the introduction rules for the `formula` datatype. Write down the Isabelle term for the formula $\exists x.\, x \in y$ using the internal encoding (with $y$ as free variable index 0).

---

## References

- Godel, K. (1940). *The Consistency of the Axiom of Choice and of the Generalized Continuum Hypothesis with the Axioms of Set Theory*. Annals of Mathematics Studies, No. 3.
- Kunen, K. (2011). *Set Theory: An Introduction to Independence Proofs*. Studies in Logic. Chapters II and VI.
- Paulson, L.C. (2003). The relative consistency of the axiom of choice --- mechanized using Isabelle/ZF. *LMS Journal of Computation and Mathematics*, 6, 198--248.
- Jech, T. (2003). *Set Theory*. Springer Monographs in Mathematics. Chapter 13.
