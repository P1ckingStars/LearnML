# Lecture 10a: The seL4 Verification Story

> **Module 10 --- seL4, Refinement & Frontier**
> Estimated study time: 5--7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe what seL4 is and explain its significance as the world's first formally verified OS kernel.
2. State precisely what was proved about seL4 and identify the assumptions under which the proof holds.
3. Explain the historical context of the L4 microkernel family and the NICTA/Data61 project.
4. Quantify the verification effort in terms of person-years, lines of proof, and proof-to-code ratio.
5. Identify the real-world deployments and impact of seL4.
6. Compare seL4's verification approach with other verified systems.

---

## 1. What Is seL4?

### 1.1 A Microkernel

seL4 is a *microkernel*: a minimal operating system kernel that provides only the most fundamental services:

- **Address spaces**: virtual memory management via page tables.
- **Threads**: execution contexts with scheduling.
- **Inter-process communication (IPC)**: message passing between threads.
- **Capabilities**: fine-grained access control to kernel objects.

Everything else --- file systems, device drivers, network stacks, application services --- runs in user space. The microkernel mediates access to hardware and enforces isolation between components.

### 1.2 The L4 Microkernel Family

seL4 descends from the L4 microkernel family, initiated by Jochen Liedtke in the 1990s. The L4 family is characterized by:

- **Minimal kernel interface**: only ~30 system calls.
- **High-performance IPC**: L4 pioneered fast synchronous IPC (as low as 100 cycles on modern hardware).
- **Component-based systems**: the microkernel provides isolation; all policy is in user space.

Major L4 variants include L4/Fiasco (TU Dresden), OKL4 (Open Kernel Labs), and seL4 (NICTA/Data61). seL4 distinguishes itself by being formally verified.

### 1.3 Key Numbers

| Metric | Value |
|--------|-------|
| C code | ~8,700 lines |
| Assembly (ARM) | ~600 lines |
| Isabelle proof | ~480,000 lines (functional correctness) |
| Total proof (all properties) | ~1,000,000+ lines |
| System calls | ~30 |
| Kernel objects | ~10 types (endpoints, CNodes, page tables, ...) |

---

## 2. The Verification

### 2.1 The SOSP 2009 Paper

The landmark paper announcing seL4's verification:

- **Klein, G., Elphinstone, K., Heiser, G., Andronick, J., Cock, D., Derrin, P., Elkaduwe, D., Engelhardt, K., Kolanski, R., Norrish, M., Sewell, T., Tuch, H., Winwood, S.** "seL4: Formal Verification of an OS Kernel." *SOSP*, 2009.

This paper received the **Best Paper Award** at SOSP 2009 and was later inducted into the **SOSP Hall of Fame** (2019) in recognition of its lasting impact on the field.

### 2.2 What Was Proved

The central theorem is **functional correctness of the C implementation**:

**Theorem (Functional Correctness).** *For every possible execution of the seL4 C code on a correctly functioning hardware platform, the behavior conforms to the abstract specification.*

More precisely, using the refinement framework developed for seL4:

```isabelle
theorem seL4_functional_correctness:
  "c_refines abstract_spec c_implementation"
```

This means: every observable behavior of the C implementation (every sequence of system call results, every state transition) is permitted by the abstract specification. There is no C execution that violates the specification.

This is an *extremely* strong guarantee. It covers:

- All possible inputs (system calls, interrupts, hardware events).
- All possible execution schedules.
- All memory states (including adversarial user-space behavior).
- All error paths and edge cases.

It rules out:

- Buffer overflows.
- Null pointer dereferences.
- Use-after-free.
- Integer overflow bugs.
- Deadlocks (at the kernel level).
- Any deviation from the specified behavior.

### 2.3 What Was NOT Proved

Every formal verification rests on assumptions. The seL4 verification assumes:

**Assembly code (~600 lines).** The kernel entry/exit code, context switch, and hardware register access are written in assembly and not verified. These are axiomatized: the proof assumes that the assembly code correctly saves/restores registers, enters/exits kernel mode, and performs TLB flushes.

**Boot code (~1,200 lines).** The initialization code that sets up the kernel's initial state is not verified. The proof begins from a correctly initialized kernel state.

