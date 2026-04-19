---
title: "Recitation 02: Implementing a Type Checker"
tags:
  - type-theory
  - stlc
  - recitation
---
# Recitation 02: Implementing a Type Checker

> **Module 02 --- Simply Typed Lambda Calculus (Weeks 3-4)**
> Hands-on OCaml implementation session

---

## Overview

In this recitation, we implement a complete type checker and evaluator for the simply typed lambda calculus with booleans, natural numbers, products, sums, and unit. Every code block in this document is runnable OCaml.

By the end of this session, you will have:

1. An OCaml AST for STLC types and terms.
2. A type checker that implements the typing rules from Lectures 02a and 02d.
3. A small-step evaluator.
4. A combined pipeline: parse (by hand), type-check, then evaluate.
5. Extensions for products, sums, and unit.

---

## 1. Defining Types

We begin by defining the OCaml types for our STLC types. This is a direct transcription of the grammar $T ::= \text{Bool} \mid \text{Nat} \mid T_1 \to T_2$.

```ocaml
(* typ.ml -- The type language of STLC *)

type typ =
  | TBool
  | TNat
  | TArrow of typ * typ
  | TProd of typ * typ    (* T1 * T2 *)
  | TSum of typ * typ     (* T1 + T2 *)
  | TUnit                 (* Unit *)
```

We also define a pretty-printer for types, which is essential for readable error messages:

```ocaml
let rec string_of_typ (t : typ) : string =
  match t with
  | TBool -> "Bool"
  | TNat -> "Nat"
  | TArrow (t1, t2) ->
    let s1 = match t1 with
      | TArrow _ -> "(" ^ string_of_typ t1 ^ ")"
      | _ -> string_of_typ t1
    in
    s1 ^ " -> " ^ string_of_typ t2
  | TProd (t1, t2) ->
    let s1 = match t1 with
      | TArrow _ | TSum _ -> "(" ^ string_of_typ t1 ^ ")"
      | _ -> string_of_typ t1
    in
    let s2 = match t2 with
      | TArrow _ | TSum _ -> "(" ^ string_of_typ t2 ^ ")"
      | _ -> string_of_typ t2
    in
    s1 ^ " * " ^ s2
  | TSum (t1, t2) ->
    let s1 = match t1 with
      | TArrow _ -> "(" ^ string_of_typ t1 ^ ")"
      | _ -> string_of_typ t1
    in
    let s2 = match t2 with
      | TArrow _ -> "(" ^ string_of_typ t2 ^ ")"
      | _ -> string_of_typ t2
    in
    s1 ^ " + " ^ s2
  | TUnit -> "Unit"
```

Test the printer:

```ocaml
let () =
  let t = TArrow (TArrow (TBool, TNat), TArrow (TNat, TBool)) in
  print_endline (string_of_typ t)
  (* Output: (Bool -> Nat) -> Nat -> Bool *)
```

---

## 2. Defining Terms

Next, the term language. Variables are represented as strings (named representation).

```ocaml
(* term.ml -- The term language of STLC *)

type term =
  (* Lambda calculus core *)
  | TmVar of string
  | TmAbs of string * typ * term       (* lambda x : T . t *)
  | TmApp of term * term               (* t1 t2 *)
  (* Booleans *)
  | TmTrue
  | TmFalse
  | TmIf of term * term * term         (* if t1 then t2 else t3 *)
  (* Natural numbers *)
  | TmZero
  | TmSucc of term
  | TmPred of term
  | TmIsZero of term
  (* Products *)
  | TmPair of term * term              (* (t1, t2) *)
  | TmFst of term                      (* fst t *)
  | TmSnd of term                      (* snd t *)
  (* Sums *)
  | TmInl of term * typ                (* inl t as T1 + T2 *)
  | TmInr of term * typ                (* inr t as T1 + T2 *)
  | TmCase of term * string * term * string * term
    (* case t of inl x => t1 | inr y => t2 *)
  (* Unit *)
  | TmUnit
```

Note that `TmInl` and `TmInr` carry a type annotation (the full sum type) to ensure uniqueness of types, as discussed in Lecture 02c.

A pretty-printer for terms:

```ocaml
let rec string_of_term (t : term) : string =
  match t with
  | TmVar x -> x
  | TmAbs (x, ty, body) ->
    "(lambda " ^ x ^ " : " ^ string_of_typ ty ^ " . " ^
    string_of_term body ^ ")"
  | TmApp (t1, t2) ->
    "(" ^ string_of_term t1 ^ " " ^ string_of_term t2 ^ ")"
  | TmTrue -> "true"
  | TmFalse -> "false"
  | TmIf (t1, t2, t3) ->
    "(if " ^ string_of_term t1 ^ " then " ^
    string_of_term t2 ^ " else " ^ string_of_term t3 ^ ")"
  | TmZero -> "0"
  | TmSucc t1 -> "(succ " ^ string_of_term t1 ^ ")"
  | TmPred t1 -> "(pred " ^ string_of_term t1 ^ ")"
  | TmIsZero t1 -> "(iszero " ^ string_of_term t1 ^ ")"
  | TmPair (t1, t2) ->
    "(" ^ string_of_term t1 ^ ", " ^ string_of_term t2 ^ ")"
  | TmFst t1 -> "(fst " ^ string_of_term t1 ^ ")"
  | TmSnd t1 -> "(snd " ^ string_of_term t1 ^ ")"
  | TmInl (t1, ty) ->
    "(inl " ^ string_of_term t1 ^ " as " ^ string_of_typ ty ^ ")"
  | TmInr (t1, ty) ->
    "(inr " ^ string_of_term t1 ^ " as " ^ string_of_typ ty ^ ")"
  | TmCase (t0, x, t1, y, t2) ->
    "(case " ^ string_of_term t0 ^ " of inl " ^ x ^ " => " ^
    string_of_term t1 ^ " | inr " ^ y ^ " => " ^
    string_of_term t2 ^ ")"
  | TmUnit -> "unit"
```

---

## 3. Typing Contexts

A typing context maps variable names to types. We use a simple association list:

```ocaml
(* context.ml -- Typing contexts *)

type context = (string * typ) list

let empty_ctx : context = []

let extend (ctx : context) (x : string) (ty : typ) : context =
  (x, ty) :: ctx

let lookup (ctx : context) (x : string) : typ option =
  List.assoc_opt x ctx
```

The `extend` function prepends a binding, so more recent bindings shadow earlier ones. The `lookup` function returns `Some ty` if the variable is bound, or `None` if not.

---

## 4. The Type Checker

Now we implement the type checker. This is a direct transcription of the typing rules into OCaml. The function `typecheck` takes a context and a term and returns the type, or raises an exception if the term is ill-typed.

