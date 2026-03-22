# Lecture 08c: The SIMPL Framework

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** why IMP is insufficient for real program verification and what SIMPL adds.
2. **Describe** SIMPL's language constructs: Basic, Seq, Cond, While, Call, Throw, Catch, Guard, Spec.
3. **Formalize** SIMPL programs with record-based state representations.
4. **State** the Hoare logic rules for SIMPL (partial and total correctness) and their soundness.
5. **Connect** SIMPL to the C verification pipeline (as a preview of Module 09).

---

## 2. Motivation: Beyond IMP

### 2.1 What IMP Lacks

IMP is a useful pedagogical tool, but real programming languages have features IMP cannot express:

| Feature | IMP | Real languages |
|---|---|---|
| Procedures/functions | No | Yes |
| Local variables | No | Yes |
| Exceptions | No | Yes (try/catch) |
| Pointers/heap | No | Yes |
| Guards/assertions | No | Yes (null checks, bounds checks) |
| Nondeterminism | No | Sometimes (concurrency, spec) |
| Abrupt termination | No | Yes (return, break, continue) |

### 2.2 SIMPL: A Generic Framework

SIMPL (Schirmer, 2005) is a *generic* imperative language framework in Isabelle/HOL. It parameterizes over:

- The state type (using records).
- The procedure environment (a mapping from procedure names to bodies).
- The fault type (for different kinds of runtime errors).

SIMPL serves as an intermediate language: source languages (C, for example) are translated into SIMPL, and verification is performed at the SIMPL level.

---

## 3. SIMPL Language Constructs

### 3.1 The Command Datatype

```isabelle
datatype ('s, 'p, 'f) com =
    Skip
  | Basic "'s => 's"                       -- state transformer
  | Seq "('s,'p,'f) com" "('s,'p,'f) com"  -- sequential composition
  | Cond "'s set" "('s,'p,'f) com"
                  "('s,'p,'f) com"          -- conditional
  | While "'s set" "('s,'p,'f) com"         -- while loop
  | Call 'p                                 -- procedure call
  | DynCom "'s => ('s,'p,'f) com"           -- dynamic command (state-dependent)
  | Guard 'f "'s set" "('s,'p,'f) com"      -- guarded command
  | Throw                                   -- raise exception
  | Catch "('s,'p,'f) com"
          "('s,'p,'f) com"                  -- exception handler
  | Spec "('s * 's) set"                    -- specification command
```

The type parameters are:
- `'s`: the state type
- `'p`: the procedure name type
- `'f`: the fault (error) type

### 3.2 Construct Explanations

**Basic.** A basic command applies a state transformer `f :: 's => 's`:

```isabelle
Basic (\<lambda>s. s\<lparr> x_' := x_' s + 1 \<rparr>)
```

This increments field `x_'` of the state record. Unlike IMP's `Assign`, Basic takes an arbitrary function, making it more flexible.

**Cond.** Conditional branching on a set (the "true" states):

```isabelle
Cond {s. x_' s > 0} c1 c2
```

Executes `c1` if the current state is in the set, `c2` otherwise.

**While.** Loop while the state is in a given set:

```isabelle
While {s. x_' s > 0} body
```

**Call.** Procedure call by name:

```isabelle
Call ''factorial''
```

The procedure body is looked up in the *procedure environment* $\Gamma : p \to (\text{s}, p, f)\, \text{com}$.

**Guard.** A guarded command checks a condition before executing:

```isabelle
Guard MemoryFault {s. ptr_' s \<noteq> NULL}
  (Basic (\<lambda>s. s\<lparr> val_' := deref (ptr_' s) \<rparr>))
```

If the state is in the guard set, execution proceeds normally. If not, the program *faults* with the given fault tag (here `MemoryFault`). Guards model runtime checks: null pointer dereferences, array bounds violations, integer overflow, etc.

**Throw and Catch.** Exception handling:

```isabelle
Catch
  (Seq (Basic f) Throw)    -- body that may throw
  (Basic handler)           -- exception handler
```

`Throw` causes an *abrupt* termination, which propagates upward until caught by a `Catch`. This models C's `longjmp`, C++ exceptions, or structured `return`/`break` statements.

