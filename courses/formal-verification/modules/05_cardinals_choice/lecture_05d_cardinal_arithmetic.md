# Lecture 05d: Cardinal Arithmetic

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** cardinal addition ($\kappa \oplus \lambda$), cardinal multiplication ($\kappa \otimes \lambda$), and state their basic properties.
2. **Distinguish** which cardinal arithmetic results hold in ZF and which require AC.
3. **State** and explain the absorption law: $\kappa \otimes \kappa = \kappa$ for infinite cardinals (requires AC).
4. **Define** infinite cardinals (`InfCard`) and the cardinal successor `csucc`.
5. **State** the jump cardinal construction and explain why it works without AC.
6. **State** Konig's theorem and explain its significance.
7. **Navigate** `CardinalArith.thy` and `Cardinal_AC.thy` in the Isabelle/ZF distribution.

---

## 2. Motivation and Context

### 2.1 Why Cardinal Arithmetic?

Cardinal arithmetic studies how cardinalities combine under standard set-theoretic operations: disjoint union (addition), Cartesian product (multiplication), and exponentiation. The results are often surprising:

- For finite cardinals, cardinal arithmetic coincides with ordinary arithmetic.
- For infinite cardinals (assuming AC), addition and multiplication are trivial: $\kappa + \lambda = \kappa \cdot \lambda = \max(\kappa, \lambda)$ when at least one is infinite.
- Cardinal exponentiation, however, is highly non-trivial: the value of $2^{\aleph_0}$ (the cardinality of the continuum) is independent of ZFC.

### 2.2 ZF vs ZFC

Many cardinal arithmetic results require AC. Isabelle/ZF separates these cleanly:

- `CardinalArith.thy`: results provable in ZF (without AC).
- `Cardinal_AC.thy`: results requiring AC.

This separation is valuable both pedagogically and foundationally: it tells us exactly where AC is needed.

---

## 3. Core Theory

### 3.1 Cardinal Addition

**Definition 5.9 (Cardinal Addition).**

$$\kappa \oplus \lambda = |\kappa + \lambda|$$

where $\kappa + \lambda$ denotes the disjoint union:

$$\kappa + \lambda = (\{0\} \times \kappa) \cup (\{1\} \times \lambda)$$

```isabelle
definition cadd :: "[i, i] => i"  (infixl "\<oplus>" 65) where
  "K \<oplus> L \<equiv> |K + L|"
```

Here `K + L` is the disjoint sum, defined as:

```isabelle
definition sum :: "[i, i] => i"  (infixr "+" 65) where
  "A + B \<equiv> ({0} \<times> A) \<union> ({1} \<times> B)"
```

### 3.2 Cardinal Multiplication

**Definition 5.10 (Cardinal Multiplication).**

$$\kappa \otimes \lambda = |\kappa \times \lambda|$$

```isabelle
definition cmult :: "[i, i] => i"  (infixl "\<otimes>" 70) where
  "K \<otimes> L \<equiv> |K \<times> L|"
```

### 3.3 Properties Without AC

The following properties hold in ZF, without AC:

```isabelle
(* Commutativity *)
lemma cadd_commute: "K \<oplus> L = L \<oplus> K"
lemma cmult_commute: "K \<otimes> L = L \<otimes> K"

(* Associativity *)
lemma cadd_assoc: "K \<oplus> (L \<oplus> M) = (K \<oplus> L) \<oplus> M"
lemma cmult_assoc: "K \<otimes> (L \<otimes> M) = (K \<otimes> L) \<otimes> M"

(* Distributivity *)
lemma cmult_cadd_distrib: "K \<otimes> (L \<oplus> M) = (K \<otimes> L) \<oplus> (K \<otimes> M)"

(* Identity elements *)
lemma cadd_0: "Card(K) \<Longrightarrow> K \<oplus> 0 = K"
lemma cmult_0: "K \<otimes> 0 = 0"
lemma cmult_1: "Card(K) \<Longrightarrow> K \<otimes> 1 = K"
```

