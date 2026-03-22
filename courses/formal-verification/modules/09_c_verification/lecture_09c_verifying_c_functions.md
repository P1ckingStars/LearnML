# Lecture 09c: Verifying C Functions End-to-End

> **Module 09 --- C Verification: Parser, AutoCorres & Proofs**
> Estimated study time: 8--10 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Verify a pure C function (no loops, no pointers) from C source to a proved Hoare triple.
2. Verify a C function with a `while` loop by providing a loop invariant and termination measure.
3. Verify a recursive C function by providing a termination argument.
4. Verify a C function that operates on arrays, including pointer validity preconditions.
5. Apply the standard proof pattern: unfold, wp, clarsimp/auto.
6. Debug failed verification proofs by examining AutoCorres output and strengthening invariants.

---

## 1. The Verification Workflow

### 1.1 The Standard Pattern

Verifying a C function with AutoCorres follows a consistent workflow:

1. **Parse**: `install_C_file "file.c"`
2. **Abstract**: `autocorres [options] "file.c"`
3. **Specify**: state the desired property as a theorem about the AutoCorres output.
4. **Prove**: unfold the AutoCorres definition, apply weakest precondition reasoning, and discharge the resulting proof obligations with auto/clarsimp.

The proof obligations are typically arithmetic or logical conditions that arise from the function's control flow.

### 1.2 Hoare Triples for AutoCorres Output

For functions in the `nondet` monad, specifications are typically Hoare triples:

```isabelle
"\<lbrace> P \<rbrace> f' x \<lbrace> \<lambda>rv s. Q rv s \<rbrace>!"
```

This reads: if precondition `P` holds in the initial state, then `f' x` does not fail (indicated by `!`) and every result `(rv, s)` satisfies postcondition `Q`.

For `pure` functions (after type strengthening), specifications are ordinary equalities:

```isabelle
"f' x = expected_result"
```

---

## 2. Example 1: The `max` Function (Pure, No Loops)

### 2.1 C Source

```c
/* max.c */
unsigned int max(unsigned int a, unsigned int b) {
    if (a > b) {
        return a;
    } else {
        return b;
    }
}
```

### 2.2 Setup

```isabelle
theory MaxVerify
  imports AutoCorres2.AutoCorres
begin

install_C_file "max.c"
autocorres [unsigned_word_abs = max] "max.c"
```

After AutoCorres with word abstraction, `max'` has the definition:

```isabelle
max' :: "nat \<Rightarrow> nat \<Rightarrow> nat"
"max' a b \<equiv> if a > b then a else b"
```

### 2.3 Specification and Proof

```isabelle
lemma max_correct:
  "max' a b = (if a > b then a else b)"
  by (simp add: max'_def)
```

This is trivially true by definition unfolding. For a more useful specification:

```isabelle
lemma max_ge_left: "max' a b \<ge> a"
  by (simp add: max'_def)

lemma max_ge_right: "max' a b \<ge> b"
  by (simp add: max'_def)

lemma max_is_arg: "max' a b = a \<or> max' a b = b"
  by (simp add: max'_def)

lemma max_greatest:
  "\<lbrakk> c \<ge> a; c \<ge> b \<rbrakk> \<Longrightarrow> c \<ge> max' a b"
  by (simp add: max'_def)
```

All of these follow by unfolding the definition and applying `simp`. The proofs are short because AutoCorres has done the hard work of abstracting away the C-level details.

---

## 3. Example 2: Factorial (Loop with Invariant)

### 3.1 C Source

```c
/* factorial.c */
unsigned int factorial(unsigned int n) {
    unsigned int result = 1;
    unsigned int i = 1;
    while (i <= n) {
        result = result * i;
        i = i + 1;
    }
    return result;
}
```

### 3.2 Setup

```isabelle
theory FactVerify
  imports AutoCorres2.AutoCorres
begin

install_C_file "factorial.c"
autocorres [unsigned_word_abs = factorial] "factorial.c"
```

