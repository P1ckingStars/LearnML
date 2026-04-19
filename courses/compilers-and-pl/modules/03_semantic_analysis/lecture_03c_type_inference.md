# Lecture 03c: Type Inference

## 1. Motivation

Type inference frees the programmer from annotating every expression with its type, while retaining the safety guarantees of static typing. The compiler automatically deduces the most general type of each expression.

**Central question:** Given an expression $e$ with no (or partial) type annotations, find a type $\tau$ and a type environment $\Gamma$ such that $\Gamma \vdash e : \tau$, or report that no such typing exists.

**Historical context:** Type inference for the simply-typed lambda calculus was studied by Curry in the 1950s and Hindley in 1969. Milner independently rediscovered the algorithm in the context of ML (1978), and Damas and Milner proved its completeness (1982). The resulting **Hindley-Milner** (HM) type system remains the foundation of type inference in ML, OCaml, Haskell, F\#, and (with extensions) Rust and Scala.

---

## 2. Substitutions and Unification

### 2.1 Type Variables and Substitutions

Let $\text{TVar} = \{\alpha, \beta, \gamma, \ldots\}$ be a countably infinite set of **type variables**. Types are defined by:

$$\tau ::= \alpha \mid \texttt{int} \mid \texttt{bool} \mid \tau_1 \to \tau_2 \mid \tau_1 \times \tau_2$$

A **substitution** is a finite mapping from type variables to types:

$$S : \text{TVar} \rightharpoonup \text{Type}$$

We write $S = [\alpha_1 \mapsto \tau_1, \ldots, \alpha_n \mapsto \tau_n]$. Application of $S$ to a type $\tau$, written $S(\tau)$ or $S\tau$, replaces each free occurrence of $\alpha_i$ in $\tau$ with $\tau_i$.

**Definition 2.1 (Composition).** The composition $S_1 \circ S_2$ is the substitution such that $(S_1 \circ S_2)(\tau) = S_1(S_2(\tau))$ for all $\tau$.

**Properties:**

1. Substitution application distributes over type constructors: $S(\tau_1 \to \tau_2) = S(\tau_1) \to S(\tau_2)$.
2. Composition is associative: $(S_1 \circ S_2) \circ S_3 = S_1 \circ (S_2 \circ S_3)$.
3. The identity substitution $\text{id}$ satisfies $S \circ \text{id} = \text{id} \circ S = S$.

### 2.2 Unification

**Definition 2.2 (Unifier).** A substitution $S$ is a **unifier** of types $\tau_1$ and $\tau_2$ if $S(\tau_1) = S(\tau_2)$.

**Definition 2.3 (Most General Unifier).** A unifier $S$ of $\tau_1$ and $\tau_2$ is a **most general unifier** (MGU) if for every other unifier $S'$ of $\tau_1$ and $\tau_2$, there exists a substitution $R$ such that $S' = R \circ S$.

### 2.3 Robinson's Unification Algorithm

```
function unify(t1, t2):
    if t1 is a type variable alpha:
        if alpha == t2:
            return id                       // trivial
        if alpha occurs in t2:
            error("Infinite type: " + alpha + " ~ " + t2)  // occurs check
        return [alpha -> t2]
    if t2 is a type variable alpha:
        return unify(t2, t1)                // symmetric case
    if t1 is a base type and t2 is a base type:
        if t1 == t2:
            return id
        else:
            error("Cannot unify " + t1 + " with " + t2)
    if t1 = s1 -> s2 and t2 = r1 -> r2:    // function types
        S1 := unify(s1, r1)
        S2 := unify(S1(s2), S1(r2))
        return S2 . S1
    if t1 = s1 * s2 and t2 = r1 * r2:      // product types
        S1 := unify(s1, r1)
        S2 := unify(S1(s2), S1(r2))
        return S2 . S1
    error("Cannot unify " + t1 + " with " + t2)
```

### 2.4 The Occurs Check

The **occurs check** prevents construction of infinite types. Without it, unifying $\alpha$ with $\alpha \to \texttt{int}$ would yield $\alpha = \alpha \to \texttt{int} = (\alpha \to \texttt{int}) \to \texttt{int} = \cdots$, an infinite type.

**Theorem 2.1 (Soundness and Completeness of Unification).** Robinson's unification algorithm, given types $\tau_1$ and $\tau_2$:
1. Terminates.
2. If a unifier exists, returns a most general unifier.
3. If no unifier exists, reports failure.

