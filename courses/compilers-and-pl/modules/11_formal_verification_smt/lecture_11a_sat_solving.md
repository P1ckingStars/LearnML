1# Lecture 11a: SAT Solving -- DPLL & CDCL

## 1. The Boolean Satisfiability Problem

### 1.1 Formal Definition

At its core, SAT asks the simplest possible question about a logical formula: can it ever be true? Despite the apparent simplicity of this question, SAT is the canonical hard problem in computer science, and efficient SAT solving has become one of the most practically impactful achievements in algorithm engineering.

**Definition (SAT).** Given a propositional formula $\varphi$ over Boolean variables $x_1, x_2, \ldots, x_n$, the *Boolean satisfiability problem* (SAT) asks: does there exist an assignment $\sigma : \{x_1, \ldots, x_n\} \to \{0, 1\}$ such that $\sigma \models \varphi$?

A formula is *satisfiable* if such an assignment exists, and *unsatisfiable* otherwise. The set of all satisfying assignments is denoted $\text{SAT}(\varphi)$.

### 1.2 The Cook-Levin Theorem

The Cook-Levin theorem tells us that SAT is the "hardest" problem in NP: if you can solve SAT efficiently, you can solve every problem in NP efficiently. This is why SAT sits at the foundation of computational complexity theory.

**Theorem (Cook 1971, Levin 1973).** SAT is NP-complete.

*Proof sketch.* Two parts are required:

1. **SAT is in NP.** Given a candidate assignment $\sigma$, we can evaluate $\varphi$ under $\sigma$ in polynomial time. Hence a nondeterministic Turing machine can guess $\sigma$ and verify it.

2. **SAT is NP-hard.** Let $L \in \text{NP}$ be decided by a nondeterministic TM $M$ in time $p(n)$. We construct a polynomial-time reduction from $L$ to SAT. For input $w$ of length $n$, we introduce Boolean variables encoding the configuration of $M$ at each of the $p(n)$ time steps:

   - $Q_{t,q}$: at time $t$, $M$ is in state $q$
   - $H_{t,i}$: at time $t$, the head is at position $i$
   - $S_{t,i,a}$: at time $t$, cell $i$ contains symbol $a$

   We then construct a formula $\varphi_M(w)$ that is satisfiable if and only if $M$ accepts $w$. The formula encodes:
   - Initial configuration matches $w$
   - Each step follows the transition function
   - Exactly one state, head position, and symbol per cell at each time
   - Some accepting state is reached

   The reduction is polynomial since there are $O(p(n)^2)$ variables and $O(p(n)^2)$ clauses. $\blacksquare$

**Corollary.** Unless P = NP, there is no polynomial-time algorithm for SAT.

Despite worst-case exponential complexity, modern SAT solvers routinely handle industrial instances with millions of variables. Understanding why is one of the great practical successes of algorithm engineering.

---

## 2. Conjunctive Normal Form and Tseitin Transformation

### 2.1 Conjunctive Normal Form (CNF)

SAT solvers do not work on arbitrary Boolean formulas. Instead, they require the input in a standardized form called CNF, which has a simple recursive structure: it is a conjunction (AND) of clauses, where each clause is a disjunction (OR) of literals. This restriction is not a loss of generality -- any formula can be converted to CNF -- and it enables the efficient data structures and propagation algorithms that make modern SAT solving practical.

**Definition.** A *literal* is a variable $x$ or its negation $\neg x$ (also written $\bar{x}$). A *clause* is a disjunction of literals: $C = l_1 \lor l_2 \lor \cdots \lor l_k$. A formula in *conjunctive normal form* (CNF) is a conjunction of clauses:

$$\varphi = C_1 \land C_2 \land \cdots \land C_m$$

We often represent a CNF formula as a set of clauses, each clause as a set of literals.

**Notation.** A clause $\{x_1, \bar{x}_3, x_5\}$ represents $x_1 \lor \neg x_3 \lor x_5$. The empty clause $\square$ is unsatisfiable. The empty formula (no clauses) is trivially satisfiable.

### 2.2 Tseitin Transformation

The naive approach to converting a formula to CNF -- distributing ORs over ANDs -- can cause an exponential blowup. For example, converting $(x_1 \land y_1) \lor (x_2 \land y_2) \lor \cdots \lor (x_n \land y_n)$ to CNF produces $2^n$ clauses. The Tseitin transformation avoids this by introducing fresh variables that name the results of intermediate subformulas.

Any propositional formula can be converted to an *equisatisfiable* CNF formula in linear time using the Tseitin transformation. Note: "equisatisfiable" is weaker than "equivalent" -- the CNF formula may have additional variables.

**Algorithm.** For a formula $\varphi$ represented as a DAG (directed acyclic graph):

1. Assign a fresh variable $t_g$ to each internal gate $g$.
2. For each gate $g$ with inputs $a, b$ and output $t_g$, add clauses encoding $t_g \leftrightarrow g(a, b)$:

   - AND gate ($t_g \leftrightarrow a \land b$):
     $(\neg t_g \lor a) \land (\neg t_g \lor b) \land (t_g \lor \neg a \lor \neg b)$

   - OR gate ($t_g \leftrightarrow a \lor b$):
     $(t_g \lor \neg a) \land (t_g \lor \neg b) \land (\neg t_g \lor a \lor b)$

   - NOT gate ($t_g \leftrightarrow \neg a$):
     $(t_g \lor a) \land (\neg t_g \lor \neg a)$

3. Add a unit clause $(t_{\text{root}})$ asserting the output is true.

**Theorem.** The Tseitin transformation produces a CNF formula that is equisatisfiable with $\varphi$, has size $O(|\varphi|)$, and can be computed in $O(|\varphi|)$ time.

*Proof.* Each gate introduces at most 4 clauses of constant size. The number of gates is $|\varphi|$. Equisatisfiability follows because any satisfying assignment of $\varphi$ can be extended to satisfy the Tseitin formula by setting each $t_g$ to the value computed at gate $g$. Conversely, any satisfying assignment of the Tseitin formula, when restricted to the original variables, satisfies $\varphi$. $\blacksquare$

### 2.3 Worked Example: Tseitin Transformation

Consider the formula $\varphi = (a \land b) \lor (\neg c)$. We will transform it to CNF step by step.

**Step 1: Build the DAG.** The formula has three gates:

```
        t3 (OR)         <-- root
       /       \
    t1 (AND)   t2 (NOT)
    /    \       |
   a      b     c
```

- Gate $g_1$: AND of $a, b$ -- introduce variable $t_1$
- Gate $g_2$: NOT of $c$ -- introduce variable $t_2$
- Gate $g_3$: OR of $t_1, t_2$ -- introduce variable $t_3$

**Step 2: Generate clauses for each gate.**

Gate $g_1$: $t_1 \leftrightarrow (a \land b)$

$$(\neg t_1 \lor a) \land (\neg t_1 \lor b) \land (t_1 \lor \neg a \lor \neg b)$$

This says: if $t_1$ is true then both $a$ and $b$ must be true, and if both $a$ and $b$ are true then $t_1$ must be true.

