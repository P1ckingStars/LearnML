---
title: "Recitation 07: Higher-Kinded Types"
tags:
  - type-theory
  - lambda-cube
  - recitation
---
# Recitation 07: Higher-Kinded Types

## Overview

This recitation provides hands-on practice with the material from Lectures 07a--07d. We implement a kind checker, type-level beta-reduction, and bounded quantification in OCaml, and work through exercises connecting the formal theory to programming practice. Every OCaml code block is self-contained and runnable.

---

## 1. Implementing a Kind Checker

### 1.1 Representing Kinds and Type Expressions

We begin by defining OCaml types for kinds and type expressions.

```ocaml
(* kinds.ml *)

(** Kinds: classifying type expressions *)
type kind =
  | KStar                     (* * : the kind of proper types *)
  | KArrow of kind * kind     (* K1 => K2 : type operator kinds *)

(** Type expressions *)
type ty =
  | TVar of string                   (* X : type variable *)
  | TArrow of ty * ty                (* T1 -> T2 : function type *)
  | TForall of string * kind * ty    (* forall X :: K. T *)
  | TLam of string * kind * ty       (* \X :: K. T : type-level abstraction *)
  | TApp of ty * ty                  (* T1 T2 : type-level application *)
  | TBase of string                  (* Int, Bool, etc. *)

(** Kinding context: maps type variable names to their kinds *)
type kinding_ctx = (string * kind) list

(** Pretty-printing kinds *)
let rec pp_kind = function
  | KStar -> "*"
  | KArrow (k1, k2) ->
    let left = match k1 with
      | KArrow _ -> "(" ^ pp_kind k1 ^ ")"
      | _ -> pp_kind k1
    in
    left ^ " => " ^ pp_kind k2

(** Pretty-printing type expressions *)
let rec pp_ty = function
  | TVar x -> x
  | TArrow (t1, t2) ->
    let left = match t1 with
      | TArrow _ | TForall _ -> "(" ^ pp_ty t1 ^ ")"
      | _ -> pp_ty t1
    in
    left ^ " -> " ^ pp_ty t2
  | TForall (x, k, t) ->
    "forall " ^ x ^ " :: " ^ pp_kind k ^ ". " ^ pp_ty t
  | TLam (x, k, t) ->
    "\\(" ^ x ^ " :: " ^ pp_kind k ^ "). " ^ pp_ty t
  | TApp (t1, t2) ->
    let left = match t1 with
      | TLam _ | TForall _ -> "(" ^ pp_ty t1 ^ ")"
      | _ -> pp_ty t1
    in
    let right = match t2 with
      | TApp _ | TArrow _ | TLam _ | TForall _ -> "(" ^ pp_ty t2 ^ ")"
      | _ -> pp_ty t2
    in
    left ^ " " ^ right
  | TBase s -> s
```

### 1.2 The Kind Checker

The kind checker implements the kinding rules from Lecture 07a as a recursive function.

```ocaml
(** Kind checking errors *)
exception KindError of string

(** Look up a type variable in the kinding context *)
let lookup_kind (ctx : kinding_ctx) (x : string) : kind =
  match List.assoc_opt x ctx with
  | Some k -> k
  | None -> raise (KindError ("Unbound type variable: " ^ x))

(** Kind checking: given a context and a type expression, compute its kind.
    Implements the rules:
      K-Var:   Delta |- X :: Delta(X)
      K-Arrow: Delta |- T1 -> T2 :: *  when T1 :: * and T2 :: *
      K-All:   Delta |- (forall X::K. T) :: *  when Delta, X::K |- T :: *
      K-Abs:   Delta |- (\X::K1. T) :: K1 => K2  when Delta, X::K1 |- T :: K2
      K-App:   Delta |- T1 T2 :: K2  when T1 :: K1 => K2 and T2 :: K1
*)
let rec kind_check (ctx : kinding_ctx) (ty : ty) : kind =
  match ty with
  | TVar x ->
    (* K-Var *)
    lookup_kind ctx x

  | TBase _ ->
    (* Base types have kind * *)
    KStar

  | TArrow (t1, t2) ->
    (* K-Arrow: both sides must have kind * *)
    let k1 = kind_check ctx t1 in
    let k2 = kind_check ctx t2 in
    (match k1, k2 with
     | KStar, KStar -> KStar
     | KStar, _ ->
       raise (KindError ("Right side of arrow has kind " ^ pp_kind k2
                          ^ ", expected *"))
     | _, _ ->
       raise (KindError ("Left side of arrow has kind " ^ pp_kind k1
                          ^ ", expected *")))

  | TForall (x, k, body) ->
    (* K-All: body must have kind * in extended context *)
    let ctx' = (x, k) :: ctx in
    let kb = kind_check ctx' body in
    (match kb with
     | KStar -> KStar
     | _ ->
       raise (KindError ("Body of forall has kind " ^ pp_kind kb
                          ^ ", expected *")))

  | TLam (x, k1, body) ->
    (* K-Abs: lambda produces an arrow kind *)
    let ctx' = (x, k1) :: ctx in
    let k2 = kind_check ctx' body in
    KArrow (k1, k2)

  | TApp (t1, t2) ->
    (* K-App: t1 must have arrow kind, t2 must match domain *)
    let k1 = kind_check ctx t1 in
    let k2 = kind_check ctx t2 in
    (match k1 with
     | KArrow (kdom, kcod) ->
       if kdom = k2 then kcod
       else raise (KindError (
         "Kind mismatch in type application: operator expects "
         ^ pp_kind kdom ^ " but argument has kind " ^ pp_kind k2))
     | _ ->
       raise (KindError (
         "Type application of non-operator: " ^ pp_ty t1
         ^ " has kind " ^ pp_kind k1)))
```

