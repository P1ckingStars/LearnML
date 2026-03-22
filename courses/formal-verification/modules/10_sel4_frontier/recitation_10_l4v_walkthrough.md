# Recitation 10: l4v Repository Walkthrough

> **Module 10 --- seL4, Refinement & Frontier**
> Estimated time: 2--3 hours (in-class)

---

## Overview

This recitation is a guided tour of the l4v repository --- the Isabelle proof repository for seL4. The goal is not to build or check the proofs (which takes many hours) but to understand the structure, navigate the codebase, and read representative proof fragments.

By the end of this recitation, you will be able to:

1. Clone and navigate the l4v repository.
2. Identify the key directories and their roles.
3. Read a simple abstract specification and trace it through the three specification layers.
4. Find and read a simple refinement proof.
5. Understand the build system without actually running it.

---

## 1. Getting the Repository

### 1.1 Clone

The l4v repository is hosted on GitHub:

```bash
git clone https://github.com/seL4/l4v.git
cd l4v
```

The repository is large (~2 GB including history). You can use `--depth 1` for a shallow clone if space is a concern.

### 1.2 Related Repositories

The l4v repository depends on several other repositories:

- **seL4**: the C kernel source code (`https://github.com/seL4/seL4`).
- **isabelle**: a specific version of Isabelle used by the proofs.

