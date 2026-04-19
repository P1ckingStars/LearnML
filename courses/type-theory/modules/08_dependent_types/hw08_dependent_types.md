---
title: "Homework 08: Dependent Types"
tags:
  - type-theory
  - dependent-types
  - homework
  - module-index
---
# Homework 08: Dependent Types

> **Module 08 --- Dependent Types (Weeks 15--16)**
> Due: End of Week 16

---

## Instructions

This homework has two parts of equal weight. Part A focuses on theory (pen-and-paper proofs and formal reasoning about dependent type systems). Part B focuses on implementation (extending the dependent type checker from Recitation 08).

**Submission requirements:**

- **Part A:** A PDF with clearly written proofs. Use LaTeX for all mathematical notation. Number each problem and sub-problem clearly. State any lemmas you use.
- **Part B:** Your OCaml source code (`.ml` file) with a `README` describing how to build and run it. Include test output demonstrating that all tests pass. Your code must compile with OCaml 5.x and produce no warnings.

**Academic integrity:** You may consult the course notes, the textbooks listed in the Further Reading sections of the lectures, and the Coq/Agda/Lean documentation. You may not consult solutions from other students or from online sources. You may use a proof assistant (Coq, Agda, Lean) to check your work in Part A, but you must submit human-readable proofs, not tactic scripts.

**Notation conventions:** We use $\text{Id}_A(a, b)$ or $a =_A b$ for identity types, $\text{refl}_a$ for the reflexivity constructor, and $\text{J}$ for the eliminator. We write $\Pi(x : A).\, B(x)$ for dependent function types and $\Sigma(x : A).\, B(x)$ for dependent pair types. The universe is $\mathcal{U}$ (with levels $\mathcal{U}_0, \mathcal{U}_1, \ldots$ when relevant). The natural number type is $\text{Nat}$ with constructors $0$ and $\text{succ}$.

---

## Part A: Theory (50%)

### Problem 1: Identity Type Derivations (15 points)

Throughout this problem, work in intensional Martin-Lof type theory with Pi types, Sigma types, identity types ($\text{Id}$), natural numbers, and a universe $\mathcal{U}$.

**Recall the J eliminator:**

$$\frac{\begin{array}{c} \Gamma \vdash p : \text{Id}_A(a, b) \\ \Gamma, x : A, y : A, q : \text{Id}_A(x, y) \vdash C(x, y, q) \; \text{type} \\ \Gamma, z : A \vdash c(z) : C(z, z, \text{refl}_z) \end{array}}{\Gamma \vdash \text{J}(C, c, a, b, p) : C(a, b, p)}$$

with computation rule $\text{J}(C, c, a, a, \text{refl}_a) \equiv c(a)$.

**(a)** (5 points) Using the J eliminator, derive the **action on paths** (congruence / $\text{ap}$):

$$\text{ap} : \Pi(A\, B : \mathcal{U}).\, \Pi(f : A \to B).\, \Pi(a\, b : A).\, \text{Id}_A(a, b) \to \text{Id}_B(f(a), f(b))$$

Write out the complete term (including the motive for J) and verify the computation rule: $\text{ap}(A, B, f, a, a, \text{refl}_a) \equiv \text{refl}_{f(a)}$.

**(b)** (5 points) Using J, derive **transport**:

$$\text{transport} : \Pi(A : \mathcal{U}).\, \Pi(P : A \to \mathcal{U}).\, \Pi(a\, b : A).\, \text{Id}_A(a, b) \to P(a) \to P(b)$$

Write out the complete proof term, including the motive. Verify the computation rule: $\text{transport}(A, P, a, a, \text{refl}_a) \equiv \text{id}_{P(a)}$ (the identity function on $P(a)$).

Then use transport to prove that equality is a **congruence for type families**: if $P : A \to \mathcal{U}$ and $p : \text{Id}_A(a, b)$, then there is a function $P(a) \to P(b)$. (This is simply transport itself --- explain why.)

