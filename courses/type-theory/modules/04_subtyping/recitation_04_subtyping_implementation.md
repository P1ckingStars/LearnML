---
title: "Recitation 04: Subtyping Implementation"
tags:
  - type-theory
  - subtyping
  - recitation
---
# Recitation 04: Subtyping Implementation

## Overview

This recitation is a hands-on guide to implementing a type checker with subtyping in OCaml. Every code block is runnable. By the end, you will have a complete implementation of the STLC with subtyping, records, and joins/meets that directly corresponds to the formal rules from Lectures 04a-04d.

**Prerequisites:** OCaml fluency, Recitations 01-03, Lectures 04a-04b.

---

## 1. Syntax Definitions

We start by defining the types and terms of our language.

### 1.1 Types

```ocaml
type label = string

type ty =
  | TBool
  | TNat
  | TArrow of ty * ty       (* T1 -> T2 *)
  | TProd of ty * ty         (* T1 * T2 *)
  | TSum of ty * ty          (* T1 + T2 *)
  | TRecord of (label * ty) list  (* {l1: T1, ..., ln: Tn} *)
  | TTop                     (* top type *)
  | TBot                     (* bottom type *)
```

### 1.2 Terms

```ocaml
type term =
  | TmVar of string
  | TmAbs of string * ty * term         (* \x:T. t *)
  | TmApp of term * term                (* t1 t2 *)
  | TmTrue
  | TmFalse
  | TmIf of term * term * term          (* if t1 then t2 else t3 *)
  | TmZero
  | TmSucc of term
  | TmPred of term
  | TmIsZero of term
  | TmPair of term * term               (* (t1, t2) *)
  | TmFst of term                       (* t.1 *)
  | TmSnd of term                       (* t.2 *)
  | TmInl of term * ty                  (* inl t as T *)
  | TmInr of term * ty                  (* inr t as T *)
  | TmCase of term * string * term * string * term
    (* case t of inl x => t1 | inr y => t2 *)
  | TmRecord of (label * term) list     (* {l1=t1, ..., ln=tn} *)
  | TmProj of term * label              (* t.l *)
```

### 1.3 Contexts

```ocaml
type context = (string * ty) list

let lookup (ctx : context) (x : string) : ty option =
  List.assoc_opt x ctx

let extend (ctx : context) (x : string) (t : ty) : context =
  (x, t) :: ctx
```

---

## 2. Pretty Printing

Before we implement the type checker, let us set up pretty printing so we can inspect results.

```ocaml
let rec pp_ty = function
  | TBool -> "Bool"
  | TNat -> "Nat"
  | TArrow (t1, t2) ->
    let s1 = match t1 with TArrow _ -> "(" ^ pp_ty t1 ^ ")" | _ -> pp_ty t1 in
    s1 ^ " -> " ^ pp_ty t2
  | TProd (t1, t2) -> pp_ty t1 ^ " * " ^ pp_ty t2
  | TSum (t1, t2) -> pp_ty t1 ^ " + " ^ pp_ty t2
  | TRecord fields ->
    let pp_field (l, t) = l ^ " : " ^ pp_ty t in
    "{" ^ String.concat ", " (List.map pp_field fields) ^ "}"
  | TTop -> "Top"
  | TBot -> "Bot"

let rec pp_term = function
  | TmVar x -> x
  | TmAbs (x, ty, t) ->
    "(\\(" ^ x ^ " : " ^ pp_ty ty ^ "). " ^ pp_term t ^ ")"
  | TmApp (t1, t2) -> "(" ^ pp_term t1 ^ " " ^ pp_term t2 ^ ")"
  | TmTrue -> "true"
  | TmFalse -> "false"
  | TmIf (t1, t2, t3) ->
    "(if " ^ pp_term t1 ^ " then " ^ pp_term t2 ^ " else " ^ pp_term t3 ^ ")"
  | TmZero -> "0"
  | TmSucc t -> "(succ " ^ pp_term t ^ ")"
  | TmPred t -> "(pred " ^ pp_term t ^ ")"
  | TmIsZero t -> "(iszero " ^ pp_term t ^ ")"
  | TmPair (t1, t2) -> "(" ^ pp_term t1 ^ ", " ^ pp_term t2 ^ ")"
  | TmFst t -> pp_term t ^ ".1"
  | TmSnd t -> pp_term t ^ ".2"
  | TmInl (t, ty) -> "(inl " ^ pp_term t ^ " as " ^ pp_ty ty ^ ")"
  | TmInr (t, ty) -> "(inr " ^ pp_term t ^ " as " ^ pp_ty ty ^ ")"
  | TmCase (t, x1, t1, x2, t2) ->
    "(case " ^ pp_term t ^ " of inl " ^ x1 ^ " => " ^ pp_term t1
    ^ " | inr " ^ x2 ^ " => " ^ pp_term t2 ^ ")"
  | TmRecord fields ->
    let pp_field (l, t) = l ^ " = " ^ pp_term t in
    "{" ^ String.concat ", " (List.map pp_field fields) ^ "}"
  | TmProj (t, l) -> pp_term t ^ "." ^ l
```

