# Lecture 11c: Abstract Interpretation

## 1. Motivation: Analyzing Infinite-State Programs

Programs over integers, reals, pointers, and heap structures have infinitely many possible states. We cannot enumerate them. Yet we need to prove properties like:
- No division by zero
- No array out-of-bounds access
- No integer overflow
- No null pointer dereference

**Key question:** Can we automatically prove that a program satisfies a safety property, for *all* possible inputs?

### 1.1 A Concrete Example: Why We Need Abstraction

Consider the following program, which reads an integer from the user and performs a division:

```
input(n);            // n is any integer
x := n * n;          // x = n^2
y := x + 1;          // y = n^2 + 1
z := 100 / y;        // Is this division safe?
```

We want to prove that the division on line 4 never divides by zero. To do this concretely, we would need to check every possible value of `n`:
- If $n = 0$: $x = 0$, $y = 1$, $z = 100$. Safe.
- If $n = 1$: $x = 1$, $y = 2$, $z = 50$. Safe.
- If $n = -1$: $x = 1$, $y = 2$, $z = 50$. Safe.
- If $n = 2$: $x = 4$, $y = 5$, $z = 20$. Safe.
- ...

But $n$ ranges over all of $\mathbb{Z}$ -- there are infinitely many cases. Concrete enumeration is impossible.

**The abstraction idea.** Instead of tracking every possible value, we track a *property* of the values. For instance, using the sign domain: after line 2, we know $x = n^2 \ge 0$, so $x$ has sign $\ge 0$. After line 3, $y = x + 1$ has sign $+$ (strictly positive, since $x \ge 0$ and $1 > 0$). Since $y$ is strictly positive, it is never zero, and the division on line 4 is safe.

We proved safety for *all* inputs at once, by reasoning about abstract properties (signs) instead of concrete values. This is the core idea of abstract interpretation.

**What we traded away.** We lost the ability to know the exact value of `z`. The sign domain tells us `z` has sign $\top$ (could be anything), even though a human can see that $z$ is always a positive integer. This is the precision/computability trade-off: we gain decidability and termination, at the cost of sometimes being imprecise.

Abstract interpretation, introduced by Patrick and Radhia Cousot (1977), provides a mathematically rigorous framework for approximating program semantics. It trades precision for computability: we compute an *over-approximation* of all reachable states, and if the over-approximation satisfies the safety property, so does the program.

### 1.2 Roadmap

The remainder of this lecture is organized around a logical progression:

1. **The problem** (Section 1): Programs have infinitely many states, so we cannot analyze them exactly.
2. **Mathematical tools** (Section 2): We need lattices and fixed-point theorems to formalize what "approximation" means.
3. **The bridge** (Section 3): Galois connections formalize the relationship between concrete and abstract worlds, telling us precisely what information we keep and what we discard.
4. **The framework** (Section 4): We define abstract semantics and prove that they soundly over-approximate concrete semantics.
5. **Domain design** (Section 5): We build specific abstract domains -- sign, interval, octagon, polyhedra -- each offering a different precision/cost trade-off.
6. **Convergence** (Section 6): Widening and narrowing ensure termination of fixed-point computation on infinite-height lattices while recovering precision.
7. **Composition** (Section 7): The reduced product lets us combine the strengths of multiple domains.
8. **Applications** (Sections 8-12): We connect the framework to pointer analysis, dataflow analysis, and real-world tools like Astree, Frama-C, and Facebook Infer.

---

## 2. Mathematical Foundations

Before we can define abstract interpretation precisely, we need the language of partial orders, lattices, and fixed points. These are the mathematical scaffolding on which the entire framework rests.

### 2.1 Lattices and Partial Orders

**Definition.** A *partially ordered set* (poset) $(L, \sqsubseteq)$ is a set $L$ with a reflexive, antisymmetric, transitive relation $\sqsubseteq$.

**Definition.** A *complete lattice* $(L, \sqsubseteq, \sqcup, \sqcap, \bot, \top)$ is a poset where every subset $S \subseteq L$ has a least upper bound $\bigsqcup S$ (join) and a greatest lower bound $\bigsqcap S$ (meet). The least element is $\bot = \bigsqcup \emptyset$ and the greatest element is $\top = \bigsqcap \emptyset$.

**Examples:**
- $(\mathcal{P}(\mathbb{Z}), \subseteq, \cup, \cap, \emptyset, \mathbb{Z})$: the powerset of integers, ordered by inclusion.
- $(\text{Intervals}, \sqsubseteq)$: the lattice of intervals $[a, b]$ where $a \in \mathbb{Z} \cup \{-\infty\}$, $b \in \mathbb{Z} \cup \{+\infty\}$, ordered by inclusion.

### 2.2 Fixed Points

**Theorem (Knaster-Tarski).** Let $(L, \sqsubseteq)$ be a complete lattice and $f : L \to L$ a monotone function ($x \sqsubseteq y \implies f(x) \sqsubseteq f(y)$). Then $f$ has a least fixed point:

$$\text{lfp}(f) = \bigsqcap \{x \in L \mid f(x) \sqsubseteq x\}$$

and a greatest fixed point:

$$\text{gfp}(f) = \bigsqcup \{x \in L \mid x \sqsubseteq f(x)\}$$

*Proof (least fixed point).* Let $P = \{x \in L \mid f(x) \sqsubseteq x\}$ (the set of pre-fixed points). Let $d = \bigsqcap P$. We show $f(d) = d$.

For any $x \in P$: $d \sqsubseteq x$ (since $d$ is the greatest lower bound of $P$), so $f(d) \sqsubseteq f(x) \sqsubseteq x$ (by monotonicity and the pre-fixed point property). Since this holds for all $x \in P$, $f(d) \sqsubseteq d$ (as $f(d)$ is a lower bound of $P$, and $d$ is the greatest lower bound). Thus $d$ is a pre-fixed point: $f(d) \sqsubseteq d$.

By monotonicity, $f(f(d)) \sqsubseteq f(d)$, so $f(d) \in P$. Therefore $d \sqsubseteq f(d)$.

Combining: $f(d) = d$. $\blacksquare$

**Kleene's Fixed Point Theorem.** If $f$ is Scott-continuous (preserves suprema of directed sets), or if $L$ satisfies the ascending chain condition (no infinite strictly ascending chains), then:

$$\text{lfp}(f) = \bigsqcup_{i \ge 0} f^i(\bot) = \bot \sqcup f(\bot) \sqcup f^2(\bot) \sqcup \cdots$$

This is computable by iterating $f$ from $\bot$ until stabilization.

With lattices and fixed points in hand, we now have the tools to talk about approximation precisely. The next step is to formalize the connection between the concrete world (sets of program states) and the abstract world (elements of an abstract domain).

---

## 3. Galois Connections

A Galois connection is the formal bridge between the concrete semantics (what the program actually does) and the abstract semantics (what our analysis computes). It tells us exactly how to move back and forth between concrete sets of values and their abstract representations, and it characterizes precisely what information is lost in the process.

