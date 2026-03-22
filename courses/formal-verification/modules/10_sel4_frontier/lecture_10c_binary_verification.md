# Lecture 10c: Binary Verification & Translation Validation

> **Module 10 --- seL4, Refinement & Frontier**
> Estimated study time: 5--7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain the compiler trust problem and why it matters for end-to-end verification.
2. Describe the translation validation approach: verify after compilation rather than verifying the compiler.
3. Outline the technical approach: decompilation, graph refinement, and SMT-assisted proof.
4. Distinguish translation validation from verified compilation (CompCert/CakeML).
5. Describe the additional security properties proved for seL4 beyond functional correctness: integrity and confidentiality.
6. Explain the CAmkES component framework and its role in building verified systems on seL4.

---

## 1. The Compiler Trust Problem

### 1.1 The Gap

The seL4 functional correctness proof (Lecture 10a) establishes:

$$\text{C source} \xrightarrow{\text{refines}} \text{Abstract specification}$$

But the deployed system runs *compiled machine code*, not C source. Between the proved-correct C and the executing binary stands the C compiler (GCC or Clang), which performs:

- Instruction selection: mapping C operations to machine instructions.
- Register allocation: assigning variables to registers.
- Optimization: constant folding, dead code elimination, loop transformations, inlining.
- Code generation: emitting the final binary.

Any of these steps could introduce a bug. Compiler bugs are not hypothetical: GCC and Clang have had numerous correctness bugs over the years. The seminal study by Yang et al. ("Finding and Understanding Bugs in C Compilers," PLDI 2011) found hundreds of bugs in production compilers using random testing (Csmith).

If the compiler introduces a bug, the gap between the verified C and the executing binary means the verification guarantee does not hold for the running system.

### 1.2 Two Approaches

There are two approaches to closing this gap:

**Approach 1: Verified compiler.** Prove the compiler correct once, then trust all its outputs. CompCert (Leroy, Coq) and CakeML (HOL4) take this approach.

- *Advantage*: the proof is done once for the compiler, not per-program.
- *Disadvantage*: verified compilers support fewer optimizations, target fewer architectures, and may produce slower code.

**Approach 2: Translation validation.** Compile with any compiler, then verify that the specific binary produced is correct for the specific C source.

- *Advantage*: use any compiler with any optimizations; only the specific output must be validated.
- *Disadvantage*: the validation must be done for each compilation.

The seL4 project chose translation validation, described in the following paper:

- **Sewell, T., Myreen, M., Klein, G.** "Translation Validation for a Verified OS Kernel." *PLDI*, 2013.

---

## 2. The Translation Validation Approach

### 2.1 Overview

The translation validation pipeline:

```
C source (verified correct)
      |
      v  [GCC -O1]
ARM binary
      |
      v  [Decompilation in HOL4]
Binary graph (in HOL4)
      |
      v  [Export to Isabelle]
Binary specification (in Isabelle/HOL)

C source
      |
      v  [C parser]
C graph (in Isabelle/HOL)

Binary specification <--[Graph refinement]--> C graph
```

The key steps:

1. Compile the C source with GCC to produce an ARM binary.
2. Decompile the binary into a graph representation in HOL4 (using the Cambridge ARM model).
3. Build a graph representation of the C source in Isabelle/HOL (from the C parser output).
4. Prove that the binary graph refines the C graph, node by node and edge by edge.

### 2.2 Graph Representation

Both the C source and the binary are represented as control-flow graphs where:

- **Nodes** represent basic blocks: straight-line sequences of operations.
- **Edges** represent control flow: branches, function calls, returns.
- **Node actions** describe the computation performed by each basic block.

For the C graph, node actions are derived from the SIMPL representation:

```isabelle
datatype c_action =
    CAssign "lval" "expr"
  | CCall "fname" "expr list"
  | CReturn "expr"
  | CCondBranch "expr" "node_id" "node_id"
  | CSkip
```

For the binary graph, node actions are derived from the decompiled ARM instructions:

```isabelle
datatype bin_action =
    BinOp "register" "bin_expr"
  | BinLoad "register" "addr_expr"
  | BinStore "addr_expr" "register"
  | BinBranch "condition" "addr" "addr"
  | BinCall "addr"
  | BinReturn
```

### 2.3 Graph Refinement

The refinement proof establishes a correspondence between the C graph and the binary graph. Formally, this is a simulation: every path through the binary graph corresponds to a path through the C graph that performs the same computation (modulo the compilation).

The correspondence is established by:

1. **Node matching**: each binary node is matched to a C node (or a sequence of C nodes, since one C statement may compile to multiple instructions).
2. **State correspondence**: the relationship between C variables and registers/memory at each matched node pair.
3. **Computation equivalence**: the binary computation at each node produces the same result as the C computation, given the state correspondence.

### 2.4 SMT-Assisted Proofs

The node-level equivalence checks are discharged using SMT solvers (primarily Z3). Each check is of the form:

$$\forall \text{inputs.}\ \text{binary\_computation}(\text{inputs}) = \text{C\_computation}(\text{register\_mapping}(\text{inputs}))$$

These are typically decidable problems in the theory of bitvectors and arrays, which modern SMT solvers handle efficiently.

The overall graph refinement is proved in Isabelle, with the SMT solver providing lemmas for individual node equivalences. The SMT solver's output is reconstructed as Isabelle proofs (using the `smt` tactic), so the SMT solver is not trusted.

### 2.5 Challenges

**Instruction selection.** The compiler may use different instruction sequences than the naive translation. For example, multiplying by a constant may be compiled to a shift-add sequence. The SMT solver handles this by reasoning about bitvector arithmetic.

**Register allocation.** The compiler assigns C local variables to registers, with spilling to the stack when registers are exhausted. The state correspondence must track which register or stack slot holds each C variable.

**Optimizations.** GCC with `-O1` performs moderate optimizations:

- Constant folding and propagation.
- Dead code elimination.
- Basic loop optimizations.
- Instruction scheduling.

Higher optimization levels (`-O2`, `-O3`) introduce more aggressive transformations (loop unrolling, vectorization, interprocedural optimization) that are harder to validate. The seL4 translation validation targets `-O1`.

**Function inlining.** When the compiler inlines a function, the binary graph has no call edge where the C graph does. The validation must detect and account for inlining.

---

## 3. Current Status

### 3.1 ARM Validation

Translation validation for seL4 on ARM (32-bit) was completed and published in PLDI 2013. The complete chain is:

$$\text{Abstract spec} \xleftarrow{\text{refines}} \text{Design spec} \xleftarrow{\text{refines}} \text{C code} \xleftarrow{\text{TV}} \text{ARM binary}$$

This removes the C compiler from the trusted computing base for the ARM platform.

### 3.2 Other Architectures

Translation validation for x86-64 and RISC-V is ongoing research. The challenges include:

- The x86-64 instruction set is much larger and more complex than ARM.
- The formal machine model (used for decompilation) must be validated against real hardware.
- 64-bit pointer arithmetic introduces additional complexity.

### 3.3 Remaining Trust

After translation validation, the trusted computing base for seL4 consists of:

- The Isabelle kernel (~10,000 lines of Standard ML).
- The C parser (part of the l4v tools).
- The ARM machine model (used for decompilation).
- The assembly code (~600 lines).
- The hardware.

---

## 4. Beyond Functional Correctness

### 4.1 Integrity

**Theorem (Integrity).** *The seL4 kernel enforces access control: no operation can modify data that the invoking thread does not have write access to.*

This was proved by Sewell, Winwood, Gammie, Murray, Andronick, and Klein (ITP 2011). The proof establishes that seL4's capability system correctly enforces a take-grant access control model:

```isabelle
theorem integrity:
  "\<lbrakk> einvs s; pas_refined pas s; pas_cap_cur_auth pas s;
     (s, s') \<in> data_type.Step \<rbrakk>
   \<Longrightarrow> integrity pas s s'"
```

This says: if the system is in a valid state (`einvs s`) with well-formed access control policy (`pas_refined pas s`), then every step preserves integrity --- no unauthorized modifications occur.

### 4.2 Confidentiality (Information Flow)

**Theorem (Confidentiality).** *The seL4 kernel enforces information flow control: no information leaks from high-security domains to low-security domains through kernel operations.*

This was proved by Murray, Matichuk, Brassil, Gammie, Bourke, Seefried, Lewis, Gao, and Klein (IEEE S&P 2013). The property is *intransitive noninterference*:

```isabelle
theorem confidentiality:
  "noninterference_policy pol \<Longrightarrow>
   noninterference (data_type.Step) pol"
```

Intransitive noninterference allows information to flow through designated "downgraders" (declassifiers) but not directly between non-communicating domains. This models real security architectures where some controlled information sharing is necessary.

This is one of the strongest confidentiality properties ever proved for a deployed system.

### 4.3 The Complete seL4 Proof Stack

