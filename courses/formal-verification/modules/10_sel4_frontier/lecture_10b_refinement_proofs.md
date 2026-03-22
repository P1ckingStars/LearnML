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

### 2.5 Guard Weakening

One more essential rule appears constantly in the proofs:

```isabelle
lemma corres_guard_imp:
  "\<lbrakk> corres sr rv P Q a c;
     \<And>s. P' s \<Longrightarrow> P s;
     \<And>t. Q' t \<Longrightarrow> Q t \<rbrakk>
   \<Longrightarrow> corres sr rv P' Q' a c"
```

This lets you strengthen the guards (add more assumptions) when the existing `corres` lemma has weaker guards than your current context provides. You will see `apply (rule corres_guard_imp)` near the start of almost every refinement proof --- it lets the prover set up the guard conditions and then focus on the correspondence itself.

---

## 3. Worked Example: A Simple corres Proof

To make the `corres` framework concrete, let us walk through a simplified but realistic refinement proof. We will relate an abstract "get current thread" operation to its design-level counterpart.

### 3.1 The Two Specifications

**Abstract specification** (from `Structures_A.thy` / `CurThread_A.thy`):

```isabelle
(* Abstract: read the current thread from the abstract state *)
definition get_cur_thread :: "(obj_ref, 'z::state_ext) s_monad"
where
  "get_cur_thread \<equiv> gets cur_thread"
```

This simply reads the `cur_thread` field from the abstract state record.

**Design specification** (from the Haskell translation):

```isabelle
(* Design: read the current thread from the design state *)
definition getCurThread :: "(machine_word, kernel_state) nondet_monad"
where
  "getCurThread \<equiv> gets ksCurThread"
```

This reads the `ksCurThread` field from the design state record.

### 3.2 The State Relation

The `state_relation` predicate includes, among many conjuncts:

```isabelle
definition state_relation :: "abstract_state \<Rightarrow> kernel_state \<Rightarrow> bool"
where
  "state_relation a d \<equiv>
     pspace_relation (kheap a) (ksPSpace d) \<and>
     cur_thread a = ksCurThread d \<and>              (* <-- the relevant conjunct *)
     idle_thread a = ksIdleThread d \<and>
     (* ... many more fields ... *)
     \<top>"
```

The key conjunct for our proof is `cur_thread a = ksCurThread d`: the abstract and design specifications store the current thread in corresponding fields, and the state relation requires them to agree.

### 3.3 The Lemma Statement

```isabelle
lemma get_cur_thread_corres:
  "corres (=) \<top> \<top> get_cur_thread getCurThread"
```

Reading this:
- **`corres`**: we are proving a correspondence.
- **`(=)`**: the return value relation is equality --- both sides must return the same value.
- **`\<top>`**: the abstract guard is trivially true (no precondition needed).
- **`\<top>`**: the concrete guard is also trivially true.
- **`get_cur_thread`**: the abstract monadic computation.
- **`getCurThread`**: the design monadic computation.

The state relation is implicit --- it is the global `state_relation` that `corres` uses in the seL4 development.

### 3.4 The Proof

```isabelle
lemma get_cur_thread_corres:
  "corres (=) \<top> \<top> get_cur_thread getCurThread"
  unfolding get_cur_thread_def getCurThread_def
  apply (rule corres_gets)
  apply (clarsimp simp: state_relation_def)
  done
```

Step by step:

1. **`unfolding get_cur_thread_def getCurThread_def`**: Unfold both definitions so the goal becomes:
   ```
   corres (=) \<top> \<top> (gets cur_thread) (gets ksCurThread)
   ```

2. **`apply (rule corres_gets)`**: Apply the `corres_gets` rule (from Section 2.4). This rule says that two `gets` computations correspond if their extraction functions produce related results under the state relation. After applying it, the goal becomes:
   ```
   \<And>s t. state_relation s t \<Longrightarrow> cur_thread s = ksCurThread t
   ```

3. **`apply (clarsimp simp: state_relation_def)`**: Unfold `state_relation_def` and simplify. Since `state_relation` includes the conjunct `cur_thread a = ksCurThread d`, this goal is immediate.

4. **`done`**: The proof is complete.

### 3.5 A Slightly More Complex Example

Now consider a function that reads state and then conditionally modifies it. Here is a simplified version of `rescheduleRequired`:

**Abstract**:

```isabelle
definition reschedule_required :: "(unit, 'z::state_ext) s_monad"
where
  "reschedule_required \<equiv> do
     action \<leftarrow> gets scheduler_action;
     case action of
       SwitchToThread t \<Rightarrow> tcb_sched_action tcb_sched_enqueue t
     | _ \<Rightarrow> return ();
     set_scheduler_action ChooseNewThread
   od"
```

