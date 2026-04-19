# Lecture 01a: Regular Expressions & Automata

**Module 01 -- Lexical Analysis**
**Week 1**

---

## 1. Regular Expression Syntax and Semantics

### 1.1 Syntax

We work with the standard regular expression operators over an alphabet $\Sigma$:

| Operator | Notation | Precedence (highest first) |
|----------|----------|---------------------------|
| Kleene star | $r^*$ | 3 (highest) |
| Concatenation | $r_1 r_2$ | 2 |
| Alternation | $r_1 \mid r_2$ | 1 (lowest) |

Parentheses override precedence. Additional shorthand:

- $r^+ = r \cdot r^*$ (one or more)
- $r? = r \mid \varepsilon$ (zero or one)
- $[a\text{-}z]$ denotes $a \mid b \mid \cdots \mid z$ (character classes)

### 1.2 Formal Semantics

The *language* $L(r)$ of a regular expression $r$ is defined inductively:

$$L(\emptyset) = \emptyset$$
$$L(\varepsilon) = \{\varepsilon\}$$
$$L(a) = \{a\} \quad \text{for } a \in \Sigma$$
$$L(r_1 \mid r_2) = L(r_1) \cup L(r_2)$$
$$L(r_1 \cdot r_2) = L(r_1) \cdot L(r_2) = \{xy \mid x \in L(r_1), y \in L(r_2)\}$$
$$L(r^*) = L(r)^* = \bigcup_{i=0}^{\infty} L(r)^i$$

### 1.3 Extended Regular Expressions in Practice

Modern regex engines support features beyond classical regular expressions:

- **Back-references** ($\backslash 1$, $\backslash 2$, ...): not regular -- can express $\{ww \mid w \in \Sigma^*\}$.
- **Lookahead/lookbehind:** do not increase expressiveness for acceptance (still regular), but affect matching semantics.
- **Lazy quantifiers** ($*?$, $+?$): affect match priority, not language.

**Theorem 1.1 (Aho, 1990).** The membership problem for patterns with back-references is NP-hard.

---

## 2. Thompson's Construction (RE to NFA)

### 2.1 The Construction

Thompson's construction (1968) converts a regular expression $r$ into an NFA $N(r)$ with the following structural properties:

- $N(r)$ has exactly one start state and one accept state.
- The accept state has no outgoing transitions.
- Each state has at most two outgoing transitions (either one transition on a symbol, or up to two $\varepsilon$-transitions).
- The number of states is at most $2|r|$ (where $|r|$ is the number of symbols and operators in $r$).

**Base cases:**

For $\varepsilon$: Create two states $s, f$ with an $\varepsilon$-transition $s \xrightarrow{\varepsilon} f$.

For symbol $a \in \Sigma$: Create two states $s, f$ with transition $s \xrightarrow{a} f$.

**Inductive cases:**

Given NFAs $N(r_1) = (s_1, f_1)$ and $N(r_2) = (s_2, f_2)$:

**Alternation** $r_1 \mid r_2$: Create new start $s$ and accept $f$. Add:
- $s \xrightarrow{\varepsilon} s_1$, $s \xrightarrow{\varepsilon} s_2$
- $f_1 \xrightarrow{\varepsilon} f$, $f_2 \xrightarrow{\varepsilon} f$

**Concatenation** $r_1 \cdot r_2$: Merge $f_1$ with $s_2$ (or add $f_1 \xrightarrow{\varepsilon} s_2$). Start is $s_1$, accept is $f_2$.

**Kleene star** $r_1^*$: Create new start $s$ and accept $f$. Add:
- $s \xrightarrow{\varepsilon} s_1$, $s \xrightarrow{\varepsilon} f$ (allows zero repetitions)
- $f_1 \xrightarrow{\varepsilon} s_1$ (allows repetition)
- $f_1 \xrightarrow{\varepsilon} f$

### 2.2 Properties