---

## 3. The Subtype Check

This is the heart of the module. We implement the algorithmic subtyping relation from Lecture 04b.

### 3.1 Basic Subtype Check

```ocaml
let rec is_subtype (s : ty) (t : ty) : bool =
  match (s, t) with
  (* SA-Top: everything is a subtype of Top *)
  | (_, TTop) -> true
  (* SA-Bot: Bot is a subtype of everything *)
  | (TBot, _) -> true
  (* SA-Bool: Bool <: Bool *)
  | (TBool, TBool) -> true
  (* SA-Nat: Nat <: Nat *)
  | (TNat, TNat) -> true
  (* SA-BoolNat: Bool <: Nat (optional, included here) *)
  | (TBool, TNat) -> true
  (* SA-Arrow: contravariant in domain, covariant in codomain *)
  | (TArrow (s1, s2), TArrow (t1, t2)) ->
    is_subtype t1 s1 && is_subtype s2 t2
  (* SA-Prod: covariant in both components *)
  | (TProd (s1, s2), TProd (t1, t2)) ->
    is_subtype s1 t1 && is_subtype s2 t2
  (* SA-Sum: covariant in both components *)
  | (TSum (s1, s2), TSum (t1, t2)) ->
    is_subtype s1 t1 && is_subtype s2 t2
  (* SA-Rcd: for each field in t, find a matching field in s *)
  | (TRecord s_fields, TRecord t_fields) ->
    List.for_all (fun (l_t, ty_t) ->
      match List.assoc_opt l_t s_fields with
      | Some ty_s -> is_subtype ty_s ty_t
      | None -> false
    ) t_fields
  (* No other subtyping relationships *)
  | _ -> false
```

### 3.2 Testing the Subtype Check

```ocaml
let () =
  (* Basic tests *)
  assert (is_subtype TBool TBool);
  assert (is_subtype TBool TNat);           (* Bool <: Nat *)
  assert (not (is_subtype TNat TBool));      (* Nat </: Bool *)
  assert (is_subtype TBot TBool);            (* Bot <: Bool *)
  assert (is_subtype TBool TTop);            (* Bool <: Top *)
  assert (is_subtype TBot TTop);             (* Bot <: Top *)

  (* Arrow subtyping: contravariant domain, covariant codomain *)
  (* Top -> Nat <: Nat -> Top *)
  assert (is_subtype
    (TArrow (TTop, TNat))
    (TArrow (TNat, TTop)));
  (* Nat -> Nat </: Bool -> Nat (without Bool <: Nat in domain direction) *)
  (* We need Bool <: Nat for the domain, but contravariance means
     we need the supertype's domain <: the subtype's domain.
     For Nat -> Nat <: Bool -> Nat, we need Bool <: Nat. That holds! *)
  assert (is_subtype
    (TArrow (TNat, TNat))
    (TArrow (TBool, TNat)));

  (* Record subtyping *)
  (* {x:Nat, y:Bool} <: {x:Nat} -- width *)
  assert (is_subtype
    (TRecord [("x", TNat); ("y", TBool)])
    (TRecord [("x", TNat)]));
  (* {x:Nat} </: {x:Nat, y:Bool} -- cannot add fields going up *)
  assert (not (is_subtype
    (TRecord [("x", TNat)])
    (TRecord [("x", TNat); ("y", TBool)])));
  (* {x:Bool} <: {x:Nat} -- depth, since Bool <: Nat *)
  assert (is_subtype
    (TRecord [("x", TBool)])
    (TRecord [("x", TNat)]));
  (* Permutation: {y:Bool, x:Nat} <: {x:Nat, y:Bool} *)
  assert (is_subtype
    (TRecord [("y", TBool); ("x", TNat)])
    (TRecord [("x", TNat); ("y", TBool)]));

  Printf.printf "All subtype tests passed!\n"
```

---

## 4. Joins and Meets

### 4.1 Computing Joins

The join (least upper bound) of two types.

