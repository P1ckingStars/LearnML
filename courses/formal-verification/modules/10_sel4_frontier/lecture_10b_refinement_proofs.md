# Lecture 10b: Refinement Proofs --- Abstract to C

> **Module 10 --- seL4, Refinement & Frontier**
> Estimated study time: 8--10 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe the three-layer architecture of the seL4 verification (abstract, executable/design, C).
2. Define forward simulation (refinement) and data refinement precisely.
3. Explain the `corres` framework for relating monadic computations at different abstraction levels.
4. Describe the monadic framework: nondeterministic state monad with exceptions, validity triples, and the wp calculus.
5. Explain the Haskell-to-Isabelle translation and the restrictions on the Haskell subset.
6. Identify the key proof engineering challenges and the tools used to address them (crunch, Eisbach).

---

## 1. The Three-Layer Architecture

### 1.1 Overview

The seL4 functional correctness proof establishes that the C implementation refines the abstract specification. This is not proved directly (the gap between the abstract spec and C is too large for a single proof). Instead, the proof proceeds through an intermediate layer:

```
Abstract Specification
    |
    | Refinement proof 1
    v
Executable (Design) Specification
    |
    | Refinement proof 2
    v
C Implementation (SIMPL)
```

Each layer serves a distinct purpose, and each refinement proof bridges a manageable gap.

### 1.2 Layer 1: The Abstract Specification

The abstract specification is a hand-written Isabelle/HOL model of the kernel's behavior. It specifies *what* the kernel does without saying *how*:

- System call semantics: what each system call produces as output and how it changes the kernel state.
- Object creation and deletion: what happens when a new kernel object (endpoint, page table, etc.) is allocated.
- Capability operations: how capabilities are copied, moved, derived, and revoked.
- Scheduling: which thread runs and when context switches occur.

The abstract specification uses a nondeterministic state monad, allowing underspecification where the concrete implementation has freedom (e.g., choosing which thread to schedule among equally eligible candidates).

**Entry point**: `Syscall_A.syscall` is the top-level abstract specification of system call handling.

```isabelle
definition syscall ::
  "event \<Rightarrow> (unit, 'z::state_ext) s_monad"
where
  "syscall ev \<equiv> do
     thread \<leftarrow> gets cur_thread;
     handle_event ev
   od"
```

The abstract state is a record containing:

```isabelle
record abstract_state =
  kheap :: "obj_ref \<Rightarrow> kernel_object option"
  cdt :: "cslot_ptr \<Rightarrow> cslot_ptr option"
  is_original_cap :: "cslot_ptr \<Rightarrow> bool"
  cur_thread :: obj_ref
  idle_thread :: obj_ref
  scheduler_action :: scheduler_action
  ready_queues :: "domain \<Rightarrow> priority \<Rightarrow> obj_ref list"
  (* ... more fields ... *)
```

The `kheap` is a partial function from object references to kernel objects. This is the most abstract representation: objects are directly addressable by reference, without any notion of physical memory layout, page tables, or C data structures.

### 1.3 Layer 2: The Executable (Design) Specification

The executable specification is written in a restricted subset of Haskell and automatically translated into Isabelle/HOL by a Python script (the `haskell-translator`).

This layer adds implementation detail:

- Data structure choices: CNodes are arrays of capability slots, page tables use two-level lookup, etc.
- Algorithm choices: the scheduler uses a priority bitmap, capability derivation uses a tree with mutable pointers, etc.
- Error handling: explicit exception types and error codes.

The Haskell code looks like real implementation code:

```haskell
-- Design specification of IPC send
sendIPC :: Bool -> Bool -> Word -> Bool ->
           PPtr TCB -> PPtr Endpoint -> Kernel ()
sendIPC blocking call badge canGrant thread epPtr = do
    ep <- getEndpoint epPtr
    case ep of
        IdleEP -> do
            when blocking $ do
                setThreadState (BlockedOnSend epPtr
                    (BlockedOnSendData blocking call badge canGrant)) thread
                setEndpoint epPtr (SendEP [thread])
        SendEP queue -> do
            when blocking $ do
                setThreadState (BlockedOnSend epPtr
                    (BlockedOnSendData blocking call badge canGrant)) thread
                setEndpoint epPtr (SendEP (queue ++ [thread]))
        RecvEP (dest : queue) -> do
            setEndpoint epPtr (case queue of
                [] -> IdleEP
                _  -> RecvEP queue)
            doIPCTransfer thread Nothing epPtr badge canGrant dest
            -- ... scheduling logic ...
```

