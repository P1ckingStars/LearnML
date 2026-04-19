---
title: "Lecture 09a: Linear Types and Linear Logic"
tags:
  - type-theory
  - substructural
  - lecture
---
# Lecture 09a: Linear Types and Linear Logic

> **Module 09 --- Substructural & Effect Types (Weeks 17--18)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Identify the structural rules of weakening, contraction, and exchange in classical and intuitionistic logic, and explain their computational significance.
2. Define the connectives of Girard's linear logic and explain how they arise from the removal of weakening and contraction.
3. State and apply the typing rules of the linear lambda calculus, including context splitting for the application rule.
4. Distinguish the multiplicative connectives (tensor $A \otimes B$, par $A \mathbin{⅋} B$, linear implication $A \multimap B$) from the additive connectives (with $A \mathbin{\&} B$, plus $A \oplus B$).
5. Explain the role of the exponential modality $!A$ ("of course") in reintroducing unrestricted use within a linear framework.
6. Formulate and prove the Curry--Howard correspondence between linear logic and the linear lambda calculus.
7. Connect linear types to resource management in programming: file handles, memory, channels.
8. Derive the duality between $!$ and $?$ and explain its computational meaning.

---

## 1. Motivation: Resources Are Not Propositions

In classical and intuitionistic logic, a proposition, once proved, may be used any number of times---zero, one, or infinitely many. If we know $A$, we may forget that we know it (weakening), and we may duplicate our knowledge (contraction). These are the *structural rules*, and they are so deeply embedded in ordinary reasoning that they typically go unmentioned.

But many computational phenomena do not behave like propositions. Consider:

- **File handles.** An open file handle must be closed exactly once. Forgetting to close it leaks a resource; closing it twice causes a runtime error.
- **Memory.** A heap-allocated block must be freed exactly once. Omitting the free leaks memory; a double free corrupts the heap.
- **Channel endpoints.** A communication channel endpoint must be consumed in accordance with its protocol. Duplicating it causes a race; dropping it deadlocks a partner.
- **Physical resources.** A dollar cannot be spent twice, and ignoring it does not make it disappear.

The key insight of Girard's linear logic (1987) is that these phenomena become manageable---indeed, *statically enforceable*---once we remove the structural rules that allow propositions to be freely duplicated and discarded. In the resulting system, every hypothesis must be used *exactly once*. Types that enforce this discipline are called **linear types**, and they form the foundation of a rich family of *substructural type systems* that we will study throughout this module.

---

## 2. Core Theory

### 2.1 Structural Rules in Sequent Calculus

To understand what linear logic removes, we must first make the structural rules explicit. We work in Gentzen's sequent calculus, where a *sequent* has the form

$$\Gamma \vdash \Delta$$

with $\Gamma$ a multiset of hypotheses (antecedents) and $\Delta$ a multiset of conclusions (succedents). In the one-sided intuitionistic presentation we use $\Gamma \vdash A$ with a single conclusion.

**Definition 2.1.1 (Structural rules).** The three structural rules of the intuitionistic sequent calculus are:

**(1) Exchange (E).** The order of hypotheses does not matter:

$$\frac{\Gamma, A, B, \Delta \vdash C}{\Gamma, B, A, \Delta \vdash C} \; (\text{Exchange})$$

This rule justifies treating contexts as multisets (or sets) rather than lists.

**(2) Weakening (W).** An unused hypothesis may be added:

$$\frac{\Gamma \vdash C}{\Gamma, A \vdash C} \; (\text{Weakening})$$

Computationally, weakening corresponds to the ability to *ignore* a variable---to have a function $\lambda x.\, M$ in which $x$ does not appear free in $M$.

**(3) Contraction (C).** A hypothesis may be duplicated:

$$\frac{\Gamma, A, A \vdash C}{\Gamma, A \vdash C} \; (\text{Contraction})$$

Computationally, contraction corresponds to the ability to *use a variable more than once*---to have $\lambda x.\, M$ where $x$ appears free multiple times in $M$.

**Remark 2.1.2.** In the simply typed lambda calculus (Module 02), all three structural rules are admissible. The variable rule, abstraction rule, and application rule together allow variables to be reordered, ignored, and reused freely. We never noticed the structural rules because they were built into the system from the start.

**Definition 2.1.3 (Substructural logics).** A *substructural logic* is obtained by restricting one or more of the structural rules:

| Logic | Exchange | Weakening | Contraction |
|-------|----------|-----------|-------------|
| Classical / Intuitionistic | Yes | Yes | Yes |
| Linear | Yes | No | No |
| Affine | Yes | Yes | No |
| Relevant | Yes | No | Yes |
| Ordered (Lambek) | No | No | No |

The corresponding type systems inherit the same restrictions: in a linear type system, every variable must be used exactly once; in an affine type system, every variable must be used at most once; and so forth.

### 2.2 Linear Logic: Syntax

Girard introduced linear logic in his landmark 1987 paper. The key observation is that once weakening and contraction are removed, the single intuitionistic conjunction $\land$ and disjunction $\lor$ each *split* into two distinct connectives: one *multiplicative* and one *additive*. Similarly, implication splits, and a new modality $!$ is introduced to recover unrestricted reasoning when needed.

**Definition 2.2.1 (Formulas of intuitionistic linear logic).** The formulas (propositions) of *intuitionistic linear logic* (ILL) are given by the grammar:

$$A, B ::= \alpha \mid A \multimap B \mid A \otimes B \mid \mathbf{1} \mid A \mathbin{\&} B \mid \top \mid A \oplus B \mid \mathbf{0} \mid \;!A$$

where $\alpha$ ranges over propositional variables. The connectives are organized as follows:

| | Unit | Binary |
|---|---|---|
| **Multiplicative** | $\mathbf{1}$ | $A \otimes B$ (tensor), $A \multimap B$ (linear implication) |
| **Additive** | $\top$ (additive truth), $\mathbf{0}$ (additive falsehood) | $A \mathbin{\&} B$ (with), $A \oplus B$ (plus) |
| **Exponential** | --- | $!A$ (of course / bang) |

**Remark 2.2.2.** In classical linear logic (CLL), there is also $A \mathbin{⅋} B$ (par), the multiplicative disjunction, and $?A$ (why not), the dual of $!A$. We will discuss these in Section 2.7 when we treat duality. For now, we focus on the intuitionistic fragment, which is most directly relevant to programming.

### 2.3 Multiplicative Connectives

The multiplicative connectives govern how the context (the collection of hypotheses) is *split* between subderivations.

**Definition 2.3.1 (Linear implication, $\multimap$).** The formula $A \multimap B$ asserts: "consuming one $A$, produce one $B$." This is the *linear function type*. Unlike the ordinary function type $A \to B$, a linear function must use its argument exactly once.

The rules:

$$\frac{\Gamma, A \vdash B}{\Gamma \vdash A \multimap B} \; (\multimap\text{R})$$

$$\frac{\Gamma \vdash A \multimap B \quad \Delta \vdash A}{\Gamma, \Delta \vdash B} \; (\multimap\text{L})$$

The critical feature is in $(\multimap\text{L})$: the combined context is $\Gamma, \Delta$---a *disjoint* split. The resources used to prove $A \multimap B$ and the resources used to prove $A$ must be *separate*. This is the essence of linearity: resources cannot be shared between the function and the argument.

**Definition 2.3.2 (Tensor product, $\otimes$).** The formula $A \otimes B$ asserts: "I have both an $A$ and a $B$ (simultaneously, using separate resources for each)."

$$\frac{\Gamma \vdash A \quad \Delta \vdash B}{\Gamma, \Delta \vdash A \otimes B} \; (\otimes\text{R})$$

$$\frac{\Gamma \vdash A \otimes B \quad \Delta, A, B \vdash C}{\Gamma, \Delta \vdash C} \; (\otimes\text{L})$$

Again, the introduction rule splits the context: $\Gamma$ is used for $A$ and $\Delta$ is used for $B$. The elimination rule makes both components available simultaneously, but linearly---each must be used exactly once in the continuation.

**Definition 2.3.3 (Multiplicative unit, $\mathbf{1}$).** The unit of tensor:

$$\frac{}{\vdash \mathbf{1}} \; (\mathbf{1}\text{R})$$

$$\frac{\Gamma \vdash \mathbf{1} \quad \Delta \vdash C}{\Gamma, \Delta \vdash C} \; (\mathbf{1}\text{L})$$

The right rule requires an *empty* context: $\mathbf{1}$ consumes no resources. The left rule discards a proof of $\mathbf{1}$ (which held no resources) and continues.

**Proposition 2.3.4.** $A \multimap B$ is equivalent to the "internal hom" of the tensor: $A \multimap B$ is the right adjoint of $- \otimes A$. That is, there is a natural bijection between proofs of $\Gamma \vdash A \multimap B$ and proofs of $\Gamma, A \vdash B$, and more generally:

$$\frac{\Gamma \otimes A \vdash B}{\Gamma \vdash A \multimap B}$$

This is the *tensor-hom adjunction*, the linear analogue of the currying isomorphism $A \times B \to C \cong A \to (B \to C)$.

*Proof.* Direct from the rules $(\multimap\text{R})$ and $(\otimes\text{R})$: the introduction rule for $\multimap$ is exactly the rule that moves $A$ from the context on the left of $\vdash$ into a $\multimap$ on the right, and conversely. $\square$

### 2.4 Additive Connectives

The additive connectives do *not* split the context. Instead, the *same* context must suffice for both components.

**Definition 2.4.1 (With, $\mathbin{\&}$).** The formula $A \mathbin{\&} B$ asserts: "I can produce either an $A$ or a $B$ (your choice), using the same resources."

$$\frac{\Gamma \vdash A \quad \Gamma \vdash B}{\Gamma \vdash A \mathbin{\&} B} \; (\mathbin{\&}\text{R})$$

$$\frac{\Gamma \vdash A \mathbin{\&} B}{\Gamma \vdash A} \; (\mathbin{\&}\text{L}_1) \qquad \frac{\Gamma \vdash A \mathbin{\&} B}{\Gamma \vdash B} \; (\mathbin{\&}\text{L}_2)$$

The introduction rule uses the *same* context $\Gamma$ in both premises. This means the resources in $\Gamma$ must suffice to produce *either* result. The eliminations select one component, discarding the other possibility.

**Remark 2.4.2.** Compare with tensor: $A \otimes B$ splits the context (you have both, using *different* resources for each), while $A \mathbin{\&} B$ shares the context (you can provide either, using the *same* resources). This is the fundamental distinction between the multiplicative and additive worlds.

In intuitionistic logic (without linearity), $A \times B$ collapses both $A \otimes B$ and $A \mathbin{\&} B$ into a single connective, because weakening and contraction allow you to freely copy and discard context, making the distinction between splitting and sharing invisible.

**Definition 2.4.3 (Plus, $\oplus$).** The formula $A \oplus B$ asserts: "I have either an $A$ or a $B$ (my choice)."

$$\frac{\Gamma \vdash A}{\Gamma \vdash A \oplus B} \; (\oplus\text{R}_1) \qquad \frac{\Gamma \vdash B}{\Gamma \vdash A \oplus B} \; (\oplus\text{R}_2)$$

$$\frac{\Gamma \vdash A \oplus B \quad \Delta, A \vdash C \quad \Delta, B \vdash C}{\Gamma, \Delta \vdash C} \; (\oplus\text{L})$$

The elimination rule splits the context: $\Gamma$ produces the $A \oplus B$, while $\Delta$ is used in both branches. Each branch receives exactly one of $A$ or $B$.

**Definition 2.4.4 (Additive units).** The additive truth $\top$ and falsehood $\mathbf{0}$:

$$\frac{}{\Gamma \vdash \top} \; (\top\text{R})$$

No left rule is needed for $\top$; it is trivially provable from any context. Note that unlike $\mathbf{1}\text{R}$, this rule does *not* require an empty context---$\Gamma$ is simply discarded. This makes $\top$ a "garbage collector" in linear logic: it is the one place where resources can be safely dropped.

$$\frac{\Gamma \vdash \mathbf{0}}{\Gamma \vdash C} \; (\mathbf{0}\text{L})$$

There is no right rule for $\mathbf{0}$; it is unprovable. Its elimination rule says that from a proof of falsehood, we can derive anything (ex falso quodlibet), and the resources in $\Gamma$ are released.

### 2.5 The Exponential Modality: $!A$ ("Of Course")

Linear logic, taken literally, is extremely restrictive: every hypothesis must be used exactly once. This makes it impossible to write even simple programs like $\lambda x.\, (x, x)$ (which uses $x$ twice) or $\lambda x.\, 42$ (which ignores $x$). The exponential modality $!A$ provides a disciplined escape hatch.

**Definition 2.5.1 (Exponential, $!A$).** The formula $!A$ asserts: "I have an unlimited supply of $A$." A hypothesis of type $!A$ may be used zero, one, or arbitrarily many times.

We write $!\Gamma$ for a context in which *every* formula is of the form $!A_i$. The rules are:

**Promotion (introduction):**

$$\frac{!\Gamma \vdash A}{!\Gamma \vdash \;!A} \; (!\text{R} / \text{Promotion})$$

To produce a $!A$, all hypotheses must themselves be unlimited ($!\Gamma$). This ensures that the proof of $A$ does not depend on any linear resource, so it is safe to replicate.

**Dereliction (use once):**

$$\frac{\Gamma, A \vdash C}{\Gamma, \;!A \vdash C} \; (\text{Dereliction})$$

An unlimited resource $!A$ can always be used as a single linear $A$.

**Weakening (discard):**

$$\frac{\Gamma \vdash C}{\Gamma, \;!A \vdash C} \; (!\text{W})$$

An unlimited resource can be discarded---weakening is recovered for $!$-formulas.

**Contraction (duplicate):**

$$\frac{\Gamma, \;!A, \;!A \vdash C}{\Gamma, \;!A \vdash C} \; (!\text{C})$$

An unlimited resource can be duplicated---contraction is recovered for $!$-formulas.

**Proposition 2.5.2.** The type $!A \multimap B$ is the "ordinary" (non-linear) function type: it takes an argument of type $A$ that may be used any number of times. More precisely, $!A \multimap B$ in linear logic corresponds to $A \to B$ in intuitionistic logic.

*Proof.* Given a hypothesis $!A$, dereliction allows using it once, weakening allows ignoring it, and contraction allows duplicating it. Thus within the body of a function of type $!A \multimap B$, the variable bound to $A$ can be used zero or more times, exactly as in the intuitionistic setting. $\square$

**Proposition 2.5.3 (ILL embeds into IL).** Intuitionistic logic embeds into intuitionistic linear logic via the translation $(\cdot)^{\circ}$ defined by:

$$\alpha^{\circ} = \alpha$$

$$(\varphi \to \psi)^{\circ} = \;!\varphi^{\circ} \multimap \psi^{\circ}$$

$$(\varphi \land \psi)^{\circ} = \varphi^{\circ} \mathbin{\&} \psi^{\circ}$$

$$(\varphi \lor \psi)^{\circ} = \varphi^{\circ} \oplus \psi^{\circ}$$

Under this translation, $\Gamma \vdash_{\text{IL}} \varphi$ if and only if $!\Gamma^{\circ} \vdash_{\text{ILL}} \varphi^{\circ}$.

*Proof sketch.* The key insight is that in intuitionistic logic, every hypothesis can be used any number of times, which corresponds to marking every hypothesis with $!$ in ILL. The translation of $\to$ as $!\cdot \multimap \cdot$ reflects that ordinary functions have unrestricted access to their arguments. The proof proceeds by induction on the derivation in IL, using the exponential rules (dereliction, weakening, contraction, promotion) to simulate the structural rules available in IL. $\square$

### 2.6 The Linear Lambda Calculus

We now give the computational interpretation of intuitionistic linear logic as a typed lambda calculus.

**Definition 2.6.1 (Syntax of the linear lambda calculus).** Terms are defined by:

$$M, N ::= x \mid \lambda x.\, M \mid M\; N \mid (M, N) \mid \mathsf{let}\; (x, y) = M \;\mathsf{in}\; N \mid \langle M, N \rangle \mid \pi_1\, M \mid \pi_2\, M$$

$$\mid \; \mathsf{inl}\, M \mid \mathsf{inr}\, M \mid \mathsf{case}\; M \;\mathsf{of}\; \mathsf{inl}\, x \Rightarrow N_1; \mathsf{inr}\, y \Rightarrow N_2$$

$$\mid \; () \mid \mathsf{let}\; () = M \;\mathsf{in}\; N$$

$$\mid \; \mathsf{promote}\, M \mid \mathsf{derelict}\, M \mid \mathsf{discard}\; M \;\mathsf{in}\; N \mid \mathsf{copy}\; M \;\mathsf{as}\; x, y \;\mathsf{in}\; N$$

where we distinguish:
- $\lambda x.\, M$ and $M\; N$ for linear functions ($\multimap$),
- $(M, N)$ and $\mathsf{let}\; (x, y) = M \;\mathsf{in}\; N$ for tensor products ($\otimes$),
- $\langle M, N \rangle$, $\pi_1$, $\pi_2$ for the additive product ($\mathbin{\&}$),
- $\mathsf{inl}$, $\mathsf{inr}$, $\mathsf{case}$ for the additive sum ($\oplus$),
- $()$ and $\mathsf{let}\; () = M \;\mathsf{in}\; N$ for the multiplicative unit ($\mathbf{1}$),
- $\mathsf{promote}$, $\mathsf{derelict}$, $\mathsf{discard}$, $\mathsf{copy}$ for the exponential ($!$).

