# Lecture 01c: Formal Language Theory in Depth

**Module 01 -- Lexical Analysis**
**Week 2**

---

## 1. Closure Properties of Regular Languages

### 1.1 Boolean Closures

**Theorem 1.1.** The class of regular languages is closed under:
- Union, intersection, complement, difference, symmetric difference.

*Proof (complement).* Given DFA $D = (Q, \Sigma, \delta, q_0, F)$ for $L$, construct $D' = (Q, \Sigma, \delta, q_0, Q \setminus F)$. Then $L(D') = \overline{L}$. $\blacksquare$

*Proof (intersection).* $L_1 \cap L_2 = \overline{\overline{L_1} \cup \overline{L_2}}$ (De Morgan). Alternatively, use the *product construction*:

Given DFAs $D_1 = (Q_1, \Sigma, \delta_1, q_1^0, F_1)$ and $D_2 = (Q_2, \Sigma, \delta_2, q_2^0, F_2)$, construct:

$$D_\cap = (Q_1 \times Q_2,\ \Sigma,\ \delta_\cap,\ (q_1^0, q_2^0),\ F_1 \times F_2)$$

where $\delta_\cap((p, q), a) = (\delta_1(p, a), \delta_2(q, a))$.

**Proposition 1.2.** $|Q_1 \times Q_2| = |Q_1| \cdot |Q_2|$. This bound is tight: there exist languages $L_1, L_2$ with $m$ and $n$ states respectively whose intersection requires $mn$ states.

### 1.2 Algebraic Closures

**Theorem 1.3.** Regular languages are closed under:
- Concatenation
- Kleene star and Kleene plus
- Reversal: $L^R = \{w^R \mid w \in L\}$
- Homomorphism: $h(L) = \{h(w) \mid w \in L\}$ for homomorphism $h: \Sigma^* \to \Delta^*$
- Inverse homomorphism: $h^{-1}(L) = \{w \mid h(w) \in L\}$

*Proof (reversal).* Given NFA $N = (Q, \Sigma, \delta, q_0, F)$ for $L$, construct NFA $N^R$ by:
- Reversing all transitions: $q \in \delta^R(p, a) \iff p \in \delta(q, a)$.
- Making $F$ the set of start states (add new start $s$ with $\varepsilon$-transitions to all $f \in F$).
- Making $\{q_0\}$ the accept set.
Then $L(N^R) = L^R$. $\blacksquare$

*Proof (inverse homomorphism).* Given DFA $D = (Q, \Sigma, \delta, q_0, F)$ for $L$ and homomorphism $h: \Gamma^* \to \Sigma^*$, construct DFA $D' = (Q, \Gamma, \delta', q_0, F)$ where $\delta'(q, a) = \hat{\delta}(q, h(a))$. Then $L(D') = h^{-1}(L)$.

**Key fact:** Inverse homomorphism does not increase the number of states. This makes it a powerful tool in proofs. $\blacksquare$

### 1.3 Closure Under Substitution

**Definition 1.4.** A *substitution* $s: \Sigma \to \mathcal{P}(\Delta^*)$ maps each symbol $a$ to a language $s(a)$. Extended to strings: $s(\varepsilon) = \{\varepsilon\}$, $s(a_1 \cdots a_n) = s(a_1) \cdot s(a_2) \cdots s(a_n)$.

**Theorem 1.5.** If $L$ is regular and each $s(a)$ is regular, then $s(L) = \bigcup_{w \in L} s(w)$ is regular.

---

## 2. Decision Problems for Regular Languages

### 2.1 Summary of Decidable Problems