```ocaml
(* typecheck.ml -- The type checker *)

exception Type_error of string

let type_error (msg : string) : 'a =
  raise (Type_error msg)

let rec typecheck (ctx : context) (t : term) : typ =
  match t with
  (* T-Var *)
  | TmVar x ->
    begin match lookup ctx x with
    | Some ty -> ty
    | None -> type_error ("Unbound variable: " ^ x)
    end

  (* T-Abs *)
  | TmAbs (x, ty_param, body) ->
    let ctx' = extend ctx x ty_param in
    let ty_body = typecheck ctx' body in
    TArrow (ty_param, ty_body)

  (* T-App *)
  | TmApp (t1, t2) ->
    let ty1 = typecheck ctx t1 in
    let ty2 = typecheck ctx t2 in
    begin match ty1 with
    | TArrow (ty_param, ty_result) ->
      if ty_param = ty2 then ty_result
      else type_error (
        "Argument type mismatch: expected " ^
        string_of_typ ty_param ^ " but got " ^
        string_of_typ ty2)
    | _ ->
      type_error (
        "Expected function type, got " ^
        string_of_typ ty1)
    end

  (* T-True, T-False *)
  | TmTrue -> TBool
  | TmFalse -> TBool

  (* T-If *)
  | TmIf (t1, t2, t3) ->
    let ty1 = typecheck ctx t1 in
    if ty1 <> TBool then
      type_error (
        "Guard of if must be Bool, got " ^
        string_of_typ ty1);
    let ty2 = typecheck ctx t2 in
    let ty3 = typecheck ctx t3 in
    if ty2 <> ty3 then
      type_error (
        "Branches of if have different types: " ^
        string_of_typ ty2 ^ " and " ^ string_of_typ ty3);
    ty2

  (* T-Zero *)
  | TmZero -> TNat

  (* T-Succ *)
  | TmSucc t1 ->
    let ty1 = typecheck ctx t1 in
    if ty1 <> TNat then
      type_error (
        "Argument of succ must be Nat, got " ^
        string_of_typ ty1);
    TNat

  (* T-Pred *)
  | TmPred t1 ->
    let ty1 = typecheck ctx t1 in
    if ty1 <> TNat then
      type_error (
        "Argument of pred must be Nat, got " ^
        string_of_typ ty1);
    TNat

  (* T-IsZero *)
  | TmIsZero t1 ->
    let ty1 = typecheck ctx t1 in
    if ty1 <> TNat then
      type_error (
        "Argument of iszero must be Nat, got " ^
        string_of_typ ty1);
    TBool

  (* T-Pair *)
  | TmPair (t1, t2) ->
    let ty1 = typecheck ctx t1 in
    let ty2 = typecheck ctx t2 in
    TProd (ty1, ty2)

  (* T-Fst *)
  | TmFst t1 ->
    let ty1 = typecheck ctx t1 in
    begin match ty1 with
    | TProd (ty_fst, _) -> ty_fst
    | _ -> type_error (
        "Expected product type, got " ^
        string_of_typ ty1)
    end

  (* T-Snd *)
  | TmSnd t1 ->
    let ty1 = typecheck ctx t1 in
    begin match ty1 with
    | TProd (_, ty_snd) -> ty_snd
    | _ -> type_error (
        "Expected product type, got " ^
        string_of_typ ty1)
    end

  (* T-Inl *)
  | TmInl (t1, ty_annot) ->
    begin match ty_annot with
    | TSum (ty_left, _) ->
      let ty1 = typecheck ctx t1 in
      if ty1 <> ty_left then
        type_error (
          "inl annotation mismatch: expected " ^
          string_of_typ ty_left ^ " but got " ^
          string_of_typ ty1);
      ty_annot
    | _ -> type_error (
        "inl annotation must be a sum type, got " ^
        string_of_typ ty_annot)
    end

  (* T-Inr *)
  | TmInr (t1, ty_annot) ->
    begin match ty_annot with
    | TSum (_, ty_right) ->
      let ty1 = typecheck ctx t1 in
      if ty1 <> ty_right then
        type_error (
          "inr annotation mismatch: expected " ^
          string_of_typ ty_right ^ " but got " ^
          string_of_typ ty1);
      ty_annot
    | _ -> type_error (
        "inr annotation must be a sum type, got " ^
        string_of_typ ty_annot)
    end

  (* T-Case *)
  | TmCase (t0, x, t1, y, t2) ->
    let ty0 = typecheck ctx t0 in
    begin match ty0 with
    | TSum (ty_left, ty_right) ->
      let ctx1 = extend ctx x ty_left in
      let ctx2 = extend ctx y ty_right in
      let ty1 = typecheck ctx1 t1 in
      let ty2 = typecheck ctx2 t2 in
      if ty1 <> ty2 then
        type_error (
          "Case branches have different types: " ^
          string_of_typ ty1 ^ " and " ^ string_of_typ ty2);
      ty1
    | _ -> type_error (
        "Scrutinee of case must have sum type, got " ^
        string_of_typ ty0)
    end

  (* T-Unit *)
  | TmUnit -> TUnit
```

### 4.1 Testing the Type Checker

```ocaml
let test_typecheck () =
  (* Identity on booleans: lambda x:Bool. x *)
  let id_bool = TmAbs ("x", TBool, TmVar "x") in
  assert (typecheck empty_ctx id_bool = TArrow (TBool, TBool));

  (* Application: (lambda x:Bool. x) true *)
  let app = TmApp (id_bool, TmTrue) in
  assert (typecheck empty_ctx app = TBool);

  (* Pair: (true, 0) *)
  let pair = TmPair (TmTrue, TmZero) in
  assert (typecheck empty_ctx pair = TProd (TBool, TNat));

  (* Fst: fst (true, 0) *)
  let fst_pair = TmFst pair in
  assert (typecheck empty_ctx fst_pair = TBool);

  (* Sum injection: inl true as Bool + Nat *)
  let inl = TmInl (TmTrue, TSum (TBool, TNat)) in
  assert (typecheck empty_ctx inl = TSum (TBool, TNat));

  (* Case analysis *)
  let case_term = TmCase (
    inl,
    "x", TmSucc (TmZero),     (* inl x => succ 0 *)
    "y", TmVar "y"             (* inr y => y *)
  ) in
  assert (typecheck empty_ctx case_term = TNat);

  (* Higher-order: lambda f:Nat->Nat. lambda x:Nat. f (f x) *)
  let twice = TmAbs ("f", TArrow (TNat, TNat),
    TmAbs ("x", TNat,
      TmApp (TmVar "f", TmApp (TmVar "f", TmVar "x")))) in
  assert (typecheck empty_ctx twice =
    TArrow (TArrow (TNat, TNat), TArrow (TNat, TNat)));

  print_endline "All type checker tests passed."

let () = test_typecheck ()
```