After AutoCorres, the `while` loop becomes a `whileLoop` combinator in the nondet monad (or a recursive `WHILE` if type-strengthened). With word abstraction, the definition is approximately:

```isabelle
definition factorial' :: "nat \<Rightarrow> nat"
where
  "factorial' n \<equiv>
     let (result, i) = while (\<lambda>(result, i). i \<le> n) (\<lambda>(result, i). (result * i, i + 1)) (1, 1)
     in result"
```

The exact form depends on AutoCorres internals, but the key structure is a `while` with state `(result, i)`.

### 3.3 The Loop Invariant

To verify a loop, we must provide a *loop invariant*: a predicate that holds before the loop starts, is preserved by each iteration, and together with the loop's exit condition implies the desired postcondition.

For factorial, the invariant is:

$$\text{result} = (i - 1)! \quad \wedge \quad 1 \le i \quad \wedge \quad i \le n + 1$$

In Isabelle:

```isabelle
definition fact_inv :: "nat \<Rightarrow> nat \<times> nat \<Rightarrow> bool"
where
  "fact_inv n \<equiv> \<lambda>(result, i). result = fact (i - 1) \<and> 1 \<le> i \<and> i \<le> n + 1"
```

### 3.4 Proof Structure

The proof proceeds in three steps:

**Step 1: The invariant holds initially.**
When `result = 1` and `i = 1`, we need `1 = fact 0` (true) and `1 \<le> 1` and `1 \<le> n + 1` (both true).

**Step 2: The invariant is preserved by each iteration.**
Assuming `fact_inv n (result, i)` and the loop guard `i \<le> n`, we must show `fact_inv n (result * i, i + 1)`:
- `result * i = fact ((i + 1) - 1) = fact i`. By the inductive hypothesis, `result = fact (i - 1)`, so `result * i = fact (i - 1) * i = fact i`. This uses the recursive definition of factorial.
- `1 \<le> i + 1` is immediate.
- `i + 1 \<le> n + 1` follows from the guard `i \<le> n`.

**Step 3: The postcondition follows from the invariant and loop exit.**
When the loop exits, `\<not>(i \<le> n)`, i.e., `i > n`. Together with `i \<le> n + 1` from the invariant, we get `i = n + 1`. Then `result = fact (i - 1) = fact n`.

```isabelle
lemma factorial_correct:
  "factorial' n = fact n"
  unfolding factorial'_def
  apply (rule while_rule [where P = "fact_inv n" and r = "measure (\<lambda>(_, i). n + 1 - i)"])
     (* Invariant holds initially *)
     apply (simp add: fact_inv_def)
    (* Invariant preserved *)
    apply (clarsimp simp: fact_inv_def)
    apply (subgoal_tac "fact i = fact (i - 1) * i")
     apply simp
    apply (cases "i"; simp)
   (* Postcondition from invariant + exit *)
   apply (clarsimp simp: fact_inv_def)
  (* Termination: n + 1 - i decreases *)
  apply (clarsimp simp: fact_inv_def)
  done
```

### 3.5 Termination

The `while` combinator requires a termination argument: a *measure function* (also called a *variant*) that maps the loop state to a natural number and strictly decreases on each iteration. For factorial, the measure is `n + 1 - i`: since `i` increases by 1 each iteration and the loop exits when `i > n`, the measure decreases from `n` to `0`.

---

## 4. Example 3: GCD (Recursive Function)

### 4.1 C Source

```c
/* gcd.c */
unsigned int gcd(unsigned int a, unsigned int b) {
    if (b == 0) {
        return a;
    } else {
        return gcd(b, a % b);
    }
}
```

### 4.2 Setup

```isabelle
theory GCDVerify
  imports AutoCorres2.AutoCorres
begin

install_C_file "gcd.c"
autocorres [unsigned_word_abs = gcd] "gcd.c"
```

AutoCorres produces a recursive definition. With word abstraction:

```isabelle
fun gcd' :: "nat \<Rightarrow> nat \<Rightarrow> nat"
where
  "gcd' a b = (if b = 0 then a else gcd' b (a mod b))"
```

