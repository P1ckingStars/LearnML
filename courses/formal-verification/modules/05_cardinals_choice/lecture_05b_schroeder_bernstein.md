# Lecture 05b: The Schroeder-Bernstein Theorem

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **State** the Schroeder-Bernstein theorem: $A \lesssim B \land B \lesssim A \implies A \approx B$.
2. **State** Banach's decomposition theorem and explain how Isabelle/ZF uses it to prove Schroeder-Bernstein.
3. **Walk through** the proof in Cardinal.thy step by step.
4. **Apply** Schroeder-Bernstein to prove equipollence results without constructing explicit bijections.
5. **Discuss** Dedekind-infinite sets and their relationship to Schroeder-Bernstein.

---

## 2. Motivation and Context

### 2.1 Why Schroeder-Bernstein?

The Schroeder-Bernstein theorem (also called the Cantor-Bernstein-Schroeder theorem) is one of the most important results in cardinal arithmetic. It says:

> If there is an injection from $A$ to $B$ and an injection from $B$ to $A$, then there is a bijection between $A$ and $B$.

Equivalently, the preorder $\lesssim$ is antisymmetric, making it a partial order on cardinalities.

The theorem is remarkable for two reasons:

1. **It does not require the Axiom of Choice.** The proof constructs an explicit bijection from the two injections.
2. **The construction is non-trivial.** You cannot simply "paste together" the two injections; a careful decomposition is needed.

### 2.2 Historical Note

The theorem was conjectured by Cantor (1887) and proved independently by Schroeder (1898) and Bernstein (1898, as a student of Cantor). However, Schroeder's proof had a gap, and the first complete proof is usually attributed to Bernstein. Dedekind (1887) also gave a proof, which was not published until later.

---

## 3. Core Theory

### 3.1 Banach's Decomposition Theorem

The key to the Isabelle/ZF proof is Banach's decomposition theorem, which provides a cleaner framework than the original proofs.

