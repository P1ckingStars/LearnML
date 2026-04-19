---
title: "Lecture 06d: Parametricity and Free Theorems"
tags:
  - type-theory
  - system-f
  - lecture
---
# Lecture 06d: Parametricity and Free Theorems

> **Module 06 --- Polymorphism & System F (Weeks 11--12)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **State** Reynolds' abstraction theorem (parametricity) informally and formally.
2. **Construct** the relational interpretation of System F types.
3. **Derive** free theorems from polymorphic types using Wadler's recipe.
4. **Prove** that the only inhabitant of $\forall X.\, X \to X$ is the identity function.
5. **Prove** that any $f : \forall X.\, [X] \to [X]$ commutes with map.
6. **Prove** that any $f : \forall X\, Y.\, (X \to Y) \to [X] \to [Y]$ must behave as map.
7. **Explain** when parametricity fails (side effects, general recursion, non-termination).
8. **Describe** the connection between parametricity and dinaturality in category theory.

---

## 1. Motivation

### 1.1 Types as Specifications

One of the deepest insights of type theory is that types are not merely labels for data --- they are **specifications** that constrain program behavior. The more precise the type, the tighter the constraint.

In System F, polymorphic types are remarkably constraining. Consider a function $f : \forall X.\, X \to X$. What can $f$ do? It receives a value of an arbitrary, unknown type $X$ and must return a value of the same type. Since $f$ knows nothing about $X$ --- it has no operations on $X$, no way to inspect or construct values of type $X$ except the one it was given --- the only thing $f$ can do is return its argument. Therefore, $f$ must be the identity function.

This reasoning is informal but can be made completely precise. The formal framework is **parametricity**, introduced by Reynolds (1983) and popularized by Wadler (1989) under the slogan "Theorems for Free!"

### 1.2 The Key Insight

Parametric polymorphism means that a polymorphic function behaves **uniformly** across all type instantiations. Reynolds formalized this uniformity using **relational parametricity**: a polymorphic function maps related inputs to related outputs, for any notion of "relatedness" between types.

The power of this idea is that it lets us derive **non-trivial theorems about programs purely from their types**, without examining their implementations. These are Wadler's "free theorems."

---

## 2. Core Theory

### 2.1 Relational Interpretation of Types

The central construction is a **relational interpretation** that assigns to each type a relation between terms. We build this interpretation inductively on the structure of types.

**Setup.** Fix two "worlds" (which can be thought of as two different type instantiations). A **type relation** between types $A_1$ (in world 1) and $A_2$ (in world 2) is a relation $R \subseteq A_1 \times A_2$ --- a set of pairs of values.

**Definition 2.1 (Relational interpretation).** Let $\rho$ be a **relational environment** mapping each type variable $X$ to a triple $(A_1, A_2, R)$ where $A_1, A_2$ are types and $R \subseteq \lbrack\!\lbrack A_1 \rbrack\!\rbrack \times \lbrack\!\lbrack A_2 \rbrack\!\rbrack$ is a relation between their denotations. The relational interpretation $\lbrack\!\lbrack T \rbrack\!\rbrack_\rho$ is defined by:

**Type variables:**

$$\lbrack\!\lbrack X \rbrack\!\rbrack_\rho = \rho(X).\text{R}$$

That is, $v_1 \sim_{\lbrack\!\lbrack X \rbrack\!\rbrack_\rho} v_2$ iff $(v_1, v_2) \in \rho(X).\text{R}$.

**Arrow types:**

$$\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho = \{(f_1, f_2) \mid \forall (v_1, v_2) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho,\; (f_1\; v_1, f_2\; v_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho\}$$

Two functions are related at $T_1 \to T_2$ iff they map related inputs to related outputs.

**Universal types:**

$$\lbrack\!\lbrack \forall X.\, T \rbrack\!\rbrack_\rho = \{(f_1, f_2) \mid \forall A_1, A_2, R,\; (f_1\;[A_1], f_2\;[A_2]) \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (A_1, A_2, R)]}\}$$

Two polymorphic values are related at $\forall X.\, T$ iff for **every** choice of types $A_1, A_2$ and relation $R$ between them, the instantiated values are related at $T$ (with $X$ interpreted as $R$).

**Existential types:**

$$\lbrack\!\lbrack \exists X.\, T \rbrack\!\rbrack_\rho = \{(v_1, v_2) \mid \exists A_1, A_2, R,\; (v_1', v_2') \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (A_1, A_2, R)]}\}$$

where $v_i = \{*A_i, v_i'\}$.

### 2.2 Reynolds' Abstraction Theorem

**Theorem 2.2 (Abstraction theorem / Parametricity, Reynolds 1983).** If $\Gamma \vdash t : T$ in System F, then for every relational environment $\rho$ consistent with $\Gamma$ and every pair of substitutions $(\sigma_1, \sigma_2)$ that are related at $\Gamma$ under $\rho$:

$$([\sigma_1](t), [\sigma_2](t)) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$$

In words: every well-typed term, interpreted in two "worlds" related by $\rho$, produces related results.

**For closed terms.** If $\vdash t : T$ (no free variables), then $(t, t) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\emptyset$. That is, every closed term is related to itself at its type, for every choice of relations. This self-relatedness, when unpacked for specific types, yields free theorems.

*Proof sketch.* By induction on the derivation of $\Gamma \vdash t : T$, analogous to the fundamental theorem for reducibility candidates (Theorem 4.7 of Lecture 06b). The key cases:

**Case T-TAbs:** $t = \Lambda X.\, t_1$ with $\Gamma, X \vdash t_1 : T_1$. We need: for all $A_1, A_2, R$, $(\sigma_1(t_1), \sigma_2(t_1)) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto (A_1, A_2, R)]}$. This follows from the IH applied to the extended environment.

**Case T-TApp:** $t = t_1\;[S]$ with $\Gamma \vdash t_1 : \forall X.\, T_1$. By IH, $(\sigma_1(t_1), \sigma_2(t_1)) \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$. By the definition of the relational interpretation at $\forall X.\, T_1$, instantiating with the relational interpretation of $S$, we get $(\sigma_1(t_1)\;[\sigma_1(S)], \sigma_2(t_1)\;[\sigma_2(S)]) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack S \rbrack\!\rbrack_\rho]}$.

The remaining cases (T-Var, T-Abs, T-App) follow the same pattern as for simple logical relations. $\square$

### 2.3 Identity Extension Lemma

**Lemma 2.3 (Identity extension).** If every type variable $X$ in $\rho$ is mapped to the identity relation ($R_X = \{(v, v) \mid v : A_X\}$), then $\lbrack\!\lbrack T \rbrack\!\rbrack_\rho$ is the identity relation on terms of type $T$.

*Proof.* By induction on $T$.