```ocaml
let rec join (s : ty) (t : ty) : ty =
  match (s, t) with
  | (TTop, _) | (_, TTop) -> TTop
  | (TBot, t) -> t
  | (s, TBot) -> s
  | (TBool, TBool) -> TBool
  | (TNat, TNat) -> TNat
  | (TBool, TNat) | (TNat, TBool) -> TNat  (* since Bool <: Nat *)
  | (TArrow (s1, s2), TArrow (t1, t2)) ->
    (* Contravariant in domain: use meet *)
    (* Covariant in codomain: use join *)
    TArrow (meet s1 t1, join s2 t2)
  | (TProd (s1, s2), TProd (t1, t2)) ->
    TProd (join s1 t1, join s2 t2)
  | (TSum (s1, s2), TSum (t1, t2)) ->
    TSum (join s1 t1, join s2 t2)
  | (TRecord s_fields, TRecord t_fields) ->
    (* Join of records: keep only common fields, join their types *)
    let common = List.filter_map (fun (l, ty_s) ->
      match List.assoc_opt l t_fields with
      | Some ty_t -> Some (l, join ty_s ty_t)
      | None -> None
    ) s_fields in
    TRecord common
  (* Incompatible constructors: join is Top *)
  | _ -> TTop

and meet (s : ty) (t : ty) : ty =
  match (s, t) with
  | (TBot, _) | (_, TBot) -> TBot
  | (TTop, t) -> t
  | (s, TTop) -> s
  | (TBool, TBool) -> TBool
  | (TNat, TNat) -> TNat
  | (TBool, TNat) | (TNat, TBool) -> TBool  (* since Bool <: Nat *)
  | (TArrow (s1, s2), TArrow (t1, t2)) ->
    (* Contravariant in domain: use join *)
    (* Covariant in codomain: use meet *)
    TArrow (join s1 t1, meet s2 t2)
  | (TProd (s1, s2), TProd (t1, t2)) ->
    TProd (meet s1 t1, meet s2 t2)
  | (TSum (s1, s2), TSum (t1, t2)) ->
    TSum (meet s1 t1, meet s2 t2)
  | (TRecord s_fields, TRecord t_fields) ->
    (* Meet of records: take union of fields, meet common field types *)
    let common = List.filter_map (fun (l, ty_s) ->
      match List.assoc_opt l t_fields with
      | Some ty_t -> Some (l, meet ty_s ty_t)
      | None -> None
    ) s_fields in
    let only_s = List.filter (fun (l, _) ->
      not (List.mem_assoc l t_fields)
    ) s_fields in
    let only_t = List.filter (fun (l, _) ->
      not (List.mem_assoc l s_fields)
    ) t_fields in
    TRecord (common @ only_s @ only_t)
  (* Incompatible constructors: meet is Bot *)
  | _ -> TBot
```

### 4.2 Testing Joins and Meets

```ocaml
let () =
  (* Join of compatible types *)
  let j1 = join TBool TNat in
  assert (j1 = TNat);
  Printf.printf "join(Bool, Nat) = %s\n" (pp_ty j1);

  (* Join of arrows *)
  let j2 = join (TArrow (TNat, TBool)) (TArrow (TBool, TNat)) in
  Printf.printf "join(Nat->Bool, Bool->Nat) = %s\n" (pp_ty j2);
  (* Should be: meet(Nat,Bool) -> join(Bool,Nat) = Bool -> Nat *)

  (* Join of records: common fields only *)
  let j3 = join
    (TRecord [("x", TNat); ("y", TBool)])
    (TRecord [("x", TNat); ("z", TTop)]) in
  Printf.printf "join({x:Nat,y:Bool}, {x:Nat,z:Top}) = %s\n" (pp_ty j3);
  (* Should be: {x: Nat} *)

  (* Meet of records: union of fields *)
  let m1 = meet
    (TRecord [("x", TNat); ("y", TBool)])
    (TRecord [("x", TNat); ("z", TTop)]) in
  Printf.printf "meet({x:Nat,y:Bool}, {x:Nat,z:Top}) = %s\n" (pp_ty m1);
  (* Should be: {x: Nat, y: Bool, z: Top} *)

  (* Incompatible types *)
  let j4 = join (TArrow (TNat, TNat)) (TProd (TBool, TBool)) in
  assert (j4 = TTop);
  Printf.printf "join(Nat->Nat, Bool*Bool) = %s\n" (pp_ty j4);

  Printf.printf "All join/meet tests passed!\n"
```

---

## 5. The Type Checker

### 5.1 Error Handling

```ocaml
exception Type_error of string

let type_error msg = raise (Type_error msg)
```

### 5.2 Helper: Extracting Arrow Types

When checking an application `t1 t2`, we need `t1` to have an arrow type. This helper extracts the domain and codomain.

