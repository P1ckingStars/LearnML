# Lecture 11b: SMT Solving -- DPLL(T) & Decision Procedures

## 0. How to Think About SMT

Before diving into the machinery, it helps to understand the central architectural insight behind SMT solving.

A SAT solver is extraordinarily good at one thing: exploring the Boolean structure of a formula -- finding which combination of true/false assignments to variables can satisfy a propositional formula. But many verification problems involve constraints over integers, real numbers, arrays, functions, and other rich domains that SAT alone cannot handle.

The naive approach would be to build a monolithic solver that understands both Boolean connectives and arithmetic simultaneously. SMT takes a different, more powerful path: **separate the Boolean structure from the theory-specific reasoning**. The SAT solver handles the "shape" of the formula (conjunctions, disjunctions, negations), while specialized *theory solvers* handle domain-specific questions like "can $x + 1 = y$ and $y - 1 = z$ and $x \neq z$ all hold simultaneously?"

This separation is powerful for three reasons:

1. **Modularity.** Each theory solver can be developed, optimized, and proved correct independently. A world-class Simplex implementation for linear arithmetic does not need to know anything about congruence closure for uninterpreted functions.

2. **Reuse of SAT technology.** Decades of engineering in CDCL solvers -- VSIDS heuristics, clause learning, restarts, watched literals -- are inherited for free. The SAT solver does what it does best (combinatorial search), and the theory solver does what *it* does best (domain reasoning).

3. **Composability.** The Nelson-Oppen framework lets us combine theory solvers for different domains, so a formula mixing arithmetic and uninterpreted functions can be handled by plugging together existing solvers rather than building a new one from scratch.

The interaction pattern is simple: the SAT solver proposes a candidate assignment, the theory solver either confirms it or says "no, and here is why" (returning a conflict clause). The SAT solver then uses that conflict clause -- exactly as it would use a clause learned from Boolean conflict analysis -- to prune the search space and try again.

This is DPLL(T) in a nutshell. Everything that follows is about making this idea precise and efficient.

---

## 1. Satisfiability Modulo Theories

### 1.1 Why Go Beyond SAT?

SAT solvers answer a simple question: given a propositional formula, is there a true/false assignment to its variables that makes it true? This is already enormously useful, but many problems in verification and compilers involve richer constraints. When we want to ask "is there an integer $x$ such that $2x + 1 > 5$ and $x < 10$?", we cannot directly phrase this as a propositional satisfiability question -- we need a solver that understands integer arithmetic.

SMT generalizes SAT by asking satisfiability questions *relative to a background theory*. The theory tells the solver what the symbols mean: that "$+$" is addition, "$\le$" is the usual ordering on integers, and so on. The solver must find an assignment that satisfies the formula not just in the Boolean sense, but in a way that is consistent with the semantics defined by the theory.

### 1.2 Formal Definition

**Definition (SMT).** Let $\mathcal{T}$ be a first-order theory with signature $\Sigma$ (a set of sorts, function symbols, and predicate symbols) and axioms $\text{Ax}(\mathcal{T})$. A *$\mathcal{T}$-formula* $\varphi$ is a first-order formula over $\Sigma$. The *Satisfiability Modulo Theory $\mathcal{T}$* problem (SMT($\mathcal{T}$)) asks:

$$\text{Ax}(\mathcal{T}) \models \exists \vec{x}.\, \varphi(\vec{x}) \quad ?$$

That is, does there exist a $\mathcal{T}$-interpretation that satisfies $\varphi$?

**Example.** In the theory of linear integer arithmetic (LIA), the formula $x + 2y \le 5 \land x - y \ge 3 \land x \ge 0$ is satisfiable (e.g., $x = 3, y = 0$).

### 1.3 Quantifier-Free Fragments

Most practical SMT solving targets *quantifier-free* (QF) fragments. The SMT-LIB standard defines logics such as:
- QF_UF: quantifier-free uninterpreted functions
- QF_LIA: quantifier-free linear integer arithmetic
- QF_LRA: quantifier-free linear real arithmetic
- QF_BV: quantifier-free bitvectors
- QF_ABV: quantifier-free arrays + bitvectors
- QF_AUFLIA: QF arrays + uninterpreted functions + LIA

### 1.4 The Lazy vs. Eager Approach

Two paradigms for SMT:

1. **Eager approach:** Translate the entire $\mathcal{T}$-formula to a propositional (SAT) formula. This works well for bitvectors (bit-blasting) but poorly for infinite-domain theories.

2. **Lazy approach (DPLL(T)):** Use a SAT solver for the Boolean structure and a *theory solver* for $\mathcal{T}$-specific reasoning. This is the dominant paradigm.

The eager approach hits a wall when the theory has an infinite domain (like the integers or reals), because there is no finite propositional encoding of all possible values a variable can take. The lazy approach avoids this by never encoding the theory directly into SAT -- instead, it asks the theory solver on demand whether a particular set of constraints is consistent.

---

## 2. Theory of Equality and Uninterpreted Functions (EUF)

### 2.1 When You Encounter This

EUF is the theory you reach for when you want to reason about *structure* without committing to *meaning*. Suppose you are verifying that two compiler passes produce equivalent code, and one pass replaces `foo(bar(x))` with some other expression. If you do not know (or do not care) what `foo` and `bar` compute -- only that they are deterministic functions -- then EUF is the right abstraction. The function symbols are "uninterpreted": the solver knows only that equal inputs produce equal outputs, and nothing else.

In practice, EUF arises in:
- **Compiler translation validation:** proving two IR expressions are equivalent when the semantics of helper functions are irrelevant.
- **Refinement type systems:** checking subtyping when functions appear in type refinements.
- **Abstraction in software model checking:** replacing complex functions with uninterpreted symbols to reduce the problem to one that is tractable.

### 2.2 Signature and Axioms

The theory of EUF has:
- **Sorts:** one or more uninterpreted sorts
- **Function symbols:** uninterpreted function symbols $f, g, h, \ldots$
- **Axioms:** the axioms of equality (reflexivity, symmetry, transitivity) plus the *congruence axiom*:

$$\forall \vec{x}, \vec{y}.\, \left(\bigwedge_{i} x_i = y_i\right) \implies f(\vec{x}) = f(\vec{y})$$

### 2.3 The Congruence Closure Algorithm

**Problem.** Given a conjunction of equalities $s_1 = t_1 \land \cdots \land s_k = t_k$ and disequalities $u_1 \ne v_1 \land \cdots \land u_m \ne v_m$ over terms built from uninterpreted functions, determine $\mathcal{T}_\text{EUF}$-satisfiability.