- $T = X$: $\lbrack\!\lbrack X \rbrack\!\rbrack_\rho = R_X = \text{id}_{A_X}$.
- $T = T_1 \to T_2$: $(f_1, f_2) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$ iff for all $(v, v) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$, $(f_1\; v, f_2\; v) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. By IH, $\lbrack\!\lbrack T_i \rbrack\!\rbrack_\rho$ is the identity relation, so this becomes: for all $v$, $f_1\; v = f_2\; v$, i.e., $f_1 = f_2$.
- $T = \forall X.\, T_1$: the universal quantification over all relations includes identity relations, so the result follows from the IH.

$\square$

This lemma is crucial: it ensures that parametricity for closed types (where all type variables are universally quantified) yields equations between values, not merely relations.

---

## 3. Free Theorems

### 3.1 Wadler's Recipe

Wadler (1989) gave a systematic procedure for extracting free theorems from types:

**Recipe.** Given a closed type $T = \forall X_1 \cdots X_n.\, U$:

1. Write down $t \sim_T t$ (the term is related to itself at its type).
2. Expand the definition of $\sim_T$ by unfolding the relational interpretation.
3. Simplify: choose specific relations $R$ to obtain useful consequences.
4. The result is a theorem about every term of type $T$.

### 3.2 Free Theorem 1: The Identity Type

**Theorem 3.1.** Let $f : \forall X.\, X \to X$ be a closed System F term. Then $f = \text{id}$, i.e., for every type $A$ and value $a : A$, $f\;[A]\; a = a$.

*Proof.* By parametricity, $(f, f) \in \lbrack\!\lbrack \forall X.\, X \to X \rbrack\!\rbrack$. Expanding:

For all types $A_1, A_2$ and relation $R \subseteq A_1 \times A_2$:

$$(f\;[A_1], f\;[A_2]) \in \lbrack\!\lbrack X \to X \rbrack\!\rbrack_{[X \mapsto (A_1, A_2, R)]}$$

Expanding $\lbrack\!\lbrack X \to X \rbrack\!\rbrack$:

For all $(a_1, a_2) \in R$: $(f\;[A_1]\; a_1, f\;[A_2]\; a_2) \in R$.

Now choose: $A_1 = A_2 = A$, and let $R = \{(a, a)\}$ (the singleton relation containing only the pair $(a, a)$) for some fixed $a : A$.

Then $(a, a) \in R$, so $(f\;[A]\; a, f\;[A]\; a) \in R$. Since $R = \{(a, a)\}$, we conclude $f\;[A]\; a = a$.

Since $A$ and $a$ were arbitrary, $f = \Lambda X.\, \lambda x : X.\, x = \text{id}$. $\square$

**Remark.** This is a remarkably strong result: the type $\forall X.\, X \to X$ has exactly one inhabitant (up to observational equivalence). The type uniquely determines the behavior.

### 3.3 Free Theorem 2: Polymorphic List Functions

For this and subsequent examples, we use the polymorphic list type $[A]$ with the understanding that $\text{map}_g : [A] \to [B]$ applies $g : A \to B$ to each element.

**Theorem 3.2.** Let $f : \forall X.\, [X] \to [X]$ be a closed term. Then for every $g : A \to B$:

$$\text{map}\; g \circ f\;[A] = f\;[B] \circ \text{map}\; g$$

That is, $f$ "commutes with map."

*Proof.* By parametricity, for all $A, B$ and $R \subseteq A \times B$:

$$(f\;[A], f\;[B]) \in \lbrack\!\lbrack [X] \to [X] \rbrack\!\rbrack_{[X \mapsto R]}$$

The relational interpretation of $[X]$ under $R$ is the "lifting" of $R$ to lists: two lists $\ell_1 : [A]$ and $\ell_2 : [B]$ are related iff they have the same length and corresponding elements are $R$-related.

The relational interpretation of $[X] \to [X]$ under $R$ says: if $\ell_1$ and $\ell_2$ are $R$-related lists, then $f\;[A]\;\ell_1$ and $f\;[B]\;\ell_2$ are $R$-related lists.

Now choose the **graph relation** of $g$: $R_g = \{(a, g(a)) \mid a \in A\}$.

Two lists are $R_g$-related iff the second is obtained from the first by applying $g$ elementwise --- i.e., iff $\ell_2 = \text{map}\; g\; \ell_1$.

The parametricity condition becomes: if $\ell_2 = \text{map}\; g\; \ell_1$, then $f\;[B]\;\ell_2 = \text{map}\; g\; (f\;[A]\;\ell_1)$.

Substituting $\ell_2 = \text{map}\; g\; \ell_1$:

$$f\;[B]\; (\text{map}\; g\; \ell_1) = \text{map}\; g\; (f\;[A]\;\ell_1)$$

which is $f\;[B] \circ \text{map}\; g = \text{map}\; g \circ f\;[A]$. $\square$

**Corollary 3.3.** Any $f : \forall X.\, [X] \to [X]$ can only rearrange, duplicate, or drop elements of a list. It cannot create new elements or modify existing ones (since it does not know what type they have).

**Examples.** Functions of type $\forall X.\, [X] \to [X]$ include:

- $\text{reverse}$
- $\text{tail}$ (dropping the first element)
- $\text{sort}$... wait, $\text{sort}$ requires a comparison function, so it does **not** have this type.
- Permutations, repetitions, subsequences.

The free theorem says that all such functions commute with map. This is a powerful optimization principle: $\text{map}\; g\; (\text{reverse}\; \ell) = \text{reverse}\; (\text{map}\; g\; \ell)$.

### 3.4 Free Theorem 3: The Map Type

**Theorem 3.4.** Let $h : \forall X\, Y.\, (X \to Y) \to [X] \to [Y]$ be a closed term. Then for all $g : A \to B$ and $k : B \to C$:

$$h\;[A]\;[C]\; (k \circ g) = h\;[B]\;[C]\; k \circ h\;[A]\;[B]\; g$$

This is a "functoriality" law: $h$ preserves composition.

*Proof.* By parametricity, for all $A_1, A_2, R_X \subseteq A_1 \times A_2$ and $B_1, B_2, R_Y \subseteq B_1 \times B_2$:

$$(h\;[A_1]\;[B_1], h\;[A_2]\;[B_2]) \in \lbrack\!\lbrack (X \to Y) \to [X] \to [Y] \rbrack\!\rbrack_{[X \mapsto R_X, Y \mapsto R_Y]}$$

Expanding: for all $(f_1, f_2) \in \lbrack\!\lbrack X \to Y \rbrack\!\rbrack$, for all $(\ell_1, \ell_2) \in \lbrack\!\lbrack [X] \rbrack\!\rbrack$:

$$(h\;[A_1]\;[B_1]\; f_1\; \ell_1, h\;[A_2]\;[B_2]\; f_2\; \ell_2) \in \lbrack\!\lbrack [Y] \rbrack\!\rbrack$$

Choose: $A_1 = A$, $A_2 = B$, $R_X = \text{graph}(g)$; $B_1 = C$, $B_2 = C$, $R_Y = \text{id}_C$.

