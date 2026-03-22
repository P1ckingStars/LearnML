# Homework 07: HOL Proofs

> **Module 07 --- Isabelle/HOL: Types, Datatypes & Induction**
> **Due:** Two weeks after assignment
> **Estimated time:** ~18 hours
> **Total points:** 200

---

## Instructions

- Submit Isabelle `.thy` files that check without errors (no `sorry`).
- For theory questions, write clear explanations. A correct answer without justification receives no credit.
- You may use any proof method (including Sledgehammer). However, for problems marked "structured proof required," you must use Isar-style proofs with `proof`/`qed`, not one-line `by` invocations.
- You may consult *Concrete Semantics* (Nipkow & Klein), the Isabelle/HOL tutorial, and the Isabelle documentation. Cite any additional sources.
- Collaboration policy: discuss ideas freely, but write and submit your own proofs.

---

## Part A: Datatypes and Functions (60 points)

### Problem A1: Expression Evaluator (20 pts)

Define a datatype for arithmetic expressions over integers:

```isabelle
datatype expr = Const int | Var string | Plus expr expr | Mult expr expr | Neg expr
```

**(a)** (5 pts) Define a function `eval :: expr => (string => int) => int` that evaluates an expression given a variable environment.

**(b)** (5 pts) Define a function `vars :: expr => string set` that returns the set of variable names occurring in an expression.

**(c)** (10 pts) Prove the following *coincidence lemma*: if two environments agree on all variables in an expression, they produce the same evaluation result.

```isabelle
lemma eval_coincidence:
  "(\<forall>x \<in> vars e. env1 x = env2 x) \<Longrightarrow> eval e env1 = eval e env2"
```

Use a structured induction proof.

### Problem A2: Binary Trees (20 pts)

```isabelle
datatype 'a tree = Leaf | Node "'a tree" 'a "'a tree"
```

**(a)** (5 pts) Define functions `size_tree :: 'a tree => nat` (number of nodes) and `height :: 'a tree => nat` (length of longest path from root to leaf).

**(b)** (5 pts) Prove: `size_tree t < 2 ^ (height t + 1)`. *Hint:* induction on `t`.

**(c)** (5 pts) Define `mirror :: 'a tree => 'a tree` and prove `mirror (mirror t) = t`.

**(d)** (5 pts) Define `flatten :: 'a tree => 'a list` (in-order traversal) and prove `set (flatten t) = set_tree t` where `set_tree` returns all values stored in the tree.

### Problem A3: Association Lists (20 pts)

An association list is a list of key-value pairs representing a finite map.

**(a)** (5 pts) Define:

```isabelle
fun lookup :: "'k => ('k * 'v) list => 'v option" where ...
fun update :: "'k => 'v => ('k * 'v) list => ('k * 'v) list" where ...
fun delete :: "'k => ('k * 'v) list => ('k * 'v) list" where ...
```

**(b)** (5 pts) Prove `lookup k (update k v al) = Some v`.

**(c)** (5 pts) Prove `k1 \<noteq> k2 \<Longrightarrow> lookup k1 (update k2 v al) = lookup k1 al`.

**(d)** (5 pts) Prove `lookup k (delete k al) = None`.

---

## Part B: Induction (60 points)

### Problem B1: List Reversal (15 pts)

**(a)** (5 pts) Define a tail-recursive list reversal:

```isabelle
fun rev_acc :: "'a list => 'a list => 'a list" where
  "rev_acc acc [] = acc"
| "rev_acc acc (x # xs) = rev_acc (x # acc) xs"
```

**(b)** (10 pts) Prove `rev_acc acc xs = rev xs @ acc`. Note that you will need `arbitrary: acc` in the induction. Provide a structured proof explaining why `arbitrary` is necessary.

### Problem B2: Sorting (20 pts)

**(a)** (5 pts) Define an inductive predicate `sorted :: nat list => bool`:

```isabelle
inductive sorted :: "nat list => bool" where
  "sorted []"
| "sorted [x]"
| "\<lbrakk> x \<le> y; sorted (y # ys) \<rbrakk> \<Longrightarrow> sorted (x # y # ys)"
```

**(b)** (5 pts) Define insertion sort:

```isabelle
fun ins :: "nat => nat list => nat list" where ...
fun isort :: "nat list => nat list" where ...
```

**(c)** (10 pts) Prove `sorted (isort xs)` using rule induction on `sorted` and structural induction on lists. You will need an auxiliary lemma about `ins` preserving sortedness.

### Problem B3: Well-Founded Induction (10 pts)

**(a)** (10 pts) Define the Euclidean GCD algorithm using `function`:

```isabelle
function gcd :: "nat => nat => nat" where
  "gcd a 0 = a"
| "gcd 0 b = b"
| "gcd (Suc a) (Suc b) = (if a < b then gcd (Suc a) (b - a)
                           else gcd (a - b) (Suc b))"
```