**Spec.** A specification command nondeterministically produces any output state related to the input state by the given relation:

```isabelle
Spec {(s, t). t = s\<lparr> result_' := f (arg_' s) \<rparr>}
```

This is used for abstract specifications: "the result is $f$ applied to the argument." The actual implementation may compute $f$ in any way.

**DynCom.** A dynamic command whose behavior depends on the current state:

```isabelle
DynCom (\<lambda>s. if x_' s > 0 then c1 else c2)
```

---

## 4. State Representation

### 4.1 Records

SIMPL programs use Isabelle records for state:

```isabelle
record globals =
  heap_' :: "addr => val"
  ghost_' :: nat

record locals =
  x_' :: int
  y_' :: int
  ret_' :: int

record state = globals + locals +
  more :: unit
```

The trailing `_'` is a naming convention used by the C parser (not required by SIMPL itself).

### 4.2 State Updates

State transitions are record updates:

```isabelle
Basic (\<lambda>s. s\<lparr> x_' := x_' s + y_' s \<rparr>)  -- x = x + y
```

### 4.3 Separation of Concerns

The record structure separates:
- **Local variables** (per-procedure frame).
- **Global variables** (shared across procedures).
- **Ghost state** (for verification only, not present in the actual program).

---

## 5. Big-Step Semantics for SIMPL

### 5.1 Termination Modes

SIMPL's big-step semantics distinguishes four termination modes:

| Mode | Meaning |
|---|---|
| Normal $s$ | Normal termination in state $s$ |
| Abrupt $s$ | Abrupt termination (exception) in state $s$ |
| Fault $f$ | Runtime fault with tag $f$ |
| Stuck | Undefined behavior (no applicable rule) |

The semantic judgment is $\Gamma \vdash \langle c, s \rangle \Rightarrow t$ where $t$ is one of these four modes.

### 5.2 Selected Rules

```isabelle
inductive exec :: "('s,'p,'f) body => ('s,'p,'f) com =>
                   ('s,'f) xstate => ('s,'f) xstate => bool" where
  Skip:
    "\<Gamma> \<turnstile> \<langle>Skip, Normal s\<rangle> \<Rightarrow> Normal s"
| Basic:
    "\<Gamma> \<turnstile> \<langle>Basic f, Normal s\<rangle> \<Rightarrow> Normal (f s)"
| Seq:
    "\<lbrakk> \<Gamma> \<turnstile> \<langle>c1, Normal s\<rangle> \<Rightarrow> s';
       \<Gamma> \<turnstile> \<langle>c2, s'\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Seq c1 c2, Normal s\<rangle> \<Rightarrow> t"
| CondTrue:
    "\<lbrakk> s \<in> b; \<Gamma> \<turnstile> \<langle>c1, Normal s\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Cond b c1 c2, Normal s\<rangle> \<Rightarrow> t"
| CondFalse:
    "\<lbrakk> s \<notin> b; \<Gamma> \<turnstile> \<langle>c2, Normal s\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Cond b c1 c2, Normal s\<rangle> \<Rightarrow> t"
| WhileTrue:
    "\<lbrakk> s \<in> b; \<Gamma> \<turnstile> \<langle>c, Normal s\<rangle> \<Rightarrow> s';
       \<Gamma> \<turnstile> \<langle>While b c, s'\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>While b c, Normal s\<rangle> \<Rightarrow> t"
| WhileFalse:
    "s \<notin> b \<Longrightarrow> \<Gamma> \<turnstile> \<langle>While b c, Normal s\<rangle> \<Rightarrow> Normal s"
| Call:
    "\<lbrakk> \<Gamma> p = Some body; \<Gamma> \<turnstile> \<langle>body, Normal s\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Call p, Normal s\<rangle> \<Rightarrow> t"
| GuardTrue:
    "\<lbrakk> s \<in> g; \<Gamma> \<turnstile> \<langle>c, Normal s\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Guard f g c, Normal s\<rangle> \<Rightarrow> t"
| GuardFault:
    "s \<notin> g \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Guard f g c, Normal s\<rangle> \<Rightarrow> Fault f"
| Throw:
    "\<Gamma> \<turnstile> \<langle>Throw, Normal s\<rangle> \<Rightarrow> Abrupt s"
| CatchMatch:
    "\<lbrakk> \<Gamma> \<turnstile> \<langle>c1, Normal s\<rangle> \<Rightarrow> Abrupt s';
       \<Gamma> \<turnstile> \<langle>c2, Normal s'\<rangle> \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Catch c1 c2, Normal s\<rangle> \<Rightarrow> t"
| CatchMiss:
    "\<lbrakk> \<Gamma> \<turnstile> \<langle>c1, Normal s\<rangle> \<Rightarrow> t; \<not> isAbrupt t \<rbrakk>
     \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Catch c1 c2, Normal s\<rangle> \<Rightarrow> t"
```

