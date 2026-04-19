# Lecture 06a: Instruction Selection

## 1. Introduction

Instruction selection is the process of mapping intermediate representation (IR) operations onto target machine instructions. The challenge is not merely correctness---many valid instruction sequences can implement a given IR fragment---but selecting the sequence that minimizes cost (execution time, code size, energy). This lecture develops the major algorithmic approaches, from simple greedy methods to optimal dynamic programming formulations.

**The fundamental problem.** Given an IR expression tree (or DAG) and a set of target machine instruction patterns, each with an associated cost, find a covering of the IR tree by instruction patterns that minimizes total cost.

---

## 2. The Instruction Selection Problem as Tree Covering

### 2.1 IR as Expression Trees

We model each basic block's computation as a forest of expression trees. Consider the IR statement:

```
t1 := MEM[x + 4*i]
```

This corresponds to the tree:

```
    MEM
     |
    ADD
   /   \
  x    MUL
      /   \
     4     i
```

### 2.2 Machine Instruction Patterns as Tree Fragments

Each machine instruction is modeled as a tree pattern. For example, on x86-64:

| Instruction | Pattern | Cost |
|-------------|---------|------|
| `MOV r, [r + r*4]` | MEM(ADD(r, MUL(4, r))) | 1 |
| `MOV r, [r + c]` | MEM(ADD(r, CONST)) | 1 |
| `ADD r, r` | ADD(r, r) | 1 |
| `LEA r, [r + r*s]` | ADD(r, MUL(CONST, r)) | 1 |
| `MOV r, [r]` | MEM(r) | 1 |
| `MUL r, r` | MUL(r, r) | 3 |

Here $r$ denotes a register operand (a leaf that matches any subtree whose result is in a register), and $c$ denotes a constant.

### 2.3 Formal Definition

**Definition (Tree Covering Problem).** Let $T$ be a subject tree (the IR expression), and let $\mathcal{P} = \{(p_i, c_i)\}_{i=1}^{n}$ be a set of pattern trees $p_i$ with costs $c_i \in \mathbb{R}^+$. A *covering* of $T$ is a set of pattern instances $\{(p_{j_k}, v_k)\}$ where each $v_k$ is a node in $T$ at which pattern $p_{j_k}$ is rooted, such that:

1. Every node of $T$ is covered by exactly one pattern instance.
2. The leaves of each pattern instance that are register operands correspond to roots of other pattern instances.

The *optimal covering* minimizes $\sum_k c_{j_k}$.

**Theorem 2.1.** The optimal tree covering problem for ordered trees with fixed pattern set can be solved in $O(n)$ time by dynamic programming, where $n = |T|$.

---

## 3. Maximal Munch Algorithm

### 3.1 The Greedy Strategy

Maximal munch is a top-down greedy algorithm. Starting at the root of the expression tree, it finds the largest (most nodes) pattern that matches at the root, emits the corresponding instruction, and recursively processes the subtrees left at the pattern's register-operand leaves.

```
Algorithm: MaximalMunch(node)
Input: Root node of an expression tree
Output: Sequence of machine instructions

1.  Let P = { p in Patterns : p matches the tree rooted at node }
2.  Select p* = argmax_{p in P} |p|        // largest pattern
3.  // If costs differ among equally-sized patterns, prefer lowest cost
4.  Emit the instruction corresponding to p*
5.  Let leaves = register-operand leaves of p* in the subject tree
6.  For each leaf l in leaves (left to right):
7.      MaximalMunch(l)
```

### 3.2 Properties

**Proposition 3.1.** Maximal munch produces a valid covering of the expression tree.

*Proof.* By induction on tree height. The base case is a single leaf node, which must match some pattern (at minimum, a `MOV r, r` or `LOAD` pattern). For the inductive step, maximal munch covers the root and some descendants, leaving subtrees that are strictly smaller, each of which is covered by the inductive hypothesis. $\square$

**Proposition 3.2.** Maximal munch does *not* in general produce an optimal covering.

*Proof by counterexample.* Consider a target where pattern $A$ matches 3 nodes at cost 5, and two patterns $B$, $C$ each match subsets of those nodes at costs 1 and 1 respectively. Maximal munch selects $A$ (cost 5), but $B + C$ achieves cost 2. $\square$

### 3.3 Why Maximal Munch Works in Practice

Despite suboptimality, maximal munch is widely used because:
- It runs in $O(n)$ time with simple implementation.
- On RISC architectures with uniform instruction costs, larger patterns generally *are* better (fewer instructions).
- The gap to optimal is typically small for real ISAs.

---

## 4. Dynamic Programming Approach (Aho-Johnson)

### 4.1 Bottom-Up Optimal Tree Pattern Matching