### 4.3 Partial Correctness

We prove that `gcd'` computes the mathematical GCD:

```isabelle
lemma gcd_correct:
  "gcd' a b = Euclidean_Algorithm.gcd a b"
proof (induction a b rule: gcd'.induct)
  case (1 a b)
  show ?case
  proof (cases "b = 0")
    case True
    then show ?thesis by simp
  next
    case False
    then have "gcd' a b = gcd' b (a mod b)" by simp
    also have "... = Euclidean_Algorithm.gcd b (a mod b)"
      using False 1 by simp
    also have "... = Euclidean_Algorithm.gcd a b"
      using False by (simp add: gcd_red_nat)
    finally show ?thesis .
  qed
qed
```

### 4.4 Termination

The recursive call `gcd(b, a % b)` terminates because `a mod b < b` when `b > 0`. AutoCorres needs this termination argument. If AutoCorres cannot prove termination automatically, the user must provide a measure:

```isabelle
function (domintros) gcd' :: "nat \<Rightarrow> nat \<Rightarrow> nat"
where
  "gcd' a b = (if b = 0 then a else gcd' b (a mod b))"
```

Then prove termination:

```isabelle
termination gcd'
  apply (relation "measure (\<lambda>(a, b). b)")
  apply simp
  apply (simp add: mod_less_divisor)
  done
```

The measure `b` strictly decreases with each recursive call because `a mod b < b`.

---

## 5. Example 4: Array Sum (Heap Operations)

### 5.1 C Source

```c
/* array_sum.c */
unsigned int array_sum(unsigned int *arr, unsigned int n) {
    unsigned int sum = 0;
    unsigned int i = 0;
    while (i < n) {
        sum = sum + arr[i];
        i = i + 1;
    }
    return sum;
}
```

### 5.2 Setup

```isabelle
theory ArraySumVerify
  imports AutoCorres2.AutoCorres
begin

install_C_file "array_sum.c"
autocorres [heap_abs_syntax, unsigned_word_abs = array_sum] "array_sum.c"
```

The `heap_abs_syntax` option provides nicer notation for heap operations. After AutoCorres with heap lifting, the function operates on a typed heap for `unsigned int`:

```isabelle
definition array_sum' ::
  "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> nat \<Rightarrow> (nat \<times> lifted_globals) set \<times> bool"
where
  "array_sum' s arr n \<equiv>
     do {
       (sum, i) \<leftarrow> whileLoop (\<lambda>(sum, i) _. i < n)
         (\<lambda>(sum, i). do {
            v \<leftarrow> gets (\<lambda>s. heap_unsigned s (arr +\<^sub>p int i));
            return (sum + v, i + 1)
          })
         (0, 0);
       return sum
     }"
```

### 5.3 Preconditions

Unlike pure functions, array functions require preconditions about memory validity:

1. **Array validity**: each element `arr[0]`, ..., `arr[n-1]` must be a valid pointer.
2. **No overflow**: the sum must not exceed `2^32 - 1` (if using word abstraction).

```isabelle
definition array_valid ::
  "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> nat \<Rightarrow> bool"
where
  "array_valid s arr n \<equiv>
     \<forall>i < n. is_valid_unsigned s (arr +\<^sub>p int i)"
```

### 5.4 Specification

The specification uses Isabelle's list summation:

```isabelle
definition array_values ::
  "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> nat \<Rightarrow> nat list"
where
  "array_values s arr n \<equiv> map (\<lambda>i. heap_unsigned s (arr +\<^sub>p int i)) [0..<n]"

lemma array_sum_correct:
  "\<lbrace> \<lambda>s. array_valid s arr n \<rbrace>
   array_sum' arr n
   \<lbrace> \<lambda>rv s. rv = sum_list (array_values s arr n) \<rbrace>!"
```

### 5.5 Proof

The proof requires a loop invariant that tracks the partial sum:

```isabelle
definition sum_inv ::
  "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> nat \<Rightarrow> nat \<times> nat \<Rightarrow> bool"
where
  "sum_inv s arr n \<equiv> \<lambda>(sum, i).
     i \<le> n \<and>
     sum = sum_list (map (\<lambda>j. heap_unsigned s (arr +\<^sub>p int j)) [0..<i]) \<and>
     array_valid s arr n"
```

The proof applies weakest precondition reasoning with the `whileLoop_wp` rule:

```isabelle
proof -
  apply (unfold array_sum'_def)
  apply (wp whileLoop_wp [where I = "\<lambda>(sum, i) s. sum_inv s arr n (sum, i)"
                            and M = "\<lambda>((sum, i), s). n - i"])
    (* Invariant preserved *)
    apply (clarsimp simp: sum_inv_def array_valid_def)
    apply (subgoal_tac "[0..<Suc i] = [0..<i] @ [i]")
     apply simp
    apply simp
   (* Postcondition from invariant + exit *)
   apply (clarsimp simp: sum_inv_def array_values_def)
  (* Invariant holds initially *)
  apply (clarsimp simp: sum_inv_def)
  done
qed
```

### 5.6 The `whileLoop_wp` Rule in Detail

The `whileLoop_wp` weakest-precondition rule is the primary tool for reasoning about loops in AutoCorres output. Its full invocation syntax is:

```isabelle
apply (wp whileLoop_wp [where I = "\<lambda>loop_var s. invariant_predicate"
                          and M = "\<lambda>(loop_var, s). measure_expression"])
```

The two arguments are:

**`I` (the loop invariant)**: A predicate `I :: 'a \<Rightarrow> 's \<Rightarrow> bool` where `'a` is the type of the loop-carried variable (often a tuple) and `'s` is the state type. The invariant must satisfy three conditions:

1. **Initialization**: `I` holds for the initial loop variable value in the initial state.
2. **Preservation**: if `I` holds and the loop guard is true, then after executing the loop body, `I` holds for the updated loop variable and state.
3. **Postcondition**: if `I` holds and the loop guard is false, the desired postcondition follows.

**`M` (the measure / variant)**: A function `M :: 'a \<times> 's \<Rightarrow> nat` that maps the loop variable and state to a natural number. This must strictly decrease on each iteration, proving termination. If the loop modifies only the loop-carried variables (not the state), the measure depends only on those variables.

The `whileLoop_wp` rule generates three proof obligations corresponding to the three conditions above, plus a fourth obligation that `M` decreases:

```isabelle
whileLoop_wp:
  "\<lbrakk> \<And>r s. \<lbrakk> I r s; C r s \<rbrakk> \<Longrightarrow> \<lbrace> \<lambda>s'. s' = s \<rbrace> B r \<lbrace> \<lambda>r' s'. I r' s' \<and> M (r', s') < M (r, s) \<rbrace>!;
     \<And>r s. \<lbrakk> I r s; \<not> C r s \<rbrakk> \<Longrightarrow> Q r s;
     I r0 s0
   \<rbrakk> \<Longrightarrow> \<lbrace> \<lambda>s. s = s0 \<rbrace> whileLoop C B r0 \<lbrace> Q \<rbrace>!"
```

Where `C` is the loop condition and `B` is the loop body.

**Common patterns for measures:**

- Counting up to `n`: `M = \<lambda>((_, i), s). n - i`
- Counting down from `n`: `M = \<lambda>((i, _), s). i`
- Multiple variables: `M = \<lambda>((a, b), s). f a + g b` (a sum that decreases)

**When `M` is omitted**: if you omit the `M` parameter, `whileLoop_wp` generates a partial correctness proof (the loop is correct *if* it terminates, but termination is not proved). This can be useful during proof development: get the invariant right first, then add the measure.

```isabelle
(* Partial correctness only --- no termination *)
apply (wp whileLoop_wp [where I = "\<lambda>(sum, i) s. sum_inv s arr n (sum, i)"])
```

