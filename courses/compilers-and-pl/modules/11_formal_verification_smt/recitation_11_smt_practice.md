# Recitation 11: SMT Solvers in Practice

## Overview

This recitation provides hands-on experience with SMT solvers, focusing on Z3 and its Python bindings. We will encode combinatorial problems as SAT, verify compiler optimizations using bitvector theory, build a tiny symbolic executor, and verify a small compiler pass.

**Prerequisites:** Install Z3 Python bindings: `pip install z3-solver`

---

## Part 1: Z3 Tutorial -- Python Bindings

### 1.1 Basic Usage

```python
from z3 import *

# Declare integer variables
x = Int('x')
y = Int('y')

# Create a solver
s = Solver()

# Add constraints
s.add(x + y == 10)
s.add(x - y == 4)

# Check satisfiability
result = s.check()
print(result)  # sat

# Extract model
if result == sat:
    m = s.model()
    print(f"x = {m[x]}, y = {m[y]}")  # x = 7, y = 3
```

### 1.2 Declaring Sorts and Functions

```python
# Uninterpreted sort
S = DeclareSort('S')

# Uninterpreted function
f = Function('f', IntSort(), IntSort())
g = Function('g', IntSort(), IntSort(), IntSort())

# Declare constants of uninterpreted sort
a = Const('a', S)
b = Const('b', S)

# Bitvectors (32-bit)
bv_x = BitVec('bv_x', 32)
bv_y = BitVec('bv_y', 32)

# Arrays
A = Array('A', IntSort(), IntSort())

# Reals
r = Real('r')
```

### 1.3 Encoding Constraints

```python
# Boolean combinations
s = Solver()
p = Bool('p')
q = Bool('q')
s.add(Or(p, q))
s.add(Not(And(p, q)))
# Satisfiable: exactly one of p, q is true

# Quantifiers
x = Int('x')
# For all x, f(x) >= 0
f = Function('f', IntSort(), IntSort())
s.add(ForAll([x], f(x) >= 0))

# Exists x such that f(x) == 5
s.add(Exists([x], f(x) == 5))
```

### 1.4 Checking Satisfiability and Extracting Models

```python
s = Solver()
x = Int('x')
y = Int('y')

s.add(x > 0, y > 0, x + y < 5, x * y > 3)
if s.check() == sat:
    m = s.model()
    print(m)  # e.g., [x = 2, y = 2]
    # Evaluate expressions in the model
    print(m.evaluate(x + y))  # 4
    print(m.evaluate(x * y))  # 4
else:
    print("UNSAT")
```

### 1.5 Unsat Cores

```python
s = Solver()
x = Int('x')

# Track assumptions with labels
p1 = Bool('p1')
p2 = Bool('p2')
p3 = Bool('p3')

s.add(Implies(p1, x > 5))
s.add(Implies(p2, x < 3))
s.add(Implies(p3, x > 0))

# Check with assumptions
result = s.check(p1, p2, p3)
if result == unsat:
    core = s.unsat_core()
    print(f"Unsat core: {core}")  # [p1, p2]
    # p1 and p2 are contradictory (x > 5 and x < 3)
```

### 1.6 Proving Validity

To prove $\varphi$ is valid, check that $\neg\varphi$ is UNSAT:

```python
def prove(formula):
    s = Solver()
    s.add(Not(formula))
    result = s.check()
    if result == unsat:
        print("PROVED (valid)")
    elif result == sat:
        print(f"COUNTEREXAMPLE: {s.model()}")
    else:
        print("UNKNOWN")

x = Int('x')
prove(Implies(x > 3, x > 1))  # PROVED
prove(Implies(x > 3, x > 5))  # COUNTEREXAMPLE: x = 4
```

---

## Part 2: Exercise 1 -- Graph Coloring as SAT

### Problem Statement

Encode the graph 3-coloring problem and solve it using Z3.

Given graph $G = (V, E)$ with $V = \{0, 1, 2, 3, 4\}$ and edges:
$E = \{(0,1), (0,2), (1,2), (1,3), (2,3), (3,4), (0,4)\}$

Determine if $G$ is 3-colorable. If so, find a valid coloring.

### Solution Skeleton

