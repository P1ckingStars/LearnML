# Lecture 10d: Frontier --- Open Problems in Formal Verification

> **Module 10 --- seL4, Refinement & Frontier**
> Estimated study time: 5--7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Identify the key scaling challenges in formal verification and quantify the current proof-to-code ratio.
2. Describe current research on AI-assisted proof, improved Sledgehammer, and automatic proof repair.
3. Compare verification approaches for concurrent programs: Owicki-Gries, rely-guarantee, and concurrent separation logic.
4. Evaluate alternative verification approaches: verified compilers (CompCert, CakeML), refinement types (Liquid Haskell, F*), and dependent types (Agda, Lean).
5. Articulate the "verification gap" and the economic/social barriers to broader adoption.
6. Describe emerging directions in Isabelle's development and the broader formal methods ecosystem.

---

## 1. Scaling Verification

### 1.1 The Scale Problem

The seL4 microkernel has ~8,700 lines of C code and ~480,000 lines of proof, giving a proof-to-code ratio of approximately 55:1 for functional correctness alone. Including all properties (integrity, confidentiality, binary verification), the ratio exceeds 100:1.

For comparison:

| System | Lines of code |
|--------|--------------|
| seL4 microkernel | 8,700 |
| Linux kernel | 35,000,000+ |
| Windows kernel | 50,000,000+ (estimated) |
| Chromium browser | 35,000,000+ |
| Boeing 787 avionics | 6,500,000 |

At seL4's proof-to-code ratio, verifying the Linux kernel would require approximately **2 billion** lines of proof, a clearly infeasible amount. Even with significant automation improvements, full formal verification of large systems remains out of reach with current technology.

### 1.2 Reducing the Proof-to-Code Ratio

Several approaches aim to reduce the proof burden:

**Better automation.** Improved tactics, SMT integration, and domain-specific proof strategies can reduce the number of manual proof steps. The seL4 project's own tools (crunch, Eisbach methods) have significantly reduced the per-function proof cost.

**Design for verification.** Writing code that is easier to verify can dramatically reduce proof effort. Principles include:

- Minimizing mutable state.
- Using well-understood data structures with existing verified libraries.
- Avoiding complex pointer manipulation.
- Keeping functions small and well-specified.

**Proof reuse.** Libraries of verified components (like the Isabelle Archive of Formal Proofs) allow developers to build on pre-verified foundations rather than proving everything from scratch.

**Specification-level verification.** Rather than verifying the entire implementation, verify only critical properties (memory safety, information flow) and leave functional correctness to testing.

### 1.3 Proof Engineering at Scale

The seL4 experience revealed several proof engineering challenges that worsen with scale:

**Proof brittleness.** Proofs that depend on the exact syntactic structure of definitions break when those definitions change, even if the change is semantically trivial. Techniques for writing robust proofs (using named assumptions, avoiding positional tactics) help but do not eliminate the problem.

**Build times.** The full seL4 proof takes approximately 16--20 hours to check on a modern multi-core workstation. For interactive development, incremental checking (re-checking only changed theories) is essential.

**Team coordination.** Multiple people working on different parts of the proof must coordinate interface changes. The Isabelle theory structure (imports, locales) provides some modularity, but cross-cutting changes still require coordination.

---

## 2. Automation Frontiers

### 2.1 AI-Assisted Proof

Large language models (LLMs) have shown promising results in generating proof steps for interactive theorem provers. Active research areas include:

**Proof generation.** Given a lemma statement, generate a complete proof script. Current LLMs can handle simple lemmas but struggle with proofs requiring deep domain knowledge or novel proof strategies.

**Tactic suggestion.** Given a proof state (goal, hypotheses, available lemmas), suggest the next tactic to apply. This is more tractable than full proof generation and can be integrated into the IDE.

**Lemma discovery.** Identify auxiliary lemmas that would be useful for a proof. This is related to the "relevance filtering" problem in Sledgehammer.

**Current limitations:**