The comprehensive verification paper (Klein et al., ACM TOCS 2014) assembles the complete stack:

```
Binary code
    |  (Translation validation)
    v
C code
    |  (Refinement: C -> Design)
    v
Design specification (Haskell)
    |  (Refinement: Design -> Abstract)
    v
Abstract specification
    |  (Security proofs)
    v
Integrity + Confidentiality
```

This is the most complete formal verification of any deployed system, covering:

- Functional correctness (the kernel does what it should).
- Integrity (the kernel enforces access control).
- Confidentiality (the kernel prevents information leakage).
- Binary correctness (the compiled code matches the verified C).

---

## 5. CAmkES: Building Verified Systems

### 5.1 What Is CAmkES?

CAmkES (Component Architecture for Micro-Kernel-based Embedded Systems) is a component framework for building systems on seL4. It provides:

- A design-time specification language for defining components and their interconnections.
- Code generation: producing the glue code that connects components through seL4 IPC.
- Proof generation: producing Isabelle proof scripts that verify the system configuration.

### 5.2 Component Specification

A CAmkES system is described by an Architecture Description Language (ADL):

```camkes
assembly {
    composition {
        component Client client;
        component Server server;
        connection seL4RPC conn(from client.request, to server.handle);
    }
    configuration {
        client.priority = 100;
        server.priority = 200;
    }
}
```

This specifies two components (`Client` and `Server`) connected by an RPC mechanism (`seL4RPC`).

### 5.3 capDL and Verification

CAmkES generates a *capDL* (Capability Distribution Language) specification describing the initial capability distribution:

- Which capabilities each component holds.
- What access each capability grants.
- The initial memory layout.

The capDL specification is then verified against the security policy:

```isabelle
theorem camkes_system_secure:
  "system_satisfies_policy capDL_spec security_policy"
```

This verifies that the initial configuration, combined with seL4's proved integrity and confidentiality properties, ensures that the system-level security policy holds throughout execution.

---

## 6. Exercises

### Theory

**Exercise 10c.1.** Compare translation validation with verified compilation (CompCert). For each approach, identify: (a) what is in the trusted computing base, (b) when the verification effort occurs (compile time vs. one-time), and (c) what optimizations are supported.

**Exercise 10c.2.** The translation validation uses SMT solvers to discharge node-level equivalence checks. Explain why the SMT solver does not need to be trusted, even though it is used in the proof.

**Exercise 10c.3.** Why is translation validation at `-O1` but not `-O2` or `-O3`? What specific optimizations at higher levels would be difficult to validate? Consider loop unrolling, auto-vectorization, and link-time optimization.

**Exercise 10c.4.** The integrity property states that no unauthorized modification occurs. Give an example of a system call where the kernel *does* modify data --- how is this reconciled with the integrity theorem?

**Exercise 10c.5.** Intransitive noninterference allows information flow through "downgraders." Give a real-world example of a system architecture that requires downgraders. Why is transitive noninterference too restrictive for practical systems?

### Reading

**Exercise 10c.6.** Read the abstract and introduction of Sewell, Myreen, Klein (PLDI 2013). Identify the three main contributions of the paper.

**Exercise 10c.7.** Read Section 3 (Information Flow) of Murray et al. (IEEE S&P 2013). What is the formal definition of noninterference they use? How does it handle timing channels?

---

## References

- Sewell, T., Myreen, M., Klein, G. "Translation Validation for a Verified OS Kernel." *PLDI*, 2013.
- Myreen, M., Gordon, M. "Verified LISP Implementations on ARM, x86 and PowerPC." *TPHOLs*, 2009.
- Sewell, T., Winwood, S., Gammie, P., Murray, T., Andronick, J., Klein, G. "seL4 Enforces Integrity." *ITP*, 2011.
- Murray, T., Matichuk, D., Brassil, M., Gammie, P., Bourke, T., Seefried, S., Lewis, C., Gao, X., Klein, G. "seL4: From General Purpose to a Proof of Information Flow Enforcement." *IEEE S&P*, 2013.
- Klein, G., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.
- Kuz, I., Liu, Y., Gorton, I., Heiser, G. "CAmkES: A Component Model for Secure Microkernel-based Embedded Systems." *Journal of Systems and Software*, 80(5), 2007.
- Yang, X., Chen, Y., Eide, E., Regehr, J. "Finding and Understanding Bugs in C Compilers." *PLDI*, 2011.

---

*Next: [Lecture 10d: Frontier --- Open Problems in Formal Verification](lecture_10d_frontier_open_problems.md)*