```python
from z3 import *

def graph_coloring(num_vertices, edges, num_colors):
    """Encode and solve graph coloring as SAT."""
    s = Solver()

    # Variables: color[v][c] means vertex v has color c
    color = [[Bool(f'color_{v}_{c}') for c in range(num_colors)]
             for v in range(num_vertices)]

    # Constraint 1: Each vertex has at least one color
    for v in range(num_vertices):
        s.add(Or(color[v]))

    # Constraint 2: Each vertex has at most one color (pairwise exclusion)
    for v in range(num_vertices):
        for c1 in range(num_colors):
            for c2 in range(c1 + 1, num_colors):
                s.add(Not(And(color[v][c1], color[v][c2])))

    # Constraint 3: Adjacent vertices have different colors
    for (u, v) in edges:
        for c in range(num_colors):
            s.add(Not(And(color[u][c], color[v][c])))

    # Solve
    if s.check() == sat:
        m = s.model()
        coloring = {}
        for v in range(num_vertices):
            for c in range(num_colors):
                if is_true(m[color[v][c]]):
                    coloring[v] = c
        return coloring
    else:
        return None

# Test
edges = [(0,1), (0,2), (1,2), (1,3), (2,3), (3,4), (0,4)]
result = graph_coloring(5, edges, 3)
if result:
    print(f"3-coloring found: {result}")
else:
    print("Not 3-colorable")
```

### Extension Tasks

1. **Modify the encoding to use integer variables** instead of Boolean (one integer per vertex in range $[0, k)$). Compare the solving time.

2. **Find the chromatic number:** Binary search on $k$ to find the minimum number of colors.

3. **Symmetry breaking:** Add constraints that vertex 0 gets color 0, vertex 1 gets color 0 or 1 (if adjacent to vertex 0, then color 1). Measure the effect on solving time.

---

## Part 3: Exercise 2 -- Verifying a Peephole Optimization

### Problem Statement

Verify that the peephole optimization $x \times 2 \equiv x \ll 1$ is correct for all 32-bit bitvectors.

### Solution

```python
from z3 import *

def verify_mul2_shift():
    """Verify: x * 2 == x << 1 for all 32-bit bitvectors."""
    x = BitVec('x', 32)

    # Source expression
    source = x * 2

    # Target expression
    target = x << 1

    # Prove equivalence: check that NOT(source == target) is UNSAT
    s = Solver()
    s.add(source != target)

    result = s.check()
    if result == unsat:
        print("VERIFIED: x * 2 == x << 1 for all 32-bit values")
    else:
        m = s.model()
        print(f"COUNTEREXAMPLE: x = {m[x]}")

verify_mul2_shift()
```

### More Optimizations to Verify

Verify or disprove each of the following:

```python
from z3 import *

def verify_optimization(name, width, source_expr, target_expr):
    """Generic verification of bitvector optimizations."""
    s = Solver()
    s.add(source_expr != target_expr)
    result = s.check()
    if result == unsat:
        print(f"VERIFIED: {name}")
    else:
        m = s.model()
        print(f"COUNTEREXAMPLE for {name}: {m}")

x = BitVec('x', 32)
y = BitVec('y', 32)

# 1. x * 8 == x << 3
verify_optimization("x * 8 == x << 3", 32, x * 8, x << 3)

# 2. x / 2 == x >> 1 (CAREFUL: signed vs unsigned!)
verify_optimization("x / 2 == x >> 1 (signed)", 32, x / 2, x >> 1)

# 3. x / 2 == LShR(x, 1) (unsigned division, logical shift)
verify_optimization("UDiv(x,2) == LShR(x,1)", 32, UDiv(x, 2), LShR(x, 1))

# 4. (x + y) - y == x
verify_optimization("(x + y) - y == x", 32, (x + y) - y, x)

# 5. x & (x - 1) == 0 iff x is a power of 2
# This is NOT an equivalence for all x; verify the implication:
# If x > 0 and x & (x-1) == 0, then x is a power of 2
# Encoding: x > 0 and x & (x-1) == 0 implies exactly one bit set
s = Solver()
s.add(UGT(x, 0))
s.add(x & (x - 1) == 0)
# Check: does x have exactly one bit set?
# x has exactly one bit set iff x & (x-1) == 0 and x != 0
# So this is trivially true by construction. Instead verify:
# x & (x-1) == 0 and x > 0 implies there exists k such that x == 1 << k
# We check: is there a value with x > 0, x & (x-1) == 0, and x is NOT 2^k for any k?
not_power = And([x != (1 << k) for k in range(32)])
s.add(not_power)
result = s.check()
if result == unsat:
    print("VERIFIED: x > 0 and x & (x-1) == 0 implies x is a power of 2")
else:
    print(f"COUNTEREXAMPLE: x = {s.model()[x]}")
```

