# Recitation 02: Building Parsers

**Module 02 -- Parsing**
**Weeks 3--4**

---

## Overview

In this recitation, we work through four hands-on activities:

1. Implementing a recursive descent parser
2. Computing FIRST and FOLLOW sets by hand
3. Building LR parse tables step by step
4. Parser debugging techniques

---

## Part 1: Implementing a Recursive Descent Parser

### 1.1 The Language: MiniExpr

We parse a simple expression language with the following grammar (already LL(1)):

$$E \to T\, E'$$
$$E' \to +\, T\, E' \mid -\, T\, E' \mid \varepsilon$$
$$T \to F\, T'$$
$$T' \to *\, F\, T' \mid /\, F\, T' \mid \varepsilon$$
$$F \to (\, E\, ) \mid \text{NUMBER} \mid \text{IDENT}$$

### 1.2 AST Node Definitions

```python
class Expr:
    pass

class BinaryExpr(Expr):
    def __init__(self, op, left, right):
        self.op = op
        self.left = left
        self.right = right

    def __repr__(self):
        return f"({self.left} {self.op} {self.right})"

class NumberExpr(Expr):
    def __init__(self, value):
        self.value = value

    def __repr__(self):
        return str(self.value)

class IdentExpr(Expr):
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return self.name
```

### 1.3 The Parser

```python
class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self):
        if self.pos >= len(self.tokens):
            return Token('EOF', '', 0, 0)
        return self.tokens[self.pos]

    def advance(self):
        token = self.tokens[self.pos]
        self.pos += 1
        return token

    def expect(self, token_type):
        tok = self.peek()
        if tok.type != token_type:
            raise SyntaxError(
                f"Expected {token_type}, got {tok.type} "
                f"('{tok.lexeme}') at line {tok.line}:{tok.col}")
        return self.advance()

    # E -> T E'
    def parse_expr(self):
        left = self.parse_term()
        return self.parse_expr_prime(left)

    # E' -> + T E' | - T E' | epsilon
    def parse_expr_prime(self, left):
        if self.peek().type in ('PLUS', 'MINUS'):
            op = self.advance().lexeme
            right = self.parse_term()
            node = BinaryExpr(op, left, right)
            return self.parse_expr_prime(node)
        else:
            return left  # epsilon production

    # T -> F T'
    def parse_term(self):
        left = self.parse_factor()
        return self.parse_term_prime(left)

    # T' -> * F T' | / F T' | epsilon
    def parse_term_prime(self, left):
        if self.peek().type in ('STAR', 'SLASH'):
            op = self.advance().lexeme
            right = self.parse_factor()
            node = BinaryExpr(op, left, right)
            return self.parse_term_prime(node)
        else:
            return left

    # F -> ( E ) | NUMBER | IDENT
    def parse_factor(self):
        tok = self.peek()
        if tok.type == 'LPAREN':
            self.advance()
            expr = self.parse_expr()
            self.expect('RPAREN')
            return expr
        elif tok.type == 'NUMBER':
            self.advance()
            return NumberExpr(float(tok.lexeme))
        elif tok.type == 'IDENT':
            self.advance()
            return IdentExpr(tok.lexeme)
        else:
            raise SyntaxError(
                f"Unexpected token '{tok.lexeme}' at line {tok.line}:{tok.col}")
```

### 1.4 Testing the Parser

```python
def test_parser():
    # Helper: tokenize and parse
    def parse(source):
        scanner = Scanner(source)  # from Recitation 01
        tokens = scanner.tokenize()
        tokens = [t for t in tokens if t.type != 'EOF']
        parser = Parser(tokens + [Token('EOF', '', 0, 0)])
        return parser.parse_expr()

    # Test cases
    assert str(parse("1 + 2")) == "(1.0 + 2.0)"
    assert str(parse("1 + 2 * 3")) == "(1.0 + (2.0 * 3.0))"
    assert str(parse("(1 + 2) * 3")) == "((1.0 + 2.0) * 3.0)"
    assert str(parse("a + b * c - d")) == "((a + (b * c)) - d)"
    assert str(parse("1")) == "1.0"

    print("All parser tests passed.")

test_parser()
```