Then $(f_1, f_2) \in \lbrack\!\lbrack X \to Y \rbrack\!\rbrack$ means: for all $(a, b) \in R_X$ (i.e., $b = g(a)$), $(f_1(a), f_2(b)) \in R_Y$ (i.e., $f_1(a) = f_2(b)$). So $f_1(a) = f_2(g(a))$ for all $a$, i.e., $f_1 = f_2 \circ g$.

Choose $f_2 = k$, then $f_1 = k \circ g$.

Similarly, $(\ell_1, \ell_2) \in \lbrack\!\lbrack [X] \rbrack\!\rbrack$ means $\ell_2 = \text{map}\; g\; \ell_1$.

The conclusion $(h\;[A]\;[C]\; (k \circ g)\; \ell_1, h\;[B]\;[C]\; k\; (\text{map}\; g\; \ell_1)) \in \lbrack\!\lbrack [Y] \rbrack\!\rbrack$ means (since $R_Y = \text{id}$):

$$h\;[A]\;[C]\; (k \circ g)\; \ell = h\;[B]\;[C]\; k\; (\text{map}\; g\; \ell)$$

By Theorem 3.2, $\text{map}\; g\; \ell = h\;[A]\;[B]\; g\; \ell$ if $h$ is map-like. More directly, combined with the choice $k = \text{id}$, we get $h\;[A]\;[B]\; g = \text{map}\; g$, showing that any $h$ with this type must be $\text{map}$. $\square$

**Corollary 3.5.** If additionally $h$ satisfies $h\;[A]\;[A]\; \text{id}_A = \text{id}_{[A]}$ for all $A$ (identity law), then $h = \text{map}$.

### 3.5 Free Theorem 4: Polymorphic Pairs

**Theorem 3.5.** Let $\text{swap} : \forall X\, Y.\, X \times Y \to Y \times X$. The free theorem states: for all $g : A \to B$ and $h : C \to D$, and all $(a, c) \in A \times C$:

$$\text{swap}\;[B]\;[D]\; (g\;a, h\;c) = (h\;c, g\;a)$$

More precisely: $\text{swap}$ commutes with the "bifunctorial" action of $\times$:

$$(h \times g) \circ \text{swap}\;[A]\;[C] = \text{swap}\;[B]\;[D] \circ (g \times h)$$

where $(f \times g)(a, c) = (f\;a, g\;c)$.

*Proof.* By parametricity, for all $R_X \subseteq A \times B$ and $R_Y \subseteq C \times D$:

$$(\text{swap}\;[A]\;[C], \text{swap}\;[B]\;[D]) \in \lbrack\!\lbrack X \times Y \to Y \times X \rbrack\!\rbrack_{[X \mapsto R_X, Y \mapsto R_Y]}$$

Choose $R_X = \text{graph}(g)$ and $R_Y = \text{graph}(h)$. The input pair $(a, c)$ is related to $(g\;a, h\;c)$ (by the product relation). The output pair must satisfy: the first component is $R_Y$-related and the second is $R_X$-related. So $\text{swap}\;[A]\;[C]\;(a,c)$ has first component $c' \in C$ and second component $a' \in A$ such that $(c', h\;c) \in R_Y$ and $(a', g\;a) \in R_X$. Since $R_Y = \text{graph}(h)$ and $R_X = \text{graph}(g)$, this means $h\;c' = h\;c$ and $g\;a' = g\;a$. If $g$ and $h$ are injective, then $c' = c$ and $a' = a$, so $\text{swap}\;[A]\;[C]\;(a,c) = (c, a)$. For the general case (without injectivity), additional argument is needed, but the commutation equation holds regardless. $\square$

### 3.6 Free Theorem 5: Constant Functions

**Theorem 3.6 (Boolean characterization).** Let $f : \forall X.\, X \to X \to X$ be a closed term. Then $f$ is either $\Lambda X.\, \lambda a.\, \lambda b.\, a$ (first projection) or $\Lambda X.\, \lambda a.\, \lambda b.\, b$ (second projection).

*Proof.* By parametricity, for all $A, B, R \subseteq A \times B$ and $(a_1, b_1), (a_2, b_2) \in R$:

$$(f\;[A]\; a_1\; a_2, f\;[B]\; b_1\; b_2) \in R$$

Choose $A = B = \{0, 1\}$, $R = \text{id}$, $a_1 = b_1 = 0$, $a_2 = b_2 = 1$. Then $f\;[\{0,1\}]\; 0\; 1 \in \{0, 1\}$. It is either $0$ or $1$.

**Case $f\;[\{0,1\}]\; 0\; 1 = 0$:** Choose $A = \{0,1\}$, $B$ arbitrary, $R = \{(0, b_1)\}$ for arbitrary $b_1 : B$. Then $(0, b_1) \in R$ and $(1, b_2) \in R$ requires $b_2$ to be in $R$'s range, but we only put $(0, b_1)$ in $R$, so we need to be more careful. Instead, choose $R = \{(0, b_1), (1, b_2)\}$ for arbitrary $b_1, b_2 : B$.

Then $(f\;[A]\; 0\; 1, f\;[B]\; b_1\; b_2) \in R$. Since $f\;[A]\; 0\; 1 = 0$, we need $f\;[B]\; b_1\; b_2 = b_1$ (matching the $0$-component of $R$). So $f$ selects the first argument.

**Case $f\;[\{0,1\}]\; 0\; 1 = 1$:** Analogously, $f$ selects the second argument.

$\square$

### 3.6 More Free Theorems

**Theorem 3.7.** Let $f : \forall X.\, (X \to X) \to X \to X$ (the Church numeral type). Then for every $g : A \to B$, $s : A \to A$, $s' : B \to B$ with $g \circ s = s' \circ g$, and $z : A, z' : B$ with $g(z) = z'$:

$$g(f\;[A]\; s\; z) = f\;[B]\; s'\; z'$$

This says Church numerals commute with any homomorphism of the algebraic structure $(A, s, z)$.

**Theorem 3.8.** There is no closed term of type $\forall X.\, X$. (The empty type / false proposition has no proof.)

*Proof.* Suppose $f : \forall X.\, X$. By parametricity, for all $A, B, R \subseteq A \times B$:

$$(f\;[A], f\;[B]) \in R$$

Choose $R = \emptyset$ (the empty relation). Then $(f\;[A], f\;[B]) \in \emptyset$, a contradiction. $\square$

---

## 4. The Formal Framework

### 4.1 The General Setup

We now present the framework more carefully.

**Definition 4.1 (Relational interpretation, formal).** A **relational interpretation** for System F assigns:

- To each type variable $X$, a triple $(A_1^X, A_2^X, R^X)$ where $A_1^X, A_2^X$ are closed types and $R^X$ is a relation between closed values of types $A_1^X$ and $A_2^X$.