*Proof of commutativity of cadd.* We need $|A + B| = |B + A|$. The bijection $f : A + B \to B + A$ defined by $f(\langle 0, a \rangle) = \langle 1, a \rangle$ and $f(\langle 1, b \rangle) = \langle 0, b \rangle$ works. $\blacksquare$

### 3.4 Finite Cardinal Arithmetic

For natural numbers, cardinal arithmetic coincides with ordinary arithmetic:

```isabelle
lemma nat_cadd: "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk> \<Longrightarrow> m \<oplus> n = m #+ n"
lemma nat_cmult: "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk> \<Longrightarrow> m \<otimes> n = m #* n"
```

---

## 4. Infinite Cardinals

### 4.1 Definition

**Definition 5.11 (Infinite Cardinal).**

$$\mathrm{InfCard}(\kappa) \iff \mathrm{Card}(\kappa) \land \mathrm{nat} \le \kappa$$

```isabelle
definition InfCard :: "i => o" where
  "InfCard(K) \<equiv> Card(K) \<and> nat \<le> K"
```

The first infinite cardinal is $\aleph_0 = \omega$ = `nat`.

### 4.2 The Absorption Law (Requires AC)

**Theorem 5.8 (Absorption).** For any infinite cardinal $\kappa$:

$$\kappa \otimes \kappa = \kappa$$

```isabelle
lemma InfCard_cmult_eq:
  "InfCard(K) \<Longrightarrow> K \<otimes> K = K"
```

This is one of the most important results in cardinal arithmetic. Its proof requires AC (specifically, the well-ordering theorem) and proceeds by transfinite induction on $\kappa$.

*Proof sketch.* Well-order $\kappa \times \kappa$ lexicographically. Show that for each $\alpha < \kappa$, the set $\alpha \times \alpha$ has cardinality $|\alpha|$, which is $< \kappa$ (since $\kappa$ is a cardinal). The union $\kappa \times \kappa = \bigcup_{\alpha < \kappa} \alpha \times \alpha$ then has cardinality $\kappa$. $\blacksquare$

**Corollary 5.1.** For infinite cardinals $\kappa$ and $\lambda$:

$$\kappa \oplus \lambda = \kappa \otimes \lambda = \max(\kappa, \lambda)$$

```isabelle
lemma InfCard_cadd_eq:
  "\<lbrakk> InfCard(K); InfCard(L); K \<le> L \<rbrakk> \<Longrightarrow> K \<oplus> L = L"

lemma InfCard_cmult_eq':
  "\<lbrakk> InfCard(K); InfCard(L); K \<le> L \<rbrakk> \<Longrightarrow> K \<otimes> L = L"
```

This means that for infinite cardinals, addition and multiplication are "absorbed" by the larger operand. Infinite cardinal arithmetic is thus trivial --- except for exponentiation.

### 4.3 Cardinal Exponentiation (Brief)

**Definition 5.12 (Cardinal Exponentiation).**

$$\kappa^\lambda = |\lambda \to \kappa| = |\Pi(\lambda, \lambda\_.\, \kappa)|$$

That is, $\kappa^\lambda$ is the cardinality of the set of all functions from $\lambda$ to $\kappa$. Note the order: the *exponent* $\lambda$ is the domain, and the *base* $\kappa$ is the codomain.

Cardinal exponentiation is *not* trivial even for infinite cardinals:

- $2^{\aleph_0} = |\mathcal{P}(\omega)| = \mathfrak{c}$ (the cardinality of the continuum).
- Whether $\mathfrak{c} = \aleph_1$ is the Continuum Hypothesis (CH), which is independent of ZFC.

---

## 5. The Cardinal Successor

### 5.1 Definition

**Definition 5.13 (Cardinal Successor).**

$$\mathrm{csucc}(\kappa) = \mu \lambda.\, \mathrm{Card}(\lambda) \land \kappa < \lambda$$

The least cardinal strictly greater than $\kappa$.