**Theorem 5.5 (Banach's Decomposition).** Let $f : A \to B$ and $g : B \to A$ be injections. Then there exist decompositions:

$$A = A_1 \cup A_2, \quad B = B_1 \cup B_2$$

with $A_1 \cap A_2 = \emptyset$ and $B_1 \cap B_2 = \emptyset$, such that:

$$f \restriction A_1 : A_1 \xrightarrow{\sim} B_1 \quad \text{and} \quad g \restriction B_2 : B_2 \xrightarrow{\sim} A_2$$

That is, $f$ maps $A_1$ bijectively onto $B_1$, and $g$ maps $B_2$ bijectively onto $A_2$.

From this decomposition, the bijection $h : A \to B$ is:

$$h(x) = \begin{cases} f(x) & \text{if } x \in A_1 \\ g^{-1}(x) & \text{if } x \in A_2 \end{cases}$$

### 3.2 Constructing the Decomposition

The decomposition is constructed as follows. Define the operator:

$$T(X) = A \setminus g[B \setminus f[X]]$$

for $X \subseteq A$. Then:

1. $T$ is monotone: $X \subseteq Y \implies T(X) \subseteq T(Y)$.
2. By the Knaster-Tarski theorem, $T$ has a least fixed point $A_1 = \mathrm{lfp}(A, T)$.
3. Set $A_2 = A \setminus A_1$, $B_1 = f[A_1]$, $B_2 = B \setminus B_1$.

**Verification that this works:**

Since $A_1 = T(A_1) = A \setminus g[B \setminus f[A_1]] = A \setminus g[B_2]$:

- $A_2 = A \setminus A_1 = g[B_2]$ (since $A_1 = A \setminus g[B_2]$ implies $A \setminus A_1 = A \cap g[B_2] = g[B_2]$ when $g[B_2] \subseteq A$).
- $f \restriction A_1$ maps $A_1$ to $B_1 = f[A_1]$, and is bijective since $f$ is injective.
- $g \restriction B_2$ maps $B_2$ to $A_2 = g[B_2]$, and is bijective since $g$ is injective.

### 3.3 The Isabelle/ZF Proof

In Cardinal.thy, the proof proceeds as follows:

```isabelle
theorem Schroeder_Bernstein:
  assumes "f \<in> inj(A, B)" and "g \<in> inj(B, A)"
  shows   "A \<approx> B"
proof -
  (* Define the monotone operator *)
  let ?T = "\<lambda>X. A - g `` (B - f `` X)"

  (* T is monotone *)
  have mono: "bnd_mono(A, ?T)"
  proof (unfold bnd_mono_def, intro conjI allI impI)
    show "?T(A) \<subseteq> A" by blast
  next
    fix W X assume "W \<subseteq> X" "X \<subseteq> A"
    then show "?T(W) \<subseteq> ?T(X)" by blast
  qed

  (* Take the least fixed point *)
  let ?A1 = "lfp(A, ?T)"
  let ?A2 = "A - ?A1"
  let ?B1 = "f `` ?A1"
  let ?B2 = "B - ?B1"

  (* A1 is a fixed point of T *)
  have fp: "?T(?A1) = ?A1"
    using mono by (rule lfp_unfold)

  (* Construct the bijection *)
  let ?h = "lam x:A. if x \<in> ?A1 then f ` x else converse(g) ` x"

  (* Prove h is a bijection from A to B *)
  (* ... detailed proof ... *)
  show "A \<approx> B"
    unfolding eqpoll_def
    sorry (* full proof omitted for presentation *)
qed
```

The full proof verifies:

1. $h$ is well-defined: for $x \in A_1$, $f(x) \in B$; for $x \in A_2 = g[B_2]$, $g^{-1}(x) \in B_2 \subseteq B$.
2. $h$ is injective: on $A_1$, injectivity follows from injectivity of $f$; on $A_2$, from injectivity of $g^{-1}$; across the two pieces, from the disjointness of $B_1$ and $B_2$.
3. $h$ is surjective: $B_1 = f[A_1]$ is covered by the first branch, and $B_2$ is covered by the second branch (since $A_2 = g[B_2]$ means every element of $B_2$ has a preimage in $A_2$).

### 3.4 The Statement in Isabelle/ZF

```isabelle
lemma lepoll_antisym:
  "\<lbrakk> A \<lesssim> B; B \<lesssim> A \<rbrakk> \<Longrightarrow> A \<approx> B"
```

This is exactly the Schroeder-Bernstein theorem: $\lesssim$ is antisymmetric (up to equipollence).

---

## 4. Applications

### 4.1 Proving Equipollence Without Explicit Bijections

Schroeder-Bernstein is extremely useful because it reduces the task of constructing a bijection to the easier task of constructing two injections.

**Example 1.** $\mathbb{N} \approx \mathbb{N} \times \mathbb{N}$.

- Injection $\mathbb{N} \to \mathbb{N} \times \mathbb{N}$: $n \mapsto \langle n, 0 \rangle$.
- Injection $\mathbb{N} \times \mathbb{N} \to \mathbb{N}$: $\langle m, n \rangle \mapsto 2^m \cdot 3^n$ (or the Cantor pairing function).

By Schroeder-Bernstein, $\mathbb{N} \approx \mathbb{N} \times \mathbb{N}$.

```isabelle
lemma nat_lepoll_nat_times_nat: "nat \<lesssim> nat \<times> nat"
proof -
  let ?f = "lam n:nat. <n, 0>"
  have "?f \<in> inj(nat, nat \<times> nat)"
    by (auto simp: inj_def)
  then show ?thesis unfolding lepoll_def by auto
qed
```

**Example 2.** $\mathcal{P}(\mathrm{nat}) \approx \mathrm{nat} \to \{0, 1\}$.

- Injection $\mathcal{P}(\mathrm{nat}) \to (\mathrm{nat} \to \{0, 1\})$: map each subset to its characteristic function.
- Injection $(\mathrm{nat} \to \{0, 1\}) \to \mathcal{P}(\mathrm{nat})$: map each function to the set of $n$ where $f(n) = 1$.

These are actually inverses, giving a direct bijection.

### 4.2 Cardinal Ordering is a Total Order (with AC)

With the Axiom of Choice (well-ordering theorem), every two sets are comparable: $A \lesssim B$ or $B \lesssim A$. Combined with Schroeder-Bernstein, this gives a total order on cardinalities.

Without AC, it is consistent that there exist sets $A$ and $B$ with neither $A \lesssim B$ nor $B \lesssim A$.

---

## 5. Dedekind-Infinite Sets

### 5.1 Definition

**Definition 5.7 (Dedekind-Infinite).**

A set $A$ is Dedekind-infinite if it is equinumerous to a proper subset of itself:

$$\exists B \subsetneq A.\, A \approx B$$

Equivalently, $A$ is Dedekind-infinite iff there exists an injection $f : A \to A$ that is not a surjection.

### 5.2 Relationship to Schroeder-Bernstein

If $A$ is Dedekind-infinite, then there exists $B \subsetneq A$ with $A \approx B$. Since $B \subseteq A$, we have the inclusion injection $B \hookrightarrow A$ and the bijection $A \xrightarrow{\sim} B$. Schroeder-Bernstein is not needed here (we already have a bijection).

However, the converse direction (showing that $A \approx A - \{x\}$ for some $x$ implies $A$ is infinite in the usual sense) uses Schroeder-Bernstein in some formulations.

### 5.3 In ZFC

With AC, the following are equivalent:
1. $A$ is Dedekind-infinite.
2. $\mathrm{nat} \lesssim A$.
3. $A$ is not finite (i.e., $\neg \mathrm{Finite}(A)$).

Without AC, (1) and (2) are equivalent, but (3) may be strictly weaker (there might exist "amorphous" infinite sets that are not Dedekind-infinite).

---

## 6. The Structure of Cardinal.thy

The file Cardinal.thy in Isabelle/ZF contains:

1. **Definitions**: `eqpoll`, `lepoll`, `lesspoll`, `cardinal`, `Card`, `Finite`, `InfCard`.
2. **Equipollence properties**: reflexivity, symmetry, transitivity.
3. **Schroeder-Bernstein**: the main theorem via Banach decomposition.
4. **Cantor's theorem**: $A \prec \mathcal{P}(A)$.
5. **Cardinal properties**: `Ord_cardinal`, `Card_cardinal`, `cardinal_eqpoll`.
6. **Finite set properties**: closure under union, product, subset.

Results requiring AC are in Cardinal_AC.thy:

7. **Well-ordering implies cardinality**: every set has a cardinal.
8. **Cardinal comparability**: $|A| \leq |B|$ or $|B| \leq |A|$.
9. **InfCard properties**: infinite cardinals absorb addition and multiplication.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Lecture 04b**: Bijections, injections, surjections from `Perm.thy`.
- **Lecture 04c**: The Knaster-Tarski theorem (lfp) used in the decomposition proof.
- **Lecture 05a**: Equipollence and cardinal injection definitions.

### 7.2 Links to Future Modules

- **Lecture 05c**: AC is needed for cardinal comparability.
- **Lecture 05d**: Cardinal arithmetic uses Schroeder-Bernstein to prove absorption laws.
- **Module 06**: The constructible universe uses cardinality arguments.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. & Grabczewski, K. (1996).** "Mechanizing Set Theory: Cardinal Arithmetic and the Axiom of Choice." *Journal of Automated Reasoning*, 17(3), 291--323.
   - *Section 3: the Schroeder-Bernstein proof in Isabelle/ZF.*

### Recommended

2. **Hinkis, A. (2013).** *Proofs of the Cantor-Bernstein Theorem: A Mathematical Excursion.* Birkhauser.
   - *A comprehensive history and survey of all known proofs.*

3. **Banach, S. (1924).** "Un theoreme sur les transformations biunivoques." *Fundamenta Mathematicae*, 6, 236--239.
   - *The decomposition theorem used in the proof.*

---

## 9. Exercises

### Theory

**Exercise 5b.1.** Prove the Schroeder-Bernstein theorem on paper using Banach's decomposition. Write out the construction of the bijection and verify it is well-defined, injective, and surjective.

**Exercise 5b.2.** Prove that the operator $T(X) = A \setminus g[B \setminus f[X]]$ is monotone. Verify each step of the proof that $X \subseteq Y \implies T(X) \subseteq T(Y)$.

**Exercise 5b.3.** Show that Schroeder-Bernstein does not require the Axiom of Choice. Identify which steps in the proof are constructive.

**Exercise 5b.4.** Prove: if $A \approx A - \{x\}$ for some $x \in A$, then $\mathrm{nat} \lesssim A$. (Hint: define an injection $n \mapsto f^n(x)$ where $f : A \xrightarrow{\sim} A - \{x\}$.)

### Isabelle

**Exercise 5b.5.** Prove in Isabelle/ZF:
```isabelle
lemma "\<lbrakk> A \<lesssim> B; B \<lesssim> A \<rbrakk> \<Longrightarrow> A \<approx> B"
```
(This is the statement of Schroeder-Bernstein. You may use the library lemma `lepoll_antisym`.)

**Exercise 5b.6.** Use Schroeder-Bernstein to prove:
```isabelle
lemma "nat \<approx> nat - {0}"
```
by constructing injections in both directions.

**Exercise 5b.7.** Prove: `A \<lesssim> B \<Longrightarrow> Pow(A) \<lesssim> Pow(B)`. (Hint: if $f : A \to B$ is injective, define $g : \mathcal{P}(A) \to \mathcal{P}(B)$ by $g(S) = f[S]$.)

**Exercise 5b.8.** Prove that Schroeder-Bernstein fails for surjections: find sets $A$ and $B$ with surjections $A \twoheadrightarrow B$ and $B \twoheadrightarrow A$ but $A \not\approx B$. (This is actually false in ZFC; the "surjective Schroeder-Bernstein" also holds but requires AC. Discuss why.)
