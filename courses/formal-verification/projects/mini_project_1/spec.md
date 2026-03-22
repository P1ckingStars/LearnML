# Mini-Project 1: Set-Theoretic Formalization in Isabelle/ZF

**Course:** Formal Verification with Isabelle (PhD Track)
**Due:** Week 10
**Weight:** 10% of final grade
**Format:** Individual

---

## Overview

In this project, you will formalize a non-trivial set-theoretic result in Isabelle/ZF. The goal is to develop fluency with the Isabelle/ZF proof infrastructure, practice translating informal mathematical arguments into machine-checked proofs, and produce a clean, well-documented formalization that demonstrates understanding of proof engineering decisions.

This is not a tutorial exercise. You are expected to produce a formalization that goes beyond what is covered in lectures and homework, requiring you to make independent decisions about definitions, proof strategies, and theory structure.

---

## Objectives

1. Formalize a set-theoretic result of genuine mathematical content in Isabelle/ZF.
2. Navigate the gap between textbook proofs and formal proofs, making and justifying definitional choices.
3. Produce clean, well-structured Isabelle theory files with appropriate use of automation and structured reasoning.
4. Write a concise report explaining your formalization strategy and the challenges encountered.

---

## Suggested Topics

Choose one of the following topics, or propose your own (subject to instructor approval by Week 7). Each topic is described with its mathematical content and specific formalization requirements.

### Topic 1: Cantor's Theorem with Applications

Formalize Cantor's theorem (there is no surjection from a set to its power set) and develop applications:

- Prove `|A| < |Pow(A)|` for arbitrary sets A.
- Formalize the construction showing `|nat| < |Pow(nat)|`.
- Prove that `|Pow(nat)|` equals `|nat -> 2|` (the set of functions from nat to {0, 1}).
- Develop the diagonal argument in a general, reusable form.

**Starting point:** The Isabelle/ZF distribution includes basic cardinal arithmetic. Build on `Cardinal.thy`.

**Expected difficulty:** Moderate. The diagonal argument itself is straightforward, but making it work cleanly with Isabelle's cardinal infrastructure requires care.

### Topic 2: Well-Ordering of omega x omega

Formalize the Sierpinski proof that omega x omega (with the standard product ordering) is order-isomorphic to omega:

- Define the standard well-ordering on omega x omega (e.g., the Cantor pairing function ordering).
- Prove that this ordering is a well-ordering.
- Construct an explicit order isomorphism between (omega x omega, <_pair) and (omega, <).
- Prove that the isomorphism preserves the ordering in both directions.

**Starting point:** Build on `Ordinal.thy` and `Order.thy` from the Isabelle/ZF distribution.

**Expected difficulty:** Moderate to high. The key challenge is handling the pairing function and its inverse cleanly in ZF's type system.

### Topic 3: Fixed-Point Lemma for Normal Functions

Formalize the fixed-point lemma: every normal (continuous and strictly increasing) function on ordinals has arbitrarily large fixed points:

- Define normal functions on ordinals.
- Prove that the class of fixed points of a normal function is a proper class.
- Construct the enumerating function of the fixed points.
- Prove that the enumerating function is itself normal (if time permits).

**Starting point:** Build on `Ordinal.thy`. You will need the theory of ordinal-indexed sequences and suprema.

**Expected difficulty:** High. The main challenge is working with ordinal-indexed limits and ensuring the definitions interact correctly with Isabelle's ordinal infrastructure.

### Topic 4: Ordinal Arithmetic Properties

Formalize a collection of properties of ordinal arithmetic operations:

- Prove left-distributivity of multiplication over addition: alpha * (beta + gamma) = alpha * beta + alpha * gamma.
- Prove that right-distributivity fails by constructing an explicit counterexample.
- Prove that ordinal exponentiation satisfies alpha^(beta + gamma) = alpha^beta * alpha^gamma.
- Prove monotonicity and continuity properties of ordinal operations.
- Formalize at least one non-trivial result about the Cantor Normal Form (e.g., uniqueness of representation for ordinals below epsilon_0).

