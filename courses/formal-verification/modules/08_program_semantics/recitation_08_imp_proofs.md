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

Alternatively, using annotated while loops with the `acom` datatype and the full VCG:

```isabelle
lemma sum_to_n_correct_vcg:
  "\<turnstile> {\<lambda>st. st n \<ge> 0}
      s ::= N 0;;
      i ::= N 1;;
      WHILE Not (Less (V n) (V i)) DO (
        s ::= Plus (V s) (V i);;
        i ::= Plus (V i) (N 1)
      )
     {\<lambda>st. 2 * st s = st n * (st n + 1)}"
  -- supply invariant and use vcg
  sorry  -- full proof requires annotation mechanism
```

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

### 5.4 Discussion

The GCD invariant requires a mathematical property of GCD: $\gcd(a, b) = \gcd(a, b - a)$ for $b > a$. This must be proved as a separate lemma:

```isabelle
lemma gcd_subtract: "b > a \<Longrightarrow> a > 0 \<Longrightarrow> gcd a (b - a) = gcd a b"
```

This illustrates the general pattern: the VCG reduces program verification to mathematical obligations, but those obligations may themselves require non-trivial proofs.

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
