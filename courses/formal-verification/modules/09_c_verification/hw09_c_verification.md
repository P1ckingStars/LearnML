# HW9: C Verification

> **Module 09 --- C Verification: Parser, AutoCorres & Proofs**
> Due: end of Week 18

---

## Instructions

This assignment asks you to verify C functions of increasing complexity using AutoCorres. For each problem:

1. Write the C source file (or use the provided source).
2. Create an Isabelle theory file that parses and abstracts the C code.
3. State the required specification as a lemma.
4. Prove the lemma.

Submit the following for each problem:
- The `.c` source file.
- The `.thy` theory file containing the proof.

All proofs must be complete (no `sorry`). You may use any Isabelle tactics. Clearly comment your proofs to explain the proof strategy.

---

## Problem 1: Minimum of Three (10 points)

Write and verify:

```c
unsigned int min3(unsigned int a, unsigned int b, unsigned int c) {
    unsigned int m = a;
    if (b < m) m = b;
    if (c < m) m = c;
    return m;
}
```

**Specification**: prove all three of the following:

```isabelle
lemma min3_le_a: "min3' a b c \<le> a"
lemma min3_le_b: "min3' a b c \<le> b"
lemma min3_le_c: "min3' a b c \<le> c"
```

Use `unsigned_word_abs` for cleaner reasoning.

---

## Problem 2: Integer Square Root (15 points)

Write and verify:

```c
unsigned int isqrt(unsigned int n) {
    unsigned int x = 0;
    while ((x + 1) * (x + 1) <= n) {
        x = x + 1;
    }
    return x;
}
```

**Specification**: prove that the result `x` satisfies:

```isabelle
lemma isqrt_correct:
  "isqrt' n = x \<Longrightarrow> x * x \<le> n \<and> n < (x + 1) * (x + 1)"
```

**Requirements**:
- Provide a loop invariant.
- Provide a termination measure.
- Use `unsigned_word_abs`.

---

## Problem 3: Binary Search (15 points)

Write and verify:

```c
unsigned int binary_search(unsigned int *arr, unsigned int n, unsigned int key) {
    unsigned int lo = 0;
    unsigned int hi = n;
    while (lo < hi) {
        unsigned int mid = lo + (hi - lo) / 2;
        if (arr[mid] < key) {
            lo = mid + 1;
        } else if (arr[mid] > key) {
            hi = mid;
        } else {
            return mid;
        }
    }
    return n;  /* not found */
}
```

**Specification**: assuming the array is sorted, prove:

```isabelle
lemma binary_search_found:
  "\<lbrakk> binary_search' arr n key s = (i, s');
     i < n;
     sorted arr n s;
     valid_array arr n s \<rbrakk>
   \<Longrightarrow> heap_w32 s (arr +\<^sub>p int i) = key"

lemma binary_search_not_found:
  "\<lbrakk> binary_search' arr n key s = (n, s');
     sorted arr n s;
     valid_array arr n s \<rbrakk>
   \<Longrightarrow> \<forall>j < n. heap_w32 s (arr +\<^sub>p int j) \<noteq> key"
```

Define `sorted` and `valid_array` appropriately. The loop invariant must capture that `key` is not in `arr[0..lo-1]` or `arr[hi..n-1]`.

---

## Problem 4: Reverse Array In-Place (15 points)

Write and verify:

```c
void reverse(unsigned int *arr, unsigned int n) {
    unsigned int i = 0;
    while (i < n / 2) {
        unsigned int tmp = arr[i];
        arr[i] = arr[n - 1 - i];
        arr[n - 1 - i] = tmp;
        i = i + 1;
    }
}
```

**Specification**: prove that after `reverse`, the array contents are reversed:

```isabelle
lemma reverse_correct:
  "\<lbrace> \<lambda>s. valid_array s arr n \<and>
         (\<forall>j < n. heap_w32 s (arr +\<^sub>p int j) = old_vals j) \<rbrace>
   reverse' arr n
   \<lbrace> \<lambda>_ s. \<forall>j < n. heap_w32 s (arr +\<^sub>p int j) = old_vals (n - 1 - j) \<rbrace>!"
```

**Requirements**:
- The loop invariant must describe the partial reversal: elements `0..i-1` have been swapped with elements `n-i..n-1`, and elements `i..n-1-i` are unchanged.
- This is a heap-modifying function, so you must reason about `heap_update`.

---

## Problem 5: String Length (10 points)

Write and verify:

```c
unsigned int str_len(char *s) {
    unsigned int len = 0;
    while (s[len] != 0) {
        len = len + 1;
    }
    return len;
}
```

**Specification**: prove that the result is the index of the first null byte:

```isabelle
lemma str_len_correct:
  "\<lbrace> \<lambda>s. (\<exists>k. heap_char s (str +\<^sub>p int k) = 0 \<and>
             (\<forall>j < k. heap_char s (str +\<^sub>p int j) \<noteq> 0) \<and>
             (\<forall>j \<le> k. is_valid_char s (str +\<^sub>p int j))) \<rbrace>
   str_len' str
   \<lbrace> \<lambda>rv s. heap_char s (str +\<^sub>p int rv) = 0 \<and>
           (\<forall>j < rv. heap_char s (str +\<^sub>p int j) \<noteq> 0) \<rbrace>!"
```

Note the termination requirement: there must exist a null terminator within valid memory.

---

## Problem 6: Fibonacci (10 points)

Write and verify:

```c
unsigned int fib(unsigned int n) {
    if (n == 0) return 0;
    if (n == 1) return 1;
    unsigned int a = 0;
    unsigned int b = 1;
    unsigned int i = 2;
    while (i <= n) {
        unsigned int tmp = a + b;
        a = b;
        b = tmp;
        i = i + 1;
    }
    return b;
}
```

**Specification**: prove that the result equals the mathematical Fibonacci function:

```isabelle
lemma fib_correct:
  "fib' n = fib_math n"
```

Define `fib_math` using Isabelle's `fun`:

```isabelle
fun fib_math :: "nat \<Rightarrow> nat"
where
  "fib_math 0 = 0"
| "fib_math (Suc 0) = 1"
| "fib_math (Suc (Suc n)) = fib_math (Suc n) + fib_math n"
```

The loop invariant should state `a = fib_math (i - 2)` and `b = fib_math (i - 1)`.

---

## Problem 7: Insertion Sort (15 points)

Write and verify a single insertion step:

```c
void insert(unsigned int *arr, unsigned int pos) {
    unsigned int key = arr[pos];
    unsigned int j = pos;
    while (j > 0 && arr[j - 1] > key) {
        arr[j] = arr[j - 1];
        j = j - 1;
    }
    arr[j] = key;
}
```

**Specification**: prove that after `insert`, `arr[0..pos]` is sorted, assuming `arr[0..pos-1]` was already sorted:

```isabelle
lemma insert_correct:
  "\<lbrace> \<lambda>s. valid_array s arr (pos + 1) \<and>
         sorted_upto s arr pos \<rbrace>
   insert' arr pos
   \<lbrace> \<lambda>_ s. sorted_upto s arr (pos + 1) \<rbrace>!"
```

Define `sorted_upto` to mean the subarray `arr[0..k-1]` is sorted.

---

## Problem 8: Linked List Length --- Challenge (10 points)

This problem is intentionally difficult. Partial credit is awarded for a well-structured attempt with `sorry` on difficult subgoals.

Write and verify:

```c
struct node {
    unsigned int val;
    struct node *next;
};

unsigned int list_length(struct node *head) {
    unsigned int len = 0;
    struct node *curr = head;
    while (curr != 0) {
        len = len + 1;
        curr = curr->next;
    }
    return len;
}
```

**Specification**: define a recursive predicate `is_list` relating a C linked list to an Isabelle list, then prove:

```isabelle
definition is_list ::
  "lifted_globals \<Rightarrow> node_C ptr \<Rightarrow> nat list \<Rightarrow> bool"
where
  "is_list s p xs \<equiv>
     (p = NULL \<and> xs = []) \<or>
     (\<exists>v rest p'.
        p \<noteq> NULL \<and>
        is_valid_node_C s p \<and>
        val_C (heap_node_C s p) = v \<and>
        next_C (heap_node_C s p) = p' \<and>
        xs = v # rest \<and>
        is_list s p' rest)"

lemma list_length_correct:
  "\<lbrace> \<lambda>s. is_list s head xs \<rbrace>
   list_length' head
   \<lbrace> \<lambda>rv s. rv = length xs \<rbrace>!"
```

**Hints**:
- The loop invariant must track: `curr` points to the suffix of the original list, and `len` equals the number of nodes already traversed.
- Termination requires that the list is finite and acyclic (which is implicit in the `is_list` predicate).
- You will need separation-logic-style reasoning or careful disjointness arguments to ensure that traversal does not visit the same node twice.
- This problem illustrates why linked data structures are significantly harder to verify than arrays.

---

## Grading

| Problem | Points | Difficulty |
|---------|--------|------------|
| 1. Minimum of Three | 10 | Easy |
| 2. Integer Square Root | 15 | Medium |
| 3. Binary Search | 15 | Medium-Hard |
| 4. Reverse Array | 15 | Medium-Hard |
| 5. String Length | 10 | Medium |
| 6. Fibonacci | 10 | Medium |
| 7. Insertion Sort | 15 | Hard |
| 8. Linked List (Challenge) | 10 | Very Hard |
| **Total** | **100** | |

---

## References

- Greenaway, D., Lim, J., Andronick, J., Klein, G. "Don't Sweat the Small Stuff." *PLDI*, 2014.
- AutoCorres2 examples in the l4v repository: `tools/autocorres/tests/examples/`.
- Tuch, H., Klein, G., Norrish, M. "Types, Bytes, and Separation Logic." *POPL*, 2007.
