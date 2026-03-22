# Recitation 08: IMP Proofs

## 1. Overview

This recitation is a hands-on exercise session in which we verify simple IMP programs using Hoare logic in Isabelle/HOL. We will work through three complete examples: a variable swap, a factorial computation, and a GCD algorithm.

**Outline:**

1. Setup: importing HOL-IMP theories.
2. Example 1: Verifying a swap program.
3. Example 2: Verifying a factorial program.
4. Example 3: Writing and verifying a GCD program.
5. Practice with loop invariants.

---

## 2. Setup

### 2.1 Imports

Create a new theory file:

```isabelle
theory Recitation_08
  imports "HOL-IMP.VCG"
begin
```

This imports the IMP language definitions, big-step semantics, Hoare logic, and the VCG.

### 2.2 Abbreviations

For readability, define some abbreviations:

```isabelle
abbreviation "x" where "x \<equiv> ''x''"
abbreviation "y" where "y \<equiv> ''y''"
abbreviation "t" where "t \<equiv> ''t''"
abbreviation "s" where "s \<equiv> ''s''"
abbreviation "n" where "n \<equiv> ''n''"
abbreviation "i" where "i \<equiv> ''i''"
```

---

## 3. Example 1: Swap

### 3.1 The Program

Swap variables `x` and `y` using a temporary variable `t`:

```isabelle
definition swap :: com where
  "swap =
    t ::= V x;;
    x ::= V y;;
    y ::= V t"
```

### 3.2 Specification

$$\{x = a \wedge y = b\}\; \text{swap}\; \{x = b \wedge y = a\}$$

### 3.3 Proof Using Hoare Rules

```isabelle
lemma swap_correct:
  "\<turnstile> {\<lambda>s. s x = a \<and> s y = b}
      swap
     {\<lambda>s. s x = b \<and> s y = a}"
  unfolding swap_def
  by (rule Seq) (rule Seq, rule Assign, rule Assign, rule Assign)
```

### 3.4 Proof Using VCG

The VCG method is simpler:

```isabelle
lemma swap_correct_vcg:
  "\<turnstile> {\<lambda>s. s x = a \<and> s y = b}
      swap
     {\<lambda>s. s x = b \<and> s y = a}"
  unfolding swap_def
  by vcg
```

### 3.5 Discussion

This is a straight-line program (no loops), so:
- No loop invariant is needed.
- The VCG simply applies the assignment rule backward three times.
- The generated VC is trivially true.

---

## 4. Example 2: Factorial

### 4.1 The Program

Compute `n!` and store it in `s` (using multiplication defined as repeated addition, or assuming IMP has been extended with multiplication):

For simplicity, we will verify a summation program instead (since IMP as defined in Concrete Semantics lacks multiplication):

```isabelle
definition sum_to_n :: com where
  "sum_to_n =
    s ::= N 0;;
    i ::= N 1;;
    WHILE Not (Less (V n) (V i)) DO (
      s ::= Plus (V s) (V i);;
      i ::= Plus (V i) (N 1)
    )"
```

### 4.2 Specification

$$\{n \ge 0\}\; \text{sum\_to\_n}\; \{s = n \cdot (n+1) / 2\}$$

Since we are working with integers and IMP has only addition, we rewrite the postcondition as $2 \cdot s = n \cdot (n + 1)$.

### 4.3 The Loop Invariant

The key creative step is choosing the invariant:

$$I \equiv 2 \cdot s = (i - 1) \cdot i \wedge 1 \le i \wedge i \le n + 1$$

**Checking the invariant:**

1. *Initialization*: After `s := 0; i := 1`, we have $2 \cdot 0 = 0 \cdot 1 = 0$ and $1 \le 1 \le n + 1$ (since $n \ge 0$). Good.

2. *Preservation*: Assume $I$ holds and $i \le n$ (guard is true). After `s := s + i; i := i + 1`:
   - New $s' = s + i$, new $i' = i + 1$.
   - $2 \cdot s' = 2s + 2i = (i-1) \cdot i + 2i = i(i-1+2) = i(i+1) = (i'-1) \cdot i'$. Good.
   - $1 \le i' = i + 1$ and $i' = i + 1 \le n + 1$ (since $i \le n$). Good.

3. *Postcondition*: When the guard is false ($i > n$) and $I$ holds: $i = n + 1$ (since $i \le n + 1$ and $i > n$), so $2s = n(n+1)$. Good.

### 4.4 Annotated Proof in Isabelle

