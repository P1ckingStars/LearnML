# Lecture 09d: Logic Programming & Domain-Specific Languages

## Prerequisites

- First-order logic, basic type theory, familiarity with at least one DSL (SQL, regex, etc.).

---

## 1. Logic Programming: Unification and Resolution

### 1.1 Logic Programming Paradigm

In **logic programming**, a program is a set of logical formulas (typically Horn clauses), and computation is performed by **proof search**. The programmer specifies *what* is true; the system determines *how* to derive it.

### 1.2 Horn Clauses

A **Horn clause** is a disjunction of literals with at most one positive literal:

$$
A \leftarrow B_1, B_2, \ldots, B_n
$$

Read: "$A$ is true if $B_1$ and $B_2$ and $\ldots$ and $B_n$ are all true."

- **Fact**: $A \leftarrow$ (no body; $A$ is unconditionally true).
- **Rule**: $A \leftarrow B_1, \ldots, B_n$ ($A$ holds if the body holds).
- **Query (goal)**: $\leftarrow G_1, \ldots, G_m$ (can we derive these?).

### 1.3 Unification (Robinson, 1965)

**Unification** is the process of finding a **substitution** $\theta$ such that two terms become syntactically identical: $\theta(s) = \theta(t)$.

**Definition.** A **substitution** $\theta = \{X_1 \mapsto t_1, \ldots, X_k \mapsto t_k\}$ maps variables to terms. Application extends to compound terms:

$$
\theta(f(s_1, \ldots, s_n)) = f(\theta(s_1), \ldots, \theta(s_n))
$$

**Most general unifier (MGU).** A unifier $\theta$ is a **most general unifier** of $s$ and $t$ if, for every other unifier $\sigma$, there exists a substitution $\rho$ such that $\sigma = \rho \circ \theta$.

### 1.4 Unification Algorithm (Martelli-Montanari, 1982)

```
function Unify(equations):
    // equations: set of pairs (s, t) to unify
    substitution = {}
    while equations is not empty:
        pick (s, t) from equations

        if s == t:
            continue  // trivial

        if s is a variable X:
            if X occurs in t:
                return FAIL  // occurs check
            apply {X -> t} to all remaining equations and to substitution
            substitution = substitution ∪ {X -> t}

        else if t is a variable X:
            // symmetric: swap and handle as above
            add (t, s) back to equations

        else if s = f(s1,...,sn) and t = f(t1,...,tn):
            // same functor and arity
            add (s1,t1), ..., (sn,tn) to equations

        else:
            return FAIL  // different functors or arities

    return substitution
```

**Theorem (Robinson, 1965).** The unification algorithm terminates, and if it succeeds, it returns a most general unifier. If it fails, no unifier exists.

*Proof sketch.* **Termination**: Each step either removes an equation, reduces the number of variables in the remaining equations, or decomposes compound terms into smaller ones. This is bounded. **MGU property**: The algorithm only adds bindings that are forced by the structure of the terms. Any other unifier must contain these bindings (possibly composed with additional substitutions). $\square$

**Complexity.** The naive algorithm is exponential in the worst case (due to term growth from substitution application). Efficient algorithms (Paterson & Wegman, 1978) achieve $O(n)$ using DAG representations and union-find.

### 1.5 SLD Resolution

**SLD resolution** (Selection rule, Linear resolution, Definite clauses) is the proof procedure for logic programming.

Given a goal $\leftarrow G_1, \ldots, G_m$ and a program clause $A \leftarrow B_1, \ldots, B_k$:

1. Select a goal atom $G_i$ (the **selection rule** determines which).
2. Find a program clause $A \leftarrow B_1, \ldots, B_k$ such that $G_i$ and $A$ unify with MGU $\theta$.
3. The new goal (the **resolvent**) is:

$$
\leftarrow \theta(G_1, \ldots, G_{i-1}, B_1, \ldots, B_k, G_{i+1}, \ldots, G_m)
$$

4. If the goal becomes empty, the derivation **succeeds** with the composed substitution as the answer.