**Proposition 2.1.** The Thompson NFA for regular expression $r$ has:
- At most $2|r|$ states
- At most $4|r|$ transitions
- Exactly one start state with no incoming transitions
- Exactly one accept state with no outgoing transitions

### 2.3 Proof of Correctness

**Theorem 2.2.** For every regular expression $r$, $L(N(r)) = L(r)$.

*Proof.* By structural induction on $r$.

**Base case** ($r = a$): $N(a)$ accepts exactly $\{a\}$ by construction. $L(N(a)) = \{a\} = L(a)$.

**Base case** ($r = \varepsilon$): $N(\varepsilon)$ has a single $\varepsilon$-transition from start to accept. $L(N(\varepsilon)) = \{\varepsilon\} = L(\varepsilon)$.

**Inductive case** ($r = r_1 \mid r_2$): By induction, $L(N(r_1)) = L(r_1)$ and $L(N(r_2)) = L(r_2)$.

A string $w$ is accepted by $N(r_1 \mid r_2)$ iff:
- There is a path from $s$ to $f$ labeled $w$.
- This path must go $s \xrightarrow{\varepsilon} s_i \xrightarrow{w} f_i \xrightarrow{\varepsilon} f$ for $i \in \{1, 2\}$.
- Hence $w \in L(N(r_1)) \cup L(N(r_2)) = L(r_1) \cup L(r_2) = L(r_1 \mid r_2)$.

**Inductive case** ($r = r_1 \cdot r_2$): $w$ is accepted iff $w = xy$ where $x$ takes $N(r_1)$ from $s_1$ to $f_1$ and $y$ takes $N(r_2)$ from $s_2$ to $f_2$. By induction, $x \in L(r_1)$ and $y \in L(r_2)$. Hence $w \in L(r_1) \cdot L(r_2) = L(r_1 \cdot r_2)$.

**Inductive case** ($r = r_1^*$): $w$ is accepted iff $w = w_1 w_2 \cdots w_k$ (for $k \geq 0$) where each $w_j \in L(N(r_1)) = L(r_1)$. The $k = 0$ case yields $w = \varepsilon$ via $s \xrightarrow{\varepsilon} f$. Hence $L(N(r_1^*)) = L(r_1)^* = L(r_1^*)$. $\blacksquare$

---

## 3. Subset Construction (NFA to DFA)

### 3.1 Algorithm

```
function SubsetConstruction(NFA N = (Q_N, Sigma, delta_N, q_0, F_N)):
    d_0 = ECLOSE({q_0})
    Q_D = {d_0}
    WorkList = {d_0}
    delta_D = {}

    while WorkList is not empty:
        remove a state S from WorkList
        for each symbol a in Sigma:
            T = ECLOSE(Union_{q in S} delta_N(q, a))
            if T not in Q_D:
                Q_D = Q_D union {T}
                WorkList = WorkList union {T}
            delta_D(S, a) = T

    F_D = {S in Q_D : S intersect F_N != empty}
    return DFA D = (Q_D, Sigma, delta_D, d_0, F_D)
```

### 3.2 Complexity Analysis

**Theorem 3.1.** The subset construction runs in $O(2^n \cdot |\Sigma| \cdot n)$ time in the worst case, where $n = |Q_N|$.

*Proof.* There are at most $2^n$ subsets of $Q_N$. For each subset $S$ and each symbol $a$, computing $\bigcup_{q \in S} \delta_N(q, a)$ takes $O(n)$ time, and $\varepsilon$-closure takes $O(n^2)$ time (BFS/DFS on $\varepsilon$-edges). Total: $O(2^n \cdot |\Sigma| \cdot n^2)$.

In practice, only reachable subsets are constructed (on-the-fly), so the actual number of DFA states is often much smaller than $2^n$.

### 3.3 Worst-Case Exponential Blowup

