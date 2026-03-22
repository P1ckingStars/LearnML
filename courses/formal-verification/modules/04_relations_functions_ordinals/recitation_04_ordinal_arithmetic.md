# Recitation 04: Ordinal Arithmetic

## Overview

This recitation provides hands-on practice with ordinals in Isabelle/ZF. We will:

1. Define ordinal addition, multiplication, and exponentiation via transfinite recursion.
2. Prove basic ordinal arithmetic properties: associativity, distributivity, non-commutativity.
3. Work through concrete computations with small ordinals.
4. Explore order types from OrderType.thy.
5. Practice transfinite induction proofs.

**Prerequisites:** Lectures 04a--04d (pairs, functions, well-founded recursion, ordinals).

---

## 1. Ordinal Addition

### 1.1 Definition via Transfinite Recursion

Ordinal addition $\alpha + \beta$ is defined by transfinite recursion on $\beta$:

- $\alpha + 0 = \alpha$
- $\alpha + \mathrm{succ}(\beta) = \mathrm{succ}(\alpha + \beta)$
- $\alpha + \lambda = \sup_{\beta < \lambda} (\alpha + \beta)$ for limit $\lambda$

In Isabelle/ZF, ordinal addition is defined in `OrdQuant.thy` or `Ordinal.thy`:

```isabelle
definition oadd :: "[i, i] => i"  (infixl "+++" 65) where
  "i +++ j \<equiv> transrec(j, \<lambda>x f.
    if x = 0 then i
    else if (\<exists>y. x = succ(y)) then succ(f ` pred(x))
    else \<Union>(RepFun(x, \<lambda>y. f ` y)))"
```

The above uses a three-case `transrec` definition. The key recursion equations it satisfies are:

```isabelle
lemma oadd_0 [simp]: "i +++ 0 = i"
lemma oadd_succ [simp]:
  "Ord(j) \<Longrightarrow> i +++ succ(j) = succ(i +++ j)"
lemma oadd_Limit:
  "Limit(j) \<Longrightarrow> i +++ j = (\<Union>k\<in>j. i +++ k)"
```

### 1.2 Concrete Computations

```isabelle
(* 0 + omega = omega *)
lemma "0 +++ nat = nat"
  -- by the limit case: 0 + omega = sup_{n < omega} (0 + n) = sup_{n} n = omega

(* omega + 0 = omega *)
lemma "nat +++ 0 = nat"
  -- by the base case

(* 1 + omega = omega *)
lemma "succ(0) +++ nat = nat"
  -- 1 + omega = sup_{n < omega} (1 + n) = sup_{n} (n + 1) = omega

(* omega + 1 = succ(omega) *)
lemma "nat +++ succ(0) = succ(nat)"
  -- omega + 1 = succ(omega + 0) = succ(omega)
```

**Key insight:** $1 + \omega = \omega$ but $\omega + 1 = \omega \cup \{\omega\} \neq \omega$. Ordinal addition is **not commutative**.

### 1.3 Non-Commutativity

```isabelle
lemma oadd_not_commutative:
  "succ(0) +++ nat \<noteq> nat +++ succ(0)"
proof -
  have "succ(0) +++ nat = nat" sorry (* limit computation *)
  moreover have "nat +++ succ(0) = succ(nat)" by simp
  moreover have "nat \<noteq> succ(nat)" by (rule Limit_nat [THEN Limit_has_succ])
  ultimately show ?thesis by simp
qed
```

### 1.4 Associativity

Ordinal addition is associative:

```isabelle
lemma oadd_assoc:
  "\<lbrakk> Ord(i); Ord(j); Ord(k) \<rbrakk>
   \<Longrightarrow> (i +++ j) +++ k = i +++ (j +++ k)"
```

*Proof sketch.* By transfinite induction on $k$:

- **Base:** $(i + j) + 0 = i + j = i + (j + 0)$.
- **Successor:** $(i + j) + \mathrm{succ}(k) = \mathrm{succ}((i + j) + k) = \mathrm{succ}(i + (j + k))$ (by IH) $= i + \mathrm{succ}(j + k) = i + (j + \mathrm{succ}(k))$.
- **Limit:** Both sides equal the same supremum. $\blacksquare$

---

## 2. Ordinal Multiplication

### 2.1 Definition

Ordinal multiplication $\alpha \cdot \beta$ is defined by transfinite recursion on $\beta$:

- $\alpha \cdot 0 = 0$
- $\alpha \cdot \mathrm{succ}(\beta) = \alpha \cdot \beta + \alpha$
- $\alpha \cdot \lambda = \sup_{\beta < \lambda} (\alpha \cdot \beta)$ for limit $\lambda$

```isabelle
lemma omult_0 [simp]: "i *** 0 = 0"
lemma omult_succ [simp]:
  "Ord(j) \<Longrightarrow> i *** succ(j) = (i *** j) +++ i"
lemma omult_Limit:
  "Limit(j) \<Longrightarrow> i *** j = (\<Union>k\<in>j. i *** k)"
```

### 2.2 Concrete Computations

```isabelle
(* omega * 2 = omega + omega *)
lemma "nat *** succ(succ(0)) = nat +++ nat"
  -- nat * 2 = nat * 1 + nat = (nat * 0 + nat) + nat = nat + nat

(* 2 * omega = omega *)
lemma "succ(succ(0)) *** nat = nat"
  -- 2 * omega = sup_{n} (2 * n) = omega

(* omega * omega *)
-- omega^2, a larger ordinal
```

Again, multiplication is **not commutative**: $2 \cdot \omega = \omega \neq \omega \cdot 2 = \omega + \omega$.

### 2.3 Distributivity

Left-distributivity holds:

```isabelle
lemma omult_distrib:
  "\<lbrakk> Ord(i); Ord(j); Ord(k) \<rbrakk>
   \<Longrightarrow> i *** (j +++ k) = (i *** j) +++ (i *** k)"
```

But right-distributivity fails: $(\omega + 1) \cdot 2 = \omega + 1 + \omega + 1 = \omega \cdot 2 + 1$, while $\omega \cdot 2 + 1 \cdot 2 = \omega \cdot 2 + 2$.

---

## 3. Transfinite Induction Practice

### 3.1 Worked Example: Ordinal Addition Preserves Ordering

**Claim:** If $\beta < \gamma$, then $\alpha + \beta < \alpha + \gamma$ (for ordinals $\alpha, \beta, \gamma$).

```isabelle
lemma oadd_lt_mono2:
  assumes "Ord(i)" "Ord(j)" "Ord(k)" "j < k"
  shows "i +++ j < i +++ k"
using \<open>j < k\<close> \<open>Ord(k)\<close>
proof (induct k rule: trans_induct)
  case (step k)
  show ?case
  proof (cases "k = 0")
    case True
    with \<open>j < k\<close> show ?thesis by (simp add: lt_def)
  next
    case False
    then show ?thesis
    proof (cases "\<exists>m. k = succ(m)")
      case True
      then obtain m where km: "k = succ(m)" by auto
      with \<open>j < k\<close> have "j \<le> m" by (auto simp: succ_def lt_def le_def)
      then show ?thesis
      proof (cases "j = m")
        case True
        with km show ?thesis by auto
      next
        case False
        with \<open>j \<le> m\<close> have "j < m" by (auto simp: le_def)
        then have "i +++ j < i +++ m" using step km by auto
        also have "... < i +++ succ(m)" by auto
        finally show ?thesis using km by simp
      qed
    next
      case False
      (* k is a limit ordinal *)
      then have "Limit(k)" sorry
      then have "i +++ k = (\<Union>l\<in>k. i +++ l)" by (rule oadd_Limit)
      moreover from \<open>j < k\<close> have "succ(j) < k" sorry
      ultimately show ?thesis sorry
    qed
  qed
qed
```

This proof illustrates the typical structure of a transfinite induction: case-split on zero, successor, and limit.

### 3.2 Exercise: Left Cancellation

**Claim:** If $\alpha + \beta = \alpha + \gamma$, then $\beta = \gamma$.

*Hint:* Use the fact that ordinal addition is strictly monotone in the second argument.

---

## 4. Order Types

### 4.1 Overview of OrderType.thy

An *order type* assigns an ordinal to each well-ordered set. Two well-ordered sets have the same order type if and only if they are order-isomorphic.

```isabelle
definition ordertype :: "[i, i] => i" where
  "ordertype(A, r) \<equiv> ..."
```

The order type of a well-ordered set $(A, r)$ is the unique ordinal $\alpha$ such that $(A, r) \cong (\alpha, \in)$.

### 4.2 Key Properties

```isabelle
lemma Ord_ordertype: "well_ord(A, r) \<Longrightarrow> Ord(ordertype(A, r))"

lemma ordertype_eq:
  "\<lbrakk> well_ord(A, r); well_ord(B, s);
     ordertype(A, r) = ordertype(B, s) \<rbrakk>
   \<Longrightarrow> \<exists>f \<in> bij(A, B). \<forall>x\<in>A. \<forall>y\<in>A. <x,y> \<in> r \<longleftrightarrow> <f`x, f`y> \<in> s"
```

### 4.3 Examples

```isabelle
(* The order type of (nat, <) is omega *)
lemma "ordertype(nat, Memrel(nat)) = nat"

(* The order type of a finite set {0,...,n-1} is n *)
lemma "n \<in> nat \<Longrightarrow> ordertype(n, Memrel(n)) = n"
```

---

## 5. Practice Problems (with Solutions)

### Problem 1

**Prove:** $0 + \alpha = \alpha$ for all ordinals $\alpha$.

**Solution:** By transfinite induction on $\alpha$:
- Base: $0 + 0 = 0$.
- Successor: $0 + \mathrm{succ}(\alpha) = \mathrm{succ}(0 + \alpha) = \mathrm{succ}(\alpha)$ by IH.
- Limit: $0 + \lambda = \sup_{\alpha < \lambda} (0 + \alpha) = \sup_{\alpha < \lambda} \alpha = \lambda$ by IH.

### Problem 2

**Prove:** $\alpha \cdot 1 = \alpha$ for all ordinals $\alpha$.

**Solution:** $\alpha \cdot 1 = \alpha \cdot \mathrm{succ}(0) = \alpha \cdot 0 + \alpha = 0 + \alpha = \alpha$.

### Problem 3

**Prove:** $1 \cdot \alpha = \alpha$ for all ordinals $\alpha$.

**Solution:** By transfinite induction on $\alpha$:
- Base: $1 \cdot 0 = 0$.
- Successor: $1 \cdot \mathrm{succ}(\alpha) = 1 \cdot \alpha + 1 = \alpha + 1 = \mathrm{succ}(\alpha)$ by IH.
- Limit: $1 \cdot \lambda = \sup_{\alpha < \lambda} (1 \cdot \alpha) = \sup_{\alpha < \lambda} \alpha = \lambda$ by IH.

### Problem 4

**Show:** $2 \cdot \omega = \omega$ but $\omega \cdot 2 = \omega + \omega \neq \omega$.

**Solution for $2 \cdot \omega = \omega$:** $2 \cdot \omega = \sup_{n < \omega} (2 \cdot n)$. Each $2 \cdot n$ is a finite ordinal $2n$, and $\sup_{n < \omega} 2n = \omega$.

**Solution for $\omega \cdot 2 \neq \omega$:** $\omega \cdot 2 = \omega + \omega$. The ordinal $\omega + \omega$ has order type corresponding to two copies of $\omega$ placed end-to-end, which is strictly larger than $\omega$.

---

## 6. Common Pitfalls

### 6.1 Confusing nat ordering with ordinal ordering

In Isabelle/ZF, `<` on natural numbers and `<` on ordinals are essentially the same ($\in$-ordering), but the lemma names differ. Make sure you use the right lemmas.

### 6.2 Non-commutativity

Always remember: $\alpha + \beta \neq \beta + \alpha$ and $\alpha \cdot \beta \neq \beta \cdot \alpha$ in general. Only left-cancellation and left-distributivity hold.

### 6.3 Type-checking obligations

When working with ordinal operations, you must always prove that your arguments are ordinals. The `[TC]` rules help, but for complex expressions you may need explicit `Ord(...)` assumptions.
