# Lecture 09b: The AutoCorres Abstraction Pipeline

> **Module 09 --- C Verification: Parser, AutoCorres & Proofs**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain why the raw SIMPL output is insufficient for practical verification and what AutoCorres provides.
2. Describe each of the five AutoCorres phases (L1, L2, TS, HL, WA) and explain what transformation each phase performs.
3. State why AutoCorres is proof-producing and explain what this means for the trusted computing base.
4. Use the `autocorres` command with appropriate configuration options.
5. Read and interpret AutoCorres output definitions, including their type signatures.
6. Choose appropriate AutoCorres options for a given verification task.

---

## 1. Motivation: Why Abstract Beyond SIMPL?

### 1.1 The Problem with Raw SIMPL

The C parser produces SIMPL programs that faithfully represent the C semantics but are extremely verbose. Consider a simple C function:

```c
unsigned int inc(unsigned int n) {
    return n + 1;
}
```

The raw SIMPL output involves:

- An explicit state record with fields for every local variable.
- Exception-based return handling (`TRY`/`CATCH`/`creturn`).
- Machine-word arithmetic (`word32` operations with modular semantics).
- Raw heap access through `heap_raw_state` even if the function never touches the heap.

A verification proof must navigate all this infrastructure just to reason about `n + 1`. This is not just inconvenient --- it makes proofs fragile and hard to maintain. Any change in the C code can ripple through the SIMPL representation in unexpected ways.

### 1.2 The AutoCorres Solution

AutoCorres (Automatic Correspondence) is a proof-producing abstraction tool that lifts SIMPL programs through a series of increasingly abstract representations, culminating in clean monadic or pure functional specifications. The key properties are:

- **Proof-producing**: each abstraction step generates a correctness theorem checked by Isabelle's kernel. You never need to trust AutoCorres itself --- only Isabelle's kernel.
- **Automatic**: the user invokes a single command; AutoCorres determines how to abstract each function.
- **Configurable**: the user can control which abstractions are applied and to which functions.

After AutoCorres processing, the `inc` function above becomes approximately:

```isabelle
definition inc' :: "32 word \<Rightarrow> 32 word"
where "inc' n = n + 1"
```

A pure function, with no monadic state, no exceptions, no explicit heap. This is what we want to reason about.

### 1.3 Key Reference

- **Greenaway, Lim, Andronick, Klein (PLDI 2014).** "Don't Sweat the Small Stuff: Formal Verification of C Code Without the Pain."

---

## 2. Architecture: Five Sequential Phases

AutoCorres applies five transformation phases in sequence. Each phase produces an intermediate representation and a proof that the intermediate representation refines the previous one. By transitivity, the final output refines the original SIMPL.

```
SIMPL (from C parser)
  |
  v
L1: SimplConv (cleaner SIMPL)
  |
  v
L2: LocalVarExtract (local vars become functional)
  |
  v
TS: Type Strengthening (refined monad types)
  |
  v
HL: Heap Lifting (typed heaps)
  |
  v
WA: Word Abstraction (nat/int instead of machine words)
  |
  v
Final output (primed definitions: f')
```

### 2.1 Phase 1: L1 --- SimplConv

**Goal**: Convert the C parser's SIMPL output into a cleaner intermediate form.

The C parser's SIMPL output contains idiosyncrasies tied to the particular way C constructs are lowered. L1 normalizes these into a more uniform representation:

- Simplifies the exception-based return mechanism.
- Normalizes `break` and `continue` handling in loops.
- Eliminates dead code introduced by the parser.
- Regularizes the control-flow representation.

The output is still a deeply embedded program, but in a form that subsequent phases can process more easily.

**Correctness**: L1 produces a simulation proof: every behavior of the L1 program corresponds to a behavior of the original SIMPL program.

### 2.2 Phase 2: L2 --- LocalVarExtract

**Goal**: Extract local variables from the deeply embedded state, turning them into ordinary Isabelle bound variables.