### 1.3 Testing the Kind Checker

```ocaml
let () =
  let ctx = [] in

  (* Example 1: \X :: *. X  should have kind * => * *)
  let id_op = TLam ("X", KStar, TVar "X") in
  let k = kind_check ctx id_op in
  Printf.printf "%s :: %s\n" (pp_ty id_op) (pp_kind k);
  (* Output: \(X :: *). X :: * => * *)

  (* Example 2: \X :: *. X -> X  should have kind * => * *)
  let endo = TLam ("X", KStar, TArrow (TVar "X", TVar "X")) in
  let k = kind_check ctx endo in
  Printf.printf "%s :: %s\n" (pp_ty endo) (pp_kind k);
  (* Output: \(X :: *). X -> X :: * => * *)

  (* Example 3: \F :: (* => *). \X :: *. F X  should have
     (* => *) => * => * *)
  let apply_op =
    TLam ("F", KArrow (KStar, KStar),
      TLam ("X", KStar,
        TApp (TVar "F", TVar "X")))
  in
  let k = kind_check ctx apply_op in
  Printf.printf "%s :: %s\n" (pp_ty apply_op) (pp_kind k);
  (* Output: \(F :: * => *). \(X :: *). F X :: (* => *) => * => * *)

  (* Example 4: (\X :: *. X) Int  should have kind * *)
  let applied = TApp (TLam ("X", KStar, TVar "X"), TBase "Int") in
  let k = kind_check ctx applied in
  Printf.printf "%s :: %s\n" (pp_ty applied) (pp_kind k);
  (* Output: (\(X :: *). X) Int :: * *)

  (* Example 5: forall X :: *. X -> X  should have kind * *)
  let poly = TForall ("X", KStar, TArrow (TVar "X", TVar "X")) in
  let k = kind_check ctx poly in
  Printf.printf "%s :: %s\n" (pp_ty poly) (pp_kind k);
  (* Output: forall X :: *. X -> X :: * *)

  (* Example 6: Kind error: List List
     where List :: * => * *)
  let list_ty = TLam ("X", KStar, TVar "X") in
  (try
     let _ = kind_check ctx (TApp (list_ty, list_ty)) in
     Printf.printf "Unexpectedly succeeded\n"
   with KindError msg ->
     Printf.printf "Kind error (expected): %s\n" msg)
  (* Output: Kind error (expected): Kind mismatch in type application:
     operator expects * but argument has kind * => * *)
```

---

## 2. Type-Level Beta-Reduction

### 2.1 Substitution

```ocaml
(** Free type variables *)
let rec free_tvars = function
  | TVar x -> [x]
  | TBase _ -> []
  | TArrow (t1, t2) -> free_tvars t1 @ free_tvars t2
  | TForall (x, _, body) ->
    List.filter (fun v -> v <> x) (free_tvars body)
  | TLam (x, _, body) ->
    List.filter (fun v -> v <> x) (free_tvars body)
  | TApp (t1, t2) -> free_tvars t1 @ free_tvars t2

(** Generate a fresh variable name *)
let fresh_var (avoid : string list) (base : string) : string =
  if not (List.mem base avoid) then base
  else
    let rec try_n n =
      let candidate = base ^ string_of_int n in
      if List.mem candidate avoid then try_n (n + 1)
      else candidate
    in
    try_n 0

(** Capture-avoiding substitution: [X |-> S]T *)
let rec ty_subst (x : string) (s : ty) (t : ty) : ty =
  match t with
  | TVar y ->
    if y = x then s else TVar y
  | TBase b -> TBase b
  | TArrow (t1, t2) ->
    TArrow (ty_subst x s t1, ty_subst x s t2)
  | TForall (y, k, body) ->
    if y = x then
      (* x is shadowed; no substitution in body *)
      TForall (y, k, body)
    else if List.mem y (free_tvars s) then
      (* capture would occur; rename y *)
      let avoid = free_tvars s @ free_tvars body @ [x] in
      let y' = fresh_var avoid y in
      let body' = ty_subst y (TVar y') body in
      TForall (y', k, ty_subst x s body')
    else
      TForall (y, k, ty_subst x s body)
  | TLam (y, k, body) ->
    if y = x then
      TLam (y, k, body)
    else if List.mem y (free_tvars s) then
      let avoid = free_tvars s @ free_tvars body @ [x] in
      let y' = fresh_var avoid y in
      let body' = ty_subst y (TVar y') body in
      TLam (y', k, ty_subst x s body')
    else
      TLam (y, k, ty_subst x s body)
  | TApp (t1, t2) ->
    TApp (ty_subst x s t1, ty_subst x s t2)
```

### 2.2 Beta-Reduction and Normalization

