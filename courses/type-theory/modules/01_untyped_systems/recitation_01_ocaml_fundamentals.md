---
title: "Recitation 01: OCaml Fundamentals"
tags:
  - type-theory
  - untyped
  - recitation
---
# Recitation 01: OCaml Fundamentals

## Overview

This recitation is a hands-on guide to OCaml, the implementation language for this course. Every code block is complete and runnable. By the end, you will have implemented a small-step evaluator for arithmetic expressions and a substitution-based beta-reducer for the untyped lambda calculus.

**Prerequisites:** Basic programming experience in any language, Lectures 01a and 01b.

---

## 1. OCaml Basics

### 1.1 The REPL (utop)

Install OCaml and utop via opam:

```bash
opam install utop
utop
```

In utop, expressions are terminated with `;;`:

```ocaml
# 1 + 2;;
- : int = 3

# "hello" ^ " " ^ "world";;
- : string = "hello world"

# 3.14 *. 2.0;;
- : float = 6.28
```

OCaml has distinct operators for integer and floating-point arithmetic: `+`, `-`, `*`, `/` for integers; `+.`, `-.`, `*.`, `/.` for floats. Mixing them is a type error.

### 1.2 Let Bindings

```ocaml
(* Immutable bindings *)
let x = 42
let y = x + 1    (* y = 43 *)

(* Local bindings with let...in *)
let result =
  let a = 10 in
  let b = 20 in
  a + b           (* result = 30 *)

(* Recursive bindings require 'let rec' *)
let rec factorial n =
  if n = 0 then 1
  else n * factorial (n - 1)

(* Mutually recursive bindings *)
let rec is_even n =
  if n = 0 then true else is_odd (n - 1)
and is_odd n =
  if n = 0 then false else is_even (n - 1)
```

### 1.3 Functions

```ocaml
(* Functions are first-class values *)
let double x = x * 2
let add x y = x + y

(* Anonymous functions (lambdas) *)
let triple = fun x -> x * 3

(* Partial application (currying) *)
let add5 = add 5        (* add5 : int -> int *)
let _ = add5 3           (* 8 *)

(* Function composition *)
let compose f g x = f (g x)
let double_then_add5 = compose add5 double
let _ = double_then_add5 3   (* double 3 = 6, add5 6 = 11 *)

(* Higher-order functions *)
let apply_twice f x = f (f x)
let _ = apply_twice double 3  (* double (double 3) = double 6 = 12 *)
```

### 1.4 Algebraic Data Types (ADTs)

Algebraic data types are the core mechanism for defining structured data in OCaml. They will be our primary tool for representing abstract syntax trees.

```ocaml
(* Sum type (tagged union) *)
type color = Red | Green | Blue

(* Sum type with data *)
type shape =
  | Circle of float              (* radius *)
  | Rectangle of float * float   (* width, height *)
  | Triangle of float * float * float  (* three sides *)

(* Recursive type *)
type int_list =
  | Nil
  | Cons of int * int_list

let my_list = Cons (1, Cons (2, Cons (3, Nil)))

(* Parameterized (polymorphic) type *)
type 'a list =
  | Nil
  | Cons of 'a * 'a list

(* Option type (built-in) *)
(* type 'a option = None | Some of 'a *)

(* Binary tree *)
type 'a tree =
  | Leaf
  | Node of 'a tree * 'a * 'a tree
```

### 1.5 Pattern Matching

Pattern matching is OCaml's most important control structure. It is exhaustive (the compiler warns about unhandled cases) and can destructure nested data.

```ocaml
let area = function
  | Circle r -> Float.pi *. r *. r
  | Rectangle (w, h) -> w *. h
  | Triangle (a, b, c) ->
    let s = (a +. b +. c) /. 2.0 in
    Float.sqrt (s *. (s -. a) *. (s -. b) *. (s -. c))

(* Nested patterns *)
let rec length = function
  | Nil -> 0
  | Cons (_, rest) -> 1 + length rest

(* Guards *)
let classify n =
  match n with
  | 0 -> "zero"
  | n when n > 0 -> "positive"
  | _ -> "negative"

(* Matching multiple values *)
let xor a b =
  match (a, b) with
  | (true, false) | (false, true) -> true
  | _ -> false

(* As-patterns *)
let rec insert x = function
  | Nil -> Cons (x, Nil)
  | Cons (y, _) as lst when x <= y -> Cons (x, lst)
  | Cons (y, rest) -> Cons (y, insert x rest)
```

