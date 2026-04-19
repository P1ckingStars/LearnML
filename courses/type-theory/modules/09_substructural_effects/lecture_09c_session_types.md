---
title: "Lecture 09c: Session Types for Concurrency"
tags:
  - type-theory
  - substructural
  - lecture
---
# Lecture 09c: Session Types for Concurrency

> **Module 09 --- Substructural & Effect Types (Weeks 17--18)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define binary session types and explain how they type communication channels between two processes.
2. State the session type constructors (send, receive, choice, offer, end) and explain their duality.
3. Formulate the typing rules for a session-typed pi-calculus and explain how session types are linear resources.
4. Prove that well-typed binary sessions are deadlock-free.
5. Define the duality operation on session types and prove that dual session types ensure protocol compatibility.
6. Describe multiparty session types and the role of global types in ensuring deadlock-freedom beyond the binary case.
7. Connect session types to linear logic via the Curry--Howard correspondence for classical linear logic.
8. Identify practical applications of session types in protocol verification and concurrent programming.

---

## 1. Motivation: Protocols as Types

Concurrent and distributed systems communicate through message passing. A *protocol* specifies the sequence and types of messages exchanged between participants. Protocol violations---sending when a receive is expected, sending a value of the wrong type, abandoning a channel mid-conversation---are a major source of bugs in concurrent systems. These bugs are difficult to detect through testing because they depend on scheduling and timing.

Session types, introduced by Honda (1993) and independently by Honda, Vasconcelos, and Kubo (1998), provide a type discipline that *statically* ensures protocol compliance. A session type describes the communication behavior of a channel endpoint: what messages are sent and received, in what order, and with what choices. The type system guarantees that if both endpoints are well-typed, the communication will proceed without protocol violations and (in the binary case) without deadlocks.

The key insight is that a channel endpoint is a *linear resource*: it must be used exactly according to its protocol (no duplication, no abandonment). This connects session types intimately to the linear type theory of Lectures 09a--09b.

**Example 1.1 (Arithmetic server).** Consider a server that offers two services: addition and negation. The protocol from the server's perspective is:

1. Offer a choice to the client: "add" or "negate."
2. If "add": receive two integers, send their sum, end.
3. If "negate": receive one integer, send its negation, end.

We will formalize this protocol as a session type and show that the type system enforces correct sequencing of communications.

---

## 2. Core Theory

### 2.1 Binary Session Types: Syntax

**Definition 2.1.1 (Session types).** The set of *session types* is defined by the grammar:

$$S, T ::= \;!T.S \mid \;?T.S \mid S \oplus T \mid S \mathbin{\&} T \mid \mathsf{end} \mid \mu X.\, S \mid X$$

where:
- $!T.S$ : send a value of type $T$, then continue as session $S$.
- $?T.S$ : receive a value of type $T$, then continue as session $S$.
- $S_1 \oplus S_2$ : *internal choice* --- the process selects either the left or right continuation.
- $S_1 \mathbin{\&} S_2$ : *external choice* (branching) --- the process offers both continuations and the partner selects.
- $\mathsf{end}$ : the session is complete; no further communication occurs.
- $\mu X.\, S$ : recursive session type (for protocols that loop).
- $X$ : recursion variable.

We also use *labeled* variants for readability:

$$\bigoplus\{l_1 : S_1, \ldots, l_n : S_n\} \quad \text{(internal choice among labeled options)}$$

$$\mathbin{\&}\{l_1 : S_1, \ldots, l_n : S_n\} \quad \text{(external choice among labeled options)}$$

**Example 2.1.2 (Arithmetic server, formalized).** The session type for the *server* endpoint is:

$$S_{\mathsf{server}} = \mathbin{\&}\{\mathsf{add} : \;?\mathsf{Int}.\;?\mathsf{Int}.\;!\mathsf{Int}.\;\mathsf{end}, \quad \mathsf{neg} : \;?\mathsf{Int}.\;!\mathsf{Int}.\;\mathsf{end}\}$$

Reading this: the server offers a choice ($\mathbin{\&}$) between "add" and "neg." If the client selects "add," the server receives two integers, sends one integer (the sum), and ends. If the client selects "neg," the server receives one integer, sends its negation, and ends.

### 2.2 Duality

The fundamental property of session types is *duality*: each session type has a dual that describes the complementary behavior. If one endpoint sends, the other receives; if one offers a choice, the other selects.

**Definition 2.2.1 (Dual session type).** The *dual* $\overline{S}$ of a session type $S$ is defined recursively:

$$
\begin{aligned}
\overline{!T.S} &= \;?T.\overline{S} \\
\overline{?T.S} &= \;!T.\overline{S} \\
\overline{S_1 \oplus S_2} &= \overline{S_1} \mathbin{\&} \overline{S_2} \\
\overline{S_1 \mathbin{\&} S_2} &= \overline{S_1} \oplus \overline{S_2} \\
\overline{\mathsf{end}} &= \mathsf{end} \\
\overline{\mu X.\, S} &= \mu X.\, \overline{S} \\
\overline{X} &= X
\end{aligned}
$$

For the labeled variants:

$$\overline{\bigoplus\{l_i : S_i\}_{i \in I}} = \mathbin{\&}\{l_i : \overline{S_i}\}_{i \in I}$$

$$\overline{\mathbin{\&}\{l_i : S_i\}_{i \in I}} = \bigoplus\{l_i : \overline{S_i}\}_{i \in I}$$

**Proposition 2.2.2 (Involution).** Duality is an involution: $\overline{\overline{S}} = S$ for all session types $S$.

*Proof.* By structural induction on $S$.

**Base cases:**
- $\overline{\overline{\mathsf{end}}} = \overline{\mathsf{end}} = \mathsf{end}$.
- $\overline{\overline{X}} = \overline{X} = X$.

**Inductive cases:**
- $\overline{\overline{!T.S}} = \overline{?T.\overline{S}} = \;!T.\overline{\overline{S}} = \;!T.S$ (by IH).
- $\overline{\overline{?T.S}} = \overline{!T.\overline{S}} = \;?T.\overline{\overline{S}} = \;?T.S$ (by IH).
- $\overline{\overline{S_1 \oplus S_2}} = \overline{\overline{S_1} \mathbin{\&} \overline{S_2}} = \overline{\overline{S_1}} \oplus \overline{\overline{S_2}} = S_1 \oplus S_2$ (by IH).
- $\overline{\overline{S_1 \mathbin{\&} S_2}}$: symmetric to the previous case.
- $\overline{\overline{\mu X.\, S}} = \overline{\mu X.\, \overline{S}} = \mu X.\, \overline{\overline{S}} = \mu X.\, S$ (by IH). $\square$

**Example 2.2.3.** The dual of the server type is the *client* type:

$$S_{\mathsf{client}} = \overline{S_{\mathsf{server}}} = \bigoplus\{\mathsf{add} : \;!\mathsf{Int}.\;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end}, \quad \mathsf{neg} : \;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end}\}$$

The client makes a choice ($\oplus$), then sends the appropriate values and receives the result.

### 2.3 Background: Process Calculi and the Pi-Calculus

