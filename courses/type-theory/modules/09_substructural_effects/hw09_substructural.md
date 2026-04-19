---
title: "Homework 09: Substructural Types"
tags:
  - type-theory
  - substructural
  - homework
---
# Homework 09: Substructural Types

> **Module 09 --- Substructural & Effect Types (Weeks 17--18)**
> **Due:** End of Week 18
> **Total:** 100 points (Part A: 50 points, Part B: 50 points)

---

## Part A: Theory (50 points)

### Problem A.1: Type Safety for the Linear Lambda Calculus (20 points)

Consider the linear lambda calculus defined in Lecture 09a (Definition 2.6.4) with the following types and terms:

$$A, B ::= \alpha \mid A \multimap B \mid A \otimes B \mid \mathbf{1}$$

$$M, N ::= x \mid \lambda x.\, M \mid M\; N \mid (M, N) \mid \mathsf{let}\; (x, y) = M \;\mathsf{in}\; N \mid () \mid \mathsf{let}\; () = M \;\mathsf{in}\; N$$

with the typing rules from Definition 2.6.4 (restricted to the multiplicative fragment, without $\mathbin{\&}$, $\oplus$, and $!$).

**(a)** (8 points) State and prove the **Linear Substitution Lemma**: if $\Gamma_1, x : A \vdash M : B$ and $\Gamma_2 \vdash N : A$ with $\mathrm{dom}(\Gamma_1) \cap \mathrm{dom}(\Gamma_2) = \emptyset$, then $\Gamma_1, \Gamma_2 \vdash M[N/x] : B$.

Prove this by induction on the derivation of $\Gamma_1, x : A \vdash M : B$. You must handle at least the following cases explicitly:

(i) $M = x$: Then $B = A$, the context $\Gamma_1$ must be empty (or purely unrestricted), and the substitution yields $N$. Show that $\Gamma_2 \vdash N : A$ gives the required result (with appropriate weakening of unrestricted variables from $\Gamma_1$).

(ii) $M = y$ for $y \neq x$: Then $y : B \in \Gamma_1$. Explain why $x$ must appear elsewhere in the derivation (since $x$ is linear and must be used) or why this case can only arise when $A$ is of the form $!A'$.

(iii) $M = \lambda z.\, M_0$: By inversion, $\Gamma_1', x : A, z : C \vdash M_0 : D$ where $\Gamma_1 = \Gamma_1'$ and $B = C \multimap D$. Apply the IH to get $\Gamma_1', \Gamma_2, z : C \vdash M_0[N/x] : D$, then re-apply the abstraction rule.

(iv) $M = M_1\; M_2$: This is the key case. By inversion, the context $\Gamma_1, x : A$ is split as $\Delta_1, \Delta_2$ for the two subterms. The variable $x$ appears in exactly one of $\Delta_1, \Delta_2$. Apply the IH to the subterm containing $x$, replacing it with $\Gamma_2$. Reconstruct the application rule with the new context split.

**(b)** (7 points) State and prove the **Preservation Theorem** (subject reduction): if $\Gamma \vdash M : A$ and $M \longrightarrow M'$, then $\Gamma \vdash M' : A$.

Prove this for the $\beta$-rules $(\beta_{\multimap})$ and $(\beta_{\otimes})$. You may cite the substitution lemma from part (a).

*Hint for $(\beta_{\multimap})$:* The term $(\lambda x.\, M_0)\; N$ has typing derivation:

$$\frac{\frac{\Gamma_1, x : A \vdash M_0 : B}{\Gamma_1 \vdash \lambda x.\, M_0 : A \multimap B} \quad \Gamma_2 \vdash N : A}{\Gamma_1, \Gamma_2 \vdash (\lambda x.\, M_0)\; N : B}$$

The reduct is $M_0[N/x]$. Apply the substitution lemma with $\Gamma_1 = \Gamma_1$, $x : A$, and $\Gamma_2 = \Gamma_2$.

*Hint for $(\beta_{\otimes})$:* The term $\mathsf{let}\; (x, y) = (M_1, M_2) \;\mathsf{in}\; N$ requires two substitutions. Apply the substitution lemma twice, being careful about the context splits.

