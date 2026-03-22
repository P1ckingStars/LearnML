# Lecture 06d: Forcing and the Independence of CH

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **State** the Continuum Hypothesis and explain why it is independent of ZFC.
2. **Describe** the method of forcing at a high level: partial orders, generic filters, names, and the generic extension $M[G]$.
3. **Explain** the forcing relation and its key properties (definability, truth lemma).
4. **Navigate** the AFP entries for forcing and the independence of CH.
5. **Discuss** what "independence" means formally and what remains beyond current formalizations.

---

## 2. The Continuum Hypothesis

### 2.1 Statement

**The Continuum Hypothesis (CH).** There is no set whose cardinality is strictly between that of the natural numbers and that of the real numbers. Equivalently:

$$|\mathcal{P}(\omega)| = \aleph_1$$

or in the aleph notation:

$$2^{\aleph_0} = \aleph_1$$

**The Generalized Continuum Hypothesis (GCH).** For every infinite cardinal $\kappa$:

$$2^\kappa = \kappa^+$$

### 2.2 The Independence Result

**Theorem 2.1 (Godel 1940 + Cohen 1963).** CH is independent of ZFC. That is:

1. $\mathrm{Con}(\mathrm{ZFC}) \implies \mathrm{Con}(\mathrm{ZFC} + \mathrm{CH})$ (Godel, via $L$; see Lecture 06c).
2. $\mathrm{Con}(\mathrm{ZFC}) \implies \mathrm{Con}(\mathrm{ZFC} + \neg\mathrm{CH})$ (Cohen, via forcing).

This means CH can neither be proved nor refuted from the standard axioms of set theory. It is genuinely undecidable.

---

## 3. Forcing: The Big Picture

### 3.1 The Goal

Given a countable transitive model (ctm) $M$ of ZFC in which CH holds, we want to construct a *larger* model $M[G] \supseteq M$ in which CH fails. The method of forcing, invented by Paul Cohen in 1963, provides a systematic way to do this.

### 3.2 Why Inner Models Are Insufficient

Godel's $L$ is an *inner model*: $L \subseteq V$. Inner models can only *remove* sets (by restricting to a subclass). To make CH fail, we need to *add* new subsets of $\omega$ --- specifically, we need $|\mathcal{P}(\omega)^{M[G]}| > \aleph_1^M$. This requires going *outside* $M$, which is what forcing accomplishes.

### 3.3 Countable Transitive Models

**Definition 3.1 (Countable transitive model).** A ctm is a countable transitive set $M$ such that $(M, \in) \models \mathrm{ZFC}$.

By the Lowenheim-Skolem theorem, if ZFC has a model, it has a countable model. By the Mostowski collapse, we can assume it is transitive. Working with ctms is technically convenient because:

1. $M$ is a set, so $M[G]$ is also a set.
2. Being countable, every dense set in $M$ is met by a sufficiently generic filter.

**Remark.** The assumption "ZFC has a ctm" is slightly stronger than Con(ZFC). In practice, independence proofs are formulated using ctms for convenience, and the results can be recast to use only Con(ZFC) via syntactic methods (Boolean-valued models or the forcing relation as a syntactic transformation).

---

## 4. Forcing: The Machinery

### 4.1 Partial Orders and Dense Sets

**Definition 4.1 (Forcing poset).** A *forcing poset* (or *forcing notion*) is a partially ordered set $(\mathbb{P}, \le)$ with a greatest element $\mathbf{1}$. Elements of $\mathbb{P}$ are called *conditions*. If $p \le q$, we say $p$ *extends* $q$ (or $p$ is *stronger* than $q$).

**Definition 4.2 (Compatibility).** Two conditions $p, q \in \mathbb{P}$ are *compatible* if there exists $r \in \mathbb{P}$ with $r \le p$ and $r \le q$. Otherwise they are *incompatible*, written $p \perp q$.

**Definition 4.3 (Dense set).** A set $D \subseteq \mathbb{P}$ is *dense* if for every $p \in \mathbb{P}$, there exists $q \in D$ with $q \le p$.

**Definition 4.4 (Filter).** A set $G \subseteq \mathbb{P}$ is a *filter* if:
1. $G$ is upward closed: $p \in G$ and $p \le q$ implies $q \in G$.
2. $G$ is directed: $p, q \in G$ implies there exists $r \in G$ with $r \le p$ and $r \le q$.
3. $\mathbf{1} \in G$.

**Definition 4.5 ($M$-generic filter).** A filter $G \subseteq \mathbb{P}$ is *$M$-generic* if $G \cap D \ne \emptyset$ for every dense set $D \in M$.

### 4.2 Existence of Generic Filters