### 1.6 Records and Modules

```ocaml
(* Records *)
type point = { x : float; y : float }

let origin = { x = 0.0; y = 0.0 }
let p = { x = 3.0; y = 4.0 }
let dist p = Float.sqrt (p.x *. p.x +. p.y *. p.y)

(* Module signatures and structures *)
module type STACK = sig
  type 'a t
  val empty : 'a t
  val push : 'a -> 'a t -> 'a t
  val pop : 'a t -> ('a * 'a t) option
end

module ListStack : STACK = struct
  type 'a t = 'a list
  let empty = []
  let push x s = x :: s
  let pop = function
    | [] -> None
    | x :: rest -> Some (x, rest)
end
```

---

## 2. Implementing Arithmetic Expressions

### 2.1 The AST

We define the abstract syntax tree for the arithmetic expression language from Lecture 01a.

```ocaml
(* Abstract syntax tree for arithmetic expressions *)
type term =
  | TmTrue                              (* true *)
  | TmFalse                             (* false *)
  | TmIf of term * term * term          (* if t1 then t2 else t3 *)
  | TmZero                              (* 0 *)
  | TmSucc of term                      (* succ t *)
  | TmPred of term                      (* pred t *)
  | TmIsZero of term                    (* iszero t *)
```

### 2.2 Recognizing Values

```ocaml
(* Check if a term is a numeric value *)
let rec is_numeric_val = function
  | TmZero -> true
  | TmSucc t -> is_numeric_val t
  | _ -> false

(* Check if a term is a value *)
let is_val = function
  | TmTrue -> true
  | TmFalse -> true
  | t -> is_numeric_val t
```

### 2.3 Small-Step Evaluator

The evaluator implements the evaluation rules from Lecture 01a. We use an exception to signal that a term is in normal form (no rule applies).

```ocaml
(* Exception raised when no evaluation rule applies *)
exception NoRuleApplies

(* Single-step evaluation *)
let rec eval1 = function
  (* E-IfTrue *)
  | TmIf (TmTrue, t2, _) -> t2
  (* E-IfFalse *)
  | TmIf (TmFalse, _, t3) -> t3
  (* E-If: evaluate the guard *)
  | TmIf (t1, t2, t3) ->
    let t1' = eval1 t1 in
    TmIf (t1', t2, t3)
  (* E-Succ: evaluate under succ *)
  | TmSucc t1 ->
    let t1' = eval1 t1 in
    TmSucc t1'
  (* E-PredZero *)
  | TmPred TmZero -> TmZero
  (* E-PredSucc *)
  | TmPred (TmSucc nv1) when is_numeric_val nv1 -> nv1
  (* E-Pred: evaluate under pred *)
  | TmPred t1 ->
    let t1' = eval1 t1 in
    TmPred t1'
  (* E-IszeroZero *)
  | TmIsZero TmZero -> TmTrue
  (* E-IszeroSucc *)
  | TmIsZero (TmSucc nv1) when is_numeric_val nv1 -> TmFalse
  (* E-Iszero: evaluate under iszero *)
  | TmIsZero t1 ->
    let t1' = eval1 t1 in
    TmIsZero t1'
  (* No rule applies *)
  | _ -> raise NoRuleApplies

(* Multi-step evaluation: iterate until stuck *)
let rec eval t =
  try
    let t' = eval1 t in
    eval t'
  with NoRuleApplies -> t
```

### 2.4 Pretty-Printing

```ocaml
let rec string_of_term = function
  | TmTrue -> "true"
  | TmFalse -> "false"
  | TmIf (t1, t2, t3) ->
    Printf.sprintf "if %s then %s else %s"
      (string_of_term t1) (string_of_term t2) (string_of_term t3)
  | TmZero -> "0"
  | TmSucc t ->
    (* Pretty-print numeric values as decimal numbers *)
    let rec to_int = function
      | TmZero -> Some 0
      | TmSucc t -> (match to_int t with Some n -> Some (n + 1) | None -> None)
      | _ -> None
    in
    (match to_int (TmSucc t) with
     | Some n -> string_of_int n
     | None -> Printf.sprintf "(succ %s)" (string_of_term t))
  | TmPred t -> Printf.sprintf "(pred %s)" (string_of_term t)
  | TmIsZero t -> Printf.sprintf "(iszero %s)" (string_of_term t)
```

