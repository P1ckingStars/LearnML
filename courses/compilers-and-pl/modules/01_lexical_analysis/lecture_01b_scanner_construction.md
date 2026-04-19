# Lecture 01b: Scanner Construction

**Module 01 -- Lexical Analysis**
**Week 1--2**

---

## 1. The Role of the Scanner

The scanner (lexer, tokenizer) is the interface between raw source text and the parser. Its responsibilities:

1. Read characters from the input stream.
2. Group them into *lexemes* -- maximal sequences matching a token pattern.
3. Produce *tokens* -- pairs $(\text{token-type}, \text{attribute-value})$.
4. Strip whitespace and comments.
5. Report lexical errors.

**Performance matters:** The scanner typically processes every byte of the source file and accounts for 20--40% of total compilation time in simple compilers.

---

## 2. The Maximal Munch Algorithm

### 2.1 Principle

**Maximal munch** (longest match): the scanner always returns the longest possible prefix of the remaining input that matches some token pattern.

**Priority rule:** When multiple patterns match the same longest prefix, the pattern listed first (highest priority) wins. This is how keywords are handled: `if` matches both the keyword pattern and the identifier pattern, but the keyword rule has higher priority.

### 2.2 Algorithm

```
function MaximalMunchScan(input, patterns[1..k]):
    pos = 0
    tokens = []
    while pos < len(input):
        longest_match = NONE
        longest_len = 0
        best_pattern = NONE

        for i = 1 to k:
            match_len = longestPrefixMatch(patterns[i], input[pos..])
            if match_len > longest_len:
                longest_len = match_len
                best_pattern = i
            elif match_len == longest_len and match_len > 0:
                // tie: keep higher-priority (smaller i)
                pass

        if longest_len == 0:
            report error at pos
            pos += 1  // skip one character (error recovery)
        else:
            lexeme = input[pos .. pos + longest_len - 1]
            tokens.append(Token(patterns[best_pattern].type, lexeme))
            pos += longest_len

    tokens.append(Token(EOF))
    return tokens
```

### 2.3 DFA-Based Implementation

In practice, maximal munch is implemented using a single DFA constructed from all token patterns:

```
function DFA_MaximalMunch(DFA D, input):
    state = D.start
    pos = 0
    last_accept_pos = -1
    last_accept_token = NONE

    while pos < len(input) and state != DEAD:
        state = D.delta(state, input[pos])
        pos += 1
        if state in D.accept:
            last_accept_pos = pos
            last_accept_token = D.token_type(state)

    if last_accept_pos >= 0:
        return (last_accept_token, input[0..last_accept_pos-1])
    else:
        return ERROR
```

**Key insight:** The scanner continues past the first accepting state, recording each accepting state it visits. When it reaches a dead state (or end of input), it backtracks to the last accepting state.

### 2.4 Correctness Argument

**Theorem 2.1.** The DFA-based maximal munch algorithm returns the longest prefix of the input matching any token pattern, with ties broken by priority.

*Proof sketch.* The combined DFA simulates all token NFAs in parallel (by the subset construction). At each character, it transitions to the next combined state. An accepting state in the combined DFA corresponds to at least one token pattern accepting the current prefix. The algorithm records the last such state, guaranteeing the longest match. Priority is encoded in the accept-state labeling (when a DFA state corresponds to multiple accepting NFA states, the highest-priority token type is used). $\blacksquare$

---

## 3. Scanner Generators: lex/flex Architecture

### 3.1 lex Specification Format

A lex/flex specification has three sections:

```
%{
  // C declarations (copied to output)
%}

// Definitions section
DIGIT   [0-9]
LETTER  [a-zA-Z]

%%

// Rules section: pattern  { action }
{LETTER}({LETTER}|{DIGIT})*  { return TOKEN_ID; }
{DIGIT}+                      { return TOKEN_INT; }
"+"                           { return TOKEN_PLUS; }
"-"                           { return TOKEN_MINUS; }
[ \t\n]+                      { /* skip whitespace */ }
.                             { return TOKEN_ERROR; }

%%

// User code section (copied to output)
```

### 3.2 Internal Architecture

The lex-generated scanner works as follows:

1. **Compile time:** Each pattern is converted to an NFA via Thompson's construction. All NFAs are combined into a single NFA. The subset construction produces a DFA. The DFA is minimized (Hopcroft). The DFA transition table is compressed and emitted as C arrays.

2. **Run time:** The generated scanner function `yylex()` executes the DFA-based maximal munch algorithm, reading from the input buffer `yyin`, advancing `yytext` and `yyleng`.

### 3.3 The flex Optimization

flex (Fast Lexical Analyzer) improves upon lex in several ways:

- **Table compression:** Uses equivalence classes for input characters and meta-equivalence classes for table rows.
- **Reject action:** Allows falling through to the next-best match (but with performance penalty).
- **Start conditions:** Enable context-dependent scanning (e.g., inside string literals, inside comments).
- **Buffer management:** Uses double-buffering to avoid one-character-at-a-time I/O.