### 1.5 Key Design Decisions

**Left-associativity via tail calls.** The `parse_expr_prime` function builds a left-leaning tree by passing the accumulated left operand as an argument. This converts left recursion (in the original grammar $E \to E + T$) into iteration.

**Precedence via nesting.** Multiplication/division are handled in `parse_term` / `parse_term_prime`, which is called from within `parse_expr`. This ensures `*` and `/` bind tighter than `+` and `-`.

---

## Part 2: Computing FIRST and FOLLOW by Hand

### 2.1 Example Grammar

Consider the grammar:

$$S \to A\, B\, e$$
$$A \to d\, B \mid a\, S \mid c$$
$$B \to A\, S \mid b$$

### 2.2 Computing FIRST Sets

**Step 1: Terminals.** $\text{FIRST}(a) = \{a\}$, $\text{FIRST}(b) = \{b\}$, $\text{FIRST}(c) = \{c\}$, $\text{FIRST}(d) = \{d\}$, $\text{FIRST}(e) = \{e\}$.

**Step 2: Initialize nonterminals.** $\text{FIRST}(S) = \text{FIRST}(A) = \text{FIRST}(B) = \emptyset$.

**Step 3: Iterate.**

*Iteration 1:*
- $S \to ABe$: $\text{FIRST}(S) \cup= \text{FIRST}(A)$ (but $\text{FIRST}(A)$ is still empty).
- $A \to dB$: $\text{FIRST}(A) \cup= \{d\}$.
- $A \to aS$: $\text{FIRST}(A) \cup= \{a\}$.
- $A \to c$: $\text{FIRST}(A) \cup= \{c\}$.
- So $\text{FIRST}(A) = \{a, c, d\}$.
- $B \to AS$: $\text{FIRST}(B) \cup= \text{FIRST}(A) = \{a, c, d\}$.
- $B \to b$: $\text{FIRST}(B) \cup= \{b\}$.
- So $\text{FIRST}(B) = \{a, b, c, d\}$.

*Iteration 2:*
- $S \to ABe$: $\text{FIRST}(S) \cup= \text{FIRST}(A) = \{a, c, d\}$.
- No new changes to $A$ or $B$.

*Iteration 3:* No changes. Fixed point reached.

**Result:**

| Nonterminal | FIRST |
|-------------|-------|
| $S$ | $\{a, c, d\}$ |
| $A$ | $\{a, c, d\}$ |
| $B$ | $\{a, b, c, d\}$ |

### 2.3 Computing FOLLOW Sets

**Initialize:** $\text{FOLLOW}(S) = \{\$\}$, $\text{FOLLOW}(A) = \text{FOLLOW}(B) = \emptyset$.

**Apply rules from each production:**

$S \to ABe$:
- $A$ is followed by $B$: $\text{FOLLOW}(A) \cup= \text{FIRST}(B) = \{a, b, c, d\}$.
- $B$ is followed by $e$: $\text{FOLLOW}(B) \cup= \{e\}$.

$A \to dB$:
- $B$ is at the end: $\text{FOLLOW}(B) \cup= \text{FOLLOW}(A)$.

$A \to aS$:
- $S$ is at the end: $\text{FOLLOW}(S) \cup= \text{FOLLOW}(A)$.

$B \to AS$:
- $A$ is followed by $S$: $\text{FOLLOW}(A) \cup= \text{FIRST}(S) = \{a, c, d\}$. (Already there.)
- $S$ is at the end: $\text{FOLLOW}(S) \cup= \text{FOLLOW}(B)$.

**Iterate until fixed point:**

