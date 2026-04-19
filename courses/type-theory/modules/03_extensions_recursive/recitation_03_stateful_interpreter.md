---
title: "Recitation 03: Stateful Interpreter"
tags:
  - type-theory
  - extensions
  - recitation
---
# Recitation 03: Stateful Interpreter

## Overview

In this recitation, we extend the STLC interpreter from Recitation 02 with the features covered in Lectures 03a-03d: mutable references, exceptions, recursive types (fold/unfold), and the fixed-point operator. Every code block is runnable OCaml. By the end, you will have a fully functional interpreter for a language with state, error handling, recursive data structures, and general recursion.

**Prerequisites:** Recitation 02 (STLC type checker and interpreter), Lectures 03a-03d.

---

## 1. Extended Syntax

### 1.1 Types

We extend our type representation with references and recursive types.

```ocaml
type ty =
  | TBool
  | TNat
  | TUnit
  | TArrow of ty * ty
  | TProd of ty * ty
  | TSum of ty * ty
  | TRef of ty             (* Ref T *)
  | TVar of string         (* type variables for recursive types *)
  | TRec of string * ty    (* mu X. T *)
```

### 1.2 Terms

```ocaml
type term =
  (* STLC core *)
  | TmVar of string
  | TmAbs of string * ty * term
  | TmApp of term * term
  (* Booleans *)
  | TmTrue
  | TmFalse
  | TmIf of term * term * term
  (* Natural numbers *)
  | TmZero
  | TmSucc of term
  | TmPred of term
  | TmIsZero of term
  (* Unit *)
  | TmUnit
  (* Products *)
  | TmPair of term * term
  | TmFst of term
  | TmSnd of term
  (* Sums *)
  | TmInl of ty * term        (* inl with target type annotation *)
  | TmInr of ty * term
  | TmCase of term * string * term * string * term
  (* Let binding *)
  | TmLet of string * term * term
  (* Sequencing *)
  | TmSeq of term * term
  (* References (Lecture 03a) *)
  | TmRef of term              (* ref t *)
  | TmDeref of term            (* !t *)
  | TmAssign of term * term    (* t1 := t2 *)
  | TmLoc of int               (* location l (runtime only) *)
  (* Exceptions (Lecture 03b) *)
  | TmError                    (* simple error *)
  | TmTry of term * term       (* try t1 with t2 *)
  | TmRaise of term            (* raise t *)
  (* Recursive types (Lecture 03c) *)
  | TmFold of ty * term        (* fold[mu X.T] t *)
  | TmUnfold of ty * term      (* unfold[mu X.T] t *)
  (* Fixed point (Lecture 03d) *)
  | TmFix of term              (* fix t *)
```

### 1.3 Values

```ocaml
type value =
  | VBool of bool
  | VNat of int
  | VUnit
  | VClosure of string * term * env
  | VPair of value * value
  | VInl of value
  | VInr of value
  | VLoc of int                (* store location *)
  | VFold of value             (* folded recursive value *)

and env = (string * value) list
```

---

## 2. The Store

### 2.1 Store Implementation

We implement the store as a mutable list of values. Each location is an integer index into the list. Allocation appends a new entry; dereference and assignment use the index.

```ocaml
type store = value list ref

let empty_store () : store = ref []

let store_alloc (s : store) (v : value) : int =
  let loc = List.length !s in
  s := !s @ [v];
  loc

let store_lookup (s : store) (loc : int) : value =
  List.nth !s loc

let store_update (s : store) (loc : int) (v : value) : unit =
  s := List.mapi (fun i old -> if i = loc then v else old) !s
```

**Remark.** Using a list for the store is simple but inefficient ($O(n)$ for lookup and update). A production implementation would use a hash table or array. We use a list here for clarity.

### 2.2 Store Typing

The store typing maps location indices to types. We use a simple list representation.

```ocaml
type store_typing = ty list

let empty_store_typing : store_typing = []

let store_typing_lookup (st : store_typing) (loc : int) : ty =
  List.nth st loc

let store_typing_extend (st : store_typing) (t : ty) : store_typing * int =
  let loc = List.length st in
  (st @ [t], loc)
```

---

## 3. Type Substitution for Recursive Types

### 3.1 Substituting in Types

To handle recursive types, we need type substitution: replacing a type variable with a type.