The dynamic programming approach, developed by Aho, Johnson, and others, computes the optimal covering bottom-up. At each node, it considers all patterns that match and selects the one yielding minimum total cost (pattern cost plus costs of covering the subtrees at register-operand leaves).

### 4.2 Algorithm

```
Algorithm: DPInstructionSelection(T)
Input: Expression tree T with root r
Output: Optimal instruction sequence

Phase 1: Label (bottom-up)
1.  For each node v in T in post-order:
2.      For each pattern p that matches at v:
3.          cost_p = cost(p) + sum of Cost[u] for each register-operand leaf u of p
4.      Cost[v] = min over all matching patterns p of cost_p
5.      BestPattern[v] = argmin pattern

Phase 2: Emit (top-down)
6.  Procedure Emit(v):
7.      Let p = BestPattern[v]
8.      For each register-operand leaf u of p at node v:
9.          Emit(u)
10.     Output instruction for p at v
```

### 4.3 Correctness and Optimality

**Theorem 4.1 (Optimality of DP Instruction Selection).** The dynamic programming algorithm produces a minimum-cost covering of the expression tree.

*Proof.* We prove by structural induction on the tree $T$.

**Base case.** If $T$ is a single leaf, the only applicable patterns are leaf patterns, and the algorithm trivially selects the minimum-cost one.

**Inductive step.** Suppose the algorithm is optimal for all proper subtrees of $T$. At the root $r$, the algorithm considers every pattern $p$ matching at $r$. For each such pattern, the cost is:

$$\text{cost}(p, r) = c_p + \sum_{u \in \text{leaves}(p)} \text{Cost}[u]$$

By the inductive hypothesis, $\text{Cost}[u]$ is the optimal cost for the subtree rooted at $u$. Therefore, $\text{cost}(p, r)$ is the true cost of using pattern $p$ at the root with optimal subtree coverings. Since the algorithm takes the minimum over all such $p$, it achieves the global optimum.

This relies on the *optimal substructure* property: in an optimal covering, the sub-coverings of subtrees exposed by the root pattern must themselves be optimal (otherwise, replacing them with optimal sub-coverings would reduce total cost, contradicting optimality). $\square$

### 4.4 Complexity Analysis

**Theorem 4.2.** The DP instruction selection algorithm runs in $O(n \cdot |\mathcal{P}| \cdot m)$ time, where $n = |T|$, $|\mathcal{P}|$ is the number of patterns, and $m$ is the maximum pattern size.

*Proof.* Each node is visited once in post-order. At each node, we try each pattern, and matching a pattern of size $m$ takes $O(m)$ time. The emit phase is $O(n)$. $\square$

In practice, $|\mathcal{P}|$ and $m$ are constants determined by the target ISA, so the algorithm is $O(n)$.

### 4.5 Handling DAGs

Expression trees may share common subexpressions, forming DAGs. The DP algorithm extends to DAGs, but optimality is no longer guaranteed because a shared node may need to produce its result in different contexts. A common approach: if a DAG node has multiple parents, treat it as a "tree root" that stores its result to a temporary, then reference that temporary from each parent.

---

## 5. BURG and Bottom-Up Rewrite Systems

### 5.1 Tree Grammars

A *bottom-up rewrite system (BURS)* specifies instruction selection as a tree grammar. Each rule has the form:

$$\text{nonterminal} \leftarrow \text{tree pattern} \quad [\text{cost}]$$

For example:

```
reg <- MEM(ADD(reg, MUL(CONST_4, reg)))    [1]   // scaled index load
reg <- MEM(ADD(reg, CONST))                [1]   // displacement load
reg <- MEM(reg)                            [1]   // indirect load
reg <- ADD(reg, reg)                       [1]
reg <- MUL(reg, reg)                       [3]
reg <- CONST                               [1]   // load immediate
```

### 5.2 BURG: Bottom-Up Rewrite Generator

BURG (Fraser, Henry, Proebsting, 1992) is a tool that takes a tree grammar specification and generates an instruction selector. It precomputes a finite automaton that, given a subject tree, determines the optimal covering in a single bottom-up pass.

**Key idea.** BURG observes that the DP labeling at each node depends only on:
1. The operator at the node.
2. The *states* (equivalence classes of cost vectors) of the children.

Since the number of operators and states is finite, BURG builds a table:

$$\delta(\text{op}, s_1, s_2) \to (s, \text{rule})$$

where $s_1, s_2$ are child states, $s$ is the resulting state, and $\text{rule}$ is the best matching rule.

### 5.3 State Computation

**Definition.** A *state* at a node $v$ is a vector $\langle c_1, c_2, \ldots, c_k \rangle$ where $c_i$ is the minimum cost of deriving nonterminal $i$ from the subtree rooted at $v$.

