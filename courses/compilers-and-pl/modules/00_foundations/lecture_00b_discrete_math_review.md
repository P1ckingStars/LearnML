# Lecture 00b: Discrete Mathematics for Compilers

**Module 00 -- Mathematical & CS Foundations**
**Prerequisites:** Undergraduate discrete mathematics, basic proof techniques

---

## 1. Sets and Relations

### 1.1 Sets

We assume familiarity with standard set-theoretic notation: $\in$, $\subseteq$, $\cup$, $\cap$, $\setminus$, $\mathcal{P}(S)$ (power set), $S \times T$ (Cartesian product).

**Definition 1.1 (Indexed family).** An *indexed family of sets* is a function $i \mapsto A_i$ for $i \in I$ (an index set). We write $\{A_i\}_{i \in I}$ and define:

$$\bigcup_{i \in I} A_i = \{x \mid \exists i \in I.\ x \in A_i\}, \qquad \bigcap_{i \in I} A_i = \{x \mid \forall i \in I.\ x \in A_i\}.$$

### 1.2 Relations

**Definition 1.2 (Binary relation).** A *binary relation* $R$ on a set $S$ is a subset $R \subseteq S \times S$. We write $x\, R\, y$ for $(x, y) \in R$.

**Properties of relations on $S$:**

| Property | Definition |
|----------|-----------|
| Reflexive | $\forall x.\ x\, R\, x$ |
| Irreflexive | $\forall x.\ \neg(x\, R\, x)$ |
| Symmetric | $x\, R\, y \implies y\, R\, x$ |
| Antisymmetric | $x\, R\, y \land y\, R\, x \implies x = y$ |
| Transitive | $x\, R\, y \land y\, R\, z \implies x\, R\, z$ |

**Definition 1.3.** An *equivalence relation* is reflexive, symmetric, and transitive. The *equivalence class* of $x$ is $[x] = \{y \mid x\, R\, y\}$. The set of all equivalence classes forms a *partition* of $S$.

### 1.3 Closures

**Definition 1.4 (Transitive closure).** The *transitive closure* $R^+$ of $R$ is the smallest transitive relation containing $R$:

$$R^+ = \bigcup_{n=1}^{\infty} R^n, \quad \text{where } R^1 = R,\ R^{n+1} = R^n \circ R.$$

The *reflexive-transitive closure* is $R^* = R^+ \cup \{(x,x) \mid x \in S\}$.

**Proposition 1.5.** $R^+$ can be computed by the Warshall algorithm in $O(|S|^3)$ time.

---

## 2. Partial Orders

### 2.1 Definitions

**Definition 2.1 (Partial order).** A *partial order* (poset) is a pair $(S, \leq)$ where $\leq$ is reflexive, antisymmetric, and transitive.

**Definition 2.2.** Let $(S, \leq)$ be a poset and $A \subseteq S$.

- $u$ is an *upper bound* of $A$ if $\forall a \in A.\ a \leq u$.
- $l$ is a *lower bound* of $A$ if $\forall a \in A.\ l \leq a$.
- The *least upper bound* (supremum, join) $\bigsqcup A$ is the least element among all upper bounds.
- The *greatest lower bound* (infimum, meet) $\bigsqcap A$ is the greatest element among all lower bounds.

For two elements: $a \sqcup b = \bigsqcup\{a, b\}$ and $a \sqcap b = \bigsqcap\{a, b\}$.

**Definition 2.3.** Elements $a, b$ are *comparable* if $a \leq b$ or $b \leq a$; otherwise *incomparable*. A *chain* is a totally ordered subset (all pairs comparable). An *antichain* is a set of pairwise incomparable elements.

**Definition 2.4.** A poset has a *bottom* element $\bot$ if $\forall x.\ \bot \leq x$, and a *top* element $\top$ if $\forall x.\ x \leq \top$.

### 2.2 Hasse Diagrams

A Hasse diagram represents a finite poset by drawing the *covering relation*: $a \lessdot b$ iff $a < b$ and there is no $c$ with $a < c < b$. Elements are drawn bottom-to-top with edges for covering pairs.

