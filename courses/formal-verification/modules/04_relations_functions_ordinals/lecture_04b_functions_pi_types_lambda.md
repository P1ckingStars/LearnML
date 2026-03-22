# Lecture 04b: Functions, Pi Types & Lambda Abstraction

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** a ZF function as a relation that is single-valued on its domain and characterize the function space $A \to B$.
2. **Define** dependent function spaces $\Pi(A, B)$ and use lambda abstraction `lam x:A. b(x)` to construct functions.
3. **State** and apply the beta rule: `(lam x:A. b(x)) ` a = b(a)` when `a \<in> A`.
4. **Explain** why function application outside the domain yields `0` (the empty set) and how this differs from HOL.
5. **Define** injections, surjections, and bijections and prove basic properties.
6. **Compose** functions and prove type-correctness of composed functions.
7. **Navigate** `func.thy` and `Perm.thy` in the Isabelle/ZF distribution.

---

## 2. Motivation and Context

### 2.1 Functions in Set Theory

In ZF set theory, functions are not primitive objects. A function $f : A \to B$ is a set of ordered pairs $f \subseteq A \times B$ that is *single-valued* (functional) and *total* on $A$. This encoding is fundamental: it reduces the concept of "function" to the concept of "set", which is all we have in ZF.

### 2.2 Dependent Functions

In ordinary mathematics, we write $f : A \to B$ for a function with a fixed codomain. But in many settings, the codomain varies with the argument: $f(x) \in B(x)$ for each $x \in A$. This is a *dependent function*, and the space of all such functions is the dependent product $\Pi_{x \in A} B(x)$.

Isabelle/ZF supports dependent functions natively. This is one of its advantages over simpler set-theoretic frameworks: it can directly express constructions that would require additional encoding in a non-dependent setting.

---

## 3. Core Theory

### 3.1 Functions as Relations

**Definition 4.12 (Function).** A set $f$ is a function if it is a relation and it is single-valued:

```isabelle
definition function :: "i => o" where
  "function(f) \<equiv> \<forall>x y z. <x,y> \<in> f \<longrightarrow> <x,z> \<in> f \<longrightarrow> y = z"
```

A function is single-valued: each element of the domain maps to at most one element.

### 3.2 Function Application

**Definition 4.13 (Application).**

$$f \mathbin{`} a = \iota y.\, \langle a, y \rangle \in f$$

where $\iota y.\, P(y)$ denotes "the unique $y$ such that $P(y)$".

```isabelle
definition apply :: "[i, i] => i"  (infixl "`" 90) where
  "f ` a \<equiv> THE y. <a, y> \<in> f"
