# Lecture 08d: Monadic Verification and State Monads

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the nondeterministic state monad and its operations (return, bind, get, put, fail, assert).
2. **Write** specifications and implementations using monadic combinators.
3. **State** monadic Hoare triples and apply the weakest-precondition (wp) proof method.
4. **Explain** the exception-aware monad and the crunch tool.
5. **Connect** monadic specifications to SIMPL programs.

---

## 2. Motivation

### 2.1 Why Monads for Verification?

The seL4 verified microkernel (Module 09) is specified not as a SIMPL program but as a *monadic functional program*. This design choice has several advantages:

1. **Executability.** Monadic specifications can be executed (via code generation), enabling testing and simulation before formal verification.
2. **Modularity.** Monadic programs compose naturally via bind (`>>=`), enabling modular reasoning.
3. **Abstraction.** The monadic specification abstracts away from C-level details (pointer arithmetic, memory layout) while capturing the essential state transformations.
4. **Hoare reasoning.** Monadic programs support a natural Hoare logic with a weakest-precondition calculus.

### 2.2 The Architecture

In the seL4 verification, the layers are:

$$\text{Abstract specification (monadic)} \xrightarrow{\text{refinement}} \text{Executable specification (monadic)} \xrightarrow{\text{refinement}} \text{C implementation (SIMPL)}$$

This lecture covers the monadic framework used at the first two levels.

---

## 3. The Nondeterministic State Monad

### 3.1 Definition

The nondeterministic state monad captures computations that:
- Read and modify a state of type `'s`.
- May return a value of type `'a`.
- May produce multiple possible results (nondeterminism).
- May fail (representing an error or undefined behavior).

```isabelle
type_synonym ('s, 'a) nondet_monad = "'s => ('a \<times> 's) set \<times> bool"
```

A monadic computation takes an input state `s :: 's` and returns:
- A set of `(result, new_state)` pairs: all possible outcomes.
- A boolean *failure flag*: `True` if the computation might fail.

### 3.2 Why Nondeterminism?

Nondeterminism is essential for specifications:

1. **Under-specification.** A spec may allow multiple valid implementations. For example, "allocate a free memory page" can return any free page.
2. **Abstraction.** The abstract specification may leave scheduling order unspecified.
3. **Refinement.** A nondeterministic spec is refined by a deterministic implementation if the implementation's behavior is within the spec's allowed set.

### 3.3 Basic Operations

**Return.** Produce a value without changing state or failing:

```isabelle
definition return :: "'a => ('s, 'a) nondet_monad" where
  "return a \<equiv> \<lambda>s. ({(a, s)}, False)"
```

**Bind.** Sequence two computations; the second may depend on the result of the first:

The intuition: run `f` on the initial state, collect all (result, state) pairs, then for each pair run `g` on the result, and union everything together. If any step fails, the whole computation fails.

```isabelle
definition bind :: "('s, 'a) nondet_monad => ('a => ('s, 'b) nondet_monad)
                    => ('s, 'b) nondet_monad" where
  "bind f g \<equiv> \<lambda>s.
    (\<Union>(r, s') \<in> fst (f s). fst (g r s'),
     snd (f s) \<or> (\<exists>(r, s') \<in> fst (f s). snd (g r s')))"
```

The result set is the union of all result sets from `g` applied to each outcome of `f`. The computation fails if `f` fails or if any branch of `g` fails.

**Get.** Read the current state:

```isabelle
definition get :: "('s, 's) nondet_monad" where
  "get \<equiv> \<lambda>s. ({(s, s)}, False)"
```

**Put.** Replace the state:

```isabelle
definition put :: "'s => ('s, unit) nondet_monad" where
  "put s' \<equiv> \<lambda>_. ({((), s')}, False)"
```

**Modify.** Apply a function to the state:

```isabelle
definition modify :: "('s => 's) => ('s, unit) nondet_monad" where
  "modify f \<equiv> \<lambda>s. ({((), f s)}, False)"
```

