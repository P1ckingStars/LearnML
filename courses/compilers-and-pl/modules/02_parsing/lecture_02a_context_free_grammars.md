# Lecture 02a: Context-Free Grammars & Parse Trees

**Module 02 -- Parsing**
**Week 3**

---

## 1. Context-Free Grammars: Formal Definition

### 1.1 Definition

**Definition 1.1 (Context-Free Grammar).** A *context-free grammar* (CFG) is a 4-tuple $G = (V, T, P, S)$ where:

- $V$ is a finite set of *variables* (nonterminals).
- $T$ is a finite set of *terminals* (tokens), with $V \cap T = \emptyset$.
- $P \subseteq V \times (V \cup T)^*$ is a finite set of *productions*. A production $(A, \alpha) \in P$ is written $A \to \alpha$.
- $S \in V$ is the *start symbol*.

**Notation.** We use uppercase letters $A, B, C, S$ for nonterminals, lowercase letters $a, b, c$ for terminals, Greek letters $\alpha, \beta, \gamma$ for strings in $(V \cup T)^*$, and $w, x, y, z$ for strings in $T^*$.

### 1.2 Derivations

**Definition 1.2 (Derivation step).** We write $\alpha A \beta \Rightarrow_G \alpha \gamma \beta$ if $A \to \gamma \in P$. The subscript $G$ is omitted when clear from context.

**Definition 1.3.** The relation $\Rightarrow^*$ is the reflexive-transitive closure of $\Rightarrow$. If $S \Rightarrow^* \alpha$, we say $\alpha$ is a *sentential form*. If $S \Rightarrow^* w$ with $w \in T^*$, then $w$ is a *sentence* of $G$.

**Definition 1.4.** The *language generated* by $G$ is:

$$L(G) = \{w \in T^* \mid S \Rightarrow^* w\}$$

### 1.3 Leftmost and Rightmost Derivations

**Definition 1.5.** A *leftmost derivation* ($\Rightarrow_{lm}$) always replaces the leftmost nonterminal. A *rightmost derivation* ($\Rightarrow_{rm}$) always replaces the rightmost nonterminal.

**Theorem 1.6.** For any CFG $G$ and $w \in T^*$: $S \Rightarrow^* w$ iff $S \Rightarrow_{lm}^* w$ iff $S \Rightarrow_{rm}^* w$.

*Proof.* The forward directions are trivial. For the reverse, given any derivation, one can reorder the production applications to obtain a leftmost (or rightmost) derivation, since applications to disjoint portions of the sentential form are independent. A formal proof proceeds by induction on the length of the derivation. $\blacksquare$

---

## 2. Parse Trees

### 2.1 Definition

**Definition 2.1 (Parse Tree).** A *parse tree* for grammar $G = (V, T, P, S)$ is an ordered, rooted, labeled tree satisfying:

1. The root is labeled $S$.
2. Each leaf is labeled with a terminal $a \in T$ or $\varepsilon$.
3. Each interior node is labeled with a nonterminal $A \in V$.
4. If an interior node labeled $A$ has children labeled $X_1, X_2, \ldots, X_k$ (left to right), then $A \to X_1 X_2 \cdots X_k \in P$.
5. If an interior node labeled $A$ has a single child labeled $\varepsilon$, then $A \to \varepsilon \in P$.

The *yield* (or *frontier*) of the parse tree is the string obtained by reading the leaves left to right.

### 2.2 Correspondence Between Derivations and Parse Trees

**Theorem 2.2.** There is a bijection between leftmost derivations of $w$ and parse trees with yield $w$. Similarly for rightmost derivations.

*Proof sketch.* Given a leftmost derivation $S \Rightarrow_{lm} \gamma_1 \Rightarrow_{lm} \gamma_2 \Rightarrow_{lm} \cdots \Rightarrow_{lm} w$, construct the parse tree top-down: each derivation step $\alpha A \beta \Rightarrow_{lm} \alpha \gamma \beta$ corresponds to expanding the leftmost unexpanded leaf $A$ with children from the production $A \to \gamma$.

Conversely, given a parse tree, perform a leftmost preorder traversal to recover the unique leftmost derivation. $\blacksquare$

### 2.3 Abstract Syntax Trees

**Definition 2.3 (AST).** An *abstract syntax tree* is a simplified parse tree that:
- Omits punctuation tokens (parentheses, semicolons, commas).
- Omits chain productions ($A \to B$).
- Represents operators as internal nodes with operands as children.

**Example.** For the expression `3 + 4 * 5` with the standard grammar:

Parse tree:
```
        E
       /|\
      E  +  T
      |    /|\
      T   T  *  F
      |   |     |
      F   F     5
      |   |
      3   4
```