**Definition 2.6.2 (Contexts).** A *linear context* $\Gamma$ is a finite list of bindings $x_1 : A_1, \ldots, x_n : A_n$ where all variables are distinct. We write $\Gamma, \Delta$ for the *disjoint union* of two contexts (defined only when $\Gamma$ and $\Delta$ bind no common variables). We write $!\Gamma$ to indicate that every binding in $\Gamma$ has the form $x_i : \;!A_i$.

**Definition 2.6.3 (Context splitting).** A *splitting* of a context $\Gamma$ into $\Gamma_1$ and $\Gamma_2$ (written $\Gamma = \Gamma_1, \Gamma_2$) is a partition of the bindings in $\Gamma$ such that:
- Every linear binding $x : A$ (where $A$ is not of the form $!B$) appears in exactly one of $\Gamma_1$ or $\Gamma_2$.
- Every unrestricted binding $x : \;!A$ appears in *both* $\Gamma_1$ and $\Gamma_2$.

This definition is the computational heart of linear type checking: when typing an application $M\; N$, we must decide how to split the available resources between $M$ and $N$.

**Definition 2.6.4 (Typing rules).** The typing judgment $\Gamma \vdash M : A$ is defined by the following rules.

**Variable:**

$$\frac{}{\Gamma, x : A \vdash x : A} \; (\text{Var})$$

where $\Gamma$ consists entirely of unrestricted bindings ($!\Gamma$). This ensures that no linear variable is left unused.

**Linear abstraction ($\multimap$-I):**

$$\frac{\Gamma, x : A \vdash M : B}{\Gamma \vdash \lambda x.\, M : A \multimap B} \; (\multimap\text{-I})$$

**Application ($\multimap$-E):**

$$\frac{\Gamma_1 \vdash M : A \multimap B \quad \Gamma_2 \vdash N : A}{\Gamma_1, \Gamma_2 \vdash M\; N : B} \; (\multimap\text{-E})$$

The context is split: $\Gamma_1$ is used for the function, $\Gamma_2$ for the argument. No resource appears in both.

**Tensor introduction ($\otimes$-I):**

$$\frac{\Gamma_1 \vdash M : A \quad \Gamma_2 \vdash N : B}{\Gamma_1, \Gamma_2 \vdash (M, N) : A \otimes B} \; (\otimes\text{-I})$$

**Tensor elimination ($\otimes$-E):**

$$\frac{\Gamma_1 \vdash M : A \otimes B \quad \Gamma_2, x : A, y : B \vdash N : C}{\Gamma_1, \Gamma_2 \vdash \mathsf{let}\; (x, y) = M \;\mathsf{in}\; N : C} \; (\otimes\text{-E})$$

**Multiplicative unit ($\mathbf{1}$):**

$$\frac{}{\vdash () : \mathbf{1}} \; (\mathbf{1}\text{-I}) \qquad \frac{\Gamma_1 \vdash M : \mathbf{1} \quad \Gamma_2 \vdash N : C}{\Gamma_1, \Gamma_2 \vdash \mathsf{let}\; () = M \;\mathsf{in}\; N : C} \; (\mathbf{1}\text{-E})$$

**With introduction ($\mathbin{\&}$-I):**

$$\frac{\Gamma \vdash M : A \quad \Gamma \vdash N : B}{\Gamma \vdash \langle M, N \rangle : A \mathbin{\&} B} \; (\mathbin{\&}\text{-I})$$

Note: the *same* context $\Gamma$ is used for both components.

**With elimination ($\mathbin{\&}$-E):**

$$\frac{\Gamma \vdash M : A \mathbin{\&} B}{\Gamma \vdash \pi_1\, M : A} \; (\mathbin{\&}\text{-E}_1) \qquad \frac{\Gamma \vdash M : A \mathbin{\&} B}{\Gamma \vdash \pi_2\, M : B} \; (\mathbin{\&}\text{-E}_2)$$

**Plus introduction ($\oplus$-I):**

$$\frac{\Gamma \vdash M : A}{\Gamma \vdash \mathsf{inl}\, M : A \oplus B} \; (\oplus\text{-I}_1) \qquad \frac{\Gamma \vdash M : B}{\Gamma \vdash \mathsf{inr}\, M : A \oplus B} \; (\oplus\text{-I}_2)$$

**Plus elimination ($\oplus$-E):**

$$\frac{\Gamma_1 \vdash M : A \oplus B \quad \Gamma_2, x : A \vdash N_1 : C \quad \Gamma_2, y : B \vdash N_2 : C}{\Gamma_1, \Gamma_2 \vdash \mathsf{case}\; M \;\mathsf{of}\; \mathsf{inl}\, x \Rightarrow N_1;\; \mathsf{inr}\, y \Rightarrow N_2 : C} \; (\oplus\text{-E})$$

**Promotion ($!$-I):**

$$\frac{!\Gamma \vdash M : A}{!\Gamma \vdash \mathsf{promote}\, M : \;!A} \; (!\text{-I})$$

All hypotheses must be unrestricted.

**Dereliction ($!$-E$_1$):**

$$\frac{\Gamma \vdash M : \;!A}{\Gamma \vdash \mathsf{derelict}\, M : A} \; (\text{Dereliction})$$

**Discard ($!$-E$_2$, weakening):**

$$\frac{\Gamma_1 \vdash M : \;!A \quad \Gamma_2 \vdash N : C}{\Gamma_1, \Gamma_2 \vdash \mathsf{discard}\; M \;\mathsf{in}\; N : C} \; (!\text{-W})$$

**Copy ($!$-E$_3$, contraction):**

$$\frac{\Gamma_1 \vdash M : \;!A \quad \Gamma_2, x : \;!A, y : \;!A \vdash N : C}{\Gamma_1, \Gamma_2 \vdash \mathsf{copy}\; M \;\mathsf{as}\; x, y \;\mathsf{in}\; N : C} \; (!\text{-C})$$

### 2.7 Context Splitting: The Key Algorithm

The most distinctive feature of linear type checking, compared to ordinary type checking, is the need to *split* the context at every application and every tensor introduction. This is where the "bookkeeping" of linearity happens.

**Definition 2.7.1 (Context split).** Given a context $\Gamma$, a *split* of $\Gamma$ is a pair $(\Gamma_1, \Gamma_2)$ such that:

1. For each linear binding $x : A$ in $\Gamma$ (where $A$ is not $!B$), either $x : A \in \Gamma_1$ and $x \notin \mathrm{dom}(\Gamma_2)$, or $x : A \in \Gamma_2$ and $x \notin \mathrm{dom}(\Gamma_1)$.
2. For each unrestricted binding $x : !A$ in $\Gamma$, $x : !A \in \Gamma_1$ and $x : !A \in \Gamma_2$.

**Remark 2.7.2.** In a type-checking algorithm, the split is not guessed nondeterministically. Instead, the algorithm proceeds *bidirectionally*: it checks one subterm first, records which linear variables were consumed, and gives the remaining variables to the other subterm. This is the approach taken in practice by linear type checkers, and it is the approach we will implement in Recitation 09.

**Algorithm 2.7.3 (Algorithmic context splitting).** Given $\Gamma \vdash M\; N : B$:

1. Type-check $M$ using the full context $\Gamma$, obtaining a type $A \multimap B$ and a set $\text{used}_M \subseteq \mathrm{dom}(\Gamma)$ of linear variables consumed.
2. Let $\Gamma' = \Gamma \setminus \text{used}_M$ (remove the consumed linear variables; keep all unrestricted variables).
3. Type-check $N$ using $\Gamma'$, obtaining type $A$ and a set $\text{used}_N$.
4. Verify that $\text{used}_M \cup \text{used}_N$ covers all linear variables in $\Gamma$ (no linear variable is left unconsumed).

This algorithm is sound and complete with respect to the declarative rules.

**Theorem 2.7.4 (Soundness of algorithmic splitting).** If the algorithm succeeds, producing $\Gamma \vdash M\; N : B$, then there exists a split $\Gamma = \Gamma_1, \Gamma_2$ such that the declarative rules $\Gamma_1 \vdash M : A \multimap B$ and $\Gamma_2 \vdash N : A$ are derivable.

*Proof.* Let $\Gamma_1$ contain the unrestricted bindings of $\Gamma$ together with the linear bindings in $\text{used}_M$, and let $\Gamma_2$ contain the unrestricted bindings together with the linear bindings in $\text{used}_N$. Since $\text{used}_M$ and $\text{used}_N$ are disjoint (a linear variable consumed by $M$ is removed before checking $N$) and their union covers all linear variables (checked in step 4), $(\Gamma_1, \Gamma_2)$ is a valid split. $\square$

### 2.8 Worked Examples

Before presenting the operational semantics, we work through several detailed typing derivations to illustrate the context-splitting mechanism.