### 4.2 Testing Error Cases

```ocaml
let test_type_errors () =
  (* Unbound variable *)
  let ok = try
    let _ = typecheck empty_ctx (TmVar "x") in false
  with Type_error _ -> true in
  assert ok;

  (* succ true -- type mismatch *)
  let ok = try
    let _ = typecheck empty_ctx (TmSucc TmTrue) in false
  with Type_error _ -> true in
  assert ok;

  (* true false -- applying a non-function *)
  let ok = try
    let _ = typecheck empty_ctx (TmApp (TmTrue, TmFalse)) in false
  with Type_error _ -> true in
  assert ok;

  (* if 0 then true else false -- guard not Bool *)
  let ok = try
    let _ = typecheck empty_ctx (TmIf (TmZero, TmTrue, TmFalse)) in false
  with Type_error _ -> true in
  assert ok;

  (* if true then 0 else false -- branch type mismatch *)
  let ok = try
    let _ = typecheck empty_ctx (TmIf (TmTrue, TmZero, TmFalse)) in false
  with Type_error _ -> true in
  assert ok;

  (* fst true -- not a product *)
  let ok = try
    let _ = typecheck empty_ctx (TmFst TmTrue) in false
  with Type_error _ -> true in
  assert ok;

  print_endline "All type error tests passed."

let () = test_type_errors ()
```

---

## 5. The Evaluator

### 5.1 Checking for Values

```ocaml
let rec is_numeric_val (t : term) : bool =
  match t with
  | TmZero -> true
  | TmSucc t1 -> is_numeric_val t1
  | _ -> false

let rec is_val (t : term) : bool =
  match t with
  | TmTrue | TmFalse -> true
  | TmAbs _ -> true
  | TmUnit -> true
  | t when is_numeric_val t -> true
  | TmPair (t1, t2) -> is_val t1 && is_val t2
  | TmInl (t1, _) -> is_val t1
  | TmInr (t1, _) -> is_val t1
  | _ -> false
```

### 5.2 Substitution

We implement capture-avoiding substitution. For simplicity, we use a naive approach that renames bound variables when necessary. In a production implementation, de Bruijn indices would be more robust.