```isabelle
lemma sum_to_n_correct:
  "\<turnstile> {\<lambda>s. s n \<ge> 0}
      sum_to_n
     {\<lambda>st. 2 * st s = st n * (st n + 1)}"
  unfolding sum_to_n_def
  apply (rule Seq)    -- process the initial assignments
   apply (rule Assign)
  apply (rule Seq)
   apply (rule Assign)
  -- Now we need to supply the loop invariant
  apply (rule While'[where P="\<lambda>st. 2 * st s = (st i - 1) * st i
                                    \<and> 1 \<le> st i \<and> st i \<le> st n + 1"])
  -- Three subgoals:
  -- 1. Invariant is preserved by loop body
  -- 2. Invariant + negated guard implies postcondition
  -- 3. Invariant holds initially
    apply auto
  done
```

Alternatively, using the VCG with an annotated while loop. In HOL-IMP, the VCG expects loop invariants to be supplied inline using annotated commands (`acom`). The key is to wrap the while loop with the `WHILE _ INV _ DO` syntax (provided by `HOL-IMP.VCG`):

```isabelle
lemma sum_to_n_correct_vcg:
  "\<turnstile> {\<lambda>st. st n \<ge> 0}
      s ::= N 0;;
      i ::= N 1;;
      WHILE Not (Less (V n) (V i))
        INV {\<lambda>st. 2 * st s = (st i - 1) * st i
                  \<and> 1 \<le> st i \<and> st i \<le> st n + 1}
      DO (
        s ::= Plus (V s) (V i);;
        i ::= Plus (V i) (N 1)
      )
     {\<lambda>st. 2 * st s = st n * (st n + 1)}"
  by vcg_simp
```

Let us also see what happens if we break this into steps to understand the VCG's output:

```isabelle
lemma sum_to_n_correct_vcg_detailed:
  "\<turnstile> {\<lambda>st. st n \<ge> 0}
      s ::= N 0;;
      i ::= N 1;;
      WHILE Not (Less (V n) (V i))
        INV {\<lambda>st. 2 * st s = (st i - 1) * st i
                  \<and> 1 \<le> st i \<and> st i \<le> st n + 1}
      DO (
        s ::= Plus (V s) (V i);;
        i ::= Plus (V i) (N 1)
      )
     {\<lambda>st. 2 * st s = st n * (st n + 1)}"
  apply vcg
```

After `apply vcg`, three subgoals appear:

**Subgoal 1** (initialization --- the precondition implies the invariant after `s := 0; i := 1`):

```
\<And>st. st n \<ge> 0
  \<Longrightarrow> 2 * 0 = (1 - 1) * 1 \<and> 1 \<le> 1 \<and> 1 \<le> st n + 1
```

**Subgoal 2** (preservation --- the invariant and guard imply the invariant after one iteration):

```
\<And>st. \<lbrakk> 2 * st s = (st i - 1) * st i;
         1 \<le> st i; st i \<le> st n + 1;
         \<not> st n < st i \<rbrakk>
  \<Longrightarrow> 2 * (st s + st i) = ((st i + 1) - 1) * (st i + 1)
      \<and> 1 \<le> st i + 1 \<and> st i + 1 \<le> st n + 1
```

**Subgoal 3** (postcondition --- the invariant and negated guard imply the postcondition):

```
\<And>st. \<lbrakk> 2 * st s = (st i - 1) * st i;
         1 \<le> st i; st i \<le> st n + 1;
         st n < st i \<rbrakk>
  \<Longrightarrow> 2 * st s = st n * (st n + 1)
```

All three are discharged by `auto` (which handles the linear and polynomial arithmetic):

```isabelle
    apply auto
  done
```

The complete proof is just `by vcg_simp` (which combines `vcg` and `simp`), but the step-by-step version above is instructive for understanding what the VCG produces.

### 4.5 Discussion

The creative step is the invariant. Once the invariant is provided, verification is mechanical:
- The VCG generates three VCs (initialization, preservation, postcondition).
- Each VC is an arithmetic identity that `auto` or `arith` can discharge.

---

## 5. Example 3: GCD

### 5.1 The Program

Euclid's algorithm by repeated subtraction:

```isabelle
definition gcd_prog :: com where
  "gcd_prog =
    WHILE Not (And (Not (Less (V x) (V y))) (Not (Less (V y) (V x)))) DO (
      IF Less (V x) (V y) THEN
        y ::= Minus (V y) (V x)
      ELSE
        x ::= Minus (V x) (V y)
    )"
```

**Note:** IMP's `bexp` type has no `Equal` constructor. We encode `x \<noteq> y` as `Not (And (Not (Less x y)) (Not (Less y x)))`, which is equivalent to `x < y \<or> y < x`. For subtraction, we assume an extended IMP with a `Minus` constructor in `aexp` (as is common in textbook exercises extending the base IMP language).

### 5.2 Specification

$$\{x = a \wedge y = b \wedge a > 0 \wedge b > 0\}\; \text{gcd\_prog}\; \{x = \gcd(a, b)\}$$