### 3.1 Definition

**Definition.** A *Galois connection* between posets $(C, \le)$ (concrete domain) and $(A, \sqsubseteq)$ (abstract domain) is a pair of monotone functions $(\alpha, \gamma)$:

$$\alpha : C \to A \qquad \text{(abstraction)}$$
$$\gamma : A \to C \qquad \text{(concretization)}$$

satisfying:

$$\forall c \in C, a \in A.\quad \alpha(c) \sqsubseteq a \iff c \le \gamma(a)$$

Equivalently:
1. $c \le \gamma(\alpha(c))$ for all $c \in C$ (abstraction may lose information)
2. $\alpha(\gamma(a)) \sqsubseteq a$ for all $a \in A$ (concretization is "tight")

**Notation:** We write $C \xrightarrow[\gamma]{\alpha} A$ or $(C, \alpha, \gamma, A)$.

### 3.2 Properties of Galois Connections

**Proposition.** In a Galois connection $(\alpha, \gamma)$:
1. $\alpha$ preserves all joins: $\alpha(\bigsqcup S) = \bigsqcup \{\alpha(s) \mid s \in S\}$
2. $\gamma$ preserves all meets: $\gamma(\bigsqcap S) = \bigsqcap \{\gamma(s) \mid s \in S\}$
3. $\gamma \circ \alpha$ is a closure operator (extensive, monotone, idempotent)
4. $\alpha \circ \gamma$ is a kernel operator (reductive, monotone, idempotent)

### 3.3 Example: Sign Abstraction

Concrete domain: $(\mathcal{P}(\mathbb{Z}), \subseteq)$

Abstract domain: $\text{Sign} = \{\bot, -, 0, +, \le 0, \ge 0, \ne 0, \top\}$ with the obvious ordering.

$$\alpha(S) = \begin{cases} \bot & \text{if } S = \emptyset \\ + & \text{if } S \subseteq \{1, 2, 3, \ldots\} \\ - & \text{if } S \subseteq \{-1, -2, -3, \ldots\} \\ 0 & \text{if } S = \{0\} \\ \ge 0 & \text{if } S \subseteq \{0, 1, 2, \ldots\} \text{ and } 0 \in S \text{ and } S \not\subseteq \{0\} \\ \text{etc.} \end{cases}$$

$$\gamma(+) = \{1, 2, 3, \ldots\}, \quad \gamma(-) = \{-1, -2, -3, \ldots\}, \quad \gamma(\top) = \mathbb{Z}$$

**Information loss in the sign domain.** Consider $S = \{3, 7, 42\}$. Then $\alpha(S) = +$ and $\gamma(+) = \{1, 2, 3, \ldots\}$. Notice that $\gamma(\alpha(S)) = \{1, 2, 3, \ldots\} \supsetneq \{3, 7, 42\} = S$. The round-trip $\gamma \circ \alpha$ is lossy: we went from knowing the exact three values to knowing only that they are positive. This is the price of abstraction.

### 3.4 Example: Interval Abstraction

Concrete domain: $(\mathcal{P}(\mathbb{Z}), \subseteq)$.

Abstract domain: Intervals $[a, b]$ with $a \in \mathbb{Z} \cup \{-\infty\}$, $b \in \mathbb{Z} \cup \{+\infty\}$, plus $\bot$.

The Galois connection is:

$$\alpha(S) = \begin{cases} \bot & \text{if } S = \emptyset \\ [\min(S), \max(S)] & \text{otherwise} \end{cases}$$

$$\gamma([a, b]) = \{n \in \mathbb{Z} \mid a \le n \le b\}, \qquad \gamma(\bot) = \emptyset$$

**Worked example 1.** Let $S = \{2, 5, 9\}$. Then $\alpha(S) = [2, 9]$ and $\gamma([2, 9]) = \{2, 3, 4, 5, 6, 7, 8, 9\}$. We have $\gamma(\alpha(S)) = \{2, 3, 4, 5, 6, 7, 8, 9\} \supsetneq \{2, 5, 9\} = S$. The gaps (3, 4, 6, 7, 8) were filled in, because intervals cannot represent sets with holes.

**Worked example 2.** Let $S = \{-3, 0, 100\}$. Then $\alpha(S) = [-3, 100]$, and $\gamma([-3, 100])$ is all integers from $-3$ to $100$ -- a set of 104 elements, while $S$ had only 3. The information loss is severe here because the values are spread out.

**Worked example 3 (no loss).** Let $S = \{4, 5, 6, 7\}$. Then $\alpha(S) = [4, 7]$ and $\gamma([4, 7]) = \{4, 5, 6, 7\} = S$. When $S$ is already a contiguous range of integers, no information is lost. In this case the Galois connection is *exact* for this particular input.

### 3.5 Example: Parity Abstraction

Abstract domain: $\text{Parity} = \{\bot, \text{even}, \text{odd}, \top\}$.

$$\alpha(S) = \begin{cases} \bot & \text{if } S = \emptyset \\ \text{even} & \text{if all elements of } S \text{ are even} \\ \text{odd} & \text{if all elements of } S \text{ are odd} \\ \top & \text{otherwise} \end{cases}$$

$$\gamma(\text{even}) = \{\ldots, -4, -2, 0, 2, 4, \ldots\}, \quad \gamma(\text{odd}) = \{\ldots, -3, -1, 1, 3, \ldots\}, \quad \gamma(\top) = \mathbb{Z}$$

**Information loss.** $\alpha(\{2, 4\}) = \text{even}$, but $\gamma(\text{even})$ is all even integers. We lost the information that the values are small.

**Why this is a valid Galois connection.** We can verify the defining property: $\alpha(S) \sqsubseteq a \iff S \subseteq \gamma(a)$. For instance, $\alpha(\{2, 4\}) = \text{even} \sqsubseteq \top$, and indeed $\{2, 4\} \subseteq \gamma(\top) = \mathbb{Z}$. Conversely, $\alpha(\{2, 3\}) = \top \not\sqsubseteq \text{even}$, and indeed $\{2, 3\} \not\subseteq \gamma(\text{even}) = \{\ldots, -2, 0, 2, 4, \ldots\}$.

Now that we have the bridge between concrete and abstract worlds, we can build the abstract interpretation framework itself: define what it means to run a program abstractly, and prove that doing so gives sound results.

---

## 4. The Abstract Interpretation Framework

### 4.1 Concrete Semantics as a Fixed Point

Consider a program with control flow graph $G = (V, E)$. The *collecting semantics* maps each program point to the set of all possible states reaching that point.

**Definition.** The *concrete semantic function* $F : (V \to \mathcal{P}(\text{State})) \to (V \to \mathcal{P}(\text{State}))$ is:

$$F(\mathcal{S})(v) = \text{Init}(v) \cup \bigcup_{(u, v) \in E} [\![ u \to v ]\!](\mathcal{S}(u))$$

