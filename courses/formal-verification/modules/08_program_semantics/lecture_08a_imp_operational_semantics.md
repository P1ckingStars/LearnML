# Lecture 08a: The IMP Language and Operational Semantics

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the abstract syntax of IMP (arithmetic expressions, boolean expressions, commands) as Isabelle datatypes.
2. **Formalize** big-step operational semantics as an inductive relation in Isabelle/HOL.
3. **Formalize** small-step operational semantics and its reflexive-transitive closure.
4. **Prove** determinism of IMP execution.
5. **State** and sketch the proof of equivalence between big-step and small-step semantics.

---

## 2. Motivation

### 2.1 Why Study IMP?

IMP is a minimal imperative programming language --- a "while language" with integer variables, arithmetic, boolean guards, sequential composition, conditionals, and loops. It is deliberately simple: it has no procedures, no pointers, no exceptions, and no concurrency.

Why study such a toy language?

1. **It captures the essence of imperative computation.** While, assignment, and sequencing are the core constructs of every imperative language.
2. **It is small enough to formalize completely.** We can define its syntax, semantics, and program logic in Isabelle/HOL without getting lost in engineering details.
3. **It is the foundation for scaling up.** The SIMPL framework (Lecture 08c) extends IMP to handle procedures, exceptions, and guards. The C verification pipeline targets SIMPL.

### 2.2 Following Concrete Semantics

This lecture closely follows Nipkow and Klein's *Concrete Semantics* (2014), which formalizes IMP and its metatheory entirely in Isabelle/HOL. The formalization is available as the `HOL-IMP` session in the Isabelle distribution.

---

## 3. Abstract Syntax

### 3.1 States

A *state* maps variable names to integer values:

```isabelle
type_synonym vname = string
type_synonym val = int
type_synonym state = "vname => val"
```

States are total functions: every variable has a value (defaulting to 0 for undeclared variables).

### 3.2 Arithmetic Expressions

```isabelle
datatype aexp =
    N int           -- integer constant
  | V vname         -- variable reference
  | Plus aexp aexp  -- addition
```

The evaluation function is straightforward:

```isabelle
fun aval :: "aexp => state => val" where
  "aval (N n) s = n"
| "aval (V x) s = s x"
| "aval (Plus a1 a2) s = aval a1 s + aval a2 s"
```

**Example.** `aval (Plus (V ''x'') (N 3)) (\<lambda>_. 0)(''x'' := 5)` evaluates to `8`.

### 3.3 Boolean Expressions

```isabelle
datatype bexp =
    Bc bool           -- boolean constant (True/False)
  | Not bexp          -- negation
  | And bexp bexp     -- conjunction
  | Less aexp aexp    -- strict less-than comparison
```

```isabelle
fun bval :: "bexp => state => bool" where
  "bval (Bc v) s = v"
| "bval (Not b) s = (\<not> bval b s)"
| "bval (And b1 b2) s = (bval b1 s \<and> bval b2 s)"
| "bval (Less a1 a2) s = (aval a1 s < aval a2 s)"
```

### 3.4 Commands

```isabelle
datatype com =
    SKIP                    -- do nothing
  | Assign vname aexp       ("_ ::= _" [1000, 61] 61)
  | Seq com com             ("_;; _" [60, 61] 60)
  | If bexp com com         ("IF _ THEN _ ELSE _" [0, 0, 61] 61)
  | While bexp com          ("WHILE _ DO _" [0, 61] 61)
```

The annotations in parentheses define concrete syntax (mixfix notation), so we can write:

```isabelle
"''x'' ::= Plus (V ''x'') (N 1)"
```

instead of `Assign ''x'' (Plus (V ''x'') (N 1))`.

**Example program.** Factorial of variable `x`, storing result in `y`:

```isabelle
definition factorial :: com where
  "factorial =
    ''y'' ::= N 1;;
    WHILE Less (N 0) (V ''x'') DO (
      ''y'' ::= Plus (V ''y'') (N 0);;  -- placeholder; real: y := y * x
      ''x'' ::= Plus (V ''x'') (N (-1))
    )"
```

(IMP as defined here lacks multiplication; we will add it as an exercise.)

---

## 4. Big-Step Operational Semantics

### 4.1 The Idea