### 2.5 Testing

```ocaml
(* Test: if (iszero (pred (succ 0))) then 0 else (succ 0) *)
let test1 =
  TmIf (
    TmIsZero (TmPred (TmSucc TmZero)),
    TmZero,
    TmSucc TmZero
  )

let () =
  Printf.printf "Expression: %s\n" (string_of_term test1);
  let result = eval test1 in
  Printf.printf "Result:     %s\n\n" (string_of_term result)

(* Test: succ (if true then false else 0) -- gets stuck! *)
let test2 =
  TmSucc (TmIf (TmTrue, TmFalse, TmZero))

let () =
  Printf.printf "Expression: %s\n" (string_of_term test2);
  let result = eval test2 in
  Printf.printf "Result:     %s\n" (string_of_term result);
  Printf.printf "Is value?   %b\n\n" (is_val result)

(* Trace evaluation: print each step *)
let rec eval_trace t =
  Printf.printf "  --> %s\n" (string_of_term t);
  try
    let t' = eval1 t in
    eval_trace t'
  with NoRuleApplies ->
    Printf.printf "  (normal form)\n"

let () =
  Printf.printf "Trace of test1:\n";
  eval_trace test1
```

Expected output:

```
Expression: if (iszero (pred (succ 0))) then 0 else 1
Result:     0

Expression: (succ if true then false else 0)
Result:     (succ false)
Is value?   false

Trace of test1:
  --> if (iszero (pred (succ 0))) then 0 else 1
  --> if (iszero 0) then 0 else 1
  --> if true then 0 else 1
  --> 0
  (normal form)
```

### 2.6 Big-Step Evaluator

```ocaml
(* Big-step evaluation *)
exception TypeError of string

let rec eval_big = function
  | TmTrue -> TmTrue
  | TmFalse -> TmFalse
  | TmZero -> TmZero
  | TmSucc t ->
    let v = eval_big t in
    if is_numeric_val v then TmSucc v
    else raise (TypeError "succ of non-numeric value")
  | TmPred t ->
    (match eval_big t with
     | TmZero -> TmZero
     | TmSucc nv when is_numeric_val nv -> nv
     | _ -> raise (TypeError "pred of non-numeric value"))
  | TmIsZero t ->
    (match eval_big t with
     | TmZero -> TmTrue
     | TmSucc nv when is_numeric_val nv -> TmFalse
     | _ -> raise (TypeError "iszero of non-numeric value"))
  | TmIf (t1, t2, t3) ->
    (match eval_big t1 with
     | TmTrue -> eval_big t2
     | TmFalse -> eval_big t3
     | _ -> raise (TypeError "non-boolean guard"))
```

---

## 3. The Lambda Calculus AST

### 3.1 Named Representation

```ocaml
(* Lambda calculus terms with named variables *)
type lterm =
  | LVar of string                    (* variable: x *)
  | LAbs of string * lterm            (* abstraction: \x. t *)
  | LApp of lterm * lterm             (* application: t1 t2 *)
```

### 3.2 Pretty-Printing Lambda Terms

```ocaml
let rec string_of_lterm = function
  | LVar x -> x
  | LAbs (x, body) ->
    Printf.sprintf "(\\%s. %s)" x (string_of_lterm body)
  | LApp (t1, t2) ->
    Printf.sprintf "(%s %s)" (string_of_lterm t1) (string_of_lterm t2)
```

### 3.3 Free Variables

```ocaml
module StringSet = Set.Make(String)

(* Compute the set of free variables *)
let rec free_vars = function
  | LVar x -> StringSet.singleton x
  | LAbs (x, body) -> StringSet.remove x (free_vars body)
  | LApp (t1, t2) -> StringSet.union (free_vars t1) (free_vars t2)

(* Check if a term is closed (no free variables) *)
let is_closed t = StringSet.is_empty (free_vars t)
```

### 3.4 Fresh Variable Generation

```ocaml
(* Generate a fresh variable name not in the given set *)
let fresh_var (avoid : StringSet.t) (base : string) : string =
  if not (StringSet.mem base avoid) then base
  else
    let rec try_name n =
      let candidate = Printf.sprintf "%s%d" base n in
      if StringSet.mem candidate avoid then try_name (n + 1)
      else candidate
    in
    try_name 0
```

