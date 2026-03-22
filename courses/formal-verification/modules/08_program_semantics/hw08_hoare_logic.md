# Homework 08: Hoare Logic

> **Module 08 --- Program Semantics & Hoare Logic**
> **Due:** Two weeks after assignment
> **Estimated time:** ~22 hours
> **Total points:** 200

---

## Instructions

- Submit Isabelle `.thy` files that check without errors (no `sorry`).
- For theory problems, provide complete proofs with all steps justified.
- For Isabelle problems, use the `HOL-IMP` session (import `"HOL-IMP.VCG"` or individual theories as needed).
- You may use `auto`, `simp`, `blast`, `arith`, `vcg`, and Sledgehammer. For problems marked "structured proof," use Isar-style `proof`/`qed`.
- Collaboration policy: discuss ideas freely, but write and submit your own work.

---

## Part A: Operational Semantics (40 points)

### Problem A1: Extended IMP (15 pts)

**(a)** (5 pts) Extend the IMP command language with a `For` loop:

```isabelle
For :: "vname => aexp => aexp => com => com"
```

where `For x lo hi body` executes `body` for $x = \text{lo}, \text{lo}+1, \ldots, \text{hi}$. Give the big-step semantics rule(s).

**(b)** (5 pts) Show that `For` is syntactic sugar: translate `For x lo hi body` into an equivalent IMP program using `While`, and prove the equivalence.

**(c)** (5 pts) Extend IMP with a `Repeat body Until b` command (executes `body` at least once, then checks condition). Give the big-step rules and prove equivalence with the corresponding `While` program.

### Problem A2: Semantic Properties (15 pts)

**(a)** (5 pts) Prove in Isabelle that `WHILE Bc True DO SKIP` diverges from every state. Specifically, show there is no $t$ such that `(WHILE Bc True DO SKIP, s) \<Rightarrow> t`. *Hint:* use rule induction.

**(b)** (5 pts) Prove semantic equivalence of `IF b THEN c ELSE c` and `c`:

```isabelle
lemma "(IF b THEN c ELSE c, s) \<Rightarrow> t \<longleftrightarrow> (c, s) \<Rightarrow> t"
```

**(c)** (5 pts) Two commands $c_1$ and $c_2$ are *semantically equivalent* if they produce the same final states from any initial state. Prove that sequential composition is associative:

```isabelle
lemma "((c1;; c2);; c3, s) \<Rightarrow> t \<longleftrightarrow> (c1;; (c2;; c3), s) \<Rightarrow> t"
```

### Problem A3: Small-Step Properties (10 pts)

**(a)** (5 pts) Prove that the small-step semantics is deterministic: if $(c, s) \to (c_1', s_1')$ and $(c, s) \to (c_2', s_2')$, then $c_1' = c_2'$ and $s_1' = s_2'$.

**(b)** (5 pts) Prove the following: if $(c_1, s) \to^* (SKIP, s')$, then $(c_1;; c_2, s) \to^* (c_2, s')$.

---

## Part B: Hoare Logic (80 points)

### Problem B1: Pen-and-Paper Proofs (20 pts)

For each program, state the loop invariant and prove the Hoare triple using the Hoare rules (pen and paper). Show the complete proof tree.

**(a)** (10 pts)

$$\{x = a \wedge a \ge 0\}\; y := 0;\; \text{WHILE } x > 0 \text{ DO } (y := y + x;\; x := x - 1)\; \{y = a(a+1)/2\}$$

**(b)** (10 pts)

$$\{a \ge 0 \wedge b \ge 0\}\; r := a;\; \text{WHILE } r \ge b \text{ DO } r := r - b\; \{0 \le r < b \wedge \exists q.\, a = b \cdot q + r\}$$

### Problem B2: Isabelle Hoare Proofs (30 pts)

Formalize and prove the following in Isabelle using the VCG or explicit Hoare rule application:

**(a)** (10 pts) **Exponentiation by squaring** (simplified): compute $2^n$:

```
r := 1; b := 2; e := n;
WHILE e > 0 DO (
  r := r + r;    (* r := r * 2 -- simplified: double r *)
  e := e - 1
)
```

State the loop invariant and prove $\{n \ge 0\}\; \text{prog}\; \{r = 2^n\}$ (assuming multiplication or encoding doubling as `r + r`).

**(b)** (10 pts) **Integer square root**: compute $\lfloor\sqrt{n}\rfloor$:

```
r := 0;
WHILE (r + 1) * (r + 1) <= n DO (
  r := r + 1
)
```