These are typically managed by the `repo` tool (Google's repository management tool) or checked out manually. For this walkthrough, we only need l4v itself.

---

## 2. Repository Structure

### 2.1 Top-Level Directory Map

```
l4v/
  spec/             -- Specifications (all three layers)
    abstract/        -- Abstract specification (hand-written Isabelle/HOL)
    design/          -- Design specification (translated from Haskell)
    cspec/           -- C specification (from C parser)
    haskell/         -- Haskell source (input to translator)
    machine/         -- Machine/hardware specification
  proof/             -- Proofs
    refine/          -- Abstract-to-design refinement proof
    crefine/         -- Design-to-C refinement proof
    invariant-abstract/  -- Invariants of the abstract spec
    infoflow/        -- Information flow (confidentiality) proofs
    access-control/  -- Integrity/access control proofs
    sep-capDL/       -- Separation logic for capDL
    bisim/           -- Bisimulation proofs
  tools/             -- Tools
    c-parser/        -- The StrictC parser
    autocorres/      -- AutoCorres (or autocorres2)
    haskell-translator/  -- Haskell-to-Isabelle translator
    asmrefine/       -- Assembly refinement / translation validation
  lib/               -- Libraries
    Monads/          -- Monadic framework (nondet monad, wp, etc.)
    Word_Lib/        -- Machine word library
    Eisbach_Tools/   -- Custom Eisbach methods
    sep_algebra/     -- Separation algebra
  camkes/            -- CAmkES framework
  sys-init/          -- System initialization specification
  misc/              -- Miscellaneous utilities
```

### 2.2 Key Observations

- The `spec/` and `proof/` directories mirror each other: for each specification layer, there is a corresponding proof directory.
- The `lib/` directory contains reusable infrastructure shared across proofs.
- The `tools/` directory contains the C parser, AutoCorres, and other tools that are part of the trusted base or proof pipeline.

---

## 3. Exploring the Abstract Specification

### 3.1 Entry Point

Open `spec/abstract/Syscall_A.thy`. This is the top-level abstract specification of system call handling.

```isabelle
theory Syscall_A
imports
  Decode_A        -- System call decoding
  Interrupt_A     -- Interrupt handling
begin

(* The main system call handler *)
definition handle_event :: "event \<Rightarrow> (unit, 'z::state_ext) p_monad"
where
  "handle_event ev \<equiv> case ev of
     SyscallEvent call \<Rightarrow> handle_syscall call
   | UnknownSyscall n \<Rightarrow> handle_fault ...
   | UserLevelFault w1 w2 \<Rightarrow> handle_fault ...
   | Interrupt \<Rightarrow> handle_interrupt ...
   | VMFaultEvent data \<Rightarrow> handle_vm_fault ..."
```

**Task**: Read through `handle_event` and identify how different event types are dispatched.

### 3.2 A Specific System Call

Open `spec/abstract/Ipc_A.thy`. This contains the abstract specification of IPC (Inter-Process Communication), one of the most complex kernel operations.

```isabelle
definition send_ipc ::
  "bool \<Rightarrow> bool \<Rightarrow> badge \<Rightarrow> bool \<Rightarrow>
   obj_ref \<Rightarrow> obj_ref \<Rightarrow> (unit, 'z::state_ext) s_monad"
where
  "send_ipc blocking call badge can_grant thread ep \<equiv> do
     ep_obj \<leftarrow> get_endpoint ep;
     case ep_obj of
       IdleEP \<Rightarrow> when blocking $ do
         set_thread_state (BlockedOnSend ep ...) thread;
         set_endpoint ep (SendEP [thread])
       od
     | SendEP queue \<Rightarrow> when blocking $ do
         set_thread_state (BlockedOnSend ep ...) thread;
         set_endpoint ep (SendEP (queue @ [thread]))
       od
     | RecvEP (dest # queue) \<Rightarrow> do
         set_endpoint ep (case queue of [] \<Rightarrow> IdleEP | _ \<Rightarrow> RecvEP queue);
         do_ipc_transfer thread (Some ep) badge can_grant dest;
         ...
       od
   od"
```

**Task**: Read the IPC send specification. Identify the three cases (idle endpoint, send-waiting endpoint, receive-waiting endpoint) and explain what happens in each case.

### 3.3 Abstract State

Open `spec/abstract/Structures_A.thy` to see the abstract state definition:

```isabelle
record abstract_state =
  kheap :: "obj_ref \<Rightarrow> kernel_object option"
  cdt :: "cslot_ptr \<Rightarrow> cslot_ptr option"
  is_original_cap :: "cslot_ptr \<Rightarrow> bool"
  cur_thread :: obj_ref
  idle_thread :: obj_ref
  ...
```

**Task**: Identify the purpose of each field in the abstract state. Pay special attention to `kheap` (the kernel heap) and `cdt` (the capability derivation tree).

---

## 4. Tracing Through the Layers

### 4.1 From Abstract to Design

For the IPC example, the corresponding design specification is in `spec/design/Endpoint_H.thy` (or nearby). The design spec was generated from the Haskell source in `spec/haskell/src/SEL4/Object/Endpoint.lhs`.

**Task**: Find the design specification of `sendIPC` and compare it with the abstract specification. Note:

- The structure should be similar (same cases, same control flow).
- The design spec uses different data structures (e.g., `PPtr` for pointers instead of `obj_ref`).
- The design spec has more implementation detail (e.g., specific field access patterns).

### 4.2 From Design to C

The C implementation is in the seL4 repository under `src/object/endpoint.c`. The C parser output is in `spec/cspec/`.

**Task**: Find the C implementation of `sendIPC` (it may be named `sendIPC` or `send_ipc` in the C code) and compare with the design specification. Note the differences:

- C uses pointer arithmetic and struct field access.
- Error handling is done via explicit return codes.
- The C code has additional bookkeeping (updating scheduler state, etc.).

---

## 5. Reading a Refinement Proof

### 5.1 The Abstract-to-Design Refinement

Open `proof/refine/`. Look for a file related to IPC, such as `Ipc_R.thy` or `Endpoint_R.thy`.

A typical refinement lemma looks like:

```isabelle
lemma send_ipc_corres:
  "corres dc
     (einvs and tcb_at t and ep_at ep)
     (valid_pspace' and tcb_at' t and ep_at' ep)
     (Ipc_A.send_ipc blocking call badge can_grant t ep)
     (Endpoint_H.sendIPC blocking call badge can_grant t ep)"
```

This states that the abstract `send_ipc` is refined by the design `sendIPC`, under appropriate validity assumptions.

**Task**: Read the proof (or at least its structure). Identify:

- The `corres` predicate being proved.
- The state relation (implicit in `corres`).
- The proof strategy: is it by induction? By case analysis? By applying `corres` rules compositionally?

### 5.2 Understanding the Terminology in Refinement Lemmas

Before going further, let us decode the key terms that appear in `send_ipc_corres` and similar lemmas:

**`dc` ("don't care")**: This is the return value relation `\<lambda>_ _. True`. It says we do not care how the return values relate. Most kernel operations return `unit` (void), so there is nothing meaningful to relate. You will see `dc` as the first argument to `corres` and `ccorres` whenever the function returns `unit`:

```isabelle
(* dc means: we don't care about matching return values *)
abbreviation dc :: "'a \<Rightarrow> 'b \<Rightarrow> bool"
where "dc \<equiv> \<lambda>_ _. True"
```

**`p_monad` (the preemptible monad)**: The type `(unit, 'z::state_ext) p_monad` appears in the abstract specification for operations that may be interrupted by a preemption point. The preemptible monad extends the base state monad with the ability to raise a preemption exception:

```isabelle
type_synonym ('a, 'z) p_monad = "('a, 'z::state_ext) s_monad + preemption_exception"
```

In practice, `p_monad` means the function may call `preemption_point`, which checks whether the kernel has consumed too many work units and, if so, yields to the scheduler. Functions like `cap_revoke` (which may need to delete an unbounded number of capabilities) use `p_monad` because they contain preemption points. Simpler functions that cannot be preempted use `s_monad` (the plain state monad).

When you see `p_monad` in a type signature, the corresponding `corres` lemma will typically use the exception-aware variant of correspondence, often written `corres_underlying` with an exception relation.

**`xfdc` ("extraction function don't care")**: This appears only in `ccorres` lemmas. It is the extraction function `\<lambda>_. ()`, meaning we do not need to extract any return value from the C state. It is the `xf` counterpart to `dc`:

```isabelle
abbreviation xfdc :: "'s \<Rightarrow> unit"
where "xfdc \<equiv> \<lambda>_. ()"
```

The combination `dc xfdc` at the start of a `ccorres` lemma means: this is a void function --- ignore both the monadic return value and the C return value.

**`einvs`**: The extended invariants of the abstract specification (see Lecture 10a, Section 5.4). When `einvs` appears as a guard in a `corres` lemma, it means the proof assumes the abstract state is well-formed.

**`valid_pspace'`**: The design-level analogue of part of `einvs`. It says the design state's physical address space is well-formed (all objects are valid, properly typed, and non-overlapping).

**`tcb_at t` / `tcb_at' t`**: Asserts that address `t` points to a valid TCB (thread control block) in the abstract / design state, respectively. These "at" predicates are used to ensure that pointer arguments actually point to the expected object types.

**`ep_at ep` / `ep_at' ep`**: Similarly, asserts that `ep` points to a valid endpoint object.

Understanding these terms lets you read a `corres` lemma as a sentence: "`send_ipc_corres` says that abstract `send_ipc` and design `sendIPC` are related (with `dc` --- we don't care about return values) provided the abstract state satisfies `einvs` and has valid objects at the relevant addresses, and the design state satisfies `valid_pspace'` with the same object-existence requirements."

### 5.3 The C Refinement

Open `proof/crefine/`. This directory contains the most voluminous proofs. Look for `Ipc_C.thy` or similar.

C refinement lemmas use `ccorres` (concrete correspondence):

```isabelle
lemma sendIPC_ccorres:
  "ccorres dc xfdc
     (\<lambda>s. valid_pspace' s \<and> tcb_at' t s \<and> ep_at' ep s)
     (UNIV \<inter> {s. blocking_' s = from_bool blocking}
           \<inter> {s. badge_' s = badge}
           \<inter> ...)
     []
     (sendIPC blocking call badge can_grant t ep)
     (Call sendIPC_'proc)"
```

**Task**: Read the beginning of this proof. Note how much more complex it is than the abstract refinement. The complexity comes from bridging the Haskell data structures and the C memory layout.

---

## 6. How to Read a Refinement Proof

This section gives practical guidance for reading proofs in `proof/refine/` and `proof/crefine/`. These proofs are large and dense, but they follow predictable patterns.

### 6.1 The Typical Structure of a Refinement Proof File

A file like `proof/refine/Ipc_R.thy` typically contains:

1. **Theory header and imports**: the file imports the abstract and design specifications for the relevant subsystem, plus the state relation and proof infrastructure.
2. **Helper lemmas**: small lemmas about data structure properties, state relation fragments, and invariant consequences. These often take up more than half the file.
3. **The main `corres` lemmas**: one for each function pair (abstract function and its design counterpart). These are the central results.
4. **Invariant preservation lemmas**: proofs that the design functions preserve the design-level invariants (analogous to the abstract invariants in `proof/invariant-abstract/`).

A typical file might be 2,000--5,000 lines. The `crefine` counterparts are often 2--3 times larger.

### 6.2 Anatomy of a corres Proof

Here is an annotated skeleton of a typical `corres` proof:

```isabelle
lemma some_operation_corres:
  "corres dc                                     (* return value relation *)
     (einvs and tcb_at t and ep_at ep)            (* abstract guard *)
     (valid_pspace' and tcb_at' t and ep_at' ep)  (* design guard *)
     (SomeModule_A.some_operation t ep)           (* abstract computation *)
     (SomeModule_H.someOperation t ep)"           (* design computation *)
  (* Step 1: unfold both definitions *)
  unfolding some_operation_def someOperation_def

  (* Step 2: begin structural decomposition *)
  apply (rule corres_guard_imp)       (* weaken guards to match sub-goals *)

   (* Step 3: split at the first monadic bind *)
   apply (rule corres_bind)
    (* Sub-goal 1: correspondence for the first sub-computation *)
    apply (rule get_endpoint_corres)  (* use an existing corres lemma *)

   (* Sub-goal 2: correspondence for the continuation *)
   apply (case_tac rv)               (* case split on the result *)
    (* Case: IdleEP *)
    apply (rule corres_bind)
     apply (rule set_thread_state_corres)
    apply (rule set_endpoint_corres)
    (* ... *)

   (* Step 4: discharge guard obligations using wp *)
   apply (wp get_endpoint_wp | clarsimp)+

  (* Step 5: show that the outer guards imply the inner guards *)
  apply (clarsimp simp: einvs_def valid_pspace'_def)
  done
```

### 6.3 The Key Proof Steps Explained

**`apply (rule corres_bind)`** --- This is the most common proof step. It splits a goal of the form:

```
corres rv P Q (a >>= b) (c >>= d)
```

into two sub-goals:

1. `corres rv' P Q a c` --- the first computations correspond.
2. `\<And>x y. rv' x y \<Longrightarrow> corres rv (R x) (S y) (b x) (d y)` --- given that the first results are related, the continuations correspond.

After applying `corres_bind`, you typically apply an existing `corres` lemma for the first sub-computation, then continue decomposing the continuation.

**`apply (rule corres_guard_imp)`** --- Weakens (strengthens, from the user's perspective) the guards. This is used when you know more about the state than the `corres` lemma requires. The rule generates sub-goals asking you to prove that the stronger guards imply the weaker ones:

```
(* Original goal: corres rv P Q a c *)
(* After corres_guard_imp: *)
(*   1. corres rv P' Q' a c        -- with weaker guards P', Q' *)
(*   2. \<And>s. P s \<Longrightarrow> P' s            -- P implies P' *)
(*   3. \<And>t. Q t \<Longrightarrow> Q' t            -- Q implies Q' *)
```

**`apply (rule corres_split)`** --- A variant of `corres_bind` that also threads weakest-precondition obligations. In many proofs, `corres_split` is preferred over `corres_bind` because it automatically sets up the wp sub-goals:

```isabelle
lemma corres_split:
  "\<lbrakk> corres sr rv' P Q a c;
     \<And>x y. rv' x y \<Longrightarrow> corres sr rv (R x) (S y) (b x) (d y);
     \<lbrace>P\<rbrace> a \<lbrace>R\<rbrace>;          (* wp for abstract side *)
     \<lbrace>Q\<rbrace> c \<lbrace>S\<rbrace> \<rbrakk>          (* wp for concrete side *)
   \<Longrightarrow> corres sr rv P Q (a >>= b) (c >>= d)"
```

The extra wp premises (third and fourth) ensure that the guards `R x` and `S y` hold after the first computations complete. This is where the invariant-preservation lemmas (often generated by `crunch`) come into play.

**`apply (wp ...)`** --- Applies the weakest precondition calculus to discharge guard obligations. After all the `corres` steps are done, there are typically leftover goals of the form `\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>` (Hoare triples). The `wp` tactic solves these by composing known wp lemmas.

### 6.4 Search Strategies: Finding the Right Lemma

When working in a proof and you need to find the `corres` lemma for a called function, use these strategies:

**`find_theorems`**: The primary search tool in Isabelle. To find the `corres` lemma for `getEndpoint`:

```isabelle
find_theorems "corres _ _ _ (get_endpoint _) _"
```

This searches for any theorem whose conclusion matches the pattern.

**Naming conventions**: The seL4 proofs follow predictable naming:
- Abstract function `foo_bar` in `Module_A.thy` has its corres lemma named `foo_bar_corres` (or `fooBar_corres`) in `Module_R.thy`.
- The C refinement lemma is named `fooBar_ccorres` in `Module_C.thy`.
- Invariant preservation lemmas are named `foo_bar_inv` or generated by `crunch`.

**Grep the repository**: When `find_theorems` does not help (perhaps because the lemma has an unexpected name), search the repository:

```bash
grep -r "corres.*get_endpoint" proof/refine/
```

**Check the imports**: If `Module_R.thy` imports `SubModule_R.thy`, the corres lemma for a sub-module function is likely in the sub-module's `_R.thy` file.

### 6.5 Common Pitfalls When Reading Proofs

**The goal state is large.** After a few `corres_bind` steps, the goal state can have dozens of assumptions and several nested quantifiers. Focus on the *conclusion* (after the `\<Longrightarrow>`) and ignore most assumptions until you need them.

**Multiple proof branches.** Each `corres_bind` creates two sub-goals. After several binds, you may be looking at sub-goal 5 of 12. The structured proof keyword `prefer n` or the `subgoal` command can help you navigate, but in apply-style proofs (which most seL4 proofs use), the sub-goals are simply addressed in order.

**Implicit state relation.** In the seL4 development, the state relation is often a locale parameter rather than an explicit argument to `corres`. You may need to look at the locale definition to see what state relation is being used.

**Guard inflation.** As proofs proceed, the required guards (preconditions) tend to accumulate. A sub-goal may have a guard like `einvs and valid_sched and tcb_at t and ep_at ep and valid_reply_caps and ...`. Most of these follow from `einvs`; the `clarsimp simp: einvs_def` step at the end typically handles them.

### 6.6 A Reading Exercise

Open `proof/refine/` and find a short refinement proof (look for lemmas under 30 lines). Good candidates:

- `getCurThread_corres` in `StateRelation_R.thy` or a similar file.
- `getIdleThread_corres`.
- `rescheduleRequired_corres`.

For the proof you choose:

1. Write down the `corres` statement in English.
2. For each `apply` step, describe what it does to the goal.
3. Identify which existing `corres` lemmas are used (follow the `rule` applications).
4. Identify where `wp` is used and what validity lemmas it appeals to.

This exercise is the single most valuable thing you can do to build fluency with the l4v proof style.

---

## 7. Understanding the Build System

### 7.1 The Makefile

The l4v repository uses a Makefile-based build system. Key targets:

```bash
make ASpec          # Check the abstract specification
make ExecSpec       # Check the design (executable) specification
make CSpec          # Parse the C code and check the C specification
make AInvs          # Check abstract invariants
make Refine         # Check the abstract-to-design refinement
make CRefine        # Check the design-to-C refinement
make InfoFlow       # Check information flow proofs
make AutoCorresTest # Test AutoCorres
```

### 7.2 Build Times (Approximate)

| Target | Time (hours) |
|--------|-------------|
| ASpec | 0.5 |
| ExecSpec | 1 |
| CSpec | 2 |
| AInvs | 2 |
| Refine | 4 |
| CRefine | 8 |
| InfoFlow | 3 |
| **Total** | **~20** |

These times are on a modern multi-core workstation. The CRefine (C refinement) is by far the largest and slowest component.

### 7.3 CI/CD

The l4v repository uses GitHub Actions for continuous integration. Every pull request triggers a full proof check. This ensures that changes do not break existing proofs.

---

## 8. Discussion Questions

1. What is the most surprising aspect of the l4v repository structure? Is there something you expected to find that is missing, or something unexpected that is present?

2. How does the abstract specification compare to what you would write as informal documentation? Is it more or less precise? More or less readable?

3. The C refinement proofs are much larger than the abstract refinement proofs. What accounts for this difference? Is it inherent, or could better tools reduce the gap?

4. The proofs take ~20 hours to check from scratch. What are the implications for development workflow? How do the developers cope?

5. If you were starting a new formally verified kernel project today, would you use the same three-layer architecture? What might you change?

---

## 9. Homework Preparation

Review the three HW10 project options and begin planning:

- **Option A (Bump allocator)**: look at `lib/sep_algebra/` for separation logic infrastructure.
- **Option B (Ring buffer)**: look at `tools/autocorres/tests/examples/` for array verification patterns.
- **Option C (Binary search)**: look at `lib/Word_Lib/` for word arithmetic support.

For each option, identify:
- Which C functions you will write.
- What specifications (preconditions, postconditions) you will state.
- What loop invariants you will need.
- What AutoCorres options you will use.

---

## References

- The l4v repository: `https://github.com/seL4/l4v`
- The seL4 repository: `https://github.com/seL4/seL4`
- Klein, G., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.
- The seL4 documentation: `https://docs.sel4.systems/`

---

*Next: [HW10: Verification Project](hw10_verification_project.md)*
