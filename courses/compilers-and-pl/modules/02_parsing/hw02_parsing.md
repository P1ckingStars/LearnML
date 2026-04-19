# HW2: Parsing

**Module 02 -- Parsing**
**Due:** End of Week 4
**Format:** Part A: written solutions. Part B: code submission with test suite and writeup.

---

## Part A: Theory (50 points)

### Problem 1: Grammar Transformations (10 points)

Consider the grammar:

$$S \to S + S \mid S * S \mid (S) \mid a$$

**(a)** Show that this grammar is ambiguous by giving two distinct parse trees for the string $a + a * a$.

**(b)** Write an unambiguous grammar for the same language that enforces:
- $*$ has higher precedence than $+$.
- Both operators are left-associative.

**(c)** Transform your grammar from (b) to eliminate left recursion (making it suitable for LL(1) parsing). Verify that the transformed grammar is LL(1) by computing the PREDICT sets for each production.

**(d)** Prove that your transformed grammar generates the same language as the original.

### Problem 2: FIRST and FOLLOW Sets (10 points)

Compute the FIRST and FOLLOW sets for all nonterminals in the following grammar. Show your work (each iteration of the fixed-point computation).

$$S \to A\, a \mid b$$
$$A \to A\, c \mid S\, d \mid \varepsilon$$

Then determine: is this grammar LL(1)? If not, identify the specific conflict(s) and explain why they arise.

### Problem 3: LR Parse Table Construction (15 points)

Consider the augmented grammar:

$$S' \to S$$
$$S \to C\, C$$
$$C \to c\, C \mid d$$

**(a)** Construct the canonical collection of LR(1) item sets (with lookaheads). Show each item set and the GOTO transitions.

**(b)** Build the LR(1) parse table (ACTION and GOTO). Verify there are no conflicts.

**(c)** Now construct the LALR(1) parse table by merging compatible states. Does merging introduce any new conflicts?

**(d)** Trace the LR(1) parser on the input $c\, d\, c\, c\, d\, \$$. Show the stack, input, and action at each step.

### Problem 4: Grammar Class Relationships (10 points)

**(a)** Prove that every LL(1) grammar is also SLR(1).

*Hint:* Show that if there is an SLR(1) conflict for a grammar $G$, then $G$ cannot be LL(1). Consider what it means for a state in the LR(0) automaton to have a shift-reduce conflict or reduce-reduce conflict, and relate this to the FIRST/FOLLOW conditions for LL(1).

**(b)** Give an example of a grammar that is SLR(1) but not LL(1). Prove both claims (that it is SLR(1) and that it is not LL(1)).

**(c)** Give an example of a grammar that is LALR(1) but not SLR(1). Construct the LR(0) automaton and show the SLR(1) conflict, then show that LALR(1) lookaheads resolve it.

### Problem 5: Ambiguity and Inherent Ambiguity (5 points)

**(a)** Prove that the language $L = \{a^i b^j \mid i = j \text{ or } i = 2j\}$ is context-free.

**(b)** Is $L$ inherently ambiguous? Prove your answer.

*Hint:* Consider what happens with the string $a^{2n} b^n$ for large $n$. Use Ogden's lemma.

---

## Part B: Implementation (50 points)

### Overview

Implement a parser for **MiniLang** (the language from HW1) that produces an abstract syntax tree. You will implement two parsers:

1. A **recursive descent parser** (top-down).
2. A **shift-reduce parser** (bottom-up) using an SLR(1) or LALR(1) parse table.

Both parsers should accept the same language and produce equivalent ASTs.

### MiniLang Grammar

