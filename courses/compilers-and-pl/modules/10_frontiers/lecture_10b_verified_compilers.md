# Lecture 10b: Verified & Correct Compilers

## Prerequisites

- Formal semantics (operational, denotational), basic familiarity with proof assistants (Coq, Isabelle, or Lean), compiler pipeline.

---

## 1. What Does Compiler Correctness Mean?

### 1.1 The Correctness Statement

A compiler is **correct** if it preserves the observable behavior of programs. Let $S$ be a source program and $C$ be the compiled (target) program. Let $[\![ \cdot ]\!]_S$ and $[\![ \cdot ]\!]_T$ denote the source and target semantics respectively.

**Semantic preservation (strongest form):**

$$
\forall S.\; [\![ C(S) ]\!]_T = [\![ S ]\!]_S
$$

where equality means the same observable behaviors (termination, output, divergence).

### 1.2 Refinements of Correctness

In practice, we distinguish:

**Forward simulation (compiler correctness):**

$$
\forall S.\; \text{Behav}_T(C(S)) \subseteq \text{Behav}_S(S)
$$

Every behavior of the compiled program is a valid behavior of the source program. The compiler may reduce nondeterminism (choosing a specific evaluation order, for example).

**Backward simulation (completeness):**

$$
\forall S.\; \text{Behav}_S(S) \subseteq \text{Behav}_T(C(S))
$$

Every behavior of the source program is exhibited by the compiled program.

For deterministic languages, forward simulation implies backward simulation. For nondeterministic languages, both directions are needed.

### 1.3 Observable Behaviors

What counts as "observable" must be precisely defined:
- **Terminating programs**: The sequence of I/O events (reads, writes, system calls) and the final return value.
- **Diverging programs**: The (potentially infinite) sequence of I/O events.
- **Undefined behavior**: In C, the compiler need not preserve behavior of programs with undefined behavior. CompCert only guarantees preservation for well-defined programs.

### 1.4 Why Is This Hard?

A production compiler performs dozens of transformation passes, each of which must preserve semantics. The total correctness proof is the composition:

$$
[\![ P_n ]\!] = [\![ \text{pass}_n(\text{pass}_{n-1}(\ldots \text{pass}_1(P_0) \ldots)) ]\!] = [\![ P_0 ]\!]
$$

Each pass is independently proved correct, and correctness composes transitively.

---

## 2. CompCert: A Verified C Compiler

### 2.1 Overview (Leroy, 2006, 2009)

**CompCert** is a compiler for a large subset of C (ISO C99) that has been **mechanically verified** in the Coq proof assistant. It compiles C to PowerPC, ARM, x86, and RISC-V assembly.

### 2.2 Architecture

CompCert uses **14 intermediate languages** and **20+ compilation passes**:

```
C (Clight)
  |-- SimplExpr: pull side effects out of expressions
  v
Clight
  |-- SimplLocals: allocate local variables
  v
Csharpminor
  |-- Cminorgen: explicit stack allocation
  v
Cminor
  |-- Selection: instruction selection
  v
CminorSel
  |-- RTLgen: convert to CFG-based RTL
  v
RTL
  |-- Tailcall: tail call optimization
  |-- Inlining: function inlining
  |-- Renumber: renumber registers
  |-- CSE: common subexpression elimination
  |-- Deadcode: dead code elimination
  v
RTL (optimized)
  |-- Allocation: register allocation (validated)
  v
LTL
  |-- Tunneling: branch tunneling
  |-- Linearize: linearize CFG
  v
Linear
  |-- CleanupLabels: remove unused labels
  |-- Stacking: lay out stack frames
  v
Mach
  |-- Asmgen: code generation
  v
Assembly
```

### 2.3 The Main Theorem

**Theorem (CompCert correctness, Leroy 2009).** For every C program $S$ that has well-defined behavior (no undefined behavior according to the C standard):

$$
\forall t.\; \text{program\_behaves}(C(S), t) \implies \text{program\_behaves}(S, t)
$$

where $t$ is a trace of observable events (I/O operations, volatile accesses, return values).

This is stated and proved in Coq. The proof is approximately 100,000 lines of Coq.

### 2.4 What Is Not Verified

- The C parser (OCaml code, not verified).
- The assembler and linker.
- The formal semantics of the source and target languages (trusted by axiom).
- The Coq proof checker itself (part of the trusted computing base).

---

## 3. Simulation Relations and Semantic Preservation

### 3.1 Simulation Relations

The key proof technique in CompCert is the **simulation relation**. Given source semantics $\xrightarrow{S}$ and target semantics $\xrightarrow{T}$:

**Forward simulation.** A relation $R$ between source states $s$ and target states $t$ is a forward simulation if:

$$
\frac{s_1 \xrightarrow{S} s_2 \quad R(s_1, t_1)}{\exists t_2.\; t_1 \xrightarrow{T}^+ t_2 \wedge R(s_2, t_2)}
$$

That is: if the source takes a step and the source and target states are related, then the target can take one or more steps to reach a related state.

```
    s1 ----S----> s2
    |             |
    R             R
    |             |
    v             v
    t1 ---T-+---> t2
```

### 3.2 Backward Simulation

$$
\frac{t_1 \xrightarrow{T} t_2 \quad R(s_1, t_1)}{\exists s_2.\; s_1 \xrightarrow{S}^+ s_2 \wedge R(s_2, t_2)}
$$

Backward simulation is harder to prove but necessary for nondeterministic source languages.

### 3.3 Lock-Step vs. Star Simulation

When a single source step corresponds to multiple target steps (or vice versa), we use **star simulation** ($\xrightarrow{T}^+$ or $\xrightarrow{T}^*$). To ensure the proof is well-founded (no infinite stuttering), we require a **measure** function $\mu$ that decreases when the target stutters:

$$
\frac{s_1 \xrightarrow{S} s_2 \quad R(s_1, t_1)}{\exists t_2.\; (t_1 \xrightarrow{T}^+ t_2 \wedge R(s_2, t_2)) \;\vee\; (t_1 = t_2 \wedge R(s_2, t_2) \wedge \mu(s_2, t_2) < \mu(s_1, t_1))}
$$

### 3.4 Composing Simulations

**Theorem.** If pass $A \to B$ is correct (via simulation $R_1$) and pass $B \to C$ is correct (via simulation $R_2$), then the composition $A \to C$ is correct via the composed simulation $R_1 \circ R_2$:

$$
R_{1 \circ 2}(s, t) \iff \exists u.\; R_1(s, u) \wedge R_2(u, t)
$$

*Proof.* Given $s_1 \xrightarrow{A} s_2$ and $R_{1\circ 2}(s_1, t_1)$, there exists $u_1$ with $R_1(s_1, u_1)$ and $R_2(u_1, t_1)$. By the first simulation, $u_1 \xrightarrow{B}^+ u_2$ with $R_1(s_2, u_2)$. By iterating the second simulation along the $B$ steps, $t_1 \xrightarrow{C}^+ t_2$ with $R_2(u_2, t_2)$. Hence $R_{1\circ 2}(s_2, t_2)$. $\square$

This compositionality is what makes CompCert's modular pass-by-pass verification feasible.

### 3.5 Proving a Specific Pass: Constant Propagation Example

Consider a pass that replaces $x$ with a constant $c$ when $x = c$ at that program point.

**Simulation relation:** $R(s_S, s_T)$ if:
1. The program counters are the same.
2. For every register $r$: $s_T(r) = s_S(r)$.
3. The analysis result $\hat{\sigma}$ at this point satisfies: for all $r$ where $\hat{\sigma}(r) = \text{Const}(c)$, we have $s_S(r) = c$.

**Simulation proof for a step $x := y + z$ transformed to $x := c_1 + c_2$** (where $\hat{\sigma}(y) = c_1$ and $\hat{\sigma}(z) = c_2$):
- By condition 3, $s_S(y) = c_1$ and $s_S(z) = c_2$.
- Source step: $s_S' = s_S[x \mapsto c_1 + c_2]$.
- Target step: $s_T' = s_T[x \mapsto c_1 + c_2]$.
- By condition 2, $s_S'(r) = s_T'(r)$ for all $r$.
- Condition 3 is maintained by the analysis transfer function. $\square$

---

## 4. Translation Validation

### 4.1 Concept

Instead of verifying the compiler itself, **translation validation** (Pnueli, Siegel, Singerman, 1998) checks each individual compilation: given source $S$ and compiled code $T$, verify that $T$ correctly implements $S$.

$$
\text{Compiler}(S) = T \quad \xrightarrow{\text{validator}} \quad T \models S \;\text{?}
$$

**Advantages:**
- The compiler is untrusted; only the validator must be correct.
- Can validate optimizations in existing production compilers (GCC, LLVM).
- Easier to implement than full compiler verification.

**Disadvantages:**
- The validator itself must be verified (or very carefully tested).
- Validation may be incomplete (reject valid compilations).
- Must be run after every compilation.

### 4.2 Validator Design

A typical translation validator:
1. Constructs a **product program** or **cross-program simulation relation** between $S$ and $T$.
2. Uses an **SMT solver** to verify that corresponding states satisfy the simulation conditions.
3. Handles loop correspondence via **synchronization points** (typically at function entries and loop headers).

### 4.3 CompCert's Use of Validation