**Theorem 3.2.** For each $n \geq 1$, the language $L_n = \Sigma^* a \Sigma^{n-1}$ (strings whose $n$th-to-last symbol is $a$) over $\Sigma = \{a, b\}$ is recognized by an NFA with $n + 1$ states but requires $2^n$ DFA states.

*Proof sketch.* An NFA nondeterministically guesses when it has reached the $n$th-to-last position. Any DFA must distinguish all $2^n$ suffixes of length $n$, since two distinct suffixes $u \neq v$ of length $n$ can be extended differently. By Myhill-Nerode, $2^n$ states are necessary. $\blacksquare$

---

## 4. DFA Minimization

### 4.1 Equivalence of States

**Definition 4.1.** Two states $p, q$ in DFA $D$ are *equivalent* (written $p \equiv q$) if:

$$\forall w \in \Sigma^*.\ (\hat{\delta}(p, w) \in F \iff \hat{\delta}(q, w) \in F)$$

States that are not equivalent are *distinguishable*.

**Proposition 4.2.** $\equiv$ is an equivalence relation, and the quotient DFA $D/{\equiv}$ is the unique minimum-state DFA for $L(D)$.

### 4.2 Table-Filling Algorithm (Moore)

```
function MinimizeDFA_TableFilling(DFA D = (Q, Sigma, delta, q_0, F)):
    // Initialize: mark all (accept, non-accept) pairs as distinguishable
    for each pair (p, q) with p in F, q not in F:
        mark(p, q)

    // Iterate until no more pairs are marked
    repeat:
        for each unmarked pair (p, q):
            for each a in Sigma:
                if mark(delta(p, a), delta(q, a)):
                    mark(p, q)
    until no new pairs marked

    // Unmarked pairs are equivalent; merge them
    return quotient DFA
```

**Complexity:** $O(n^2 |\Sigma|)$ per iteration, at most $n^2$ iterations, giving $O(n^4 |\Sigma|)$ worst case (can be improved to $O(n^2 |\Sigma|)$ with a dependency-tracking variant).

### 4.3 Hopcroft's Algorithm

**Theorem 4.3 (Hopcroft, 1971).** The minimum-state DFA can be computed in $O(n |\Sigma| \log n)$ time.

```
function Hopcroft_Minimize(DFA D = (Q, Sigma, delta, q_0, F)):
    // Initial partition: {F, Q \ F}
    P = {F, Q \ F}
    W = {min(F, Q \ F)}   // worklist: start with smaller set

    while W is not empty:
        remove a set A from W
        for each symbol a in Sigma:
            // X = set of states that transition to A on symbol a
            X = {q in Q : delta(q, a) in A}
            for each set Y in P:
                if X intersect Y != empty and Y \ X != empty:
                    // Split Y into Y1 = X intersect Y and Y2 = Y \ X
                    replace Y in P with Y1 and Y2
                    if Y in W:
                        replace Y in W with Y1 and Y2
                    else:
                        add min(Y1, Y2) to W  // add smaller half
    return P  // final partition = states of minimum DFA
```

**Key insight:** The algorithm refines a partition. Adding the smaller half to the worklist ensures each state is processed $O(\log n)$ times across all refinements.

**Proof of $O(n |\Sigma| \log n)$ complexity.** Each state $q$ contributes to splitter computations. Each time a set containing $q$ is split, $q$ ends up in a part of size at most half the original (since we process the smaller half). Hence $q$ participates in at most $O(\log n)$ splits. For each split, we examine $|\Sigma|$ transitions per state in $X$. Total: $O(n |\Sigma| \log n)$. $\blacksquare$

### 4.4 Uniqueness of the Minimum DFA

**Theorem 4.4 (Myhill-Nerode).** For any regular language $L$, the minimum-state DFA is unique up to isomorphism. It is the quotient of any DFA for $L$ by the coarsest right-invariant equivalence relation that refines the accept/reject partition.

---

## 5. Brzozowski Derivatives