```ocaml
let extract_arrow (ty : ty) : ty * ty =
  match ty with
  | TArrow (t1, t2) -> (t1, t2)
  | _ -> type_error ("Expected arrow type, got " ^ pp_ty ty)

let extract_product (ty : ty) : ty * ty =
  match ty with
  | TProd (t1, t2) -> (t1, t2)
  | _ -> type_error ("Expected product type, got " ^ pp_ty ty)

let extract_sum (ty : ty) : ty * ty =
  match ty with
  | TSum (t1, t2) -> (t1, t2)
  | _ -> type_error ("Expected sum type, got " ^ pp_ty ty)

let extract_record (ty : ty) : (label * ty) list =
  match ty with
  | TRecord fields -> fields
  | _ -> type_error ("Expected record type, got " ^ pp_ty ty)
```

### 5.3 The Main Type Checker

This implements the algorithmic typing relation from Lecture 04b. It computes the minimal type of each term.

```ocaml
let rec typeof (ctx : context) (t : term) : ty =
  match t with
  | TmVar x ->
    (match lookup ctx x with
     | Some ty -> ty
     | None -> type_error ("Unbound variable: " ^ x))

  | TmAbs (x, ty_param, body) ->
    let ty_body = typeof (extend ctx x ty_param) body in
    TArrow (ty_param, ty_body)

  | TmApp (t1, t2) ->
    let ty1 = typeof ctx t1 in
    let (ty_domain, ty_codomain) = extract_arrow ty1 in
    let ty2 = typeof ctx t2 in
    if is_subtype ty2 ty_domain then
      ty_codomain
    else
      type_error (
        "Argument type " ^ pp_ty ty2
        ^ " is not a subtype of parameter type " ^ pp_ty ty_domain)

  | TmTrue -> TBool
  | TmFalse -> TBool

  | TmIf (t1, t2, t3) ->
    let ty1 = typeof ctx t1 in
    if not (is_subtype ty1 TBool) then
      type_error ("Condition must be Bool, got " ^ pp_ty ty1);
    let ty2 = typeof ctx t2 in
    let ty3 = typeof ctx t3 in
    join ty2 ty3  (* Use join for the result type *)

  | TmZero -> TNat
  | TmSucc t1 ->
    let ty1 = typeof ctx t1 in
    if is_subtype ty1 TNat then TNat
    else type_error ("succ expects Nat, got " ^ pp_ty ty1)
  | TmPred t1 ->
    let ty1 = typeof ctx t1 in
    if is_subtype ty1 TNat then TNat
    else type_error ("pred expects Nat, got " ^ pp_ty ty1)
  | TmIsZero t1 ->
    let ty1 = typeof ctx t1 in
    if is_subtype ty1 TNat then TBool
    else type_error ("iszero expects Nat, got " ^ pp_ty ty1)

  | TmPair (t1, t2) ->
    TProd (typeof ctx t1, typeof ctx t2)

  | TmFst t1 ->
    let ty1 = typeof ctx t1 in
    let (ty_l, _) = extract_product ty1 in
    ty_l

  | TmSnd t1 ->
    let ty1 = typeof ctx t1 in
    let (_, ty_r) = extract_product ty1 in
    ty_r

  | TmInl (t1, ty_annot) ->
    (match ty_annot with
     | TSum (ty_l, _ty_r) ->
       let ty1 = typeof ctx t1 in
       if is_subtype ty1 ty_l then ty_annot
       else type_error ("inl: " ^ pp_ty ty1 ^ " is not a subtype of " ^ pp_ty ty_l)
     | _ -> type_error "inl annotation must be a sum type")

  | TmInr (t1, ty_annot) ->
    (match ty_annot with
     | TSum (_ty_l, ty_r) ->
       let ty1 = typeof ctx t1 in
       if is_subtype ty1 ty_r then ty_annot
       else type_error ("inr: " ^ pp_ty ty1 ^ " is not a subtype of " ^ pp_ty ty_r)
     | _ -> type_error "inr annotation must be a sum type")

  | TmCase (t0, x1, t1, x2, t2) ->
    let ty0 = typeof ctx t0 in
    let (ty_l, ty_r) = extract_sum ty0 in
    let ty1 = typeof (extend ctx x1 ty_l) t1 in
    let ty2 = typeof (extend ctx x2 ty_r) t2 in
    join ty1 ty2  (* Use join for the result type *)

  | TmRecord fields ->
    let typed_fields = List.map (fun (l, t) ->
      (l, typeof ctx t)
    ) fields in
    TRecord typed_fields

  | TmProj (t1, label) ->
    let ty1 = typeof ctx t1 in
    let fields = extract_record ty1 in
    (match List.assoc_opt label fields with
     | Some ty -> ty
     | None -> type_error ("Record has no field " ^ label))
```

---

## 6. Testing the Type Checker

### 6.1 Basic Tests