### 3.5 Capture-Avoiding Substitution

This is the most delicate part of the implementation. We follow the definition from Lecture 01b exactly.

```ocaml
(* Capture-avoiding substitution: [x |-> s] t *)
let rec subst (x : string) (s : lterm) (t : lterm) : lterm =
  match t with
  (* [x |-> s] x = s *)
  | LVar y when y = x -> s
  (* [x |-> s] y = y  (y != x) *)
  | LVar y -> LVar y
  (* [x |-> s] (t1 t2) = ([x |-> s] t1) ([x |-> s] t2) *)
  | LApp (t1, t2) -> LApp (subst x s t1, subst x s t2)
  (* [x |-> s] (\x. t) = \x. t  (x is rebound) *)
  | LAbs (y, body) when y = x -> LAbs (y, body)
  (* [x |-> s] (\y. t) = \y. [x |-> s] t  if y not in FV(s) *)
  | LAbs (y, body) when not (StringSet.mem y (free_vars s)) ->
    LAbs (y, subst x s body)
  (* [x |-> s] (\y. t) = \z. [x |-> s] [y |-> z] t  if y in FV(s) *)
  | LAbs (y, body) ->
    let all_vars = StringSet.union
      (StringSet.union (free_vars s) (free_vars body))
      (StringSet.singleton x) in
    let z = fresh_var all_vars y in
    let body' = subst y (LVar z) body in
    LAbs (z, subst x s body')
```

### 3.6 Testing Substitution

```ocaml
let () =
  (* [x |-> y] (\y. x)  should alpha-rename to avoid capture *)
  let t = LAbs ("y", LVar "x") in
  let result = subst "x" (LVar "y") t in
  Printf.printf "[x |-> y] (\\y. x) = %s\n" (string_of_lterm result);
  (* Expected: (\y0. y) or similar -- NOT (\y. y) *)

  (* [x |-> (\\z. z)] (\y. x y)  -- no capture needed *)
  let t2 = LAbs ("y", LApp (LVar "x", LVar "y")) in
  let s2 = LAbs ("z", LVar "z") in
  let result2 = subst "x" s2 t2 in
  Printf.printf "[x |-> (\\z. z)] (\\y. x y) = %s\n"
    (string_of_lterm result2);
  (* Expected: (\y. (\z. z) y) *)

  (* [x |-> y z] (\y. \z. x) -- must rename both y and z *)
  let t3 = LAbs ("y", LAbs ("z", LVar "x")) in
  let s3 = LApp (LVar "y", LVar "z") in
  let result3 = subst "x" s3 t3 in
  Printf.printf "[x |-> y z] (\\y. \\z. x) = %s\n"
    (string_of_lterm result3)
  (* Expected: (\y0. \z0. y z) or similar *)
```

---

## 4. Beta-Reduction

### 4.1 Small-Step Beta-Reduction (Full)

```ocaml
(* Full beta-reduction: reduce any redex anywhere *)
let rec beta_reduce_full = function
  (* Beta rule: (\x. t) s -> [x |-> s] t *)
  | LApp (LAbs (x, body), s) ->
    subst x s body
  (* Reduce under lambda *)
  | LAbs (x, body) ->
    (try LAbs (x, beta_reduce_full body)
     with NoRuleApplies -> raise NoRuleApplies)
  (* Reduce in function position *)
  | LApp (t1, t2) ->
    (try LApp (beta_reduce_full t1, t2)
     with NoRuleApplies ->
       try LApp (t1, beta_reduce_full t2)
       with NoRuleApplies -> raise NoRuleApplies)
  | LVar _ -> raise NoRuleApplies
```

### 4.2 Call-by-Value Evaluation

```ocaml
(* Check if a lambda term is a value (under CBV) *)
let is_lval = function
  | LAbs _ -> true
  | _ -> false

(* Call-by-value evaluation *)
let rec cbv_eval1 = function
  (* E-BetaV: (\x. t) v -> [x |-> v] t, where v is a value *)
  | LApp (LAbs (x, body), v) when is_lval v ->
    subst x v body
  (* E-App2V: v t2 -> v t2', evaluate argument when function is a value *)
  | LApp (v, t2) when is_lval v ->
    let t2' = cbv_eval1 t2 in
    LApp (v, t2')
  (* E-App1: t1 t2 -> t1' t2, evaluate function first *)
  | LApp (t1, t2) ->
    let t1' = cbv_eval1 t1 in
    LApp (t1', t2)
  (* No rule applies *)
  | _ -> raise NoRuleApplies

(* Multi-step CBV evaluation *)
let rec cbv_eval t =
  try
    let t' = cbv_eval1 t in
    cbv_eval t'
  with NoRuleApplies -> t
```