| Problem | Input | Complexity |
|---------|-------|-----------|
| Membership: $w \in L(D)$? | DFA $D$, string $w$ | $O(\lvert w \rvert)$ |
| Emptiness: $L(D) = \emptyset$? | DFA $D$ | $O(\lvert Q \rvert + \lvert \delta \rvert)$ |
| Universality: $L(D) = \Sigma^*$? | DFA $D$ | $O(\lvert Q \rvert + \lvert \delta \rvert)$ |
| Equivalence: $L(D_1) = L(D_2)$? | DFAs $D_1, D_2$ | $O(n \log n)$ via Hopcroft |
| Inclusion: $L(D_1) \subseteq L(D_2)$? | DFAs $D_1, D_2$ | $O(n \log n)$ |
| Finiteness: is $L(D)$ finite? | DFA $D$ | $O(\lvert Q \rvert + \lvert \delta \rvert)$ |

For NFA inputs, the complexity may increase (e.g., universality of NFAs is PSPACE-complete).

### 2.2 Emptiness and Finiteness

**Algorithm (Emptiness).** $L(D) \neq \emptyset$ iff some accept state is reachable from $q_0$. Check via BFS/DFS in $O(|Q| + |\delta|)$.

**Algorithm (Finiteness).** $L(D)$ is infinite iff the DFA (after removing unreachable and dead states) contains a cycle on a path from a start-reachable state to an accept-reachable state. Detect via DFS in $O(|Q| + |\delta|)$.

### 2.3 Equivalence via Hopcroft-Karp

**Theorem 2.1 (Hopcroft-Karp).** Equivalence of two DFAs with $n_1$ and $n_2$ states can be decided in $O((n_1 + n_2) \log(n_1 + n_2))$ time using a union-find based algorithm.

The algorithm works by attempting to merge states of the two DFAs. Start by pairing the start states. If one state is accepting and the other is not, the languages differ. Otherwise, recursively pair their successors under each input symbol. Use union-find to track merged pairs efficiently.

### 2.4 NFA Universality

**Theorem 2.2.** The universality problem for NFAs (given NFA $N$, is $L(N) = \Sigma^*$?) is PSPACE-complete.

*Proof sketch (PSPACE-hardness).* Reduce from the acceptance problem for polynomial-space bounded Turing machines. The key idea: the complement of an NFA can require exponentially many DFA states, and universality requires checking the complement for emptiness. $\blacksquare$

---

## 3. Star-Free Languages and Counter-Free Automata

### 3.1 Star-Free Expressions

**Definition 3.1.** A *star-free expression* over $\Sigma$ is built from $\emptyset$, $\varepsilon$, and single symbols $a \in \Sigma$ using union, concatenation, and *complement* (but not Kleene star).

**Example:** The language $(ab)^*$ is star-free: $\overline{\emptyset} \setminus (\overline{\emptyset} \cdot ba \cdot \overline{\emptyset}) \setminus (b \cdot \overline{\emptyset}) \setminus (\overline{\emptyset} \cdot a)$ (informally: all strings not containing $ba$, not starting with $b$, not ending with $a$, adjusted for details).

More precisely, $(ab)^* = \overline{b\Sigma^* \cup \Sigma^*a \cup \Sigma^*aa\Sigma^* \cup \Sigma^*bb\Sigma^* \cup \Sigma^*ba\Sigma^*} \cup \{\varepsilon\}$ where $\Sigma^* = \overline{\emptyset}$.

### 3.2 Counter-Free Automata

**Definition 3.2.** A DFA is *counter-free* if for every state $q$ and every non-empty string $w$, if $\hat{\delta}(q, w) = q$ (i.e., $w$ induces a cycle at $q$), then $\hat{\delta}(p, w) = p$ for all states $p$ reachable from $q$ on any prefix of $w$... more precisely, no string $w$ induces a permutation on any subset of states that is a non-trivial cycle.

A simpler characterization: the DFA is counter-free iff no string $w$ induces a cyclic permutation of length $> 1$ on any subset of states.

### 3.3 McNaughton-Papert Theorem

**Theorem 3.3 (McNaughton-Papert, 1971; Schutzenberger, 1965).** The following are equivalent for a regular language $L$:

1. $L$ is star-free.
2. $L$ is recognized by a counter-free DFA.
3. The syntactic monoid of $L$ is *aperiodic* (group-free).
4. $L$ is definable in first-order logic with order ($\text{FO}[<]$).

