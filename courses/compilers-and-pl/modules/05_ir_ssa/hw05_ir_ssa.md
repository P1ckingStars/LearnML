# Homework 05: IR & SSA

**Due:** End of Week 10
**Total Points:** 100 (Part A: 40, Part B: 60)

---

## Part A: Theory (40 points)

### Problem 1: Dominance (12 points)

Consider the following control flow graph:

```
        ENTRY
          |
          v
    +---> B0
    |     / \
    |    v   v
    |   B1   B2
    |   |     |
    |   v     v
    |   B3   B4
    |    \   /
    |     v v
    +---- B5
          |
          v
         B6
          |
          v
        EXIT
```

Edges: ENTRY->B0, B0->B1, B0->B2, B1->B3, B2->B4, B3->B5, B4->B5, B5->B0 (back edge), B5->B6, B6->EXIT.

**(a)** (3 points) Compute the dominator tree. For each node, list its immediate dominator.

**(b)** (3 points) Compute the dominance frontier for each node.

**(c)** (3 points) Identify all back edges and natural loops. What is the loop header? What are the loop body nodes?

**(d)** (3 points) Prove that B0 dominates B5.

Hint: Consider all possible paths from ENTRY to B5 and show that each passes through B0.

---

### Problem 2: SSA Construction (16 points)

Given the following three-address code:

```
B0: a = input()
    b = input()
    c = 0
    goto B1

B1: if a > b goto B2 else B3

B2: c = a - b
    a = a - 1
    goto B4

B3: c = b - a
    b = b - 1
    goto B4

B4: d = c + 1
    if d > 10 goto B5 else B1

B5: return d
```

**(a)** (4 points) Construct the CFG and compute the dominator tree.

**(b)** (4 points) Compute the dominance frontier for each block.

**(c)** (4 points) Apply the phi-function placement algorithm. For each variable ($a$, $b$, $c$, $d$), determine where phi functions are needed. Show the worklist algorithm trace for at least one variable.

**(d)** (4 points) Perform variable renaming on the result from (c). Write out the complete SSA form.

---

### Problem 3: SSA Properties (12 points)

**(a)** (4 points) Prove that in a well-formed SSA program, every use of a variable is dominated by its (unique) definition.

Hint: Use the invariant maintained by the renaming algorithm from Lecture 05c.

**(b)** (4 points) Consider the following SSA fragment:

```
B1: x1 = 5
    goto B3

B2: x2 = 10
    goto B3

B3: x3 = phi(x1:B1, x2:B2)
    y1 = x3 + 1
```

Apply SCCP to determine the lattice value of each variable. Show the worklist trace.

**(c)** (4 points) Explain why the interference graph of an SSA program is chordal. Give an intuitive argument based on the dominance property of SSA, and explain why this is significant for register allocation.

---

## Part B: Implementation (60 points)

### Overview

Implement a CFG builder and SSA construction algorithm. Given a program in three-address code, your implementation should:

1. Parse the three-address code into basic blocks.
2. Construct the CFG.
3. Compute the dominator tree.
4. Compute dominance frontiers.
5. Place phi functions and rename variables to produce SSA form.

You may implement in Python, OCaml, Haskell, Rust, Java, or C++. Python starter code is provided.

### Input Format

Three-address code in a text format:

```
FUNCTION funcname
BLOCK B0
    a = READ
    b = READ
    c = CONST 0
    GOTO B1
BLOCK B1
    t0 = a > b
    BRANCH t0 B2 B3
BLOCK B2
    c = a - b
    a = a - CONST 1
    GOTO B4
BLOCK B3
    c = b - a
    b = b - CONST 1
    GOTO B4
BLOCK B4
    d = c + CONST 1
    t1 = d > CONST 10
    BRANCH t1 B5 B1
BLOCK B5
    RETURN d
END
```

### Task 1: CFG Construction (15 points)

**(a)** (5 pts) Parse the input into basic blocks. Each block stores its label, list of instructions, and successor/predecessor lists.

**(b)** (5 pts) Build the CFG. Add ENTRY and EXIT nodes. Compute predecessor and successor lists for each block.

**(c)** (5 pts) Implement a DOT graph output for visualization:

```python
def to_dot(cfg) -> str:
    # Output DOT format for graphviz rendering
```

**Test:** The provided test cases should produce correct CFGs. Verify visually with graphviz.

### Task 2: Dominator Tree (15 points)

Implement dominator tree computation using either:
- The iterative algorithm (Cooper, Harvey, Kennedy), or
- The Lengauer-Tarjan algorithm.

```python
def compute_dominators(cfg) -> dict:
    """Returns mapping from node -> immediate dominator."""

def compute_dominance_frontiers(cfg, idom) -> dict:
    """Returns mapping from node -> set of nodes in dominance frontier."""
```

**(a)** (8 pts) Correct dominator tree computation. Verify on the provided test cases.

**(b)** (7 pts) Correct dominance frontier computation. Verify by comparing with hand-computed results from Part A.

### Task 3: SSA Construction (30 points)

Implement full SSA construction with phi placement and variable renaming.

**(a)** (10 pts) Phi function placement:

```python
def place_phi_functions(cfg, idom, df) -> None:
    """Insert phi functions at dominance frontiers of definition sites."""
```

For each variable, compute the iterated dominance frontier of its definition sites and insert phi functions.

**(b)** (10 pts) Variable renaming:

```python
def rename_variables(cfg, idom) -> None:
    """Rename variables to SSA form using dominator tree traversal."""
```

Implement the stack-based renaming algorithm from Lecture 05c.

**(c)** (10 pts) Output the SSA form in a readable text format:

```
BLOCK B0:
    a_1 = READ
    b_1 = READ
    c_1 = CONST 0
    GOTO B1
BLOCK B1:
    a_3 = PHI(a_1:B0, a_4:B4)
    b_3 = PHI(b_1:B0, b_4:B4)
    c_3 = PHI(c_1:B0, c_4:B4)
    ...
```

**Test suite:**

1. **Straight-line code** (no phi functions needed).
2. **Diamond pattern** (if-then-else with join): phi functions at the join.
3. **Loop** (while loop): phi functions at the loop header.
4. **Nested loops**: phi functions at both headers.
5. **Multiple variables with different definition sites**.

### Provided Test Cases

```
# Test 1: Diamond
FUNCTION diamond
BLOCK B0
    x = CONST 1
    t = x > CONST 0
    BRANCH t B1 B2
BLOCK B1
    y = x + CONST 1
    GOTO B3
BLOCK B2
    y = x - CONST 1
    GOTO B3
BLOCK B3
    z = y + x
    RETURN z
END

# Expected SSA for B3:
#   y_3 = PHI(y_1:B1, y_2:B2)
#   z_1 = y_3 + x_1
```

```
# Test 2: Loop
FUNCTION loop_sum
BLOCK B0
    s = CONST 0
    i = CONST 0
    n = READ
    GOTO B1
BLOCK B1
    t = i < n
    BRANCH t B2 B3
BLOCK B2
    s = s + i
    i = i + CONST 1
    GOTO B1
BLOCK B3
    RETURN s
END

# Expected: phi functions for s and i at B1
```

---

## Submission Guidelines

1. Submit all source files as a single archive.
2. Include a `Makefile` or build script that compiles and runs the test suite.
3. Include a `README` describing your implementation approach and any design decisions.
4. For Part A, submit a PDF with clearly drawn CFGs, dominator trees, and step-by-step algorithm traces.

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Dominance | 12 | Correct dominator tree, DFs, loop detection |
| A2: SSA construction | 16 | Correct phi placement and renaming |
| A3: SSA properties | 12 | Rigorous proofs; correct SCCP trace |
| B1: CFG construction | 15 | Correct parsing, CFG, DOT output |
| B2: Dominator tree | 15 | Correct idom and DF computation |
| B3: SSA construction | 30 | Correct phi placement, renaming, output |

---

## Bonus (up to 10 extra points)

1. **(3 pts)** Implement pruned SSA (compute liveness and avoid placing dead phi functions).
2. **(3 pts)** Implement SSA destruction (phi elimination with critical edge splitting).
3. **(4 pts)** Implement SCCP on your SSA output: propagate constants and simplify branches. Report which variables are constant and what the simplified CFG looks like.
