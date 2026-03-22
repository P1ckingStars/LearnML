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

## 5. Comparison with Other Verified Systems

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

## 6. Exercises

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