CompCert uses translation validation for its register allocation pass (Rideau & Leroy, 2010):
- The register allocator (based on graph coloring + iterated register coalescing) is implemented in OCaml (unverified).
- A Coq-verified **validator** checks that the allocator's output is a correct allocation.
- If validation fails, compilation aborts (no incorrect code is emitted).

This approach avoids the difficulty of verifying the complex register allocation algorithm while still guaranteeing correctness.

---

## 5. Alive/Alive2: Verifying Peephole Optimizations

### 5.1 The Problem

LLVM contains hundreds of **peephole optimizations** (local pattern rewrites in the InstCombine pass). These are manually written and historically a significant source of **miscompilation bugs**.

### 5.2 Alive (Lopes et al., 2015)

**Alive** is a DSL and verifier for specifying and verifying LLVM peephole optimizations:

```
Name: AddSub
Pre: true
%r = add %x, %y
%s = sub %r, %y
=>
%s = %x
```

The tool:
1. Parses the optimization specification.
2. Translates both sides (source pattern and target pattern) to SMT formulas.
3. Uses Z3 to verify: for all inputs satisfying the precondition, the target computes the same result as the source, including **undefined behavior** and **poison values**.

### 5.3 Alive2 (Lopes et al., 2021)

**Alive2** extends Alive to verify actual LLVM IR transformations (not just specifications):

$$
\text{LLVM pass}(IR_{\text{before}}) = IR_{\text{after}} \quad \xrightarrow{\text{Alive2}} \quad IR_{\text{after}} \text{ refines } IR_{\text{before}} \;\text{?}
$$

**Refinement relation.** $T$ refines $S$ ($S \sqsupseteq T$) if:
1. If $S$ has defined behavior on input $\sigma$, then $T$ has defined behavior on $\sigma$ and produces the same result.
2. If $S$ has undefined behavior on $\sigma$, then $T$ may do anything on $\sigma$.
3. $T$ may have **fewer** poison/undef values than $S$ (refinement of poison).

Formally:

$$
S \sqsupseteq T \iff \forall \sigma.\; \text{defined}(S, \sigma) \implies [\![ T ]\!](\sigma) = [\![ S ]\!](\sigma)
$$

### 5.4 Impact

Alive2 has found **over 60 bugs** in LLVM's optimization passes. It is now used as part of LLVM's CI pipeline for the InstCombine pass.

**Example bug found by Alive2:**

```
; Source
%cmp = icmp slt i32 %x, 0
%neg = sub nsw i32 0, %x
%abs = select i1 %cmp, i32 %neg, i32 %x

; LLVM's incorrect transformation:
%abs = call i32 @llvm.abs.i32(i32 %x, i1 true)

; Bug: when %x = INT_MIN, sub nsw is UB in source (so any result is fine),
; but llvm.abs with is_int_min_poison=true returns poison, not UB.
; Poison is "less defined" than UB, violating refinement.
```

---

## 6. Verified Compilation Passes

### 6.1 Verified Register Allocation

Register allocation is typically implemented as graph coloring (NP-hard in general). Verifying the algorithm is complex, so CompCert uses the **validation approach** (Section 4.3).

Alternative: **verified linear scan** register allocation has been formalized in Isabelle/HOL (Lerner et al.).

### 6.2 Verified Instruction Selection

CompCert's instruction selection is verified by proving that each selected instruction sequence has the same semantics as the source operation:

$$
\forall \text{op}, \overline{v}.\; [\![ \text{select}(\text{op}) ]\!](\overline{v}) = [\![ \text{op} ]\!](\overline{v})
$$

### 6.3 Verified Optimizations

CompCert verifies the following optimizations:
- **Constant propagation**: Via abstract interpretation with a verified abstract domain.
- **CSE**: Via a verified value numbering algorithm.
- **Dead code elimination**: Via a verified liveness analysis.
- **Tail call optimization**: Via a verified transformation on the RTL IR.
- **Function inlining**: With a verified bound on code size growth.

Each optimization proof follows the simulation framework (Section 3).

---

## 7. CakeML: A Verified ML Compiler

### 7.1 Overview (Kumar et al., 2014)

**CakeML** is a verified compiler for a significant subset of Standard ML, mechanically verified in HOL4. Unlike CompCert, CakeML verifies the **entire pipeline** including the parser.

### 7.2 Key Differences from CompCert

| Aspect | CompCert | CakeML |
|--------|----------|--------|
| Source language | C (Clight subset) | Standard ML subset |
| Proof assistant | Coq | HOL4 |
| Parser verified | No | Yes (via PEG parser) |
| Bootstrapping | No | Yes (compiler compiles itself) |
| Garbage collector | Not modeled | Verified GC |
| Target | PowerPC, ARM, x86, RISC-V | x86-64, ARM, MIPS, RISC-V |

### 7.3 The CakeML Correctness Theorem