```ocaml
(* [x |-> s] t  -- substitute s for x in type t *)
let rec type_subst (x : string) (s : ty) (t : ty) : ty =
  match t with
  | TBool -> TBool
  | TNat -> TNat
  | TUnit -> TUnit
  | TArrow (t1, t2) -> TArrow (type_subst x s t1, type_subst x s t2)
  | TProd (t1, t2) -> TProd (type_subst x s t1, type_subst x s t2)
  | TSum (t1, t2) -> TSum (type_subst x s t1, type_subst x s t2)
  | TRef t1 -> TRef (type_subst x s t1)
  | TVar y -> if y = x then s else TVar y
  | TRec (y, t1) ->
    if y = x then TRec (y, t1)  (* x is shadowed by the binder *)
    else TRec (y, type_subst x s t1)
```

### 3.2 Unfolding Recursive Types

```ocaml
(* Unfold mu X. T  -->  [X |-> mu X. T] T *)
let unfold_type (mu_ty : ty) : ty =
  match mu_ty with
  | TRec (x, body) -> type_subst x mu_ty body
  | _ -> failwith "unfold_type: not a recursive type"
```

### 3.3 Type Equality

For recursive types, we need a type equality check that handles unfolding. For the iso-recursive approach, structural equality suffices (types are equal only if syntactically equal). We add alpha-equivalence for robustness.

```ocaml
let rec types_equal (t1 : ty) (t2 : ty) : bool =
  match (t1, t2) with
  | (TBool, TBool) -> true
  | (TNat, TNat) -> true
  | (TUnit, TUnit) -> true
  | (TArrow (a1, b1), TArrow (a2, b2)) ->
    types_equal a1 a2 && types_equal b1 b2
  | (TProd (a1, b1), TProd (a2, b2)) ->
    types_equal a1 a2 && types_equal b1 b2
  | (TSum (a1, b1), TSum (a2, b2)) ->
    types_equal a1 a2 && types_equal b1 b2
  | (TRef a, TRef b) -> types_equal a b
  | (TVar x, TVar y) -> x = y
  | (TRec (x1, b1), TRec (x2, b2)) ->
    (* Alpha-equivalence: rename x2 to x1 in b2 *)
    let b2' = type_subst x2 (TVar x1) b2 in
    types_equal b1 b2'
  | _ -> false
```

---

## 4. Type Checker

### 4.1 The Typing Function

We extend the type checker to handle all new constructs. The context includes a store typing for reference operations.