The lambda calculus provides a foundation for sequential computation, but it has no native notion of concurrent processes communicating through message passing. *Process calculi* fill this gap: they are formal languages designed to model systems of concurrent, interacting agents. The two foundational formalisms are Milner's *Calculus of Communicating Systems* (CCS, 1980) and its successor, the *pi-calculus* (Milner, Parrow, and Walker, 1992). Since session types are defined over the pi-calculus, we briefly review its syntax and semantics before introducing the typed variant.

**Definition 2.3.1 (Pi-calculus processes).** The set of *processes* in the pi-calculus is defined by the grammar:

$$
\begin{aligned}
P, Q ::= \; & \bar{x}\langle v \rangle.\, P & \text{(output $v$ on channel $x$, then continue as $P$)} \\
\mid \; & x(y).\, P & \text{(input on channel $x$, bind received value to $y$ in $P$)} \\
\mid \; & P \mid Q & \text{(parallel composition)} \\
\mid \; & (\nu x)\, P & \text{(restriction: create a fresh channel $x$ scoped to $P$)} \\
\mid \; & \mathbf{0} & \text{(inaction / terminated process)} \\
\mid \; & !P & \text{(replication: unbounded copies of $P$, for modeling servers)}
\end{aligned}
$$

The constructs are read as follows:

- **Output** $\bar{x}\langle v \rangle.\, P$: send the value $v$ on channel $x$, then proceed as $P$.
- **Input** $x(y).\, P$: block until a value arrives on channel $x$, bind it to $y$, and continue as $P$.
- **Parallel composition** $P \mid Q$: run $P$ and $Q$ concurrently. Both processes may communicate with each other or with the environment.
- **Restriction** $(\nu x)\, P$: create a fresh, private channel name $x$ whose scope is limited to $P$. No process outside $P$ can refer to $x$.
- **Inaction** $\mathbf{0}$: the terminated process, performing no further computation.
- **Replication** $!P$: behaves as an unbounded number of copies of $P$ running in parallel ($!P \equiv P \mid\; !P$), used to model persistent servers that handle arbitrarily many clients.

**Definition 2.3.2 (Structural congruence).** Structural congruence ($\equiv$) identifies processes that differ only in inessential structural ways. The key axioms are commutativity and associativity of parallel composition, the identity of $\mathbf{0}$, scope manipulation for restriction, and unfolding of replication:

$$P \mid Q \equiv Q \mid P \qquad (P \mid Q) \mid R \equiv P \mid (Q \mid R) \qquad P \mid \mathbf{0} \equiv P$$

$$(\nu x)\, (\nu y)\, P \equiv (\nu y)\, (\nu x)\, P \qquad (\nu x)\, (P \mid Q) \equiv P \mid (\nu x)\, Q \;\; (x \notin \mathrm{fn}(P))$$

$$!P \equiv P \mid\; !P$$

The *scope extrusion* law $(\nu x)\, (P \mid Q) \equiv P \mid (\nu x)\, Q$ (when $x \notin \mathrm{fn}(P)$) is particularly important: it allows a restricted channel to be "extruded" past parallel compositions, which is essential for modeling the dynamic scope changes that occur when channel names are communicated.

**Definition 2.3.3 (Reduction / communication).** The operational semantics is given by a reduction relation $\longrightarrow$. The core computation rule is *communication* (COMM): when an output on channel $x$ is composed in parallel with an input on the same channel, the value is transmitted and both processes advance:

$$\bar{x}\langle v \rangle.\, P \mid x(y).\, Q \longrightarrow P \mid Q[v/y]$$

Here $Q[v/y]$ denotes the capture-avoiding substitution of $v$ for $y$ in $Q$. The sender continues as $P$; the receiver continues as $Q$ with $v$ in place of the bound variable $y$. This is the only computational step in the pi-calculus---all behavior arises from communication.

**Example 2.3.4 (A simple interaction).** Consider a system where a client sends the integer $7$ on channel $c$ and a server receives on the same channel:

$$(\nu c)\, (\bar{c}\langle 7 \rangle.\, \mathbf{0} \mid c(y).\, \bar{r}\langle y \rangle.\, \mathbf{0})$$

By the COMM rule, the system reduces as follows:

$$(\nu c)\, (\bar{c}\langle 7 \rangle.\, \mathbf{0} \mid c(y).\, \bar{r}\langle y \rangle.\, \mathbf{0}) \longrightarrow (\nu c)\, (\mathbf{0} \mid \bar{r}\langle 7 \rangle.\, \mathbf{0}) \equiv \bar{r}\langle 7 \rangle.\, \mathbf{0}$$

The last step uses structural congruence to garbage-collect the unused restriction on $c$ and the parallel $\mathbf{0}$. Notice that nothing in the untyped pi-calculus prevents us from writing a malformed system such as $\bar{c}\langle 7 \rangle.\, \mathbf{0} \mid \bar{c}\langle 8 \rangle.\, \mathbf{0}$, where both sides send and neither receives---the system is simply stuck.

Reduction is closed under parallel composition, restriction, and structural congruence:

$$\frac{P \longrightarrow P'}{P \mid Q \longrightarrow P' \mid Q} \qquad \frac{P \longrightarrow P'}{(\nu x)\, P \longrightarrow (\nu x)\, P'} \qquad \frac{P \equiv P' \quad P' \longrightarrow Q' \quad Q' \equiv Q}{P \longrightarrow Q}$$

**Remark 2.3.5 (Channels as first-class values).** The distinguishing feature of the pi-calculus relative to CCS is that *channel names are first-class values*: the value $v$ transmitted in $\bar{x}\langle v \rangle.\, P$ may itself be a channel name. This means communication can dynamically reconfigure the topology of the system---a process can receive a channel name it did not previously know about and begin communicating on it.

For example, consider the process $(\nu y)\, \bar{x}\langle y \rangle.\, \bar{y}\langle 5 \rangle.\, \mathbf{0}$. This creates a fresh channel $y$, sends $y$ itself on channel $x$ to some other process, and then sends the integer $5$ on $y$. The recipient of $y$ can now communicate on this previously unknown channel. This *name-passing* discipline is precisely what makes the pi-calculus a natural setting for session types: since channels are created, passed, and used dynamically, we want a type discipline that tracks the *protocol* governing each channel's usage throughout its lifetime.

**Remark 2.3.6 (Connection to session types).** The pi-calculus as defined above is *untyped*: any value can be sent on any channel, and there is no guarantee that the sender and receiver agree on the format of their conversation. A sender might transmit an integer while the receiver expects a channel name; one side might attempt to send when the other has already terminated. Session types address exactly this gap. They assign to each channel endpoint a type that specifies the full sequence of communications---sends, receives, choices, and termination---that will occur on that channel. The type system then guarantees, at compile time, that both endpoints follow compatible protocols. The remainder of this section develops this typed variant of the pi-calculus.

### 2.4 The Session-Typed Pi-Calculus

We formalize session-typed communication using a variant of the pi-calculus (Milner, 1999) augmented with session types.

**Definition 2.4.1 (Processes).** The set of *processes* is defined by:

$$
\begin{aligned}
P, Q ::= \; & \overline{c}\langle v \rangle.\, P & \text{(send value $v$ on channel $c$, continue as $P$)} \\
\mid \; & c(x).\, P & \text{(receive on channel $c$, bind to $x$, continue as $P$)} \\
\mid \; & c \triangleleft l_j.\, P & \text{(select label $l_j$ on channel $c$, continue as $P$)} \\
\mid \; & c \triangleright \{l_i : P_i\}_{i \in I} & \text{(branch on channel $c$: offer labels $l_i$)} \\
\mid \; & (\nu c : S)\, (P \mid Q) & \text{(create channel $c$ of type $S$, run $P \mid Q$)} \\
\mid \; & P \mid Q & \text{(parallel composition)} \\
\mid \; & \mathbf{0} & \text{(inaction)} \\
\mid \; & \mathsf{close}\; c.\, P & \text{(close channel $c$, continue as $P$)} \\
\mid \; & \mathsf{wait}\; c.\, P & \text{(wait for $c$ to be closed, continue as $P$)}
\end{aligned}
$$

**Definition 2.4.2 (Typing judgment).** The typing judgment for processes has the form:

$$\Gamma; \Lambda \vdash P$$

where:
- $\Gamma$ is the *unrestricted* context (variables of non-session type, usable any number of times).
- $\Lambda$ is the *linear* context (channel endpoints with session types, each used exactly once).

### 2.5 Typing Rules

**Rule (Send):**

$$\frac{\Gamma \vdash v : T \quad \Gamma; \Lambda, c : S \vdash P}{\Gamma; \Lambda, c : \;!T.S \vdash \overline{c}\langle v \rangle.\, P} \; (\text{T-Send})$$

The channel $c$ has session type $!T.S$: send a $T$, then the channel continues with type $S$. After sending, the continuation process $P$ sees $c$ at the residual type $S$.

**Rule (Receive):**

$$\frac{\Gamma, x : T; \Lambda, c : S \vdash P}{\Gamma; \Lambda, c : \;?T.S \vdash c(x).\, P} \; (\text{T-Recv})$$

The channel $c$ has type $?T.S$: receive a $T$ (bound to $x$), then continue with $c : S$.

**Rule (Select):**

$$\frac{\Gamma; \Lambda, c : S_j \vdash P \quad j \in I}{\Gamma; \Lambda, c : \bigoplus\{l_i : S_i\}_{i \in I} \vdash c \triangleleft l_j.\, P} \; (\text{T-Select})$$

The process selects label $l_j$ and continues with the corresponding session type $S_j$.

**Rule (Branch):**

$$\frac{\Gamma; \Lambda, c : S_i \vdash P_i \quad \forall i \in I}{\Gamma; \Lambda, c : \mathbin{\&}\{l_i : S_i\}_{i \in I} \vdash c \triangleright \{l_i : P_i\}_{i \in I}} \; (\text{T-Branch})$$

The process offers all labeled branches. The same linear context $\Lambda$ (minus $c$) must be used in each branch (since exactly one branch will execute, but we must be prepared for any).

**Rule (Session creation / restriction):**

$$\frac{\Gamma; \Lambda_1, c : S \vdash P \quad \Gamma; \Lambda_2, c : \overline{S} \vdash Q}{\Gamma; \Lambda_1, \Lambda_2 \vdash (\nu c : S)\, (P \mid Q)} \; (\text{T-New})$$

A new channel $c$ is created. Process $P$ sees $c$ at type $S$; process $Q$ sees $c$ at the dual type $\overline{S}$. The linear contexts are split: $\Lambda_1$ for $P$, $\Lambda_2$ for $Q$ (plus the channel $c$ in each).

**Rule (Parallel composition):**

$$\frac{\Gamma; \Lambda_1 \vdash P \quad \Gamma; \Lambda_2 \vdash Q}{\Gamma; \Lambda_1, \Lambda_2 \vdash P \mid Q} \; (\text{T-Par})$$

The linear context is split between parallel processes. No channel endpoint appears in both $\Lambda_1$ and $\Lambda_2$---each endpoint is owned by exactly one process.

**Rule (Close / Wait):**

$$\frac{\Gamma; \Lambda \vdash P}{\Gamma; \Lambda, c : \mathsf{end} \vdash \mathsf{close}\; c.\, P} \; (\text{T-Close}) \qquad \frac{\Gamma; \Lambda \vdash P}{\Gamma; \Lambda, c : \overline{\mathsf{end}} \vdash \mathsf{wait}\; c.\, P} \; (\text{T-Wait})$$

Since $\overline{\mathsf{end}} = \mathsf{end}$, both rules have $c : \mathsf{end}$ in the context. The distinction is operational: one side initiates closure, the other waits.

**Rule (Inaction):**

$$\frac{}{\Gamma; \cdot \vdash \mathbf{0}} \; (\text{T-End})$$

The inactive process has an empty linear context: all resources have been consumed.

### 2.6 Operational Semantics

**Definition 2.6.1 (Reduction rules for sessions).** The operational semantics is given by structural congruence and reduction rules.

**Structural congruence** ($\equiv$):

$$P \mid Q \equiv Q \mid P \qquad (P \mid Q) \mid R \equiv P \mid (Q \mid R) \qquad P \mid \mathbf{0} \equiv P$$

$$(\nu c : S)\, P \equiv (\nu c : S)\, P \quad (c \notin \mathrm{fn}(P) \Rightarrow (\nu c : S)\, (P \mid Q) \equiv P \mid (\nu c : S)\, Q)$$

**Communication (send/receive):**

$$(\nu c : \;!T.S)\, (\overline{c}\langle v \rangle.\, P \mid c(x).\, Q) \longrightarrow (\nu c : S)\, (P \mid Q[v/x])$$

The value $v$ is transmitted from the sender to the receiver, and the channel type advances from $!T.S$ (sender side) and $?T.\overline{S}$ (receiver side) to $S$ and $\overline{S}$.

**Selection (select/branch):**

$$(\nu c : \bigoplus\{l_i : S_i\})\, (c \triangleleft l_j.\, P \mid c \triangleright \{l_i : Q_i\}) \longrightarrow (\nu c : S_j)\, (P \mid Q_j)$$

The selector chooses $l_j$; the branching process continues with $Q_j$; the channel type becomes $S_j$ and $\overline{S_j}$.

**Close/Wait:**

$$(\nu c : \mathsf{end})\, (\mathsf{close}\; c.\, P \mid \mathsf{wait}\; c.\, Q) \longrightarrow P \mid Q$$

Both processes continue without the channel.

**Context rules:**

$$\frac{P \longrightarrow P'}{P \mid Q \longrightarrow P' \mid Q} \qquad \frac{P \longrightarrow P'}{(\nu c : S)\, P \longrightarrow (\nu c : S')\, P'} \qquad \frac{P \equiv P' \quad P' \longrightarrow Q' \quad Q' \equiv Q}{P \longrightarrow Q}$$

### 2.7 Type Safety and Session Fidelity