**Restrictions on the Haskell subset**:

- No laziness: all computations are strict (important for reasoning about state).
- All functions must terminate: no unbounded recursion.
- No type classes beyond a fixed set.
- No concurrency primitives.
- A specific monad (`Kernel`) for stateful computations.

**The `haskell-translator`**: a Python script that converts the Haskell source into Isabelle/HOL definitions. It handles:

- Haskell pattern matching to Isabelle case expressions.
- Haskell `do` notation to Isabelle monadic bind.
- Haskell algebraic data types to Isabelle datatypes.
- Haskell type signatures to Isabelle type annotations.

The translator is part of the trusted base: any bug in the translator could introduce a discrepancy between the Haskell source and the Isabelle formalization. In practice, the translator is relatively simple (compared to a full Haskell compiler) and has been extensively tested.

### 1.4 Layer 3: The C Implementation

The C implementation is the actual seL4 kernel code, written in the StrictC subset of C99. It is parsed by the C parser (Lecture 09a) into SIMPL and then abstracted by AutoCorres (Lecture 09b).

The C layer adds:

- Memory layout: kernel objects are allocated in specific memory regions.
- Data representation: capabilities are packed into 64-bit words using bitfield operations.
- Pointer arithmetic: navigating page tables, CNode arrays, and TCB structures.
- Low-level optimizations: inlined functions, bitwise operations, cache-line-aligned structures.

---

## 2. Refinement

### 2.1 What Is Refinement?

Informally, a concrete system *refines* an abstract system if every behavior of the concrete system is a behavior permitted by the abstract system. The abstract system may permit more behaviors (nondeterminism), but the concrete system must not exhibit any behavior that the abstract system forbids.

**Definition 2.1 (Forward Simulation).** A *forward simulation* from abstract system $A$ to concrete system $C$ with respect to an abstraction relation $R$ is a proof that:

For every concrete state $c$ and abstract state $a$ related by $R(a, c)$, and every concrete step $c \to c'$, there exists an abstract state $a'$ such that $R(a', c')$ and $a \to a'$ (or $a \to^* a'$ for stuttering).

```
a -----> a'
|        |
R        R
|        |
c -----> c'
```

**Definition 2.2 (Data Refinement).** A *data refinement* is a forward simulation where the abstraction relation $R$ relates the data representations at different levels. For seL4:

- Between abstract and design: $R$ relates the abstract kernel heap to the Haskell-style data structures.
- Between design and C: $R$ relates the Haskell data structures to the C memory layout.

### 2.2 Why Forward Simulation Suffices

For deterministic systems, forward simulation is both necessary and sufficient for trace inclusion (every concrete trace is an abstract trace). For nondeterministic systems, forward simulation is sufficient but not necessary --- backward simulation is the full converse.

seL4 uses forward simulation because:

- The abstract specification is nondeterministic (underspecified), and the concrete implementation resolves the nondeterminism.
- Forward simulation is easier to prove: you follow the concrete execution and find a matching abstract execution.
- For the seL4 case, forward simulation turns out to be sufficient.

### 2.3 Refinement in Isabelle

The `corres` predicate captures refinement between monadic computations:

```isabelle
definition corres ::
  "('s \<Rightarrow> 't \<Rightarrow> bool) \<Rightarrow>       (* state relation *)
   ('a \<Rightarrow> 'b \<Rightarrow> bool) \<Rightarrow>       (* return value relation *)
   ('s \<Rightarrow> bool) \<Rightarrow>             (* abstract guard *)
   ('t \<Rightarrow> bool) \<Rightarrow>             (* concrete guard *)
   ('s, 'a) nondet_monad \<Rightarrow>   (* abstract computation *)
   ('t, 'b) nondet_monad \<Rightarrow>   (* concrete computation *)
   bool"
where
  "corres sr rv P Q a c \<equiv>
     \<forall>s t. sr s t \<and> P s \<and> Q t \<longrightarrow>
       (\<forall>(r', t') \<in> fst (c t).
          \<exists>(r, s') \<in> fst (a s). sr s' t' \<and> rv r r') \<and>
       (\<not> snd (a s) \<longrightarrow> \<not> snd (c t))"
```