```ocaml
type context = (string * ty) list

exception TypeError of string

let lookup_var (ctx : context) (x : string) : ty =
  match List.assoc_opt x ctx with
  | Some t -> t
  | None -> raise (TypeError ("Unbound variable: " ^ x))

let rec typecheck (ctx : context) (st : store_typing) (t : term) : ty * store_typing =
  match t with
  (* --- STLC core --- *)
  | TmVar x -> (lookup_var ctx x, st)

  | TmAbs (x, ty_param, body) ->
    let (ty_body, st') = typecheck ((x, ty_param) :: ctx) st body in
    (TArrow (ty_param, ty_body), st')

  | TmApp (t1, t2) ->
    let (ty1, st1) = typecheck ctx st t1 in
    let (ty2, st2) = typecheck ctx st1 t2 in
    (match ty1 with
     | TArrow (ty_param, ty_ret) ->
       if types_equal ty_param ty2 then (ty_ret, st2)
       else raise (TypeError "Application: argument type mismatch")
     | _ -> raise (TypeError "Application: not a function"))

  (* --- Booleans --- *)
  | TmTrue -> (TBool, st)
  | TmFalse -> (TBool, st)
  | TmIf (t1, t2, t3) ->
    let (ty1, st1) = typecheck ctx st t1 in
    if not (types_equal ty1 TBool) then
      raise (TypeError "If: guard not Bool");
    let (ty2, st2) = typecheck ctx st1 t2 in
    let (ty3, st3) = typecheck ctx st2 t3 in
    if types_equal ty2 ty3 then (ty2, st3)
    else raise (TypeError "If: branch type mismatch")

  (* --- Naturals --- *)
  | TmZero -> (TNat, st)
  | TmSucc t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    if types_equal ty1 TNat then (TNat, st1)
    else raise (TypeError "Succ: argument not Nat")
  | TmPred t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    if types_equal ty1 TNat then (TNat, st1)
    else raise (TypeError "Pred: argument not Nat")
  | TmIsZero t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    if types_equal ty1 TNat then (TBool, st1)
    else raise (TypeError "IsZero: argument not Nat")

  (* --- Unit --- *)
  | TmUnit -> (TUnit, st)

  (* --- Products --- *)
  | TmPair (t1, t2) ->
    let (ty1, st1) = typecheck ctx st t1 in
    let (ty2, st2) = typecheck ctx st1 t2 in
    (TProd (ty1, ty2), st2)
  | TmFst t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    (match ty1 with
     | TProd (a, _) -> (a, st1)
     | _ -> raise (TypeError "Fst: not a product"))
  | TmSnd t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    (match ty1 with
     | TProd (_, b) -> (b, st1)
     | _ -> raise (TypeError "Snd: not a product"))

  (* --- Sums --- *)
  | TmInl (sum_ty, t1) ->
    let (ty1, st1) = typecheck ctx st t1 in
    (match sum_ty with
     | TSum (a, _) ->
       if types_equal ty1 a then (sum_ty, st1)
       else raise (TypeError "Inl: type mismatch")
     | _ -> raise (TypeError "Inl: annotation not a sum type"))
  | TmInr (sum_ty, t1) ->
    let (ty1, st1) = typecheck ctx st t1 in
    (match sum_ty with
     | TSum (_, b) ->
       if types_equal ty1 b then (sum_ty, st1)
       else raise (TypeError "Inr: type mismatch")
     | _ -> raise (TypeError "Inr: annotation not a sum type"))
  | TmCase (t0, x1, t1, x2, t2) ->
    let (ty0, st0) = typecheck ctx st t0 in
    (match ty0 with
     | TSum (a, b) ->
       let (ty1, st1) = typecheck ((x1, a) :: ctx) st0 t1 in
       let (ty2, st2) = typecheck ((x2, b) :: ctx) st1 t2 in
       if types_equal ty1 ty2 then (ty1, st2)
       else raise (TypeError "Case: branch type mismatch")
     | _ -> raise (TypeError "Case: scrutinee not a sum"))

  (* --- Let and Seq --- *)
  | TmLet (x, t1, t2) ->
    let (ty1, st1) = typecheck ctx st t1 in
    typecheck ((x, ty1) :: ctx) st1 t2
  | TmSeq (t1, t2) ->
    let (ty1, st1) = typecheck ctx st t1 in
    if types_equal ty1 TUnit then typecheck ctx st1 t2
    else raise (TypeError "Seq: first term not Unit")

  (* --- References (Lecture 03a) --- *)
  | TmRef t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    let (st2, _loc) = store_typing_extend st1 ty1 in
    (TRef ty1, st2)

  | TmDeref t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    (match ty1 with
     | TRef a -> (a, st1)
     | _ -> raise (TypeError "Deref: not a reference"))

  | TmAssign (t1, t2) ->
    let (ty1, st1) = typecheck ctx st t1 in
    let (ty2, st2) = typecheck ctx st1 t2 in
    (match ty1 with
     | TRef a ->
       if types_equal a ty2 then (TUnit, st2)
       else raise (TypeError "Assign: type mismatch")
     | _ -> raise (TypeError "Assign: not a reference"))

  | TmLoc loc ->
    if loc < List.length st then
      (TRef (store_typing_lookup st loc), st)
    else
      raise (TypeError "Location out of bounds")

  (* --- Exceptions (Lecture 03b) --- *)
  | TmError ->
    (* error has any type -- we return a placeholder *)
    (* In a real implementation, we would need type inference or annotation *)
    raise (TypeError "Cannot infer type of bare error; use try-with")

  | TmTry (t1, t2) ->
    let (ty1, st1) = typecheck ctx st t1 in
    let (ty2, st2) = typecheck ctx st1 t2 in
    if types_equal ty1 ty2 then (ty1, st2)
    else raise (TypeError "Try: handler type mismatch")

  | TmRaise t1 ->
    let (_ty1, st1) = typecheck ctx st t1 in
    (* raise can have any result type -- need annotation in practice *)
    raise (TypeError "Cannot infer result type of raise; use annotation")

  (* --- Recursive types (Lecture 03c) --- *)
  | TmFold (mu_ty, t1) ->
    (match mu_ty with
     | TRec (x, body) ->
       let unfolded = type_subst x mu_ty body in
       let (ty1, st1) = typecheck ctx st t1 in
       if types_equal ty1 unfolded then (mu_ty, st1)
       else raise (TypeError "Fold: type mismatch with unfolded type")
     | _ -> raise (TypeError "Fold: annotation not a recursive type"))

  | TmUnfold (mu_ty, t1) ->
    (match mu_ty with
     | TRec (x, body) ->
       let (ty1, st1) = typecheck ctx st t1 in
       if types_equal ty1 mu_ty then
         let unfolded = type_subst x mu_ty body in
         (unfolded, st1)
       else raise (TypeError "Unfold: term does not have recursive type")
     | _ -> raise (TypeError "Unfold: annotation not a recursive type"))

  (* --- Fixed point (Lecture 03d) --- *)
  | TmFix t1 ->
    let (ty1, st1) = typecheck ctx st t1 in
    (match ty1 with
     | TArrow (a, b) ->
       if types_equal a b then (a, st1)
       else raise (TypeError "Fix: argument must have type T -> T")
     | _ -> raise (TypeError "Fix: argument not a function"))
```