**Fail.** Indicate a computation that always fails:

```isabelle
definition fail :: "('s, 'a) nondet_monad" where
  "fail \<equiv> \<lambda>_. ({}, True)"
```

**Assert.** Check a condition; fail if it does not hold:

```isabelle
definition assert :: "bool => ('s, unit) nondet_monad" where
  "assert P \<equiv> if P then return () else fail"
```

**Guard.** Check a state-dependent condition:

```isabelle
definition guard :: "('s => bool) => ('s, unit) nondet_monad" where
  "guard P \<equiv> \<lambda>s. if P s then ({((), s)}, False) else ({}, True)"
```

### 3.4 Derived Combinators

**Sequence and ignore result:**

```isabelle
definition seq :: "('s, 'a) nondet_monad => ('s, 'b) nondet_monad
                   => ('s, 'b) nondet_monad"  (infixl ">>" 61) where
  "f >> g \<equiv> f >>= (\<lambda>_. g)"
```

**Conditional:**

```isabelle
definition "when" :: "bool => ('s, unit) nondet_monad
                      => ('s, unit) nondet_monad" where
  "when P f \<equiv> if P then f else return ()"
```

**Nondeterministic choice (select):**

```isabelle
definition select :: "'a set => ('s, 'a) nondet_monad" where
  "select S \<equiv> \<lambda>s. ((\<lambda>x. (x, s)) ` S, S = {})"