```ocaml
(** Single-step type-level beta reduction.
    Returns Some t' if a redex was found, None otherwise. *)
let rec ty_beta_step (t : ty) : ty option =
  match t with
  | TApp (TLam (x, _k, body), arg) ->
    (* Beta redex found: (\X::K. body) arg --> [X |-> arg]body *)
    Some (ty_subst x arg body)
  | TApp (t1, t2) ->
    (* Try reducing t1 first, then t2 *)
    (match ty_beta_step t1 with
     | Some t1' -> Some (TApp (t1', t2))
     | None ->
       match ty_beta_step t2 with
       | Some t2' -> Some (TApp (t1, t2'))
       | None -> None)
  | TArrow (t1, t2) ->
    (match ty_beta_step t1 with
     | Some t1' -> Some (TArrow (t1', t2))
     | None ->
       match ty_beta_step t2 with
       | Some t2' -> Some (TArrow (t1, t2'))
       | None -> None)
  | TForall (x, k, body) ->
    (match ty_beta_step body with
     | Some body' -> Some (TForall (x, k, body'))
     | None -> None)
  | TLam (x, k, body) ->
    (match ty_beta_step body with
     | Some body' -> Some (TLam (x, k, body'))
     | None -> None)
  | TVar _ | TBase _ -> None

(** Normalize a type expression to beta-normal form. *)
let rec ty_normalize (t : ty) : ty =
  match ty_beta_step t with
  | Some t' -> ty_normalize t'
  | None -> t

(** Check if two type expressions are beta-equivalent. *)
let ty_equiv (t1 : ty) (t2 : ty) : bool =
  let n1 = ty_normalize t1 in
  let n2 = ty_normalize t2 in
  n1 = n2  (* structural equality after normalization *)
```

### 2.3 Testing Normalization

```ocaml
let () =
  Printf.printf "\n--- Type-Level Beta Reduction ---\n";

  (* (\X::*. X -> X) Int  -->  Int -> Int *)
  let t1 = TApp (TLam ("X", KStar, TArrow (TVar "X", TVar "X")),
                  TBase "Int") in
  let n1 = ty_normalize t1 in
  Printf.printf "%s  -->  %s\n" (pp_ty t1) (pp_ty n1);
  (* Output: (\(X :: *). X -> X) Int  -->  Int -> Int *)

  (* (\F :: (* => *). \X :: *. F X) (\Y :: *. Y -> Y) Int
     -->  Int -> Int *)
  let compose_test =
    TApp (
      TApp (
        TLam ("F", KArrow (KStar, KStar),
          TLam ("X", KStar,
            TApp (TVar "F", TVar "X"))),
        TLam ("Y", KStar, TArrow (TVar "Y", TVar "Y"))),
      TBase "Int")
  in
  let n2 = ty_normalize compose_test in
  Printf.printf "%s\n  -->  %s\n" (pp_ty compose_test) (pp_ty n2);
  (* Output: ...  -->  Int -> Int *)

  (* (\X::*. \Y::*. X) Int Bool  -->  Int *)
  let const_test =
    TApp (TApp (
      TLam ("X", KStar, TLam ("Y", KStar, TVar "X")),
      TBase "Int"), TBase "Bool")
  in
  let n3 = ty_normalize const_test in
  Printf.printf "%s  -->  %s\n" (pp_ty const_test) (pp_ty n3);
  (* Output: ...  -->  Int *)

  (* Type equivalence check *)
  let ta = TApp (TLam ("X", KStar, TVar "X"), TBase "Int") in
  let tb = TBase "Int" in
  Printf.printf "(%s) equiv (%s) = %b\n"
    (pp_ty ta) (pp_ty tb) (ty_equiv ta tb);
  (* Output: ... equiv ... = true *)

  (* Compose: (\F. \G. \X. F (G X)) List Option Int
     --> List (Option Int) *)
  let compose =
    TLam ("F", KArrow (KStar, KStar),
      TLam ("G", KArrow (KStar, KStar),
        TLam ("X", KStar,
          TApp (TVar "F", TApp (TVar "G", TVar "X")))))
  in
  let list_op = TLam ("A", KStar, TApp (TBase "List", TVar "A")) in
  let option_op = TLam ("A", KStar, TApp (TBase "Option", TVar "A")) in
  let composed = TApp (TApp (TApp (compose, list_op), option_op),
                       TBase "Int") in
  let n4 = ty_normalize composed in
  Printf.printf "Compose List Option Int  -->  %s\n" (pp_ty n4)
  (* Output: Compose List Option Int  -->  List (Option Int) *)
```

---

## 3. Implementing Bounded Quantification

### 3.1 Extended Syntax for F-sub

```ocaml
(* fsub.ml *)

(** Types in F-sub *)
type fsub_ty =
  | FVar of string
  | FTop
  | FArrow of fsub_ty * fsub_ty
  | FForall of string * fsub_ty * fsub_ty  (* forall X <: T1. T2 *)
  | FRecord of (string * fsub_ty) list

(** Terms in F-sub *)
type fsub_term =
  | EVar of string
  | EAbs of string * fsub_ty * fsub_term       (* \x:T. e *)
  | EApp of fsub_term * fsub_term               (* e1 e2 *)
  | ETAbs of string * fsub_ty * fsub_term       (* /\X<:T. e *)
  | ETApp of fsub_term * fsub_ty                (* e [T] *)
  | ERecord of (string * fsub_term) list        (* {l1=e1, ...} *)
  | EProj of fsub_term * string                 (* e.l *)

(** Context entries *)
type ctx_entry =
  | TermBind of string * fsub_ty     (* x : T *)
  | TypeBind of string * fsub_ty     (* X <: T *)

type fsub_ctx = ctx_entry list

(** Look up a type variable's bound *)
let rec lookup_bound (ctx : fsub_ctx) (x : string) : fsub_ty option =
  match ctx with
  | [] -> None
  | TypeBind (y, bound) :: _ when y = x -> Some bound
  | _ :: rest -> lookup_bound rest x

(** Look up a term variable's type *)
let rec lookup_type (ctx : fsub_ctx) (x : string) : fsub_ty option =
  match ctx with
  | [] -> None
  | TermBind (y, ty) :: _ when y = x -> Some ty
  | _ :: rest -> lookup_type rest x
```

### 3.2 Subtyping Algorithm (Kernel F-sub)