Two nodes have the same state if and only if their cost vectors are identical. BURG normalizes these into equivalence classes during a precomputation phase.

```
Algorithm: BURG Precomputation
Input: Tree grammar G with nonterminals N, operators Sigma
Output: Transition table delta, rule table

1.  Initialize: for each leaf operator op:
2.      Compute the state (cost vector) for a leaf labeled op
3.      Record in table
4.  Repeat until no new states are discovered:
5.      For each internal operator op of arity k:
6.          For each combination (s1, ..., sk) of known child states:
7.              Compute new state s by evaluating all rules matching op(s1,...,sk)
8.              For each nonterminal n:
9.                  s[n] = min over matching rules r of (cost(r) + sum of child costs)
10.             If s is a new state, add it
11.             Record delta(op, s1, ..., sk) = s
```

**Theorem 5.1.** The number of distinct states is finite (bounded by the product of cost ranges across nonterminals), and BURG's precomputation terminates.

### 5.4 Runtime Operation

At compile time, BURG's generated selector performs:
1. **Bottom-up labeling**: traverse the IR tree in post-order, using $\delta$ to assign a state to each node. Time: $O(n)$.
2. **Top-down emit**: starting from the root, use the rule table to select instructions. Time: $O(n)$.

Total runtime: $O(n)$ with excellent constant factors (table lookups only).

---

## 6. Instruction Selection for CISC vs RISC

### 6.1 CISC Challenges

Complex Instruction Set Computers (x86, VAX) present difficulties:
- **Many addressing modes**: `[base + index*scale + displacement]` on x86 creates large pattern sets.
- **Variable instruction costs**: costs depend on operand types, alignment, microarchitectural state.
- **Instruction constraints**: some instructions require specific registers (e.g., `DIV` on x86 uses `RAX`/`RDX`).
- **Side effects**: flag registers, implicit operands.

These require richer pattern sets and more complex cost models. CISC machines benefit most from sophisticated instruction selection because complex addressing modes can fold multiple IR operations into a single instruction.

### 6.2 RISC Simplifications

Reduced Instruction Set Computers (ARM, RISC-V, MIPS) simplify instruction selection:
- **Uniform instruction format**: fewer patterns needed.
- **Load/store architecture**: memory operations are separate from computation.
- **Uniform costs**: most instructions take 1 cycle.
- **Large register files**: reduces pressure on register allocation.

For RISC targets, maximal munch often suffices, and the main optimization opportunity shifts to register allocation and scheduling.

### 6.3 Instruction Selection Quality Metrics

Let $\text{OPT}(T)$ be the cost of the optimal covering and $\text{ALG}(T)$ the cost produced by algorithm ALG. The *approximation ratio* is:

$$\rho = \max_T \frac{\text{ALG}(T)}{\text{OPT}(T)}$$

For maximal munch on typical RISC targets, empirical studies show $\rho \leq 1.05$. For CISC targets, the gap can be larger, motivating the use of BURG or DP-based selectors.

---

## 7. Peephole Optimization

### 7.1 Overview

Peephole optimization examines a small sliding window ("peephole") of consecutive instructions and replaces inefficient sequences with better ones. It operates *after* initial instruction selection and can correct suboptimal local choices.

### 7.2 Peephole Rules

Peephole rules are pattern-replacement pairs. Examples for x86-64:

```
// Redundant load after store
MOV [addr], r1          =>   MOV [addr], r1
MOV r2, [addr]               MOV r2, r1

// Strength reduction
MUL r, 2                =>   SHL r, 1

// Identity elimination
ADD r, 0                =>   (delete)

// Redundant move
MOV r1, r2              =>   (delete, if r1 = r2)

// Combine adjacent operations
PUSH r1                 =>   (merge when possible)
POP r1                       (delete both)
```

### 7.3 Formal Framework

A peephole optimizer can be modeled as a term rewriting system. Let $\mathcal{R} = \{l_i \to r_i\}$ be a set of rewrite rules where $l_i$ and $r_i$ are instruction sequences.

**Definition (Correctness).** A peephole rule $l \to r$ is *correct* if for all machine states $\sigma$:

$$[\![ l ]\!](\sigma) = [\![ r ]\!](\sigma)$$

where $[\![ \cdot ]\!]$ denotes the semantic function mapping states to states.

**Theorem 7.1.** If each peephole rule is correct and the rewriting is confluent and terminating, then the peephole optimizer preserves program semantics.

### 7.4 Implementation Considerations

- **Window size**: typically 2--4 instructions. Larger windows find more optimizations but increase compile time combinatorially.
- **Iterative application**: one pass may create new optimization opportunities; repeat until no more rules apply.
- **Integration with instruction selection**: some compilers deliberately generate naive code and rely on the peephole optimizer to clean it up, simplifying the instruction selector.

