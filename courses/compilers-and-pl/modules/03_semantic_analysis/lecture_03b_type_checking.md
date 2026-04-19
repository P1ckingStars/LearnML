# Lecture 03b: Type Checking

## 1. Introduction: What Are Types and Why Do We Need Them?

A **type system** is a tractable syntactic method for proving the absence of certain program behaviors by classifying phrases according to the kinds of values they compute.

**Definition 1.1 (Type).** A *type* is a set of values together with the operations defined on those values. Formally, a type $\tau$ denotes a subset of the universe of all values $\mathcal{V}$, with an associated collection of operations.

**Why type systems?**

1. **Safety:** Prevent undefined behavior (e.g., adding an integer to a function pointer).
2. **Documentation:** Types serve as machine-checked specifications.
3. **Optimization:** Type information enables better code generation (e.g., unboxing, register allocation by type).
4. **Abstraction:** Types enforce module boundaries and representation invariance.

**Theorem 1.1 (Milner's Slogan, informal).** "Well-typed programs cannot go wrong"---that is, a well-typed program in a sound type system will never reach a stuck state during evaluation.

We formalize this precisely in Lecture 04b (Progress and Preservation).

---

## 2. Type Checking vs. Type Inference

| Aspect | Type Checking | Type Inference |
|--------|--------------|----------------|
| Input | AST + explicit type annotations | AST (possibly with partial annotations) |
| Output | Accept/reject | Accept with inferred types, or reject |
| Algorithm | Verify given types match | Discover types via constraint solving |
| Examples | C, Java, Go | ML, Haskell, Rust (partial) |

**Type checking** verifies that a program conforms to explicitly stated types. **Type inference** (Lecture 03c) deduces types automatically.

In practice, most languages use a hybrid: some annotations required (function signatures in Rust, Haskell top-level), with inference filling in the rest.

---

## 3. Attribute Grammars

### 3.1 Definition

An **attribute grammar** is a context-free grammar augmented with attributes attached to grammar symbols and semantic rules (equations) that define how attributes are computed.

**Definition 3.1.** An attribute grammar is a tuple $(G, A, R)$ where:
- $G = (N, \Sigma, P, S)$ is a context-free grammar,
- $A = \bigcup_{X \in N \cup \Sigma} A(X)$ assigns a set of attributes to each symbol,
- $R = \bigcup_{p \in P} R(p)$ assigns semantic rules to each production.

### 3.2 Synthesized Attributes

A **synthesized attribute** of a nonterminal $X$ is computed from the attributes of $X$'s children in the parse tree. Information flows *up* the tree.

**Example:** Type of an expression is synthesized.

$$
\begin{aligned}
E &\to E_1 + E_2 \quad &\{E.\text{type} := \text{check\_add}(E_1.\text{type}, E_2.\text{type})\} \\
E &\to \text{num} \quad &\{E.\text{type} := \texttt{int}\} \\
E &\to \text{real} \quad &\{E.\text{type} := \texttt{float}\}
\end{aligned}
$$

### 3.3 Inherited Attributes

An **inherited attribute** of a nonterminal $X$ is computed from the attributes of $X$'s parent or siblings. Information flows *down* or *across* the tree.

**Example:** Expected type in a declaration context.

$$
\begin{aligned}
D &\to T\; L \quad &\{L.\text{inh\_type} := T.\text{type}\} \\
T &\to \texttt{int} \quad &\{T.\text{type} := \texttt{int}\} \\
L &\to L_1,\; \texttt{id} \quad &\{L_1.\text{inh\_type} := L.\text{inh\_type};\; \text{addtype}(\texttt{id}, L.\text{inh\_type})\}
\end{aligned}
$$

### 3.4 S-Attributed and L-Attributed Grammars

- **S-attributed grammar:** Only synthesized attributes. Can be evaluated in a single bottom-up pass.
- **L-attributed grammar:** Inherited attributes of a symbol depend only on inherited attributes of the parent and attributes of left siblings. Can be evaluated in a single left-to-right depth-first traversal.

**Theorem 3.1.** Every S-attributed grammar is L-attributed. $\square$

---

## 4. Type Checking Rules as Inference Rules

### 4.1 Typing Judgments

A **typing judgment** has the form:

$$\Gamma \vdash e : \tau$$

Read as: "Under type environment $\Gamma$, expression $e$ has type $\tau$."

Here $\Gamma$ is a **type environment** (a finite mapping from variable names to types):

$$\Gamma : \text{Var} \rightharpoonup \text{Type}$$

We write $\Gamma, x : \tau$ for the environment $\Gamma$ extended with the binding $x \mapsto \tau$.

### 4.2 Typing Rules for a Simple Language

Consider a language with integers, booleans, functions, and let-bindings.

**Variables:**

$$\frac{x : \tau \in \Gamma}{\Gamma \vdash x : \tau} \quad (\text{T-Var})$$

**Integer and Boolean Literals:**

$$\frac{n \in \mathbb{Z}}{\Gamma \vdash n : \texttt{int}} \quad (\text{T-Int}) \qquad \frac{b \in \{\texttt{true}, \texttt{false}\}}{\Gamma \vdash b : \texttt{bool}} \quad (\text{T-Bool})$$

**Arithmetic:**

$$\frac{\Gamma \vdash e_1 : \texttt{int} \quad \Gamma \vdash e_2 : \texttt{int}}{\Gamma \vdash e_1 + e_2 : \texttt{int}} \quad (\text{T-Add})$$

**Comparison:**

$$\frac{\Gamma \vdash e_1 : \texttt{int} \quad \Gamma \vdash e_2 : \texttt{int}}{\Gamma \vdash e_1 < e_2 : \texttt{bool}} \quad (\text{T-Lt})$$

**Conditional:**

$$\frac{\Gamma \vdash e_1 : \texttt{bool} \quad \Gamma \vdash e_2 : \tau \quad \Gamma \vdash e_3 : \tau}{\Gamma \vdash \texttt{if}\; e_1\; \texttt{then}\; e_2\; \texttt{else}\; e_3 : \tau} \quad (\text{T-If})$$

**Function Abstraction:**

$$\frac{\Gamma, x : \tau_1 \vdash e : \tau_2}{\Gamma \vdash \lambda x : \tau_1.\; e : \tau_1 \to \tau_2} \quad (\text{T-Abs})$$

**Function Application:**

$$\frac{\Gamma \vdash e_1 : \tau_1 \to \tau_2 \quad \Gamma \vdash e_2 : \tau_1}{\Gamma \vdash e_1\; e_2 : \tau_2} \quad (\text{T-App})$$

**Let Binding:**

$$\frac{\Gamma \vdash e_1 : \tau_1 \quad \Gamma, x : \tau_1 \vdash e_2 : \tau_2}{\Gamma \vdash \texttt{let}\; x = e_1\; \texttt{in}\; e_2 : \tau_2} \quad (\text{T-Let})$$

### 4.3 Type Derivation Trees

A **type derivation** (or typing derivation) is a tree of rule applications that proves a typing judgment. Each node is an instance of a typing rule, with the conclusion at the bottom.

**Example.** Derive $\emptyset \vdash (\lambda x:\texttt{int}.\; x + 1)\; 42 : \texttt{int}$.

$$
\frac{
  \frac{
    \frac{x:\texttt{int} \in \{x:\texttt{int}\}}{x:\texttt{int} \vdash x : \texttt{int}} \text{(T-Var)}
    \quad
    \frac{}{x:\texttt{int} \vdash 1 : \texttt{int}} \text{(T-Int)}
  }{x:\texttt{int} \vdash x + 1 : \texttt{int}} \text{(T-Add)}
}{
  \emptyset \vdash \lambda x:\texttt{int}.\; x + 1 : \texttt{int} \to \texttt{int}
} \text{(T-Abs)}
\quad
\frac{}{\emptyset \vdash 42 : \texttt{int}} \text{(T-Int)}
$$

Combined by (T-App):

$$
\frac{
  \emptyset \vdash \lambda x:\texttt{int}.\; x + 1 : \texttt{int} \to \texttt{int}
  \quad
  \emptyset \vdash 42 : \texttt{int}
}{
  \emptyset \vdash (\lambda x:\texttt{int}.\; x + 1)\; 42 : \texttt{int}
} \text{(T-App)}
$$

---

## 5. Type Checking Algorithm

### 5.1 Syntax-Directed Type Checking

When the typing rules are **syntax-directed** (at most one rule applies to each syntactic form), type checking is a straightforward recursive traversal of the AST.

```
function typecheck(gamma, expr):
    match expr with
    | IntLit(n):
        return INT
    | BoolLit(b):
        return BOOL
    | Var(x):
        if x not in gamma:
            error("Unbound variable: " + x)
        return gamma[x]
    | BinOp(op, e1, e2):
        t1 := typecheck(gamma, e1)
        t2 := typecheck(gamma, e2)
        if op in {+, -, *, /}:
            assert t1 == INT and t2 == INT
            return INT
        if op in {<, >, <=, >=}:
            assert t1 == INT and t2 == INT
            return BOOL
        if op in {==, !=}:
            assert t1 == t2
            return BOOL
        if op in {&&, ||}:
            assert t1 == BOOL and t2 == BOOL
            return BOOL
    | If(cond, then_e, else_e):
        tc := typecheck(gamma, cond)
        assert tc == BOOL
        tt := typecheck(gamma, then_e)
        te := typecheck(gamma, else_e)
        assert tt == te
        return tt
    | Lambda(x, ann_type, body):
        tbody := typecheck(gamma + {x: ann_type}, body)
        return FunType(ann_type, tbody)
    | App(fun_e, arg_e):
        tf := typecheck(gamma, fun_e)
        assert tf is FunType(t1, t2)
        ta := typecheck(gamma, arg_e)
        assert ta == t1
        return t2
    | Let(x, rhs, body):
        trhs := typecheck(gamma, rhs)
        return typecheck(gamma + {x: trhs}, body)
```

### 5.2 Complexity

**Theorem 5.1.** For a simply-typed language without subtyping or overloading, syntax-directed type checking runs in $O(n)$ time, where $n$ is the size of the AST, assuming constant-time environment operations.

*Proof.* Each AST node is visited exactly once. At each node, we perform a constant amount of work (environment lookup, type comparison). Environment operations (lookup and extension) are $O(1)$ amortized with hash-based symbol tables. $\square$

---

## 6. Structural vs. Nominal Typing

### 6.1 Nominal Typing

Under **nominal typing**, two types are equal if and only if they have the same name (declared identity).

$$\tau_1 =_{\text{nom}} \tau_2 \iff \text{name}(\tau_1) = \text{name}(\tau_2)$$

**Example (Java):**

```java
class Point { int x; int y; }
class Coord { int x; int y; }
// Point and Coord are DIFFERENT types, despite identical structure
```

### 6.2 Structural Typing

Under **structural typing**, two types are equal if they have the same structure.

$$\tau_1 =_{\text{struct}} \tau_2 \iff \text{structure}(\tau_1) = \text{structure}(\tau_2)$$

**Example (TypeScript/OCaml-style):**

```typescript
type Point = { x: number; y: number };
type Coord = { x: number; y: number };
// Point and Coord are THE SAME type structurally
```

### 6.3 Formal Definition of Structural Equivalence

Define structural equivalence $\equiv$ inductively:

$$\frac{}{\texttt{int} \equiv \texttt{int}} \qquad \frac{}{\texttt{bool} \equiv \texttt{bool}}$$

$$\frac{\tau_1 \equiv \tau_1' \quad \tau_2 \equiv \tau_2'}{\tau_1 \to \tau_2 \equiv \tau_1' \to \tau_2'}$$

$$\frac{\tau_1 \equiv \tau_1' \quad \tau_2 \equiv \tau_2'}{\tau_1 \times \tau_2 \equiv \tau_1' \times \tau_2'}$$

**Algorithm for structural equivalence:** Reduce both types to canonical form and compare. For recursive types, use a union-find algorithm on type graph nodes.

### 6.4 Recursive Types and Structural Equivalence

For recursive types (e.g., `type List = Nil | Cons of int * List`), structural equivalence becomes checking bisimulation on the type graph.

**Algorithm (Recursive Type Equivalence):**

```
function types_equal(t1, t2, assumptions):
    if (t1, t2) in assumptions:
        return true   // coinductive assumption
    match (t1, t2) with
    | (IntType, IntType) -> true
    | (BoolType, BoolType) -> true
    | (FunType(a1, r1), FunType(a2, r2)) ->
        types_equal(a1, a2, assumptions + {(t1,t2)}) and
        types_equal(r1, r2, assumptions + {(t1,t2)})
    | (RecType(x, body1), _) ->
        types_equal(unfold(t1), t2, assumptions + {(t1,t2)})
    | _ -> false
```

This is essentially checking **bisimilarity** on the infinite trees generated by unfolding the recursive type definitions.

---

## 7. Subtyping

### 7.1 The Subtyping Relation

A type $\sigma$ is a **subtype** of $\tau$, written $\sigma <: \tau$, if a value of type $\sigma$ can safely be used wherever a value of type $\tau$ is expected.

**Subsumption Rule:**

$$\frac{\Gamma \vdash e : \sigma \quad \sigma <: \tau}{\Gamma \vdash e : \tau} \quad (\text{T-Sub})$$

### 7.2 Subtyping Rules

**Reflexivity and Transitivity:**

$$\frac{}{\tau <: \tau} \quad (\text{S-Refl}) \qquad \frac{\tau_1 <: \tau_2 \quad \tau_2 <: \tau_3}{\tau_1 <: \tau_3} \quad (\text{S-Trans})$$

**Function Types (contravariant in argument, covariant in result):**

$$\frac{\tau_1' <: \tau_1 \quad \tau_2 <: \tau_2'}{\tau_1 \to \tau_2 <: \tau_1' \to \tau_2'} \quad (\text{S-Arrow})$$

**Record Width Subtyping:**

$$\frac{}{\{l_1:\tau_1, \ldots, l_n:\tau_n, l_{n+1}:\tau_{n+1}\} <: \{l_1:\tau_1, \ldots, l_n:\tau_n\}} \quad (\text{S-RecWidth})$$

**Record Depth Subtyping:**

$$\frac{\tau_i <: \tau_i' \text{ for all } i}{\{l_1:\tau_1, \ldots, l_n:\tau_n\} <: \{l_1:\tau_1', \ldots, l_n:\tau_n'\}} \quad (\text{S-RecDepth})$$

### 7.3 Variance

Given a type constructor $F$:

- **Covariant** in parameter $X$: if $A <: B$ then $F(A) <: F(B)$.
- **Contravariant** in parameter $X$: if $A <: B$ then $F(B) <: F(A)$.
- **Invariant** in parameter $X$: neither covariant nor contravariant.

**Key result for function types:** The function type constructor $(\to)$ is *contravariant* in its domain and *covariant* in its codomain.

**For mutable references:** `Ref T` must be *invariant* in $T$.

*Proof sketch.* If `Ref A <: Ref B` when `A <: B` (covariant), then given `r : Ref A`, we could write a value of type `B` into `r` (since `r` is also `Ref B`), violating the invariant that `r` contains an `A`. Similarly, contravariance fails because we could read a `B` from `r` expecting an `A`. Therefore, `Ref` must be invariant. $\square$

### 7.4 Java Array Covariance Bug

Java arrays are covariant: `String[] <: Object[]`. This is unsound:

```java
String[] strings = new String[1];
Object[] objects = strings;    // OK: covariant
objects[0] = new Integer(42);  // Compiles! But throws ArrayStoreException at runtime
```

This demonstrates why mutable containers must be invariant for soundness.

---

## 8. Type Checking with Subtyping

Adding subtyping complicates type checking because the subsumption rule (T-Sub) is not syntax-directed: it can be applied anywhere.

**Solution:** Integrate subtyping into the existing rules. Replace equality checks with subtype checks.

**Modified application rule:**

$$\frac{\Gamma \vdash e_1 : \tau_1 \to \tau_2 \quad \Gamma \vdash e_2 : \sigma \quad \sigma <: \tau_1}{\Gamma \vdash e_1\; e_2 : \tau_2} \quad (\text{T-App-Sub})$$

### 8.1 Algorithmic Subtyping

We need a decision procedure for $\sigma <: \tau$.

```
function is_subtype(sigma, tau):
    match (sigma, tau) with
    | (_, Top) -> true
    | (Bot, _) -> true
    | (IntType, IntType) -> true
    | (BoolType, BoolType) -> true
    | (FunType(s1, s2), FunType(t1, t2)) ->
        is_subtype(t1, s1) and is_subtype(s2, t2)   // contravariant, covariant
    | (Record(fields1), Record(fields2)) ->
        for each (l, t) in fields2:
            if l not in fields1: return false
            if not is_subtype(fields1[l], t): return false
        return true
    | _ -> false
```

**Theorem 8.1.** The algorithmic subtyping procedure above is sound and complete with respect to the declarative subtyping rules (for non-recursive types).

---

## 9. Implicit Conversions and Coercions

Some languages (e.g., C, C++) allow implicit type conversions (coercions):

$$\frac{\Gamma \vdash e : \texttt{int}}{\Gamma \vdash e : \texttt{float}} \quad (\text{T-IntToFloat})$$

**Warning:** Implicit conversions can interact badly with overloading, leading to ambiguity. C++ has a complex set of rules for "implicit conversion sequences" ranked by quality.

**Formal model:** A coercion is a function $c : \tau_1 \to \tau_2$ inserted by the compiler. The set of available coercions forms a directed graph. If this graph has unique paths (no ambiguous conversions), the system is coherent.

**Definition 9.1 (Coherence).** A coercion system is *coherent* if for every pair of types $(\tau_1, \tau_2)$ with $\tau_1 <: \tau_2$, all coercion paths from $\tau_1$ to $\tau_2$ yield the same semantic function.

---

## 10. Error Reporting

Good type error messages are crucial for usability. Key principles:

1. **Location:** Point to the exact source location of the mismatch.
2. **Expected vs. actual:** Show what type was expected and what was found.
3. **Context:** Explain *why* a particular type was expected.
4. **Suggestions:** Offer potential fixes when possible.

**Example of good error reporting:**

```
error[E0308]: mismatched types
 --> src/main.rs:5:18
  |
5 |     let x: i32 = "hello";
  |            ---   ^^^^^^^ expected `i32`, found `&str`
  |            |
  |            expected due to this
```

### 10.1 Techniques

- **Carry source locations** through the type checker alongside types.
- **Generate constraints** with source location metadata (for constraint-based checking).
- **Bidirectional type checking:** Propagate expected types downward, reducing the distance between error location and error source.

---

## 11. Summary

| Concept | Description |
|---------|-------------|
| Typing judgment $\Gamma \vdash e : \tau$ | Core formalism for type checking |
| Synthesized attributes | Computed bottom-up (e.g., expression types) |
| Inherited attributes | Computed top-down (e.g., expected types) |
| Structural typing | Types equal by structure |
| Nominal typing | Types equal by name |
| Subtyping $\sigma <: \tau$ | Safe substitutability |
| Variance | How subtyping interacts with type constructors |
| Subsumption | Implicit upcast via subtyping |

---

## References

1. Cardelli, L. & Wegner, P. (1985). "On Understanding Types, Data Abstraction, and Polymorphism." *Computing Surveys*, 17(4), 471--522.
2. Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press. Chapters 8, 9, 11, 15.
3. Aho, A.V., Lam, M.S., Sethi, R., & Ullman, J.D. (2006). *Compilers: Principles, Techniques, and Tools* (2nd ed.), Chapter 6: Intermediate-Code Generation, Section 6.5 (Type Checking).
4. Knuth, D.E. (1968). "Semantics of Context-Free Languages." *Mathematical Systems Theory*, 2(2), 127--145. (Attribute grammars.)
5. Liskov, B.H. & Wing, J.M. (1994). "A Behavioral Notion of Subtyping." *ACM TOPLAS*, 16(6), 1811--1841.
6. Tate, R. (2013). "The Sequential Semantics of Producer Effect Systems." *POPL*.