**Hardware correctness.** The proof assumes the hardware behaves according to its specification. If the processor has a bug (like the Pentium FDIV bug), the verification does not protect against it.

**Cache and TLB behavior.** The proof assumes a sequentially consistent memory model. Cache coherence and TLB management are not modeled; the proof assumes that the assembly-level cache/TLB operations produce a sequentially consistent view.

**Timing and side channels.** The proof says nothing about execution time. Information leakage through timing side channels (like Spectre/Meltdown) is not addressed by functional correctness.

**DMA devices.** Direct Memory Access by devices can bypass the CPU's MMU and modify memory without the kernel's knowledge. The proof assumes DMA devices are correctly configured to not interfere with kernel memory.

**The C compiler.** The original 2009 proof trusted the C compiler (GCC). Translation validation (covered in Lecture 10c) later removed this assumption for the ARM platform.

### 2.4 The Assumptions in Isabelle

The assumptions are formally stated as Isabelle axioms or locale assumptions, making them explicit and auditable. For example:

```isabelle
(* Axiom: the assembly entry code correctly saves user context *)
axiomatization where
  asm_entry_correct:
    "asm_entry_impl s = abstract_entry_spec s"

(* Axiom: hardware interrupt handling is correct *)
axiomatization where
  interrupt_handling:
    "hw_interrupt_impl s = abstract_interrupt_spec s"
```

By inspecting these axioms, anyone can evaluate whether the trust assumptions are reasonable for their deployment context.

---

## 3. The Scale of the Effort

### 3.1 Timeline

| Year | Milestone |
|------|-----------|
| 2004 | Project begins at NICTA (National ICT Australia) |
| 2006 | Abstract specification and design specification complete |
| 2007 | C parser and memory model paper (POPL) |
| 2008 | Monadic framework paper (TPHOLs) |
| 2009 | Functional correctness proof complete; SOSP paper |
| 2011 | Integrity (access control) proof (ITP) |
| 2013 | Confidentiality (information flow) proof (IEEE S&P) |
| 2013 | Binary verification / translation validation (PLDI) |
| 2014 | Comprehensive verification paper (ACM TOCS) |
| 2014--present | Ongoing: multi-core, RISC-V, MCS extensions |

### 3.2 Person-Years

The functional correctness proof required approximately **11 person-years** of effort by a team of researchers and PhD students. The breakdown:

| Activity | Person-years (approx.) |
|----------|----------------------|
| Abstract specification | 2 |
| Design specification (Haskell + translation) | 2 |
| C implementation in the verified subset | 1.5 |
| Proof infrastructure (tools, tactics) | 2 |
| The actual proofs (abstract-to-design, design-to-C) | 3.5 |

### 3.3 Proof-to-Code Ratio

The proof-to-code ratio is a useful (if crude) measure of verification cost:

$$\frac{\text{Lines of proof}}{\text{Lines of C code}} \approx \frac{480{,}000}{8{,}700} \approx 55:1$$

This means approximately 55 lines of proof for every line of C code. Including all verified properties (integrity, confidentiality), the ratio exceeds 100:1.

This ratio is often cited as evidence that full formal verification is extremely expensive. However, it should be contextualized:

- Much of the proof is *reusable infrastructure* (tactics, lemma libraries, frameworks) that would not need to be rebuilt for a similar project.
- The ratio for individual functions varies enormously: simple getter/setter functions may need only 2--3x proof, while complex functions (like the capability derivation tree operations) may need 200x.
- The proofs are machine-checked, providing an absolute guarantee. The alternative (testing) provides no such guarantee regardless of effort.

---

## 4. Impact and Deployment

### 4.1 DARPA HACMS

The DARPA High-Assurance Cyber Military Systems (HACMS) program (2012--2017) used seL4 to build a verified software stack for an autonomous helicopter. The demonstration showed that a cyber-physical system built on seL4 was impervious to attacks that compromised similar systems built on conventional software.

The helicopter's flight-critical software ran on seL4, isolated from the mission-planning software. Even when the mission planner was deliberately compromised, the attacker could not affect the flight controls.