---

## 5. Evaluator

### 5.1 Exception Handling in the Evaluator

We use an OCaml exception to represent raised exceptions in the interpreted language.

```ocaml
exception RuntimeError of string
exception RaisedException of value
```

### 5.2 The Evaluation Function

```ocaml
let rec eval (env : env) (s : store) (t : term) : value =
  match t with
  (* --- STLC core --- *)
  | TmVar x ->
    (match List.assoc_opt x env with
     | Some v -> v
     | None -> raise (RuntimeError ("Unbound variable: " ^ x)))

  | TmAbs (x, _ty, body) ->
    VClosure (x, body, env)

  | TmApp (t1, t2) ->
    let v1 = eval env s t1 in
    let v2 = eval env s t2 in
    (match v1 with
     | VClosure (x, body, clos_env) ->
       eval ((x, v2) :: clos_env) s body
     | _ -> raise (RuntimeError "Application: not a closure"))

  (* --- Booleans --- *)
  | TmTrue -> VBool true
  | TmFalse -> VBool false
  | TmIf (t1, t2, t3) ->
    (match eval env s t1 with
     | VBool true -> eval env s t2
     | VBool false -> eval env s t3
     | _ -> raise (RuntimeError "If: guard not a boolean"))

  (* --- Naturals --- *)
  | TmZero -> VNat 0
  | TmSucc t1 ->
    (match eval env s t1 with
     | VNat n -> VNat (n + 1)
     | _ -> raise (RuntimeError "Succ: not a nat"))
  | TmPred t1 ->
    (match eval env s t1 with
     | VNat 0 -> VNat 0
     | VNat n -> VNat (n - 1)
     | _ -> raise (RuntimeError "Pred: not a nat"))
  | TmIsZero t1 ->
    (match eval env s t1 with
     | VNat 0 -> VBool true
     | VNat _ -> VBool false
     | _ -> raise (RuntimeError "IsZero: not a nat"))

  (* --- Unit --- *)
  | TmUnit -> VUnit

  (* --- Products --- *)
  | TmPair (t1, t2) ->
    let v1 = eval env s t1 in
    let v2 = eval env s t2 in
    VPair (v1, v2)
  | TmFst t1 ->
    (match eval env s t1 with
     | VPair (v1, _) -> v1
     | _ -> raise (RuntimeError "Fst: not a pair"))
  | TmSnd t1 ->
    (match eval env s t1 with
     | VPair (_, v2) -> v2
     | _ -> raise (RuntimeError "Snd: not a pair"))

  (* --- Sums --- *)
  | TmInl (_, t1) -> VInl (eval env s t1)
  | TmInr (_, t1) -> VInr (eval env s t1)
  | TmCase (t0, x1, t1, x2, t2) ->
    (match eval env s t0 with
     | VInl v -> eval ((x1, v) :: env) s t1
     | VInr v -> eval ((x2, v) :: env) s t2
     | _ -> raise (RuntimeError "Case: not a sum value"))

  (* --- Let and Seq --- *)
  | TmLet (x, t1, t2) ->
    let v1 = eval env s t1 in
    eval ((x, v1) :: env) s t2
  | TmSeq (t1, t2) ->
    let _ = eval env s t1 in
    eval env s t2

  (* --- References (Lecture 03a) --- *)
  | TmRef t1 ->
    let v = eval env s t1 in
    let loc = store_alloc s v in
    VLoc loc

  | TmDeref t1 ->
    (match eval env s t1 with
     | VLoc loc -> store_lookup s loc
     | _ -> raise (RuntimeError "Deref: not a location"))

  | TmAssign (t1, t2) ->
    let v1 = eval env s t1 in
    let v2 = eval env s t2 in
    (match v1 with
     | VLoc loc ->
       store_update s loc v2;
       VUnit
     | _ -> raise (RuntimeError "Assign: not a location"))

  | TmLoc loc ->
    VLoc loc

  (* --- Exceptions (Lecture 03b) --- *)
  | TmError ->
    raise (RaisedException VUnit)

  | TmRaise t1 ->
    let v = eval env s t1 in
    raise (RaisedException v)

  | TmTry (t1, t2) ->
    (try eval env s t1
     with RaisedException _v ->
       eval env s t2)

  (* --- Recursive types (Lecture 03c) --- *)
  | TmFold (_, t1) ->
    let v = eval env s t1 in
    VFold v

  | TmUnfold (_, t1) ->
    (match eval env s t1 with
     | VFold v -> v
     | _ -> raise (RuntimeError "Unfold: not a folded value"))

  (* --- Fixed point (Lecture 03d) --- *)
  | TmFix t1 ->
    let v = eval env s t1 in
    (match v with
     | VClosure (x, body, clos_env) ->
       (* fix (fun x -> body) = body[x := fix (fun x -> body)] *)
       (* We use a lazy approach: create a recursive closure *)
       let rec fix_env = (x, VClosure (x, body, fix_env)) :: clos_env in
       eval fix_env s body
     | _ -> raise (RuntimeError "Fix: not a closure"))
```