AST:
```
    +
   / \
  3   *
     / \
    4   5
```

---

## 3. Ambiguity

### 3.1 Definition

**Definition 3.1.** A CFG $G$ is *ambiguous* if there exists a string $w \in L(G)$ with two or more distinct parse trees (equivalently, two or more distinct leftmost derivations).

**Example 3.2.** The grammar $E \to E + E \mid E * E \mid (E) \mid \mathbf{id}$ is ambiguous. The string $\mathbf{id} + \mathbf{id} * \mathbf{id}$ has two parse trees: one interpreting $+$ before $*$, the other interpreting $*$ before $+$.

### 3.2 Disambiguation

Ambiguity is resolved by:

1. **Rewriting the grammar** to encode precedence and associativity:

$$E \to E + T \mid T$$
$$T \to T * F \mid F$$
$$F \to (E) \mid \mathbf{id}$$

This grammar is unambiguous: $*$ binds tighter than $+$ (encoded by nesting), and both are left-associative (encoded by left recursion).

2. **Disambiguation rules** in parser generators: specify `%left`, `%right`, `%nonassoc` directives.

### 3.3 Inherent Ambiguity

**Definition 3.3.** A CFL $L$ is *inherently ambiguous* if every CFG generating $L$ is ambiguous.

**Theorem 3.4 (Parikh, 1966; Ogden, 1968).** The language:

$$L = \{a^i b^j c^k \mid i = j \text{ or } j = k\}$$

is inherently ambiguous.

*Proof sketch.* Any grammar for $L$ must generate $a^n b^n c^n$ (which is in $L$ since both $i = j$ and $j = k$ hold). One can show using Ogden's lemma that any grammar must have distinct derivation trees for such strings, arising from the fact that $L$ is the union of two "incompatible" CFLs. The full proof uses a refined version of the pumping lemma for CFLs. $\blacksquare$

### 3.4 Undecidability

**Theorem 3.5.** It is undecidable whether a given CFG is ambiguous.

*Proof.* Reduction from Post's Correspondence Problem (PCP). Given PCP instance $(u_1, \ldots, u_k, v_1, \ldots, v_k)$, construct grammar with productions:

$$S \to A \mid B$$
$$A \to u_1 A a_1 \mid \cdots \mid u_k A a_k \mid u_1 a_1 \mid \cdots \mid u_k a_k$$
$$B \to v_1 B a_1 \mid \cdots \mid v_k B a_k \mid v_1 a_1 \mid \cdots \mid v_k a_k$$

This grammar is ambiguous iff the PCP instance has a solution. Since PCP is undecidable, so is CFG ambiguity. $\blacksquare$

---

## 4. Grammar Transformations

### 4.1 Elimination of Left Recursion

**Definition 4.1.** A grammar is *left-recursive* if $A \Rightarrow^+ A\alpha$ for some nonterminal $A$ and string $\alpha$.

**Immediate left recursion.** Productions of the form $A \to A\alpha_1 \mid \cdots \mid A\alpha_m \mid \beta_1 \mid \cdots \mid \beta_n$ (where no $\beta_i$ starts with $A$) are replaced by:

$$A \to \beta_1 A' \mid \cdots \mid \beta_n A'$$
$$A' \to \alpha_1 A' \mid \cdots \mid \alpha_m A' \mid \varepsilon$$