```ocaml
(** Subtyping check for kernel F-sub.
    Implements algorithmic subtyping:
      SA-Top:      T <: Top always
      SA-Refl:     X <: X always
      SA-TVar:     X <: T if X <: U in ctx and U <: T
      SA-Arrow:    S1->S2 <: T1->T2 if T1<:S1 and S2<:T2
      SA-All:      (forall X<:S1.S2) <: (forall X<:T1.T2)
                   if T1<:S1 and (under X<:T1) S2<:T2
      SA-Rcd:      width + depth subtyping for records
*)
exception SubtypeError of string

let rec is_subtype (ctx : fsub_ctx) (s : fsub_ty) (t : fsub_ty) : bool =
  match s, t with
  (* SA-Top: everything is a subtype of Top *)
  | _, FTop -> true

  (* SA-Refl-TVar: X <: X *)
  | FVar x, FVar y when x = y -> true

  (* SA-TVar: X <: T if X <: U in ctx and U <: T *)
  | FVar x, _ ->
    (match lookup_bound ctx x with
     | Some bound -> is_subtype ctx bound t
     | None -> false)

  (* SA-Arrow: contravariant in domain, covariant in codomain *)
  | FArrow (s1, s2), FArrow (t1, t2) ->
    is_subtype ctx t1 s1 && is_subtype ctx s2 t2

  (* SA-All (kernel): forall X<:S1.S2 <: forall X<:T1.T2
     requires T1 <: S1 and, under X <: T1, S2 <: T2 *)
  | FForall (x, s1, s2), FForall (y, t1, t2) ->
    (* For simplicity, require same variable name.
       A full implementation would handle alpha-equivalence. *)
    if x <> y then false
    else
      is_subtype ctx t1 s1 &&
      let ctx' = TypeBind (x, t1) :: ctx in
      is_subtype ctx' s2 t2

  (* SA-Rcd: width + depth subtyping *)
  | FRecord s_fields, FRecord t_fields ->
    List.for_all (fun (l, t_ty) ->
      match List.assoc_opt l s_fields with
      | Some s_ty -> is_subtype ctx s_ty t_ty
      | None -> false
    ) t_fields

  | _, _ -> false
```

### 3.3 Type Checker for F-sub

```ocaml
(** Substitution in F-sub types: [X |-> S]T *)
let rec fsub_ty_subst (x : string) (s : fsub_ty) (t : fsub_ty) : fsub_ty =
  match t with
  | FVar y -> if y = x then s else FVar y
  | FTop -> FTop
  | FArrow (t1, t2) ->
    FArrow (fsub_ty_subst x s t1, fsub_ty_subst x s t2)
  | FForall (y, bound, body) ->
    if y = x then FForall (y, fsub_ty_subst x s bound, body)
    else FForall (y, fsub_ty_subst x s bound, fsub_ty_subst x s body)
  | FRecord fields ->
    FRecord (List.map (fun (l, ty) -> (l, fsub_ty_subst x s ty)) fields)

(** Type checking for F-sub *)
exception TypeError of string

let rec typecheck (ctx : fsub_ctx) (e : fsub_term) : fsub_ty =
  match e with
  | EVar x ->
    (match lookup_type ctx x with
     | Some ty -> ty
     | None -> raise (TypeError ("Unbound variable: " ^ x)))

  | EAbs (x, ty, body) ->
    let ctx' = TermBind (x, ty) :: ctx in
    let body_ty = typecheck ctx' body in
    FArrow (ty, body_ty)

  | EApp (e1, e2) ->
    let ty1 = typecheck ctx e1 in
    let ty2 = typecheck ctx e2 in
    (match ty1 with
     | FArrow (t_dom, t_cod) ->
       if is_subtype ctx ty2 t_dom then t_cod
       else raise (TypeError "Argument type is not a subtype of parameter type")
     | _ -> raise (TypeError "Application of non-function"))

  | ETAbs (x, bound, body) ->
    let ctx' = TypeBind (x, bound) :: ctx in
    let body_ty = typecheck ctx' body in
    FForall (x, bound, body_ty)

  | ETApp (e, ty_arg) ->
    let e_ty = typecheck ctx e in
    (match e_ty with
     | FForall (x, bound, body) ->
       if is_subtype ctx ty_arg bound then
         fsub_ty_subst x ty_arg body
       else raise (TypeError (
         "Type argument is not a subtype of the bound"))
     | _ -> raise (TypeError "Type application to non-polymorphic term"))

  | ERecord fields ->
    FRecord (List.map (fun (l, e) -> (l, typecheck ctx e)) fields)

  | EProj (e, label) ->
    let e_ty = typecheck ctx e in
    (match e_ty with
     | FRecord fields ->
       (match List.assoc_opt label fields with
        | Some ty -> ty
        | None -> raise (TypeError ("No field " ^ label ^ " in record")))
     | _ -> raise (TypeError "Projection from non-record"))
```

### 3.4 Testing F-sub

