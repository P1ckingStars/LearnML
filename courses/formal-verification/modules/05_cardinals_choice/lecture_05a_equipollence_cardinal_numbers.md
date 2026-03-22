# Lecture 05a: Equipollence & Cardinal Numbers

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** equipollence ($A \approx B$), cardinal injection ($A \lesssim B$), and strict cardinal inequality ($A \prec B$) in Isabelle/ZF.
2. **Prove** that equipollence is an equivalence relation and cardinal injection is a preorder.
3. **Define** cardinal numbers as the least ordinal equinumerous to a given set: $|A| = (\mu i.\, i \approx A)$.
4. **State** and prove Cantor's theorem: $A \prec \mathcal{P}(A)$ for every set $A$.
5. **Distinguish** finite and infinite sets in ZF and relate finiteness to natural numbers.
6. **Navigate** `Cardinal.thy` in the Isabelle/ZF distribution.

---

## 2. Motivation and Context

### 2.1 Counting Beyond the Finite

The concept of "size" for finite sets is straightforward: two sets have the same size if they can be put in one-to-one correspondence. Cantor's revolutionary insight was that this same definition extends to infinite sets, but with surprising consequences: not all infinite sets have the same size.

Isabelle/ZF formalizes this via:

- **Equipollence** ($\approx$): two sets have the same cardinality.
- **Cardinal injection** ($\lesssim$): one set embeds into another.
- **Cardinal numbers** ($|A|$): a canonical representative for each cardinality.

### 2.2 The Role of Ordinals

Cardinal numbers in ZFC are defined using ordinals: the cardinal of $A$ is the least ordinal that can be put in bijection with $A$. This requires the Well-Ordering Theorem (equivalent to the Axiom of Choice): every set can be well-ordered, hence bijected with an ordinal.

Without AC, cardinality can still be defined (e.g., using Scott's trick), but the theory is much less clean. Isabelle/ZF provides both: Cardinal.thy works in ZF (where possible), and Cardinal_AC.thy adds results requiring AC.

---

## 3. Core Theory

### 3.1 Equipollence

**Definition 5.1 (Equipollence).**

$$A \approx B \iff \exists f \in \mathrm{bij}(A, B)$$

```isabelle
definition eqpoll :: "[i, i] => o"  (infixl "\<approx>" 50) where
  "A \<approx> B \<equiv> \<exists>f. f \<in> bij(A, B)"
```

**Theorem 5.1.** Equipollence is an equivalence relation.

*Proof.*

- **Reflexivity.** $A \approx A$ via the identity function $\mathrm{id}(A) \in \mathrm{bij}(A, A)$.
- **Symmetry.** If $f \in \mathrm{bij}(A, B)$, then $f^{-1} \in \mathrm{bij}(B, A)$.
- **Transitivity.** If $f \in \mathrm{bij}(A, B)$ and $g \in \mathrm{bij}(B, C)$, then $g \circ f \in \mathrm{bij}(A, C)$. $\blacksquare$

```isabelle
lemma eqpoll_refl: "A \<approx> A"
lemma eqpoll_sym: "A \<approx> B \<Longrightarrow> B \<approx> A"
lemma eqpoll_trans: "\<lbrakk> A \<approx> B; B \<approx> C \<rbrakk> \<Longrightarrow> A \<approx> C"
```

### 3.2 Cardinal Injection

**Definition 5.2 (Cardinal Injection / Dominance).**

$$A \lesssim B \iff \exists f \in \mathrm{inj}(A, B)$$

```isabelle
definition lepoll :: "[i, i] => o"  (infixl "\<lesssim>" 50) where
  "A \<lesssim> B \<equiv> \<exists>f. f \<in> inj(A, B)"
```

**Theorem 5.2.** Cardinal injection is a preorder.

```isabelle
lemma lepoll_refl: "A \<lesssim> A"
lemma lepoll_trans: "\<lbrakk> A \<lesssim> B; B \<lesssim> C \<rbrakk> \<Longrightarrow> A \<lesssim> C"
```

Note: $\lesssim$ is *not* antisymmetric in general. Antisymmetry ($A \lesssim B \land B \lesssim A \implies A \approx B$) is the Schroeder-Bernstein theorem (Lecture 05b).

### 3.3 Strict Cardinal Inequality

**Definition 5.3 (Strict Cardinal Inequality).**

$$A \prec B \iff A \lesssim B \land \neg(A \approx B)$$

```isabelle
definition lesspoll :: "[i, i] => o"  (infixl "\<prec>" 50) where
  "A \<prec> B \<equiv> A \<lesssim> B \<and> \<not>(A \<approx> B)"
```

### 3.4 Cantor's Theorem

**Theorem 5.3 (Cantor).** For every set $A$: $A \prec \mathcal{P}(A)$.

This has two parts:

1. $A \lesssim \mathcal{P}(A)$: the injection $a \mapsto \{a\}$ works.
2. $\neg(A \approx \mathcal{P}(A))$: there is no surjection from $A$ onto $\mathcal{P}(A)$.

*Proof of (2).* Suppose for contradiction that $f \in \mathrm{surj}(A, \mathcal{P}(A))$. Define:

$$D = \{x \in A : x \notin f(x)\}$$

Then $D \in \mathcal{P}(A)$ (it is a subset of $A$). Since $f$ is surjective, there exists $d \in A$ with $f(d) = D$. Now:

- If $d \in D$, then by definition of $D$, $d \notin f(d) = D$. Contradiction.
- If $d \notin D$, then by definition of $D$, $d \in f(d) = D$. Contradiction.

In either case, we have a contradiction. $\blacksquare$

```isabelle
lemma Cantor: "A \<prec> Pow(A)"
```

The Isabelle/ZF proof in Cardinal.thy follows this diagonal argument. The key intermediate lemma is:

```isabelle
lemma cantor_surj:
  "f \<in> surj(A, Pow(A)) \<Longrightarrow> False"
proof -
  assume "f \<in> surj(A, Pow(A))"
  let ?D = "{x \<in> A. x \<notin> f ` x}"
  have "?D \<in> Pow(A)" by blast
  with \<open>f \<in> surj(A, Pow(A))\<close>
  obtain d where "d \<in> A" and "f ` d = ?D"
    by (auto simp: surj_def)
  then show False
  proof (cases "d \<in> ?D")
    case True
    then have "d \<notin> f ` d" by (rule CollectD2)
    with \<open>f ` d = ?D\<close> True show False by simp
  next
    case False
    with \<open>d \<in> A\<close> \<open>f ` d = ?D\<close> have "d \<in> ?D" by auto
    with False show False by contradiction
  qed