**(c)** (5 points) Prove that identity types satisfy **groupoid laws** up to higher identity. Specifically, construct terms witnessing:

1. Left unit: $\Pi(a\, b : A).\, \Pi(p : \text{Id}_A(a, b)).\, \text{Id}(\text{trans}(\text{refl}_a, p),\, p)$
2. Right unit: $\Pi(a\, b : A).\, \Pi(p : \text{Id}_A(a, b)).\, \text{Id}(\text{trans}(p, \text{refl}_b),\, p)$
3. Inverse: $\Pi(a\, b : A).\, \Pi(p : \text{Id}_A(a, b)).\, \text{Id}(\text{trans}(p, \text{sym}(p)),\, \text{refl}_a)$

For each, state the motive used in J and verify the computation rule on $\text{refl}$. (In each case, instantiating $p = \text{refl}_a$ should yield $\text{refl}_{\text{refl}_a}$.)

### Problem 2: Propositions as Types (15 points)

**(a)** (5 points) Formalize the following propositions as types in MLTT and construct proof terms for those that are provable. For those that are not provable (in constructive logic), explain why, and state whether adding the law of excluded middle would make them provable.

Recall the type-theoretic translations: $\forall$ becomes $\Pi$, $\exists$ becomes $\Sigma$, $\land$ becomes $\times$, $\lor$ becomes $+$, $\Rightarrow$ becomes $\to$, $\neg P$ becomes $P \to \mathbf{0}$.

1. $(\forall x : A.\, P(x) \to Q(x)) \to (\forall x : A.\, P(x)) \to (\forall x : A.\, Q(x))$

   Type: $(\Pi(x : A).\, P(x) \to Q(x)) \to (\Pi(x : A).\, P(x)) \to \Pi(x : A).\, Q(x)$

2. $(\exists x : A.\, P(x) \land Q(x)) \to (\exists x : A.\, P(x)) \land (\exists x : A.\, Q(x))$

   Type: $(\Sigma(x : A).\, P(x) \times Q(x)) \to (\Sigma(x : A).\, P(x)) \times (\Sigma(x : A).\, Q(x))$

3. $\neg\neg(\forall x : A.\, P(x) \lor \neg P(x))$

   Type: $((\Pi(x : A).\, P(x) + (P(x) \to \mathbf{0})) \to \mathbf{0}) \to \mathbf{0}$

4. $(\forall x : A.\, \neg\neg P(x)) \to \neg\neg(\forall x : A.\, P(x))$

   Type: $(\Pi(x : A).\, ((P(x) \to \mathbf{0}) \to \mathbf{0})) \to ((\Pi(x : A).\, P(x)) \to \mathbf{0}) \to \mathbf{0}$

**(b)** (5 points) Prove the **type-theoretic axiom of choice**:

$$\left(\Pi(x : A).\, \Sigma(y : B(x)).\, C(x, y)\right) \;\to\; \Sigma(f : \Pi(x : A).\, B(x)).\, \Pi(x : A).\, C(x, f(x))$$

Write out the complete proof term. Then explain in 3--4 sentences why this is a theorem in MLTT but an axiom (independent of ZF) in set theory. Your explanation should address the constructive content of the hypothesis.

**(c)** (5 points) The **decidable equality** type for $A$ is:

$$\text{DecEq}(A) \;\stackrel{\text{def}}{=}\; \Pi(a\, b : A).\, \text{Id}_A(a, b) + \neg\,\text{Id}_A(a, b)$$

Prove that $\text{Nat}$ has decidable equality: construct a term of type $\text{DecEq}(\text{Nat})$.

*Hint:* Proceed by double induction on $a$ and $b$. The four cases are:

- $a = 0$, $b = 0$: Equal (by $\text{refl}$).
- $a = 0$, $b = \text{succ}(n)$: Not equal.
- $a = \text{succ}(m)$, $b = 0$: Not equal.
- $a = \text{succ}(m)$, $b = \text{succ}(n)$: Reduce to the decision for $m$ and $n$.

