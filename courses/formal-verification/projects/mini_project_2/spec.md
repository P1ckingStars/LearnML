# Mini-Project 2: C Program Verification with AutoCorres

**Course:** Formal Verification with Isabelle (PhD Track)
**Due:** Week 16
**Weight:** 10% of final grade
**Format:** Individual or pairs

---

## Overview

In this project, you will verify a small C program end-to-end using AutoCorres and the Isabelle/SIMPL framework. The goal is to develop practical experience with the full C verification pipeline: writing a functional specification, parsing C code into Isabelle, using AutoCorres to abstract from the low-level SIMPL representation to a clean monadic specification, and proving that the implementation satisfies the specification.

This is not a tutorial exercise. You are expected to produce a complete verification covering total correctness (the program terminates and produces the correct result) and memory safety (no undefined behavior, no buffer overflows, no null pointer dereferences).

---

## Objectives

1. Write a functional specification in Isabelle/HOL that captures the intended behavior of a C module.
2. Parse C source code into Isabelle using the C-to-Isabelle parser.
3. Apply AutoCorres to lift the low-level SIMPL representation to a readable monadic form.
4. Prove that the AutoCorres-lifted functions refine the functional specification.
5. Write a clear report documenting the verification approach and challenges encountered.

---

## Suggested Programs

Choose one of the following programs, or propose your own (subject to instructor approval by Week 13). Each program is described with its verification requirements.

### Program 1: Sorting Algorithm

Implement and verify insertion sort or selection sort on a fixed-size array.

**C implementation requirements:**

- Sort an array of `unsigned int` in place
- Array is passed by pointer with an explicit length parameter
- No dynamic memory allocation

**Verification requirements:**

- **Functional specification:** Define a pure function `sort_spec :: int list => int list` in Isabelle/HOL that sorts a list.
- **Correctness:** Prove that after calling the sort function, the array contents correspond to `sort_spec` applied to the original contents.
- **Permutation:** Prove that the output is a permutation of the input (no elements are created or lost).
- **Sortedness:** Prove that the output is sorted (each element is less than or equal to the next).
- **Termination:** Prove total correctness (the function always terminates).
- **Memory safety:** Prove that all array accesses are within bounds.

**Expected difficulty:** Moderate. The main challenge is the loop invariant for the sorting loop and the relationship between C arrays and Isabelle lists.

### Program 2: String Manipulation Functions

Implement and verify a set of C string functions: `strlen`, `strcmp`, and `strcpy`.

**C implementation requirements:**

- Strings are null-terminated `char` arrays
- Functions operate on pointers to `char`
- No dynamic memory allocation
- `strcpy` must handle the case where source and destination do not overlap

**Verification requirements:**

- **Functional specification:** Define pure functions `strlen_spec`, `strcmp_spec`, and `strcpy_spec` in Isabelle/HOL on lists of characters.
- **strlen correctness:** Returns the number of characters before the null terminator.
- **strcmp correctness:** Returns the correct comparison result (negative, zero, positive) matching the specification.
- **strcpy correctness:** The destination buffer contains a copy of the source string after the call.
- **Termination:** All three functions terminate on valid inputs.
- **Memory safety:** No out-of-bounds reads or writes. For `strcpy`, the destination buffer must be large enough (this is a precondition, not something you prove holds -- you prove that *if* the precondition holds, the function is safe).

**Expected difficulty:** Moderate. The main challenge is reasoning about null-terminated strings and pointer arithmetic in the heap model.

### Program 3: Stack or Queue Implementation

Implement and verify a bounded stack or queue using an array and an index variable.

**C implementation requirements:**

- Fixed-capacity stack (or circular queue) using a statically allocated array
- Operations: `push`/`enqueue`, `pop`/`dequeue`, `peek`/`front`, `is_empty`, `is_full`
- Struct-based implementation with capacity, size, and data array fields

**Verification requirements:**

- **Functional specification:** Define an abstract stack (or queue) as an Isabelle/HOL list. Specify each operation as a pure function on lists.
- **Data abstraction:** Define an abstraction function mapping the concrete C struct state to the abstract list.
- **Invariant:** Define and prove maintenance of the representation invariant (e.g., size <= capacity, array contents match abstract list).
- **Correctness:** Each operation preserves the invariant and produces results consistent with the abstract specification.
- **Error handling:** Push on a full stack (enqueue on a full queue) returns an error code; prove this behavior.
- **Memory safety:** All array accesses are within bounds.

**Expected difficulty:** Moderate to high. The main challenge is maintaining the abstraction invariant across operations and handling the circular buffer logic (for a queue).

### Program 4: Binary Search

Implement and verify binary search on a sorted array.

**C implementation requirements:**