---

## 8. Superoptimization

### 8.1 Massalin's Approach

Superoptimization (Massalin, 1987) finds the *provably optimal* instruction sequence for a given computation by exhaustive search.

**Algorithm sketch:**

```
Algorithm: Superoptimize(spec)
Input: Specification spec (input-output behavior of desired computation)
Output: Shortest correct instruction sequence

1.  For length L = 1, 2, 3, ...:
2.      For each instruction sequence S of length L:
3.          If Verify(S, spec):
4.              Return S

Procedure Verify(S, spec):
1.  For each test input t in TestSuite:
2.      If Execute(S, t) != spec(t): return false
3.  // Optional: formal verification via SMT solver
4.  Return true
```

### 8.2 Modern Developments

- **Stochastic superoptimization** (Schkufza et al., 2013, STOKE): uses MCMC random search in the space of instruction sequences, avoiding exhaustive enumeration.
- **Synthesis-based approaches**: use SMT solvers (e.g., Z3) to find instruction sequences satisfying $\forall x.\; [\![ S ]\!](x) = \text{spec}(x)$.
- **Counterexample-guided synthesis (CEGIS)**: alternates between synthesis and verification, using counterexamples to prune the search.

### 8.3 Practical Impact

Superoptimization is too slow for general-purpose compilation but is valuable for:
- Compiler libraries (e.g., optimizing `memcpy`, `div` sequences).
- Peephole rule discovery: superoptimize short sequences, then install the results as peephole rules.
- Correctness validation: verify that compiler-generated code is optimal for small functions.

---

## 9. Advanced Topics

### 9.1 Instruction Selection on SSA Form

Modern compilers (e.g., LLVM) perform instruction selection on SSA-based IR rather than expression trees. LLVM's SelectionDAG and GlobalISel frameworks:

1. **SelectionDAG**: builds a DAG per basic block, applies legalization (expand operations the target cannot handle), then performs pattern matching using TableGen-generated matchers.
2. **GlobalISel**: operates on the machine IR (MIR) directly, performing instruction selection in a more modular, potentially global manner.

### 9.2 Instruction Selection for VLIW

Very Long Instruction Word (VLIW) architectures require the compiler to schedule independent operations into instruction "bundles." Instruction selection and scheduling become intertwined: selecting one instruction may preclude parallel execution of another. This is typically handled by integrated selection-and-scheduling algorithms.

### 9.3 Tiling vs Covering

Some formulations distinguish:
- **Covering**: every IR node is covered by at least one pattern (patterns may overlap).
- **Tiling**: every IR node is covered by exactly one pattern (no overlap).

Tiling is the standard formulation for instruction selection. Covering is more relevant for verification and cost analysis.

---

## 10. Summary

| Method | Optimality | Time Complexity | Best For |
|--------|-----------|-----------------|----------|
| Maximal Munch | Heuristic (no guarantee) | $O(n)$ | RISC, rapid prototyping |
| DP (Aho-Johnson) | Optimal for trees | $O(n)$ | General purpose |
| BURG | Optimal for trees | $O(n)$ with precomputation | Production compilers |
| Superoptimization | Globally optimal | Exponential | Library routines, rule discovery |
| Peephole | Local improvement | $O(n)$ per pass | Post-pass cleanup |

The choice of instruction selection algorithm depends on the target architecture complexity, compile-time budget, and code quality requirements. For most production compilers targeting CISC architectures, BURG-style generators or DP-based approaches provide the best balance of code quality and compilation speed.

---

## References

1. Aho, A. V., Ganapathi, M., & Tjiang, S. W. K. (1989). "Code Generation Using Tree Matching and Dynamic Programming." *ACM Transactions on Programming Languages and Systems*, 11(4), 491--516.
2. Fraser, C. W., Henry, R. R., & Proebsting, T. A. (1992). "BURG---Fast Optimal Instruction Selection and Tree Parsing." *ACM SIGPLAN Notices*, 27(4), 68--76.
3. Massalin, H. (1987). "Superoptimizer: A Look at the Smallest Program." *ASPLOS*, 122--126.
4. Schkufza, E., Sharma, R., & Aiken, A. (2013). "Stochastic Superoptimization." *ASPLOS*, 305--316.
5. Aho, A. V., Lam, M. S., Sethi, R., & Ullman, J. D. (2006). *Compilers: Principles, Techniques, and Tools* (2nd ed.). Addison-Wesley. Chapters 8--9.
6. Appel, A. W. (2004). *Modern Compiler Implementation in ML*. Cambridge University Press. Chapter 9.
7. Muchnick, S. S. (1997). *Advanced Compiler Design and Implementation*. Morgan Kaufmann. Chapter 14.