$$
\forall S.\; \text{parse}(S) = \text{Some}(ast) \;\wedge\; \text{typecheck}(ast) = \text{OK} \implies
$$

$$
\text{machine\_semantics}(\text{compile}(ast)) \subseteq \text{source\_semantics}(ast)
$$

This covers the entire chain from source text to machine code.

### 7.4 Bootstrapping

CakeML is **bootstrapped**: the verified compiler is written in CakeML and compiled by itself. The correctness theorem guarantees that the compiler binary (produced by itself) correctly compiles any input program.

### 7.5 Verified Garbage Collection

CakeML includes a verified copying garbage collector. The correctness statement:

$$
\text{After GC}: \quad \forall \text{reachable pointer } p.\; \text{read}(\text{new\_heap}, \text{forward}(p)) = \text{read}(\text{old\_heap}, p)
$$

All reachable objects are preserved with the same values; the heap is compacted.

---

## 8. Proof-Carrying Code

### 8.1 Concept (Necula, 1997)

**Proof-carrying code (PCC)** attaches a machine-checkable proof of safety to compiled code. The code consumer verifies the proof before execution.

$$
\text{Producer} \xrightarrow{\text{code} + \text{proof}} \text{Consumer} \xrightarrow{\text{check proof}} \text{Execute (if valid)}
$$

### 8.2 Safety Policy

The proof certifies that the code satisfies a **safety policy**, such as:
- Memory safety: No out-of-bounds accesses.
- Type safety: Operations respect declared types.
- Control flow integrity: Jumps go only to valid targets.

### 8.3 Verification Condition Generation

The proof is structured as:
1. The code is annotated with **loop invariants** and **preconditions/postconditions**.
2. A **verification condition generator (VCGen)** produces logical formulas from the annotated code.
3. The producer proves these formulas (using an automated theorem prover or manually).
4. The consumer re-runs the VCGen and checks the proofs.

**Theorem (Necula, 1997).** If the verification conditions are valid, then the code satisfies the safety policy. The proof checking is linear in the size of the proof and code.

### 8.4 Foundational PCC

**Foundational PCC** (Appel, 2001) reduces the trusted base to just the machine semantics and a proof checker for a small logic (e.g., higher-order logic). The safety policy, typing rules, and VCGen are all proved as lemmas within the logic, rather than being trusted.

### 8.5 Typed Assembly Language (TAL)

**Typed Assembly Language** (Morrisett et al., 1999) is a related approach: the type system of the source language is extended to the assembly level. Type checking the assembly code guarantees safety.

$$
\frac{\Gamma \vdash r_1 : \text{int} \quad \Gamma \vdash r_2 : \text{int}}{\Gamma \vdash \text{add } r_d, r_1, r_2 : [\Gamma[r_d \mapsto \text{int}]]}
$$

---

## 9. Summary

| Approach | What is verified | Trust base | Effort |
|----------|-----------------|-----------|--------|
| Verified compiler (CompCert) | The compiler itself | Proof assistant, semantics definitions | Very high (person-decades) |
| Translation validation | Each compilation instance | The validator | Moderate |
| Alive2 | Individual peephole optimizations | SMT solver, formalization of LLVM semantics | Moderate |
| CakeML | Full pipeline including parser | HOL4, machine semantics | Very high |
| Proof-carrying code | Safety of emitted code | Proof checker, safety policy | Moderate (per program) |

---

## References

1. Leroy, X. (2009). "A formally verified compiler back-end." *Journal of Automated Reasoning*, 43(4), 363--446.
2. Lopes, N. P., Lee, J., Hur, C.-K., Liu, Z., & Regehr, J. (2021). "Alive2: Bounded translation validation for LLVM." *PLDI '21*.
3. Kumar, R., Myreen, M. O., Norrish, M., & Owens, S. (2014). "CakeML: A verified implementation of ML." *POPL '14*.
4. Pnueli, A., Siegel, M., & Singerman, E. (1998). "Translation validation." *TACAS '98*.
5. Necula, G. C. (1997). "Proof-carrying code." *POPL '97*.
6. Morrisett, G., Walker, D., Crary, K., & Glew, N. (1999). "From System F to typed assembly language." *ACM TOPLAS*, 21(3), 527--568.
7. Appel, A. W. (2001). "Foundational proof-carrying code." *LICS '01*.
8. Lopes, N. P., Menendez, D., Naber, S., & Regehr, J. (2015). "Provably correct peephole optimizations with Alive." *PLDI '15*.
9. Leroy, X. (2006). "Formal certification of a compiler back-end, or: programming a compiler with a proof assistant." *POPL '06*.
10. Rideau, S. & Leroy, X. (2010). "Validating register allocation and spilling." *CC '10*.
