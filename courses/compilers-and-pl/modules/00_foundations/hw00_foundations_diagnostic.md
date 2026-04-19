# HW0: Foundations Diagnostic

**Module 00 -- Mathematical & CS Foundations**
**Due:** Before Week 1
**Format:** Written solutions (LaTeX or neat handwriting). Code where specified.

---

## Instructions

This diagnostic assesses your preparation for the course. It covers the prerequisite material from Lecture 00a (Formal Languages & Automata Theory) and Lecture 00b (Discrete Mathematics for Compilers). You should be able to complete these problems using your prior undergraduate knowledge, supplemented by the lecture notes.

If you struggle with more than 2--3 of these problems, you should review the relevant background material before proceeding to Module 01.

---

## Problem 1: DFA Construction (15 points)

Construct a DFA over the alphabet $\Sigma = \{0, 1\}$ that accepts exactly the set of binary strings representing integers divisible by 3 (interpreting the string as a binary number read left to right; the empty string represents 0 and should be accepted).

**(a)** Give the formal 5-tuple $(Q, \Sigma, \delta, q_0, F)$ and draw the state diagram.

**(b)** Trace the execution on inputs $1101$ (which is 13 in decimal) and $1100$ (which is 12 in decimal).

**(c)** Prove by induction on $|w|$ that your DFA is correct: after reading string $w$, the DFA is in state $q_r$ where $r \equiv \text{val}(w) \pmod{3}$ and $\text{val}(w)$ is the numerical value of the binary string $w$.

---

## Problem 2: NFA to DFA via Subset Construction (15 points)

Consider the NFA $N = (\{q_0, q_1, q_2\}, \{a, b\}, \delta, q_0, \{q_2\})$ with:

| | $a$ | $b$ | $\varepsilon$ |
|---|---|---|---|
| $q_0$ | $\{q_0, q_1\}$ | $\{q_0\}$ | $\emptyset$ |
| $q_1$ | $\emptyset$ | $\{q_2\}$ | $\emptyset$ |
| $q_2$ | $\emptyset$ | $\emptyset$ | $\emptyset$ |

**(a)** Apply the subset construction to convert $N$ to a DFA $D$. Show all reachable states and the complete transition table.

**(b)** Identify and remove any unreachable or dead states.

**(c)** What language does this automaton accept? Express it as a regular expression.

**(d)** Is the resulting DFA minimal? Justify your answer using the Myhill-Nerode theorem.

---

## Problem 3: Pumping Lemma Application (10 points)

Prove that $L = \{w \in \{0, 1\}^* \mid w \text{ has an equal number of 0s and 1s}\}$ is not regular.

Use the pumping lemma. Be precise about the adversarial structure of the argument: clearly indicate which choices are yours (the string $w$) and which are the adversary's (the pumping length $p$ and the decomposition $w = xyz$).

---

## Problem 4: Context-Free Grammar Design (15 points)

**(a)** Write a context-free grammar for the language:

$$L_1 = \{a^i b^j c^k \mid i + k = j,\ i, j, k \geq 0\}$$

Prove your grammar is correct (i.e., it generates exactly $L_1$).

**(b)** Write a context-free grammar for the language of balanced parentheses with two types: `(`, `)`, `[`, `]`, where matching must respect types. For example, `([])` is valid but `([)]` is not.

**(c)** Is the grammar from part (b) ambiguous? Prove or disprove.

---

## Problem 5: Chomsky Normal Form (10 points)

Convert the following CFG into Chomsky Normal Form. Show each step of the transformation (elimination of $\varepsilon$-productions, unit productions, useless symbols, and conversion to CNF).

$$S \to ASB \mid \varepsilon$$
$$A \to aAS \mid a$$
$$B \to SbS \mid A \mid bb$$

---

## Problem 6: Lattice Theory (15 points)

**(a)** Consider the poset $(\mathcal{P}(\{1,2,3\}), \subseteq)$. Draw its Hasse diagram. Verify that it is a lattice by identifying the join and meet of every pair of elements $\{1,2\}$ and $\{2,3\}$.

**(b)** Let $L = \{0, a, b, c, 1\}$ with the ordering $0 < a < 1$, $0 < b < 1$, $0 < c < 1$, and $a, b, c$ pairwise incomparable. Is $(L, \leq)$ a lattice? If so, is it distributive? Prove your claims.