```ocaml
(* Free variables *)
let rec free_vars (t : term) : string list =
  match t with
  | TmVar x -> [x]
  | TmAbs (x, _, body) ->
    List.filter (fun v -> v <> x) (free_vars body)
  | TmApp (t1, t2) -> free_vars t1 @ free_vars t2
  | TmTrue | TmFalse | TmZero | TmUnit -> []
  | TmIf (t1, t2, t3) ->
    free_vars t1 @ free_vars t2 @ free_vars t3
  | TmSucc t1 | TmPred t1 | TmIsZero t1 -> free_vars t1
  | TmPair (t1, t2) -> free_vars t1 @ free_vars t2
  | TmFst t1 | TmSnd t1 -> free_vars t1
  | TmInl (t1, _) | TmInr (t1, _) -> free_vars t1
  | TmCase (t0, x, t1, y, t2) ->
    free_vars t0 @
    List.filter (fun v -> v <> x) (free_vars t1) @
    List.filter (fun v -> v <> y) (free_vars t2)

(* Generate a fresh variable name *)
let fresh_var (base : string) (avoid : string list) : string =
  let rec try_name n =
    let name = base ^ string_of_int n in
    if List.mem name avoid then try_name (n + 1)
    else name
  in
  if not (List.mem base avoid) then base
  else try_name 0

(* Capture-avoiding substitution: [x -> s] t *)
let rec subst (x : string) (s : term) (t : term) : term =
  match t with
  | TmVar y ->
    if y = x then s else t

  | TmAbs (y, ty, body) ->
    if y = x then t  (* x is shadowed *)
    else if not (List.mem y (free_vars s)) then
      TmAbs (y, ty, subst x s body)
    else
      (* Rename y to avoid capture *)
      let fvs = free_vars s @ free_vars body @ [x] in
      let y' = fresh_var y fvs in
      let body' = subst y (TmVar y') body in
      TmAbs (y', ty, subst x s body')

  | TmApp (t1, t2) ->
    TmApp (subst x s t1, subst x s t2)

  | TmTrue -> TmTrue
  | TmFalse -> TmFalse
  | TmIf (t1, t2, t3) ->
    TmIf (subst x s t1, subst x s t2, subst x s t3)

  | TmZero -> TmZero
  | TmSucc t1 -> TmSucc (subst x s t1)
  | TmPred t1 -> TmPred (subst x s t1)
  | TmIsZero t1 -> TmIsZero (subst x s t1)

  | TmPair (t1, t2) ->
    TmPair (subst x s t1, subst x s t2)
  | TmFst t1 -> TmFst (subst x s t1)
  | TmSnd t1 -> TmSnd (subst x s t1)

  | TmInl (t1, ty) -> TmInl (subst x s t1, ty)
  | TmInr (t1, ty) -> TmInr (subst x s t1, ty)
  | TmCase (t0, y1, t1, y2, t2) ->
    let t0' = subst x s t0 in
    let fvs = free_vars s in
    (* Handle y1 binding in t1 *)
    let (y1', t1') =
      if y1 = x then (y1, t1)
      else if not (List.mem y1 fvs) then (y1, subst x s t1)
      else
        let avoid = fvs @ free_vars t1 @ [x] in
        let y1n = fresh_var y1 avoid in
        (y1n, subst x s (subst y1 (TmVar y1n) t1))
    in
    (* Handle y2 binding in t2 *)
    let (y2', t2') =
      if y2 = x then (y2, t2)
      else if not (List.mem y2 fvs) then (y2, subst x s t2)
      else
        let avoid = fvs @ free_vars t2 @ [x] in
        let y2n = fresh_var y2 avoid in
        (y2n, subst x s (subst y2 (TmVar y2n) t2))
    in
    TmCase (t0', y1', t1', y2', t2')

  | TmUnit -> TmUnit
```

### 5.3 Single-Step Evaluation

```ocaml
exception No_rule_applies

let rec eval1 (t : term) : term =
  match t with
  (* E-AppAbs: (lambda x:T. t) v -> [x -> v] t *)
  | TmApp (TmAbs (x, _, body), v2) when is_val v2 ->
    subst x v2 body

  (* E-App2: v1 t2 -> v1 t2' *)
  | TmApp (v1, t2) when is_val v1 ->
    let t2' = eval1 t2 in
    TmApp (v1, t2')

  (* E-App1: t1 t2 -> t1' t2 *)
  | TmApp (t1, t2) ->
    let t1' = eval1 t1 in
    TmApp (t1', t2)

  (* E-IfTrue *)
  | TmIf (TmTrue, t2, _) -> t2

  (* E-IfFalse *)
  | TmIf (TmFalse, _, t3) -> t3

  (* E-If *)
  | TmIf (t1, t2, t3) ->
    let t1' = eval1 t1 in
    TmIf (t1', t2, t3)

  (* E-Succ *)
  | TmSucc t1 ->
    let t1' = eval1 t1 in
    TmSucc t1'

  (* E-PredZero *)
  | TmPred TmZero -> TmZero

  (* E-PredSucc *)
  | TmPred (TmSucc nv) when is_numeric_val nv -> nv

  (* E-Pred *)
  | TmPred t1 ->
    let t1' = eval1 t1 in
    TmPred t1'

  (* E-IsZeroZero *)
  | TmIsZero TmZero -> TmTrue

  (* E-IsZeroSucc *)
  | TmIsZero (TmSucc nv) when is_numeric_val nv -> TmFalse

  (* E-IsZero *)
  | TmIsZero t1 ->
    let t1' = eval1 t1 in
    TmIsZero t1'

  (* E-FstPair *)
  | TmFst (TmPair (v1, v2)) when is_val v1 && is_val v2 -> v1

  (* E-Fst *)
  | TmFst t1 ->
    let t1' = eval1 t1 in
    TmFst t1'

  (* E-SndPair *)
  | TmSnd (TmPair (v1, v2)) when is_val v1 && is_val v2 -> v2

  (* E-Snd *)
  | TmSnd t1 ->
    let t1' = eval1 t1 in
    TmSnd t1'

  (* E-Pair2 *)
  | TmPair (v1, t2) when is_val v1 ->
    let t2' = eval1 t2 in
    TmPair (v1, t2')

  (* E-Pair1 *)
  | TmPair (t1, t2) ->
    let t1' = eval1 t1 in
    TmPair (t1', t2)

  (* E-CaseInl *)
  | TmCase (TmInl (v, _), x, t1, _, _) when is_val v ->
    subst x v t1

  (* E-CaseInr *)
  | TmCase (TmInr (v, _), _, _, y, t2) when is_val v ->
    subst y v t2

  (* E-Case *)
  | TmCase (t0, x, t1, y, t2) ->
    let t0' = eval1 t0 in
    TmCase (t0', x, t1, y, t2)

  (* E-Inl *)
  | TmInl (t1, ty) ->
    let t1' = eval1 t1 in
    TmInl (t1', ty)

  (* E-Inr *)
  | TmInr (t1, ty) ->
    let t1' = eval1 t1 in
    TmInr (t1', ty)

  | _ -> raise No_rule_applies
```