**Theorem 4.2.** This transformation preserves the language: $L(G') = L(G)$.

*Proof.* The original $A$ generates strings of the form $\beta_i \alpha_{j_1} \alpha_{j_2} \cdots \alpha_{j_k}$. After transformation, $A$ generates $\beta_i A'$ and $A'$ generates $\alpha_{j_1} \alpha_{j_2} \cdots \alpha_{j_k}$ (via right recursion terminated by $\varepsilon$). Both produce the same set of terminal strings. $\blacksquare$

**General left recursion** (indirect: $A \Rightarrow^+ A\alpha$ through multiple nonterminals) is eliminated by ordering the nonterminals and systematically substituting to remove all cycles.

### 4.2 Left Factoring

When two productions for the same nonterminal share a common prefix, the grammar is not suitable for predictive parsing. *Left factoring* extracts the common prefix:

$$A \to \alpha \beta_1 \mid \alpha \beta_2$$

becomes:

$$A \to \alpha A'$$
$$A' \to \beta_1 \mid \beta_2$$

---

## 5. Normal Forms

### 5.1 Chomsky Normal Form (CNF)

**Theorem 5.1.** Every CFL not containing $\varepsilon$ is generated by a grammar in CNF, where every production has the form:

$$A \to BC \quad \text{or} \quad A \to a$$

with $A, B, C \in V$ and $a \in T$.

**Conversion algorithm:**

1. **Eliminate $\varepsilon$-productions:** For each nonterminal $A$ with $A \Rightarrow^* \varepsilon$ (nullable), replace each occurrence of $A$ in right-hand sides with both $A$ present and $A$ absent.

2. **Eliminate unit productions:** $A \to B$ where $B \in V$. Compute the unit closure and replace.

3. **Eliminate useless symbols:** Remove unreachable and non-generating nonterminals.

4. **Convert to binary:** Replace $A \to X_1 X_2 \cdots X_k$ (for $k > 2$) with $A \to X_1 A_1$, $A_1 \to X_2 A_2$, ..., $A_{k-2} \to X_{k-1} X_k$.

5. **Isolate terminals:** Replace each terminal $a$ in right-hand sides of length $\geq 2$ with a fresh nonterminal $C_a$ and add $C_a \to a$.

### 5.2 Greibach Normal Form (GNF)

**Theorem 5.2.** Every CFL not containing $\varepsilon$ is generated by a grammar in GNF, where every production has the form:

$$A \to a \alpha \quad \text{where } a \in T, \alpha \in V^*$$

GNF ensures every derivation step consumes exactly one terminal, which means any derivation of a string of length $n$ takes exactly $n$ steps.

---

## 6. The CYK Algorithm

### 6.1 Algorithm

The Cocke-Younger-Kasami (CYK) algorithm is a dynamic programming algorithm for parsing with CNF grammars.

**Input:** Grammar $G$ in CNF, string $w = a_1 a_2 \cdots a_n$.

**Idea:** Build a table $T[i][j]$ containing all nonterminals that can derive the substring $a_i a_{i+1} \cdots a_j$.

```
function CYK(Grammar G in CNF, string w = a_1 ... a_n):
    // Initialize table
    for i = 1 to n:
        T[i][i] = {A : A -> a_i in P}

    // Fill diagonals (increasing substring length)
    for length = 2 to n:
        for i = 1 to n - length + 1:
            j = i + length - 1
            T[i][j] = {}
            for k = i to j - 1:
                for each production A -> BC in P:
                    if B in T[i][k] and C in T[k+1][j]:
                        T[i][j] = T[i][j] union {A}

    return S in T[1][n]
```

### 6.2 Complexity

**Theorem 6.1.** The CYK algorithm runs in $O(n^3 \cdot |P|)$ time and $O(n^2 \cdot |V|)$ space.

*Proof.* There are $O(n^2)$ entries in the table. For each entry $T[i][j]$ with $j - i + 1 = \ell$, we iterate over $\ell - 1$ split points and $|P|$ productions, giving $O(n \cdot |P|)$ work per entry. Total: $O(n^2 \cdot n \cdot |P|) = O(n^3 |P|)$. Each entry stores a subset of $V$, requiring $O(|V|)$ space. $\blacksquare$

### 6.3 Recovering Parse Trees

To recover a parse tree (not just check membership), store *back-pointers*: for each $A \in T[i][j]$, record which production $A \to BC$ and which split point $k$ were used. Trace back from $S \in T[1][n]$ to reconstruct the tree.

---

## 7. Earley's Algorithm

### 7.1 Motivation

CYK requires CNF conversion. Earley's algorithm (1970) works with *arbitrary* CFGs and runs in:
- $O(n^3)$ for general CFGs
- $O(n^2)$ for unambiguous grammars
- $O(n)$ for LL(k) and LR(k) grammars (i.e., deterministic CFLs)

### 7.2 Earley Items

**Definition 7.1 (Earley item).** An Earley item is a triple $[A \to \alpha \bullet \beta, j]$ where $A \to \alpha \beta$ is a production and $j$ is the *origin* (the position in the input where recognition of this production began). The dot $\bullet$ indicates how much of the right-hand side has been recognized so far.

### 7.3 Algorithm

The algorithm maintains sets $S_0, S_1, \ldots, S_n$ (one per input position). Each set contains Earley items.

```
function EarleyParse(Grammar G, string w = a_1 ... a_n):
    S_0 = {[S' -> . S, 0]}  // S' is augmented start symbol

    for i = 0 to n:
        for each item in S_i:  // process items as they are added
            if item = [A -> alpha . B beta, j]:  // B is nonterminal
                PREDICT(B, i)
            elif item = [A -> alpha . a_i+1 beta, j] and i < n:
                SCAN(item, i)
            elif item = [A -> alpha ., j]:
                COMPLETE(item, i)

    return [S' -> S ., 0] in S_n

function PREDICT(B, i):
    for each production B -> gamma:
        add [B -> . gamma, i] to S_i

function SCAN(item = [A -> alpha . a beta, j], i):
    add [A -> alpha a . beta, j] to S_{i+1}

function COMPLETE(item = [A -> gamma ., j], i):
    for each item [B -> alpha . A beta, k] in S_j:
        add [B -> alpha A . beta, k] to S_i
```

### 7.4 Correctness

**Theorem 7.2 (Earley, 1970).** $[A \to \alpha \bullet \beta, j] \in S_i$ iff $S \Rightarrow^* a_1 \cdots a_j A \delta$ and $A \Rightarrow^* a_{j+1} \cdots a_i \beta$ for some $\delta$, using the first part of the production $\alpha$.

The proof is by induction on the number of items added.

### 7.5 Complexity Analysis

**Theorem 7.3.** Earley's algorithm runs in $O(n^3)$ time for arbitrary CFGs.

*Proof.* Each set $S_i$ has at most $O(n \cdot |P|)$ items (since there are $|P|$ production positions and $n + 1$ possible origin values). The COMPLETE step is the bottleneck: for each completed item in $S_i$, we scan $S_j$ for items with $A$ after the dot. With proper indexing, this takes $O(n \cdot |P|)$ per item. Total: $O(n \cdot n|P| \cdot n) = O(n^3 |P|^2)$, which simplifies to $O(n^3)$ for fixed $G$. $\blacksquare$

---

## 8. Grammar Classes for Deterministic Parsing

### 8.1 Hierarchy

$$\text{LL}(1) \subsetneq \text{LL}(k) \subsetneq \text{LR}(1) = \text{DCFL}$$

$$\text{LR}(0) \subsetneq \text{SLR}(1) \subsetneq \text{LALR}(1) \subsetneq \text{LR}(1)$$

**Theorem 8.1 (Knuth, 1965).** A language is deterministic context-free iff it has an LR(1) grammar. Moreover, for every $k \geq 1$, $\text{LR}(k)$ grammars generate exactly the deterministic CFLs.

**Theorem 8.2.** Every LL(1) grammar is LR(1), but not conversely. Left-recursive grammars are never LL(k) for any $k$, but may be LR(1).

### 8.2 Significance for Compiler Design

- **LL(1)** is sufficient for most hand-written recursive descent parsers. Grammars may need left-factoring and left-recursion elimination.
- **LALR(1)** is the sweet spot for parser generators (yacc, bison): nearly the power of LR(1) with the table size of SLR(1).
- **GLR** handles arbitrary CFGs (including ambiguous ones) deterministically where possible, with nondeterministic splitting where necessary.

---

## 9. The Pumping Lemma for CFLs (Review)

**Theorem 9.1.** If $L$ is a CFL, then there exists $p$ such that every $w \in L$ with $|w| \geq p$ can be decomposed as $w = uvxyz$ where:

1. $|vy| \geq 1$
2. $|vxy| \leq p$
3. $\forall i \geq 0: uv^i xy^i z \in L$

**Application.** $\{a^n b^n c^n \mid n \geq 0\}$ is not context-free.

*Proof.* Set $w = a^p b^p c^p$. For any decomposition, $vxy$ can span at most two of the three symbol groups (since $|vxy| \leq p$). Pumping produces a string with an unequal count of at least one pair of symbols. $\blacksquare$

---

## 10. Ogden's Lemma

**Theorem 10.1 (Ogden, 1968).** A strengthened version of the CFL pumping lemma. If $L$ is a CFL, then there exists $p$ such that for every $w \in L$ with at least $p$ *marked* positions, $w = uvxyz$ where:

1. $vy$ contains at least one marked position.
2. $vxy$ contains at most $p$ marked positions.
3. $\forall i \geq 0: uv^i xy^i z \in L$.

Ogden's lemma is strictly stronger than the standard pumping lemma and is essential for proving inherent ambiguity and non-context-freeness in cases where the standard lemma fails.

---

## References

1. Knuth, D. E. "On the translation of languages from left to right." *Information and Control*, 8(6):607--639, 1965.
2. Earley, J. "An efficient context-free parsing algorithm." *Communications of the ACM*, 13(2):94--102, 1970.
3. Younger, D. H. "Recognition and parsing of context-free languages in time $n^3$." *Information and Control*, 10(2):189--208, 1967.
4. Kasami, T. "An efficient recognition and syntax-analysis algorithm for context-free languages." *AFCRL Report*, 1965.
5. Cocke, J. "Programming languages and their compilers." *Courant Institute, NYU*, 1969.
6. Parikh, R. J. "On context-free languages." *JACM*, 13(4):570--581, 1966.
7. Ogden, W. "A helpful result for proving inherent ambiguity." *Mathematical Systems Theory*, 2(3):191--194, 1968.
8. Grune, D. and Jacobs, C. J. H. *Parsing Techniques: A Practical Guide*, 2nd ed. Springer, 2008.
