# Lecture 05c: The Axiom of Choice & Zorn's Lemma

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **State** the Axiom of Choice in the Halmos formulation used by Isabelle/ZF.
2. **State** Zorn's Lemma, the Well-Ordering Theorem, and explain their equivalence to AC.
3. **Navigate** the theory dependency graph: ZF (without AC) vs ZFC (with AC).
4. **Describe** the AC/ session in Isabelle/ZF: the Grabczewski formalization of AC equivalences (WO1--WO8, AC0--AC19).
5. **State** Dependent Choice (DC) and explain its role as a weaker form of AC.
6. **Apply** AC and Zorn's Lemma to prove existence results.

---

## 2. Motivation and Context

### 2.1 Why the Axiom of Choice?

The Axiom of Choice (AC) asserts that given any family of non-empty sets, one can simultaneously choose an element from each set. This seems obvious for finite families, but for infinite families it is a genuine axiom --- it cannot be proved from the other ZF axioms.

AC is indispensable for many theorems of modern mathematics:

- Every vector space has a basis.
- Every surjection has a right inverse.
- The product of non-empty sets is non-empty.
- Every set can be well-ordered.
- Tychonoff's theorem in topology.
- The Hahn-Banach theorem in functional analysis.

Isabelle/ZF carefully tracks which results require AC. The theories in `ZF/` work without AC; those in `ZF/AC/` explore AC equivalences; and results in `Cardinal_AC.thy`, `Zorn.thy`, etc., assume AC.

### 2.2 The Independence of AC

Godel (1938) showed that AC is consistent with ZF (if ZF is consistent), by constructing the constructible universe $L$ in which AC holds. Cohen (1963) showed that AC is independent of ZF, by the method of forcing. Module 06 covers both results.

---

## 3. Core Theory

### 3.1 The Axiom of Choice (Halmos Formulation)

In Isabelle/ZF, AC is stated in the following form:

**Axiom of Choice.** For every set $A$ and every function $B : A \to \mathcal{P}(V) \setminus \{\emptyset\}$ (i.e., $B(x) \neq \emptyset$ for all $x \in A$), there exists a choice function $f \in \Pi(A, B)$:

```isabelle
axiomatization where
  AC: "\<forall>x\<in>A. (\<exists>y. y \<in> B(x))
       \<Longrightarrow> \<exists>f. f \<in> Pi(A, B)"
```

This says: if $B(x)$ is non-empty for every $x \in A$, then there exists a function $f$ with $f(x) \in B(x)$ for all $x \in A$.

**Remark.** The Halmos formulation uses dependent function spaces, which naturally express "choosing one element from each set in a family." This is slightly different from the formulation often seen in textbooks ("every family of non-empty sets has a choice function"), but is equivalent.

### 3.2 The Well-Ordering Theorem

**Theorem 5.6 (Well-Ordering Theorem).** Every set can be well-ordered.

$$\forall A.\, \exists r.\, \mathrm{well\_ord}(A, r)$$

```isabelle
lemma well_ord_exists:
  "\<exists>r. well_ord(A, r)"
```

### 3.3 Zorn's Lemma

**Definition 5.8 (Chain).** A subset $C$ of a partially ordered set $(P, \leq)$ is a *chain* if every two elements of $C$ are comparable:

$$\forall x, y \in C.\, x \leq y \lor y \leq x$$

