# Lecture 09d: Memory Models & Separation Logic

> **Module 09 --- C Verification: Parser, AutoCorres & Proofs**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe the byte-level C memory model formalized by Tuch, Klein, and Norrish, including value representation, pointer arithmetic, and alignment.
2. State the core connectives of separation logic and explain the frame rule.
3. Explain how AutoCorres's heap lifting relates to separation logic through implicit type-based separation.
4. Distinguish between situations where typed heaps suffice and where explicit separation logic is needed.
5. Describe how the seL4 verification uses monadic reasoning with typed heaps rather than full separation logic for most proofs.
6. Identify the key components of the l4v library's separation logic infrastructure.

---

## 1. The C Memory Model

### 1.1 Overview

The C language defines an abstract machine with a flat, byte-addressable memory. The formal memory model used in the seL4 verification, developed by Tuch, Klein, and Norrish (POPL 2007), faithfully captures this abstraction in Isabelle/HOL while providing enough structure for practical verification.

The key challenge is that C treats memory simultaneously at two levels:

- **Byte level**: memory is a sequence of bytes; any region can be read or written as raw bytes.
- **Typed level**: C values (integers, structs, pointers) occupy contiguous byte regions and have type-specific representations.

The formal model must bridge these levels, supporting both low-level byte manipulation (needed for systems code like memory allocators) and high-level typed reasoning (used for most application logic).

### 1.2 Types and Value Representation

Every C type has a *size* (in bytes) and an *alignment* requirement:

```isabelle
class c_type =
  fixes size_of :: "'a itself \<Rightarrow> nat"
  fixes align_of :: "'a itself \<Rightarrow> nat"
  fixes to_bytes :: "'a \<Rightarrow> byte list"
  fixes from_bytes :: "byte list \<Rightarrow> 'a"
```

The functions `to_bytes` and `from_bytes` convert between typed values and byte sequences. They satisfy a round-trip property:

**Axiom (Value representation round-trip).**

$$\texttt{from\_bytes}(\texttt{to\_bytes}(v)) = v$$

and `length (to_bytes v) = size_of TYPE('a)` for all `v :: 'a`.

The converse does not hold in general: not every byte sequence represents a valid value of type `'a`. The domain of `from_bytes` includes all byte lists of the correct length, but the result may be arbitrary for invalid representations.

**Example.** For `unsigned int` on a 32-bit little-endian platform:

```isabelle
size_of TYPE(32 word) = 4
align_of TYPE(32 word) = 4

to_bytes (0x01020304 :: 32 word) = [0x04, 0x03, 0x02, 0x01]
from_bytes [0x04, 0x03, 0x02, 0x01] = (0x01020304 :: 32 word)
```

### 1.3 Struct Layout

For a C struct:

```c
struct point {
    int x;
    int y;
};
```

The memory layout follows C's rules: fields are laid out sequentially with padding as needed to satisfy alignment constraints. The `field_lvalue` function maps a struct pointer and field name to the byte offset of that field:

```isabelle
field_lvalue :: "'a::c_type ptr \<Rightarrow> field_name \<Rightarrow> addr"
```

The total size includes any trailing padding required for array alignment:

```isabelle
size_of TYPE(point_C) = 8   (* 4 bytes for x + 4 bytes for y, no padding needed *)
align_of TYPE(point_C) = 4  (* same as the strictest member alignment *)
```

### 1.4 Pointer Arithmetic

C pointer arithmetic is defined in terms of the pointed-to type's size. For a pointer `p :: 'a ptr` and integer `n`:

```isabelle
definition ptr_add :: "'a::c_type ptr \<Rightarrow> int \<Rightarrow> 'a ptr"
where
  "ptr_add p n = Ptr (ptr_val p + of_int (n * int (size_of TYPE('a))))"