The core idea is to maintain equivalence classes of terms using a union-find data structure. When two terms are asserted equal, we merge their classes. The key subtlety is the *congruence rule*: if $a$ and $b$ are in the same class, then $f(a)$ and $f(b)$ must also be in the same class. After processing all equalities and propagating congruences, we check whether any disequality $u \neq v$ has both sides in the same class -- if so, the conjunction is unsatisfiable.

**Algorithm (Congruence Closure):**

```
function CongruenceClosure(equalities, disequalities, terms):
    // Initialize union-find with all subterms
    UF := new UnionFind(allSubterms(terms))

    // Process equalities
    worklist := equalities
    while worklist is not empty:
        pick (s = t) from worklist
        if find(UF, s) != find(UF, t):
            union(UF, s, t)
            // Check congruence: for all pairs f(a1,...,an), f(b1,...,bn)
            // if ai and bi are in the same equivalence class for all i,
            // then f(a1,...,an) = f(b1,...,bn) should be merged
            for each pair (f(a), f(b)) where args are now congruent:
                if find(UF, f(a)) != find(UF, f(b)):
                    worklist := worklist union {f(a) = f(b)}

    // Check disequalities
    for each (u != v) in disequalities:
        if find(UF, u) == find(UF, v):
            return UNSAT  // u and v are in the same equivalence class

    return SAT
```

### 2.4 Congruence Closure: Complete Worked Example

Consider the formula:

$$f(a) = f(b) \land a = b \land g(f(a)) \neq g(f(b))$$

The subterms are: $a, b, f(a), f(b), g(f(a)), g(f(b))$.

**Initial equivalence classes** (each term in its own class):

```
{a}  {b}  {f(a)}  {f(b)}  {g(f(a))}  {g(f(b))}
```

**Step 1: Process $f(a) = f(b)$.** Merge the classes of $f(a)$ and $f(b)$:

```
{a}  {b}  {f(a), f(b)}  {g(f(a))}  {g(f(b))}
```

Now check congruence: $g(f(a))$ and $g(f(b))$ both have the form $g(\cdot)$ where the arguments $f(a)$ and $f(b)$ are now in the same class. So we add $g(f(a)) = g(f(b))$ to the worklist.

**Step 2: Process $a = b$.** Merge the classes of $a$ and $b$:

```
{a, b}  {f(a), f(b)}  {g(f(a))}  {g(f(b))}
```

Check congruence: $f(a)$ and $f(b)$ both have the form $f(\cdot)$ where arguments $a$ and $b$ are now in the same class. But $f(a)$ and $f(b)$ are already in the same class, so no new work.

**Step 3: Process $g(f(a)) = g(f(b))$** (from the worklist). Merge:

```
{a, b}  {f(a), f(b)}  {g(f(a)), g(f(b))}
```

Worklist is now empty.

**Step 4: Check disequalities.** The disequality $g(f(a)) \neq g(f(b))$ requires $g(f(a))$ and $g(f(b))$ to be in different classes. But they are in the same class. **Return UNSAT.**

This shows the congruence closure algorithm correctly detecting that the equality $a = b$ forces $f(a) = f(b)$ (which was already given) which forces $g(f(a)) = g(f(b))$, contradicting the disequality.

### 2.5 Correctness and Complexity

**Theorem.** The congruence closure algorithm correctly decides the quantifier-free theory of EUF.

*Proof.*

*Soundness:* If the algorithm returns UNSAT, then we derived $u = v$ for some disequality $u \ne v$ using only the congruence axiom and the given equalities. By soundness of equational reasoning, the input is unsatisfiable.

*Completeness:* If the algorithm returns SAT, we construct a model. The equivalence classes form the domain. Each function symbol $f$ is interpreted by choosing a representative for each class: $f^{\mathcal{I}}([a_1], \ldots, [a_n]) = [f(a_1, \ldots, a_n)]$. This is well-defined by the congruence closure invariant. The equalities hold by construction, and the disequalities hold because distinct classes map to distinct elements. $\blacksquare$

**Complexity.** Using an efficient union-find data structure with path compression and union by rank, the Downey-Sethi-Tarjan algorithm achieves $O(n \log n)$ time, where $n$ is the number of terms. The bottleneck is maintaining the congruence invariant: after merging two classes, we must find all function applications whose arguments have become congruent.

**Theorem (Downey, Sethi, Tarjan 1980).** Congruence closure can be computed in $O(n \log n)$ time.

*Proof sketch.* Each term is hashed by its function symbol and the equivalence class representatives of its arguments. After a union, we process the smaller class (union by rank). Each term is processed at most $O(\log n)$ times across all unions (by a counting argument on class sizes doubling). Each processing step takes $O(1)$ amortized time with appropriate hash tables. $\blacksquare$

---

## 3. Theory of Linear Integer Arithmetic (LIA)

### 3.1 When You Encounter This

LIA is the theory of integers with addition (but not multiplication of variables by variables). You encounter LIA whenever you reason about:
- **Array index arithmetic:** proving that `a[i+1]` and `a[j-1]` access the same element under certain conditions.
- **Loop bound analysis:** verifying that a loop counter stays within bounds, or that two loops iterate the same number of times.
- **Resource counting:** proving that a memory allocator never exceeds its budget, or that a reference count is always non-negative.
- **Modular arithmetic properties:** divisibility constraints like "this value is always even" arise naturally as LIA formulas with divisibility predicates.

The distinction between LIA and LRA (linear *real* arithmetic) matters because integer constraints are fundamentally harder -- $x + y = 1$ has infinitely many real solutions but constrains integers to a one-dimensional lattice.

### 3.2 Presburger Arithmetic

**Definition.** *Presburger arithmetic* is the first-order theory of the natural numbers with addition: $\langle \mathbb{N}, 0, 1, +, \le \rangle$. Equivalently, it is the theory of linear integer arithmetic.

**Theorem (Presburger 1929).** Presburger arithmetic is decidable.

**Theorem (Fischer & Rabin 1974).** The decision problem for the full first-order theory of Presburger arithmetic has a lower bound of $2^{2^{cn}}$ for some constant $c > 0$ (doubly exponential).

The quantifier-free fragment (QF_LIA) is NP-complete (satisfiability of systems of linear integer inequalities reduces to integer programming).

### 3.3 The Omega Test

The Omega test (Pugh 1991) is a decision procedure for quantifier-free Presburger arithmetic (QF_LIA) based on variable elimination.

**Core idea.** Eliminate variables one at a time using a combination of:

1. **Real shadow:** For variable $x$, collect all constraints $a_i x \le b_i(\vec{y})$ (upper bounds) and $c_j x \ge d_j(\vec{y})$ (lower bounds). For each pair $(i, j)$, derive:

$$a_i \cdot d_j(\vec{y}) \le c_j \cdot b_i(\vec{y})$$

This is the *Fourier-Motzkin elimination* adapted for integers.

