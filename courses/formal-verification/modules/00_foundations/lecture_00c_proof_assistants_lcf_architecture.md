# Lecture 00c: Proof Assistants & the LCF Architecture

> **Module 00 — Foundations: Logic & Proof (Pre-Work)**
> Estimated study time: 5-7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain what a proof assistant is and articulate why machine-checked proofs are valuable.
2. Name the major proof assistant families and their distinguishing characteristics.
3. State the de Bruijn criterion and explain why a small trusted kernel is essential.
4. Describe the LCF architecture: the abstract type `thm`, inference rules as ML functions, and derived rules (tactics).
5. Explain Isabelle's distinctive position as a generic logical framework.
6. Distinguish between an object logic and a metalogic and explain why this separation matters.
7. Trace the historical development from Robin Milner's LCF through to modern Isabelle.

---

## 1. What Is a Proof Assistant?

### 1.1 The Problem

Mathematical proofs, as published in journals, are informal arguments intended to convince human readers. They rely on shared mathematical culture, implicit reasoning steps, and the reader's ability to fill in gaps. This works remarkably well, but it has limits:

- **Errors.** Published proofs sometimes contain mistakes that go undetected for years. Voevodsky, after discovering an error in one of his own published proofs, became a major advocate for computer-verified mathematics.
- **Complexity.** Some proofs are so long and intricate that no human can feasibly verify them. The classification of finite simple groups spans thousands of pages across hundreds of papers.
- **Software correctness.** When we claim that a compiler, operating system kernel, or cryptographic protocol is correct, an informal argument is insufficient. The stakes — security, safety, financial integrity — demand certainty.

### 1.2 The Solution

A *proof assistant* (also called an *interactive theorem prover*, ITP) is a software system that:

1. Provides a formal language for stating mathematical definitions and theorems.
2. Provides mechanisms for constructing proofs.
3. *Checks* every proof against the rules of a precisely defined logical system.
4. Guarantees that if the system accepts a proof, the theorem genuinely follows from the axioms.

The critical guarantee is (4). The system must be trustworthy: when it says "QED," we need to believe it.

### 1.3 The Landscape

The major proof assistant families, with their approximate user bases and logical foundations:

| System | Foundation | Language | Notable achievements |
|--------|-----------|----------|---------------------|
| Isabelle | Generic framework (Pure); HOL, ZF, FOL | Isar, ML | seL4, CoCon, Archive of Formal Proofs |
| Coq | Calculus of Inductive Constructions (CIC) | Gallina, Ltac, Ltac2 | Four Color Theorem, CompCert, Feit-Thompson |
| Lean 4 | Dependent type theory (CIC variant) | Lean | Mathlib, Liquid Tensor Experiment |
| HOL4 | Classical HOL | SML | CakeML verified compiler |
| HOL Light | Classical HOL | OCaml | Flyspeck (Kepler conjecture) |
| Agda | Martin-Lof type theory | Agda | HoTT library |
| ACL2 | First-order, computational | Lisp | AMD processor verification |
| Mizar | Set theory (Tarski-Grothendieck) | Mizar | Mizar Mathematical Library |

These systems differ in their logical foundations, proof styles, automation levels, and communities. But they share a common design principle.

---

## 2. The de Bruijn Criterion

### 2.1 Statement

**The de Bruijn criterion** (named after Nicolaas Govert de Bruijn, creator of the Automath system in the 1960s): A proof assistant should be structured so that the correctness of the entire system depends only on a small, clearly identified *trusted kernel*.

The trusted kernel is the only code that must be correct for the system's guarantees to hold. Everything else — proof automation, user interfaces, tactic languages, code generators — is untrusted: if it contains bugs, those bugs cannot cause the system to accept invalid proofs.

### 2.2 Why This Matters

A proof assistant is itself a piece of software, and software has bugs. The de Bruijn criterion limits the damage:

- The kernel might be 5,000-10,000 lines of code. It can be carefully audited, formally verified, or even proved correct.
- The automation layer might be 500,000+ lines. It does not need to be trusted.

**Analogy.** A spell-checker can suggest words, but ultimately a human decides what to type. Similarly, proof automation can suggest proof steps, but ultimately the kernel checks each step. A bug in the automation might cause it to fail to find a proof, or to suggest nonsensical steps, but it cannot cause the kernel to accept an invalid proof.

### 2.3 The Alternative (and Why It Is Dangerous)

Some systems (notably some older automated theorem provers) do not follow the de Bruijn criterion. Their entire codebase is trusted. If any part contains a bug, the system might accept invalid theorems. This has happened in practice.

---

## 3. The LCF Architecture