```ocaml
let () =
  Printf.printf "\n--- F-sub Type Checking ---\n";

  (* Test 1: Bounded identity *)
  (* /\X <: Top. \x:X. x  :  forall X<:Top. X -> X *)
  let bounded_id =
    ETAbs ("X", FTop,
      EAbs ("x", FVar "X",
        EVar "x"))
  in
  let ty = typecheck [] bounded_id in
  Printf.printf "bounded_id : ";
  (match ty with
   | FForall (x, _, FArrow (FVar a, FVar b)) when a = x && b = x ->
     Printf.printf "forall %s<:Top. %s -> %s\n" x a b
   | _ -> Printf.printf "(unexpected type)\n");

  (* Test 2: Field extraction with bounded polymorphism *)
  (* /\X <: {name:String}. \x:X. x.name *)
  let name_ty = FRecord [("name", FVar "String")] in
  let get_name =
    ETAbs ("X", name_ty,
      EAbs ("x", FVar "X",
        EProj (EVar "x", "name")))
  in
  let ty2 = typecheck [TermBind ("String", FTop)] get_name in
  Printf.printf "get_name : ";
  (match ty2 with
   | FForall (_, _, FArrow (_, result)) ->
     Printf.printf "forall X<:{name:String}. X -> %s\n"
       (match result with FVar s -> s | _ -> "?")
   | _ -> Printf.printf "(unexpected type)\n");

  (* Test 3: Subtyping check *)
  Printf.printf "\n--- Subtyping Tests ---\n";
  let ctx = [] in

  (* {a:Int, b:Bool} <: {a:Int} *)
  let r1 = FRecord [("a", FVar "Int"); ("b", FVar "Bool")] in
  let r2 = FRecord [("a", FVar "Int")] in
  Printf.printf "{a:Int, b:Bool} <: {a:Int} = %b\n"
    (is_subtype ctx r1 r2);
  (* Output: true *)

  (* {a:Int} <: {a:Int, b:Bool} *)
  Printf.printf "{a:Int} <: {a:Int, b:Bool} = %b\n"
    (is_subtype ctx r2 r1);
  (* Output: false *)

  (* Arrow variance: (Top -> Int) <: (Int -> Top) *)
  let f1 = FArrow (FTop, FVar "Int") in
  let f2 = FArrow (FVar "Int", FTop) in
  Printf.printf "(Top -> Int) <: (Int -> Top) = %b\n"
    (is_subtype ctx f1 f2);
  (* Output: true, since Int <: Top (domain contra) and Int <: Top (co) *)

  (* (Int -> Top) <: (Top -> Int) should be false *)
  Printf.printf "(Int -> Top) <: (Top -> Int) = %b\n"
    (is_subtype ctx f2 f1)
  (* Output: false *)
```

---

## 4. Type-Level Encodings

### 4.1 Church Encoding of Pairs

```ocaml
(** Church-encoded pair type operator:
    Pair = \A::*. \B::*. forall R::*. (A -> B -> R) -> R *)
let church_pair_op =
  TLam ("A", KStar,
    TLam ("B", KStar,
      TForall ("R", KStar,
        TArrow (
          TArrow (TVar "A", TArrow (TVar "B", TVar "R")),
          TVar "R"))))

let () =
  Printf.printf "\n--- Church-Encoded Type Operators ---\n";

  (* Kind of Pair *)
  let k = kind_check [] church_pair_op in
  Printf.printf "Pair :: %s\n" (pp_kind k);
  (* Output: Pair :: * => * => * *)

  (* Pair Int Bool *)
  let pair_int_bool =
    TApp (TApp (church_pair_op, TBase "Int"), TBase "Bool")
  in
  let n = ty_normalize pair_int_bool in
  Printf.printf "Pair Int Bool = %s\n" (pp_ty n);
  (* Output: forall R :: *. (Int -> Bool -> R) -> R *)

  let k2 = kind_check [] pair_int_bool in
  Printf.printf "Pair Int Bool :: %s\n" (pp_kind k2)
  (* Output: Pair Int Bool :: * *)
```

### 4.2 Church Encoding of Maybe

```ocaml
(** Maybe = \A::*. forall R::*. R -> (A -> R) -> R *)
let church_maybe_op =
  TLam ("A", KStar,
    TForall ("R", KStar,
      TArrow (TVar "R",
        TArrow (TArrow (TVar "A", TVar "R"),
                TVar "R"))))

let () =
  let k = kind_check [] church_maybe_op in
  Printf.printf "Maybe :: %s\n" (pp_kind k);
  (* Output: Maybe :: * => * *)

  let maybe_int = TApp (church_maybe_op, TBase "Int") in
  let n = ty_normalize maybe_int in
  Printf.printf "Maybe Int = %s\n" (pp_ty n)
  (* Output: forall R :: *. R -> (Int -> R) -> R *)
```

### 4.3 Compose Type Operator

```ocaml
(** Compose = \F :: (* => *). \G :: (* => *). \X :: *. F (G X) *)
let compose_op =
  TLam ("F", KArrow (KStar, KStar),
    TLam ("G", KArrow (KStar, KStar),
      TLam ("X", KStar,
        TApp (TVar "F", TApp (TVar "G", TVar "X")))))

let () =
  let k = kind_check [] compose_op in
  Printf.printf "Compose :: %s\n" (pp_kind k);
  (* Output: Compose :: (* => *) => (* => *) => * => * *)

  (* Compose Maybe Maybe Int = Maybe (Maybe Int) *)
  let cmp = TApp (TApp (TApp (compose_op, church_maybe_op),
                        church_maybe_op), TBase "Int") in
  let n = ty_normalize cmp in
  Printf.printf "Compose Maybe Maybe Int = %s\n" (pp_ty n)
```

---

## 5. Higher-Kinded Types in Haskell

### 5.1 A Brief Tour

While we cannot run Haskell code in this recitation, understanding the correspondence to our formal system is valuable. The following shows how the type-theoretic concepts map to Haskell.

**Kind $*$ in Haskell:**

```haskell
-- Int :: *
-- Bool :: *
-- [Int] :: *     (List applied to Int)
-- Int -> Bool :: *
```

**Kind $* \to *$ in Haskell:**

```haskell
-- [] :: * -> *       (the list type constructor)
-- Maybe :: * -> *
-- IO :: * -> *
```