- Search for a value in a sorted array of `unsigned int`
- Return the index if found, or -1 (as a signed int) if not found
- The array is passed by pointer with an explicit length parameter

**Verification requirements:**

- **Functional specification:** Define a pure function `bsearch_spec :: int list => int => int option` in Isabelle/HOL.
- **Correctness (found):** If the function returns an index i >= 0, then `array[i] == target`.
- **Correctness (not found):** If the function returns -1, then the target is not in the array.
- **Precondition:** The array must be sorted. Define sortedness as a precondition and prove correctness under this assumption.
- **Termination:** Prove that the search loop terminates (the search interval strictly decreases).
- **Memory safety:** All array accesses are within bounds. This requires proving that the computed midpoint is always a valid index.
- **No integer overflow:** The midpoint computation `(low + high) / 2` can overflow. Either use the safe form `low + (high - low) / 2` and verify it, or verify the simpler form under appropriate preconditions on array size.

**Expected difficulty:** Moderate. The classic source of bugs in binary search (off-by-one errors, integer overflow in midpoint computation) is exactly what formal verification catches. The termination argument requires a well-founded measure.

### Proposing Your Own Program

If you wish to propose a different program, submit a 1-paragraph proposal to the instructor by Week 13. The proposal must include:

- The C program you intend to verify (attach the source code)
- A sketch of the functional specification
- Evidence that AutoCorres can parse the source code
- An estimate of the verification effort

---

## Technical Requirements

### C Source Requirements

Your C code must be in the subset supported by the C-to-Isabelle parser:

- No dynamic memory allocation (`malloc`, `free`) unless you use a custom allocator model
- No function pointers
- No floating point
- No variable-length arrays
- No recursive functions (unless you can provide a termination argument)
- No inline assembly
- Standard integer types only (`unsigned int`, `int`, `unsigned char`, etc.)
- Structs and arrays are permitted
- Pointer arithmetic is permitted

**Size:** The C source should be 50-150 lines of code (excluding comments and blank lines). The verification effort will be significantly larger.

### Isabelle Requirements

- **Isabelle version:** Isabelle2025
- **AutoCorres version:** The version compatible with Isabelle2025 (available on the course website)
- **No sorry:** All proofs must be complete
- **Build:** The development must build with `isabelle build` using the provided ROOT file

### Proof Structure

Your verification should follow the standard layered approach:

1. **C source** is parsed into Isabelle by the C-to-Isabelle parser, producing a SIMPL representation.
2. **AutoCorres** lifts the SIMPL representation to a monadic (nondeterministic state monad) representation.
3. **Functional specification** is defined as pure Isabelle/HOL functions.
4. **Refinement proofs** show that the AutoCorres-lifted functions refine the functional specification.

You should use `wp` (weakest precondition) tactics and `corres` (correspondence) lemmas as demonstrated in the course and the AutoCorres examples.

---

## Deliverables

### 1. Report (2 pages max)

Your report must include:

1. **Program Description** (2-3 sentences): What does the C program do?
2. **Functional Specification** (half page): State the functional specification informally and explain how it captures the intended behavior. Discuss any simplifications or idealizations.
3. **Verification Strategy** (1 page): This is the most important section. Cover:
   - How you structured the refinement proof
   - Key loop invariants and how you discovered them
   - How you handled pointer arithmetic and memory reasoning
   - The most challenging verification step and how you resolved it
   - How AutoCorres simplified (or complicated) the verification
4. **Statistics:** Lines of C code, lines of Isabelle proof, number of lemmas, approximate time spent.
5. **Lessons Learned** (2-3 sentences): What did you learn about the effort of verifying C code?

### 2. C Source Code

- Clean, well-commented C source in the supported subset
- A header file (if applicable) with function prototypes and documentation

### 3. Isabelle Code

- All theory files with a working ROOT file
- Functional specification in a separate theory file from the verification proofs
- Clean, well-commented proofs
- No sorry

### 4. Build Verification

Include the output of `isabelle build -D .` showing successful compilation.

---

## Milestones

### Week 13: Program Selection + AutoCorres Setup (5% of project grade)

Submit:

- Your chosen program (C source code)
- Evidence that AutoCorres processes the C source without errors (screenshot or log)
- A `.thy` file containing the functional specification (definitions only; proofs not required yet)

### Week 16: Final Submission (95% of project grade)

Submit the full report, C source, Isabelle code, and build verification as described above.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Specification Quality** | 25% | The functional specification accurately and completely captures the intended behavior. Preconditions are well-chosen. The abstraction level is appropriate -- neither too concrete (just restating the C code) nor too abstract (omitting important behavior). |
| **Verification Completeness** | 30% | All specified properties are proved. No sorry. Proofs cover correctness, termination, and memory safety. Loop invariants are correct and documented. |
| **Proof Engineering** | 25% | Proofs are well-structured. Lemma factoring is thoughtful. Appropriate use of wp tactics, corres lemmas, and automation. Proofs are not unnecessarily long. |
| **Report and Code Quality** | 20% | Report is clear and insightful, especially the verification strategy section. C code is clean. Isabelle code is well-organized and commented. |