**Key design decisions:**

1. **References** use the mutable `store` directly, which is threaded through all evaluation calls via the shared reference.

2. **Exceptions** use OCaml's own exception mechanism (`RaisedException`) to implement propagation. This is a common technique: the meta-language's exception mechanism implements the object language's exception mechanism.

3. **Fold/Unfold** are trivial at runtime: `fold` wraps a value in `VFold`, and `unfold` unwraps it.

4. **Fix** uses a clever trick: we create a recursive environment binding using OCaml's `let rec`. The variable `x` is bound to a closure whose environment contains the binding `x -> (the closure itself)`. This implements the fixed-point semantics without explicit unrolling.

---

## 6. Pretty Printing

```ocaml
let rec string_of_value (v : value) : string =
  match v with
  | VBool b -> string_of_bool b
  | VNat n -> string_of_int n
  | VUnit -> "()"
  | VClosure _ -> "<closure>"
  | VPair (v1, v2) ->
    "(" ^ string_of_value v1 ^ ", " ^ string_of_value v2 ^ ")"
  | VInl v1 -> "inl(" ^ string_of_value v1 ^ ")"
  | VInr v1 -> "inr(" ^ string_of_value v1 ^ ")"
  | VLoc loc -> "loc(" ^ string_of_int loc ^ ")"
  | VFold v1 -> "fold(" ^ string_of_value v1 ^ ")"

let rec string_of_type (t : ty) : string =
  match t with
  | TBool -> "Bool"
  | TNat -> "Nat"
  | TUnit -> "Unit"
  | TArrow (t1, t2) ->
    "(" ^ string_of_type t1 ^ " -> " ^ string_of_type t2 ^ ")"
  | TProd (t1, t2) ->
    "(" ^ string_of_type t1 ^ " * " ^ string_of_type t2 ^ ")"
  | TSum (t1, t2) ->
    "(" ^ string_of_type t1 ^ " + " ^ string_of_type t2 ^ ")"
  | TRef t1 -> "Ref " ^ string_of_type t1
  | TVar x -> x
  | TRec (x, body) -> "(mu " ^ x ^ ". " ^ string_of_type body ^ ")"
```

---

## 7. Testing

### 7.1 Helper Function

```ocaml
let run (t : term) : string =
  let s = empty_store () in
  try
    let v = eval [] s t in
    string_of_value v
  with
  | RaisedException v -> "Uncaught exception: " ^ string_of_value v
  | RuntimeError msg -> "Runtime error: " ^ msg
```

### 7.2 Reference Tests

