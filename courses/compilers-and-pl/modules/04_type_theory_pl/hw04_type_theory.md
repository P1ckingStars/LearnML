# Homework 04: Type Theory & PL Foundations

**Due:** End of Week 8
**Total Points:** 100 (Part A: 50, Part B: 50)

---

## Part A: Theory (50 points)

### Problem 1: Lambda Calculus Reductions (12 points)

**(a)** (3 points) Reduce the following to normal form using normal-order evaluation. Show every step.

$$(\lambda f.\; \lambda x.\; f\; (f\; x))\; (\lambda y.\; y \times y)\; 3$$

**(b)** (3 points) Consider the term:

$$M = (\lambda x.\; \lambda y.\; x\; y\; y)\; (\lambda a.\; \lambda b.\; a)$$

Reduce $M$ to normal form. What well-known combinator does the result correspond to?

**(c)** (3 points) Prove that the following term has no normal form:

$$(\lambda x.\; x\; x\; x)\; (\lambda x.\; x\; x\; x)$$

Hint: Show that every reduction step produces a strictly larger term.

**(d)** (3 points) Convert the following lambda terms to de Bruijn notation:

1. $\lambda x.\; \lambda y.\; x\; (\lambda z.\; z\; y)$
2. $\lambda f.\; (\lambda x.\; f\; (x\; x))\; (\lambda x.\; f\; (x\; x))$ (Y combinator)

---

### Problem 2: Type Derivations and Type Safety (14 points)

**(a)** (4 points) Construct a full typing derivation for:

$$\vdash \lambda f:(\texttt{bool} \to \texttt{int}).\; \lambda x:\texttt{bool}.\; (f\; x) + (f\; (\texttt{not}\; x)) : ?$$

Assume $\texttt{not} : \texttt{bool} \to \texttt{bool}$ is in the initial environment.

**(b)** (4 points) Prove the following lemma:

**Lemma (Weakening).** If $\Gamma \vdash e : \tau$ and $x \notin \text{dom}(\Gamma)$, then $\Gamma, x:\sigma \vdash e : \tau$ for any type $\sigma$.

Prove by structural induction on the typing derivation.

**(c)** (6 points) Consider extending our language with a $\texttt{fix}$ operator for general recursion:

$$\frac{\Gamma \vdash e : \tau \to \tau}{\Gamma \vdash \texttt{fix}\; e : \tau} \quad (\text{T-Fix})$$

with evaluation rule:

$$\texttt{fix}\; (\lambda x:\tau.\; e) \to [x \mapsto \texttt{fix}\; (\lambda x:\tau.\; e)]e \quad (\text{E-Fix})$$

1. Prove that preservation still holds with the addition of T-Fix and E-Fix.
2. Does progress still hold? Prove it or provide a counterexample.
3. Does strong normalization still hold? Explain why or why not, and give a specific example.

---

### Problem 3: Curry-Howard Translations (12 points)

**(a)** (6 points) For each of the following propositions, either write a closed, well-typed lambda term that proves it, or argue that no such term exists (i.e., the proposition is not intuitionistically valid).