**(c)** Let $f: \mathcal{P}(\{1,2,3\}) \to \mathcal{P}(\{1,2,3\})$ be defined by $f(S) = S \cup \{1\}$. Verify that $f$ is monotone. Compute the least fixed point of $f$ using Kleene iteration starting from $\bot = \emptyset$.

---

## Problem 7: Fixed-Point Computation (10 points)

Consider the data-flow equations for a simple program with three nodes and the powerset lattice $(\mathcal{P}(\{x, y, z\}), \subseteq)$:

$$\text{OUT}[1] = \{x\} \cup (\text{IN}[1] \setminus \{y\})$$
$$\text{OUT}[2] = \{y\} \cup (\text{IN}[2] \setminus \{x\})$$
$$\text{OUT}[3] = \text{IN}[3] \setminus \{z\}$$

with the confluence operator being union and the following control flow: entry $\to$ 1 $\to$ 2 $\to$ 3 $\to$ 1 (a loop), where $\text{IN}[1] = \text{OUT}[3] \cup \text{OUT}[\text{entry}]$, $\text{IN}[2] = \text{OUT}[1]$, $\text{IN}[3] = \text{OUT}[2]$, and $\text{OUT}[\text{entry}] = \emptyset$.

**(a)** Perform the iterative fixed-point computation. Initialize all OUT sets to $\emptyset$ and iterate until convergence. Show the value of each OUT set after each iteration.

**(b)** How many iterations are required? Relate this to the height of the lattice.

---

## Problem 8: Structural Induction (10 points)

Consider the following inductively defined set of binary trees:

$$t ::= \text{Leaf} \mid \text{Node}(t_1, t_2)$$

and the functions:

$$\text{leaves}(\text{Leaf}) = 1, \quad \text{leaves}(\text{Node}(t_1, t_2)) = \text{leaves}(t_1) + \text{leaves}(t_2)$$

$$\text{nodes}(\text{Leaf}) = 0, \quad \text{nodes}(\text{Node}(t_1, t_2)) = 1 + \text{nodes}(t_1) + \text{nodes}(t_2)$$

Prove by structural induction that for all binary trees $t$:

$$\text{leaves}(t) = \text{nodes}(t) + 1$$

---

## Problem 9: Graph Algorithms (Bonus, 10 points)

Given the following control-flow graph (CFG) with entry node 1:

- Edges: $1 \to 2$, $1 \to 3$, $2 \to 4$, $3 \to 4$, $4 \to 5$, $4 \to 6$, $5 \to 4$, $6 \to 1$

**(a)** Compute the dominator tree. Show your work using the iterative algorithm from Lecture 00b.

**(b)** Compute the dominance frontier of each node.

**(c)** Identify all natural loops. For each, give the loop header and the set of nodes in the loop body.

---

## Problem 10: Galois Connections (Bonus, 10 points)

Consider the concrete domain $(\mathcal{P}(\mathbb{Z}), \subseteq)$ and the abstract *sign domain* $(\{\bot, -, 0, +, \top\}, \leq)$ where $\bot \leq x \leq \top$ for all $x$ and $-, 0, +$ are pairwise incomparable.

**(a)** Define abstraction $\alpha: \mathcal{P}(\mathbb{Z}) \to \text{Sign}$ and concretization $\gamma: \text{Sign} \to \mathcal{P}(\mathbb{Z})$ functions that form a Galois connection.

**(b)** Verify the Galois connection property: $\alpha(S) \leq a \iff S \subseteq \gamma(a)$ for a few representative cases.

**(c)** Define an abstract addition operation $+^\#: \text{Sign} \times \text{Sign} \to \text{Sign}$ that is *sound*: $\alpha(\{x + y \mid x \in \gamma(a),\ y \in \gamma(b)\}) \leq a +^\# b$. Give the complete table.

---

## Submission Guidelines

- Written proofs should be rigorous but need not be excessively formal. Use standard mathematical notation.
- Problems 9 and 10 are bonus problems worth extra credit.
- Total points (excluding bonus): 100.
- Estimated time: 4--6 hours.