In SIMPL, local variables are fields in an explicit state record. Every read of a local variable `x` is an access `x_' (locals s)` into the state, and every write is an update `locals_update (x_'_update ...)`. This is faithful to C's semantics (locals live on the stack) but terrible for reasoning.

L2 transforms the program so that local variables become bound variables in a monadic computation. The state threading disappears for locals; only truly stateful operations (global variable access, heap operations) remain in the state monad.

**Before L2** (schematic):
```isabelle
"DO
   s \<leftarrow> get;
   _ \<leftarrow> set (s\<lparr> x_' := 0 \<rparr>);
   s \<leftarrow> get;
   _ \<leftarrow> set (s\<lparr> y_' := x_' s + 1 \<rparr>);
   s \<leftarrow> get;
   return (y_' s)
 OD"
```

**After L2** (schematic):
```isabelle
"DO
   let x = 0;
   let y = x + 1;
   return y
 OD"
```

**Key insight**: local variables are inherently functional --- they are scoped to a single function invocation and their lifetimes do not overlap with other invocations. L2 exploits this to eliminate the state-threading overhead entirely for locals.

**Correctness**: L2 proves that the functional representation simulates the stateful one by showing that the local state projections at each program point match the bound variables.

### 2.3 Phase 3: TS --- Type Strengthening

**Goal**: Refine the monad type to the most abstract monad that captures the function's effects.

After L2, every function lives in the full nondeterministic state monad with exceptions:

```isabelle
type_synonym ('s, 'a) nondet_monad = "'s \<Rightarrow> (('a \<times> 's) set \<times> bool)"
```

This is the most general monad: it supports nondeterminism, state, and failure. But many functions do not use all these features. A function that just computes `n + 1` does not need state, failure, or nondeterminism.

TS analyzes each function and assigns it to the most abstract monad type that captures its actual effects. The hierarchy (from most abstract to most concrete):

| Monad | Type | Effects | Example |
|-------|------|---------|---------|
| `pure` | `'a` | None (ordinary function) | `inc(n) = n + 1` |
| `option` | `'a option` | May fail (partial function) | Division by zero |
| `gets` | `'s \<Rightarrow> 'a option` | Reads state, may fail | Reading a global |
| `nondet` | `('s, 'a) nondet_monad` | Full nondeterministic state monad | Functions with writes |

**Configuration**: The `ts_rules` parameter specifies which monad types to attempt:

```isabelle
autocorres [ts_rules = pure option nondet] "myfile.c"
```

The `ts_force` parameter forces a specific function to a specific monad type:

```isabelle
autocorres [ts_force pure = my_pure_func] "myfile.c"
```

**Correctness**: TS proves that the function in the abstract monad can be embedded into the concrete monad and produces the same results. For example, if a function is classified as `pure`, TS proves that it never modifies state and never fails.

### 2.4 Phase 4: HL --- Heap Lifting

**Goal**: Abstract the byte-level heap into separate typed heaps.

The C parser's heap is a single, untyped byte array. Every access goes through `h_val` and `heap_update` with explicit byte-level encodings. This is accurate but painful to reason about.

HL introduces one abstract heap per C type. Instead of a single `heap_raw_state` containing bytes, the state contains:

```isabelle
record lifted_globals =
  heap_unsigned :: "32 word ptr \<Rightarrow> 32 word"
  heap_point_C  :: "point_C ptr \<Rightarrow> point_C"
  (* ... one field per C type used in the program ... *)
  is_valid_unsigned :: "32 word ptr \<Rightarrow> bool"
  is_valid_point_C  :: "point_C ptr \<Rightarrow> bool"
  (* ... validity predicates ... *)
```

Each typed heap is a function from pointers-to-that-type to values-of-that-type. The `is_valid_*` predicates replace the low-level `ptr_valid` checks.

**Implicit separation**: because each type lives in its own heap, values of different types are automatically separated. Writing to a `point_C` pointer cannot affect an `unsigned int` value. This is a form of separation logic built into the representation.