Gate $g_2$: $t_2 \leftrightarrow \neg c$

$$(t_2 \lor c) \land (\neg t_2 \lor \neg c)$$

Gate $g_3$: $t_3 \leftrightarrow (t_1 \lor t_2)$

$$(t_3 \lor \neg t_1) \land (t_3 \lor \neg t_2) \land (\neg t_3 \lor t_1 \lor t_2)$$

**Step 3: Assert the root.**

$$(t_3)$$

**Final CNF (8 clauses):**

$$(\neg t_1 \lor a) \land (\neg t_1 \lor b) \land (t_1 \lor \neg a \lor \neg b) \land (t_2 \lor c) \land (\neg t_2 \lor \neg c) \land (t_3 \lor \neg t_1) \land (t_3 \lor \neg t_2) \land (\neg t_3 \lor t_1 \lor t_2) \land (t_3)$$

**Verification.** Consider the satisfying assignment $a = 1, b = 1, c = 1$ for the original formula (since $a \land b = 1$, the OR is satisfied). We can extend this: $t_1 = 1$ (since $a \land b = 1$), $t_2 = 0$ (since $\neg c = 0$), $t_3 = 1$ (since $t_1 \lor t_2 = 1$). Check every clause:
- $(\neg t_1 \lor a) = (0 \lor 1) = 1$, $(\neg t_1 \lor b) = (0 \lor 1) = 1$, $(t_1 \lor \neg a \lor \neg b) = (1 \lor 0 \lor 0) = 1$
- $(t_2 \lor c) = (0 \lor 1) = 1$, $(\neg t_2 \lor \neg c) = (1 \lor 0) = 1$
- $(t_3 \lor \neg t_1) = (1 \lor 0) = 1$, $(t_3 \lor \neg t_2) = (1 \lor 1) = 1$, $(\neg t_3 \lor t_1 \lor t_2) = (0 \lor 1 \lor 0) = 1$
- $(t_3) = 1$

All clauses satisfied. The original formula has 3 variables; the Tseitin CNF has 6 variables but only 8 clauses (linear growth), compared to a naive distribution which would produce $(a \lor \neg c) \land (b \lor \neg c)$ in this simple case -- but the advantage becomes dramatic for deeply nested formulas.

---

## 3. The Resolution Proof System

### 3.1 The Resolution Rule

Resolution is the proof-theoretic engine behind SAT solving. The idea is beautifully simple: if one clause says "either $A$ is true or $x$ is true," and another says "either $B$ is true or $x$ is false," then we can conclude "either $A$ is true or $B$ is true" -- the variable $x$ is eliminated because one of the two cases must hold. This single inference rule is powerful enough to prove any unsatisfiable formula is unsatisfiable.

**Definition (Resolution).** Given two clauses $C_1 = A \lor x$ and $C_2 = B \lor \neg x$, the *resolvent* on $x$ is:

$$\text{Res}(C_1, C_2, x) = A \lor B$$

The variable $x$ is called the *pivot variable*.

**Example.** From $(a \lor b \lor x)$ and $(\neg a \lor \neg x)$, resolving on $x$ yields $(a \lor b \lor \neg a)$, which simplifies to a tautology.

### 3.2 Soundness and Completeness

**Theorem (Soundness of Resolution).** If $C$ is derived from $\varphi$ by resolution, then $\varphi \models C$ (every satisfying assignment of $\varphi$ also satisfies $C$).

*Proof.* Let $\sigma \models \varphi$. Then $\sigma \models C_1$ and $\sigma \models C_2$. If $\sigma(x) = 1$, then $\sigma \models B$ (since $\sigma \models C_2$ and $\sigma(\neg x) = 0$). If $\sigma(x) = 0$, then $\sigma \models A$. In either case, $\sigma \models A \lor B$. $\blacksquare$

**Theorem (Completeness of Resolution -- Robinson 1965).** If a CNF formula $\varphi$ is unsatisfiable, then there exists a resolution derivation of the empty clause $\square$ from $\varphi$.

*Proof.* By induction on the number of variables $n$.

*Base case ($n = 0$):* The only unsatisfiable formula with no variables is $\{\square\}$, which already contains $\square$.

*Inductive step:* Assume completeness for $n-1$ variables. Let $\varphi$ be unsatisfiable over $\{x_1, \ldots, x_n\}$. Consider $\varphi[x_n = 0]$ and $\varphi[x_n = 1]$, the formulas obtained by setting $x_n$ to 0 and 1, respectively. Both are unsatisfiable (over $n-1$ variables). By the induction hypothesis, there exist resolution derivations of $\square$ from each. These derivations can be lifted back to derivations from $\varphi$ of some clauses $C_0$ (containing only positive $x_n$) and $C_1$ (containing only negative $x_n$). Repeated resolution on $x_n$ eventually yields $\square$. $\blacksquare$

### 3.3 Worked Example: Resolution Refutation

To see how resolution proves a formula is unsatisfiable, consider the following small CNF formula over variables $p, q$:

$$\varphi = \{(p), (\neg p \lor q), (\neg p \lor \neg q), (\neg q)\}$$

That is: $p$ must be true (clause 1), if $p$ then $q$ (clause 2), if $p$ then $\neg q$ (clause 3), and $\neg q$ (clause 4). Intuitively, this is contradictory: $p$ forces both $q$ and $\neg q$.

**Derivation:**

1. Resolve clause 1 $(p)$ with clause 3 $(\neg p \lor \neg q)$ on pivot $p$:
   $$\text{Res}((p), (\neg p \lor \neg q), p) = (\neg q) \quad \text{--- clause 5}$$

2. Resolve clause 1 $(p)$ with clause 2 $(\neg p \lor q)$ on pivot $p$:
   $$\text{Res}((p), (\neg p \lor q), p) = (q) \quad \text{--- clause 6}$$

3. Resolve clause 5 $(\neg q)$ with clause 6 $(q)$ on pivot $q$:
   $$\text{Res}((\neg q), (q), q) = \square$$

We have derived the empty clause $\square$, proving that $\varphi$ is unsatisfiable. Each resolution step is sound (preserves all satisfying assignments), and the empty clause has no satisfying assignment, so the original formula has none either.

Note that this derivation is a *tree*: each clause is used at most once along each path. In general, resolution proofs can be *DAGs* where derived clauses are reused. CDCL's clause learning effectively constructs DAG-like resolution proofs, which can be exponentially more compact than tree-like proofs.

---

## 4. The DPLL Algorithm

### 4.1 Overview

The Davis-Putnam-Logemann-Loveland (DPLL) algorithm (Davis & Putnam 1960, Davis et al. 1962) is a systematic backtracking search for SAT. It forms the foundation of all modern SAT solvers.

The key idea is to combine two strategies: (1) make a guess about a variable's value, then (2) propagate the forced consequences of that guess as far as possible before making another guess. When a contradiction is found, backtrack and try the other value. This interleaving of guessing and deduction is far more efficient than naive enumeration.