### 5.3 Understanding the Stuck Mode

The `Stuck` mode deserves special attention because it is easy to confuse with `Fault`.

**Stuck** means there is *no semantic rule that applies*. The primary situation that produces Stuck is a `Call` to a procedure name that is not defined in the procedure environment Gamma:

```isabelle
| CallUndefined:
    "\<Gamma> p = None \<Longrightarrow> \<Gamma> \<turnstile> \<langle>Call p, Normal s\<rangle> \<Rightarrow> Stuck"
```

In other words, if the program tries to call a procedure `p` and `Gamma p = None`, execution gets *stuck*. There is no error tag --- it simply has no meaning.

**Stuck vs. Fault:**

| Situation | Mode | Meaning |
|---|---|---|
| Guard condition violated | Fault f | Runtime error (e.g., null deref, overflow) |
| Undefined procedure call | Stuck | Undefined behavior (no semantics at all) |

In the Hoare logic, a valid triple guarantees *both* the absence of Fault and the absence of Stuck. Concretely, the partial correctness judgment:

$$\Gamma \models \{P\}\, c\, \{Q\},\, \{A\}$$

requires: for all states $s$ satisfying $P$, if $\Gamma \vdash \langle c, \text{Normal}\; s \rangle \Rightarrow t$, then $t$ is either Normal (satisfying $Q$) or Abrupt (satisfying $A$) --- never Fault or Stuck.

This means that proving a Hoare triple for a program with procedure calls implicitly proves that every called procedure is defined in Gamma. When you use the C parser, Gamma is generated from the C translation unit, so every function that appears in the source has an entry. Stuck can only arise from calls to functions that were not parsed.

### 5.4 Propagation Rules

When a command is in a non-Normal state (Abrupt, Fault, or Stuck), most commands propagate it unchanged:

```isabelle
| FaultProp:
    "\<Gamma> \<turnstile> \<langle>c, Fault f\<rangle> \<Rightarrow> Fault f"
| StuckProp:
    "\<Gamma> \<turnstile> \<langle>c, Stuck\<rangle> \<Rightarrow> Stuck"
| AbruptProp:
    "\<Gamma> \<turnstile> \<langle>c, Abrupt s\<rangle> \<Rightarrow> Abrupt s"
```

---

## 6. Hoare Logic for SIMPL

### 6.1 The Triple

SIMPL's Hoare triple has the form:

$$\Gamma \vdash \{P\}\, c\, \{Q\},\, \{A\}$$

where:
- $P$: precondition (on Normal states).
- $Q$: postcondition for Normal termination.
- $A$: postcondition for Abrupt termination.

The triple is valid if: starting from any Normal state satisfying $P$, command $c$ either terminates normally in a state satisfying $Q$, terminates abruptly in a state satisfying $A$, or does not terminate (partial correctness). It never faults or gets stuck.

### 6.2 Selected Rules