```

Returns an arbitrary element of `S`; fails if `S` is empty.

### 3.5 The whileLoop Combinator

Loops are fundamental to imperative programs, and the monadic framework provides a dedicated combinator for them:

```isabelle
definition whileLoop ::
  "('a \<Rightarrow> 's \<Rightarrow> bool) \<Rightarrow>
   ('a \<Rightarrow> ('s, 'a) nondet_monad) \<Rightarrow>
   'a \<Rightarrow> ('s, 'a) nondet_monad"
```

The type parameters are:
- `'a`: the loop variable type (the value threaded through iterations).
- `'s`: the state type.
- The first argument is the *guard*: a predicate on the loop variable and state that determines whether to continue.
- The second argument is the *body*: given the current loop variable, produce a monadic computation that returns the next loop variable.
- The third argument is the *initial* loop variable.

**Intuition.** A C while loop:

```c
while (cond(r, s)) {
    r = body(r, s);
}
```

is modeled as `whileLoop (\<lambda>r s. cond r s) (\<lambda>r. body_monad r) r_init`.

**Example.** Counting down from `n` to `0`:

```isabelle
definition countdown :: "nat \<Rightarrow> ('s, nat) nondet_monad" where
  "countdown \<equiv> whileLoop (\<lambda>n s. n > 0) (\<lambda>n. return (n - 1))"
```

**The Key Proof Rule: whileLoop_wp.**

To verify a `whileLoop`, you supply a loop invariant, just as with SIMPL's While. The rule is:

```isabelle
lemma whileLoop_wp:
  "\<lbrakk> \<And>r. \<lbrace>\<lambda>s. I r s \<and> C r s\<rbrace> B r \<lbrace>I\<rbrace>;
     \<And>r s. \<lbrakk> I r s; \<not> C r s \<rbrakk> \<Longrightarrow> Q r s \<rbrakk>
   \<Longrightarrow> \<lbrace>I r\<rbrace> whileLoop C B r \<lbrace>Q\<rbrace>"
```

This says: if the invariant `I` is preserved by each iteration of the body `B` (when the guard `C` holds), and the invariant plus the negated guard implies the postcondition `Q`, then the triple holds. This is the monadic analogue of the standard while rule in Hoare logic.

For *total correctness* (proving termination), you additionally supply a well-founded measure:

```isabelle
lemma whileLoop_wp_inv:
  "\<lbrakk> \<And>r. \<lbrace>\<lambda>s. I r s \<and> C r s\<rbrace> B r \<lbrace>I\<rbrace>!;
     \<And>r s. \<lbrakk> I r s; C r s \<rbrakk> \<Longrightarrow> ((r', s'), (r, s)) \<in> R;
     wf R;
     \<And>r s. \<lbrakk> I r s; \<not> C r s \<rbrakk> \<Longrightarrow> Q r s \<rbrakk>
   \<Longrightarrow> \<lbrace>I r\<rbrace> whileLoop C B r \<lbrace>Q\<rbrace>!"
```

Here `R` is a well-founded relation on `('a \<times> 's)` pairs. You must show that each iteration strictly decreases the measure, guaranteeing termination. The `!` notation for total correctness is explained in Section 4.3.

### 3.6 Monad Laws

The nondeterministic state monad satisfies the standard monad laws:

```isabelle
lemma return_bind: "return a >>= f = f a"
lemma bind_return: "f >>= return = f"
lemma bind_assoc: "(f >>= g) >>= h = f >>= (\<lambda>x. g x >>= h)"
```

---

## 4. Monadic Hoare Triples

### 4.1 Definition

A monadic Hoare triple $\{P\}\, f\, \{Q\}$ states: if the precondition $P$ holds on the initial state, then (1) $f$ does not fail, and (2) for every (result, final state) pair produced by $f$, the postcondition $Q$ holds. Note that non-failure is a *guarantee* of the triple, not an assumption.

```isabelle
definition valid :: "('s => bool) => ('s, 'a) nondet_monad =>
                     ('a => 's => bool) => bool"
  ("\<lbrace>_\<rbrace> _ \<lbrace>_\<rbrace>") where
  "\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace> \<equiv>
    \<forall>s. P s \<longrightarrow> (\<forall>(r, s') \<in> fst (f s). Q r s') \<and> \<not> snd (f s)"
```

Note:
- $P :: s \Rightarrow \text{bool}$ is a precondition on the state.
- $Q :: a \Rightarrow s \Rightarrow \text{bool}$ is a postcondition on the return value and final state.
- The failure flag `snd (f s)` must be False: the computation must not fail.

### 4.2 Example

```isabelle
lemma "\<lbrace>\<lambda>s. x_' s > 0\<rbrace>
         modify (\<lambda>s. s\<lparr> x_' := x_' s - 1 \<rparr>)
       \<lbrace>\<lambda>_ s. x_' s \<ge> 0\<rbrace>"
  unfolding valid_def modify_def
  by auto
```

### 4.3 Total Correctness: validNF

The `valid` predicate from Section 4.1 establishes *partial correctness*: if the precondition holds, then every result satisfies the postcondition, and the computation does not fail. However, `valid` does not guarantee *termination*. A computation that loops forever vacuously satisfies `valid` because there are no result pairs to check.

For total correctness, the monadic framework provides `validNF` (valid with No Failure, including termination):

```isabelle
definition validNF :: "('s \<Rightarrow> bool) \<Rightarrow> ('s, 'a) nondet_monad \<Rightarrow>
                        ('a \<Rightarrow> 's \<Rightarrow> bool) \<Rightarrow> bool"
  ("\<lbrace>_\<rbrace> _ \<lbrace>_\<rbrace>!") where
  "\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>! \<equiv>
    \<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace> \<and> (\<forall>s. P s \<longrightarrow> fst (f s) \<noteq> {})"
```

The `!` suffix is the distinguishing notation. The definition conjoins two requirements:

1. **Partial correctness** (`\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>`): every result satisfies `Q`, and the computation does not fail.
2. **Non-emptiness** (`fst (f s) \<noteq> {}`): the computation produces at least one result. For a deterministic computation, this means it terminates. For a nondeterministic computation, it means at least one execution path terminates.

**When to use `valid` vs. `validNF`:**

| Property | `valid` (`\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>`) | `validNF` (`\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>!`) |
|---|---|---|
| Partial correctness | Yes | Yes |
| No failure | Yes | Yes |
| Termination | No | Yes |
| Use case | Most proofs; sufficient for safety properties | When you must prove the program halts |

In practice, most seL4 proofs use `valid` (partial correctness). Total correctness with `validNF` is used selectively --- for example, to prove that a scheduler loop always eventually returns, or that an allocation function does not diverge.

The wp rules for `validNF` mirror those for `valid` but carry the additional non-emptiness obligation. For `whileLoop`, this is where the well-founded measure (from Section 3.5) becomes essential.

---

## 5. The Weakest Precondition Method

### 5.1 wp Rules

The `wp` proof method works by applying *weakest precondition rules* bottom-up through the monadic program. Each combinator has a rule:

```isabelle
lemma wp_return: "\<lbrace>Q a\<rbrace> return a \<lbrace>Q\<rbrace>"
  by (simp add: valid_def return_def)

lemma wp_bind:
  "\<lbrakk> \<And>r. \<lbrace>R r\<rbrace> g r \<lbrace>Q\<rbrace>; \<lbrace>P\<rbrace> f \<lbrace>R\<rbrace> \<rbrakk>
   \<Longrightarrow> \<lbrace>P\<rbrace> f >>= g \<lbrace>Q\<rbrace>"
  by (auto simp: valid_def bind_def)

lemma wp_get: "\<lbrace>\<lambda>s. Q s s\<rbrace> get \<lbrace>Q\<rbrace>"
  by (simp add: valid_def get_def)

lemma wp_put: "\<lbrace>\<lambda>_. Q () s'\<rbrace> put s' \<lbrace>Q\<rbrace>"
  by (simp add: valid_def put_def)

lemma wp_modify: "\<lbrace>\<lambda>s. Q () (f s)\<rbrace> modify f \<lbrace>Q\<rbrace>"
  by (simp add: valid_def modify_def)

lemma wp_assert: "\<lbrace>\<lambda>s. P \<and> Q () s\<rbrace> assert P \<lbrace>Q\<rbrace>"
  by (simp add: valid_def assert_def return_def fail_def)

lemma wp_guard: "\<lbrace>\<lambda>s. G s \<and> Q () s\<rbrace> guard G \<lbrace>Q\<rbrace>"
  by (auto simp: valid_def guard_def)
```

### 5.2 Using wp

The `wp` method collects these rules and applies them automatically:

```isabelle
lemma "\<lbrace>\<lambda>s. x_' s = n \<and> n > 0\<rbrace>
         do
           x \<leftarrow> get;
           modify (\<lambda>s. s\<lparr> x_' := x_' s + 1 \<rparr>);
           return (x_' x)
         od
       \<lbrace>\<lambda>r s. r = n \<and> x_' s = n + 1\<rbrace>"
  by wp auto
```

The `do ... od` notation is syntactic sugar for nested `>>=` and `>>`.

### 5.3 How wp Works

The `wp` method processes the monadic program from bottom to top:

1. Start with the postcondition $Q$.
2. At each combinator, apply the corresponding wp rule to compute the weakest precondition.
3. When all combinators have been processed, the remaining goal is a pure logical implication between the user's precondition and the computed weakest precondition.

### 5.4 Relationship Between wp and vcg

Both `wp` (for monadic programs) and `vcg` (for SIMPL programs) are weakest-precondition-based proof methods. They serve the same conceptual purpose --- decomposing a program verification into pure mathematical subgoals --- but they target *different program representations*.

| Aspect | `wp` | `vcg` |
|---|---|---|
| Target | Monadic programs (`('s, 'a) nondet_monad`) | SIMPL programs (`('s, 'p, 'f) com`) |
| Triple | `\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>` | `\<Gamma> \<turnstile> {P} c {Q}, {A}` |
| Combinators | `return`, `>>=`, `modify`, `guard`, `whileLoop` | `Skip`, `Basic`, `Seq`, `Cond`, `While`, `Guard` |
| Rule set | `wp_return`, `wp_bind`, `wp_modify`, etc. | Built into the `vcg` tactic from `Vcg.thy` |
| Loop handling | `whileLoop_wp` (user supplies invariant) | `whileAnno` (user annotates with invariant) |
| Used at layer | Abstract and executable specifications | C implementation (via C parser) |

In the seL4 verification pipeline, a typical function is verified at three levels:

1. **Abstract spec** (monadic): verified using `wp`.
2. **Executable spec** (monadic): verified using `wp`, then shown to refine the abstract spec.
3. **C implementation** (SIMPL): verified using `vcg`, then shown to refine the executable spec.

The refinement proofs (using `corres`, see Section 8) bridge between the layers. A key practical consequence: you do *not* use `wp` and `vcg` in the same proof. They operate on different objects. If you are verifying a monadic program, use `wp`. If you are verifying a SIMPL program (produced by the C parser), use `vcg`.

---

## 6. Exception-Aware Monads

### 6.1 The Error Monad

Many specifications need to distinguish between successful results and errors. The error monad wraps the result in a sum type:

```isabelle
type_synonym ('s, 'e, 'a) nondet_monad_e =
  "('s, 'e + 'a) nondet_monad"
```

Here `'e + 'a` is:
- `Inl e` for an error/exception of type `'e`.
- `Inr a` for a successful result of type `'a`.

### 6.2 Error Monad Operations

```isabelle
definition throwError :: "'e => ('s, 'e, 'a) nondet_monad_e" where
  "throwError e \<equiv> return (Inl e)"

definition catchError :: "('s, 'e, 'a) nondet_monad_e =>
                          ('e => ('s, 'e, 'a) nondet_monad_e) =>
                          ('s, 'e, 'a) nondet_monad_e" where
  "catchError f handler \<equiv>
    f >>= (\<lambda>r. case r of Inl e => handler e | Inr a => return (Inr a))"

definition liftE :: "('s, 'a) nondet_monad => ('s, 'e, 'a) nondet_monad_e" where
  "liftE f \<equiv> f >>= (\<lambda>a. return (Inr a))"
```

### 6.3 Error Monad Hoare Triples

The Hoare triple for the error monad distinguishes success and error postconditions:

```isabelle
definition validE :: "('s => bool) => ('s, 'e, 'a) nondet_monad_e =>
                      ('a => 's => bool) => ('e => 's => bool) => bool"
  ("\<lbrace>_\<rbrace> _ \<lbrace>_\<rbrace>, \<lbrace>_\<rbrace>") where
  "\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>, \<lbrace>E\<rbrace> \<equiv>
    \<lbrace>P\<rbrace> f \<lbrace>\<lambda>r s. case r of Inl e => E e s | Inr a => Q a s\<rbrace>"
```

---

## 7. The crunch Tool

### 7.1 Motivation

In a large verification project, many functions must be shown to preserve certain properties. For example, "function $f$ does not modify the scheduler state" must be proved for every function in the call chain. Doing this manually for hundreds of functions is prohibitive.

### 7.2 How crunch Works

The `crunch` tool automatically proves that a property is preserved by a function *and all its callees*, by structural decomposition:

```isabelle
crunch my_function
  for inv: "my_invariant"
  (wp: wp_rules simp: simp_rules)
```

This generates and proves lemmas of the form:

```isabelle
lemma my_function_inv: "\<lbrace>my_invariant\<rbrace> my_function \<lbrace>\<lambda>_. my_invariant\<rbrace>"
```

It works by:
1. Unfolding `my_function` into its monadic definition.
2. Applying wp rules for each sub-expression.
3. Recursing into callees, proving the property for each.
4. Caching the results to avoid re-proving for shared callees.

### 7.3 Example

```isabelle
definition increment :: "('s, unit) nondet_monad" where
  "increment \<equiv> modify (\<lambda>s. s\<lparr> count_' := count_' s + 1 \<rparr>)"

definition double_increment :: "('s, unit) nondet_monad" where
  "double_increment \<equiv> increment >> increment"

crunch double_increment
  for other_field: "\<lambda>s. P (other_field_' s)"
```

The crunch tool proves that `double_increment` does not modify `other_field_'` by decomposing into `increment` and proving the property for `increment` first.

---

## 8. Connection to SIMPL

### 8.1 Monads and SIMPL

Monadic programs and SIMPL programs represent two views of the same computation:

| Aspect | Monadic | SIMPL |
|---|---|---|
| Style | Functional | Imperative |
| State | Implicit (via monad) | Explicit (state record) |
| Composition | `>>=` (bind) | Seq |
| Conditionals | `if` (Haskell-like) | Cond |
| Loops | Recursion or `whileM` | While |
| Errors | `throwError`/`catchError` | Throw/Catch |
| Guards | `guard` combinator | Guard |

### 8.2 Correspondence

A monadic program $f$ corresponds to a SIMPL program $c$ if they produce the same state transitions:

```isabelle
definition corres :: "('s => bool) => ('s, 'a) nondet_monad =>
                      ('s, 'p, 'f) com => bool" where
  "corres P f c \<equiv>
    \<forall>s. P s \<longrightarrow>
      (\<forall>(r, s') \<in> fst (f s). \<Gamma> \<turnstile> \<langle>c, Normal s\<rangle> \<Rightarrow> Normal s') \<and>
      (\<not> snd (f s) \<longrightarrow> (\<exists>t. \<Gamma> \<turnstile> \<langle>c, Normal s\<rangle> \<Rightarrow> t))"
```

This *correspondence* (or *refinement*) relation is the key linking the monadic specification to the C implementation via SIMPL.

---

## 9. Key Takeaways

1. The nondeterministic state monad `('s, 'a) nondet_monad` models stateful computations with possible nondeterminism and failure.
2. Monadic Hoare triples $\{P\}\, f\, \{Q\}$ state that $f$ preserves the relationship between pre- and postconditions and does not fail.
3. The `wp` method applies weakest-precondition rules bottom-up, reducing program verification to pure logic.
4. The error monad adds exception handling with `throwError` and `catchError`.
5. The `crunch` tool automatically propagates invariant-preservation proofs through call chains.
6. Monadic specifications correspond to SIMPL programs via refinement, bridging the gap between abstract specifications and C implementations.

---

## 10. Exercises

**Exercise 8d.1.** Prove the three monad laws (left unit, right unit, associativity) for the nondeterministic state monad.

**Exercise 8d.2.** Write a monadic program `swap` that swaps two fields `x_'` and `y_'` in the state record. Prove:
```isabelle
\<lbrace>\<lambda>s. x_' s = a \<and> y_' s = b\<rbrace> swap \<lbrace>\<lambda>_ s. x_' s = b \<and> y_' s = a\<rbrace>
```

**Exercise 8d.3.** Write a monadic program `lookup` that searches a list of key-value pairs for a given key, returning the value via the error monad (`throwError` if not found). Verify its correctness.

**Exercise 8d.4.** Explain why the `select` combinator models nondeterminism. What happens when the set argument is empty? How does this interact with the failure flag?

**Exercise 8d.5.** Describe how the `crunch` tool would propagate the invariant "scheduler state is unchanged" through a chain of 5 nested function calls. What happens if one of the functions *does* modify the scheduler state?

---

## References

- Cock, D., Klein, G., and Sewell, T. (2008). Secure microkernels, state monads and scalable refinement. *TPHOLs 2008*.
- Greenaway, D., Andronick, J., and Klein, G. (2014). Bridging the gap: Automatic verified abstraction of C. *ITP 2014*.
- Winwood, S., et al. (2009). Mind the gap: A verification framework for low-level C. *TPHOLs 2009*.
- Klein, G., et al. (2014). Comprehensive formal verification of an OS microkernel. *ACM TOCS*, 32(1).