**Theorem 2.7.1 (Subject reduction / preservation).** If $\Gamma; \Lambda \vdash P$ and $P \longrightarrow Q$, then $\Gamma; \Lambda \vdash Q$.

*Proof.* By case analysis on the reduction rule applied.

**Case (Communication):** We have $(\nu c : \;!T.S)\, (\overline{c}\langle v \rangle.\, P \mid c(x).\, Q) \longrightarrow (\nu c : S)\, (P \mid Q[v/x])$.

The typing derivation gives us:
1. $\Gamma; \Lambda_1, c : \;!T.S \vdash \overline{c}\langle v \rangle.\, P$, which by T-Send requires $\Gamma \vdash v : T$ and $\Gamma; \Lambda_1, c : S \vdash P$.
2. $\Gamma; \Lambda_2, c : \;?T.\overline{S} \vdash c(x).\, Q$, which by T-Recv requires $\Gamma, x : T; \Lambda_2, c : \overline{S} \vdash Q$.

The reduct $(\nu c : S)\, (P \mid Q[v/x])$ is typed by T-New:
1. $\Gamma; \Lambda_1, c : S \vdash P$ (from above).
2. $\Gamma; \Lambda_2, c : \overline{S} \vdash Q[v/x]$ (by the substitution lemma, since $\Gamma \vdash v : T$).

So $\Gamma; \Lambda_1, \Lambda_2 \vdash (\nu c : S)\, (P \mid Q[v/x])$, as required.

**Case (Selection):** Similar. The selected branch $Q_j$ has $c : \overline{S_j}$ in its context, matching the continuation $P$ which has $c : S_j$.

**Case (Close/Wait):** The channel $c : \mathsf{end}$ is consumed in both processes; the continuations have no reference to $c$. $\square$

**Theorem 2.7.2 (Session fidelity).** In a well-typed process, every communication on a session channel matches the expected message type. That is, if a send operation transmits a value of type $T$, the corresponding receive expects type $T$.

*Proof.* By the duality invariant maintained by T-New: if one endpoint has type $!T.S$, the other has type $?T.\overline{S}$. The send rule requires the value to have type $T$, and the receive rule expects a value of type $T$. By subject reduction, this invariant is preserved across reductions. $\square$

### 2.8 Deadlock Freedom

The central result of binary session type theory is that well-typed programs are deadlock-free. We formalize this precisely.

**Definition 2.8.1 (Deadlock).** A process $P$ is *deadlocked* if $P$ is not structurally congruent to $\mathbf{0}$, and $P$ cannot reduce, but $P$ contains processes that are waiting to communicate.

More precisely, $P$ is deadlocked if $P \not\longrightarrow$ and $P$ has the form $(\nu \vec{c})\, (P_1 \mid \ldots \mid P_n)$ where each $P_i$ is blocked on a communication on some $c_j$, and there is a cyclic dependency among the channels.

**Theorem 2.8.2 (Deadlock freedom for binary sessions).** If $\Gamma; \cdot \vdash P$ (well-typed with empty linear context), then $P$ is not deadlocked. That is, either $P \equiv \mathbf{0}$ or $P \longrightarrow Q$ for some $Q$.

*Proof.* We prove a stronger result: every well-typed process either reduces to $\mathbf{0}$ or can make progress.

The proof proceeds by induction on the structure of $P$ (modulo structural congruence), using the *linearity* of the channel context:

**Key observations:**

1. **Channel pairing.** Each channel $c$ is introduced by $(\nu c : S)$. By T-New, exactly two processes share $c$: one with type $S$ and one with type $\overline{S}$. No other process mentions $c$.

2. **Dual actions.** By duality, if one process is ready to send on $c$ (type $!T.S$), the other is ready to receive on $c$ (type $?T.\overline{S}$). Their actions are complementary, so they can reduce.

3. **No cycles.** Deadlock requires a cyclic dependency: process $P_1$ waits on channel $c_1$ for $P_2$, which waits on $c_2$ for $P_3$, ..., which waits on $c_k$ for $P_1$. In the binary session type system, each channel connects exactly two processes. A cycle would require a process to participate in multiple channels simultaneously. While this is possible, the *tree structure* of session creation ($\nu$ bindings are nested) prevents cycles: the channel dependency graph is a tree (or forest), and trees are acyclic.

More formally, we define a *dependency relation* $\prec$ on channels: $c_1 \prec c_2$ if a process blocked on $c_1$ also holds an endpoint of $c_2$. Since channels are created by $\nu$-binding and each process is involved in at most two endpoints at the point of creation (one for each side), the dependency graph is a tree rooted at the outermost $\nu$. Trees are acyclic, so there is no deadlock.

4. **Termination.** If all channels have type $\mathsf{end}$, the close/wait reductions fire and eventually all processes terminate as $\mathbf{0}$.

For a fully rigorous proof using a *progress measure* (the multiset of session types in the linear context), see Caires and Pfenning (2010). $\square$

**Remark 2.8.3.** Deadlock freedom for binary sessions depends on the *tree topology* of channel creation. If we allow *channel passing* (sending channel endpoints as messages), the topology can become a general graph, and deadlock becomes possible even in well-typed programs. Ensuring deadlock freedom with channel passing requires additional mechanisms, such as priority-based typing (Padovani, 2014) or the Curry--Howard approach (Caires and Pfenning, 2010).

### 2.9 Session Types and Linear Logic

Caires and Pfenning (2010) and Wadler (2012) independently established a *Curry--Howard correspondence* between session types and classical (or dual intuitionistic) linear logic.

**Correspondence 2.9.1 (Propositions as sessions).**

| Classical Linear Logic | Session Types |
|---|---|
| Proposition $A$ | Session type $S$ |
| $A \otimes B$ | Send $A$, continue as $B$: $\;!A.B$ |
| $A \mathbin{⅋} B$ | Receive $A$, continue as $B$: $\;?A.B$ |
| $A \oplus B$ | Internal choice: $A \oplus B$ |
| $A \mathbin{\&} B$ | External choice: $A \mathbin{\&} B$ |
| $\mathbf{1}$ | Close / end (sender) |
| $\bot$ | Wait / end (receiver) |
| $!A$ | Replicated server (offering $A$ repeatedly) |
| $?A$ | Replicated client (requesting $A$ repeatedly) |
| Linear negation $A^{\perp}$ | Dual session type $\overline{S}$ |
| Cut (composition) | Parallel composition with channel binding |
| Cut elimination | Communication reduction |
| Identity (axiom) | Forwarding (channel linking) |

**Theorem 2.9.2 (Caires--Pfenning).** There is a bijection between:
- Cut-free proofs of $A_1, \ldots, A_n \vdash B$ in intuitionistic linear logic, and
- Well-typed processes $x_1 : A_1, \ldots, x_n : A_n \vdash P :: z : B$ where $P$ provides a session of type $B$ on channel $z$ using channels $x_1, \ldots, x_n$ of types $A_1, \ldots, A_n$.

Moreover, cut elimination corresponds to communication, and the cut-elimination theorem implies deadlock freedom.

*Proof sketch.* Each sequent calculus rule of ILL corresponds to a process typing rule. The identity axiom $A \vdash A$ corresponds to the *forwarder* process $[x \leftrightarrow z]$ that links channels $x$ and $z$. The cut rule:

$$\frac{\Gamma \vdash A \quad \Delta, A \vdash B}{\Gamma, \Delta \vdash B} \; (\text{Cut})$$

corresponds to the session creation rule:

$$\frac{\Gamma \vdash P :: x : A \quad \Delta, x : A \vdash Q :: z : B}{\Gamma, \Delta \vdash (\nu x : A)\, (P \mid Q) :: z : B} \; (\text{T-Cut})$$

Cut elimination produces a cut-free proof; computationally, this corresponds to reducing all communications to normal form. Since cut elimination terminates (Gentzen's Hauptsatz), communication terminates, yielding deadlock freedom. $\square$

**Remark 2.9.3 (Wadler's GV and CP).** Wadler (2012) introduced two calculi:
- **CP** (Classical Processes): a direct Curry--Howard correspondence with CLL. Process constructors correspond exactly to sequent calculus rules.
- **GV** (Good Variation): a more conventional functional language with session-typed channels, connected to CP by a translation.

### 2.10 Subtyping for Session Types

Session types admit a natural subtyping relation based on the principle of *safe substitutability*: a session type $S$ is a subtype of $T$ if a process implementing $S$ can safely be used where $T$ is expected.

**Definition 2.10.1 (Session subtyping).** The subtyping relation $S <: T$ is defined coinductively by:

$$\frac{T' <: T \quad S <: S'}{!T.S <: \;!T'.S'} \; (\text{Sub-Send}) \qquad \frac{T <: T' \quad S <: S'}{?T.S <: \;?T'.S'} \; (\text{Sub-Recv})$$

$$\frac{I \supseteq J \quad S_i <: T_i \;\forall i \in J}{\bigoplus\{l_i : S_i\}_{i \in I} <: \bigoplus\{l_j : T_j\}_{j \in J}} \; (\text{Sub-Choice})$$

$$\frac{J \supseteq I \quad S_i <: T_i \;\forall i \in I}{\mathbin{\&}\{l_i : S_i\}_{i \in I} <: \mathbin{\&}\{l_j : T_j\}_{j \in J}} \; (\text{Sub-Branch})$$

$$\frac{}{\mathsf{end} <: \mathsf{end}} \; (\text{Sub-End})$$

**Remark 2.10.2.** The subtyping rules embody the standard variance principles:
- **Send is contravariant** in the payload type: if $S <: \;!T'.S'$, a sender that sends a $T'$ (supertype) is more general than one that sends a $T$ (subtype). The receiver expects at most $T$, and $T' \supseteq T$ suffices.

Wait, let us be more careful. The rule Sub-Send says $!T.S <: \;!T'.S'$ when $T' <: T$. This means: a process that sends a $T$ (which is a supertype of $T'$) can be used where a process that sends a $T'$ is expected. This is *covariant* in the sent type from the sender's perspective but *contravariant* from the receiver's perspective.

Actually, the standard convention (Gay and Hole, 2005) is: $!T.S <: \;!T'.S'$ when $T <: T'$ (covariant in the sent type). The sender of a subtype can be used where a sender of a supertype is expected, because the receiver expects a supertype and will accept a subtype. We adopt this convention:

$$\frac{T <: T' \quad S <: S'}{!T.S <: \;!T'.S'} \; (\text{Sub-Send, corrected})$$

- **Receive is contravariant** in the received type: $?T.S <: \;?T'.S'$ when $T' <: T$.
- **Internal choice is covariant** in the set of labels: offering *more* options is a subtype (more capable).
- **External choice is contravariant** in the set of labels: accepting *more* options is a subtype (more tolerant).

### 2.11 Multiparty Session Types

Binary session types handle two-party protocols. Many real-world protocols involve three or more participants. *Multiparty session types* (Honda, Yoshida, and Carbone, 2008) extend the theory to handle multi-party communication.

**Definition 2.11.1 (Global type).** A *global type* $G$ describes the communication protocol from a global, birds-eye perspective:

$$G ::= p \to q : \{l_i : G_i\}_{i \in I} \mid \mu X.\, G \mid X \mid \mathsf{end}$$

where $p \to q : \{l_i : G_i\}_{i \in I}$ means: participant $p$ sends to participant $q$ a message labeled $l_i$ (for some $i \in I$), and the protocol continues as $G_i$.

**Definition 2.11.2 (Local type / projection).** The *projection* of a global type $G$ onto participant $r$, written $G \upharpoonright r$, gives the *local type* describing what $r$ must do:

$$
\begin{aligned}
(p \to q : \{l_i : G_i\}) \upharpoonright r &= \begin{cases}
\bigoplus\{l_i : G_i \upharpoonright r\} & \text{if } r = p \\
\mathbin{\&}\{l_i : G_i \upharpoonright r\} & \text{if } r = q \\
G_1 \upharpoonright r & \text{if } r \neq p, q \text{ and } \forall i, j.\; G_i \upharpoonright r = G_j \upharpoonright r
\end{cases} \\
(\mu X.\, G) \upharpoonright r &= \mu X.\, (G \upharpoonright r) \\
\mathsf{end} \upharpoonright r &= \mathsf{end}
\end{aligned}
$$

The third case (when $r$ is neither sender nor receiver) requires that $r$'s local behavior is the same regardless of which label is chosen---this ensures that $r$'s projection is well-defined (the "merge" condition).

**Theorem 2.11.3 (Multiparty deadlock freedom).** If each participant $r$ is well-typed with respect to its local type $G \upharpoonright r$, and all local types are obtained by projecting a single global type $G$, then the system of participants is deadlock-free and communication-safe.

*Proof sketch.* The global type $G$ defines a total ordering on communication actions. Each projection preserves this ordering for the relevant participant. Since the global type is well-formed (no circular dependencies that cannot be resolved), the induced communication pattern is deadlock-free. The proof uses a *global progress* argument: at each step, there is at least one communication action enabled (the next one in the global type's ordering), and performing it advances the global state. $\square$

### 2.12 Subject Reduction: Detailed Proof

We provide a more detailed proof of subject reduction (Theorem 2.7.1) for the communication and selection cases.

**Proof of Theorem 2.7.1, Communication case (detailed).**

We have:

$$(\nu c : \;!T.S)\, (\overline{c}\langle v \rangle.\, P \mid c(x).\, Q) \longrightarrow (\nu c : S)\, (P \mid Q[v/x])$$

**Typing of the left-hand side.** By T-New:

$$\frac{\Gamma; \Lambda_1, c : \;!T.S \vdash \overline{c}\langle v \rangle.\, P \quad \Gamma; \Lambda_2, c : \;?T.\overline{S} \vdash c(x).\, Q}{\Gamma; \Lambda_1, \Lambda_2 \vdash (\nu c : \;!T.S)\, (\overline{c}\langle v \rangle.\, P \mid c(x).\, Q)}$$

By T-Send on the first premise:

$$\frac{\Gamma \vdash v : T \quad \Gamma; \Lambda_1, c : S \vdash P}{\Gamma; \Lambda_1, c : \;!T.S \vdash \overline{c}\langle v \rangle.\, P}$$

By T-Recv on the second premise:

$$\frac{\Gamma, x : T; \Lambda_2, c : \overline{S} \vdash Q}{\Gamma; \Lambda_2, c : \;?T.\overline{S} \vdash c(x).\, Q}$$

**Typing of the right-hand side.** We need to show $\Gamma; \Lambda_1, \Lambda_2 \vdash (\nu c : S)\, (P \mid Q[v/x])$.

By T-New, we need:

1. $\Gamma; \Lambda_1, c : S \vdash P$ --- this is exactly the second premise from T-Send above.

2. $\Gamma; \Lambda_2, c : \overline{S} \vdash Q[v/x]$ --- by the substitution lemma, since $\Gamma, x : T; \Lambda_2, c : \overline{S} \vdash Q$ and $\Gamma \vdash v : T$, we get $\Gamma; \Lambda_2, c : \overline{S} \vdash Q[v/x]$.

Both premises hold, so $\Gamma; \Lambda_1, \Lambda_2 \vdash (\nu c : S)\, (P \mid Q[v/x])$. $\square$

**Proof of Theorem 2.7.1, Selection case (detailed).**

We have:

$$(\nu c : \bigoplus\{l_i : S_i\})\, (c \triangleleft l_j.\, P \mid c \triangleright \{l_i : Q_i\}) \longrightarrow (\nu c : S_j)\, (P \mid Q_j)$$

By T-New, the left-hand side has:

1. $\Gamma; \Lambda_1, c : \bigoplus\{l_i : S_i\} \vdash c \triangleleft l_j.\, P$, which by T-Select gives $\Gamma; \Lambda_1, c : S_j \vdash P$.

2. $\Gamma; \Lambda_2, c : \mathbin{\&}\{l_i : \overline{S_i}\} \vdash c \triangleright \{l_i : Q_i\}$, which by T-Branch gives $\Gamma; \Lambda_2, c : \overline{S_i} \vdash Q_i$ for all $i$.

For the right-hand side, by T-New we need:

1. $\Gamma; \Lambda_1, c : S_j \vdash P$ --- from T-Select above.

2. $\Gamma; \Lambda_2, c : \overline{S_j} \vdash Q_j$ --- from T-Branch above (for $i = j$).

Both premises hold. $\square$

### 2.13 Recursive Session Types

**Definition 2.13.1 (Recursive sessions).** The recursive session type $\mu X.\, S$ denotes a protocol that repeats. It is understood via the *equi-recursive* approach: $\mu X.\, S$ is considered equal to its unfolding $S[\mu X.\, S / X]$.

**Example 2.13.2 (Counter protocol).** A counter that repeatedly accepts "increment" or "get" requests:

$$S_{\mathsf{counter}} = \mu X.\, \mathbin{\&}\{\mathsf{inc} : X, \quad \mathsf{get} : \;!\mathsf{Int}.\;\mathsf{end}\}$$

The server offers: if "inc," loop back; if "get," send the current count and terminate.

**Proposition 2.13.3.** Subtyping and duality extend to recursive types via their coinductive characterizations. In particular, $\overline{\mu X.\, S} = \mu X.\, \overline{S}$ (duality distributes through recursion).

### 2.14 Asynchronous Session Types

So far, we have considered *synchronous* communication: send and receive are blocking operations. In practice, communication is often *asynchronous*: messages are placed in a buffer and the sender proceeds without waiting for the receiver.

**Definition 2.14.1 (Asynchronous semantics).** In the asynchronous pi-calculus, the send operation $\overline{c}\langle v \rangle.\, P$ is replaced by $\overline{c}\langle v \rangle \mid P$: the message is sent and the sender proceeds immediately. Messages reside in a *buffer* until they are received.

The reduction rule becomes:

$$\overline{c}\langle v \rangle \mid c(x).\, Q \longrightarrow Q[v/x]$$

The message $\overline{c}\langle v \rangle$ is consumed by the receiver $c(x).\, Q$.

**Proposition 2.14.2.** Asynchronous session types are related to synchronous session types by a *subtyping* relation: the asynchronous system allows more behaviors (the sender does not wait), but the type safety guarantees (session fidelity, deadlock freedom) still hold, provided the buffers are bounded.

**Remark 2.14.3.** Honda, Yoshida, and Carbone's multiparty session types (Section 2.11) were originally developed for the *asynchronous* setting. The global type specifies the ordering of messages, and the asynchronous semantics guarantees that messages arrive in the correct order (FIFO channels).

### 2.15 Practical Applications

**Application 2.15.1 (Protocol verification).** Session types have been applied to verify implementations of real-world protocols:

- **HTTP:** The request-response pattern can be modeled as $!(\mathsf{Request}).\;?(\mathsf{Response}).\;\mathsf{end}$.
- **SMTP:** The multi-step handshake (EHLO, MAIL FROM, RCPT TO, DATA, QUIT) is modeled as a sequence of sends and receives with appropriate branching.
- **OAuth:** The multi-party authorization flow involving client, server, and authorization provider is modeled using multiparty session types.

**Application 2.15.2 (Language implementations).** Session types have been implemented in:

- **Links** (Cooper et al.): a web programming language with native session types.
- **Scribble** (Honda et al.): a protocol description language based on multiparty session types.
- **Session-typed Haskell** (Lindley and Morris, 2016): embedding session types in Haskell using indexed monads.
- **Rust** (Jespersen et al., 2015): encoding session types using Rust's affine type system.

**Application 2.15.3 (Session types in Rust).** Rust's affine type system naturally supports session types: a channel endpoint is an affine value that must be consumed according to a protocol. The `session_types` crate implements this approach:

```rust
type Server = Offer<Recv<i32, Recv<i32, Send<i32, End>>>,
                     Recv<i32, Send<i32, End>>>;
```

Each communication operation consumes the old channel endpoint and returns a new one at the residual session type, enforcing the protocol through move semantics.

### 2.16 Worked Examples: Full Protocol Derivations

**Example 2.16.1 (Arithmetic server: full derivation).** We give the complete typing derivation for the arithmetic server and client from Examples 2.1.2 and 2.2.3.

**Server process:**

$$P_{\mathsf{server}} = c \triangleright \left\{ \begin{array}{l} \mathsf{add} : c(x).\, c(y).\, \overline{c}\langle x + y \rangle.\, \mathsf{close}\; c.\, \mathbf{0}, \\ \mathsf{neg} : c(x).\, \overline{c}\langle -x \rangle.\, \mathsf{close}\; c.\, \mathbf{0} \end{array} \right\}$$

**Server typing derivation:** We verify $\cdot; c : S_{\mathsf{server}} \vdash P_{\mathsf{server}}$ where:

$$S_{\mathsf{server}} = \mathbin{\&}\{\mathsf{add} : \;?\mathsf{Int}.\;?\mathsf{Int}.\;!\mathsf{Int}.\;\mathsf{end}, \quad \mathsf{neg} : \;?\mathsf{Int}.\;!\mathsf{Int}.\;\mathsf{end}\}$$

By T-Branch, we must verify both branches:

*Branch "add":* $x : \mathsf{Int}; c : \;?\mathsf{Int}.\;!\mathsf{Int}.\;\mathsf{end} \vdash c(y).\, \overline{c}\langle x + y \rangle.\, \mathsf{close}\; c.\, \mathbf{0}$

By T-Recv: $x : \mathsf{Int}, y : \mathsf{Int}; c : \;!\mathsf{Int}.\;\mathsf{end} \vdash \overline{c}\langle x + y \rangle.\, \mathsf{close}\; c.\, \mathbf{0}$

By T-Send (with $x + y : \mathsf{Int}$): $\cdot; c : \mathsf{end} \vdash \mathsf{close}\; c.\, \mathbf{0}$

By T-Close: $\cdot; \cdot \vdash \mathbf{0}$, which holds by T-End.

*Branch "neg":* Similar, with one receive and one send.

**Client process:**

$$Q_{\mathsf{client}} = c \triangleleft \mathsf{add}.\, \overline{c}\langle 3 \rangle.\, \overline{c}\langle 4 \rangle.\, c(z).\, \mathsf{wait}\; c.\, \mathbf{0}$$

**Client typing derivation:** We verify $\cdot; c : S_{\mathsf{client}} \vdash Q_{\mathsf{client}}$ where:

$$S_{\mathsf{client}} = \overline{S_{\mathsf{server}}} = \bigoplus\{\mathsf{add} : \;!\mathsf{Int}.\;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end}, \quad \mathsf{neg} : \;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end}\}$$