```ocaml
let typecheck (t : term) : string =
  try
    let ty = typeof [] t in
    pp_ty ty
  with Type_error msg ->
    "ERROR: " ^ msg

let () =
  (* Identity function *)
  let id_nat = TmAbs ("x", TNat, TmVar "x") in
  Printf.printf "\\x:Nat. x : %s\n" (typecheck id_nat);
  (* Expected: Nat -> Nat *)

  (* Application with subtyping: pass Bool where Nat expected *)
  let app1 = TmApp (TmAbs ("x", TNat, TmVar "x"), TmTrue) in
  Printf.printf "(\\x:Nat. x) true : %s\n" (typecheck app1);
  (* Expected: Nat (since Bool <: Nat) *)

  (* Application with Top *)
  let app2 = TmApp (TmAbs ("x", TTop, TmVar "x"), TmZero) in
  Printf.printf "(\\x:Top. x) 0 : %s\n" (typecheck app2);
  (* Expected: Top *)

  Printf.printf "\n"
```

### 6.2 Record Subtyping Tests

```ocaml
let () =
  (* Record creation *)
  let r1 = TmRecord [("x", TmZero); ("y", TmTrue)] in
  Printf.printf "{x=0, y=true} : %s\n" (typecheck r1);
  (* Expected: {x : Nat, y : Bool} *)

  (* Record projection *)
  let proj1 = TmProj (r1, "x") in
  Printf.printf "{x=0, y=true}.x : %s\n" (typecheck proj1);
  (* Expected: Nat *)

  (* Function taking {x:Nat}, applied to {x:Nat, y:Bool} *)
  let f = TmAbs ("r", TRecord [("x", TNat)], TmProj (TmVar "r", "x")) in
  let app3 = TmApp (f, TmRecord [("x", TmZero); ("y", TmTrue)]) in
  Printf.printf "(\\r:{x:Nat}. r.x) {x=0, y=true} : %s\n" (typecheck app3);
  (* Expected: Nat (width subtyping on the argument) *)

  (* Width subtyping: extra field should be accepted *)
  let app4 = TmApp (f,
    TmRecord [("x", TmSucc TmZero); ("y", TmFalse); ("z", TmZero)]) in
  Printf.printf "(\\r:{x:Nat}. r.x) {x=1, y=false, z=0} : %s\n" (typecheck app4);
  (* Expected: Nat *)

  (* Depth subtyping: pass {x:Bool} where {x:Nat} expected *)
  let app5 = TmApp (f, TmRecord [("x", TmTrue)]) in
  Printf.printf "(\\r:{x:Nat}. r.x) {x=true} : %s\n" (typecheck app5);
  (* Expected: Nat (depth subtyping: Bool <: Nat) *)

  Printf.printf "\n"
```

### 6.3 Arrow Subtyping Tests

```ocaml
let () =
  (* A function that takes a (Nat -> Nat) function *)
  let apply_f = TmAbs ("f", TArrow (TNat, TNat),
    TmApp (TmVar "f", TmZero)) in
  Printf.printf "\\f:Nat->Nat. f 0 : %s\n" (typecheck apply_f);
  (* Expected: (Nat -> Nat) -> Nat *)

  (* Pass a (Top -> Nat) function: Top -> Nat <: Nat -> Nat
     because Nat <: Top (contravariance) and Nat <: Nat (covariance) *)
  let g = TmAbs ("x", TTop, TmZero) in  (* g : Top -> Nat *)
  let app6 = TmApp (apply_f, g) in
  Printf.printf "(\\f:Nat->Nat. f 0) (\\x:Top. 0) : %s\n" (typecheck app6);
  (* Expected: Nat *)

  (* Failing case: pass (Bool -> Nat) where (Nat -> Nat) expected *)
  (* Bool -> Nat <: Nat -> Nat? Need Nat <: Bool. No! *)
  (* But wait: for arrow subtyping S1->S2 <: T1->T2, we need T1 <: S1.
     Here S1=Bool, T1=Nat, so we need Nat <: Bool. That fails. *)
  (* Actually let me reconsider: Bool <: Nat.
     For Bool->Nat <: Nat->Nat: need Nat <: Bool (domain contra). No.
     So this should fail. *)
  let h = TmAbs ("x", TBool, TmZero) in
  Printf.printf "(\\f:Nat->Nat. f 0) (\\x:Bool. 0) : %s\n"
    (typecheck (TmApp (apply_f, h)));
  (* Expected: ERROR (Bool->Nat is not a subtype of Nat->Nat) *)

  Printf.printf "\n"
```

### 6.4 Conditional with Joins