**Example 2.8.1 (Linear identity).** The term $\lambda x.\, x : A \multimap A$.

$$\frac{\frac{}{x : A \vdash x : A} \; (\text{Var})}{{\vdash \lambda x.\, x : A \multimap A}} \; (\multimap\text{-I})$$

The variable rule requires that the remaining context is purely unrestricted (in this case, empty). The variable $x : A$ is consumed by the variable occurrence.

**Example 2.8.2 (Linear swap).** The term $\lambda p.\, \mathsf{let}\; (x, y) = p \;\mathsf{in}\; (y, x) : (A \otimes B) \multimap (B \otimes A)$.

$$\frac{\frac{\frac{}{p : A \otimes B \vdash p : A \otimes B} \; (\text{Var}) \quad \frac{\frac{}{y : B \vdash y : B} \; (\text{Var}) \quad \frac{}{x : A \vdash x : A} \; (\text{Var})}{x : A, y : B \vdash (y, x) : B \otimes A} \; (\otimes\text{-I})}{p : A \otimes B \vdash \mathsf{let}\; (x, y) = p \;\mathsf{in}\; (y, x) : B \otimes A} \; (\otimes\text{-E})}{\vdash \lambda p.\, \mathsf{let}\; (x, y) = p \;\mathsf{in}\; (y, x) : (A \otimes B) \multimap (B \otimes A)} \; (\multimap\text{-I})$$

Note the context split in the $(\otimes\text{-I})$ rule: $y : B$ goes to the left subterm and $x : A$ goes to the right subterm. Each linear variable is used exactly once.

**Example 2.8.3 (Currying for linear types).** The term $\mathsf{curry} : (A \otimes B \multimap C) \multimap (A \multimap B \multimap C)$:

$$\mathsf{curry} = \lambda f.\, \lambda a.\, \lambda b.\, f\; (a, b)$$

The typing derivation is:

$$\frac{\frac{\frac{}{f : A \otimes B \multimap C \vdash f : A \otimes B \multimap C} \quad \frac{\frac{}{a : A \vdash a : A} \quad \frac{}{b : B \vdash b : B}}{a : A, b : B \vdash (a, b) : A \otimes B}}{f : A \otimes B \multimap C, a : A, b : B \vdash f\; (a, b) : C}}{\ \vdots\ }$$

At the application $f\; (a, b)$, the context $\{f, a, b\}$ is split as $\{f\}$ for the function and $\{a, b\}$ for the argument. Within the tensor pair $(a, b)$, the context $\{a, b\}$ is further split as $\{a\}$ for the left component and $\{b\}$ for the right.

**Example 2.8.4 (Ill-typed: contraction).** The term $\lambda x.\, (x, x) : A \multimap A \otimes A$ is *not* well-typed. At the $(\otimes\text{-I})$ rule, we must split the context $\{x : A\}$ into two parts: one containing $x$ for the left component and one for the right. But $x$ cannot appear in both parts (contraction is not allowed). Therefore the term is rejected.

**Example 2.8.5 (Ill-typed: weakening).** The term $\lambda x.\, () : A \multimap \mathbf{1}$ is *not* well-typed (when $A$ is a linear type). The $(\multimap\text{-I})$ rule introduces $x : A$ into the context, but the body $()$ does not use $x$. Since $A$ is not of the form $!B$, the unused binding $x : A$ violates the linearity constraint.

**Example 2.8.6 (Well-typed with $!$: contraction).** The term $\lambda x.\, \mathsf{copy}\; x \;\mathsf{as}\; a, b \;\mathsf{in}\; (\mathsf{derelict}\; a, \mathsf{derelict}\; b) : \;!A \multimap A \otimes A$ is well-typed:

1. By $(\multimap\text{-I})$, we have $x : \;!A$ in context.
2. By $(!\text{-C})$, we copy $x$ into $a : \;!A$ and $b : \;!A$.
3. By dereliction, $\mathsf{derelict}\; a : A$ and $\mathsf{derelict}\; b : A$.
4. By $(\otimes\text{-I})$, $(\mathsf{derelict}\; a, \mathsf{derelict}\; b) : A \otimes A$.

The $!$ modality makes contraction safe: the underlying value is independent of any linear resource and can be freely duplicated.

**Example 2.8.7 (Additive pair vs. multiplicative pair).** Consider $f : A \multimap B$ and $g : A \multimap C$. We can form:

$$\lambda x.\, \langle f\; x, g\; x \rangle \quad : \quad A \multimap B \mathbin{\&} C$$

using the additive pair ($\mathbin{\&}$-I), which *shares* the context: the *same* $x$ is used in both $f\; x$ and $g\; x$. This is well-typed because the additive rule does not split the context.

But we *cannot* form:

$$\lambda x.\, (f\; x, g\; x) \quad : \quad A \multimap B \otimes C$$

using the multiplicative pair ($\otimes$-I), because this would require splitting $x$ between the two components---using it once in $f\; x$ and once in $g\; x$---which is contraction.

This illustrates the fundamental difference: $\mathbin{\&}$ offers a *choice* (the consumer picks one), while $\otimes$ provides *both* (but requires separate resources).

### 2.9 Operational Semantics

**Definition 2.9.1 (Values).** The values of the linear lambda calculus are:

$$V ::= \lambda x.\, M \mid (V_1, V_2) \mid () \mid \langle V_1, V_2 \rangle \mid \mathsf{inl}\, V \mid \mathsf{inr}\, V \mid \mathsf{promote}\, V$$

**Definition 2.9.2 (Evaluation contexts).** The call-by-value evaluation contexts are:

$$\mathcal{E} ::= [\cdot] \mid \mathcal{E}\; N \mid V\; \mathcal{E} \mid (\mathcal{E}, N) \mid (V, \mathcal{E}) \mid \mathsf{let}\; (x, y) = \mathcal{E} \;\mathsf{in}\; N$$

$$\mid \; \mathsf{let}\; () = \mathcal{E} \;\mathsf{in}\; N \mid \pi_i\, \mathcal{E} \mid \mathsf{inl}\, \mathcal{E} \mid \mathsf{inr}\, \mathcal{E}$$

$$\mid \; \mathsf{case}\; \mathcal{E} \;\mathsf{of}\; \ldots \mid \mathsf{derelict}\, \mathcal{E} \mid \mathsf{discard}\; \mathcal{E} \;\mathsf{in}\; N \mid \mathsf{copy}\; \mathcal{E} \;\mathsf{as}\; x, y \;\mathsf{in}\; N$$

**Definition 2.9.3 (Reduction rules).** The linear lambda calculus has the following $\beta$-reduction rules:

$$(\lambda x.\, M)\; N \longrightarrow M[N/x] \quad (\beta_{\multimap})$$

$$\mathsf{let}\; (x, y) = (M_1, M_2) \;\mathsf{in}\; N \longrightarrow N[M_1/x, M_2/y] \quad (\beta_{\otimes})$$

$$\pi_i\, \langle M_1, M_2 \rangle \longrightarrow M_i \quad (\beta_{\mathbin{\&}})$$

$$\mathsf{case}\; (\mathsf{inl}\, M) \;\mathsf{of}\; \mathsf{inl}\, x \Rightarrow N_1;\; \mathsf{inr}\, y \Rightarrow N_2 \longrightarrow N_1[M/x] \quad (\beta_{\oplus_1})$$

$$\mathsf{case}\; (\mathsf{inr}\, M) \;\mathsf{of}\; \mathsf{inl}\, x \Rightarrow N_1;\; \mathsf{inr}\, y \Rightarrow N_2 \longrightarrow N_2[M/y] \quad (\beta_{\oplus_2})$$

$$\mathsf{let}\; () = () \;\mathsf{in}\; N \longrightarrow N \quad (\beta_{\mathbf{1}})$$

$$\mathsf{derelict}\; (\mathsf{promote}\, M) \longrightarrow M \quad (\beta_{!1})$$

$$\mathsf{discard}\; (\mathsf{promote}\, M) \;\mathsf{in}\; N \longrightarrow N \quad (\beta_{!2})$$

$$\mathsf{copy}\; (\mathsf{promote}\, M) \;\mathsf{as}\; x, y \;\mathsf{in}\; N \longrightarrow N[\mathsf{promote}\, M / x, \mathsf{promote}\, M / y] \quad (\beta_{!3})$$

**Remark 2.9.4.** In the rule $(\beta_{!3})$, the promoted term $\mathsf{promote}\, M$ is duplicated. This is safe because promotion requires all hypotheses to be unrestricted, so $M$ depends on no linear resources.

**Definition 2.9.5 (Congruence closure).** Reduction is closed under evaluation contexts:

$$\frac{M \longrightarrow M'}{\mathcal{E}[M] \longrightarrow \mathcal{E}[M']}$$