```

**Key property.** If $f$ is a function and $a \in \mathrm{domain}(f)$, then $\langle a, f \mathbin{`} a \rangle \in f$ and $f \mathbin{`} a$ is the unique element paired with $a$.

```isabelle
lemma apply_equality:
  "\<lbrakk> <a, b> \<in> f; function(f) \<rbrakk> \<Longrightarrow> f ` a = b"
```

**Application outside the domain.** If $a \notin \mathrm{domain}(f)$, then there is no $y$ with $\langle a, y \rangle \in f$, and the definite description `THE y. <a, y> \<in> f` returns an arbitrary element (in Isabelle/ZF, this is `0` by convention). This is *not* an error; it is simply a well-defined but uninteresting value.

This differs fundamentally from Isabelle/HOL, where function application `f a` is always well-defined by construction (functions are total in HOL). In ZF, the "totality" of a function is a theorem to be proved, not a type-level guarantee.

### 3.3 The Function Space

**Definition 4.14 (Function Space).**

$$A \to B = \{f \in \mathcal{P}(A \times B) : \mathrm{function}(f) \land \mathrm{domain}(f) = A \land \mathrm{range}(f) \subseteq B\}$$

In Isabelle/ZF, this is defined as a special case of the dependent product:

```isabelle
abbreviation function_space :: "[i, i] => i"  (infixr "\<rightarrow>" 60) where
  "A \<rightarrow> B \<equiv> Pi(A, \<lambda>_. B)"
```

### 3.4 The Dependent Product (Pi Type)

**Definition 4.15 (Pi).**

$$\Pi(A, B) = \{f \in \mathcal{P}(\Sigma(A, B)) : \mathrm{function}(f) \land \mathrm{domain}(f) = A\}$$

```isabelle
definition Pi :: "[i, i => i] => i" where
  "Pi(A, B) \<equiv> {f \<in> Pow(Sigma(A, B)). function(f) \<and> domain(f) = A}"
```

A member $f \in \Pi(A, B)$ is a function such that:
- $f \subseteq \Sigma(A, B)$, i.e., for each $x \in A$, $f(x) \in B(x)$.
- $f$ is single-valued.
- $\mathrm{domain}(f) = A$ (totality).

**Pi type membership:**

```isabelle
lemma Pi_iff:
  "f \<in> Pi(A, B) \<longleftrightarrow>
    function(f) \<and> f \<subseteq> Sigma(A, B) \<and> domain(f) = A"
```

### 3.5 Lambda Abstraction

**Definition 4.16 (Lambda).**

$$(\lambda x \in A.\, b(x)) = \{\langle x, b(x) \rangle : x \in A\}$$

```isabelle
definition Lambda :: "[i, i => i] => i" where
  "Lambda(A, b) \<equiv> {<x, b(x)>. x \<in> A}"

syntax "_lam" :: "[pttrn, i, i] => i"  ("(3lam _:_./ _)" 10)
translations  "lam x:A. b" \<rightleftharpoons> "CONST Lambda(A, \<lambda>x. b)"
```

### 3.6 The Beta Rule

**Theorem 4.2 (Beta).** If $a \in A$, then:

$$(\lambda x \in A.\, b(x)) \mathbin{`} a = b(a)$$

```isabelle
lemma beta [simp]:
  "a \<in> A \<Longrightarrow> (lam x:A. b(x)) ` a = b(a)"
```

*Proof sketch.* By definition, $(\lambda x \in A.\, b(x)) = \{\langle x, b(x) \rangle : x \in A\}$. Since $a \in A$, we have $\langle a, b(a) \rangle \in (\lambda x \in A.\, b(x))$. The function is single-valued (if $\langle a, y \rangle$ is also in the set, then $y = b(a)$). By `apply_equality`, the application equals $b(a)$. $\blacksquare$

**The type-checking obligation.** The beta rule requires the precondition $a \in A$. This is the type-checking obligation: before applying a function, you must prove the argument is in the domain.

### 3.7 Lambda Type Rule

**Theorem 4.3 (Lambda Type).** If $b(x) \in B(x)$ for all $x \in A$, then:

$$(\lambda x \in A.\, b(x)) \in \Pi(A, B)$$

```isabelle
lemma lam_type [TC]:
  "(\<And>x. x \<in> A \<Longrightarrow> b(x) \<in> B(x)) \<Longrightarrow> (lam x:A. b(x)) \<in> Pi(A, B)"
```

This is one of the most important `[TC]` rules. It lets us prove that a lambda-defined function belongs to a Pi type by proving the body has the right type for each argument.

### 3.8 Apply Type Rule

**Theorem 4.4 (Apply Type).**

```isabelle
lemma apply_type [TC]:
  "\<lbrakk> f \<in> Pi(A, B); a \<in> A \<rbrakk> \<Longrightarrow> f ` a \<in> B(a)"
```

This says: if $f \in \Pi(A, B)$ and $a \in A$, then $f(a) \in B(a)$. The combination of `lam_type` and `apply_type` gives a type-checking workflow analogous to the typing rules of dependent type theory.

---

## 4. Function Properties

### 4.1 Eta Rule

```isabelle
lemma eta [simp]:
  "f \<in> Pi(A, B) \<Longrightarrow> (lam x:A. f ` x) = f"