You may use without proof the following auxiliary lemmas:

- $\text{succ-inj} : \text{Id}(\text{succ}(m), \text{succ}(n)) \to \text{Id}(m, n)$ (successor is injective).
- $\text{zero-neq-succ} : \neg\,\text{Id}(0, \text{succ}(n))$ (zero is not a successor).
- $\text{ap} : (f : A \to B) \to \text{Id}(a, b) \to \text{Id}(f(a), f(b))$ (congruence).

Write out the structure of the proof clearly, indicating which eliminator (Nat-elim) is used at each level of induction, and how the inductive hypothesis is used in the successor-successor case.

### Problem 3: Metatheory (20 points)

Consider the following minimal dependent type system $\lambda_\Pi$:

**Syntax:**

$$e ::= x \mid \lambda(x : e).\, e \mid e\; e \mid \Pi(x : e).\, e \mid \mathcal{U}$$

**Typing rules:**

$$\frac{}{\Gamma \vdash \mathcal{U} : \mathcal{U}} \; (\text{Ax}) \qquad \frac{(x : A) \in \Gamma}{\Gamma \vdash x : A} \; (\text{Var})$$

$$\frac{\Gamma \vdash A : \mathcal{U} \qquad \Gamma, x : A \vdash B : \mathcal{U}}{\Gamma \vdash \Pi(x : A).\, B : \mathcal{U}} \; (\Pi F) \qquad \frac{\Gamma, x : A \vdash b : B}{\Gamma \vdash \lambda(x : A).\, b : \Pi(x : A).\, B} \; (\Pi I)$$

$$\frac{\Gamma \vdash f : \Pi(x : A).\, B \qquad \Gamma \vdash a : A}{\Gamma \vdash f\; a : B[a/x]} \; (\Pi E) \qquad \frac{\Gamma \vdash t : A \qquad A \equiv_\beta B \qquad \Gamma \vdash B : \mathcal{U}}{\Gamma \vdash t : B} \; (\text{Conv})$$

**(a)** (5 points) Prove the **weakening lemma**: if $\Gamma, \Delta \vdash t : A$ and $\Gamma \vdash B : \mathcal{U}$ with $y \notin \text{dom}(\Gamma) \cup \text{dom}(\Delta)$, then $\Gamma, y : B, \Delta \vdash t : A$.

*Hint:* Proceed by induction on the typing derivation $\Gamma, \Delta \vdash t : A$. For each rule, show that the premises can be weakened and then apply the same rule in the extended context. Pay special attention to the variable rule and the Pi-formation rule.

**(b)** (5 points) Prove the **substitution lemma**: if $\Gamma, x : A, \Delta \vdash t : C$ and $\Gamma \vdash a : A$, then $\Gamma, \Delta[a/x] \vdash t[a/x] : C[a/x]$.

*Hint:* Proceed by induction on the typing derivation. The key cases are:

- *Variable ($t = x$):* Then $C = A$ and $t[a/x] = a$. We need $\Gamma, \Delta[a/x] \vdash a : A$, which follows from $\Gamma \vdash a : A$ and weakening.
- *Lambda ($t = \lambda(y : B).\, b$):* Apply the induction hypothesis to $b$, handling the extended context $\Delta, y : B$.
- *Application ($t = f\;s$):* Apply the induction hypothesis to both $f$ and $s$.
- *Conversion:* The substitution must be applied to both the term and the type, using the fact that $\beta$-equivalence is preserved under substitution.

**(c)** (5 points) Prove **subject reduction** (type preservation): if $\Gamma \vdash t : A$ and $t \longrightarrow_\beta t'$, then $\Gamma \vdash t' : A$.

*Hint:* The critical case is the $\beta$-reduction $(\lambda(x : B).\, b)\;s \longrightarrow b[s/x]$. From the typing derivation, extract: (i) $\Gamma, x : B \vdash b : C(x)$, (ii) $\Gamma \vdash s : B$. Apply the substitution lemma to conclude $\Gamma \vdash b[s/x] : C[s/x]$. The result type of the application is $C[s/x]$ by the App rule, so subject reduction holds.