The relational interpretation of types $\lbrack\!\lbrack T \rbrack\!\rbrack_\rho$ is then a relation between closed values of types $\lbrack\!\lbrack T \rbrack\!\rbrack_1$ (obtained by substituting $A_1^X$ for each $X$) and $\lbrack\!\lbrack T \rbrack\!\rbrack_2$ (obtained by substituting $A_2^X$).

**Definition 4.2 (Related substitutions).** Two term substitutions $\sigma_1, \sigma_2$ are **related at $\Gamma$ under $\rho$**, written $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma \rbrack\!\rbrack_\rho$, if for every $x : T \in \Gamma$:

$$(\sigma_1(x), \sigma_2(x)) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$$

**Theorem 4.3 (Abstraction theorem, formal).** If $\Gamma \vdash t : T$ and $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma \rbrack\!\rbrack_\rho$, then:

$$(\sigma_1(t), \sigma_2(t)) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$$

### 4.2 Parametricity for Existential Types

The relational interpretation extends to existentials:

**Definition 4.4.** $(v_1, v_2) \in \lbrack\!\lbrack \exists X.\, T \rbrack\!\rbrack_\rho$ iff there exist $A_1, A_2, R$ and $v_1' : [X \mapsto A_1]\,T$, $v_2' : [X \mapsto A_2]\,T$ such that $v_i = \{*A_i, v_i'\}$ and $(v_1', v_2') \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (A_1, A_2, R)]}$.

This gives us the formal machinery for **representation independence** of ADTs:

**Theorem 4.5 (Representation independence).** Let $\text{impl}_1 = \{*S_1, v_1\} : \exists X.\, T$ and $\text{impl}_2 = \{*S_2, v_2\} : \exists X.\, T$ be two implementations of an ADT. If there exists a relation $R \subseteq S_1 \times S_2$ such that $(v_1, v_2) \in \lbrack\!\lbrack T \rbrack\!\rbrack_{[X \mapsto (S_1, S_2, R)]}$, then for every client $\Gamma, X, x : T \vdash t_2 : U$ with $X \notin \text{FTV}(U)$:

$$\text{let } \{X, x\} = \text{impl}_1 \text{ in } t_2 = \text{let } \{X, x\} = \text{impl}_2 \text{ in } t_2$$

*Proof.* By parametricity applied to $t_2$, using the related substitutions $\sigma_1 = [x \mapsto v_1]$ and $\sigma_2 = [x \mapsto v_2]$. Since $X \notin \text{FTV}(U)$, the identity extension lemma (Lemma 2.3) gives that $\lbrack\!\lbrack U \rbrack\!\rbrack$ is the identity relation, so the two results are equal. $\square$

This is the formal justification for the data abstraction guaranteed by existential types (Lecture 06c, Section 3.3).

---

## 5. Parametricity and Naturality

### 5.1 Natural Transformations

In category theory, a **natural transformation** $\alpha : F \Rightarrow G$ between functors $F, G : \mathcal{C} \to \mathcal{C}$ is a family of morphisms $\alpha_A : F(A) \to G(A)$ indexed by objects $A$, satisfying the **naturality condition**: for every morphism $f : A \to B$:

$$G(f) \circ \alpha_A = \alpha_B \circ F(f)$$

This is a commutative diagram:

$$F(A) \xrightarrow{\alpha_A} G(A)$$

$$\downarrow{F(f)} \qquad \downarrow{G(f)}$$

$$F(B) \xrightarrow{\alpha_B} G(B)$$

### 5.2 Parametricity as Naturality

The free theorems we derived are naturality conditions. A polymorphic function $f : \forall X.\, F(X) \to G(X)$ (where $F$ and $G$ are "type functors" built from $X$ using $\to$ and type constructors) corresponds to a natural transformation.

**Examples:**

1. $f : \forall X.\, [X] \to [X]$ is a natural endomorphism of the list functor. The free theorem $\text{map}\; g \circ f\;[A] = f\;[B] \circ \text{map}\; g$ is the naturality condition.

2. $\text{head} : \forall X.\, [X] \to X$ is a natural transformation from the list functor to the identity functor. The free theorem is $g(\text{head}\;[A]\;\ell) = \text{head}\;[B]\;(\text{map}\; g\; \ell)$.

3. $\text{length} : \forall X.\, [X] \to \text{Nat}$ is a natural transformation from the list functor to the constant functor $\text{Nat}$. The free theorem is $\text{length}\;[A]\;\ell = \text{length}\;[B]\;(\text{map}\; g\; \ell)$ --- the length is invariant under map.

### 5.3 Examples of Naturality

Let us make the naturality connection concrete with several examples.

**Example 5.1 (head).** $\text{head} : \forall X.\, [X] \to X$ is a natural transformation from the list functor $[-]$ to the identity functor $\text{Id}$. The naturality square is:

$$[A] \xrightarrow{\text{head}\;[A]} A$$

$$\downarrow{\text{map}\;g} \qquad\quad \downarrow{g}$$

$$[B] \xrightarrow{\text{head}\;[B]} B$$

The free theorem is: $g\;(\text{head}\;[A]\;\ell) = \text{head}\;[B]\;(\text{map}\;g\;\ell)$ for all $g : A \to B$.

**Example 5.2 (concat).** $\text{concat} : \forall X.\, [[X]] \to [X]$ (list flattening) is a natural transformation from $[[-]]$ to $[-]$. The free theorem:

$$\text{map}\;g\;(\text{concat}\;[A]\;\ell ss) = \text{concat}\;[B]\;(\text{map}\;(\text{map}\;g)\;\ell ss)$$

**Example 5.3 (return for lists).** The singleton list function $\text{return} : \forall X.\, X \to [X]$ (where $\text{return}\;x = [x]$) is a natural transformation from $\text{Id}$ to $[-]$. The free theorem:

$$\text{map}\;g\;(\text{return}\;[A]\;a) = \text{return}\;[B]\;(g\;a)$$

This is one of the monad laws (naturality of $\eta$, the unit of the list monad).

### 5.4 Dinaturality

For types involving both covariant and contravariant occurrences of a type variable, the appropriate categorical notion is **dinaturality** rather than naturality.

**Definition 5.1.** A **dinatural transformation** $\alpha : F \Rightarrow G$ between bifunctors $F, G : \mathcal{C}^{op} \times \mathcal{C} \to \mathcal{C}$ is a family $\alpha_A : F(A, A) \to G(A, A)$ satisfying the **dinaturality hexagon**: for every $f : A \to B$:

$$G(\text{id}, f) \circ \alpha_A \circ F(f, \text{id}) = G(f, \text{id}) \circ \alpha_B \circ F(\text{id}, f) : F(B, A) \to G(A, B)$$

**Example.** The type $\forall X.\, (X \to \text{Nat}) \to X \to \text{Nat}$ has $X$ occurring both covariantly (as the domain of the output function) and contravariantly (as the codomain of the input function). The free theorem involves dinaturality.

---

## 6. Practical Applications

### 6.1 Compiler Optimizations

Free theorems justify compiler optimizations:

**Map fusion.** From the free theorem for $\forall X\, Y.\, (X \to Y) \to [X] \to [Y]$:

$$\text{map}\; g \circ \text{map}\; f = \text{map}\; (g \circ f)$$

This allows the compiler to fuse two traversals into one, eliminating an intermediate list.

**Fold-map fusion.** From the free theorem for $\text{foldr} : \forall X\, Y.\, (X \to Y \to Y) \to Y \to [X] \to Y$:

$$\text{foldr}\; k\; z\; (\text{map}\; f\; \ell) = \text{foldr}\; (k \circ f)\; z\; \ell$$

**Short-cut deforestation.** The GHC Haskell compiler uses free theorems (specifically, the "fold/build" rule) to eliminate intermediate data structures. The rule:

$$\text{foldr}\; k\; z\; (\text{build}\; g) = g\; k\; z$$

where $\text{build} : (\forall X.\, (A \to X \to X) \to X \to X) \to [A]$, is a consequence of parametricity.

### 6.2 Refactoring Guarantees

Free theorems guarantee that certain refactorings are behavior-preserving:

**Example.** If $f : \forall X.\, [X] \to [X]$, then replacing $\text{map}\; g\; (f\; \ell)$ with $f\; (\text{map}\; g\; \ell)$ preserves behavior. This is guaranteed by the free theorem, regardless of which particular $f$ is chosen.

### 6.3 Specification and Testing

Free theorems serve as **specifications** derivable from types. They can be used for:

- **Property-based testing**: QuickCheck properties derived from types (Bernardy et al., 2012).
- **Documentation**: the free theorem is a precise statement of what the type guarantees.
- **Verification**: free theorems reduce the proof burden when reasoning about polymorphic code.

---

## 7. Limitations of Parametricity

### 7.1 Side Effects

Parametricity as stated above assumes a **pure** language. Side effects break parametricity:

**Example (Mutable state).** In a language with mutable references, we could define:

```
f : forall X. X -> X
f x = (r := x; !r)    -- store x in a ref, read it back
```

This is the identity function --- no violation yet. But with type-unsafe operations:

```
f : forall X. X -> X
f x = (r := x; r := 42; !r)  -- store x, overwrite with 42, read
```

This returns 42 regardless of input, violating $f = \text{id}$. Of course, this would not type-check in a sound type system, but the point is that the presence of mutable state requires a more sophisticated formulation of parametricity.

### 7.2 General Recursion and Non-Termination

In a language with general recursion (e.g., PCF, Haskell), we can define:

$$\text{loop} : \forall X.\, X \to X$$

$$\text{loop} = \Lambda X.\, \lambda x : X.\, \text{loop}\;[X]\; x$$

This term has type $\forall X.\, X \to X$ but is not the identity function --- it diverges. More subtly:

$$\text{seq} : \forall X.\, X \to X$$

$$\text{seq} = \Lambda X.\, \lambda x : X.\, \text{case } (\text{loop}\;[\text{Unit}]\;\text{unit}) \text{ of } \_ \to x$$

This diverges because $\text{loop}$ does not terminate, even though it "wants to" return $x$.

Parametricity still holds in these settings, but in a weaker form. The relation must account for non-termination by including $(\bot, \bot)$ (both sides diverge) as a valid related pair. The resulting theory is **domain-theoretic parametricity** or **lazy parametricity**.

### 7.3 Type Case and Intensional Type Analysis

Languages with runtime type inspection (e.g., `typeOf`, `instanceof`, reflection) break parametricity entirely:

```
f : forall X. X -> X
f x = if typeOf x == Int then x + 1 else x
```

This function behaves differently at different types, violating uniformity. System F has no type case; the type is erased at runtime. Parametricity depends on this erasure.

### 7.4 Exceptions

Exceptions partially break parametricity. A function $f : \forall X.\, X \to X$ could throw an exception:

```
f x = raise "error"
```

This has type $\forall X.\, X \to X$ (exceptions can have any return type) but is not the identity. With exceptions, the free theorem becomes: $f$ is either the identity or raises an exception.

### 7.5 Seq and Selective Strictness

In Haskell, the `seq` primitive breaks parametricity by allowing evaluation to be forced:

```haskell
seq :: a -> b -> b
seq x y = y  -- but x is evaluated to WHNF first
```

The function $\text{seq} : \forall X\, Y.\, X \to Y \to Y$ has the type of the second projection, but its behavior differs: it evaluates its first argument before returning the second. Operationally, `seq undefined 42 = undefined`, while the second projection would return `42`.

This means the free theorem for $\forall X\, Y.\, X \to Y \to Y$ does not hold for `seq`: the result depends on whether the first argument terminates.

**Theorem 7.1 (Weakened free theorem with seq).** In a language with `seq`, the free theorem for $f : \forall X.\, X \to X$ weakens to: $f$ is either the identity or $f\;x = \bot$ for all $x$ (i.e., $f$ always diverges).

### 7.6 Summary of Limitations

| Feature | Parametricity holds? |
|---------|---------------------|
| Pure System F | Yes (Reynolds, 1983) |
| Pure with non-termination | Weakened form (Pitts, 2000) |
| Mutable state (well-typed) | Requires step-indexed relations |
| Exceptions | Weakened (must account for exceptions) |
| Type case / reflection | No |
| Unsafe coercions | No |

---

## 8. Advanced Topics

### 8.1 Parametricity for Product and Sum Types

The relational interpretation extends naturally to product and sum types:

**Products:**

$$\lbrack\!\lbrack T_1 \times T_2 \rbrack\!\rbrack_\rho = \{((v_1, v_2), (w_1, w_2)) \mid (v_1, w_1) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho \text{ and } (v_2, w_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho\}$$

Two pairs are related if their corresponding components are related.

**Sums:**

$$\lbrack\!\lbrack T_1 + T_2 \rbrack\!\rbrack_\rho = \{(\text{inl}\;v_1, \text{inl}\;w_1) \mid (v_1, w_1) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho\}$$

$$\cup\; \{(\text{inr}\;v_2, \text{inr}\;w_2) \mid (v_2, w_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho\}$$

Two sum values are related if they use the same injection and their payloads are related.

**Base types (Nat, Bool):**

$$\lbrack\!\lbrack \text{Nat} \rbrack\!\rbrack_\rho = \{(n, n) \mid n \in \mathbb{N}\} = \text{id}_\mathbb{N}$$

$$\lbrack\!\lbrack \text{Bool} \rbrack\!\rbrack_\rho = \{(b, b) \mid b \in \mathbb{B}\} = \text{id}_\mathbb{B}$$

Base types are always interpreted as identity relations --- they have no type parameters to vary.

### 8.2 Worked Example: Free Theorem for Filter

Let us derive the free theorem for the type of a filter function in full detail.

$$f : \forall X.\, (X \to \text{Bool}) \to [X] \to [X]$$

By parametricity, for all types $A, B$, relation $R \subseteq A \times B$:

$$(f\;[A], f\;[B]) \in \lbrack\!\lbrack (X \to \text{Bool}) \to [X] \to [X] \rbrack\!\rbrack_{[X \mapsto R]}$$

Expanding:

For all $(p_1, p_2) \in \lbrack\!\lbrack X \to \text{Bool} \rbrack\!\rbrack_{[X \mapsto R]}$, for all $(\ell_1, \ell_2) \in \lbrack\!\lbrack [X] \rbrack\!\rbrack_{[X \mapsto R]}$:

$$(f\;[A]\; p_1\; \ell_1, f\;[B]\; p_2\; \ell_2) \in \lbrack\!\lbrack [X] \rbrack\!\rbrack_{[X \mapsto R]}$$

Now, $\lbrack\!\lbrack X \to \text{Bool} \rbrack\!\rbrack_{[X \mapsto R]} = \{(p_1, p_2) \mid \forall (a, b) \in R.\; (p_1\;a, p_2\;b) \in \text{id}_\mathbb{B}\}$. The identity relation on $\text{Bool}$ means $p_1\;a = p_2\;b$ whenever $(a, b) \in R$.

Choose $R = \text{graph}(g)$ for some $g : A \to B$. Then $(a, g(a)) \in R$, and the condition becomes: $p_1\;a = p_2\;(g\;a)$ for all $a$, i.e., $p_1 = p_2 \circ g$.

With this choice, $\ell_2 = \text{map}\; g\; \ell_1$ (lists are $R$-related iff the second is the image of the first under $g$).

Setting $p_2 = p$ (arbitrary predicate on $B$) and $p_1 = p \circ g$, the conclusion is:

$$f\;[B]\; p\; (\text{map}\; g\; \ell) = \text{map}\; g\; (f\;[A]\; (p \circ g)\; \ell)$$

This is the free theorem for filter: **filtering after mapping is the same as mapping after filtering with the composed predicate.**

In Haskell notation: `filter p (map g xs) = map g (filter (p . g) xs)`.

### 8.3 Parametricity and Type Isomorphisms

Parametricity can establish **type isomorphisms** --- that two types have the same inhabitants (up to observational equivalence).

**Theorem 8.1 (Yoneda lemma, type-theoretic version).** For any type constructor $F$ (a functor), there is a bijection:

$$(\forall X.\, (A \to X) \to F\;X) \cong F\;A$$

*Proof sketch.* The forward direction maps $f : \forall X.\, (A \to X) \to F\;X$ to $f\;[A]\;\text{id}_A : F\;A$. The backward direction maps $v : F\;A$ to $\Lambda X.\, \lambda g : A \to X.\, F(g)\;v$. That these are mutual inverses follows from parametricity (the free theorem for $f$ forces $f\;[X]\;g = F(g)\;(f\;[A]\;\text{id})$). $\square$

This is the type-theoretic analogue of the Yoneda lemma in category theory, and it demonstrates the deep connection between parametricity and categorical concepts.

**Theorem 8.2 (Church encoding correctness).** The Church encoding of $\text{Bool}$ is correct:

$$\forall X.\, X \to X \to X \cong \text{Bool}$$

(where the right side is the two-element type). This follows from the free theorem that every inhabitant of the left side is either $\text{tru}$ or $\text{fls}$.

### 8.4 The Graph Relation Technique

Many free theorem derivations use the **graph relation** $\text{graph}(g) = \{(a, g(a)) \mid a \in A\}$ for a function $g : A \to B$. This technique is so common that it deserves explicit treatment.

**Proposition 8.3 (Graph relations and the relational interpretation).** For any function $g : A \to B$:

1. $(\ell_1, \ell_2) \in \lbrack\!\lbrack [X] \rbrack\!\rbrack_{[X \mapsto \text{graph}(g)]}$ iff $\ell_2 = \text{map}\;g\;\ell_1$.
2. $(f_1, f_2) \in \lbrack\!\lbrack X \to Y \rbrack\!\rbrack_{[X \mapsto \text{graph}(g), Y \mapsto \text{graph}(h)]}$ iff $h \circ f_1 = f_2 \circ g$.
3. $(f_1, f_2) \in \lbrack\!\lbrack X \to X \rbrack\!\rbrack_{[X \mapsto \text{graph}(g)]}$ iff $g \circ f_1 = f_2 \circ g$ (i.e., $f_1$ and $f_2$ are "$g$-related").

*Proof.* Each follows by unfolding the definitions.

Part 1: $(\ell_1, \ell_2) \in \lbrack\!\lbrack [X] \rbrack\!\rbrack_R$ iff $\ell_1$ and $\ell_2$ have the same length and $((\ell_1)_i, (\ell_2)_i) \in R$ for all $i$. When $R = \text{graph}(g)$, this means $(\ell_2)_i = g((\ell_1)_i)$, i.e., $\ell_2 = \text{map}\;g\;\ell_1$.

Part 2: $(f_1, f_2) \in \lbrack\!\lbrack X \to Y \rbrack\!\rbrack$ iff for all $(a, b) \in \text{graph}(g)$ (i.e., $b = g(a)$), $(f_1(a), f_2(b)) \in \text{graph}(h)$ (i.e., $f_2(g(a)) = h(f_1(a))$). This is $h \circ f_1 = f_2 \circ g$.

Part 3: Special case of Part 2 with $Y = X$ and $h = g$. $\square$

### 8.5 Reynolds' Original Formulation

Reynolds' 1983 paper formulated parametricity in a set-theoretic framework, which led to a well-known **coherence problem**: there is no set-theoretic model of System F satisfying parametricity. Specifically:

**Theorem 8.4 (Reynolds, 1984).** There is no set-theoretic model of the polymorphic lambda calculus in which types are interpreted as sets and $\forall X.\, T$ is interpreted as the intersection $\bigcap_{A} \lbrack\!\lbrack T \rbrack\!\rbrack_{[X \mapsto A]}$.

The problem is that the set $\forall X.\, T$ would need to be a member of the universe it quantifies over, leading to cardinality paradoxes.

This was resolved by subsequent work using domain theory (Bainbridge et al., 1990), PER models (partial equivalence relations), and realizability models. The syntactic/operational approach to parametricity (using logical relations on terms rather than sets) avoids these issues entirely.

### 8.6 Step-Indexed Logical Relations

For languages with general recursion, mutable state, or other effects, **step-indexed logical relations** (Appel & McAllester, 2001; Ahmed, 2006) provide a parametricity framework. The key idea: instead of defining "term $t_1$ is related to $t_2$" as a flat proposition, define "$t_1$ is related to $t_2$ for $k$ steps" by induction on $k$. This avoids the circularity problems that arise from recursive types and mutable references.

### 8.2 Relational Parametricity for Dependent Types

Extending parametricity to dependent type theories is an active research area. Bernardy and Moulin (2012) showed that in a dependently typed language, parametricity can be internalized --- the free theorems become provable within the type theory itself, rather than being metatheorems.

### 8.3 Parametricity and Program Extraction

In proof assistants like Coq, parametricity is used for program extraction: the parametricity translation takes a type and produces the corresponding free theorem, which can then be proved internally. This automates the derivation of free theorems and makes them available as lemmas.

---

## 9. Detailed Proofs

### 9.1 Proof of the Abstraction Theorem (Selected Cases)

We provide careful proofs of the key cases of the abstraction theorem (Theorem 2.2).

**Case T-Var.** $\Gamma \vdash x : T$ with $x : T \in \Gamma$.

Let $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma \rbrack\!\rbrack_\rho$. By definition, $(\sigma_1(x), \sigma_2(x)) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$. Since $\sigma_i(x) = \sigma_i(x)$, we are done.

**Case T-Abs.** $\Gamma \vdash \lambda x : T_1.\, t : T_1 \to T_2$ with $\Gamma, x : T_1 \vdash t : T_2$.

Let $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma \rbrack\!\rbrack_\rho$. We must show:

$$(\sigma_1(\lambda x : T_1.\, t), \sigma_2(\lambda x : T_1.\, t)) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$$

By definition of $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$, this means: for all $(v_1, v_2) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$:

$$(\sigma_1(\lambda x : T_1.\, t)\; v_1, \sigma_2(\lambda x : T_1.\, t)\; v_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$$

Let $(v_1, v_2) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$. Define $\sigma_1' = \sigma_1[x \mapsto v_1]$ and $\sigma_2' = \sigma_2[x \mapsto v_2]$. Then $(\sigma_1', \sigma_2') \in \lbrack\!\lbrack \Gamma, x : T_1 \rbrack\!\rbrack_\rho$.

By IH on the premise $\Gamma, x : T_1 \vdash t : T_2$:

$$(\sigma_1'(t), \sigma_2'(t)) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$$

Now $\sigma_i(\lambda x : T_1.\, t)\; v_i = (\lambda x : T_1.\, \sigma_i(t))\; v_i \to \sigma_i'(t)$ (by beta reduction).

Therefore $(\sigma_1(\lambda x : T_1.\, t)\; v_1, \sigma_2(\lambda x : T_1.\, t)\; v_2)$ reduces to $(\sigma_1'(t), \sigma_2'(t)) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. (In the operational formulation, we need the interpretation to be closed under reduction, which it is by the properties of logical relations.)

**Case T-TAbs.** $\Gamma \vdash \Lambda X.\, t : \forall X.\, T$ with $\Gamma, X \vdash t : T$.

Let $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma \rbrack\!\rbrack_\rho$. We must show:

$$(\sigma_1(\Lambda X.\, t), \sigma_2(\Lambda X.\, t)) \in \lbrack\!\lbrack \forall X.\, T \rbrack\!\rbrack_\rho$$

By definition, this means: for all types $A_1, A_2$, relation $R \subseteq A_1 \times A_2$:

$$(\sigma_1(\Lambda X.\, t)\;[A_1], \sigma_2(\Lambda X.\, t)\;[A_2]) \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (A_1, A_2, R)]}$$

Let $A_1, A_2, R$ be given. Let $\rho' = \rho[X \mapsto (A_1, A_2, R)]$. Then $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma, X \rbrack\!\rbrack_{\rho'}$ (the new type variable $X$ is in scope with interpretation $R$).

By IH on $\Gamma, X \vdash t : T$:

$$(\sigma_1(t)[\text{under } \rho'], \sigma_2(t)[\text{under } \rho']) \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho'}$$

Now $\sigma_i(\Lambda X.\, t)\;[A_i] = (\Lambda X.\, \sigma_i(t))\;[A_i] \to [X \mapsto A_i]\,\sigma_i(t)$. The result is precisely $\sigma_i(t)$ evaluated under the type substitution mapping $X$ to $A_i$, which corresponds to the relational environment $\rho'$. Therefore the conclusion holds.

**Case T-TApp.** $\Gamma \vdash t\;[S] : [X \mapsto S]\,T$ with $\Gamma \vdash t : \forall X.\, T$.

Let $(\sigma_1, \sigma_2) \in \lbrack\!\lbrack \Gamma \rbrack\!\rbrack_\rho$. By IH:

$$(\sigma_1(t), \sigma_2(t)) \in \lbrack\!\lbrack \forall X.\, T \rbrack\!\rbrack_\rho$$

By the definition of $\lbrack\!\lbrack \forall X.\, T \rbrack\!\rbrack_\rho$, for all $A_1, A_2, R$:

$$(\sigma_1(t)\;[A_1], \sigma_2(t)\;[A_2]) \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (A_1, A_2, R)]}$$