### Discussion Questions

1. Why does signed division $x / 2$ differ from arithmetic right shift $x \gg 1$? For what values of $x$ do they differ? (Hint: consider negative odd numbers.)

2. What is the role of `poison` and `undef` values in LLVM's semantics, and how does Alive2 handle them in verification?

---

## Part 4: Exercise 3 -- A Tiny Symbolic Executor

### Problem Statement

Implement a symbolic execution engine for a simple imperative language:

**Grammar:**
```
program  ::= stmt*
stmt     ::= var ':=' expr
           | 'if' expr 'then' stmt* 'else' stmt* 'end'
           | 'assert' expr
           | 'print' expr
expr     ::= integer | var | expr '+' expr | expr '-' expr
           | expr '*' expr | expr '<' expr | expr '==' expr
           | expr '&&' expr | expr '||' expr | '!' expr
var      ::= identifier
```

### Solution

```python
from z3 import *

class SymbolicState:
    """Represents a symbolic execution state."""
    def __init__(self, store=None, path_condition=None):
        self.store = store if store is not None else {}
        self.path_condition = path_condition if path_condition is not None else []
        self.assertions_violated = []

    def copy(self):
        s = SymbolicState(
            store=dict(self.store),
            path_condition=list(self.path_condition)
        )
        return s

    def is_feasible(self):
        """Check if the current path condition is satisfiable."""
        s = Solver()
        s.add(*self.path_condition)
        return s.check() == sat

    def get_model(self):
        """Get a concrete model satisfying the path condition."""
        s = Solver()
        s.add(*self.path_condition)
        if s.check() == sat:
            return s.model()
        return None


class SymbolicExecutor:
    """A tiny symbolic execution engine."""

    def __init__(self):
        self.symbolic_vars = {}
        self.results = []

    def fresh_symbolic(self, name):
        """Create a fresh symbolic integer variable."""
        if name not in self.symbolic_vars:
            self.symbolic_vars[name] = Int(name)
        return self.symbolic_vars[name]

    def eval_expr(self, expr, state):
        """Evaluate an expression in the given symbolic state."""
        if isinstance(expr, int):
            return IntVal(expr)
        elif isinstance(expr, str):
            # Variable lookup
            if expr in state.store:
                return state.store[expr]
            else:
                # Create a fresh symbolic input
                sym = self.fresh_symbolic(expr)
                state.store[expr] = sym
                return sym
        elif isinstance(expr, tuple):
            op = expr[0]
            if op == '+':
                return self.eval_expr(expr[1], state) + self.eval_expr(expr[2], state)
            elif op == '-':
                return self.eval_expr(expr[1], state) - self.eval_expr(expr[2], state)
            elif op == '*':
                return self.eval_expr(expr[1], state) * self.eval_expr(expr[2], state)
            elif op == '<':
                return self.eval_expr(expr[1], state) < self.eval_expr(expr[2], state)
            elif op == '==':
                return self.eval_expr(expr[1], state) == self.eval_expr(expr[2], state)
            elif op == '!':
                return Not(self.eval_expr(expr[1], state))
            elif op == '&&':
                return And(self.eval_expr(expr[1], state),
                           self.eval_expr(expr[2], state))
            elif op == '||':
                return Or(self.eval_expr(expr[1], state),
                          self.eval_expr(expr[2], state))
        raise ValueError(f"Unknown expression: {expr}")

    def execute(self, stmts, state):
        """Symbolically execute a list of statements.
        Returns a list of final states (one per feasible path).
        """
        if not stmts:
            return [state]

        stmt = stmts[0]
        rest = stmts[1:]

        if stmt[0] == 'assign':
            # ('assign', var_name, expr)
            var_name = stmt[1]
            value = self.eval_expr(stmt[2], state)
            state.store[var_name] = value
            return self.execute(rest, state)

        elif stmt[0] == 'if':
            # ('if', condition_expr, then_stmts, else_stmts)
            cond = self.eval_expr(stmt[1], state)

            final_states = []

            # Then branch
            then_state = state.copy()
            then_state.path_condition.append(cond)
            if then_state.is_feasible():
                after_then = self.execute(stmt[2], then_state)
                for s in after_then:
                    final_states.extend(self.execute(rest, s))

            # Else branch
            else_state = state.copy()
            else_state.path_condition.append(Not(cond))
            if else_state.is_feasible():
                after_else = self.execute(stmt[3], else_state)
                for s in after_else:
                    final_states.extend(self.execute(rest, s))

            return final_states

        elif stmt[0] == 'assert':
            # ('assert', condition_expr)
            cond = self.eval_expr(stmt[1], state)

            # Check if assertion can be violated
            violation_state = state.copy()
            violation_state.path_condition.append(Not(cond))
            if violation_state.is_feasible():
                model = violation_state.get_model()
                self.results.append({
                    'type': 'assertion_violation',
                    'assertion': stmt[1],
                    'model': model,
                    'path_condition': violation_state.path_condition
                })

            # Continue on the path where assertion holds
            state.path_condition.append(cond)
            if state.is_feasible():
                return self.execute(rest, state)
            else:
                return []

        elif stmt[0] == 'print':
            # ('print', expr)
            value = self.eval_expr(stmt[1], state)
            # Record the symbolic value
            self.results.append({
                'type': 'print',
                'value': value,
                'path_condition': list(state.path_condition)
            })
            return self.execute(rest, state)

        else:
            raise ValueError(f"Unknown statement: {stmt[0]}")


# --- Example usage ---

def example_abs():
    """Symbolically execute an absolute value function."""
    print("=== Example: Absolute Value ===")

    # Program:
    #   if x < 0 then y := 0 - x else y := x end
    #   assert y >= 0
    program = [
        ('if', ('<', 'x', 0),
            [('assign', 'y', ('-', 0, 'x'))],
            [('assign', 'y', 'x')]
        ),
        ('assert', ('!', ('<', 'y', 0)))
    ]

    executor = SymbolicExecutor()
    initial_state = SymbolicState()
    final_states = executor.execute(program, initial_state)

    print(f"Number of paths explored: {len(final_states)}")
    for i, s in enumerate(final_states):
        model = s.get_model()
        print(f"  Path {i}: model = {model}, y = {model.evaluate(s.store['y'])}")

    if not executor.results:
        print("No assertion violations found!")
    for r in executor.results:
        if r['type'] == 'assertion_violation':
            print(f"ASSERTION VIOLATION: {r['model']}")


def example_bug():
    """Find inputs that trigger a bug."""
    print("\n=== Example: Finding a Bug ===")

    # Program:
    #   z := x * x - y * y
    #   if z == 0 then
    #       assert x == y   # BUG: x could equal -y
    #   end
    program = [
        ('assign', 'z', ('-', ('*', 'x', 'x'), ('*', 'y', 'y'))),
        ('if', ('==', 'z', 0),
            [('assert', ('==', 'x', 'y'))],
            []
        )
    ]

    executor = SymbolicExecutor()
    initial_state = SymbolicState()
    final_states = executor.execute(program, initial_state)

    print(f"Number of paths explored: {len(final_states)}")
    for r in executor.results:
        if r['type'] == 'assertion_violation':
            print(f"ASSERTION VIOLATION found!")
            print(f"  Counterexample: {r['model']}")


if __name__ == '__main__':
    example_abs()
    example_bug()
```