where $[\![ u \to v ]\!]$ is the concrete transfer function for edge $(u, v)$.

The collecting semantics is $\mathcal{S}^* = \text{lfp}(F)$, the least fixed point.

### 4.2 Abstract Semantics

The *abstract semantic function* $F^\sharp : (V \to A) \to (V \to A)$ is:

$$F^\sharp(\mathcal{S}^\sharp)(v) = \text{Init}^\sharp(v) \sqcup \bigsqcup_{(u, v) \in E} [\![ u \to v ]\!]^\sharp(\mathcal{S}^\sharp(u))$$

where $[\![ u \to v ]\!]^\sharp$ is the abstract transfer function.

The abstract semantics is $\mathcal{S}^{\sharp*} = \text{lfp}(F^\sharp)$.

### 4.3 Soundness Condition

**Definition.** An abstract transfer function $f^\sharp$ is *sound* with respect to concrete transfer function $f$ if:

$$\alpha \circ f \sqsubseteq f^\sharp \circ \alpha$$

Equivalently: $f \circ \gamma \le \gamma \circ f^\sharp$ (applying the concrete function to any concretized abstract value is contained in the concretization of the abstract result).

### 4.4 Intuition for the Soundness Theorem

Before stating the theorem formally, let us build intuition for what it says and why over-approximation is safe.

**The box-and-marble analogy.** Think of the concrete reachable states as a marble, and the abstract result as a box that contains the marble. The soundness theorem says: if we can prove the box does not touch the "danger zone" (e.g., a state where a division by zero occurs), then the marble inside the box cannot be in the danger zone either. The box might be much larger than the marble -- it might include many states that the program never actually reaches -- but that is fine. We may get *false alarms* (the box overlaps the danger zone but the marble does not), but we will never get *false assurances* (claiming safety when the marble is actually in the danger zone).

**In formal terms:** the abstract fixed point $\text{lfp}(F^\sharp)$ contains (over-approximates) the abstraction of the concrete fixed point $\alpha(\text{lfp}(F))$. So if the abstract fixed point satisfies a safety property (e.g., "no division by zero at any program point"), the concrete collecting semantics does too.

This is why over-approximation gives *soundness*: we may report bugs that do not exist (false positives), but we will never miss a real bug (no false negatives). In safety-critical contexts, this is exactly the guarantee we need.

**Theorem (Soundness of Abstract Interpretation).** If all abstract transfer functions are sound, then:

$$\alpha(\text{lfp}(F)) \sqsubseteq \text{lfp}(F^\sharp)$$

That is, the abstract fixed point over-approximates the abstraction of the concrete fixed point.

*Proof.* We prove by induction on the Kleene iteration. Let $F^0(\bot) = \bot$ and $F^{i+1}(\bot) = F(F^i(\bot))$. Similarly for $F^\sharp$.

Claim: $\alpha(F^i(\bot_C)) \sqsubseteq (F^\sharp)^i(\bot_A)$ for all $i$.

Base: $\alpha(\bot_C) = \alpha(\emptyset) = \bot_A \sqsubseteq \bot_A$. Check.

Inductive step: Assume $\alpha(F^i(\bot_C)) \sqsubseteq (F^\sharp)^i(\bot_A)$.

$\alpha(F^{i+1}(\bot_C)) = \alpha(F(F^i(\bot_C))) \sqsubseteq F^\sharp(\alpha(F^i(\bot_C))) \sqsubseteq F^\sharp((F^\sharp)^i(\bot_A)) = (F^\sharp)^{i+1}(\bot_A)$

The first inequality is soundness; the second is monotonicity of $F^\sharp$.

Taking the limit (join): $\alpha(\text{lfp}(F)) = \alpha(\bigsqcup_i F^i(\bot_C)) = \bigsqcup_i \alpha(F^i(\bot_C)) \sqsubseteq \bigsqcup_i (F^\sharp)^i(\bot_A) = \text{lfp}(F^\sharp)$. $\blacksquare$

### 4.5 Best Abstract Transformer

**Definition.** The *best abstract transformer* for concrete function $f$ is:

$$f^\sharp_{\text{best}} = \alpha \circ f \circ \gamma$$

**Theorem.** $f^\sharp_{\text{best}}$ is the most precise sound abstract transformer.

*Proof.* Soundness: we need $\alpha \circ f \sqsubseteq f^\sharp_{\text{best}} \circ \alpha$. By definition $f^\sharp_{\text{best}} = \alpha \circ f \circ \gamma$, so $f^\sharp_{\text{best}} \circ \alpha = \alpha \circ f \circ \gamma \circ \alpha \sqsupseteq \alpha \circ f$ (since $\gamma \circ \alpha \sqsupseteq \text{id}$ in any Galois connection).

More directly: for any sound $g^\sharp$ (i.e., $\alpha \circ f \sqsubseteq g^\sharp \circ \alpha$), we have $\alpha \circ f \circ \gamma \sqsubseteq g^\sharp \circ \alpha \circ \gamma \sqsubseteq g^\sharp$ (using $\alpha \circ \gamma \sqsubseteq \text{id}$). Therefore $f^\sharp_{\text{best}} \sqsubseteq g^\sharp$. $\blacksquare$

In practice, we often cannot compute the best transformer exactly (it requires computing $\gamma$, applying $f$ to possibly infinite sets, and re-abstracting). We use sound but less precise transformers.

### 4.6 Complete End-to-End Worked Example

To make the framework concrete, we walk through an entire abstract interpretation on a small program, from CFG construction through Kleene iteration, widening, narrowing, and final safety check. We use the interval domain.

**The program:**

```
// Program P: compute the sum 1 + 2 + ... + n for n = 10
x := 0;
i := 1;
while (i <= 10):
    x := x + i;
    i := i + 1;
assert(x <= 100);
```

We want to prove that the assertion `x <= 100` holds.

**Step 1: Control Flow Graph.**

The CFG has 5 nodes:

```
  [1: x:=0]  -->  [2: i:=1]  -->  [3: loop head]
                                    |           |
                              (i<=10)|     (i>10)|
                                    v           v
                              [4: body]    [5: assert]
                              x:=x+i;
                              i:=i+1;
                                 |
                                 +---> back to [3]
```

Edges: $(1, 2)$, $(2, 3)$, $(3, 4)$ with guard $i \le 10$, $(4, 3)$ back edge, $(3, 5)$ with guard $i > 10$.

**Step 2: Initial abstract state.**

We assign $\bot$ (unreachable) to every node except the entry:

| Node | Initial state |
|---|---|
| 1 | $x = \top, i = \top$ (entry) |
| 2 | $\bot$ |
| 3 | $\bot$ |
| 4 | $\bot$ |
| 5 | $\bot$ |

**Step 3: Kleene iteration (with widening at the loop head, node 3).**

We apply $F^\sharp$ repeatedly. For readability, we show only the interval for $(x, i)$ at each node. Widening is applied at node 3 (the loop head) because it is the target of a back edge.