```

This says: if $f$ is already a function from $A$ to $B$, then wrapping it in a lambda and re-applying gives back $f$.

### 4.2 Function Extensionality

```isabelle
lemma fun_extension:
  "\<lbrakk> f \<in> Pi(A, B); g \<in> Pi(A, C);
     \<And>x. x \<in> A \<Longrightarrow> f ` x = g ` x \<rbrakk>
   \<Longrightarrow> f = g"
```

Two functions with the same domain are equal if and only if they agree on every input. This is function extensionality, which in ZF follows from set extensionality.

### 4.3 Restriction

```isabelle
definition restrict :: "[i, i] => i" where
  "restrict(f, A) \<equiv> lam x:A. f ` x"
```

`restrict(f, A)` restricts the function $f$ to the subdomain $A$.

```isabelle
lemma restrict_type:
  "\<lbrakk> f \<in> Pi(C, B); A \<subseteq> C \<rbrakk>
   \<Longrightarrow> restrict(f, A) \<in> Pi(A, B)"
```

---

## 5. Injections, Surjections, Bijections

### 5.1 Definitions (from Perm.thy)

```isabelle
definition inj :: "[i, i] => i" where
  "inj(A, B) \<equiv> {f \<in> A \<rightarrow> B.
    \<forall>w\<in>A. \<forall>x\<in>A. f ` w = f ` x \<longrightarrow> w = x}"

definition surj :: "[i, i] => i" where
  "surj(A, B) \<equiv> {f \<in> A \<rightarrow> B.
    \<forall>y\<in>B. \<exists>x\<in>A. f ` x = y}"

definition bij :: "[i, i] => i" where
  "bij(A, B) \<equiv> inj(A, B) \<inter> surj(A, B)"
```

### 5.2 Key Properties

```isabelle
(* Injections *)
lemma inj_is_fun: "f \<in> inj(A, B) \<Longrightarrow> f \<in> A \<rightarrow> B"
lemma inj_equality:
  "\<lbrakk> f \<in> inj(A, B); f ` a = f ` b; a \<in> A; b \<in> A \<rbrakk> \<Longrightarrow> a = b"

(* Surjections *)
lemma surj_is_fun: "f \<in> surj(A, B) \<Longrightarrow> f \<in> A \<rightarrow> B"
lemma surj_range: "f \<in> surj(A, B) \<Longrightarrow> range(f) = B"

(* Bijections *)
lemma bij_is_inj: "f \<in> bij(A, B) \<Longrightarrow> f \<in> inj(A, B)"
lemma bij_is_surj: "f \<in> bij(A, B) \<Longrightarrow> f \<in> surj(A, B)"
lemma bij_is_fun: "f \<in> bij(A, B) \<Longrightarrow> f \<in> A \<rightarrow> B"
```

### 5.3 The Identity Function

```isabelle
definition id :: "i => i" where
  "id(A) \<equiv> lam x:A. x"

lemma id_type [TC]: "id(A) \<in> A \<rightarrow> A"
lemma id_bij: "id(A) \<in> bij(A, A)"
```

### 5.4 Composition of Functions

In Isabelle/ZF, function composition uses relational composition (composing the underlying sets of pairs). The key results are:

```isabelle
lemma comp_type [TC]:
  "\<lbrakk> g \<in> B \<rightarrow> C; f \<in> A \<rightarrow> B \<rbrakk> \<Longrightarrow> g O f \<in> A \<rightarrow> C"

lemma comp_inj:
  "\<lbrakk> g \<in> inj(B, C); f \<in> inj(A, B) \<rbrakk> \<Longrightarrow> g O f \<in> inj(A, C)"

lemma comp_surj:
  "\<lbrakk> g \<in> surj(B, C); f \<in> surj(A, B) \<rbrakk> \<Longrightarrow> g O f \<in> surj(A, C)"

lemma comp_bij:
  "\<lbrakk> g \<in> bij(B, C); f \<in> bij(A, B) \<rbrakk> \<Longrightarrow> g O f \<in> bij(A, C)"
```

### 5.5 Inverse of a Bijection

```isabelle
lemma bij_converse_bij:
  "f \<in> bij(A, B) \<Longrightarrow> converse(f) \<in> bij(B, A)"
```

The inverse of a bijection is its relational converse, which is also a bijection.