### 4.2 Defense and Aerospace

seL4 has been deployed in:

- **Military communications systems**: cross-domain solutions that handle data at multiple security classification levels.
- **Avionics**: systems where software failure could endanger lives.
- **Satellite systems**: where software updates after deployment are impractical.

### 4.3 Automotive

The HENSOLDT Cyber GmbH (a German defense electronics company) has adopted seL4 for automotive systems, where the trend toward autonomous driving demands extremely high software reliability.

### 4.4 The seL4 Foundation

In 2020, the seL4 Foundation was established under the Linux Foundation to support the open-source development and adoption of seL4. The kernel is available under open-source licenses (GPLv2 for the kernel, BSD for the proofs).

---

## 5. A Taste of the Abstract Specification

This section previews what the abstract specification actually looks like in Isabelle, giving you concrete code to anchor the high-level descriptions above.

### 5.1 The Kernel State Record

The abstract kernel state is defined in `Structures_A.thy`. A simplified view of the record (omitting some fields for clarity):

```isabelle
record abstract_state =
  kheap            :: "obj_ref \<Rightarrow> kernel_object option"
                        (* the kernel heap: a partial map from addresses to objects *)
  cdt              :: "cslot_ptr \<Rightarrow> cslot_ptr option"
                        (* capability derivation tree: parent pointers *)
  is_original_cap  :: "cslot_ptr \<Rightarrow> bool"
                        (* tracks which caps are originals vs. derived copies *)
  cur_thread       :: obj_ref
                        (* the currently running thread *)
  idle_thread      :: obj_ref
                        (* the designated idle thread *)
  scheduler_action :: scheduler_action
                        (* what the scheduler should do next:
                           ResumeCurrentThread | ChooseNewThread | SwitchToThread t *)
  ready_queues     :: "domain \<Rightarrow> priority \<Rightarrow> obj_ref list"
                        (* per-domain, per-priority run queues *)
  machine_state    :: machine_state
                        (* abstraction of the hardware state *)
  interrupt_irq_node :: "irq \<Rightarrow> obj_ref"
                        (* maps IRQ numbers to handler capability slots *)
```

Key observations:

- **`kheap`** is a *partial function*: `obj_ref \<Rightarrow> kernel_object option`. Every kernel object (TCBs, endpoints, CNodes, page tables, etc.) lives in this single map, keyed by its address. This is the most abstract possible representation --- no memory layout, no alignment, no pointer arithmetic.
- **`scheduler_action`** is a small datatype with three constructors. This tells the scheduler what to do at the next scheduling point: resume the current thread, pick a new one from the ready queues, or switch to a specific thread.
- **`ready_queues`** is indexed by both *domain* (for domain scheduling / temporal isolation) and *priority*. Each queue is a simple list of thread references.
- **`cdt`** represents the capability derivation tree as a parent-pointer structure. Each capability slot optionally points to its parent. This is used during `revoke` to find and delete all children of a capability.

### 5.2 The `handle_event` Function

The top-level entry point for kernel execution is `handle_event` in `Syscall_A.thy`. This is the function that the refinement proof ultimately targets: everything the kernel does is a response to an event.

```isabelle
definition handle_event :: "event \<Rightarrow> (unit, 'z::state_ext) p_monad"
where
  "handle_event ev \<equiv> case ev of
     SyscallEvent call \<Rightarrow> handle_syscall call
   | UnknownSyscall n \<Rightarrow> do
       thread \<leftarrow> gets cur_thread;
       handle_fault thread (UnknownSyscallException n);
       return ()
     od
   | UserLevelFault w1 w2 \<Rightarrow> do
       thread \<leftarrow> gets cur_thread;
       handle_fault thread (UserException w1 (w2 && mask 29));
       return ()
     od
   | Interrupt \<Rightarrow> do
       active \<leftarrow> do_machine_op getActiveIRQ;
       case active of
         Some irq \<Rightarrow> handle_interrupt irq
       | None \<Rightarrow> return ()
     od
   | VMFaultEvent data \<Rightarrow> do
       thread \<leftarrow> gets cur_thread;
       handle_vm_fault thread data;
       return ()
     od"
```

