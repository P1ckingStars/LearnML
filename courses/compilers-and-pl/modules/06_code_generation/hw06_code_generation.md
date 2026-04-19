# HW6: Code Generation

**Due:** Two weeks from assignment date
**Total Points:** 100 (Part A: 40, Part B: 60)

---

## Part A: Theory (40 points)

### Problem 1: Interference Graph Construction (12 points)

Consider the following program fragment (instructions numbered sequentially):

```
1:  a = read()
2:  b = read()
3:  c = a + b
4:  d = a - b
5:  e = c * d
6:  f = read()
7:  g = e + f
8:  h = c + f
9:  print(g)
10: print(h)
```

**(a)** (4 pts) Compute the live variables at each program point (before and after each instruction). Show your work using the backward dataflow equations.

**(b)** (4 pts) Construct the interference graph. List all edges and draw the graph.

**(c)** (4 pts) What is the chromatic number $\chi(G)$ of this interference graph? Prove your answer by exhibiting a $\chi(G)$-coloring and showing that no $(\chi(G)-1)$-coloring exists (e.g., by identifying a clique of size $\chi(G)$).

---

### Problem 2: Graph Coloring Register Allocation (14 points)

Consider the interference graph $G$ with vertices $\{a, b, c, d, e, f\}$ and edges:

$$E = \{(a,b), (a,c), (a,d), (b,c), (b,d), (b,e), (c,d), (c,f), (d,e), (d,f), (e,f)\}$$

**(a)** (3 pts) Draw the graph and compute the degree of each vertex.

**(b)** (5 pts) Apply Chaitin's algorithm with $k = 3$ registers. Show each step of the simplification phase (which node is removed and why, or which node is selected for spilling and why). If a spill is necessary, use the maximum-degree heuristic. Show the select phase and the final assignment.

**(c)** (3 pts) Now apply Briggs' optimistic coloring with $k = 3$. Does optimistic coloring avoid any spills that Chaitin's algorithm would incur? Justify your answer.

**(d)** (3 pts) Prove or disprove: if the interference graph is a *planar* graph, then it can always be 4-colored (i.e., 4 registers always suffice). What does the Four Color Theorem tell us about register allocation for planar interference graphs? Is this practically useful?

---

### Problem 3: Instruction Selection (14 points)

Consider a target machine with the following instruction patterns and costs:

| ID | Pattern | Assembly | Cost |
|----|---------|----------|------|
| R1 | `REG` | (register operand) | 0 |
| R2 | `CONST` | `li rd, imm` | 1 |
| R3 | `ADD(r, r)` | `add rd, rs1, rs2` | 1 |
| R4 | `ADD(r, CONST)` | `addi rd, rs, imm` | 1 |
| R5 | `MUL(r, r)` | `mul rd, rs1, rs2` | 4 |
| R6 | `SHL(r, CONST)` | `slli rd, rs, imm` | 1 |
| R7 | `MEM(r)` | `lw rd, 0(rs)` | 2 |
| R8 | `MEM(ADD(r, CONST))` | `lw rd, imm(rs)` | 2 |
| R9 | `MEM(ADD(r, r))` | `add tmp, rs1, rs2; lw rd, 0(tmp)` | 3 |
| R10 | `MEM(ADD(r, SHL(r, CONST)))` | `slli tmp, rs, imm; add tmp, tmp, rs2; lw rd, 0(tmp)` | 3 |

**(a)** (5 pts) For the IR expression tree `MEM(ADD(base, MUL(idx, 4)))`, apply the maximal munch algorithm. Show which patterns match at each step and the final instruction sequence. What is the total cost?

**(b)** (5 pts) For the same expression tree, apply the DP (bottom-up) algorithm. At each node, show the cost of each matching pattern and the chosen minimum. What is the optimal total cost? Is maximal munch optimal here?

**(c)** (4 pts) Note that $\text{MUL}(x, 4) = \text{SHL}(x, 2)$. If the compiler rewrites `MUL(idx, 4)` to `SHL(idx, 2)` before instruction selection, redo parts (a) and (b) on the transformed tree `MEM(ADD(base, SHL(idx, 2)))`. Compare the costs.

---