This definition says:

1. **Forward simulation**: for every concrete result `(r', t')`, there exists a matching abstract result `(r, s')` such that the state relation `sr` and return value relation `rv` hold.
2. **Failure refinement**: if the abstract computation does not fail, neither does the concrete computation.

### 2.4 The `corres` Proof Rules

The `corres` framework provides compositional proof rules:

**Sequential composition (bind)**:

```isabelle
lemma corres_bind:
  "\<lbrakk> corres sr rv' P Q a c;
     \<And>x y. rv' x y \<Longrightarrow> corres sr rv (R x) (S y) (b x) (d y) \<rbrakk>
   \<Longrightarrow> corres sr rv P Q (a >>= b) (c >>= d)"
```

**Conditional**:

```isabelle
lemma corres_if:
  "\<lbrakk> G = G';
     G \<Longrightarrow> corres sr rv P Q a c;
     \<not>G \<Longrightarrow> corres sr rv P' Q' b d \<rbrakk>
   \<Longrightarrow> corres sr rv
     (\<lambda>s. (G \<longrightarrow> P s) \<and> (\<not>G \<longrightarrow> P' s))
     (\<lambda>t. (G' \<longrightarrow> Q t) \<and> (\<not>G' \<longrightarrow> Q' t))
     (if G then a else b) (if G' then c else d)"
```

**State lookup**:

```isabelle
lemma corres_gets:
  "(\<And>s t. sr s t \<Longrightarrow> rv (f s) (g t))
   \<Longrightarrow> corres sr rv \<top> \<top> (gets f) (gets g)"
```

These rules allow the refinement proof to be decomposed structurally, following the program's control flow.

---

## 3. The Monadic Framework

### 3.1 The Nondeterministic State Monad

All three specification layers use the same monadic framework, parameterized by the state type:

```isabelle
type_synonym ('s, 'a) nondet_monad = "'s \<Rightarrow> ('a \<times> 's) set \<times> bool"
```

A monadic computation takes an initial state `s` and produces:

- A set of `(result, final_state)` pairs: the possible outcomes (nondeterminism).
- A boolean `failed`: whether the computation may fail.

The monad operations:

```isabelle
definition return :: "'a \<Rightarrow> ('s, 'a) nondet_monad"
where "return x \<equiv> \<lambda>s. ({(x, s)}, False)"

definition bind :: "('s, 'a) nondet_monad \<Rightarrow> ('a \<Rightarrow> ('s, 'b) nondet_monad) \<Rightarrow>
                    ('s, 'b) nondet_monad"
where "bind f g \<equiv> \<lambda>s.
  (\<Union>(r, s') \<in> fst (f s). fst (g r s'),
   snd (f s) \<or> (\<exists>(r, s') \<in> fst (f s). snd (g r s')))"

definition fail :: "('s, 'a) nondet_monad"
where "fail \<equiv> \<lambda>s. ({}, True)"

definition get :: "('s, 's) nondet_monad"
where "get \<equiv> \<lambda>s. ({(s, s)}, False)"

definition put :: "'s \<Rightarrow> ('s, unit) nondet_monad"
where "put s' \<equiv> \<lambda>s. ({((), s')}, False)"
```

### 3.2 Validity Triples

The Hoare-logic style reasoning for monadic computations uses *validity triples*:

```isabelle
definition valid ::
  "('s \<Rightarrow> bool) \<Rightarrow> ('s, 'a) nondet_monad \<Rightarrow> ('a \<Rightarrow> 's \<Rightarrow> bool) \<Rightarrow> bool"
  ("\<lbrace>_\<rbrace> _ \<lbrace>_\<rbrace>")
where
  "\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace> \<equiv> \<forall>s. P s \<longrightarrow>
     (\<forall>(r, s') \<in> fst (f s). Q r s')"
```