qed
```

### 3.5 Cardinal Numbers

**Definition 5.4 (Cardinal Number).**

The cardinal of a set $A$ is the least ordinal equinumerous to $A$:

$$|A| = (\mu i.\, i \approx A)$$

where $\mu$ denotes the least ordinal satisfying the property.

```isabelle
definition cardinal :: "i => i"  ("|_|") where
  "|A| \<equiv> \<mu> i. i \<approx> A"
```

The operator $\mu$ (Least) is defined as:

```isabelle
definition Least :: "(i => o) => i"  ("\<mu>") where
  "\<mu> i. P(i) \<equiv> THE i. Ord(i) \<and> P(i) \<and> (\<forall>j. j < i \<longrightarrow> \<not>P(j))"
```

**Key properties:**

```isabelle
(* |A| is an ordinal *)
lemma Ord_cardinal [TC]: "Ord(|A|)"

(* |A| is equinumerous to A (requires AC for arbitrary sets) *)
lemma cardinal_eqpoll: "well_ord(A, r) \<Longrightarrow> |A| \<approx> A"

(* |A| is the least such ordinal *)
lemma cardinal_le: "Ord(i) \<Longrightarrow> i \<approx> A \<Longrightarrow> |A| \<le> i"

(* Equipollent sets have the same cardinal *)
lemma eqpoll_imp_cardinal_eq: "A \<approx> B \<Longrightarrow> |A| = |B|"

(* The cardinal of an ordinal *)
lemma cardinal_of_Ord: "Ord(i) \<Longrightarrow> |i| \<le> i"
```

### 3.6 Initial Ordinals (Cardinals as Ordinals)

**Definition 5.5 (Cardinal / Initial Ordinal).** An ordinal $\kappa$ is a *cardinal* (initial ordinal) if no smaller ordinal is equinumerous to $\kappa$:

$$\mathrm{Card}(\kappa) \iff \mathrm{Ord}(\kappa) \land |\kappa| = \kappa$$

```isabelle
definition Card :: "i => o" where
  "Card(K) \<equiv> Ord(K) \<and> |K| = K"
```

**Theorem 5.4.** $|A|$ is always a cardinal: $\mathrm{Card}(|A|)$.

```isabelle
lemma Card_cardinal: "Card(|A|)"
```

---

## 4. Finite and Infinite Sets

### 4.1 Finite Sets

**Definition 5.6 (Finite).**

$$\mathrm{Finite}(A) \iff \exists n \in \mathrm{nat}.\, A \approx n$$

```isabelle
definition Finite :: "i => o" where
  "Finite(A) \<equiv> \<exists>n\<in>nat. A \<approx> n"