### 4.2 Key Mechanisms

**Unit Propagation (BCP -- Boolean Constraint Propagation).** If a clause contains a single unassigned literal (all others are falsified), that literal must be set to true. This is called a *unit clause*, and propagating it is forced.

The power of unit propagation lies in its cascading effect: setting one literal true can simplify other clauses, creating new unit clauses, which trigger further propagations. A single decision can lead to a long chain of forced assignments, effectively exploring a large portion of the search space without branching.

**Pure Literal Elimination.** If a variable $x$ appears in only one polarity (all positive or all negative) across all unresolved clauses, set it to make those literals true. (Modern CDCL solvers typically omit this.)

**Splitting (Decision).** Choose an unassigned variable $x$ and a polarity. Branch: try $x = 1$ and $x = 0$.

### 4.3 Pseudocode

```
function DPLL(F, assignment):
    // Unit propagation
    while there exists a unit clause {l} in F:
        assignment := assignment union {l}
        F := simplify(F, l)

    // Contradiction check
    if empty clause in F:
        return UNSAT

    // All clauses satisfied
    if F is empty:
        return SAT(assignment)

    // Pure literal elimination
    for each pure literal l in F:
        assignment := assignment union {l}
        F := simplify(F, l)

    // Decision (splitting)
    choose an unassigned variable x
    if DPLL(simplify(F, x), assignment union {x}) == SAT:
        return SAT
    else:
        return DPLL(simplify(F, ~x), assignment union {~x})

function simplify(F, l):
    // Remove all clauses containing l (they are satisfied)
    // Remove ~l from all remaining clauses
    F' := {}
    for each clause C in F:
        if l in C:
            continue  // clause satisfied
        C' := C \ {~l}
        F' := F' union {C'}
    return F'
```

### 4.4 Worked Example: DPLL Trace

Consider the following CNF formula with 5 variables $\{a, b, c, d, e\}$ and 5 clauses:

$$\varphi = (a \lor b) \land (\neg a \lor c) \land (\neg c \lor d) \land (\neg b \lor \neg d) \land (b \lor e)$$

**Initial state:** No unit clauses, no pure literals. We must make a decision.

**Decision 1: Set $a = 1$.**

Simplify: clause $(a \lor b)$ is satisfied and removed. $\neg a$ is removed from clause 2, turning $(\neg a \lor c)$ into the unit clause $(c)$.

Formula becomes: $(c) \land (\neg c \lor d) \land (\neg b \lor \neg d) \land (b \lor e)$

**Unit propagation: $(c)$ forces $c = 1$.**

Simplify: clause $(c)$ is satisfied and removed. $\neg c$ is removed from clause 3, turning $(\neg c \lor d)$ into the unit clause $(d)$.

Formula becomes: $(d) \land (\neg b \lor \neg d) \land (b \lor e)$

**Unit propagation: $(d)$ forces $d = 1$.**

Simplify: clause $(d)$ is satisfied and removed. $\neg d$ is removed from clause 4, turning $(\neg b \lor \neg d)$ into the unit clause $(\neg b)$.

Formula becomes: $(\neg b) \land (b \lor e)$

**Unit propagation: $(\neg b)$ forces $b = 0$.**

Simplify: clause $(\neg b)$ is satisfied and removed. $b$ is removed from clause 5, turning $(b \lor e)$ into the unit clause $(e)$.

Formula becomes: $(e)$

**Unit propagation: $(e)$ forces $e = 1$.**

Simplify: clause $(e)$ is satisfied and removed.

**Formula is empty -- all clauses satisfied!**

**Result: SAT with assignment** $a = 1, b = 0, c = 1, d = 1, e = 1$.

Notice that a single decision ($a = 1$) triggered a cascade of four forced propagations. This is typical: on structured formulas, unit propagation does most of the work, and the solver rarely needs to backtrack. Now consider what would happen with $a = 0$ instead:

**Alternative -- Decision 1: Set $a = 0$.**

Simplify: $a$ is removed from clause 1, giving unit clause $(b)$. Clause 2 $(\neg a \lor c)$ is satisfied and removed.

Formula becomes: $(b) \land (\neg c \lor d) \land (\neg b \lor \neg d) \land (b \lor e)$

**Unit propagation: $(b)$ forces $b = 1$.**

Simplify: clause $(b)$ and clause $(b \lor e)$ are satisfied. $\neg b$ is removed from clause 4, giving unit clause $(\neg d)$.

Formula becomes: $(\neg c \lor d) \land (\neg d)$

**Unit propagation: $(\neg d)$ forces $d = 0$.**

Simplify: clause $(\neg d)$ is satisfied. $d$ is removed from clause $(\neg c \lor d)$, giving unit clause $(\neg c)$.

Formula becomes: $(\neg c)$

**Unit propagation: $(\neg c)$ forces $c = 0$.**

Formula is empty. **SAT with assignment** $a = 0, b = 1, c = 0, d = 0, e = \text{any}$.

Both branches lead to SAT (the formula is satisfiable), but the key point is how DPLL uses unit propagation to avoid exhaustive search.

### 4.5 Correctness of DPLL

**Theorem.** DPLL is sound and complete.

*Proof of soundness.* If DPLL returns SAT with assignment $\sigma$, then $\sigma$ satisfies $\varphi$. This follows because:
- Unit propagation only performs forced assignments (preserving satisfiability of the simplified formula).
- Pure literal elimination preserves satisfiability (if $\varphi$ is satisfiable, it has a satisfying assignment where the pure literal is true).
- The splitting rule explores all possibilities for variable $x$.
- When $F$ is empty, all clauses have been satisfied. $\blacksquare$

*Proof of completeness.* If $\varphi$ is satisfiable, DPLL returns SAT. If $\varphi$ is unsatisfiable, DPLL returns UNSAT. This follows because:
- The search tree has depth at most $n$ (number of variables) and branching factor 2.
- Every branch terminates: each recursive call has strictly fewer unassigned variables.
- If $\varphi$ is satisfiable, the branch corresponding to a satisfying assignment will be found (unit propagation and pure literal elimination cannot eliminate satisfying assignments). $\blacksquare$

**Theorem.** DPLL terminates in $O(2^n \cdot m)$ time in the worst case, where $n$ is the number of variables and $m$ is the number of clauses.

---

## 5. CDCL: Conflict-Driven Clause Learning

### 5.1 Motivation

DPLL's chronological backtracking is wasteful: when a conflict is discovered deep in the search tree, it backtracks one level, even if the conflict was caused by a decision far above. CDCL, introduced by Marques-Silva and Sakallah (GRASP, ICCAD 1996; journal version 1999) and refined by Moskewicz et al. (2001, Chaff), addresses this with three key innovations:

1. **Clause learning:** Analyze conflicts to derive new clauses that prevent similar conflicts.
2. **Non-chronological backjumping:** Backtrack directly to the decision level responsible for the conflict.
3. **Sophisticated decision heuristics:** Use activity-based branching (VSIDS).

### 5.2 The Implication Graph