**(c)** (5 points) State and prove the **Progress Theorem**: if $\vdash M : A$ (closed, well-typed term), then either $M$ is a value or there exists $M'$ such that $M \longrightarrow M'$.

Define the set of values precisely:

$$V ::= \lambda x.\, M \mid (V_1, V_2) \mid () \mid \langle V_1, V_2 \rangle \mid \mathsf{inl}\, V \mid \mathsf{inr}\, V$$

Then prove progress by induction on the typing derivation. For each rule, show that the term is either already a value or that an evaluation context and a redex can be identified.

*Hint:* The key cases are application (either $M$ is not a value and can step, or $M$ is a lambda and the $\beta_{\multimap}$ rule applies) and $\mathsf{let}$-expressions (either the scrutinee is not a value and can step, or the scrutinee is a pair/unit and the appropriate $\beta$ rule applies).

---

### Problem A.2: Deadlock Freedom for Binary Session Types (15 points)

Consider the session-typed pi-calculus defined in Lecture 09c (Definitions 2.3.1--2.3.2) with the typing rules from Section 2.4.

**(a)** (5 points) Let $S = \;!\mathsf{Int}.\;?\mathsf{Bool}.\;\mathsf{end}$. Write out the dual $\overline{S}$ and construct a process $P$ with typing $c : S \vdash P$ and a process $Q$ with typing $c : \overline{S} \vdash Q$ such that $(\nu c : S)\, (P \mid Q)$ reduces to $\mathbf{0}$.

Show the full reduction sequence step by step, annotating each step with the reduction rule applied (Communication, Selection, or Close/Wait).

*Hint:* $\overline{S} = \;?\mathsf{Int}.\;!\mathsf{Bool}.\;\mathsf{end}$. Process $P$ sends an integer and then receives a boolean. Process $Q$ receives an integer and sends a boolean. Construct explicit processes for $P$ and $Q$ and show at least three reduction steps.

**(b)** (5 points) Prove **Session Fidelity** (Theorem 2.6.2 from Lecture 09c): in a well-typed session, every send operation transmits a value of the type expected by the corresponding receive. Prove this by showing that the duality invariant is preserved under reduction.

Specifically, show that if $\Gamma; \Lambda_1, c : S \vdash P$ and $\Gamma; \Lambda_2, c : \overline{S} \vdash Q$, and $(\nu c : S)\, (P \mid Q) \longrightarrow R$, then $R$ has the form $(\nu c : S')\, (P' \mid Q')$ where $\Gamma; \Lambda_1', c : S' \vdash P'$ and $\Gamma; \Lambda_2', c : \overline{S'} \vdash Q'$ (or $R = P' \mid Q'$ if the session ended).

**(c)** (5 points) Prove **Deadlock Freedom** for binary sessions without channel passing (Theorem 2.7.2): if $\Gamma; \cdot \vdash P$, then either $P \equiv \mathbf{0}$ or $P \longrightarrow Q$ for some $Q$.

You may use the following proof strategy: define a *progress measure* $\mu(P) = $ the multiset of session types appearing in the linear contexts of all subprocesses. Show that if $P \not\equiv \mathbf{0}$, then there exists a channel $c$ on which both sides are ready to communicate (one is blocked on send, the other on receive, or one selects while the other offers), and therefore $P \longrightarrow Q$. Argue that cyclic blocking is impossible by appealing to the tree structure of channel creation.

---

### Problem A.3: Curry--Howard for Linear Logic (15 points)

**(a)** (5 points) State the **Curry--Howard correspondence for intuitionistic linear logic** (Theorem 2.12.1 from Lecture 09a). Give the full correspondence table mapping each ILL connective to its computational counterpart in the linear lambda calculus. Your table should include at least the following columns:

| ILL Connective | Linear Lambda Calculus | Introduction Rule | Elimination Rule |
|---|---|---|---|
| $A \multimap B$ | ... | ... | ... |
| $A \otimes B$ | ... | ... | ... |
| ... | ... | ... | ... |

Fill in all rows for: $\multimap$, $\otimes$, $\mathbf{1}$, $\mathbin{\&}$, $\oplus$, $\mathbf{0}$, $\top$, and $!$.