```

Equivalently, $A$ is finite if $|A| \in \mathrm{nat}$.

### 4.2 Properties of Finite Sets

```isabelle
lemma Finite_0 [simp]: "Finite(0)"
lemma Finite_cons: "Finite(A) \<Longrightarrow> Finite(cons(a, A))"
lemma Finite_Un: "\<lbrakk> Finite(A); Finite(B) \<rbrakk> \<Longrightarrow> Finite(A \<union> B)"
lemma Finite_subset: "\<lbrakk> B \<subseteq> A; Finite(A) \<rbrakk> \<Longrightarrow> Finite(B)"
lemma nat_not_Finite: "\<not> Finite(nat)"
```

### 4.3 Dedekind-Infinite

A set is *Dedekind-infinite* if it is equinumerous to a proper subset:

$$\mathrm{Dedekind\text{-}infinite}(A) \iff \exists B \subsetneq A.\, A \approx B$$

In ZFC, Dedekind-infinite is equivalent to $\mathrm{nat} \lesssim A$. Without AC, this equivalence may fail.

---

## 5. Examples and Computations

### 5.1 Cardinals of Small Sets

```isabelle
lemma "|0| = 0"
lemma "|{a}| = succ(0)"    (* |singleton| = 1 *)
lemma "|nat| = nat"         (* omega is a cardinal *)
```

### 5.2 Cantor's Theorem: Consequences

Starting from $\mathrm{nat} \prec \mathcal{P}(\mathrm{nat})$:

$$|\mathrm{nat}| < |\mathcal{P}(\mathrm{nat})| < |\mathcal{P}(\mathcal{P}(\mathrm{nat}))| < \cdots$$

This gives an infinite hierarchy of infinite cardinalities. Whether $|\mathcal{P}(\mathrm{nat})| = \aleph_1$ (the Continuum Hypothesis) is independent of ZFC (Module 06).

### 5.3 Proving a Set is Countable

```isabelle
lemma nat_times_nat_eqpoll_nat:
  "nat \<times> nat \<approx> nat"
```

This requires constructing a bijection between $\omega \times \omega$ and $\omega$. The standard approach uses the Cantor pairing function:

$$\pi(m, n) = \frac{(m + n)(m + n + 1)}{2} + m$$

In Isabelle/ZF, this is typically proved using cardinal arithmetic (Lecture 05d) or by an explicit bijection.

---

## 6. Connections and Extensions

### 6.1 Links to Prior Modules

- **Lecture 04b**: Bijections, injections, and surjections are defined in `Perm.thy`.
- **Lecture 04d**: Ordinals provide the indexing set for cardinal numbers.

### 6.2 Links to Future Modules

- **Lecture 05b**: Schroeder-Bernstein theorem: $A \lesssim B \land B \lesssim A \implies A \approx B$.
- **Lecture 05c**: The Axiom of Choice is needed to prove that every set has a cardinal number.
- **Lecture 05d**: Cardinal arithmetic: addition, multiplication, and the absorption law.

---

## 7. Seminal Paper Reading List

### Required

1. **Paulson, L. C. & Grabczewski, K. (1996).** "Mechanizing Set Theory: Cardinal Arithmetic and the Axiom of Choice." *Journal of Automated Reasoning*, 17(3), 291--323.
   - *The foundational paper on cardinal arithmetic in Isabelle/ZF. Read Sections 1--4.*

### Recommended

2. **Halmos, P. R. (1960).** *Naive Set Theory.* Springer.
   - *Chapters 22--24: cardinal numbers and Cantor's theorem.*

3. **Cantor, G. (1891).** "Ueber eine elementare Frage der Mannigfaltigkeitslehre." *Jahresbericht der DMV*, 1, 75--78.
   - *The original diagonal argument.*

---

## 8. Exercises

### Theory

**Exercise 5a.1.** Prove that $\mathrm{nat} \approx \mathrm{nat} - \{0\}$ by constructing an explicit bijection (the "Hilbert Hotel" argument).

**Exercise 5a.2.** Prove Cantor's theorem on paper: for any set $A$, there is no surjection $f : A \to \mathcal{P}(A)$.

**Exercise 5a.3.** Show that $|A| = |B| \iff A \approx B$ (assuming both $A$ and $B$ can be well-ordered).

**Exercise 5a.4.** Prove that $\mathrm{Finite}(A)$ and $\mathrm{Finite}(B)$ implies $\mathrm{Finite}(A \times B)$.

### Isabelle

**Exercise 5a.5.** Prove in Isabelle/ZF:
```isabelle
lemma "A \<approx> A"
lemma "A \<approx> B \<Longrightarrow> B \<approx> A"
lemma "\<lbrakk> A \<approx> B; B \<approx> C \<rbrakk> \<Longrightarrow> A \<approx> C"
```

**Exercise 5a.6.** Prove: `A \<lesssim> A \<union> B` (there is an injection from $A$ into $A \cup B$).

**Exercise 5a.7.** Prove that a subset of a finite set is finite:
```isabelle
lemma "\<lbrakk> Finite(A); B \<subseteq> A \<rbrakk> \<Longrightarrow> Finite(B)"
```

**Exercise 5a.8.** Prove Cantor's theorem for a specific case: `{0} \<prec> Pow({0})`. Compute $\mathcal{P}(\{0\})$ explicitly and show no bijection exists by considering all possible functions.