The resulting Hoare triple uses `\<lbrace> P \<rbrace> f \<lbrace> Q \<rbrace>` (without `!`) instead of `\<lbrace> P \<rbrace> f \<lbrace> Q \<rbrace>!` (with `!`), meaning the function is allowed to diverge.

---

## 6. Example 5: Inter-Function Verification

### 6.1 Motivation

Real C programs consist of functions that call one another. To verify a caller, we need the callee's specification as a lemma, but we should not need to re-prove (or even re-examine) the callee's implementation. This is the essence of modular verification.

The proof pattern is:
1. Verify the callee in isolation, producing a Hoare triple or equality lemma.
2. When verifying the caller, use the callee's specification as a rewrite rule or wp rule.

### 6.2 C Source

```c
/* clamp.c */
unsigned max(unsigned a, unsigned b) {
    if (a > b) return a;
    else return b;
}

unsigned min(unsigned a, unsigned b) {
    if (a < b) return a;
    else return b;
}

unsigned clamp(unsigned x, unsigned lo, unsigned hi) {
    return min(max(x, lo), hi);
}
```

Here `clamp` calls both `max` and `min`. We want to verify that `clamp` returns a value in the range `[lo, hi]` (assuming `lo \<le> hi`).

### 6.3 Setup

```isabelle
theory ClampVerify
  imports AutoCorres2.AutoCorres
begin

install_C_file "clamp.c"
autocorres [unsigned_word_abs = max min clamp] "clamp.c"
```

After AutoCorres with word abstraction, the definitions are:

```isabelle
max' :: "nat \<Rightarrow> nat \<Rightarrow> nat"
"max' a b \<equiv> if a > b then a else b"

min' :: "nat \<Rightarrow> nat \<Rightarrow> nat"
"min' a b \<equiv> if a < b then a else b"

clamp' :: "nat \<Rightarrow> nat \<Rightarrow> nat \<Rightarrow> nat"
"clamp' x lo hi \<equiv> min' (max' x lo) hi"
```

Because all three functions are pure (no state, no heap), AutoCorres inlines the calls. The `clamp'` definition directly refers to `min'` and `max'`.

### 6.4 Step 1: Verify the Callees

First, we prove properties of `max'` and `min'`:

```isabelle
lemma max'_ge_left: "max' a b \<ge> a"
  by (simp add: max'_def)

lemma max'_ge_right: "max' a b \<ge> b"
  by (simp add: max'_def)

lemma min'_le_left: "min' a b \<le> a"
  by (simp add: min'_def)

lemma min'_le_right: "min' a b \<le> b"
  by (simp add: min'_def)
```

### 6.5 Step 2: Verify the Caller Using Callee Specifications

Now we verify `clamp'` using the callee lemmas:

```isabelle
lemma clamp_lower_bound:
  "lo \<le> hi \<Longrightarrow> clamp' x lo hi \<ge> lo"
  unfolding clamp'_def
  apply (rule order_trans [OF max'_ge_right])
  apply (rule min'_le_left)
  done

lemma clamp_upper_bound:
  "lo \<le> hi \<Longrightarrow> clamp' x lo hi \<le> hi"
  unfolding clamp'_def
  by (rule min'_le_right)

lemma clamp_in_range:
  "lo \<le> hi \<Longrightarrow> lo \<le> clamp' x lo hi \<and> clamp' x lo hi \<le> hi"
  using clamp_lower_bound clamp_upper_bound by blast
```

The key insight: we used `max'_ge_right` and `min'_le_left`/`min'_le_right` without unfolding the definitions of `max'` and `min'`. We treated the callees as black boxes with known specifications. In a large verification, this modularity is essential --- we verify each function once and reuse its specification everywhere it is called.

### 6.6 The Monadic Case: Functions with Side Effects

When the caller and callee are in the `nondet` monad (because they access global state or the heap), the pattern uses `wp` with the callee's Hoare triple:

```c
/* stateful_clamp.c */
unsigned hi_bound;

unsigned get_hi(void) {
    return hi_bound;
}

unsigned clamp_to_hi(unsigned x) {
    unsigned h = get_hi();
    if (x > h) return h;
    return x;
}
```