By T-Select (choosing "add"): $\cdot; c : \;!\mathsf{Int}.\;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end} \vdash \overline{c}\langle 3 \rangle.\, \overline{c}\langle 4 \rangle.\, c(z).\, \mathsf{wait}\; c.\, \mathbf{0}$

By T-Send ($3 : \mathsf{Int}$): $\cdot; c : \;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end} \vdash \overline{c}\langle 4 \rangle.\, c(z).\, \mathsf{wait}\; c.\, \mathbf{0}$

By T-Send ($4 : \mathsf{Int}$): $\cdot; c : \;?\mathsf{Int}.\;\mathsf{end} \vdash c(z).\, \mathsf{wait}\; c.\, \mathbf{0}$

By T-Recv: $z : \mathsf{Int}; c : \mathsf{end} \vdash \mathsf{wait}\; c.\, \mathbf{0}$

By T-Wait: $z : \mathsf{Int}; \cdot \vdash \mathbf{0}$ (with $z$ going unused into the unrestricted context---or more precisely, $z : \mathsf{Int}$ is used in the final result if we modify the example to return $z$).

**Full system:**

$$(\nu c : S_{\mathsf{server}})\, (P_{\mathsf{server}} \mid Q_{\mathsf{client}})$$

**Reduction trace:**