```

The result is a pointer whose raw address is `ptr_val p + n * size_of TYPE('a)`.

**Key properties**:

```isabelle
lemma ptr_add_0: "ptr_add p 0 = p"
lemma ptr_add_add: "ptr_add (ptr_add p m) n = ptr_add p (m + n)"
```

Pointer subtraction yields the number of elements between two pointers:

```isabelle
definition ptr_diff :: "'a::c_type ptr \<Rightarrow> 'a ptr \<Rightarrow> int"
where
  "ptr_diff p q = (ptr_val p - ptr_val q) div int (size_of TYPE('a))"
```

### 1.5 The Heap

The heap is the central data structure of the memory model:

```isabelle
type_synonym heap_mem = "addr \<Rightarrow> byte"
type_synonym heap_type_desc = "addr \<Rightarrow> (bool \<times> typ_uinfo) option"
type_synonym heap_raw_state = "heap_mem \<times> heap_type_desc"
```

- `heap_mem` maps each address to its current byte value.
- `heap_type_desc` tracks which addresses are currently "owned" by typed values. For each address, it records whether the address is part of a typed object and, if so, which type and at what offset within the object.

Typed access through the heap uses `h_val` and `heap_update`:

```isabelle
definition h_val :: "heap_mem \<Rightarrow> 'a::c_type ptr \<Rightarrow> 'a"
where
  "h_val h p = from_bytes (map h [ptr_val p ..< ptr_val p + size_of TYPE('a)])"

definition heap_update :: "'a::c_type ptr \<Rightarrow> 'a \<Rightarrow> heap_mem \<Rightarrow> heap_mem"
where
  "heap_update p v h = (\<lambda>a.
     if a \<in> {ptr_val p ..< ptr_val p + size_of TYPE('a)}
     then to_bytes v ! (a - ptr_val p)
     else h a)"
```

The key correctness lemma:

```isabelle
lemma h_val_heap_update:
  "h_val (heap_update p v h) p = v"
```

And the non-interference lemma for disjoint pointers:

```isabelle
lemma h_val_heap_update_disjoint:
  "\<lbrakk> {ptr_val p ..< ptr_val p + size_of TYPE('a)} \<inter>
     {ptr_val q ..< ptr_val q + size_of TYPE('b)} = {} \<rbrakk>
   \<Longrightarrow> h_val (heap_update q w h) p = h_val h p"
```

### 1.6 Alignment and Validity

A pointer is *aligned* if its address is a multiple of the type's alignment requirement:

```isabelle
definition ptr_aligned :: "'a::c_type ptr \<Rightarrow> bool"
where
  "ptr_aligned p = (ptr_val p mod align_of TYPE('a) = 0)"
```

The `c_guard` predicate combines alignment with non-nullity:

```isabelle
definition c_guard :: "'a::c_type ptr \<Rightarrow> bool"
where
  "c_guard p = (ptr_aligned p \<and> ptr_val p \<noteq> 0 \<and>
                ptr_val p + size_of TYPE('a) \<le> addr_card)"
```

The condition `ptr_val p + size_of TYPE('a) \<le> addr_card` ensures the object does not wrap around the address space.

---

## 2. Separation Logic

### 2.1 Motivation

The non-interference lemma for disjoint pointers (Section 1.5) is the key to reasoning about pointer-manipulating programs. But manually tracking pointer disjointness is extremely tedious: for $n$ pointers, there are $O(n^2)$ disjointness conditions.

**Separation logic** (Reynolds 2002, O'Hearn, Reynolds, Yang 2001) provides a systematic framework for this reasoning. Its central innovation is the *separating conjunction* $P \ast Q$, which asserts that the heap can be split into two disjoint parts, one satisfying $P$ and the other satisfying $Q$.

### 2.2 Assertions as Heap Predicates

In separation logic, assertions are predicates on heaps. A heap is typically modeled as a partial function from addresses to values:

```isabelle
type_synonym heap = "addr \<rightharpoonup> byte"
```

An assertion $P$ is a predicate `heap \<Rightarrow> bool`.

### 2.3 Core Connectives

**Points-to**: $p \mapsto v$ asserts that the heap contains exactly one allocated object: the value $v$ at address $p$.

```isabelle
definition maps_to :: "'a::c_type ptr \<Rightarrow> 'a \<Rightarrow> heap \<Rightarrow> bool"  ("_ \<mapsto> _")
where
  "p \<mapsto> v = (\<lambda>h. dom h = {ptr_val p ..< ptr_val p + size_of TYPE('a)}
                   \<and> h_val (the \<circ> h) p = v)"
```

**Separating conjunction**: $P \ast Q$ asserts that the heap can be split into two disjoint parts.

```isabelle
definition sep_conj :: "(heap \<Rightarrow> bool) \<Rightarrow> (heap \<Rightarrow> bool) \<Rightarrow> (heap \<Rightarrow> bool)"
  (infixr "\<and>\<^sup>*" 35)
where
  "P \<and>\<^sup>* Q = (\<lambda>h. \<exists>h1 h2. h = h1 ++ h2 \<and> dom h1 \<inter> dom h2 = {} \<and> P h1 \<and> Q h2)"
```

**Separating implication (magic wand)**: $P \mathrel{-\!\!\ast} Q$ asserts that if we add a heap satisfying $P$, the combined heap satisfies $Q$.

```isabelle
definition sep_impl :: "(heap \<Rightarrow> bool) \<Rightarrow> (heap \<Rightarrow> bool) \<Rightarrow> (heap \<Rightarrow> bool)"
  (infixr "-\<^sup>*" 25)
where
  "P -\<^sup>* Q = (\<lambda>h. \<forall>h'. dom h \<inter> dom h' = {} \<and> P h' \<longrightarrow> Q (h ++ h'))"
```

**Empty heap**: $\textbf{emp}$ asserts that the heap is empty.

```isabelle
definition sep_empty :: "heap \<Rightarrow> bool"  ("\<box>")
where
  "\<box> = (\<lambda>h. h = Map.empty)"
```

### 2.4 Key Properties

The separating conjunction is commutative and associative:

$$P \ast Q \iff Q \ast P$$
$$P \ast (Q \ast R) \iff (P \ast Q) \ast R$$

The empty heap is the unit:

$$P \ast \textbf{emp} \iff P$$

### 2.5 The Frame Rule

The most important proof rule in separation logic is the **frame rule**:

$$\frac{\{P\}\ c\ \{Q\}}{\{P \ast R\}\ c\ \{Q \ast R\}}$$

provided $c$ does not modify variables free in $R$.

**Interpretation**: if a command $c$ is correct assuming it operates on a heap satisfying $P$ and produces a heap satisfying $Q$, then $c$ is also correct when extra heap $R$ is present --- and $R$ is preserved unchanged.

This is the key to modular reasoning: we verify each function against the minimal heap it needs, and the frame rule lets us compose verifications without re-proving anything about the untouched heap.

**Example.** Suppose we have proved:

$$\{p \mapsto x\}\ \texttt{*p = x + 1}\ \{p \mapsto (x+1)\}$$

By the frame rule:

$$\{p \mapsto x \ast q \mapsto y\}\ \texttt{*p = x + 1}\ \{p \mapsto (x+1) \ast q \mapsto y\}$$

The value at `q` is preserved without any explicit reasoning about pointer disjointness. The separating conjunction `*` implicitly guarantees that `p` and `q` point to disjoint regions.

### 2.6 Separation Logic Hoare Triples

A separation-logic Hoare triple $\{P\}\ c\ \{Q\}$ has a *local* interpretation: $P$ describes only the memory that $c$ accesses. This is in contrast to classical Hoare logic where $P$ describes the entire state.

The advantage is compositionality: proofs about individual functions can be combined without reasoning about the entire program state. The frame rule is the formal mechanism for this composition.

---

## 3. Typed Heaps vs. Separation Logic

### 3.1 AutoCorres's Typed Heaps as Implicit Separation

AutoCorres's heap lifting (Phase 4, HL) creates one typed heap per C type:

```isabelle
record lifted_globals =
  heap_w32 :: "32 word ptr \<Rightarrow> 32 word"
  heap_point_C :: "point_C ptr \<Rightarrow> point_C"
  ...
```

This representation provides a form of *implicit* separation: writing to `heap_w32` cannot affect `heap_point_C` because they are separate record fields. Values of different types are automatically separated.

This covers the most common case in well-typed C code: distinct types occupy disjoint memory regions. When this holds, typed heaps provide a simple, efficient alternative to explicit separation logic.

### 3.2 When Typed Heaps Suffice

Typed heaps are sufficient when:

- Each memory region has a fixed type throughout the function's execution.
- The function does not perform type-punning (interpreting the same bytes as different types).
- Different pointers of the same type are known to be distinct through other means (e.g., they are function parameters guaranteed distinct by the caller).

For the majority of seL4 verification, typed heaps suffice. The proofs use Hoare-logic reasoning with `wp` (weakest precondition) tactics, and the typed heap structure handles inter-type non-interference automatically.

### 3.3 When Explicit Separation Logic Is Needed

Explicit separation logic becomes necessary when:

- **Same-type non-interference**: two pointers of the same type must be shown disjoint. Typed heaps do not help here because both pointers index the same heap.
- **Data structure invariants**: linked lists, trees, and graphs require separation-logic assertions to express that distinct nodes occupy disjoint memory.
- **Memory allocation/deallocation**: allocators manipulate raw memory that does not have a fixed type.
- **Type-punning**: reinterpreting memory as a different type (e.g., casting `void *` to a struct pointer).

### 3.4 The seL4 Approach

The seL4 verification primarily uses monadic reasoning with typed heaps, not full separation logic. This was a pragmatic choice:

- Most kernel code is well-typed and benefits from typed heaps.
- Separation logic proofs are more complex to write and automate.
- The `wp` tactic (weakest precondition) integrates well with typed heaps but requires additional setup for separation logic.

Where same-type non-interference is needed (e.g., capability table operations), the seL4 proofs use ad hoc disjointness reasoning rather than a full separation-logic framework.

For the capDL (capability distribution language) layer, however, the l4v library does include a separation logic framework.

---

## 4. Separation Logic in the l4v Library

### 4.1 The sep-capDL Framework

The `proof/sep-capDL/` directory in the l4v repository contains a separation logic framework for reasoning about capability distributions:

```
l4v/proof/sep-capDL/
  Sep_Algebra.thy        -- Separation algebras
  Sep_Tactics.thy        -- Proof tactics
  Separation_D.thy       -- Separation logic for capDL
```

### 4.2 Separation Algebras

The framework abstracts over the particular heap model using the algebraic structure of *separation algebras* (Calcagno, O'Hearn, Yang, 2007):

```isabelle
class sep_algebra = zero +
  fixes sep_disj :: "'a \<Rightarrow> 'a \<Rightarrow> bool"  (infix "##" 60)
  fixes plus :: "'a \<Rightarrow> 'a \<Rightarrow> 'a"        (infixl "+" 65)
  assumes sep_disj_zero: "x ## 0"
  assumes sep_disj_commutativity: "x ## y \<Longrightarrow> y ## x"
  assumes sep_add_zero: "x + 0 = x"
  assumes sep_add_commute: "x ## y \<Longrightarrow> x + y = y + x"
  assumes sep_add_assoc:
    "\<lbrakk> x ## y; y ## z; x ## (y + z) \<rbrakk> \<Longrightarrow> (x + y) + z = x + (y + z)"
```

A separation algebra provides:
- A partial combining operation `+` (merge two disjoint heaps).
- A disjointness predicate `##`.
- A zero element `0` (empty heap).

### 4.3 The `sep_conj` and Tactics

```isabelle
definition sep_conj :: "('a::sep_algebra \<Rightarrow> bool) \<Rightarrow> ('a \<Rightarrow> bool) \<Rightarrow> ('a \<Rightarrow> bool)"
  (infixr "\<and>\<^sup>*" 35)
where
  "P \<and>\<^sup>* Q \<equiv> \<lambda>h. \<exists>h1 h2. h1 ## h2 \<and> h = h1 + h2 \<and> P h1 \<and> Q h2"
```

The `sep_conj_ac` rules rewrite separating conjunctions into a canonical form:

```isabelle
lemmas sep_conj_ac =
  sep_conj_commute   (* P * Q = Q * P *)
  sep_conj_assoc     (* P * (Q * R) = (P * Q) * R *)
  sep_conj_left_commute  (* P * (Q * R) = Q * (P * R) *)
```

The `sep_cancel` tactic automatically cancels matching conjuncts between a goal and hypotheses.

---

## 5. Worked Example: Separation Logic Proof

### 5.1 The `swap` Function

Consider a C function that swaps two pointed-to unsigned values:

```c
/* swap.c */
void swap(unsigned *a, unsigned *b) {
    unsigned tmp = *a;
    *a = *b;
    *b = tmp;
}
```

This function is a classic separation logic example because it requires reasoning about two pointers that must refer to disjoint memory regions.

### 5.2 The Separation Logic Specification

The specification using separation logic notation:

$$\{a \mapsto x \ast b \mapsto y\}\ \texttt{swap(a, b)}\ \{a \mapsto y \ast b \mapsto x\}$$

In Isabelle, using the `sep_conj` notation:

```isabelle
lemma swap_sep_spec:
  "\<lbrace> \<lambda>s. (a \<mapsto> x \<and>\<^sup>* b \<mapsto> y) (heap_of s) \<rbrace>
   swap' a b
   \<lbrace> \<lambda>_ s. (a \<mapsto> y \<and>\<^sup>* b \<mapsto> x) (heap_of s) \<rbrace>!"
```

The separating conjunction `\<and>\<^sup>*` does two things simultaneously:

1. **Asserts the values**: `a` points to `x` and `b` points to `y`.
2. **Asserts disjointness**: the memory regions for `a` and `b` do not overlap.

This is strictly stronger than the precondition `a \<noteq> b`: pointer inequality only means the base addresses differ, but the pointed-to objects could still overlap if they are large (e.g., structs or arrays). The separating conjunction guarantees that the *entire footprints* are disjoint.

### 5.3 The Proof in Detail

After AutoCorres with heap lifting, `swap'` has approximately this definition:

```isabelle
definition swap' :: "32 word ptr \<Rightarrow> 32 word ptr \<Rightarrow> (lifted_globals, unit) nondet_monad"
where
  "swap' a b \<equiv> do {
    tmp \<leftarrow> gets (\<lambda>s. heap_w32 s a);
    v_b \<leftarrow> gets (\<lambda>s. heap_w32 s b);
    modify (\<lambda>s. s\<lparr> heap_w32 := (heap_w32 s)(a := v_b) \<rparr>);
    modify (\<lambda>s. s\<lparr> heap_w32 := (heap_w32 s)(b := tmp) \<rparr>)
  }"
```

The separation logic proof proceeds step by step, tracking how the heap evolves:

```isabelle
lemma swap_sep_correct:
  "\<lbrace> \<lambda>s. (a \<mapsto> x \<and>\<^sup>* b \<mapsto> y) (heap_of s) \<and>
         is_valid_w32 s a \<and> is_valid_w32 s b \<rbrace>
   swap' a b
   \<lbrace> \<lambda>_ s. (a \<mapsto> y \<and>\<^sup>* b \<mapsto> x) (heap_of s) \<rbrace>!"
  unfolding swap'_def
  apply wp
  apply (clarsimp simp: sep_conj_def maps_to_def)
  (* At this point, the proof state contains:
     - h1, h2: the two disjoint sub-heaps from the precondition
     - dom h1 \<inter> dom h2 = {}   (disjointness)
     - h_val h1 a = x, h_val h2 b = y
     We must construct new sub-heaps for the postcondition. *)
  apply (rule_tac x="h1(a := to_bytes y)" in exI)
  apply (rule_tac x="h2(b := to_bytes x)" in exI)
  apply (intro conjI)
     (* Disjointness preserved: updates do not change domains *)
     apply (simp add: dom_fun_upd)
    (* Combined heap equals updated full heap *)
    apply (auto simp: map_add_def)
   (* a \<mapsto> y in updated h1 *)
   apply (simp add: h_val_heap_update)
  (* b \<mapsto> x in updated h2 *)
  apply (simp add: h_val_heap_update h_val_heap_update_disjoint)
  done
```

**Key steps explained:**

1. **Unfolding**: we expose `swap'`'s definition so `wp` can process the monadic operations.
2. **`wp`**: the weakest precondition tactic processes the four monadic operations (two reads, two writes) backwards, producing a single proof obligation about the initial state.
3. **Unfolding `sep_conj`**: we obtain witness heaps `h1` and `h2` and the disjointness assumption.
4. **Constructing witnesses**: for the postcondition, we provide updated sub-heaps where `a`'s region now contains `y` and `b`'s region contains `x`.
5. **Disjointness preservation**: since the updates only change values (not domains), the domains remain disjoint.
6. **Non-interference**: writing to `a` (in `h1`) does not affect the value at `b` (in `h2`) because the domains are disjoint. This is where separation logic pays off --- we get this fact for free from `dom h1 \<inter> dom h2 = {}`.

### 5.4 The `sep_cancel` Tactic

The `sep_cancel` tactic automates a common proof step: when the goal and a hypothesis both contain separating conjunctions, `sep_cancel` identifies matching conjuncts and cancels them.

**Example.** Suppose the goal is:

```isabelle
(a \<mapsto> y \<and>\<^sup>* b \<mapsto> x \<and>\<^sup>* R) h
```

and we have a hypothesis:

```isabelle
(a \<mapsto> y \<and>\<^sup>* P) h'
```

where `h` and `h'` are related by some frame. Applying `sep_cancel` will:

1. Match `a \<mapsto> y` in the goal with `a \<mapsto> y` in the hypothesis.
2. Cancel the matching conjuncts, reducing the goal to showing that the remaining conjuncts (`b \<mapsto> x \<and>\<^sup>* R`) hold in the remainder of the heap.

In Isabelle:

```isabelle
(* Before sep_cancel: *)
(* goal: (a \<mapsto> y \<and>\<^sup>* b \<mapsto> x \<and>\<^sup>* c \<mapsto> z) h *)
(* hypothesis: (a \<mapsto> y \<and>\<^sup>* rest) h *)
apply sep_cancel
(* After sep_cancel: *)
(* goal: (b \<mapsto> x \<and>\<^sup>* c \<mapsto> z) h' *)
(* where h' is the portion of h not covered by a \<mapsto> y *)
```

The tactic uses the commutativity and associativity of `\<and>\<^sup>*` (via `sep_conj_ac`) to rearrange conjuncts before matching. This is critical because separating conjunction is commutative and associative, so `a \<mapsto> y \<and>\<^sup>* b \<mapsto> x` and `b \<mapsto> x \<and>\<^sup>* a \<mapsto> y` are logically equivalent but syntactically different.

For proofs with many heap assertions, `sep_cancel` can be applied repeatedly:

```isabelle
apply sep_cancel+   (* apply sep_cancel one or more times *)
```

### 5.5 Contrast: Typed-Heap Proof for `swap`

Using AutoCorres's typed heaps (without separation logic), the same `swap` function is verified differently:

```isabelle
lemma swap_typed_heap:
  "\<lbrace> \<lambda>s. is_valid_w32 s a \<and> is_valid_w32 s b \<and> a \<noteq> b \<and>
         heap_w32 s a = x \<and> heap_w32 s b = y \<rbrace>
   swap' a b
   \<lbrace> \<lambda>_ s. heap_w32 s a = y \<and> heap_w32 s b = x \<rbrace>!"
  unfolding swap'_def
  apply wp
  apply clarsimp
  done
```

**Differences from the separation logic proof:**

1. **Disjointness is explicit**: we must state `a \<noteq> b` as a separate precondition. With separation logic, disjointness is implicit in `\<and>\<^sup>*`.
2. **Heap is global**: the typed-heap proof reasons about the entire `heap_w32` function. The fact that `(heap_w32 s)(a := v_b) b = y` (writing to `a` does not affect `b`) follows from `a \<noteq> b` via function update simplification. This is straightforward for two pointers but scales poorly to many pointers.
3. **No frame rule**: if we later embed `swap` in a larger context with additional valid pointers `c`, `d`, ..., the typed-heap proof must be re-done (or a frame-like lemma must be proved manually). With separation logic, the frame rule handles this automatically.
4. **Simpler for simple cases**: for functions with few pointer arguments, the typed-heap proof is shorter and more direct. Separation logic overhead is justified mainly when pointer structures are complex.

**When to use which approach:**

| Criterion | Typed heaps | Separation logic |
|-----------|------------|-----------------|
| Few pointers of known distinct types | Preferred | Overkill |
| Many same-type pointers | Awkward | Natural |
| Linked data structures | Very difficult | Designed for this |
| Frame reasoning needed | Manual | Automatic (frame rule) |
| Proof automation | `wp` + `clarsimp` | `wp` + `sep_cancel` |

---

## 6. Advanced Topics

### 6.1 The Burstall-Bornat Memory Model

The typed-heap approach used by AutoCorres is sometimes called the *Burstall-Bornat* model (after Rod Burstall's pioneering work on separate arrays for different struct fields). The key idea: instead of a single heap, maintain separate arrays indexed by field names:

```
heap_x :: point_C ptr \<Rightarrow> int    (* the x-field heap *)
heap_y :: point_C ptr \<Rightarrow> int    (* the y-field heap *)
```

This goes even further than AutoCorres's per-type splitting, splitting within a struct type. The advantage is that updating `p->x` does not affect `q->y` even when `p = q`. The seL4 verification does not use this fine-grained splitting, but it appears in some academic verification frameworks.

### 6.2 Fractional Permissions

Separation logic can be extended with *fractional permissions* (Boyland, 2003) to model shared read access:

- A full permission $\pi = 1$ allows reading and writing.
- A fractional permission $0 < \pi < 1$ allows only reading.
- Fractions can be split and combined: $p \mapsto_\pi v$ can be split into $p \mapsto_{\pi/2} v \ast p \mapsto_{\pi/2} v$.

This is useful for concurrent verification where multiple threads may read the same data. The l4v library does not currently use fractional permissions, as seL4 verification focuses on sequential correctness.

### 6.3 AutoCorrode and Crush Tactics

**AutoCorrode** (AWS Labs) is a research project exploring Rust verification using techniques related to AutoCorres. It translates Rust's MIR (Mid-level Intermediate Representation) into Isabelle definitions and leverages Rust's ownership type system for automatic separation reasoning.

**Crush** tactics are experimental high-automation tactics that combine `wp`, `simp`, and separation-logic reasoning into a single invocation. They aim to reduce the proof burden for routine C verification tasks.

---

## 7. Exercises

### Theory

**Exercise 9d.1.** Prove that $p \mapsto x \ast p \mapsto y$ is unsatisfiable (there is no heap satisfying it). What does this tell us about the meaning of the separating conjunction?

**Exercise 9d.2.** State and prove the frame rule for a simple imperative language with assignments `*p := e` and sequential composition `c1; c2`. Use the definitions from Section 2.

**Exercise 9d.3.** Explain the relationship between AutoCorres's typed heaps and the frame rule. In what sense does the typed heap representation "build in" the frame rule?

**Exercise 9d.4.** Consider a C function that swaps two `int` values through pointers:
```c
void swap(int *p, int *q) {
    int tmp = *p;
    *p = *q;
    *q = tmp;
}
```
Write the separation-logic specification for `swap`. Why is the precondition `p \neq q` insufficient --- what does separation logic add?

### Isabelle

**Exercise 9d.5.** Using the separation algebra framework, prove:
```isabelle
lemma sep_conj_empty: "(P \<and>\<^sup>* \<box>) = P"
```

**Exercise 9d.6.** Define a `list_seg` predicate in separation logic that asserts a singly-linked list segment from pointer `p` to pointer `q` with contents `xs :: 'a list`. Prove that `list_seg p q [] = (p = q \<and> \<box>)` and state (but need not prove) the recursive case.

**Exercise 9d.7.** Using AutoCorres with typed heaps, verify a function that reads a struct field through a pointer:
```c
int get_x(struct point *p) {
    return p->x;
}
```
What validity precondition is needed?

---

## References

- Tuch, H., Klein, G., Norrish, M. "Types, Bytes, and Separation Logic." *POPL*, 2007.
- Reynolds, J.C. "Separation Logic: A Logic for Shared Mutable Data Structures." *LICS*, 2002.
- O'Hearn, P.W., Reynolds, J.C., Yang, H. "Local Reasoning about Programs that Alter Data Structures." *CSL*, 2001.
- Calcagno, C., O'Hearn, P.W., Yang, H. "Local Action and Abstract Separation Logic." *LICS*, 2007.
- Klein, G., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.

---

*Next: [Recitation 09: AutoCorres Exercises](recitation_09_autocorres_exercises.md)*
