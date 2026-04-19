# HW09: Programming Language Paradigms

**Due:** End of Week 18
**Total Points:** 100

---

## Part A: Theory (50 points)

### Problem 1: Monad Law Proofs (15 points)

**(a)** (5 points) The `List` monad is defined as:

$$
\text{return}\;a = [a]
$$

$$
xs \gg\!\!= f = \text{concatMap}\;f\;xs
$$

where $\text{concatMap}\;f\;xs = \text{concat}\;(\text{map}\;f\;xs)$.

Prove that the `List` monad satisfies all three monad laws. State each law, substitute the definitions, and show equality step by step.

**(b)** (5 points) The `Reader r` monad is defined as:

$$
\text{return}\;a = \lambda r.\;a
$$

$$
m \gg\!\!= f = \lambda r.\;f\;(m\;r)\;r
$$

Prove the associativity law: $(m \gg\!\!= f) \gg\!\!= g = m \gg\!\!= (\lambda x.\; f\;x \gg\!\!= g)$.

**(c)** (5 points) Consider a hypothetical "Pair" construction:

$$
\text{return}\;a = (a, a)
$$

$$
(a, b) \gg\!\!= f = \text{let}\;(c, \_) = f\;a;\; (\_, d) = f\;b\;\text{in}\;(c, d)
$$

Show that this does **not** satisfy the left identity law. Provide a specific counterexample with concrete values.

---

### Problem 2: CPS Transformations (15 points)

**(a)** (5 points) Apply the CPS transformation $\mathcal{C}[\![ \cdot ]\!]$ to the following expression:

$$
\text{let}\;f = \lambda x.\;\lambda y.\;x + y\;\text{in}\;f\;3\;4
$$

Show each step of the transformation. Simplify the final result by performing beta reductions where possible.

**(b)** (5 points) CPS-transform the following recursive function:

$$
\text{fact}(n) = \text{if}\;n = 0\;\text{then}\;1\;\text{else}\;n \times \text{fact}(n - 1)
$$

Write the CPS version $\text{fact}_{\text{cps}}(n, k)$ and show that $\text{fact}_{\text{cps}}(3, \lambda x.\;x) = 6$ by tracing the computation.

**(c)** (5 points) Defunctionalize the CPS version of `fact` from part (b). Identify all continuation forms, define a data type for them, and write the `apply_cont` dispatch function. Show that the defunctionalized version computes $\text{fact}(3) = 6$.

---

### Problem 3: Session Type Derivations (10 points)

Consider a simple file transfer protocol between a client and a server:

1. The client sends a filename (a string).
2. The server responds with either:
   - `Found(size)`: the file exists, followed by the file data (a byte sequence), OR
   - `NotFound`: the file does not exist.
3. If `Found`, after receiving the data, the client sends an acknowledgment.
4. The protocol then loops (the client may request another file or end the session).

**(a)** (4 points) Write the session type for the **client** endpoint. Use the notation from the lecture: $!\tau.S$ for send, $?\tau.S$ for receive, $\oplus$ for internal choice, $\mathbin{\&}$ for external choice, $\mu X.S$ for recursion.

**(b)** (3 points) Write the dual session type (the **server** endpoint). Verify that it is the formal dual of the client type by applying the duality rules.

**(c)** (3 points) Extend the protocol so that the client can optionally request a checksum of the file before the actual data transfer. Modify the session types accordingly and verify duality.

---

### Problem 4: Datalog Query Evaluation (10 points)

Consider the following Datalog program:

```
edge(a, b).
edge(b, c).
edge(c, d).
edge(d, b).

path(X, Y) :- edge(X, Y).
path(X, Y) :- edge(X, Z), path(Z, Y).
```

**(a)** (4 points) Compute the least fixpoint using **semi-naive evaluation**. Show the contents of $I$ (accumulated facts) and $\Delta$ (new facts) at each iteration. How many iterations are needed?

**(b)** (3 points) List all ground atoms in $\text{path}$ that are derived. Verify that $\text{path}(a, b)$ and $\text{path}(a, d)$ are in the fixpoint.

**(c)** (3 points) Consider adding the rule:

```
reachable(X) :- path(a, X).
scc(X, Y) :- path(X, Y), path(Y, X).
```

Without recomputing the full fixpoint, use the results from part (b) to determine which atoms are in $\text{reachable}$ and $\text{scc}$. Explain your reasoning.

---

## Part B: Implementation (50 points)

**Choose ONE of the following two projects.**

---

### Option 1: Mini Prolog Interpreter (50 points)

Implement a Prolog interpreter in the language of your choice (Haskell, OCaml, Rust, Python, or Java).