$$(\nu c)\, (c \triangleright \{\mathsf{add}: P_a, \mathsf{neg}: P_n\} \mid c \triangleleft \mathsf{add}.\, Q')$$

$$\longrightarrow (\nu c)\, (P_a \mid Q') \quad \text{(selection reduction)}$$

$$= (\nu c)\, (c(x).\, c(y).\, \overline{c}\langle x + y \rangle.\, \ldots \mid \overline{c}\langle 3 \rangle.\, \overline{c}\langle 4 \rangle.\, c(z).\, \ldots)$$

$$\longrightarrow (\nu c)\, (c(y).\, \overline{c}\langle 3 + y \rangle.\, \ldots \mid \overline{c}\langle 4 \rangle.\, c(z).\, \ldots) \quad \text{(comm: $x \mapsto 3$)}$$

$$\longrightarrow (\nu c)\, (\overline{c}\langle 3 + 4 \rangle.\, \ldots \mid c(z).\, \ldots) \quad \text{(comm: $y \mapsto 4$)}$$

$$\longrightarrow (\nu c)\, (\mathsf{close}\; c.\, \mathbf{0} \mid \mathsf{wait}\; c.\, \mathbf{0}) \quad \text{(comm: $z \mapsto 7$)}$$

$$\longrightarrow \mathbf{0} \mid \mathbf{0} \equiv \mathbf{0} \quad \text{(close/wait)}$$

The session completes successfully with result $z = 7$.

**Example 2.16.2 (Ill-typed: protocol mismatch).** Consider a client that tries to send a string where an integer is expected:

$$Q_{\mathsf{bad}} = c \triangleleft \mathsf{add}.\, \overline{c}\langle \text{"hello"} \rangle.\, \ldots$$

The session type for the client after selecting "add" is $!\mathsf{Int}.\;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end}$. The T-Send rule requires $\vdash \text{"hello"} : \mathsf{Int}$, which fails. The type system catches the protocol violation at compile time.

**Example 2.16.3 (Ill-typed: abandoned channel).** Consider a client that selects "add" but then does nothing:

$$Q_{\mathsf{abandon}} = c \triangleleft \mathsf{add}.\, \mathbf{0}$$

After selection, the channel has type $!\mathsf{Int}.\;!\mathsf{Int}.\;?\mathsf{Int}.\;\mathsf{end}$. The T-End rule requires an empty linear context, but $c$ is still present. The type system rejects this: the session was not completed.

### 2.17 Channel Passing and Higher-Order Sessions

**Definition 2.17.1 (Channel delegation).** Session types can include *channel types* as payload types: a process can send a channel endpoint to another process, *delegating* part of a protocol.

$$S = \;!S'.S'' \quad \text{(send a channel endpoint of type $S'$, then continue as $S''$)}$$

**Example 2.17.2 (Delegating a sub-protocol).** A client establishes a session with a server, then delegates part of the interaction to a helper:

$$S_{\mathsf{server}} = \;?\mathsf{Int}.\;!\mathsf{Int}.\;\mathsf{end}$$

$$S_{\mathsf{manager}} = \;!S_{\mathsf{server}}.\;\mathsf{end}$$

The manager sends the server's channel endpoint to a helper, who then completes the interaction.

**Remark 2.17.3.** Channel passing breaks the tree topology of binary sessions, as the same channel may be passed between multiple processes. This can introduce the possibility of deadlocks, even in well-typed programs. Additional mechanisms (priority types, logic-based approaches) are needed to ensure deadlock freedom with channel passing.

### 2.18 Comparison: Session Types, Linear Types, and Behavioral Types

**Proposition 2.18.1.** Session types can be seen as a *refinement* of linear types: a session-typed channel is a linear value whose type additionally specifies the *sequence* of communications. Without the sequencing structure, a session type degenerates to a linear channel type.

**Remark 2.18.2.** Session types belong to the broader family of *behavioral types*, which characterize the behavior (not just the data content) of a program component:

- **Session types:** describe communication protocols.
- **Typestate:** describes state-dependent operations (Section 2.9, Lecture 09b).
- **Behavioral contracts:** describe expected input-output behavior.
- **Process types (CCS/CSP types):** describe process behavior via bisimulation equivalence.

All of these benefit from substructural typing disciplines that ensure resources (channels, state, contracts) are used correctly.

### 2.19 Subtyping and Polymorphism for Session Types (Extended)