**Theorem 4.6 (Rasiowa-Sikorski).** If $M$ is countable and $\mathbb{P} \in M$, then for any $p \in \mathbb{P}$, there exists an $M$-generic filter $G$ containing $p$.

*Proof.* Since $M$ is countable, enumerate the dense sets $D_0, D_1, D_2, \ldots$ that belong to $M$. Build a descending chain: start with $p_0 = p$, and given $p_n$, find $p_{n+1} \le p_n$ with $p_{n+1} \in D_n$ (possible because $D_n$ is dense). Let $G = \{q \in \mathbb{P} \mid \exists n.\, p_n \le q\}$. Then $G$ is a filter meeting every $D_n$. $\blacksquare$

**Key point.** The generic filter $G$ is not in $M$ (in the non-trivial case). It is a "new" object that we adjoin to $M$.

### 4.3 Names and the Generic Extension

**Definition 4.7 ($\mathbb{P}$-names).** The class of $\mathbb{P}$-names is defined by recursion:

$$\mathrm{Val}^{\mathbb{P}} = \{ \tau \mid \tau \text{ is a set of pairs } \langle \sigma, p \rangle \text{ where } \sigma \in \mathrm{Val}^{\mathbb{P}} \text{ and } p \in \mathbb{P} \}$$

A name $\tau$ is a "recipe" for constructing a set in $M[G]$: it lists potential elements (themselves names) paired with conditions that must be in $G$ for the element to be included.

**Definition 4.8 (Interpretation of a name).** Given a generic filter $G$, the *interpretation* (or *value*) of a name $\tau$ is:

$$\tau^G = \{ \sigma^G \mid \exists p \in G.\, \langle \sigma, p \rangle \in \tau \}$$

**Definition 4.9 (Generic extension).** The generic extension is:

$$M[G] = \{ \tau^G \mid \tau \in M \text{ is a } \mathbb{P}\text{-name} \}$$

### 4.4 The Fundamental Theorem of Forcing

**Theorem 4.10 (Cohen).** If $M$ is a ctm of ZFC, $\mathbb{P} \in M$ is a forcing poset, and $G$ is $M$-generic, then:

1. $M[G]$ is a ctm of ZFC.
2. $M \subseteq M[G]$.
3. $G \in M[G]$.
4. $M[G]$ has the same ordinals as $M$: $\mathrm{Ord}^{M[G]} = \mathrm{Ord}^M$.
5. $M[G]$ is the smallest ctm containing $M$ and $G$.

---

## 5. The Forcing Relation

### 5.1 Definition

The *forcing relation* $p \Vdash \varphi$ ("$p$ forces $\varphi$") is defined for conditions $p \in \mathbb{P}$ and formulas $\varphi$ in the forcing language (with names as terms). It is defined in $M$ (without reference to $G$) and has the following key property:

**Theorem 5.1 (Truth Lemma).** For any sentence $\varphi$ with parameters from $M^{\mathbb{P}}$ (the class of $\mathbb{P}$-names in $M$):

$$M[G] \models \varphi \iff \exists p \in G.\, p \Vdash \varphi$$

### 5.2 Definability

**Theorem 5.2 (Definability of Forcing).** The forcing relation $p \Vdash \varphi$ is definable in $M$. That is, for each formula $\varphi$, there is a formula $\psi(p)$ in the language of set theory such that:

$$p \Vdash \varphi \iff M \models \psi(p)$$

This is crucial: it means we can reason about what $M[G]$ satisfies without ever constructing $G$.

### 5.3 Forcing for Atomic Formulas

For atomic formulas, the forcing relation is defined by a joint recursion on the ranks of the names. The key clauses (following Kunen, Chapter VII) are:

$$p \Vdash \tau_1 \in \tau_2 \iff \forall q \le p,\, \exists r \le q,\, \exists \langle \sigma, s \rangle \in \tau_2.\, r \le s \,\wedge\, r \Vdash \tau_1 = \sigma$$

$$p \Vdash \tau_1 = \tau_2 \iff (\forall \langle \sigma, s \rangle \in \tau_1.\, \forall q \le p, s.\, q \Vdash \sigma \in \tau_2)$$
$$\quad\quad\quad \wedge\, (\forall \langle \sigma, s \rangle \in \tau_2.\, \forall q \le p, s.\, q \Vdash \sigma \in \tau_1)$$

The $\tau_1 = \tau_2$ clause says: every name in $\tau_1$ is forced to be a member of $\tau_2$ (by all extensions that are also below its condition), and vice versa. The mutual recursion terminates because the names $\sigma$ appearing in $\tau_1$ or $\tau_2$ have strictly smaller rank.

---