```ocaml
(* Test 1: Simple reference cycle *)
(* let r = ref 0 in r := 1; !r  -->  1 *)
let test_ref_1 =
  TmLet ("r", TmRef TmZero,
    TmSeq (
      TmAssign (TmVar "r", TmSucc TmZero),
      TmDeref (TmVar "r")))

let () = assert (run test_ref_1 = "1")

(* Test 2: Aliasing *)
(* let r = ref 0 in let s = r in s := 5; !r  -->  5 *)
let test_ref_2 =
  TmLet ("r", TmRef TmZero,
    TmLet ("s", TmVar "r",
      TmSeq (
        TmAssign (TmVar "s", TmSucc (TmSucc (TmSucc (TmSucc (TmSucc TmZero))))),
        TmDeref (TmVar "r"))))

let () = assert (run test_ref_2 = "5")

(* Test 3: Counter with closure *)
(* let counter = ref 0 in
   let incr = fun _ -> counter := succ(!counter); !counter in
   let _ = incr unit in
   incr unit  -->  2 *)
let test_counter =
  TmLet ("counter", TmRef TmZero,
    TmLet ("incr",
      TmAbs ("_", TUnit,
        TmSeq (
          TmAssign (TmVar "counter", TmSucc (TmDeref (TmVar "counter"))),
          TmDeref (TmVar "counter"))),
      TmLet ("_", TmApp (TmVar "incr", TmUnit),
        TmApp (TmVar "incr", TmUnit))))

let () = assert (run test_counter = "2")
```

### 7.3 Exception Tests

```ocaml
(* Test 4: Simple error caught by try-with *)
(* try error with 42  -->  42 *)
let test_exn_1 =
  TmTry (TmError, TmSucc (TmSucc TmZero))

let () = assert (run test_exn_1 = "2")

(* Test 5: No error -- try returns normally *)
(* try 7 with 42  -->  7 *)
let seven = TmSucc(TmSucc(TmSucc(TmSucc(TmSucc(TmSucc(TmSucc TmZero))))))
let test_exn_2 = TmTry (seven, TmZero)

let () = assert (run test_exn_2 = "7")

(* Test 6: Nested try-with *)
(* try (try error with error) with 99  -->  99 *)
let ninety_nine =
  let rec build n = if n = 0 then TmZero else TmSucc (build (n-1)) in
  build 99

let test_exn_3 =
  TmTry (
    TmTry (TmError, TmError),
    ninety_nine)

let () = assert (run test_exn_3 = "99")
```

### 7.4 Recursive Type Tests

```ocaml
(* Define the NatList type: mu X. Unit + (Nat * X) *)
let nat_list_ty = TRec ("X", TSum (TUnit, TProd (TNat, TVar "X")))

(* nil = fold[NatList] (inl unit) *)
let nil_term =
  TmFold (nat_list_ty,
    TmInl (TSum (TUnit, TProd (TNat, nat_list_ty)), TmUnit))

(* cons h t = fold[NatList] (inr (h, t)) *)
let cons_term h t =
  TmFold (nat_list_ty,
    TmInr (TSum (TUnit, TProd (TNat, nat_list_ty)),
      TmPair (h, t)))

(* Test 7: Build a list [1, 2, 3] and check the head *)
let list_123 =
  cons_term (TmSucc TmZero)
    (cons_term (TmSucc (TmSucc TmZero))
      (cons_term (TmSucc (TmSucc (TmSucc TmZero)))
        nil_term))

(* head l = case (unfold l) of inl _ -> 0 | inr p -> fst p *)
let head_term l =
  TmCase (
    TmUnfold (nat_list_ty, l),
    "_", TmZero,
    "p", TmFst (TmVar "p"))

let test_list_1 = head_term list_123

let () = assert (run test_list_1 = "1")
```

### 7.5 Fixed-Point Tests

