# Recitation 01: Building a Scanner from Scratch

**Module 01 -- Lexical Analysis**
**Weeks 1--2**

---

## Overview

In this recitation, we implement a complete lexical analysis pipeline from first principles:

1. Thompson's construction (regular expression to NFA)
2. NFA simulation
3. A complete scanner for a toy language

All code is in Python for clarity. Students are encouraged to re-implement in their language of choice.

---

## Part 1: Thompson's Construction Implementation

### 1.1 Data Structures

```python
class NFAState:
    """A state in a Thompson NFA."""
    _id_counter = 0

    def __init__(self):
        self.id = NFAState._id_counter
        NFAState._id_counter += 1
        self.transitions = {}   # symbol -> list of NFAState
        self.epsilon = []       # list of NFAState (epsilon transitions)
        self.is_accept = False
        self.token_type = None  # set for accept states

    def add_transition(self, symbol, target):
        self.transitions.setdefault(symbol, []).append(target)

    def add_epsilon(self, target):
        self.epsilon.append(target)


class NFA:
    """An NFA fragment with a single start and single accept state."""
    def __init__(self, start, accept):
        self.start = start
        self.accept = accept
```

### 1.2 Base Cases

```python
def nfa_epsilon():
    """NFA for the empty string epsilon."""
    start = NFAState()
    accept = NFAState()
    start.add_epsilon(accept)
    return NFA(start, accept)


def nfa_symbol(symbol):
    """NFA for a single symbol."""
    start = NFAState()
    accept = NFAState()
    start.add_transition(symbol, accept)
    return NFA(start, accept)
```

### 1.3 Inductive Cases

```python
def nfa_union(nfa1, nfa2):
    """NFA for nfa1 | nfa2 (alternation)."""
    start = NFAState()
    accept = NFAState()
    start.add_epsilon(nfa1.start)
    start.add_epsilon(nfa2.start)
    nfa1.accept.add_epsilon(accept)
    nfa2.accept.add_epsilon(accept)
    return NFA(start, accept)


def nfa_concat(nfa1, nfa2):
    """NFA for nfa1 followed by nfa2 (concatenation)."""
    nfa1.accept.add_epsilon(nfa2.start)
    return NFA(nfa1.start, nfa2.accept)


def nfa_star(nfa1):
    """NFA for nfa1* (Kleene star)."""
    start = NFAState()
    accept = NFAState()
    start.add_epsilon(nfa1.start)
    start.add_epsilon(accept)          # zero repetitions
    nfa1.accept.add_epsilon(nfa1.start)  # loop back
    nfa1.accept.add_epsilon(accept)      # exit loop
    return NFA(start, accept)


def nfa_plus(nfa1):
    """NFA for nfa1+ (one or more). Equivalent to nfa1 . nfa1*."""
    # We need a fresh copy of nfa1 for the star part to avoid
    # sharing states. For simplicity, we implement directly:
    start = NFAState()
    accept = NFAState()
    start.add_epsilon(nfa1.start)
    nfa1.accept.add_epsilon(accept)
    nfa1.accept.add_epsilon(nfa1.start)  # loop back (at least one)
    return NFA(start, accept)


def nfa_optional(nfa1):
    """NFA for nfa1? (zero or one)."""
    start = NFAState()
    accept = NFAState()
    start.add_epsilon(nfa1.start)
    start.add_epsilon(accept)  # zero case
    nfa1.accept.add_epsilon(accept)
    return NFA(start, accept)
```

### 1.4 Building NFAs from Simple Patterns

```python
def nfa_string(s):
    """NFA that matches the exact string s."""
    if len(s) == 0:
        return nfa_epsilon()
    result = nfa_symbol(s[0])
    for c in s[1:]:
        result = nfa_concat(result, nfa_symbol(c))
    return result


def nfa_char_class(chars):
    """NFA for a character class [chars], e.g., nfa_char_class('abc')."""
    if len(chars) == 0:
        start = NFAState()
        accept = NFAState()
        return NFA(start, accept)  # matches nothing
    result = nfa_symbol(chars[0])
    for c in chars[1:]:
        result = nfa_union(result, nfa_symbol(c))
    return result


def nfa_char_range(lo, hi):
    """NFA for character range [lo-hi]."""
    chars = [chr(c) for c in range(ord(lo), ord(hi) + 1)]
    return nfa_char_class(chars)
```