### Tasks

1. **Run the examples** and verify the output. The `abs` example should report no violations. The bug example should find a counterexample (e.g., $x = 1, y = -1$).

2. **Add while-loop support** with bounded unrolling:
```python
# ('while', condition, body, max_iterations)
# Unroll the while loop up to max_iterations times
```

3. **Add a `reach` command** that checks whether a specific program point is reachable:
```python
# ('reach', label)
# Report: "label is reachable" with a satisfying model, or "unreachable"
```

4. **Track path coverage:** Report the total number of paths, how many are feasible, and what fraction of branches are covered.

---

## Part 5: Exercise 4 -- Verifying a Compiler Optimization Pass

### Problem Statement

Verify that the following optimization is correct: replacing `x - x` with `0` in a simple expression language.

### Solution

```python
from z3 import *

def verify_sub_self_elimination():
    """
    Verify that x - x == 0 for all integers.
    This is trivial for mathematical integers but let us also check bitvectors.
    """
    # Mathematical integers
    x_int = Int('x')
    prove_valid("x - x == 0 (integers)", x_int - x_int == 0)

    # 32-bit bitvectors
    x_bv = BitVec('x', 32)
    prove_valid("x - x == 0 (bitvectors)", x_bv - x_bv == 0)

    # IEEE 754 floating-point (32-bit)
    x_fp = FP('x', Float32())
    prove_valid("x - x == 0.0 (float32)", fpEQ(fpSub(RNE(), x_fp, x_fp), FPVal(0.0, Float32())))
    # NOTE: This will FAIL for NaN! fpSub(NaN, NaN) = NaN, and NaN != 0.0

def prove_valid(name, formula):
    s = Solver()
    s.add(Not(formula))
    result = s.check()
    if result == unsat:
        print(f"VERIFIED: {name}")
    elif result == sat:
        m = s.model()
        print(f"COUNTEREXAMPLE for {name}: {m}")
    else:
        print(f"UNKNOWN: {name}")


def verify_strength_reduction():
    """
    Verify strength reduction: x * C --> (x << k) + (x << j) + ...
    Example: x * 5 == (x << 2) + x
    """
    x = BitVec('x', 32)

    # x * 5 == (x << 2) + x
    source = x * 5
    target = (x << 2) + x
    prove_valid("x * 5 == (x << 2) + x", source == target)

    # x * 7 == (x << 3) - x
    source = x * 7
    target = (x << 3) - x
    prove_valid("x * 7 == (x << 3) - x", source == target)

    # x * 15 == (x << 4) - x
    source = x * 15
    target = (x << 4) - x
    prove_valid("x * 15 == (x << 4) - x", source == target)


def verify_conditional_optimization():
    """
    Verify: (x > 0) ? x : -x   ==   abs(x)
    More precisely, verify they produce the same result for all bitvector values.

    CAREFUL: This is NOT true for INT_MIN in two's complement!
    """
    x = BitVec('x', 32)

    # Source: if x > 0 then x else -x
    # Using signed comparison
    source = If(x > 0, x, -x)

    # Target: should be non-negative for all x
    # Check: is source always >= 0 (signed)?
    s = Solver()
    s.add(source < 0)  # signed less than
    result = s.check()
    if result == sat:
        m = s.model()
        val = m[x].as_signed_long()
        print(f"abs(x) can be negative! x = {val} (0x{m[x]})")
        print(f"  This is because -INT_MIN overflows in two's complement")
    else:
        print("abs(x) is always non-negative")


if __name__ == '__main__':
    print("=== Sub-self elimination ===")
    verify_sub_self_elimination()

    print("\n=== Strength reduction ===")
    verify_strength_reduction()

    print("\n=== Conditional abs ===")
    verify_conditional_optimization()
```