```isabelle
lemma left_inverse:
  "\<lbrakk> f \<in> bij(A, B); a \<in> A \<rbrakk> \<Longrightarrow> converse(f) ` (f ` a) = a"

lemma right_inverse:
  "\<lbrakk> f \<in> bij(A, B); b \<in> B \<rbrakk> \<Longrightarrow> f ` (converse(f) ` b) = b"
```

---

## 6. Worked Example: Constructing a Bijection

Let us construct a bijection between `bool = {0, 1}` and `{succ(0), succ(succ(0))}` (i.e., `{1, 2}`):

```isabelle
definition shift :: i where
  "shift \<equiv> lam x:bool. succ(x)"

lemma shift_type: "shift \<in> bool \<rightarrow> {succ(0), succ(succ(0))}"
proof (unfold shift_def, rule lam_type)
  fix x assume "x \<in> bool"
  then show "succ(x) \<in> {succ(0), succ(succ(0))}"
    by (auto simp: bool_def)
qed

lemma shift_inj: "shift \<in> inj(bool, {succ(0), succ(succ(0))})"
proof (unfold inj_def, intro CollectI conjI ballI impI)
  show "shift \<in> bool \<rightarrow> {succ(0), succ(succ(0))}"
    by (rule shift_type)
next
  fix w x
  assume "w \<in> bool" "x \<in> bool" "shift ` w = shift ` x"
  then show "w = x"
    by (auto simp: shift_def bool_def)
qed

lemma shift_bij: "shift \<in> bij(bool, {succ(0), succ(succ(0))})"
  (* would additionally need surjectivity *)
  oops
```

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Lecture 04a**: Functions are special relations; all the relation machinery (domain, range, converse, composition) applies.
- **Module 03**: Lambda abstraction uses `RepFun` (replacement) to construct the set of pairs.

### 7.2 Links to Future Modules

- **Lecture 04c**: Well-founded recursion defines functions by recursion on well-founded relations.
- **Lecture 04d**: Transfinite recursion defines functions on ordinals.
- **Module 05**: Equipollence and cardinal numbers are defined via bijections.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1993).** "Set Theory for Verification: I. From Foundations to Functions." *Journal of Automated Reasoning*, 11(3), 353--389.
   - *Sections 7--8: functions, Pi types, lambda abstraction.*

### Recommended

2. **Paulson, L. C. (1995).** "Set Theory for Verification: II. Induction and Recursion." *Journal of Automated Reasoning*, 15(2), 167--215.
   - *Uses functions extensively for recursive definitions.*

---

## 9. Exercises

### Theory

**Exercise 4b.1.** Show on paper that if $f \in A \to B$ and $g \in B \to C$, then $g \circ f \in A \to C$. Verify each component: subset of $A \times C$, functionality, domain equals $A$.

**Exercise 4b.2.** Prove that the composition of two injections is an injection.

**Exercise 4b.3.** Prove that if $g \circ f$ is injective, then $f$ is injective.

**Exercise 4b.4.** Prove that if $g \circ f$ is surjective, then $g$ is surjective.

### Isabelle

**Exercise 4b.5.** Prove in Isabelle/ZF:
```isabelle
lemma "id(A) \<in> bij(A, A)"
lemma "f \<in> A \<rightarrow> B \<Longrightarrow> id(B) O f = f"
lemma "f \<in> A \<rightarrow> B \<Longrightarrow> f O id(A) = f"
```

**Exercise 4b.6.** Define the constant function and prove its type:
```isabelle
definition const_fun :: "[i, i] => i" where
  "const_fun(A, b) \<equiv> lam x:A. b"
lemma "b \<in> B \<Longrightarrow> const_fun(A, b) \<in> A \<rightarrow> B"
```

**Exercise 4b.7.** Prove that `Pi(0, B) = {0}` (the only function from the empty set is the empty function).

**Exercise 4b.8.** Prove that if `B(x) = 0` for some `x \<in> A`, then `Pi(A, B) = 0` (there is no total function from $A$ if the codomain is empty for some argument).