## Part B: Implementation (60 points)

### Overview

Implement a code generator that translates a simple three-address IR to x86-64 assembly (AT&T syntax), including a register allocator. Your code generator should produce assembly that can be assembled with `gcc` or `as` and linked into a working executable.

### IR Specification

The input IR has the following instruction types:

```
FUNCTION name(params...)
  t = a OP b         ; OP in {+, -, *, /}
  t = a               ; copy
  t = CONST           ; load immediate
  t = MEM[a]          ; load from memory address a
  MEM[a] = b          ; store b to memory address a
  IF a CMP b GOTO L   ; CMP in {==, !=, <, >, <=, >=}
  GOTO L               ; unconditional jump
  LABEL L              ; label definition
  CALL t = f(args...)  ; function call, result in t
  RETURN a             ; return value a
END
```

All values are 64-bit integers. Temporaries are named `t0`, `t1`, etc. Parameters are named `p0`, `p1`, etc. (mapped to ABI registers on entry).

### Task 1: Naive Code Generator (20 points)

Implement a naive code generator that:

1. Maps each IR instruction to one or more x86-64 instructions.
2. Uses a simple register allocation strategy: spill everything (all temporaries live on the stack; load before use, store after definition).
3. Handles the System V AMD64 calling convention for function entry/exit and calls.
4. Produces correct, assembler-compatible output.

**Deliverables:**
- Source code for the naive code generator.
- Test cases: at least 3 IR programs with expected outputs.
- Generated assembly for each test case.

### Task 2: Register Allocator (30 points)

Implement a register allocator using **one** of the following approaches (choose one):

**(Option A) Graph Coloring (Briggs' optimistic coloring):**
1. Perform liveness analysis on the IR.
2. Build the interference graph.
3. Apply Briggs' algorithm with $k$ allocable registers (use $k = 13$ for System V AMD64, excluding `RSP`, `RBP`, and `RAX` as scratch).
4. Insert spill code for spilled variables.
5. Re-run if spills were introduced.

**(Option B) Linear Scan:**
1. Linearize the IR (topological order of basic blocks).
2. Compute live intervals for each variable.
3. Apply the linear scan algorithm with $k = 13$ allocable registers.
4. Insert spill code for evicted variables.

**Requirements:**
- Handle precolored registers for calling conventions (function parameters, return values).
- Handle caller-saved register saving across function calls.
- Produce correct code on all provided test cases.

**Deliverables:**
- Source code for the register allocator.
- A report (1--2 pages) describing your implementation, including:
  - Which algorithm you chose and why.
  - How you handle precolored registers and calling conventions.
  - Any interesting design decisions or challenges encountered.

### Task 3: Integration and Testing (10 points)

1. Integrate your register allocator with the code generator.
2. Test on the following benchmark programs (IR will be provided):
   - Fibonacci (recursive and iterative)
   - Matrix multiplication (nested loops)
   - Quicksort (recursive with function calls)
3. For each benchmark, report:
   - Number of spills.
   - Total number of generated instructions.
   - Correctness verification (compare output with reference).

### Grading Criteria

| Component | Points | Criteria |
|-----------|--------|----------|
| Naive code gen | 20 | Correctness on test suite; proper ABI adherence |
| Register allocator | 30 | Correct liveness analysis (8), correct interference graph or live intervals (7), correct allocation (10), spill code (5) |
| Integration & testing | 10 | All benchmarks pass; clear report |

### Submission

Submit a tarball or zip containing:
1. All source code (with build instructions or Makefile).
2. Test IR programs and expected outputs.
3. Generated assembly for all test cases.
4. The implementation report.

### Hints

- Start with the naive code generator and verify correctness thoroughly before adding the register allocator.
- For the graph coloring approach, implement the simplify-select loop first without coalescing. Add coalescing as an optional enhancement.
- Use `gcc -no-pie -o test test.s` to assemble and link your output.
- The `printf` function can be used for output; declare it as `extern printf` in your assembly.
- Test with small programs first (2--3 instructions) and build up to the benchmarks.

---

## Academic Integrity

This is an individual assignment. You may discuss high-level approaches with classmates, but all code must be your own. Cite any external references used.