```ocaml
let () =
  (* If-then-else with different branch types *)
  let cond1 = TmIf (TmTrue,
    TmRecord [("x", TmZero); ("y", TmTrue)],
    TmRecord [("x", TmSucc TmZero); ("z", TmFalse)]) in
  Printf.printf "if true then {x=0,y=true} else {x=1,z=false} : %s\n"
    (typecheck cond1);
  (* Expected: {x : Nat} (join keeps only common fields, both have x:Nat) *)
  (* Actually: join({x:Nat,y:Bool}, {x:Nat,z:Bool})
     = {x: join(Nat,Nat)} = {x: Nat} *)

  (* If-then-else with arrow types *)
  let cond2 = TmIf (TmTrue,
    TmAbs ("x", TNat, TmVar "x"),
    TmAbs ("x", TBool, TmZero)) in
  Printf.printf "if true then (\\x:Nat. x) else (\\x:Bool. 0) : %s\n"
    (typecheck cond2);
  (* Expected: join(Nat->Nat, Bool->Nat) = meet(Nat,Bool)->join(Nat,Nat)
     = Bool -> Nat *)

  Printf.printf "\n"
```

---

## 7. Evaluator

For completeness, here is a small-step evaluator so we can run programs.

### 7.1 Value Check

```ocaml
let rec is_value = function
  | TmAbs _ -> true
  | TmTrue -> true
  | TmFalse -> true
  | TmZero -> true
  | TmSucc t -> is_numeric_value t
  | TmPair (t1, t2) -> is_value t1 && is_value t2
  | TmInl (t, _) -> is_value t
  | TmInr (t, _) -> is_value t
  | TmRecord fields -> List.for_all (fun (_, t) -> is_value t) fields
  | _ -> false

and is_numeric_value = function
  | TmZero -> true
  | TmSucc t -> is_numeric_value t
  | _ -> false
```

### 7.2 Single-Step Evaluation

```ocaml
exception No_rule

let rec eval1 (t : term) : term =
  match t with
  | TmApp (TmAbs (x, _, body), v2) when is_value v2 ->
    subst x v2 body
  | TmApp (v1, t2) when is_value v1 ->
    TmApp (v1, eval1 t2)
  | TmApp (t1, t2) ->
    TmApp (eval1 t1, t2)

  | TmIf (TmTrue, t2, _) -> t2
  | TmIf (TmFalse, _, t3) -> t3
  | TmIf (t1, t2, t3) -> TmIf (eval1 t1, t2, t3)

  | TmSucc t1 -> TmSucc (eval1 t1)
  | TmPred TmZero -> TmZero
  | TmPred (TmSucc nv) when is_numeric_value nv -> nv
  | TmPred t1 -> TmPred (eval1 t1)
  | TmIsZero TmZero -> TmTrue
  | TmIsZero (TmSucc nv) when is_numeric_value nv -> TmFalse
  | TmIsZero t1 -> TmIsZero (eval1 t1)

  | TmPair (v1, t2) when is_value v1 -> TmPair (v1, eval1 t2)
  | TmPair (t1, t2) -> TmPair (eval1 t1, t2)
  | TmFst (TmPair (v1, _)) when is_value v1 -> v1
  | TmFst t1 -> TmFst (eval1 t1)
  | TmSnd (TmPair (_, v2)) when is_value v2 -> v2
  | TmSnd t1 -> TmSnd (eval1 t1)

  | TmInl (t1, ty) -> TmInl (eval1 t1, ty)
  | TmInr (t1, ty) -> TmInr (eval1 t1, ty)
  | TmCase (TmInl (v, _), x1, t1, _, _) when is_value v ->
    subst x1 v t1
  | TmCase (TmInr (v, _), _, _, x2, t2) when is_value v ->
    subst x2 v t2
  | TmCase (t0, x1, t1, x2, t2) ->
    TmCase (eval1 t0, x1, t1, x2, t2)

  | TmRecord fields ->
    let rec eval_fields = function
      | [] -> raise No_rule
      | (l, t) :: rest when is_value t ->
        (l, t) :: eval_fields rest
      | (l, t) :: rest ->
        (l, eval1 t) :: rest
    in
    TmRecord (eval_fields fields)
  | TmProj (TmRecord fields, label) when
      List.for_all (fun (_, t) -> is_value t) fields ->
    (match List.assoc_opt label fields with
     | Some v -> v
     | None -> raise No_rule)
  | TmProj (t1, label) ->
    TmProj (eval1 t1, label)

  | _ -> raise No_rule

and subst (x : string) (s : term) (t : term) : term =
  match t with
  | TmVar y -> if y = x then s else t
  | TmAbs (y, ty, body) ->
    if y = x then t  (* x is shadowed *)
    else TmAbs (y, ty, subst x s body)
  | TmApp (t1, t2) -> TmApp (subst x s t1, subst x s t2)
  | TmTrue -> TmTrue
  | TmFalse -> TmFalse
  | TmIf (t1, t2, t3) ->
    TmIf (subst x s t1, subst x s t2, subst x s t3)
  | TmZero -> TmZero
  | TmSucc t1 -> TmSucc (subst x s t1)
  | TmPred t1 -> TmPred (subst x s t1)
  | TmIsZero t1 -> TmIsZero (subst x s t1)
  | TmPair (t1, t2) -> TmPair (subst x s t1, subst x s t2)
  | TmFst t1 -> TmFst (subst x s t1)
  | TmSnd t1 -> TmSnd (subst x s t1)
  | TmInl (t1, ty) -> TmInl (subst x s t1, ty)
  | TmInr (t1, ty) -> TmInr (subst x s t1, ty)
  | TmCase (t0, x1, t1, x2, t2) ->
    let t0' = subst x s t0 in
    let t1' = if x1 = x then t1 else subst x s t1 in
    let t2' = if x2 = x then t2 else subst x s t2 in
    TmCase (t0', x1, t1', x2, t2')
  | TmRecord fields ->
    TmRecord (List.map (fun (l, t) -> (l, subst x s t)) fields)
  | TmProj (t1, label) ->
    TmProj (subst x s t1, label)
```