The implication graph is the solver's "memory" of why each assignment was made. It records the causal chain from decisions to propagations, and when a conflict occurs, the solver traces backward through this graph to understand what went wrong. This is the key data structure that enables clause learning.

**Definition.** The *implication graph* $G = (V, E)$ is a DAG where:
- Each node represents a literal assignment $l@d$, where $d$ is the *decision level*.
- *Decision nodes* have no incoming edges.
- *Propagation nodes* have incoming edges from the literals that caused the propagation (the other literals in the unit clause that forced this assignment).
- A *conflict node* $\kappa$ is added when a clause becomes empty (all literals falsified).

**Example.** Suppose at decision level 3 we set $x_5 = 1$. This forces $x_7 = 0$ via clause $(\neg x_5 \lor \neg x_7)$, then $x_9 = 1$ via clause $(x_7 \lor x_9 \lor \neg x_2)$ (where $x_2 = 1$ was set at level 1). The implication graph records these dependencies.

### 5.3 Conflict Analysis and Clause Learning

When a conflict occurs, we analyze the implication graph to derive a *learned clause*. The standard method is the **1-UIP (First Unique Implication Point)** scheme.

The intuition behind 1-UIP is this: when we hit a conflict, we want to find the *single most recent assignment* at the current decision level that, together with assignments from earlier levels, was sufficient to cause the conflict. This assignment is the "bottleneck" -- the unique point through which all causal paths from the current decision to the conflict must pass. The learned clause says: "the combination of earlier-level assignments that led to this bottleneck must never occur again."

**Definition.** A *Unique Implication Point* (UIP) at decision level $d$ is a node on every path from the decision at level $d$ to the conflict node. The *first UIP* (1-UIP) is the UIP closest to the conflict.

**Algorithm: 1-UIP Conflict Analysis**

```
function analyzeConflict(conflictClause, decisionLevel):
    // Start with the conflict clause
    learntClause := conflictClause
    numLitsAtCurrentLevel := count literals in learntClause at decisionLevel

    while numLitsAtCurrentLevel > 1:
        // Choose the most recently propagated literal at the current level
        // that appears in learntClause
        l := mostRecentPropagatedLiteral(learntClause, decisionLevel)

        // Resolve learntClause with the antecedent clause of l
        antecedent := getAntecedent(l)
        learntClause := resolve(learntClause, antecedent, var(l))

        numLitsAtCurrentLevel := count literals in learntClause at decisionLevel

    // The backjump level is the second-highest decision level in learntClause
    backjumpLevel := secondHighestDecisionLevel(learntClause)

    return (learntClause, backjumpLevel)
```

**Key insight.** After the loop, `learntClause` contains exactly one literal at `decisionLevel` -- this is the 1-UIP literal. All other literals are at lower decision levels. When we backjump to `backjumpLevel`, the learned clause becomes a unit clause, forcing the 1-UIP literal to be flipped.

### 5.4 Worked Example: 1-UIP Conflict Analysis

Let us trace through a complete conflict analysis on a concrete formula. Consider the following CNF with 6 variables $\{a, b, c, d, e, f\}$ and 5 clauses:

$$C_1 = (a \lor b)$$
$$C_2 = (a \lor \neg b \lor c)$$
$$C_3 = (\neg c \lor d)$$
$$C_4 = (\neg c \lor \neg d \lor e)$$
$$C_5 = (\neg e \lor f)$$
$$C_6 = (\neg e \lor \neg f)$$

**Decision level 1:** Decide $a = 0$ (i.e., assign $\neg a$).

No unit clauses yet.

**Decision level 2:** Decide $b = 0$ (i.e., assign $\neg b$).

Now clause $C_1 = (a \lor b)$ has both literals falsified ($a = 0$ at level 1, $b = 0$ at level 2). Wait -- actually $C_1$ becomes unit *after* the decision. Let us re-examine: after $a = 0$ at level 1, $C_1 = (a \lor b)$ has $a$ falsified, leaving $(b)$. So $b = 1$ is forced at level 1 by unit propagation.

Let us redo this more carefully.

**Decision level 1:** Decide $a = 0$.

- $C_1 = (a \lor b)$: $a$ is falsified, clause becomes unit $(b)$. Propagate $b = 1$ at level 1, with antecedent $C_1$.
- $C_2 = (a \lor \neg b \lor c)$: $a$ is falsified and $\neg b$ is falsified (since $b = 1$), clause becomes unit $(c)$. Propagate $c = 1$ at level 1, with antecedent $C_2$.
- $C_3 = (\neg c \lor d)$: $\neg c$ is falsified (since $c = 1$), clause becomes unit $(d)$. Propagate $d = 1$ at level 1, with antecedent $C_3$.
- $C_4 = (\neg c \lor \neg d \lor e)$: $\neg c$ is falsified, $\neg d$ is falsified, clause becomes unit $(e)$. Propagate $e = 1$ at level 1, with antecedent $C_4$.
- $C_5 = (\neg e \lor f)$: $\neg e$ is falsified, clause becomes unit $(f)$. Propagate $f = 1$ at level 1, with antecedent $C_5$.
- $C_6 = (\neg e \lor \neg f)$: $\neg e$ is falsified and $\neg f$ is falsified. **Conflict!**

**The implication graph at this point:**

```
a=0 @1 (decision)
   |
   +--> b=1 @1  (via C1: a v b)
   |      |
   |      +--> c=1 @1  (via C2: a v ~b v c)
   |             |
   |             +--> d=1 @1  (via C3: ~c v d)
   |             |      |
   |             |      +--> e=1 @1  (via C4: ~c v ~d v e)
   |             |             |
   |             +-----------+ |
   |                         | |
   |                   e=1 @1  |
   |                     |     |
   |                     +--> f=1 @1  (via C5: ~e v f)
   |                     |
   |                     +--> CONFLICT (via C6: ~e v ~f)
   |                               ^
   |                               |
   f=1 @1 -------------------------+
```

More precisely, the conflict node has incoming edges from $e = 1$ and $f = 1$ (both literals in $C_6$ are falsified).

**Conflict analysis (1-UIP):**

The conflict clause is $C_6 = (\neg e \lor \neg f)$, i.e., $\{\neg e, \neg f\}$.

Current decision level: 1. Count literals at level 1: both $\neg e$ and $\neg f$ are at level 1. Count = 2.

**Iteration 1:** The most recently propagated literal at level 1 in the clause is $f$ (propagated after $e$). Its antecedent is $C_5 = (\neg e \lor f)$.

Resolve $\{\neg e, \neg f\}$ with $\{\neg e, f\}$ on variable $f$:

$$\text{Res}((\neg e \lor \neg f), (\neg e \lor f), f) = (\neg e)$$

Learned clause so far: $\{\neg e\}$. Literals at level 1: just $\neg e$. Count = 1. **Stop.**

The 1-UIP literal is $e$ (the clause contains $\neg e$, asserting $e$ must be false). But wait -- all literals are at level 1, and the decision at level 1 is the only decision. The backjump level is the second-highest decision level in the learned clause. Since the learned clause $(\neg e)$ has only one literal at level 1 and no literals at other levels, the backjump level is 0.