**Kind $(* \to *) \to * \to *$ in Haskell:**

```haskell
-- The Functor class parameter has kind * -> *
class Functor (f :: * -> *) where
  fmap :: (a -> b) -> f a -> f b

-- A higher-kinded type: applies a type constructor twice
type Twice (f :: * -> *) (a :: *) = f (f a)
-- Twice :: (* -> *) -> * -> *
-- Twice Maybe Int = Maybe (Maybe Int)
```

**Natural transformations:**

```haskell
-- A natural transformation from f to g
type Nat f g = forall a. f a -> g a
-- Nat :: (* -> *) -> (* -> *) -> *

-- Example: a natural transformation from Maybe to List
maybeToList :: Nat Maybe []
maybeToList Nothing  = []
maybeToList (Just x) = [x]
```

### 5.2 Functor and Monad as Higher-Kinded Type Classes

In our formal notation:

$$
\text{Functor} : (* \Rightarrow *) \to \text{Constraint}
$$

A Functor instance for a type constructor $F :: * \Rightarrow *$ provides:

$$
\text{fmap} : \forall A :: *.\; \forall B :: *.\; (A \to B) \to F\;A \to F\;B
$$

Similarly:

$$
\text{Monad} : (* \Rightarrow *) \to \text{Constraint}
$$

A Monad instance provides:

$$
\text{return} : \forall A :: *.\; A \to M\;A
$$

$$
\text{bind} : \forall A :: *.\; \forall B :: *.\; M\;A \to (A \to M\;B) \to M\;B
$$

### 5.3 Monad Transformers

Monad transformers are the canonical example of *higher-higher-kinded* types:

$$
\text{MonadTrans} : ((* \Rightarrow *) \Rightarrow * \Rightarrow *) \to \text{Constraint}
$$

A monad transformer $T :: (* \Rightarrow *) \Rightarrow * \Rightarrow *$ takes a monad $M :: * \Rightarrow *$ and produces a new monad $T\;M :: * \Rightarrow *$.

```haskell
class MonadTrans (t :: (* -> *) -> * -> *) where
  lift :: Monad m => m a -> t m a

-- StateT :: * -> (* -> *) -> * -> *
newtype StateT s m a = StateT { runStateT :: s -> m (a, s) }
```

---

## 6. Practice Problems

### Problem 6.1: Kinding Derivations

Derive the kind of each type expression, or explain why it is ill-kinded:

(a) $\lambda X :: *.\; \lambda Y :: *.\; X \to Y \to X$

(b) $(\lambda F :: (* \Rightarrow *).\; F\;\text{Int})\;(\lambda X :: *.\; X)$

(c) $\lambda X :: *.\; \text{List}\;(\text{List}\;X)$ (assuming $\text{List} :: * \Rightarrow *$)

(d) $\lambda F :: (* \Rightarrow * \Rightarrow *).\; \lambda X :: *.\; F\;X\;X$

### Problem 6.2: Normalization

Reduce each to beta-normal form:

(a) $(\lambda X :: *.\; \lambda Y :: *.\; X)\;\text{Bool}\;\text{Int}$

(b) $(\lambda F :: (* \Rightarrow *).\; \lambda G :: (* \Rightarrow *).\; \lambda X :: *.\; F\;(G\;X))\;(\lambda A :: *.\; A \to A)\;(\lambda B :: *.\; B \times B)\;\text{Nat}$

(c) $(\lambda X :: *.\; (\lambda Y :: *.\; Y)\;X)\;\text{Int}$

### Problem 6.3: Subtyping

Determine whether each subtyping judgment holds in kernel $F_{<:}$:

(a) $\{x : \text{Int}, y : \text{Bool}, z : \text{String}\} <: \{x : \text{Int}, y : \text{Bool}\}$

(b) $(\text{Top} \to \text{Int}) <: (\text{Int} \to \text{Top})$

(c) $(\forall X <: \{a : \text{Int}, b : \text{Bool}\}.\; X \to X) <: (\forall X <: \{a : \text{Int}\}.\; X \to X)$

(d) $(\text{Int} \to \text{Int}) <: (\text{Top} \to \text{Top})$

### Problem 6.4: PTS Identification

For each expression, determine which lambda cube system is the *least expressive* system in which it can be expressed:

(a) $\lambda x : \text{Nat}.\; x + 1 : \text{Nat} \to \text{Nat}$

(b) $\Lambda X.\; \lambda x : X.\; x : \forall X.\; X \to X$

(c) $\lambda X :: *.\; X \to X :: * \Rightarrow *$

(d) $\Pi n : \text{Nat}.\; \text{Vec}\;\text{Int}\;n$

---

## 7. Solutions to Selected Problems

### Solution 6.1 (a)

$\lambda X :: *.\; \lambda Y :: *.\; X \to Y \to X$

Derivation (bottom-up):

1. $X :: *, Y :: * \vdash X :: *$ by K-Var.
2. $X :: *, Y :: * \vdash Y :: *$ by K-Var.
3. $X :: *, Y :: * \vdash Y \to X :: *$ by K-Arrow from (2) and (1).
4. $X :: *, Y :: * \vdash X \to (Y \to X) :: *$ by K-Arrow from (1) and (3).
5. $X :: * \vdash \lambda Y :: *.\; X \to Y \to X :: * \Rightarrow *$ by K-Abs from (4).
6. $\emptyset \vdash \lambda X :: *.\; \lambda Y :: *.\; X \to Y \to X :: * \Rightarrow * \Rightarrow *$ by K-Abs from (5).