*Iteration 1:*
- $\text{FOLLOW}(A) = \{a, b, c, d\}$
- $\text{FOLLOW}(B) = \{e\} \cup \text{FOLLOW}(A) = \{a, b, c, d, e\}$
- $\text{FOLLOW}(S) = \{\$\} \cup \text{FOLLOW}(A) \cup \text{FOLLOW}(B) = \{a, b, c, d, e, \$\}$

*Iteration 2:*
- $\text{FOLLOW}(A) \cup= \text{FIRST}(S) = \{a, c, d\}$ -- no change.
- $\text{FOLLOW}(B) \cup= \text{FOLLOW}(A) = \{a, b, c, d\}$ -- add gives $\{a, b, c, d, e\}$, no change.
- $\text{FOLLOW}(S) \cup= \text{FOLLOW}(A) \cup \text{FOLLOW}(B)$. Already have $\{a, b, c, d, e, \$\}$.

Fixed point.

**Result:**

| Nonterminal | FOLLOW |
|-------------|--------|
| $S$ | $\{a, b, c, d, e, \$\}$ |
| $A$ | $\{a, b, c, d\}$ |
| $B$ | $\{a, b, c, d, e\}$ |

### 2.4 LL(1) Check

For $A$: productions are $A \to dB \mid aS \mid c$.
- $\text{FIRST}(dB) = \{d\}$
- $\text{FIRST}(aS) = \{a\}$
- $\text{FIRST}(c) = \{c\}$

All disjoint. No $\varepsilon$-productions for $A$. Good.

For $B$: productions are $B \to AS \mid b$.
- $\text{FIRST}(AS) = \text{FIRST}(A) = \{a, c, d\}$
- $\text{FIRST}(b) = \{b\}$

Disjoint. Good. This grammar is LL(1).

---

## Part 3: Building LR Parse Tables Step by Step

### 3.1 Example Grammar

Augmented grammar:

$$S' \to E$$
$$E \to E + T \mid T$$
$$T \to T * F \mid F$$
$$F \to (\, E\, ) \mid \mathbf{id}$$

### 3.2 LR(0) Item Sets (Canonical Collection)

