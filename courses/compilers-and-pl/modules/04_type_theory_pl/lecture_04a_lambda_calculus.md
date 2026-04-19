# Lecture 04a: Lambda Calculus

## 1. Introduction

The **lambda calculus**, introduced by Alonzo Church in 1936, is a formal system for expressing computation based on function abstraction and application. It is the theoretical foundation of functional programming and serves as the core calculus underlying the semantics of most programming languages.

**Church's Thesis (informal):** The lambda calculus captures exactly the class of effectively computable functions---the same class as Turing machines.

---

## 2. Untyped Lambda Calculus: Syntax

### 2.1 Terms

The core idea is radical: everything is a function. There are no numbers, no booleans, no data structures built in --- only three ways to form expressions.

The set $\Lambda$ of **lambda terms** is defined inductively:

$$e ::= x \mid \lambda x.\; e \mid e_1\; e_2$$

where:
- $x$ is a **variable** (drawn from a countably infinite set $\mathcal{V}$) --- a name,
- $\lambda x.\; e$ is an **abstraction** (function with parameter $x$ and body $e$) --- making a function,
- $e_1\; e_2$ is an **application** (applying $e_1$ to argument $e_2$) --- calling a function.

Think of $\lambda x.\; e$ as an anonymous function: in Python, `lambda x: e`. Application $e_1\; e_2$ is just calling $e_1$ with argument $e_2$.

**Conventions:**
- Application is left-associative: $e_1\; e_2\; e_3 = (e_1\; e_2)\; e_3$.
- Abstraction extends as far right as possible: $\lambda x.\; x\; y = \lambda x.\; (x\; y)$.
- Multiple parameters: $\lambda x\; y\; z.\; e = \lambda x.\; \lambda y.\; \lambda z.\; e$ (currying).

### 2.2 Free and Bound Variables

**Definition 2.1.** The set of **free variables** of a term $e$, written $\text{FV}(e)$, is defined by:

$$
\begin{aligned}
\text{FV}(x) &= \{x\} \\
\text{FV}(\lambda x.\; e) &= \text{FV}(e) \setminus \{x\} \\
\text{FV}(e_1\; e_2) &= \text{FV}(e_1) \cup \text{FV}(e_2)
\end{aligned}
$$

A variable $x$ is **bound** in $e$ if it appears within the scope of a $\lambda x$. A term with no free variables is **closed** (also called a **combinator**).

**Example.** In $\lambda x.\; x\; y$:
- $x$ is bound (captured by $\lambda x$),
- $y$ is free (no $\lambda y$ above it),
- $\text{FV}(\lambda x.\; x\; y) = \{y\}$.

In $\lambda x.\; \lambda y.\; x\; y\; z$, both $x$ and $y$ are bound, only $z$ is free.

---

## 3. Reduction Rules

Lambda calculus terms are static syntax --- trees of symbols. **Reduction rules are the computation mechanism.** They define how to transform one term into a simpler one, the same way executing a CPU instruction transforms machine state. Without reduction rules, $(\lambda x.\; x)\; 5$ is just a dead expression; reduction is what makes it *evaluate* to $5$.

There are three reduction rules, each serving a distinct role:

| Rule | Role | Analogy |
|------|------|---------|
| $\alpha$ | Rename labels so substitution stays safe | Refactoring variable names --- no semantic change |
| $\beta$ | Execute a function call | The CPU's fetch-execute cycle |
| $\eta$ | Equate a wrapper with the thing it wraps | Inlining a trivial forwarding function |

Alpha is hygiene. Beta is computation. Eta is reasoning about equivalence. In practice, **beta is the only rule that "does work"**; alpha is the prerequisite that keeps beta correct, and eta is an optional principle about when two terms mean the same thing.

### 3.1 Alpha-Reduction ($\alpha$)

**Purpose:** Bound variable names are arbitrary labels. Alpha-reduction says you can rename them freely, because the *name* of a parameter does not affect what a function *does*.

Consider two C++ lambdas:

```cpp
auto f = [](int x){ return x + 1; };
auto g = [](int n){ return n + 1; };
```

These are the same function. You would never say they differ because one uses `x` and the other `n`. Alpha-reduction formalizes this: $\lambda x.\; x$ and $\lambda y.\; y$ are **the same term**.

**Definition.** Alpha-reduction is the renaming of bound variables:

$$\lambda x.\; e =_\alpha \lambda y.\; [x \mapsto y]e \quad \text{provided } y \notin \text{FV}(e)$$

Alpha-equivalent terms are considered identical. We work modulo alpha-equivalence throughout.

**Why it is needed for computation.** Without alpha, substitution breaks. Suppose you want to reduce:

$$(\lambda x.\; \lambda y.\; x)\; y$$

Naively substituting $y$ for $x$ gives $\lambda y.\; y$ --- the identity function. But the original meant "always return $y$." The free $y$ got **captured** by the inner binder $\lambda y$. Alpha-rename the inner variable first ($\lambda y.\; x \to_\alpha \lambda z.\; x$), then substitute to get $\lambda z.\; y$. Correct.

### 3.2 Beta-Reduction ($\beta$)

**Purpose:** This is **the** computation rule. It defines what "calling a function" means.

**Why substitution?** Lambda calculus has no memory, no stack, no registers. There is no "environment" to bind $x = e_2$ in. The only way to "pass an argument" is to literally **replace** every occurrence of the parameter with the argument in the body. That textual replacement is substitution.

**Why is this the only computation rule needed?** Because lambda calculus encodes *everything* as functions --- numbers, booleans, loops are all lambdas. So the only operation you ever need is "call a function." Every computation, no matter how complex, is a chain of beta-reductions. Think of it this way: in a CPU, the one primitive operation is "execute instruction at PC, advance PC." In lambda calculus, the one primitive operation is "apply function to argument."

**Definition.** Beta-reduction is function application:

$$(\lambda x.\; e_1)\; e_2 \to_\beta [x \mapsto e_2]e_1$$

The term $(\lambda x.\; e_1)\; e_2$ is called a **redex** (reducible expression). The result $[x \mapsto e_2]e_1$ is the **reduct**.

**Capture-avoiding substitution** $[x \mapsto s]e$ is defined by:

$$
\begin{aligned}
{[x \mapsto s]}x &= s \\
{[x \mapsto s]}y &= y \quad (y \neq x) \\
{[x \mapsto s]}(\lambda x.\; e) &= \lambda x.\; e \quad \text{(x is bound; no substitution)} \\
{[x \mapsto s]}(\lambda y.\; e) &= \lambda y.\; [x \mapsto s]e \quad \text{if } y \notin \text{FV}(s) \\
{[x \mapsto s]}(\lambda y.\; e) &= \lambda z.\; [x \mapsto s][y \mapsto z]e \quad \text{if } y \in \text{FV}(s), z \text{ fresh} \\
{[x \mapsto s]}(e_1\; e_2) &= ([x \mapsto s]e_1)\; ([x \mapsto s]e_2)
\end{aligned}
$$

Rules 3--5 are where alpha-reduction earns its keep: they ensure that substitution never accidentally captures a free variable. Rule 3 says "a binder that shadows the substituted variable blocks it." Rule 4 is the straightforward case. Rule 5 fires when the binder's name collides with a free variable in the term being substituted --- alpha-rename first, then proceed.

**Worked examples of substitution.** These are worth tracing carefully, since most lambda calculus bugs come from getting substitution wrong.

**Simple case (rule 4):** $[x \mapsto a](\lambda y.\; x\; y)$. Since $y \neq x$ and $y \notin \text{FV}(a) = \{a\}$:

$$[x \mapsto a](\lambda y.\; x\; y) = \lambda y.\; [x \mapsto a](x\; y) = \lambda y.\; a\; y$$

**Capture-avoidance is needed (rule 5):** $[x \mapsto y](\lambda y.\; x)$. Naively substituting gives $\lambda y.\; y$, which is wrong --- the free $y$ got "captured" by $\lambda y$. Since $y \in \text{FV}(y)$ and the binder is $\lambda y$, we must rename: pick fresh $z$, then:

$$[x \mapsto y](\lambda y.\; x) = \lambda z.\; [x \mapsto y][y \mapsto z]x = \lambda z.\; [x \mapsto y]x = \lambda z.\; y$$

The free $y$ stays free, as it should.

**Bound variable blocks substitution (rule 3):** $[x \mapsto a](\lambda x.\; x) = \lambda x.\; x$ --- the inner $\lambda x$ shadows the outer $x$, so nothing is substituted.

### 3.3 Eta-Reduction ($\eta$)

**Purpose:** Eta captures **extensional equality** --- two functions are the same if they produce the same output for every input. It says that a function which does nothing but forward its argument to $f$ **is** $f$.