1. $(A \to B) \to (B \to C) \to (A \to C)$
2. $(A \to B \to C) \to (A \times B \to C)$ (currying, one direction)
3. $(A \times B \to C) \to (A \to B \to C)$ (currying, other direction)
4. $\neg(A \times B) \to (\neg A + \neg B)$ (one of De Morgan's laws)
5. $(\neg A + \neg B) \to \neg(A \times B)$ (the other direction)
6. $\neg\neg(A + \neg A)$ (double negation of excluded middle)

For items (4) and (6), think carefully about what is constructively provable.

**(b)** (6 points) The **Curry-Howard correspondence** associates proof normalization with beta-reduction.

1. Write the natural deduction proof of $(A \Rightarrow B) \Rightarrow (B \Rightarrow C) \Rightarrow (A \Rightarrow C)$ and the corresponding lambda term.
2. Create a "non-normal" (redundant) proof of $A \Rightarrow A$ that uses a detour through implication introduction and elimination. Write the corresponding lambda term.
3. Show that beta-reducing the term from (2) yields the normal proof $\lambda x.\; x$.

---

### Problem 4: Hoare Logic Proofs (12 points)

**(a)** (4 points) Prove the following Hoare triple using the rules of Hoare logic. Show the derivation tree.

$$\{x = a \wedge y = b\}\quad t := x;\; x := y;\; y := t \quad \{x = b \wedge y = a\}$$

**(b)** (4 points) Prove the following triple for integer square root:

```
{x >= 0}
r := 0;
while (r + 1) * (r + 1) <= x do
    r := r + 1
{r * r <= x /\ x < (r + 1) * (r + 1)}
```

State the loop invariant and prove that it is maintained.

**(c)** (4 points) Compute the weakest precondition:

$$\text{wp}(\texttt{if}\; x > 0\; \texttt{then}\; y := x\; \texttt{else}\; y := -x,\; y > 5)$$

Simplify the result.

---

## Part B: Implementation (50 points)

### Overview

Implement a **lambda calculus interpreter** with beta-reduction and type checking for the simply-typed lambda calculus. Your implementation should support:

1. Parsing lambda calculus expressions (a parser is provided).
2. Beta-reduction with multiple strategies.
3. Type checking for the simply-typed lambda calculus.
4. Detection of normal forms and divergence.

You may implement in OCaml, Haskell, Rust, Python, or Java.

### Language

```
expr ::= x                            (* variable *)
       | \x:type. expr                 (* abstraction with type annotation *)
       | expr expr                     (* application *)
       | (expr)                        (* grouping *)
       | let x = expr in expr          (* let binding *)
       | n                             (* integer literal *)
       | true | false                  (* boolean literals *)
       | if expr then expr else expr   (* conditional *)
       | expr + expr | expr * expr     (* arithmetic *)
       | fix expr                      (* fixed point *)

type ::= Int | Bool | type -> type | (type)
```

### Task 1: Beta-Reduction Engine (20 points)

Implement a reducer supporting multiple strategies:

```
val reduce : strategy -> expr -> expr option
    (* Returns Some e' if one step is possible, None if in normal form *)

type strategy = NormalOrder | ApplicativeOrder | CallByValue | CallByName
```

Requirements:

1. **(5 pts)** Implement capture-avoiding substitution. Handle all cases correctly (variable capture, alpha-renaming).

2. **(5 pts)** Implement **normal-order** reduction (leftmost outermost redex first).

3. **(5 pts)** Implement **call-by-value** reduction (evaluate arguments before applying, do not reduce under lambdas).

4. **(5 pts)** Implement a `normalize` function that repeatedly reduces until a normal form is reached or a step limit is exceeded:

```
val normalize : strategy -> int -> expr -> (expr, string) result
    (* normalize strategy max_steps expr *)
    (* Returns Ok normal_form or Error "step limit exceeded" *)
```

**Test cases:**

```
(* 1. Simple beta *)
(\x:Int. x) 42                          --> 42

(* 2. Nested reduction *)
(\f:Int->Int. \x:Int. f (f x)) (\y:Int. y + 1) 0  --> 2

(* 3. Divergence detection *)
(\x:Int->Int. x x) (\x:Int->Int. x x)  --> step limit exceeded

(* 4. Normal order finds normal form *)
(\x:Int. \y:Int. x) 42 ((\z:Int->Int. z z) (\z:Int->Int. z z))
    --> 42 (under normal order)
    --> step limit exceeded (under applicative order)

(* 5. Church encoding: 2 + 3 *)
(* Define plus, 2, 3 as Church numerals and verify plus 2 3 = 5 *)
```

### Task 2: Type Checker (15 points)

Implement a type checker for the simply-typed lambda calculus:

```
val typecheck : env -> expr -> ty result
```

Requirements:

1. **(5 pts)** Basic type checking: variables, literals, arithmetic, booleans, conditionals.
2. **(5 pts)** Function types: lambda abstraction and application.
3. **(5 pts)** Let bindings and the `fix` operator.

**Test cases:**

```
(* Well-typed *)
\x:Int. x + 1                              : Int -> Int
\f:Int->Bool. \x:Int. if f x then 1 else 0 : (Int->Bool) -> Int -> Int
let id = \x:Int. x in id 42                : Int

(* Ill-typed *)
42 true                                     : ERROR (not a function)
\x:Int. x + true                            : ERROR (type mismatch)
if 42 then 1 else 2                         : ERROR (condition not bool)
```

### Task 3: Pretty-Printing and Exploration (15 points)

**(a)** (5 pts) Implement a pretty-printer for lambda terms that:
- Uses minimal parentheses (respecting precedence and associativity).
- Alpha-renames bound variables to avoid shadowing in the output.

**(b)** (5 pts) Implement a **step-by-step tracer** that shows each reduction step with the redex highlighted:

```
> trace (\x. \y. x) ((\z. z) a) b
Step 1: (\x. \y. x) [(\z. z) a] b
        --> (\x. \y. x) a b           [beta: z -> a]
Step 2: [(\x. \y. x) a] b
        --> (\y. a) b                  [beta: x -> a]
Step 3: [(\y. a) b]
        --> a                          [beta: y -> b]
Normal form: a (3 steps)
```

**(c)** (5 pts) Implement Church numeral encoding and conversion:

```
val to_church : int -> expr       (* convert integer to Church numeral *)
val from_church : expr -> int option  (* attempt to convert back *)
```

Test by encoding `plus 2 3`, reducing, and converting back to verify the result is 5.

---

## Submission Guidelines

1. Submit all source files as a single archive.
2. Include a `Makefile` or build script.
3. Include a `README` describing your design decisions.
4. For Part A, submit a PDF with clearly formatted proofs.

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Lambda reductions | 12 | Correct step-by-step reductions |
| A2: Type derivations & safety | 14 | Complete derivation trees; rigorous proofs |
| A3: Curry-Howard | 12 | Correct terms or impossibility arguments |
| A4: Hoare logic | 12 | Correct invariants, complete proofs |
| B1: Reduction engine | 20 | Correct strategies, capture-avoiding substitution |
| B2: Type checker | 15 | Handles all cases, good error messages |
| B3: Pretty-printing & exploration | 15 | Minimal parens, step tracer, Church numerals |

---

## Bonus (up to 10 extra points)

1. **(3 pts)** Implement de Bruijn index representation and conversion to/from named representation.
2. **(3 pts)** Add eta-reduction and detect eta-redexes in addition to beta-redexes.
3. **(4 pts)** Implement a simple proof checker: given a proposition (type) and a proof (term), verify that the term inhabits the type. Provide a library of example propositions and their proofs.