2. **Dark shadow:** The real shadow is not exact for integers. The *dark shadow* adds the constraint:

$$c_j \cdot b_i(\vec{y}) - a_i \cdot d_j(\vec{y}) \ge (a_i - 1)(c_j - 1)$$

which guarantees an integer solution exists between the bounds.

3. **Gray shadow:** When the dark shadow is unsatisfiable but the real shadow is satisfiable, a finite number of additional cases (the "gray shadow") must be checked.

**Theorem.** The Omega test is a complete decision procedure for QF Presburger arithmetic.

### 3.4 The Omega Test: Complete Worked Example

Consider the system with variables $x, y, z$:

$$2x - y \le 4 \quad (1)$$
$$x + y \ge 3 \quad (2)$$
$$y - z \le 1 \quad (3)$$
$$z \ge 1 \quad (4)$$

We want to determine if there exist integers $x, y, z$ satisfying all four constraints. We will eliminate variables one at a time.

**Eliminating $x$.** Rewrite constraints (1) and (2) as bounds on $x$:

- From (1): $2x \le 4 + y$, so $x \le \lfloor(4 + y)/2\rfloor$ (upper bound)
- From (2): $x \ge 3 - y$ (lower bound)

**Real shadow.** For the real relaxation, we need the upper bound to be at least the lower bound:

$$3 - y \le (4 + y) / 2$$

Multiplying both sides by 2:

$$6 - 2y \le 4 + y$$

$$2 \le 3y$$

$$y \ge 1 \quad \text{(rounding up since } y \text{ is an integer: } y \ge 1\text{)}$$

**Dark shadow.** With $a_i = 2$ (the coefficient of $x$ in the upper bound) and $c_j = 1$ (the coefficient of $x$ in the lower bound), the dark shadow requires:

$$c_j \cdot b_i - a_i \cdot d_j \ge (a_i - 1)(c_j - 1)$$

Here $b_i = 4 + y$ (so $c_j \cdot b_i = 4 + y$) and $d_j = 3 - y$ (so $a_i \cdot d_j = 6 - 2y$):

$$4 + y - (6 - 2y) \ge (2 - 1)(1 - 1) = 0$$

$$3y - 2 \ge 0$$

$$y \ge 1 \quad \text{(since } y \text{ is an integer)}$$

In this case the dark shadow and real shadow give the same constraint on $y$. (When they differ, the "gray shadow" -- the region between them -- requires case-splitting.)

**After eliminating $x$**, the remaining system is:

$$y \ge 1 \quad (5, \text{from shadows})$$
$$y - z \le 1 \quad (3)$$
$$z \ge 1 \quad (4)$$

**Eliminating $y$.** From (5): $y \ge 1$ (lower bound). From (3): $y \le 1 + z$ (upper bound).

Real shadow: $1 \le 1 + z$, i.e., $z \ge 0$. Combined with (4): $z \ge 1$.

Dark shadow: coefficients are both 1, so $(1-1)(1-1) = 0$, same as the real shadow.

**After eliminating $y$**: just $z \ge 1$, which is trivially satisfiable (take $z = 1$).

**Reconstructing the solution.** Working backwards:
- $z = 1$
- $y \ge 1$ and $y \le 1 + z = 2$, so $y \in \{1, 2\}$. Take $y = 1$.
- $x \ge 3 - y = 2$ and $x \le \lfloor(4 + y)/2\rfloor = \lfloor 5/2 \rfloor = 2$, so $x = 2$.

**Verify:** $2(2) - 1 = 3 \le 4$ (yes), $2 + 1 = 3 \ge 3$ (yes), $1 - 1 = 0 \le 1$ (yes), $1 \ge 1$ (yes). The system is **satisfiable** with $(x, y, z) = (2, 1, 1)$.

### 3.5 Simplex for SMT (LRA and LIA)

Modern SMT solvers use a variant of the Simplex algorithm for linear arithmetic, adapted by Dutertre and de Moura (2006).

**Key adaptations for SMT:**
- Incremental: efficiently add and remove constraints as the SAT solver makes/undoes decisions.
- Explanation generation: when unsatisfiable, return a minimal unsatisfiable subset (for theory conflict clauses).
- For LIA: Simplex solves the rational relaxation first. If a non-integer solution is found, branch-and-bound or Gomory cuts are used.

---

## 4. Theory of Linear Real Arithmetic (LRA)

### 4.1 When You Encounter This

LRA arises whenever you reason about continuous quantities or when integer discreteness is irrelevant. Common sources include:
- **Floating-point abstractions:** when you abstract away rounding and treat floating-point values as reals (a sound overapproximation for many properties).
- **Timing analysis:** reasoning about real-valued clocks in timed automata or real-time systems.
- **Probability and expectation:** constraints on probabilities, which range over $[0,1] \subset \mathbb{R}$.
- **Optimization and resource allocation:** linear programming relaxations arising in compiler scheduling.

LRA is computationally easier than LIA because you do not have to deal with the discreteness of integers. The quantifier-free fragment is solvable in polynomial time (it is just linear programming feasibility), whereas QF_LIA is NP-complete.

### 4.2 Decision Procedure

**Theorem (Tarski 1951).** The first-order theory of real closed fields $\langle \mathbb{R}, 0, 1, +, \times, \le \rangle$ is decidable.

For the *linear* fragment (no multiplication of variables), the quantifier-free theory is decidable in polynomial time via linear programming.

### 4.3 Simplex for SMT

The Simplex method adapted for SMT (Dutertre & de Moura 2006):

```
function SimplexSMT:
    // Maintain a tableau: Ax = 0 with basic and non-basic variables
    // Each variable x_i has bounds: l_i <= x_i <= u_i

    function assert(constraint):
        // Add a new row or update bounds
        update tableau or bounds for the new constraint

    function check():
        while exists basic variable x_i violating its bounds:
            if x_i > u_i:
                // Try to decrease x_i by pivoting with a non-basic x_j
                // where the pivot direction can decrease x_i
                find suitable non-basic x_j
                if no such x_j exists:
                    return UNSAT with conflict (the row for x_i)
                pivot(x_i, x_j)
            // symmetric case for x_i < l_i
        return SAT

    function explain(conflict):
        // Return a subset of asserted constraints that are infeasible
        // This becomes the theory conflict clause
```

**Key property:** The explanation consists of the bound constraints involved in the conflict row, which forms a minimal unsatisfiable subset.

---

## 5. Theory of Bitvectors (QF_BV)

### 5.1 When You Encounter This