This deep result connects automata theory, algebra, and logic. The equivalence $(1) \iff (3)$ is due to Schutzenberger; $(1) \iff (4)$ is due to McNaughton and Papert.

### 3.4 Significance

Star-free languages correspond to the complexity class $\text{AC}^0$ (constant-depth, polynomial-size circuits). They are exactly the languages computable with "no counting," which has implications for parallel evaluation and circuit complexity of pattern matching.

---

## 4. Weighted Automata and Transducers

### 4.1 Weighted Automata

**Definition 4.1.** A *weighted finite automaton* (WFA) over a semiring $(K, +, \cdot, 0, 1)$ is a tuple $A = (Q, \Sigma, I, \delta, F)$ where:

- $I: Q \to K$ assigns initial weights.
- $\delta: Q \times \Sigma \times Q \to K$ assigns transition weights.
- $F: Q \to K$ assigns final weights.

The *weight* of a path $\pi = q_0 \xrightarrow{a_1} q_1 \xrightarrow{a_2} \cdots \xrightarrow{a_n} q_n$ is:

$$w(\pi) = I(q_0) \cdot \delta(q_0, a_1, q_1) \cdot \delta(q_1, a_2, q_2) \cdots \delta(q_{n-1}, a_n, q_n) \cdot F(q_n)$$

The *weight of a string* $w = a_1 \cdots a_n$ is the sum over all paths:

$$[\![ A ]\!](w) = \sum_{\pi: q_0 \xrightarrow{w} q_n} w(\pi)$$

### 4.2 Common Semirings

| Semiring | $K$ | $+$ | $\cdot$ | $0$ | $1$ | Application |
|----------|-----|-----|---------|-----|-----|-------------|
| Boolean | $\{0, 1\}$ | $\lor$ | $\land$ | $0$ | $1$ | Standard automata |
| Tropical | $\mathbb{R}_{\geq 0} \cup \{\infty\}$ | $\min$ | $+$ | $\infty$ | $0$ | Shortest path |
| Probability | $\mathbb{R}_{\geq 0}$ | $+$ | $\cdot$ | $0$ | $1$ | Probabilistic models |
| Counting | $\mathbb{N}$ | $+$ | $\cdot$ | $0$ | $1$ | Count accepting paths |

### 4.3 Finite-State Transducers

**Definition 4.2.** A *finite-state transducer* (FST) is a finite automaton that produces output as well as reading input. Formally, an FST is $(Q, \Sigma, \Delta, \delta, q_0, F)$ where $\delta \subseteq Q \times (\Sigma \cup \{\varepsilon\}) \times (\Delta \cup \{\varepsilon\}) \times Q$.

An FST defines a *relation* $R \subseteq \Sigma^* \times \Delta^*$: $(u, v) \in R$ iff there is an accepting path reading input $u$ and producing output $v$.

**Definition 4.3.** A *sequential transducer* (subsequential transducer) is a deterministic FST: for each state and input symbol, there is at most one transition. Sequential transducers compute *functions* $f: \Sigma^* \to \Delta^*$.

### 4.4 Applications to Lexical Analysis

- **Tokenization as transduction:** A scanner can be modeled as a transducer that maps character streams to token streams. The input alphabet is the character set; the output alphabet is the set of tokens.

- **Text normalization:** Unicode normalization (NFC, NFD) can be implemented as weighted transducers.

- **Morphological analysis:** In natural language processing, morphological analyzers are commonly implemented as FSTs (e.g., Xerox finite-state tools, OpenFST).

---

## 5. Applications to String Matching and Text Processing

### 5.1 Aho-Corasick Algorithm

**Problem:** Given a set of patterns $P = \{p_1, \ldots, p_k\}$ and a text $T$, find all occurrences of any pattern in $T$.

**Theorem 5.1 (Aho-Corasick, 1975).** The multi-pattern matching problem can be solved in $O(|T| + \sum_i |p_i| + z)$ time where $z$ is the number of matches, using an automaton constructed in $O(\sum_i |p_i|)$ time.