```
program     -> declaration* EOF

declaration -> let_decl | fn_decl | statement

let_decl    -> "let" IDENT "=" expression ";"

fn_decl     -> "fn" IDENT "(" param_list? ")" block

param_list  -> IDENT ("," IDENT)*

statement   -> expr_stmt | if_stmt | while_stmt | for_stmt
             | return_stmt | block

expr_stmt   -> expression ";"

if_stmt     -> "if" expression block ("else" block)?

while_stmt  -> "while" expression block

for_stmt    -> "for" IDENT "=" expression ";" expression ";" expression block

return_stmt -> "return" expression? ";"

block       -> "{" declaration* "}"

expression  -> assignment

assignment  -> IDENT "=" assignment | logic_or

logic_or    -> logic_and ("||" logic_and)*

logic_and   -> equality ("&&" equality)*

equality    -> comparison (("==" | "!=") comparison)*

comparison  -> addition (("<" | ">" | "<=" | ">=") addition)*

addition    -> multiplication (("+" | "-") multiplication)*

multiplication -> unary (("*" | "/" | "%") unary)*

unary       -> ("-" | "!") unary | call

call        -> primary ("(" arg_list? ")")*

arg_list    -> expression ("," expression)*

primary     -> INT_LIT | FLOAT_LIT | HEX_LIT | STRING_LIT
             | "true" | "false" | "nil"
             | IDENT
             | "(" expression ")"
```

### AST Node Types

Define AST nodes for at least the following:

- `Program(declarations)`
- `LetDecl(name, initializer)`
- `FnDecl(name, params, body)`
- `Block(declarations)`
- `IfStmt(condition, then_branch, else_branch)`
- `WhileStmt(condition, body)`
- `ForStmt(var, init, condition, update, body)`
- `ReturnStmt(value)`
- `ExprStmt(expression)`
- `BinaryExpr(op, left, right)`
- `UnaryExpr(op, operand)`
- `CallExpr(callee, arguments)`
- `Assignment(name, value)`
- `Literal(value)`
- `Identifier(name)`

### Requirements

**Part B.1: Recursive Descent Parser (25 points)**

1. Implement a recursive descent parser using the scanner from HW1.
2. The parser should build an AST (not just check syntax).
3. Handle operator precedence and associativity correctly.
4. Implement error recovery: report multiple errors per parse, synchronize on statement boundaries.
5. Provide clear error messages with line/column numbers.

**Part B.2: Shift-Reduce Parser (25 points)**

1. Write a grammar suitable for bottom-up parsing (left-recursive for left-associative operators).
2. Compute the SLR(1) or LALR(1) parse table (you may write a program to compute it).
3. Implement the table-driven shift-reduce parsing algorithm.
4. Build the same AST as the recursive descent parser.
5. Handle the "dangling else" ambiguity (if present) via shift preference or explicit precedence.

### Test Suite

Provide at least 15 test cases including:

1. Arithmetic expressions with all operators and precedence levels.
2. Nested function calls: `f(g(x), h(y, z))`.
3. If/else with dangling else.
4. While and for loops.
5. Function definitions and calls.
6. Block scoping with nested blocks.
7. Assignment expressions.
8. Error cases: missing semicolons, unmatched braces, incomplete expressions.
9. Empty program.
10. Complex program combining all features.

For each test case, show the input and the expected AST (printed in a readable format).

### Deliverables

1. **Source code** for both parsers.
2. **Test suite** with expected outputs.
3. **Grammar specification** used for the shift-reduce parser, with any SLR(1) or LALR(1) tables.
4. **Writeup** (2--3 pages) discussing:
   - Comparison of the two parsing approaches (development effort, code size, error handling quality).
   - Any grammar transformations you applied and why.
   - How you handle precedence and associativity in each parser.
   - Interesting edge cases or ambiguities you discovered.

### Grading Rubric

| Criterion | Points |
|----------|--------|
| **Recursive Descent Parser** | |
| Correct parsing of all constructs | 10 |
| AST construction | 5 |
| Error recovery and messages | 5 |
| Precedence and associativity | 5 |
| **Shift-Reduce Parser** | |
| Correct parse table (SLR/LALR) | 5 |
| Correct shift-reduce algorithm | 5 |
| AST construction | 5 |
| Conflict resolution | 5 |
| Equivalence with recursive descent | 5 |
| **Test suite and writeup** | |
| Test coverage and quality | 5 |
| Writeup analysis | 5 |

---

## Submission

Submit via the course submission system by the deadline. Late submissions are penalized 10% per day.

**Reminder:** You may use any programming language. No parser generator tools are permitted for Part B.2 -- you must implement the table-driven algorithm yourself (though you may write a program to *compute* the table from the grammar).
