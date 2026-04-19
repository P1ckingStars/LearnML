# Lecture 02d: Error Recovery & Practical Parsing

**Module 02 -- Parsing**
**Week 4**

---

## 1. The Problem of Syntax Errors

### 1.1 Goals of Error Recovery

A parser should not halt on the first syntax error. Good error recovery should:

1. **Report** the error with a clear, actionable message including location.
2. **Recover** to a state where parsing can continue meaningfully.
3. **Avoid cascading errors** -- spurious errors triggered by the recovery itself.
4. **Preserve correctness** -- when the input is valid, recovery mechanisms should not interfere.

### 1.2 Error Classification

| Error Type | Example | Detection Point |
|-----------|---------|----------------|
| Lexical | `@` in C source | Scanner |
| Syntactic | `if x { }` (missing parens) | Parser |
| Semantic | `int x = "hello";` | Type checker |
| Logical | Off-by-one in loop bound | Runtime / verification |

This lecture focuses on syntactic error recovery.

---

## 2. Panic-Mode Recovery

### 2.1 Strategy

The simplest and most robust recovery strategy:

1. When an error is detected, discard input tokens until a *synchronizing token* is found.
2. Synchronizing tokens are typically statement or block delimiters: `;`, `}`, `)`, keywords like `end`, `else`, `class`.

### 2.2 Implementation in Recursive Descent

```
function synchronize():
    advance()  // skip the problematic token
    while lookahead != EOF:
        // Synchronize on statement boundaries
        if previous_token == SEMICOLON:
            return
        switch lookahead:
            case CLASS, FN, LET, FOR, IF, WHILE, RETURN:
                return
            default:
                advance()
```

### 2.3 Implementation in LR Parsing

In an LR parser:

1. Pop states from the stack until finding a state $s$ where $\text{GOTO}(s, A)$ is defined for some "error nonterminal" $A$ (a nonterminal that represents a construct like *statement* or *declaration*).
2. Push the error state $\text{GOTO}(s, A)$.
3. Discard input tokens until finding one that is valid in the new state.

### 2.4 Analysis

**Advantages:** Simple to implement, rarely causes cascading errors, works with any parser type.

**Disadvantages:** May skip large portions of input, losing information about multiple errors in the skipped region.

---

## 3. Phrase-Level Recovery

### 3.1 Strategy

Rather than discarding tokens, *locally repair* the input by:
- Inserting a missing token.
- Deleting an extraneous token.
- Replacing a token.

### 3.2 Implementation

Define error actions in the parse table. When $\text{ACTION}[s, a]$ is empty (error), instead of halting:

```
function phrase_level_recover(state s, token a):
    // Try to determine what was expected
    expected = {t : ACTION[s, t] is defined}

    if SEMICOLON in expected:
        report("missing ';' before " + a)
        push synthetic SEMICOLON
        // Don't consume a -- retry with it
    elif RPAREN in expected and a == SEMICOLON:
        report("missing ')' -- inserting ')'")
        push synthetic RPAREN
    elif a is clearly extraneous:
        report("unexpected " + a + " -- ignoring")
        advance()
    else:
        panic_mode_recover()
```

### 3.3 Analysis

**Advantages:** Produces better error messages, preserves more input for continued parsing.

**Disadvantages:** Risk of infinite loops (inserting a token that triggers another error). Must be carefully designed to guarantee progress.

**Progress guarantee:** Ensure that every error recovery action either consumes an input token or reduces the stack. This prevents infinite loops.

---

## 4. Error Productions

### 4.1 Strategy

Augment the grammar with productions that explicitly match common error patterns:

```
stmt : IF LPAREN expr RPAREN stmt ELSE stmt
     | IF LPAREN expr RPAREN stmt
     | IF expr RPAREN stmt          // error: missing LPAREN
         { report_error("missing '(' in if-statement"); }
     | IF LPAREN expr stmt          // error: missing RPAREN
         { report_error("missing ')' in if-statement"); }
     ;
```

### 4.2 yacc/bison Error Token

yacc/bison provides a special `error` token:

```yacc
stmt : expr SEMICOLON
     | error SEMICOLON
         { yyerrok; report("syntax error in statement"); }
     ;

block : LBRACE stmt_list RBRACE
      | LBRACE error RBRACE
          { yyerrok; report("syntax error in block"); }
      ;
```