---

## 4. Handling Keywords, Whitespace, and Comments

### 4.1 Keywords

Two approaches:

**Approach 1 -- Keyword rules:** List each keyword as a separate pattern with higher priority than identifiers.

```
"if"      { return TOKEN_IF; }
"while"   { return TOKEN_WHILE; }
{ID}      { return TOKEN_ID; }
```

**Approach 2 -- Keyword table lookup:** Recognize all keywords as identifiers, then look up the lexeme in a hash table of reserved words.

```
{ID}  {
    token_type = keyword_lookup(yytext);
    if (token_type != NOT_FOUND) return token_type;
    return TOKEN_ID;
}
```

**Trade-offs:**
- Approach 1: DFA has more states (one path for each keyword), but lookup is implicit.
- Approach 2: Smaller DFA, but requires a hash table lookup per identifier. This is the approach used by most hand-written scanners (gcc, clang, rustc).

### 4.2 Whitespace

Whitespace tokens are typically matched and discarded (no token returned to the parser). In Python, however, indentation is significant, requiring the scanner to track indentation levels and emit INDENT/DEDENT tokens.

### 4.3 Comments

**Line comments** (e.g., `//`): Match from `//` to end of line. Pattern: `"//"[^\n]*`

**Block comments** (e.g., `/* ... */`): More complex. Naive pattern `"/*"(.|\n)*"*/"` is greedy and may span multiple comments. Solutions:

1. **Start conditions** (flex approach):

```
%x COMMENT
%%
"/*"           { BEGIN(COMMENT); }
<COMMENT>"*/"  { BEGIN(INITIAL); }
<COMMENT>.     { /* skip */ }
<COMMENT>\n    { /* skip, count lines */ }
```

2. **Nested comments** (as in some languages like Haskell): require a counter -- not regular, but handled in the scanner with a state variable.

---

## 5. Error Recovery in Lexical Analysis

### 5.1 Error Types

- **Illegal character:** A character not in any valid token's alphabet (e.g., `@` in standard C).
- **Unterminated string/comment:** EOF inside a string literal or block comment.
- **Malformed token:** e.g., `0x` followed by non-hex digit.

### 5.2 Recovery Strategies

**Panic mode:** Skip the offending character and resume scanning. Simple but loses minimal context.

```
.  { fprintf(stderr, "Illegal character '%c' at line %d\n", *yytext, yylineno); }
```

**Character deletion/insertion:** Try deleting, inserting, or replacing a single character to form a valid token. Expensive and rarely worthwhile at the lexical level.

**Synchronization:** Skip forward to a known synchronization point (e.g., whitespace, semicolon, newline).

### 5.3 Error Tokens

Modern scanners often emit an ERROR token rather than halting, allowing the parser to continue and report multiple errors in a single pass.

---

## 6. Unicode and Multi-Byte Character Sets

### 6.1 The Challenge

ASCII uses 7 bits (128 characters). Modern languages support Unicode (up to 1,114,112 code points). This affects scanner design:

- **Character representation:** UTF-8 (variable-length, 1--4 bytes), UTF-16 (2 or 4 bytes), UTF-32 (4 bytes).
- **Alphabet size:** $|\Sigma|$ is no longer 128 but potentially $> 10^6$. DFA transition tables indexed by character become enormous.

### 6.2 Solutions

**Equivalence classes:** Group Unicode code points into equivalence classes based on behavior in all patterns. The number of classes is typically small (< 200), making DFA tables manageable.

**Range-based transitions:** Instead of per-character transitions, store transitions as sorted lists of character ranges. A binary search gives the transition in $O(\log k)$ for $k$ ranges.

**Two-level tables:** First level maps characters to equivalence classes (a flat array for ASCII, a trie or hash map for higher code points). Second level is the standard DFA table indexed by equivalence class.

### 6.3 Identifier Characters

Modern languages allow Unicode identifiers (e.g., variable names in Arabic, Chinese, etc.). The scanner must classify code points according to Unicode categories:

- `ID_Start`: letters, letter numbers, plus `_`.
- `ID_Continue`: `ID_Start` plus digits, combining marks, connector punctuation.

This follows Unicode Technical Report #31.

---

## 7. Performance: Table-Driven vs. Direct-Coded Scanners

### 7.1 Table-Driven Scanners

The generated scanner uses a transition table:

```c
int next_state = transition_table[current_state][input_char];
```

**Advantages:** Compact, generated automatically, easy to modify.

**Disadvantages:** Each transition involves a table lookup (potential cache miss). The indirect branch is hard for the CPU branch predictor.

### 7.2 Direct-Coded Scanners

Instead of a table, generate code with one label per DFA state:

```c
state_0:
    c = next_char();
    if (c >= 'a' && c <= 'z') goto state_1;
    if (c >= '0' && c <= '9') goto state_2;
    goto error;

state_1:
    c = next_char();
    if (c >= 'a' && c <= 'z') goto state_1;
    if (c >= '0' && c <= '9') goto state_1;
    accept(TOKEN_ID);
    goto done;
```

**Advantages:** No table lookup; transitions become direct jumps. Branch prediction works better because each state has its own branch history.

**Disadvantages:** Code size may be large. Generated code is harder to debug.

### 7.3 Empirical Comparison

Studies by Bumbulis and Cowan (1993) show direct-coded scanners can be 2--3x faster than table-driven scanners. The advantage comes from:

- Eliminating memory indirection (table lookups).
- Better branch prediction (state-specific branch targets).
- Better instruction cache utilization for scanners with moderate state counts.

### 7.4 Hand-Coded Scanners

Many production compilers (GCC, Clang, Go, Rust) use hand-written scanners for maximum performance and flexibility. A hand-written scanner is essentially a direct-coded scanner with additional optimizations:

- Fast paths for common tokens (identifiers, numbers).
- SIMD-accelerated whitespace skipping.
- Inline keyword detection via tries or perfect hashing.

---

## 8. Building a Scanner from Scratch

### 8.1 Architecture

A hand-written scanner typically consists of:

1. **Input buffer:** Manages character input with lookahead.
2. **Main dispatch loop:** Examines the first character to determine the token category, then dispatches to a specialized handler.
3. **Token handlers:** Each handler reads the full lexeme for its category.
4. **Token output:** Returns $(\text{type}, \text{lexeme}, \text{line}, \text{column})$.

### 8.2 Skeleton

```python
class Scanner:
    def __init__(self, source: str):
        self.source = source
        self.pos = 0
        self.line = 1
        self.col = 1

    def peek(self) -> str:
        if self.pos >= len(self.source):
            return '\0'
        return self.source[self.pos]

    def advance(self) -> str:
        c = self.source[self.pos]
        self.pos += 1
        if c == '\n':
            self.line += 1
            self.col = 1
        else:
            self.col += 1
        return c

    def scan_token(self) -> Token:
        self.skip_whitespace()
        c = self.peek()

        if c == '\0':
            return Token(EOF, '', self.line, self.col)
        if c.isalpha() or c == '_':
            return self.scan_identifier()
        if c.isdigit():
            return self.scan_number()
        if c == '"':
            return self.scan_string()
        # ... single/double character tokens
        return self.scan_operator()

    def scan_identifier(self) -> Token:
        start = self.pos
        while self.peek().isalnum() or self.peek() == '_':
            self.advance()
        lexeme = self.source[start:self.pos]
        token_type = KEYWORDS.get(lexeme, TOKEN_ID)
        return Token(token_type, lexeme, self.line, self.col)

    def scan_number(self) -> Token:
        start = self.pos
        while self.peek().isdigit():
            self.advance()
        if self.peek() == '.' and self.source[self.pos+1].isdigit():
            self.advance()  # consume '.'
            while self.peek().isdigit():
                self.advance()
        return Token(TOKEN_NUMBER, self.source[start:self.pos],
                     self.line, self.col)
```

### 8.3 Testing Strategy

- **Exhaustive token coverage:** Test every token type at least once.
- **Boundary cases:** Empty input, single-character tokens, maximum-length identifiers.
- **Error cases:** Unterminated strings, illegal characters, malformed numbers.
- **Regression corpus:** Scan real source files and compare against expected token streams.

---

## 9. Summary

| Aspect | Table-Driven | Direct-Coded | Hand-Written |
|--------|-------------|--------------|--------------|
| Development effort | Low (generated) | Low (generated) | High |
| Flexibility | Low | Medium | High |
| Performance | Moderate | Good | Best |
| Maintainability | Good (regenerate) | Moderate | Varies |
| Error messages | Generic | Generic | Excellent |

For course projects, a hand-written scanner is recommended for educational value. For production compilers, the choice depends on the language complexity and performance requirements.

---

## References

1. Aho, A. V., Lam, M. S., Sethi, R., and Ullman, J. D. *Compilers: Principles, Techniques, and Tools*, 2nd ed. Pearson, 2006. Chapter 3.
2. Cooper, K. D. and Torczon, L. *Engineering a Compiler*, 3rd ed. Morgan Kaufmann, 2022. Chapter 2.
3. Bumbulis, P. and Cowan, D. D. "RE2C: A More Versatile Scanner Generator." *ACM Letters on Programming Languages and Systems*, 2(1--4):70--84, 1993.
4. Paxson, V. "Flex -- Fast Lexical Analyzer Generator." Documentation, 1995.
5. Russ Cox. "Regular Expression Matching Can Be Simple And Fast." https://swtch.com/~rsc/regexp/regexp1.html, 2007.
6. Unicode Consortium. "Unicode Standard Annex #31: Unicode Identifier and Pattern Syntax." https://unicode.org/reports/tr31/.