## 6. Cohen Forcing: Making CH Fail

### 6.1 The Forcing Poset

To make CH fail, Cohen uses the poset of *finite partial functions* from $\omega_2 \times \omega$ to $\{0, 1\}$:

$$\mathbb{P} = \mathrm{Fn}(\omega_2 \times \omega, 2) = \{ p : A \to \{0, 1\} \mid A \subseteq \omega_2 \times \omega, |A| < \aleph_0 \}$$

ordered by reverse inclusion: $p \le q$ iff $p \supseteq q$ (stronger conditions have larger domains).

Each condition $p$ specifies finitely many bits of a two-dimensional array indexed by $(\alpha, n)$ for $\alpha < \omega_2$ and $n < \omega$.

### 6.2 Generic Reals

For each ordinal $\alpha < \omega_2^M$, define the *generic real* $r_\alpha : \omega \to \{0, 1\}$ by:

$$r_\alpha(n) = \begin{cases} p(\alpha, n) & \text{if } (\alpha, n) \in \mathrm{dom}(p) \text{ for some } p \in G \\ 0 & \text{otherwise} \end{cases}$$

Since $G$ is a filter (directed), the values are consistent, and since $G$ meets all dense sets, $r_\alpha$ is total.

### 6.3 The Key Arguments

**Distinct reals.** For $\alpha \ne \beta$, the reals $r_\alpha$ and $r_\beta$ are distinct. The dense set $D_{\alpha, \beta} = \{p \in \mathbb{P} \mid \exists n.\, p(\alpha, n) \ne p(\beta, n)\}$ is met by $G$, so $r_\alpha$ and $r_\beta$ differ on some $n$.

**No new countable ordinals.** Cohen forcing is *countable chain condition (ccc)*: every antichain in $\mathbb{P}$ is countable. The ccc ensures that $\omega_1$ and $\omega_2$ are preserved: $\omega_1^{M[G]} = \omega_1^M$ and $\omega_2^{M[G]} = \omega_2^M$.

**Conclusion.** In $M[G]$, there are at least $\omega_2^M = \omega_2^{M[G]}$ many distinct reals (subsets of $\omega$). Therefore:

$$|\mathcal{P}(\omega)^{M[G]}| \ge \aleph_2^{M[G]} > \aleph_1^{M[G]}$$

which means CH fails in $M[G]$.

---

## 7. The Formalization in Isabelle

### 7.1 The AFP Entry: Forcing

The AFP entry *Forcing* by Gunther, Pagano, Sanchez Terraf, and Steinberg formalizes the core forcing machinery in Isabelle/ZF. It builds on Paulson's `Constructible` library.

**Theory structure:**

| Theory | Content |
|---|---|
| `Forcing_Data.thy` | Forcing posets, dense sets, compatibility |
| `Names.thy` | $\mathbb{P}$-names and interpretation |
| `Forcing_Theorems.thy` | The truth lemma and definability |
| `Generic_Extension.thy` | $M[G]$ satisfies ZFC |

Key design decisions:

1. **Remodularization.** The authors restructured Paulson's `Constructible` library to provide cleaner interfaces for the relativized concepts, separating the concerns of internalized formulas from the forcing machinery.

2. **Locales.** The forcing development uses Isabelle locales extensively:

```isabelle
locale forcing_data =
  fixes M :: "i => o" and P :: i and leq :: i and one :: i
  assumes M_model: "M_ZFC(M)"
      and P_in_M: "M(P)"
      and leq_in_M: "M(leq)"
      and one_in_M: "M(one)"
      and one_max: "\<forall>p \<in> P. \<langle>p, one\<rangle> \<in> leq"
```

3. **Internalized forcing.** The forcing relation is defined both semantically (using the metatheory) and syntactically (using internalized formulas), and the two are proved equivalent.

### 7.2 The AFP Entry: Independence_CH

A separate AFP entry, *Independence_CH* by the same authors, completes the independence proof:

```isabelle
theorem independence_of_CH:
  assumes "M_ctm(M)" and "M \<Turnstile> ZFC"
  shows "\<exists>N. M \<subseteq> N \<and> N \<Turnstile> ZFC \<and> N \<Turnstile> \<not>CH"
```

This entry constructs the specific Cohen forcing poset, builds the generic extension, and verifies that CH fails in the extension.

---

## 8. What Does "Independence" Mean Formally?

### 8.1 Syntactic vs. Semantic Independence

**Syntactic independence.** A sentence $\sigma$ is independent of a theory $T$ if $T \nvdash \sigma$ and $T \nvdash \neg\sigma$. By the completeness theorem (for first-order logic), this is equivalent to:

**Semantic independence.** There exist models $M_1 \models T + \sigma$ and $M_2 \models T + \neg\sigma$.

### 8.2 What the Formalization Proves

The formalization establishes the *relative consistency* statements:

$$\mathrm{Con}(\mathrm{ZFC}) \implies \mathrm{Con}(\mathrm{ZFC} + \mathrm{CH})$$
$$\mathrm{Con}(\mathrm{ZFC}) \implies \mathrm{Con}(\mathrm{ZFC} + \neg\mathrm{CH})$$

Together, these imply that CH is independent of ZFC (assuming ZFC is consistent).

### 8.3 The Formalization Gap

Several aspects of the full independence result are not (yet) fully formalized:

1. **The metatheory.** The proofs assume a metatheory strong enough to reason about ctms. The exact metatheoretic assumptions are carefully tracked but not reduced to, say, Peano arithmetic.

2. **Boolean-valued models.** An alternative approach via Boolean-valued models avoids ctms entirely but has not been fully formalized in Isabelle.

3. **Generic absoluteness.** Some absoluteness results for the generic extension require additional technical machinery beyond what is in the current AFP entries.

---

## 9. Historical and Philosophical Context

### 9.1 Cohen's Achievement

Paul Cohen received the Fields Medal in 1966 for his invention of forcing. The method has since become the primary tool for establishing independence results in set theory. Hundreds of independence results have been proved using forcing, including:

- Independence of the Suslin Hypothesis.
- Independence of Martin's Axiom (relative to ZFC + $\neg$CH).
- Consistency of various large cardinal hypotheses.

### 9.2 The Multiverse View

The independence of CH has led to philosophical debate about the nature of mathematical truth in set theory. Two major positions:

1. **Universism.** There is a single intended model $V$ of set theory, and CH has a definite truth value that we have not yet determined. Woodin's $\Omega$-logic program attempts to resolve CH.

2. **Multiversism (Hamkins).** There are many equally legitimate set-theoretic universes, and CH holds in some and fails in others. Independence is not a deficiency but a feature.

The formalization perspective is neutral: it establishes the mathematical fact of independence without taking a philosophical position.

---

## 10. Key Takeaways

1. Forcing constructs a generic extension $M[G]$ of a ctm $M$ by adjoining an $M$-generic filter $G$ for a forcing poset $\mathbb{P} \in M$.
2. The Fundamental Theorem of Forcing: $M[G]$ is a ctm of ZFC with the same ordinals as $M$.
3. Cohen forcing uses $\mathrm{Fn}(\omega_2 \times \omega, 2)$ to add $\aleph_2$-many new reals, making CH fail.
4. The ccc property ensures cardinal preservation: $\omega_1$ and $\omega_2$ are not collapsed.
5. The AFP entries *Forcing* and *Independence_CH* formalize the complete independence result in Isabelle/ZF.
6. Independence means neither provable nor refutable; the formalization establishes relative consistency in both directions.

---

## 11. Exercises

**Exercise 6d.1.** Verify that $\mathrm{Fn}(\omega_2 \times \omega, 2)$ with reverse inclusion is a partially ordered set. Show that any two compatible conditions have a common extension.

**Exercise 6d.2.** Prove that the set $D_n = \{p \in \mathrm{Fn}(\omega_2 \times \omega, 2) \mid (\alpha, n) \in \mathrm{dom}(p)\}$ is dense for every $\alpha < \omega_2$ and $n < \omega$.

**Exercise 6d.3.** Explain why the ccc property is necessary for the independence proof. What would go wrong if the forcing poset collapsed $\omega_1$?

**Exercise 6d.4.** State the Rasiowa-Sikorski lemma and explain why countability of $M$ is essential.

**Exercise 6d.5.** In the AFP entry `Forcing`, find the locale `forcing_data`. What are its assumptions? How does it relate to `M_trivial` from `Relative.thy`?

---

## References

- Cohen, P.J. (1963). The independence of the continuum hypothesis. *Proceedings of the National Academy of Sciences*, 50(6), 1143--1148.
- Cohen, P.J. (1966). *Set Theory and the Continuum Hypothesis*. W.A. Benjamin.
- Kunen, K. (2011). *Set Theory*. Chapter VII: Forcing.
- Gunther, E., Pagano, M., Sanchez Terraf, P., and Steinberg, M. (2020). Formalization of forcing in Isabelle/ZF. *AFP*.
- Gunther, E., Pagano, M., and Sanchez Terraf, P. (2022). The independence of the continuum hypothesis in Isabelle/ZF. *AFP*.
- Hamkins, J.D. (2012). The set-theoretic multiverse. *Review of Symbolic Logic*, 5(3), 416--449.
