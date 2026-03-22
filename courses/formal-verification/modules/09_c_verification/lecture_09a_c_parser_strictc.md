# Lecture 09a: The StrictC Parser & C-to-Isabelle Translation

> **Module 09 --- C Verification: Parser, AutoCorres & Proofs**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe the complete C verification pipeline from C source through SIMPL to proofs.
2. List the C99 features supported and unsupported by the StrictC parser and explain the rationale for each restriction.
3. Use `install_C_file` with its configuration options to parse a C file into Isabelle.
4. Read the SIMPL output produced by the parser, identifying procedure definitions, type definitions, and state records.
5. Explain the byte-level memory model: typed pointers, `c_guard`, and `ptr_valid`.
6. State what modifies clauses are and how they are generated automatically.

---

## 1. The C Verification Pipeline

### 1.1 Overview

Verifying a C program in Isabelle involves a multi-stage pipeline. Each stage transforms the program into a more abstract representation, and each transformation is either definitional (part of the trusted base) or proof-producing (verified by Isabelle's kernel).

```
C source code (.c)
      |
      v
  StrictC Parser (c-parser)
      |
      v
  SIMPL programs (deeply embedded in Isabelle)
      |
      v
  AutoCorres (proof-producing abstraction)
      |
      v
  Abstract monadic specifications
      |
      v
  User proofs (Hoare triples, refinement, etc.)
```

The parser is the only component in this pipeline that must be trusted: it translates C source into Isabelle definitions, and any bug in the parser could introduce a gap between the actual C semantics and what Isabelle reasons about. Everything downstream of the parser is either a definition within Isabelle or a proof checked by the kernel.

### 1.2 Historical Context

The C parser was developed as part of the seL4 verification project at NICTA (now Data61/CSIRO) beginning around 2006. The parser targets a strict subset of C99, chosen to be sufficient for systems code like the seL4 microkernel while remaining amenable to formal reasoning. The key reference is:

- **Tuch, Klein, Norrish (POPL 2007).** "Types, Bytes, and Separation Logic: Verifying Low-Level Programs in Isabelle/HOL."

The parser lives in the `l4v` repository under `tools/c-parser/` and is implemented primarily in Standard ML, running within the Isabelle/ML infrastructure.

---

## 2. The StrictC Subset of C99

### 2.1 Supported Features

The StrictC parser supports a substantial fragment of C99, sufficient for writing operating system kernels and embedded systems code:

- **Basic types**: `char`, `unsigned char`, `short`, `unsigned short`, `int`, `unsigned int`, `long`, `unsigned long`, `long long`, `unsigned long long`
- **Pointer types**: pointers to any supported type, including pointers to structs and function pointers (with restrictions)
- **Struct types**: including nested structs and structs containing arrays
- **Array types**: fixed-size arrays (size must be a compile-time constant)
- **Typedef**: user-defined type aliases
- **Enum types**: with explicit or implicit values
- **Control flow**: `if`/`else`, `while`, `for`, `do`/`while`, `return`, `break`, `continue`, `switch` (without fall-through)
- **Arithmetic and bitwise operators**: all standard C operators on integer types
- **Pointer arithmetic**: addition and subtraction on pointers
- **Casting**: between integer types and between integer and pointer types
- **Function calls**: direct calls and calls through function pointers (restricted)
- **Compound literals and designated initializers** (partial support)
- **`const` and `volatile` qualifiers** (`volatile` is noted but not given special semantics)

### 2.2 Unsupported Features

The following C99 features are deliberately excluded. Each exclusion simplifies the formal semantics without significantly limiting the class of verifiable programs.

**No floating-point types.** Floating-point arithmetic involves rounding modes, NaN propagation, and platform-dependent behavior that enormously complicates formal reasoning. The seL4 microkernel does not use floating-point, and most systems code avoids it. Formally modeling IEEE 754 in Isabelle is possible but would require a separate, extensive effort.

**No address-of for local variables.** The expression `&x` where `x` is a local variable is forbidden. This restriction ensures that local variables can be modeled as ordinary Isabelle variables rather than heap-allocated storage. If locals could be addressed, every local would need to live on the heap, dramatically complicating the memory model.

**No `goto` and no `switch` fall-through.** Arbitrary control flow via `goto` makes structured reasoning nearly impossible. The `switch` statement is supported, but each `case` must end with `break` or `return`; fall-through between cases is not allowed. This ensures that `switch` can be modeled as a nested conditional.

**No side effects within expressions.** Expressions like `a[i++]` or `f(x) + g(y)` where `f` and `g` have side effects are forbidden. C leaves the evaluation order of subexpressions unspecified, creating undefined behavior when subexpressions have side effects. The StrictC parser requires that side effects (assignments, function calls with side effects) appear only as standalone statements.

**No variadic arguments.** Functions like `printf` with a variable number of arguments are not supported. Variadic functions require runtime type introspection that has no clean formal model.

**No static local variables.** Local variables declared `static` persist across function calls, effectively becoming global state scoped to a function. This complicates the local/global state separation.

**Limited function pointer support.** Function pointers can be stored and called, but the parser requires that the set of possible callees be statically determinable. This enables the parser to resolve indirect calls.

### 2.3 The Rationale

The guiding principle is: **support what is needed for verified systems code, exclude what would make verification impractical**. The seL4 kernel is written entirely within this subset, demonstrating that the restrictions are not onerous for serious systems programming.

---

## 3. Using the C Parser

### 3.1 The `install_C_file` Command

The primary interface to the parser is the Isabelle command `install_C_file`. Given a path to a C source file, it parses the file and generates Isabelle definitions within a locale.

```isabelle
theory MyVerification
  imports AutoCorres2.CTranslation
begin

install_C_file "my_program.c"

end
```

The command reads the C file, type-checks it according to StrictC rules, and produces:

1. **Type definitions** for every C struct appearing in the file.
2. **A global state record** (`globals`) containing fields for each global variable.
3. **One SIMPL procedure** per C function, representing the function body as a deeply embedded program in the SIMPL language.
4. **Modifies specifications** for each function, describing which global variables the function may change.

### 3.2 Configuration Options

The `install_C_file` command accepts several options that control parsing behavior:

```isabelle
install_C_file "my_program.c"
  [memsafe]           (* Generate memory-safety proof obligations *)
  [c_types]           (* Only generate type definitions, not code *)
  [c_defs]            (* Print generated definitions *)
  [no_modifies]       (* Skip automatic modifies proof generation *)
  [roots = f1, f2]    (* Only process functions f1 and f2 and their callees *)
  [machinety = 64]    (* Target machine word size: 32 or 64 *)
  [ghostty = nat]     (* Type of ghost state for specification variables *)
```

**`roots`** is particularly useful for large codebases: rather than processing every function in the file, you can specify the entry points and the parser will only process those functions and everything they transitively call.

**`machinety`** controls the word size. For seL4, this is typically 32 (ARM) or 64 (x86-64, RISC-V). The choice affects the size of `int`, `long`, and pointer types, and hence the range of values and the overflow behavior.

### 3.3 Include Files and Preprocessing

The C parser processes already-preprocessed C code. In practice, you typically set up a Makefile or build system that:

1. Runs the C preprocessor (`cpp` or `gcc -E`) on your source file.
2. Produces a single preprocessed `.c` file with all includes resolved.
3. Passes this preprocessed file to `install_C_file`.

The `l4v` repository includes infrastructure for this. Header files for standard library functions (`string.h`, `stdlib.h`, etc.) are not available by default; you must provide your own stubs or model the needed functions.

---

## 4. What the Parser Produces

### 4.1 A Concrete Example

Consider the following C function:

```c
/* max.c */
unsigned int max(unsigned int a, unsigned int b) {
    if (a > b) {
        return a;
    } else {
        return b;
    }
}
```

After `install_C_file "max.c"`, the parser generates (approximately) the following SIMPL procedure within a locale:

```isabelle
context max_global_addresses
begin

definition max_body :: "(globals myvars, int, strictc_errortype) com"
where
  "max_body \<equiv>
    TRY
      Cond {s. unat (a_' (locals s)) > unat (b_' (locals s))}
        (creturn globals_update ret__unsigned_update (\<lambda>s. a_' (locals s)))
        (creturn globals_update ret__unsigned_update (\<lambda>s. b_' (locals s)))
    CATCH SKIP
    END"

end
```

Several things to note:

- **Parameters become local state**: the function parameters `a` and `b` are fields `a_'` and `b_'` in a local variables record.
- **The body is a SIMPL `com`**: a deeply embedded command in the SIMPL language (which we studied in Module 08).
- **Return is modeled via exceptions**: `creturn` sets a return variable and throws an exception caught by the `TRY`/`CATCH` wrapper. See Section 4.1.2 below for details.
- **Unsigned comparison**: `unat` converts a machine word to a natural number for comparison. See Section 4.1.1 below for the full family of word conversion functions.

#### 4.1.1 Word Conversion Functions: `unat`, `scast`, `ucast`

The SIMPL output uses several functions to convert between machine words and mathematical values. Understanding these is essential for reading parser output.

**`unat :: 'a::len word \<Rightarrow> nat`** converts an unsigned machine word to a natural number. For a 32-bit word `w`, `unat w` is the value of `w` interpreted as an unsigned integer in the range `[0, 2^32 - 1]`. This appears throughout the parser output whenever C performs unsigned comparisons or uses unsigned values in arithmetic guard conditions.

```isabelle
(* Examples *)
unat (5 :: 32 word) = 5
unat (0 :: 32 word) = 0
unat (0xFFFFFFFF :: 32 word) = 4294967295
```

**`ucast :: 'a::len word \<Rightarrow> 'b::len word`** performs an unsigned cast between word types of different widths. When casting to a wider type, the value is zero-extended. When casting to a narrower type, the value is truncated. This models C's implicit integer conversions for unsigned types.

```isabelle
(* Widening: zero-extends *)
ucast (0xFF :: 8 word) = (0x000000FF :: 32 word)

(* Narrowing: truncates *)
ucast (0x12345678 :: 32 word) = (0x78 :: 8 word)
```

**`scast :: 'a::len word \<Rightarrow> 'b::len word`** performs a signed cast. When casting to a wider type, the value is sign-extended. This models C's implicit conversions for signed types.

```isabelle
(* Sign-extends negative values *)
scast (0xFF :: 8 signed word) = (0xFFFFFFFF :: 32 signed word)   (* -1 \<rightarrow> -1 *)
```

**`sint :: 'a::len word \<Rightarrow> int`** converts a machine word to a signed integer, interpreting the word using two's complement.

These functions interact with C's "usual arithmetic conversions": when C promotes a `char` to an `int` or compares an `unsigned` with a `signed`, the parser inserts the appropriate cast function.

#### 4.1.2 `creturn` and the Exception-Based Return Model

C's `return` statement has a non-trivial semantics: it transfers control from an arbitrary point in the function body back to the caller, bypassing any remaining statements. In SIMPL, this is modeled using the `Throw` exception mechanism.

The `creturn` combinator encapsulates this pattern:

```isabelle
definition creturn ::
  "(('a \<Rightarrow> 'a) \<Rightarrow> ('c, 'd) state_scheme \<Rightarrow> ('c, 'd) state_scheme)
   \<Rightarrow> (('e \<Rightarrow> 'e) \<Rightarrow> 'a \<Rightarrow> 'a)
   \<Rightarrow> (('c, 'd) state_scheme \<Rightarrow> 'e)
   \<Rightarrow> (('c, 'd) state_scheme, 'f, 'g) com"
where
  "creturn global_upd ret_upd v \<equiv>
     Basic (\<lambda>s. global_upd (ret_upd (\<lambda>_. v s)) s) ;; Throw"
```

The three arguments are:

1. **`global_upd`** (`globals_update`): the function that updates the global portion of the state. The return value is stored in a global variable because the caller needs to read it after the function returns.
2. **`ret_upd`** (e.g., `ret__unsigned_update`): the field updater for the return-value variable in the globals record. Its name follows the pattern `ret__<type>_update`.
3. **`v`**: a function from the current state to the return value. For `return a`, this is `\<lambda>s. a_' (locals s)`.

The `Throw` at the end causes control to jump to the enclosing `CATCH` block. The entire function body is wrapped in `TRY ... CATCH SKIP END`, so the `Throw` exits the body and execution continues after the `CATCH` (i.e., the function returns to the caller).

**Multiple returns.** If a function has multiple `return` statements, each becomes a separate `creturn` followed by `Throw`. Only the first one executed takes effect; subsequent code is skipped because `Throw` transfers control immediately.

### 4.2 Example: A Function with Global State

Now consider C functions that read and write a global variable:

```c
/* counter.c */
unsigned counter;

void increment(void) {
    counter++;
}

unsigned get_and_reset(void) {
    unsigned old = counter;
    counter = 0;
    return old;
}
```

After `install_C_file "counter.c"`, the parser generates a global state record that includes `counter` as a field, and SIMPL procedures for both functions.

**The global state record:**

```isabelle
record globals =
  counter_' :: "32 word"
  t_hrs_' :: "heap_raw_state"
```

The `counter_'` field holds the current value of the C global variable `counter`. The `t_hrs_'` field (typed heap representation state) is always present --- it represents the raw heap for dynamically allocated memory and pointer dereferences. Even if a program uses no pointers, `t_hrs_'` appears in the globals record because the parser conservatively includes it.

**Understanding `t_hrs_'`:** The name stands for "typed heap raw state." It bundles the byte-level memory (`heap_mem`) with the type descriptor (`heap_type_desc`) that tracks which typed objects occupy which addresses. When a C function dereferences a pointer `*p`, the SIMPL output accesses `t_hrs_'` to read or update the heap. For functions that only manipulate global scalars (like `counter`), `t_hrs_'` is present in the record but untouched by the function body.

**SIMPL output for `increment`:**

```isabelle
definition increment_body :: "(globals myvars, unit, strictc_errortype) com"
where
  "increment_body \<equiv>
    Basic (\<lambda>s. globals_update
      (counter_'_update (\<lambda>old. old + 1))
      s)"
```

This is straightforward: `increment` reads the `counter_'` field from globals, adds 1 (using word arithmetic, so modular at `2^32`), and writes the result back. There is no `TRY`/`CATCH` because the function returns `void` --- there is no return value to communicate via `Throw`.

**SIMPL output for `get_and_reset`:**

```isabelle
definition get_and_reset_body :: "(globals myvars, int, strictc_errortype) com"
where
  "get_and_reset_body \<equiv>
    TRY
      Basic (\<lambda>s. locals_update
        (old_'_update (\<lambda>_. counter_' (globals s)))
        s) ;;
      Basic (\<lambda>s. globals_update
        (counter_'_update (\<lambda>_. 0))
        s) ;;
      creturn globals_update ret__unsigned_update (\<lambda>s. old_' (locals s))
    CATCH SKIP
    END"
```

This shows a more complex interaction between locals and globals:

1. **Read global into local**: the first `Basic` copies `counter_'` from the global state into the local variable `old_'`.
2. **Write global**: the second `Basic` sets `counter_'` to zero. Note how `globals_update` wraps the field update, distinguishing global writes from local writes.
3. **Return**: `creturn` sets the return value to `old_'` and throws an exception to exit.

**The modifies proof for `increment`:**

```isabelle
lemma increment_modifies:
  "\<forall>s. \<Gamma> \<turnstile>\<^bsub>/UNIV\<^esub>
    {s} Call increment_'proc
    {t. t may_only_modify_globals s in [counter]}"
```

This states that `increment` may only modify the `counter` global. The parser generates this automatically by analyzing the `counter_'_update` in the body. All other globals (and in particular `t_hrs_'`) are guaranteed unchanged.

The `may_only_modify_globals s in [counter]` predicate expands to:

```isabelle
"t may_only_modify_globals s in [counter] \<equiv>
   t_hrs_' (globals t) = t_hrs_' (globals s)
   (* ... and all other globals fields equal ... *)"
```

Every global field except `counter_'` must have the same value in the post-state `t` as in the pre-state `s`.

### 4.3 Inspecting Generated Definitions

After `install_C_file`, you can inspect the generated definitions and theorems using standard Isabelle commands:

```isabelle
(* View the SIMPL body of a function *)
thm max_body_def
thm increment_body_def
thm get_and_reset_body_def

(* View the modifies proof *)
thm increment_modifies
thm max_modifies

(* View type definitions *)
print_record globals      (* show all fields in the globals record *)
print_record point_C      (* show fields of a struct type *)

(* View the locale context *)
print_locale max_global_addresses
```

The `thm` command prints a named theorem. The `_body_def` suffix is the naming convention for SIMPL procedure bodies. The `_modifies` suffix names the automatically generated modifies lemma.

**Tip**: if you are unsure what names the parser generated, use Isabelle's `find_theorems` command:

```isabelle
find_theorems name: "increment"   (* lists all theorems with "increment" in the name *)
```

### 4.4 Struct Type Definitions

For a C struct:

```c
struct point {
    int x;
    int y;
};
```

The parser generates an Isabelle record type:

```isabelle
record point_C =
  x_C :: "32 signed word"
  y_C :: "32 signed word"
```

The field names are suffixed with `_C` to avoid clashes with Isabelle identifiers. The type `32 signed word` is a 32-bit signed machine word, matching C's `int` on a 32-bit platform.

### 4.5 The Global State Record

All global variables are collected into a single record:

```c
unsigned int counter;
struct point origin;
```

becomes:

```isabelle
record globals =
  counter_' :: "32 word"
  origin_' :: "point_C"
  t_hrs_' :: "heap_raw_state"   (* the raw heap *)
```

The `t_hrs_'` field is special: it represents the entire heap (dynamically allocated memory). Every global variable that is a pointer indirectly references data stored in this heap.

---

## 5. The Memory Model

### 5.1 Byte-Level Representation

The C parser uses a byte-level memory model where the heap is fundamentally a mapping from addresses to bytes:

```isabelle
type_synonym addr = "machine_word"
type_synonym byte = "8 word"
type_synonym heap_mem = "addr \<Rightarrow> byte"
```

The `heap_raw_state` bundles the raw memory with type-tag information used to track which typed values occupy which regions:

```isabelle
type_synonym heap_raw_state = "heap_mem \<times> heap_type_desc"
```

The `heap_type_desc` maps each address to information about whether it is currently occupied by a typed value and, if so, what type and at what offset.

### 5.2 Typed Access

Rather than working directly with bytes, the framework provides typed access functions:

```isabelle
h_val :: "heap_mem \<Rightarrow> 'a::c_type ptr \<Rightarrow> 'a"
heap_update :: "'a::c_type ptr \<Rightarrow> 'a \<Rightarrow> heap_mem \<Rightarrow> heap_mem"
```

Here `h_val h p` reads the value of type `'a` at pointer `p` from heap `h`, and `heap_update p v h` writes value `v` of type `'a` at pointer `p` in heap `h`.

The `c_type` type class ensures that the type has a well-defined byte representation: `to_bytes :: 'a \<Rightarrow> byte list` and `from_bytes :: byte list \<Rightarrow> 'a`, with round-trip properties.

### 5.3 Pointer Validity

Not every pointer value is valid for reading or writing. The framework provides several validity predicates:

**`c_guard :: 'a::c_type ptr \<Rightarrow> bool`** --- The pointer is non-null and properly aligned. This is a necessary condition for any dereference.

**`ptr_valid :: heap_type_desc \<Rightarrow> 'a::c_type ptr \<Rightarrow> bool`** --- The pointer points to a region of memory that is currently allocated for a value of type `'a`. This is the key predicate for memory-safety reasoning.

**`ptr_valid_d :: heap_type_desc \<Rightarrow> 'a::c_type ptr \<Rightarrow> bool`** --- A stronger variant that additionally asserts the pointer's footprint does not overlap with any other typed value's footprint.

These predicates appear as preconditions in verification proofs. To verify a C function that dereferences a pointer `p`, you must show that `ptr_valid` holds for `p` in the current heap state.

### 5.4 Pointer Arithmetic

Pointer arithmetic in C is defined in terms of the pointed-to type's size:

```isabelle
ptr_add :: "'a::c_type ptr \<Rightarrow> int \<Rightarrow> 'a ptr"
```

`ptr_add p n` advances the pointer by `n * size_of TYPE('a)` bytes. The key lemmas relate pointer arithmetic to array access:

```isabelle
lemma h_val_ptr_add_array:
  "\<lbrakk> valid_array p n h; i < n \<rbrakk>
   \<Longrightarrow> h_val h (ptr_add p (int i)) = array_index (h_val h (array_ptr_coerce p)) i"
```

---

## 6. Modifies Proofs

### 6.1 What Are Modifies Proofs?

A *modifies specification* describes which global variables a function may change. For the `max` function above, which only reads its parameters and returns a value without touching global state, the modifies specification would be:

```isabelle
lemma max_modifies:
  "\<forall>s. \<Gamma> \<turnstile>\<^bsub>/UNIV\<^esub>
    {s} Call max_'proc {t. t may_only_modify_globals s in []}"
```

This says: after calling `max`, the global state `t` equals `s` on all global variables. The function modifies nothing.

For a function that increments a global counter:

```c
void increment(void) {
    counter++;
}
```

The modifies specification would be:

```isabelle
lemma increment_modifies:
  "\<forall>s. \<Gamma> \<turnstile>\<^bsub>/UNIV\<^esub>
    {s} Call increment_'proc {t. t may_only_modify_globals s in [counter]}"
```

### 6.2 Automatic Generation

The `install_C_file` command automatically generates and attempts to prove modifies specifications for each function. It does this by syntactic analysis: it examines which global variable fields are written in the function body and generates a modifies clause listing exactly those fields.

These proofs are Hoare triples in the SIMPL logic. They are typically discharged automatically by the `vcg` (verification condition generator) tactic combined with `simp`.

If automatic proof fails (which can happen for complex functions with indirect writes through pointers), the user can disable automatic generation with `[no_modifies]` and provide manual modifies proofs.

### 6.3 Why Modifies Proofs Matter

Modifies specifications are essential for modular reasoning. When verifying a function `f` that calls `g`, we need to know what `g` might change. Without modifies specifications, calling `g` could invalidate any fact about global state, forcing us to re-establish everything after every call. With modifies specifications, we know exactly which globals may have changed and can preserve facts about the rest.

---

## 7. Advanced Parser Features

### 7.1 Ghost State

The parser supports *ghost state*: additional specification-only variables that do not exist in the C code but are available for writing specifications:

```isabelle
install_C_file "my_program.c" [ghostty = nat]
```

Ghost state is useful for tracking abstract quantities (like the number of elements in a data structure) that are implicit in the C code but needed for the specification.

### 7.2 Handling Multiple Translation Units

Real C programs consist of multiple `.c` files. The parser processes one file at a time, but the `l4v` infrastructure supports linking multiple translation units by:

1. Parsing each `.c` file separately.
2. Ensuring consistent type and function declarations across files.
3. Combining the results into a single verification environment.

### 7.3 Preprocessor Macros and Assertions

C macros are expanded by the preprocessor before parsing. Assertion macros (`assert(expr)`) can be modeled as specification annotations if appropriately defined.

---

## 8. Exercises

### Theory

**Exercise 9a.1.** Explain why forbidding `&x` for local variables simplifies the memory model. What would change in the parser's output if locals could be addressed?

**Exercise 9a.2.** Consider the following C code:
```c
int f(int x) {
    return x++ + x;
}
```
Explain why this code is rejected by the StrictC parser. What is the underlying problem in the C standard?

**Exercise 9a.3.** Why are modifies proofs formulated as Hoare triples rather than as simple set-membership assertions? What would we lose with a simpler formulation?

**Exercise 9a.4.** Explain the role of `heap_type_desc` in the memory model. Why is a raw byte mapping (`heap_mem`) insufficient for type-safe reasoning?

### Isabelle

**Exercise 9a.5.** Write a C file containing a function `unsigned int add(unsigned int a, unsigned int b)` that returns `a + b`. Parse it with `install_C_file` and examine the generated SIMPL body. Identify the local variable record fields and the return mechanism.

**Exercise 9a.6.** Write a C file containing a struct with three fields and a function that reads one field. Parse it and identify the generated record type and the field access in the SIMPL body.

**Exercise 9a.7.** Write a C file with two global variables and a function that swaps them. Examine the automatically generated modifies specification. Does it correctly list both globals?

---

## References

- Tuch, H., Klein, G., Norrish, M. "Types, Bytes, and Separation Logic." *POPL*, 2007.
- Greenaway, D., Andronick, J., Klein, G. "Bridging the Gap: Automatic Verified Abstraction of C." *ITP*, 2012.
- Winwood, S., Klein, G., Sewell, T., Andronick, J., Cock, D., Norrish, M. "Mind the Gap: A Verification Framework for Low-Level C." *TPHOLs*, 2009.
- The l4v repository: `tools/c-parser/` directory and `README.md`.

---

*Next: [Lecture 09b: The AutoCorres Abstraction Pipeline](lecture_09b_autocorres_pipeline.md)*