```isabelle
definition csucc :: "i => i" where
  "csucc(K) \<equiv> \<mu> L. Card(L) \<and> K < L"
```

### 5.2 Existence

**Theorem 5.9.** For every cardinal $\kappa$, the cardinal successor $\mathrm{csucc}(\kappa)$ exists.

*Proof.* By Cantor's theorem, $\mathcal{P}(\kappa)$ has cardinality strictly greater than $\kappa$: $\kappa \prec \mathcal{P}(\kappa)$. The cardinal $|\mathcal{P}(\kappa)|$ is a cardinal greater than $\kappa$, so the least such cardinal exists. $\blacksquare$

```isabelle
lemma Card_csucc [TC]: "Ord(K) \<Longrightarrow> Card(csucc(K))"
lemma lt_csucc: "Ord(K) \<Longrightarrow> K < csucc(K)"
lemma csucc_le: "\<lbrakk> Card(L); K < L \<rbrakk> \<Longrightarrow> csucc(K) \<le> L"
```

### 5.3 The Aleph Hierarchy

Using `csucc`, we can define the aleph numbers:

$$\aleph_0 = \omega, \quad \aleph_{\alpha+1} = \mathrm{csucc}(\aleph_\alpha), \quad \aleph_\lambda = \sup_{\alpha < \lambda} \aleph_\alpha$$