### 5.4 Multi-Step Evaluation

```ocaml
let rec eval (t : term) : term =
  try
    let t' = eval1 t in
    eval t'
  with No_rule_applies -> t
```

### 5.5 Trace Evaluation (for Debugging)

```ocaml
let eval_trace (t : term) : term =
  let rec go t step =
    Printf.printf "  Step %d: %s\n" step (string_of_term t);
    try
      let t' = eval1 t in
      go t' (step + 1)
    with No_rule_applies ->
      Printf.printf "  (normal form)\n";
      t
  in
  go t 0
```

---

## 6. The Complete Pipeline

```ocaml
let run (t : term) : unit =
  Printf.printf "Term: %s\n" (string_of_term t);
  try
    let ty = typecheck empty_ctx t in
    Printf.printf "Type: %s\n" (string_of_typ ty);
    let result = eval t in
    Printf.printf "Result: %s\n\n" (string_of_term result)
  with Type_error msg ->
    Printf.printf "Type error: %s\n\n" msg
```

---

## 7. Test Suite

### 7.1 Basic Lambda Calculus

```ocaml
let () =
  print_endline "=== Basic Lambda Calculus ===";

  (* Identity function applied to true *)
  run (TmApp (TmAbs ("x", TBool, TmVar "x"), TmTrue));
  (* Expected: Type: Bool, Result: true *)

  (* Constant function *)
  run (TmApp (
    TmApp (
      TmAbs ("x", TBool, TmAbs ("y", TNat, TmVar "x")),
      TmTrue),
    TmZero));
  (* Expected: Type: Bool, Result: true *)

  (* Twice: (lambda f. lambda x. f (f x)) succ 0 *)
  run (TmApp (TmApp (
    TmAbs ("f", TArrow (TNat, TNat),
      TmAbs ("x", TNat,
        TmApp (TmVar "f", TmApp (TmVar "f", TmVar "x")))),
    TmAbs ("n", TNat, TmSucc (TmVar "n"))),
    TmZero));
  (* Expected: Type: Nat, Result: (succ (succ 0)) *)
```

### 7.2 Booleans and Conditionals

```ocaml
let () =
  print_endline "=== Booleans and Conditionals ===";

  run (TmIf (TmTrue, TmZero, TmSucc TmZero));
  (* Expected: Type: Nat, Result: 0 *)

  run (TmIf (TmIsZero TmZero, TmTrue, TmFalse));
  (* Expected: Type: Bool, Result: true *)

  run (TmIf (TmIsZero (TmSucc TmZero), TmTrue, TmFalse));
  (* Expected: Type: Bool, Result: false *)
```

### 7.3 Natural Numbers

```ocaml
let () =
  print_endline "=== Natural Numbers ===";

  run (TmPred (TmSucc (TmSucc TmZero)));
  (* Expected: Type: Nat, Result: (succ 0) *)

  run (TmPred TmZero);
  (* Expected: Type: Nat, Result: 0 *)

  run (TmIsZero (TmPred (TmSucc TmZero)));
  (* Expected: Type: Bool, Result: true *)
```

### 7.4 Products

