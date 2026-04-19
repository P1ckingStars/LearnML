# Lecture 09c: Concurrency & Parallelism in Programming Languages

## Prerequisites

- Operating systems basics (threads, processes), basic formal logic, familiarity with at least one concurrent programming model.

---

## 1. Shared Memory Concurrency: Threads, Locks, Atomics

### 1.1 Thread Model

A **thread** is a sequential flow of control that shares an address space with other threads in the same process. The interleaving of thread executions is nondeterministic (determined by the scheduler).

**Formal model.** A concurrent program is a tuple $(T_1, \ldots, T_n, \sigma_0)$ where each $T_i$ is a sequence of **actions** and $\sigma_0$ is the initial shared state. An **execution** is an interleaving (total order on actions consistent with each thread's program order).

### 1.2 Mutual Exclusion and Locks

A **mutex lock** provides mutual exclusion: at most one thread holds the lock at any time.

**Safety properties:**
- **Mutual exclusion**: $\neg(\text{in\_cs}(T_i) \wedge \text{in\_cs}(T_j))$ for $i \neq j$.
- **Deadlock freedom**: If some thread wants the lock and no thread holds it, some thread eventually acquires it.
- **Starvation freedom** (stronger): Every thread that requests the lock eventually acquires it.

**Theorem (Fischer, Lynch, Paterson, 1985).** There is no deterministic algorithm for consensus (and hence no wait-free mutual exclusion) in an asynchronous system with even one crash failure, using only reads and writes.

### 1.3 Atomic Operations

Modern hardware provides atomic read-modify-write instructions:

- **Compare-and-swap (CAS):**

```
function CAS(addr, expected, new_val):
    atomically:
        if *addr == expected:
            *addr = new_val
            return true
        else:
            return false
```

- **Fetch-and-add**, **load-linked/store-conditional** (LL/SC).

**Theorem (Herlihy, 1991).** CAS (and other read-modify-write operations with consensus number $\infty$) can implement any concurrent data structure in a **wait-free** manner, given sufficient memory. Registers (read/write only) have consensus number 1 and cannot solve 2-thread consensus.

---

## 2. Memory Models and Consistency

### 2.1 Sequential Consistency (Lamport, 1979)

A multiprocessor system is **sequentially consistent** if the result of any execution is the same as if the operations of all processors were executed in some sequential order, and the operations of each individual processor appear in this sequence in the order specified by its program.

Formally, there exists a total order $<_S$ on all memory operations such that:
1. If operations $a$ and $b$ are by the same thread and $a$ precedes $b$ in program order, then $a <_S b$.
2. Every read of variable $x$ returns the value written by the most recent write to $x$ in $<_S$.

### 2.2 Why Weaker Models?

Sequential consistency is expensive to implement in hardware because it prevents many optimizations:
- Store buffers
- Instruction reordering
- Cache coherence relaxations

Modern hardware (x86-TSO, ARM, POWER) provides **relaxed memory models**.

### 2.3 The Happens-Before Relation (Lamport, 1978)

The **happens-before** relation $\xrightarrow{hb}$ is the smallest partial order such that:

1. **Program order**: If $a$ and $b$ are actions in the same thread and $a$ precedes $b$, then $a \xrightarrow{hb} b$.
2. **Synchronization order**: If $a$ is a release of lock $m$ and $b$ is the subsequent acquire of $m$, then $a \xrightarrow{hb} b$.
3. **Transitivity**: If $a \xrightarrow{hb} b$ and $b \xrightarrow{hb} c$, then $a \xrightarrow{hb} c$.

A **data race** occurs when two accesses to the same variable are not ordered by happens-before, and at least one is a write.

**Theorem (DRF guarantee).** A program that is **data-race-free** (DRF) under the happens-before relation has sequentially consistent semantics, even on hardware with a relaxed memory model. This is the foundation of the Java Memory Model (Manson, Pugh, Adve, 2005) and the C++11 memory model.

### 2.4 The C++11 Memory Model (Simplified)

C++11 defines several memory orderings for atomic operations:

| Ordering | Guarantees |
|----------|-----------|
| `memory_order_seq_cst` | Full sequential consistency (total order on all seq_cst operations) |
| `memory_order_acquire` | Subsequent reads/writes cannot be reordered before this load |
| `memory_order_release` | Previous reads/writes cannot be reordered after this store |
| `memory_order_relaxed` | No ordering guarantees beyond atomicity |

A release store $\xrightarrow{sw}$ (synchronizes-with) a matching acquire load on the same variable. This synchronizes-with relation feeds into happens-before.

---

## 3. Lock-Free and Wait-Free Data Structures

### 3.1 Progress Guarantees

- **Blocking**: Uses locks; a thread holding a lock that is delayed can prevent all other threads from making progress.
- **Lock-free**: At least one thread makes progress in a finite number of steps (system-wide progress, but individual threads may starve).
- **Wait-free**: Every thread completes its operation in a bounded number of steps (strongest guarantee).

### 3.2 Lock-Free Stack (Treiber, 1986)

```
struct Node { val; next; }
atomic<Node*> top;

function push(val):
    node = new Node(val)
    loop:
        old_top = top.load()
        node.next = old_top
        if CAS(&top, old_top, node):
            return

function pop():
    loop:
        old_top = top.load()
        if old_top == null:
            return EMPTY
        new_top = old_top.next
        if CAS(&top, old_top, new_top):
            return old_top.val
```

**Correctness argument.** The CAS ensures that the push/pop only succeeds if the top has not changed since it was read, maintaining a consistent linked-list structure. The stack is lock-free because at least one competing CAS succeeds in each round.

### 3.3 The ABA Problem

A CAS may succeed even when the value has changed and then changed back ($A \to B \to A$). Solutions:
- **Tagged pointers**: Augment the pointer with a monotonically increasing counter.
- **Hazard pointers** (Michael, 2004): Protect nodes from being reclaimed while in use.
- **Epoch-based reclamation**: Delay memory reclamation to safe points.

### 3.4 Lock-Free Queue (Michael & Scott, 1996)

```
struct Node { val; next; }
struct Queue { atomic<Node*> head; atomic<Node*> tail; }

function enqueue(q, val):
    node = new Node(val, null)
    loop:
        tail = q.tail.load()
        next = tail.next.load()
        if tail == q.tail.load():     // consistency check
            if next == null:
                if CAS(&tail.next, null, node):
                    CAS(&q.tail, tail, node)   // swing tail (may fail; helper will do it)
                    return
            else:
                CAS(&q.tail, tail, next)       // help advance tail

function dequeue(q):
    loop:
        head = q.head.load()
        tail = q.tail.load()
        next = head.next.load()
        if head == q.head.load():
            if head == tail:
                if next == null: return EMPTY
                CAS(&q.tail, tail, next)
            else:
                val = next.val
                if CAS(&q.head, head, next):
                    return val
```

---

## 4. Message Passing: Actors, Channels, CSP, Pi-Calculus

### 4.1 Communicating Sequential Processes (Hoare, 1978)

**CSP** models concurrent systems as processes that communicate via **synchronous message passing** over named channels.

**Syntax (simplified):**

$$
P ::= \text{STOP} \mid a \to P \mid P \square P \mid P \parallel P \mid P \setminus A
$$

- $a \to P$: Perform event $a$, then behave as $P$.
- $P \square Q$: External choice -- the environment decides which branch to take.
- $P \parallel Q$: Parallel composition (synchronize on shared events).
- $P \setminus A$: Hide events in set $A$ (make them internal).

**Trace semantics.** The meaning of a process $P$ is the set of all possible traces (finite sequences of events):

$$
\text{traces}(a \to P) = \{\langle\rangle\} \cup \{\langle a \rangle \frown s \mid s \in \text{traces}(P)\}
$$

$$
\text{traces}(P \square Q) = \text{traces}(P) \cup \text{traces}(Q)
$$

**Refinement.** $P$ refines $Q$ (written $Q \sqsubseteq P$) if $\text{traces}(P) \subseteq \text{traces}(Q)$ (and, in the failures-divergences model, also $\text{failures}(P) \subseteq \text{failures}(Q)$).

### 4.2 The Pi-Calculus (Milner, 1999)

The **pi-calculus** extends CCS with **name passing**: channels themselves can be sent over channels, enabling dynamic reconfiguration of communication topology.

**Syntax:**

$$
P ::= 0 \mid \bar{x}\langle y \rangle.P \mid x(z).P \mid P \mid Q \mid (\nu x)P \mid !P
$$

- $\bar{x}\langle y \rangle.P$: Send name $y$ on channel $x$, continue as $P$.
- $x(z).P$: Receive a name on channel $x$, bind it to $z$, continue as $P$.
- $(\nu x)P$: Create a new (private) channel $x$.
- $!P$: Replication (unbounded copies of $P$).

**Reduction rule (communication):**

$$
\bar{x}\langle y \rangle.P \mid x(z).Q \;\longrightarrow\; P \mid Q[y/z]
$$

**Theorem (Milner, 1999).** The pi-calculus is **Turing-complete**. Computation can be encoded via name passing alone.

### 4.3 The Actor Model (Hewitt, 1973; Agha, 1986)

In the **actor model**, the fundamental unit is the **actor**: an entity that can:
1. Send messages to other actors (asynchronously).
2. Create new actors.
3. Designate the behavior for the next message it receives.

Actors have:
- A **mailbox** (message queue).
- No shared state between actors.

**Semantics (informal).** An actor configuration is a set of actors and in-transit messages. A step consists of an actor receiving a message from its mailbox and executing its behavior, which may produce new messages and new actors.

Languages/frameworks: Erlang (processes), Akka (Scala/Java), Pony.

---

## 5. Software Transactional Memory

### 5.1 Concept (Shavit & Touitou, 1995; Harris et al., 2005)

**Software Transactional Memory (STM)** applies the transaction concept from databases to shared memory:

```
atomically {
    // read and write shared variables
    // if conflict detected, abort and retry
}
```

**Properties:**
- **Atomicity**: The block executes as if instantaneous.
- **Isolation**: Intermediate states are not visible to other transactions.
- **Composability**: Transactions compose (unlike locks, which don't).

### 5.2 Formal Model

A transaction $T$ is a sequence of reads and writes to transactional variables (TVars). The runtime maintains:
- A **read set**: variables read by $T$ and their observed values.
- A **write set**: variables written by $T$ and their new values.

At commit time:
1. **Validate**: Check that all variables in the read set still hold the values observed.
2. If validation succeeds, atomically apply all writes.
3. If validation fails, abort and re-execute.

### 5.3 Optimistic vs. Pessimistic

- **Optimistic** (most STM systems): Execute speculatively, validate at commit. Good when conflicts are rare.
- **Pessimistic**: Acquire locks on read/write. Lower abort rate but reduces concurrency.

### 5.4 The retry and orElse Combinators (Haskell STM)

```haskell
retry :: STM a
-- Abort current transaction, re-execute when any read variable changes.

orElse :: STM a -> STM a -> STM a
-- Try first transaction; if it calls retry, try the second.
```

**Theorem (Composability).** STM transactions compose: if $T_1$ and $T_2$ are correct transactions, then $T_1 \gg T_2$ (sequential composition) and $T_1\;\text{orElse}\;T_2$ (alternative composition) are also correct transactions. This property does not hold for lock-based synchronization (composing two correctly locked operations can lead to deadlock).

---

## 6. Async/Await and Coroutines

### 6.1 Coroutines

A **coroutine** is a generalization of a subroutine that can **yield** control (suspend execution) and later be **resumed** from the suspension point.

**Symmetric coroutines**: Any coroutine can transfer to any other.
**Asymmetric coroutines**: A coroutine yields to its caller.

### 6.2 Async/Await

**Async/await** is a structured form of coroutines for asynchronous I/O:

```
async function fetchData(url):
    response = await httpGet(url)     // suspend here until response is ready
    data = await parseJson(response)
    return data
```

**Compilation strategy.** An `async` function is compiled to a **state machine**:

```
function fetchData_stateMachine(url, state, result):
    switch state:
        case 0:
            issue httpGet(url)
            save state = 1
            return SUSPENDED
        case 1:
            response = result
            issue parseJson(response)
            save state = 2
            return SUSPENDED
        case 2:
            data = result
            return COMPLETED(data)
```

Each `await` point becomes a state transition. Local variables are saved in a **frame object** allocated on the heap (or stack, if the compiler can prove the coroutine does not outlive its caller).

### 6.3 Colored Functions Problem

A well-known issue: async functions and sync functions are "different colors" -- a sync function cannot (easily) call an async function. This bifurcates the ecosystem. Languages attempt various solutions:
- **Go**: Goroutines are always "async" (green threads); no coloring.
- **Zig**: Async is built into the language uniformly.
- **Effect handlers** (see Module 10): Async is just another effect, handled generically.

---

## 7. Data Parallelism

### 7.1 SIMD (Single Instruction, Multiple Data)

Hardware provides vector instructions that operate on multiple data elements simultaneously.

**Example (AVX-512):** A single instruction adds 16 32-bit floats in parallel.

**Auto-vectorization.** Compilers attempt to detect loops amenable to SIMD:

```
for i in 0..n:
    C[i] = A[i] + B[i]
```

Requirements for auto-vectorization:
- No loop-carried dependencies (or they can be reduced).
- Aligned, contiguous memory access patterns.
- Trip count is known or can be bounded.

### 7.2 GPU Programming Models

**CUDA/OpenCL.** A computation is organized as:
- **Kernel**: A function executed by many threads.
- **Thread block**: A group of threads that share local memory and synchronize.
- **Grid**: A collection of thread blocks.

The programming model is **SPMD** (Single Program, Multiple Data): all threads execute the same code but operate on different data.

**Memory hierarchy:**
1. Registers (per-thread, fastest)
2. Shared memory (per-block, ~5 cycles)
3. Global memory (device-wide, ~400 cycles)

### 7.3 Data-Parallel Languages

- **NESL** (Blelloch, 1996): Nested data parallelism with flattening transformation.
- **Futhark**: A purely functional data-parallel language compiled to GPU code.
- **Halide**: Domain-specific for image processing; separates algorithm from schedule.

---

## 8. Session Types for Communication Safety

### 8.1 Motivation

**Session types** (Honda, 1993; Honda, Vasconcelos, Kubo, 1998) assign types to communication channels, specifying the **protocol** of message exchange.

### 8.2 Session Type Syntax

$$
S ::= !\tau.S \mid ?\tau.S \mid S_1 \oplus S_2 \mid S_1 \mathbin{\&} S_2 \mid \mu X. S \mid X \mid \text{end}
$$

- $!\tau.S$: Send a value of type $\tau$, then continue with protocol $S$.
- $?\tau.S$: Receive a value of type $\tau$, then continue with protocol $S$.
- $S_1 \oplus S_2$: Internal choice -- the session owner selects which branch.
- $S_1 \mathbin{\&} S_2$: External choice -- the other party selects.
- $\mu X. S$: Recursive session type.
- $\text{end}$: Session is complete.

### 8.3 Duality

For a two-party session to be well-typed, the two endpoints must have **dual** types:

$$
\overline{!\tau.S} = ?\tau.\overline{S} \qquad \overline{?\tau.S} = !\tau.\overline{S}
$$

$$
\overline{S_1 \oplus S_2} = \overline{S_1} \mathbin{\&} \overline{S_2} \qquad \overline{S_1 \mathbin{\&} S_2} = \overline{S_1} \oplus \overline{S_2}
$$

$$
\overline{\text{end}} = \text{end}
$$

### 8.4 Example: A Simple Arithmetic Protocol

Server type:

$$
S_{\text{server}} = \mu X.\; ?(\text{Int} \times \text{Int}).\; !\text{Int}.\; (X \mathbin{\&} \text{end})
$$

The server repeatedly: receives two integers, sends back their sum, then waits for the client to choose "again" or "done."

Client type (dual):

$$
S_{\text{client}} = \overline{S_{\text{server}}} = \mu X.\; !(\text{Int} \times \text{Int}).\; ?\text{Int}.\; (X \oplus \text{end})
$$

### 8.5 Typing Rules (Simplified)

**Send:**

$$
\frac{\Gamma \vdash e : \tau \quad \Delta, c : S \vdash P}{\Delta, c : !\tau.S \vdash c!\langle e \rangle.P}
$$

**Receive:**

$$
\frac{\Gamma, x : \tau; \Delta, c : S \vdash P}{\Delta, c : ?\tau.S \vdash c?(x).P}
$$

**Parallel composition (with dual channels):**

$$
\frac{\Delta_1, c : S \vdash P \quad \Delta_2, c : \overline{S} \vdash Q}{\Delta_1, \Delta_2 \vdash (\nu c)(P \mid Q)}
$$

### 8.6 Guarantees

**Theorem (Session fidelity).** If a process is well-typed with session types, then at runtime, every communication on a session-typed channel follows the protocol specified by the type.

**Theorem (Deadlock freedom for binary sessions).** Well-typed processes in the binary session type system are deadlock-free (assuming no other sources of cyclic dependency).

*Proof sketch.* The session type discipline ensures that each channel is used linearly (exactly one sender, one receiver). The dual typing ensures that sends are always matched by receives. The absence of cycles follows from the acyclic structure of the type derivation. $\square$

### 8.7 Multiparty Session Types

**Multiparty session types** (Honda, Yoshida, Carbone, 2008) extend binary sessions to protocols involving $n$ participants. A **global type** describes the entire protocol; **local types** (projections) describe each participant's view.

$$
G ::= p \to q : \tau.G \mid G_1 + G_2 \mid \mu X.G \mid \text{end}
$$

The projection $G \upharpoonright p$ extracts participant $p$'s local session type from the global type.

---

## 9. Summary

| Model | Communication | Shared State | Key Guarantee |
|-------|--------------|-------------|---------------|
| Threads + locks | Implicit (shared memory) | Yes | Mutual exclusion (programmer-enforced) |
| Lock-free structures | Implicit (CAS) | Yes | System-wide progress |
| CSP / channels | Synchronous message passing | No | Process algebra reasoning |
| Pi-calculus | Asynchronous name passing | No | Dynamic topology |
| Actors | Asynchronous messages | No (per-actor state) | Encapsulation |
| STM | Implicit (transactional memory) | Yes (transactional) | Atomicity + composability |
| Async/await | Structured coroutines | Depends | Structured concurrency |
| Session types | Typed channels | No | Protocol adherence, deadlock freedom |

---

## References

1. Hoare, C. A. R. (1978). "Communicating sequential processes." *Communications of the ACM*, 21(8), 666--677.
2. Milner, R. (1999). *Communicating and Mobile Systems: the Pi-Calculus.* Cambridge University Press.
3. Shavit, N. & Touitou, D. (1995). "Software transactional memory." *PODC '95*.
4. Harris, T., Marlow, S., Peyton Jones, S., & Herlihy, M. (2005). "Composable memory transactions." *PPoPP '05*.
5. Lamport, L. (1979). "How to make a multiprocessor computer that correctly executes multiprocess programs." *IEEE Trans. Computers*, C-28(9).
6. Herlihy, M. (1991). "Wait-free synchronization." *ACM TOPLAS*, 13(1), 124--149.
7. Honda, K. (1993). "Types for dyadic interaction." *CONCUR '93*.
8. Honda, K., Yoshida, N., & Carbone, M. (2008). "Multiparty asynchronous session types." *POPL '08*.
9. Manson, J., Pugh, W., & Adve, S. V. (2005). "The Java memory model." *POPL '05*.
10. Michael, M. M. & Scott, M. L. (1996). "Simple, fast, and practical non-blocking and blocking concurrent queue algorithms." *PODC '96*.
11. Fischer, M. J., Lynch, N. A., & Paterson, M. S. (1985). "Impossibility of distributed consensus with one faulty process." *JACM*, 32(2).
12. Agha, G. (1986). *Actors: A Model of Concurrent Computation in Distributed Systems.* MIT Press.
13. Treiber, R. K. (1986). "Systems programming: coping with parallelism." IBM Research Report RJ 5118.