Provide the termination proof using `measure (\<lambda>(a, b). a + b)`. Then prove `gcd a b dvd a \<and> gcd a b dvd b` using computation induction (`gcd.induct`).

### Problem B4: Rule Induction (15 pts)

**(a)** (5 pts) Define the reflexive transitive closure of a relation:

```isabelle
inductive rtc :: "('a => 'a => bool) => 'a => 'a => bool" where
  refl: "rtc R x x"
| step: "\<lbrakk> R x y; rtc R y z \<rbrakk> \<Longrightarrow> rtc R x z"
```

**(b)** (10 pts) Prove transitivity of `rtc`:

```isabelle
lemma rtc_trans: "\<lbrakk> rtc R x y; rtc R y z \<rbrakk> \<Longrightarrow> rtc R x z"
```

Use rule induction on `rtc R x y`. Explain why structural induction on a datatype would not work here.

---

## Part C: Automation (40 points)

### Problem C1: Sledgehammer Exploration (15 pts)

For each of the following lemmas, attempt to prove it using Sledgehammer. Record:
- Which prover(s) succeeded.
- The suggested proof method and facts.
- How long the prover took.

If Sledgehammer fails, explain why and provide a manual proof.

**(a)** `"finite A \<Longrightarrow> finite B \<Longrightarrow> card (A \<union> B) + card (A \<inter> B) = card A + card B"`

**(b)** `"\<forall>x \<in> set xs. P x \<Longrightarrow> filter P xs = xs"`

**(c)** `"inj f \<Longrightarrow> f ` A \<inter> f ` B = f ` (A \<inter> B)"`

### Problem C2: Counterexample Finding (10 pts)

For each of the following conjectures, use Nitpick or Quickcheck to find a counterexample. Then state the correct version and prove it.

**(a)** `"map f xs = map f ys \<Longrightarrow> xs = ys"`

**(b)** `"sorted xs \<Longrightarrow> sorted (butlast xs)"` (using the `sorted` predicate from B2)

**(c)** `"length (remdups xs) = card (set xs)"` (where `remdups` removes consecutive duplicates only)

### Problem C3: Eisbach Method (15 pts)

**(a)** (10 pts) Write an Eisbach method `list_solver` that combines induction on lists with `auto` and `simp` to solve common list lemmas. Your method should successfully prove at least 5 of the following:

- `length (xs @ ys) = length xs + length ys`
- `rev (xs @ ys) = rev ys @ rev xs`
- `map f (xs @ ys) = map f xs @ map f ys`
- `filter P (xs @ ys) = filter P xs @ filter P ys`
- `set (xs @ ys) = set xs \<union> set ys`
- `length (rev xs) = length xs`
- `rev (rev xs) = xs`

**(b)** (5 pts) Test your method on a lemma it *cannot* solve. Explain why it fails and what would be needed to handle that case.

---

## Part D: Theory Questions (40 points)

### Problem D1: HOL Foundations (15 pts)

**(a)** (5 pts) State the three axioms of Isabelle/HOL (extensionality, Hilbert choice, typedef). For each, explain what it enables that cannot be done without it.

**(b)** (5 pts) In HOL, `'a set = 'a => bool`. This means the "powerset" `'a set set = ('a => bool) => bool` is a type. Explain how this avoids Russell's paradox, whereas in ZF the set of all sets leads to contradiction.

**(c)** (5 pts) HOL functions are total. How does Isabelle handle "partial" functions like `hd :: 'a list => 'a` (head of a list, undefined for empty lists)? What is the value of `hd []`?

### Problem D2: Type Classes (10 pts)

**(a)** (5 pts) Define a type class `metric_space` with:
- A distance function `dist :: 'a => 'a => real`
- Axioms: non-negativity, identity of indiscernibles, symmetry, triangle inequality.

**(b)** (5 pts) Provide an instance showing that `real` is a metric space with `dist x y = abs (x - y)`. Prove all the axioms.

### Problem D3: Comparison Essay (15 pts)

Write a 300--500 word essay comparing Isabelle/HOL and Isabelle/ZF for formalizing the following theorem:

> **Theorem (Cantor-Bernstein).** If there exist injections $f : A \to B$ and $g : B \to A$, then there exists a bijection $h : A \to B$.

Discuss: (a) how the statement would be formulated in each logic, (b) which proof steps would be easier/harder in each, (c) which logic you would choose and why. You do not need to complete the proof, but you should identify the key challenges.

---

## References

- Nipkow, T. and Klein, G. (2014). *Concrete Semantics with Isabelle/HOL*. Chapters 2--4.
- Nipkow, T., Paulson, L.C., and Wenzel, M. (2002). *Isabelle/HOL --- A Proof Assistant for Higher-Order Logic*.
- Isabelle documentation: `isar-ref.pdf`, `datatypes.pdf`.