### 5.3 The Loop Invariant

$$I \equiv \gcd(x, y) = \gcd(a, b) \wedge x > 0 \wedge y > 0$$

**Checking:**

1. *Initialization*: $\gcd(a, b) = \gcd(a, b)$ and $a > 0, b > 0$. Good.
2. *Preservation*: If $x \ne y$ and $x < y$, then $\gcd(x, y - x) = \gcd(x, y)$ (standard property of GCD). Similarly if $x \ge y$. Also $y - x > 0$ since $y > x > 0$.
3. *Postcondition*: When $x = y$: $\gcd(x, y) = x = \gcd(a, b)$. Good.

### 5.4 Supporting Lemmas

The GCD invariant requires mathematical properties of GCD. We first establish the key lemma: $\gcd(a, b) = \gcd(a, b - a)$ when $b > a > 0$. In Isabelle, the `gcd` function is defined on natural numbers, so we work with `nat`.

Since IMP operates on integers, we need a version of the GCD program that works with `nat`. In practice, the precondition `a > 0 \<and> b > 0` ensures the values stay positive, so we can use the `nat` version of `gcd`. Isabelle's library already provides the key fact we need:

```isabelle
lemma gcd_diff1: "b > a \<Longrightarrow> a > 0 \<Longrightarrow> gcd a (b - a) = gcd a (b::nat)"
  by (metis gcd.commute gcd_diff2 less_imp_le)
```

Here `gcd_diff2` from the Isabelle library states `a \<le> b \<Longrightarrow> gcd (b - a) a = gcd b a`. We also need the symmetric case:

```isabelle
lemma gcd_diff_sym: "a > b \<Longrightarrow> b > 0 \<Longrightarrow> gcd (a - b) b = gcd a (b::nat)"
  by (metis gcd_diff2 less_imp_le)
```

And a fact about GCD when the two arguments are equal:

```isabelle
lemma gcd_self: "gcd a a = (a::nat)"
  by simp
```

### 5.5 The Complete GCD Proof (Using Hoare Rules)

We define the program using `nat`-valued variables (extending IMP with subtraction as noted above). The while guard encodes `x \<noteq> y`:

```isabelle
definition gcd_prog :: com where
  "gcd_prog =
    WHILE Not (And (Not (Less (V x) (V y)))
                   (Not (Less (V y) (V x)))) DO (
      IF Less (V x) (V y) THEN
        y ::= Minus (V y) (V x)
      ELSE
        x ::= Minus (V x) (V y)
    )"
```

The proof proceeds by supplying the invariant $\gcd(x, y) = \gcd(a, b) \wedge x > 0 \wedge y > 0$:

```isabelle
lemma gcd_prog_correct:
  "\<turnstile> {\<lambda>st. st x = a \<and> st y = b \<and> a > 0 \<and> b > 0}
      gcd_prog
     {\<lambda>st. st x = gcd a b}"
  unfolding gcd_prog_def
  apply (rule While'[where P="\<lambda>st. gcd (st x) (st y) = gcd a b
                                     \<and> st x > 0 \<and> st y > 0"])
  -- Subgoal 1: Invariant is preserved by the loop body
  -- Subgoal 2: Invariant + negated guard implies postcondition
  -- Subgoal 3: Precondition implies invariant
  defer
  -- Handle the postcondition subgoal first (easiest):
  -- When the guard is false, x = y, so gcd(x,y) = x = gcd(a,b).
    apply clarsimp
    apply (metis gcd_self le_antisym not_less)
  -- Handle the invariant preservation:
  -- The body is IF x < y THEN y := y - x ELSE x := x - y.
   apply (rule If)
    -- Case: x < y, so we do y := y - x
    apply (rule Assign')
    apply clarsimp
    apply (metis gcd_diff1)
   -- Case: x >= y, so we do x := x - y
   apply (rule Assign')
   apply clarsimp
   apply (smt (verit) gcd_diff_sym linorder_neqE_nat)
  -- Handle initialization: precondition implies invariant
  apply simp
  done
```

### 5.6 The GCD Proof Using VCG

The VCG version is more concise. We supply the invariant inline:

```isabelle
lemma gcd_prog_correct_vcg:
  "\<turnstile> {\<lambda>st. st x = a \<and> st y = b \<and> a > 0 \<and> b > 0}
      WHILE Not (And (Not (Less (V x) (V y)))
                     (Not (Less (V y) (V x))))
        INV {\<lambda>st. gcd (st x) (st y) = gcd a b
                  \<and> st x > 0 \<and> st y > 0}
      DO (
        IF Less (V x) (V y) THEN
          y ::= Minus (V y) (V x)
        ELSE
          x ::= Minus (V x) (V y)
      )
     {\<lambda>st. st x = gcd a b}"
  apply vcg
```