**Iteration 0:**

| Node | State |
|---|---|
| 1 | $(x{=}\top, i{=}\top)$ |
| 2 | $\bot$ |
| 3 | $\bot$ |
| 4 | $\bot$ |
| 5 | $\bot$ |

**Iteration 1:** Propagate from node 1.

- Node 2: after `x := 0`, we get $(x{=}[0,0], i{=}\top)$. After `i := 1`, we get $(x{=}[0,0], i{=}[1,1])$.
- Node 3: receives from node 2: $(x{=}[0,0], i{=}[1,1])$. Since the old value was $\bot$, widening is: $\bot \nabla [0,0] = [0,0]$ and $\bot \nabla [1,1] = [1,1]$. Result: $(x{=}[0,0], i{=}[1,1])$.
- Node 4: guard $i \le 10$ applied to $(x{=}[0,0], i{=}[1,1])$: $i$ constrained to $[1, \min(1,10)] = [1,1]$. After body: $x := x + i$ gives $x{=}[0+1, 0+1] = [1,1]$; $i := i + 1$ gives $i{=}[2,2]$. State: $(x{=}[1,1], i{=}[2,2])$.
- Node 5: guard $i > 10$ applied to $(x{=}[0,0], i{=}[1,1])$: $i$ constrained to $[\max(1,11), 1] = \bot$. Node 5 is unreachable so far.

| Node | State after iteration 1 |
|---|---|
| 3 | $(x{=}[0,0], i{=}[1,1])$ |
| 4 | $(x{=}[1,1], i{=}[2,2])$ |
| 5 | $\bot$ |

**Iteration 2:** Node 3 receives the back edge from node 4.

- Node 3: join of incoming from node 2 and node 4: $(x{=}[0,0], i{=}[1,1]) \sqcup (x{=}[1,1], i{=}[2,2]) = (x{=}[0,1], i{=}[1,2])$.
- **Widening** at node 3: old $= (x{=}[0,0], i{=}[1,1])$, new $= (x{=}[0,1], i{=}[1,2])$.
  - $x$: $[0,0] \nabla [0,1]$. Lower bound: $0 \ge 0$, keep $0$. Upper bound: $1 > 0$, jump to $+\infty$. Result: $[0, +\infty]$.
  - $i$: $[1,1] \nabla [1,2]$. Lower bound: $1 \ge 1$, keep $1$. Upper bound: $2 > 1$, jump to $+\infty$. Result: $[1, +\infty]$.
  - Node 3 state: $(x{=}[0, +\infty], i{=}[1, +\infty])$.

- Node 4: guard $i \le 10$: $i{=}[1, 10]$. After body: $x := x + i$ gives $x{=}[0+1, +\infty] = [1, +\infty]$; $i := i + 1$ gives $i{=}[2, 11]$. State: $(x{=}[1, +\infty], i{=}[2, 11])$.

- Node 5: guard $i > 10$: $i{=}[11, +\infty]$. State: $(x{=}[0, +\infty], i{=}[11, +\infty])$.

**Iteration 3:** Node 3 receives back edge.

- Node 3: join: $(x{=}[0,0], i{=}[1,1]) \sqcup (x{=}[1, +\infty], i{=}[2, 11]) = (x{=}[0, +\infty], i{=}[1, 11])$.
- **Widening**: old $= (x{=}[0, +\infty], i{=}[1, +\infty])$, new $= (x{=}[0, +\infty], i{=}[1, 11])$.
  - $x$: $[0,+\infty] \nabla [0,+\infty] = [0,+\infty]$. Stable.
  - $i$: $[1,+\infty] \nabla [1,11]$. Lower: $1 \ge 1$, keep $1$. Upper: $11 \le +\infty$, keep $+\infty$. Result: $[1,+\infty]$. Stable.
  - Node 3 is stable: $(x{=}[0, +\infty], i{=}[1, +\infty])$.

The widened fixed point has been reached.

**Step 4: Narrowing to recover precision.**

Widening over-shot: it says $i \in [1, +\infty]$ and $x \in [0, +\infty]$ at the loop head. We apply narrowing iterations.

**Narrowing iteration 1.** Recompute $F^\sharp$ from the widened result and narrow.

- Node 3 from $F^\sharp$: join of node 2 and node 4 contributions.
  - From node 2: $(x{=}[0,0], i{=}[1,1])$.
  - From node 4 (with $i{=}[1,10]$ in the loop body): $x{=}[1, +\infty], i{=}[2, 11]$.
  - Join: $(x{=}[0, +\infty], i{=}[1, 11])$.
- Narrowing: $(x{=}[0, +\infty], i{=}[1, +\infty]) \Delta (x{=}[0, +\infty], i{=}[1, 11])$.
  - $x$: $[0, +\infty] \Delta [0, +\infty] = [0, +\infty]$. ($+\infty$ stays $+\infty$ since the new upper bound is also $+\infty$.)
  - $i$: $[1, +\infty] \Delta [1, 11] = [1, 11]$. (Upper bound was $+\infty$, replaced by $11$.)
  - Node 3: $(x{=}[0, +\infty], i{=}[1, 11])$.

**Narrowing iteration 2.** Re-propagate with the tighter node 3 state.

- Node 4: guard $i \le 10$: $i{=}[1,10]$. Body: $x{=}[0+1, +\infty] = [1, +\infty]$, $i{=}[2, 11]$.
- Node 3 from $F^\sharp$: join: $(x{=}[0, +\infty], i{=}[1, 11])$.
- Narrowing: $(x{=}[0, +\infty], i{=}[1, 11]) \Delta (x{=}[0, +\infty], i{=}[1, 11])$. Stable.

Note: The non-relational interval domain cannot determine the upper bound of $x$ here because $x$ depends on the sum $1 + 2 + \cdots + i$, which requires tracking the relationship between $x$ and $i$. The interval domain gives $x \in [0, +\infty]$.

**Step 5: Safety check.**

At node 5 (after the loop), with the narrowed node 3 state $(x{=}[0, +\infty], i{=}[1, 11])$, applying guard $i > 10$: $i{=}[11, 11]$.

The assertion is `x <= 100`. The abstract state says $x \in [0, +\infty]$. Since $+\infty > 100$, the analysis **cannot prove the assertion** -- it reports a potential alarm.

This is a false alarm: the actual value of $x$ at the end is $55$, which satisfies $x \le 100$. To prove this, we would need a relational domain (e.g., polyhedra) that can track the invariant $x = i(i-1)/2$, or at minimum track a linear relation between $x$ and $i$. This illustrates the precision/cost trade-off: the interval domain is efficient but insufficient for this property.

**If we change the assertion to** `x >= 0`, the interval domain succeeds: $x \in [0, +\infty]$ clearly satisfies $x \ge 0$, so the program is verified safe.

---

## 5. Numerical Abstract Domains

