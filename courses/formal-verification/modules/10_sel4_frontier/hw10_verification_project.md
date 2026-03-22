# HW10: Verification Project

> **Module 10 --- seL4, Refinement & Frontier**
> Due: end of Week 20 (last day of class)

---

## Overview

This is the final assignment: a mini-capstone project in which you verify a complete C module end-to-end using AutoCorres. You will:

1. Write C code in the StrictC subset.
2. Parse it with `install_C_file` and abstract it with `autocorres`.
3. State a complete functional specification.
4. Prove correctness (at minimum, partial correctness).
5. Write a short report explaining your verification decisions.

Choose **one** of the three options below.

---

## Submission

Submit the following files:

- `module.c`: your C source file.
- `Verify.thy`: your Isabelle theory file containing all definitions, specifications, and proofs.
- `report.pdf`: a 2-page report (see Section 5).

All proofs must be complete (no `sorry`). If you cannot complete a proof, use `sorry` and explain in your report what remains and what approach you would take.

---

## Option A: Bump Allocator with Free List (Recommended difficulty: Medium-Hard)

### Description

Implement and verify a simple memory allocator that manages a contiguous region of memory. The allocator supports two operations:

- `alloc(size)`: allocate a block of the given size. Return a pointer to the block, or NULL if the allocator is out of space.
- `free(ptr)`: return a previously allocated block to the free list.

### C Source

```c
#define HEAP_SIZE 1024

unsigned int heap[HEAP_SIZE];
unsigned int bump_ptr;           /* next free position */

/* Simplified: allocate n words from the bump region */
unsigned int *bump_alloc(unsigned int n) {
    if (bump_ptr + n > HEAP_SIZE) {
        return 0;  /* NULL: out of memory */
    }
    unsigned int *result = &heap[bump_ptr];
    bump_ptr = bump_ptr + n;
    return result;
}

/* Free list (simplified): just reset the bump pointer */
void bump_reset(void) {
    bump_ptr = 0;
}
```

Note: this is a simplified allocator. You may modify the C code as needed for your verification, as long as it implements the allocator interface. In particular, you may use a more manageable representation if `&heap[bump_ptr]` (address-of array element) causes issues with the C parser. An alternative using explicit pointer arithmetic:

```c
unsigned int heap[HEAP_SIZE];
unsigned int bump_ptr;

unsigned int alloc(unsigned int n) {
    if (bump_ptr + n > HEAP_SIZE) {
        return HEAP_SIZE;  /* sentinel for failure */
    }
    unsigned int old = bump_ptr;
    bump_ptr = bump_ptr + n;
    return old;  /* return index, not pointer */
}

void reset(void) {
    bump_ptr = 0;
}
```

### Specification

Prove the following properties:

**A1. Successful allocation returns a valid region.**
```isabelle
lemma alloc_valid:
  "\<lbrace> \<lambda>s. bump_ptr_' s + n \<le> HEAP_SIZE \<rbrace>
   alloc' n
   \<lbrace> \<lambda>rv s. rv < HEAP_SIZE \<and> rv + n \<le> HEAP_SIZE \<rbrace>!"
```

**A2. Failed allocation returns the sentinel.**
```isabelle
lemma alloc_fail:
  "\<lbrace> \<lambda>s. bump_ptr_' s + n > HEAP_SIZE \<rbrace>
   alloc' n
   \<lbrace> \<lambda>rv s. rv = HEAP_SIZE \<rbrace>!"
```

**A3. Successive allocations return non-overlapping regions.**
```isabelle
lemma alloc_disjoint:
  "\<lbrace> \<lambda>s. bump_ptr_' s + n1 + n2 \<le> HEAP_SIZE \<rbrace>
   do { r1 \<leftarrow> alloc' n1; r2 \<leftarrow> alloc' n2; return (r1, r2) }
   \<lbrace> \<lambda>(r1, r2) s. r1 + n1 \<le> r2 \<or> r2 + n2 \<le> r1 \<rbrace>!"
```

**A4. Reset restores the allocator to its initial state.**
```isabelle
lemma reset_correct:
  "\<lbrace> \<top> \<rbrace> reset' \<lbrace> \<lambda>_ s. bump_ptr_' s = 0 \<rbrace>!"
```

