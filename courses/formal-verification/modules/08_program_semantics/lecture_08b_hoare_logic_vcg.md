# Lecture 08b: Hoare Logic and Verification Conditions

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **State** the Hoare logic rules for partial and total correctness.
2. **Prove** the soundness of Hoare logic with respect to the big-step operational semantics.
3. **Explain** Cook's relative completeness theorem.
4. **Use** the Verification Condition Generator (VCG) to verify annotated IMP programs.
5. **Distinguish** partial correctness ($\{P\}\,c\,\{Q\}$) from total correctness ($[P]\,c\,[Q]$) and state the difference in the While rule.

---

## 2. Hoare Triples

### 2.1 Partial Correctness

**Definition 2.1.** A *Hoare triple* $\{P\}\, c\, \{Q\}$ (partial correctness) is valid if: for every state $s$ satisfying $P$, if $(c, s) \Rightarrow t$, then $t$ satisfies $Q$.

```isabelle
definition hoare_valid :: "assn => com => assn => bool"
  ("\<Turnstile> {(1_)}/ (_)/ {(1_)}" 50) where
  "\<Turnstile> {P} c {Q} \<longleftrightarrow> (\<forall>s t. P s \<longrightarrow> (c, s) \<Rightarrow> t \<longrightarrow> Q t)"
```

where `assn = state => bool` is the type of assertions (predicates on states).

**Key point.** Partial correctness says nothing about termination. If $c$ diverges from $s$, the triple is vacuously true. This is why it is called "partial."

### 2.2 Assertions

Assertions are predicates on states. We write them informally using mathematical notation and formally as Isabelle lambda expressions:

| Informal | Isabelle |
|---|---|
| $x > 0$ | `\<lambda>s. s ''x'' > 0` |
| $x = y + 1$ | `\<lambda>s. s ''x'' = s ''y'' + 1` |
| $P \wedge Q$ | `\<lambda>s. P s \<and> Q s` |
| $P[x/a]$ | `\<lambda>s. P (s(''x'' := aval a s))` |

### 2.3 Substitution in Assertions

The assertion $P[x/a]$ denotes $P$ with variable $x$ replaced by expression $a$. Formally:

```isabelle
abbreviation subst :: "assn => vname => aexp => assn"
  ("_[_/_]" [1000, 0, 0] 999) where
  "P[a/x] \<equiv> (\<lambda>s. P (s(x := aval a s)))"
```

This is the key ingredient of the assignment rule.

---

## 3. Hoare Logic Rules

### 3.1 The Proof System

```isabelle
inductive hoare :: "assn => com => assn => bool"
  ("\<turnstile> ({(1_)}/ (_)/ {(1_)})" 50) where
  Skip:
    "\<turnstile> {P} SKIP {P}"
| Assign:
    "\<turnstile> {P[a/x]} x ::= a {P}"
| Seq:
    "\<lbrakk> \<turnstile> {P} c1 {Q}; \<turnstile> {Q} c2 {R} \<rbrakk>
     \<Longrightarrow> \<turnstile> {P} c1;; c2 {R}"
| If:
    "\<lbrakk> \<turnstile> {\<lambda>s. P s \<and> bval b s} c1 {Q};
       \<turnstile> {\<lambda>s. P s \<and> \<not> bval b s} c2 {Q} \<rbrakk>
     \<Longrightarrow> \<turnstile> {P} IF b THEN c1 ELSE c2 {Q}"
| While:
    "\<turnstile> {\<lambda>s. P s \<and> bval b s} c {P}
     \<Longrightarrow> \<turnstile> {P} WHILE b DO c {\<lambda>s. P s \<and> \<not> bval b s}"
| Conseq:
    "\<lbrakk> \<forall>s. P' s \<longrightarrow> P s;
       \<turnstile> {P} c {Q};
       \<forall>s. Q s \<longrightarrow> Q' s \<rbrakk>
     \<Longrightarrow> \<turnstile> {P'} c {Q'}"
```

### 3.2 Reading the Rules

**Skip.** SKIP preserves any assertion.

**Assign.** To establish $P$ after $x := a$, we need $P[a/x]$ before --- i.e., $P$ with $x$ replaced by $a$. This is the *backward* assignment rule: the precondition is derived from the postcondition.