The VCG generates three subgoals. Unlike the summation example, these are *not* simple arithmetic --- they require reasoning about GCD:

**Subgoal 1** (preservation, case `x < y`):

```
\<And>st. \<lbrakk> gcd (st x) (st y) = gcd a b;
         st x > 0; st y > 0; st x < st y \<rbrakk>
  \<Longrightarrow> gcd (st x) (st y - st x) = gcd a b
      \<and> st x > 0 \<and> st y - st x > 0
```

**Subgoal 2** (preservation, case `x >= y` and `x \<noteq> y`):

```
\<And>st. \<lbrakk> gcd (st x) (st y) = gcd a b;
         st x > 0; st y > 0; \<not> st x < st y; st y < st x \<rbrakk>
  \<Longrightarrow> gcd (st x - st y) (st y) = gcd a b
      \<and> st x - st y > 0 \<and> st y > 0
```

**Subgoal 3** (postcondition):

```
\<And>st. \<lbrakk> gcd (st x) (st y) = gcd a b;
         st x > 0; st y > 0;
         \<not> st x < st y; \<not> st y < st x \<rbrakk>
  \<Longrightarrow> st x = gcd a b
```

We discharge them using our supporting lemmas:

```isabelle
  apply (auto simp: gcd_diff1 gcd_diff_sym
              intro: le_antisym dest: not_less[THEN iffD1])
  done
```

Alternatively, if `auto` does not close everything in one shot, we can be more explicit:

```isabelle
  apply clarsimp
  apply (safe; (metis gcd_diff1 gcd_diff_sym gcd_self le_antisym
                      linorder_neqE_nat less_imp_le)?)
  done
```

### 5.7 Discussion

The GCD example illustrates a key difference from the summation example: the VCG-generated subgoals require *domain-specific mathematical reasoning* (properties of GCD) rather than just arithmetic simplification. This is the general pattern:

1. The VCG is a *syntax-directed* procedure that decomposes the program.
2. The resulting subgoals are *semantic* --- they depend on the mathematical content of the program.
3. Simple programs (summation, swap) produce subgoals that `auto` or `arith` can handle.
4. Programs involving richer mathematics (GCD, sorting, cryptography) require lemmas from Isabelle's library or custom-proved mathematical facts.

---

## 6. Guidelines for Finding Loop Invariants

### 6.1 General Strategy

1. **Start with the postcondition.** The invariant is often the postcondition generalized to hold at any loop iteration.

2. **Identify what varies.** Determine which variables change during the loop. The invariant must relate the changing values to the fixed initial values.

3. **Include range constraints.** The invariant should constrain loop variables to valid ranges (e.g., $1 \le i \le n + 1$).

4. **Check three conditions:**
   - Initialization: the invariant holds before the loop.
   - Preservation: the invariant is maintained by each iteration.
   - Postcondition: the invariant plus the negated guard implies the desired result.

### 6.2 Common Patterns

| Program | Invariant pattern |
|---|---|
| Accumulation (sum, product) | "accumulated result equals partial computation" |
| Search (linear, binary) | "target is in the remaining search space" |
| Two-pointer (GCD, merge) | "relationship between current and initial values" |
| Counter loop | "result = f(counter) and 0 <= counter <= n" |

---

## 7. Practice Problems

### Problem R8.1: Exponentiation

Write an IMP program that computes $2^n$ by repeated doubling. State the loop invariant, verify the three conditions by hand, and formalize the proof in Isabelle.

### Problem R8.2: Maximum of Two Variables

Write an IMP program that stores $\max(x, y)$ in a variable `m`. This is a straight-line program (no loop). Verify it using the VCG.

### Problem R8.3: Counting Down

Write an IMP program that counts variable `x` down to 0, incrementing `y` at each step. Prove $\{x \ge 0\}\; \text{prog}\; \{y = x_0\}$ where $x_0$ is the initial value of $x$.

### Problem R8.4: Fibonacci

Write an IMP program that computes the $n$-th Fibonacci number. State the loop invariant (which will need two state variables tracking consecutive Fibonacci numbers). Verify the VCs by hand.

### Problem R8.5: Invariant Debugging

The following invariant is *wrong* for the summation program:

$$I_{\text{bad}} \equiv s = (i - 1) \cdot i / 2$$

Explain why it fails (which of the three conditions --- initialization, preservation, postcondition --- breaks?). Fix it.

---

## References

- Nipkow, T. and Klein, G. (2014). *Concrete Semantics*. Chapters 7, 12.
- Hoare, C.A.R. (1969). An axiomatic basis for computer programming.
- Isabelle session: `HOL-IMP` (in the Isabelle distribution).