```isabelle
Skip:
  "\<Gamma> \<turnstile> {P} Skip {P}, {A}"

Basic:
  "\<Gamma> \<turnstile> {\<lambda>s. Q (f s)} Basic f {Q}, {A}"

Seq:
  "\<lbrakk> \<Gamma> \<turnstile> {P} c1 {Q}, {A};
     \<Gamma> \<turnstile> {Q} c2 {R}, {A} \<rbrakk>
   \<Longrightarrow> \<Gamma> \<turnstile> {P} Seq c1 c2 {R}, {A}"

Guard:
  "\<lbrakk> \<Gamma> \<turnstile> {P \<inter> g} c {Q}, {A} \<rbrakk>
   \<Longrightarrow> \<Gamma> \<turnstile> {P \<inter> g} Guard f g c {Q}, {A}"

Throw:
  "\<Gamma> \<turnstile> {P} Throw {Q}, {P}"

Catch:
  "\<lbrakk> \<Gamma> \<turnstile> {P} c1 {Q}, {R};
     \<Gamma> \<turnstile> {R} c2 {Q}, {A} \<rbrakk>
   \<Longrightarrow> \<Gamma> \<turnstile> {P} Catch c1 c2 {Q}, {A}"

Call:
  "\<lbrakk> \<Gamma> p = Some body;
     \<Gamma> \<turnstile> {P} body {Q}, {A} \<rbrakk>
   \<Longrightarrow> \<Gamma> \<turnstile> {P} Call p {Q}, {A}"
```

### 6.3 Soundness and Completeness

**Theorem 6.1 (Schirmer, 2005).** SIMPL's Hoare logic is sound and (relatively) complete, for both partial and total correctness.

The soundness proof follows the same pattern as IMP's (rule induction on the Hoare derivation), but handles the additional termination modes and the procedure environment.

---

## 7. The VCG for SIMPL

### 7.1 Usage

SIMPL provides a VCG proof method:

```isabelle
lemma "\<Gamma> \<turnstile> {P} my_program {Q}, {A}"
  apply vcg
  -- subgoals are pure verification conditions
  apply auto
  done
```

The `vcg` method:
1. Unfolds the procedure bodies from $\Gamma$.
2. Applies the Hoare rules bottom-up.
3. Produces mathematical subgoals for the user to discharge.

### 7.2 Annotations

Loop invariants are provided via `whileAnno`:

```isabelle
whileAnno guard invariant variant body
```

The variant is used for total correctness proofs (proving termination).

---

## 8. Connection to C Verification

### 8.1 The C Parser

The seL4 verification pipeline (Module 09) works as follows:

$$\text{C source} \xrightarrow{\text{C parser}} \text{SIMPL program} \xrightarrow{\text{VCG}} \text{Verification conditions} \xrightarrow{\text{Isabelle}} \text{Proof}$$

The C parser (Park & Matthews) translates C code into SIMPL:

- C variables become record fields.
- C control flow (if, while, for, switch, goto, return, break) becomes SIMPL constructs.
- Pointer dereferences become Basic commands with Guard wrappers (for null checks).
- Function calls become Call commands.

### 8.2 Example: C to SIMPL

```c
int abs(int x) {
    if (x < 0) return -x;
    return x;
}
```

becomes approximately:

```isabelle
\<Gamma> ''abs'' = Some (
  Cond {s. x_' s < 0}
    (Seq (Basic (\<lambda>s. s\<lparr> ret_' := - x_' s \<rparr>)) (Throw))
    (Seq (Basic (\<lambda>s. s\<lparr> ret_' := x_' s \<rparr>)) (Throw))
)
```

Here `Throw` models `return` (an abrupt termination that exits the function).

### 8.3 Locale Structure Generated by the C Parser

An important detail for proof development: the C parser does not simply generate a single SIMPL definition. Instead, it generates an Isabelle **locale** parameterized over the procedure environment Gamma. Every SIMPL program produced by the parser lives inside this locale.

Concretely, for a C file `foo.c`, the parser produces:

```isabelle
locale foo_global_addresses
  (* addresses of global variables *)

locale foo_impl = foo_global_addresses +
  fixes \<Gamma> :: "('globals, 'p, strictc_errortype) body"
  assumes abs_body:
    "\<Gamma> ''abs'' = Some (Cond {s. x_' s < 0} ...)"
  assumes bar_body:
    "\<Gamma> ''bar'' = Some (...)"
  (* one assumption per C function *)
```

What this means for proof development:

1. **Gamma is abstract.** You never see a concrete definition `\<Gamma> = ...`. Instead, each function body is introduced as a locale *assumption*. When you write `apply vcg`, the VCG method uses these assumptions to unfold the procedure bodies.

2. **Proofs are inside the locale.** All your Hoare triple lemmas are proved *within* the locale context:

```isabelle
context foo_impl begin

lemma abs_correct:
  "\<Gamma> \<turnstile> {P} Call ''abs'' {Q}, {A}"
  apply vcg
  apply auto
  done

end
```

3. **Locale interpretation.** To use the verified properties outside the locale, you must *interpret* the locale by providing a concrete Gamma that satisfies all the assumptions. The C parser generates this interpretation automatically.

4. **Cross-function reasoning.** Because all functions share the same Gamma parameter, calling function `bar` from within the proof of `abs` works naturally: `vcg` looks up `\<Gamma> ''bar''` using the locale assumption for `bar`.

This locale-based design is what makes the SIMPL framework scale to large C codebases like the seL4 microkernel, where hundreds of functions must be verified together.

---

## 9. Worked Example: Verifying a SIMPL Program

We now work through a complete SIMPL verification from scratch. The program computes the absolute value of an integer, with a Guard to handle the edge case where `x = INT_MIN` (since `-INT_MIN` overflows in two's-complement arithmetic).

### 9.1 State Record

```isabelle
record abs_state =
  x_' :: "32 signed word"
  ret_' :: "32 signed word"
```

We use machine words (`32 signed word`) rather than mathematical integers to faithfully model C's integer semantics. The type `32 signed word` is a 32-bit signed integer with wrap-around arithmetic.

### 9.2 The SIMPL Program

```isabelle
definition abs_prog :: "(abs_state, 'p, strictc_errortype) com" where
  "abs_prog \<equiv>
    Guard SignedArithmetic
      {s. x_' s \<noteq> - 2147483648}    \<comment> \<open>guard: x \<noteq> INT_MIN\<close>
      (Cond {s. x_' s < 0}
        (Basic (\<lambda>s. s\<lparr> ret_' := - x_' s \<rparr>))
        (Basic (\<lambda>s. s\<lparr> ret_' := x_' s \<rparr>)))"
```

The Guard ensures we do not negate `INT_MIN`, which would be undefined behavior in C. If the guard is violated, execution terminates with `Fault SignedArithmetic` rather than producing a wrong result.

### 9.3 The Hoare Triple Specification

We want to prove: if the guard is satisfied, the result is the absolute value of `x`:

```isabelle
lemma abs_prog_correct:
  "\<Gamma> \<turnstile> {\<lambda>s. x_' s \<noteq> - 2147483648}
      abs_prog
     {\<lambda>s. ret_' s = (if x_' s < 0 then - x_' s else x_' s)},
     {}"
```

The abrupt postcondition is empty (`{}`, i.e., False) because the program never throws --- there is no `Throw` in the body.

### 9.4 Applying the VCG

```isabelle
  unfolding abs_prog_def
  apply vcg
```

After `apply vcg`, the VCG decomposes the program structure and produces two subgoals (one for each branch of the conditional):

**Subgoal 1** (the `then` branch, where `x < 0`):

```
\<And>s. \<lbrakk> x_' s \<noteq> - 2147483648; x_' s < 0 \<rbrakk>
  \<Longrightarrow> - x_' s = (if x_' s < 0 then - x_' s else x_' s)
```

**Subgoal 2** (the `else` branch, where `x >= 0`):

```
\<And>s. \<lbrakk> x_' s \<noteq> - 2147483648; \<not> x_' s < 0 \<rbrakk>
  \<Longrightarrow> x_' s = (if x_' s < 0 then - x_' s else x_' s)
```

Note that the VCG has:
- Consumed the Guard, adding `x_' s \<noteq> - 2147483648` as a hypothesis.
- Split the Cond into two branches, adding `x_' s < 0` or its negation as a hypothesis.
- Applied the Basic rule backward, substituting the state update into the postcondition.

### 9.5 Discharging the Subgoals

Both subgoals are straightforward conditional simplifications:

```isabelle
  apply simp_all
  done
```

The `simp_all` method evaluates the `if` expression in each subgoal using the hypothesis about the sign of `x`, closing both goals.

### 9.6 The Complete Proof

Putting it all together:

```isabelle
lemma abs_prog_correct:
  "\<Gamma> \<turnstile> {\<lambda>s. x_' s \<noteq> - 2147483648}
      abs_prog
     {\<lambda>s. ret_' s = (if x_' s < 0 then - x_' s else x_' s)},
     {}"
  unfolding abs_prog_def
  apply vcg
  apply simp_all
  done
```

This four-line proof is typical of SIMPL verification for straight-line code. The VCG does the heavy lifting --- decomposing the program structure and computing weakest preconditions --- and the user only has to discharge the resulting mathematical obligations.

### 9.7 What If the Guard Fails?

If we tried to prove the triple *without* the precondition `x_' s \<noteq> - 2147483648`, the VCG would still produce subgoals, but the Guard rule would require us to show that the current state is in the guard set. We would be stuck with an unprovable subgoal:

```
\<And>s. True \<Longrightarrow> x_' s \<noteq> - 2147483648
```

This is exactly the point: the Guard forces us to *prove the absence of overflow* as part of the verification. The C parser inserts guards for every potentially undefined C operation, so verifying any C function through SIMPL requires proving that no undefined behavior occurs.

---

## 10. The AFP Entry

SIMPL is available as the AFP entry *Simpl* by Norbert Schirmer. Key theories:

| Theory | Content |
|---|---|
| `Language.thy` | The command datatype |
| `Semantic.thy` | Big-step and small-step semantics |
| `HoarePartial.thy` | Partial correctness Hoare logic |
| `HoareTotal.thy` | Total correctness Hoare logic |
| `Vcg.thy` | The verification condition generator |
| `UserGuide.thy` | Tutorial and examples |

---

## 11. Key Takeaways

1. SIMPL extends IMP with procedures, exceptions (Throw/Catch), guards (runtime checks), and specification commands.
2. The state is represented as an Isabelle record, with fields for local/global variables.
3. SIMPL semantics has four termination modes: Normal, Abrupt, Fault, Stuck.
4. **Stuck** means an undefined procedure was called; **Fault** means a Guard was violated. Both are excluded by valid Hoare triples.
5. Hoare triples include both normal and abrupt postconditions: $\{P\}\, c\, \{Q\},\, \{A\}$.
6. SIMPL's Hoare logic is proved sound and relatively complete.
7. The C parser translates C source code into SIMPL programs inside a locale parameterized over Gamma.
8. The VCG decomposes SIMPL programs into pure mathematical subgoals; Guards produce proof obligations ensuring the absence of undefined behavior.

---

## 12. Exercises

**Exercise 8c.1.** Write a SIMPL program for absolute value (without using the C parser). Prove $\{True\}\; \text{abs}\; \{r = |x|\}$ using SIMPL's Hoare logic.

**Exercise 8c.2.** Explain the role of Guard in SIMPL. How does it model C's undefined behavior for null pointer dereferences?

**Exercise 8c.3.** Write a SIMPL program with exception handling: a function that throws if the input is negative, caught by a wrapper that returns 0 in that case. Verify the wrapper.

**Exercise 8c.4.** Compare SIMPL's Hoare triple $\{P\}\, c\, \{Q\},\, \{A\}$ with IMP's $\{P\}\, c\, \{Q\}$. Why is the abrupt postcondition $A$ necessary?

**Exercise 8c.5.** In the AFP, open `Simpl/UserGuide.thy`. Find the example of a recursive procedure and trace its verification.

---

## References

- Schirmer, N. (2005). A verification environment for sequential imperative programs in Isabelle/HOL. *PhD thesis*, Technische Universitat Munchen.
- Schirmer, N. (2006). Verification of sequential imperative programs in Isabelle/HOL. *AFP entry: Simpl*.
- Nipkow, T. and Klein, G. (2014). *Concrete Semantics*. Chapter 14 (brief discussion of extensions).
- Winwood, S., et al. (2009). Mind the gap: A verification framework for low-level C. *TPHOLs 2009*.