**Example.** To prove $\{?\}\; x := x + 1\; \{x > 5\}$, compute $P[x+1/x] = (x + 1 > 5) = (x > 4)$. So the triple is $\{x > 4\}\; x := x + 1\; \{x > 5\}$.

**Seq.** Compose two triples with a matching intermediate assertion $Q$.

**If.** Both branches must establish $Q$; each branch gets the guard (or its negation) as an extra assumption.

**While.** The assertion $P$ is a *loop invariant*: it holds before the loop, is preserved by each iteration (when the guard is true), and holds after the loop (when the guard is false). The postcondition adds $\neg b$ to the invariant.

**Consequence.** Allows strengthening the precondition and weakening the postcondition. This is the only rule that involves logical implication rather than syntactic structure.

---

## 4. Soundness

### 4.1 Statement

**Theorem 4.1 (Soundness of Hoare Logic).** If $\vdash \{P\}\, c\, \{Q\}$ then $\models \{P\}\, c\, \{Q\}$.

In Isabelle:

```isabelle
theorem hoare_sound: "\<turnstile> {P} c {Q} \<Longrightarrow> \<Turnstile> {P} c {Q}"
```

### 4.2 Proof

By rule induction on the Hoare logic derivation $\vdash \{P\}\, c\, \{Q\}$:

```isabelle
proof (induction rule: hoare.induct)
  case (Skip P)
  then show ?case
    unfolding hoare_valid_def by (auto elim: big_step.cases)
next
  case (Assign P a x)
  then show ?case
    unfolding hoare_valid_def
    by (auto elim: big_step.cases)
next
  case (Seq P c1 Q c2 R)
  then show ?case
    unfolding hoare_valid_def
    by (auto elim: big_step.cases)
next
  case (If P b c1 Q c2)
  then show ?case
    unfolding hoare_valid_def
    by (auto elim: big_step.cases)
next
  case (While P b c)
  -- This is the key case.
  show ?case
    unfolding hoare_valid_def
  proof (intro allI impI)
    fix s t
    assume "P s" and "(WHILE b DO c, s) \<Rightarrow> t"
    then show "P t \<and> \<not> bval b t"
    proof (induction "WHILE b DO c" s t rule: big_step.induct)
      case (WhileFalse s)
      then show ?case by auto
    next
      case (WhileTrue s1 s2 s3)
      then show ?case
        using While.IH unfolding hoare_valid_def by blast
    qed
  qed
next
  case (Conseq P' P c Q Q')
  then show ?case
    unfolding hoare_valid_def by blast
qed
```

The While case is the most interesting: it uses rule induction on the big-step derivation of the while loop, applying the invariant-preservation hypothesis at each iteration.

---

## 5. Completeness

### 5.1 Cook's Relative Completeness

**Theorem 5.1 (Cook, 1978).** Hoare logic is *relatively complete*: if $\models \{P\}\, c\, \{Q\}$ then $\vdash \{P\}\, c\, \{Q\}$, provided the assertion language is expressive enough (i.e., every weakest precondition is expressible as an assertion).

Completeness is *relative* because it depends on the ability to express weakest preconditions. For IMP with integer arithmetic, the assertion language (first-order arithmetic over integers) is already sufficiently expressive.

### 5.2 Weakest Preconditions

**Definition 5.2.** The *weakest precondition* $\mathrm{wp}(c, Q)$ is the weakest assertion $P$ such that $\models \{P\}\, c\, \{Q\}$:

$$\mathrm{wp}(c, Q)(s) \iff \forall t.\, (c, s) \Rightarrow t \implies Q(t)$$

In Isabelle:

```isabelle
definition wp :: "com => assn => assn" where
  "wp c Q = (\<lambda>s. \<forall>t. (c, s) \<Rightarrow> t \<longrightarrow> Q t)"
```

**Proposition 5.3.** $\mathrm{wp}$ satisfies:

- $\mathrm{wp}(SKIP, Q) = Q$
- $\mathrm{wp}(x := a, Q) = Q[a/x]$
- $\mathrm{wp}(c_1;; c_2, Q) = \mathrm{wp}(c_1, \mathrm{wp}(c_2, Q))$

