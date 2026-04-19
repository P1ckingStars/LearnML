# Mini-Project 1: End-to-End Compiler Front-End

**Due**: End of Week 8
**Weight**: 10% of final grade
**Team Size**: Individual

---

## Overview

Build a complete compiler front-end for a small but non-trivial language called **Decaf-Lite**. Your compiler should take source code as input and produce a typed abstract syntax tree (AST) as output.

## The Decaf-Lite Language

Decaf-Lite is a simplified imperative language with:

- Integer and boolean types
- Variables with block scoping
- Arithmetic and boolean expressions
- If/else and while statements
- Functions with parameters and return values
- Arrays (1D)
- Print statement for output

## Phases

### Phase 1: Lexer (Scanner)

- Tokenize Decaf-Lite source code
- Handle keywords, identifiers, integer literals, string literals, operators
- Report lexical errors with line/column numbers
- **No generator tools** (no flex/lex) -- build from scratch

### Phase 2: Parser

- Parse token stream into an AST
- Implement either recursive descent or an LR parser (your choice)
- Handle operator precedence and associativity
- Report syntax errors with meaningful messages
- **No generator tools** (no bison/yacc) -- build from scratch

### Phase 3: Semantic Analysis

- Build symbol tables with proper scoping
- Type check all expressions and statements
- Check: undeclared variables, type mismatches, duplicate declarations
- Report semantic errors with source locations

## Deliverables

1. Source code with clear module boundaries (lexer, parser, semantic analyzer)
2. Test suite: at least 20 valid programs and 20 programs with errors (lexical, syntactic, semantic)
3. Documentation: grammar specification (BNF), AST node types, type rules
4. Writeup (~3 pages): design decisions, challenges encountered, what you would do differently

## Grading Rubric

| Component | Points |
|-----------|--------|
| Lexer correctness | 15 |
| Parser correctness | 20 |
| AST design | 10 |
| Semantic analysis | 20 |
| Error reporting quality | 10 |
| Test suite | 15 |
| Writeup | 10 |