This says: if precondition `P` holds in the initial state, then for every result `(r, s')` of `f`, the postcondition `Q r s'` holds.

The non-failure variant adds `\<not> snd (f s)`:

```isabelle
definition validNF ::
  "('s \<Rightarrow> bool) \<Rightarrow> ('s, 'a) nondet_monad \<Rightarrow> ('a \<Rightarrow> 's \<Rightarrow> bool) \<Rightarrow> bool"
  ("\<lbrace>_\<rbrace> _ \<lbrace>_\<rbrace>!")
where
  "\<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace>! \<equiv> \<lbrace>P\<rbrace> f \<lbrace>Q\<rbrace> \<and> (\<forall>s. P s \<longrightarrow> \<not> snd (f s))"
```

### 3.3 The wp Calculus

The weakest precondition calculus generates verification conditions automatically:

```isabelle
lemma wp_return: "\<lbrace>Q x\<rbrace> return x \<lbrace>Q\<rbrace>"

lemma wp_bind:
  "\<lbrakk> \<And>r. \<lbrace>R r\<rbrace> g r \<lbrace>Q\<rbrace>; \<lbrace>P\<rbrace> f \<lbrace>R\<rbrace> \<rbrakk>
   \<Longrightarrow> \<lbrace>P\<rbrace> f >>= g \<lbrace>Q\<rbrace>"

lemma wp_get: "\<lbrace>\<lambda>s. Q s s\<rbrace> get \<lbrace>Q\<rbrace>"

lemma wp_put: "\<lbrace>\<lambda>_. Q () s'\<rbrace> put s' \<lbrace>Q\<rbrace>"

lemma wp_if:
  "\<lbrakk> P \<Longrightarrow> \<lbrace>A\<rbrace> f \<lbrace>Q\<rbrace>; \<not>P \<Longrightarrow> \<lbrace>B\<rbrace> g \<lbrace>Q\<rbrace> \<rbrakk>
   \<Longrightarrow> \<lbrace>\<lambda>s. (P \<longrightarrow> A s) \<and> (\<not>P \<longrightarrow> B s)\<rbrace> if P then f else g \<lbrace>Q\<rbrace>"
```

The `wp` tactic applies these rules automatically, working backward from the postcondition to compute the weakest precondition.

---

## 4. The Two Refinement Proofs

### 4.1 Abstract to Executable (Refinement 1)

This proof shows that the Haskell-derived executable specification refines the hand-written abstract specification.

**State relation**: the `state_relation` predicate maps between the abstract state (with a simple kernel heap) and the design state (with specific data structures):

```isabelle
definition state_relation :: "abstract_state \<Rightarrow> design_state \<Rightarrow> bool"
where
  "state_relation a d \<equiv>
     pspace_relation (kheap a) (ksPSpace d) \<and>
     cdt_relation (cdt a) (cteMap d) \<and>
     cur_thread a = ksCurThread d \<and>
     scheduler_relation (scheduler_action a) (ksSchedulerAction d) \<and>
     (* ... many more conjuncts ... *)"
```

**Proof structure**: the proof follows the structure of the abstract and design specifications, which mirror each other. For each abstract function `f_A`, there is a corresponding design function `f_D`, and the proof shows `corres state_relation rv P Q f_A f_D`.

The proof for a single system call involves dozens of intermediate lemmas, one for each sub-function called during the system call handling.

### 4.2 Executable to C (Refinement 2)

This proof shows that the C implementation (parsed and abstracted) refines the executable specification. This is the harder of the two refinement proofs because:

- The gap between Haskell and C is larger than between the abstract and Haskell specs.
- The state relation must map Haskell data structures to C memory layouts.
- Pointer arithmetic, alignment, and memory management must be handled.

**State relation (ccorres)**: the `cstate_relation` maps between the Haskell state and the C state (after AutoCorres processing):

```isabelle
definition cstate_relation :: "design_state \<Rightarrow> c_globals \<Rightarrow> bool"
where
  "cstate_relation d c \<equiv>
     cpspace_relation (ksPSpace d) (t_hrs_' c) \<and>
     cready_queues_relation (ksReadyQueues d) (ksReadyQueues_' c) \<and>
     ksCurThread d = tcb_ptr_to_ctcb_ptr (ksCurThread_' c) \<and>
     (* ... many more conjuncts ... *)"
```