---

## Part 2: NFA Simulation

### 2.1 Epsilon Closure

```python
def epsilon_closure(states):
    """Compute the epsilon closure of a set of NFA states.

    Uses BFS to find all states reachable via epsilon transitions.
    """
    closure = set(states)
    worklist = list(states)

    while worklist:
        state = worklist.pop()
        for target in state.epsilon:
            if target not in closure:
                closure.add(target)
                worklist.append(target)

    return frozenset(closure)
```

### 2.2 Move Function

```python
def move(states, symbol):
    """Compute the set of states reachable from `states` on `symbol`."""
    result = set()
    for state in states:
        for target in state.transitions.get(symbol, []):
            result.add(target)
    return result
```

### 2.3 Full NFA Simulation

```python
def nfa_accepts(nfa, input_string):
    """Check if the NFA accepts the given string."""
    current = epsilon_closure({nfa.start})

    for symbol in input_string:
        current = epsilon_closure(move(current, symbol))

    return nfa.accept in current
```

### 2.4 Testing Thompson's Construction

```python
def test_thompson():
    # Test: (a|b)*abb
    a = nfa_symbol('a')
    b = nfa_symbol('b')
    a_or_b = nfa_union(nfa_symbol('a'), nfa_symbol('b'))
    star_ab = nfa_star(a_or_b)
    abb = nfa_concat(nfa_symbol('a'),
              nfa_concat(nfa_symbol('b'), nfa_symbol('b')))
    pattern = nfa_concat(star_ab, abb)

    assert nfa_accepts(pattern, "abb") == True
    assert nfa_accepts(pattern, "aabb") == True
    assert nfa_accepts(pattern, "babb") == True
    assert nfa_accepts(pattern, "ababb") == True
    assert nfa_accepts(pattern, "ab") == False
    assert nfa_accepts(pattern, "") == False
    assert nfa_accepts(pattern, "a") == False
    print("All Thompson construction tests passed.")

test_thompson()
```

---

## Part 3: Building a Complete Scanner

### 3.1 The Toy Language: MiniCalc

We define a simple calculator language with the following tokens:

| Token Type | Pattern | Example |
|-----------|---------|---------|
| NUMBER | `[0-9]+(\.[0-9]+)?` | `42`, `3.14` |
| IDENT | `[a-zA-Z_][a-zA-Z0-9_]*` | `x`, `foo_bar` |
| PLUS | `+` | |
| MINUS | `-` | |
| STAR | `*` | |
| SLASH | `/` | |
| LPAREN | `(` | |
| RPAREN | `)` | |
| ASSIGN | `=` | |
| SEMICOLON | `;` | |
| LET | `let` (keyword) | |
| PRINT | `print` (keyword) | |
| EOF | end of input | |

### 3.2 Token Definition

```python
from enum import Enum, auto

class TokenType(Enum):
    NUMBER = auto()
    IDENT = auto()
    PLUS = auto()
    MINUS = auto()
    STAR = auto()
    SLASH = auto()
    LPAREN = auto()
    RPAREN = auto()
    ASSIGN = auto()
    SEMICOLON = auto()
    LET = auto()
    PRINT = auto()
    EOF = auto()
    ERROR = auto()


class Token:
    def __init__(self, type, lexeme, line, col):
        self.type = type
        self.lexeme = lexeme
        self.line = line
        self.col = col

    def __repr__(self):
        return f"Token({self.type.name}, {self.lexeme!r}, L{self.line}:{self.col})"
```

### 3.3 The Scanner