**Why it is separate from beta:** Beta is about *computation* (calling a function). Eta is about *meaning*. Consider:

```cpp
auto f = [](int x){ return g(x); };
// Is f the same as g?
```

There is no redex to beta-reduce. But eta says: yes, if `f` does nothing but forward to `g`, they are equal. This is the principle that `f` and `lambda x: f(x)` are interchangeable in Python.

**Why you should care:**
1. **Optimization** --- a compiler can replace $\lambda x.\; f\; x$ with $f$, eliminating a trivial wrapper.
2. **Equational reasoning** --- when proving two programs equivalent, eta lets you simplify wrappers away.
3. **Type theory** --- eta-expansion (the reverse direction) is needed in some type systems to ensure canonical forms.

**Definition.** Eta-reduction expresses extensionality:

$$\lambda x.\; e\; x \to_\eta e \quad \text{provided } x \notin \text{FV}(e)$$

The side condition $x \notin \text{FV}(e)$ is essential. If $x$ appears free in $e$, the wrapper is not trivial: $\lambda x.\; x\; x \neq x$.

### 3.4 Reduction Strategies

**Purpose:** A term may contain multiple redexes simultaneously. The **reduction strategy** decides which one to reduce first. This is not just a matter of taste --- the choice can determine whether evaluation terminates or loops forever.

**Why this matters.** Consider $(\lambda x.\; \lambda y.\; y)\; \Omega$ where $\Omega = (\lambda x.\; x\; x)(\lambda x.\; x\; x)$ diverges. The function ignores its first argument. If we reduce the outer redex first (substitute $\Omega$ for $x$, which is unused), we get $\lambda y.\; y$ immediately. If we try to evaluate the argument $\Omega$ first, we loop forever. Same term, different strategy, different outcome. This is why language designers care deeply about evaluation order.

- **Normal order:** Always reduce the leftmost, outermost redex first. (Most "cautious" --- guaranteed to find a normal form if one exists; see Theorem 4.2.)
- **Applicative order:** Always reduce the leftmost, innermost redex first (evaluate arguments before applying). (Eager --- can diverge even when a normal form exists, as in the $\Omega$ example above.)
- **Call-by-value:** Like applicative order, but do not reduce under lambdas. (This is what most languages do: C, C++, Python, Java. Arguments are fully evaluated before the function body runs.)
- **Call-by-name:** Like normal order, but do not reduce under lambdas. (Arguments are substituted unevaluated, and only reduced when actually used.)
- **Call-by-need (lazy):** Like call-by-name, but memoize the result of each reduction so no argument is evaluated more than once. (Haskell. Combines the termination benefits of call-by-name with the efficiency of call-by-value.)

**Example:**

$$(\lambda x.\; \lambda y.\; x)\; ((\lambda z.\; z)\; a)\; b$$

- Normal order: reduce the outermost redex $(\lambda x.\; \lambda y.\; x)\; ((\lambda z.\; z)\; a)$ first $\to (\lambda y.\; (\lambda z.\; z)\; a)\; b \to (\lambda z.\; z)\; a \to a$.
- Applicative order: reduce the innermost redex $(\lambda z.\; z)\; a$ first $\to (\lambda x.\; \lambda y.\; x)\; a\; b \to (\lambda y.\; a)\; b \to a$.

Both reach $a$, but normal order substituted the unreduced argument $((\lambda z.\; z)\; a)$ first and simplified it later, while applicative order simplified the argument before passing it in. In this case both terminate; in the $\Omega$ example above, only normal order does.

---

## 4. Normal Forms and Confluence

### 4.1 Normal Forms

**Definition 4.1.** A term $e$ is in **normal form** if it contains no beta-redexes.

**Definition 4.2.** A term $e$ is in **weak head normal form** (WHNF) if it is of the form $\lambda x.\; e'$ or $x\; e_1 \cdots e_n$ (a variable applied to arguments).

Not every term has a normal form. The simplest divergent term is:

$$\Omega = (\lambda x.\; x\; x)(\lambda x.\; x\; x) \to_\beta (\lambda x.\; x\; x)(\lambda x.\; x\; x) = \Omega$$

### 4.2 The Church-Rosser Theorem (Confluence)

Intuitively: it does not matter in which order you simplify --- if you can reach two different terms, those terms can always be brought back together. This is why lambda calculus "makes sense" as a computation model: different evaluation strategies may take different paths, but they cannot disagree on the final answer.