**Starting point:** Build on `Ordinal.thy` and `OrdQuant.thy`.

**Expected difficulty:** Moderate. Individual properties are not hard, but the collection requires careful organization.

### Topic 5: Ramsey's Theorem for Pairs

Formalize the infinite Ramsey theorem for pairs: for any 2-coloring of the 2-element subsets of omega, there exists an infinite homogeneous set:

- Define the partition relation omega -> (omega)^2_2.
- Prove the theorem using the standard combinatorial argument (construct an infinite descending sequence of infinite sets).
- Formalize the pigeon-hole principle for infinite sets as a supporting lemma.

**Starting point:** Build on `Nat.thy` and `Finite.thy` from the Isabelle/ZF distribution.

**Expected difficulty:** High. The main challenge is handling infinite subsets and the selection argument within ZF's framework. You will need the axiom of choice (or dependent choice).

### Proposing Your Own Topic

If you wish to propose a different topic, submit a 1-paragraph proposal to the instructor by Week 7. The proposal must include:

- The mathematical result you intend to formalize
- A textbook reference for the informal proof
- Evidence that the result is not already in the Isabelle/ZF distribution or the AFP
- An estimate of the formalization effort (how many definitions and lemmas you expect)

---

## Technical Requirements

### Code Requirements

- **Minimum size:** 500 lines of Isabelle/ZF code (excluding blank lines and comments).
- **Completeness:** No sorry in any submitted proof. Every lemma and theorem must be fully proved.
- **Build:** The development must build successfully with `isabelle build` using the provided ROOT file.
- **Framework:** You must use Isabelle/ZF, not Isabelle/HOL. The point is to work within the ZF axiom system.

### Proof Style

Your proofs should demonstrate a mix of techniques:

- **Structured Isar proofs** for the main theorems and key lemmas where the proof structure is mathematically interesting.
- **Automation** (simp, auto, blast, force) for routine steps and obvious consequences.
- **Sledgehammer** is permitted but should not be your only proof technique. If Sledgehammer finds a proof, you should understand why it works.

At least **3 proofs** in your development should use structured Isar reasoning (proof ... qed) rather than pure automation.

### Theory File Organization

- Use a clear naming convention for theory files (e.g., `Cantor_Diagonal.thy`, `Pairing_Function.thy`).
- Include a ROOT file that specifies the session and build order.
- Begin each theory file with a comment block explaining its purpose and dependencies.
- Definitions should be accompanied by informal explanations in comments.

---

## Deliverables

### 1. Report (2 pages max)

Your report must include:

1. **Formalization Goal** (2-3 sentences): What did you formalize and why?
2. **Mathematical Background** (half page): State the main result and sketch the informal proof.
3. **Formalization Strategy** (1 page): This is the most important section. Cover:
   - Key definitional choices and alternatives considered
   - How the formal proof structure differs from the informal proof
   - Which proofs used automation vs. structured reasoning, and why
   - The most challenging step and how you resolved it
4. **Statistics:** Line count, number of definitions, number of lemmas, approximate time spent.
5. **Lessons Learned** (2-3 sentences): What did you learn about the gap between informal and formal mathematics?

### 2. Isabelle Code

- All theory files with a working ROOT file
- Clean, well-commented code
- No sorry

### 3. Build Verification

Include the output of `isabelle build -D .` showing successful compilation in a text file or screenshot.

---

## Milestones

### Week 7: Topic Selection + Initial Definitions (5% of project grade)

Submit:

- Your chosen topic (or a custom topic proposal)
- A `.thy` file containing the key definitions you plan to use
- Evidence that the definitions are accepted by Isabelle (screenshot or build log)

### Week 10: Final Submission (95% of project grade)