### 5.1 Definition

**Definition 5.1 (Brzozowski, 1964).** The *derivative* of a language $L$ with respect to a symbol $a$ is:

$$\partial_a L = \{w \mid aw \in L\}$$

Extended to strings: $\partial_\varepsilon L = L$ and $\partial_{wa} L = \partial_a(\partial_w L)$.

### 5.2 Derivatives of Regular Expressions

The derivative operation can be defined directly on regular expressions:

$$\partial_a(\emptyset) = \emptyset$$

$$\partial_a(\varepsilon) = \emptyset$$

$$\partial_a(b) = \begin{cases} \varepsilon & \text{if } a = b \\ \emptyset & \text{if } a \neq b \end{cases}$$

$$\partial_a(r_1 \mid r_2) = \partial_a(r_1) \mid \partial_a(r_2)$$

$$\partial_a(r_1 \cdot r_2) = \partial_a(r_1) \cdot r_2 \mid \nu(r_1) \cdot \partial_a(r_2)$$

$$\partial_a(r^*) = \partial_a(r) \cdot r^*$$

where the *nullability* function $\nu(r)$ is:

$$\nu(r) = \begin{cases} \varepsilon & \text{if } \varepsilon \in L(r) \\ \emptyset & \text{if } \varepsilon \notin L(r) \end{cases}$$

Explicitly:

$$\nu(\emptyset) = \emptyset, \quad \nu(\varepsilon) = \varepsilon, \quad \nu(a) = \emptyset$$
$$\nu(r_1 \mid r_2) = \nu(r_1) \mid \nu(r_2), \quad \nu(r_1 \cdot r_2) = \nu(r_1) \cdot \nu(r_2), \quad \nu(r^*) = \varepsilon$$

### 5.3 Brzozowski's DFA Construction

**Theorem 5.2 (Brzozowski, 1964).** The set of derivatives $\{\partial_w r \mid w \in \Sigma^*\}$ (modulo ACI -- associativity, commutativity, idempotency of $\mid$) is finite for any regular expression $r$. These derivatives correspond to the states of a DFA recognizing $L(r)$.

**Algorithm:**

```
function BrzozowskiDFA(regex r):
    q_0 = simplify(r)
    Q = {q_0}
    WorkList = {q_0}

    while WorkList is not empty:
        remove state s from WorkList  // s is a regex
        for each a in Sigma:
            t = simplify(derivative(s, a))
            if t not in Q:
                Q = Q union {t}
                WorkList = WorkList union {t}
            delta(s, a) = t

    F = {s in Q : nullable(s)}
    return DFA (Q, Sigma, delta, q_0, F)
```

The `simplify` function applies algebraic identities to canonicalize expressions (ensuring finiteness).

### 5.4 Brzozowski's Minimization Algorithm

**Theorem 5.3 (Brzozowski, 1962).** For any DFA $D$, let $\text{rev}(D)$ denote the NFA obtained by reversing all transitions and swapping start/accept states, and let $\text{det}(N)$ denote the subset construction. Then:

$$\text{det}(\text{rev}(\text{det}(\text{rev}(D))))$$

produces the unique minimum DFA for $L(D)$.

This is remarkable: two applications of "reverse, then determinize" always yield the minimum DFA, regardless of the input.

**Complexity:** Worst case $O(2^{2^n})$ due to two subset constructions. In practice, often efficient for small automata.

---

## 6. From Theory to Scanners

### 6.1 Multi-Pattern Matching

In lexical analysis, we have multiple token patterns $r_1, r_2, \ldots, r_k$ (e.g., identifiers, integers, keywords, operators). The scanner must:

1. Find the longest match (maximal munch).
2. On ties, prefer the pattern with higher priority (typically the one listed first).

**Construction:** Build a combined NFA $N$ with a new start state $s_0$ and $\varepsilon$-transitions to each $N(r_i)$. Mark each accept state with the corresponding token type. Apply subset construction. In the resulting DFA, each accept state may correspond to multiple token types; choose the highest-priority one.

