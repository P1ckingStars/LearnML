# Lecture 04d: Denotational & Axiomatic Semantics

## 1. Introduction

While operational semantics describes *how* programs execute, **denotational semantics** describes *what* programs mean as mathematical objects, and **axiomatic semantics** describes *what properties* programs satisfy. Together with operational semantics, these three approaches form the semantic foundations of programming languages.

| Approach | Central Question | Key Idea |
|----------|-----------------|----------|
| Operational | How does the program execute? | Transition rules |
| Denotational | What mathematical object does the program denote? | Compositional mapping to domains |
| Axiomatic | What can we prove about the program? | Pre/postconditions, invariants |

---

## 2. Denotational Semantics

### 2.1 The Idea

**Denotational semantics** assigns to each program phrase a mathematical object (its **denotation**) in a way that is **compositional**: the denotation of a compound phrase is determined by the denotations of its subphrases.

**Definition 2.1 (Compositionality).** A semantic function $[\![ \cdot ]\!]$ is compositional if for every syntactic constructor $C$:

$$[\![ C(e_1, \ldots, e_n) ]\!] = f_C([\![ e_1 ]\!], \ldots, [\![ e_n ]\!])$$

for some mathematical function $f_C$.

### 2.2 Denotations of a Simple Expression Language

For an arithmetic expression language:

$$[\![ n ]\!] = n \in \mathbb{Z}$$
$$[\![ e_1 + e_2 ]\!] = [\![ e_1 ]\!] + [\![ e_2 ]\!]$$
$$[\![ e_1 \times e_2 ]\!] = [\![ e_1 ]\!] \times [\![ e_2 ]\!]$$

With variables and an environment $\rho : \text{Var} \to \mathbb{Z}$:

$$[\![ x ]\!]\rho = \rho(x)$$
$$[\![ e_1 + e_2 ]\!]\rho = [\![ e_1 ]\!]\rho + [\![ e_2 ]\!]\rho$$

### 2.3 Functions and the Lambda Calculus

For the simply-typed lambda calculus:

$$[\![ x ]\!]\rho = \rho(x)$$
$$[\![ \lambda x:\tau.\; e ]\!]\rho = d \mapsto [\![ e ]\!]\rho[x \mapsto d]$$
$$[\![ e_1\; e_2 ]\!]\rho = [\![ e_1 ]\!]\rho\;([\![ e_2 ]\!]\rho)$$

A lambda abstraction denotes a mathematical function; application denotes function application.

---

## 3. Scott Domains and Fixed-Point Semantics

### 3.1 The Problem of Recursion

For a recursive definition like:

```
let rec f = fun x -> if x = 0 then 1 else x * f(x-1)
```

The denotation of $f$ must satisfy $[\![ f ]\!] = F([\![ f ]\!])$ where $F$ is the "one-step unfolding" functional. We need a mathematical framework where such fixed-point equations have solutions.

### 3.2 Partial Orders and CPOs

**Definition 3.1 (Partial Order).** A **partial order** (poset) is a set $D$ with a relation $\sqsubseteq$ that is reflexive, antisymmetric, and transitive.

**Definition 3.2 (Directed Set).** A subset $S \subseteq D$ is **directed** if every finite subset of $S$ has an upper bound in $S$. In particular, $S$ is nonempty.

**Definition 3.3 (CPO).** A **complete partial order** (CPO) is a partial order $(D, \sqsubseteq)$ with a least element $\bot$ such that every directed set $S$ has a least upper bound $\bigsqcup S$.

**Definition 3.4 (Continuous Function).** A function $f : D \to E$ between CPOs is **continuous** if it preserves least upper bounds of directed sets:

$$f\left(\bigsqcup S\right) = \bigsqcup \{f(d) \mid d \in S\}$$

Every continuous function is monotone: $d_1 \sqsubseteq d_2 \Rightarrow f(d_1) \sqsubseteq f(d_2)$.

### 3.3 The Fixed-Point Theorem