#### Requirements

**(a) Parser (10 points)**

Parse Prolog programs with the following syntax:
- Atoms: lowercase identifiers (e.g., `tom`, `parent`).
- Variables: uppercase identifiers (e.g., `X`, `Who`).
- Compound terms: `functor(arg1, arg2, ...)`.
- Lists: `[H|T]`, `[1, 2, 3]`, `[]`.
- Clauses: `head :- body1, body2, ...` (rules) or `head.` (facts).
- Queries: `?- goal1, goal2, ...`

**(b) Unification (10 points)**

Implement the Martelli-Montanari unification algorithm with the occurs check. Your implementation must handle:
- Variable-variable unification.
- Variable-term unification.
- Compound term decomposition.
- Failure cases (different functors, occurs check violation).

**(c) SLD Resolution (15 points)**

Implement depth-first SLD resolution with backtracking:
- Leftmost goal selection.
- Clauses tried in program order.
- Variable renaming to avoid capture (use a counter for fresh variables).
- Yield all solutions (not just the first).

**(d) Built-in Predicates (5 points)**

Implement at least these built-ins:
- `is/2`: Arithmetic evaluation (e.g., `X is 3 + 4 * 2`).
- `write/1`: Print a term.
- `nl/0`: Print a newline.
- `=/2`: Unification.
- `\=/2`: Negation of unification.

**(e) Test Suite (10 points)**

Provide a test suite demonstrating:
- Family relationship queries (the standard `parent`/`grandparent` example).
- List operations (`append`, `member`, `reverse`).
- Arithmetic (`factorial`, `fibonacci`).
- At least one program that demonstrates backtracking yielding multiple solutions.
- At least one program that demonstrates the occurs check preventing unsound results.

#### Deliverables

- Source code with build instructions.
- A `README` explaining your design decisions (data structures for terms, substitution representation, search strategy).
- Test output showing all test cases passing.

---

### Option 2: Monad Library with IO, State, and Maybe (50 points)

Implement a monad library in Haskell, OCaml, Rust, or Scala that provides composable effectful computations.

#### Requirements

**(a) Core Monad Interface (10 points)**

Define a monad abstraction (type class, trait, or module signature) with `return` (or `pure`) and `bind` (or `>>=`). Implement:
- `Maybe` (optional values, short-circuit on failure).
- `Either e` (error handling with error type `e`).
- `State s` (stateful computation).
- `Reader r` (environment passing).
- `Writer w` (logging, where `w` is a monoid).
- `IO` (if your language does not already have one: simulate with a free monad or continuation monad).

**(b) Monad Transformers (15 points)**

Implement monad transformers for at least three of the above:
- `MaybeT m a`
- `StateT s m a`
- `ReaderT r m a`
- `WriterT w m a`

Each transformer must implement `lift` to embed the inner monad. Verify the transformer laws in your test suite.

**(c) Utility Functions (10 points)**

Implement the following generic monadic utilities:
- `mapM :: Monad m => (a -> m b) -> [a] -> m [b]`
- `sequence :: Monad m => [m a] -> m [a]`
- `filterM :: Monad m => (a -> m Bool) -> [a] -> m [a]`
- `foldM :: Monad m => (b -> a -> m b) -> b -> [a] -> m b`
- `when :: Monad m => Bool -> m () -> m ()`

**(d) Application: A Mini Interpreter (15 points)**

Using your monad library, implement an interpreter for a simple expression language:

```
Expr = Num Int
     | Var String
     | Add Expr Expr
     | Div Expr Expr       -- can fail (division by zero)
     | Let String Expr Expr
     | Trace String Expr   -- log a message
```

The interpreter should use a **stack of monad transformers** combining:
- `ReaderT` for variable environment.
- `WriterT` for trace logging.
- `MaybeT` (or `ExceptT`) for error handling.

Demonstrate that your interpreter correctly:
- Evaluates arithmetic expressions.
- Handles variable binding and lookup.
- Propagates division-by-zero errors.
- Accumulates trace messages.

#### Deliverables

- Source code with build instructions.
- Property-based tests (if possible) or unit tests verifying the monad laws for each implementation.
- Example runs of the mini interpreter showing all features.

---

## Submission Guidelines

- Submit via the course submission system by the due date.
- Late submissions incur a 10% penalty per day, up to 3 days. After 3 days, no credit.
- Collaboration policy: You may discuss approaches with classmates, but all code and proofs must be your own. Cite any external references used.
- Academic integrity: Do not use AI code generation tools for Part B. You may use them for understanding concepts in Part A but must write your own proofs.