When the parser encounters an error, it pops states until it finds one where shifting `error` is valid. It then shifts `error`, discards input until the token following `error` in the production is found (e.g., `;` or `}`), and reduces.

### 4.3 The `yyerrok` Macro

After recovery, `yyerrok` resets the error state, telling the parser to report subsequent errors normally (without suppressing them). Without `yyerrok`, bison suppresses error messages for three tokens after recovery.

---

## 5. Burke-Fisher Error Repair

### 5.1 Principle

Burke-Fisher error repair (1987) is a more sophisticated strategy that considers a *window* of recent tokens and tries all possible single-token repairs:

1. When an error is detected at position $p$, consider the $k$ most recent tokens (the window).
2. For each position $i$ in the window, try:
   - **Delete** the token at position $i$.
   - **Insert** every possible token before position $i$.
   - **Replace** the token at position $i$ with every possible token.
3. Re-parse with each repair. Choose the repair that allows parsing to proceed the farthest.

### 5.2 Algorithm Sketch

```
function BurkeFisherRepair(parser, token_stream, error_pos, window_size):
    window = token_stream[error_pos - window_size .. error_pos]
    best_repair = NONE
    best_distance = 0

    for i in window:
        // Try deletion
        modified = remove token at position i
        distance = try_parse(parser, modified)
        if distance > best_distance:
            best_repair = ("delete", i)
            best_distance = distance

        // Try insertion of every token type
        for each token_type t:
            modified = insert t before position i
            distance = try_parse(parser, modified)
            if distance > best_distance:
                best_repair = ("insert", t, i)
                best_distance = distance

        // Try replacement
        for each token_type t:
            modified = replace token at position i with t
            distance = try_parse(parser, modified)
            if distance > best_distance:
                best_repair = ("replace", t, i)
                best_distance = distance

    apply best_repair
    report error with repair suggestion
```

### 5.3 Complexity and Practicality

**Complexity:** For window size $w$ and $|T|$ token types, we try $O(w \cdot |T|)$ repairs. Each re-parse attempt is fast (bounded by the window size plus a look-ahead distance).

**Implementation:** Requires the ability to checkpoint and restore parser state efficiently. This is straightforward with table-driven LR parsers (snapshot the stack and state).

### 5.4 Quality of Repairs

Burke-Fisher produces remarkably good error messages:

```
Error at line 5: unexpected '}', expected ';'
  Repair: insert ';' before '}'
```

Used in production compilers such as the Wirth compilers and some ML implementations.

---

## 6. Incremental Parsing

### 6.1 Motivation

In interactive settings (IDEs, notebooks), the user edits a file continuously. Re-parsing the entire file on every keystroke is wasteful. *Incremental parsing* re-parses only the affected region.

### 6.2 Tree Differencing Approach

Maintain the parse tree from the previous parse. When an edit occurs:

1. Identify the smallest subtree whose span overlaps the edit.
2. Re-lex the affected region (see incremental lexing, Lecture 01d).
3. Re-parse only the tokens covered by the affected subtree.
4. Replace the old subtree with the new one.

### 6.3 Challenges

- **Context sensitivity:** Changes in one place may require re-parsing distant code (e.g., adding `/*` opens a comment that extends to a distant `*/`).
- **State dependencies:** In LR parsing, each parse tree node implicitly encodes the parser state. Changing one node may invalidate states of subsequent nodes.
- **Grammar structure:** The granularity of incremental re-parsing depends on the grammar. Fine-grained nonterminals (e.g., individual statements) allow localized re-parsing.

### 6.4 Wagner-Graham Incremental LR Parsing

**Algorithm (Wagner and Graham, 1998):**

1. Maintain the parse tree as a sequence of tree fragments.
2. When tokens change, mark the affected tree nodes as "dirty."
3. Re-parse the dirty region using a modified LR parser that:
   - Shifts clean subtrees as single units (skipping their internal structure).
   - Re-parses dirty regions normally.
4. The parser uses the LR automaton to validate that the clean subtrees are still consistent.

**Complexity:** $O(k \log n)$ where $k$ is the size of the change and $n$ is the file size (amortized).

---