### 6.2 Correctness of Multi-Pattern DFA

**Theorem 6.1.** The multi-pattern DFA correctly identifies the token type of any prefix of the input, in the sense that for any string $w = uv$ where $u$ is a prefix accepted by pattern $r_i$ but no longer prefix is accepted by any pattern, the DFA will identify $u$ as a token of type $i$ (assuming $r_i$ has highest priority among all patterns accepting $u$).

*Proof sketch.* The subset construction preserves the language, and the priority marking ensures deterministic resolution of ambiguity. $\blacksquare$

---

## 7. Implementation Considerations

### 7.1 NFA Simulation

Rather than converting to a DFA, one can simulate the NFA directly:

```
function NFA_Simulate(NFA N, string w):
    current = ECLOSE({q_0})
    for each symbol a in w:
        next = empty set
        for each state q in current:
            next = next union delta(q, a)
        current = ECLOSE(next)
    return current intersect F != empty
```

**Complexity:** $O(|w| \cdot |Q|^2)$ per match (or $O(|w| \cdot |Q| \cdot |\delta|)$ with careful implementation).

**Trade-off:**
- NFA simulation: $O(n)$ construction, $O(n \cdot m)$ matching where $n = |r|$, $m = |w|$.
- DFA: potentially $O(2^n)$ construction, $O(m)$ matching.

### 7.2 Lazy DFA Construction

A practical compromise: build DFA states on demand during scanning. Cache computed states; evict if cache grows too large.

```
function LazyDFA_Scan(NFA N, input stream):
    cache = {}
    current_nfa_states = ECLOSE({q_0})
    current_dfa_state = get_or_create(cache, current_nfa_states)

    for each symbol a in input:
        key = (current_dfa_state, a)
        if key not in cache:
            next_nfa = ECLOSE(move(current_nfa_states, a))
            cache[key] = get_or_create(cache, next_nfa)
        current_dfa_state = cache[key]
        // check for acceptance, track longest match, etc.
```

---

## 8. Complexity Summary

| Operation | Time Complexity |
|-----------|----------------|
| Thompson's construction (RE $\to$ NFA) | $O(\lvert r \rvert)$ |
| Subset construction (NFA $\to$ DFA) | $O(2^n \cdot \lvert\Sigma\rvert)$ worst case |
| DFA minimization (Hopcroft) | $O(n \lvert\Sigma\rvert \log n)$ |
| DFA simulation (matching) | $O(\lvert w \rvert)$ |
| NFA simulation (matching) | $O(\lvert w \rvert \cdot \lvert Q \rvert^2)$ |
| Brzozowski DFA | Finite, but potentially exponential in $\lvert r \rvert$ |

---

## References

1. Thompson, K. "Programming Techniques: Regular expression search algorithm." *Communications of the ACM*, 11(6):419--422, 1968.
2. Hopcroft, J. E. "An $n \log n$ algorithm for minimizing states in a finite automaton." *Theory of Machines and Computations*, pp. 189--196, 1971.
3. Brzozowski, J. A. "Derivatives of regular expressions." *Journal of the ACM*, 11(4):481--494, 1964.
4. Brzozowski, J. A. "Canonical regular expressions and minimal state graphs for definite events." *Mathematical Theory of Automata*, pp. 529--561, 1962.
5. Aho, A. V. "Algorithms for finding patterns in strings." *Handbook of Theoretical Computer Science*, Vol. A, pp. 255--300, 1990.
6. Rabin, M. O. and Scott, D. "Finite Automata and Their Decision Problems." *IBM Journal of Research and Development*, 3(2):114--125, 1959.
7. Cox, R. "Regular Expression Matching Can Be Simple And Fast." https://swtch.com/~rsc/regexp/regexp1.html, 2007.
