# Notation Reference

This document defines all notation used throughout the course. When in doubt, refer here. We distinguish between mathematical notation, Isabelle/Pure notation, Isabelle/ZF notation, and Isabelle/HOL notation.

## Logical Connectives (Mathematical)

| Notation | Meaning |
|----------|---------|
| P, Q, R | Propositions |
| P /\ Q | Conjunction (and) |
| P \/ Q | Disjunction (or) |
| ~P or not P | Negation |
| P --> Q | Implication |
| P <-> Q | Biconditional (iff) |
| forall x. P(x) | Universal quantification |
| exists x. P(x) | Existential quantification |

## Isabelle/Pure (Metalogic)

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Meta-forall | `\<And>x. P(x)` or `!!x. P(x)` | Universal quantification at the meta-level |
| Meta-implication | `P \<Longrightarrow> Q` or `P ==> Q` | Entailment at the meta-level |
| Meta-equality | `t \<equiv> s` or `t == s` | Definitional equality |
| Trueprop | `Trueprop(P)` | Coercion from object-logic to meta-logic (usually implicit) |

## Isabelle/ZF: Sets

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Membership | `x \<in> A` or `x : A` | x is a member of A |
| Non-membership | `x \<notin> A` | x is not a member of A |
| Empty set | `0` | The empty set |
| Unordered pair | `Upair(a,b)` | {a, b} |
| Singleton | `{a}` | cons(a, 0) |
| Cons | `cons(a, A)` | Upair(a,a) \<union> A |
| Ordered pair | `\<langle>a, b\<rangle>` or `<a, b>` | Kuratowski pair: {{a},{a,b}} |
| Successor | `succ(x)` | cons(x, x) = x \<union> {x} |
| Power set | `Pow(A)` | {x. x \<subseteq> A} |
| Union | `\<Union>(A)` or `Union(A)` | Union of all members of A |
| Binary union | `A \<union> B` or `A Un B` | {x. x \<in> A \<or> x \<in> B} |
| Binary intersection | `A \<inter> B` or `A Int B` | {x. x \<in> A \<and> x \<in> B} |
| Set difference | `A - B` | {x \<in> A. x \<notin> B} |
| Subset | `A \<subseteq> B` | forall x. x \<in> A --> x \<in> B |
| Cartesian product | `A \<times> B` or `A * B` | Sigma(A, \<lambda>_. B) |
| Sigma type | `Sigma(A, B)` | {p. fst(p) \<in> A \<and> snd(p) \<in> B(fst(p))} |
| Separation | `{x \<in> A. P(x)}` or `Collect(A, P)` | {x : x \<in> A and P(x)} |
| Replacement | `{f(x). x \<in> A}` or `RepFun(A, f)` | {f(x) : x \<in> A} |
| General replacement | `{y. x \<in> A, P(x,y)}` | PrimReplace(A, P) |
| Nat | `nat` | The set of natural numbers (omega) |

## Isabelle/ZF: Functions

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Function space | `A -> B` | Pi(A, \<lambda>_. B) |
| Dependent function | `Pi(A, B)` | Product of B(x) for x \<in> A |
| Lambda | `\<lambda>x\<in>A. b(x)` or `lam x:A. b(x)` | Function from A mapping x to b(x) |
| Application | `` f`a `` | Apply function f to argument a |
| Domain | `domain(f)` | {x. exists y. \<langle>x,y\<rangle> \<in> f} |
| Range | `range(f)` | {y. exists x. \<langle>x,y\<rangle> \<in> f} |
| Restriction | `restrict(f, A)` | f restricted to domain A |
| Composition | `r O s` | Relational composition |
| Injection | `inj(A, B)` | Injective functions from A to B |
| Surjection | `surj(A, B)` | Surjective functions from A to B |
| Bijection | `bij(A, B)` | Bijective functions from A to B |

## Isabelle/ZF: Ordinals & Cardinals

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Ordinal | `Ord(i)` | i is an ordinal |
| Less-than | `i < j` | i \<in> j \<and> Ord(j) |
| Less-or-equal | `i \<le> j` | i < j \<or> i = j |
| Limit ordinal | `Limit(i)` | Ord(i) \<and> 0 < i \<and> forall y. y < i --> succ(y) < i |
| Natural number | `n \<in> nat` | n is a natural number |
| Transfinite recursion | `transrec(a, H)` | Recursion over ordinals |
| Well-founded recursion | `wfrec(r, a, H)` | Recursion over well-founded r |
| Equipollence | `A \<approx> B` | There exists a bijection A -> B |
| Cardinal injection | `A \<lesssim> B` | There exists an injection A -> B |
| Strict cardinal ineq. | `A \<prec> B` | A \<lesssim> B \<and> ~(A \<approx> B) |
| Cardinality | `\|A\|` or `cardinal(A)` | The least ordinal equinumerous to A |
| Cardinal addition | `K \<oplus> L` | cadd(K, L) |
| Cardinal multiplication | `K \<otimes> L` | cmult(K, L) |
| Cardinal successor | `csucc(K)` | Least cardinal greater than K |

## Isabelle/ZF: Inductive Definitions

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Least fixed point | `lfp(D, h)` | Knaster-Tarski least fixed point of h in D |
| Greatest fixed point | `gfp(D, h)` | Greatest fixed point of h in D |
| Transitive closure | `r^+` | Transitive closure of relation r |
| Reflexive-trans closure | `r^*` | Reflexive-transitive closure |

## Isabelle/HOL Types

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Bool | `bool` | Booleans: True, False |
| Natural numbers | `nat` | 0, Suc 0, Suc (Suc 0), ... |
| Integers | `int` | Integers |
| List | `'a list` | Polymorphic lists |
| Option | `'a option` | None or Some x |
| Set | `'a set` | Predicate-based sets |
| Function type | `'a \<Rightarrow> 'b` or `'a => 'b` | Total function type |
| Product type | `'a \<times> 'b` or `'a * 'b` | Pair type |
| Sum type | `'a + 'b` | Disjoint sum |
| Type variable | `'a, 'b, 'c` | Polymorphic type variables |
| Machine word | `word32, word64` | Fixed-width integers |