### 4.3 Call-by-Name Evaluation

```ocaml
(* Call-by-name evaluation *)
let rec cbn_eval1 = function
  (* E-BetaN: (\x. t) s -> [x |-> s] t, no restriction on s *)
  | LApp (LAbs (x, body), s) ->
    subst x s body
  (* E-App1: t1 t2 -> t1' t2, evaluate function only *)
  | LApp (t1, t2) ->
    let t1' = cbn_eval1 t1 in
    LApp (t1', t2)
  (* No rule applies *)
  | _ -> raise NoRuleApplies

(* Multi-step CBN evaluation *)
let rec cbn_eval t =
  try
    let t' = cbn_eval1 t in
    cbn_eval t'
  with NoRuleApplies -> t
```

### 4.4 Testing Beta-Reduction

```ocaml
(* Identity: \x. x *)
let id_term = LAbs ("x", LVar "x")

(* Church booleans *)
let tru = LAbs ("t", LAbs ("f", LVar "t"))
let fls = LAbs ("t", LAbs ("f", LVar "f"))

(* Church numerals *)
let c0 = LAbs ("s", LAbs ("z", LVar "z"))
let c1 = LAbs ("s", LAbs ("z", LApp (LVar "s", LVar "z")))
let c2 = LAbs ("s", LAbs ("z",
  LApp (LVar "s", LApp (LVar "s", LVar "z"))))

(* Successor *)
let scc = LAbs ("n", LAbs ("s", LAbs ("z",
  LApp (LVar "s",
    LApp (LApp (LVar "n", LVar "s"), LVar "z")))))

(* Test: scc c1 should evaluate to c2 *)
let () =
  let expr = LApp (scc, c1) in
  Printf.printf "\nExpression: %s\n" (string_of_lterm expr);
  let result = cbv_eval expr in
  Printf.printf "CBV result: %s\n" (string_of_lterm result)

(* Test: (\x. \y. x) applied to id and tru *)
let () =
  let k_comb = LAbs ("x", LAbs ("y", LVar "x")) in
  let expr = LApp (LApp (k_comb, id_term), tru) in
  Printf.printf "\nExpression: %s\n" (string_of_lterm expr);
  let result = cbv_eval expr in
  Printf.printf "CBV result: %s\n" (string_of_lterm result)

(* Test: CBN can handle divergent arguments *)
let () =
  let omega = LApp (LAbs ("x", LApp (LVar "x", LVar "x")),
                     LAbs ("x", LApp (LVar "x", LVar "x"))) in
  let k_true = LAbs ("x", tru) in
  let expr = LApp (k_true, omega) in
  Printf.printf "\nExpression: %s\n" (string_of_lterm expr);
  let result = cbn_eval expr in
  Printf.printf "CBN result: %s\n" (string_of_lterm result)
  (* Note: cbv_eval on this expression would loop forever! *)
```

---

## 5. Evaluation with Tracing

### 5.1 Step-by-Step Tracer

```ocaml
(* Trace CBV evaluation, printing each step *)
let cbv_eval_trace t =
  let step = ref 0 in
  let rec go t =
    Printf.printf "  [%d] %s\n" !step (string_of_lterm t);
    try
      let t' = cbv_eval1 t in
      incr step;
      go t'
    with NoRuleApplies ->
      Printf.printf "  (normal form after %d steps)\n" !step
  in
  go t

(* Trace with a step limit to handle potential divergence *)
let cbv_eval_trace_bounded max_steps t =
  let rec go n t =
    if n >= max_steps then
      Printf.printf "  [%d] %s\n  (step limit reached)\n" n
        (string_of_lterm t)
    else begin
      Printf.printf "  [%d] %s\n" n (string_of_lterm t);
      try
        let t' = cbv_eval1 t in
        go (n + 1) t'
      with NoRuleApplies ->
        Printf.printf "  (normal form after %d steps)\n" n
    end
  in
  go 0 t

let () =
  Printf.printf "\nTracing (\\f. f (\\x. x)) (\\y. y):\n";
  cbv_eval_trace
    (LApp (
      LAbs ("f", LApp (LVar "f", LAbs ("x", LVar "x"))),
      LAbs ("y", LVar "y")))
```