The completeness proof constructs a derivation $\vdash \{P\}\, c\, \{Q\}$ by using $\mathrm{wp}$ as intermediate assertions and applying the consequence rule.

---

## 6. Total Correctness

### 6.1 Definition

**Definition 6.1.** A total correctness triple $[P]\, c\, [Q]$ is valid if: for every state $s$ satisfying $P$, command $c$ terminates and the final state satisfies $Q$.

```isabelle
definition hoare_total_valid :: "assn => com => assn => bool"
  ("\<Turnstile>t {(1_)}/ (_)/ {(1_)}" 50) where
  "\<Turnstile>t {P} c {Q} \<longleftrightarrow> (\<forall>s. P s \<longrightarrow> (\<exists>t. (c, s) \<Rightarrow> t \<and> Q t))"
```

### 6.2 The Total Correctness While Rule

The only rule that differs from partial correctness is the While rule. For total correctness, we must prove that the loop terminates by providing a *variant* (a well-founded measure that decreases with each iteration):

```isabelle
While_total:
  "\<lbrakk> \<forall>n::nat. \<turnstile>t {\<lambda>s. P s \<and> bval b s \<and> t s = n} c {\<lambda>s. P s \<and> t s < n} \<rbrakk>
   \<Longrightarrow> \<turnstile>t {P} WHILE b DO c {\<lambda>s. P s \<and> \<not> bval b s}"
```

Here $t : \mathrm{state} \to \mathrm{nat}$ is the variant function. The rule says: if each iteration of the loop body preserves the invariant $P$ *and* strictly decreases the variant $t$, then the loop terminates (because there are no infinite descending chains of natural numbers).

---

## 7. Verification Condition Generator

### 7.1 The Idea

Writing Hoare logic proofs by hand is tedious. A *Verification Condition Generator* (VCG) automates the process by:

1. Traversing the program bottom-up.
2. Applying the Hoare rules mechanically.
3. Collecting the *verification conditions* (VCs): pure mathematical obligations that must hold for the program to satisfy its specification.

The user provides:
- The precondition and postcondition.
- Loop invariants (annotated in the program).

The VCG produces verification conditions that are purely mathematical --- no program logic, just arithmetic and logic.

### 7.2 Annotated Programs

To use the VCG, we annotate while loops with invariants:

```isabelle
datatype acom =
    ASKIP
  | AAssign vname aexp
  | ASeq acom acom
  | AIf bexp acom acom
  | AWhile assn bexp acom    -- invariant annotated here
```

### 7.3 The VCG Function

The VCG computes the weakest precondition bottom-up:

```isabelle
fun pre :: "acom => assn => assn" where
  "pre ASKIP Q = Q"
| "pre (AAssign x a) Q = Q[a/x]"
| "pre (ASeq c1 c2) Q = pre c1 (pre c2 Q)"
| "pre (AIf b c1 c2) Q =
    (\<lambda>s. (bval b s \<longrightarrow> pre c1 Q s) \<and> (\<not> bval b s \<longrightarrow> pre c2 Q s))"
| "pre (AWhile I b c) Q = I"
```

For the While case, the VCG returns the invariant $I$ as the precondition (since the invariant must hold before the loop).

The VCG also collects *side conditions* that must be verified:

```isabelle
fun vc :: "acom => assn => bool" where
  "vc ASKIP Q = True"
| "vc (AAssign x a) Q = True"
| "vc (ASeq c1 c2) Q = (vc c1 (pre c2 Q) \<and> vc c2 Q)"
| "vc (AIf b c1 c2) Q = (vc c1 Q \<and> vc c2 Q)"
| "vc (AWhile I b c) Q =
    ((\<forall>s. I s \<and> bval b s \<longrightarrow> pre c I s) \<and>
     (\<forall>s. I s \<and> \<not> bval b s \<longrightarrow> Q s) \<and>
     vc c I)"
```

The three conditions for While are:
1. The loop body preserves the invariant (when the guard is true).
2. The invariant plus the negated guard implies the postcondition.
3. All VCs within the loop body are satisfied.

### 7.4 VCG Soundness