You may use the substitution lemma from part (b). For the congruence cases (reduction in a subterm), appeal to the induction hypothesis.

**(d)** (5 points) Explain why the axiom $\mathcal{U} : \mathcal{U}$ makes this system inconsistent (you do not need to reproduce Girard's paradox in full, but you should outline the key idea). Then describe how the system would be modified to restore consistency by introducing a universe hierarchy $\mathcal{U}_0 : \mathcal{U}_1 : \mathcal{U}_2 : \ldots$, and state (without proof) what metatheoretic property of the hierarchy is essential for consistency.

In your answer, address:

- What kind of self-referential definition does $\mathcal{U} : \mathcal{U}$ enable?
- How is this analogous to Russell's paradox in set theory?
- What role does the stratification into levels play in blocking the paradox?
- Is the universe hierarchy itself a type? Why or why not?

---

## Part B: Implementation (50%)

Extend the dependent type checker from Recitation 08 with the following features. Each sub-problem is independent; you may complete them in any order.

### Problem 4: Boolean Type with Dependent Elimination (10 points)

Add the Boolean type to the checker.

**New syntax constructors:** `Bool`, `True`, `False`, `BoolElim(c, ct, cf, b)`.

**New value constructors:** `VBool`, `VTrue`, `VFalse`, and a neutral form `NBoolElim(c, ct, cf, ne)`.

**Typing rule for BoolElim:**

$$\frac{\Gamma \vdash b : \text{Bool} \quad \Gamma, x : \text{Bool} \vdash C(x) : \mathcal{U} \quad \Gamma \vdash c_t : C(\text{true}) \quad \Gamma \vdash c_f : C(\text{false})}{\Gamma \vdash \text{BoolElim}(C, c_t, c_f, b) : C(b)}$$

**Computation rules:**

$$\text{BoolElim}(C, c_t, c_f, \text{true}) \equiv c_t$$

$$\text{BoolElim}(C, c_t, c_f, \text{false}) \equiv c_f$$

When $b$ is a neutral value, $\text{BoolElim}$ is stuck and produces a neutral value.

**Deliverable:** Updated `eval`, `quote`, `conv`, `check`, `infer` functions. Write at least three test cases:

1. A simple (non-dependent) if-then-else: $\text{BoolElim}(\lambda b.\, \text{Nat}, 1, 0, \text{true})$ should evaluate to $1$.
2. A function $\text{not} : \text{Bool} \to \text{Bool}$ defined as $\lambda b.\, \text{BoolElim}(\lambda \_.\, \text{Bool}, \text{false}, \text{true}, b)$, and verify that $\text{not}(\text{true})$ evaluates to $\text{false}$.
3. A **dependent** elimination: define a function $f : \Pi(b : \text{Bool}).\, C(b)$ where $C(\text{true}) = \text{Nat}$ and $C(\text{false}) = \text{Bool}$, using $\text{BoolElim}$ with the motive $C(b) \stackrel{\text{def}}{=} \text{BoolElim}(\lambda \_.\, \mathcal{U}, \text{Nat}, \text{Bool}, b)$. Verify that $f(\text{true}) : \text{Nat}$ and $f(\text{false}) : \text{Bool}$.

### Problem 5: Let-Bindings and Definitions (10 points)

Add let-bindings to the checker.

**New syntax constructor:** `Let(x, ty, def, body)` representing $\text{let}\; x : A = t \;\text{in}\; \text{body}$.

**Typing rule:**

$$\frac{\Gamma \vdash A : \mathcal{U} \qquad \Gamma \vdash t : A \qquad \Gamma, x : A = t \vdash \text{body} : B}{\Gamma \vdash \text{let}\; x : A = t \;\text{in}\; \text{body} : B[t/x]}$$

**Evaluation rule:** $\text{let}\; x : A = t \;\text{in}\; \text{body} \equiv \text{body}[t/x]$. In NbE, this means evaluating `body` in an environment where `x` is bound to the *value* of `t`, not a fresh neutral variable.

**Key implementation detail:** When checking `body`, the context should record both the *type* of $x$ (for type checking) and the *value* of $x$ (for evaluation/conversion). You will need to modify the `extend` function or create a new `extend_def` function that adds the definition's value to the environment rather than a fresh variable.

This is crucial: if we extend with a fresh variable instead of the definition's value, the type checker will not be able to unfold the let-binding during conversion checking, causing spurious type errors.

**Deliverable:** Updated checker with let-bindings. Write test cases that demonstrate:

1. A simple non-dependent let: $\text{let}\; x : \text{Nat} = \text{succ}(\text{succ}(0)) \;\text{in}\; \text{succ}(x)$ should have type $\text{Nat}$ and normalize to $\text{succ}(\text{succ}(\text{succ}(0)))$.
2. A let whose body's type depends on the bound variable: define $\text{let}\; n : \text{Nat} = 3 \;\text{in}\; \text{vnil}$ where `vnil` has type $\text{Vec}(A, 0)$ but the context knows that $n = 3$. Verify that the definition of $n$ is correctly unfolded during conversion checking.
3. A nested let that demonstrates that inner definitions can refer to outer definitions.

### Problem 6: Empty Type and Absurdity (10 points)

Add the empty type to the checker.

**New syntax constructors:** `Empty`, `Absurd(c, e)`.

**New value constructors:** `VEmpty` and a neutral form `NAbsurd(c, ne)`.

**Typing rules:**

- $\text{Empty}$ has no introduction rules. There are no values of type $\text{Empty}$.
- The eliminator (ex falso quodlibet):

$$\frac{\Gamma \vdash e : \text{Empty} \qquad \Gamma \vdash C : \mathcal{U}}{\Gamma \vdash \text{Absurd}(C, e) : C}$$

**Computation rules:** There are no computation rules for $\text{Absurd}$. Since $\text{Empty}$ has no constructors, $e$ must be a neutral term, so $\text{Absurd}(C, e)$ is always stuck. In the evaluator, when $e$ evaluates to a neutral value, produce `VNeutral(NAbsurd(vc, ne))`.

**Deliverable:** Updated checker. Write test cases that demonstrate:

1. The negation type $\neg A \stackrel{\text{def}}{=} A \to \text{Empty}$ is well-formed: check that $\Pi(A : \mathcal{U}).\, A \to \text{Empty}$ has type $\mathcal{U} \to \mathcal{U}$ (or simply that $\neg \text{Nat}$ is a valid type).
2. Ex falso: given a hypothesis $e : \text{Empty}$ in the context, construct a term of type $\text{Nat}$ using $\text{Absurd}$. Specifically, type-check the function $\lambda(e : \text{Empty}).\, \text{Absurd}(\text{Nat}, e) : \text{Empty} \to \text{Nat}$.
3. Double negation introduction: construct and type-check a term of type $\Pi(A : \mathcal{U}).\, A \to ((A \to \text{Empty}) \to \text{Empty})$. This should be $\lambda A.\, \lambda a.\, \lambda f.\, f\;a$.
4. (Bonus) Verify that the function $\Pi(A : \mathcal{U}).\, ((A \to \text{Empty}) \to \text{Empty}) \to A$ is *not* typeable (your checker should report an error if you attempt to check a lambda against this type).

### Problem 7: Integration Test --- Verified Addition (20 points)

Using all the features of your extended checker, encode and type-check the following. This problem tests that all components of your type checker work together correctly.

**(a)** (5 points) Define addition $\text{add} : \text{Nat} \to \text{Nat} \to \text{Nat}$ using $\text{NatElim}$ and verify that $\text{add}(2, 3)$ normalizes to $5$ (that is, to $\text{succ}^5(0)$).

Specifically, construct the term:

```
add = lam m. lam n. NatElim (lam _. Nat) n (lam k. lam ih. succ ih) m
```

Then evaluate `App(App(add, succ(succ(zero))), succ(succ(succ(zero))))` and verify that the result is `VSucc(VSucc(VSucc(VSucc(VSucc(VZero)))))`.

**(b)** (5 points) Define a type family $\text{Vec} : \mathcal{U} \to \text{Nat} \to \mathcal{U}$ using the Church encoding:

$$\text{Vec}(A, n) = \Pi(V : \text{Nat} \to \mathcal{U}).\, V(0) \to (\Pi(k : \text{Nat}).\, A \to V(k) \to V(\text{succ}(k))) \to V(n)$$

Construct the following terms and verify that they type-check:

1. $\text{Vec} : \mathcal{U} \to \text{Nat} \to \mathcal{U}$ (the type family itself).
2. $\text{vnil} : \Pi(A : \mathcal{U}).\, \text{Vec}(A, 0)$ (the empty vector). This should be $\lambda A.\, \lambda V.\, \lambda vn.\, \lambda vc.\, vn$.
3. $\text{vcons} : \Pi(A : \mathcal{U}).\, \Pi(n : \text{Nat}).\, A \to \text{Vec}(A, n) \to \text{Vec}(A, \text{succ}(n))$ (the cons operation). This should be $\lambda A.\, \lambda n.\, \lambda a.\, \lambda v.\, \lambda V.\, \lambda vn.\, \lambda vc.\, vc\;n\;a\;(v\;V\;vn\;vc)$.

**(c)** (5 points) Define the type of proofs that two natural numbers are equal, using the Leibniz encoding of identity:

$$\text{Eq}(a, b) = \Pi(P : \text{Nat} \to \mathcal{U}).\, P(a) \to P(b)$$

Construct a proof of $\text{Eq}(\text{add}(2, 3), 5)$. Since $\text{add}(2, 3)$ computes to $5$ by the reduction rules, this should be $\text{refl}$, i.e., $\lambda P.\, \lambda p.\, p$. Verify that this proof type-checks.

Also construct a proof of $\text{Eq}(\text{add}(0, n), n)$ for an arbitrary $n$ (this should also be $\text{refl}$ since $\text{add}(0, n) \equiv n$ by the computation rule of NatElim).

**(d)** (5 points) Write a comprehensive test suite that runs all the above tests and prints results. Include at least **two negative tests**: terms that should be *rejected* by the type checker. Examples:

1. Applying a non-function: `App(Zero, Zero)` should fail because `Zero` is not a function.
2. Type mismatch in a dependent pair: `Pair(True, succ(zero))` checked against $\Sigma(b : \text{Bool}).\, C(b)$ where $C(\text{true}) = \text{Bool}$ and $C(\text{false}) = \text{Nat}$ --- the second component $\text{succ}(0) : \text{Nat}$ does not match the expected $C(\text{true}) = \text{Bool}$.
3. Dimension mismatch: attempting to type-check a term that applies a vector operation at the wrong length.

For each negative test, catch the exception raised by the type checker and print a message indicating that the error was correctly detected.

---

---

## Hints and Clarifications

### General Hints for Part A

- When constructing proof terms using J, always specify the motive $C(x, y, q)$ explicitly and verify the computation rule by substituting $\text{refl}$.
- For induction proofs on $\text{Nat}$, the motive is the property you are proving, viewed as a type family $C : \text{Nat} \to \mathcal{U}$.
- When a proof requires multiple uses of J or induction, it is often clearest to define auxiliary lemmas separately and compose them.
- Remember that definitional equality is decided by the type checker (via normalization), while propositional equality requires explicit proof terms. When a goal follows by computation (e.g., $\text{add}(0, n) = n$), $\text{refl}$ suffices. When it requires induction (e.g., $\text{add}(n, 0) = n$), you must construct a proof by induction.

### General Hints for Part B

- Start with the recitation code as your base. Make incremental changes and test after each modification.
- When adding a new type former, you need to update *all* of the following: the `expr` type, the `value` type (and possibly the `neutral` type), `eval`, `quote`, `conv`, `check`, and `infer`.
- For `BoolElim` and `Absurd`, the neutral cases are crucial: when the scrutinee is a neutral value, the eliminator produces a neutral value.
- For let-bindings, the key insight is that the evaluation environment should contain the *value* of the let-bound variable, not a fresh neutral variable. This is what allows the type checker to unfold definitions during conversion checking.
- For negative tests, use `try ... with Failure msg -> ...` (or the appropriate OCaml exception mechanism) to catch type errors and verify that they are reported correctly.

### Suggested Implementation Order

1. Problem 5 (Let-bindings) --- simplest extension
2. Problem 4 (Bool) --- straightforward type former
3. Problem 6 (Empty) --- simple type with no introduction rules
4. Problem 7 (Integration tests) --- uses all the above

### Testing Methodology

For each test, we recommend the following pattern:

```ocaml
let run_test (name : string) (f : unit -> unit) : unit =
  try
    f ();
    Printf.printf "  PASS: %s\n" name
  with
  | Failure msg ->
    Printf.printf "  FAIL: %s\n    Error: %s\n" name msg

let run_negative_test (name : string) (f : unit -> unit) : unit =
  try
    f ();
    Printf.printf "  FAIL: %s (expected error, but succeeded)\n" name
  with
  | Failure _ ->
    Printf.printf "  PASS: %s (correctly rejected)\n" name
```

---

## Grading Rubric

| Problem | Points | Criteria |
|---|---|---|
| 1(a) | 5 | Correct term for ap with explicit motive; computation rule verified by substitution |
| 1(b) | 5 | Correct term for transport with explicit motive; computation rule verified; congruence explained |
| 1(c) | 5 | All three groupoid laws with correct motives; computation rules verified on refl |
| 2(a) | 5 | Correct formalization of all four statements; correct proof terms for provable ones; correct justification for non-provable ones |
| 2(b) | 5 | Complete proof term for AC; clear and correct explanation of constructive vs. classical content |
| 2(c) | 5 | Correct structure for DecEq(Nat) by double induction; all four cases handled |
| 3(a) | 5 | Complete proof of weakening by induction on typing derivation; all rules handled |
| 3(b) | 5 | Complete proof of substitution by induction; key cases (Var, Lam, App, Conv) detailed |
| 3(c) | 5 | Complete proof of subject reduction; beta case uses substitution lemma correctly |
| 3(d) | 5 | Clear explanation of Girard's paradox; correct description of universe hierarchy fix |
| 4 | 10 | Bool type correctly implemented in all functions; 3+ tests including dependent elimination |
| 5 | 10 | Let-bindings with correct definition unfolding; 2+ tests demonstrating dependent unfolding |
| 6 | 10 | Empty type and Absurd correctly implemented; 3+ tests including double negation |
| 7 | 20 | Integration: add normalizes correctly (5), Vec encodes and type-checks (5), Eq proof type-checks (5), negative tests correctly rejected (5) |
| **Total** | **100** | |

---

## Submission Checklist

Before submitting, verify:

**Part A:**

- [ ] All proof terms are written with explicit motives for J and explicit induction motives for Nat-elim.
- [ ] Computation rules are verified by substitution (not just stated).
- [ ] Non-provable statements in Problem 2(a) have clear justifications.
- [ ] The weakening, substitution, and subject reduction proofs in Problem 3 are by induction on the *typing derivation* (not on the structure of the term).
- [ ] Problem 3(d) addresses all four sub-questions about Girard's paradox.

**Part B:**

- [ ] Code compiles without warnings under OCaml 5.x.
- [ ] All test cases pass (both positive and negative).
- [ ] The `README` explains how to build and run the tests.
- [ ] The output of running the tests is included.
- [ ] Each new type former is implemented in *all* relevant functions (eval, quote, conv, check, infer).
- [ ] Eta rules for functions and pairs are preserved from the recitation code.
- [ ] The NatElim case in `infer` correctly constructs the step type.