### 7.3 Multi-Step Evaluation

```ocaml
let rec eval (t : term) : term =
  try
    let t' = eval1 t in
    eval t'
  with No_rule -> t

let run (t : term) : unit =
  let ty_str = typecheck t in
  let result = eval t in
  Printf.printf "%s : %s ==> %s\n"
    (pp_term t) ty_str (pp_term result)
```

---

## 8. Integration Tests

### 8.1 End-to-End Examples

```ocaml
let () =
  Printf.printf "=== Integration Tests ===\n\n";

  (* Test 1: Record width subtyping in function application *)
  let get_x = TmAbs ("r", TRecord [("x", TNat)],
    TmProj (TmVar "r", "x")) in
  let point = TmRecord [("x", TmSucc (TmSucc TmZero));
                          ("y", TmSucc TmZero)] in
  run (TmApp (get_x, point));
  (* Expected: ... ==> (succ (succ 0)) *)

  (* Test 2: Nested records with subtyping *)
  let get_data_x = TmAbs ("r",
    TRecord [("data", TRecord [("x", TNat)])],
    TmProj (TmProj (TmVar "r", "data"), "x")) in
  let nested = TmRecord [
    ("name", TmTrue);
    ("data", TmRecord [("x", TmSucc TmZero); ("y", TmZero)])
  ] in
  run (TmApp (get_data_x, nested));
  (* Expected: ... ==> (succ 0) *)

  (* Test 3: Higher-order function with subtyping *)
  let apply = TmAbs ("f", TArrow (TNat, TNat),
    TmApp (TmVar "f", TmZero)) in
  let const_zero = TmAbs ("x", TTop, TmZero) in
  run (TmApp (apply, const_zero));
  (* Expected: ... ==> 0 *)
  (* Top -> Nat <: Nat -> Nat because Nat <: Top *)

  (* Test 4: Conditional with join *)
  let cond = TmIf (TmTrue,
    TmRecord [("a", TmZero); ("b", TmTrue)],
    TmRecord [("a", TmSucc TmZero); ("c", TmFalse)]) in
  Printf.printf "Conditional join type: %s\n" (typecheck cond);
  run cond;
  (* Type should be {a: Nat}, value should be {a=0, b=true} *)

  Printf.printf "\n"
```

### 8.2 Error Cases

```ocaml
let () =
  Printf.printf "=== Error Cases ===\n\n";

  (* Error 1: Missing field in record *)
  let bad1 = TmApp (
    TmAbs ("r", TRecord [("x", TNat); ("y", TNat)],
      TmProj (TmVar "r", "x")),
    TmRecord [("x", TmZero)]) in
  Printf.printf "Missing field: %s\n" (typecheck bad1);
  (* Expected: ERROR *)

  (* Error 2: Wrong direction of arrow subtyping *)
  let bad2 = TmApp (
    TmAbs ("f", TArrow (TBool, TNat),
      TmApp (TmVar "f", TmTrue)),
    TmAbs ("x", TNat, TmVar "x")) in
  Printf.printf "Wrong arrow direction: %s\n" (typecheck bad2);
  (* Nat -> Nat <: Bool -> Nat? Need Bool <: Nat (ok) and Nat <: Nat (ok).
     Actually this should succeed! Let me check:
     For S1->S2 <: T1->T2: T1 <: S1 and S2 <: T2.
     S = Nat->Nat, T = Bool->Nat.
     Need Bool <: Nat (yes, SA-BoolNat) and Nat <: Nat (yes). Works! *)
  (* Let me construct a genuine error instead *)
  let bad3 = TmApp (
    TmAbs ("f", TArrow (TTop, TNat),
      TmApp (TmVar "f", TmTrue)),
    TmAbs ("x", TNat, TmVar "x")) in
  Printf.printf "Genuine arrow error: %s\n" (typecheck bad3);
  (* Nat -> Nat <: Top -> Nat? Need Top <: Nat. No! ERROR *)

  Printf.printf "\n"
```

