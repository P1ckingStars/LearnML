# Lecture 04b: Operational Semantics

## 1. Introduction

**Operational semantics** defines the meaning of programs by specifying how they execute, step by step. Unlike denotational semantics (which maps programs to mathematical objects) or axiomatic semantics (which characterizes programs by their input-output properties), operational semantics describes computation as a sequence of state transitions.

There are two main styles:
- **Big-step (natural) semantics:** Relates an expression directly to its final value.
- **Small-step (structural operational) semantics:** Specifies individual computation steps.

---

## 2. The Language: IMP + Expressions

We define a small imperative language with expressions to illustrate both styles.

### 2.1 Syntax

**Expressions:**

$$e ::= n \mid b \mid x \mid e_1 \oplus e_2 \mid \texttt{if}\; e_1\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \mid \lambda x:\tau.\; e \mid e_1\; e_2 \mid \texttt{let}\; x = e_1\; \texttt{in}\; e_2$$

**Values:**

$$v ::= n \mid b \mid \lambda x:\tau.\; e$$

Values are expressions that are fully evaluated---they are the "answers" of computation.

---

## 3. Big-Step (Natural) Semantics

### 3.1 Judgment Form

The big-step judgment is:

$$e \Downarrow v$$

Read: "Expression $e$ evaluates to value $v$."

In the presence of an environment (for variables):

$$\sigma \vdash e \Downarrow v$$

where $\sigma$ is a mapping from variables to values.

### 3.2 Rules

**Values evaluate to themselves:**

$$\frac{}{\sigma \vdash v \Downarrow v} \quad (\text{B-Val})$$

**Variable lookup:**

$$\frac{x \mapsto v \in \sigma}{\sigma \vdash x \Downarrow v} \quad (\text{B-Var})$$

**Arithmetic:**

$$\frac{\sigma \vdash e_1 \Downarrow n_1 \quad \sigma \vdash e_2 \Downarrow n_2 \quad n_3 = n_1 + n_2}{\sigma \vdash e_1 + e_2 \Downarrow n_3} \quad (\text{B-Add})$$

**Conditional:**

$$\frac{\sigma \vdash e_1 \Downarrow \texttt{true} \quad \sigma \vdash e_2 \Downarrow v}{\sigma \vdash \texttt{if}\; e_1\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \Downarrow v} \quad (\text{B-IfTrue})$$

$$\frac{\sigma \vdash e_1 \Downarrow \texttt{false} \quad \sigma \vdash e_3 \Downarrow v}{\sigma \vdash \texttt{if}\; e_1\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \Downarrow v} \quad (\text{B-IfFalse})$$

**Function application (call-by-value):**

$$\frac{\sigma \vdash e_1 \Downarrow \lambda x:\tau.\; e \quad \sigma \vdash e_2 \Downarrow v_2 \quad \sigma[x \mapsto v_2] \vdash e \Downarrow v}{\sigma \vdash e_1\; e_2 \Downarrow v} \quad (\text{B-App})$$

**Let binding:**

$$\frac{\sigma \vdash e_1 \Downarrow v_1 \quad \sigma[x \mapsto v_1] \vdash e_2 \Downarrow v_2}{\sigma \vdash \texttt{let}\; x = e_1\; \texttt{in}\; e_2 \Downarrow v_2} \quad (\text{B-Let})$$

### 3.3 Properties of Big-Step Semantics

**Advantages:**
- Intuitive and concise.
- Directly corresponds to recursive interpreters.
- Natural for denotational-style reasoning.

**Disadvantages:**
- Cannot distinguish "stuck" (type error) from "divergent" (infinite loop): both result in no derivation.
- Harder to reason about intermediate states.
- Does not naturally model concurrency or interleaving.

---

## 4. Small-Step (Structural Operational) Semantics

### 4.1 Judgment Form

The small-step judgment is:

$$e \to e'$$

Read: "Expression $e$ takes one step to $e'$."

The reflexive transitive closure $\to^*$ denotes zero or more steps.

### 4.2 Rules