**Theorem 3.1 (Kleene's Fixed-Point Theorem).** Let $D$ be a CPO with least element $\bot$, and let $f : D \to D$ be a continuous function. Then $f$ has a least fixed point:

$$\text{fix}(f) = \bigsqcup_{n \geq 0} f^n(\bot)$$

*Proof.*

**Step 1:** Show the chain $\bot \sqsubseteq f(\bot) \sqsubseteq f^2(\bot) \sqsubseteq \cdots$ is ascending.

By induction. Base: $\bot \sqsubseteq f(\bot)$ since $\bot$ is the least element. Inductive step: if $f^n(\bot) \sqsubseteq f^{n+1}(\bot)$, then by monotonicity of $f$, $f^{n+1}(\bot) \sqsubseteq f^{n+2}(\bot)$.

**Step 2:** The chain is directed, so $d = \bigsqcup_{n \geq 0} f^n(\bot)$ exists.

**Step 3:** Show $d$ is a fixed point: $f(d) = d$.

$$f(d) = f\left(\bigsqcup_{n \geq 0} f^n(\bot)\right) = \bigsqcup_{n \geq 0} f^{n+1}(\bot) = \bigsqcup_{n \geq 1} f^n(\bot) = \bigsqcup_{n \geq 0} f^n(\bot) = d$$

The second equality uses continuity. The fourth equality holds because adding $\bot = f^0(\bot)$ to the set does not change the LUB (since $\bot$ is below all elements).

**Step 4:** Show $d$ is the *least* fixed point. If $f(e) = e$, we show $f^n(\bot) \sqsubseteq e$ for all $n$ by induction. Base: $\bot \sqsubseteq e$. Step: $f^{n+1}(\bot) = f(f^n(\bot)) \sqsubseteq f(e) = e$. Therefore $d = \bigsqcup f^n(\bot) \sqsubseteq e$. $\square$

### 3.4 Application to Recursive Functions

The denotation of a recursive function `let rec f = F(f)` is:

$$[\![ f ]\!] = \text{fix}(\lambda g.\; [\![ F ]\!]\rho[f \mapsto g])$$

The iteration starts from the totally undefined function $\bot$ (maps every input to $\bot$) and repeatedly applies the defining equation:

$$f_0 = \bot, \quad f_1 = F(f_0), \quad f_2 = F(f_1), \quad \ldots$$

Each $f_n$ is defined on "more" inputs than $f_{n-1}$, and the limit gives the full recursive function.

**Example:** Factorial.

$$F = \lambda g.\; \lambda n.\; \texttt{if}\; n = 0\; \texttt{then}\; 1\; \texttt{else}\; n \times g(n-1)$$

- $f_0 = \bot$ (undefined everywhere)
- $f_1 = F(\bot) = \lambda n.\; \texttt{if}\; n = 0\; \texttt{then}\; 1\; \texttt{else}\; \bot$
  - Defined only for $n = 0$: $f_1(0) = 1$.
- $f_2 = F(f_1) = \lambda n.\; \texttt{if}\; n = 0\; \texttt{then}\; 1\; \texttt{else}\; n \times f_1(n-1)$
  - Defined for $n = 0, 1$: $f_2(1) = 1 \times f_1(0) = 1$.
- $f_n$ is defined for inputs $0, 1, \ldots, n-1$.
- $\text{fix}(F) = \bigsqcup f_n = \text{factorial}$.

### 3.5 Scott Domains

**Definition 3.5 (Scott Domain).** A **Scott domain** is a consistently complete, algebraic CPO. Key examples:

- **Flat domains:** $D_\bot = D \cup \{\bot\}$ where all elements of $D$ are incomparable and above $\bot$. Used for base types: $\mathbb{Z}_\bot$, $\mathbb{B}_\bot$.

- **Function spaces:** $[D \to E]$ is the set of continuous functions from $D$ to $E$, ordered pointwise: $f \sqsubseteq g \iff \forall d \in D.\; f(d) \sqsubseteq g(d)$.

- **Product domains:** $D_1 \times D_2$ with componentwise ordering.

- **Sum domains:** $D_1 + D_2$ with separated sum.

### 3.6 Adequacy

A denotational semantics is **adequate** with respect to an operational semantics if:

$$[\![ e ]\!] = [\![ v ]\!] \implies e \Downarrow v$$

and conversely. This ensures the mathematical model faithfully represents computation.

**Full abstraction** (a stronger property): $[\![ e_1 ]\!] = [\![ e_2 ]\!]$ if and only if $e_1$ and $e_2$ are observationally equivalent (indistinguishable in all program contexts).

---

## 4. Axiomatic Semantics: Hoare Logic

### 4.1 Motivation

**Axiomatic semantics** specifies program behavior through logical assertions about program states, without describing the execution mechanism. The primary framework is **Hoare logic** (Hoare, 1969).

### 4.2 Hoare Triples

A **Hoare triple** has the form:

$$\{P\}\; S\; \{Q\}$$

where:
- $P$ is the **precondition** (assertion about the state before execution),
- $S$ is a program (statement/command),
- $Q$ is the **postcondition** (assertion about the state after execution).

**Meaning (partial correctness):** If $P$ holds before executing $S$, and if $S$ terminates, then $Q$ holds after execution.

**Total correctness** additionally requires that $S$ terminates when $P$ holds:

$$[P]\; S\; [Q]$$

### 4.3 Hoare Logic Rules

**Assignment:**

$$\frac{}{\{Q[x \mapsto e]\}\; x := e\; \{Q\}} \quad (\text{H-Assign})$$

This is the **backward** assignment rule. $Q[x \mapsto e]$ denotes $Q$ with all free occurrences of $x$ replaced by $e$.

**Example:** To establish $\{?\}\; x := x + 1\; \{x > 5\}$, compute $Q[x \mapsto x+1] = (x+1 > 5) = (x > 4)$. So $\{x > 4\}\; x := x+1\; \{x > 5\}$.

**Sequential Composition:**

$$\frac{\{P\}\; S_1\; \{R\} \quad \{R\}\; S_2\; \{Q\}}{\{P\}\; S_1;\; S_2\; \{Q\}} \quad (\text{H-Seq})$$

**Conditional:**

$$\frac{\{P \wedge b\}\; S_1\; \{Q\} \quad \{P \wedge \neg b\}\; S_2\; \{Q\}}{\{P\}\; \texttt{if}\; b\; \texttt{then}\; S_1\; \texttt{else}\; S_2\; \{Q\}} \quad (\text{H-If})$$

**While Loop:**

$$\frac{\{P \wedge b\}\; S\; \{P\}}{\{P\}\; \texttt{while}\; b\; \texttt{do}\; S\; \{P \wedge \neg b\}} \quad (\text{H-While})$$

Here $P$ is the **loop invariant**: an assertion that holds before and after every iteration.

**Consequence (Strengthening/Weakening):**

$$\frac{P' \Rightarrow P \quad \{P\}\; S\; \{Q\} \quad Q \Rightarrow Q'}{\{P'\}\; S\; \{Q'\}} \quad (\text{H-Conseq})$$

### 4.4 Example: Division Algorithm

Prove: $\{x \geq 0 \wedge y > 0\}\; \texttt{div}(x, y)\; \{x = q \cdot y + r \wedge 0 \leq r < y\}$

```
q := 0;
r := x;
while r >= y do
    r := r - y;
    q := q + 1
```

**Loop invariant:** $P \equiv x = q \cdot y + r \wedge r \geq 0$

**Proof:**

1. **Initialization:** After `q := 0; r := x`:
   - $x = 0 \cdot y + x \wedge x \geq 0$ holds by precondition. So $P$ holds.

2. **Maintenance:** Assume $P \wedge (r \geq y)$. After `r := r - y; q := q + 1`:
   - New $q' = q + 1$, new $r' = r - y$.
   - $x = q \cdot y + r = (q+1) \cdot y + (r - y) = q' \cdot y + r'$. Check.
   - $r' = r - y \geq 0$ since $r \geq y$. Check.
   - So $P$ holds with new values.

3. **Termination:** When the loop exits, $P \wedge \neg(r \geq y)$, i.e., $x = q \cdot y + r \wedge r \geq 0 \wedge r < y$. This is exactly the postcondition.

**Formal derivation tree:**

$$\frac{
  \frac{
    \{x = q \cdot y + r \wedge r \geq 0 \wedge r \geq y\}\; r := r - y;\; q := q + 1\; \{x = q \cdot y + r \wedge r \geq 0\}
  }{
    \{x = q \cdot y + r \wedge r \geq 0\}\; \texttt{while}\; r \geq y\; \texttt{do}\; \ldots\; \{x = q \cdot y + r \wedge r \geq 0 \wedge r < y\}
  }
}{\text{H-While}}$$

---

## 5. Weakest Precondition Calculus

### 5.1 Definition

**Definition 5.1 (Weakest Precondition).** The **weakest precondition** $\text{wp}(S, Q)$ is the weakest assertion $P$ such that $\{P\}\; S\; \{Q\}$ holds:

$$\text{wp}(S, Q) = \text{the largest } P \text{ such that } \{P\}\; S\; \{Q\}$$

Equivalently, $\text{wp}(S, Q)$ characterizes exactly the set of initial states from which execution of $S$ is guaranteed to terminate in a state satisfying $Q$.

### 5.2 Dijkstra's Predicate Transformer Rules

Dijkstra (1975) gave a calculus for computing weakest preconditions:

**Assignment:**

$$\text{wp}(x := e, Q) = Q[x \mapsto e]$$

**Sequence:**

$$\text{wp}(S_1;\; S_2, Q) = \text{wp}(S_1, \text{wp}(S_2, Q))$$

**Conditional:**

$$\text{wp}(\texttt{if}\; b\; \texttt{then}\; S_1\; \texttt{else}\; S_2, Q) = (b \Rightarrow \text{wp}(S_1, Q)) \wedge (\neg b \Rightarrow \text{wp}(S_2, Q))$$

**While loop (total correctness):**

$$\text{wp}(\texttt{while}\; b\; \texttt{do}\; S, Q) \text{ requires finding an invariant and a variant (termination measure).}$$

For total correctness of loops, we need:
1. An invariant $I$ with $I \wedge \neg b \Rightarrow Q$.
2. A **variant** (ranking function) $V : \text{State} \to \mathbb{N}$ such that $I \wedge b \Rightarrow V > 0$ and $\{I \wedge b \wedge V = v_0\}\; S\; \{I \wedge V < v_0\}$.

### 5.3 Example

Compute $\text{wp}(x := x + 1;\; y := x \times 2, y > 10)$.

Working backward:

$$\text{wp}(y := x \times 2, y > 10) = (x \times 2 > 10) = (x > 5)$$

$$\text{wp}(x := x + 1, x > 5) = (x + 1 > 5) = (x > 4)$$

So $\text{wp}(x := x + 1;\; y := x \times 2, y > 10) = (x > 4)$.

---

## 6. Soundness and Completeness

### 6.1 Soundness

**Theorem 6.1 (Soundness of Hoare Logic).** If $\vdash \{P\}\; S\; \{Q\}$ is derivable in Hoare logic, then for every state $\sigma$ satisfying $P$, if execution of $S$ starting in $\sigma$ terminates in state $\sigma'$, then $\sigma'$ satisfies $Q$.

*Proof sketch.* By induction on the derivation. Each rule is shown to preserve the partial correctness interpretation:

- **H-Assign:** If $\sigma \models Q[x \mapsto e]$ and $\sigma' = \sigma[x \mapsto [\![ e ]\!]\sigma]$, then $\sigma' \models Q$. This follows from the substitution: $\sigma' \models Q$ iff $\sigma \models Q[x \mapsto e]$.

- **H-Seq:** By IH on both premises and transitivity.

- **H-While:** By induction on the number of loop iterations $n$. The invariant $P$ holds at the start of each iteration (by the loop body's Hoare triple) and at the end (with $\neg b$). $\square$

### 6.2 Relative Completeness

**Theorem 6.2 (Cook, 1978).** Hoare logic is **relatively complete**: if $\{P\}\; S\; \{Q\}$ is true (in the standard interpretation), then it is derivable in Hoare logic, provided we have an oracle for the underlying first-order arithmetic.

The "relative" qualifier is necessary because first-order arithmetic is itself incomplete (Godel's incompleteness theorem). The completeness is relative to the ability to decide the side conditions (logical implications) in the consequence rule.

*Proof sketch.* Cook showed that for any statement $S$ and postcondition $Q$, the weakest precondition $\text{wp}(S, Q)$ is expressible in the assertion language (assuming it is expressive enough---the **expressive** assumption). Then:
1. $\text{wp}(S, Q)$ can be computed syntactically.
2. $\{P\}\; S\; \{Q\}$ is true iff $P \Rightarrow \text{wp}(S, Q)$.
3. Using the consequence rule with this implication yields the derivation. $\square$

---

## 7. Separation Logic

### 7.1 Motivation

Hoare logic does not handle **heap-manipulating programs** well. Assertions about pointers and dynamic memory require reasoning about aliasing, which is notoriously difficult.

**Separation logic** (Reynolds, 2002; O'Hearn, 2001) extends Hoare logic with spatial connectives:

### 7.2 Key Connectives

- $\text{emp}$: The heap is empty.
- $e_1 \mapsto e_2$: The heap contains exactly one cell at address $e_1$ with value $e_2$.
- $P * Q$ (**separating conjunction**): The heap can be split into two disjoint parts, one satisfying $P$ and the other satisfying $Q$.
- $P \mathbin{-\!\!*} Q$ (**separating implication** / magic wand): If the heap is extended with a disjoint part satisfying $P$, the result satisfies $Q$.

### 7.3 The Frame Rule

The key innovation of separation logic is the **frame rule**:

$$\frac{\{P\}\; S\; \{Q\}}{\{P * R\}\; S\; \{Q * R\}} \quad (\text{H-Frame})$$

provided $S$ does not modify variables free in $R$.

This rule says: if $S$ operates on the portion of the heap described by $P$, then a disjoint portion described by $R$ is unaffected. This enables **local reasoning** about heap operations.

### 7.4 Example

```
// Swap via temporary pointer
{x |-> a * y |-> b}
t := *x;
*x := *y;
*y := t;
{x |-> b * y |-> a}
```

The separating conjunction $x \mapsto a * y \mapsto b$ asserts that $x$ and $y$ point to *disjoint* heap cells---ruling out aliasing.

---

## 8. Connections Between Semantic Approaches

### 8.1 Soundness of Denotational with Respect to Operational

**Theorem 8.1 (Adequacy).** For a well-defined denotational semantics $[\![ \cdot ]\!]$ and operational semantics $\Downarrow$:

$$[\![ e ]\!]\rho \neq \bot \iff \exists v.\; \rho \vdash e \Downarrow v \text{ and } [\![ e ]\!]\rho = [\![ v ]\!]$$

### 8.2 Relating Axiomatic and Denotational

Hoare triples can be given denotational semantics. Define:

$$\models \{P\}\; S\; \{Q\} \iff \forall \sigma.\; \sigma \models P \implies [\![ S ]\!]\sigma \neq \bot \implies [\![ S ]\!]\sigma \models Q$$

Soundness of Hoare logic then reduces to proving each rule preserves this semantic validity.

---

## 9. Summary

| Semantic Approach | Defines | Key Tool | Strength |
|-------------------|---------|----------|----------|
| Operational | How programs run | Transition rules | Executable, implementation-close |
| Denotational | What programs mean | Domains, fixed points | Compositional, mathematical |
| Axiomatic | What programs guarantee | Hoare triples, invariants | Verification, correctness proofs |

| Denotational Key Concepts | |
|---------------------------|---|
| CPO | Complete partial order with $\bot$ |
| Continuous function | Preserves directed LUBs |
| Least fixed point | $\bigsqcup f^n(\bot)$ |
| Adequacy | Denotational matches operational |

| Axiomatic Key Concepts | |
|------------------------|---|
| Hoare triple $\{P\}\;S\;\{Q\}$ | Partial correctness specification |
| Loop invariant | Preserved by each iteration |
| Weakest precondition | Most general valid precondition |
| Separation logic | Spatial reasoning about the heap |

---

## References

1. Scott, D.S. & Strachey, C. (1971). "Toward a Mathematical Semantics for Computer Languages." *Proceedings of the Symposium on Computers and Automata*, Polytechnic Institute of Brooklyn, 19--46.
2. Scott, D.S. (1976). "Data Types as Lattices." *SIAM Journal on Computing*, 5(3), 522--587.
3. Hoare, C.A.R. (1969). "An Axiomatic Basis for Computer Programming." *Communications of the ACM*, 12(10), 576--580.
4. Dijkstra, E.W. (1975). "Guarded Commands, Nondeterminacy and Formal Derivation of Programs." *Communications of the ACM*, 18(8), 453--457.
5. Cook, S.A. (1978). "Soundness and Completeness of an Axiom System for Program Verification." *SIAM Journal on Computing*, 7(1), 70--90.
6. Reynolds, J.C. (2002). "Separation Logic: A Logic for Shared Mutable Data Structures." *LICS*, 55--74.
7. O'Hearn, P.W., Reynolds, J.C., & Yang, H. (2001). "Local Reasoning about Programs that Alter Data Structures." *CSL*, LNCS 2142, 1--19.
8. Winskel, G. (1993). *The Formal Semantics of Programming Languages: An Introduction*. MIT Press.
9. Stoy, J.E. (1977). *Denotational Semantics: The Scott-Strachey Approach to Programming Language Theory*. MIT Press.