**Design**:

```isabelle
definition rescheduleRequired :: "kernel_state \<Rightarrow> (unit \<times> kernel_state) set \<times> bool"
where
  "rescheduleRequired \<equiv> do
     action \<leftarrow> gets ksSchedulerAction;
     case action of
       SwitchToThread t \<Rightarrow> tcbSchedEnqueue t
     | _ \<Rightarrow> return ();
     setSchedulerAction ChooseNewThread
   od"
```

The refinement proof uses `corres_bind` to split the proof at each monadic bind:

```isabelle
lemma reschedule_required_corres:
  "corres dc (invs and valid_sched) invs'
     reschedule_required rescheduleRequired"
  unfolding reschedule_required_def rescheduleRequired_def
  apply (rule corres_bind)                  (* split at first >>= *)
    apply (rule corres_gets)                (* gets scheduler_action vs gets ksSchedulerAction *)
    apply (clarsimp simp: state_relation_def scheduler_relation_def)
   apply (rule corres_bind)                 (* split at second >>= *)
     apply (case_tac x; clarsimp)           (* case split on scheduler_action *)
      apply (rule tcb_sched_enqueue_corres)  (* use existing corres lemma *)
     apply (rule corres_return_trivial)
    apply (rule set_scheduler_action_corres) (* use existing corres lemma *)
    apply clarsimp
   apply (wp | clarsimp)+
  done
```

Key observations:

- **`dc`** as the return value relation means "don't care" --- the return value is `unit`, so any relation is fine.
- **`invs and valid_sched`** on the abstract side and **`invs'`** on the design side are the invariants that must hold.
- Each `corres_bind` application produces *two* sub-goals: one for the first computation and one for the continuation.
- Existing `corres` lemmas (`tcb_sched_enqueue_corres`, `set_scheduler_action_corres`) are applied to sub-goals involving library functions.
- **`wp`** (weakest precondition) is used to discharge the remaining guard obligations.

---

## 4. The C Refinement: ccorres

The second refinement step bridges the design specification (Haskell-derived monadic code) and the C implementation (represented as SIMPL programs). This uses a different correspondence predicate: `ccorres`.

### 4.1 Why a Separate Predicate?

The `corres` predicate relates two monadic computations operating on different state types. The C layer is fundamentally different: it is not a monadic computation in the same sense. Instead, the C code is represented as a SIMPL program (a structured imperative language with explicit state, as covered in Lecture 09a). The `ccorres` predicate bridges a monadic computation with a SIMPL program.

### 4.2 The ccorres Definition

```isabelle
definition ccorres ::
  "('a \<Rightarrow> 'b \<Rightarrow> bool)       (* rrel: return value relation *)
   \<Rightarrow> ('s \<Rightarrow> 'b)             (* xf: extraction function from C state *)
   \<Rightarrow> (kernel_state \<Rightarrow> bool) (* P: Haskell-side precondition *)
   \<Rightarrow> 's set                  (* P': C-side precondition, a set of C states *)
   \<Rightarrow> ('s, 'p, 'x) com list  (* hs: handler stack for exceptions *)
   \<Rightarrow> (kernel_state, 'a) nondet_monad  (* a: the monadic computation *)
   \<Rightarrow> ('s, 'p, 'x) com       (* c: the SIMPL program *)
   \<Rightarrow> bool"
```

Each parameter explained:

| Parameter | Type | Purpose |
|-----------|------|---------|
| `rrel` | `'a \<Rightarrow> 'b \<Rightarrow> bool` | Relates the monadic return value to the C return value |
| `xf` | `'s \<Rightarrow> 'b` | Extracts the return value from the C state (e.g., reading a local variable or register) |
| `P` | `kernel_state \<Rightarrow> bool` | Precondition on the Haskell (design) state |
| `P'` | `'s set` | Precondition on the C state, expressed as a set of valid states |
| `hs` | `com list` | Handler stack --- a list of SIMPL programs for exception handling |
| `a` | `nondet_monad` | The monadic (design) computation being refined |
| `c` | `com` | The SIMPL program that implements it |

The predicate asserts: if the Haskell state and C state are related (by `cstate_relation`), and the preconditions `P` and `P'` hold, then every execution of the SIMPL program `c` produces a C state that is related to some result of the monadic computation `a`, with the return values related by `rrel` and extracted by `xf`.

### 4.3 Common Abbreviations

Two abbreviations appear pervasively in `ccorres` lemmas:

**`dc` ("don't care")**:

```isabelle
abbreviation dc :: "'a \<Rightarrow> 'b \<Rightarrow> bool"
where "dc \<equiv> \<lambda>_ _. True"
```

Used as `rrel` when the return value is `unit` (or otherwise irrelevant). Most kernel operations return `unit`, so `dc` appears very frequently.

**`xfdc` ("extraction function don't care")**:

```isabelle
abbreviation xfdc :: "'s \<Rightarrow> unit"
where "xfdc \<equiv> \<lambda>_. ()"
```

Used as `xf` when there is no meaningful return value to extract from the C state. Paired with `dc` for void-returning C functions.

### 4.4 A Concrete ccorres Lemma

Here is a concrete (simplified) `ccorres` lemma for getting the current thread, relating the Haskell `getCurThread` to the C implementation:

```isabelle
lemma getCurThread_ccorres:
  "ccorres (\<lambda>rv rv'. rv = tcb_ptr_to_ctcb_ptr rv')
           ret__ptr_to_struct_tcb_C_'
           \<top>
           UNIV
           []
           getCurThread
           (Basic (\<lambda>s. globals_update
              (ret__ptr_to_struct_tcb_C_'_update
                (\<lambda>_. ksCurThread_' (globals s))) s))"
```

Reading this:

- **`rrel`**: The return value relation says the Haskell result `rv` equals the C result `rv'` after converting through `tcb_ptr_to_ctcb_ptr` (which adjusts for the fact that C points to the middle of the TCB struct, offset to the `tcb_C` sub-struct).
- **`ret__ptr_to_struct_tcb_C_'`**: The extraction function reads the `ret__ptr_to_struct_tcb_C` local variable from the C state.
- **`\<top>`**: No Haskell-side precondition.
- **`UNIV`**: No C-side precondition (all C states are acceptable).
- **`[]`**: Empty handler stack (no exception handling).
- **`getCurThread`**: The Haskell computation.
- **`Basic (\<lambda>s. ...)`**: The SIMPL program --- a basic (non-branching) statement that reads `ksCurThread_'` from global state.

### 4.5 The Proof Pattern for ccorres

Proofs of `ccorres` lemmas follow a characteristic pattern:

1. **Unfold the SIMPL program** into its constituent statements (assignments, conditionals, loops, function calls).
2. **Apply the Verification Condition Generator (VCG)** to produce proof obligations for each statement.
3. **Match each VCG obligation** against the corresponding step of the monadic computation.
4. **Discharge state-relation obligations** by appealing to `cstate_relation` and its component relations.

A simplified proof skeleton:

```isabelle
lemma someFunction_ccorres:
  "ccorres dc xfdc
     (invs' and tcb_at' t)
     (UNIV \<inter> {s. thread_' s = tcb_ptr_to_ctcb_ptr t})
     []
     (someFunction t)
     (Call someFunction_'proc)"
  unfolding someFunction_def
  apply (cinit lift: thread_')             (* initialize: lift C parameters *)
  apply (ctac add: getObject_tcb_ccorres)  (* C tactic: handle the first C call *)
   apply (ctac add: setObject_tcb_ccorres) (* handle the next C call *)
  apply (wp | clarsimp)+                   (* discharge wp obligations *)
  apply (clarsimp simp: cstate_relation_def cpspace_relation_def)
  done
```

Key tactics:
- **`cinit`**: Initializes the `ccorres` proof, lifting C function parameters into the proof context.
- **`ctac`**: The main workhorse --- applies existing `ccorres` lemmas for called functions, splitting the proof at each function call boundary.
- **`VCG`** (or `vcg`): Applies the Hoare-logic VCG for SIMPL to produce verification conditions.
- **`clarsimp simp: cstate_relation_def`**: Simplifies state-relation goals.

### 4.6 The C State Relation in Detail

The `cstate_relation` predicate maps between the design (Haskell) state and the C global state. Here is an expanded (but still simplified) view of its key components:

```isabelle
definition cstate_relation :: "kernel_state \<Rightarrow> globals \<Rightarrow> bool"
where
  "cstate_relation d c \<equiv>
     cpspace_relation (ksPSpace d) (t_hrs_' c) \<and>
     cready_queues_relation (ksReadyQueues d) (ksReadyQueues_' c) \<and>
     ksCurThread d = ctcb_ptr_to_tcb_ptr (ksCurThread_' c) \<and>
     ksIdleThread d = ctcb_ptr_to_tcb_ptr (ksIdleThread_' c) \<and>
     csch_act_relation (ksSchedulerAction d) (ksSchedulerAction_' c) \<and>
     carch_state_relation (ksArchState d) (phantom_machine_state_' c) \<and>
     (* interrupt controller state *)
     cinterrupt_relation (ksInterruptState d) (intStateIRQNode_' c)
                         (intStateIRQTable_' c) \<and>
     (* work units remaining (for preemption) *)
     ksWorkUnitsCompleted d = ksWorkUnitsCompleted_' c"
```