This is a conflict at level 0 after backjumping, which means... actually, let us use a slightly richer example that better illustrates non-chronological backjumping. Let us add variables from earlier decision levels.

**Revised example for non-trivial backjumping:**

Consider the formula:

$$C_1 = (\neg a \lor b)$$
$$C_2 = (\neg a \lor c)$$
$$C_3 = (\neg b \lor \neg c \lor d)$$
$$C_4 = (\neg b \lor \neg c \lor \neg d)$$
$$C_5 = (a \lor e)$$
$$C_6 = (a \lor \neg e)$$

**Decision level 1:** Decide $a = 1$.

- $C_1$: $\neg a$ falsified, becomes unit $(b)$. Propagate $b = 1$, antecedent $C_1$.
- $C_2$: $\neg a$ falsified, becomes unit $(c)$. Propagate $c = 1$, antecedent $C_2$.
- $C_3 = (\neg b \lor \neg c \lor d)$: $\neg b$ falsified, $\neg c$ falsified, becomes unit $(d)$. Propagate $d = 1$, antecedent $C_3$.
- $C_4 = (\neg b \lor \neg c \lor \neg d)$: $\neg b$ falsified, $\neg c$ falsified, $\neg d$ falsified. **Conflict!**

**Implication graph:**

```
a=1 @1 (decision)
   |
   +--> b=1 @1  (via C1)
   |      |
   |      +--> d=1 @1  (via C3, also needs c=1)
   |      |      |
   +--> c=1 @1  (via C2)
          |      |
          +------+--> CONFLICT (via C4: ~b v ~c v ~d)
          |             ^
          +-------------+
```

The conflict clause is $C_4 = (\neg b \lor \neg c \lor \neg d)$, i.e., $\{\neg b, \neg c, \neg d\}$. All three literals are at decision level 1.

**Iteration 1:** Most recently propagated at level 1 in the clause: $d$. Antecedent of $d$ is $C_3 = (\neg b \lor \neg c \lor d)$.

Resolve $\{\neg b, \neg c, \neg d\}$ with $\{\neg b, \neg c, d\}$ on $d$:

$$\{\neg b, \neg c\}$$

Literals at level 1: $\neg b$ and $\neg c$. Count = 2.

**Iteration 2:** Most recently propagated at level 1: say $c$ was propagated after $b$. Antecedent of $c$ is $C_2 = (\neg a \lor c)$.

Resolve $\{\neg b, \neg c\}$ with $\{\neg a, c\}$ on $c$:

$$\{\neg b, \neg a\}$$

Literals at level 1: $\neg b$ (at level 1), $\neg a$ (at level 1 -- it was the decision). Count = 2.

**Iteration 3:** Most recently propagated: $b$ (propagated at level 1). Antecedent of $b$ is $C_1 = (\neg a \lor b)$.

Resolve $\{\neg b, \neg a\}$ with $\{\neg a, b\}$ on $b$:

$$\{\neg a\}$$

Literals at level 1: just $\neg a$. Count = 1. **Stop.**

**Learned clause:** $(\neg a)$, i.e., $a$ must be false. The 1-UIP is $a$ itself (the decision variable). Backjump level = 0 (no other literals in the clause).

**Backjump to level 0.** Undo $a = 1, b = 1, c = 1, d = 1$. Add learned clause $(\neg a)$ to the database. At level 0, this is a unit clause forcing $a = 0$.

After propagating $a = 0$:

- $C_5 = (a \lor e)$: $a$ falsified, unit clause $(e)$. Propagate $e = 1$.
- $C_6 = (a \lor \neg e)$: $a$ falsified, $\neg e$ falsified. **Conflict at level 0 -- UNSAT!**

The formula is unsatisfiable. The learned clause $(\neg a)$ told us $a = 1$ leads to contradiction. Setting $a = 0$ also leads to contradiction (from $C_5, C_6$). Therefore no satisfying assignment exists.

Now let us show a richer example where backjumping skips levels. Consider a scenario where earlier decisions at multiple levels feed into a conflict:

**Decision level 1:** Decide $x_1 = 1$. No propagations.

**Decision level 2:** Decide $x_2 = 0$. No propagations.

**Decision level 3:** Decide $x_3 = 1$. No propagations.

**Decision level 4:** Decide $x_4 = 0$.

Suppose unit propagation at level 4 derives $x_5 = 1$ via clause $C_a = (x_4 \lor x_5)$, then $x_6 = 1$ via clause $C_b = (\neg x_5 \lor \neg x_1 \lor x_6)$, then a conflict on clause $C_c = (\neg x_5 \lor \neg x_6 \lor x_2)$ (all falsified since $x_5 = 1$, $x_6 = 1$, $x_2 = 0$).

**Conflict analysis:**

Conflict clause: $C_c = \{\neg x_5, \neg x_6, x_2\}$.

Literals at level 4: $\neg x_5$ (level 4), $\neg x_6$ (level 4). $x_2$ is at level 2. Count at level 4 = 2.

Resolve with antecedent of $x_6$ ($C_b = \{\neg x_5, \neg x_1, x_6\}$) on $x_6$:

$$\{\neg x_5, x_2, \neg x_1\}$$

Literals at level 4: $\neg x_5$. Count = 1. **Stop.**

Learned clause: $(\neg x_5 \lor x_2 \lor \neg x_1)$.

Decision levels: $x_5$ at level 4, $x_2$ at level 2, $x_1$ at level 1. Backjump level = max of non-current levels = level 2.

**Backjump from level 4 to level 2**, skipping level 3 entirely. The decision at level 3 ($x_3 = 1$) was irrelevant to the conflict. At level 2, the learned clause $(\neg x_5 \lor x_2 \lor \neg x_1)$ becomes unit (since $x_2 = 0$ and $x_1 = 1$), forcing $x_5 = 0$.

This is the power of non-chronological backjumping: DPLL would have backtracked to level 3, tried $x_3 = 0$, and re-discovered the same conflict.

### 5.5 Non-Chronological Backjumping

After learning clause $C$ with backjump level $d'$:

1. Undo all assignments at decision levels $> d'$.
2. Add $C$ to the clause database.
3. Propagate: $C$ is now a unit clause at level $d'$, forcing the negation of the 1-UIP literal.

This can skip many decision levels, dramatically pruning the search space.

### 5.6 Full CDCL Pseudocode

```
function CDCL(F):
    assignment := {}
    decisionLevel := 0
    clauseDB := F

    // Initial unit propagation
    if BCP(clauseDB, assignment) == CONFLICT:
        return UNSAT

    while not allVariablesAssigned(assignment):
        // Decision
        decisionLevel := decisionLevel + 1
        l := pickBranchingLiteral()    // e.g., VSIDS
        assignment := assign(l, decisionLevel)

        // Boolean Constraint Propagation
        while BCP(clauseDB, assignment) == CONFLICT:
            if decisionLevel == 0:
                return UNSAT

            // Conflict analysis
            (learntClause, backjumpLevel) := analyzeConflict(...)

            // Learn clause
            clauseDB := clauseDB union {learntClause}

            // Backjump
            undoAssignments(assignment, backjumpLevel)
            decisionLevel := backjumpLevel

            // The learned clause is now unit; BCP will propagate it

        // Optionally restart
        if restartCondition():
            undoAssignments(assignment, 0)
            decisionLevel := 0

    return SAT(assignment)
```