Walk through the dispatch:

1. **`SyscallEvent call`**: A user thread invoked a system call. The `call` is a constructor of the `syscall` datatype (`SysSend`, `SysRecv`, `SysCall`, `SysReply`, `SysReplyRecv`, `SysYield`, `SysNBSend`, `SysNBRecv`). This delegates to `handle_syscall`.
2. **`UnknownSyscall n`**: The user invoked a system call number the kernel does not recognize. This is treated as a fault on the current thread.
3. **`UserLevelFault`**: A user-level exception (e.g., illegal instruction). Again treated as a fault.
4. **`Interrupt`**: A hardware interrupt occurred. The kernel queries the hardware for the active IRQ and dispatches to `handle_interrupt`.
5. **`VMFaultEvent`**: A virtual memory fault (page fault). Dispatched to the VM fault handler.

### 5.3 System Call Dispatch

`handle_syscall` further dispatches based on the system call type:

```isabelle
definition handle_syscall :: "syscall \<Rightarrow> (unit, 'z::state_ext) p_monad"
where
  "handle_syscall call \<equiv> case call of
     SysSend \<Rightarrow> handle_send True
   | SysNBSend \<Rightarrow> handle_send False
   | SysCall \<Rightarrow> handle_call
   | SysRecv \<Rightarrow> handle_recv True
   | SysReply \<Rightarrow> handle_reply
   | SysReplyRecv \<Rightarrow> do handle_reply; handle_recv True od
   | SysYield \<Rightarrow> handle_yield
   | SysNBRecv \<Rightarrow> handle_recv False"
```

For example, `handle_send blocking` proceeds as follows:

1. Look up the current thread's message info register to determine the operation.
2. Decode the system call: look up the capability being invoked, check permissions, parse arguments.
3. Perform the operation: this eventually calls `send_ipc` (for endpoint operations), `send_signal` (for notifications), or other object-specific operations.

The `handle_send` function illustrates the error-handling pattern used throughout the abstract specification:

```isabelle
definition handle_send :: "bool \<Rightarrow> (unit, 'z::state_ext) p_monad"
where
  "handle_send blocking \<equiv> do
     thread \<leftarrow> gets cur_thread;
     reply_cap_slot \<leftarrow> get_cap (thread, tcb_cnode_index 2);
     ep_cap \<leftarrow> liftE $ lookup_cap thread;
     case ep_cap of
       EndpointCap ref badge rights \<Rightarrow>
         if AllowSend \<in> rights
         then liftE $ send_ipc blocking False badge True thread ref
         else throwError (FailedLookup ...)
     | _ \<Rightarrow> throwError (InvalidCapability 0)
   od <catch> (\<lambda>fault. handle_fault thread fault)"
```

The `<catch>` combinator at the end catches any exception that occurs during capability lookup or invocation and redirects it to the fault handler.

### 5.4 Invariants at the Abstract Layer

The abstract refinement proof requires that certain *invariants* hold on the abstract state. These are collected under the name `einvs` ("extended invariants"):

```isabelle
definition einvs :: "abstract_state \<Rightarrow> bool"
where
  "einvs s \<equiv>
     valid_objs s \<and>            (* all objects in the heap are well-formed *)
     pspace_aligned s \<and>        (* object addresses are properly aligned *)
     valid_mdb s \<and>             (* the capability derivation tree is well-formed *)
     valid_ioc s \<and>             (* is_original_cap is consistent with the mdb *)
     valid_idle s \<and>            (* the idle thread is in the correct state *)
     only_idle s \<and>             (* only the idle thread is in the Idle thread state *)
     if_unsafe_then_cap s \<and>    (* every non-idle thread has a fault handler cap *)
     valid_reply_caps s \<and>      (* reply caps are consistent *)
     valid_global_refs s \<and>     (* global objects are not deleted *)
     valid_arch_state s \<and>      (* arch-specific state is well-formed *)
     valid_irq_node s \<and>        (* IRQ node entries are valid *)
     valid_irq_handlers s \<and>   (* IRQ handler caps are consistent *)
     valid_irq_states s \<and>     (* IRQ states are consistent with masks *)
     cur_tcb s \<and>              (* cur_thread points to a valid TCB *)
     valid_list s              (* ready queue lists are well-formed *)"
```