## 7. Tree-sitter and Modern Parsing Frameworks

### 7.1 Tree-sitter Overview

Tree-sitter (Brunsfeld, 2018) is a parsing framework designed for IDEs, providing:

- **Incremental parsing:** Re-parses only changed regions in $O(\text{change size} \cdot \log n)$.
- **Error recovery:** Produces a parse tree even for syntactically incorrect code.
- **Concrete syntax trees (CST):** Preserves all tokens including whitespace and comments.
- **Language-agnostic:** Grammars are specified in JavaScript DSL, compiled to C parsers.

### 7.2 Tree-sitter's Parsing Algorithm

Tree-sitter uses a modified GLR parser:

1. **Base parser:** LR(1) with operator-precedence disambiguation.
2. **Conflict handling:** When LR conflicts arise, the parser splits (GLR-style) but with a bounded number of parallel stacks (typically 2--4).
3. **Error recovery:** Uses a cost-based model:
   - Missing node (insertion): cost 1
   - Extra node (deletion): cost 1
   - The parser tries to minimize total cost.

### 7.3 Error Recovery in Tree-sitter

```
When the parser encounters an error:
1. Mark the current position as an ERROR node.
2. Try to recover by:
   a. Skipping one token (cost 1).
   b. Inserting missing tokens (predicted by the grammar) (cost 1 each).
   c. Wrapping a sequence of tokens in an ERROR node.
3. Choose the recovery that allows the parser to continue
   with the lowest total error cost.
4. Resume normal parsing.
```

The resulting tree always spans the entire input:

```
(program
  (function_definition
    name: (identifier)
    parameters: (parameter_list)
    body: (block
      (expression_statement
        (binary_expression
          left: (identifier)
          (ERROR)           <-- error node for malformed code
          right: (identifier)))
      (return_statement
        (integer)))))
```

### 7.4 Error-Tolerant Parsing Properties

**Theorem 7.1 (informal).** Tree-sitter guarantees:
1. Every input produces a parse tree (possibly with ERROR nodes).
2. ERROR nodes are local: valid portions of the code have correct parse trees.
3. Incremental re-parsing preserves all non-affected subtrees.

### 7.5 Grammar Specification Example

```javascript
// Tree-sitter grammar for a simple language
module.exports = grammar({
  name: 'simple',

  rules: {
    program: $ => repeat($.statement),

    statement: $ => choice(
      $.let_statement,
      $.expression_statement,
      $.if_statement,
    ),

    let_statement: $ => seq(
      'let',
      field('name', $.identifier),
      '=',
      field('value', $.expression),
      ';'
    ),

    if_statement: $ => seq(
      'if',
      field('condition', $.expression),
      field('consequence', $.block),
      optional(seq('else', field('alternative', $.block)))
    ),

    // ...
  }
});
```

---

## 8. Parsing in IDEs: Error Tolerance and Recovery

### 8.1 Requirements for IDE Parsers

IDE parsers face unique requirements:

1. **Speed:** Must parse within ~16ms (one frame at 60fps) for responsive editing.
2. **Incrementality:** Re-parse only what changed.
3. **Error tolerance:** Code is almost always syntactically invalid during editing.
4. **Partial results:** Must produce a useful tree even for incomplete code.
5. **Position fidelity:** Every token must map to exact source positions.

### 8.2 Resilient Parsing Strategies

**Strategy 1 -- Anchor-based recovery:** Define "anchor points" in the grammar -- constructs that strongly signal structure (function definitions, class declarations, block delimiters). The parser trusts anchor points and uses them to re-synchronize.

**Strategy 2 -- Speculative parsing:** Try multiple interpretations in parallel (like GLR) and commit to the best one based on how far parsing proceeds.

**Strategy 3 -- Partial parsing:** Parse the file as a sequence of independent top-level declarations. If one declaration has errors, other declarations are unaffected.

### 8.3 LSP and Parsing

The Language Server Protocol (LSP) separates the editor from the language analysis:

```
Editor <--> LSP Client <--> LSP Server (contains parser)
                              |
                              +-- Incremental parse on textDocument/didChange
                              +-- Syntax errors via textDocument/publishDiagnostics
                              +-- Parse tree used for:
                                  - Syntax highlighting (semantic tokens)
                                  - Code folding
                                  - Outline / symbol navigation
                                  - Code actions and refactoring
```