We instantiate with $A_i = \sigma_i(S)$ (the type $S$ interpreted in world $i$) and $R = \lbrack\!\lbrack S \rbrack\!\rbrack_\rho$ (the relational interpretation of $S$). This gives:

$$(\sigma_1(t)\;[\sigma_1(S)], \sigma_2(t)\;[\sigma_2(S)]) \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (\sigma_1(S), \sigma_2(S), \lbrack\!\lbrack S \rbrack\!\rbrack_\rho)]}$$

A key semantic substitution lemma shows:

$$\lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto (\sigma_1(S), \sigma_2(S), \lbrack\!\lbrack S \rbrack\!\rbrack_\rho)]} = \lbrack\!\lbrack [X \mapsto S]\,T \rbrack\!\rbrack_\rho$$

(This is proved by induction on $T$.) Since $\sigma_i(t\;[S]) = \sigma_i(t)\;[\sigma_i(S)]$, we conclude:

$$(\sigma_1(t\;[S]), \sigma_2(t\;[S])) \in \lbrack\!\lbrack [X \mapsto S]\,T \rbrack\!\rbrack_\rho$$

### 9.2 The Semantic Substitution Lemma

**Lemma 9.1 (Semantic substitution).** For all types $T, S$ and relational environments $\rho$:

$$\lbrack\!\lbrack [X \mapsto S]\,T \rbrack\!\rbrack_\rho = \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack S \rbrack\!\rbrack_\rho]}$$