*Proof.*

**Termination.** Define the measure $\mu(\tau_1, \tau_2) = |\text{vars}(\tau_1) \cup \text{vars}(\tau_2)| + \text{size}(\tau_1) + \text{size}(\tau_2)$. In each recursive call, either (a) a variable is eliminated by substitution, decreasing $|\text{vars}|$, or (b) both types are decomposed into strictly smaller subterms, decreasing $\text{size}$. Hence $\mu$ strictly decreases, and since it is bounded below by 0, the algorithm terminates.

**Soundness.** We show by induction on the recursion that the returned substitution $S$ satisfies $S(\tau_1) = S(\tau_2)$. Base cases are immediate. For the inductive case $\tau_1 = s_1 \to s_2$, $\tau_2 = r_1 \to r_2$: we have $S_1(s_1) = S_1(r_1)$ by induction, and $S_2(S_1(s_2)) = S_2(S_1(r_2))$ by induction. Therefore $(S_2 \circ S_1)(s_1 \to s_2) = S_2(S_1(s_1)) \to S_2(S_1(s_2)) = S_2(S_1(r_1)) \to S_2(S_1(r_2)) = (S_2 \circ S_1)(r_1 \to r_2)$.

**Completeness (MGU property).** Suppose $U$ is any unifier of $\tau_1$ and $\tau_2$. We show by induction that there exists $R$ with $U = R \circ S$ where $S$ is the returned substitution.

- If $\tau_1 = \alpha \notin \text{FV}(\tau_2)$: $S = [\alpha \mapsto \tau_2]$. Since $U(\alpha) = U(\tau_2)$, define $R = U \setminus \{\alpha\}$ (restricting $U$ to variables other than $\alpha$). Then $R \circ S = R \circ [\alpha \mapsto \tau_2]$. For any variable $\beta \neq \alpha$: $(R \circ S)(\beta) = R(\beta) = U(\beta)$. For $\alpha$: $(R \circ S)(\alpha) = R(\tau_2) = U(\tau_2) = U(\alpha)$.

- Inductive case follows similarly by composing the witnesses from the recursive calls. $\square$

### 2.5 Complexity of Unification

**Theorem 2.2.** Robinson's algorithm has exponential worst-case time complexity due to the explicit representation of substitutions.

**Theorem 2.3 (Martelli-Montanari, 1982; Paterson-Wegman, 1978).** Unification can be solved in $O(n)$ time using a DAG representation with union-find.

The near-linear algorithm uses union-find ($O(n \cdot \alpha(n))$ in practice) by representing type terms as nodes in a DAG and merging equivalence classes.

```
function unify_efficient(node1, node2):
    s := find(node1)
    t := find(node2)
    if s == t:
        return                          // already unified
    if s is a variable:
        if occurs(s, t):
            error("Infinite type")
        union(s, t)                     // make t the representative
        return
    if t is a variable:
        if occurs(t, s):
            error("Infinite type")
        union(t, s)
        return
    if s.constructor != t.constructor or s.arity != t.arity:
        error("Type mismatch")
    union(s, t)
    for i := 1 to s.arity:
        unify_efficient(s.child[i], t.child[i])
```

---

## 3. The Hindley-Milner Type System

### 3.1 Types and Type Schemes

The HM system distinguishes between **monotypes** and **polytypes** (type schemes):

$$
\begin{aligned}
\tau &::= \alpha \mid \texttt{int} \mid \texttt{bool} \mid \tau_1 \to \tau_2 \quad &\text{(monotypes)} \\
\sigma &::= \tau \mid \forall \alpha.\; \sigma \quad &\text{(type schemes / polytypes)}
\end{aligned}
$$

A type scheme $\forall \alpha_1 \ldots \alpha_n.\; \tau$ represents a family of types obtained by substituting the $\alpha_i$ with arbitrary monotypes.

**Example:** The identity function has type scheme $\forall \alpha.\; \alpha \to \alpha$.

### 3.2 Instantiation and Generalization

**Instantiation.** A type scheme $\forall \bar{\alpha}.\; \tau$ can be *instantiated* by replacing bound variables with fresh monotypes:

$$\frac{\sigma = \forall \alpha_1 \ldots \alpha_n.\; \tau \quad \tau' = [\alpha_1 \mapsto \tau_1, \ldots, \alpha_n \mapsto \tau_n]\tau}{\sigma \succeq \tau'} \quad (\text{Inst})$$

**Generalization.** A monotype $\tau$ can be *generalized* over variables not free in the environment:

$$\text{Gen}(\Gamma, \tau) = \forall (\text{FV}(\tau) \setminus \text{FV}(\Gamma)).\; \tau$$

**Example:** If $\Gamma = \{y : \texttt{int}\}$ and $\tau = \alpha \to \texttt{int}$, then $\text{Gen}(\Gamma, \tau) = \forall \alpha.\; \alpha \to \texttt{int}$.

### 3.3 Typing Rules

The HM typing judgment is $\Gamma \vdash e : \sigma$.

**Variables with instantiation:**

$$\frac{x : \sigma \in \Gamma \quad \sigma \succeq \tau}{\Gamma \vdash x : \tau} \quad (\text{HM-Var})$$

**Abstraction:**

$$\frac{\Gamma, x : \tau_1 \vdash e : \tau_2}{\Gamma \vdash \lambda x.\; e : \tau_1 \to \tau_2} \quad (\text{HM-Abs})$$

Note: in HM-Abs, $x$ is assigned a *monotype* $\tau_1$, not a type scheme. This is the **monomorphism restriction** on lambda-bound variables.

**Application:**

$$\frac{\Gamma \vdash e_1 : \tau_1 \to \tau_2 \quad \Gamma \vdash e_2 : \tau_1}{\Gamma \vdash e_1\; e_2 : \tau_2} \quad (\text{HM-App})$$

**Let-binding with generalization:**

$$\frac{\Gamma \vdash e_1 : \tau_1 \quad \Gamma, x : \text{Gen}(\Gamma, \tau_1) \vdash e_2 : \tau_2}{\Gamma \vdash \texttt{let}\; x = e_1\; \texttt{in}\; e_2 : \tau_2} \quad (\text{HM-Let})$$

### 3.4 Let-Polymorphism

The `let` rule is the key to polymorphism in HM. Consider:

```
let id = fun x -> x in
  (id 42, id true)
```

Without let-polymorphism (as in the simply-typed lambda calculus), `id` would be assigned a single monotype, say $\alpha \to \alpha$, and the first use would force $\alpha = \texttt{int}$, making the second use $\texttt{id true}$ a type error.

With let-polymorphism:
1. Infer $\texttt{id} : \alpha \to \alpha$.
2. Generalize: $\texttt{id} : \forall \alpha.\; \alpha \to \alpha$.
3. First use: instantiate with $\alpha \mapsto \texttt{int}$, get $\texttt{id} : \texttt{int} \to \texttt{int}$.
4. Second use: instantiate with $\alpha \mapsto \texttt{bool}$, get $\texttt{id} : \texttt{bool} \to \texttt{bool}$.

**Crucial distinction:** `let x = e1 in e2` generalizes the type of `e1`, but $(\lambda x.\; e_2)\; e_1$ does not. In the latter, $x$ is lambda-bound and restricted to a monotype.

---

## 4. Algorithm W (Damas-Milner)

### 4.1 The Algorithm

Algorithm W computes the principal type of an expression in the HM type system.

```
function W(gamma, expr) -> (Substitution, Type):
    match expr with
    | Var(x):
        if x not in gamma:
            error("Unbound variable: " + x)
        sigma := gamma(x)
        tau := instantiate(sigma)    // replace bound vars with fresh vars
        return (id, tau)

    | Abs(x, body):
        alpha := fresh_type_var()
        gamma' := gamma + {x : alpha}   // x gets monotype alpha
        (S, tau) := W(gamma', body)
        return (S, S(alpha) -> tau)

    | App(e1, e2):
        (S1, tau1) := W(gamma, e1)
        (S2, tau2) := W(S1(gamma), e2)
        alpha := fresh_type_var()
        S3 := unify(S2(tau1), tau2 -> alpha)
        return (S3 . S2 . S1, S3(alpha))

    | Let(x, e1, e2):
        (S1, tau1) := W(gamma, e1)
        gamma1 := S1(gamma)
        sigma := Gen(gamma1, tau1)     // generalize
        (S2, tau2) := W(gamma1 + {x : sigma}, e2)
        return (S2 . S1, tau2)

    | IntLit(n):
        return (id, int)

    | BoolLit(b):
        return (id, bool)

    | If(cond, then_e, else_e):
        (S1, t1) := W(gamma, cond)
        S1' := unify(t1, bool)
        S1'' := S1' . S1
        (S2, t2) := W(S1''(gamma), then_e)
        (S3, t3) := W((S2 . S1'')(gamma), else_e)
        S4 := unify(S3(t2), t3)
        return (S4 . S3 . S2 . S1'', S4(t3))

function instantiate(sigma):
    // sigma = forall a1...an. tau
    // replace each ai with a fresh type variable
    fresh := [a1 -> fresh_var(), ..., an -> fresh_var()]
    return fresh(tau)
```