### 3.1 Robin Milner's Key Insight

The LCF (Logic for Computable Functions) system, designed by Robin Milner at Stanford in the early 1970s and later reimplemented at Edinburgh, introduced an architectural pattern that remains the gold standard for proof assistant design.

The key insight is to use the *type system of the implementation language* to enforce the de Bruijn criterion.

### 3.2 The Abstract Type `thm`

In ML (the programming language Milner invented for LCF), define an *abstract type* `thm` whose values represent theorems. The crucial properties:

1. The type `thm` is *abstract*: code outside the kernel cannot inspect or forge values of type `thm`.
2. The *only* ways to create values of type `thm` are through a fixed set of functions in the kernel module, each corresponding to a logical inference rule.
3. Any value of type `thm` is guaranteed to be a valid theorem.

The kernel module might look like (in ML-like pseudocode):

```sml
signature THM = sig
  type thm

  (* Axioms *)
  val assume : form -> thm              (* {phi} |- phi *)

  (* Inference rules *)
  val implies_intro : form -> thm -> thm
    (* if th is Gamma |- psi, returns Gamma \ {phi} |- phi --> psi *)

  val implies_elim : thm -> thm -> thm
    (* if th1 is Gamma |- phi --> psi and th2 is Delta |- phi,
       returns Gamma u Delta |- psi *)

  val forall_intro : var -> thm -> thm
    (* if th is Gamma |- phi and x not free in Gamma,
       returns Gamma |- forall x. phi *)

  val forall_elim : term -> thm -> thm
    (* if th is Gamma |- forall x. phi,
       returns Gamma |- phi[t/x] *)

  (* ... additional primitive rules ... *)

  val concl : thm -> form               (* extract the conclusion *)
  val hyps  : thm -> form list           (* extract the hypotheses *)
end
```

### 3.3 Derived Rules (Tactics)

Outside the kernel, users can write arbitrarily complex functions that produce values of type `thm`. These are called *derived rules* or *tactics*. For example:

```sml
fun modus_ponens_chain (th1 : thm) (th2 : thm) (th3 : thm) : thm =
  (* th1: A |- P -> Q
     th2: B |- Q -> R
     th3: C |- P
     Result: A u B u C |- R *)
  implies_elim th2 (implies_elim th1 th3)
```

This function composes two applications of `implies_elim`. It might be hundreds of lines long and contain subtle bugs. But no bug can cause it to produce an invalid theorem, because:

- It can only create `thm` values by calling kernel functions.
- Each kernel function checks its own preconditions and produces only valid theorems.
- Therefore, any `thm` value, however it was produced, represents a valid theorem.

### 3.4 The Security Guarantee

**Theorem (LCF correctness principle).** If the kernel correctly implements the inference rules, then every value of type `thm` that exists at any point during execution represents a valid theorem in the logic, regardless of what code outside the kernel does.

*Proof.* By induction on the construction of `thm` values. The base cases are the axioms (valid by definition). Each inference rule preserves validity (soundness of each rule). Since these are the only ways to construct `thm` values (by abstraction of the type), every `thm` is valid. $\square$

The proof relies on ML's type safety: there is no way to forge a `thm` value without going through the kernel's interface. This is why Milner invented ML — specifically to have a language with a strong enough type system to support this architecture.

### 3.5 Advantages and Disadvantages

**Advantages:**

- Small trusted base (the kernel + the ML compiler/runtime).
- Extensibility: anyone can write new tactics without compromising soundness.
- Compositionality: tactics can be freely combined.

**Disadvantages:**

- Performance: every proof step passes through the kernel, even if an oracle (SAT solver, SMT solver, etc.) has already verified it externally. (Some systems mitigate this with *proof certificates* that the kernel replays.)
- The ML runtime is part of the trusted base and is itself a substantial piece of software.

---

## 4. Isabelle's Architecture

### 4.1 Isabelle as a Generic Logical Framework