where we abuse notation: $\lbrack\!\lbrack S \rbrack\!\rbrack_\rho$ stands for the triple $(\sigma_1(S), \sigma_2(S), \lbrack\!\lbrack S \rbrack\!\rbrack_\rho^{\text{rel}})$.

*Proof.* By induction on $T$.

**Case $T = X$:** $[X \mapsto S]\,X = S$, so $\lbrack\!\lbrack [X \mapsto S]\,X \rbrack\!\rbrack_\rho = \lbrack\!\lbrack S \rbrack\!\rbrack_\rho$. On the other hand, $\lbrack\!\lbrack X \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack S \rbrack\!\rbrack_\rho]} = \lbrack\!\lbrack S \rbrack\!\rbrack_\rho$. Equal.

**Case $T = Y \neq X$:** $[X \mapsto S]\,Y = Y$, so $\lbrack\!\lbrack Y \rbrack\!\rbrack_\rho = \rho(Y)$. Also $\lbrack\!\lbrack Y \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack S \rbrack\!\rbrack_\rho]} = \rho(Y)$ (since $Y \neq X$, the extended environment agrees with $\rho$ on $Y$). Equal.

**Case $T = T_1 \to T_2$:** By IH on both $T_1$ and $T_2$, the interpretations commute with substitution. The definition of $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack$ is in terms of $\lbrack\!\lbrack T_1 \rbrack\!\rbrack$ and $\lbrack\!\lbrack T_2 \rbrack\!\rbrack$, so the equation propagates.

