# Recitation 09: Multi-Paradigm Programming

## Overview

This recitation provides hands-on exercises in four programming paradigms: functional (monads), concurrent (actors), logic (Prolog), and DSL design. Students should attempt each exercise and be prepared to discuss design trade-offs.

---

## Exercise 1: Implementing Monads from Scratch

### 1.1 The Maybe Monad

Implement the `Maybe` monad in your language of choice (Haskell, OCaml, Python, or Rust).

**Task A.** Define the type, `return`, and `bind`:

```
type Maybe a = Nothing | Just a

return :: a -> Maybe a
return x = Just x

(>>=) :: Maybe a -> (a -> Maybe b) -> Maybe b
Nothing >>= _ = Nothing
(Just x) >>= f = f x
```

**Task B.** Verify the three monad laws for your implementation. Write each law as an equation and show that both sides reduce to the same expression.

- Left identity: `return a >>= f  ==  f a`
- Right identity: `m >>= return  ==  m`
- Associativity: `(m >>= f) >>= g  ==  m >>= (\x -> f x >>= g)`

### 1.2 The State Monad

**Task C.** Implement the `State s a` monad:

```
newtype State s a = State { runState :: s -> (a, s) }
```

Implement `return`, `>>=`, `get`, `put`, and `modify`.

**Task D.** Use your State monad to implement a simple stack calculator that evaluates reverse Polish notation expressions. For example, `[Push 3, Push 4, Add, Push 2, Mul]` should produce `14`.

### 1.3 Monad Transformer

**Task E.** Implement `StateT s Maybe a` -- a state monad that can also fail. Show that `lift` correctly embeds `Maybe` computations into the combined monad.

---

## Exercise 2: Actor-Based Concurrent Programming

### 2.1 A Simple Actor Framework

Using Erlang, Elixir, Akka (Scala), or a library in your preferred language, implement a basic actor system.

**Task A.** Implement a `Counter` actor that:
- Accepts `Increment(n)` messages (adds `n` to its count).
- Accepts `GetCount(replyTo)` messages (sends the current count to the `replyTo` actor).
- Accepts `Reset` messages (sets the count to zero).

```
actor Counter:
    state: count = 0

    on Increment(n):
        count = count + n

    on GetCount(replyTo):
        send replyTo CurrentCount(count)

    on Reset:
        count = 0
```

**Task B.** Implement a `Supervisor` actor that:
- Spawns $n$ `Counter` actors.
- Distributes incoming increment messages round-robin.
- On a `TotalCount(replyTo)` message, queries all counters and sums their counts.

**Task C.** Discuss: What happens if a `Counter` actor crashes mid-computation? How does the supervisor pattern (Erlang/OTP style "let it crash") handle this? What guarantees does it provide?

### 2.2 Dining Philosophers

**Task D.** Implement the dining philosophers problem using actors (one actor per philosopher, one actor per fork). Ensure your solution is deadlock-free. Describe which strategy you used (e.g., resource ordering, a waiter actor).

---

## Exercise 3: Building a Small Prolog Interpreter

### 3.1 Core Implementation

Implement a minimal Prolog interpreter that supports:
1. Facts and rules (Horn clauses).
2. Unification with the occurs check.
3. SLD resolution with backtracking (depth-first, leftmost selection).

**Data structures:**

```
type Term = Var(String)
           | Atom(String)
           | Compound(String, List[Term])

type Clause = Clause(head: Term, body: List[Term])

type Substitution = Map[String, Term]
```

**Task A.** Implement `unify(t1: Term, t2: Term, subst: Substitution) -> Option[Substitution]`.

Test cases:
- `unify(Var("X"), Atom("a"), {})` should return `{X -> Atom("a")}`.
- `unify(Compound("f", [Var("X"), Atom("b")]), Compound("f", [Atom("a"), Var("Y")]), {})` should return `{X -> Atom("a"), Y -> Atom("b")}`.
- `unify(Var("X"), Compound("f", [Var("X")]), {})` should fail (occurs check).

**Task B.** Implement `solve(goals: List[Term], program: List[Clause]) -> Iterator[Substitution]` using SLD resolution with backtracking. The function should yield all solutions.

### 3.2 Test Programs

**Task C.** Run the following Prolog programs through your interpreter:

```prolog
% Family relationships
parent(tom, bob).
parent(tom, liz).
parent(bob, ann).
parent(bob, pat).

grandparent(X, Z) :- parent(X, Y), parent(Y, Z).

% Query: grandparent(tom, Who)?
% Expected: Who = ann ; Who = pat
```

```prolog
% List operations
append([], L, L).
append([H|T], L, [H|R]) :- append(T, L, R).

% Query: append([1,2], [3,4], Result)?
% Expected: Result = [1,2,3,4]

% Query: append(X, Y, [1,2,3])?
% Expected: X=[], Y=[1,2,3] ; X=[1], Y=[2,3] ; X=[1,2], Y=[3] ; X=[1,2,3], Y=[]
```

**Task D.** Measure the performance of your interpreter on the `append` example with lists of increasing size. Where is the bottleneck? How could you optimize it?

---

## Exercise 4: Designing a DSL

### 4.1 Choose a Domain

Select one of the following domains (or propose your own):
- (a) Regular expressions with named captures.
- (b) State machines for protocol specification.
- (c) Database queries (a subset of SQL).
- (d) Configuration for build systems.

### 4.2 Embedded DSL

**Task A.** Design an embedded DSL in your host language. Define:
- The abstract syntax (as algebraic data types or classes).
- A "smart constructor" API that provides a user-friendly surface syntax.
- At least two interpreters/backends (e.g., pretty-printer and evaluator, or code generator targeting two different formats).

**Example (state machine DSL in Haskell-like pseudocode):**

```
stateMachine "trafficLight" $ do
    initial "red"
    state "red" $ do
        on "timer" --> "green"
    state "green" $ do
        on "timer" --> "yellow"
    state "yellow" $ do
        on "timer" --> "red"
```

**Task B.** Implement a validation pass that checks:
- All referenced states are defined.
- There are no unreachable states (from the initial state).
- The initial state is defined.

### 4.3 Discussion Questions

1. What are the trade-offs between your embedded DSL and a standalone DSL for the same domain?
2. How would you add error reporting that refers to domain concepts rather than host-language concepts?
3. Could your DSL benefit from staged compilation (generating optimized code at compile time)? How?

---

## Discussion Topics

1. **Paradigm comparison**: For a concurrent web scraper, compare an implementation using (a) threads + locks, (b) actors, (c) async/await, (d) CSP-style channels. Which is easiest to reason about? Which performs best?

2. **Monads vs. effect handlers**: Monad transformers require choosing a fixed stack order (e.g., `StateT s (ExceptT e IO)`). How do algebraic effect handlers (Module 10) address this limitation?

3. **Logic programming in practice**: Why has Datalog seen a resurgence in program analysis (Souffl\'e, Doop) while general Prolog has not? What properties of Datalog make it amenable to efficient implementation?

---

## Deliverables

- Source code for Exercises 1--4 (or a selected subset as directed by the instructor).
- A brief write-up (1--2 pages) discussing the trade-offs encountered in Exercise 4 (DSL design).
- Be prepared to present your Prolog interpreter (Exercise 3) in class.