With the framework in place -- lattices, Galois connections, abstract semantics, soundness -- we now turn to designing specific abstract domains. Each domain makes a different choice about what information to track, leading to different precision/cost trade-offs. We begin with the simplest domain and progress toward more expressive (and expensive) ones.

### 5.1 The Sign Domain (Complete Worked Example)

**Domain:** $\text{Sign} = \{\bot, -, 0, +, \le 0, \ge 0, \ne 0, \top\}$

**Lattice structure:**
```
              top
           /  |   \
        <=0  !=0   >=0
        / \  / \  / \
       -    0    +
        \   |   /
          bot
```

**Abstract operations:**

Addition ($\oplus^\sharp$):

| $\oplus^\sharp$ | $-$ | $0$ | $+$ |
|---|---|---|---|
| $-$ | $-$ | $-$ | $\top$ |
| $0$ | $-$ | $0$ | $+$ |
| $+$ | $\top$ | $+$ | $+$ |

(Extended to $\le 0$, $\ge 0$, etc. by case analysis.)

Multiplication ($\otimes^\sharp$):

| $\otimes^\sharp$ | $-$ | $0$ | $+$ |
|---|---|---|---|
| $-$ | $+$ | $0$ | $-$ |
| $0$ | $0$ | $0$ | $0$ |
| $+$ | $-$ | $0$ | $+$ |

**Example analysis.** Consider the program:

```
x := 5;       // x = +
y := -3;      // y = -
z := x + y;   // z = top (+ + - = top)
w := x * y;   // w = - (+ * - = -)
```