---

## 3. Lattices

### 3.1 Definitions

**Definition 3.1 (Lattice).** A poset $(L, \leq)$ is a *lattice* if every two-element subset $\{a, b\}$ has both a join $a \sqcup b$ and a meet $a \sqcap b$ in $L$.

**Definition 3.2 (Complete lattice).** A poset $(L, \leq)$ is a *complete lattice* if every subset $A \subseteq L$ (including $\emptyset$ and $L$ itself) has both $\bigsqcup A$ and $\bigsqcap A$ in $L$.

**Proposition 3.3.** Every complete lattice has $\bot = \bigsqcup \emptyset = \bigsqcap L$ and $\top = \bigsqcap \emptyset = \bigsqcup L$.

**Proposition 3.4.** Every finite lattice is complete.

*Proof.* In a finite lattice, every subset is finite. If $\{a_1, \ldots, a_n\}$ is a subset, then $\bigsqcup\{a_1, \ldots, a_n\} = a_1 \sqcup a_2 \sqcup \cdots \sqcup a_n$ exists by induction on $n$ (using associativity of $\sqcup$). Similarly for meets. $\blacksquare$

### 3.2 Examples Relevant to Compilers

1. **Power set lattice** $(\mathcal{P}(S), \subseteq)$: complete lattice with $\sqcup = \cup$, $\sqcap = \cap$, $\bot = \emptyset$, $\top = S$. Appears in data-flow analysis (e.g., reaching definitions, live variables).

2. **Constant propagation lattice**: For each variable, the lattice $\{\top, c_1, c_2, \ldots, \bot\}$ where $\top$ means "undefined/unknown," each $c_i$ is a specific constant, and $\bot$ means "not a constant" (overdefined). This is a flat lattice of height 2.

3. **Interval lattice** for range analysis: $\{[a,b] \mid a \leq b\} \cup \{\bot\}$ ordered by inclusion ($[a,b] \sqsubseteq [c,d]$ iff $c \leq a$ and $b \leq d$, i.e., the contained interval is lower). Here $\bot = \emptyset$ and $\top = [-\infty, +\infty]$.

4. **Product lattice**: If $(L_1, \leq_1)$ and $(L_2, \leq_2)$ are (complete) lattices, then $L_1 \times L_2$ with componentwise ordering is a (complete) lattice.

### 3.3 Lattice Algebraic Properties

**Proposition 3.5.** In any lattice, the operations $\sqcup$ and $\sqcap$ satisfy:

- **Idempotent:** $a \sqcup a = a$, $a \sqcap a = a$
- **Commutative:** $a \sqcup b = b \sqcup a$, $a \sqcap b = b \sqcap a$
- **Associative:** $a \sqcup (b \sqcup c) = (a \sqcup b) \sqcup c$
- **Absorption:** $a \sqcup (a \sqcap b) = a$, $a \sqcap (a \sqcup b) = a$

**Definition 3.6 (Distributive lattice).** A lattice is *distributive* if:

$$a \sqcap (b \sqcup c) = (a \sqcap b) \sqcup (a \sqcap c)$$

for all $a, b, c$. Equivalently, $a \sqcup (b \sqcap c) = (a \sqcup b) \sqcap (a \sqcup c)$.

**Theorem 3.7 (Birkhoff).** A lattice is distributive iff it contains no sublattice isomorphic to $M_3$ (the diamond) or $N_5$ (the pentagon).

---

## 4. Fixed-Point Theorems

Fixed-point theory is the mathematical foundation of iterative data-flow analysis, abstract interpretation, and denotational semantics.

### 4.1 Monotone Functions

**Definition 4.1.** A function $f: L \to L$ on a poset $(L, \leq)$ is *monotone* (order-preserving) if $x \leq y \implies f(x) \leq f(y)$.

**Definition 4.2.** A *fixed point* of $f$ is an element $x$ with $f(x) = x$. The set of all fixed points is denoted $\text{Fix}(f)$.

### 4.2 Knaster-Tarski Fixed-Point Theorem

