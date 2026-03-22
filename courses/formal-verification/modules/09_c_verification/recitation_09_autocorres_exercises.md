# Recitation 09: AutoCorres Exercises

> **Module 09 --- C Verification: Parser, AutoCorres & Proofs**
> Estimated time: 2--3 hours (in-class)

---

## Overview

This recitation provides hands-on practice with the AutoCorres C verification workflow. You will verify four C functions of increasing complexity, building fluency with the parse-abstract-specify-prove pattern.

All exercises follow the same structure:

1. Write (or use the provided) C source file.
2. Parse with `install_C_file` and abstract with `autocorres`.
3. Examine the generated definition.
4. State a specification.
5. Prove it.

---

## Setup

Create a theory file that imports AutoCorres:

```isabelle
theory Recitation09
  imports AutoCorres2.AutoCorres
begin

(* We will install C files as we go *)

end
```

Ensure that each `.c` file is in the same directory as the `.thy` file or adjust paths accordingly.

---

## Exercise 1: Absolute Value (Pure Function)

### C Source

Create a file `abs_val.c`:

```c
unsigned int abs_val(int x) {
    if (x < 0) {
        return (unsigned int)(-x);
    } else {
        return (unsigned int)x;
    }
}
```

### Tasks

**1a.** Parse and abstract the function:

```isabelle
install_C_file "abs_val.c"
autocorres [signed_word_abs = abs_val] "abs_val.c"
```

**1b.** Examine the generated definition:

```isabelle
thm abs_val.abs_val'_def
```

What is the type of `abs_val'`? What monad did TS assign?

**1c.** Prove the following specification:

```isabelle
lemma abs_val_nonneg:
  "abs_val' x \<ge> 0"
```

**1d.** Prove that `abs_val'` agrees with Isabelle's built-in `abs`:

```isabelle
lemma abs_val_correct:
  "abs_val' x = \<bar>x\<bar>"
```

### Hints

- With `signed_word_abs`, the parameter `x` becomes an `int` (mathematical integer).
- The proof should follow by unfolding the definition and applying `simp` or `auto`.
- Recall that Isabelle's `abs` on integers is defined as `\<bar>x\<bar> = (if x < 0 then -x else x)`.

---

## Exercise 2: Swap Two Globals (Stateful Function)

### C Source

Create a file `swap_globals.c`:

```c
unsigned int g_a;
unsigned int g_b;

void swap_globals(void) {
    unsigned int tmp = g_a;
    g_a = g_b;
    g_b = tmp;
}
```

### Tasks

**2a.** Parse and abstract:

```isabelle
install_C_file "swap_globals.c"
autocorres "swap_globals.c"
```

**2b.** Examine the generated definition. What monad is `swap_globals'` in? Why is it not `pure`?

**2c.** Prove the swap specification:

```isabelle
lemma swap_globals_correct:
  "\<lbrace> \<lambda>s. g_a_' s = a \<and> g_b_' s = b \<rbrace>
   swap_globals'
   \<lbrace> \<lambda>_ s. g_a_' s = b \<and> g_b_' s = a \<rbrace>!"
```

**2d.** Prove that swapping twice is the identity:

```isabelle
lemma swap_twice:
  "\<lbrace> \<lambda>s. g_a_' s = a \<and> g_b_' s = b \<rbrace>
   do { swap_globals'; swap_globals' }
   \<lbrace> \<lambda>_ s. g_a_' s = a \<and> g_b_' s = b \<rbrace>!"
```

### Hints

- The function reads and writes global variables, so TS will assign it to `nondet` (or possibly `gets` + write).
- The proof should use `wp` followed by `clarsimp` or `auto`.
- For the double-swap proof, apply `wp` twice and simplify.

---

## Exercise 3: Find Minimum in Array (Heap + Loop)

### C Source

Create a file `find_min.c`:

```c
unsigned int find_min(unsigned int *arr, unsigned int n) {
    unsigned int min_val = arr[0];
    unsigned int i = 1;
    while (i < n) {
        if (arr[i] < min_val) {
            min_val = arr[i];
        }
        i = i + 1;
    }
    return min_val;
}
```

### Tasks