**Beta-reduction (call-by-value):**

$$\frac{}{(\lambda x:\tau.\; e)\; v \to [x \mapsto v]e} \quad (\text{E-AppAbs})$$

**Evaluate the function first:**

$$\frac{e_1 \to e_1'}{e_1\; e_2 \to e_1'\; e_2} \quad (\text{E-App1})$$

**Then evaluate the argument:**

$$\frac{e_2 \to e_2'}{v_1\; e_2 \to v_1\; e_2'} \quad (\text{E-App2})$$

**Arithmetic:**

$$\frac{}{n_1 + n_2 \to n_3} \quad \text{where } n_3 = n_1 + n_2 \quad (\text{E-AddNum})$$

$$\frac{e_1 \to e_1'}{e_1 + e_2 \to e_1' + e_2} \quad (\text{E-Add1})$$

$$\frac{e_2 \to e_2'}{v_1 + e_2 \to v_1 + e_2'} \quad (\text{E-Add2})$$

**Conditional:**

$$\frac{}{\texttt{if}\; \texttt{true}\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \to e_2} \quad (\text{E-IfTrue})$$

$$\frac{}{\texttt{if}\; \texttt{false}\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \to e_3} \quad (\text{E-IfFalse})$$

$$\frac{e_1 \to e_1'}{\texttt{if}\; e_1\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \to \texttt{if}\; e_1'\; \texttt{then}\; e_2\; \texttt{else}\; e_3} \quad (\text{E-If})$$

**Let binding:**

$$\frac{}{\texttt{let}\; x = v\; \texttt{in}\; e \to [x \mapsto v]e} \quad (\text{E-LetVal})$$

$$\frac{e_1 \to e_1'}{\texttt{let}\; x = e_1\; \texttt{in}\; e_2 \to \texttt{let}\; x = e_1'\; \texttt{in}\; e_2} \quad (\text{E-Let})$$

### 4.3 Stuck Terms

A **stuck term** is a closed term that is neither a value nor can take a step. For example:

$$\texttt{true} + 1 \quad \text{(stuck: no rule applies)}$$

$$42\; \texttt{true} \quad \text{(stuck: 42 is not a function)}$$

Stuck terms represent runtime type errors. The goal of a type system is to rule them out statically.

---

## 5. Evaluation Contexts

### 5.1 Definition

An **evaluation context** $E$ is a term with a single "hole" $[\cdot]$ indicating where the next reduction should occur:

$$E ::= [\cdot] \mid E\; e \mid v\; E \mid E + e \mid v + E \mid \texttt{if}\; E\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \mid \texttt{let}\; x = E\; \texttt{in}\; e$$

### 5.2 Context-Based Reduction

The small-step rules can be reformulated using contexts. Define a **notion of reduction** (the basic computation steps):

$$(\lambda x:\tau.\; e)\; v \rightsquigarrow [x \mapsto v]e$$
$$n_1 + n_2 \rightsquigarrow n_3 \quad (\text{where } n_3 = n_1 + n_2)$$
$$\texttt{if}\; \texttt{true}\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \rightsquigarrow e_2$$
$$\texttt{if}\; \texttt{false}\; \texttt{then}\; e_2\; \texttt{else}\; e_3 \rightsquigarrow e_3$$

Then the single evaluation rule is:

$$\frac{e \rightsquigarrow e'}{E[e] \to E[e']} \quad (\text{E-Context})$$

**Theorem 5.1 (Unique Decomposition).** For every non-value closed term $e$ that is not stuck, there exists a unique evaluation context $E$ and redex $r$ such that $e = E[r]$.

*Proof.* By structural induction on $e$, following the left-to-right, outermost-first evaluation order enforced by the grammar of evaluation contexts. The key is that at each application or binary operation, the context grammar specifies that the left operand is evaluated first (as $E\; e$), and only when it is a value do we evaluate the right operand ($v\; E$). $\square$

This ensures **determinism** of evaluation.

### 5.3 Advantages of Evaluation Contexts