```ocaml
let () =
  print_endline "=== Products ===";

  (* fst (true, 0) *)
  run (TmFst (TmPair (TmTrue, TmZero)));
  (* Expected: Type: Bool, Result: true *)

  (* snd (true, 0) *)
  run (TmSnd (TmPair (TmTrue, TmZero)));
  (* Expected: Type: Nat, Result: 0 *)

  (* Swap function *)
  let swap = TmAbs ("p", TProd (TBool, TNat),
    TmPair (TmSnd (TmVar "p"), TmFst (TmVar "p"))) in
  run (TmApp (swap, TmPair (TmTrue, TmSucc TmZero)));
  (* Expected: Type: Nat * Bool, Result: ((succ 0), true) *)

  (* Nested pairs *)
  run (TmFst (TmFst (TmPair (TmPair (TmTrue, TmFalse), TmZero))));
  (* Expected: Type: Bool, Result: true *)
```

### 7.5 Sums

```ocaml
let () =
  print_endline "=== Sums ===";

  let bool_or_nat = TSum (TBool, TNat) in

  (* case (inl true) of inl x => iszero 0 | inr y => iszero y *)
  run (TmCase (
    TmInl (TmTrue, bool_or_nat),
    "x", TmIsZero TmZero,
    "y", TmIsZero (TmVar "y")));
  (* Expected: Type: Bool, Result: true *)

  (* case (inr (succ 0)) of inl x => 0 | inr y => y *)
  run (TmCase (
    TmInr (TmSucc TmZero, bool_or_nat),
    "x", TmZero,
    "y", TmVar "y"));
  (* Expected: Type: Nat, Result: (succ 0) *)
```

### 7.6 Unit

```ocaml
let () =
  print_endline "=== Unit ===";

  run TmUnit;
  (* Expected: Type: Unit, Result: unit *)

  (* A function that discards its argument *)
  run (TmApp (TmAbs ("x", TNat, TmUnit), TmSucc TmZero));
  (* Expected: Type: Unit, Result: unit *)
```

### 7.7 Error Cases

```ocaml
let () =
  print_endline "=== Error Cases ===";

  (* Type errors that should be caught *)
  run (TmApp (TmTrue, TmFalse));
  (* Expected: Type error *)

  run (TmSucc TmTrue);
  (* Expected: Type error *)

  run (TmFst TmTrue);
  (* Expected: Type error *)

  run (TmIf (TmZero, TmTrue, TmFalse));
  (* Expected: Type error *)
```

---

## 8. Advanced Example: Church Booleans vs. Native Booleans

An interesting exercise is to compare Church-encoded booleans with native booleans:

```ocaml
let () =
  print_endline "=== Church Booleans (typed) ===";

  (* Church true: lambda t:Nat. lambda f:Nat. t *)
  let church_true = TmAbs ("t", TNat,
    TmAbs ("f", TNat, TmVar "t")) in

  (* Church false: lambda t:Nat. lambda f:Nat. f *)
  let church_false = TmAbs ("t", TNat,
    TmAbs ("f", TNat, TmVar "f")) in

  (* Church AND: lambda b1. lambda b2. b1 b2 church_false *)
  (* Note: we must monomorphize -- Church booleans in STLC *)
  (* are not polymorphic, so they only work at a fixed type *)

  (* Apply church_true to (1, 0) -- should select 1 *)
  run (TmApp (TmApp (church_true, TmSucc TmZero), TmZero));
  (* Expected: Type: Nat, Result: (succ 0) *)

  (* Apply church_false to (1, 0) -- should select 0 *)
  run (TmApp (TmApp (church_false, TmSucc TmZero), TmZero));
  (* Expected: Type: Nat, Result: 0 *)

  (* Note: Church booleans in STLC have type Nat -> Nat -> Nat,
     not a polymorphic type. This is a limitation of STLC
     that System F (Module 06) resolves with:
     church_true : forall X. X -> X -> X *)
  ()
```

---

## 9. Exercises

### Exercise 9.1: Add Let-Bindings

Extend the type checker and evaluator with let-bindings:

```ocaml
(* Add to the term type:
   | TmLet of string * term * term    (* let x = t1 in t2 *)
*)

(* Add to typecheck:
   | TmLet (x, t1, t2) ->
     let ty1 = typecheck ctx t1 in
     let ctx' = extend ctx x ty1 in
     typecheck ctx' t2
*)

(* Add to eval1:
   | TmLet (x, v1, t2) when is_val v1 ->
     subst x v1 t2
   | TmLet (x, t1, t2) ->
     let t1' = eval1 t1 in
     TmLet (x, t1', t2)
*)
```