**Theorem 4.1 (Church-Rosser, 1936).** If $e \twoheadrightarrow_\beta e_1$ and $e \twoheadrightarrow_\beta e_2$ (where $\twoheadrightarrow_\beta$ denotes zero or more beta-reduction steps), then there exists a term $e_3$ such that $e_1 \twoheadrightarrow_\beta e_3$ and $e_2 \twoheadrightarrow_\beta e_3$.

*Proof sketch (Tait-Martin-Lof method).*

Define **parallel reduction** $\Rightarrow$ where multiple redexes can be reduced simultaneously:

$$\frac{}{x \Rightarrow x} \qquad \frac{e \Rightarrow e'}{\lambda x.\; e \Rightarrow \lambda x.\; e'} \qquad \frac{e_1 \Rightarrow e_1' \quad e_2 \Rightarrow e_2'}{e_1\; e_2 \Rightarrow e_1'\; e_2'}$$

$$\frac{e_1 \Rightarrow e_1' \quad e_2 \Rightarrow e_2'}{(\lambda x.\; e_1)\; e_2 \Rightarrow [x \mapsto e_2']e_1'}$$

**Step 1:** Show that $\Rightarrow$ satisfies the diamond property: if $e \Rightarrow e_1$ and $e \Rightarrow e_2$, then there exists $e_3$ with $e_1 \Rightarrow e_3$ and $e_2 \Rightarrow e_3$. This is proved by induction on the derivation of $e \Rightarrow e_1$, defining $e_3$ as the "complete development" $e^*$ that reduces all redexes in $e$ simultaneously.

**Step 2:** Show that $\to_\beta \;\subseteq\; \Rightarrow \;\subseteq\; \twoheadrightarrow_\beta$.

**Step 3:** The diamond property of $\Rightarrow$ lifts to the transitive closure $\twoheadrightarrow_\beta$ by a standard strip lemma argument. $\square$

**Corollary 4.1.** If a term has a normal form, it is unique (up to alpha-equivalence).

**Theorem 4.2 (Normalization Theorem).** If a term $e$ has a normal form, then the normal-order reduction strategy will find it.

---

## 5. Church Encodings

Since lambda calculus has only functions, we need to *represent* data as functions. The key idea: **encode a value as the thing that uses it**. A boolean is a choice between two options, so we represent it as a function that takes two arguments and picks one. A number $n$ is "the act of doing something $n$ times."

### 5.1 Booleans

$$
\begin{aligned}
\texttt{true} &= \lambda t.\; \lambda f.\; t \\
\texttt{false} &= \lambda t.\; \lambda f.\; f \\
\texttt{if} &= \lambda b.\; \lambda t.\; \lambda f.\; b\; t\; f \\
\texttt{and} &= \lambda a.\; \lambda b.\; a\; b\; \texttt{false} \\
\texttt{or} &= \lambda a.\; \lambda b.\; a\; \texttt{true}\; b \\
\texttt{not} &= \lambda a.\; a\; \texttt{false}\; \texttt{true}
\end{aligned}
$$

**Verification:** $\texttt{if}\; \texttt{true}\; M\; N = (\lambda b\; t\; f.\; b\; t\; f)\; (\lambda t\; f.\; t)\; M\; N \to_\beta^* (\lambda t\; f.\; t)\; M\; N \to_\beta^* M$. $\checkmark$

### 5.2 Church Numerals

The number $n$ is represented as "apply $f$ exactly $n$ times to $x$":

$$
\begin{aligned}
\overline{0} &= \lambda f.\; \lambda x.\; x & &\text{(apply $f$ zero times: just return $x$)} \\
\overline{1} &= \lambda f.\; \lambda x.\; f\; x & &\text{(apply $f$ once)} \\
\overline{2} &= \lambda f.\; \lambda x.\; f\; (f\; x) & &\text{(apply $f$ twice)} \\
\overline{n} &= \lambda f.\; \lambda x.\; f^n(x)
\end{aligned}
$$

Notice $\overline{0} = \texttt{false}$ --- this is not a coincidence and will recur in the Curry-Howard correspondence.

**Arithmetic.** Read these by thinking about "how many times does $f$ get applied?"

$$
\begin{aligned}
\texttt{succ} &= \lambda n.\; \lambda f.\; \lambda x.\; f\; (n\; f\; x) & &\text{(one more $f$)} \\
\texttt{plus} &= \lambda m.\; \lambda n.\; \lambda f.\; \lambda x.\; m\; f\; (n\; f\; x) & &\text{($m$ applications after $n$ applications)} \\
\texttt{mult} &= \lambda m.\; \lambda n.\; \lambda f.\; m\; (n\; f) & &\text{(apply "$n$ copies of $f$" $m$ times)} \\
\texttt{exp} &= \lambda m.\; \lambda n.\; n\; m & &\text{(apply $m$ to itself $n$ times)} \\
\texttt{iszero} &= \lambda n.\; n\; (\lambda x.\; \texttt{false})\; \texttt{true} & &\text{(if $f$ is applied even once, return false)}
\end{aligned}
$$

**Verification of plus.** Let us check $\texttt{plus}\; \overline{2}\; \overline{1}$ reduces to $\overline{3}$:

$$
\begin{aligned}
\texttt{plus}\; \overline{2}\; \overline{1}
&= (\lambda m\; n\; f\; x.\; m\; f\; (n\; f\; x))\; \overline{2}\; \overline{1} \\
&\to_\beta^* \lambda f.\; \lambda x.\; \overline{2}\; f\; (\overline{1}\; f\; x) \\
&= \lambda f.\; \lambda x.\; \overline{2}\; f\; (f\; x) \\
&= \lambda f.\; \lambda x.\; f\; (f\; (f\; x)) = \overline{3} \quad \checkmark
\end{aligned}
$$

**Predecessor (Kleene):**

$$\texttt{pred} = \lambda n.\; \lambda f.\; \lambda x.\; n\; (\lambda g.\; \lambda h.\; h\; (g\; f))\; (\lambda u.\; x)\; (\lambda u.\; u)$$

Predecessor is the hardest Church encoding to understand. The difficulty is that Church numerals only know how to *apply* $f$ --- they cannot "unapply" it. Kleene's trick: instead of removing one application of $f$, **rebuild from scratch and stop one step early**.

*Derivation (pair-shifting method):* Using Church pairs from Section 5.3, define:

$$\phi = \lambda p.\; \texttt{pair}\; (\texttt{snd}\; p)\; (\texttt{succ}\; (\texttt{snd}\; p))$$

This takes a pair $(a, b)$ and produces $(b, b+1)$. Now trace what happens when we apply $\phi$ repeatedly starting from $(0, 0)$:

| Iteration | Pair |
|-----------|------|
| Start | $(0, 0)$ |
| After $\phi^1$ | $(0, 1)$ |
| After $\phi^2$ | $(1, 2)$ |
| After $\phi^3$ | $(2, 3)$ |
| After $\phi^n$ | $(n-1, n)$ |

So $\texttt{pred}\; n = \texttt{fst}\; (n\; \phi\; (\texttt{pair}\; \overline{0}\; \overline{0}))$ gives us $n - 1$. The one-line version above inlines the pair operations to avoid the overhead.

### 5.3 Pairs

$$
\begin{aligned}
\texttt{pair} &= \lambda a.\; \lambda b.\; \lambda f.\; f\; a\; b \\
\texttt{fst} &= \lambda p.\; p\; (\lambda a.\; \lambda b.\; a) = \lambda p.\; p\; \texttt{true} \\
\texttt{snd} &= \lambda p.\; p\; (\lambda a.\; \lambda b.\; b) = \lambda p.\; p\; \texttt{false}
\end{aligned}
$$

### 5.4 Lists

$$
\begin{aligned}
\texttt{nil} &= \lambda c.\; \lambda n.\; n \\
\texttt{cons} &= \lambda h.\; \lambda t.\; \lambda c.\; \lambda n.\; c\; h\; (t\; c\; n) \\
\texttt{isnil} &= \lambda l.\; l\; (\lambda h.\; \lambda t.\; \texttt{false})\; \texttt{true} \\
\texttt{head} &= \lambda l.\; l\; (\lambda h.\; \lambda t.\; h)\; \bot \\
\texttt{foldr} &= \lambda f.\; \lambda z.\; \lambda l.\; l\; f\; z
\end{aligned}
$$

A list $[a, b, c]$ is encoded as $\lambda c.\; \lambda n.\; c\; a\; (c\; b\; (c\; c_{\text{elem}}\; n))$---essentially a right fold.

---

## 6. Fixed-Point Combinators

### 6.1 The Need for Recursion

The lambda calculus has no built-in recursion --- a function cannot refer to itself by name (there are no names!). If we try to write factorial as $\texttt{fact} = \lambda n.\; \ldots \texttt{fact} \ldots$, the $\texttt{fact}$ on the right side is a free variable, not a self-reference. We need a mechanism to "tie the knot." That mechanism is the **fixed-point combinator**.

**Definition 6.1.** A **fixed-point combinator** is a closed term $Y$ such that for all $f$:

$$Y\; f =_\beta f\; (Y\; f)$$

### 6.2 The Y Combinator (Curry)

$$Y = \lambda f.\; (\lambda x.\; f\; (x\; x))\; (\lambda x.\; f\; (x\; x))$$

**Derivation.** We want to find a term $Y$ such that $Y\; f = f\; (Y\; f)$ for any $f$. That is, $Y\; f$ should be a **fixed point** of $f$ --- a value $v$ where $f\; v = v$.

The key insight is **self-application**. If a function receives *itself* as an argument, it can call itself:

**Step 1.** Suppose we have some term $\omega$ that, when applied to itself, produces the fixed point we want. If $\omega = \lambda x.\; f\; (x\; x)$, then:

$$\omega\; \omega = (\lambda x.\; f\; (x\; x))\; \omega \to_\beta f\; (\omega\; \omega)$$

So $\omega\; \omega$ satisfies our equation: it equals $f$ applied to itself!

**Step 2.** But $\omega$ depends on $f$, so wrap it in a lambda:

$$Y = \lambda f.\; (\lambda x.\; f\; (x\; x))\; (\lambda x.\; f\; (x\; x))$$

**Verification:**

$$
\begin{aligned}
Y\; f &= (\lambda x.\; f\; (x\; x))\; (\lambda x.\; f\; (x\; x)) \\
&\to_\beta f\; ((\lambda x.\; f\; (x\; x))\; (\lambda x.\; f\; (x\; x))) \\
&= f\; (Y\; f)
\end{aligned}
$$

### 6.3 The Turing Fixed-Point Combinator

$$\Theta = (\lambda x.\; \lambda y.\; y\; (x\; x\; y))\; (\lambda x.\; \lambda y.\; y\; (x\; x\; y))$$

Unlike $Y$, the Turing combinator satisfies $\Theta\; f \to_\beta^+ f\; (\Theta\; f)$ (reduces to, rather than equals).

### 6.4 Call-by-Value Fixed Point (Z combinator)

The $Y$ combinator diverges under call-by-value evaluation. The **Z combinator** works with call-by-value:

$$Z = \lambda f.\; (\lambda x.\; f\; (\lambda v.\; x\; x\; v))\; (\lambda x.\; f\; (\lambda v.\; x\; x\; v))$$

The extra $\lambda v.\; \ldots\; v$ wraps the self-application $x\; x$ inside a lambda, so it is a *value* (a function) rather than an expression that immediately reduces. Under call-by-value, a value is not reduced further, so the infinite unfolding is deferred until the recursive call is actually needed. This is the same trick as wrapping a thunk in a lazy language.

### 6.5 Example: Factorial

$$\texttt{fact} = Y\; (\lambda f.\; \lambda n.\; \texttt{if}\; (\texttt{iszero}\; n)\; \overline{1}\; (\texttt{mult}\; n\; (f\; (\texttt{pred}\; n))))$$

---

## 7. Normalization

### 7.1 Weak vs. Strong Normalization

**Definition 7.1.** A term $e$ is **weakly normalizing** (WN) if there exists at least one reduction sequence from $e$ to a normal form.

**Definition 7.2.** A term $e$ is **strongly normalizing** (SN) if every reduction sequence from $e$ terminates (reaches a normal form).

Strong normalization implies weak normalization, but not conversely. Example: $(\lambda x.\; \lambda y.\; y)\; \Omega$ is WN (reducing the outermost redex first) but not SN (reducing $\Omega$ first diverges).

### 7.2 Simply-Typed Lambda Calculus

**Theorem 7.1 (Strong Normalization of STLC).** Every well-typed term in the simply-typed lambda calculus is strongly normalizing.

*Proof sketch (Tait's method of logical relations).* For each type $\tau$, define the set $\text{Red}(\tau)$ of "reducible" terms:

- $\text{Red}(\text{base}) = \text{SN}$ (the set of strongly normalizing terms of base type)
- $\text{Red}(\tau_1 \to \tau_2) = \{e \mid \forall e' \in \text{Red}(\tau_1).\; e\; e' \in \text{Red}(\tau_2)\}$

**Key lemma:** Every reducible term is strongly normalizing, and every variable is reducible.

**Main theorem:** If $\Gamma \vdash e : \tau$ and all variables in $\Gamma$ are replaced by reducible terms, then $e$ is reducible (hence SN).

The proof proceeds by induction on the typing derivation. The application case uses the definition of $\text{Red}(\to)$. The abstraction case requires the substitution lemma. $\square$

**Corollary.** The simply-typed lambda calculus is not Turing-complete (since all programs terminate).

---

## 8. De Bruijn Indices

### 8.1 Motivation

Working with named variables requires alpha-equivalence and capture-avoiding substitution, which are error-prone to implement. Consider: $\lambda x.\; \lambda y.\; x$ and $\lambda a.\; \lambda b.\; a$ are the same function, but a naive string comparison says they are different. **De Bruijn indices** (de Bruijn, 1972) solve this by replacing variable names with natural numbers. The number tells you "how many lambdas up do I need to go to find my binder?" --- counting from 0.

### 8.2 Definition

$$e ::= n \mid \lambda.\; e \mid e_1\; e_2$$

where $n \in \mathbb{N}$ is a de Bruijn index. Index 0 refers to the innermost enclosing binder, 1 to the next, and so on.

**Examples:**

| Named | De Bruijn |
|-------|-----------|
| $\lambda x.\; x$ | $\lambda.\; 0$ |
| $\lambda x.\; \lambda y.\; x$ | $\lambda.\; \lambda.\; 1$ |
| $\lambda x.\; \lambda y.\; y$ | $\lambda.\; \lambda.\; 0$ |
| $\lambda x.\; \lambda y.\; x\; y$ | $\lambda.\; \lambda.\; 1\; 0$ |
| $(\lambda x.\; x)\; (\lambda y.\; y)$ | $(\lambda.\; 0)\; (\lambda.\; 0)$ |

Reading the table: in $\lambda.\; \lambda.\; 1$, the inner body is $1$, meaning "go up 1 binder" --- that is the outermost $\lambda$, so this is "return the first argument," i.e., $\lambda x.\; \lambda y.\; x$.

Now $\lambda x.\; \lambda y.\; x$ and $\lambda a.\; \lambda b.\; a$ both become $\lambda.\; \lambda.\; 1$ --- alpha-equivalence is just syntactic equality.

### 8.3 Substitution with De Bruijn Indices

When substituting under a binder, free variable indices need adjustment because the binder "shifts the frame." The **shifting** operation handles this:

$$
\begin{aligned}
\uparrow^d_c(n) &= \begin{cases} n & \text{if } n < c \\ n + d & \text{if } n \geq c \end{cases} \\
\uparrow^d_c(\lambda.\; e) &= \lambda.\; \uparrow^d_{c+1}(e) \\
\uparrow^d_c(e_1\; e_2) &= \uparrow^d_c(e_1)\; \uparrow^d_c(e_2)
\end{aligned}
$$

**Substitution** $[n \mapsto s]e$:

$$
\begin{aligned}
{[n \mapsto s]}k &= \begin{cases} s & \text{if } k = n \\ k & \text{otherwise} \end{cases} \\
{[n \mapsto s]}(\lambda.\; e) &= \lambda.\; [n+1 \mapsto \uparrow^1_0(s)]e \\
{[n \mapsto s]}(e_1\; e_2) &= ([n \mapsto s]e_1)\; ([n \mapsto s]e_2)
\end{aligned}
$$

**Beta-reduction:**

$$(\lambda.\; e_1)\; e_2 \to_\beta \uparrow^{-1}_0([0 \mapsto \uparrow^1_0(e_2)]e_1)$$

**Worked example.** Let us reduce $(\lambda.\; \lambda.\; 1\; 0)\; (\lambda.\; 0)$, which is $(\lambda x.\; \lambda y.\; x\; y)\; (\lambda z.\; z)$ in named form. We expect $\lambda y.\; (\lambda z.\; z)\; y = \lambda.\; (\lambda.\; 0)\; 0$.

The body $e_1 = \lambda.\; 1\; 0$ and argument $e_2 = \lambda.\; 0$.

1. Shift $e_2$ up: $\uparrow^1_0(\lambda.\; 0) = \lambda.\; 0$ (the $0$ is bound inside its own $\lambda$, so $0 < 1$ in the recursive case with $c = 1$; unchanged).
2. Substitute: $[0 \mapsto \lambda.\; 0](\lambda.\; 1\; 0) = \lambda.\; [1 \mapsto \uparrow^1_0(\lambda.\; 0)](1\; 0) = \lambda.\; (\lambda.\; 0)\; 0$.
3. Shift down: $\uparrow^{-1}_0(\lambda.\; (\lambda.\; 0)\; 0) = \lambda.\; (\lambda.\; 0)\; 0$ (no free variables to shift).

Result: $\lambda.\; (\lambda.\; 0)\; 0$, which is $\lambda y.\; (\lambda z.\; z)\; y$. $\checkmark$

### 8.4 Advantages

1. Alpha-equivalence becomes syntactic equality.
2. No need for fresh variable generation.
3. Used extensively in proof assistants (Coq) and compiler implementations.

---

## 9. Combinatory Logic

### 9.1 SKI Combinators

Combinatory logic provides an equivalent formalism without variable binding:

$$
\begin{aligned}
\mathbf{S} &= \lambda x.\; \lambda y.\; \lambda z.\; x\; z\; (y\; z) \\
\mathbf{K} &= \lambda x.\; \lambda y.\; x \\
\mathbf{I} &= \lambda x.\; x = \mathbf{S}\; \mathbf{K}\; \mathbf{K}
\end{aligned}
$$

**Theorem 9.1.** Every closed lambda term can be translated into an equivalent SKI combinator expression.

The translation (bracket abstraction) $[\![ \lambda x.\; e ]\!]$ is defined by:

$$
\begin{aligned}
{[\![\lambda x.\; x]\!]} &= \mathbf{I} \\
{[\![\lambda x.\; e]\!]} &= \mathbf{K}\; [\![e]\!] \quad \text{if } x \notin \text{FV}(e) \\
{[\![\lambda x.\; e_1\; e_2]\!]} &= \mathbf{S}\; [\![\lambda x.\; e_1]\!]\; [\![\lambda x.\; e_2]\!]
\end{aligned}
$$

### 9.2 Historical Note

Combinatory logic was invented by Schonfinkel (1924) and developed by Curry. It was used in early implementations of lazy functional languages (Turner's SASL, Miranda) before being superseded by the STG machine and graph reduction.

---

## 10. The Untyped Lambda Calculus as a Programming Language

### 10.1 Expressiveness

The untyped lambda calculus can express:
- All data types (via Church encodings)
- Recursion (via fixed-point combinators)
- All computable functions (Church-Turing thesis)

### 10.2 Limitations for Practical Use

1. No built-in data types (encodings are inefficient)
2. No type safety (stuck terms are possible: $0\; 1$)
3. No side effects
4. Equational reasoning is complex (undecidable in general)

These limitations motivate the **typed** lambda calculi studied in subsequent lectures.

---

## 11. Summary

| Concept | Key Point |
|---------|-----------|
| Lambda terms | Variables, abstraction, application |
| Beta-reduction | Function application = substitution |
| Alpha-equivalence | Renaming bound variables |
| Eta-reduction | Extensional equality of functions |
| Church-Rosser | Normal forms are unique (if they exist) |
| Church encodings | Data as functions |
| Y combinator | Recursion without built-in recursion |
| Strong normalization | All reductions terminate (STLC) |
| De Bruijn indices | Nameless representation of terms |

---

## References

1. Church, A. (1936). "An Unsolvable Problem of Elementary Number Theory." *American Journal of Mathematics*, 58(2), 345--363.
2. Church, A. (1941). *The Calculi of Lambda-Conversion*. Princeton University Press.
3. Barendregt, H.P. (1984). *The Lambda Calculus: Its Syntax and Semantics* (revised ed.). North-Holland.
4. de Bruijn, N.G. (1972). "Lambda Calculus Notation with Nameless Dummies." *Indagationes Mathematicae*, 34, 381--392.
5. Curry, H.B. & Feys, R. (1958). *Combinatory Logic*, Vol. I. North-Holland.
6. Tait, W.W. (1967). "Intensional Interpretations of Functionals of Finite Type I." *Journal of Symbolic Logic*, 32(2), 198--212.
7. Hindley, J.R. & Seldin, J.P. (2008). *Lambda-Calculus and Combinators: An Introduction* (2nd ed.). Cambridge.