- LLMs generate plausible-looking but incorrect proofs frequently (hallucination).
- The proofs must be machine-checked, so incorrect suggestions are caught, but the false-positive rate limits usefulness.
- Training data is limited: the total corpus of Isabelle proofs is much smaller than the corpus of, say, Python code.
- Proofs require long chains of logically valid reasoning, which autoregressive models struggle with.

**Notable projects:**

- **PISA** (Jiang et al.): proof step prediction for Isabelle.
- **LeanDojo** (Yang et al.): a framework for training LLMs on Lean proofs.
- **AlphaProof** (DeepMind): neural theorem proving for competition mathematics.
- **Baldur** (First et al.): whole-proof generation for Isabelle.

### 2.2 Improved Sledgehammer

Sledgehammer is Isabelle/HOL's bridge to external automated theorem provers. It works by:

1. **Relevance filtering**: selecting from the thousands of available lemmas the few dozen most likely to be useful.
2. **Translation**: converting the Isabelle goal and selected lemmas into the input format of external provers (TPTP for first-order provers, SMT-LIB for SMT solvers).
3. **Proving**: running multiple external provers in parallel (E, Vampire, Z3, CVC5, ...).
4. **Proof reconstruction**: translating the external prover's proof back into Isabelle proof steps that can be checked by the kernel.

Current research directions:

- **Better relevance filtering**: using machine learning (MaSh --- Machine Learning for Sledgehammer) to predict which lemmas are relevant.
- **Proof reconstruction improvements**: the external prover finds a proof, but reconstructing it in Isabelle sometimes fails. Better reconstruction algorithms increase the success rate.
- **Higher-order reasoning**: most external provers are first-order. Zipperposition and other higher-order provers are being integrated.
- **SMT integration**: deeper integration with SMT solvers for theories like bitvectors, arrays, and linear arithmetic.

### 2.3 Automatic Proof Repair

When a specification or implementation changes, existing proofs may break. Manually fixing broken proofs is one of the biggest costs of verified software maintenance.

**Proof repair** aims to automatically update broken proofs:

- **MiMo** (Ringer et al.): repairs proofs in Coq after changes to definitions or lemma statements.
- **Sledgehammer-based repair**: when a proof breaks, re-run Sledgehammer on the new subgoals to find alternative proofs.
- **Diff-based repair**: analyze the difference between the old and new versions to predict what proof changes are needed.

This is an active research area. Current tools handle simple changes (renaming, reordering) but struggle with substantive changes.

---

## 3. New Verification Targets

### 3.1 Concurrent Programs

The seL4 verification initially assumed single-core execution. Verifying concurrent programs introduces fundamental new challenges:

**The problem.** Concurrent executions interleave operations from multiple threads, creating an exponential number of possible schedules. Reasoning about all interleavings is infeasible without compositional techniques.

**Owicki-Gries method (1976).** Annotate each thread's code with preconditions and postconditions. Prove each thread correct in isolation. Then prove *non-interference*: each thread's annotations are preserved by every other thread's statements.

```isabelle
(* Thread 1: *)  (* Thread 2: *)
{x = 0}          {x = 0}
x := x + 1       x := x + 2
{x \<ge> 1}          {x \<ge> 2}
```

Non-interference check: does Thread 2's `x := x + 2` preserve Thread 1's annotation `{x \<ge> 1}`? Yes, if `x \<ge> 1` before, then `x + 2 \<ge> 3 \<ge> 1` after.

**Rely-guarantee (Jones, 1983).** Each thread specifies:

- A *guarantee*: what the thread may do to shared state.
- A *rely*: what the environment (other threads) may do to shared state.

The proof obligation is: (1) the thread's code satisfies its guarantee, and (2) under the rely assumption, the thread is correct.