### Grade Descriptors

- **A (90-100%):** Complete verification with clean, well-documented proofs. The report provides genuine insight into the verification process. Loop invariants are elegant and well-motivated. The student demonstrates understanding of the full verification pipeline.
- **B (80-89%):** Complete verification. Proofs work but may be verbose or inelegant. Report is adequate. The student demonstrates competence with AutoCorres.
- **C (70-79%):** Partial verification (e.g., correctness proved but termination or memory safety incomplete). Report is superficial. Proofs have style issues.
- **D/F (<70%):** Verification is incomplete with sorry in key lemmas. AutoCorres setup issues unresolved. Report is missing or inadequate.

---

## Helpful Guidance

### Getting Started

1. **Get AutoCorres working first.** Before writing any proofs, ensure that AutoCorres can parse your C source and produce the lifted monadic representation. Run the AutoCorres examples from the distribution to verify your setup.
2. **Study the examples.** The AutoCorres distribution includes examples (e.g., `WordAbs.thy`, `heap_lift_base`) that demonstrate the verification pattern. Study these before starting your own proofs.
3. **Write the specification first.** Define the functional specification in a separate theory file. Make sure the specification is correct by testing it on examples using `value` in Isabelle.
4. **Start with the simplest function.** If your program has multiple functions, verify the simplest one first to establish the proof pattern.

### Common Pitfalls

- **AutoCorres version mismatch.** Ensure your AutoCorres version matches your Isabelle version exactly. Version mismatches produce cryptic errors.
- **C parser limitations.** The C-to-Isabelle parser does not support the full C language. Test early. If your C code does not parse, simplify it. Common issues: complex initializers, some forms of typedef, certain uses of enum.
- **Heap reasoning complexity.** Reasoning about pointer-based data structures on the heap is significantly harder than reasoning about pure values. Use the heap abstraction provided by AutoCorres (`is_valid_*`, `heap_*` functions) rather than reasoning about raw memory.
- **Loop invariant discovery.** Finding the right loop invariant is the hardest part of C verification. The invariant must capture: (1) the relationship between loop variables and the abstract state, (2) validity of all pointers accessed in the loop body, (3) bounds on index variables. Start with the strongest invariant you can think of and weaken it only if the proof of invariant preservation fails.
- **Integer overflow.** C integer arithmetic wraps around. In AutoCorres, arithmetic on `word32` and `word64` types is modular. If your algorithm assumes no overflow, you must prove that overflow does not occur under your preconditions.
- **Confusing SIMPL and AutoCorres layers.** Make sure you are proving properties about the AutoCorres-lifted functions, not the raw SIMPL representation. AutoCorres is designed to simplify your proofs.

### Verification Effort Estimates

Based on past student experience:

- **Sorting (insertion sort):** 50-80 lines of C, 600-1000 lines of Isabelle proof
- **String functions (strlen + strcmp):** 30-50 lines of C, 400-700 lines of Isabelle proof
- **Stack implementation:** 60-100 lines of C, 700-1200 lines of Isabelle proof
- **Binary search:** 20-30 lines of C, 400-800 lines of Isabelle proof

The ratio of proof to code is typically 10:1 to 15:1. Plan accordingly.

### Suggested Reading

- Greenaway, "Automated Proof-Producing Abstraction of C Code" (PhD thesis, UNSW, 2015) -- the definitive reference for AutoCorres
- Klein et al., "seL4: Formal Verification of an OS Kernel" (SOSP 2009) -- to understand the broader context
- Tuch, Klein, Norrish, "Types, Bytes, and Separation Logic" (POPL 2007) -- for understanding the heap model
- The AutoCorres documentation and examples bundled with the distribution

---

## Academic Integrity

- You must write all verification proofs yourself. You may reference AutoCorres examples and seL4 proof patterns for guidance, but the proofs must be your own work.
- The C source code must be your own or a standard textbook implementation (cite the source).
- You may use utility libraries from the Isabelle distribution and AFP.
- If working in pairs, both students must contribute substantially to the verification. Include a contribution statement.
- Using AI tools for proof discovery is permitted but must be disclosed. All proofs must be verified by Isabelle.

---

## Submission

Submit via the course portal by **Week 16, Friday 11:59 PM**:

1. Report as PDF (2 pages max)
2. C source code
3. Isabelle theory files as a zip archive
4. Build verification output
5. If working in pairs: contribution statement