**Theorem 4.3 (Knaster-Tarski, 1955).** Let $(L, \leq)$ be a complete lattice and $f: L \to L$ a monotone function. Then $\text{Fix}(f)$ is non-empty and, ordered by $\leq$, forms a complete lattice. In particular:

$$\text{lfp}(f) = \bigsqcap \{x \in L \mid f(x) \leq x\}$$

$$\text{gfp}(f) = \bigsqcup \{x \in L \mid x \leq f(x)\}$$

*Proof (least fixed point).* Let $P = \{x \in L \mid f(x) \leq x\}$ (the set of *pre-fixed points*). Since $L$ is a complete lattice, $P$ is non-empty ($\top \in P$, since $f(\top) \leq \top$). Let $a = \bigsqcap P$.

**Claim 1:** $f(a) \leq a$ (i.e., $a \in P$).
For every $x \in P$, $a \leq x$. By monotonicity, $f(a) \leq f(x) \leq x$. So $f(a)$ is a lower bound of $P$, hence $f(a) \leq \bigsqcap P = a$.

**Claim 2:** $a \leq f(a)$.
From Claim 1 and monotonicity: $f(a) \leq a \implies f(f(a)) \leq f(a)$. So $f(a) \in P$, hence $a \leq f(a)$.

From Claims 1 and 2: $f(a) = a$, so $a$ is a fixed point. Any fixed point $b$ satisfies $f(b) = b \leq b$, so $b \in P$, hence $a \leq b$. Therefore $a = \text{lfp}(f)$. $\blacksquare$

### 4.3 Kleene's Fixed-Point Theorem

**Definition 4.4.** A function $f: L \to L$ is *continuous* (Scott-continuous) if for every directed set $D \subseteq L$, $f(\bigsqcup D) = \bigsqcup f(D)$. (A set $D$ is *directed* if every finite subset has an upper bound in $D$.)

Every continuous function is monotone, but not conversely.

**Theorem 4.5 (Kleene, 1952).** Let $(L, \leq)$ be a complete partial order (CPO) with bottom $\bot$, and let $f: L \to L$ be continuous. Then:

$$\text{lfp}(f) = \bigsqcup_{n=0}^{\infty} f^n(\bot)$$

where $f^0(\bot) = \bot$ and $f^{n+1}(\bot) = f(f^n(\bot))$.

*Proof.* The sequence $\bot \leq f(\bot) \leq f^2(\bot) \leq \cdots$ is an ascending chain (by induction, using $\bot \leq f(\bot)$ and monotonicity). This chain is directed, so $a = \bigsqcup_{n} f^n(\bot)$ exists.

By continuity: $f(a) = f(\bigsqcup_n f^n(\bot)) = \bigsqcup_n f^{n+1}(\bot) = a$. So $a$ is a fixed point.

If $b$ is any fixed point, then $\bot \leq b$ and by induction $f^n(\bot) \leq f^n(b) = b$ for all $n$. Hence $a = \bigsqcup_n f^n(\bot) \leq b$. $\blacksquare$

### 4.4 Application: Data-Flow Analysis

In a data-flow analysis framework, we have:
- A complete lattice $(L, \sqcup, \sqcap)$ of data-flow values.
- A control-flow graph with nodes $n_1, \ldots, n_k$.
- Transfer functions $f_i: L \to L$ for each node $i$.
- A system of equations: $\text{OUT}[n_i] = f_i(\text{IN}[n_i])$ and $\text{IN}[n_i] = \bigsqcup_{p \in \text{pred}(n_i)} \text{OUT}[p]$.

This system defines a monotone function $F: L^k \to L^k$ on the product lattice. By Knaster-Tarski, a least fixed point exists. By Kleene (if $F$ is continuous, e.g., when $L$ has finite height), iterating from $\bot$ converges.

### 4.5 Ascending Chain Condition and Termination

**Definition 4.6.** A poset satisfies the *ascending chain condition* (ACC) if every ascending chain $x_0 \leq x_1 \leq x_2 \leq \cdots$ eventually stabilizes: $\exists N.\ \forall n \geq N.\ x_n = x_N$.