**$I_0$ = CLOSURE($\{[S' \to \bullet E]\}$):**

$$[S' \to \bullet E]$$
$$[E \to \bullet E + T]$$
$$[E \to \bullet T]$$
$$[T \to \bullet T * F]$$
$$[T \to \bullet F]$$
$$[F \to \bullet ( E )]$$
$$[F \to \bullet \mathbf{id}]$$

**GOTO($I_0$, $E$) = $I_1$:**

$$[S' \to E \bullet]$$
$$[E \to E \bullet + T]$$

**GOTO($I_0$, $T$) = $I_2$:**

$$[E \to T \bullet]$$
$$[T \to T \bullet * F]$$

**GOTO($I_0$, $F$) = $I_3$:**

$$[T \to F \bullet]$$

**GOTO($I_0$, $($) = $I_4$:**

$$[F \to ( \bullet E )]$$
$$[E \to \bullet E + T]$$
$$[E \to \bullet T]$$
$$[T \to \bullet T * F]$$
$$[T \to \bullet F]$$
$$[F \to \bullet ( E )]$$
$$[F \to \bullet \mathbf{id}]$$

**GOTO($I_0$, $\mathbf{id}$) = $I_5$:**

$$[F \to \mathbf{id} \bullet]$$

**GOTO($I_1$, $+$) = $I_6$:**

$$[E \to E + \bullet T]$$
$$[T \to \bullet T * F]$$
$$[T \to \bullet F]$$
$$[F \to \bullet ( E )]$$
$$[F \to \bullet \mathbf{id}]$$

**GOTO($I_2$, $*$) = $I_7$:**

$$[T \to T * \bullet F]$$
$$[F \to \bullet ( E )]$$
$$[F \to \bullet \mathbf{id}]$$

**GOTO($I_4$, $E$) = $I_8$:**

$$[F \to ( E \bullet )]$$
$$[E \to E \bullet + T]$$

**GOTO($I_6$, $T$) = $I_9$:**

$$[E \to E + T \bullet]$$
$$[T \to T \bullet * F]$$

**GOTO($I_7$, $F$) = $I_{10}$:**

$$[T \to T * F \bullet]$$

**GOTO($I_8$, $)$) = $I_{11}$:**

$$[F \to ( E ) \bullet]$$

**Note:** GOTO($I_4$, $T$) = $I_2$, GOTO($I_4$, $F$) = $I_3$, GOTO($I_4$, $($) = $I_4$, GOTO($I_4$, $\mathbf{id}$) = $I_5$, GOTO($I_6$, $F$) = $I_3$, GOTO($I_6$, $($) = $I_4$, GOTO($I_6$, $\mathbf{id}$) = $I_5$, GOTO($I_7$, $($) = $I_4$, GOTO($I_7$, $\mathbf{id}$) = $I_5$, GOTO($I_8$, $+$) = $I_6$, GOTO($I_9$, $*$) = $I_7$.

### 3.3 SLR(1) Parse Table

FOLLOW sets:
- $\text{FOLLOW}(E) = \{+, ), \$\}$
- $\text{FOLLOW}(T) = \{+, *, ), \$\}$
- $\text{FOLLOW}(F) = \{+, *, ), \$\}$

Number the productions: (1) $E \to E + T$, (2) $E \to T$, (3) $T \to T * F$, (4) $T \to F$, (5) $F \to (E)$, (6) $F \to \mathbf{id}$.

| State | $\mathbf{id}$ | $+$ | $*$ | $($ | $)$ | $\$$ | $E$ | $T$ | $F$ |
|-------|---|---|---|---|---|---|---|---|---|
| 0 | s5 | | | s4 | | | 1 | 2 | 3 |
| 1 | | s6 | | | | acc | | | |
| 2 | | r2 | s7 | | r2 | r2 | | | |
| 3 | | r4 | r4 | | r4 | r4 | | | |
| 4 | s5 | | | s4 | | | 8 | 2 | 3 |
| 5 | | r6 | r6 | | r6 | r6 | | | |
| 6 | s5 | | | s4 | | | | 9 | 3 |
| 7 | s5 | | | s4 | | | | | 10 |
| 8 | | s6 | | | s11 | | | | |
| 9 | | r1 | s7 | | r1 | r1 | | | |
| 10 | | r3 | r3 | | r3 | r3 | | | |
| 11 | | r5 | r5 | | r5 | r5 | | | |

**Notation:** s$n$ = shift to state $n$; r$n$ = reduce by production $n$; acc = accept; blank = error.

### 3.4 Tracing a Parse

Input: $\mathbf{id} + \mathbf{id} * \mathbf{id}\, \$$

| Stack | Input | Action |
|-------|-------|--------|
| 0 | $\mathbf{id} + \mathbf{id} * \mathbf{id}\, \$$ | s5 |
| 0 5 | $+ \mathbf{id} * \mathbf{id}\, \$$ | r6: $F \to \mathbf{id}$ |
| 0 3 | $+ \mathbf{id} * \mathbf{id}\, \$$ | r4: $T \to F$ |
| 0 2 | $+ \mathbf{id} * \mathbf{id}\, \$$ | r2: $E \to T$ |
| 0 1 | $+ \mathbf{id} * \mathbf{id}\, \$$ | s6 |
| 0 1 6 | $\mathbf{id} * \mathbf{id}\, \$$ | s5 |
| 0 1 6 5 | $* \mathbf{id}\, \$$ | r6: $F \to \mathbf{id}$ |
| 0 1 6 3 | $* \mathbf{id}\, \$$ | r4: $T \to F$ |
| 0 1 6 9 | $* \mathbf{id}\, \$$ | s7 |
| 0 1 6 9 7 | $\mathbf{id}\, \$$ | s5 |
| 0 1 6 9 7 5 | $\$$ | r6: $F \to \mathbf{id}$ |
| 0 1 6 9 7 10 | $\$$ | r3: $T \to T * F$ |
| 0 1 6 9 | $\$$ | r1: $E \to E + T$ |
| 0 1 | $\$$ | accept |

---

## Part 4: Parser Debugging Techniques

### 4.1 Common Parser Bugs

| Symptom | Likely Cause |
|---------|-------------|
| Infinite loop | Left recursion in recursive descent; incorrect epsilon handling |
| Wrong precedence | Grammar nesting is incorrect; wrong associativity |
| Unexpected token error | Missing production; incorrect FIRST set logic |
| Shift-reduce conflict | Ambiguous grammar; missing precedence directives |
| Reduce-reduce conflict | Overlapping grammar rules; grammar too ambiguous for LALR(1) |

### 4.2 Debugging Strategies

**Strategy 1: Trace the derivation.** For recursive descent, add print statements to each `parse_*` function:

```python
def parse_expr(self, depth=0):
    print("  " * depth + f"parse_expr, lookahead={self.peek()}")
    left = self.parse_term(depth + 1)
    return self.parse_expr_prime(left, depth + 1)
```

**Strategy 2: Validate FIRST/FOLLOW by hand.** Before implementing, compute FIRST and FOLLOW on paper and verify against the code. Common mistakes:
- Forgetting to propagate $\varepsilon$ through FIRST.
- Missing FOLLOW propagation from parent nonterminal.

**Strategy 3: Minimal failing input.** When a test fails, reduce the input to the smallest string that triggers the bug. This is analogous to delta debugging.

**Strategy 4: Grammar visualization.** Draw the grammar's NFA/DFA (for LR) or the call graph (for recursive descent) to identify structural issues.

### 4.3 yacc/bison Debugging

bison provides several debugging aids:

```bash
# Generate verbose output with state descriptions
bison -v grammar.y
# Produces grammar.output with all states and conflicts

# Enable runtime trace
# In the .y file:
%debug
# Then set yydebug = 1; before calling yyparse()
```

The trace output shows every shift, reduce, and state transition:

```
Starting parse
Entering state 0
Reading a token: identifier
Shifting token identifier (1.1: )
Entering state 5
Reducing stack by rule 6 (line 42):
   $1 = token identifier (1.1: )
-> $$ = nterm F (1.1: )
...
```

### 4.4 Exercise: Debug This Parser

The following recursive descent parser has a bug. Find and fix it.

```python
# Grammar: S -> a S b | epsilon
def parse_S(self):
    if self.peek().type == 'A':
        self.expect('A')
        self.parse_S()
        self.expect('B')
    # else: epsilon production -- do nothing
    # BUG: What happens with input "aab"?
```

**Answer:** The parser succeeds on `aab` but it should fail (it needs `aabb`). The issue is that the epsilon production triggers when the lookahead is `B`, which is correct -- but after parsing the inner `S` (which takes $\varepsilon$), the parser expects `B`, consuming the single `b`. Then the outer call also expects `B`, but the input is empty. This correctly produces an error. So actually, this parser is correct. A real bug would be if we forgot the `else` branch -- then the parser would always try the `A` branch and crash on non-`A` inputs.

---

## Exercises

1. **Extend the recursive descent parser** to support:
   - Unary minus: `-expr`
   - Comparison operators: `<`, `>`, `==`, `!=`
   - Function calls: `f(x, y)`

   For each extension, first write the grammar rules, then implement the parsing functions.

2. **Build SLR(1) tables** for the grammar:

$$S \to S S + \mid S S * \mid a$$

   (Postfix expressions.) Show all item sets and the complete parse table.

3. **Prove or disprove:** The grammar $S \to a S a \mid b S b \mid c$ is LL(1).

4. **Implement a shift-reduce parser** using the SLR(1) table from Exercise 3.2 of Part 3. Parse the input `a a + a *` and show the stack trace.