**Concurrent separation logic (O'Hearn, 2007).** Extends separation logic with a rule for parallel composition:

$$\frac{\{P_1\}\ c_1\ \{Q_1\} \quad \{P_2\}\ c_2\ \{Q_2\}}{\{P_1 \ast P_2\}\ c_1 \| c_2\ \{Q_1 \ast Q_2\}}$$

The separating conjunction ensures $c_1$ and $c_2$ operate on disjoint memory, guaranteeing race-freedom.

**Iris (Jung et al., 2015--present).** A state-of-the-art concurrent separation logic framework in Coq. Iris supports:

- Fine-grained concurrency (lock-free data structures).
- Higher-order reasoning (storing assertions in shared state).
- Ghost state and invariants.

Iris has been used to verify concurrent data structures, the Rust type system's safety guarantees (RustBelt), and concurrent OS kernel components.

### 3.2 Floating-Point Arithmetic

The seL4 C parser does not support floating-point types. Formally reasoning about IEEE 754 floating-point is challenging because:

- Rounding modes: results depend on the current rounding mode.
- Special values: NaN, infinities, signed zeros have complex semantics.
- Non-associativity: $(a + b) + c \neq a + (b + c)$ in floating-point.

Existing work:

- **Flocq** (Boldo and Melquiond): a Coq library for floating-point reasoning.
- **HOL-Light's floating-point theory** (Harrison): verification of floating-point algorithms.
- **VCFloat** (Appel and Kellison): verified C floating-point in VST.

### 3.3 Cryptographic Implementations

Verifying cryptographic code has additional requirements:

- **Functional correctness**: the code computes the right mathematical function (e.g., AES, SHA-256).
- **Constant-time execution**: no data-dependent branches or memory accesses (to prevent timing side channels).
- **Memory safety**: no buffer overflows (which could leak key material).

Notable verified cryptographic implementations:

- **HACL\*** (INRIA/Microsoft): verified C and assembly implementations of TLS 1.3 cryptographic primitives, verified in F*.
- **Vale** (Microsoft): a domain-specific language for verified assembly, used for AES-NI and SHA-NI implementations.
- **Jasmin** (Almeida et al.): a framework for high-assurance cryptographic implementations.
- **Fiat-Crypto** (MIT): automatically synthesized and verified elliptic curve arithmetic.

### 3.4 Rust Verification

Rust's ownership type system provides memory safety guarantees at the language level, making it an attractive target for formal verification:

**RustBelt** (Jung et al., 2017): proves that Rust's type system (including `unsafe` code abstractions) is sound, using the Iris framework in Coq.

**Creusot** (Denis et al.): a deductive verification tool for Rust, translating Rust code into WhyML for verification with Why3.

**Kani** (AWS): a model checker for Rust that uses bounded verification to find bugs.

**Prusti** (ETH Zurich): an automated verifier for Rust based on the Viper intermediate verification language.

**Verus** (Microsoft/CMU): a verification tool for Rust that uses SMT-based verification with linear types.

---

## 4. Alternative Approaches

### 4.1 Verified Compilers

**CompCert** (Leroy et al., Coq):

- A formally verified optimizing C compiler.
- Proved correct in Coq: compilation preserves the observable behavior of any well-defined C program.
- Targets: x86, ARM, PowerPC, RISC-V.
- Limitations: does not support all C11 features; some optimizations are weaker than GCC/Clang; the unverified front-end (preprocessing, parsing) is in the trusted base.

**CakeML** (HOL4):

- A formally verified compiler for a subset of Standard ML.
- The entire pipeline is verified: parsing, type checking, compilation, and even the garbage collector.
- Bootstrapped: CakeML is compiled by itself, and the compiler binary is verified correct.
- The trusted base is reduced to the HOL4 kernel and the hardware.

**Correctness by construction vs. post-hoc verification:**

| Aspect | Verified compiler | Post-hoc (seL4-style) |
|--------|-------------------|----------------------|
| When is verification done | Once (for the compiler) | Per program |
| What is verified | All compilations | One specific program |
| Proof effort | Very large (once) | Proportional to program size |
| Trust | Source semantics | Abstract specification |
| Language restrictions | Modest | Strict (StrictC subset) |

### 4.2 Refinement Types

**Liquid Haskell** (Vazou et al.):

- Extends Haskell's type system with refinement types: types annotated with logical predicates.
- Example: `{v : Int | v > 0}` is the type of positive integers.
- Type checking automatically proves that programs satisfy their refinement type specifications, using SMT solvers.
- Can express and verify complex properties (sortedness, balanced trees, termination).

**F\*** (Microsoft Research):

- A dependently typed functional programming language with effects.
- Combines dependent types, refinement types, and monadic effects.
- Used for verified cryptographic implementations (HACL*, EverCrypt).
- Can extract verified C code (via KaRaMeL).

### 4.3 Dependent Types

**Agda**: a dependently typed programming language and proof assistant. Programs and proofs are the same thing (via the Curry-Howard correspondence). Well-suited for verified programming but less mature for large-scale systems verification.

**Idris 2**: a dependently typed language designed for practical programming, with first-class support for quantitative types (tracking how many times a value is used).

**Lean 4**: originally a proof assistant, now also a practical programming language. Growing rapidly in both the mathematical formalization community (Mathlib) and the verified programming community.

### 4.4 Model Checking vs. Theorem Proving

Model checking and theorem proving are complementary verification approaches:

| | Model Checking | Theorem Proving |
|---|----------------|-----------------|
| Automation | Fully automatic | Semi-automatic |
| State space | Finite (or bounded) | Infinite |
| Properties | Temporal logic (LTL, CTL) | Arbitrary logic |
| Counterexamples | Yes (automatic) | No (manual debugging) |
| Scalability | Limited by state explosion | Limited by proof effort |
| Tools | SPIN, NuSMV, CBMC, TLA+ | Isabelle, Coq, Lean |

In practice, the best approach often combines both: use model checking to find bugs quickly, then use theorem proving to establish properties that require reasoning about unbounded state spaces.

**CBMC** (Bounded Model Checking for C): automatically checks C programs for assertion violations, buffer overflows, and other errors up to a bounded number of loop iterations. Does not provide full verification but is highly effective at finding bugs.

**TLA+** (Lamport): a specification language for concurrent systems, supported by the TLC model checker. Widely used at Amazon (AWS) for verifying distributed system designs.

---

## 5. The Verification Gap

### 5.1 Economic Incentives

Despite the strong guarantees formal verification provides, adoption remains limited. The primary barrier is economic:

- Formal verification is expensive: the seL4 effort required ~11 person-years for ~8,700 lines of code.
- The benefit (absence of bugs) is hard to quantify in advance.
- For most software, the cost of bugs is absorbed through patching, and customers accept occasional failures.

Formal verification is economically justified only when the cost of failure is extremely high:

- **Avionics**: a software bug could crash an aircraft.
- **Medical devices**: a bug could harm patients.
- **Military systems**: a vulnerability could be exploited by adversaries.
- **Cryptography**: a subtle bug could expose all encrypted communications.
- **Financial systems**: high-frequency trading systems where bugs cause immediate financial loss.

### 5.2 Developer Training

Formal verification requires expertise that most software developers do not have:

- Fluency in a proof assistant (Isabelle, Coq, Lean).
- Understanding of formal logic and proof techniques.
- Experience with specification writing.
- Patience for proof debugging.

Training programs and educational materials (including this course) aim to address this gap, but the learning curve remains steep.

### 5.3 Tool Maturity

Current tools, while powerful, have usability issues:

- Error messages are often cryptic.
- Proof state can be hard to understand.
- IDE support varies (Isabelle/jEdit is functional but not on par with mainstream IDEs).
- Integration with existing development workflows (CI/CD, version control) requires effort.

---

## 6. Isabelle's Future

### 6.1 Isabelle/Naproche

Isabelle/Naproche (Natural Proof Checking) is a project to allow proofs to be written in controlled natural language. Instead of tactic scripts:

```isabelle
lemma "P \<longrightarrow> P"
  by (rule impI)
```

One writes:

```
Theorem. If P, then P.
Proof. Assume P. Then P. QED.
```

The system parses the natural language, extracts the logical content, and verifies it with Isabelle. This could dramatically lower the barrier to entry for formal verification.

### 6.2 IDE and Tooling

Ongoing efforts to improve Isabelle's development experience:

- **VS Code integration**: via the Isabelle Language Server Protocol (LSP) implementation.
- **Better error messages**: more informative feedback when proofs fail.
- **Proof refactoring tools**: automatically restructuring proofs when definitions change.

### 6.3 The Archive of Formal Proofs (AFP)

The AFP is a curated collection of Isabelle formalization. It contains over 800 entries covering:

- Mathematics: algebra, analysis, topology, number theory, graph theory.
- Computer science: algorithms, data structures, programming language theory, security.
- Logic: completeness theorems, model theory, set theory.

The AFP serves as both a library of reusable formalizations and a test suite for Isabelle itself. Every entry is re-checked with each new Isabelle release.

### 6.4 Community Growth

The Isabelle community has grown significantly in recent years, driven by:

- The seL4 project's visibility and impact.
- Growing industrial interest in formal verification.
- Academic courses teaching Isabelle (including this one).
- The ``Concrete Semantics'' textbook (Nipkow and Klein) using Isabelle/HOL.

---

## 7. Exercises

### Theory

**Exercise 10d.1.** Estimate the verification cost for a safety-critical system in your domain of interest. Consider: How many lines of code? What is the acceptable proof-to-code ratio? How many person-years would be needed? Is it economically justified?

**Exercise 10d.2.** Compare Owicki-Gries, rely-guarantee, and concurrent separation logic. For each approach, give an example of a concurrent program that is easy to verify with that approach but difficult with the others.

**Exercise 10d.3.** The seL4 proof-to-code ratio is ~55:1. Identify three specific advances (in tools, techniques, or methodology) that could reduce this ratio, and estimate the reduction each might provide.

**Exercise 10d.4.** Argue for or against the following claim: "AI-assisted proof will make formal verification practical for mainstream software within 10 years." Consider the current state of LLM-based proof generation and the fundamental challenges.

**Exercise 10d.5.** Compare Isabelle/HOL with Lean 4 as verification platforms. Consider: type theory vs. HOL, tactic languages, library support, community size, and IDE quality.

### Discussion

**Exercise 10d.6.** The "verification gap" describes the fact that most software remains unverified. Is this a problem? If so, whose responsibility is it to close the gap: tool developers, software developers, regulators, or users?

**Exercise 10d.7.** If you could verify one piece of widely-used software (not a kernel), what would you choose and why? What properties would you verify? Estimate the difficulty.

### Project Preview

**Exercise 10d.8.** Review the three project options for HW10. For each option, identify: (a) the key specification challenge, (b) the key proof challenge, and (c) which AutoCorres features you would need. Choose the option you plan to pursue and write a one-paragraph proposal.

---

## References

- Klein, G., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.
- Jung, R., et al. "Iris: Monoids and Invariants as an Orthogonal Basis for Concurrent Reasoning." *POPL*, 2015.
- Jung, R., et al. "RustBelt: Securing the Foundations of the Rust Programming Language." *POPL*, 2017.
- Leroy, X. "Formal Verification of a Realistic Compiler." *CACM*, 52(7), 2009.
- Kumar, R., Myreen, M., Norrish, M., Owens, S. "CakeML: A Verified Implementation of ML." *POPL*, 2014.
- Vazou, N., Seidel, E., Jhala, R., Vytiniotis, D., Peyton Jones, S. "Refinement Types for Haskell." *ICFP*, 2014.
- Protzenko, J., et al. "Verified Low-Level Programming Embedded in F*." *ICFP*, 2017.
- First, E., Rabe, M., Ringer, T., Brun, Y. "Baldur: Whole-Proof Generation and Repair with Large Language Models." *FSE*, 2023.
- Blanchette, J., Kaliszyk, C., Paulson, L., Urban, J. "Hammering towards QED." *Journal of Formalized Reasoning*, 9(1), 2016.

---

*Next: [Recitation 10: l4v Repository Walkthrough](recitation_10_l4v_walkthrough.md)*