- Separate the "search" for the next redex from the "reduction" step.
- Make the evaluation order explicit in the grammar.
- Enable concise formulation of reduction semantics.
- Widely used in the PL theory community (Felleisen & Hieb, 1992).

---

## 6. Type Safety: Progress and Preservation

### 6.1 The Central Theorem

**Theorem 6.1 (Type Safety).** If $\vdash e : \tau$ (i.e., $e$ is well-typed in the empty context), then evaluation of $e$ does not get stuck.

Type safety is established by proving two lemmas:

### 6.2 Progress

**Theorem 6.2 (Progress).** If $\vdash e : \tau$, then either $e$ is a value or there exists $e'$ such that $e \to e'$.

*Proof.* By induction on the typing derivation $\vdash e : \tau$.

**Case T-Var:** Impossible, since $e = x$ but $x$ is not in the empty context.

**Case T-Int:** $e = n$ is a value. Done.

**Case T-Bool:** $e = b$ is a value. Done.

**Case T-Abs:** $e = \lambda x:\tau_1.\; e'$ is a value. Done.

**Case T-App:** $e = e_1\; e_2$ with $\vdash e_1 : \tau_1 \to \tau_2$ and $\vdash e_2 : \tau_1$.

By induction on $e_1$:
- If $e_1$ is not a value, then $e_1 \to e_1'$ by IH, so $e_1\; e_2 \to e_1'\; e_2$ by E-App1.
- If $e_1$ is a value: by the **canonical forms lemma** (below), since $e_1 : \tau_1 \to \tau_2$ and $e_1$ is a value, $e_1 = \lambda x:\tau_1.\; e'$.
  - If $e_2$ is not a value, then $e_2 \to e_2'$ by IH, so $e_1\; e_2 \to e_1\; e_2'$ by E-App2.
  - If $e_2$ is a value $v_2$, then $(\lambda x:\tau_1.\; e')\; v_2 \to [x \mapsto v_2]e'$ by E-AppAbs.

**Case T-Add:** Similar, using canonical forms for $\texttt{int}$.

**Case T-If:** $e = \texttt{if}\; e_1\; \texttt{then}\; e_2\; \texttt{else}\; e_3$ with $\vdash e_1 : \texttt{bool}$.

By IH on $e_1$: either $e_1$ steps (use E-If) or $e_1$ is a value. By canonical forms for $\texttt{bool}$, $e_1 \in \{\texttt{true}, \texttt{false}\}$, and E-IfTrue or E-IfFalse applies. $\square$

**Lemma 6.1 (Canonical Forms).**
1. If $\vdash v : \texttt{int}$ and $v$ is a value, then $v$ is a numeric literal.
2. If $\vdash v : \texttt{bool}$ and $v$ is a value, then $v \in \{\texttt{true}, \texttt{false}\}$.
3. If $\vdash v : \tau_1 \to \tau_2$ and $v$ is a value, then $v = \lambda x:\tau_1.\; e$ for some $e$.

*Proof.* By inspection of the value forms and the typing rules. $\square$

### 6.3 Preservation (Subject Reduction)

**Theorem 6.3 (Preservation).** If $\Gamma \vdash e : \tau$ and $e \to e'$, then $\Gamma \vdash e' : \tau$.

*Proof.* By induction on the derivation of $e \to e'$, with case analysis on the reduction rule used.

**Case E-AppAbs:** $e = (\lambda x:\tau_1.\; e_0)\; v_2 \to [x \mapsto v_2]e_0 = e'$.

From the typing derivation:
- $\Gamma \vdash \lambda x:\tau_1.\; e_0 : \tau_1 \to \tau_2$, which gives $\Gamma, x:\tau_1 \vdash e_0 : \tau_2$ (by inverting T-Abs).
- $\Gamma \vdash v_2 : \tau_1$.

By the **Substitution Lemma** (below): $\Gamma \vdash [x \mapsto v_2]e_0 : \tau_2$.

**Case E-App1:** $e = e_1\; e_2 \to e_1'\; e_2$ where $e_1 \to e_1'$.

By inversion: $\Gamma \vdash e_1 : \tau_1 \to \tau_2$ and $\Gamma \vdash e_2 : \tau_1$.
By IH: $\Gamma \vdash e_1' : \tau_1 \to \tau_2$.
By T-App: $\Gamma \vdash e_1'\; e_2 : \tau_2$.

Other cases are similar. $\square$

**Lemma 6.2 (Substitution).** If $\Gamma, x:\sigma \vdash e : \tau$ and $\Gamma \vdash v : \sigma$, then $\Gamma \vdash [x \mapsto v]e : \tau$.

*Proof.* By induction on the derivation of $\Gamma, x:\sigma \vdash e : \tau$. The key cases:

- $e = x$: then $\tau = \sigma$ and $[x \mapsto v]x = v$. By assumption $\Gamma \vdash v : \sigma = \tau$.
- $e = y \neq x$: then $[x \mapsto v]y = y$ and $\Gamma \vdash y : \tau$ follows from weakening (since $y : \tau \in \Gamma$).
- $e = \lambda y:\tau_1.\; e_0$ (where $y \neq x$, $y \notin \text{FV}(v)$ by alpha-convention): by IH on the body. $\square$

### 6.4 Putting It Together

**Corollary (Type Safety).** If $\vdash e : \tau$ and $e \to^* e'$ where $e'$ is in normal form, then $e'$ is a value.

*Proof.* By induction on the number of steps in $e \to^* e'$. Preservation ensures the type is maintained at each step. Progress ensures that if $e'$ is well-typed and not a value, it can take a step---contradicting normal form. $\square$

---

## 7. Determinism of Evaluation

**Theorem 7.1 (Determinism).** If $e \to e_1$ and $e \to e_2$, then $e_1 = e_2$.

*Proof.* By induction on the derivation of $e \to e_1$, with case analysis.

The proof relies on the evaluation context grammar ensuring that at most one rule applies to each expression form. For example, in $e_1\; e_2$:
- If $e_1$ is not a value, only E-App1 applies.
- If $e_1$ is a value and $e_2$ is not, only E-App2 applies.
- If both are values, only E-AppAbs applies.

No two rules overlap for the same syntactic configuration. $\square$

---

## 8. Equivalence of Big-Step and Small-Step

**Theorem 8.1.** For closed expressions: $e \Downarrow v$ if and only if $e \to^* v$ where $v$ is a value.

*Proof.*

($\Rightarrow$) By induction on the derivation of $e \Downarrow v$.

Case B-Val: $v \Downarrow v$ and $v \to^* v$ (zero steps). $\checkmark$

Case B-App: $e_1\; e_2 \Downarrow v$ where $e_1 \Downarrow \lambda x.\; e$, $e_2 \Downarrow v_2$, $[x \mapsto v_2]e \Downarrow v$.

By IH: $e_1 \to^* \lambda x.\; e$, $e_2 \to^* v_2$, $[x \mapsto v_2]e \to^* v$.

Then: $e_1\; e_2 \to^* (\lambda x.\; e)\; e_2 \to^* (\lambda x.\; e)\; v_2 \to [x \mapsto v_2]e \to^* v$.

($\Leftarrow$) By induction on the number of steps in $e \to^* v$, using a "head expansion" lemma: if $e \to e'$ and $e' \Downarrow v$, then $e \Downarrow v$. $\square$

---

## 9. Extending the Framework

### 9.1 Adding State

For mutable references, the judgment becomes:

$$\langle e, \mu \rangle \to \langle e', \mu' \rangle$$

where $\mu$ is a store (memory) mapping locations to values.

$$\frac{}{\langle \texttt{ref}\; v, \mu \rangle \to \langle l, \mu[l \mapsto v] \rangle} \quad l \notin \text{dom}(\mu) \quad (\text{E-RefV})$$

$$\frac{}{\langle \;!l, \mu \rangle \to \langle \mu(l), \mu \rangle} \quad (\text{E-DerefLoc})$$

$$\frac{}{\langle l := v, \mu \rangle \to \langle \texttt{unit}, \mu[l \mapsto v] \rangle} \quad (\text{E-Assign})$$

Preservation now requires a **store typing** $\Sigma$ that tracks the types of locations:

$$\Gamma \mid \Sigma \vdash e : \tau$$

### 9.2 Adding Exceptions

$$\frac{e_1 \to e_1'}{\texttt{try}\; e_1\; \texttt{with}\; x \Rightarrow e_2 \to \texttt{try}\; e_1'\; \texttt{with}\; x \Rightarrow e_2} \quad (\text{E-Try})$$

$$\frac{}{\texttt{try}\; v\; \texttt{with}\; x \Rightarrow e_2 \to v} \quad (\text{E-TryV})$$

$$\frac{}{\texttt{try}\; (\texttt{raise}\; v)\; \texttt{with}\; x \Rightarrow e_2 \to [x \mapsto v]e_2} \quad (\text{E-TryRaise})$$

Exceptions propagate through evaluation contexts:

$$\frac{}{E[\texttt{raise}\; v] \to \texttt{raise}\; v} \quad E \neq [\cdot] \quad (\text{E-Propagate})$$

---

## 10. Abstract Machines

### 10.1 The CEK Machine

The **CEK machine** (Felleisen & Friedman, 1986) is an abstract machine for call-by-value lambda calculus:

- **C**: Control (current expression)
- **E**: Environment (variable bindings)
- **K**: Continuation (what to do next)

States: $\langle e, \rho, \kappa \rangle$

```
Continuations:
    kappa ::= halt
            | arg(e, rho, kappa)    -- evaluate argument next
            | fun(v, kappa)         -- apply function to result

Transitions:
    <x, rho, kappa>                     ==> <v, rho', kappa>
        where rho(x) = (v, rho')

    <lambda x. e, rho, kappa>           ==> <lambda x. e, rho, kappa>
        (closure is a value)

    <e1 e2, rho, kappa>                 ==> <e1, rho, arg(e2, rho, kappa)>
        (evaluate function first)

    <v, rho, arg(e, rho', kappa)>       ==> <e, rho', fun(v, kappa)>
        (function is a value; evaluate argument)

    <v, rho, fun(closure(x, e, rho'), kappa)> ==> <e, rho'[x -> v], kappa>
        (both are values; apply)
```

### 10.2 Correspondence

**Theorem 10.1.** The CEK machine correctly implements call-by-value small-step semantics: $e \to^* v$ iff $\langle e, \emptyset, \texttt{halt} \rangle \Rightarrow^* \langle v, \rho, \texttt{halt} \rangle$.

---

## 11. Summary

| Concept | Description |
|---------|-------------|
| Big-step semantics | $e \Downarrow v$: direct evaluation to final value |
| Small-step semantics | $e \to e'$: single computation step |
| Evaluation contexts | Grammar-based control of reduction order |
| Progress | Well-typed, non-value terms can step |
| Preservation | Reduction preserves typing |
| Type safety | Progress + Preservation |
| Determinism | At most one step from any state |
| Abstract machines | CEK, SECD: mechanized evaluation |

---

## References

1. Plotkin, G.D. (1981). "A Structural Approach to Operational Semantics." Tech Report DAIMI FN-19, Aarhus University.
2. Wright, A.K. & Felleisen, M. (1994). "A Syntactic Approach to Type Soundness." *Information and Computation*, 115(1), 38--94.
3. Felleisen, M. & Hieb, R. (1992). "The Revised Report on the Syntactic Theories of Sequential Control and State." *Theoretical Computer Science*, 103(2), 235--271.
4. Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press, Chapters 3, 8, 9, 13.
5. Harper, R. (2016). *Practical Foundations for Programming Languages* (2nd ed.). Cambridge, Chapters 5--7.
6. Felleisen, M. & Friedman, D.P. (1986). "Control Operators, the SECD-Machine, and the Lambda-Calculus." *Formal Description of Programming Concepts III*, 193--217.