```ocaml
(* Test 8: Factorial using fix *)
(* fix (fun fact -> fun n -> if iszero n then 1 else n * fact (pred n)) *)
(* Simplified: we use repeated addition since we lack multiplication *)
(* Instead, let us compute: fix (fun f -> fun n -> if iszero n then 0 else succ (f (pred n))) *)
(* This computes the identity function on Nat via recursion *)
let test_fix_1 =
  TmApp (
    TmFix (
      TmAbs ("f", TArrow (TNat, TNat),
        TmAbs ("n", TNat,
          TmIf (TmIsZero (TmVar "n"),
            TmZero,
            TmSucc (TmApp (TmVar "f", TmPred (TmVar "n"))))))),
    TmSucc (TmSucc (TmSucc TmZero)))  (* apply to 3 *)

let () = assert (run test_fix_1 = "3")

(* Test 9: Sum of a recursive list using fix *)
(* sum = fix (fun f -> fun l ->
     case (unfold l) of
       inl _ -> 0
     | inr p -> (fst p) + f (snd p)) *)
(* We approximate addition using succ chains for simplicity *)
(* Instead, test: count elements in a list *)
let count_term =
  TmFix (
    TmAbs ("f", TArrow (nat_list_ty, TNat),
      TmAbs ("l", nat_list_ty,
        TmCase (
          TmUnfold (nat_list_ty, TmVar "l"),
          "_", TmZero,
          "p", TmSucc (TmApp (TmVar "f", TmSnd (TmVar "p")))))))

let test_fix_2 = TmApp (count_term, list_123)

let () = assert (run test_fix_2 = "3")
```

### 7.6 Combined Test: Mutable List with Exception Handling

```ocaml
(* Test 10: Try to get the head of an empty list, catch exception *)
(* safe_head l = try (case (unfold l) of inl _ -> raise 0 | inr p -> fst p)
                 with 0 *)
let test_combined =
  TmTry (
    TmCase (
      TmUnfold (nat_list_ty, nil_term),
      "_", TmRaise TmZero,
      "p", TmFst (TmVar "p")),
    TmZero)

(* Head of empty list raises, caught by handler returning 0 *)
let () = assert (run test_combined = "0")
```

---

## 8. Exercises

### Exercise 8.1: Mutable Counter ADT

Implement a counter as a pair of functions `(increment, read)` that share a mutable reference:

```ocaml
(* let counter = ref 0 in
   let incr = fun _ -> counter := succ(!counter); unit in
   let read = fun _ -> !counter in
   (incr, read) *)
```

Write a test that calls `incr` three times and verifies that `read` returns 3.

### Exercise 8.2: Exception-Based Search

Implement a function that searches a recursive list for a given value using exceptions for early return:

```ocaml
(* find : NatList -> Nat -> Bool
   Raises an exception with the found element if present.
   The outer handler converts the exception to true/false. *)
```

### Exercise 8.3: Recursive Tree Type

Define a binary tree type and implement an in-order traversal that collects elements into a list, using fold/unfold for both types.

### Exercise 8.4: Mutual Recursion via Fix

Implement `iseven` and `isodd` using the product-based encoding of mutual recursion from Lecture 03d. Test on several values.

### Exercise 8.5: Extend with Raise-with-Value

Modify the `TmTry` handler to receive the exception value. Change the evaluation so that `TmTry (t1, t2)` evaluates $t_2\;v$ when $t_1$ raises $v$, as described in Lecture 03b Section 2.5.

---

## 9. Common Pitfalls

1. **Forgetting to unfold before case analysis.** A value of type $\mu X.\, T$ cannot be directly case-analyzed. You must `unfold` it first to expose the sum/product structure.

2. **Store aliasing in tests.** Because the store is a mutable `ref`, all evaluation calls within a single `run` invocation share the same store. Be careful about leftover state between tests -- use `empty_store ()` for each test.

3. **Type annotation on fold.** The `fold` operation requires a type annotation specifying which recursive type is being constructed. Without it, the type checker cannot determine the type.

4. **Fix and non-function arguments.** The `fix` operator requires a function of type $T \to T$. Applying `fix` to a non-function raises a runtime error. In the type checker, this is caught statically.

5. **Infinite loops with fix.** Be careful when testing `fix` -- some terms diverge. Set a timeout or step limit in your evaluation loop if needed.

---

## 10. Summary

In this recitation, we extended the STLC interpreter with four major features:

- **Mutable references** using a store implemented as a mutable list, with `ref`, `deref` (`!`), and `:=` operations.
- **Exceptions** using OCaml's own exception mechanism for propagation, with `error`, `raise`, and `try`-`with`.
- **Recursive types** with explicit `fold`/`unfold` operations and type-level substitution.
- **The fix operator** for general recursion, implemented via recursive closures in the environment.

Each feature required extending both the type checker and the evaluator. The resulting interpreter handles a rich language capable of expressing recursive data structures, mutable state, error handling, and general recursion -- all within a type-safe framework.
