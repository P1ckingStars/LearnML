# Math Reference

## Lattices and Fixed Points

**Definition (Partial Order)**: A relation $\sqsubseteq$ on set $L$ that is reflexive, antisymmetric, and transitive.

**Definition (Lattice)**: A partial order $(L, \sqsubseteq)$ where every pair $\{a, b\}$ has a least upper bound $a \sqcup b$ (join) and greatest lower bound $a \sqcap b$ (meet).

**Definition (Complete Lattice)**: A lattice where every subset has a join and a meet. Equivalently, it has a top element $\top$ and bottom element $\bot$.

**Knaster-Tarski Theorem**: If $f: L \to L$ is monotone on a complete lattice $(L, \sqsubseteq)$, then $f$ has a least fixed point:

$$\text{lfp}(f) = \bigsqcap \{x \in L \mid f(x) \sqsubseteq x\}$$

**Kleene Fixed-Point Theorem**: If $f: L \to L$ is Scott-continuous on a pointed CPO, then:

$$\text{lfp}(f) = \bigsqcup_{n \geq 0} f^n(\bot)$$

## Common Lattices in Compiler Analysis

| Analysis | Lattice | Direction | Meet/Join |
|----------|---------|-----------|-----------|
| Reaching definitions | $\mathcal{P}(\text{Defs})$ | Forward | $\cup$ (join) |
| Live variables | $\mathcal{P}(\text{Vars})$ | Backward | $\cup$ (join) |
| Available expressions | $\mathcal{P}(\text{Exprs})$ | Forward | $\cap$ (meet) |
| Constant propagation | $\bot \sqsubseteq c \sqsubseteq \top$ per variable | Forward | meet |

## Type Rules (Common Patterns)

**Variable**:
$$\frac{x : \tau \in \Gamma}{\Gamma \vdash x : \tau}$$

**Application**:
$$\frac{\Gamma \vdash e_1 : \tau \to \sigma \quad \Gamma \vdash e_2 : \tau}{\Gamma \vdash e_1 \; e_2 : \sigma}$$

**Abstraction**:
$$\frac{\Gamma, x : \tau \vdash e : \sigma}{\Gamma \vdash \lambda x. e : \tau \to \sigma}$$

**Let-Polymorphism**:
$$\frac{\Gamma \vdash e_1 : \tau \quad \Gamma, x : \text{Gen}(\Gamma, \tau) \vdash e_2 : \sigma}{\Gamma \vdash \text{let } x = e_1 \text{ in } e_2 : \sigma}$$

**Subsumption**:
$$\frac{\Gamma \vdash e : \tau \quad \tau <: \sigma}{\Gamma \vdash e : \sigma}$$

## Graph Theory

**Dominator**: Node $d$ dominates node $n$ ($d \text{ dom } n$) if every path from entry to $n$ passes through $d$.

**Immediate Dominator**: $\text{idom}(n)$ is the closest strict dominator of $n$.

**Dominance Frontier**: $\text{DF}(n) = \{w \mid \exists v \in \text{succ}(\text{subtree}(n)), w \in \text{succ}(v), n \text{ does not strictly dominate } w\}$

Simplified: $\text{DF}(n) = \{w \mid n$ dominates a predecessor of $w$ but does not strictly dominate $w\}$

## Complexity Classes

| Problem | Complexity |
|---------|-----------|
| DFA minimization | $O(n \log n)$ |
| NFA to DFA (subset construction) | $O(2^n)$ worst case |
| CYK parsing | $O(n^3 \cdot |G|)$ |
| LL(1)/LR(1) parsing | $O(n)$ |
| Graph coloring (k >= 3) | NP-complete |
| Register allocation (optimal) | NP-complete |
| Alias analysis (exact) | Undecidable |
| Andersen's points-to | $O(n^3)$ |
| Steensgaard's points-to | $O(n \cdot \alpha(n))$ |