## Isabelle/HOL: Hoare Logic

| Notation | Isabelle Syntax | Meaning |
|----------|----------------|---------|
| Hoare triple | `\<lbrace>P\<rbrace> c \<lbrace>Q\<rbrace>` | Partial correctness |
| Total correctness | `\<lbrace>P\<rbrace> c \<lbrace>Q\<rbrace>!` | Total correctness (termination + correctness) |
| Weakest precondition | `wp c Q` | Weakest precondition of c for postcondition Q |
| Valid (monadic) | `\<lbrace>\<lambda>s. P s\<rbrace> f \<lbrace>\<lambda>rv s. Q rv s\<rbrace>` | Monadic Hoare triple |

## Isar Proof Commands

| Command | Meaning |
|---------|---------|
| `lemma` / `theorem` | State a proposition to prove |
| `proof` / `qed` | Begin/end a structured proof block |
| `have` | Prove an intermediate fact |
| `show` | Prove the current goal |
| `assume` | Introduce an assumption |
| `fix` | Introduce a universally quantified variable |
| `obtain` | Extract a witness from an existential |
| `from ... have` | Chain a fact into the next step |
| `then` | Chain the previous fact |
| `moreover` / `ultimately` | Accumulate facts |
| `by (method)` | One-step proof |
| `using` | Supply additional facts |
| `sorry` | Skip a proof (for development only) |

## Proof Methods

| Method | Meaning |
|--------|---------|
| `simp` | Equational rewriting using `[simp]` rules |
| `auto` | Simplification + classical reasoning |
| `blast` | Tableau-based classical FOL |
| `force` / `fastforce` | Stronger auto variants |
| `rule` | Apply an introduction rule |
| `erule` | Apply an elimination rule |
| `drule` | Apply a destruction rule |
| `induct` | Structural or rule induction |
| `cases` | Case analysis |
| `subst` | Rewrite using an equation |
| `unfold` | Unfold a definition |
| `sledgehammer` | Call external ATPs (HOL only) |
| `vcg` | Verification condition generator |
| `wp` | Weakest precondition |

## Common Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| ZF | Zermelo-Fraenkel (without Choice) |
| ZFC | Zermelo-Fraenkel with Choice |
| HOL | Higher-Order Logic |
| FOL | First-Order Logic |
| IFOL | Intuitionistic First-Order Logic |
| AC | Axiom of Choice |
| CH | Continuum Hypothesis |
| GCH | Generalized Continuum Hypothesis |
| LCF | Logic for Computable Functions (architecture) |
| VCG | Verification Condition Generator |
| SIMPL | Sequential Imperative Programming Language |
| IMP | Simple imperative language (from Concrete Semantics) |
| AFP | Archive of Formal Proofs |
| ATP | Automated Theorem Prover |
| SMT | Satisfiability Modulo Theories |
| seL4 | Secure Embedded L4 (verified microkernel) |
| l4v | L4 Verified (seL4 proof repository) |
| CAmkES | Component Architecture for Microkernel-based Embedded Systems |