These invariants appear as preconditions in almost every refinement lemma. For example, when proving that `send_ipc` at the abstract level is refined by `sendIPC` at the design level, the proof assumes `einvs` holds and must show that `einvs` is preserved. The invariant preservation proofs live in `proof/invariant-abstract/`.

Understanding `einvs` is crucial for reading the proofs: when you see a goal like `einvs s` in a proof obligation, it means the proof system needs to know that the kernel state is well-formed at that point.

---

## 6. Comparison with Other Verified Systems

### 5.1 CompCert (Verified C Compiler)

CompCert (Leroy, 2006--present) is a formally verified optimizing C compiler, proved correct in Coq. It takes a different approach from seL4:

- **Correctness by construction**: CompCert's correctness is a property of the *compiler*, not the compiled programs. Any program compiled by CompCert behaves according to the C semantics.
- **seL4's approach**: post-hoc verification of a specific program (the kernel).

| | seL4 | CompCert |
|---|------|----------|
| What is verified | One specific program | A general-purpose tool |
| Proof assistant | Isabelle/HOL | Coq |
| Trusted base | C parser, ~600 lines ASM | Unverified front-end, linker |
| Impact | Eliminates kernel bugs | Eliminates compiler bugs |

### 5.2 CertiKOS (Verified Concurrent Kernel)

CertiKOS (Gu et al., OSDI 2016) is a verified concurrent OS kernel, proved correct in Coq. Unlike seL4's initial verification (which assumed single-core execution), CertiKOS addresses concurrency:

- Uses *certified concurrent abstraction layers*.
- Proves both functional correctness and absence of data races.
- Smaller than seL4 but addresses a harder problem (concurrency).

### 5.3 Verve and Ironclad

Microsoft Research's Verve (Yang and Hawblitzel, 2010) and Ironclad (Hawblitzel et al., 2014) verified systems software written in managed languages:

- **Verve**: a type-safe OS kernel written in a verified subset of C# + assembly.
- **Ironclad Apps**: verified applications providing strong end-to-end security guarantees.

These projects use Dafny and Boogie for verification, leveraging SMT solvers for automation.

---

## 7. Exercises

### Theory

**Exercise 10a.1.** The seL4 proof assumes the hardware is correct. Give two specific examples of real-world hardware bugs that would invalidate the seL4 guarantee. How serious would each be?

**Exercise 10a.2.** The proof-to-code ratio for seL4 is approximately 55:1. Argue for or against the claim that this makes formal verification impractical for most software. Consider the cost of bugs in safety-critical systems.

**Exercise 10a.3.** Compare the trust assumptions of seL4 with those of a conventionally tested OS kernel. Which system requires you to trust more components? Which provides stronger guarantees?

**Exercise 10a.4.** The seL4 abstract specification is written by hand. What are the risks of this approach? How could you gain confidence that the abstract specification correctly captures the intended behavior?

**Exercise 10a.5.** Explain why proving functional correctness of a single-core kernel does not immediately extend to a multi-core kernel. What additional properties must be established?

### Reading

**Exercise 10a.6.** Read Sections 1--4 of the SOSP 2009 paper (Klein et al.). Identify the three specification layers and explain how they relate to each other.

**Exercise 10a.7.** Read Section 7 (Lessons Learnt) of the SOSP 2009 paper. Which lesson do you find most surprising? Why?

---

## References

- Klein, G., et al. "seL4: Formal Verification of an OS Kernel." *SOSP*, 2009.
- Klein, G., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.
- Heiser, G., Klein, G. "Formal Verification of a High-Performance Microkernel." In *Dependable and Historic Computing*, LNCS 6875, 2011.
- Gu, R., et al. "CertiKOS: An Extensible Architecture for Building Certified Concurrent OS Kernels." *OSDI*, 2016.
- Leroy, X. "Formal Verification of a Realistic Compiler." *CACM*, 52(7), 2009.

---

*Next: [Lecture 10b: Refinement Proofs --- Abstract to C](lecture_10b_refinement_proofs.md)*
