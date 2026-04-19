# Glossary

**Abstract Syntax Tree (AST)**: A tree representation of the syntactic structure of source code, omitting syntactic sugar like parentheses and semicolons.

**Alias Analysis**: A program analysis that determines when two pointers or references may refer to the same memory location.

**Alpha Equivalence**: Two lambda terms are alpha-equivalent if they differ only in the names of bound variables.

**Attribute Grammar**: A formal way to define semantics of a programming language using attributes attached to grammar symbols.

**Basic Block**: A maximal sequence of instructions with no branches except at the end and no branch targets except at the beginning.

**Beta Reduction**: The computational rule of lambda calculus: $(\lambda x. e) \; v \to e[v/x]$.

**Bottom-Up Parsing**: Parsing strategy that builds the parse tree from leaves to root (e.g., LR parsing).

**Calling Convention**: The protocol for how functions receive parameters and return results at the machine level.

**Church-Rosser Theorem**: If a lambda term can be reduced in two different ways, both can be further reduced to a common term (confluence).

**Context-Free Grammar (CFG)**: A grammar where every production has a single nonterminal on the left-hand side.

**Control Flow Graph (CFG)**: A graph representation of a program where nodes are basic blocks and edges represent possible flow of control.

**Curry-Howard Correspondence**: The deep connection between type systems and logic: types correspond to propositions, programs to proofs.

**Dataflow Analysis**: A framework for computing information about the possible states of a program at each program point.

**Dead Code Elimination (DCE)**: An optimization that removes code that does not affect program output.

**Denotational Semantics**: A mathematical approach to semantics that maps programs to mathematical objects (usually functions on domains).

**DFA (Deterministic Finite Automaton)**: A finite automaton where each state has exactly one transition for each input symbol.

**Dominance**: Node $A$ dominates node $B$ in a CFG if every path from the entry to $B$ must pass through $A$.

**Dominance Frontier**: The set of nodes where dominance by a given node ends, used in SSA construction.

**Garbage Collection (GC)**: Automatic memory management that reclaims memory no longer reachable by the program.

**Hindley-Milner**: A type system with parametric polymorphism and complete type inference (Algorithm W).

**Hoare Triple**: $\{P\} \; c \; \{Q\}$ -- if precondition $P$ holds before executing $c$, then postcondition $Q$ holds after.

**Interference Graph**: A graph where nodes are variables and edges connect variables that are live at the same time (used in register allocation).

**Intermediate Representation (IR)**: A data structure used internally by a compiler to represent source code between front-end and back-end.

**Lattice**: A partially ordered set where every pair of elements has a least upper bound (join) and greatest lower bound (meet).

**Lexeme**: The actual character sequence in source code that matches a token pattern.

**Linear Scan**: A register allocation algorithm that processes live intervals in order, achieving linear time complexity.

**Live Variable**: A variable is live at a program point if its current value may be used later before being overwritten.

**LL Parsing**: Top-down parsing that reads input Left-to-right and produces a Leftmost derivation.

**LR Parsing**: Bottom-up parsing that reads input Left-to-right and produces a Rightmost derivation (in reverse).

**Maximal Munch**: A lexing strategy that always matches the longest possible token at each point.

**Monotone Framework**: A dataflow analysis framework where transfer functions are monotone with respect to a lattice ordering.

**NFA (Nondeterministic Finite Automaton)**: A finite automaton that can have multiple transitions for the same input symbol, or epsilon transitions.

**Operational Semantics**: Semantics defined by specifying how programs execute step by step (small-step) or evaluate to values (big-step).

**Phi Function**: A pseudo-instruction in SSA form that selects a value based on which predecessor block was executed.

**Register Allocation**: The process of mapping program variables to a finite set of hardware registers.

**SSA (Static Single Assignment)**: An IR property where every variable is assigned exactly once, with phi functions at control flow join points.

**Subtyping**: A relation where values of one type can be safely used where another type is expected ($\tau <: \sigma$).

**Token**: A categorized unit of source text (e.g., identifier, integer literal, keyword).

**Top-Down Parsing**: Parsing strategy that builds the parse tree from root to leaves (e.g., recursive descent, LL parsing).

**Transfer Function**: In dataflow analysis, a function that models the effect of a basic block on the analysis state.

**Type Inference**: Automatically deducing the types of expressions without explicit type annotations.

**Unification**: An algorithm for finding a substitution that makes two terms syntactically identical.

**Vtable**: A table of function pointers used to implement dynamic dispatch in object-oriented languages.

**Abstract Interpretation**: A theory of sound approximation of program semantics using abstract domains connected to concrete semantics via Galois connections (Cousot & Cousot, 1977).

**Bounded Model Checking (BMC)**: A verification technique that unrolls loops to a bounded depth and encodes the resulting program as a SAT/SMT formula to check for property violations.

**CDCL (Conflict-Driven Clause Learning)**: The dominant SAT solving algorithm that combines DPLL with clause learning from conflicts, non-chronological backjumping, and restart strategies.

**CEGAR**: CounterExample-Guided Abstraction Refinement. A verification loop that starts with a coarse abstraction and iteratively refines it using spurious counterexamples.

**Concolic Execution**: A hybrid technique combining concrete and symbolic execution, where a program is executed concretely while collecting symbolic constraints along the path.

**Congruence Closure**: A decision procedure for the theory of equality and uninterpreted functions (EUF), computing the finest partition of terms consistent with given equalities.

**Decision Procedure**: An algorithm that determines the satisfiability of formulas in a given logical theory (e.g., linear arithmetic, bitvectors, arrays).

**DPLL**: Davis-Putnam-Logemann-Loveland algorithm. A backtracking search algorithm for SAT that uses unit propagation and pure literal elimination.

**DPLL(T)**: The standard framework for SMT solving that combines a DPLL-based SAT solver with theory-specific decision procedures via a well-defined interface.

**Galois Connection**: A pair of monotone functions $(\alpha, \gamma)$ between two lattices satisfying $\alpha(c) \sqsubseteq a \iff c \sqsubseteq \gamma(a)$, forming the foundation of abstract interpretation.

**Implication Graph**: In CDCL, a DAG recording the reasons for each literal assignment, used for conflict analysis and clause learning.

**SAT (Boolean Satisfiability)**: The problem of determining if there exists an assignment of truth values that makes a Boolean formula true. The canonical NP-complete problem.

**SMT (Satisfiability Modulo Theories)**: The problem of determining satisfiability of formulas with respect to background theories such as arithmetic, arrays, or bitvectors.

**Symbolic Execution**: A program analysis technique that executes programs with symbolic inputs, maintaining path conditions as logical formulas.

**Translation Validation**: Verifying that a specific compiler run preserved program semantics, rather than verifying the compiler itself.

**Widening**: An operator used in abstract interpretation to force convergence of ascending chains in infinite-height lattices, trading precision for termination.
