# HW1: Lexical Analysis

**Module 01 -- Lexical Analysis**
**Due:** End of Week 2
**Format:** Part A: written solutions. Part B: code submission with test suite and writeup.

---

## Part A: Theory (50 points)

### Problem 1: Regular Expression to NFA (10 points)

Apply Thompson's construction to the regular expression $(a|b)^* a (a|b)$ step by step. Draw the resulting NFA. Clearly label all states and transitions, including $\varepsilon$-transitions.

Then apply the subset construction to produce a DFA. Show the subset construction table (reachable states only). How many DFA states result? Is this DFA minimal? If not, minimize it.

### Problem 2: DFA Minimization (10 points)

Consider the DFA $D = (Q, \{0, 1\}, \delta, A, \{D, E\})$ with states $Q = \{A, B, C, D, E, F\}$ and transitions:

| State | 0 | 1 |
|-------|---|---|
| A | B | C |
| B | A | D |
| C | E | F |
| D | E | F |
| E | E | F |
| F | F | F |

**(a)** Apply the table-filling algorithm to identify all pairs of distinguishable states. Show your work.

**(b)** Apply Hopcroft's algorithm to compute the minimum DFA. Trace the partition refinement steps.

**(c)** Verify that both methods produce the same result.

### Problem 3: Closure Properties (10 points)

**(a)** Let $L_1 = \{w \in \{a, b\}^* \mid |w| \text{ is even}\}$ and $L_2 = \{w \in \{a, b\}^* \mid w \text{ contains } aa\}$. Construct a DFA for $L_1 \cap L_2$ using the product construction. Is the product DFA minimal?

**(b)** Prove that the class of regular languages is closed under the *shuffle* operation: $L_1 \shuffle L_2 = \{w \mid w \text{ is an interleaving of some } u \in L_1, v \in L_2\}$. (Hint: use a product construction on NFAs.)

### Problem 4: Brzozowski Derivatives (10 points)

Compute the Brzozowski derivatives of the regular expression $r = (ab|b)^* a$ with respect to each symbol in $\{a, b\}$. Continue computing derivatives until no new (up to ACI equivalence) expressions are generated. Use the resulting set of derivatives to construct a DFA directly.

Verify that the DFA you obtain is minimal by comparing its state count with the Myhill-Nerode index of $L(r)$.

### Problem 5: Pumping and Myhill-Nerode (10 points)

**(a)** Prove that $L = \{a^{n^2} \mid n \geq 0\}$ (strings of $a$'s whose length is a perfect square) is not regular. Use the pumping lemma.

**(b)** Give an alternative proof using the Myhill-Nerode theorem by exhibiting infinitely many pairwise distinguishable strings.

**(c)** Compare the two proof techniques. Which one generalizes more easily? Which one provides more information about the language?

---

## Part B: Implementation (50 points)

### Overview

Implement a complete scanner for the language **MiniLang** defined below. You must implement the scanner **from scratch** -- no scanner generator tools (lex, flex, ANTLR, etc.) are permitted. You may use any programming language.

### The MiniLang Token Specification

| Token Type | Pattern | Notes |
|-----------|---------|-------|
| `INT_LIT` | `[0-9]+` | Decimal integers |
| `FLOAT_LIT` | `[0-9]+\.[0-9]+` | Floating point (must have digits on both sides of `.`) |
| `HEX_LIT` | `0x[0-9a-fA-F]+` | Hexadecimal integers |
| `STRING_LIT` | `"([^"\\]|\\.)*"` | Double-quoted strings with escape sequences |
| `IDENT` | `[a-zA-Z_][a-zA-Z0-9_]*` | Identifiers |
| `PLUS` | `+` | |
| `MINUS` | `-` | |
| `STAR` | `*` | |
| `SLASH` | `/` | |
| `PERCENT` | `%` | |
| `EQ` | `==` | |
| `NEQ` | `!=` | |
| `LT` | `<` | |
| `GT` | `>` | |
| `LEQ` | `<=` | |
| `GEQ` | `>=` | |
| `ASSIGN` | `=` | |
| `LPAREN` | `(` | |
| `RPAREN` | `)` | |
| `LBRACE` | `{` | |
| `RBRACE` | `}` | |
| `LBRACKET` | `[` | |
| `RBRACKET` | `]` | |
| `SEMICOLON` | `;` | |
| `COMMA` | `,` | |
| `DOT` | `.` | |
| `ARROW` | `->` | |
| Keywords | `if`, `else`, `while`, `for`, `return`, `let`, `fn`, `true`, `false`, `nil` | |

**Whitespace:** spaces, tabs, newlines (skip).

**Line comments:** `//` to end of line (skip).

**Block comments:** `/* ... */` (skip, need not handle nesting).

### Requirements

1. **Correctness:** Your scanner must correctly tokenize all valid MiniLang programs and report errors for invalid tokens (with line and column numbers).

2. **Maximal munch:** Always match the longest possible token. For example, `>=` is `GEQ`, not `GT` followed by `ASSIGN`.

3. **Error recovery:** On encountering an illegal character, emit an `ERROR` token and continue scanning.

4. **Position tracking:** Each token must include line number and column number.

5. **Test suite:** Provide at least 20 test cases covering:
   - All token types
   - Multi-character operators (`==`, `!=`, `<=`, `>=`, `->`)
   - Keywords vs. identifiers (`if` vs. `iffy`)
   - String literals with escape sequences
   - Hex literals
   - Comments (line and block)
   - Error cases (unterminated strings, illegal characters)
   - Edge cases (empty input, adjacent operators, numbers followed by dots)

### Deliverables

1. **Source code** for the scanner.
2. **Test suite** with expected outputs.
3. **Writeup** (1--2 pages) discussing:
   - Your design choices (table-driven vs. direct-coded).
   - How you handle multi-character tokens and maximal munch.
   - How you handle string literal escapes.
   - Any interesting edge cases you encountered.
   - Performance measurement: time your scanner on a large input ($\geq$ 100 KB) and report throughput in MB/s.

### Grading Rubric

| Criterion | Points |
|----------|--------|
| Correct tokenization of all token types | 20 |
| Maximal munch and priority handling | 5 |
| Error recovery and reporting | 5 |
| Position tracking (line/column) | 5 |
| Test suite (coverage and quality) | 10 |
| Writeup | 5 |

---

## Submission

Submit via the course submission system by the deadline. Late submissions are penalized 10% per day.