**Case $T = \forall Y.\, T_1$:** We may assume $Y \neq X$ and $Y \notin \text{FTV}(S)$. Then $[X \mapsto S]\,(\forall Y.\, T_1) = \forall Y.\, [X \mapsto S]\,T_1$. The quantification over all $A_1, A_2, R$ in both sides is the same, and the body follows by IH.

$\square$

### 9.3 Composing Free Theorems

Free theorems compose: if $f : \forall X.\, T_1$ and $g : \forall X.\, T_2$ are both polymorphic, and $h$ is defined using both $f$ and $g$, then the free theorem for $h$ can be derived from the free theorems for $f$ and $g$.

**Example.** Let $\text{filter} : \forall X.\, (X \to \text{Bool}) \to [X] \to [X]$ and $\text{map} : \forall X\, Y.\, (X \to Y) \to [X] \to [Y]$. Consider:

$$h = \Lambda X.\, \Lambda Y.\, \lambda g : X \to Y.\, \lambda p : Y \to \text{Bool}.\, \lambda \ell : [X].\, \text{filter}\;[Y]\; p\; (\text{map}\;[X]\;[Y]\; g\; \ell)$$

The free theorem for $h$ can be derived by combining the free theorems for $\text{filter}$ and $\text{map}$. Specifically:

$$\text{filter}\;[Y]\; p\; (\text{map}\;g\;\ell) = \text{map}\;g\;(\text{filter}\;[X]\;(p \circ g)\;\ell)$$

This follows from the free theorem for $\text{filter}$ (which says $\text{map}\;g \circ \text{filter}\;[X]\;(p \circ g) = \text{filter}\;[Y]\;p \circ \text{map}\;g$).

---

## 10. Exercises

**Exercise 10.1.** Derive the free theorem for $f : \forall X.\, X \to [X]$ (the type of singleton list construction). Show that $\text{map}\;g\;(f\;[A]\;a) = f\;[B]\;(g\;a)$ for all $g : A \to B$.

**Exercise 10.2.** Derive the free theorem for $f : \forall X.\, [X] \to \text{Nat}$ (the type of length). Show that $f\;[A]\;\ell = f\;[B]\;(\text{map}\;g\;\ell)$ --- i.e., the result is independent of the element type.

**Exercise 10.3.** Consider $f : \forall X.\, (X \to X \to X) \to X \to X$. Derive its free theorem. What does it say about the possible behaviors of $f$? (Hint: $f$ applies a binary operation to its second argument some number of times.)

**Exercise 10.4.** Prove that $f : \forall X.\, (\text{Nat} \to X) \to X$ satisfies: for all $g : A \to B$, $g\;(f\;[A]\;h) = f\;[B]\;(g \circ h)$. Interpret this: $f$ "selects" a natural number and applies the function to it.

**Exercise 10.5.** Show that parametricity implies the following "initial algebra" property: for the Church numeral type $\text{CNat} = \forall X.\, (X \to X) \to X \to X$, every $n : \text{CNat}$ satisfies the "fold fusion" law: for all $h : A \to B$, $s_A : A \to A$, $s_B : B \to B$, $z_A : A$, if $h(s_A(a)) = s_B(h(a))$ for all $a$ and $h(z_A) = z_B$, then $h(n\;[A]\;s_A\;z_A) = n\;[B]\;s_B\;z_B$.

---

## Summary

Parametricity is the formal expression of the intuition that parametrically polymorphic functions behave uniformly across all types. Key results:

1. **Reynolds' abstraction theorem**: every well-typed System F term satisfies its relational interpretation.
2. **Free theorems**: non-trivial properties derivable from types alone.
   - $f : \forall X.\, X \to X$ implies $f = \text{id}$.
   - $f : \forall X.\, [X] \to [X]$ implies $f$ commutes with map.
   - $f : \forall X\, Y.\, (X \to Y) \to [X] \to [Y]$ with identity law implies $f = \text{map}$.
3. **Representation independence**: parametricity justifies data abstraction via existential types.
4. **Naturality**: free theorems are naturality conditions from category theory.
5. **Practical applications**: compiler optimizations (map fusion, deforestation), refactoring guarantees, property-based testing.
6. **Limitations**: parametricity requires purity; side effects, general recursion, type case, and exceptions weaken or break it.

---

## Further Reading

1. **Reynolds, J. C.** (1983). Types, abstraction and parametric polymorphism. In *Information Processing 83*, ed. R. E. A. Mason, North-Holland. The original formulation of relational parametricity.
2. **Wadler, P.** (1989). Theorems for free! In *Proc. FPCA 1989*. The paper that popularized free theorems and gave the systematic recipe.
3. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapter 23.9 (Parametricity).
4. **Wadler, P.** (2007). The Girard-Reynolds isomorphism (second edition). *Theoretical Computer Science*, 375(1--3), 201--226.
5. **Bernardy, J.-P., Jansson, P., and Paterson, R.** (2012). Proofs for free --- parametricity for dependent types. *Journal of Functional Programming*, 22(2), 107--152.
6. **Ahmed, A.** (2006). Step-indexed syntactic logical relations for recursive and quantified types. In *Proc. ESOP 2006*. Extends parametricity to languages with general recursion.
7. **Appel, A. W. and McAllester, D.** (2001). An indexed model of recursive types for foundational proof-carrying code. *ACM TOPLAS*, 23(5), 657--683.
8. **Pitts, A. M.** (2000). Parametric polymorphism and operational equivalence. *Mathematical Structures in Computer Science*, 10(3), 321--359.
9. **Hermida, C., Reddy, U. S., and Robinson, E. P.** (2014). Logical relations and parametricity --- a Reynolds programme for category theory and programming languages. *ENTCS*, 303, 149--180.
10. **Gill, A., Launchbury, J., and Peyton Jones, S. L.** (1993). A short cut to deforestation. In *Proc. FPCA 1993*. Uses parametricity for compiler optimization.
