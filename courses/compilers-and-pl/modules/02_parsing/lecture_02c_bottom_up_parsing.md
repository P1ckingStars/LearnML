# Lecture 02c: Bottom-Up Parsing

**Module 02 -- Parsing**
**Week 4**

---

## 1. Shift-Reduce Parsing

### 1.1 Overview

Bottom-up parsing constructs the parse tree from leaves to root, or equivalently, discovers a *rightmost derivation in reverse*. The parser reads input left to right and builds the derivation by identifying *handles* -- substrings that match the right-hand side of a production and can be reduced.

### 1.2 The Shift-Reduce Framework

The parser maintains a *stack* (of grammar symbols) and an *input buffer*. At each step, it performs one of four actions:

- **Shift:** Push the next input token onto the stack.
- **Reduce:** Pop symbols matching a production's right-hand side and push the left-hand side nonterminal.
- **Accept:** Parsing is complete (stack contains $S$, input is empty).
- **Error:** No valid action exists.

**Theorem 1.1.** If a shift-reduce parser makes no errors, the sequence of reductions (read in reverse) forms a rightmost derivation of the input.

### 1.3 Handles

**Definition 1.1.** A *handle* of a right-sentential form $\gamma$ is a production $A \to \beta$ and a position in $\gamma$ where $\beta$ may be found, such that replacing $\beta$ by $A$ yields the previous sentential form in the rightmost derivation.

Formally, if $S \Rightarrow_{rm}^* \alpha A w \Rightarrow_{rm} \alpha \beta w = \gamma$ (where $w \in T^*$), then $A \to \beta$ at position after $\alpha$ is the handle.

**Theorem 1.2.** In an unambiguous grammar, every right-sentential form has a unique handle.

---

## 2. LR(0) Items and the LR(0) Automaton

### 2.1 LR(0) Items

**Definition 2.1.** An *LR(0) item* is a production with a dot ($\bullet$) at some position on the right-hand side. For production $A \to X Y Z$, the items are:

$$[A \to \bullet X Y Z], \quad [A \to X \bullet Y Z], \quad [A \to X Y \bullet Z], \quad [A \to X Y Z \bullet]$$

An item $[A \to \alpha \bullet \beta]$ indicates that $\alpha$ has been seen (is on the stack) and $\beta$ is expected.

### 2.2 Closure and Goto

**Definition 2.2 (Closure).** The *closure* of an item set $I$ is:

```
function CLOSURE(I):
    J = I
    repeat until no changes:
        for each item [A -> alpha . B beta] in J:
            for each production B -> gamma:
                add [B -> . gamma] to J
    return J
```

**Definition 2.3 (Goto).** For item set $I$ and grammar symbol $X$:

$$\text{GOTO}(I, X) = \text{CLOSURE}(\{[A \to \alpha X \bullet \beta] \mid [A \to \alpha \bullet X \beta] \in I\})$$

### 2.3 Constructing the LR(0) Automaton

The *LR(0) automaton* (also called the *canonical collection of LR(0) item sets*) is a DFA whose states are item sets:

```
function BuildLR0Automaton(Grammar G'):
    // G' is the augmented grammar with S' -> S
    I_0 = CLOSURE({[S' -> . S]})
    C = {I_0}  // collection of item sets
    WorkList = {I_0}

    while WorkList is not empty:
        remove I from WorkList
        for each grammar symbol X (terminal or nonterminal):
            J = GOTO(I, X)
            if J is not empty and J not in C:
                C = C union {J}
                WorkList = WorkList union {J}
            record transition I --X--> J

    return (C, transitions)
```

### 2.4 LR(0) Parsing

An LR(0) parser uses the automaton states directly:

- **Shift** when the current state has items with the dot before a terminal.
- **Reduce** by $A \to \alpha$ when the state contains $[A \to \alpha \bullet]$.
- **Accept** when the state contains $[S' \to S \bullet]$.

**Conflict:** An LR(0) conflict occurs when a state has both shift and reduce items (*shift-reduce conflict*) or multiple reduce items (*reduce-reduce conflict*).

**Theorem 2.4.** Very few practical grammars are LR(0). LR(0) cannot handle any grammar with $\varepsilon$-productions or right-hand sides that are prefixes of other right-hand sides for the same nonterminal.

---

## 3. SLR(1) Parsing

### 3.1 Idea

SLR(1) (*Simple LR*) resolves LR(0) conflicts by using FOLLOW sets to determine when to reduce.

**SLR(1) action table:**
- If $[A \to \alpha \bullet a \beta] \in I_i$ (dot before terminal $a$): $\text{ACTION}[i, a] = \text{shift } j$ where $I_j = \text{GOTO}(I_i, a)$.
- If $[A \to \alpha \bullet] \in I_i$ and $A \neq S'$: $\text{ACTION}[i, a] = \text{reduce } A \to \alpha$ for all $a \in \text{FOLLOW}(A)$.
- If $[S' \to S \bullet] \in I_i$: $\text{ACTION}[i, \$] = \text{accept}$.

### 3.2 SLR(1) Limitations

SLR(1) uses $\text{FOLLOW}(A)$ globally -- it does not consider the specific context in which the reduction occurs. This is too imprecise for some grammars.

**Example.** Consider:

$$S \to L = R \mid R$$
$$L \to * R \mid \mathbf{id}$$
$$R \to L$$

The item set containing $[R \to L \bullet]$ and $[S \to L \bullet = R]$ has a shift-reduce conflict on $=$: SLR(1) would reduce $R \to L$ on $=$ because $= \in \text{FOLLOW}(R)$ (since $S \to L = R$ and $L$ appears before $=$), but in this context, reducing is wrong -- we should shift. This grammar is LR(1) but not SLR(1).

---

## 4. Canonical LR(1) Parsing

### 4.1 LR(1) Items

**Definition 4.1.** An *LR(1) item* is a pair $[A \to \alpha \bullet \beta, a]$ where $A \to \alpha \beta$ is a production and $a \in T \cup \{\$\}$ is a *lookahead symbol*. The item means: "$\alpha$ is on the stack, $\beta$ is expected, and upon completing $A \to \alpha \beta$, the next input should be $a$."

### 4.2 LR(1) Closure and Goto

```
function CLOSURE_LR1(I):
    J = I
    repeat until no changes:
        for each item [A -> alpha . B beta, a] in J:
            for each production B -> gamma:
                for each b in FIRST(beta a):
                    add [B -> . gamma, b] to J
    return J
```

The GOTO function is analogous: $\text{GOTO}(I, X) = \text{CLOSURE}(\{[A \to \alpha X \bullet \beta, a] \mid [A \to \alpha \bullet X \beta, a] \in I\})$.

### 4.3 LR(1) Parse Table

- If $[A \to \alpha \bullet a \beta, b] \in I_i$: $\text{ACTION}[i, a] = \text{shift } j$ where $I_j = \text{GOTO}(I_i, a)$.
- If $[A \to \alpha \bullet, a] \in I_i$ and $A \neq S'$: $\text{ACTION}[i, a] = \text{reduce } A \to \alpha$.
- If $[S' \to S \bullet, \$] \in I_i$: $\text{ACTION}[i, \$] = \text{accept}$.

**Key difference from SLR(1):** Reductions are guided by the specific lookahead $a$ in the LR(1) item, not the global $\text{FOLLOW}(A)$.

### 4.4 Power and Cost

**Theorem 4.2 (Knuth, 1965).** A grammar is LR(1) iff $L(G)$ is a deterministic context-free language (DCFL). Furthermore, for every $k \geq 1$, the class of LR(k) languages equals the class of DCFLs.

**Cost:** The LR(1) automaton can have many more states than the LR(0) automaton -- potentially $O(|P| \cdot |T|)$ factor more, though in practice the increase is more moderate.

---

## 5. LALR(1) Parsing

### 5.1 Motivation

LR(1) tables are large. LALR(1) ("Look-Ahead LR") achieves nearly the same power as LR(1) with the same number of states as LR(0)/SLR(1).

### 5.2 Construction

**Definition 5.1.** Two LR(1) item sets are *compatible* if they have the same *core* -- the same set of LR(0) items (ignoring lookaheads).

**Construction:** Merge compatible LR(1) states by taking the union of their lookahead sets:

$$\{[A \to \alpha \bullet \beta, a_1], \ldots, [A \to \alpha \bullet \beta, a_k]\} \longrightarrow [A \to \alpha \bullet \beta, \{a_1, \ldots, a_k\}]$$

### 5.3 LALR(1) vs LR(1)

**Theorem 5.3.** Merging compatible LR(1) states never introduces *shift-reduce* conflicts (since the core determines shift actions). However, it may introduce *reduce-reduce* conflicts.

*Proof.* Shift actions depend only on the core: $[A \to \alpha \bullet a \beta, b]$ produces a shift on $a$ regardless of $b$. After merging, the same shifts are present. For reduces, merging combines lookahead sets: if states $I$ and $J$ have cores producing reductions by $A \to \alpha$ and $B \to \beta$ respectively, and their lookaheads are disjoint in both $I$ and $J$, the merged state might have overlapping lookaheads for the two reductions. $\blacksquare$

**Corollary 5.4.** $\text{SLR}(1) \subseteq \text{LALR}(1) \subseteq \text{LR}(1)$, and both containments are strict.

### 5.4 Proof: LALR(1) $\subsetneq$ LR(1)

**Theorem 5.5.** There exist grammars that are LR(1) but not LALR(1).

*Proof.* Consider the grammar:

$$S' \to S$$
$$S \to aAd \mid bBd \mid aBe \mid bAe$$
$$A \to c$$
$$B \to c$$

This grammar is LR(1): when the parser has seen $ac$ or $bc$ on the stack, the LR(1) items carry different lookaheads ($d$ vs $e$) depending on whether $a$ or $b$ was seen first, allowing the parser to choose between reducing $c$ to $A$ or $B$.

After LALR(1) merging, the states containing $[A \to c \bullet, d]$ and $[B \to c \bullet, e]$ (from $a$ context) are merged with states containing $[A \to c \bullet, e]$ and $[B \to c \bullet, d]$ (from $b$ context). The merged state has $[A \to c \bullet, \{d, e\}]$ and $[B \to c \bullet, \{d, e\}]$ -- a reduce-reduce conflict on both $d$ and $e$. $\blacksquare$

### 5.5 Efficient LALR(1) Construction

Rather than building the full LR(1) automaton and merging, LALR(1) states can be computed directly from the LR(0) automaton by propagating lookaheads:

**Algorithm (DeRemer and Pennello, 1982):**

1. Build the LR(0) automaton (canonical collection of LR(0) item sets).
2. Determine which lookaheads are *spontaneously generated* and which are *propagated* between item sets.
3. Propagate lookaheads iteratively to a fixed point.

This avoids constructing the potentially much larger LR(1) automaton.

---

## 6. Operator Precedence Parsing

### 6.1 Precedence Relations

For expression grammars, *operator precedence parsing* uses relations $\lessdot$, $\doteq$, $\gtrdot$ between terminals:

- $a \lessdot b$: $a$ yields precedence to $b$ (shift $b$).
- $a \doteq b$: $a$ has equal precedence to $b$ (part of same handle).
- $a \gtrdot b$: $a$ takes precedence over $b$ (reduce before shifting $b$).

### 6.2 Algorithm

```
function OperatorPrecedenceParse(input):
    stack = [$]
    input = input + $

    while not (stack == [$ S] and input == $):
        a = topmost terminal on stack
        b = current input terminal

        if a <. b or a =. b:
            shift b onto stack
        elif a >. b:
            // Find handle: pop until we find <. relation
            reduce the handle
        else:
            error
```

### 6.3 Pratt Parsing

*Pratt parsing* (1973), also called *top-down operator precedence parsing*, is a hybrid approach widely used in hand-written parsers for expressions:

```
function parse_expression(min_precedence):
    left = parse_prefix()    // literal, unary op, parenthesized expr

    while precedence(lookahead) >= min_precedence:
        op = lookahead
        advance()
        if op is right-associative:
            right = parse_expression(precedence(op))
        else:
            right = parse_expression(precedence(op) + 1)
        left = BinaryExpr(op, left, right)

    return left
```

**Advantages:** Simple, efficient, handles precedence and associativity naturally, easy to extend with new operators.

---

## 7. GLR Parsing

### 7.1 Motivation

LR(1) parsing requires an unambiguous, LR(1) grammar. *Generalized LR* (GLR) parsing (Tomita, 1985) handles arbitrary CFGs, including ambiguous ones.

### 7.2 Key Idea

When the parse table has conflicts, instead of reporting an error, the GLR parser *splits* the parse into multiple parallel paths (using a graph-structured stack, or GSS):

- **Shift-reduce conflict:** Both shift and reduce, maintaining two (or more) parse stacks.
- **Reduce-reduce conflict:** Reduce by all applicable productions, maintaining parallel stacks.

Paths that lead to errors are eventually abandoned. If the grammar is ambiguous, multiple parse trees survive and can be represented as a *shared packed parse forest* (SPPF).

### 7.3 Graph-Structured Stack (GSS)

Rather than maintaining independent copies of the stack, the GSS shares common prefixes:

```
     [4]        [4]
      |           |
     [3]        [5]
      \         /
       \       /
        [2]
         |
        [1]
         |
        [0]
```

The GSS is a DAG where:
- Each node is an LR state.
- Edges represent stack links (with associated parse tree fragments).
- Splitting creates new nodes; merging occurs when two paths reach the same state.

### 7.4 Complexity

**Theorem 7.1 (Tomita, 1985).** GLR parsing runs in $O(n^3)$ time for arbitrary CFGs and $O(n)$ for unambiguous LR(k) grammars (where it degenerates to standard LR parsing).

### 7.5 Applications

- **Natural language processing:** Ambiguous grammars are the norm.
- **Language prototyping:** Allows parsing ambiguous grammars during development.
- **Tree-sitter:** Uses GLR with error recovery for IDE parsing.
- **Elkhound / Menhir / bison's %glr-parser:** GLR-capable parser generators.

---

## 8. Parser Generator Internals (yacc/bison)

### 8.1 Architecture

```
Grammar specification (.y file)
        |
        v
  [Parser Generator]
   |  - Build augmented grammar
   |  - Construct LR(0) items and automaton
   |  - Compute LALR(1) lookaheads
   |  - Build ACTION/GOTO tables
   |  - Detect and report conflicts
   |  - Emit parser code + tables
        |
        v
  Generated parser (C source)
        |
        v
  [C Compiler]
        |
        v
  Executable parser
```

### 8.2 Conflict Resolution in yacc/bison

When LALR(1) conflicts arise:

- **Shift-reduce:** Default resolution is to **shift** (which gives the "dangling else" its standard interpretation).
- **Reduce-reduce:** Default is to reduce by the **first production** in the grammar file.
- **Explicit directives:** `%left`, `%right`, `%nonassoc`, `%precedence` specify operator precedence and associativity.

### 8.3 Precedence and Associativity

```yacc
%left '+' '-'
%left '*' '/'
%right '^'
%nonassoc UMINUS

%%

expr : expr '+' expr
     | expr '-' expr
     | expr '*' expr
     | expr '/' expr
     | expr '^' expr
     | '-' expr %prec UMINUS
     | '(' expr ')'
     | NUMBER
     ;
```

The `%left`, `%right` directives resolve shift-reduce conflicts:
- If the operator on the stack has higher precedence, reduce.
- If equal precedence and left-associative, reduce; if right-associative, shift.

---

## 9. Parsing Algorithm Comparison

| Algorithm | Grammar Class | Table States | Parse Time | Handles Ambiguity |
|-----------|--------------|-------------|-----------|------------------|
| LR(0) | LR(0) | Small | $O(n)$ | No |
| SLR(1) | SLR(1) | Same as LR(0) | $O(n)$ | No |
| LALR(1) | LALR(1) | Same as LR(0) | $O(n)$ | No |
| Canonical LR(1) | LR(1) = DCFL | Large | $O(n)$ | No |
| GLR | Any CFG | LALR(1) base | $O(n^3)$ worst, $O(n)$ typical | Yes |
| Earley | Any CFG | N/A (chart) | $O(n^3)$ worst | Yes |
| CYK | Any CFG (CNF) | N/A (table) | $O(n^3)$ | Yes |

---

## References

1. Knuth, D. E. "On the translation of languages from left to right." *Information and Control*, 8(6):607--639, 1965.
2. DeRemer, F. L. "Practical translators for LR(k) languages." *PhD thesis, MIT*, 1969.
3. DeRemer, F. L. and Pennello, T. J. "Efficient computation of LALR(1) look-ahead sets." *ACM TOPLAS*, 4(4):615--649, 1982.
4. Tomita, M. "Efficient parsing for natural language." *Kluwer*, 1986.
5. Pratt, V. "Top down operator precedence." *POPL*, pp. 41--51, 1973.
6. Aho, A. V., Lam, M. S., Sethi, R., and Ullman, J. D. *Compilers: Principles, Techniques, and Tools*, 2nd ed. Pearson, 2006. Chapter 4.
7. Grune, D. and Jacobs, C. J. H. *Parsing Techniques: A Practical Guide*, 2nd ed. Springer, 2008.
8. Scott, E. and Johnstone, A. "GLL parsing." *Electronic Notes in Theoretical Computer Science*, 253(7):177--189, 2010.