**Theorem (Soundness and completeness of SLD resolution).** SLD resolution is **sound**: every computed answer is a logical consequence of the program. It is **complete** (under a fair selection rule): every correct answer is an instance of some computed answer.

### 1.6 Prolog: Operational Semantics

Prolog uses SLD resolution with:
- **Leftmost selection rule**: Always select the leftmost goal.
- **Depth-first search**: Clauses are tried in textual order; backtracking on failure.

```
function Prolog_Solve(goals, program, substitution):
    if goals is empty:
        return substitution  // success
    G = first(goals)
    for each clause (A :- B1, ..., Bk) in program (in order):
        theta = Unify(G, rename(A))   // rename to avoid variable capture
        if theta != FAIL:
            new_goals = apply(theta, [B1,...,Bk] ++ rest(goals))
            new_sub = compose(theta, substitution)
            result = Prolog_Solve(new_goals, program, new_sub)
            if result != FAIL:
                return result
    return FAIL  // all clauses exhausted; backtrack
```

**Limitations of Prolog's search:**
- Depth-first search is **incomplete**: left-recursive rules cause infinite loops.
- The **occurs check** is omitted in most Prolog implementations for efficiency, sacrificing soundness in rare cases.

---

## 2. Constraint Logic Programming

### 2.1 CLP Framework

**Constraint Logic Programming (CLP)** (Jaffar & Lassez, 1987) generalizes logic programming by allowing constraints over specific domains instead of pure unification.

A CLP program operates over a **constraint domain** $\mathcal{D}$ (e.g., real arithmetic, finite domains, strings). Goals include both atoms and constraints. The system maintains a **constraint store** that accumulates constraints.

**Resolution step in CLP:**

$$
\frac{\leftarrow C \wedge G_1, \ldots, G_m \qquad A \leftarrow C' \wedge B_1, \ldots, B_k \qquad G_i = A\theta}{\leftarrow (C \wedge C'\theta) \wedge G_1, \ldots, G_{i-1}, B_1\theta, \ldots, B_k\theta, G_{i+1}, \ldots, G_m}
$$

provided the constraint store $C \wedge C'\theta$ is satisfiable in $\mathcal{D}$.

### 2.2 Common CLP Domains

| Domain | Notation | Constraints | Solver |
|--------|----------|-------------|--------|
| Finite domains | CLP(FD) | $X \in \{1,\ldots,n\}$, $X \neq Y$, $X < Y$ | Arc consistency + backtracking |
| Rational/real arithmetic | CLP(Q), CLP(R) | Linear arithmetic equalities/inequalities | Simplex |
| Booleans | CLP(B) | Boolean formulas | BDDs, SAT |

### 2.3 Applications

- **Scheduling**: CLP(FD) with constraint propagation.
- **Type inference**: Type equations as constraints.
- **Program analysis**: Abstract interpretation as constraint solving.

---

## 3. Datalog and Its Applications

### 3.1 Datalog: Syntax and Semantics

**Datalog** is a restricted form of logic programming:
- No function symbols (only constants and variables).
- All variables in the head must appear in the body (**range restriction**).
- Negation is stratified (if allowed at all).

These restrictions guarantee **termination**: the set of derivable facts is finite.

**Syntax:**

$$
\text{Intensional (derived):} \quad p(X_1, \ldots, X_k) \leftarrow q_1(\ldots), \ldots, q_n(\ldots).
$$

$$
\text{Extensional (base):} \quad r(c_1, \ldots, c_m). \quad \text{(ground facts)}
$$

### 3.2 Fixpoint Semantics

The meaning of a Datalog program is the **least fixpoint** of the immediate consequence operator $T_P$:

$$
T_P(I) = \{A \mid (A \leftarrow B_1, \ldots, B_n) \in \text{ground}(P),\; \{B_1, \ldots, B_n\} \subseteq I\}
$$

**Theorem (van Emden & Kowalski, 1976).** The operator $T_P$ is monotone on the lattice of Herbrand interpretations. By the Knaster-Tarski theorem, the least fixpoint $\text{lfp}(T_P) = \bigcup_{i=0}^{\infty} T_P^i(\emptyset)$ exists. For Datalog (no function symbols), this fixpoint is reached in finitely many iterations.