### 8.4 Comparison of Modern Parsing Frameworks

| Feature | yacc/bison | ANTLR 4 | Tree-sitter | Menhir |
|---------|-----------|---------|-------------|--------|
| Algorithm | LALR(1) | LL(*) | GLR | LR(1) |
| Incremental | No | No | Yes | No |
| Error recovery | Basic | Good | Excellent | Good |
| Target languages | C | Java, C#, etc. | C (runtime) | OCaml |
| IDE integration | Poor | Moderate | Excellent | Moderate |
| Ambiguity handling | Conflicts | Resolved by order | GLR splitting | Conflicts |
| Performance | Fast | Moderate | Fast | Fast |

---

## 9. Case Study: Parsing Real Language Grammars

### 9.1 C/C++ Parsing Challenges

- **Lexer hack:** The token type of an identifier depends on whether it names a type or a variable: `T * x;` is either a declaration or multiplication. The parser must feed type information back to the lexer.
- **Template syntax:** `vector<vector<int>>` -- the `>>` must be split into two `>` tokens in template context.
- **Preprocessor interaction:** `#if` / `#else` / `#endif` create syntactically independent code paths that may not individually parse correctly.

### 9.2 Python Parsing

- **Indentation-sensitive:** INDENT/DEDENT tokens create block structure. The grammar is context-free given these synthetic tokens.
- **Python 3.9+:** Switched from LL(1) (pgen) to PEG (pegen) for more natural grammar specification.
- **The new PEG parser** allows left recursion, eliminating the need for grammar contortions.

### 9.3 Rust Parsing

- **Macro expansion:** `macro_rules!` definitions create arbitrary syntax extensions. The parser must handle token trees before macro expansion and re-parse after.
- **Turbofish syntax:** `f::<T>()` -- the `::` before `<` disambiguates from comparison.
- **Pattern matching:** Complex patterns require careful grammar design to avoid ambiguity.

### 9.4 Lessons Learned

1. **No real language has a clean grammar.** Every language has quirks that complicate parsing.
2. **Error recovery is as important as correct parsing.** Users spend most of their time with invalid code.
3. **Hand-written parsers dominate production compilers.** GCC, Clang, rustc, Go, V8 (JavaScript) all use hand-written recursive descent parsers.
4. **Parser generators shine for prototyping and domain-specific languages.** When the grammar is small and clean, generators save significant effort.

---

## 10. Summary

| Recovery Strategy | Quality of Messages | Implementation Effort | Risk of Cascading | Best For |
|------------------|--------------------|-----------------------|-------------------|----------|
| Panic mode | Low | Very low | Low | Any parser |
| Phrase-level | Medium | Medium | Medium | Table-driven parsers |
| Error productions | High | High | Low | Specific known errors |
| Burke-Fisher | Very high | High | Low | LR parsers |
| Tree-sitter style | High | In framework | Very low | IDE parsers |

---

## References

1. Burke, M. G. and Fisher, G. A. "A practical method for LR and LL syntactic error diagnosis and recovery." *ACM TOPLAS*, 9(2):164--197, 1987.
2. Wagner, T. A. and Graham, S. L. "Efficient and flexible incremental parsing." *ACM TOPLAS*, 20(5):980--1013, 1998.
3. Brunsfeld, M. "Tree-sitter -- a new parsing system for programming tools." *GitHub*, 2018. https://tree-sitter.github.io/tree-sitter/
4. Medeiros, S. and Ierusalimschy, R. "Syntax error recovery in parsing expression grammars." *SAC*, 2018.
5. Aho, A. V., Lam, M. S., Sethi, R., and Ullman, J. D. *Compilers: Principles, Techniques, and Tools*, 2nd ed. Pearson, 2006. Section 4.8.
6. Grune, D. and Jacobs, C. J. H. *Parsing Techniques: A Practical Guide*, 2nd ed. Springer, 2008. Chapter 10.
7. Parr, T. *The Definitive ANTLR 4 Reference*, 2nd ed. Pragmatic Bookshelf, 2013.
8. Python Software Foundation. "PEP 617 -- New Parser." https://peps.python.org/pep-0617/