**Theorem 5.7 (Zorn's Lemma).** Let $(P, \leq)$ be a non-empty partially ordered set in which every chain has an upper bound. Then $P$ has a maximal element.

In Isabelle/ZF (from Zorn.thy):

```isabelle
lemma Zorn:
  assumes "P \<noteq> 0"
  assumes "\<And>C. \<lbrakk> C \<subseteq> P; chain(P, r, C) \<rbrakk>
           \<Longrightarrow> \<exists>u\<in>P. \<forall>x\<in>C. <x, u> \<in> r"
  shows   "\<exists>m\<in>P. \<forall>x\<in>P. <m, x> \<in> r \<longrightarrow> x = m"
```

### 3.4 The Equivalence AC <-> WO <-> Zorn

The three statements are equivalent over ZF:

1. **AC** (Axiom of Choice)
2. **WO** (Well-Ordering Theorem)
3. **Zorn** (Zorn's Lemma)

The proof cycle is:

- **AC => WO**: Given AC, define a well-ordering on $A$ by transfinite recursion: at each stage, use AC to choose an element not yet chosen.
- **WO => Zorn**: Given a partial order with the upper bound property, well-order the poset and find a maximal element by transfinite recursion.
- **Zorn => AC**: Given a family of non-empty sets, consider the poset of partial choice functions ordered by extension. Every chain has an upper bound (the union). By Zorn, there is a maximal partial choice function, which must be total.

In Isabelle/ZF, these equivalences are proved in `Zorn.thy` and the `AC/` session.

---

## 4. The AC/ Session: Grabczewski's Formalization

### 4.1 Overview

Krzysztof Grabczewski formalized a comprehensive network of AC equivalences in Isabelle/ZF in the mid-1990s. The `AC/` session contains:

- **Seven forms of the Well-Ordering Principle**: WO1 through WO8 (some are identical to WO but restricted in various ways).
- **Twenty forms of the Axiom of Choice**: AC0 through AC19.
- **Equivalence proofs**: a web of implications connecting all these forms.

### 4.2 Selected AC Forms

| Name | Statement |
|------|-----------|
| AC0 | Every family of non-empty sets has a choice function |
| AC1 | Every family of non-empty sets admits a system of representatives |
| AC2 | The product of a family of non-empty sets is non-empty |
| AC3 | Every surjection has a right inverse |
| AC4 | Every relation contains a function with the same domain |
| AC5 | Every epimorphism in **Set** splits |
| AC10 | Every infinite set is Dedekind-infinite |
| AC15 | Every partial order can be extended to a total order |
| AC18 | Tukey's Lemma: every family of finite character has a maximal element |
| AC19 | Hausdorff Maximal Principle: every chain in a poset extends to a maximal chain |

### 4.3 The Theory Graph

The AC equivalences form a complex directed graph of implications. Here is a simplified version:

```
WO1 <--> AC0 <--> AC1 <--> AC2 <--> Zorn <--> AC18 <--> AC19
  |                                    |
  v                                    v
WO2 <--> WO3                        AC15
  |
  v
WO6 --> AC10
```

Each arrow represents an implication proved in Isabelle/ZF. The mutual implications establish equivalence.

### 4.4 Theory Imports: ZF vs ZFC

In Isabelle/ZF, theories can import either `ZF` or `ZFC`:

```isabelle
(* Theories that do NOT use AC *)
theory MyTheory imports ZF begin ... end

(* Theories that USE AC *)
theory MyTheory imports ZFC begin ... end
```

The `ZFC` theory simply extends `ZF` by adding the AC axiom:

```isabelle
theory ZFC imports ZF begin
  axiomatization where AC: ...
end
```

This separation allows you to see exactly which results depend on AC and which do not.

---

## 5. Dependent Choice

### 5.1 Statement

**Axiom of Dependent Choice (DC).** Let $r$ be a relation on $A$ such that for every $x \in A$, there exists $y \in A$ with $\langle x, y \rangle \in r$. Then for every $a \in A$, there exists a function $f : \omega \to A$ with $f(0) = a$ and $\langle f(n), f(n+1) \rangle \in r$ for all $n$.

```isabelle
lemma DC:
  assumes "\<forall>x\<in>A. \<exists>y\<in>A. <x, y> \<in> r"
  assumes "a \<in> A"
  shows "\<exists>f \<in> nat \<rightarrow> A. f ` 0 = a \<and>
         (\<forall>n\<in>nat. <f ` n, f ` succ(n)> \<in> r)"
```

### 5.2 DC vs AC

Dependent Choice is strictly weaker than AC:

- **DC follows from AC**: Given AC, choose the next element at each step.
- **DC does not imply AC**: There are models of ZF + DC where AC fails.

DC is strong enough for most of analysis and measure theory. It is used in the proof that "no infinite descending chain" is equivalent to well-foundedness.

In Isabelle/ZF, DC is proved from AC in `DC.thy`.

---

## 6. Applications of AC and Zorn

### 6.1 Every Vector Space Has a Basis (Sketch)

Let $V$ be a vector space over a field $F$. Consider the set $\mathcal{I}$ of linearly independent subsets of $V$, ordered by inclusion. Every chain in $\mathcal{I}$ has an upper bound (the union). By Zorn's Lemma, $\mathcal{I}$ has a maximal element, which is a basis.

### 6.2 Every Surjection Has a Right Inverse

If $f : A \twoheadrightarrow B$ is surjective, then for each $b \in B$, the preimage $f^{-1}[\{b\}]$ is non-empty. By AC, there exists a function $g : B \to A$ with $g(b) \in f^{-1}[\{b\}]$ for all $b$. Then $f \circ g = \mathrm{id}_B$.

### 6.3 Cardinal Comparability

With AC (specifically WO), any two sets can be compared:

```isabelle
lemma cardinal_linear:
  "|A| \<le> |B| \<or> |B| \<le> |A|"
```

This fails without AC.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Lecture 04c**: Well-founded recursion is used in the proof of WO from AC.
- **Lecture 04d**: Ordinals provide the "measuring stick" for well-orderings.
- **Lecture 05a**: Cardinal numbers require AC (well-ordering) to be defined for arbitrary sets.

### 7.2 Links to Future Modules

- **Lecture 05d**: Cardinal arithmetic uses AC for the absorption law $\kappa \cdot \kappa = \kappa$.
- **Module 06**: AC holds in the constructible universe $L$ (Godel). AC is independent of ZF (Cohen).

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. & Grabczewski, K. (1996).** "Mechanizing Set Theory: Cardinal Arithmetic and the Axiom of Choice." *Journal of Automated Reasoning*, 17(3), 291--323.
   - *Section 5: the AC equivalences formalization.*

### Recommended

2. **Jech, T. (1973).** *The Axiom of Choice.* North-Holland.
   - *The standard reference on AC and its equivalences.*

3. **Rubin, H. & Rubin, J. E. (1963).** *Equivalents of the Axiom of Choice.* North-Holland.
   - *An exhaustive catalog of AC equivalences.*

4. **Zorn, M. (1935).** "A Remark on Method in Transfinite Algebra." *Bulletin of the AMS*, 41, 667--670.
   - *The original statement of Zorn's Lemma.*

---

## 9. Exercises

### Theory

**Exercise 5c.1.** Prove on paper that AC implies the Well-Ordering Theorem. (Sketch: define a well-ordering on $A$ by transfinite recursion, using AC to choose the next element at each stage.)

**Exercise 5c.2.** Prove that Zorn's Lemma implies AC. (Hint: consider the poset of partial choice functions.)

**Exercise 5c.3.** Show that AC implies every surjection has a right inverse. Then show the converse: if every surjection has a right inverse, then AC holds.

**Exercise 5c.4.** Explain why DC is sufficient to prove that well-foundedness is equivalent to "no infinite descending chain."

### Isabelle

**Exercise 5c.5.** Verify in Isabelle/ZF that the import `ZFC` is needed for the following (try importing only `ZF` and see what fails):
```isabelle
lemma "well_ord(A, r)" for some r
lemma "|A| \<le> |B| \<or> |B| \<le> |A|"
```

**Exercise 5c.6.** Using Zorn's Lemma (from `Zorn.thy`), prove that every partial order on a finite set can be extended to a total order.

**Exercise 5c.7.** Explore the `AC/` session: list all the AC forms and draw the implication graph. Identify which implications are trivial and which require substantial proof.

**Exercise 5c.8.** Prove that AC implies: if $A$ is infinite (not finite), then $\mathrm{nat} \lesssim A$. (This is AC10 in Grabczewski's numbering.)
