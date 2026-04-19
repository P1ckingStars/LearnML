# HW11: Formal Verification & SMT

**Due:** End of Week 22 | **Total:** 100 points (Part A: 50, Part B: 50)

---

## Part A: Theory (50 points)

### Problem 1: DPLL and CDCL Trace (10 points)

Consider the following CNF formula over variables $\{x_1, x_2, x_3, x_4, x_5\}$:

$$\varphi = (x_1 \lor x_2) \land (\neg x_1 \lor x_3) \land (\neg x_2 \lor x_4) \land (\neg x_3 \lor \neg x_4 \lor x_5) \land (\neg x_1 \lor \neg x_5) \land (\neg x_3 \lor x_4) \land (x_2 \lor \neg x_4 \lor \neg x_5)$$

Label the clauses as $C_1, \ldots, C_7$ in order.

**(a)** (3 pts) Trace the DPLL algorithm on $\varphi$ with the decision order $x_1 = 1, x_2 = 1, x_3 = 1, \ldots$ (choose TRUE first for each variable). Show each step: decision, unit propagation, conflict detection, and backtracking. Report whether the formula is satisfiable.

**(b)** (4 pts) Now trace the CDCL algorithm on $\varphi$. Start with decision $x_1 = 1$ at decision level 1.

1. Show the implication graph after each propagation.
2. When a conflict occurs, identify the conflict clause.
3. Perform 1-UIP conflict analysis: show the sequence of resolution steps, identify the 1-UIP, and derive the learned clause.
4. Determine the backjump level.
5. Show the state after backjumping and continue the search.

**(c)** (3 pts) Compare the DPLL and CDCL traces. How many decisions/backtracks did each require? Explain how clause learning helped CDCL avoid redundant work.

---

### Problem 2: Congruence Closure for EUF (10 points)

Consider the following set of equalities and disequalities over terms with uninterpreted functions $f$ and $g$:

**Equalities:**
- $a = b$
- $f(a) = c$
- $f(b) = d$
- $g(c, d) = e$
- $g(d, d) = h$

**Disequality:**
- $e \ne h$

**(a)** (4 pts) Trace the congruence closure algorithm step by step.

1. List all subterms and initialize the equivalence classes.
2. Process each equality. After each merge, check for congruence closures that are triggered and process them.
3. Show the equivalence classes after each step.
4. Determine whether the conjunction of equalities and the disequality is satisfiable.

**(b)** (3 pts) Prove that the congruence closure algorithm is sound and complete for the quantifier-free theory of equality with uninterpreted functions. Your proof should address:
- Soundness: if the algorithm reports UNSAT, the formula is truly unsatisfiable.
- Completeness: if the algorithm reports SAT, a model can be constructed.

**(c)** (3 pts) Explain why the Downey-Sethi-Tarjan algorithm achieves $O(n \log n)$ time complexity. What data structure is used, and what is the key invariant that bounds the number of congruence checks?

---

### Problem 3: Abstract Interpretation with Intervals (10 points)

Consider the following program:

```
x := 0;
y := 10;
while (x < y) {
    x := x + 1;
    y := y - 1;
}
assert(x + y == 10);
```

**(a)** (4 pts) Compute the abstract state at each program point using the **interval domain**. Show the Kleene iteration at the loop head:

- Iteration 0 (before first loop entry): $x \in ?, y \in ?$
- Iteration 1 (after one pass through the loop body): $x \in ?, y \in ?$
- Continue until you would need widening.

**(b)** (3 pts) Apply **widening** at the loop head. Show where the widening is applied and the resulting (over-approximate) abstract state. Then apply **narrowing** to improve precision. Show each narrowing iteration.

Final result: what are the intervals for $x$ and $y$ after the loop?

**(c)** (3 pts) Can the interval domain prove that the assertion $x + y = 10$ holds? Explain why or why not. What abstract domain *could* prove this property? (Hint: consider relational domains.)

---

### Problem 4: Bounded Model Checking Encoding (10 points)

Consider the following program:

```c
int x = input();  // arbitrary integer input
int y = 0;
for (int i = 0; i < 3; i++) {
    if (x > 0)
        y = y + x;
    else
        y = y - x;
    x = x - 1;
}
assert(y >= 0);  // Is this always true?
```

**(a)** (4 pts) Unroll the loop to depth $k = 3$ and convert to SSA form. Write out every SSA variable and assignment.

**(b)** (4 pts) Encode the unrolled program as an SMT formula (using the theory of integer arithmetic). The formula should be satisfiable if and only if the assertion can be violated. Write the complete formula.

**(c)** (2 pts) Is the assertion valid (holds for all inputs)? If not, provide a concrete counterexample (a value of `input()` that violates the assertion). Explain how you determined this from the SMT encoding.

---

### Problem 5: Nelson-Oppen Theory Combination (10 points)

Consider the following formula mixing the theory of Equality and Uninterpreted Functions (EUF) and Linear Integer Arithmetic (LIA):

$$f(x + 1) = f(y) \land g(y) = g(z + 2) \land x + 1 = z + 2 \land f(x + 1) \ne g(z + 2)$$

**(a)** (3 pts) **Purify** the formula: separate it into a pure EUF formula $\varphi_{\text{EUF}}$ and a pure LIA formula $\varphi_{\text{LIA}}$, introducing shared variables as necessary. List all shared variables.

**(b)** (3 pts) **Enumerate arrangements** over the shared variables. How many arrangements are there in total? (You may group them by the partition they induce.)

**(c)** (2 pts) For each arrangement, determine whether $\varphi_{\text{EUF}} \land \mathcal{A}$ and $\varphi_{\text{LIA}} \land \mathcal{A}$ are independently satisfiable. Which arrangement(s), if any, make both satisfiable?