### 5.7 Why CDCL Works in Practice

At first glance, it may be surprising that CDCL can solve industrial instances with millions of variables -- instances that have $2^{1000000}$ possible assignments. No amount of clever pruning can enumerate a meaningful fraction of that space. The secret is that CDCL's components work together synergistically in a way that transcends simple search:

**Clause learning turns conflicts into knowledge.** Each conflict produces a learned clause that is a logical consequence of the original formula. This clause is a compact summary of a dead-end: "this combination of assignments will always fail." The solver never makes the same mistake twice. Over time, the learned clause database becomes a refined model of the formula's structure.

**Non-chronological backjumping focuses on root causes.** When a conflict occurs, the solver identifies *which decisions actually caused it* via the implication graph, and jumps back to the relevant decision level. In contrast, DPLL's chronological backtracking would waste time flipping irrelevant decisions that had nothing to do with the conflict.

**VSIDS identifies the "hot" variables.** Activity-based heuristics ensure that the solver focuses its decisions on variables that appear in recent conflicts -- these are the variables participating in the "hard core" of the formula at the current stage of search. As clauses are learned and the hard core shifts, VSIDS adapts.

**Restarts escape heavy tails without losing progress.** The runtime distribution for SAT solving has heavy tails: some unlucky decision orderings lead to exponentially longer searches. Restarts let the solver "re-roll the dice" on decision ordering. Crucially, learned clauses are retained across restarts, so no information is lost. The combination of restarts + clause learning means the solver gets the benefit of randomization (escaping bad branches) without the cost (losing work).

**The synergy.** These components amplify each other. VSIDS guides the solver toward the hard part of the formula. Conflicts in the hard part produce high-quality learned clauses. These clauses simplify future search. Restarts let the solver re-approach the simplified formula with fresh decisions. The result is that on structured formulas (which arise in practice from hardware verification, software analysis, planning, etc.), the solver effectively discovers and exploits the formula's underlying structure, achieving runtimes that are nearly linear in practice despite worst-case exponential complexity.

This is why CDCL dominates on industrial instances but struggles on random instances near the phase transition: random instances have no structure to exploit.

### 5.8 Why CDCL Is Complete

**Theorem.** CDCL is a sound and complete decision procedure for SAT.

*Proof.*

*Soundness:* If CDCL returns SAT, the assignment satisfies all original clauses (BCP never found a conflict with the final assignment, and learned clauses are implied by the original formula). If CDCL returns UNSAT, it means a conflict was derived at decision level 0, meaning BCP alone (with learned clauses) derives a contradiction, which by soundness of resolution means the original formula is unsatisfiable.

*Completeness (termination):* CDCL terminates because:
1. Every learned clause is a non-trivial resolvent not already in the clause database (up to subsumption).
2. There are finitely many clauses over $n$ variables (at most $3^n$ distinct clauses).
3. Therefore, eventually either a satisfying assignment is found, or enough clauses are learned to derive a conflict at level 0.

More precisely, learned clauses correspond to resolution proofs. Since the resolution proof system is complete (Robinson 1965), if the formula is unsatisfiable, CDCL will eventually derive $\square$ through its sequence of learned clauses. $\blacksquare$

**Theorem (Pipatsrisawat & Darwiche 2011).** CDCL with 1-UIP learning and restarts can polynomially simulate general resolution.

This is a remarkable result: it means CDCL is as powerful as the full resolution proof system, and for formulas with short resolution proofs, CDCL can find them efficiently.

---

## 6. Decision Heuristics

### 6.1 VSIDS (Variable State Independent Decaying Sum)

The choice of which variable to branch on has a dramatic effect on solver performance -- a good heuristic can mean the difference between solving a problem in seconds versus timing out. VSIDS is the dominant decision heuristic because it tracks which variables are involved in recent conflicts, effectively letting the solver focus on the "hard part" of the formula as it changes during search.

Introduced in Chaff (Moskewicz et al. 2001), VSIDS works as follows:

1. Maintain an *activity score* $\text{act}(x)$ for each variable $x$.
2. When a clause is learned, increment $\text{act}(x)$ for every variable $x$ appearing in the learned clause.
3. Periodically (or after each conflict), multiply all activities by a decay factor $\delta < 1$ (typically $\delta = 0.95$).
4. Choose the unassigned variable with highest activity.

**Implementation trick (MiniSat).** Instead of decaying all scores, maintain a global increment value $\Delta$. After each conflict, set $\Delta := \Delta / \delta$. When bumping a variable, add $\Delta$ to its score. This achieves the same relative ordering without touching all variables.

**Intuition.** VSIDS focuses on variables involved in recent conflicts. These are the variables participating in the "hard part" of the formula. The exponential decay ensures that variables from old conflicts fade, adapting to the current state of the search.

### 6.2 Worked Example: VSIDS Activity Scores

Consider variables $\{a, b, c, d, e\}$, all starting with activity score 0. Decay factor $\delta = 0.5$ (exaggerated for clarity; real solvers use $\delta \approx 0.95$). The increment starts at $\Delta = 1.0$.

**Conflict 1:** Learned clause $(\neg a \lor b \lor \neg c)$. Bump $a$, $b$, $c$.

| Variable | $a$ | $b$ | $c$ | $d$ | $e$ |
|---|---|---|---|---|---|
| Score | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 |

Now decay: multiply all scores by $\delta = 0.5$. Equivalently, set $\Delta := \Delta / \delta = 1.0 / 0.5 = 2.0$.

Effective scores (relative to $\Delta = 2.0$): $a = 1.0$, $b = 1.0$, $c = 1.0$, $d = 0$, $e = 0$.

**Conflict 2:** Learned clause $(\neg b \lor d)$. Bump $b$ and $d$, each by $\Delta = 2.0$.

| Variable | $a$ | $b$ | $c$ | $d$ | $e$ |
|---|---|---|---|---|---|
| Raw score | 1.0 | 3.0 | 1.0 | 2.0 | 0.0 |

Set $\Delta := 2.0 / 0.5 = 4.0$.

**Conflict 3:** Learned clause $(c \lor \neg d \lor e)$. Bump $c$, $d$, $e$ by $\Delta = 4.0$.

| Variable | $a$ | $b$ | $c$ | $d$ | $e$ |
|---|---|---|---|---|---|
| Raw score | 1.0 | 3.0 | 5.0 | 6.0 | 4.0 |

Set $\Delta := 4.0 / 0.5 = 8.0$.

**Current ranking:** $d$ (6.0) > $c$ (5.0) > $e$ (4.0) > $b$ (3.0) > $a$ (1.0).