Kind: $* \Rightarrow * \Rightarrow *$.

### Solution 6.1 (b)

$(\lambda F :: (* \Rightarrow *).\; F\;\text{Int})\;(\lambda X :: *.\; X)$

First, kind-check the operator:
- $F :: (* \Rightarrow *) \vdash F :: * \Rightarrow *$ and $\text{Int} :: *$, so $F\;\text{Int} :: *$ by K-App.
- $\emptyset \vdash \lambda F :: (* \Rightarrow *).\; F\;\text{Int} :: (* \Rightarrow *) \Rightarrow *$ by K-Abs.

Next, kind-check the argument:
- $\emptyset \vdash \lambda X :: *.\; X :: * \Rightarrow *$ by K-Abs.

Domain of operator kind is $* \Rightarrow *$; argument has kind $* \Rightarrow *$. They match.

Result kind: $*$.

After normalization: $(\lambda X :: *.\; X)\;\text{Int} \longrightarrow_\beta \text{Int}$.

### Solution 6.2 (b)

$$(\lambda F.\; \lambda G.\; \lambda X.\; F\;(G\;X))\;(\lambda A.\; A \to A)\;(\lambda B.\; B \times B)\;\text{Nat}$$

Step 1: Apply the first argument.

$$(\lambda G.\; \lambda X.\; (\lambda A.\; A \to A)\;(G\;X))\;(\lambda B.\; B \times B)\;\text{Nat}$$

Step 2: Apply the second argument.

$$(\lambda X.\; (\lambda A.\; A \to A)\;((\lambda B.\; B \times B)\;X))\;\text{Nat}$$

Step 3: Apply the third argument.

$$(\lambda A.\; A \to A)\;((\lambda B.\; B \times B)\;\text{Nat})$$

Step 4: Reduce inner redex.

$$(\lambda A.\; A \to A)\;(\text{Nat} \times \text{Nat})$$

Step 5: Reduce outer redex.

$$(\text{Nat} \times \text{Nat}) \to (\text{Nat} \times \text{Nat})$$

### Solution 6.3 (c)

$$(\forall X <: \{a : \text{Int}, b : \text{Bool}\}.\; X \to X) <: (\forall X <: \{a : \text{Int}\}.\; X \to X)$$

By SA-All (kernel), we need:

1. $\{a : \text{Int}\} <: \{a : \text{Int}, b : \text{Bool}\}$? NO. The right-hand side has more fields; it is a *subtype* of the left, not a supertype. Record subtyping requires the subtype to have at least as many fields.

So this subtyping does **not** hold in kernel $F_{<:}$.

The bound on the left ($\{a : \text{Int}, b : \text{Bool}\}$) is more restrictive than the bound on the right ($\{a : \text{Int}\}$). For SA-All, we need the right bound to be a subtype of the left bound (contravariance), but $\{a : \text{Int}\}$ is a *supertype* of $\{a : \text{Int}, b : \text{Bool}\}$. The direction is wrong.

### Solution 6.4

(a) $\lambda{\to}$ (STLC): ordinary function, no polymorphism, no type operators, no dependent types.

(b) $\lambda 2$ (System F): requires polymorphism (terms depending on types).

(c) $\lambda\underline{\omega}$: requires type operators (types depending on types), but not polymorphism.

(d) $\lambda P$ (LF): requires types depending on terms ($\text{Vec}\;\text{Int}\;n$ where $n$ is a term variable).

---

## 8. Challenge: Implementing a PTS Type Checker

For ambitious students: implement a general PTS type checker in OCaml, parameterized by $(\mathcal{S}, \mathcal{A}, \mathcal{R})$. This is a significant undertaking but deeply instructive.