```isabelle
definition Aleph :: "i => i" where
  "Aleph(a) \<equiv> transrec(a, \<lambda>x f.
    if x = 0 then nat
    else if (\<exists>y. x = succ(y)) then csucc(f ` pred(x))
    else \<Union>(RepFun(x, \<lambda>y. f ` y)))"
```

---

## 6. The Jump Cardinal

### 6.1 Motivation

Without AC, we cannot guarantee that every set can be well-ordered, so the cardinal $|A|$ might not be defined. However, we can still construct a cardinal *strictly greater than* $|A|$ without AC.

### 6.2 Definition

**Definition 5.14 (Jump Cardinal).**

The jump cardinal of $K$ is a cardinal $\lambda$ such that $K \prec \lambda$. It is constructed using Hartogs' theorem.

**Theorem 5.10 (Hartogs).** For every set $A$, there exists an ordinal $\alpha$ such that $\alpha \not\lesssim A$.

```isabelle
definition jump_cardinal :: "i => i" where
  "jump_cardinal(K) \<equiv> \<mu> i. Ord(i) \<and> \<not>(i \<lesssim> K)"
```

This exists because we can form the set of all ordinals that inject into $K$ (using Replacement), and this set is itself an ordinal --- the least ordinal that does not inject into $K$.

---

## 7. Konig's Theorem

### 7.1 Statement

**Theorem 5.11 (Konig).** Let $\{A_i\}_{i \in I}$ and $\{B_i\}_{i \in I}$ be indexed families of sets with $|A_i| < |B_i|$ for all $i \in I$. Then:

$$\left|\sum_{i \in I} A_i\right| < \left|\prod_{i \in I} B_i\right|$$

where $\sum$ denotes disjoint union and $\prod$ denotes Cartesian product.

### 7.2 Significance

Konig's theorem has important consequences:

- **Cofinality bounds**: $\mathrm{cf}(\kappa) > \omega$ implies $\kappa^{\aleph_0} > \kappa$ (one cannot express $\kappa$ as a countable union of smaller sets).
- **The continuum**: $2^{\aleph_0} \neq \aleph_\omega$ (the continuum cannot have countable cofinality).

---

## 8. CardinalArith.thy vs Cardinal_AC.thy

### 8.1 Results in CardinalArith.thy (ZF, no AC)

| Result | Theorem |
|--------|---------|
| Commutativity of $\oplus$, $\otimes$ | `cadd_commute`, `cmult_commute` |
| Associativity of $\oplus$, $\otimes$ | `cadd_assoc`, `cmult_assoc` |
| Distributivity | `cmult_cadd_distrib` |
| $\kappa \oplus 0 = \kappa$ | `cadd_0` |
| $\kappa \otimes 0 = 0$ | `cmult_0` |
| $\kappa \otimes 1 = \kappa$ | `cmult_1` |
| Cantor's theorem | `Cantor` |
| Jump cardinal exists | `jump_cardinal` |
| Finite cardinal arithmetic = nat arithmetic | `nat_cadd`, `nat_cmult` |

### 8.2 Results in Cardinal_AC.thy (ZFC)

| Result | Theorem |
|--------|---------|
| Absorption: $\kappa \otimes \kappa = \kappa$ | `InfCard_cmult_eq` |
| $\kappa \oplus \lambda = \max(\kappa, \lambda)$ | `InfCard_cadd_eq` |
| Cardinal comparability | `cardinal_linear` |
| Every set has a cardinal | `cardinal_eqpoll` |
| $\omega \times \omega \approx \omega$ | via absorption |

---

## 9. Connections and Extensions

### 9.1 Links to Prior Modules

- **Lecture 05a**: Cardinal numbers and equipollence.
- **Lecture 05b**: Schroeder-Bernstein is used in proving absorption.
- **Lecture 05c**: AC is required for the absorption law.

### 9.2 Links to Future Modules

- **Module 06**: The Continuum Hypothesis ($2^{\aleph_0} = \aleph_1$) is independent of ZFC. This is proved using the constructible universe (AC + GCH) and forcing (negation of CH).

---

## 10. Seminal Paper Reading List

### Required

1. **Paulson, L. C. & Grabczewski, K. (1996).** "Mechanizing Set Theory: Cardinal Arithmetic and the Axiom of Choice." *Journal of Automated Reasoning*, 17(3), 291--323.
   - *The main reference for cardinal arithmetic in Isabelle/ZF.*

### Recommended

2. **Sierpinski, W. (1958).** *Cardinal and Ordinal Numbers.* Polish Scientific Publishers.
   - *Classical treatment of cardinal arithmetic.*

3. **Konig, J. (1905).** "Zum Kontinuumproblem." *Mathematische Annalen*, 60, 177--180.
   - *The original statement of Konig's theorem.*

---

## 11. Exercises

### Theory

**Exercise 5d.1.** Prove on paper that cardinal addition is commutative: $|A + B| = |B + A|$. Construct the bijection explicitly.

**Exercise 5d.2.** Prove that cardinal multiplication distributes over cardinal addition: $\kappa \otimes (\lambda \oplus \mu) = (\kappa \otimes \lambda) \oplus (\kappa \otimes \mu)$. Use the bijection $(A \times B) \cup (A \times C) \cong A \times (B \cup C)$ for disjoint $B$ and $C$.

**Exercise 5d.3.** Prove the absorption law for $\omega$: $\omega \cdot \omega = \omega$ (i.e., $|\mathrm{nat} \times \mathrm{nat}| = |\mathrm{nat}|$). Construct a bijection using the Cantor pairing function.

**Exercise 5d.4.** Explain why $2^{\aleph_0} \neq \aleph_\omega$ using Konig's theorem.

### Isabelle

**Exercise 5d.5.** Prove in Isabelle/ZF:
```isabelle
lemma "K \<oplus> L = L \<oplus> K"
lemma "K \<otimes> L = L \<otimes> K"
lemma "K \<otimes> 0 = 0"
```

**Exercise 5d.6.** Prove that `csucc(nat)` exists and is a cardinal strictly greater than `nat`:
```isabelle
lemma "Card(csucc(nat))"
lemma "nat < csucc(nat)"
```

**Exercise 5d.7.** Prove (using AC) that $\mathrm{nat} \oplus \mathrm{nat} = \mathrm{nat}$.

**Exercise 5d.8.** Prove that for finite $n$: $n \oplus n = n \otimes \mathrm{succ}(\mathrm{succ}(0))$. (Cardinal doubling equals multiplication by 2.)