**(b)** (5 points) Let $A, B, C$ be linear types. Prove the following isomorphisms by constructing explicit terms (proof terms) and their inverses:

(i) $A \otimes (B \otimes C) \cong (A \otimes B) \otimes C$ (associativity of tensor)

(ii) $A \multimap (B \multimap C) \cong (A \otimes B) \multimap C$ (currying for linear types)

(iii) $A \otimes (B \oplus C) \cong (A \otimes B) \oplus (A \otimes C)$ (distributivity)

For each isomorphism, construct a term $f : \text{LHS} \multimap \text{RHS}$ and a term $g : \text{RHS} \multimap \text{LHS}$. Verify (informally) that $g \circ f$ and $f \circ g$ are $\beta\eta$-equivalent to the identity.

Note: for isomorphism (iii), you will need the additive connective $\oplus$ (which requires the $!$ modality to handle the duplication of $A$ in the reverse direction). Alternatively, you may assume $A : \;!A'$ (i.e., $A$ is unrestricted). State clearly which assumption you make.

**(c)** (5 points) The **exponential isomorphisms** of linear logic state:

(i) $!(A \mathbin{\&} B) \cong \;!A \otimes \;!B$

(ii) $!\mathbf{1} \cong \mathbf{1}$ (or more precisely, $!\top \cong \mathbf{1}$ in the multiplicative-additive fragment)

For isomorphism (i), construct proof terms for both directions. Explain why this isomorphism fails without the $!$ modality (i.e., why $A \mathbin{\&} B \not\cong A \otimes B$ in general).

*Hint for the forward direction of (i):* Given $z : \;!(A \mathbin{\&} B)$, first copy $z$ to get two copies $z_1, z_2 : \;!(A \mathbin{\&} B)$. Then derelict each and project: $\pi_1(\mathsf{derelict}\; z_1) : A$ and $\pi_2(\mathsf{derelict}\; z_2) : B$. Promote each to get $!A$ and $!B$, then pair with $\otimes$.

*Hint for the failure without $!$:* The forward direction $A \mathbin{\&} B \multimap A \otimes B$ would require using the hypothesis $z : A \mathbin{\&} B$ twice (once for $\pi_1$, once for $\pi_2$), which is contraction. Without $!$, this is forbidden.

---

### Problem A.4: Effect Systems (Bonus, 10 points)

This problem is optional and provides up to 10 bonus points.

**(a)** (5 points) Consider the language with algebraic effects from Lecture 09d (Definition 2.5.1) with the state effect:

$$\mathsf{State}(\mathsf{Int}) = \{ \mathsf{get} : \mathsf{Unit} \to \mathsf{Int}, \quad \mathsf{put} : \mathsf{Int} \to \mathsf{Unit} \}$$

Give the full typing derivation for the following computation:

$$c = \mathsf{let}\; n = \mathsf{get}() \;\mathsf{in}\; \mathsf{put}(n + 1);\; \mathsf{return}\; n$$

showing that $\vdash c : \mathsf{Int} \mathbin{!} \langle \mathsf{State}(\mathsf{Int}) \rangle$.

Then give the typing derivation for the handler:

$$H = \{ \mathsf{return}\; x \mapsto \lambda s.\, \mathsf{return}\; (x, s), \quad \mathsf{get}(\_; k) \mapsto \lambda s.\, k\; s\; s, \quad \mathsf{put}(s'; k) \mapsto \lambda \_.\, k\; ()\; s' \}$$

and show that $\vdash \mathsf{handle}\; c \;\mathsf{with}\; H : (\mathsf{Int} \to \mathsf{Int} \times \mathsf{Int}) \mathbin{!} \langle \rangle$.

**(b)** (5 points) Prove the **handle-operation** reduction case of the preservation theorem (Theorem 2.11.1 from Lecture 09d):

Show that if $\Gamma \vdash \mathsf{handle}\; E[\mathsf{op}(v; y.\, c)] \;\mathsf{with}\; H : B \mathbin{!} \varepsilon$ and the reduction produces $c_i[v/x_i, K/k_i]$ where $K = \lambda y.\, \mathsf{handle}\; E[c] \;\mathsf{with}\; H$, then $\Gamma \vdash c_i[v/x_i, K/k_i] : B \mathbin{!} \varepsilon$.

The key step is showing that $K$ has the correct type, i.e., $K : B_{\mathsf{op}} \to B \mathbin{!} \varepsilon$.

---

## Part B: Implementation (50 points)

All implementations should be in OCaml. You may use the code from Recitation 09 as a starting point.

### Problem B.1: Full Linear Type Checker (25 points)

Implement a complete type checker for the linear lambda calculus with all connectives: $\multimap$, $\otimes$, $\mathbf{1}$, $\mathbin{\&}$, $\oplus$, and $!$.

Your implementation must:

**(a)** (5 points) Define the abstract syntax for types, terms, and contexts as OCaml data types. Include at least:
- Linear implication $A \multimap B$
- Tensor product $A \otimes B$ and multiplicative unit $\mathbf{1}$
- Additive product $A \mathbin{\&} B$ and additive sum $A \oplus B$
- Exponential $!A$

**(b)** (10 points) Implement the type checking function with the following signature:

```ocaml
val typecheck : context -> term -> ty * context
```

where the return value `(ty, ctx')` consists of the inferred type `ty` and the output context `ctx'` reflecting which variables have been consumed.

Use the output-context approach (Algorithm 2.7.3 from Lecture 09a). Your implementation must correctly handle:
- Context splitting for application and tensor introduction (variables consumed by the first subterm are unavailable to the second).
- Context sharing for with-introduction and case branches (both branches must use the same linear variables).
- The promotion rule: all free variables must be unrestricted.
- Dereliction, weakening (discard), and contraction (copy) for $!$-types.

**(c)** (5 points) Provide a test suite with at least 10 test cases, including:
- 5 well-typed terms covering each connective.
- 5 ill-typed terms that should be rejected, covering:
  - Contraction of a linear variable (used twice).
  - Weakening of a linear variable (not used).
  - Promotion with a linear variable in context.
  - Unbalanced usage in case branches.
  - Type mismatch in application.

**(d)** (5 points) Implement a pretty-printer for typing derivations: given a term and its type, print the derivation tree showing the typing rules applied. The output should clearly show context splits at each application node.

For example, the derivation of $\lambda f.\, \lambda x.\, f\; x : (A \multimap B) \multimap A \multimap B$ should produce output similar to:

```
                                     ----------- Var     ----------- Var
                                     f:A-oB |- f:A-oB   x:A |- x:A
                                     --------------------------------- ->E
                                     f:A-oB, x:A |- f x : B
                                     --------------------------------- ->I
                                     f:A-oB |- \x:A. f x : A -o B
                                     --------------------------------- ->I
                                     |- \f:A-oB. \x:A. f x : (A-oB) -o A -o B
```

The derivation tree may be printed top-down or bottom-up. What matters is that context splits are visible.

*Implementation hint:* Define a `derivation` data type that mirrors the typing rules, then write a recursive pretty-printer. The `typecheck` function should return both the type and the derivation tree.

```ocaml
type derivation =
  | DVar of context * string * ty
  | DLam of context * string * ty * derivation * ty
  | DApp of context * derivation * derivation * ty
  | DTensor of context * derivation * derivation * ty
  | DLetTensor of context * derivation * derivation * ty
  (* ... etc ... *)
```

---

### Problem B.2: Session Type Protocol Checker (25 points)

Implement a checker that verifies that a pair of processes conforms to a binary session type protocol.

**(a)** (5 points) Define the abstract syntax for session types and processes:

```ocaml
type session_type =
  | Send of value_type * session_type
  | Recv of value_type * session_type
  | Choose of (string * session_type) list    (* labeled internal choice *)
  | Offer of (string * session_type) list     (* labeled external choice *)
  | End
  | Rec of string * session_type              (* recursive session type *)
  | SVar of string                            (* recursion variable *)
```

Implement the `dual` function that computes the dual of a session type (Definition 2.2.1 from Lecture 09c). Verify by testing that `dual (dual s) = s` for at least 5 example session types, including:
- A simple send-receive-end type.
- A type with internal and external choice.
- A recursive type (e.g., the counter protocol).
- A type with nested choices.
- The arithmetic server type from Example 2.1.2.

**(b)** (10 points) Implement the session type checker:

```ocaml
val check_session : session_ctx -> process -> session_ctx
```

The checker must verify:
- Send operations match the expected session type (correct value type, correct channel).
- Receive operations match the expected session type.
- Select operations choose a valid label from the available choices.
- Offer operations provide handlers for all required labels.
- Sessions are fully consumed (no dangling channels at the end).
- Recursive sessions are handled correctly (unfolding $\mu X.\, S$ when the recursion variable $X$ is encountered).

**(c)** (5 points) Implement a **deadlock detector** for binary sessions (without channel passing). Given a process $(\nu c_1 : S_1)\, \ldots\, (\nu c_n : S_n)\, (P_1 \mid \ldots \mid P_m)$, check whether the process can make progress. Your detector should:
- Identify channels on which processes are blocked (waiting to send, waiting to receive, etc.).
- Check whether there exist complementary actions on any channel (a send paired with a receive, or a select paired with an offer).
- Report potential deadlocks if no complementary pair exists.

*Implementation hint:* Represent the process state as a list of `(channel, action)` pairs where `action` is one of `WaitSend`, `WaitRecv`, `WaitSelect`, `WaitOffer`, `WaitClose`, `WaitEnd`. Two actions on the same channel are complementary if one is `WaitSend` and the other is `WaitRecv`, or one is `WaitSelect` and the other is `WaitOffer`, or one is `WaitClose` and the other is `WaitEnd`.

**(d)** (5 points) Implement the following example protocols and verify them with your checker:

(i) **Arithmetic server** (Example 2.1.2 from Lecture 09c): a server that offers addition and negation.

(ii) **Counter** (Example 2.11.2 from Lecture 09c): a recursive protocol for a counter with increment and get operations.

(iii) **Two-phase commit**: a protocol between a coordinator and a participant:
- Coordinator sends "prepare."
- Participant responds with "yes" or "no."
- If "yes": coordinator sends "commit," participant acknowledges.
- If "no": coordinator sends "abort," participant acknowledges.

For each protocol, define the session type, implement both the server/coordinator and client/participant processes, and verify that they type-check and are deadlock-free.

For the **two-phase commit** protocol, the session type from the coordinator's perspective should be:

$$S_{\mathsf{coord}} = \;!\mathsf{Prepare}.\; \mathbin{\&}\left\{ \begin{array}{l} \mathsf{yes} : \;!\mathsf{Commit}.\;?\mathsf{Ack}.\;\mathsf{end}, \\ \mathsf{no} : \;!\mathsf{Abort}.\;?\mathsf{Ack}.\;\mathsf{end} \end{array} \right\}$$

Define corresponding process terms and verify them.

**(e)** (Bonus, 5 points) Add support for **multiparty session types**. Implement:
- Global type representation.
- Projection of a global type onto a participant role.
- Verification that all projections are well-defined (the "merge" condition from Definition 2.10.2 of Lecture 09c).

Test with a three-party protocol of your choice (e.g., buyer-seller-shipper).

---

## Grading Criteria

- **Correctness (60%).** Your proofs must be logically sound, and your implementations must correctly accept well-typed inputs and reject ill-typed inputs.

- **Completeness (20%).** All cases must be handled. In Part A, do not skip "trivial" or "analogous" cases --- write them out. In Part B, handle all term forms and error conditions.

- **Clarity (20%).** Proofs should be well-structured with clear case labels. Code should be well-documented with comments explaining the key invariants, especially at context-splitting points.

---

## Submission Instructions

Submit a single archive containing:

1. `theory.pdf` --- solutions to Part A, typeset in LaTeX. All proofs must be complete (no "the remaining cases are analogous" shortcuts).

2. `linear_checker.ml` --- your linear type checker (Problem B.1).

3. `session_checker.ml` --- your session type checker (Problem B.2).

4. `tests.ml` --- your test suites for both checkers.

5. `README.txt` --- brief instructions for compiling and running your code.

All OCaml code must compile with OCaml 5.0 or later. Use `dune` for building.