---

## Option B: Ring Buffer (Recommended difficulty: Medium)

### Description

Implement and verify a fixed-size ring buffer (circular buffer) for unsigned integers. The buffer supports two operations:

- `enqueue(val)`: add a value to the back of the buffer. Return 1 on success, 0 if the buffer is full.
- `dequeue()`: remove and return the value at the front of the buffer. The buffer must not be empty (precondition).

### C Source

```c
#define BUF_SIZE 16

unsigned int buf[BUF_SIZE];
unsigned int head;     /* index of front element */
unsigned int tail;     /* index of next free slot */
unsigned int count;    /* number of elements */

unsigned int enqueue(unsigned int val) {
    if (count == BUF_SIZE) {
        return 0;  /* full */
    }
    buf[tail] = val;
    tail = (tail + 1) % BUF_SIZE;
    count = count + 1;
    return 1;  /* success */
}

unsigned int dequeue(void) {
    unsigned int val = buf[head];
    head = (head + 1) % BUF_SIZE;
    count = count - 1;
    return val;
}
```

### Specification

Define an abstract model of the ring buffer as an Isabelle list:

```isabelle
definition ring_abs :: "lifted_globals \<Rightarrow> nat list"
where
  "ring_abs s \<equiv>
     map (\<lambda>i. heap_w32 s (buf_ptr +\<^sub>p int ((head_' s + i) mod BUF_SIZE)))
         [0 ..< count_' s]"
```

Prove the following:

**B1. Enqueue adds to the back (when not full).**
```isabelle
lemma enqueue_correct:
  "\<lbrace> \<lambda>s. ring_inv s \<and> count_' s < BUF_SIZE \<and> xs = ring_abs s \<rbrace>
   enqueue' val
   \<lbrace> \<lambda>rv s. rv = 1 \<and> ring_abs s = xs @ [val] \<rbrace>!"
```

**B2. Dequeue removes from the front (when not empty).**
```isabelle
lemma dequeue_correct:
  "\<lbrace> \<lambda>s. ring_inv s \<and> count_' s > 0 \<and> xs = ring_abs s \<rbrace>
   dequeue'
   \<lbrace> \<lambda>rv s. rv = hd xs \<and> ring_abs s = tl xs \<rbrace>!"
```

**B3. Enqueue on a full buffer returns 0 and does not modify the buffer.**
```isabelle
lemma enqueue_full:
  "\<lbrace> \<lambda>s. ring_inv s \<and> count_' s = BUF_SIZE \<and> xs = ring_abs s \<rbrace>
   enqueue' val
   \<lbrace> \<lambda>rv s. rv = 0 \<and> ring_abs s = xs \<rbrace>!"
```

**Note:** The free variable `xs` captures the initial abstract buffer contents in the precondition, allowing the postcondition to refer to the pre-call state. This is a standard Isabelle pattern --- the monadic Hoare triple provides no built-in way to refer to the initial state from the postcondition.

**B4. The ring invariant is preserved by all operations.**

Define `ring_inv` to capture:
- `head < BUF_SIZE` and `tail < BUF_SIZE` and `count \<le> BUF_SIZE`.
- `tail = (head + count) mod BUF_SIZE`.
- All buffer slots are valid heap locations.

---

## Option C: Binary Search with Full Specification (Recommended difficulty: Medium-Hard)

### Description

Implement and verify a binary search function on a sorted array. This is Problem 3 from HW9, but with a complete specification and full proofs.

### C Source

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

### Specification

Define sortedness:

```isabelle
definition sorted_array :: "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> nat \<Rightarrow> bool"
where
  "sorted_array s arr n \<equiv>
     \<forall>i j. i < j \<and> j < n \<longrightarrow>
       heap_w32 s (arr +\<^sub>p int i) \<le> heap_w32 s (arr +\<^sub>p int j)"
```

Prove the following:

**C1. Correctness when found.**
```isabelle
lemma bsearch_found:
  "\<lbrace> \<lambda>s. sorted_array s arr n \<and> valid_array s arr n \<and>
         (\<exists>k < n. heap_w32 s (arr +\<^sub>p int k) = key) \<rbrace>
   binary_search' arr n key
   \<lbrace> \<lambda>rv s. rv < n \<and> heap_w32 s (arr +\<^sub>p int rv) = key \<rbrace>!"
```

**C2. Correctness when not found.**
```isabelle
lemma bsearch_not_found:
  "\<lbrace> \<lambda>s. sorted_array s arr n \<and> valid_array s arr n \<and>
         (\<forall>k < n. heap_w32 s (arr +\<^sub>p int k) \<noteq> key) \<rbrace>
   binary_search' arr n key
   \<lbrace> \<lambda>rv s. rv = n \<rbrace>!"
```

**C3. The function never accesses out-of-bounds indices.**
```isabelle
lemma bsearch_bounds:
  "\<lbrace> \<lambda>s. valid_array s arr n \<rbrace>
   binary_search' arr n key
   \<lbrace> \<lambda>rv s. rv \<le> n \<rbrace>!"
```

**C4. The loop invariant.**

State and prove a loop invariant that captures:
- `lo \<le> hi \<le> n`.
- `key` is not in `arr[0..lo-1]` (all elements are less than `key`).
- `key` is not in `arr[hi..n-1]` (all elements are greater than `key`).
- The array is sorted and valid.

**C5. Termination.** Provide the measure `hi - lo` and prove that it strictly decreases.

---

## 4. Grading Rubric

| Component | Points |
|-----------|--------|
| C code compiles and is in the StrictC subset | 10 |
| `install_C_file` and `autocorres` succeed | 10 |
| Specifications are correctly stated | 20 |
| Proofs are complete and correct | 40 |
| Report: verification decisions explained | 20 |
| **Total** | **100** |

Partial credit is available:

- A well-structured proof with `sorry` on difficult subgoals receives up to 60% credit on the proof component.
- A correct specification that you cannot prove receives full credit on the specification component.
- Extra credit (up to 10 points) for proving additional properties beyond the required ones.

---

## 5. Report Guidelines

Write a 2-page report (single-spaced, 11pt font) covering:

1. **Design decisions** (0.5 page): explain any modifications you made to the C code and why. Describe which AutoCorres options you chose and why.

2. **Specification justification** (0.5 page): explain why your specifications are correct --- why do they capture the intended behavior? Are there properties you chose not to specify, and why?

3. **Proof strategy** (0.5 page): describe your proof approach. What loop invariants did you use? What were the most difficult proof obligations? How did you discharge them?

4. **Reflection** (0.5 page): what did you learn from this exercise? What was harder than expected? What was easier? If you had more time, what would you do differently?

---

## 6. Tips

### General

- Start early. Setting up AutoCorres and getting the first proof to work takes time.
- Test your C code (compile and run it with GCC) before attempting verification.
- Use `unsigned_word_abs` where possible to avoid word-level reasoning.
- Start with the simplest specification and build up.

### Common Issues

- **Parser rejects your C code**: check for unsupported features (address-of locals, side effects in expressions, etc.). Simplify the code.
- **AutoCorres takes a long time**: use `scope` to process only the functions you need.
- **Loop proofs fail**: strengthen the invariant. Include bounds on all variables, validity predicates, and any facts that need to survive loop iterations.
- **Heap reasoning is confusing**: use `heap_abs_syntax` for cleaner notation. Remember that writes to one typed heap do not affect others.

### Resources

- The AutoCorres2 examples in `tools/autocorres/tests/examples/` in the l4v repository are invaluable. Study `WordAbs.thy`, `Memcpy.thy`, and `Alloc.thy`.
- The Isabelle `word` library documentation (for understanding machine word operations).
- Your solutions to HW9 (which exercised similar proof patterns).

---

## References

- Greenaway, D., Lim, J., Andronick, J., Klein, G. "Don't Sweat the Small Stuff." *PLDI*, 2014.
- Tuch, H., Klein, G., Norrish, M. "Types, Bytes, and Separation Logic." *POPL*, 2007.
- Klein, G., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.
- AutoCorres2 documentation and examples in the l4v repository.