Bitvector theory models what hardware and low-level code actually compute. Unlike mathematical integers, machine integers wrap around on overflow, and operations like bitwise AND, shift, and sign extension have no natural counterpart in integer arithmetic. You encounter QF_BV when:
- **Verifying compiler optimizations on fixed-width integers:** proving that `x * 2` is equivalent to `x << 1` for all 32-bit values, including overflow cases.
- **Checking for integer overflow bugs:** is there an input where `a + b` wraps around?
- **Analyzing cryptographic code:** reasoning about XOR, rotation, and modular multiplication.
- **Verifying hardware (RTL) designs:** where all values are inherently fixed-width bit strings.

### 5.2 Signature

Fixed-width bitvectors of width $w$: values in $\{0, 1\}^w$. Operations include:
- Arithmetic: addition, subtraction, multiplication (modular)
- Bitwise: AND, OR, XOR, NOT, shifts
- Comparison: signed/unsigned $<, \le, =, \ge, >$
- Extraction, concatenation, extension

### 5.3 Bit-Blasting

The primary decision procedure for QF_BV is *bit-blasting*: encode each bitvector operation as a Boolean circuit, then solve the resulting SAT problem.

**Example.** For 4-bit addition $z = x + y$:
- $z_0 = x_0 \oplus y_0$, $c_0 = x_0 \land y_0$
- $z_i = x_i \oplus y_i \oplus c_{i-1}$, $c_i = (x_i \land y_i) \lor (x_i \land c_{i-1}) \lor (y_i \land c_{i-1})$

Apply Tseitin transformation and solve with CDCL.

**Complexity.** Multiplication circuits have quadratic size. The resulting SAT problem is NP-complete, but modern SAT solvers handle typical instances efficiently.

### 5.4 Word-Level Reasoning

Some solvers combine bit-blasting with word-level reasoning:
- Algebraic simplifications (e.g., $x + 0 = x$, $x \oplus x = 0$)
- Congruence closure at the word level
- Interval analysis for bounds propagation

---

## 6. Theory of Arrays

### 6.1 When You Encounter This

Array theory models the fundamental operation of indexing into a data structure. You encounter it whenever a program reads from or writes to a data structure indexed by some key:
- **Verifying array-manipulating programs:** proving that a sorting algorithm does not access out-of-bounds indices, or that two array operations commute.
- **Memory models:** heap memory can be modeled as an array from addresses to values.
- **Functional map data structures:** any key-value store with get/set operations.

The array theory is parameterized by the index theory (what kind of values are used as indices) and the element theory (what kind of values are stored). In QF_AUFLIA, indices are integers and elements can be integers or uninterpreted.

### 6.2 Read-Over-Write Axioms

The theory of arrays has two operations:
- $\text{read}(a, i)$: read array $a$ at index $i$
- $\text{write}(a, i, v)$: write value $v$ to array $a$ at index $i$, returning a new array

**Axioms:**
1. $\forall a, i, v.\, \text{read}(\text{write}(a, i, v), i) = v$ (read-over-write, same index)
2. $\forall a, i, j, v.\, i \ne j \implies \text{read}(\text{write}(a, i, v), j) = \text{read}(a, j)$ (read-over-write, different index)
3. $\forall a, b.\, (\forall i.\, \text{read}(a, i) = \text{read}(b, i)) \implies a = b$ (extensionality)

### 6.3 Decision Procedure

The standard approach reduces array constraints to EUF + index theory:

1. Collect all array terms and their indices.
2. For each $\text{write}(a, i, v)$, introduce a fresh array variable $a'$ and add:
   - $\text{read}(a', i) = v$
   - For each other index $j$ in the formula: $i = j \lor \text{read}(a', j) = \text{read}(a, j)$
3. Solve the resulting EUF + index theory problem.

**Theorem (Stump et al. 2001).** The quantifier-free theory of arrays with extensionality is decidable and NP-complete (when index and element theories are decidable).

---

## 7. Theory of Strings

### 7.1 Word Equations

The theory of strings deals with string variables, concatenation, length, and regular expression membership.

**Decidability.** The satisfiability of word equations (Makanin 1977) is decidable, but the complexity is very high. Modern string solvers (Z3str3, CVC4/cvc5) use a combination of techniques:
- Unfolding-based approaches
- Length-based abstraction
- Reduction to arithmetic constraints

### 7.2 Applications

String theory is crucial for:
- Web security analysis (SQL injection, XSS)
- Path constraint solving in symbolic execution of string-heavy programs
- Regular expression analysis

---

## 8. The DPLL(T) Framework

### 8.1 Architecture

DPLL(T), formalized by Nieuwenhuis, Oliveras, and Tinelli (2006), cleanly separates the Boolean reasoning (SAT solver) from theory-specific reasoning (theory solver).

The intuition is this: a formula like $(x + y \le 5) \lor (f(x) = f(y))$ has two levels of structure. At the Boolean level, it is a disjunction "$A \lor B$." At the theory level, $A$ and $B$ are arithmetic and EUF atoms with specific semantics. DPLL(T) handles these levels independently: the SAT solver treats theory atoms as opaque propositional variables and finds Boolean models, while the theory solver checks whether the selected atoms are simultaneously satisfiable in the theory.

```
    +------------------+         +------------------+
    |                  |  atoms  |                  |
    |   CDCL SAT       | ------> |   Theory Solver  |
    |   Solver          | <------ |   (T-solver)     |
    |                  | conflict|                  |
    +------------------+ clauses +------------------+
```

**Interface between SAT solver and theory solver:**
- **assert(l):** The SAT solver informs the theory solver that literal $l$ has been assigned true.
- **check():** The SAT solver asks: is the current set of theory literals consistent in $\mathcal{T}$?
- **propagate():** The theory solver informs the SAT solver of implied literals.
- **explain(l):** The theory solver returns a clause explaining why $l$ was propagated.
- **conflict():** The theory solver returns a theory conflict clause (a subset of asserted literals that is $\mathcal{T}$-inconsistent).

### 8.2 Boolean Abstraction

Given a $\mathcal{T}$-formula $\varphi$, replace each atomic $\mathcal{T}$-formula with a fresh Boolean variable:

$$\varphi = (x + y \le 5) \lor (f(x) = f(y)) \quad \leadsto \quad p_1 \lor p_2$$

where $p_1 \leftrightarrow (x + y \le 5)$ and $p_2 \leftrightarrow (f(x) = f(y))$.

The SAT solver reasons over the Boolean abstraction. When it finds a Boolean model, the theory solver checks whether the corresponding $\mathcal{T}$-atoms are simultaneously satisfiable.

### 8.3 Full DPLL(T) Pseudocode

```
function DPLL_T(formula):
    // Boolean abstraction
    (boolFormula, atomMap) := abstract(formula)

    // Initialize SAT solver and theory solver
    satSolver := new CDCL(boolFormula)
    theorySolver := new TSolver()

    while true:
        result := satSolver.solve()

        if result == UNSAT:
            return UNSAT

        // satSolver found a Boolean model
        model := satSolver.getModel()

        // Map Boolean model to theory atoms
        theoryAtoms := {}
        for each (boolVar, value) in model:
            if boolVar in atomMap:
                atom := atomMap[boolVar]
                if value == TRUE:
                    theoryAtoms.add(atom)
                else:
                    theoryAtoms.add(NOT(atom))

        // Check theory consistency
        tResult := theorySolver.check(theoryAtoms)

        if tResult == SAT:
            return SAT(model, theorySolver.getModel())
        else:
            // Get theory conflict clause
            conflict := theorySolver.getConflict()
            // Convert to Boolean clause and add to SAT solver
            boolConflict := abstractClause(conflict, atomMap)
            satSolver.addClause(NOT(boolConflict))
```

**Optimization: Online DPLL(T).** Rather than waiting for a full Boolean model, invoke the theory solver incrementally during BCP:

```
function DPLL_T_Online(formula):
    (boolFormula, atomMap) := abstract(formula)
    satSolver := new CDCL(boolFormula)
    theorySolver := new TSolver()

    satSolver.onAssign(literal l):
        if l corresponds to theory atom a:
            theorySolver.assert(a)

            // Early conflict detection
            if theorySolver.check() == UNSAT:
                conflict := theorySolver.getConflict()
                satSolver.addConflictClause(abstractClause(conflict))
                satSolver.backtrack()

            // Theory propagation
            for each implied literal l' from theorySolver:
                satSolver.enqueue(l', explanation=theorySolver.explain(l'))

    satSolver.onBacktrack(level):
        theorySolver.backtrackTo(level)

    return satSolver.solve()
```

### 8.4 DPLL(T) End-to-End Worked Example

Let us trace DPLL(T) on a concrete formula that mixes EUF and LIA:

$$\varphi \;=\; f(x) = f(y) \;\land\; x = y + 1 \;\land\; y = z - 1 \;\land\; f(z) \neq f(x)$$

This formula asserts that $f(x) = f(y)$ (an EUF fact), that $x$ and $z$ are related through arithmetic ($x = y + 1$ and $y = z - 1$, so $x = z$), and that $f(z) \neq f(x)$. Intuitively, since $x = z$, we should have $f(x) = f(z)$, contradicting the disequality. Let us see how DPLL(T) discovers this.

**Step 1: Boolean Abstraction.** Replace each theory atom with a propositional variable:

| Theory atom | Boolean variable |
|---|---|
| $f(x) = f(y)$ | $p_1$ |
| $x = y + 1$ | $p_2$ |
| $y = z - 1$ | $p_3$ |
| $f(z) = f(x)$ | $p_4$ |

The Boolean abstraction of $\varphi$ is:

$$p_1 \land p_2 \land p_3 \land \neg p_4$$

(The last conjunct is $\neg p_4$ because the original has $f(z) \neq f(x)$, which is $\neg(f(z) = f(x))$.)

**Step 2: SAT Solver Finds a Boolean Model.** The Boolean formula $p_1 \land p_2 \land p_3 \land \neg p_4$ is trivially satisfiable: set $p_1 = p_2 = p_3 = \top$ and $p_4 = \bot$. The SAT solver returns this model.

**Step 3: Map to Theory Atoms.** The Boolean model corresponds to the theory conjunction:

$$f(x) = f(y) \;\land\; x = y + 1 \;\land\; y = z - 1 \;\land\; f(z) \neq f(x)$$

This is exactly the original formula (since the Boolean formula had only one satisfying assignment).

**Step 4: Theory Solver Checks Consistency.** Now the theory solver receives these four literals. Since the formula mixes EUF and LIA, the solver uses Nelson-Oppen combination (detailed in Section 9). For now, we observe the key reasoning:

- The LIA solver processes $x = y + 1$ and $y = z - 1$. From these, it derives $x = (z - 1) + 1 = z$, so $x = z$. It propagates the equality $x = z$ to the EUF solver.
- The EUF solver now knows $x = z$. By the congruence axiom, $f(x) = f(z)$. But it also has the disequality $f(z) \neq f(x)$. This is a contradiction.

The theory solver returns **UNSAT** with the conflict clause:

$$\neg(x = y + 1) \;\lor\; \neg(y = z - 1) \;\lor\; f(z) = f(x)$$

In Boolean terms: $\neg p_2 \lor \neg p_3 \lor p_4$.

**Step 5: Conflict Clause Added.** The SAT solver adds the clause $\neg p_2 \lor \neg p_3 \lor p_4$. It now has:

$$p_1 \land p_2 \land p_3 \land \neg p_4 \land (\neg p_2 \lor \neg p_3 \lor p_4)$$

The clause $(\neg p_2 \lor \neg p_3 \lor p_4)$ combined with $p_2 \land p_3$ forces $p_4 = \top$ by unit propagation. But $\neg p_4$ is also required. This is a Boolean contradiction.

**Step 6: SAT Solver Returns UNSAT.** The augmented Boolean formula has no satisfying assignment. DPLL(T) returns **UNSAT**.

The formula is indeed unsatisfiable: the arithmetic constraints force $x = z$, congruence then forces $f(x) = f(z)$, contradicting $f(z) \neq f(x)$.

### 8.5 Correctness of DPLL(T)

**Theorem.** DPLL(T) is sound and complete for decidable theories $\mathcal{T}$ with a sound and complete theory solver.

*Proof.*

*Soundness:* If DPLL(T) returns SAT, both the Boolean abstraction and the theory constraints are satisfied. The Boolean model satisfies the formula's Boolean structure, and the theory model satisfies the corresponding theory atoms. Together, they constitute a $\mathcal{T}$-model of $\varphi$.

If DPLL(T) returns UNSAT, it means the SAT solver proved unsatisfiability of the Boolean formula augmented with theory conflict clauses. Each theory conflict clause is a valid clause in $\mathcal{T}$ (by soundness of the theory solver). Therefore the original formula is $\mathcal{T}$-unsatisfiable.

*Completeness:* If $\varphi$ is $\mathcal{T}$-satisfiable, there exists a Boolean model whose corresponding theory atoms are $\mathcal{T}$-consistent. The SAT solver will eventually find this model (CDCL is complete). The theory solver will confirm consistency (by completeness of the theory solver). Therefore DPLL(T) returns SAT.

If $\varphi$ is $\mathcal{T}$-unsatisfiable, every Boolean model has $\mathcal{T}$-inconsistent theory atoms. Each such model generates a theory conflict clause that blocks it and possibly other models. Since there are finitely many Boolean models, after finitely many iterations the SAT solver will report UNSAT.

*Termination:* Each iteration either returns a result or adds a new blocking clause. Since the number of distinct clauses over $n$ Boolean variables is finite, the procedure terminates. $\blacksquare$

---

## 9. Combination of Theories: The Nelson-Oppen Method

### 9.1 Motivation

Real verification problems mix multiple theories. For example:

$$f(x) = f(y) \land x + 1 = y \land y - 1 = z \land f(z) \ne f(x)$$

This mixes EUF ($f$) and LIA ($+, -, 1$). We need to combine the decision procedures.

The fundamental challenge is this: the EUF solver knows about function congruence but nothing about arithmetic, and the LIA solver knows about arithmetic but nothing about uninterpreted functions. Neither solver alone can determine satisfiability. Yet they must cooperate, because facts derived in one theory (like $x = z$ from arithmetic) have consequences in the other (like $f(x) = f(z)$ from congruence). The Nelson-Oppen method provides a principled framework for this cooperation.

### 9.2 Requirements

The Nelson-Oppen combination (1979) requires the component theories to be:

1. **Signature-disjoint:** The theories share no function or predicate symbols (except equality).
2. **Stably infinite:** Each theory has arbitrarily large models. Formally, $\mathcal{T}$ is stably infinite if every $\mathcal{T}$-satisfiable QF formula is satisfiable in a model with an infinite domain.

**Definition (Stably Infinite).** A theory $\mathcal{T}$ is *stably infinite* if for every quantifier-free $\mathcal{T}$-satisfiable formula $\varphi$, there exists a $\mathcal{T}$-model of $\varphi$ with an infinite domain.

EUF and LIA are both stably infinite. The theory of bitvectors of fixed width is *not* stably infinite.

### 9.3 Why "Stably Infinite" Matters

The stable infiniteness requirement is subtle but essential. Here is the problem it prevents.

The Nelson-Oppen method works by finding models of the two purified sub-formulas *independently* and then *amalgamating* them -- gluing the two models together into one combined model. For this to work, the two models must be compatible: they must agree on which shared variables are equal and which are distinct. The arrangement (Section 9.4) ensures this agreement on equalities and disequalities among shared variables.

But there is a hidden assumption: the two models must have domains large enough that the amalgamation is possible. Specifically, if one model has 5 elements in its domain and the other has 7, we need to embed them into a common domain. This is easy when both domains are infinite (any two countably infinite sets are in bijection), but fails when a theory forces small finite domains.

**Concrete example of failure.** Consider a theory $\mathcal{T}_{\le 2}$ that axiomatizes "there are at most 2 elements": $\forall x, y, z.\, x = y \lor x = z \lor y = z$. This theory is *not* stably infinite. Now consider combining $\mathcal{T}_{\le 2}$ with EUF. The formula:

$$a \neq b \land b \neq c \land a \neq c$$

is satisfiable in EUF (just let $a, b, c$ be three distinct elements) but unsatisfiable in $\mathcal{T}_{\le 2}$ (there are at most 2 elements). If we tried to combine models, the EUF model requires 3 distinct elements for shared variables $a, b, c$, but $\mathcal{T}_{\le 2}$ cannot accommodate this. The Nelson-Oppen method would incorrectly report satisfiability if we did not check domain compatibility.

Stable infiniteness guarantees that both theories can always find models with infinite domains, making domain mismatch impossible. Any shared variable arrangement that is satisfiable in both theories can be realized in models of the same (infinite) cardinality.

### 9.4 The Method

Given a formula $\varphi$ over combined theory $\mathcal{T}_1 \cup \mathcal{T}_2$:

**Step 1: Purification.** Separate $\varphi$ into $\varphi_1$ (pure $\mathcal{T}_1$) and $\varphi_2$ (pure $\mathcal{T}_2$) by introducing *shared variables* for mixed terms.

**Example.** The formula $f(x + 1) = g(y)$ becomes:
- $\mathcal{T}_1$ (EUF): $f(v_1) = g(y)$, where $v_1$ is a shared variable
- $\mathcal{T}_2$ (LIA): $v_1 = x + 1$

The shared variables $V = \{x, y, v_1\}$ appear in both purified formulas.

**Step 2: Arrangement Enumeration.** The key insight is that the theories must agree on which shared variables are equal. An *arrangement* $\mathcal{A}$ over shared variables $V$ is a complete specification of equalities and disequalities among elements of $V$:

$$\mathcal{A} = \bigwedge_{v_i, v_j \in V, i < j} (v_i = v_j \lor v_i \ne v_j)$$

For each arrangement $\mathcal{A}$:
- Check if $\varphi_1 \land \mathcal{A}$ is $\mathcal{T}_1$-satisfiable.
- Check if $\varphi_2 \land \mathcal{A}$ is $\mathcal{T}_2$-satisfiable.
- If both are satisfiable under the same arrangement, then $\varphi$ is $\mathcal{T}_1 \cup \mathcal{T}_2$-satisfiable.

### 9.5 Nelson-Oppen: Complete Worked Example

Consider the formula:

$$f(x) = f(y) \;\land\; x + 1 = y \;\land\; y - 1 = z \;\land\; f(z) \neq f(x)$$

We will walk through every step of the Nelson-Oppen procedure for $\mathcal{T}_1 = $ EUF and $\mathcal{T}_2 = $ LIA.

**Step 1: Purification.** We need to separate the formula so that each conjunct belongs purely to one theory. The function symbol $f$ belongs to EUF; the arithmetic operations $+, -, 1$ belong to LIA; the variables $x, y, z$ are shared.

The original conjuncts:
- $f(x) = f(y)$: pure EUF (uses only $f$ and variables). Keep as is.
- $x + 1 = y$: pure LIA. Keep as is.
- $y - 1 = z$: pure LIA. Keep as is.
- $f(z) \neq f(x)$: pure EUF. Keep as is.

This formula is already pure -- no conjunct mixes the two signatures. (If we had $f(x + 1) = f(y)$, we would need to introduce a fresh variable $v$ and split into $v = x + 1$ (LIA) and $f(v) = f(y)$ (EUF).)

The purified sub-formulas are:

$$\varphi_{\text{EUF}}: \quad f(x) = f(y) \;\land\; f(z) \neq f(x)$$

$$\varphi_{\text{LIA}}: \quad x + 1 = y \;\land\; y - 1 = z$$

The shared variables are $V = \{x, y, z\}$.

**Step 2: Determine Arrangements.** The shared variables are $x, y, z$. An arrangement specifies, for each pair, whether they are equal or distinct. The possible arrangements are:

| Arrangement | $x, y$ | $x, z$ | $y, z$ |
|---|---|---|---|
| $\mathcal{A}_1$ | $x = y$ | $x = z$ | $y = z$ |
| $\mathcal{A}_2$ | $x = y$ | $x = z$ | $y \neq z$ |
| $\mathcal{A}_3$ | $x = y$ | $x \neq z$ | $y = z$ |
| $\mathcal{A}_4$ | $x = y$ | $x \neq z$ | $y \neq z$ |
| $\mathcal{A}_5$ | $x \neq y$ | $x = z$ | $y = z$ |
| $\mathcal{A}_6$ | $x \neq y$ | $x = z$ | $y \neq z$ |
| $\mathcal{A}_7$ | $x \neq y$ | $x \neq z$ | $y = z$ |
| $\mathcal{A}_8$ | $x \neq y$ | $x \neq z$ | $y \neq z$ |

Note: $\mathcal{A}_2$, $\mathcal{A}_3$, and $\mathcal{A}_5$ are inconsistent (e.g., $x = y$ and $x = z$ but $y \neq z$ is impossible). This leaves 5 consistent arrangements.

**Step 3: Check each arrangement against both theories.**

Since LIA is not convex, we must enumerate. However, we can quickly narrow down. The LIA constraints $x + 1 = y \land y - 1 = z$ imply $x = z$ (since $z = y - 1 = (x + 1) - 1 = x$) and $x \neq y$ (since $y = x + 1$). So the only LIA-consistent arrangement is $\mathcal{A}_6$: $x \neq y$, $x = z$, $y \neq z$.

Now check $\varphi_{\text{EUF}} \land \mathcal{A}_6$:

$$f(x) = f(y) \;\land\; f(z) \neq f(x) \;\land\; x \neq y \;\land\; x = z \;\land\; y \neq z$$

Since $x = z$, by congruence, $f(x) = f(z)$. But $f(z) \neq f(x)$ is asserted. Contradiction. **EUF returns UNSAT under $\mathcal{A}_6$.**

Since no arrangement is satisfiable in both theories, the formula is **UNSAT**.

**In practice (with convexity optimization):** Since EUF is convex, it propagates equalities eagerly. LIA is not convex, but in this case there is no disjunction to split -- LIA directly implies $x = z$. The equality $x = z$ is propagated to EUF, which derives $f(x) = f(z)$, contradicting $f(z) \neq f(x)$. The procedure terminates without full arrangement enumeration.

### 9.6 Correctness of Nelson-Oppen

**Theorem (Nelson & Oppen 1979).** Let $\mathcal{T}_1$ and $\mathcal{T}_2$ be stably infinite, signature-disjoint theories with decidable QF satisfiability. Then the Nelson-Oppen procedure is a decision procedure for the QF satisfiability of $\mathcal{T}_1 \cup \mathcal{T}_2$.

*Proof.*

*Soundness:* If the procedure returns SAT with arrangement $\mathcal{A}$, then there exist models $\mathcal{M}_1 \models \varphi_1 \land \mathcal{A}$ and $\mathcal{M}_2 \models \varphi_2 \land \mathcal{A}$. Since both theories are stably infinite, we can assume $|\mathcal{M}_1| = |\mathcal{M}_2| = \aleph_0$ (both have countably infinite domains). Since $\mathcal{A}$ specifies the same partition of shared variables, we can find a bijection between the domains that preserves the shared variable assignments. Amalgamating $\mathcal{M}_1$ and $\mathcal{M}_2$ via this bijection gives a model of $\varphi_1 \land \varphi_2 \land \mathcal{A}$, hence of $\varphi$.

*Completeness:* If $\varphi$ is $\mathcal{T}_1 \cup \mathcal{T}_2$-satisfiable, there exists a model $\mathcal{M} \models \varphi$. The restriction of $\mathcal{M}$ to $\Sigma_1$ satisfies $\varphi_1$, the restriction to $\Sigma_2$ satisfies $\varphi_2$, and the arrangement $\mathcal{A}$ induced by $\mathcal{M}$ on shared variables is consistent with both. Therefore the procedure finds this arrangement and returns SAT. $\blacksquare$

### 9.7 Convex Theories and Optimization

**Definition.** A theory $\mathcal{T}$ is *convex* if whenever $\varphi \models_\mathcal{T} \bigvee_{i=1}^{k} (x_i = y_i)$, then $\varphi \models_\mathcal{T} (x_i = y_i)$ for some $i$.

In plain terms: if the theory constraints force *some* equality among shared variables to hold (but you do not know which one), convexity says the constraints must in fact force a *specific* one. This matters because, for convex theories, we never need to case-split on which equality holds -- we can just propagate equalities one at a time.

**Theorem.** If both theories are convex, the Nelson-Oppen method can avoid enumerating all arrangements. Instead, it suffices to propagate equalities between shared variables: when $\mathcal{T}_1$ implies $v_i = v_j$ for shared variables, inform $\mathcal{T}_2$, and vice versa.

LRA and EUF are convex. LIA is *not* convex (e.g., $1 \le x \le 2 \models x = 1 \lor x = 2$ but neither disjunct is implied individually). For non-convex theories, case splitting on disjunctions of equalities is required.

---

## 10. Quantifier Handling

### 10.1 E-Matching and Triggers

For universally quantified formulas $\forall \vec{x}.\, \psi(\vec{x})$, SMT solvers use *E-matching* to find relevant instantiations.

**Definition.** A *trigger* (or *pattern*) for $\forall \vec{x}.\, \psi(\vec{x})$ is a set of terms $\{t_1(\vec{x}), \ldots, t_k(\vec{x})\}$ containing all quantified variables. When ground terms matching the trigger appear in the E-graph, the quantifier is instantiated.

**Example.** For $\forall x.\, f(x) \ge 0$, the trigger is $\{f(x)\}$. If $f(a + b)$ appears in the E-graph, we instantiate with $x \mapsto a + b$, adding $f(a + b) \ge 0$.

**Completeness.** E-matching is incomplete in general. It may fail to find necessary instantiations. However, it is highly effective in practice for verification conditions.

### 10.2 Model-Based Quantifier Instantiation (MBQI)

MBQI (Ge & de Moura 2009) is a more complete approach:

1. Find a model $\mathcal{M}$ of the quantifier-free part.
2. Check if $\mathcal{M}$ satisfies the quantified formulas.
3. If not, find a counterexample and use it to generate an instantiation.
4. Add the instantiation and repeat.

**Theorem (Ge & de Moura 2009).** MBQI is a decision procedure for several decidable fragments, including the Bernays-Schonfinkel-Ramsey class (EPR: $\exists^* \forall^*$ with no function symbols of arity $> 0$).

### 10.3 Quantifier Elimination

For specific theories, quantifiers can be eliminated entirely:

- **LRA:** Fourier-Motzkin elimination removes existential quantifiers. For $\exists x.\, \bigwedge_i a_i x \le b_i$, eliminate $x$ by pairing upper and lower bounds.
- **Presburger arithmetic:** Cooper's algorithm or the Omega test.
- **Real closed fields:** Cylindrical Algebraic Decomposition (CAD) by Collins (1975).

---

## 11. SMT Solver Architecture: Z3 Internals

Z3 (de Moura & Bjorner 2008) is the most widely used SMT solver. Its architecture:

```
+--------------------------------------------------+
|                    Z3 Kernel                       |
|  +------+  +--------+  +---------+  +----------+ |
|  | CDCL |  | Simplex|  |Congr.   |  | BV       | |
|  | SAT  |  | (LRA/  |  |Closure  |  | Solver   | |
|  |Solver|  |  LIA)  |  |(EUF)    |  |(bit-blast| |
|  +------+  +--------+  +---------+  +----------+ |
|  +--------+  +---------+  +----------+            |
|  | Array  |  | String  |  | Quantifier|            |
|  | Solver |  | Solver  |  | Module    |            |
|  +--------+  +---------+  +----------+            |
|                                                    |
|  Nelson-Oppen Combination Framework                |
+--------------------------------------------------+
```

**Key components:**
1. **SAT core:** CDCL with VSIDS, phase saving, restarts.
2. **Theory solvers:** Pluggable theory solvers registered for specific sorts/functions.
3. **Combination:** Nelson-Oppen with equality propagation (for convex theories) and case splitting (for non-convex).
4. **Quantifier module:** E-matching, MBQI, and specialized quantifier reasoning.
5. **Preprocessing:** Formula simplification, flattening, Gaussian elimination.
6. **Model construction:** When SAT, construct a concrete model.

---

## 12. Applications to Compilers and Programming Languages

### 12.1 Refinement Type Checking

**Liquid Haskell** uses SMT (via Z3) to discharge subtyping obligations. Types are refined with predicates:

$$\{v : \text{Int} \mid v \ge 0\}$$

Subtyping reduces to SMT validity:

$$\{v : \text{Int} \mid p(v)\} <: \{v : \text{Int} \mid q(v)\} \iff \forall v.\, p(v) \implies q(v)$$

**F\*** (F-star) uses Z3 for verification condition discharge in its dependent type system. Effectful programs generate VCs that Z3 proves automatically.

### 12.2 Translation Validation: Alive2

**Alive2** (Lopes et al. 2021) verifies LLVM peephole optimizations using SMT. For each optimization $\text{src} \to \text{tgt}$:

1. Encode source and target semantics as SMT formulas over bitvectors.
2. Encode undefined behavior (UB) and poison values.
3. Check: $\forall \vec{x}.\, \text{defined}(\text{src}) \implies \text{src}(\vec{x}) = \text{tgt}(\vec{x})$
4. This is valid iff its negation is UNSAT.

Alive2 has found numerous bugs in LLVM's InstCombine pass.

### 12.3 Compiler Optimization Verification

SMT solvers verify:
- **Constant folding:** $a \oplus b = c$ for bitvector operations.
- **Strength reduction:** $x \times 2^k = x \ll k$ for all $w$-bit values.
- **Dead code elimination:** Proving a condition is always true/false.
- **Loop invariant inference:** Using quantified formulas or abstract interpretation.

### 12.4 Program Synthesis

Syntax-guided synthesis (SyGuS) uses SMT to synthesize programs from specifications:

$$\exists P \in \mathcal{G}.\, \forall \vec{x}.\, \text{spec}(\vec{x}, P(\vec{x}))$$

The inner $\forall$ is handled by CEGIS (Counter-Example Guided Inductive Synthesis):
1. Guess a candidate program $P$.
2. Find a counterexample $\vec{x}$ using SMT.
3. Add $\vec{x}$ as a constraint and repeat.

### 12.5 Test Generation and Fuzzing Guidance

SMT solvers power:
- **KLEE:** Symbolic execution for LLVM, generating test inputs via Z3/STP.
- **SAGE (Microsoft):** Whitebox fuzzing using concolic execution with Z3.
- Directed testing: negate path conditions to explore new branches.

---

## 13. Summary

| Theory | Decision Procedure | Complexity | Convex? |
|---|---|---|---|
| EUF | Congruence closure | $O(n \log n)$ | Yes |
| LRA | Simplex | Polynomial | Yes |
| LIA | Omega test / branch-and-bound | NP-complete (QF) | No |
| QF_BV | Bit-blasting to SAT | NP-complete | No |
| Arrays | Reduction to EUF + index theory | Depends on index theory | No |

The DPLL(T) framework elegantly separates Boolean reasoning from theory reasoning, enabling modular solver design. The Nelson-Oppen combination method allows mixing theories, making SMT solvers versatile tools for compiler verification, program analysis, and software engineering.

---

## References

1. Nelson, G. & Oppen, D.C. (1979). "Simplification by cooperating decision procedures." *ACM TOPLAS*, 1(2), 245-257.
2. Nieuwenhuis, R., Oliveras, A. & Tinelli, C. (2006). "Solving SAT and SAT Modulo Theories: From an abstract Davis-Putnam-Logemann-Loveland procedure to DPLL(T)." *Journal of the ACM*, 53(6), 937-977.
3. de Moura, L. & Bjorner, N. (2008). "Z3: An efficient SMT solver." *TACAS 2008*, LNCS 4963, 337-340.
4. Barrett, C. et al. (2009). "The SMT-LIB Standard: Version 2.0." *SMT Workshop*.
5. Downey, P., Sethi, R. & Tarjan, R.E. (1980). "Variations on the common subexpression problem." *Journal of the ACM*, 27(4), 758-771.
6. Pugh, W. (1991). "The Omega test: A fast and practical integer programming algorithm for dependence analysis." *Supercomputing*, 4-13.
7. Dutertre, B. & de Moura, L. (2006). "A fast linear-arithmetic solver for DPLL(T)." *CAV 2006*, LNCS 4144, 81-94.
8. Ge, Y. & de Moura, L. (2009). "Complete instantiation for quantified formulas in satisfiability modulo theories." *CAV 2009*, LNCS 5643, 306-320.
9. Lopes, N.P. et al. (2021). "Alive2: Bounded translation validation for LLVM." *PLDI 2021*, 65-79.
10. Presburger, M. (1929). "Uber die Vollstandigkeit eines gewissen Systems der Arithmetik ganzer Zahlen." *Comptes Rendus du I Congres des Mathematiciens des Pays Slaves*, 92-101.
11. Tarski, A. (1951). *A Decision Method for Elementary Algebra and Geometry*. University of California Press.
12. Fischer, M.J. & Rabin, M.O. (1974). "Super-exponential complexity of Presburger arithmetic." *SIAM-AMS Proceedings*, 7, 27-41.