After AutoCorres, `get_hi'` is in the `gets` monad (reads global state) and `clamp_to_hi'` is in the `nondet` monad. The verification pattern:

```isabelle
(* Step 1: Verify the callee *)
lemma get_hi_correct:
  "\<lbrace> \<lambda>s. True \<rbrace> get_hi' \<lbrace> \<lambda>rv s. rv = hi_bound_' (globals s) \<rbrace>!"
  unfolding get_hi'_def
  by wp

(* Step 2: Verify the caller, using the callee's lemma *)
lemma clamp_to_hi_correct:
  "\<lbrace> \<lambda>s. True \<rbrace>
   clamp_to_hi' x
   \<lbrace> \<lambda>rv s. rv \<le> hi_bound_' (globals s) \<rbrace>!"
  unfolding clamp_to_hi'_def
  apply (wp get_hi_correct)   (* use the callee's Hoare triple *)
  apply clarsimp
  done
```

The `wp` tactic, when given `get_hi_correct` as an argument, uses it as a weakest-precondition rule for the call to `get_hi'`. This transforms the proof obligation from "reason about `get_hi'`'s implementation" to "reason about `get_hi'`'s specification." The callee's implementation is never unfolded in the caller's proof.

**General pattern for monadic inter-function verification:**

```isabelle
(* 1. Prove callee correct *)
lemma callee_spec:
  "\<lbrace> P_callee \<rbrace> callee' args \<lbrace> Q_callee \<rbrace>!"

(* 2. Prove caller correct using callee's spec *)
lemma caller_correct:
  "\<lbrace> P_caller \<rbrace> caller' args \<lbrace> Q_caller \<rbrace>!"
  unfolding caller'_def
  apply (wp callee_spec)    (* callee becomes a black box *)
  apply clarsimp
  (* ... discharge remaining proof obligations ... *)
  done
```

This scales to any call depth: if `f` calls `g` which calls `h`, verify `h` first, then use `h`'s spec when verifying `g`, then use `g`'s spec when verifying `f`.

---

## 7. Common Proof Patterns

### 7.1 The Unfold-WP-Clarsimp Pattern

The most common proof pattern for AutoCorres verifications:

```isabelle
lemma my_lemma:
  "\<lbrace> P \<rbrace> f' x \<lbrace> Q \<rbrace>!"
  unfolding f'_def           (* expose the AutoCorres definition *)
  apply wp                    (* apply weakest precondition rules *)
  apply clarsimp              (* simplify the resulting obligations *)
  done
```

For pure functions, replace `wp` with `simp`:

```isabelle
lemma my_lemma:
  "f' x = y"
  unfolding f'_def
  by simp
```

### 7.2 Word Arithmetic Simp Rules

When reasoning about machine words (without word abstraction), useful simp rules include:

```isabelle
word_bits_def       (* word size constants *)
unat_of_nat         (* unat (of_nat n) = n mod 2^len *)
unat_add_lem        (* conditions for overflow-free addition *)
word_less_nat_alt   (* word comparison via unat *)
uint_word_ariths    (* arithmetic on word values *)
```

### 7.3 Handling Unsigned Overflow

With word abstraction, overflow becomes a precondition. Without word abstraction, overflow is modular:

```isabelle
(* With word abstraction, must prove: *)
"a + b < 2^32"

(* Without word abstraction, arithmetic wraps: *)
"(a :: 32 word) + b = of_nat ((unat a + unat b) mod 2^32)"
```

### 7.4 Pointer Validity Predicates

For heap-lifted functions, common predicates:

```isabelle
is_valid_w32       :: "lifted_globals \<Rightarrow> 32 word ptr \<Rightarrow> bool"
is_valid_point_C   :: "lifted_globals \<Rightarrow> point_C ptr \<Rightarrow> bool"
```

These appear as preconditions and are threaded through the proof.

---

## 8. Debugging Failed Proofs

### 8.1 Examining AutoCorres Output

When a proof fails, the first step is to understand exactly what AutoCorres produced:

```isabelle
thm myfile.f'_def    (* see the definition *)
term "f'"            (* see the type *)
```

Common surprises:

- The function was classified as `nondet` when you expected `pure`. Check for global variable access or heap operations.
- Word abstraction was not applied. Check that the function is listed in `unsigned_word_abs` or `signed_word_abs`.
- The definition looks different from what you expected. The C code may have been parsed differently than you thought.

### 8.2 Identifying Missing Preconditions

If `wp` produces unprovable subgoals, you likely need a stronger precondition. Common missing preconditions:

- Pointer validity for a dereferenced pointer.
- Array bounds for an indexed access.
- Non-zero divisor for a division operation.
- Overflow bounds for word-abstracted arithmetic.

### 8.3 Strengthening Loop Invariants

If the loop invariant is too weak:

- The preservation step fails because the invariant does not imply the needed facts after the loop body.
- The postcondition step fails because the invariant plus the exit condition does not imply the desired result.

Common fixes:

- Add bounds on the loop counter (`i \<le> n`).
- Add the loop's own preconditions to the invariant (they are needed after each iteration).
- Add preservation of validity predicates (the heap does not change in a read-only loop, but you must state this).

### 8.4 Using `sorry` Strategically

During development, use `sorry` to skip subgoals and focus on the proof structure:

```isabelle
lemma my_lemma:
  "\<lbrace> P \<rbrace> f' x \<lbrace> Q \<rbrace>!"
  unfolding f'_def
  apply wp
  apply clarsimp
  sorry  (* come back to this later *)
```

This lets you check that the overall proof strategy is correct before tackling individual arithmetic obligations. Remember to remove all `sorry` before the proof is final.

---

## 9. Exercises

### Theory

**Exercise 9c.1.** Explain why a loop invariant must include the loop's preconditions, not just facts about the loop variables. Give a concrete example where omitting a precondition from the invariant causes the proof to fail.

**Exercise 9c.2.** For the array sum example, explain why `array_valid` must appear in the loop invariant even though the loop does not modify the heap. What would go wrong without it?

**Exercise 9c.3.** The GCD termination proof uses the measure `b`. Explain why `a + b` would also be a valid measure. Is there a case where `a + b` works but `b` does not?

### Isabelle

**Exercise 9c.4.** Verify the following C function end-to-end:
```c
unsigned int clamp(unsigned int x, unsigned int lo, unsigned int hi) {
    if (x < lo) return lo;
    if (x > hi) return hi;
    return x;
}
```
Prove that `lo \<le> clamp' x lo hi` and `clamp' x lo hi \<le> hi` (assuming `lo \<le> hi`).

**Exercise 9c.5.** Verify a `linear_search` function:
```c
unsigned int linear_search(unsigned int *arr, unsigned int n, unsigned int key) {
    unsigned int i = 0;
    while (i < n) {
        if (arr[i] == key) return i;
        i = i + 1;
    }
    return n;  /* not found */
}
```
State and prove: if the function returns `i < n`, then `arr[i] == key`. If it returns `n`, then `key` does not appear in `arr[0..n-1]`.

**Exercise 9c.6.** Verify a `power` function that computes `base^exp` using a loop. Provide the loop invariant and termination measure.

**Exercise 9c.7.** Verify `bubble_sort_pass`: a single pass of bubble sort over an array. Prove that after the pass, the maximum element is in the last position (partial specification).

---

## References

- Greenaway, D., Lim, J., Andronick, J., Klein, G. "Don't Sweat the Small Stuff: Formal Verification of C Code Without the Pain." *PLDI*, 2014.
- Klein, G., Andronick, J., Elphinstone, K., et al. "Comprehensive Formal Verification of an OS Microkernel." *ACM TOCS*, 32(1), 2014.
- The AutoCorres2 examples in the l4v repository: `tools/autocorres/tests/examples/`.

---

*Next: [Lecture 09d: Memory Models & Separation Logic](lecture_09d_memory_model_separation_logic.md)*