The sign domain loses precision for $z$ (we don't know the sign of $5 + (-3)$), but correctly determines $w < 0$.

### 5.2 The Interval Domain

**Domain.** Abstract values are intervals $[a, b]$ where $a \in \mathbb{Z} \cup \{-\infty\}$, $b \in \mathbb{Z} \cup \{+\infty\}$, plus $\bot$ (empty set).

**Ordering.** $[a, b] \sqsubseteq [c, d] \iff c \le a \land b \le d$

**Join.** $[a, b] \sqcup [c, d] = [\min(a, c), \max(b, d)]$

**Meet.** $[a, b] \sqcap [c, d] = [\max(a, c), \min(b, d)]$ (or $\bot$ if empty)

**Abstract operations:**

$$[a, b] +^\sharp [c, d] = [a + c, b + d]$$
$$[a, b] -^\sharp [c, d] = [a - d, b - c]$$
$$[a, b] \times^\sharp [c, d] = [\min(ac, ad, bc, bd), \max(ac, ad, bc, bd)]$$

Division requires care with zero:
$$[a, b] /^\sharp [c, d] = \begin{cases} \bot & \text{if } [c,d] = [0,0] \\ [a, b] \times^\sharp [1/d, 1/c] & \text{if } 0 \notin [c, d] \\ \top & \text{otherwise (warning: possible div by zero)} \end{cases}$$

**Comparison (filter/guard).** For $x \le y$ where $x \in [a, b]$ and $y \in [c, d]$:
$$x' = [a, \min(b, d)], \quad y' = [\max(a, c), d]$$

**Example analysis.**
```
x := 0;                // x in [0, 0]
while (x < 100):       // guard: x in [0, 99]  (after widening convergence)
    x := x + 1;        // x in [1, 100]
// after loop:          // x in [100, 100]  (with narrowing)
```

### 5.3 The Octagon Domain

**Definition (Mine 2006).** The octagon domain represents constraints of the form $\pm x_i \pm x_j \le c$ (difference-bound constraints between pairs of variables and their negations).

**Representation.** A *Difference Bound Matrix* (DBM) of size $2n \times 2n$, where variable $x_i$ is encoded as two "virtual" variables $x_i^+ = x_i$ and $x_i^- = -x_i$.

The constraint $x_i - x_j \le c$ becomes an entry in the DBM. Closure is computed by the Floyd-Warshall shortest-path algorithm in $O(n^3)$.

**Expressiveness.** Octagons can express:
- $x \le c$, $x \ge c$ (unary bounds)
- $x - y \le c$ (difference constraints)
- $x + y \le c$ (sum constraints)
- But NOT $2x - y \le c$ (non-unit coefficients)

**Trade-off.** More precise than intervals (which are non-relational), less precise than polyhedra, with $O(n^3)$ complexity per operation (vs. exponential for polyhedra).

### 5.4 The Polyhedral Domain

**Definition (Cousot & Halbwachs 1978).** The polyhedral domain represents conjunctions of linear inequalities $\sum_i a_i x_i \le b$ with arbitrary rational coefficients.

**Representation.** Two dual representations:
1. **Constraint form:** $Ax \le b$ (set of half-spaces)
2. **Generator form:** Vertices, rays, and lines (by Minkowski-Weyl theorem)

**Chernikova's algorithm** converts between the two representations. Operations:
- **Join:** Convex hull (efficient in generator form)
- **Meet:** Intersection (efficient in constraint form)
- **Transfer functions:** Affine transformations

**Complexity.** The number of generators can be exponential in the number of constraints (and vice versa). In practice, the polyhedral domain is expensive but very precise for programs with linear arithmetic.

### 5.5 The Zone Domain (DBMs)

**Definition.** The zone domain represents constraints of the form $x_i - x_j \le c$ (pure difference constraints). This is a subset of octagon constraints.

**Representation.** A $n \times n$ DBM where entry $(i, j) = c$ means $x_i - x_j \le c$. A special variable $x_0 = 0$ encodes unary bounds: $x_i \le c$ becomes $x_i - x_0 \le c$.

**Closure.** Floyd-Warshall in $O(n^3)$, or incremental closure in $O(n^2)$ when adding a single constraint.

### 5.6 Comparison of Numerical Domains

The following table summarizes the trade-offs. The last two rows give concrete examples of what each domain can and cannot express, to build intuition about their limitations.

| Property | Sign | Interval | Zone (DBM) | Octagon | Polyhedra |
|---|---|---|---|---|---|
| **Constraints** | sign of each var | $a \le x \le b$ | $x - y \le c$ | $\pm x \pm y \le c$ | $\sum a_i x_i \le b$ |
| **Time per op** | $O(1)$ per var | $O(1)$ per var | $O(n^2)$ | $O(n^3)$ | exponential |
| **Space** | $O(n)$ | $O(n)$ | $O(n^2)$ | $O(n^2)$ | exponential |
| **Relational?** | No | No | Yes | Yes | Yes |
| **Example it CAN express** | "$x$ is positive" | "$x$ is between 0 and 100" | "$x - y \le 5$" (e.g., a lock is acquired before release) | "$x + y \le 10$" (e.g., two resource counters sum to at most 10) | "$2x - 3y \le 7$" (arbitrary linear invariant) |
| **Example it CANNOT express** | "$x$ is between 1 and 10" (only knows sign) | "$x = 2y$" (no relation between variables) | "$x + y \le 10$" (only differences, not sums) | "$2x - y \le 5$" (only unit coefficients) | "$xy \le 100$" (nonlinear constraint) |

Each domain is strictly more expressive than the ones above it (sign < interval < zone < octagon < polyhedra for the numerical properties they track), but each step up the hierarchy comes with significantly higher computational cost.

---

## 6. Widening and Narrowing

We have defined abstract semantics as the least fixed point of $F^\sharp$, computed by Kleene iteration. But what happens when the abstract lattice has infinite ascending chains? The iteration may never converge. This section introduces widening (to force convergence) and narrowing (to recover precision lost by widening).

### 6.1 The Problem of Non-Termination

When the abstract domain has infinite ascending chains, the Kleene iteration $\bot, F^\sharp(\bot), (F^\sharp)^2(\bot), \ldots$ may not converge.

**Example.** In the interval domain, analyzing:
```
x := 0;
while (true):
    x := x + 1;
```

The Kleene iteration produces: $[0,0], [0,1], [0,2], [0,3], \ldots$ -- an infinite ascending chain that never stabilizes.

### 6.2 Widening Operator

**Definition.** A *widening operator* $\nabla : A \times A \to A$ satisfies:
1. **Upper bound:** $a \sqsubseteq a \nabla b$ and $b \sqsubseteq a \nabla b$
2. **Convergence guarantee:** For any sequence $a_0, a_1, a_2, \ldots$, the sequence $w_0 = a_0$, $w_{i+1} = w_i \nabla a_{i+1}$ eventually stabilizes (after finitely many steps).

**Interval widening.** For intervals $[a, b]$ and $[c, d]$:

$$[a, b] \nabla [c, d] = \left[\begin{cases} a & \text{if } c \ge a \\ -\infty & \text{if } c < a \end{cases},\; \begin{cases} b & \text{if } d \le b \\ +\infty & \text{if } d > b \end{cases}\right]$$

**Intuition:** If a bound is growing, immediately jump to infinity. This guarantees convergence in at most 3 iterations per variable (finite to $-\infty$/$+\infty$).

**Example (continued).**
```
x := 0;
while (true):
    x := x + 1;
```
- Iteration 0: $x = [0, 0]$
- Iteration 1: $x = [0, 0] \nabla [0, 1] = [0, +\infty]$ (upper bound grew, jump to $+\infty$)
- Iteration 2: $x = [0, +\infty] \nabla [0, +\infty] = [0, +\infty]$ (stable)

Result: $x \in [0, +\infty]$. Sound but imprecise (we lost the information that $x$ can be arbitrarily large but the loop doesn't terminate).

### 6.3 Correctness of Widening

**Theorem.** The widening iteration computes a sound post-fixed point.

*Proof.* Let $w_0 = \bot$, $w_{i+1} = w_i \nabla F^\sharp(w_i)$. By the convergence guarantee, the sequence stabilizes at some $w_k$. At that point:

$$w_k = w_k \nabla F^\sharp(w_k) \sqsupseteq F^\sharp(w_k)$$

So $w_k$ is a post-fixed point of $F^\sharp$, meaning $F^\sharp(w_k) \sqsubseteq w_k$. By the Knaster-Tarski theorem, $\text{lfp}(F^\sharp) \sqsubseteq w_k$. Combined with the soundness theorem (Section 4.3), $\alpha(\text{lfp}(F)) \sqsubseteq \text{lfp}(F^\sharp) \sqsubseteq w_k$. $\blacksquare$

### 6.4 Narrowing

After widening, we have a sound but possibly imprecise post-fixed point. *Narrowing* improves precision by iterating downward.

**Definition.** A *narrowing operator* $\Delta : A \times A \to A$ satisfies:
1. $a \sqcap b \sqsubseteq a \Delta b \sqsubseteq a$ (improves $a$ toward $a \sqcap b$)
2. For any descending sequence, the narrowing iteration stabilizes.

**Narrowing iteration:** Starting from the widened result $w$, iterate $w' = w \Delta F^\sharp(w)$ until stable. Each step maintains the post-fixed point invariant while improving precision.

**Interval narrowing:**

$$[a, b] \Delta [c, d] = \left[\begin{cases} c & \text{if } a = -\infty \\ a & \text{otherwise} \end{cases},\; \begin{cases} d & \text{if } b = +\infty \\ b & \text{otherwise} \end{cases}\right]$$

**Example.**
```
x := 0;
while (x < 100):
    x := x + 1;
```

Widening gives $x \in [0, +\infty]$ at the loop head. After the loop (guard negation $x \ge 100$): $x \in [100, +\infty]$.

Narrowing: $F^\sharp$ applied to $[0, +\infty]$ inside the loop gives $x \in [1, 100]$. At loop head: $[0, 0] \sqcup [1, 100] = [0, 100]$. Narrowing $[0, +\infty] \Delta [0, 100] = [0, 100]$. After the loop: $x \in [100, 100]$. Precise.

### 6.5 Detailed Worked Example: Widening and Narrowing Step by Step

Consider a more complex program with two variables:

```
x := 0;
y := 100;
while (x < y):
    x := x + 1;
    y := y - 1;
```

We analyze this using the interval domain, tracking $(x, y)$ at the loop head (node L). Widening is applied at node L.

The transfer function for one loop iteration, assuming the guard $x < y$ holds, is:
- Constrain: $x < y$, i.e., $x \le y - 1$.
- Update: $x' = x + 1$, $y' = y - 1$.

The following table shows the Kleene iteration with widening, then narrowing. The "Incoming" column shows the value of $F^\sharp$ at L (the join of the initial assignment and the back edge), and "After $\nabla$/$\Delta$" shows the result after applying widening or narrowing to the current value at L.

**Phase 1: Widening iterations**

| Iter | Current at L | Incoming from $F^\sharp$ | After $\nabla$ | Stable? |
|---|---|---|---|---|
| 0 | $\bot$ | $(x{=}[0,0], y{=}[100,100])$ | $(x{=}[0,0], y{=}[100,100])$ | No |
| 1 | $(x{=}[0,0], y{=}[100,100])$ | $(x{=}[0,1], y{=}[99,100])$ | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | No |
| 2 | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | Yes |

Explanation of iteration 1: The old upper bound of $x$ was $0$, the new upper bound is $1 > 0$, so widening jumps to $+\infty$. The old lower bound of $y$ was $100$, the new lower bound is $99 < 100$, so widening jumps to $-\infty$.

The widened result is very imprecise: $x \in [0, +\infty]$ and $y \in [-\infty, 100]$.

**Phase 2: Narrowing iterations**

| Iter | Current at L | Incoming from $F^\sharp$ | After $\Delta$ | Stable? |
|---|---|---|---|---|
| 1 | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | $(x{=}[0,+\infty], y{=}[-\infty,100])$ | Yes |

In this case, the interval domain (being non-relational) cannot determine that $x$ and $y$ are related by $x + y = 100$. The narrowing does not improve the result because the transfer function, applied to the already-wide intervals, produces the same intervals. The final result is $x \in [0, +\infty]$, $y \in [-\infty, 100]$.

After the loop (guard $x \ge y$): $x \in [0, +\infty]$ and $y \in [-\infty, 100]$.

The true answer is $x = 50, y = 50$ (or $x = 50, y = 51$ depending on the exact semantics of $<$). A relational domain like octagons could express $x + y = 100$, giving $x \in [0, 100]$ and $y \in [0, 100]$, and after the loop $x = y = 50$. This illustrates why relational domains exist: they can track the dependencies that non-relational domains miss.

### 6.6 Widening with Thresholds

**Idea.** Instead of jumping directly to $\pm\infty$, jump to the next *threshold* from a predefined set $T = \{c_1, c_2, \ldots, c_k, +\infty\}$.

$$[a, b] \nabla_T [c, d] = \left[a',\; \begin{cases} b & \text{if } d \le b \\ \min\{t \in T \mid t \ge d\} & \text{otherwise} \end{cases}\right]$$

Thresholds can be extracted from program constants (e.g., loop bounds, array sizes).

**Example.** Returning to the simple loop:

```
x := 0;
while (x < 100):
    x := x + 1;
```

With thresholds $T = \{0, 100, +\infty\}$ (extracted from the program constants):

| Iter | Current at loop head | Incoming | After $\nabla_T$ |
|---|---|---|---|
| 0 | $\bot$ | $[0,0]$ | $[0,0]$ |
| 1 | $[0,0]$ | $[0,1]$ | $[0, 100]$ (next threshold above $1$ is $100$) |
| 2 | $[0,100]$ | $[0,100]$ | $[0, 100]$ (stable) |

After the loop (guard $x \ge 100$): $x \in [100, 100]$. We immediately get the precise answer, no narrowing needed. Thresholds are a simple but highly effective technique in practice.

---

## 7. Reduced Product of Domains

Having explored individual domains, we now ask: can we combine them to get the best of both worlds? The reduced product provides a principled way to do this.

### 7.1 Definition

Given abstract domains $A_1$ and $A_2$ with Galois connections $(C, \alpha_1, \gamma_1, A_1)$ and $(C, \alpha_2, \gamma_2, A_2)$, the *direct product* is $A_1 \times A_2$ with:

$$\alpha_{1 \times 2}(c) = (\alpha_1(c), \alpha_2(c))$$
$$\gamma_{1 \times 2}(a_1, a_2) = \gamma_1(a_1) \cap \gamma_2(a_2)$$

The *reduced product* applies a *reduction* operator that uses information from each component to refine the other.

**Example.** Combining the sign domain and interval domain: if the sign component says $x \ge 0$ and the interval says $x \in [-5, 10]$, reduction yields $x \in [0, 10]$ with sign $\ge 0$.

---

## 8. Abstract Interpretation of Pointers

Having covered numerical domains, we now move to a qualitatively different kind of abstraction: reasoning about pointer values and heap structures.

### 8.1 Points-To Analysis as Abstract Interpretation

The concrete domain is the set of all possible heap configurations (memory graphs). The abstract domain maps each pointer variable to a set of possible targets.

**Andersen's analysis** (1994) can be formulated as abstract interpretation:
- Concrete domain: $(V \to \mathcal{P}(\text{Locations}))$ -- each variable maps to a set of locations
- Abstract domain: $(V \to \mathcal{P}(\text{AllocSites}))$ -- each variable maps to a set of allocation sites
- Transfer functions model pointer assignments, loads, stores

**Steensgaard's analysis** uses equivalence classes (union-find), which corresponds to a coarser abstract domain where the abstraction function maps points-to sets to equivalence classes.

---

## 9. Relational vs. Non-Relational Domains

**Non-relational domains** abstract each variable independently:
- Sign, interval, bitfield domains
- Cannot express relationships like $x = y$ or $x \le y + 1$
- Efficient: $O(n)$ per program point for $n$ variables

**Relational domains** track relationships between variables:
- Octagon, polyhedral, zone domains
- Can express $x - y \le c$, $\sum a_i x_i \le b$
- More precise but more expensive: $O(n^2)$ to $O(2^n)$

**The precision-cost trade-off:**

| Domain | Constraints | Time per op | Space |
|---|---|---|---|
| Sign | sign of each var | $O(1)$ per var | $O(n)$ |
| Interval | $a \le x \le b$ | $O(1)$ per var | $O(n)$ |
| Zone (DBM) | $x - y \le c$ | $O(n^2)$ | $O(n^2)$ |
| Octagon | $\pm x \pm y \le c$ | $O(n^3)$ | $O(n^2)$ |
| Polyhedra | $\sum a_i x_i \le b$ | exponential | exponential |

---

## 10. Connection to Dataflow Analysis

### 10.1 Dataflow Analysis IS Abstract Interpretation

The dataflow analyses from classical compiler optimization (reaching definitions, live variables, available expressions, constant propagation) are all instances of abstract interpretation on specific lattices.

**Constant propagation:**
- Abstract domain: $\{\bot, c_1, c_2, \ldots, \top\}$ per variable (flat lattice)
- Transfer functions: evaluate operations on constants
- Join: $c \sqcup c = c$, $c \sqcup c' = \top$ for $c \ne c'$

**Reaching definitions:**
- Abstract domain: $\mathcal{P}(\text{Definitions})$ (powerset lattice)
- Transfer functions: gen/kill sets
- Join: set union (may analysis)

**Available expressions:**
- Abstract domain: $\mathcal{P}(\text{Expressions})$ (powerset lattice)
- Transfer functions: gen/kill sets
- Meet: set intersection (must analysis)

### 10.2 What Abstract Interpretation Adds

Abstract interpretation goes beyond classical dataflow analysis by providing:

1. **A correctness framework.** Galois connections formalize what it means for an analysis to be sound.
2. **Systematic domain design.** New domains can be designed by specifying the Galois connection and proving soundness of transfer functions.
3. **Widening/narrowing theory.** Handles infinite-height lattices (e.g., intervals) that classical dataflow analysis cannot.
4. **Domain combination.** The reduced product allows combining analyses systematically.
5. **Completeness results.** Conditions under which an abstract interpretation is as precise as possible.

---

## 11. Tools and Applications

### 11.1 Astree

Astree (Blanchet et al. 2003) is an abstract interpreter for C designed to verify the absence of runtime errors in safety-critical embedded software. It was used to verify the primary flight control software of the Airbus A340 and A380 -- proving absence of:
- Integer/float overflow
- Division by zero
- Array out-of-bounds
- Uninitialized variables

**Key techniques:**
- Relational numerical domains (octagons + decision trees)
- Domain-specific abstract domains for floating-point, filters, timers
- Widening with thresholds derived from program constants
- Partitioning based on control flow (trace partitioning)

### 11.2 Frama-C

Frama-C is a platform for C program analysis. Its EVA (Evolved Value Analysis) plugin implements abstract interpretation with multiple numerical domains (intervals, octagons, congruences).

### 11.3 Facebook Infer

Infer uses a form of abstract interpretation called *bi-abduction* for compositional shape analysis. It infers pre- and post-conditions for each function, enabling modular analysis of large codebases.

**Separation logic** provides the abstract domain: spatial predicates describe heap shapes (linked lists, trees). Bi-abduction computes frame conditions.

### 11.4 Verasco (Certified Abstract Interpretation in CompCert)

Verasco (Jourdan et al. 2015) is an abstract interpreter verified in Coq and integrated with CompCert. The soundness of the analysis is machine-checked, providing the highest level of assurance.

**Key insight:** The entire analysis, including numerical domains (intervals, octagons), widening, narrowing, and transfer functions, is formally verified. A bug in the abstract interpreter cannot cause false negatives.

---

## 12. Applications to Compiler Verification

### 12.1 Verifying Absence of Runtime Errors

A compiler targeting safety-critical systems must ensure that the compiled program cannot exhibit undefined behavior. Abstract interpretation can verify this *before compilation*:

- Integer overflow: interval analysis
- Division by zero: sign/interval analysis
- Array bounds: relational analysis (relating index to array size)
- Null pointer: points-to analysis with nullness tracking

### 12.2 Proving Memory Safety

Abstract interpretation over separation logic can prove:
- No use-after-free
- No double-free
- No memory leaks
- No buffer overflows

### 12.3 Certified Abstract Interpretation

The key result connecting abstract interpretation to verified compilation:

**Theorem (Jourdan et al. 2015).** If the abstract interpreter (Verasco) reports "no alarms" on a C program, and CompCert compiles it, then the compiled assembly code is free of undefined behavior (assuming correctness of CompCert's semantics model).

This composes two verified components:
1. Verasco: source program is safe (verified in Coq)
2. CompCert: compilation preserves semantics (verified in Coq)

---

## 13. Common Pitfalls

Students frequently make the following mistakes when learning abstract interpretation. Being aware of them helps avoid confusion.

**Pitfall 1: Confusing soundness with completeness.**

- *Soundness* means: if the analysis says "safe," the program really is safe. Equivalently, the analysis over-approximates all reachable states. A sound analysis may report false alarms (claiming a potential error when none exists).
- *Completeness* means: if the program is safe, the analysis will prove it safe. A complete analysis has no false alarms.

In practice, abstract interpretation is sound but incomplete: it may raise false alarms. This is inherent -- Rice's theorem tells us that no non-trivial semantic property is decidable in general, so any terminating sound analysis must sometimes be imprecise.

**Pitfall 2: Getting the direction of over-approximation backwards.**

The abstract result *over*-approximates the concrete reachable states. This means the abstract set is *larger* than (or equal to) the set of concrete states. Some students think "over-approximate" means "too small" (as in "I over-estimated the difficulty, so I thought it was harder than it was"). In our setting, "over-approximate" means the abstract set *contains* all concrete states and possibly more.

Concretely: if the analysis says $x \in [0, 100]$, the true range of $x$ is some subset of $[0, 100]$. If the analysis says $x \in [0, 100]$ and the actual range is $[-5, 50]$, the analysis is *unsound* (it missed $-5$ through $-1$).

**Pitfall 3: Thinking widening computes the least fixed point.**

Widening computes a *post-fixed point* (i.e., $F^\sharp(w) \sqsubseteq w$), which is an upper bound on the least fixed point. It is generally *not* the least fixed point itself. The widened result is sound but may be strictly above the least fixed point. Narrowing can improve it, but even after narrowing, the result may still be above the least fixed point.

**Pitfall 4: Confusing the abstract lattice ordering with "better precision."**

In the abstract lattice, $\bot$ is the *smallest* element (represents the empty set of concrete states), and $\top$ is the *largest* (represents all possible states). A *lower* element in the lattice represents *fewer* concrete states and is therefore *more precise*. Students sometimes think "higher in the lattice = more information," but it is the opposite: higher in the lattice = less information = more states included = less precise.

**Pitfall 5: Applying widening everywhere instead of only at loop heads.**

Widening is needed only at points where the Kleene iteration may diverge, typically the targets of back edges (loop heads) in the CFG. Applying widening at every program point is sound but causes unnecessary precision loss. A standard strategy is to compute the set of widening points as the set of loop headers (or, more generally, a cutset of the CFG that hits every cycle).

**Pitfall 6: Forgetting that narrowing must start from the widened result.**

Narrowing iterates *downward* from the widened post-fixed point. Some students try to run narrowing from $\top$ or from $\bot$, which is incorrect. The starting point must be a post-fixed point of $F^\sharp$, and the narrowing iteration maintains this invariant while improving precision.

---

## 14. Summary

Abstract interpretation provides:
- A **mathematical framework** (Galois connections, soundness proofs) for program analysis.
- **Systematic design** of analyses as choice of abstract domain + transfer functions.
- **Guaranteed soundness**: every alarm corresponds to a potential real error (no false negatives in the over-approximate direction).
- **Practical tools** that have verified flight control software and analyze millions of lines of code.

The hierarchy of numerical domains -- from signs (imprecise, cheap) to polyhedra (precise, expensive) -- illustrates the fundamental trade-off in program analysis. Widening and narrowing make fixed-point computation tractable over infinite-height domains. The reduced product combines the strengths of multiple domains.

Abstract interpretation is not just a theoretical framework; it is the basis of industrial-strength verification tools that have proven the absence of critical bugs in some of the most safety-critical software ever deployed.

---

## References

1. Cousot, P. & Cousot, R. (1977). "Abstract interpretation: A unified lattice model for static analysis of programs by construction or approximation of fixpoints." *POPL*, 238-252.
2. Cousot, P. & Cousot, R. (1979). "Systematic design of program analysis frameworks." *POPL*, 269-282.
3. Cousot, P. & Halbwachs, N. (1978). "Automatic discovery of linear restraints among variables of a program." *POPL*, 84-96.
4. Mine, A. (2006). "The octagon abstract domain." *Higher-Order and Symbolic Computation*, 19(1), 31-100.
5. Blanchet, B. et al. (2003). "A static analyzer for large safety-critical software." *PLDI*, 196-207.
6. Jourdan, J.H. et al. (2015). "A formally-verified C static analyzer." *POPL*, 247-259.
7. Andersen, L.O. (1994). "Program analysis and specialization for the C programming language." *PhD thesis*, DIKU, University of Copenhagen.
8. Calcagno, C. et al. (2011). "Compositional shape analysis by means of bi-abduction." *Journal of the ACM*, 58(6), 1-66.
9. Knaster, B. (1928). "Un theoreme sur les fonctions d'ensembles." *Annales de la Societe Polonaise de Mathematique*, 6, 133-134.
10. Tarski, A. (1955). "A lattice-theoretical fixpoint theorem and its applications." *Pacific Journal of Mathematics*, 5(2), 285-309.