```ocaml
(* pts.ml - Skeleton for a Pure Type System type checker *)

(** PTS sorts are represented as strings *)
type sort = string

(** PTS expressions: unified syntax for terms, types, and kinds *)
type pts_expr =
  | PVar of string
  | PSort of sort
  | PPi of string * pts_expr * pts_expr    (* Pi x : A. B *)
  | PLam of string * pts_expr * pts_expr   (* \x : A. e *)
  | PApp of pts_expr * pts_expr            (* e1 e2 *)

(** PTS specification *)
type pts_spec = {
  sorts : sort list;
  axioms : (sort * sort) list;       (* (s1, s2) means s1 : s2 *)
  rules : (sort * sort * sort) list;  (* (s1, s2, s3) for Pi formation *)
}

(** Lambda cube specifications *)
let lambda_arrow : pts_spec = {
  sorts = ["*"; "Box"];
  axioms = [("*", "Box")];
  rules = [("*", "*", "*")];
}

let system_f : pts_spec = {
  sorts = ["*"; "Box"];
  axioms = [("*", "Box")];
  rules = [("*", "*", "*"); ("Box", "*", "*")];
}

let system_f_omega : pts_spec = {
  sorts = ["*"; "Box"];
  axioms = [("*", "Box")];
  rules = [("*", "*", "*"); ("Box", "*", "*"); ("Box", "Box", "Box")];
}

let calculus_of_constructions : pts_spec = {
  sorts = ["*"; "Box"];
  axioms = [("*", "Box")];
  rules = [
    ("*", "*", "*");
    ("Box", "*", "*");
    ("Box", "Box", "Box");
    ("*", "Box", "Box");
  ];
}

(** Beta-reduction for PTS expressions *)
let rec pts_subst (x : string) (s : pts_expr) (e : pts_expr) : pts_expr =
  match e with
  | PVar y -> if y = x then s else PVar y
  | PSort _ -> e
  | PPi (y, a, b) ->
    if y = x then PPi (y, pts_subst x s a, b)
    else PPi (y, pts_subst x s a, pts_subst x s b)
  | PLam (y, a, body) ->
    if y = x then PLam (y, pts_subst x s a, body)
    else PLam (y, pts_subst x s a, pts_subst x s body)
  | PApp (e1, e2) ->
    PApp (pts_subst x s e1, pts_subst x s e2)

let rec pts_normalize (e : pts_expr) : pts_expr =
  match e with
  | PApp (PLam (x, _, body), arg) ->
    pts_normalize (pts_subst x arg body)
  | PApp (e1, e2) ->
    let e1' = pts_normalize e1 in
    (match e1' with
     | PLam (x, _, body) -> pts_normalize (pts_subst x e2 body)
     | _ -> PApp (e1', pts_normalize e2))
  | PLam (x, a, body) -> PLam (x, pts_normalize a, pts_normalize body)
  | PPi (x, a, b) -> PPi (x, pts_normalize a, pts_normalize b)
  | PVar _ | PSort _ -> e

let pts_beta_eq (e1 : pts_expr) (e2 : pts_expr) : bool =
  pts_normalize e1 = pts_normalize e2

(** The main type checking function (skeleton).
    Full implementation is left as an exercise. *)
let rec pts_typecheck
    (spec : pts_spec)
    (ctx : (string * pts_expr) list)
    (e : pts_expr) : pts_expr =
  match e with
  | PSort s ->
    (* Axiom rule *)
    (match List.assoc_opt s spec.axioms with
     | Some s2 -> PSort s2
     | None -> failwith ("No axiom for sort " ^ s))

  | PVar x ->
    (* Variable rule *)
    (match List.assoc_opt x ctx with
     | Some ty -> ty
     | None -> failwith ("Unbound variable: " ^ x))

  | PPi (x, a, b) ->
    (* Product rule *)
    let s1 = pts_normalize (pts_typecheck spec ctx a) in
    let ctx' = (x, a) :: ctx in
    let s2 = pts_normalize (pts_typecheck spec ctx' b) in
    (match s1, s2 with
     | PSort sort1, PSort sort2 ->
       (match List.find_opt
                (fun (r1, r2, _) -> r1 = sort1 && r2 = sort2)
                spec.rules with
        | Some (_, _, sort3) -> PSort sort3
        | None -> failwith "No matching rule for this product type")
     | _ -> failwith "Pi domain/codomain must be classified by sorts")

  | PLam (x, a, body) ->
    (* Abstraction rule *)
    let ctx' = (x, a) :: ctx in
    let b = pts_typecheck spec ctx' body in
    let pi_ty = PPi (x, a, b) in
    (* Check that the Pi type is well-formed *)
    let _ = pts_typecheck spec ctx pi_ty in
    pi_ty

  | PApp (e1, e2) ->
    (* Application rule *)
    let ty1 = pts_normalize (pts_typecheck spec ctx e1) in
    let ty2 = pts_typecheck spec ctx e2 in
    (match ty1 with
     | PPi (x, a, b) ->
       if pts_beta_eq (pts_normalize ty2) (pts_normalize a) then
         pts_subst x e2 b
       else failwith "Type mismatch in application"
     | _ -> failwith "Application of non-function")
```

Test it with the polymorphic identity in System F:

```ocaml
let () =
  Printf.printf "\n--- PTS Type Checker ---\n";

  (* In System F: \X:*. \x:X. x  :  Pi X:*. X -> X *)
  let id_term =
    PLam ("X", PSort "*",
      PLam ("x", PVar "X",
        PVar "x"))
  in
  let ty = pts_typecheck system_f [] id_term in
  Printf.printf "Polymorphic identity has type: ";
  let rec pp_pts = function
    | PVar x -> x
    | PSort s -> s
    | PPi (x, a, b) ->
      if x = "_" || not (List.mem x (let rec fv = function
        | PVar y -> [y] | PSort _ -> [] | PPi (y, a, b) ->
          fv a @ List.filter ((<>) y) (fv b)
        | PLam (y, a, b) -> fv a @ List.filter ((<>) y) (fv b)
        | PApp (a, b) -> fv a @ fv b in fv b))
      then pp_pts a ^ " -> " ^ pp_pts b
      else "Pi " ^ x ^ ":" ^ pp_pts a ^ ". " ^ pp_pts b
    | PLam (x, a, b) ->
      "\\" ^ x ^ ":" ^ pp_pts a ^ ". " ^ pp_pts b
    | PApp (a, b) -> pp_pts a ^ " " ^ pp_pts b
  in
  Printf.printf "%s\n" (pp_pts ty)
  (* Expected output: Pi X:*. X -> X *)
```

---

## 9. Summary

This recitation covered:

1. **Kind checking** in OCaml: a recursive function mirroring the kinding rules from Lecture 07a, implemented as pattern matching on the type expression.

2. **Type-level beta-reduction**: capture-avoiding substitution and normalization at the type level, demonstrating that type-level computation terminates and produces unique normal forms.

3. **Bounded quantification**: subtyping and type checking for kernel $F_{<:}$, including record subtyping, arrow variance, and bounded polymorphism.

4. **Type-level encodings**: Church encodings of Pair, Maybe, and Compose as type operators in $F_\omega$.

5. **Higher-kinded types in Haskell**: the correspondence between our formal notation and Haskell's Functor, Monad, and monad transformer classes.

6. **PTS type checker**: a skeleton implementation showing how the uniform framework of Pure Type Systems can be implemented in OCaml, parameterized by the specification triple $(\mathcal{S}, \mathcal{A}, \mathcal{R})$.