### 4.2 Example Trace

Infer the type of $\texttt{let id} = \lambda x.\; x\; \texttt{in}\; \texttt{id}\; 42$.

1. $W(\emptyset, \texttt{let id} = \lambda x.\; x\; \texttt{in}\; \texttt{id}\; 42)$
2. First, $W(\emptyset, \lambda x.\; x)$:
   - Fresh $\alpha_1$. Environment $\Gamma' = \{x : \alpha_1\}$.
   - $W(\Gamma', x)$: lookup $x$, get $\alpha_1$. Return $(\text{id}, \alpha_1)$.
   - Return $(\text{id}, \alpha_1 \to \alpha_1)$.
3. $\tau_1 = \alpha_1 \to \alpha_1$. $\Gamma_1 = \text{id}(\emptyset) = \emptyset$. $\text{Gen}(\emptyset, \alpha_1 \to \alpha_1) = \forall \alpha_1.\; \alpha_1 \to \alpha_1$.
4. $W(\{\texttt{id} : \forall \alpha_1.\; \alpha_1 \to \alpha_1\}, \texttt{id}\; 42)$:
   - $W(\Gamma, \texttt{id})$: instantiate with fresh $\alpha_2$. Return $(\text{id}, \alpha_2 \to \alpha_2)$.
   - $W(\Gamma, 42)$: Return $(\text{id}, \texttt{int})$.
   - Unify $\alpha_2 \to \alpha_2$ with $\texttt{int} \to \alpha_3$ (fresh $\alpha_3$):
     - Unify $\alpha_2 = \texttt{int}$, then $\alpha_2 = \alpha_3$, so $\alpha_3 = \texttt{int}$.
   - $S_3 = [\alpha_2 \mapsto \texttt{int}, \alpha_3 \mapsto \texttt{int}]$. Return $(S_3, \texttt{int})$.
5. Final result: type is $\texttt{int}$.

---

## 5. Principal Types and Most General Unifiers

### 5.1 Principal Type Property

**Definition 5.1.** A type $\tau$ is a **principal type** of $e$ under $\Gamma$ if:
1. $\Gamma \vdash e : \tau$ (it is a valid typing), and
2. For every $\tau'$ such that $\Gamma \vdash e : \tau'$, there exists a substitution $S$ with $S(\tau) = \tau'$ (it is the most general).

**Theorem 5.1 (Damas-Milner, 1982).** Algorithm W computes principal types. That is, if $\Gamma \vdash e : \sigma$ for some type scheme $\sigma$, then $W(\Gamma, e)$ succeeds and returns $(S, \tau)$ such that $\text{Gen}(S(\Gamma), \tau)$ is a principal type scheme for $e$.

*Proof sketch.* The proof proceeds by structural induction on $e$.

**Base case (variables):** $W$ instantiates the type scheme from $\Gamma$ with fresh variables, producing the most general instance. Any other valid typing must be a substitution instance.

**Inductive case (application):** Suppose $e = e_1\; e_2$. By induction, $W$ computes principal types for $e_1$ and $e_2$. The unification step finds the MGU of the constraint $\tau_1 = \tau_2 \to \alpha$. Since the MGU is the most general solution, the composed substitution yields the most general type for the application.

**Inductive case (let):** By induction, $W$ computes the principal type $\tau_1$ for $e_1$. Generalization over variables not in $\Gamma$ produces the principal type scheme. The body $e_2$ is then checked under this most general scheme. $\square$

### 5.2 Decidability

**Theorem 5.2.** Type inference for the Hindley-Milner type system is decidable.

*Proof.* Algorithm W always terminates (it makes structural recursive calls on smaller subexpressions, and unification terminates by Theorem 2.1) and is complete (Theorem 5.1). $\square$

**Theorem 5.3 (Complexity).** Type inference for HM is DEXPTIME-complete in the worst case (Mairson, 1990). However, for practical programs (where type scheme sizes are bounded), it runs in nearly linear time.

The exponential blowup arises from nested `let`-expressions that double the size of types at each level:

```
let f0 = fun x -> (x, x) in
let f1 = fun y -> f0 (f0 y) in
let f2 = fun z -> f1 (f1 z) in
...
```

The type of $f_n$ has size $O(2^{2^n})$.

---

## 6. Constraint-Based Type Inference

### 6.1 Motivation

Algorithm W interleaves constraint generation and solving (unification). An alternative approach separates these phases:

1. **Generate** a set of type equality constraints from the program.
2. **Solve** the constraints using unification.

This separation offers advantages:
- Cleaner algorithm structure
- Better error reporting (all constraints visible before solving)
- Easier to extend with new features (subtyping, effects)

### 6.2 Constraint Generation

```
function generate(gamma, expr) -> (Type, ConstraintSet):
    match expr with
    | Var(x):
        tau := instantiate(gamma(x))
        return (tau, {})

    | Abs(x, body):
        alpha := fresh_type_var()
        (tau, C) := generate(gamma + {x : alpha}, body)
        return (alpha -> tau, C)

    | App(e1, e2):
        (tau1, C1) := generate(gamma, e1)
        (tau2, C2) := generate(gamma, e2)
        alpha := fresh_type_var()
        return (alpha, C1 U C2 U {tau1 = tau2 -> alpha})

    | Let(x, e1, e2):
        (tau1, C1) := generate(gamma, e1)
        S := solve(C1)                 // solve constraints for e1
        sigma := Gen(S(gamma), S(tau1))
        (tau2, C2) := generate(S(gamma) + {x : sigma}, e2)
        return (tau2, C2)              // C1 already solved

    | IntLit(_):
        return (int, {})

    | BoolLit(_):
        return (bool, {})
```

### 6.3 Constraint Solving

```
function solve(constraints) -> Substitution:
    S := id
    worklist := constraints
    while worklist is not empty:
        pick (tau1 = tau2) from worklist
        S' := unify(S(tau1), S(tau2))
        S := S' . S
        // Apply S' to remaining constraints
        update worklist with S'
    return S
```

### 6.4 HM(X): Parameterized Constraint-Based Inference

The framework **HM(X)** (Odersky, Sulzmann, Wehr, 1999) parameterizes HM type inference over an arbitrary constraint domain $X$. The constraint language determines what properties can be expressed:

- $X$ = equality constraints: standard HM
- $X$ = subtyping constraints: HM with subtyping
- $X$ = qualified constraints: Haskell type classes

---

## 7. Type Inference in Practice

### 7.1 ML and OCaml

OCaml implements HM with extensions:
- **Value restriction** (Wright, 1995): Only values (not arbitrary expressions) can be generalized. This ensures soundness in the presence of mutable references.
- **Relaxed value restriction** (Garrigue, 2004): Extends generalization to expressions that are "non-expansive."
- **Row polymorphism** for object types and polymorphic variants.

### 7.2 Haskell

Haskell extends HM with:
- **Type classes** (Wadler & Blott, 1989): Ad-hoc polymorphism via constrained type schemes $\forall \alpha.\; C(\alpha) \Rightarrow \tau$.
- **Higher-rank types** (with explicit annotations): `forall a. a -> a` as a first-class type.
- **Type families** and **GADTs**: Require local constraint solving beyond standard HM.

### 7.3 Rust

Rust uses a region-based type system with:
- Local type inference within function bodies (bidirectional).
- **Lifetime inference**: Inference of region/lifetime parameters.
- **Trait solving**: Similar to type class resolution.
- No inference of function signatures (they must be annotated).

### 7.4 The Value Restriction

Consider:

```ocaml
let r = ref [] in
r := [1];
List.hd (!r) + "hello"    (* Unsound without value restriction! *)
```

Without restriction, $r : \forall \alpha.\; \text{ref}(\alpha\;\text{list})$. The first use instantiates $\alpha = \texttt{int}$; the second instantiates $\alpha = \texttt{string}$. Both refer to the same mutable cell---unsound!

The **value restriction** prevents generalization of expressions that might have side effects (only syntactic values---variables, lambdas, constructors---may be generalized).

---

## 8. Extensions and Limitations

### 8.1 Recursive Types

Adding equi-recursive types to HM requires dropping the occurs check in unification. The resulting system infers types but loses the principal type property in some cases.

### 8.2 Overloading

Standard HM does not support ad-hoc overloading. Solutions include:
- **Type classes** (Haskell): Principled overloading with instance resolution.
- **Implicits** (Scala): Resolution of implicit parameters.

### 8.3 Higher-Rank Polymorphism

HM restricts polymorphism to let-bindings. **Higher-rank polymorphism** allows polymorphic types in any position:

$$f : (\forall \alpha.\; \alpha \to \alpha) \to \texttt{int} \times \texttt{bool}$$

**Theorem 8.1 (Wells, 1999).** Type inference for System F (rank-$\omega$ polymorphism) is undecidable.

**Theorem 8.2 (Kfoury & Wells, 1999).** Type inference for rank-$k$ polymorphism with $k \geq 3$ is undecidable.

Type inference for rank-2 polymorphism is decidable (Kfoury & Wells, 1994).

---

## 9. Bidirectional Type Checking

**Bidirectional type checking** (Pierce & Turner, 2000) splits the typing judgment into two modes:

- **Checking mode** $\Gamma \vdash e \Leftarrow \tau$: Check that $e$ has the given type $\tau$.
- **Inference mode** $\Gamma \vdash e \Rightarrow \tau$: Infer the type of $e$.

```
function check(gamma, expr, expected_type):
    match expr with
    | Abs(x, body):
        match expected_type with
        | FunType(t1, t2):
            check(gamma + {x: t1}, body, t2)
        | _ -> error("Expected function type")
    | _:
        tau := infer(gamma, expr)
        unify(tau, expected_type)

function infer(gamma, expr):
    match expr with
    | Var(x):
        return instantiate(gamma(x))
    | App(e1, e2):
        tau1 := infer(gamma, e1)
        match tau1 with
        | FunType(t_arg, t_ret):
            check(gamma, e2, t_arg)
            return t_ret
        | _ -> error("Not a function")
    | Annotated(e, tau):
        check(gamma, e, tau)
        return tau
    | _:
        error("Cannot infer type; annotation needed")
```

**Advantages:**
- Naturally handles higher-rank types with annotations.
- Better error messages (expected types propagate inward).
- Modular: easy to add new constructs.

---

## 10. Summary

| Concept | Key Idea |
|---------|----------|
| Substitution | Maps type variables to types |
| Unification | Find MGU of two types |
| Occurs check | Prevents infinite types |
| HM type system | Monotypes + let-polymorphism |
| Algorithm W | Combines traversal with unification |
| Principal type | Most general valid typing |
| Constraint-based | Separate generation from solving |
| Value restriction | Prevent unsound generalization with effects |
| Bidirectional | Checking + inference modes |

---

## References

1. Milner, R. (1978). "A Theory of Type Polymorphism in Programming." *Journal of Computer and System Sciences*, 17(3), 348--375.
2. Damas, L. & Milner, R. (1982). "Principal Type-Schemes for Functional Programs." *POPL*, 207--212.
3. Robinson, J.A. (1965). "A Machine-Oriented Logic Based on the Resolution Principle." *JACM*, 12(1), 23--41.
4. Hindley, R. (1969). "The Principal Type-Scheme of an Object in Combinatory Logic." *Transactions of the AMS*, 146, 29--60.
5. Mairson, H.G. (1990). "Deciding ML Typability is Complete for Deterministic Exponential Time." *POPL*, 382--401.
6. Wright, A.K. (1995). "Simple Imperative Polymorphism." *Lisp and Symbolic Computation*, 8(4), 343--355.
7. Pierce, B.C. & Turner, D.N. (2000). "Local Type Inference." *ACM TOPLAS*, 22(1), 1--44.
8. Odersky, M., Sulzmann, M., & Wehr, M. (1999). "Type Inference with Constrained Types." *TAPOS*, 5(1), 35--55.
9. Wells, J.B. (1999). "Typability and Type Checking in System F are Equivalent and Undecidable." *Annals of Pure and Applied Logic*, 98(1--3), 111--156.