**Construction:** Build a trie of all patterns. Add *failure links* (analogous to the KMP failure function) connecting each node to the longest proper suffix that is a prefix of some pattern. Add *output links* to enumerate all patterns ending at each position.

```
function BuildAhoCorasick(patterns P):
    // Phase 1: Build trie
    root = new TrieNode()
    for each pattern p in P:
        node = root
        for each character c in p:
            if c not in node.children:
                node.children[c] = new TrieNode()
            node = node.children[c]
        node.output.add(p)

    // Phase 2: Build failure links via BFS
    queue = empty queue
    for each child c of root:
        c.fail = root
        queue.enqueue(c)

    while queue is not empty:
        u = queue.dequeue()
        for each child v of u via character a:
            queue.enqueue(v)
            w = u.fail
            while w != root and a not in w.children:
                w = w.fail
            v.fail = w.children[a] if a in w.children else root
            v.output = v.output union v.fail.output

    return root
```

**Search:**

```
function AhoCorasickSearch(root, text T):
    state = root
    for i = 0 to |T| - 1:
        while state != root and T[i] not in state.children:
            state = state.fail
        if T[i] in state.children:
            state = state.children[T[i]]
        for each pattern p in state.output:
            report match of p ending at position i
```

### 5.2 Relationship to DFA

The Aho-Corasick automaton can be viewed as a DFA (by following failure links to determine transitions). The DFA has $O(\sum |p_i|)$ states and processes each character of $T$ in $O(1)$ amortized time (or worst-case $O(1)$ with the explicit DFA).

### 5.3 Regular Expression Matching in Text Editors

Tools like grep use Thompson NFA simulation (or DFA construction) for guaranteed linear-time matching, unlike backtracking engines (Perl, Python, Java) which can exhibit exponential time on pathological inputs.

**Example of catastrophic backtracking:** The regex $(a?)^n a^n$ matched against $a^n$ takes $O(2^n)$ time with a backtracking engine but $O(n)$ with Thompson/DFA.

---

## 6. Beyond Regular: Where Lexical Analysis Meets Context-Free

### 6.1 Limitations

Some lexical constructs are not regular:
- **Nested comments:** $\{/\!*\, (\text{text without } *\!/)^*\, (/\!*\, \cdots\, *\!/)^*\, (\text{text without } *\!/)^*\, *\!/\}$ requires counting nesting depth.
- **String interpolation:** Languages like Ruby, Kotlin, and Swift allow arbitrary expressions inside string literals, requiring the lexer to interact with the parser.
- **Python indentation:** INDENT/DEDENT tokens require maintaining a stack of indentation levels.

### 6.2 Pragmatic Solutions

These are handled by augmenting the scanner with:
- **Counters** (for nesting depth).
- **Stacks** (for indentation or matched delimiters).
- **Scanner-parser feedback** (the parser tells the scanner about context, e.g., whether `>` is a comparison operator or the end of a generic type parameter).

The formal model is a *visibly pushdown automaton* or a scanner-parser combination.

---

## References

1. McNaughton, R. and Papert, S. *Counter-Free Automata*. MIT Press, 1971.
2. Schutzenberger, M. P. "On finite monoids having only trivial subgroups." *Information and Control*, 8(2):190--194, 1965.
3. Sakarovitch, J. *Elements of Automata Theory*. Cambridge University Press, 2009.
4. Aho, A. V. and Corasick, M. J. "Efficient string matching: an aid to bibliographic search." *Communications of the ACM*, 18(6):333--340, 1975.
5. Droste, M., Kuich, W., and Vogler, H. *Handbook of Weighted Automata*. Springer, 2009.
6. Mohri, M. "Finite-state transducers in language and speech processing." *Computational Linguistics*, 23(2):269--311, 1997.
7. Mohri, M. "Weighted automata algorithms." *Handbook of Weighted Automata*, pp. 213--254, 2009.