**3a.** Parse and abstract with heap syntax:

```isabelle
install_C_file "find_min.c"
autocorres [heap_abs_syntax, unsigned_word_abs = find_min] "find_min.c"
```

**3b.** Examine the definition. Identify:
- The whileLoop combinator
- The loop state variables
- The heap access for `arr[i]`

**3c.** Define the loop invariant. It should state:

- `min_val` is the minimum of `arr[0], ..., arr[i-1]`.
- `1 \<le> i \<le> n`.
- The array is valid.

```isabelle
definition find_min_inv ::
  "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> nat \<Rightarrow> nat \<times> nat \<Rightarrow> bool"
where
  "find_min_inv s arr n \<equiv> \<lambda>(min_val, i).
     1 \<le> i \<and> i \<le> n \<and>
     (\<forall>j < i. min_val \<le> heap_w32 s (arr +\<^sub>p int j)) \<and>
     (\<exists>j < i. min_val = heap_w32 s (arr +\<^sub>p int j)) \<and>
     (\<forall>j < n. is_valid_w32 s (arr +\<^sub>p int j))"
```

**3d.** Prove the specification:

```isabelle
lemma find_min_correct:
  assumes "n > 0"
  assumes "\<forall>j < n. is_valid_w32 s (arr +\<^sub>p int j)"
  shows "\<lbrace> \<lambda>s'. s' = s \<rbrace>
         find_min' arr n
         \<lbrace> \<lambda>rv s'. (\<forall>j < n. rv \<le> heap_w32 s' (arr +\<^sub>p int j)) \<and>
                   (\<exists>j < n. rv = heap_w32 s' (arr +\<^sub>p int j)) \<rbrace>!"
```

### Hints

- The precondition `n > 0` is needed because the function accesses `arr[0]` unconditionally.
- The function does not modify the heap, but the invariant must carry the validity predicate through the loop.
- Use `wp whileLoop_wp` with the invariant. The measure is `n - i`.

---

## Exercise 4: Iterative Sum with Early Exit

### C Source

Create a file `sum_until.c`:

```c
/* Sum array elements until a zero is encountered or the array ends. */
unsigned int sum_until_zero(unsigned int *arr, unsigned int n) {
    unsigned int sum = 0;
    unsigned int i = 0;
    while (i < n) {
        if (arr[i] == 0) {
            return sum;
        }
        sum = sum + arr[i];
        i = i + 1;
    }
    return sum;
}
```

### Tasks

**4a.** Parse and abstract. Note that early return within a loop introduces additional complexity in the AutoCorres output.

**4b.** Examine the definition. How does AutoCorres handle the early `return` inside the `while` loop? (Hint: it may use an `Either`-like type or a flag variable.)

**4c.** State a partial specification: if no element in `arr[0..n-1]` is zero, then the result equals the sum of all elements.

**4d.** State a specification for the early-exit case: if `arr[k]` is the first zero (all elements before it are nonzero), then the result equals the sum of `arr[0..k-1]`.

**4e.** Attempt to prove one of these specifications. If the proof becomes difficult, use `sorry` for subgoals and focus on the proof structure.

### Hints

- Early returns in loops are one of the more complex patterns for AutoCorres. The generated code may use a sum type to distinguish between "loop exited normally" and "function returned early."
- The loop invariant must track whether the early return has been taken.
- This exercise is intentionally challenging. The goal is to experience the proof engineering involved, not necessarily to complete the proof in the recitation session.

---

## Discussion Questions

1. How does the complexity of the proof relate to the complexity of the C code? Is there a linear relationship, or does complexity grow faster?

2. Which of the five AutoCorres phases had the biggest impact on proof simplicity for these exercises?

3. What would these proofs look like without AutoCorres, working directly with SIMPL? Consider how much longer the proofs would be.

4. For Exercise 3, what happens if we omit the `n > 0` precondition? Where does the proof break?

---

## References

- AutoCorres2 examples directory in the l4v repository.
- Greenaway, D., Lim, J., Andronick, J., Klein, G. "Don't Sweat the Small Stuff." *PLDI*, 2014.

---

*Next: [HW9: C Verification](hw09_c_verification.md)*