**Proposition 4.7.** If $L$ has finite height (the length of the longest chain is bounded), then $L$ satisfies ACC.

**Corollary 4.8.** If $L$ has finite height and $f: L \to L$ is monotone, then the Kleene iteration $\bot, f(\bot), f^2(\bot), \ldots$ converges to $\text{lfp}(f)$ in at most $h$ steps, where $h$ is the height of $L$.

This justifies the termination of iterative data-flow analysis on lattices of finite height.

---

## 5. Graph Theory for Compilers

### 5.1 Directed Graphs

**Definition 5.1.** A *directed graph* (digraph) is $G = (V, E)$ with $E \subseteq V \times V$.

### 5.2 Directed Acyclic Graphs (DAGs)

**Definition 5.2.** A *DAG* is a directed graph with no directed cycles.

**Theorem 5.3.** A directed graph $G$ is a DAG iff it admits a *topological ordering*: a linear ordering $v_1, v_2, \ldots, v_n$ of vertices such that $(v_i, v_j) \in E \implies i < j$.

**Algorithm (Kahn's topological sort):**

```
function TopologicalSort(G = (V, E)):
    L = empty list        // result
    S = {v in V : in-degree(v) = 0}
    while S is not empty:
        remove a vertex u from S
        append u to L
        for each edge (u, v) in E:
            remove edge (u, v)
            if in-degree(v) == 0:
                add v to S
    if graph still has edges:
        return ERROR (cycle detected)
    return L
```

**Complexity:** $O(|V| + |E|)$.

**Application:** Instruction scheduling, evaluation order for expressions (DAG representation of basic blocks).

### 5.3 Strongly Connected Components

**Definition 5.4.** A *strongly connected component* (SCC) of a digraph is a maximal set $C \subseteq V$ such that for every pair $u, v \in C$, there is a path from $u$ to $v$ and from $v$ to $u$.

**Theorem 5.5.** The condensation (quotient) of a digraph by its SCCs is a DAG.

**Algorithm (Tarjan's SCC algorithm, 1972):**

```
index_counter = 0
S = empty stack
index = {}
lowlink = {}
on_stack = {}
result = []

function strongconnect(v):
    index[v] = index_counter
    lowlink[v] = index_counter
    index_counter += 1
    S.push(v)
    on_stack[v] = true

    for each (v, w) in E:
        if w not in index:
            strongconnect(w)
            lowlink[v] = min(lowlink[v], lowlink[w])
        elif on_stack[w]:
            lowlink[v] = min(lowlink[v], index[w])

    if lowlink[v] == index[v]:
        component = []
        repeat:
            w = S.pop()
            on_stack[w] = false
            component.append(w)
        until w == v
        result.append(component)

for each v in V:
    if v not in index:
        strongconnect(v)
```

**Complexity:** $O(|V| + |E|)$.

**Application:** In compilers, SCCs in the call graph identify sets of mutually recursive functions. SCCs in the control-flow graph correspond to natural loops when combined with dominance analysis.

### 5.4 Dominance

**Definition 5.6.** In a flow graph $(V, E, \text{entry})$, a node $d$ *dominates* node $n$ (written $d\ \text{dom}\ n$) if every path from $\text{entry}$ to $n$ passes through $d$.

**Properties:**
- Reflexive: $n\ \text{dom}\ n$.
- Transitive: $a\ \text{dom}\ b \land b\ \text{dom}\ c \implies a\ \text{dom}\ c$.
- Antisymmetric: $a\ \text{dom}\ b \land b\ \text{dom}\ a \implies a = b$.

Hence the dominance relation is a partial order.

**Definition 5.7.** The *immediate dominator* $\text{idom}(n)$ of $n \neq \text{entry}$ is the unique node $d \neq n$ that dominates $n$ and is dominated by all other dominators of $n$.

**Theorem 5.8.** The immediate dominator is well-defined (unique) for every node except the entry. The immediate dominator relation forms a tree rooted at $\text{entry}$, called the *dominator tree*.

**Algorithm (Lengauer-Tarjan, 1979):**

The Lengauer-Tarjan algorithm computes the dominator tree in $O(|E| \cdot \alpha(|V|))$ time (near-linear), using depth-first search, semidominators, and a union-find data structure. For practical purposes, Cooper, Harvey, and Kennedy (2001) give a simpler iterative algorithm:

```
function ComputeDominators(CFG):
    // Initialize
    doms[entry] = entry
    for each node n != entry:
        doms[n] = undefined

    changed = true
    while changed:
        changed = false
        for each node n in reverse postorder (excluding entry):
            new_idom = first processed predecessor of n
            for each other predecessor p of n:
                if doms[p] is defined:
                    new_idom = intersect(p, new_idom)
            if doms[n] != new_idom:
                doms[n] = new_idom
                changed = true
    return doms

function intersect(b1, b2):
    while b1 != b2:
        while b1 < b2:  // using reverse postorder numbers
            b1 = doms[b1]
        while b2 < b1:
            b2 = doms[b2]
    return b1
```

**Application:** Dominance is fundamental to SSA construction, loop detection, and code motion optimizations.

### 5.5 Dominance Frontiers

**Definition 5.9.** The *dominance frontier* of node $d$ is:

$$\text{DF}(d) = \{n \mid d\ \text{dom}\ \text{pred}(n) \text{ for some predecessor of } n, \text{ but } d \text{ does not strictly dominate } n\}$$

More precisely, $n \in \text{DF}(d)$ iff $d$ dominates some predecessor of $n$ but $d$ does not strictly dominate $n$ itself.

**Application:** Dominance frontiers determine where $\phi$-functions must be placed in SSA form (Cytron et al., 1991).

---

## 6. Induction Principles

### 6.1 Mathematical Induction (Review)

**Principle (Strong/Complete Induction).** Let $P(n)$ be a predicate on $\mathbb{N}$. If for all $n$, $(\forall k < n.\ P(k)) \implies P(n)$, then $\forall n.\ P(n)$.

### 6.2 Structural Induction

**Definition 6.1.** Suppose a set $S$ is defined inductively by:
- **Base cases:** Certain elements are in $S$.
- **Inductive cases:** If certain elements are in $S$, then elements constructed from them are also in $S$.
- **Extremal clause:** Nothing else is in $S$.

**Principle (Structural Induction).** To prove $\forall x \in S.\ P(x)$:
1. **Base cases:** Prove $P(b)$ for each base element $b$.
2. **Inductive cases:** For each constructor $c$, assuming $P(x_1), \ldots, P(x_k)$ for the sub-components, prove $P(c(x_1, \ldots, x_k))$.

**Example 6.2.** Arithmetic expressions defined by:

$$e ::= n \mid e_1 + e_2 \mid e_1 \times e_2$$

To prove a property $P(e)$ for all expressions, prove:
- $P(n)$ for each numeral $n$.
- If $P(e_1)$ and $P(e_2)$, then $P(e_1 + e_2)$.
- If $P(e_1)$ and $P(e_2)$, then $P(e_1 \times e_2)$.

**Example 6.3 (Compiler application).** For a simple expression language with an evaluation function $\text{eval}(e)$ and a compilation function $\text{compile}(e)$ that produces stack machine code, prove *compiler correctness*:

$$\forall e.\ \text{exec}(\text{compile}(e), [\ ]) = [\text{eval}(e)]$$

by structural induction on $e$. The base case handles numerals; inductive cases handle $+$ and $\times$ by assuming the property for sub-expressions.

### 6.3 Well-Founded Induction

**Definition 6.4.** A relation $\prec$ on a set $S$ is *well-founded* if there is no infinite descending chain $\cdots \prec x_2 \prec x_1 \prec x_0$.

Equivalently, every non-empty subset of $S$ has a $\prec$-minimal element.

**Principle (Well-Founded Induction).** If $(S, \prec)$ is well-founded, and for all $x \in S$:

$$(\forall y \prec x.\ P(y)) \implies P(x)$$

then $\forall x \in S.\ P(x)$.

*Proof.* Suppose $\exists x.\ \neg P(x)$. Let $T = \{x \in S \mid \neg P(x)\}$. Since $T \neq \emptyset$ and $\prec$ is well-founded, $T$ has a $\prec$-minimal element $m$. Then $\forall y \prec m.\ P(y)$ (since $y \notin T$), but the hypothesis gives $P(m)$, contradicting $m \in T$. $\blacksquare$

**Remark.** Both mathematical induction (on $\mathbb{N}$) and structural induction are special cases of well-founded induction.

### 6.4 Applications in Compiler Correctness

Well-founded induction is used extensively in:

- **Termination proofs** for optimizations and transformations: define a well-founded measure that decreases with each step.
- **Type soundness proofs** (Wright-Felleisen "progress and preservation"): structural induction on typing derivations and induction on reduction steps.
- **Correctness of fixpoint computations:** the Kleene ascending chain is indexed by ordinals, and convergence is argued by transfinite induction when needed.

---

## 7. Additional Topics

### 7.1 Galois Connections

**Definition 7.1.** A *Galois connection* between posets $(C, \leq_C)$ (concrete domain) and $(A, \leq_A)$ (abstract domain) is a pair of monotone functions $\alpha: C \to A$ (abstraction) and $\gamma: A \to C$ (concretization) satisfying:

$$\alpha(c) \leq_A a \iff c \leq_C \gamma(a)$$

for all $c \in C$, $a \in A$.

**Proposition 7.2.** In a Galois connection $(\alpha, \gamma)$:

1. $\alpha \circ \gamma \circ \alpha = \alpha$ and $\gamma \circ \alpha \circ \gamma = \gamma$.
2. $\gamma \circ \alpha$ is a closure operator on $C$ (extensive, monotone, idempotent).
3. $\alpha \circ \gamma$ is a kernel operator on $A$ (reductive, monotone, idempotent).
4. $\alpha$ preserves all existing joins: $\alpha(\bigsqcup C') = \bigsqcup \alpha(C')$.
5. $\gamma$ preserves all existing meets.

**Application:** Galois connections are the mathematical foundation of abstract interpretation (Cousot & Cousot, 1977). The concrete domain $C$ (e.g., sets of program states) is connected to the abstract domain $A$ (e.g., intervals, signs, polyhedra) via $\alpha$ and $\gamma$.

### 7.2 Boolean Algebras

**Definition 7.3.** A *Boolean algebra* is a complemented distributive lattice: a distributive lattice with $\bot$ and $\top$ where every element $a$ has a complement $\bar{a}$ with $a \sqcup \bar{a} = \top$ and $a \sqcap \bar{a} = \bot$.

**Example:** $(\mathcal{P}(S), \subseteq)$ is a Boolean algebra with $\bar{A} = S \setminus A$.

**Application:** Bit-vector data-flow problems (reaching definitions, live variables, available expressions) operate on Boolean algebras of bit vectors.

---

## References

1. Davey, B. A. and Priestley, H. A. *Introduction to Lattices and Order*, 2nd ed. Cambridge University Press, 2002.
2. Tarski, A. "A lattice-theoretical fixpoint theorem and its applications." *Pacific Journal of Mathematics*, 5(2):285--309, 1955.
3. Kleene, S. C. *Introduction to Metamathematics*. North-Holland, 1952.
4. Cousot, P. and Cousot, R. "Abstract interpretation: a unified lattice model for static analysis of programs by construction or approximation of fixpoints." *POPL*, 1977.
5. Lengauer, T. and Tarjan, R. E. "A fast algorithm for finding dominators in a flowgraph." *ACM TOPLAS*, 1(1):121--141, 1979.
6. Cooper, K. D., Harvey, T. J., and Kennedy, K. "A simple, fast dominance algorithm." *Software Practice and Experience*, 2001.
7. Cytron, R., Ferrante, J., Rosen, B. K., Wegman, M. N., and Zadeck, F. K. "Efficiently computing static single assignment form and the control dependence graph." *ACM TOPLAS*, 13(4):451--490, 1991.
8. Tarjan, R. E. "Depth-first search and linear graph algorithms." *SIAM Journal on Computing*, 1(2):146--160, 1972.