**When HL does not apply**: if a function performs type-unsafe operations (casting between pointer types that break the type system's assumptions), HL cannot abstract it. The `no_heap_abs` option exempts specific functions:

```isabelle
autocorres [no_heap_abs = unsafe_func] "myfile.c"
```

**Correctness**: HL proves that the typed-heap representation refines the byte-level representation, subject to a well-typedness invariant: the byte-level heap must be decomposable into non-overlapping typed regions.

### 2.5 Phase 5: WA --- Word Abstraction

**Goal**: Replace finite machine words with unbounded mathematical integers.

C arithmetic operates on fixed-width machine words with modular overflow semantics. The type `32 word` represents unsigned 32-bit integers where `0xFFFFFFFF + 1 = 0`. Reasoning about word arithmetic requires tracking overflow conditions, which is tedious and error-prone.

WA replaces machine words with Isabelle's `nat` (for unsigned values) or `int` (for signed values), eliminating overflow concerns entirely:

**Before WA**:
```isabelle
"inc' (n :: 32 word) = n + (1 :: 32 word)"
```

**After WA**:
```isabelle
"inc' (n :: nat) = n + 1"
```

**Soundness condition**: WA is only sound when the function's inputs and intermediate values stay within the machine word's range. WA generates guard conditions that must be satisfied:

- For unsigned word abstraction: `0 \<le> x` and `x < 2^32` at each arithmetic operation.
- For signed word abstraction: `-2^31 \<le> x` and `x < 2^31`.

If a function can overflow, WA should not be applied to it (or the overflow must be handled as a precondition).

**Configuration**:

```isabelle
autocorres [unsigned_word_abs = func1 func2,
            signed_word_abs = func3] "myfile.c"
```

Only the listed functions receive word abstraction. Functions not listed retain machine-word types.

**Correctness**: WA proves that when the guard conditions hold, the nat/int computation produces the same result as the word computation.

---

## 3. Using AutoCorres

### 3.1 Basic Invocation

A minimal AutoCorres setup:

```isabelle
theory MyVerification
  imports AutoCorres2.AutoCorres
begin

install_C_file "myfile.c"
autocorres "myfile.c"

end
```

The `autocorres` command must come after `install_C_file` for the same `.c` file. It processes all functions in the file through all five phases with default settings.

### 3.2 Configuration Options

| Option | Purpose | Example |
|--------|---------|---------|
| `ts_rules` | Monad types to attempt | `ts_rules = pure option nondet` |
| `ts_force` | Force a function to a specific monad | `ts_force pure = f` |
| `unsigned_word_abs` | Functions for unsigned word abstraction | `unsigned_word_abs = f g` |
| `signed_word_abs` | Functions for signed word abstraction | `signed_word_abs = h` |
| `no_heap_abs` | Skip heap lifting for specific functions | `no_heap_abs = unsafe_f` |
| `skip_word_abs` | Skip word abstraction entirely | `skip_word_abs` |
| `scope` | Only process specified functions | `scope = f g` |
| `heap_abs_syntax` | Use nicer syntax for heap operations | `heap_abs_syntax` |

### 3.3 Examining the Output

After `autocorres`, the generated definitions are available in Isabelle. The final output for each function `f` is named `f'` (with a prime suffix):

```isabelle
(* To see what AutoCorres produced: *)
thm myfile.f'_def
```

The type signature of `f'` reveals which monad AutoCorres chose:

- `f' :: 32 word \<Rightarrow> 32 word` --- pure function
- `f' :: 32 word \<Rightarrow> 32 word option` --- option monad
- `f' :: lifted_globals \<Rightarrow> (32 word \<times> lifted_globals) set \<times> bool` --- nondet monad

### 3.4 The Correspondence Theorems

AutoCorres also generates correspondence theorems connecting the output back to the SIMPL input:

```isabelle
thm myfile.f'_ac_corres
```

This theorem states that `f'` refines the SIMPL procedure for `f`. Its precise form depends on the monad type, but schematically:

```isabelle
"ac_corres globals_rel (liftE (f' x))
   \<Gamma> (Call f_'proc) (preconditions)"
```

These theorems are the formal justification for reasoning about `f'` instead of the SIMPL procedure. Any property proved about `f'` transfers to the original SIMPL program (and hence to the C code) via this correspondence.

---

## 4. Supported Architectures

AutoCorres supports multiple target architectures, affecting word sizes and pointer widths:

| Architecture | Word size | Pointer width | Status |
|-------------|-----------|---------------|--------|
| ARM (32-bit) | 32 bits | 32 bits | Mature (seL4 verification) |
| X64 | 64 bits | 64 bits | Supported |
| RISC-V 64 | 64 bits | 64 bits | Supported |

The architecture is typically set by the `install_C_file` command via the `machinety` option and must be consistent between parsing and AutoCorres processing.

---

## 5. Worked Example: End-to-End

### 5.1 C Source

```c
/* abs.c */
unsigned int abs_diff(unsigned int a, unsigned int b) {
    if (a > b) {
        return a - b;
    } else {
        return b - a;
    }
}
```

### 5.2 Isabelle Theory

```isabelle
theory AbsDiff
  imports AutoCorres2.AutoCorres
begin

install_C_file "abs.c"
autocorres [unsigned_word_abs = abs_diff] "abs.c"

(* Examine the generated definition *)
thm abs_diff.abs_diff'_def
(* Should produce something like:
   abs_diff' a b = (if a > b then a - b else b - a) *)

(* Now we can reason about abs_diff' as a pure nat function *)
lemma abs_diff_correct:
  "abs_diff' a b = (if a > b then a - b else b - a)"
  by (simp add: abs_diff.abs_diff'_def)

end
```

### 5.3 What Happened

1. `install_C_file` parsed the C into a SIMPL procedure.
2. `autocorres` ran the five phases:
   - L1: normalized the SIMPL.
   - L2: extracted locals `a` and `b` as bound variables.
   - TS: classified `abs_diff` as `pure` (no state, no failure).
   - HL: skipped (no heap access).
   - WA: replaced `word32` with `nat` (because we specified `unsigned_word_abs`).
3. The result is a simple functional definition amenable to `simp`.

---

## 6. The Correspondence Theorem `ac_corres` in Detail

The `ac_corres` theorem is the formal link between the AutoCorres output and the original SIMPL program. Understanding its structure is important for advanced verification tasks, particularly when composing proofs across abstraction layers.

### 6.1 The Type of `ac_corres`

The full type of `ac_corres` (simplified for clarity) is:

```isabelle
ac_corres ::
  "(lifted_globals \<Rightarrow> globals myvars \<Rightarrow> bool)   (* globals_rel: relates abstract and concrete states *)
   \<Rightarrow> (lifted_globals, 'a) nondet_monad           (* abstract program (AutoCorres output) *)
   \<Rightarrow> (globals myvars) com_body                    (* concrete SIMPL program *)
   \<Rightarrow> (globals myvars) set                         (* precondition on concrete state *)
   \<Rightarrow> bool"
```

A theorem `ac_corres globals_rel (liftE (f' x)) \<Gamma> (Call f_'proc) P` states:

- For every concrete state `s` satisfying precondition `P`,
- if the abstract program `f' x` produces result `r` and abstract state `s'`,
- then the concrete SIMPL program `Call f_'proc` produces a corresponding concrete state `t` where `globals_rel s' t` holds, and the return value matches.

### 6.2 `globals_rel`: Relating Abstract and Concrete State

The `globals_rel` relation connects the lifted globals (typed heaps, individual global variables) back to the flat byte-level state. It asserts:

1. Each typed heap in the abstract state is consistent with the byte-level `t_hrs_'` in the concrete state.
2. Each abstract global variable field equals the corresponding field in the concrete globals record.
3. The validity predicates (`is_valid_*`) match the `ptr_valid` checks in the concrete heap type descriptor.

AutoCorres generates `globals_rel` automatically based on the types and globals present in the C file. You rarely need to unfold it manually, but knowing it exists explains why properties proved about `f'` transfer to the SIMPL level.

### 6.3 `liftE` and Monad Embedding

The `liftE` combinator lifts a computation from a simpler monad into the full `nondet_monad`:

```isabelle
liftE :: "('s, 'a) nondet_monad \<Rightarrow> ('s, 'a + 'e) nondet_monad"
liftE m = do { v \<leftarrow> m; return (Inl v) }
```

This is needed because the SIMPL semantics includes the possibility of exceptions (for `return` statements), but the AutoCorres output may be in a monad without exceptions. `liftE` bridges this gap by wrapping the result in `Inl` (the non-exceptional case).

For functions classified as `pure` by TS, the embedding is deeper:

```isabelle
"ac_corres globals_rel (liftE (gets (\<lambda>_. f' x))) \<Gamma> (Call f_'proc) P"
```

Here `gets (\<lambda>_. f' x)` lifts a pure value into the state monad before `liftE` lifts it into the exception monad.

### 6.4 Using `ac_corres` in Proofs

You typically do not interact with `ac_corres` directly. Instead, you prove properties about the AutoCorres output `f'`, and the correspondence theorem guarantees those properties hold for the SIMPL program. However, in advanced scenarios (e.g., connecting AutoCorres proofs to a larger refinement framework), you may need to compose `ac_corres` with other refinement theorems:

```isabelle
(* Typical usage pattern: *)
lemma f_correct_simpl:
  "\<forall>s. \<Gamma> \<turnstile>\<^bsub>/UNIV\<^esub> {s. P s} Call f_'proc {t. Q t}"
  using f_correct_autocorres       (* proved about f' *)
        myfile.f'_ac_corres        (* generated by AutoCorres *)
  by (rule ac_corres_to_hoare)     (* transfer lemma *)
```

---

## 7. Phase-by-Phase Output for a Concrete Function

To understand what each AutoCorres phase does, let us trace a concrete function through all phases. We use a simple summation function with a loop and a local variable.

### 7.1 C Source

```c
/* sum_to_n.c */
unsigned sum_to_n(unsigned n) {
    unsigned s = 0;
    unsigned i = 1;
    while (i <= n) {
        s = s + i;
        i = i + 1;
    }
    return s;
}
```

### 7.2 SIMPL Output (Before L1)

After `install_C_file`, the parser produces:

```isabelle
definition sum_to_n_body :: "(globals myvars, int, strictc_errortype) com"
where
  "sum_to_n_body \<equiv>
    TRY
      (* s = 0 *)
      Basic (\<lambda>st. locals_update (s_'_update (\<lambda>_. 0)) st) ;;
      (* i = 1 *)
      Basic (\<lambda>st. locals_update (i_'_update (\<lambda>_. 1)) st) ;;
      (* while (i <= n) *)
      While {st. unat (i_' (locals st)) \<le> unat (n_' (locals st))}
        ((* s = s + i *)
         Basic (\<lambda>st. locals_update
           (s_'_update (\<lambda>_. s_' (locals st) + i_' (locals st))) st) ;;
         (* i = i + 1 *)
         Basic (\<lambda>st. locals_update
           (i_'_update (\<lambda>_. i_' (locals st) + 1)) st)) ;;
      (* return s *)
      creturn globals_update ret__unsigned_update (\<lambda>st. s_' (locals st))
    CATCH SKIP
    END"
```

**Key observations**: all local variables (`s_'`, `i_'`, `n_'`) are fields in the `locals` record. Every read goes through `x_' (locals st)` and every write through `locals_update (x_'_update ...)`. The `While` command takes a set (guard condition) and a body. The entire function is wrapped in `TRY ... CATCH SKIP END` for return handling.

### 7.3 After L1: SimplConv

L1 normalizes the SIMPL into a monadic form, cleaning up the exception-based return:

```isabelle
definition sum_to_n_l1 ::
  "(globals myvars, 32 word) nondet_monad"
where
  "sum_to_n_l1 \<equiv> do {
    modify (locals_update (s_'_update (\<lambda>_. 0)));
    modify (locals_update (i_'_update (\<lambda>_. 1)));
    whileLoop (\<lambda>_ st. unat (i_' (locals st)) \<le> unat (n_' (locals st)))
      (\<lambda>_. do {
        modify (locals_update
          (s_'_update (\<lambda>_. s_' (locals st) + i_' (locals st))));
        modify (locals_update
          (i_'_update (\<lambda>_. i_' (locals st) + 1)))
      }) ();
    gets (\<lambda>st. s_' (locals st))
  }"
```

**What changed**: the deeply embedded `While` command became a `whileLoop` combinator in the nondeterministic state monad. The `TRY/CATCH/Throw` pattern for `return` is gone, replaced by a simple `gets` at the end. The `Basic` commands became `modify` operations. The program is now a monadic computation rather than a deeply embedded syntax tree.

### 7.4 After L2: LocalVarExtract

L2 extracts local variables from the state, turning them into ordinary bound variables:

```isabelle
definition sum_to_n_l2 ::
  "32 word \<Rightarrow> (globals, 32 word) nondet_monad"
where
  "sum_to_n_l2 n \<equiv> do {
    (s, i) \<leftarrow> whileLoop (\<lambda>(s, i) _. unat i \<le> unat n)
      (\<lambda>(s, i). return (s + i, i + 1))
      (0, 1);
    return s
  }"
```

**What changed**: the local variables `s_'`, `i_'`, and `n_'` are no longer accessed through the state record. Instead, `n` is a function parameter and `(s, i)` are loop-carried variables bound by the `whileLoop` combinator. The `modify` and `gets` calls for locals are gone. The state monad now only carries `globals` (not `globals myvars`), because there is no local state to thread.

This is a dramatic simplification. The function parameter `n` was extracted from the state and became a regular Isabelle function argument. The loop variables became a tuple threaded through the `whileLoop`.

### 7.5 After TS: Type Strengthening

TS analyzes the function's effects. Since `sum_to_n` does not read or write any global variables and does not access the heap, TS classifies it as `pure`:

```isabelle
definition sum_to_n_ts :: "32 word \<Rightarrow> 32 word"
where
  "sum_to_n_ts n \<equiv>
    fst (while (\<lambda>(s, i). unat i \<le> unat n)
               (\<lambda>(s, i). (s + i, i + 1))
               (0, 1))"
```

**What changed**: the `nondet_monad` wrapper is gone. The function is now a pure Isabelle function `32 word \<Rightarrow> 32 word`. The monadic `whileLoop` became a pure `while` combinator. The `do` notation and `return` disappeared entirely.

TS produced a proof that the pure function simulates the monadic version: for any input, the monadic computation does not fail and returns the same value as the pure function.

### 7.6 After HL: Heap Lifting

HL is not applicable to `sum_to_n` because it does not access the heap. HL is skipped for this function. For functions that do access pointers, HL would replace `t_hrs_'` access with typed heap operations.

### 7.7 After WA: Word Abstraction

If we specify `unsigned_word_abs = sum_to_n`, WA replaces `32 word` with `nat`:

```isabelle
definition sum_to_n' :: "nat \<Rightarrow> nat"
where
  "sum_to_n' n \<equiv>
    fst (while (\<lambda>(s, i). i \<le> n)
               (\<lambda>(s, i). (s + i, i + 1))
               (0, 1))"
```

**What changed**: the type changed from `32 word \<Rightarrow> 32 word` to `nat \<Rightarrow> nat`. The `unat` calls in the guard disappeared because comparisons on `nat` are direct. Arithmetic is now over natural numbers (no modular overflow).

WA generated a guard condition: the word abstraction is sound only when all intermediate values fit in 32 bits. The guard requires `s + i < 2^32` at each iteration and `sum_to_n' n < 2^32`.

### 7.8 Summary Table

| Phase | Key Change | Type |
|-------|-----------|------|
| SIMPL | Raw parser output | deeply embedded `com` |
| L1 | Monadic form, clean control flow | `(globals myvars, 32 word) nondet_monad` |
| L2 | Locals become bound variables | `32 word \<Rightarrow> (globals, 32 word) nondet_monad` |
| TS | Pure function (no state/failure) | `32 word \<Rightarrow> 32 word` |
| HL | (skipped --- no heap access) | --- |
| WA | `nat` instead of `32 word` | `nat \<Rightarrow> nat` |

Each phase reduces the representation gap between the low-level C semantics and the mathematical property we want to prove. The correspondence theorems chain together: the final `sum_to_n'` refines the TS output, which refines L2, which refines L1, which refines the SIMPL, which was generated from the C source.

---

## 8. Common Pitfalls

### 8.1 Word Abstraction Unsoundness

Applying word abstraction to a function that intentionally overflows produces an incorrect abstraction. For example, hash functions that rely on modular arithmetic should not be word-abstracted. AutoCorres generates guard conditions, but if you discharge them incorrectly (e.g., by adding false preconditions), the final theorem will be vacuously true.

### 8.2 Heap Lifting Failures

HL fails when the C code performs type-punning: casting a `struct point *` to an `unsigned int *` and reading individual fields as integers. This breaks the assumption that each memory region has a single type. Use `no_heap_abs` for such functions.

### 8.3 Recursive Functions

AutoCorres handles recursive C functions but requires termination to produce total definitions. If the function is not structurally recursive, AutoCorres uses `WHILE` loops or `measure` functions. The user may need to provide termination proofs for deeply recursive functions.

### 8.4 Large Files

AutoCorres processes all functions in a file by default. For large files (hundreds of functions), this can be slow. Use the `scope` option to restrict processing to the functions you actually want to verify.

---

## 9. Exercises

### Theory

**Exercise 9b.1.** Explain why AutoCorres being proof-producing means it does not need to be trusted. What would change if AutoCorres were a trusted translation (like the C parser)?

**Exercise 9b.2.** For each of the following C functions, predict which monad type (pure, option, gets, nondet) TS would assign:

**(a)** `int square(int x) { return x * x; }`

**(b)** `int div_safe(int x, int y) { if (y == 0) return -1; return x / y; }`

**(c)** `unsigned read_counter(void) { return counter; }` (where `counter` is a global)

**(d)** `void set_counter(unsigned v) { counter = v; }` (where `counter` is a global)

**Exercise 9b.3.** Why does heap lifting create one typed heap per C type? What would go wrong with a single typed heap for all types?

**Exercise 9b.4.** Under what conditions is word abstraction sound? Give a concrete C function where applying word abstraction would produce an incorrect specification.

### Isabelle

**Exercise 9b.5.** Write a C file with a pure function `unsigned min(unsigned a, unsigned b)`. Parse and autocorres it with `unsigned_word_abs`. Verify that the output is equivalent to `min' a b = (if a < b then a else b)`.

**Exercise 9b.6.** Write a C file with a function that reads and returns a global variable. Examine the AutoCorres output to confirm that TS classifies it as `gets` (or `nondet`).

**Exercise 9b.7.** Write a C file with a function that deliberately overflows (`unsigned f(unsigned x) { return x + 1; }`). Apply `unsigned_word_abs` and examine the generated guard conditions. What precondition is needed for soundness?

---

## References

- Greenaway, D., Lim, J., Andronick, J., Klein, G. "Don't Sweat the Small Stuff: Formal Verification of C Code Without the Pain." *PLDI*, 2014.
- Greenaway, D., Andronick, J., Klein, G. "Bridging the Gap: Automatic Verified Abstraction of C." *ITP*, 2012.
- AutoCorres2 documentation in the l4v repository: `tools/autocorres/README.md`.
- Cock, D., Klein, G., Sewell, T. "Secure Microkernels, State Monads and Scalable Refinement." *TPHOLs*, 2008.

---

*Next: [Lecture 09c: Verifying C Functions End-to-End](lecture_09c_verifying_c_functions.md)*