The `cpspace_relation` is particularly complex: it relates the Haskell kernel object map to the C heap, accounting for the specific memory layout of each kernel object type (TCBs, endpoints, CNodes, page tables, etc.).

---

## 5. Proof Engineering

### 5.1 The Crunch Tool

The `crunch` tool automatically propagates invariants through monadic call chains. Given a validity lemma like:

```isabelle
lemma f_preserves_P: "\<lbrace>P\<rbrace> f \<lbrace>\<lambda>_. P\<rbrace>"
```

Crunch can automatically prove similar lemmas for all functions that transitively call `f`, provided the callers do not themselves violate `P`:

```isabelle
crunch g, h, k
  for preserves_P: "P"
  (wp: f_preserves_P simp: some_simps)
```

This saves enormous amounts of manual proof effort. In the seL4 verification, crunch generates thousands of invariant-preservation lemmas automatically.

### 5.2 Eisbach

Eisbach is a proof method language for Isabelle that allows defining custom tactics. The seL4 proofs use Eisbach extensively to capture recurring proof patterns:

```isabelle
method corres_step =
  (rule corres_bind | rule corres_if | rule corres_gets | ...)

method solve_corres =
  (corres_step; solve_corres?) |
  (rule corres_trivial, clarsimp)
```

### 5.3 Maintenance

The seL4 proof must be maintained as the C code evolves. This is one of the biggest ongoing challenges:

- A small change to the C code (e.g., changing a data structure field) can break hundreds of proof lemmas.
- Changes to the abstract specification (e.g., adding a new system call) require changes at all three layers and both refinement proofs.
- The proof development uses continuous integration to catch breakage early.

Typical maintenance effort: fixing proof breakage from a kernel change takes 1--10 person-days, depending on the scope of the change.

---

## 6. Exercises

### Theory

**Exercise 10b.1.** Define forward simulation precisely for a simple transition system (a set of states $S$, initial states $I \subseteq S$, and transition relation $\to \subseteq S \times S$). Prove that forward simulation implies trace inclusion.

**Exercise 10b.2.** Explain why a two-step refinement (abstract -> design -> C) is preferable to a single-step refinement (abstract -> C). What are the trade-offs?

**Exercise 10b.3.** The `corres` predicate includes both a state relation and a return value relation. Why are both needed? Give an example where the return value relation is not the identity.

**Exercise 10b.4.** The Haskell-to-Isabelle translator is part of the trusted base. What could go wrong if the translator had a bug? How could you increase confidence in the translator?

**Exercise 10b.5.** The `crunch` tool propagates invariants through call chains. Explain informally why this is sound: why does preservation of `P` by all callees imply preservation of `P` by the caller?

### Isabelle

**Exercise 10b.6.** Define a simple abstract and concrete system as Isabelle datatypes with monadic transition functions. Prove a `corres` lemma relating them.

**Exercise 10b.7.** Prove the following `corres` rule for error handling:
```isabelle
lemma corres_catch:
  "\<lbrakk> corres sr rv P Q f g;
     \<And>e e'. rv_e e e' \<Longrightarrow> corres sr rv (R e) (S e') (h e) (k e') \<rbrakk>
   \<Longrightarrow> corres sr rv P Q (f <catch> h) (g <catch> k)"
```

---

## References

- Klein, G., et al. "seL4: Formal Verification of an OS Kernel." *SOSP*, 2009.
- Cock, D., Klein, G., Sewell, T. "Secure Microkernels, State Monads and Scalable Refinement." *TPHOLs*, 2008.
- Matichuk, D., Murray, T., Wenzel, M. "Eisbach: A Proof Method Language for Isabelle." *Journal of Automated Reasoning*, 56, 2016.
- Greenaway, D., Andronick, J., Klein, G. "Bridging the Gap." *ITP*, 2012.

---

*Next: [Lecture 10c: Binary Verification & Translation Validation](lecture_10c_binary_verification.md)*