#### The cpspace_relation

The most complex component is `cpspace_relation`, which relates the Haskell physical address space to the C heap representation:

```isabelle
definition cpspace_relation ::
  "(machine_word \<rightharpoonup> kernel_object) \<Rightarrow> heap_raw_state \<Rightarrow> bool"
where
  "cpspace_relation hp hrs \<equiv>
     cpspace_tcb_relation hp (clift (t_hrs_' hrs)) \<and>
     cpspace_ep_relation hp (clift (t_hrs_' hrs)) \<and>
     cpspace_ntfn_relation hp (clift (t_hrs_' hrs)) \<and>
     cpspace_cte_relation hp (clift (t_hrs_' hrs)) \<and>
     cpspace_pde_relation hp (clift (t_hrs_' hrs)) \<and>
     cpspace_pte_relation hp (clift (t_hrs_' hrs)) \<and>
     cpspace_asidpool_relation hp (clift (t_hrs_' hrs))"
```

This says: for *each* kind of kernel object (TCBs, endpoints, notifications, CTE entries, page directory entries, page table entries, ASID pools), there is a sub-relation that maps between the Haskell-level representation and the C struct representation in the typed heap.

For example, `cpspace_tcb_relation` says: for every address `p` in the Haskell heap that holds a TCB object, the C heap at the corresponding address contains a valid `tcb_C` struct whose fields match the Haskell TCB fields:

```isabelle
definition cpspace_tcb_relation ::
  "(machine_word \<rightharpoonup> kernel_object) \<Rightarrow>
   (tcb_C ptr \<rightharpoonup> tcb_C) \<Rightarrow> bool"
where
  "cpspace_tcb_relation hp ct \<equiv>
     \<forall>p. hp p = Some (KOTCB tcb) \<longrightarrow>
       (\<exists>ctcb. ct (tcb_ptr_to_ctcb_ptr p) = Some ctcb \<and>
               ctcb_relation tcb ctcb)"
```

The `ctcb_relation` then spells out the field-by-field correspondence between a Haskell TCB record and a C `tcb_C` struct (thread state, priority, time slice, fault handler, bound notification, etc.).

#### The pspace_relation (Abstract to Design)

For completeness, here is the abstract-to-design object relation:

```isabelle
definition pspace_relation ::
  "(obj_ref \<rightharpoonup> kernel_object) \<Rightarrow>
   (machine_word \<rightharpoonup> kernel_object) \<Rightarrow> bool"
where
  "pspace_relation abs_hp des_hp \<equiv>
     \<forall>p. \<forall>ko. abs_hp p = Some ko \<longrightarrow>
       obj_relation_cuts ko p \<subseteq> {(p', obj). des_hp p' = Some obj}"
```

This is more subtle than a direct map because a single abstract object may correspond to *multiple* design-level objects (an abstract TCB includes its CNode slots, but at the design level these are stored as separate CTE objects). The function `obj_relation_cuts` computes the set of (address, object) pairs that the abstract object "covers" at the design level.

---

## 5. The Monadic Framework

### 5.1 The Nondeterministic State Monad

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

### 5.2 Validity Triples

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

### 5.3 The wp Calculus

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

## 6. The Two Refinement Proofs

### 6.1 Abstract to Executable (Refinement 1)

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

### 6.2 Executable to C (Refinement 2)

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

## 7. Proof Engineering

### 7.1 The Crunch Tool

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

### 7.2 Eisbach

Eisbach is a proof method language for Isabelle that allows defining custom tactics. The seL4 proofs use Eisbach extensively to capture recurring proof patterns:

```isabelle
method corres_step =
  (rule corres_bind | rule corres_if | rule corres_gets | ...)

method solve_corres =
  (corres_step; solve_corres?) |
  (rule corres_trivial, clarsimp)
```

### 7.3 Maintenance

The seL4 proof must be maintained as the C code evolves. This is one of the biggest ongoing challenges:

- A small change to the C code (e.g., changing a data structure field) can break hundreds of proof lemmas.
- Changes to the abstract specification (e.g., adding a new system call) require changes at all three layers and both refinement proofs.
- The proof development uses continuous integration to catch breakage early.

Typical maintenance effort: fixing proof breakage from a kernel change takes 1--10 person-days, depending on the scope of the change.

---

## 8. Exercises

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