**Definition 2.9.6 (Eta-expansions).** The linear lambda calculus also admits $\eta$-expansion rules, which are important for the categorical semantics:

$$M : A \multimap B \quad \longrightarrow_{\eta} \quad \lambda x.\, M\; x \quad (x \notin \mathrm{FV}(M))$$

$$M : A \otimes B \quad \longrightarrow_{\eta} \quad \mathsf{let}\; (x, y) = M \;\mathsf{in}\; (x, y)$$

$$M : \mathbf{1} \quad \longrightarrow_{\eta} \quad \mathsf{let}\; () = M \;\mathsf{in}\; ()$$

$$M : A \mathbin{\&} B \quad \longrightarrow_{\eta} \quad \langle \pi_1\, M, \pi_2\, M \rangle$$

The $\eta$-rule for $\otimes$ is called the *commuting conversion* in proof theory.

**Example 2.9.7 (Reduction sequence).** Consider the term:

$$(\lambda f.\, \lambda x.\, f\; x)\; (\lambda y.\, (y, y'))$$

where $y' : \;!B$ is free and unrestricted. The reduction proceeds:

$$(\lambda f.\, \lambda x.\, f\; x)\; (\lambda y.\, (y, y')) \longrightarrow_{\beta_{\multimap}} \lambda x.\, (\lambda y.\, (y, y'))\; x \longrightarrow_{\beta_{\multimap}} \lambda x.\, (x, y')$$

Wait---this example is ill-typed because $(y, y')$ uses $y$ once (fine), but the outer application would need to split the context. Let us instead consider a fully linear example:

$$\mathsf{let}\; (a, b) = (\lambda x.\, (x, ()))\; v \;\mathsf{in}\; a$$

Assuming $v : A$:

$$(\lambda x.\, (x, ()))\; v \longrightarrow_{\beta_{\multimap}} (v, ())$$

$$\mathsf{let}\; (a, b) = (v, ()) \;\mathsf{in}\; a \longrightarrow_{\beta_{\otimes}} a[v/a, ()/b] = v$$

But this last step is ill-typed: $b$ has type $\mathbf{1}$ and is not used, which violates linearity. The correct term would be:

$$\mathsf{let}\; (a, b) = (v, ()) \;\mathsf{in}\; \mathsf{let}\; () = b \;\mathsf{in}\; a$$

$$\longrightarrow_{\beta_{\otimes}} \mathsf{let}\; () = () \;\mathsf{in}\; v \longrightarrow_{\beta_{\mathbf{1}}} v$$

This illustrates that in the linear lambda calculus, every intermediate value must be explicitly consumed.

### 2.10 Type Safety

**Theorem 2.10.1 (Preservation / Subject reduction).** If $\Gamma \vdash M : A$ and $M \longrightarrow M'$, then $\Gamma \vdash M' : A$.

*Proof.* By induction on the derivation of $\Gamma \vdash M : A$, with a case analysis on the reduction step $M \longrightarrow M'$.

**Case $(\beta_{\multimap})$:** We have $\Gamma_1, \Gamma_2 \vdash (\lambda x.\, M_0)\; N : B$ derived from:
- $\Gamma_1 \vdash \lambda x.\, M_0 : A \multimap B$, which comes from $\Gamma_1, x : A \vdash M_0 : B$.
- $\Gamma_2 \vdash N : A$.

The reduct is $M_0[N/x]$. By the substitution lemma (below), $\Gamma_1, \Gamma_2 \vdash M_0[N/x] : B$.

**Case $(\beta_{\otimes})$:** We have $\Gamma_1, \Gamma_2 \vdash \mathsf{let}\; (x, y) = (M_1, M_2) \;\mathsf{in}\; N : C$ derived from:
- $\Gamma_1 \vdash (M_1, M_2) : A \otimes B$, which comes from $\Gamma_{11} \vdash M_1 : A$ and $\Gamma_{12} \vdash M_2 : B$ with $\Gamma_1 = \Gamma_{11}, \Gamma_{12}$.
- $\Gamma_2, x : A, y : B \vdash N : C$.

The reduct is $N[M_1/x, M_2/y]$. By two applications of the substitution lemma, $\Gamma_{11}, \Gamma_{12}, \Gamma_2 \vdash N[M_1/x, M_2/y] : C$, i.e., $\Gamma_1, \Gamma_2 \vdash N[M_1/x, M_2/y] : C$.

The remaining cases ($\beta_{\mathbin{\&}}$, $\beta_{\oplus}$, $\beta_{\mathbf{1}}$, $\beta_{!}$) are analogous. $\square$

**Lemma 2.10.2 (Linear substitution).** If $\Gamma, x : A \vdash M : B$ and $\Delta \vdash N : A$, then $\Gamma, \Delta \vdash M[N/x] : B$.

*Proof.* By induction on the derivation of $\Gamma, x : A \vdash M : B$.

**Case** $M = x$: Then $B = A$ and $\Gamma$ is empty (or purely unrestricted). The result is $\Delta \vdash N : A$, which holds by hypothesis (with possible weakening of unrestricted variables).

**Case** $M = y$ where $y \neq x$: Then $x$ must not be linear, which contradicts the assumption that $x : A$ is in the context and must be used. (If $A$ were $!A'$, weakening would apply.) Actually, in this case $x$ was not used, which is only valid if $A = !A'$ and weakening was applied. Then $M[N/x] = y$ and we must show $\Gamma, \Delta \vdash y : B$. Since $y : B \in \Gamma$ and we can weaken with the unrestricted parts of $\Delta$, plus $N : !A'$ can be discarded, this holds.

**Case** $M = \lambda z.\, M_0$: We have $\Gamma, x : A \vdash \lambda z.\, M_0 : C \multimap B$ from $\Gamma, x : A, z : C \vdash M_0 : B$. By IH, $\Gamma, \Delta, z : C \vdash M_0[N/x] : B$, so $\Gamma, \Delta \vdash \lambda z.\, M_0[N/x] : C \multimap B$.

**Case** $M = M_1\; M_2$: The context $\Gamma, x : A$ is split as $\Gamma_1, \Gamma_2$ where $x : A$ appears in one component (say $\Gamma_1 = \Gamma_1', x : A$). By IH on the subterm containing $x$, we substitute, and the resulting context includes $\Delta$ in place of $x : A$. The split becomes $\Gamma_1', \Delta, \Gamma_2 \setminus \Gamma_1'$, which is valid.

The remaining cases follow the same pattern. $\square$

**Theorem 2.10.3 (Progress).** If $\vdash M : A$ (closed, well-typed term), then either $M$ is a value or there exists $M'$ such that $M \longrightarrow M'$.

*Proof.* By induction on the derivation of $\vdash M : A$. The proof is essentially identical to the STLC progress theorem (Module 02), with additional cases for the linear connectives. Each elimination form applied to a non-value reduces to an application of a congruence rule; each elimination form applied to the corresponding introduction form triggers a $\beta$-reduction. $\square$

**Corollary 2.10.4 (Type safety for the linear lambda calculus).** Well-typed closed terms do not get stuck: evaluation either produces a value or diverges (though the pure linear lambda calculus is strongly normalizing and does not diverge).

### 2.11 Resource Interpretation

The operational meaning of linearity is resource tracking. We now make this interpretation precise through several examples.

**Example 2.11.1 (File handles).** Model file operations as:

$$\mathsf{open} : \mathsf{String} \multimap \mathsf{Handle}$$

$$\mathsf{read} : \mathsf{Handle} \multimap \mathsf{String} \otimes \mathsf{Handle}$$

$$\mathsf{close} : \mathsf{Handle} \multimap \mathbf{1}$$

Since $\mathsf{Handle}$ is a linear type:
- $\mathsf{open}$ produces a handle that *must* eventually be consumed.
- $\mathsf{read}$ consumes the handle and returns a new one (along with the data). The old handle is invalidated; only the new one is live.
- $\mathsf{close}$ consumes the handle permanently, returning the unit $\mathbf{1}$ (no further use).

A well-typed program that opens a file *must* eventually close it, and *cannot* read from a closed handle. These invariants are enforced *at compile time* by the type system.

**Example 2.11.2 (Memory management).** Model heap allocation as:

$$\mathsf{alloc} : A \multimap \mathsf{Ptr}(A)$$

$$\mathsf{deref} : \mathsf{Ptr}(A) \multimap A \otimes \mathsf{Ptr}(A)$$

$$\mathsf{free} : \mathsf{Ptr}(A) \multimap \mathbf{1}$$

Again, linearity of $\mathsf{Ptr}(A)$ prevents:
- **Use-after-free:** once $\mathsf{free}$ consumes the pointer, no further operations are possible.
- **Double free:** the pointer is consumed by the first $\mathsf{free}$; it cannot be used again.
- **Memory leak:** a linear value must be consumed; the type checker rejects programs that abandon pointers.

**Example 2.11.3 (Channel communication).** A channel endpoint of type $\mathsf{Chan}(A)$ is linear: it represents one end of a communication channel that must be used according to a protocol. We will develop this into a full theory of *session types* in Lecture 09c.

### 2.12 The Curry--Howard Correspondence for Linear Logic

The Curry--Howard correspondence extends beautifully from intuitionistic logic to linear logic. The extended correspondence is summarized in the following table.

| Linear Logic | Linear Lambda Calculus |
|---|---|
| Proposition $A$ | Type $A$ |
| Proof of $A$ | Term $M : A$ |
| Hypothesis $A$ in context | Variable $x : A$ (used exactly once) |
| $A \multimap B$ | Linear function type |
| $A \otimes B$ | Tensor pair (both components, separate resources) |
| $A \mathbin{\&} B$ | Lazy pair / with (either component, shared resources) |
| $A \oplus B$ | Tagged union / sum |
| $\mathbf{1}$ | Unit type (multiplicative) |
| $!A$ | Unrestricted / reusable type |
| Cut elimination | $\beta$-reduction |
| Cut-free proof | Normal form / value |

**Theorem 2.12.1 (Curry--Howard for ILL).** There is a bijection between:
- Derivations of $A_1, \ldots, A_n \vdash B$ in intuitionistic linear logic, and
- Terms $x_1 : A_1, \ldots, x_n : A_n \vdash M : B$ in the linear lambda calculus (modulo $\beta\eta$-equivalence).

Moreover, cut elimination in ILL corresponds to $\beta$-reduction in the linear lambda calculus.

*Proof sketch.* The correspondence is established by the typing rules of Definition 2.6.4, which are in exact correspondence with the sequent calculus rules of ILL. Each logical rule becomes a typing rule; each cut becomes a substitution (which corresponds to $\beta$-reduction). The bijection is shown by mutual induction: given a derivation, extract a term; given a typing derivation, extract a proof. $\square$

### 2.13 Classical Linear Logic and the $!$-$?$ Duality

In the full classical linear logic (CLL), every connective has a *dual* obtained by De Morgan laws. The classical system is formulated using one-sided sequents $\vdash \Gamma$ (with negation internalizing the left/right distinction).

**Definition 2.13.1 (Linear negation).** The linear negation $A^{\perp}$ satisfies $(A^{\perp})^{\perp} = A$ (involutive negation). It maps each connective to its dual:

$$
\begin{aligned}
(\alpha)^{\perp} &= \alpha^{\perp} \\
(A \otimes B)^{\perp} &= A^{\perp} \mathbin{⅋} B^{\perp} \\
(A \mathbin{⅋} B)^{\perp} &= A^{\perp} \otimes B^{\perp} \\
\mathbf{1}^{\perp} &= \bot \\
\bot^{\perp} &= \mathbf{1} \\
(A \mathbin{\&} B)^{\perp} &= A^{\perp} \oplus B^{\perp} \\
(A \oplus B)^{\perp} &= A^{\perp} \mathbin{\&} B^{\perp} \\
\top^{\perp} &= \mathbf{0} \\
\mathbf{0}^{\perp} &= \top \\
(!A)^{\perp} &= \;?(A^{\perp}) \\
(?A)^{\perp} &= \;!(A^{\perp})
\end{aligned}
$$

**Definition 2.13.2 (Par, $\mathbin{⅋}$).** The multiplicative disjunction $A \mathbin{⅋} B$ is the dual of tensor. In the one-sided sequent calculus:

$$\frac{\vdash \Gamma, A, B}{\vdash \Gamma, A \mathbin{⅋} B} \; (\mathbin{⅋})$$

compared to tensor:

$$\frac{\vdash \Gamma, A \quad \vdash \Delta, B}{\vdash \Gamma, \Delta, A \otimes B} \; (\otimes)$$

The difference is the familiar multiplicative/additive distinction: tensor splits the context, par shares it.

**Definition 2.13.3 (Why not, $?A$).** The $?$ modality is the dual of $!$. Its rules are:

**Dereliction:**

$$\frac{\vdash \Gamma, A}{\vdash \Gamma, \;?A} \; (?\text{-Der})$$

**Weakening:**

$$\frac{\vdash \Gamma}{\vdash \Gamma, \;?A} \; (?\text{-W})$$

**Contraction:**

$$\frac{\vdash \Gamma, \;?A, \;?A}{\vdash \Gamma, \;?A} \; (?\text{-C})$$

**Copromotion:**

$$\frac{\vdash \;?\Gamma, A}{\vdash \;?\Gamma, \;?A} \; (?\text{-Coprom})$$

**Proposition 2.13.4.** In CLL, the linear implication $A \multimap B$ is definable as $A^{\perp} \mathbin{⅋} B$.

*Proof.* We verify: $(A \multimap B)^{\perp} = A \otimes B^{\perp}$. We have $(A^{\perp} \mathbin{⅋} B)^{\perp} = A^{\perp\perp} \otimes B^{\perp} = A \otimes B^{\perp}$. In a one-sided sequent, $\vdash \Gamma, A^{\perp} \mathbin{⅋} B$ is the same as $\vdash \Gamma, A^{\perp}, B$, which (reading $A^{\perp}$ on the left as $A$) is the same as $A, \Gamma \vdash B$, i.e., $\Gamma \vdash A \multimap B$. $\square$

**Remark 2.13.5 ($!$-$?$ symmetry).** The $!$ modality marks formulas that can be freely used (weakened and contracted) on the *left* of a sequent (as hypotheses), while $?$ marks formulas that can be freely used on the *right* (as conclusions). In computational terms:

- $!A$: "I have an unlimited supply of $A$s that I can provide" --- models *input* resources that can be duplicated.
- $?A$: "I can accept an unlimited demand for $A$s" --- models *output* capabilities that can be shared.

This duality is fundamental to the categorical semantics of linear logic (in terms of $*$-autonomous categories) and to the interpretation of classical linear logic as a theory of concurrent processes.

### 2.14 Categorical Semantics (Brief Overview)

**Definition 2.14.1 (Symmetric monoidal closed category).** A *symmetric monoidal closed category* (SMCC) $(\mathcal{C}, \otimes, I, \multimap)$ consists of:
- A category $\mathcal{C}$,
- A bifunctor $\otimes : \mathcal{C} \times \mathcal{C} \to \mathcal{C}$ (tensor product) with unit object $I$,
- Natural isomorphisms expressing associativity, unit laws, and symmetry of $\otimes$,
- An internal hom functor $\multimap$ right adjoint to $\otimes$: $\mathcal{C}(A \otimes B, C) \cong \mathcal{C}(A, B \multimap C)$.

**Proposition 2.14.2.** The models of multiplicative intuitionistic linear logic are symmetric monoidal closed categories. The tensor product $\otimes$ interprets the multiplicative conjunction, $I$ interprets $\mathbf{1}$, and the internal hom $\multimap$ interprets linear implication.

**Definition 2.14.3 (Linear-non-linear adjunction).** A model of full ILL consists of:
- A symmetric monoidal closed category $\mathcal{L}$ (the "linear" world),
- A cartesian closed category $\mathcal{C}$ (the "non-linear" / "intuitionistic" world),
- A monoidal adjunction $F \dashv G : \mathcal{C} \to \mathcal{L}$ where the comonad $! = F \circ G$ models the exponential.

This is Benton's *linear-non-linear* (LNL) model (1995), which gives a clean separation between linear and unrestricted resources.

### 2.15 Strong Normalization

**Theorem 2.15.1.** The linear lambda calculus (without fixpoint combinators) is strongly normalizing: every reduction sequence terminates.

*Proof sketch.* The proof uses a *reducibility candidates* argument (analogous to Girard's proof for System F, Module 06). We assign to each type $A$ a set $\mathsf{RED}_A$ of "reducible" terms and show:

1. Every reducible term is strongly normalizing.
2. Every well-typed term is reducible.

For the linear types, the key property is that the context-splitting discipline ensures that reduction of a subterm does not affect the resources available to another subterm (since they are disjoint). The exponential case uses the fact that promoted terms depend only on unrestricted resources, so duplication during $(\beta_{!3})$ preserves strong normalization.

A detailed proof can be found in Benton, Bierman, de Paiva, and Hyland (1993). $\square$

### 2.16 Decidability of Type Checking

**Theorem 2.16.1.** Type checking for the linear lambda calculus is decidable.

*Proof sketch.* The typing rules are syntax-directed: for each term form, there is exactly one applicable rule. The only non-trivial aspect is context splitting at application and tensor introduction nodes, which can be handled algorithmically as described in Section 2.7. The algorithm runs in polynomial time in the size of the term and context.

Specifically, using the output-directed approach (Algorithm 2.7.3), each typing judgment $\Gamma \vdash M : A$ can be checked in $O(|M| \cdot |\Gamma|)$ time, where $|M|$ is the size of the term and $|\Gamma|$ is the size of the context. $\square$

**Theorem 2.16.2.** Type *inference* for the linear lambda calculus (without type annotations on lambda-bound variables) is decidable.

*Proof sketch.* We generate linear constraints (analogous to unification constraints in Hindley--Milner, Module 05) together with *usage constraints* that track how each variable is used. The usage constraints form a system of linear equations over a two-point lattice $\{0, 1\}$ (each variable is used exactly once), which can be solved in polynomial time. $\square$

### 2.17 Linear Logic and Quantum Computing

A remarkable application of linear logic arises in quantum computing, where the *no-cloning theorem* states that an arbitrary quantum state cannot be duplicated. This is precisely the prohibition of contraction in linear logic.

**Proposition 2.17.1 (No-cloning as linearity).** In a quantum type system, quantum bits (qubits) are linear types: they cannot be duplicated (no contraction) and cannot be silently discarded (no weakening, since discarding a qubit collapses its entanglement). Classical bits, which *can* be cloned and discarded, correspond to $!$-types.

$$
\begin{aligned}
\mathsf{Qubit} &: \text{linear type (no cloning, no discarding)} \\
\mathsf{Bit} &\cong \;!\mathsf{Bool} : \text{unrestricted type (cloning and discarding allowed)}
\end{aligned}
$$

**Example 2.17.2.** The CNOT gate has the linear type:

$$\mathsf{CNOT} : \mathsf{Qubit} \otimes \mathsf{Qubit} \multimap \mathsf{Qubit} \otimes \mathsf{Qubit}$$

It consumes two qubits and produces two (entangled) qubits. The Hadamard gate:

$$H : \mathsf{Qubit} \multimap \mathsf{Qubit}$$

Measurement produces a classical bit:

$$\mathsf{measure} : \mathsf{Qubit} \multimap \;!\mathsf{Bool}$$

The linearity of qubits ensures that quantum states are never duplicated or silently discarded, and measurement is the mechanism that converts a linear qubit into an unrestricted classical bit.

**Remark 2.17.3.** This connection has been formalized by Selinger (2004) and Selinger and Valiron (2006) in their quantum lambda calculus, which is essentially a linear lambda calculus extended with quantum operations. The Quipper language (Green et al., 2013) implements this approach for practical quantum programming.

### 2.18 Exponential Isomorphisms

The exponential modality $!$ satisfies several important structural isomorphisms that characterize its behavior.

**Proposition 2.18.1 (Exponential isomorphisms).** The following are provable in ILL:

(i) $!(A \mathbin{\&} B) \dashv\vdash \;!A \otimes \;!B$ \quad (the "Seely isomorphism")

(ii) $!\top \dashv\vdash \mathbf{1}$ \quad ($!$ of the additive truth is the multiplicative unit)

(iii) $!!A \dashv\vdash \;!A$ \quad (idempotence of $!$)

(iv) $!A \dashv\vdash \;!A \otimes \;!A$ \quad (contraction as an isomorphism for $!$-types)

*Proof of (i), forward direction: $!(A \mathbin{\&} B) \multimap \;!A \otimes \;!B$.*

Given $z : \;!(A \mathbin{\&} B)$:

1. By contraction $(!\text{-C})$: $\mathsf{copy}\; z \;\mathsf{as}\; z_1, z_2 \;\mathsf{in}\; \ldots$, getting $z_1, z_2 : \;!(A \mathbin{\&} B)$.
2. By dereliction on $z_1$: $\mathsf{derelict}\; z_1 : A \mathbin{\&} B$.
3. By $\pi_1$: $\pi_1(\mathsf{derelict}\; z_1) : A$.
4. By promotion (since all free variables $z_2$ are of $!$-type): $\mathsf{promote}(\pi_1(\mathsf{derelict}\; z_1)) : \;!A$.

Wait---this does not work directly because $z_2$ is free and the promotion rule requires *all* free variables to be unrestricted, which $z_2$ satisfies (it has type $!(A \mathbin{\&} B)$). But the issue is that $z_1$ was consumed by dereliction and $\pi_1$, so at the point of promoting, the only free variable is $z_2$, which we have not yet used for the $!B$ part.

Let us restructure. The correct term is:

$$\lambda z.\, \mathsf{copy}\; z \;\mathsf{as}\; z_1, z_2 \;\mathsf{in}\; (\mathsf{promote}(\pi_1(\mathsf{derelict}\; z_1)), \mathsf{promote}(\pi_2(\mathsf{derelict}\; z_2)))$$

Here, the tensor pair uses $z_1$ for the left component and $z_2$ for the right. Within each $\mathsf{promote}$, the free variables are only unrestricted (the other $z_i$ is consumed by that component's tensor slot, and $\mathsf{promote}$ applies to a closed term or one with only $!$-typed free variables).

Actually, $\pi_1(\mathsf{derelict}\; z_1)$ has free variable $z_1 : !(A \mathbin{\&} B)$, which is consumed by $\mathsf{derelict}$. So after $\pi_1(\mathsf{derelict}\; z_1)$, the term $A$ is closed with respect to $z_1$. But $\mathsf{promote}$ requires that at the point of promotion, all free variables are $!$-typed. The result $\pi_1(\mathsf{derelict}\; z_1) : A$ has no free variables (since $z_1$ was consumed). So $\mathsf{promote}(\pi_1(\mathsf{derelict}\; z_1)) : !A$ is valid.

*Proof of (i), reverse direction: $!A \otimes \;!B \multimap \;!(A \mathbin{\&} B)$.*

Given $(u, v) : \;!A \otimes \;!B$:

$$\lambda p.\, \mathsf{let}\; (u, v) = p \;\mathsf{in}\; \mathsf{promote}(\langle \mathsf{derelict}\; u, \mathsf{derelict}\; v \rangle)$$

The $\mathsf{promote}$ is valid because $u : \;!A$ and $v : \;!B$ are both of $!$-type. Inside the promotion, $\mathsf{derelict}\; u : A$ and $\mathsf{derelict}\; v : B$, and $\langle \mathsf{derelict}\; u, \mathsf{derelict}\; v \rangle : A \mathbin{\&} B$. The additive pair uses the same context $\{u, v\}$ for both components (which is valid because the $\mathbin{\&}$-I rule shares the context, and dereliction of $!$-typed variables can be done in both branches). $\square$

### 2.19 Phase Semantics

Girard's original paper introduced *phase semantics* as a denotational semantics for linear logic. We give a brief account.

**Definition 2.19.1 (Phase space).** A *phase space* is a triple $(M, \cdot, \bot)$ where:
- $(M, \cdot)$ is a commutative monoid with identity $1$,
- $\bot \subseteq M$ is a distinguished subset called the *pole*.

For a subset $A \subseteq M$, define:

$$A^{\perp} = \{ m \in M \mid \forall a \in A.\; m \cdot a \in \bot \}$$

A subset $A$ is a *fact* if $A = A^{\perp\perp}$.

**Proposition 2.19.2.** The operation $(-)^{\perp\perp}$ is a closure operator: $A \subseteq A^{\perp\perp}$, and $A^{\perp\perp\perp\perp} = A^{\perp\perp}$. Facts form a complete lattice under inclusion.

**Definition 2.19.3 (Interpretation of connectives).** Given facts $A$ and $B$:

$$A \otimes B = (A \cdot B)^{\perp\perp} \quad \text{where} \quad A \cdot B = \{ a \cdot b \mid a \in A, b \in B \}$$

$$A \mathbin{⅋} B = (A^{\perp} \cdot B^{\perp})^{\perp}$$

$$A \mathbin{\&} B = A \cap B$$

$$A \oplus B = (A \cup B)^{\perp\perp}$$

$$!A = \text{the largest fact contained in } A \text{ that is a submonoid of } M$$

$$\mathbf{1} = \{1\}^{\perp\perp}$$

**Theorem 2.19.4 (Soundness of phase semantics).** If $A$ is provable in linear logic, then $A$ is true in all phase spaces.

*Proof sketch.* Each inference rule of linear logic preserves truth in phase spaces. The key verification is that the context-splitting rules for $\otimes$ and $\multimap$ correspond to the monoidal structure of $M$. $\square$

**Theorem 2.19.5 (Completeness of phase semantics).** If $A$ is true in all phase spaces, then $A$ is provable in linear logic.

*Proof sketch.* Construct the *syntactic phase space*: let $M$ be the free commutative monoid generated by formulas, $\bot$ be the set of provable sequents, and show that unprovable formulas are falsified. $\square$

### 2.20 Proof Nets (Brief Introduction)

Proof nets (Girard, 1987) provide an alternative representation of proofs in linear logic that quotients out the "bureaucracy" of the sequent calculus---the order in which rules are applied, when this order is irrelevant.

**Definition 2.20.1 (Proof structure).** A *proof structure* for multiplicative linear logic (MLL) is a graph whose nodes are labeled with formulas and whose edges represent the logical connections. Specifically:

- **Axiom links** connect two occurrences of dual formulas $A$ and $A^{\perp}$.
- **Tensor links** connect two formulas $A$ and $B$ to their tensor $A \otimes B$.
- **Par links** connect two formulas $A$ and $B$ to their par $A \mathbin{⅋} B$.
- **Cut links** connect two occurrences of dual formulas $A$ and $A^{\perp}$ in a cut.

**Definition 2.20.2 (Correctness criterion).** Not every proof structure corresponds to a valid proof. Girard's *correctness criterion* (also called the *Danos--Regnier criterion*) provides a graph-theoretic condition: a proof structure is a *proof net* (i.e., corresponds to a valid proof) if and only if every *switching* yields an acyclic connected graph.

A *switching* of a proof structure is obtained by choosing, for each par link, one of its two premises to disconnect. The criterion requires that for *all* such choices, the resulting graph is a tree.

**Proposition 2.20.3.** Two sequent calculus proofs that differ only in the order of independent rule applications (i.e., they are related by rule permutations) correspond to the *same* proof net. This makes proof nets the canonical representatives of equivalence classes of proofs.

**Remark 2.20.4.** The computational significance of proof nets is that they provide a more efficient representation of programs in the linear lambda calculus: $\beta$-reduction corresponds to *cut elimination* in proof nets, which can be performed in a highly parallel fashion. This has been exploited in implementations of optimal reduction (Lamping, 1990; Gonthier, Abadi, and Levy, 1992).

### 2.21 Linear Types in Programming Languages

We conclude with a survey of how linear types have been adopted in real programming languages and systems.

**System 2.20.1 (Linear Haskell).** GHC Haskell (version 9.0+) supports linear types via the `LinearTypes` extension. A linear function is written $A \to_1 B$ (or `A %1 -> B` in Haskell syntax), meaning the function uses its argument exactly once. The standard arrow $A \to B$ is recovered as $A \to_{\omega} B$ (or `A %Many -> B`), meaning the function may use its argument any number of times.

The key design principle, following Bernardy et al. (2018), is *linearity on the arrow*: the linearity annotation is on the function type, not on the data type. A value of type $\mathsf{Int}$ is neither linear nor unrestricted intrinsically; it becomes linear or unrestricted based on how it is bound.

$$\mathsf{dup} : \mathsf{Int} \to_{\omega} (\mathsf{Int}, \mathsf{Int}) \quad \text{(unrestricted: may use argument multiple times)}$$

$$\mathsf{swap} : (A, B) \to_1 (B, A) \quad \text{(linear: argument used exactly once)}$$

**System 2.20.2 (Rust).** As we will see in detail in Lecture 09b, Rust's ownership system is an affine type system (use at most once, with implicit drop). Rust does not enforce *exactly once* usage, so it is affine rather than strictly linear.

**System 2.20.3 (ATS).** ATS (Applied Type System) by Xi (2004) is a programming language that combines dependent types with linear types. Linear types in ATS are used for safe manual memory management: the programmer explicitly allocates and frees memory, and the type system ensures that every allocation is freed exactly once.

**System 2.20.4 (Idris 2).** Idris 2 uses *quantitative type theory* (QTT), introduced by Atkey (2018) and McBride (2016). Each variable binding is annotated with a *quantity* $q \in \{0, 1, \omega\}$:

- $0$: the variable is erased at runtime (used only at the type level).
- $1$: the variable is used exactly once (linear).
- $\omega$: the variable is used any number of times (unrestricted).

This unifies linearity with erasure, a particularly elegant combination for dependently typed programming.

**System 2.20.5 (Clean).** Clean uses *uniqueness types* (dual to linear types; see Lecture 09b) for safe destructive update and I/O.

**System 2.20.6 (Granule).** Granule (Orchard, Liepelt, and Eades, 2019) is a research language that supports *graded linear types*: each variable is annotated with a *grade* from a semiring, generalizing the $\{0, 1, \omega\}$ of QTT to arbitrary resource algebras. This allows tracking not just "how many times" but "how much of what kind" a resource is used.

### 2.22 Exercises

**Exercise 2.22.1.** Derive the following in the linear lambda calculus (give the typing derivation and the term):

(a) $A \otimes B \multimap B \otimes A$ (commutativity of tensor).

(b) $A \otimes (B \otimes C) \multimap (A \otimes B) \otimes C$ (associativity of tensor).

(c) $A \otimes \mathbf{1} \multimap A$ and $A \multimap A \otimes \mathbf{1}$ (unit laws for tensor).

**Exercise 2.22.2.** Show that $A \mathbin{\&} B \multimap A \otimes B$ is *not* provable in ILL (without $!$). Explain intuitively why.

**Exercise 2.22.3.** Prove that $!(A \mathbin{\&} B) \multimap \;!A \otimes \;!B$. Construct the explicit term.

**Exercise 2.22.4.** Show that the following are equivalent in ILL:
- $!A \multimap B$
- $!A \multimap \;!B$ (when $B$ does not mention any linear variable)

**Exercise 2.22.5.** Implement the file-handle API of Example 2.11.1 in a language with linear types (e.g., Linear Haskell or a pseudocode linear lambda calculus). Write a program that opens a file, reads it, and closes it. Verify that your program is well-typed and that the type system prevents double-close and use-after-close.

---

## Summary

- **Structural rules** --- weakening, contraction, and exchange --- are implicit in ordinary logic and type systems. Making them explicit reveals the possibility of *substructural logics* and type systems.

- **Linear logic** (Girard, 1987) removes weakening and contraction, yielding a logic where every hypothesis must be used exactly once. This splits the familiar conjunction and disjunction into multiplicative ($\otimes$, $\mathbin{⅋}$) and additive ($\mathbin{\&}$, $\oplus$) variants.

- **The linear lambda calculus** is the computational interpretation of intuitionistic linear logic via the Curry--Howard correspondence. Its key feature is *context splitting*: at each application $M\; N$, the available resources are partitioned between $M$ and $N$.

- **The exponential $!A$** recovers unrestricted use within the linear framework. A hypothesis of type $!A$ can be weakened (discarded), contracted (duplicated), and derelicted (used once). The promotion rule ensures that only computations independent of linear resources can be made unrestricted.

- **Resource management** is the practical payoff: linear types allow compile-time enforcement of exactly-once usage invariants for file handles, memory, channels, and other resources.

- **Type safety** (preservation and progress) holds for the linear lambda calculus. The key lemma is the *linear substitution lemma*, which respects context splitting.

- **Classical linear logic** introduces duality through linear negation, yielding the De Morgan relationships between $\otimes$/$\mathbin{⅋}$, $\mathbin{\&}$/$\oplus$, $!$/$?$, and $\mathbf{1}$/$\bot$.

- **Categorical semantics** identifies models of multiplicative ILL with symmetric monoidal closed categories, and models of full ILL with linear-non-linear adjunctions (Benton, 1995).

## Further Reading

1. Girard, J.-Y. (1987). "Linear logic." *Theoretical Computer Science*, 50(1), 1--102. The foundational paper introducing linear logic, its proof theory, and its semantics.

2. Wadler, P. (1990). "Linear types can change the world!" In *Programming Concepts and Methods*, pp. 561--581. North-Holland. A highly influential paper connecting linear types to practical programming concerns.

3. Wadler, P. (1993). "A taste of linear logic." In *Mathematical Foundations of Computer Science*, LNCS 711, pp. 185--210. Springer. An accessible introduction to the Curry--Howard correspondence for linear logic.

4. Benton, P. N., Bierman, G. M., de Paiva, V., and Hyland, M. (1993). "A term calculus for intuitionistic linear logic." In *Typed Lambda Calculi and Applications*, LNCS 664, pp. 75--90. Springer. The definitive term calculus for ILL.

5. Benton, P. N. (1995). "A mixed linear and non-linear logic: proofs, terms and models." In *Computer Science Logic*, LNCS 933, pp. 121--135. Springer. The linear-non-linear adjunction model.

6. Barber, A. (1996). "Dual intuitionistic linear logic." Technical Report ECS-LFCS-96-347, University of Edinburgh. An alternative term calculus that separates linear and intuitionistic variables.

7. Girard, J.-Y., Lafont, Y., and Taylor, P. (1989). *Proofs and Types*. Cambridge University Press. Chapter 14 covers linear logic.

8. Troelstra, A. S. (1992). *Lectures on Linear Logic*. CSLI Lecture Notes 29, Stanford. A comprehensive introduction to linear logic from a proof-theoretic perspective.

9. Lincoln, P. (1992). "Linear logic." *ACM SIGACT News*, 23(2), 29--37. A concise survey.

10. Di Cosmo, R. and Miller, D. (2019). "Linear logic." *Stanford Encyclopedia of Philosophy*. An up-to-date survey of the field.