**Theorem 7.1.** If `vc ac Q` holds and `P = pre ac Q`, then $\models \{P\}\, \mathrm{strip}(ac)\, \{Q\}$.

```isabelle
theorem vc_sound:
  "\<lbrakk> vc ac Q; \<forall>s. P s \<longrightarrow> pre ac Q s \<rbrakk>
   \<Longrightarrow> \<Turnstile> {P} strip ac {Q}"
```

where `strip` removes the annotations, converting `acom` back to `com`.

### 7.5 Using the VCG in Isabelle

The VCG is available as a proof method:

```isabelle
lemma "\<Turnstile> {\<lambda>s. s ''x'' = n}
         ''y'' ::= N 1;;
         WHILE Less (N 0) (V ''x'') DO (
           ''y'' ::= Plus (V ''y'') (V ''y'');;
           ''x'' ::= Plus (V ''x'') (N (-1))
         )
       {\<lambda>s. s ''y'' = 2 ^ n}"
  apply (rule vc_sound)
  apply (simp_all)  -- discharge VCs
  done
```

The `vc_sound` rule reduces the program verification problem to pure mathematical obligations, which `simp` or `auto` can often discharge.

---

## 8. A Complete Example

### 8.1 Verifying a Summation Program

**Program.** Compute the sum $1 + 2 + \cdots + n$ and store it in `s`:

```isabelle
definition sum_prog :: com where
  "sum_prog =
    ''s'' ::= N 0;;
    ''i'' ::= N 1;;
    WHILE Not (Less (V ''n'') (V ''i'')) DO (
      ''s'' ::= Plus (V ''s'') (V ''i'');;
      ''i'' ::= Plus (V ''i'') (N 1)
    )"
```

**Specification.** $\{n \ge 0\}\; \text{sum\_prog}\; \{s = n \cdot (n+1) / 2\}$.

**Loop invariant.** $s = (i-1) \cdot i / 2 \wedge 1 \le i \wedge i \le n + 1$.

**Verification conditions** (generated by VCG):

1. *Initialization*: After `s := 0; i := 1`, the invariant holds.
2. *Preservation*: If the invariant holds and $i \le n$, then after `s := s + i; i := i + 1`, the invariant still holds.
3. *Postcondition*: If the invariant holds and $i > n$, then $s = n(n+1)/2$.

All three are arithmetic identities, dischargeable by `auto` or `arith`.

---

## 9. Key Takeaways

1. Hoare logic provides a compositional proof system for program correctness: each language construct has a corresponding rule.
2. The assignment rule works *backward*: the precondition is the postcondition with the assigned variable substituted.
3. Soundness is proved by rule induction on the Hoare derivation, with the While case using rule induction on the big-step semantics.
4. Total correctness requires a variant (well-founded measure) that decreases at each loop iteration.
5. The VCG automates Hoare logic proofs by reducing program verification to pure mathematical obligations.
6. The user must supply loop invariants; the VCG handles everything else.

---

## 10. Exercises

**Exercise 8b.1.** Verify the following triple using the Hoare logic rules (pen and paper):
$$\{x = a \wedge y = b\}\; t := x;\; x := y;\; y := t\; \{x = b \wedge y = a\}$$

**Exercise 8b.2.** Give a loop invariant and verify: $\{n \ge 0\}\; \text{(power program)}\; \{r = b^n\}$ where the program computes $b^n$ by repeated multiplication.

**Exercise 8b.3.** Prove in Isabelle that the While rule is sound: the While case of the soundness proof.

**Exercise 8b.4.** Explain why the rule of consequence is necessary. Give an example of a valid Hoare triple that cannot be derived without it.

**Exercise 8b.5.** Formalize the summation program example in Isabelle using the VCG. State the loop invariant and verify that all VCs are discharged.

---

## References

- Hoare, C.A.R. (1969). An axiomatic basis for computer programming. *Communications of the ACM*, 12(10), 576--580.
- Cook, S.A. (1978). Soundness and completeness of an axiom system for program verification. *SIAM Journal on Computing*, 7(1), 70--90.
- Nipkow, T. and Klein, G. (2014). *Concrete Semantics*. Chapters 12--13.
- Winskel, G. (1993). *The Formal Semantics of Programming Languages*. Chapters 6--7.