Isabelle, created by Lawrence Paulson at Cambridge (building on ideas from Paulson's earlier work with Milner on LCF), has a distinctive architectural feature: it separates the *metalogic* from *object logics*.

**The metalogic (Isabelle/Pure)** is a minimal intuitionistic fragment of higher-order logic. It provides:

- Meta-level implication: $\varphi \Longrightarrow \psi$ ("$\varphi$ implies $\psi$" at the meta-level)
- Meta-level universal quantification: $\bigwedge x.\, \varphi(x)$ ("for all $x$, $\varphi(x)$" at the meta-level)
- Meta-level equality: $t \equiv s$ ("$t$ equals $s$" by definition)

**Object logics** are formalized *within* Pure by declaring types, constants, and axioms. The major object logics shipped with Isabelle are:

| Object Logic | Description |
|-------------|------------|
| Isabelle/HOL | Classical higher-order logic (the most widely used) |
| Isabelle/FOL | Classical first-order logic |
| Isabelle/ZF | Zermelo-Fraenkel set theory (with or without Choice) |

### 4.2 Object Logic vs Metalogic

This separation is Isabelle's key architectural insight. Consider an inference rule like modus ponens. In Isabelle, it is represented as a meta-level theorem:

$$\llbracket P \longrightarrow Q;\; P \rrbracket \Longrightarrow Q$$

Here:

- $P \longrightarrow Q$ is an *object-level* implication (a connective defined within the object logic).
- $\Longrightarrow$ is a *meta-level* implication (part of Pure's infrastructure).
- $\llbracket \cdot ;\; \cdot \rrbracket$ is notation for iterated meta-implication: $A \Longrightarrow B \Longrightarrow C$ means "assuming $A$ and $B$, conclude $C$."

The meta-level connectives are used to *state* inference rules. The object-level connectives are what we *reason about*. This separation means that:

1. The same proof infrastructure (unification, resolution, rewriting) works for any object logic.
2. One can formalize new logics without modifying Isabelle's kernel.
3. Results about the metalogic (e.g., properties of Pure's inference rules) are independent of any particular object logic.

### 4.3 Isabelle's Kernel

Isabelle's kernel implements the following primitive inference rules of Pure:

1. **Assumption**: $\varphi \Longrightarrow \varphi$
2. **Implies introduction**: from $\varphi \Longrightarrow \psi$, conclude $\varphi \Longrightarrow \psi$ (discharging an assumption)
3. **Implies elimination (resolution)**: from $\varphi \Longrightarrow \psi$ and $\psi \Longrightarrow \chi$, conclude $\varphi \Longrightarrow \chi$
4. **Forall introduction**: from $\varphi(x)$, conclude $\bigwedge x.\, \varphi(x)$ when $x$ is not free in the assumptions
5. **Forall elimination**: from $\bigwedge x.\, \varphi(x)$, conclude $\varphi(t)$ for any term $t$
6. **Definitional equality**: $t \equiv t$ (reflexivity), and congruence rules

Higher-order unification is used to instantiate schematic variables (variables starting with `?`) during resolution. This is a key feature: Isabelle performs proof by *backward chaining* — starting from the goal and working backward, resolving the goal against known rules.

### 4.4 The Trusted Computing Base

Isabelle's trusted computing base consists of:

1. The kernel (inference rules of Pure, type-checking).
2. The Isabelle/ML runtime (Poly/ML).
3. The axioms of whichever object logic is loaded.

Everything else — the Isar proof language, the `auto`/`blast`/`simp` tactics, the Sledgehammer bridge to external provers, the code generator, the document preparation system — is untrusted. Bugs in these components cannot cause Isabelle to accept invalid proofs.

---

## 5. Historical Development

### 5.1 Timeline

**1972 — LCF (Stanford).** Robin Milner creates the Logic for Computable Functions system for reasoning about Scott's domain theory. The implementation language (later named ML — Meta Language) is designed specifically for this purpose.

**1979 — Edinburgh LCF.** Milner, with Gordon and Wadsworth, reimplements LCF at Edinburgh. The new system introduces the abstract-type architecture. ML becomes a general-purpose programming language. The resulting book *Edinburgh LCF* (1979) is the foundational text.

**1985 — Cambridge LCF.** Larry Paulson rewrites LCF in Standard ML at Cambridge. Key improvements: better tactic combinators, more efficient term representation.

**1986 — HOL (Higher Order Logic).** Mike Gordon (Milner's student) forks LCF to create a system for classical higher-order logic, aimed at hardware verification. HOL becomes the standard in the hardware verification community.

**1989 — Isabelle (first version).** Larry Paulson designs Isabelle as a "generic theorem prover" — a logical framework that can support multiple object logics. The key innovation is the Pure metalogic.

**1990s — Isabelle/HOL.** Tobias Nipkow (TU Munich) and Paulson develop Isabelle/HOL, which becomes the most popular object logic. The Isar proof language (Markus Wenzel) transforms Isabelle from an apply-script system to a structured-proof system.

**1998 — Isabelle/Isar.** Markus Wenzel introduces the Isar language for human-readable structured proofs, fundamentally changing how Isabelle is used.

**2009 — seL4.** Gerwin Klein and the NICTA team verify the functional correctness of the seL4 microkernel using Isabelle/HOL — approximately 200,000 lines of proof for 10,000 lines of C code. This is a landmark in formal verification.

**2014-present — Archive of Formal Proofs (AFP).** The AFP grows to contain thousands of formal developments, making Isabelle's library one of the largest bodies of formalized mathematics.

### 5.2 Milner's Legacy

Robin Milner (1934-2010) received the Turing Award in 1991. His contributions include:

- The LCF architecture (this lecture)
- The ML programming language (type inference, algebraic data types, pattern matching)
- The pi-calculus (concurrent computation)
- The Calculus of Communicating Systems (CCS)

The LCF architecture remains the dominant design pattern for proof assistants more than 50 years after its invention.

---

## 6. Comparison with Other Approaches

### 6.1 Type-Theoretic Proof Assistants (Coq, Lean, Agda)

In systems based on dependent type theory, the Curry-Howard correspondence is used directly: proofs are terms in a typed lambda calculus, and the type-checker verifies proofs. The "kernel" is the type-checker.

**Advantages over LCF:**

- Proofs are first-class objects that can be manipulated, composed, and analyzed.
- Computation (program extraction) is built in.
- The logical foundations are constructive, enabling proof-relevant mathematics.

**Disadvantages:**

- The type-checker is more complex than LCF's simple inference rules, making the trusted base harder to audit.
- Definitional equality and universe checking add complexity.
- Classical reasoning requires axioms that break computational content.

### 6.2 Isabelle's Middle Ground

Isabelle occupies a distinctive position:

- Like LCF systems, it has a small kernel based on simple inference rules.
- Like type-theoretic systems, it supports structured, human-readable proofs (via Isar).
- Unlike type-theoretic systems, it is logic-agnostic: the same infrastructure supports classical, intuitionistic, and set-theoretic reasoning.
- Its automation (Sledgehammer, Nitpick, Quickcheck) is among the most powerful of any proof assistant.

The tradeoff: Isabelle proofs are not programs. There is no built-in Curry-Howard extraction. (Isabelle does have a code generator, but it operates differently.)

---

## 7. Exercises

**Exercise 7.1.** Explain why the type abstraction of `thm` is essential to the LCF architecture. What would go wrong if `thm` were a transparent (non-abstract) type?

**Exercise 7.2.** Consider a hypothetical proof assistant with a 500,000-line kernel (no abstraction barrier). Give three concrete scenarios where a bug in this kernel could lead to accepting an invalid theorem.

**Exercise 7.3.** In Isabelle's metalogic, the rule for modus ponens in FOL is stated as:

$$\llbracket P \longrightarrow Q;\; P \rrbracket \Longrightarrow Q$$

Identify which symbols belong to the metalogic (Pure) and which to the object logic (FOL). Why is it important that $\Longrightarrow$ and $\longrightarrow$ are different connectives?

**Exercise 7.4.** The Curry-Howard correspondence maps proofs to programs. Under this mapping, what does a bug in a proof correspond to? What does the type-checker's acceptance of a proof correspond to?

**Exercise 7.5.** Isabelle/HOL and Coq both verify the same class of mathematical theorems (in principle). Name three practical factors that might lead a verification project to choose one over the other.

**Exercise 7.6.** Research and briefly describe the seL4 verification effort. What was verified, how long did it take, and what is the ratio of proof code to implementation code?

---

## References

- Gordon, M.J.C., Milner, R., and Wadsworth, C.P. *Edinburgh LCF: A Mechanised Logic of Computation*. Springer LNCS 78, 1979.
- Paulson, L.C. *Logic and Computation: Interactive Proof with Cambridge LCF*. Cambridge University Press, 1987.
- Paulson, L.C. "The Foundation of a Generic Theorem Prover." *Journal of Automated Reasoning* 5(3), 1989.
- Wenzel, M. "Isar — A Generic Interpretive Approach to Readable Formal Proof Documents." *TPHOLs 1999*, Springer LNCS 1690.
- Nipkow, T., Paulson, L.C., and Wenzel, M. *Isabelle/HOL: A Proof Assistant for Higher-Order Logic*. Springer LNCS 2283, 2002.
- Klein, G. et al. "seL4: Formal Verification of an OS Kernel." *SOSP 2009*, ACM.
- Harrison, J. "HOL Light: An Overview." *TPHOLs 2009*, Springer LNCS 5674.

---

*Previous: [Lecture 00b: Natural Deduction & Sequent Calculus](lecture_00b_natural_deduction_sequent_calculus.md)*
*Next: Module 01 — [Isabelle/Pure & the Isar Language](../01_isabelle_isar/01_isabelle_isar.md)*