Notice how $a$ appeared only in the first conflict and has "faded" to the bottom. Variable $d$, which appeared in the two most recent conflicts, has risen to the top. The solver will branch on $d$ next, focusing on the most recently contentious variable.

With a realistic decay factor of $\delta = 0.95$, the decay is gentler: a variable's score halves after about 14 conflicts ($0.95^{14} \approx 0.49$). This means the solver has a "memory" of roughly the last 20-30 conflicts.

### 6.3 Phase Saving

Introduced by Pipatsrisawat and Darwiche (2007):

- When a variable $x$ is unassigned during backjumping, record its last assigned polarity.
- When $x$ is next chosen as a decision variable, assign it its saved polarity.
- This heuristic preserves partial solutions and significantly reduces search effort.

---

## 7. Restart Strategies

Restarts undo all assignments and restart the search from scratch, retaining all learned clauses. This combats heavy-tail behavior: the time to solve a SAT instance has a heavy-tailed distribution, and restarts allow the solver to escape unproductive branches.

### 7.1 Luby Sequence

The Luby restart strategy uses a unit-optimal restart sequence $1, 1, 2, 1, 1, 2, 4, 1, 1, 2, 1, 1, 2, 4, 8, \ldots$

**Definition.** The Luby sequence $\{t_i\}$ is defined as:

$$t_i = \begin{cases} 2^{k-1} & \text{if } i = 2^k - 1 \\ t_{i - 2^{k-1} + 1} & \text{if } 2^{k-1} \le i < 2^k - 1 \end{cases}$$

**Theorem (Luby, Sinclair, Zuckerman 1993).** For a class of randomized algorithms with unknown runtime distribution, the Luby sequence is an optimal universal restart strategy (up to a logarithmic factor).

### 7.2 Geometric Restarts

The geometric strategy restarts after $c \cdot g^k$ conflicts for the $k$-th restart, where $c$ is an initial constant and $g > 1$ is a growth factor. Glucose and many modern solvers use variants based on the *Literal Block Distance* (LBD) of learned clauses.

---

## 8. Watched Literals

### 8.1 The Two-Watched-Literal Scheme

Efficient unit propagation is critical since it dominates solver runtime. The two-watched-literal scheme (Chaff, Moskewicz et al. 2001) avoids scanning the entire clause database after each assignment.

The core insight is lazy evaluation: instead of tracking the full state of every clause (how many literals are falsified, which are still unassigned), we only track two "sentinel" literals per clause. A clause can only become unit or conflicting when it has at most one non-false literal, so as long as at least two non-false literals exist, we do not need to examine the clause at all. By watching exactly two non-false literals, we ensure we are notified only when the clause might need attention.

**Invariant.** For each clause, maintain pointers to two *watched literals* that are not currently falsified.

**Key properties:**
- A clause can only become unit or conflicting when one of its watched literals is falsified.
- When a watched literal $l$ is falsified, scan the clause for a replacement:
  - If another non-false, non-watched literal $l'$ exists, swap: watch $l'$ instead of $l$.
  - If no replacement exists and the other watched literal is unassigned, the clause is unit -- propagate.
  - If no replacement exists and the other watched literal is false, the clause is conflicting.

**Advantages:**
- Backtracking requires no updates to watch lists (the invariant is maintained lazily).
- Satisfied clauses are never visited (only falsified watched literals trigger scans).
- Average-case performance is excellent: most clauses have many non-false literals, so replacements are found quickly.

### 8.2 Worked Example: Watched Literals in Action

Consider the clause $C = (a \lor b \lor c \lor d)$ with initial watched literals $a$ and $b$ (marked with brackets below).

**Initial state:**

```
Clause C:  [a]  [b]  c  d       (watches: a, b)
Watch list of a: {..., C, ...}
Watch list of b: {..., C, ...}
Assignment: {}
```

Each literal has a *watch list*: the set of clauses watching it. When a literal is falsified, we iterate through its watch list.

**Step 1: Assign $c = 0, d = 0$ (from other clauses).**

Nothing happens to $C$. Neither $c$ nor $d$ is watched, so the solver does not even look at clause $C$. This is the key efficiency: falsifying non-watched literals is free.

```
Clause C:  [a]  [b]  c=0  d=0   (watches: a, b)
```

**Step 2: Assign $a = 0$ (falsify watched literal $a$).**

The solver is notified via $a$'s watch list. It scans clause $C$ for a replacement for $a$:
- Other watched literal: $b$ (still unassigned -- good, not false).
- Scan remaining literals: $c$ is false, $d$ is false.
- No non-false replacement found.
- Other watched literal $b$ is unassigned, so $C$ is now a **unit clause**. Propagate $b = 1$.

```
Clause C:  a=0  [b=1]  c=0  d=0  (watches: b, -- )
                                   Unit propagation: b = 1
```

**Alternative Step 2: Suppose instead we assign $b = 0$ (falsify watched literal $b$).**

The solver scans clause $C$ for a replacement for $b$:
- Check $c$: false. Skip.
- Check $d$: false. Skip.
- No replacement found. Other watched literal $a$ is unassigned.
- $C$ is unit. Propagate $a = 1$.

**Alternative Step 2 (different scenario): Suppose $c$ and $d$ are unassigned, and we assign $a = 0$.**

The solver scans for a replacement for $a$:
- Check $c$: unassigned. Found a replacement!
- Replace $a$ with $c$ in the watch.

```
Before:  [a]  [b]  c  d     Watch lists: a -> {...,C,...}, b -> {...,C,...}
After:    a=0 [b]  [c] d     Watch lists: a -> {...}, b -> {...,C,...}, c -> {...,C,...}
```

The clause is removed from $a$'s watch list and added to $c$'s watch list. The clause still has two non-false watched literals, so no propagation occurs.

**Why backtracking is free:** If we later undo $a = 0$ (backtrack), we do NOT need to undo the watch update. The invariant is that watched literals are not false, and after unassigning $a$, both $c$ and $b$ remain valid watches (they are either true or unassigned). The lazy invariant remains satisfied.

---

## 9. Preprocessing and Inprocessing

### 9.1 Subsumption

A clause $C$ *subsumes* $D$ if $C \subseteq D$. If $C$ subsumes $D$, then $D$ is redundant and can be removed.

### 9.2 Self-Subsuming Resolution

If resolving $C$ and $D$ on pivot $x$ produces a clause $C'$ that subsumes $D$, then $D$ can be replaced by $C'$, a shorter clause.

### 9.3 Bounded Variable Elimination (BVE)

For a variable $x$, let $S^+$ be all clauses containing $x$ and $S^-$ all clauses containing $\neg x$. Resolving all pairs and removing the original clauses eliminates $x$. This is beneficial when the number of resolvents is smaller than $|S^+| + |S^-|$.

**Heuristic.** Eliminate variable $x$ if $|S^+| \cdot |S^-| - |S^+| - |S^-| \le 0$ (the number of new clauses minus removed clauses is non-positive).

### 9.4 Inprocessing