### Exercise 9.2: Add the Absurd Eliminator

Extend the system with the Void type and absurd eliminator:

```ocaml
(* The Void type is already in our typ definition.
   Add to the term type:
   | TmAbsurd of term * typ    (* absurd t as T *)
*)

(* Add to typecheck:
   | TmAbsurd (t1, ty_result) ->
     let ty1 = typecheck ctx t1 in
     if ty1 <> TVoid then
       type_error "absurd requires Void type";
     ty_result
*)

(* Add to eval1:
   | TmAbsurd (t1, ty) ->
     let t1' = eval1 t1 in
     TmAbsurd (t1', ty)
   (* No computation rule -- absurd never reaches a value *)
*)
```

### Exercise 9.3: Add Ascription

```ocaml
(* Add to term type:
   | TmAscribe of term * typ   (* t as T *)
*)

(* Add to typecheck:
   | TmAscribe (t1, ty) ->
     let ty1 = typecheck ctx t1 in
     if ty1 <> ty then
       type_error ("Ascription mismatch: term has type " ^
         string_of_typ ty1 ^ " but ascribed as " ^
         string_of_typ ty);
     ty
*)

(* Add to eval1:
   | TmAscribe (v, _) when is_val v -> v
   | TmAscribe (t1, ty) ->
     let t1' = eval1 t1 in
     TmAscribe (t1', ty)
*)
```

### Exercise 9.4: Property-Based Testing

Write a function that generates random well-typed terms and verify that:
1. The type checker accepts them.
2. They evaluate to a value.
3. The value has the same type (preservation).

```ocaml
(* Sketch of a random term generator *)
let rec gen_term (ctx : context) (ty : typ) (depth : int) : term =
  if depth <= 0 then
    (* Generate a base-case term *)
    match ty with
    | TBool -> if Random.bool () then TmTrue else TmFalse
    | TNat -> TmZero
    | TUnit -> TmUnit
    | TArrow (t1, t2) ->
      let x = fresh_var "x" (List.map fst ctx) in
      TmAbs (x, t1, gen_term (extend ctx x t1) t2 0)
    | _ -> failwith "Cannot generate base case for this type"
  else
    (* Choose a random construction *)
    match ty with
    | TBool ->
      (* Could be: true, false, iszero t, if t then t else t *)
      begin match Random.int 3 with
      | 0 -> if Random.bool () then TmTrue else TmFalse
      | 1 -> TmIsZero (gen_term ctx TNat (depth - 1))
      | _ -> TmIf (gen_term ctx TBool (depth - 1),
                    gen_term ctx TBool (depth - 1),
                    gen_term ctx TBool (depth - 1))
      end
    | TNat ->
      begin match Random.int 3 with
      | 0 -> TmZero
      | 1 -> TmSucc (gen_term ctx TNat (depth - 1))
      | _ -> TmPred (gen_term ctx TNat (depth - 1))
      end
    | _ -> failwith "TODO: extend for more types"

(* Test preservation *)
let test_preservation (n : int) : unit =
  for _ = 1 to n do
    let ty = TBool in  (* or generate random types *)
    let t = gen_term empty_ctx ty 3 in
    let ty_check = typecheck empty_ctx t in
    assert (ty_check = ty);
    let v = eval t in
    let ty_val = typecheck empty_ctx v in
    assert (ty_val = ty)
  done;
  Printf.printf "Preservation held for %d random terms.\n" n
```

---

## 10. Summary

In this recitation, we built a complete STLC implementation:

| Component | Function | Lines of Code (approx.) |
|-----------|----------|------------------------|
| Types | `typ` ADT, `string_of_typ` | 40 |
| Terms | `term` ADT, `string_of_term` | 70 |
| Context | `extend`, `lookup` | 10 |
| Type checker | `typecheck` | 100 |
| Substitution | `subst` | 60 |
| Evaluator | `eval1`, `eval` | 80 |
| Tests | Various | 100 |
| **Total** | | **~460** |

Key implementation insights:

1. The type checker is a **direct transcription** of the inference rules. Each typing rule becomes a case in the `match`.
2. Substitution is the most error-prone component. Using de Bruijn indices (Module 01) eliminates the need for capture-avoidance but makes the code less readable.
3. The evaluator must carefully order pattern matching to ensure computation rules fire before congruence rules.
4. Type annotations on sum injections (`TmInl`, `TmInr`) are necessary for decidable type checking without inference.