### Discussion

1. **Floating-point subtlety:** $x - x = 0$ fails for floating-point when $x$ is NaN, because NaN $-$ NaN $=$ NaN $\ne 0$. This is why compilers must be careful with floating-point optimizations (and why `-ffast-math` can introduce bugs).

2. **Two's complement overflow:** $-\text{INT\_MIN}$ overflows in two's complement, producing INT_MIN (a negative number). Therefore `abs(INT_MIN)` is negative. This is a real bug pattern.

3. **The Alive2 approach:** Alive2 encodes LLVM's full semantics including `undef`, `poison`, and UB. An optimization is valid only if:
   - If the source is defined, the target is defined.
   - If both are defined, they produce the same value.
   - The target does not introduce new UB.

---

## Summary

| Exercise | Technique | Theory | Tool |
|---|---|---|---|
| Graph coloring | SAT encoding | Propositional logic | Z3 (Boolean) |
| Peephole verification | Bitvector equivalence | QF_BV | Z3 (BitVec) |
| Symbolic executor | Path exploration | SMT (QF_LIA) | Z3 (Int) |
| Optimization verification | Translation validation | QF_BV, QF_FP | Z3 (BitVec, FP) |

These exercises demonstrate the practical power of SMT solvers in compiler and programming language contexts. The same techniques scale to industrial tools like Alive2 (verifying LLVM), CBMC (bounded model checking), and KLEE (symbolic execution).