Prove $\{n \ge 0\}\; \text{prog}\; \{r^2 \le n < (r+1)^2\}$. State the loop invariant.

**(c)** (10 pts) **Array initialization** (simulated): initialize positions 0 through $n-1$:

```
i := 0;
WHILE i < n DO (
  a_i := 0;    (* conceptually: a[i] := 0, using indexed variable names *)
  i := i + 1
)
```

Since IMP does not have arrays, model this using a family of variables or discuss how the proof would work with an array model. Prove the relevant Hoare triple with a suitable invariant.

### Problem B3: Total Correctness (15 pts)

**(a)** (5 pts) State the total correctness While rule. Explain the role of the variant (well-founded measure).

**(b)** (10 pts) Prove total correctness for the summation program from Recitation 08. The variant is $n + 1 - i$. Show that it is non-negative when the guard is true and decreases with each iteration.

### Problem B4: Soundness Proof (15 pts)

**(a)** (10 pts) Prove the soundness of the Assign rule in Isabelle: if $P[a/x]$ holds in state $s$ and $(x := a, s) \Rightarrow t$, then $P$ holds in state $t$. Provide a structured Isar proof.

**(b)** (5 pts) Prove the soundness of the Consequence rule in Isabelle.

---

## Part C: SIMPL and Monads (40 points)

### Problem C1: SIMPL Programs (20 pts)

**(a)** (10 pts) Write a SIMPL program for computing the absolute value of an integer variable `x`, storing the result in `r`. Use `Guard` to model the assumption that $x \ne \text{INT\_MIN}$ (since negating INT_MIN overflows in C). Specify and verify it using SIMPL's Hoare logic.

**(b)** (10 pts) Write a SIMPL program with a procedure `max` that takes two values and returns the maximum. Write a caller that invokes `max` and stores the result. Verify the caller-callee combination.

### Problem C2: Monadic Specifications (20 pts)

**(a)** (10 pts) Define a monadic function `find_first` that searches a list for the first element satisfying a predicate, returning it via the error monad (throwing if not found):

```isabelle
fun find_first :: "('a => bool) => 'a list => ('s, 'e, 'a) nondet_monad_e" where
  ...
```

Prove a correctness specification using a monadic Hoare triple.

**(b)** (10 pts) Define monadic functions `push` and `pop` for a stack implemented as a list stored in the state. Prove that `push x >> pop` returns `x` and leaves the stack unchanged:

```isabelle
\<lbrace>\<lambda>s. stack_' s = stk\<rbrace> push x >> pop \<lbrace>\<lambda>r s. r = x \<and> stack_' s = stk\<rbrace>
```

---

## Part D: Theory Questions (40 points)

### Problem D1: Comparison of Semantics (15 pts)

**(a)** (5 pts) Give an example of a property that is easier to prove using big-step semantics than small-step semantics. Explain why.

**(b)** (5 pts) Give an example of a property that *requires* small-step semantics (i.e., cannot be naturally expressed or proved with big-step). Explain why.

**(c)** (5 pts) Describe denotational semantics (informally) and explain how it relates to operational semantics. What is the connection to fixed-point theory?

### Problem D2: Completeness (10 pts)

**(a)** (5 pts) State Cook's relative completeness theorem precisely. What does "relative" mean?

**(b)** (5 pts) Give an example of a valid Hoare triple whose weakest precondition is not expressible in Presburger arithmetic. What does this say about the assertion language needed for completeness?

### Problem D3: Scaling Up (15 pts)

**(a)** (5 pts) Explain the role of the `Guard` construct in SIMPL. How does it relate to C's undefined behavior?

**(b)** (5 pts) Why does seL4 use monadic specifications rather than SIMPL directly? What advantages does the monadic approach provide for a 10,000-line C codebase?

**(c)** (5 pts) The `crunch` tool can automatically prove invariant preservation across function call chains. Describe a scenario where crunch would fail and manual proof is required. What structural property of the program causes the failure?

---

## References

- Nipkow, T. and Klein, G. (2014). *Concrete Semantics with Isabelle/HOL*. Chapters 7--14.
- Hoare, C.A.R. (1969). An axiomatic basis for computer programming.
- Schirmer, N. (2005). Verification of sequential imperative programs in Isabelle/HOL. PhD thesis.
- Cock, D., Klein, G., and Sewell, T. (2008). Secure microkernels, state monads and scalable refinement.
- Klein, G., et al. (2014). Comprehensive formal verification of an OS microkernel.