---

## 9. Subtype Check Properties

Let us verify some properties of our subtype check programmatically.

### 9.1 Reflexivity

```ocaml
let () =
  Printf.printf "=== Property Tests ===\n\n";

  (* Test reflexivity for a variety of types *)
  let types = [
    TBool; TNat; TTop; TBot;
    TArrow (TNat, TBool);
    TArrow (TArrow (TTop, TBot), TNat);
    TProd (TNat, TBool);
    TSum (TNat, TBool);
    TRecord [("x", TNat); ("y", TBool)];
    TRecord [];
  ] in
  List.iter (fun ty ->
    assert (is_subtype ty ty);
  ) types;
  Printf.printf "Reflexivity: PASSED for %d types\n" (List.length types)
```

### 9.2 Transitivity

```ocaml
let () =
  (* Test transitivity for specific triples *)
  let triples = [
    (TBool, TNat, TTop);
    (TBot, TBool, TNat);
    (TBot, TBot, TTop);
    (TArrow (TTop, TBot), TArrow (TNat, TBot), TArrow (TNat, TTop));
    (TRecord [("x", TNat); ("y", TBool); ("z", TTop)],
     TRecord [("x", TNat); ("y", TBool)],
     TRecord [("x", TNat)]);
  ] in
  List.iter (fun (a, b, c) ->
    assert (is_subtype a b);
    assert (is_subtype b c);
    assert (is_subtype a c);
  ) triples;
  Printf.printf "Transitivity: PASSED for %d triples\n" (List.length triples)
```

### 9.3 Arrow Contravariance

```ocaml
let () =
  (* Verify contravariance: if A <: B then (B -> C) <: (A -> C) *)
  let a = TBool in
  let b = TNat in
  assert (is_subtype a b);  (* Bool <: Nat *)
  assert (is_subtype (TArrow (b, TBool)) (TArrow (a, TBool)));
  (* Nat -> Bool <: Bool -> Bool (contravariant domain) *)
  assert (not (is_subtype (TArrow (a, TBool)) (TArrow (b, TBool))));
  (* Bool -> Bool </: Nat -> Bool *)
  Printf.printf "Arrow contravariance: PASSED\n"
```

### 9.4 Join/Meet Properties

```ocaml
let () =
  (* Verify join properties: S <: join(S,T) and T <: join(S,T) *)
  let pairs = [
    (TBool, TNat);
    (TArrow (TNat, TBool), TArrow (TBool, TNat));
    (TRecord [("x", TNat); ("y", TBool)],
     TRecord [("x", TBool); ("z", TTop)]);
  ] in
  List.iter (fun (s, t) ->
    let j = join s t in
    assert (is_subtype s j);
    assert (is_subtype t j);
  ) pairs;
  Printf.printf "Join upper bound: PASSED for %d pairs\n" (List.length pairs);

  (* Verify meet properties: meet(S,T) <: S and meet(S,T) <: T *)
  List.iter (fun (s, t) ->
    let m = meet s t in
    assert (is_subtype m s);
    assert (is_subtype m t);
  ) pairs;
  Printf.printf "Meet lower bound: PASSED for %d pairs\n" (List.length pairs);

  Printf.printf "\nAll property tests passed!\n"
```

---

## 10. Exercises

1. **Add variant types to the subtype check.** Implement a `TVariant of (label * ty) list` type constructor and add the appropriate cases to `is_subtype`. Remember that variant subtyping is dual to record subtyping: fewer alternatives means subtype.

2. **Implement `is_subtype` without `Bool <: Nat`.** Remove the SA-BoolNat rule and update the test suite. Which tests break?

3. **Add a `TRef of ty` type constructor** with invariant subtyping (require exact equality of the inner types). Extend the type checker to support `ref`, `!`, and `:=`.

4. **Implement the coercion translation.** Write a function `coerce : ty -> ty -> term -> term` that takes a source type, target type, and term, and wraps the term with an explicit coercion function.

5. **Stress-test joins.** Write a function that generates random types and verifies the join properties (upper bound and least upper bound) hold. Run it for 1000 random pairs.