Big-step (or *natural*) semantics relates a command and initial state directly to the final state, skipping intermediate steps. The judgment $(c, s) \Rightarrow t$ means "executing command $c$ in state $s$ terminates in state $t$."

### 4.2 The Rules

The big-step semantics is defined as an inductive relation:

```isabelle
inductive big_step :: "com \<times> state \<Rightarrow> state \<Rightarrow> bool"
  (infix "\<Rightarrow>" 55) where
  Skip:
    "(SKIP, s) \<Rightarrow> s"
| Assign:
    "(x ::= a, s) \<Rightarrow> s(x := aval a s)"
| Seq:
    "\<lbrakk> (c1, s1) \<Rightarrow> s2; (c2, s2) \<Rightarrow> s3 \<rbrakk>
     \<Longrightarrow> (c1;; c2, s1) \<Rightarrow> s3"
| IfTrue:
    "\<lbrakk> bval b s; (c1, s) \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> (IF b THEN c1 ELSE c2, s) \<Rightarrow> t"
| IfFalse:
    "\<lbrakk> \<not> bval b s; (c2, s) \<Rightarrow> t \<rbrakk>
     \<Longrightarrow> (IF b THEN c1 ELSE c2, s) \<Rightarrow> t"
| WhileFalse:
    "\<not> bval b s
     \<Longrightarrow> (WHILE b DO c, s) \<Rightarrow> s"
| WhileTrue:
    "\<lbrakk> bval b s1; (c, s1) \<Rightarrow> s2; (WHILE b DO c, s2) \<Rightarrow> s3 \<rbrakk>
     \<Longrightarrow> (WHILE b DO c, s1) \<Rightarrow> s3"
```

### 4.3 Reading the Rules

- **Skip**: SKIP does nothing; the state is unchanged.
- **Assign**: Assignment evaluates the expression `a` in state `s` and updates variable `x`.
- **Seq**: Sequential composition executes `c1` first, producing intermediate state `s2`, then executes `c2`.
- **IfTrue/IfFalse**: Conditional branches on the boolean guard `b`.
- **WhileFalse**: If the guard is false, the loop terminates immediately.
- **WhileTrue**: If the guard is true, execute the body once, then repeat the loop.

### 4.4 Derivation Trees

A proof that $(c, s) \Rightarrow t$ is a *derivation tree*. For example, executing `x ::= N 5;; x ::= Plus (V ''x'') (N 1)` in the zero state:

```
                     aval (N 5) s = 5
                  ─────────────────────── Assign
                  (x ::= N 5, s) ⇒ s(x:=5)
                                                 aval (Plus (V x) (N 1)) s(x:=5) = 6
                                              ──────────────────────────────────────── Assign
                                              (x ::= Plus (V x) (N 1), s(x:=5)) ⇒ s(x:=6)
─────────────────────────────────────────────────────────────────────────────────────────────── Seq
(x ::= N 5;; x ::= Plus (V x) (N 1), s) ⇒ s(x:=6)
```

---

## 5. Determinism

### 5.1 Statement

**Theorem 5.1 (Determinism).** If $(c, s) \Rightarrow t_1$ and $(c, s) \Rightarrow t_2$, then $t_1 = t_2$.

### 5.2 Proof

```isabelle
theorem big_step_determ:
  "\<lbrakk> (c, s) \<Rightarrow> t; (c, s) \<Rightarrow> t' \<rbrakk> \<Longrightarrow> t = t'"
proof (induction arbitrary: t' rule: big_step.induct)
  case (Skip s)
  then show ?case by (auto elim: big_step.cases)
next
  case (Assign x a s)
  then show ?case by (auto elim: big_step.cases)
next
  case (Seq c1 s1 s2 c2 s3)
  from Seq.prems obtain s2' where
    "(c1, s1) \<Rightarrow> s2'" "(c2, s2') \<Rightarrow> t'"
    by (auto elim: big_step.cases)
  with Seq.IH have "s2' = s2" by blast
  with \<open>(c2, s2') \<Rightarrow> t'\<close> Seq.IH show "s3 = t'" by blast
next
  case (IfTrue b s c1 t c2)
  then show ?case by (auto elim: big_step.cases)
next
  case (IfFalse b s c2 t c1)
  then show ?case by (auto elim: big_step.cases)
next
  case (WhileFalse b s c)
  then show ?case by (auto elim: big_step.cases)
next
  case (WhileTrue b s1 c s2 s3)
  from WhileTrue.prems obtain s2' where
    "(c, s1) \<Rightarrow> s2'" "(WHILE b DO c, s2') \<Rightarrow> t'"
    using WhileTrue.hyps by (auto elim: big_step.cases)
  with WhileTrue.IH have "s2' = s2" by blast
  with \<open>(WHILE b DO c, s2') \<Rightarrow> t'\<close> WhileTrue.IH
  show "s3 = t'" by blast
qed
```