*Proof.* The Herbrand base (set of all ground atoms) is finite because there are finitely many predicate symbols and constants, and no function symbols. Since $T_P$ is monotone and the lattice is finite, the ascending chain $\emptyset \subseteq T_P(\emptyset) \subseteq T_P^2(\emptyset) \subseteq \ldots$ must stabilize. $\square$

### 3.3 Evaluation Strategies

**Naive evaluation:**

```
function NaiveEval(program P):
    I = extensional facts (EDB)
    repeat:
        I_new = I ∪ T_P(I)
        if I_new == I: return I
        I = I_new
```

**Semi-naive evaluation** (optimization): In each iteration, only derive facts that use at least one fact derived in the *previous* iteration.

```
function SemiNaiveEval(program P):
    I = EDB
    Delta = T_P(EDB) \ EDB
    while Delta is not empty:
        I = I ∪ Delta
        Delta_new = T_P^delta(I, Delta) \ I
        Delta = Delta_new
    return I
```

where $T_P^{\delta}(I, \Delta)$ considers only rule instances where at least one body atom matches a fact in $\Delta$.

### 3.4 Datalog for Program Analysis

Datalog is widely used in **static program analysis** (Whaley & Lam, 2004; Smaragdakis & Bravenboer, 2011):

**Example: Points-to analysis in Datalog.**

```
// Base relations (from the program)
Alloc(var, heap)      // var = new T() at allocation site heap
Assign(to, from)      // to = from
Load(to, base, fld)   // to = base.fld
Store(base, fld, src) // base.fld = src

// Derived relations
PointsTo(var, heap) :- Alloc(var, heap).
PointsTo(to, heap)  :- Assign(to, from), PointsTo(from, heap).
PointsTo(to, heap)  :- Load(to, base, fld), PointsTo(base, obj), HeapPointsTo(obj, fld, heap).
HeapPointsTo(obj, fld, heap) :- Store(base, fld, src), PointsTo(base, obj), PointsTo(src, heap).
```

**Tools:** Souffl\'e, LogicBlox, Doop (for Java pointer analysis).

### 3.5 Stratified Negation

Datalog with negation requires **stratification**: rules with negation can only negate predicates defined in lower strata.

$$
p(X) \leftarrow q(X), \neg r(X).
$$

The evaluation proceeds stratum by stratum: compute all facts for stratum $k$ before evaluating stratum $k+1$.

**Theorem.** If a Datalog program with negation is stratifiable, its stratified semantics is well-defined (independent of the particular stratification chosen) and coincides with the **perfect model semantics**.

---

## 4. DSL Design: Embedded vs. Standalone

### 4.1 What Is a DSL?

A **domain-specific language** (DSL) is a programming language tailored to a particular application domain, offering appropriate abstractions and notations.

Examples: SQL (databases), regex (pattern matching), CSS (styling), Halide (image processing), TensorFlow (neural networks).

### 4.2 Standalone (External) DSLs

A standalone DSL has its own parser, type checker, and compiler/interpreter.

**Advantages:**
- Complete freedom in syntax design.
- Domain-specific error messages.
- Domain-specific optimizations.

**Disadvantages:**
- High implementation cost (parser, type checker, code generator).
- Limited tooling (editor support, debugger).
- Users must learn a new language.

### 4.3 Embedded (Internal) DSLs

An embedded DSL is implemented as a library within a host language, exploiting the host language's syntax and type system.

**Advantages:**
- Reuse host language infrastructure (parser, type checker, tooling).
- Seamless interoperation with host language code.
- Lower implementation cost.

**Disadvantages:**
- Constrained by host language syntax.
- Error messages leak host language details.
- Limited domain-specific optimization (unless using staged compilation).

**Techniques for embedding:**
- **Overloaded operators** (Haskell, Scala, Kotlin).
- **Builder pattern / fluent APIs** (Java, Kotlin).
- **Tagless final** (Carette, Kiselyov, Shan, 2009): Represent DSL terms as type class instances.
- **Free monads / free applicatives**: DSL programs as data structures that can be interpreted.