---

## 6. De Bruijn Index Representation

### 6.1 AST with De Bruijn Indices

```ocaml
(* Nameless lambda terms using de Bruijn indices *)
type db_term =
  | DBVar of int                     (* de Bruijn index *)
  | DBAbs of db_term                 (* abstraction (no variable name) *)
  | DBApp of db_term * db_term       (* application *)
```

### 6.2 Shifting

```ocaml
(* Shift: increase free variable indices by d, above cutoff c *)
let rec shift d c = function
  | DBVar k -> if k >= c then DBVar (k + d) else DBVar k
  | DBAbs t -> DBAbs (shift d (c + 1) t)
  | DBApp (t1, t2) -> DBApp (shift d c t1, shift d c t2)
```

### 6.3 Substitution on De Bruijn Terms

```ocaml
(* Substitution: [j |-> s] t *)
let rec db_subst j s = function
  | DBVar k -> if k = j then s else DBVar k
  | DBAbs t -> DBAbs (db_subst (j + 1) (shift 1 0 s) t)
  | DBApp (t1, t2) -> DBApp (db_subst j s t1, db_subst j s t2)

(* Beta-reduction for de Bruijn terms *)
(* (\. t) s  -->  shift(-1, 0, [0 |-> shift(1, 0, s)] t) *)
let db_beta_reduce body arg =
  shift (-1) 0 (db_subst 0 (shift 1 0 arg) body)
```

### 6.4 Evaluation with De Bruijn Indices

```ocaml
(* CBV evaluation for de Bruijn terms *)
let is_db_val = function
  | DBAbs _ -> true
  | _ -> false

let rec db_cbv_eval1 = function
  | DBApp (DBAbs body, v) when is_db_val v ->
    db_beta_reduce body v
  | DBApp (v, t2) when is_db_val v ->
    let t2' = db_cbv_eval1 t2 in
    DBApp (v, t2')
  | DBApp (t1, t2) ->
    let t1' = db_cbv_eval1 t1 in
    DBApp (t1', t2)
  | _ -> raise NoRuleApplies

let rec db_cbv_eval t =
  try
    let t' = db_cbv_eval1 t in
    db_cbv_eval t'
  with NoRuleApplies -> t

(* Pretty-printing de Bruijn terms *)
let rec string_of_db_term = function
  | DBVar n -> string_of_int n
  | DBAbs t -> Printf.sprintf "(\\. %s)" (string_of_db_term t)
  | DBApp (t1, t2) ->
    Printf.sprintf "(%s %s)" (string_of_db_term t1) (string_of_db_term t2)
```

### 6.5 Conversion Between Named and Nameless

```ocaml
(* A naming context maps variable names to de Bruijn indices *)
type naming_ctx = string list

(* Find index of a variable name in the context *)
let rec name_to_index ctx x =
  match ctx with
  | [] -> failwith (Printf.sprintf "Unbound variable: %s" x)
  | y :: rest -> if y = x then 0 else 1 + name_to_index rest x

(* Convert named term to de Bruijn representation *)
let rec to_debruijn ctx = function
  | LVar x -> DBVar (name_to_index ctx x)
  | LAbs (x, body) -> DBAbs (to_debruijn (x :: ctx) body)
  | LApp (t1, t2) -> DBApp (to_debruijn ctx t1, to_debruijn ctx t2)

(* Convert de Bruijn term back to named representation *)
let rec from_debruijn ctx = function
  | DBVar n ->
    if n < List.length ctx then LVar (List.nth ctx n)
    else LVar (Printf.sprintf "free_%d" (n - List.length ctx))
  | DBAbs t ->
    let names_in_use = StringSet.of_list ctx in
    let x = fresh_var names_in_use "x" in
    LAbs (x, from_debruijn (x :: ctx) t)
  | DBApp (t1, t2) ->
    LApp (from_debruijn ctx t1, from_debruijn ctx t2)
```

### 6.6 Testing De Bruijn Operations