We return to subtyping (Section 2.10) to give a more thorough treatment.

**Definition 2.19.1 (Coinductive subtyping).** The subtyping relation for session types is defined *coinductively*, because session types may be recursive. A coinductive definition means: $S <: T$ if there exists a *bisimulation-like* relation $\mathcal{R}$ such that $(S, T) \in \mathcal{R}$ and $\mathcal{R}$ is closed under the subtyping rules.

Formally, a relation $\mathcal{R}$ on session types is a *subtyping simulation* if, whenever $(S, T) \in \mathcal{R}$:

1. If $S = \;!A.S'$ and $T = \;!B.T'$, then $A <: B$ (covariant in sent type) and $(S', T') \in \mathcal{R}$.
2. If $S = \;?A.S'$ and $T = \;?B.T'$, then $B <: A$ (contravariant in received type) and $(S', T') \in \mathcal{R}$.
3. If $S = \bigoplus\{l_i : S_i\}$ and $T = \bigoplus\{l_j : T_j\}$, then $\{l_j\} \subseteq \{l_i\}$ and for each $j$, $(S_j, T_j) \in \mathcal{R}$.
4. If $S = \mathbin{\&}\{l_i : S_i\}$ and $T = \mathbin{\&}\{l_j : T_j\}$, then $\{l_i\} \subseteq \{l_j\}$ and for each $i$, $(S_i, T_i) \in \mathcal{R}$.

Then $S <: T$ iff $(S, T)$ belongs to some subtyping simulation $\mathcal{R}$.

**Theorem 2.19.2 (Decidability of session subtyping).** For finite (non-recursive) session types, subtyping is decidable in polynomial time. For recursive session types, subtyping is decidable (Gay and Hole, 2005) but requires a coinductive algorithm (essentially, a bisimulation check on the unfolded types).

*Proof sketch.* Represent session types as finite automata (with recursive types as cycles). Subtyping becomes a simulation check on automata, which is decidable. $\square$

**Definition 2.19.3 (Session type polymorphism).** Polymorphic session types allow abstracting over the types of values exchanged:

$$S = \forall \alpha.\; ?\alpha.\; !\alpha.\; \mathsf{end}$$

This describes a "generic echo server" that receives a value of any type and sends it back. The Curry--Howard correspondence extends: this corresponds to a polymorphic linear proposition $\forall \alpha.\; \alpha \multimap \alpha$.

### 2.20 Exercises

**Exercise 2.20.1.** Define a session type for a simple ATM protocol:
- The ATM offers: "balance" (respond with an integer) or "withdraw" (receive an amount, respond with success or failure).
- Write the session types for both the ATM and the customer.
- Verify that they are duals of each other.

**Exercise 2.20.2.** Prove that the following process is well-typed, and give its complete reduction sequence:

$$(\nu c : \;!\mathsf{Bool}.\;\mathsf{end})\, (\overline{c}\langle \mathsf{true} \rangle.\, \mathsf{close}\; c.\, \mathbf{0} \mid c(x).\, \mathsf{wait}\; c.\, \mathbf{0})$$

**Exercise 2.20.3.** Define a multiparty session type (global type) for a three-phase commit protocol involving a coordinator, a participant, and an observer. Project the global type onto each role.

**Exercise 2.20.4.** Show that the following system is deadlocked:

$$(\nu a)(\nu b)\, (a(x).\, \overline{b}\langle x \rangle.\, \mathbf{0} \mid b(y).\, \overline{a}\langle y \rangle.\, \mathbf{0})$$

Explain why the binary session type system (without channel passing) prevents this pattern from arising in well-typed programs.

**Exercise 2.20.5.** Implement the arithmetic server protocol (Example 2.16.1) in a programming language with session type support (e.g., using the `session_types` crate in Rust, or encoding session types in Haskell using indexed monads). Verify that your implementation type-checks and that protocol violations are caught at compile time.

---

## Summary

- **Session types** assign types to communication channel endpoints, specifying the sequence and types of messages exchanged. They ensure protocol compliance at compile time.

- **Session type constructors** include send ($!T.S$), receive ($?T.S$), internal choice ($\oplus$), external choice ($\mathbin{\&}$), end ($\mathsf{end}$), and recursion ($\mu X.\, S$).

- **Duality** is the fundamental operation on session types: $\overline{!T.S} = \;?T.\overline{S}$, $\overline{S_1 \oplus S_2} = \overline{S_1} \mathbin{\&} \overline{S_2}$, etc. Duality is an involution: $\overline{\overline{S}} = S$.

- **Deadlock freedom** for binary sessions follows from the tree structure of channel creation: well-typed programs cannot have cyclic dependencies among channels.

- **The Curry--Howard correspondence** extends to session types via classical linear logic (Caires--Pfenning, Wadler). Propositions are session types, proofs are processes, cut elimination is communication.

- **Multiparty session types** (Honda, Yoshida, Carbone) extend the theory to multiple participants using *global types* that project to local types for each participant.

- **Session types are linear resources**: each channel endpoint must be used exactly once, following its protocol. This connects session types to the broader framework of substructural type systems.

## Further Reading

1. Honda, K. (1993). "Types for dyadic interaction." In *CONCUR '93*, LNCS 715, pp. 509--523. Springer. The original paper introducing session types.

2. Honda, K., Vasconcelos, V. T., and Kubo, M. (1998). "Language primitives and type discipline for structured communication-based programming." In *ESOP '98*, LNCS 1381, pp. 122--138. Springer. The full development of binary session types with subtyping.

3. Caires, L. and Pfenning, F. (2010). "Session types as intuitionistic linear propositions." In *CONCUR 2010*, LNCS 6269, pp. 222--236. Springer. The Curry--Howard correspondence for session types and linear logic.

4. Wadler, P. (2012). "Propositions as sessions." In *ICFP 2012*, pp. 273--286. ACM. Wadler's formulation of the session types/linear logic correspondence (CP and GV calculi).

5. Honda, K., Yoshida, N., and Carbone, M. (2008). "Multiparty asynchronous session types." In *POPL 2008*, pp. 273--284. ACM. The foundational paper on multiparty session types with global types.

6. Gay, S. J. and Hole, M. (2005). "Subtyping for session types in the pi calculus." *Acta Informatica*, 42(2--3), 191--225. Session type subtyping.

7. Lindley, S. and Morris, J. G. (2016). "Talking bananas: Structural recursion for session types." In *ICFP 2016*, pp. 434--447. ACM. Session types in Haskell.

8. Vasconcelos, V. T. (2012). "Fundamentals of session types." *Information and Computation*, 217, 52--70. A comprehensive survey of session type theory.

9. Padovani, L. (2014). "Deadlock and lock freedom in the linear pi-calculus." In *LICS 2014*, pp. 72:1--72:10. ACM. Priority-based typing for deadlock freedom with channel passing.

10. Toninho, B., Caires, L., and Pfenning, F. (2013). "Higher-order processes, functions, and sessions: A monadic integration." In *ESOP 2013*, LNCS 7792, pp. 350--369. Springer. Integrating session types with higher-order functional programming.