```python
KEYWORDS = {
    'let': TokenType.LET,
    'print': TokenType.PRINT,
}

SINGLE_CHAR_TOKENS = {
    '+': TokenType.PLUS,
    '-': TokenType.MINUS,
    '*': TokenType.STAR,
    '/': TokenType.SLASH,
    '(': TokenType.LPAREN,
    ')': TokenType.RPAREN,
    '=': TokenType.ASSIGN,
    ';': TokenType.SEMICOLON,
}


class Scanner:
    def __init__(self, source):
        self.source = source
        self.pos = 0
        self.line = 1
        self.col = 1

    def peek(self):
        if self.pos >= len(self.source):
            return '\0'
        return self.source[self.pos]

    def peek_next(self):
        if self.pos + 1 >= len(self.source):
            return '\0'
        return self.source[self.pos + 1]

    def advance(self):
        c = self.source[self.pos]
        self.pos += 1
        if c == '\n':
            self.line += 1
            self.col = 1
        else:
            self.col += 1
        return c

    def skip_whitespace_and_comments(self):
        while self.pos < len(self.source):
            c = self.peek()
            if c in ' \t\r\n':
                self.advance()
            elif c == '/' and self.peek_next() == '/':
                # Line comment: skip to end of line
                while self.pos < len(self.source) and self.peek() != '\n':
                    self.advance()
            else:
                break

    def scan_number(self):
        start_col = self.col
        start = self.pos
        while self.peek().isdigit():
            self.advance()
        # Check for decimal point
        if self.peek() == '.' and self.peek_next().isdigit():
            self.advance()  # consume '.'
            while self.peek().isdigit():
                self.advance()
        lexeme = self.source[start:self.pos]
        return Token(TokenType.NUMBER, lexeme, self.line, start_col)

    def scan_identifier(self):
        start_col = self.col
        start = self.pos
        while self.peek().isalnum() or self.peek() == '_':
            self.advance()
        lexeme = self.source[start:self.pos]
        token_type = KEYWORDS.get(lexeme, TokenType.IDENT)
        return Token(token_type, lexeme, self.line, start_col)

    def next_token(self):
        self.skip_whitespace_and_comments()

        if self.pos >= len(self.source):
            return Token(TokenType.EOF, '', self.line, self.col)

        c = self.peek()
        line, col = self.line, self.col

        # Single-character tokens
        if c in SINGLE_CHAR_TOKENS:
            self.advance()
            return Token(SINGLE_CHAR_TOKENS[c], c, line, col)

        # Numbers
        if c.isdigit():
            return self.scan_number()

        # Identifiers and keywords
        if c.isalpha() or c == '_':
            return self.scan_identifier()

        # Error: unrecognized character
        self.advance()
        return Token(TokenType.ERROR, c, line, col)

    def tokenize(self):
        tokens = []
        while True:
            tok = self.next_token()
            tokens.append(tok)
            if tok.type == TokenType.EOF:
                break
        return tokens
```

### 3.4 Testing the Scanner

```python
def test_scanner():
    source = """
    // This is a comment
    let x = 42;
    let y = 3.14;
    print(x + y * 2);
    """

    scanner = Scanner(source)
    tokens = scanner.tokenize()

    expected_types = [
        TokenType.LET, TokenType.IDENT, TokenType.ASSIGN,
        TokenType.NUMBER, TokenType.SEMICOLON,
        TokenType.LET, TokenType.IDENT, TokenType.ASSIGN,
        TokenType.NUMBER, TokenType.SEMICOLON,
        TokenType.PRINT, TokenType.LPAREN, TokenType.IDENT,
        TokenType.PLUS, TokenType.IDENT, TokenType.STAR,
        TokenType.NUMBER, TokenType.RPAREN, TokenType.SEMICOLON,
        TokenType.EOF,
    ]

    assert len(tokens) == len(expected_types), \
        f"Expected {len(expected_types)} tokens, got {len(tokens)}"

    for tok, expected in zip(tokens, expected_types):
        assert tok.type == expected, \
            f"Expected {expected}, got {tok.type} for lexeme {tok.lexeme!r}"

    print("All scanner tests passed.")
    print("Tokens:")
    for tok in tokens:
        print(f"  {tok}")

test_scanner()
```

