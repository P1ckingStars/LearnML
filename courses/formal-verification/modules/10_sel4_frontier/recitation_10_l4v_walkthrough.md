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

### 5.2 The C Refinement

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

## 6. Understanding the Build System

### 6.1 The Makefile

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

### 6.2 Build Times (Approximate)

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

### 6.3 CI/CD

The l4v repository uses GitHub Actions for continuous integration. Every pull request triggers a full proof check. This ensures that changes do not break existing proofs.

---

## 7. Discussion Questions

1. What is the most surprising aspect of the l4v repository structure? Is there something you expected to find that is missing, or something unexpected that is present?

2. How does the abstract specification compare to what you would write as informal documentation? Is it more or less precise? More or less readable?

3. The C refinement proofs are much larger than the abstract refinement proofs. What accounts for this difference? Is it inherent, or could better tools reduce the gap?

4. The proofs take ~20 hours to check from scratch. What are the implications for development workflow? How do the developers cope?

5. If you were starting a new formally verified kernel project today, would you use the same three-layer architecture? What might you change?

---

## 8. Homework Preparation

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