The proof uses *rule induction* on the first big-step derivation and case analysis on the second. The key insight is that for each rule, the second derivation must use the same rule (or a compatible one), and the intermediate states must agree by the induction hypothesis.

---

## 6. Small-Step Operational Semantics

### 6.1 The Idea

Small-step (or *structural operational*) semantics defines a single computation step. The judgment $(c, s) \to (c', s')$ means "command $c$ in state $s$ reduces in one step to command $c'$ in state $s'$."

### 6.2 The Rules

```isabelle
inductive small_step :: "com \<times> state \<Rightarrow> com \<times> state \<Rightarrow> bool"
  (infix "\<rightarrow>" 55) where
  Assign:
    "(x ::= a, s) \<rightarrow> (SKIP, s(x := aval a s))"
| Seq1:
    "(SKIP;; c2, s) \<rightarrow> (c2, s)"
| Seq2:
    "(c1, s) \<rightarrow> (c1', s')
     \<Longrightarrow> (c1;; c2, s) \<rightarrow> (c1';; c2, s')"
| IfTrue:
    "bval b s
     \<Longrightarrow> (IF b THEN c1 ELSE c2, s) \<rightarrow> (c1, s)"
| IfFalse:
    "\<not> bval b s
     \<Longrightarrow> (IF b THEN c1 ELSE c2, s) \<rightarrow> (c2, s)"
| While:
    "(WHILE b DO c, s) \<rightarrow>
     (IF b THEN c;; WHILE b DO c ELSE SKIP, s)"
```

### 6.3 Key Differences from Big-Step

1. **Intermediate configurations are visible.** The small-step relation exposes every step, making it suitable for reasoning about non-termination and concurrency.
2. **While unfolds once.** The While rule replaces the loop with a conditional that executes the body followed by the loop again.
3. **SKIP is a final command.** A configuration $(SKIP, s)$ is *stuck* (no further steps).

### 6.4 Multi-Step Execution

The reflexive-transitive closure captures full execution:

```isabelle
definition small_steps :: "com \<times> state \<Rightarrow> com \<times> state \<Rightarrow> bool"
  (infix "\<rightarrow>*" 55) where
  "cs \<rightarrow>* cs' \<longleftrightarrow> rtc (\<lambda>x y. x \<rightarrow> y) cs cs'"
```

A program $c$ *terminates* in state $t$ from state $s$ if $(c, s) \to^* (SKIP, t)$.

---

## 7. Equivalence of Big-Step and Small-Step

### 7.1 Statement

**Theorem 7.1.** $(c, s) \Rightarrow t \iff (c, s) \to^* (SKIP, t)$.

### 7.2 Proof Sketch: Big-Step Implies Small-Step

By rule induction on $(c, s) \Rightarrow t$:

- **Skip**: $(SKIP, s) \to^* (SKIP, s)$ by reflexivity.
- **Assign**: $(x ::= a, s) \to (SKIP, s(x := \text{aval}\,a\,s))$ in one step.
- **Seq**: By induction, $(c_1, s_1) \to^* (SKIP, s_2)$ and $(c_2, s_2) \to^* (SKIP, s_3)$. We need a key lemma:

**Lemma (Seq lifting).** If $(c_1, s) \to^* (SKIP, s')$, then $(c_1;; c_2, s) \to^* (c_2, s')$.

This is proved by induction on the small-step sequence, using the Seq2 rule to lift each step.

- **While**: Combine the If and Seq cases.

### 7.3 Proof Sketch: Small-Step Implies Big-Step

By induction on the length of the small-step sequence $(c, s) \to^* (SKIP, t)$:

- **Base case**: $c = SKIP$, $t = s$, and $(SKIP, s) \Rightarrow s$ by the Skip rule.
- **Step case**: $(c, s) \to (c', s') \to^* (SKIP, t)$. By induction, $(c', s') \Rightarrow t$. Now case-split on which small-step rule produced $(c, s) \to (c', s')$, and combine with $(c', s') \Rightarrow t$ using the big-step rules.

---

## 8. Non-Termination

### 8.1 Big-Step Semantics and Non-Termination

A command $c$ *diverges* from state $s$ if there is no $t$ with $(c, s) \Rightarrow t$. In big-step semantics, divergence is the absence of a derivation --- it is not explicitly represented.

**Example.** `WHILE Bc True DO SKIP` diverges from every state. There is no derivation tree because the WhileTrue rule would require a derivation for the loop again, leading to an infinite regression.

### 8.2 Small-Step Semantics and Non-Termination

In small-step semantics, divergence is an *infinite* reduction sequence:

$$(c_0, s_0) \to (c_1, s_1) \to (c_2, s_2) \to \cdots$$

that never reaches $(SKIP, t)$. This is representable as a coinductive object (infinite stream of configurations).

### 8.3 Why This Matters

For program verification:

- **Big-step** is simpler and sufficient for total correctness (terminating programs).
- **Small-step** is needed for reasoning about non-termination, concurrency, and interleaving.
- **Denotational semantics** (not covered in this course) provides a third perspective using fixed points.

---

## 9. The HOL-IMP Session

### 9.1 Theory Structure

The Isabelle session `HOL-IMP` contains:

| Theory | Content |
|---|---|
| `ASM.thy` | A simple stack machine (compilation target) |
| `AExp.thy` | Arithmetic expressions and evaluation |
| `BExp.thy` | Boolean expressions |
| `Com.thy` | Command syntax |
| `Big_Step.thy` | Big-step semantics |
| `Small_Step.thy` | Small-step semantics |
| `Compiler.thy` | Compilation to stack machine + correctness |
| `Hoare.thy` | Hoare logic (Lecture 08b) |
| `VCG.thy` | Verification condition generator |

### 9.2 Loading

```
isabelle jedit -l HOL-IMP
```

or in a theory file:

```isabelle
theory My_Theory
  imports "HOL-IMP.Big_Step"
begin
```

---

## 10. Key Takeaways

1. IMP has three syntactic categories: arithmetic expressions (`aexp`), boolean expressions (`bexp`), and commands (`com`).
2. Big-step semantics $(c, s) \Rightarrow t$ relates a command and initial state directly to the final state; it is defined inductively with 7 rules.
3. Small-step semantics $(c, s) \to (c', s')$ defines single computation steps; full execution is the reflexive-transitive closure.
4. Big-step and small-step are equivalent for terminating programs.
5. IMP is deterministic: if $(c, s) \Rightarrow t_1$ and $(c, s) \Rightarrow t_2$ then $t_1 = t_2$.
6. Everything is formalized in the `HOL-IMP` session of Isabelle/HOL.

---

## 11. Exercises

**Exercise 8a.1.** Extend IMP with a `Times aexp aexp` constructor for multiplication. Update `aval` accordingly. Then write the factorial program properly and trace its execution on input $x = 3$.

**Exercise 8a.2.** Prove that `SKIP;; c` and `c` are semantically equivalent: $(SKIP;; c, s) \Rightarrow t \iff (c, s) \Rightarrow t$.

**Exercise 8a.3.** Prove that `WHILE Bc True DO SKIP` has no big-step derivation from any state. *Hint:* use rule induction.

**Exercise 8a.4.** In the small-step semantics, trace the execution of `IF Less (V ''x'') (N 5) THEN ''x'' ::= N 5 ELSE SKIP` in a state where `x = 3`. List every configuration.

**Exercise 8a.5.** Prove the Seq lifting lemma: if $(c_1, s) \to^* (SKIP, s')$ then $(c_1;; c_2, s) \to^* (c_2, s')$.

---

## References

- Nipkow, T. and Klein, G. (2014). *Concrete Semantics with Isabelle/HOL*. Chapters 7--8.
- Winskel, G. (1993). *The Formal Semantics of Programming Languages*. MIT Press. Chapters 2--4.
- Plotkin, G.D. (1981). A structural approach to operational semantics. Technical Report DAIMI FN-19, Aarhus University.