---

## Part 4: Testing and Edge Cases

### 4.1 Edge Case Tests

```python
def test_edge_cases():
    # Empty input
    tokens = Scanner("").tokenize()
    assert len(tokens) == 1 and tokens[0].type == TokenType.EOF

    # Only whitespace
    tokens = Scanner("   \n\t  ").tokenize()
    assert len(tokens) == 1 and tokens[0].type == TokenType.EOF

    # Only comments
    tokens = Scanner("// hello world\n// another comment").tokenize()
    assert len(tokens) == 1 and tokens[0].type == TokenType.EOF

    # Adjacent tokens with no whitespace
    tokens = Scanner("x+y").tokenize()
    assert tokens[0].type == TokenType.IDENT
    assert tokens[1].type == TokenType.PLUS
    assert tokens[2].type == TokenType.IDENT

    # Number at end of input
    tokens = Scanner("42").tokenize()
    assert tokens[0].type == TokenType.NUMBER
    assert tokens[0].lexeme == "42"

    # Decimal number
    tokens = Scanner("3.14").tokenize()
    assert tokens[0].type == TokenType.NUMBER
    assert tokens[0].lexeme == "3.14"

    # Number followed by dot (not decimal)
    tokens = Scanner("42.").tokenize()
    assert tokens[0].type == TokenType.NUMBER
    assert tokens[0].lexeme == "42"
    # The dot would be an error token in our language

    # Keyword vs identifier
    tokens = Scanner("let letter").tokenize()
    assert tokens[0].type == TokenType.LET
    assert tokens[1].type == TokenType.IDENT
    assert tokens[1].lexeme == "letter"

    # Illegal character
    tokens = Scanner("@").tokenize()
    assert tokens[0].type == TokenType.ERROR

    print("All edge case tests passed.")

test_edge_cases()
```

### 4.2 Line/Column Tracking Test

```python
def test_positions():
    source = "let x = 1;\nlet y = 2;"
    tokens = Scanner(source).tokenize()

    # First line: let x = 1;
    assert tokens[0].line == 1 and tokens[0].col == 1   # let
    assert tokens[1].line == 1 and tokens[1].col == 5   # x
    assert tokens[2].line == 1 and tokens[2].col == 7   # =
    assert tokens[3].line == 1 and tokens[3].col == 9   # 1
    assert tokens[4].line == 1 and tokens[4].col == 10  # ;

    # Second line: let y = 2;
    assert tokens[5].line == 2 and tokens[5].col == 1   # let
    assert tokens[6].line == 2 and tokens[6].col == 5   # y

    print("All position tests passed.")

test_positions()
```

---

## Exercises

1. **Extend the scanner** to handle string literals (double-quoted, with escape sequences `\n`, `\t`, `\\`, `\"`).

2. **Add multi-line comments** (`/* ... */`) with proper error reporting for unterminated comments.

3. **Implement the NFA-based scanner:** Instead of the hand-written scanner above, build NFAs for each token pattern using Thompson's construction, combine them, and use NFA simulation for the maximal munch algorithm.

4. **Add the subset construction** to convert your combined NFA to a DFA. Compare the performance of NFA simulation vs. DFA lookup on a large input file.

5. **Measure performance:** Generate a 1 MB source file with random valid MiniCalc programs. Time your scanner and compute throughput in MB/s.

---

## Summary

This recitation demonstrated:

- Thompson's construction produces correct NFAs with $O(|r|)$ states.
- NFA simulation via epsilon-closure is straightforward to implement.
- A hand-written scanner for a real (toy) language requires careful handling of whitespace, comments, keywords, numbers, and error cases.
- Systematic testing with edge cases is essential for scanner correctness.

The hand-written approach used here mirrors the technique used by production compilers (GCC, Clang, rustc). In HW1, you will implement both an NFA-based scanner and a hand-written scanner, comparing their correctness and performance.