**(d)** (2 pts) Is the original formula satisfiable? Justify your answer using the Nelson-Oppen procedure. If the formula is satisfiable, provide a model. If unsatisfiable, explain which theory constraints conflict.

---

## Part B: Implementation (50 points)

### Project: Mini Symbolic Execution Engine

Build a symbolic execution engine for a simple imperative language using Z3 as the backend constraint solver.

### Language Grammar

```
program    ::= function*
function   ::= 'fun' ID '(' params ')' '{' stmt* '}'
params     ::= ID (',' ID)*  |  epsilon
stmt       ::= ID ':=' expr ';'
             | 'if' '(' expr ')' '{' stmt* '}' 'else' '{' stmt* '}'
             | 'while' '(' expr ')' '{' stmt* '}'       // bounded unrolling
             | 'assert' '(' expr ')' ';'
             | 'return' expr ';'
expr       ::= INT | ID | expr binop expr | unop expr | '(' expr ')'
             | ID '(' args ')'                           // function call
binop      ::= '+' | '-' | '*' | '/' | '%' | '<' | '<=' | '>' | '>='
             | '==' | '!=' | '&&' | '||'
unop       ::= '-' | '!'
args       ::= expr (',' expr)*  |  epsilon
```

### Requirements

Implement the following components. You may use Python with the `z3-solver` package.

#### 1. Parser (10 points)

Implement a parser for the grammar above. You may use a parser combinator library, a recursive descent parser, or a simple hand-written parser. The parser should produce an AST.

*Alternatively*, you may represent programs directly as Python data structures (nested tuples/dicts) and skip the string-parsing step. In this case, provide at least 5 non-trivial test programs as Python ASTs.

#### 2. Symbolic Execution Engine (20 points)

Implement the core symbolic execution algorithm:

- **Symbolic state:** Maintain a symbolic store mapping variables to Z3 expressions and a path condition (list of Z3 Boolean expressions).
- **Forking on branches:** When encountering an `if` statement, fork execution into two paths (then and else), adding the appropriate constraint to each path condition. Check feasibility using Z3 before exploring a path.
- **Loop handling:** Unroll `while` loops up to a configurable bound $k$ (default $k = 10$). After $k$ unrollings, assume the loop exits (add the negation of the loop guard to the path condition).
- **Function calls:** Inline function calls (for simplicity, no recursion required; optionally support bounded recursion).
- **Assertions:** When encountering `assert(e)`, check if the negation of `e` is satisfiable under the current path condition. If so, report an assertion violation with a concrete counterexample.

#### 3. Path Feasibility Checking (5 points)

Use Z3 to check satisfiability of path conditions. Implement:
- `is_feasible(path_condition) -> bool`: Returns whether the conjunction of constraints is satisfiable.
- `get_counterexample(path_condition) -> dict`: Returns a concrete variable assignment from the Z3 model.

#### 4. Bug Finding and Reporting (10 points)

For each program, your engine should report:
- **Total paths explored** (feasible and infeasible).
- **Assertion violations found:** For each violation, report:
  - The assertion that was violated.
  - The path condition under which it was violated.
  - A concrete input assignment that triggers the violation.
- **Unreachable code:** Program points where no feasible path reaches.

#### 5. Test Suite (5 points)

Provide at least the following test programs:

**(a)** A program where all assertions pass (e.g., absolute value function).

**(b)** A program with an assertion violation and at least 3 paths (e.g., a function with nested conditionals where one branch has a bug).

**(c)** A program with a loop where the bug is reachable only after multiple iterations.

**(d)** A program with an infeasible path (dead code that is never reached for any input).

**(e)** A program that demonstrates path explosion: at least 4 sequential `if` statements producing 16 paths. Report the total number of paths and the number of feasible paths.

For each test, explain the expected output and verify that your engine produces correct results.

### Deliverables

1. **Source code** with clear documentation and instructions for running.
2. **Test programs** (at least 5 as described above).
3. **Report** (2-3 pages) describing:
   - Architecture of your symbolic execution engine.
   - Design decisions (search strategy, loop handling, etc.).
   - Results on each test program.
   - Limitations and potential improvements.

### Grading Rubric (Part B)

| Component | Points | Criteria |
|---|---|---|
| Parser / AST | 10 | Correctly parses or represents programs |
| Core engine | 20 | Correct symbolic execution with forking, feasibility checks, loop unrolling |
| Z3 integration | 5 | Correct use of Z3 for path feasibility and model extraction |
| Bug finding | 10 | Correct detection of assertion violations with counterexamples |
| Test suite | 5 | Comprehensive tests demonstrating all features |

### Bonus: Concolic Execution (up to 10 extra points)

Implement *concolic execution* that alternates between concrete and symbolic runs:

1. Start with random concrete inputs.
2. Execute the program concretely while collecting symbolic constraints.
3. Negate one branch constraint and solve for new inputs using Z3.
4. Repeat, systematically covering new paths.

Compare the number of SMT queries required by pure symbolic execution vs. concolic execution on your test programs.

---

## Submission Guidelines

- **Part A:** Submit as a PDF with clear, typeset solutions. Show all work for traces and derivations. LaTeX is strongly recommended.
- **Part B:** Submit source code as a tarball or zip file, along with the report as a PDF. Include a `README.md` with build/run instructions and a `Makefile` or equivalent.
- **Academic integrity:** You may use Z3 documentation and the course materials. You may NOT use existing symbolic execution frameworks (KLEE, angr, etc.) as your implementation base. You must write the symbolic execution engine yourself.