```ocaml
let () =
  Printf.printf "\n--- De Bruijn Tests ---\n";

  (* \x. x  -->  \. 0 *)
  let id_db = to_debruijn [] id_term in
  Printf.printf "id = %s\n" (string_of_db_term id_db);

  (* \x. \y. x  -->  \. \. 1 *)
  let k_db = to_debruijn [] tru in
  Printf.printf "K  = %s\n" (string_of_db_term k_db);

  (* \x. \y. x y  -->  \. \. 1 0 *)
  let t = LAbs ("x", LAbs ("y", LApp (LVar "x", LVar "y"))) in
  let t_db = to_debruijn [] t in
  Printf.printf "\\x.\\y. x y = %s\n" (string_of_db_term t_db);

  (* Evaluate (\. 0) (\. 0) in de Bruijn form *)
  let expr_db = DBApp (DBAbs (DBVar 0), DBAbs (DBVar 0)) in
  Printf.printf "\n(\\. 0) (\\. 0) = %s\n" (string_of_db_term expr_db);
  let result_db = db_cbv_eval expr_db in
  Printf.printf "Result: %s\n" (string_of_db_term result_db);

  (* Convert back to named form *)
  let result_named = from_debruijn [] result_db in
  Printf.printf "Named:  %s\n" (string_of_lterm result_named)
```

---

## 7. Putting It All Together

### 7.1 A Complete Example Session

```ocaml
(* Church encoding test: compute 2 + 1 using Church numerals *)
let () =
  Printf.printf "\n--- Church Arithmetic ---\n";

  (* plus = \m. \n. \s. \z. m s (n s z) *)
  let plus = LAbs ("m", LAbs ("n", LAbs ("s", LAbs ("z",
    LApp (LApp (LVar "m", LVar "s"),
          LApp (LApp (LVar "n", LVar "s"), LVar "z")))))) in

  let expr = LApp (LApp (plus, c2), c1) in
  Printf.printf "2 + 1 = %s\n" (string_of_lterm expr);
  let result = cbv_eval expr in
  Printf.printf "Result: %s\n\n" (string_of_lterm result);
  (* The result is a Church numeral -- verify it is c3 *)
  (* by applying it to succ and 0 (as named terms) *)

  (* Manually verify: apply result to a "succ" and "zero" *)
  Printf.printf "Verifying result is c3...\n";
  cbv_eval_trace
    (LApp (LApp (result, LAbs ("n", LApp (LVar "S", LVar "n"))),
           LVar "Z"))
  (* Should produce S (S (S Z)) -- three applications of S *)
```

### 7.2 Alpha-Equivalence Check

```ocaml
(* Two terms are alpha-equivalent iff they have the same
   de Bruijn representation *)
let alpha_equiv t1 t2 =
  to_debruijn [] t1 = to_debruijn [] t2

let () =
  Printf.printf "\n--- Alpha-Equivalence ---\n";
  let t1 = LAbs ("x", LVar "x") in
  let t2 = LAbs ("y", LVar "y") in
  let t3 = LAbs ("x", LAbs ("y", LVar "x")) in
  let t4 = LAbs ("a", LAbs ("b", LVar "a")) in

  Printf.printf "\\x.x =_a \\y.y ? %b\n" (alpha_equiv t1 t2);
  Printf.printf "\\x.\\y.x =_a \\a.\\b.a ? %b\n" (alpha_equiv t3 t4);
  Printf.printf "\\x.x =_a \\x.\\y.x ? %b\n" (alpha_equiv t1 t3)
```

---

## 8. Exercises

1. **Extend the arithmetic evaluator** to support a `TmPlus of term * term` constructor. Define appropriate evaluation rules (evaluate both arguments to numeric values, then compute their sum).

2. **Implement eta-reduction** for the named lambda calculus: if a term has the form `LAbs (x, LApp (t, LVar x))` where `x` is not free in `t`, reduce it to `t`.

3. **Implement normal-order evaluation** (leftmost-outermost redex first, reducing under lambdas). Compare its behavior with CBV and CBN on the term `(\x. \y. y) ((\z. z z) (\z. z z))`.

4. **Implement a step counter** that counts the number of beta-reductions performed during evaluation. Compare the step counts of CBV and CBN on several terms, including `(\f. \x. f (f x)) (\y. y) z`.

5. **Challenge:** Implement a parser for lambda terms. Accept syntax like `\x. \y. x y` and produce the corresponding `lterm` AST. Use OCaml's `Scanf` module or write a recursive descent parser by hand.