### 4.4 The Expression Problem

The **expression problem** (Wadler, 1998) highlights a tension in DSL design:
- **Adding new data variants** (new syntax constructors) should not require modifying existing code.
- **Adding new operations** (new interpreters/compilers) should not require modifying existing code.

Functional languages (pattern matching) make it easy to add operations but hard to add data variants. OO languages (subclassing) make it easy to add variants but hard to add operations. Solutions: visitor pattern, type classes, tagless final, object algebras.

---

## 5. Macro Systems

### 5.1 Textual Macros (C Preprocessor)

C-style macros operate on token streams:

```c
#define MAX(a, b) ((a) > (b) ? (a) : (b))
```

**Problems:** No hygiene (variable capture), no type checking, multiple evaluation of arguments, confusing error messages.

### 5.2 Hygienic Macros (Kohlbecker et al., 1986)

**Hygienic macros** (Scheme, Racket) guarantee that:
1. Variables introduced by the macro do not capture variables from the use site.
2. Variables from the use site do not capture bindings in the macro body.

**Definition.** A macro system is **hygienic** if the expansion of a macro respects the lexical scoping of both the macro definition and the macro use site. Formally, $\alpha$-equivalence is preserved: renaming bound variables in either the macro body or the use-site code does not change the meaning of the expanded program.

**Implementation.** Each identifier is **marked** with a set of **scopes** (or syntax marks) that track its origin. During expansion, the system uses these marks to distinguish identically-named variables from different scopes.

### 5.3 Procedural Macros (Rust, Scala)

**Procedural macros** are functions from syntax trees to syntax trees, executed at compile time.

```
// Rust proc macro (conceptual)
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    let ast = parse(input);
    let output = transform(ast);
    output.into()
}
```

**Trade-offs:**
- Full power of the host language for metaprogramming.
- Hygiene must be maintained manually (or with library support).
- Compile-time execution raises issues of determinism and sandboxing.

### 5.4 Macro Typing

**Theorem (typed macros).** In a system with typed macros (e.g., MetaML, MacroML), if the macro itself is well-typed, then every expansion of the macro produces a well-typed program. This eliminates a large class of macro-related bugs.

---

## 6. Language Workbenches

### 6.1 Concept

A **language workbench** (Fowler, 2005) is an IDE-like tool for defining and using DSLs. It integrates:
- Grammar/syntax definition.
- Type system specification.
- Code generation / interpretation.
- Editor support (syntax highlighting, auto-complete, error checking).

**Examples:** JetBrains MPS, Spoofax, Xtext.

### 6.2 Projectional Editing

In **projectional editing** (JetBrains MPS), the user directly edits the AST, not text. The displayed representation is a **projection** of the AST. This allows:
- Multiple notations for the same construct (textual, tabular, graphical).
- Language composition without grammar ambiguity (since there is no grammar).
- Domain-expert-friendly interfaces.

---

## 7. Staged Programming and Metaprogramming

### 7.1 Multi-Stage Programming

**Multi-stage programming** (Taha & Sheard, 2000) provides constructs for:
- **Quoting** (brackets $\langle e \rangle$): Delay the evaluation of $e$, producing a code fragment.
- **Splicing** (escape $\sim e$): Insert a code fragment into a larger piece of code.
- **Running** (run $!\,e$): Execute a code fragment.

**Type system:** $\langle e \rangle : \text{Code}\;\tau$ if $e : \tau$. The staging level tracks how many layers of quotation surround an expression.

### 7.2 Typing Rules for Staging

$$
\frac{\Gamma \vdash^{n+1} e : \tau}{\Gamma \vdash^n \langle e \rangle : \text{Code}\;\tau} \quad (\text{Quote})
$$

$$
\frac{\Gamma \vdash^n e : \text{Code}\;\tau}{\Gamma \vdash^{n+1} \sim e : \tau} \quad (\text{Splice})
$$

$$
\frac{\Gamma \vdash^0 e : \text{Code}\;\tau}{\Gamma \vdash^0 !\,e : \tau} \quad (\text{Run, only at stage 0})
$$