Submit the full report, code, and build verification as described above.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Mathematical Depth** | 25% | The formalized result is non-trivial. The proof requires a genuine chain of reasoning, not just a single application of automation. The mathematical content is faithfully represented. |
| **Proof Engineering** | 30% | Code is well-structured. Definitions are well-chosen and aligned with Isabelle infrastructure. Appropriate mix of automation and structured reasoning. Lemma factoring is thoughtful. No sorry. |
| **Report Quality** | 25% | Formalization strategy section is detailed and insightful. Definitional choices are explained and justified. The report demonstrates understanding of why formalization is hard, not just that it was done. |
| **Code Quality** | 20% | Theory files are well-organized with clear naming. Comments explain non-obvious steps. ROOT file works. Code is readable by another Isabelle user. |

### Grade Descriptors

- **A (90-100%):** A formalization of genuine depth with clean, well-documented code. The report provides real insight into formalization decisions. The proof structure demonstrates understanding of both the mathematics and the proof assistant.
- **B (80-89%):** A correct formalization with adequate documentation. The report is clear but may lack depth in the strategy discussion. Code works but may have style issues.
- **C (70-79%):** The formalization is correct but the result is shallow or the code is poorly organized. The report is superficial. Proofs may rely excessively on brute-force automation.
- **D/F (<70%):** Sorry remains in the code, the result is trivial, or the development does not build. Report is missing or inadequate.

---

## Helpful Guidance

### Getting Started

1. Start by reading the relevant Isabelle/ZF theories (`Ordinal.thy`, `Cardinal.thy`, `Nat.thy`, etc.) to understand what infrastructure already exists.
2. Use `find_theorems` extensively before proving anything. The lemma you need may already exist.
3. Write out the informal proof by hand first, then identify which steps map directly to Isabelle automation and which require structured reasoning.
4. Begin with definitions. Spend time getting them right before attempting proofs. Definitional mistakes compound.

### Common Pitfalls

- **Reinventing existing lemmas.** Check `find_theorems name: "foo"` and `find_theorems "_ : Ord ==> _"` before proving basic properties. The Isabelle/ZF library is extensive.
- **Over-reliance on auto/simp.** When auto takes more than 10 seconds or simp loops, you need to restructure the proof. Add intermediate goals.
- **Mismatched types in ZF.** ZF is untyped (everything is a set), but Isabelle/ZF uses soft typing via predicates like `Ord`, `nat`, etc. Forgetting type assumptions is a common source of unprovable goals.
- **Ignoring the simpset.** Adding too many rules to the simpset causes looping. Adding too few makes automation weak. Use `[simp]` annotations judiciously and test after each addition.
- **Monolithic theory files.** Split your development into files of 100-300 lines each, organized by logical topic.

### Compute Expectations

Formalization is not computationally expensive. Any modern laptop running Isabelle2025 is sufficient. However, some proofs may take 30-60 seconds to check if they involve extensive automation. Plan for this when debugging.

### Suggested Reading

- Paulson, "Set Theory for Verification: I" (JAR, 1993) -- the original paper describing Isabelle/ZF
- Paulson, "Set Theory for Verification: II" (JAR, 1995) -- cardinal arithmetic in Isabelle/ZF
- The Isabelle/ZF documentation in the Isabelle distribution (`~~/src/ZF/README`)
- Kunen, *Set Theory: An Introduction to Independence Proofs* -- for mathematical background on all suggested topics

---

## Academic Integrity

- You must write all proofs yourself. You may reference the Isabelle distribution, AFP, and course materials for guidance, but the formalization must be your own.
- Cite any Isabelle theory files or AFP entries you reference or adapt.
- Discussion of proof strategies with classmates is encouraged, but do not share theory files.
- Using AI tools for proof discovery is permitted but must be disclosed. All proofs must be verified by Isabelle.

---

## Submission

Submit via the course portal by **Week 10, Friday 11:59 PM**:

1. Report as PDF (2 pages max)
2. Isabelle theory files as a zip archive
3. Build verification output