Modern solvers apply preprocessing techniques *during* search (between restarts). SatELite (Een & Biere 2005) and CaDiCaL (Biere 2019) demonstrate the effectiveness of inprocessing.

---

## 10. SAT Solver Architecture: MiniSat

MiniSat (Een & Sorensson 2003) is a minimalist yet competitive SAT solver that serves as a reference implementation. Its architecture:

1. **Data structures:** Clause database with two-watched-literal scheme. Variables stored in a priority queue (activity-based).
2. **Propagation:** BCP using watched literals. Maintains a propagation queue.
3. **Conflict analysis:** 1-UIP scheme with on-the-fly clause minimization.
4. **Learning:** Learned clause database with periodic cleanup. Clauses with low LBD (Literal Block Distance) are retained.
5. **Decisions:** VSIDS with exponential decay.
6. **Restarts:** Geometric or Luby-based.
7. **Simplification:** Subsumption and variable elimination on restarts.

MiniSat's codebase is approximately 2000 lines of C++, making it ideal for study. Competition-winning solvers (Glucose, CaDiCaL, Kissat) build on this foundation with refinements in clause management, restart policies, and inprocessing.

---

## 11. Encoding Problems as SAT

### 11.1 Graph Coloring

Given graph $G = (V, E)$ and $k$ colors, introduce variables $x_{v,c}$ (vertex $v$ gets color $c$).

**Clauses:**
- At-least-one: $\bigvee_{c=1}^{k} x_{v,c}$ for each $v \in V$
- At-most-one (pairwise): $\neg x_{v,c} \lor \neg x_{v,c'}$ for each $v, c \ne c'$
- Edge constraint: $\neg x_{u,c} \lor \neg x_{v,c}$ for each $(u,v) \in E, c \in [k]$

### 11.2 Bounded Model Checking

Given a transition system $(I, T, P)$ with initial states $I$, transition relation $T$, and property $P$, check if there is a counterexample of length $\le k$:

$$\varphi_k = I(s_0) \land \bigwedge_{i=0}^{k-1} T(s_i, s_{i+1}) \land \bigvee_{i=0}^{k} \neg P(s_i)$$

If satisfiable, the model gives a concrete counterexample trace. This encoding connects SAT solving directly to hardware and software verification.

### 11.3 Scheduling

Variables $x_{j,t}$ encode "job $j$ starts at time $t$". Clauses encode:
- Each job starts exactly once.
- Precedence constraints: if $j_1$ must precede $j_2$, then $x_{j_1,t} \implies \bigvee_{t' > t + d_{j_1}} x_{j_2,t'}$.
- Resource constraints: at most $R$ jobs active at any time $t$.

---

## 12. Phase Transitions in Random SAT

### 12.1 Random $k$-SAT

A random $k$-SAT instance with $n$ variables and $m$ clauses is generated by choosing each clause uniformly at random (each of $k$ literals chosen independently).

**Definition.** The *clause-to-variable ratio* is $\alpha = m / n$.

**Empirical observation (Mitchell, Selman, Levesque 1992).** For random 3-SAT, there is a sharp phase transition at $\alpha \approx 4.267$:
- For $\alpha < 4.267$: almost all instances are satisfiable.
- For $\alpha > 4.267$: almost all instances are unsatisfiable.
- Near $\alpha \approx 4.267$: instances are hardest for all known algorithms.

**Theorem (Friedgut 1999).** For random $k$-SAT, the satisfiability threshold $\alpha_k$ exists: for every $\varepsilon > 0$,

$$\lim_{n \to \infty} \Pr[\varphi \text{ is SAT}] = \begin{cases} 1 & \text{if } \alpha < \alpha_k - \varepsilon \\ 0 & \text{if } \alpha > \alpha_k + \varepsilon \end{cases}$$

The exact threshold for $k \ge 3$ remains one of the major open problems in computational complexity, though Ding, Sly, and Sun (2015) proved the threshold conjecture for large $k$.

### 12.2 Implications for Solver Design

The hardness peak at the phase transition motivates:
- Random SAT benchmarks for testing solvers at their limits.
- Structured/industrial instances, which have very different characteristics (often far from the phase transition but with other sources of difficulty such as community structure).
- The empirical observation that CDCL excels on industrial instances but struggles on random hard instances near the threshold.

---

## 13. Summary

| Feature | DPLL | CDCL |
|---|---|---|
| Backtracking | Chronological | Non-chronological (backjumping) |
| Learning | None | Clause learning (1-UIP) |
| Decisions | Basic heuristics | VSIDS / activity-based |
| Restarts | None | Luby / geometric / adaptive |
| Propagation | Naive | Two-watched-literal scheme |
| Proof system | Tree-like resolution | General resolution |

CDCL represents a paradigm shift: by learning from failures and jumping over irrelevant parts of the search space, it transforms SAT solving from a brute-force search into an intelligent, adaptive algorithm. The combination of clause learning, VSIDS, restarts, and watched literals enables modern solvers to handle formulas with millions of variables arising from hardware verification, planning, and compiler optimization.

---

## References

1. Davis, M. & Putnam, H. (1960). "A computing procedure for quantification theory." *Journal of the ACM*, 7(3), 201-215.
2. Davis, M., Logemann, G. & Loveland, D. (1962). "A machine program for theorem-proving." *Communications of the ACM*, 5(7), 394-397.
3. Robinson, J.A. (1965). "A machine-oriented logic based on the resolution principle." *Journal of the ACM*, 12(1), 23-41.
4. Cook, S.A. (1971). "The complexity of theorem-proving procedures." *STOC*, 151-158.
5. Marques-Silva, J.P. & Sakallah, K.A. (1996). "GRASP -- a new search algorithm for satisfiability." *ICCAD*, 220-227. Journal version: *IEEE Transactions on Computers*, 48(5), 506-521, 1999.
6. Moskewicz, M.W. et al. (2001). "Chaff: Engineering an efficient SAT solver." *DAC*, 530-535.
7. Een, N. & Sorensson, N. (2003). "An extensible SAT-solver." *SAT 2003*, LNCS 2919, 502-518.
8. Luby, M., Sinclair, A. & Zuckerman, D. (1993). "Optimal speedup of Las Vegas algorithms." *Information Processing Letters*, 47(4), 173-180.
9. Mitchell, D., Selman, B. & Levesque, H. (1992). "Hard and easy distributions of SAT problems." *AAAI*, 459-465.
10. Pipatsrisawat, K. & Darwiche, A. (2011). "On the power of clause-learning SAT solvers as resolution engines." *Artificial Intelligence*, 175(2), 512-525.
13. Pipatsrisawat, K. & Darwiche, A. (2007). "A lightweight component caching scheme for satisfiability solvers." *SAT 2007*, LNCS 4501, 294-299.
11. Friedgut, E. (1999). "Sharp thresholds of graph properties and the $k$-SAT problem." *Journal of the AMS*, 12(4), 1017-1054.
12. Biere, A., Heule, M., van Maaren, H. & Walsh, T. (2009). *Handbook of Satisfiability*. IOS Press.