The superscript $n$ is the **staging level**. A variable bound at level $n$ can only be used at level $n$ (cross-stage persistence requires explicit mechanisms).

### 7.3 Applications

- **Eliminating interpretation overhead**: A generic algorithm parameterized by a configuration can be specialized at stage 1, producing optimized stage-0 code.
- **Domain-specific optimization**: Matrix multiplication kernels, FFT, parser generators.
- **Partial evaluation**: Staging is a programmer-controlled form of partial evaluation.

### 7.4 Example: Staged Power Function

```
// Unstaged
let rec power n x =
    if n = 0 then 1
    else x * power (n-1) x

// Staged (MetaOCaml)
let rec power_staged n x =
    if n = 0 then .<1>.
    else .<.~x * .~(power_staged (n-1) x)>.

// power_staged 3 .<y>. produces:
// .<y * y * y * 1>.
```

The staged version generates specialized code at compile time, eliminating the recursion.

### 7.5 Relationship to Partial Evaluation

**Theorem (Futamura projections, 1971/1999).**

Let $\text{mix}$ be a partial evaluator. Then:

1. $\text{mix}(\text{interp}, \text{src}) = \text{target}$: Specializing an interpreter with respect to a source program yields the compiled program.
2. $\text{mix}(\text{mix}, \text{interp}) = \text{compiler}$: Specializing the partial evaluator with respect to an interpreter yields a compiler.
3. $\text{mix}(\text{mix}, \text{mix}) = \text{cogen}$: Specializing the partial evaluator with respect to itself yields a compiler generator.

---

## 8. Summary

| Topic | Key Idea | Formal Foundation |
|-------|----------|-------------------|
| Logic programming | Programs as logical formulas; computation as proof search | First-order logic, Horn clauses |
| Unification | Finding substitutions that make terms identical | Robinson's algorithm, MGU theorem |
| SLD resolution | Goal-directed proof search for definite clauses | Soundness and completeness theorems |
| Datalog | Restricted logic programming with guaranteed termination | Least fixpoint of $T_P$ |
| CLP | Logic programming with constraint domains | Constraint satisfaction |
| Embedded DSLs | DSL as a library in a host language | Tagless final, free monads |
| Hygienic macros | Scope-safe syntactic transformations | Alpha-equivalence preservation |
| Staged programming | Compile-time code generation with type safety | Multi-level type systems |

---

## References

1. Robinson, J. A. (1965). "A machine-oriented logic based on the resolution principle." *JACM*, 12(1), 23--41.
2. Kowalski, R. (1974). "Predicate logic as a programming language." *Information Processing '74*.
3. Ceri, S., Gottlob, G., & Tanca, L. (1989). "What you always wanted to know about Datalog (and never dared to ask)." *IEEE TKDE*, 1(1).
4. Martelli, A. & Montanari, U. (1982). "An efficient unification algorithm." *ACM TOPLAS*, 4(2), 258--282.
5. Jaffar, J. & Lassez, J.-L. (1987). "Constraint logic programming." *POPL '87*.
6. Taha, W. & Sheard, T. (2000). "MetaML and multi-stage programming with explicit annotations." *TCS*, 248(1-2), 211--242.
7. Kohlbecker, E., Friedman, D. P., Felleisen, M., & Duba, B. (1986). "Hygienic macro expansion." *LFP '86*.
8. Smaragdakis, Y. & Bravenboer, M. (2011). "Using Datalog for fast and easy program analysis." *LNCS 6702*.
9. van Emden, M. H. & Kowalski, R. A. (1976). "The semantics of predicate logic as a programming language." *JACM*, 23(4).
10. Carette, J., Kiselyov, O., & Shan, C. (2009). "Finally tagless, partially evaluated." *JFP*, 19(5).
11. Futamura, Y. (1999). "Partial evaluation of computation process -- an approach to a compiler-compiler." *HOSC*, 12(4). (Revised version of 1971 paper.)
12. Wadler, P. (1998). "The expression problem." Email to java-genericity list.
