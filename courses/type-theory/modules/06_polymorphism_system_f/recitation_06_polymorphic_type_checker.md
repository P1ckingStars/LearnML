---
title: "Recitation 06: Polymorphic Type Checker"
tags:
  - type-theory
  - system-f
  - recitation
---
# Recitation 06: Polymorphic Type Checker

> **Module 06 --- Polymorphism & System F (Weeks 11--12)**
> Estimated time: 3--4 hours (hands-on)

---

## 1. Overview

In this recitation, we extend the STLC type checker from Recitation 02 to handle System F: universal types ($\forall X.\, T$), type abstraction ($\Lambda X.\, t$), type application ($t\;[T]$), existential types ($\exists X.\, T$), pack, and unpack. By the end, you will have a working type checker and interpreter for System F with existential types.

**Outline:**

1. Extending the AST with type variables, type abstraction, and type application.
2. Implementing capture-avoiding type substitution.
3. Type checking System F terms (T-TAbs, T-TApp).
4. Adding existential types (T-Pack, T-Unpack).
5. Implementing the evaluator with type-level beta reduction.
6. Testing with polymorphic examples: identity, Church encodings, ADTs.

**Prerequisites:** Working STLC type checker from Recitation 02 (or the reference implementation provided).

---

## 2. AST Extensions

### 2.1 Types

We extend the type AST to include type variables and universal/existential quantification.

```ocaml
(* types.ml *)

type ty =
  | TVar of string          (* type variable: X, Y, Z *)
  | TArrow of ty * ty       (* T1 -> T2 *)
  | TForall of string * ty  (* forall X. T *)
  | TExists of string * ty  (* exists X. T *)
  | TNat                    (* base type: Nat *)
  | TBool                   (* base type: Bool *)
```

**Design note.** We use named representation for type variables (strings). A more robust implementation would use de Bruijn indices for type variables to avoid capture issues, but named representation is clearer for pedagogy.

### 2.2 Terms

We extend the term AST with type abstraction, type application, pack, and unpack.

```ocaml
(* terms.ml *)

type term =
  | Var of string                       (* x *)
  | Abs of string * ty * term           (* \x : T. t *)
  | App of term * term                  (* t1 t2 *)
  | TAbs of string * term               (* /\X. t  (type abstraction) *)
  | TApp of term * ty                   (* t [T]   (type application) *)
  | Pack of ty * term * ty              (* {*S, t} as exists X. T *)
  | Unpack of string * string * term * term
      (* let {X, x} = t1 in t2 *)
  | IntLit of int                       (* integer literals *)
  | BoolLit of bool                     (* boolean literals *)
  | Succ of term                        (* succ t *)
  | Pred of term                        (* pred t *)
  | IsZero of term                      (* iszero t *)
  | If of term * term * term            (* if t1 then t2 else t3 *)
```

### 2.3 Values

```ocaml
type value =
  | VInt of int
  | VBool of bool
  | VClosure of string * term * env
  | VTAbs of string * term * env      (* type abstraction value *)
  | VPack of ty * value * ty           (* existential package value *)

and env = (string * value) list
```

---

## 3. Type Substitution

Type substitution $[X \mapsto S]\,T$ is the fundamental operation for System F. We must implement it carefully to handle variable capture.

### 3.1 Free Type Variables

```ocaml
(* Compute the set of free type variables in a type *)
let rec free_type_vars (t : ty) : StringSet.t =
  match t with
  | TVar x -> StringSet.singleton x
  | TArrow (t1, t2) ->
    StringSet.union (free_type_vars t1) (free_type_vars t2)
  | TForall (x, t1) ->
    StringSet.remove x (free_type_vars t1)
  | TExists (x, t1) ->
    StringSet.remove x (free_type_vars t1)
  | TNat | TBool -> StringSet.empty
```

### 3.2 Fresh Variable Generation

```ocaml
let counter = ref 0

let fresh_type_var (base : string) : string =
  let n = !counter in
  counter := n + 1;
  base ^ "_" ^ string_of_int n
```

### 3.3 Type Substitution

```ocaml
(* [x |-> s] t : substitute type s for type variable x in type t *)
let rec type_subst (x : string) (s : ty) (t : ty) : ty =
  match t with
  | TVar y ->
    if y = x then s else TVar y
  | TArrow (t1, t2) ->
    TArrow (type_subst x s t1, type_subst x s t2)
  | TForall (y, t1) ->
    if y = x then
      (* x is shadowed by the binder; no substitution *)
      TForall (y, t1)
    else if StringSet.mem y (free_type_vars s) then
      (* capture would occur; alpha-rename the bound variable *)
      let z = fresh_type_var y in
      let t1' = type_subst y (TVar z) t1 in
      TForall (z, type_subst x s t1')
    else
      TForall (y, type_subst x s t1)
  | TExists (y, t1) ->
    if y = x then
      TExists (y, t1)
    else if StringSet.mem y (free_type_vars s) then
      let z = fresh_type_var y in
      let t1' = type_subst y (TVar z) t1 in
      TExists (z, type_subst x s t1')
    else
      TExists (y, type_subst x s t1)
  | TNat -> TNat
  | TBool -> TBool
```

**Exercise 3.1.** Verify that `type_subst "X" (TVar "Y") (TForall ("Y", TArrow (TVar "X", TVar "Y")))` correctly alpha-renames to avoid capture. The result should be `TForall ("Y_0", TArrow (TVar "Y", TVar "Y_0"))` (or similar fresh name), not `TForall ("Y", TArrow (TVar "Y", TVar "Y"))`.

### 3.4 Type Substitution in Terms

We also need to substitute types within terms (for type applications and unpack).

```ocaml
(* Substitute type s for type variable x in term t *)
let rec type_subst_in_term (x : string) (s : ty) (tm : term) : term =
  match tm with
  | Var y -> Var y
  | Abs (y, ty1, body) ->
    Abs (y, type_subst x s ty1, type_subst_in_term x s body)
  | App (t1, t2) ->
    App (type_subst_in_term x s t1, type_subst_in_term x s t2)
  | TAbs (y, body) ->
    if y = x then TAbs (y, body)  (* shadowed *)
    else TAbs (y, type_subst_in_term x s body)
  | TApp (t1, ty1) ->
    TApp (type_subst_in_term x s t1, type_subst x s ty1)
  | Pack (witness, t1, exist_ty) ->
    Pack (type_subst x s witness,
          type_subst_in_term x s t1,
          type_subst x s exist_ty)
  | Unpack (ty_var, tm_var, t1, t2) ->
    let t1' = type_subst_in_term x s t1 in
    let t2' =
      if ty_var = x then t2  (* shadowed by unpack's type binder *)
      else type_subst_in_term x s t2
    in
    Unpack (ty_var, tm_var, t1', t2')
  | IntLit n -> IntLit n
  | BoolLit b -> BoolLit b
  | Succ t1 -> Succ (type_subst_in_term x s t1)
  | Pred t1 -> Pred (type_subst_in_term x s t1)
  | IsZero t1 -> IsZero (type_subst_in_term x s t1)
  | If (t1, t2, t3) ->
    If (type_subst_in_term x s t1,
        type_subst_in_term x s t2,
        type_subst_in_term x s t3)
```

---

## 4. Type Equality

We need type equality that respects alpha-equivalence. For our named representation, we implement it by normalizing bound variable names.

```ocaml
(* Check if two types are alpha-equivalent *)
let rec types_equal (t1 : ty) (t2 : ty) : bool =
  match t1, t2 with
  | TVar x, TVar y -> x = y
  | TArrow (a1, b1), TArrow (a2, b2) ->
    types_equal a1 a2 && types_equal b1 b2
  | TForall (x, body1), TForall (y, body2) ->
    if x = y then types_equal body1 body2
    else
      (* alpha-rename: substitute a fresh variable for both *)
      let z = fresh_type_var "alpha" in
      let body1' = type_subst x (TVar z) body1 in
      let body2' = type_subst y (TVar z) body2 in
      types_equal body1' body2'
  | TExists (x, body1), TExists (y, body2) ->
    if x = y then types_equal body1 body2
    else
      let z = fresh_type_var "alpha" in
      let body1' = type_subst x (TVar z) body1 in
      let body2' = type_subst y (TVar z) body2 in
      types_equal body1' body2'
  | TNat, TNat -> true
  | TBool, TBool -> true
  | _ -> false
```

---

## 5. The Type Checker

### 5.1 Typing Context

The typing context now has two kinds of bindings: term variables with types, and type variable declarations.

```ocaml
type binding =
  | VarBind of ty        (* x : T *)
  | TyVarBind            (* X (type variable in scope) *)

type context = (string * binding) list

(* Look up a term variable *)
let lookup_var (ctx : context) (x : string) : ty option =
  match List.assoc_opt x ctx with
  | Some (VarBind ty) -> Some ty
  | _ -> None

(* Check if a type variable is in scope *)
let is_type_var_bound (ctx : context) (x : string) : bool =
  match List.assoc_opt x ctx with
  | Some TyVarBind -> true
  | _ -> false
```

### 5.2 Well-Formedness of Types

Before using a type, we must check that all its free type variables are in scope.

```ocaml
let rec well_formed_type (ctx : context) (t : ty) : bool =
  match t with
  | TVar x -> is_type_var_bound ctx x
  | TArrow (t1, t2) ->
    well_formed_type ctx t1 && well_formed_type ctx t2
  | TForall (x, t1) ->
    well_formed_type ((x, TyVarBind) :: ctx) t1
  | TExists (x, t1) ->
    well_formed_type ((x, TyVarBind) :: ctx) t1
  | TNat | TBool -> true
```

### 5.3 The Type Checking Function

```ocaml
exception Type_error of string

let rec typeof (ctx : context) (t : term) : ty =
  match t with
  | Var x ->
    (match lookup_var ctx x with
     | Some ty -> ty
     | None -> raise (Type_error ("Unbound variable: " ^ x)))

  | Abs (x, ty1, body) ->
    if not (well_formed_type ctx ty1) then
      raise (Type_error ("Ill-formed type annotation on " ^ x));
    let ctx' = (x, VarBind ty1) :: ctx in
    let ty2 = typeof ctx' body in
    TArrow (ty1, ty2)

  | App (t1, t2) ->
    let ty1 = typeof ctx t1 in
    let ty2 = typeof ctx t2 in
    (match ty1 with
     | TArrow (ty_param, ty_ret) ->
       if types_equal ty2 ty_param then ty_ret
       else raise (Type_error
         "Argument type mismatch in application")
     | _ -> raise (Type_error
         "Application of non-function"))

  (* === NEW: Type abstraction (T-TAbs) === *)
  | TAbs (x, body) ->
    let ctx' = (x, TyVarBind) :: ctx in
    let ty_body = typeof ctx' body in
    TForall (x, ty_body)

  (* === NEW: Type application (T-TApp) === *)
  | TApp (t1, ty_arg) ->
    if not (well_formed_type ctx ty_arg) then
      raise (Type_error "Ill-formed type argument");
    let ty1 = typeof ctx t1 in
    (match ty1 with
     | TForall (x, ty_body) ->
       type_subst x ty_arg ty_body
     | _ -> raise (Type_error
         "Type application to non-polymorphic term"))

  (* === NEW: Pack (T-Pack) === *)
  | Pack (witness_ty, t1, exist_ty) ->
    if not (well_formed_type ctx exist_ty) then
      raise (Type_error "Ill-formed existential type");
    (match exist_ty with
     | TExists (x, ty_body) ->
       let expected = type_subst x witness_ty ty_body in
       let actual = typeof ctx t1 in
       if types_equal actual expected then exist_ty
       else raise (Type_error
         "Pack: term type does not match witness instantiation")
     | _ -> raise (Type_error
         "Pack: annotation is not an existential type"))

  (* === NEW: Unpack (T-Unpack) === *)
  | Unpack (ty_var, tm_var, t1, t2) ->
    let ty1 = typeof ctx t1 in
    (match ty1 with
     | TExists (x, ty_body) ->
       (* Substitute the existential's bound variable with
          our local type variable name *)
       let ty_inner = type_subst x (TVar ty_var) ty_body in
       let ctx' = (ty_var, TyVarBind) ::
                  (tm_var, VarBind ty_inner) :: ctx in
       let ty2 = typeof ctx' t2 in
       (* Check that the result type does not mention
          the abstract type variable *)
       if StringSet.mem ty_var (free_type_vars ty2) then
         raise (Type_error
           ("Unpack: result type mentions abstract type variable "
            ^ ty_var))
       else ty2
     | _ -> raise (Type_error
         "Unpack: scrutinee is not an existential package"))

  (* Existing STLC rules *)
  | IntLit _ -> TNat
  | BoolLit _ -> TBool
  | Succ t1 ->
    let ty1 = typeof ctx t1 in
    if types_equal ty1 TNat then TNat
    else raise (Type_error "succ expects Nat")
  | Pred t1 ->
    let ty1 = typeof ctx t1 in
    if types_equal ty1 TNat then TNat
    else raise (Type_error "pred expects Nat")
  | IsZero t1 ->
    let ty1 = typeof ctx t1 in
    if types_equal ty1 TNat then TBool
    else raise (Type_error "iszero expects Nat")
  | If (t1, t2, t3) ->
    let ty1 = typeof ctx t1 in
    if not (types_equal ty1 TBool) then
      raise (Type_error "if condition must be Bool");
    let ty2 = typeof ctx t2 in
    let ty3 = typeof ctx t3 in
    if types_equal ty2 ty3 then ty2
    else raise (Type_error "if branches must have same type")
```

### 5.4 Walkthrough: Typing the Polymorphic Identity

Let us trace the type checker on $\Lambda X.\, \lambda x : X.\, x$:

```ocaml
let poly_id = TAbs ("X", Abs ("x", TVar "X", Var "x"))
```

1. `typeof [] (TAbs ("X", ...))`:
   - Extend context: `ctx' = [("X", TyVarBind)]`.
   - Recurse: `typeof [("X", TyVarBind)] (Abs ("x", TVar "X", Var "x"))`.

2. `typeof [("X", TyVarBind)] (Abs ("x", TVar "X", Var "x"))`:
   - Check `well_formed_type ctx (TVar "X")`: "X" is bound, so yes.
   - Extend context: `ctx' = [("x", VarBind (TVar "X")); ("X", TyVarBind)]`.
   - Recurse: `typeof ctx' (Var "x")` returns `TVar "X"`.
   - Return: `TArrow (TVar "X", TVar "X")`.

3. Back in step 1: return `TForall ("X", TArrow (TVar "X", TVar "X"))`.

Result: $\forall X.\, X \to X$.

---

## 6. The Evaluator

### 6.1 The Evaluation Function

```ocaml
let rec eval (env : env) (t : term) : value =
  match t with
  | Var x ->
    (match List.assoc_opt x env with
     | Some v -> v
     | None -> failwith ("Unbound variable in eval: " ^ x))

  | Abs (x, _, body) ->
    VClosure (x, body, env)

  | App (t1, t2) ->
    let v1 = eval env t1 in
    let v2 = eval env t2 in
    (match v1 with
     | VClosure (x, body, clos_env) ->
       eval ((x, v2) :: clos_env) body
     | _ -> failwith "Application of non-closure")

  (* === NEW: Type abstraction === *)
  | TAbs (x, body) ->
    VTAbs (x, body, env)

  (* === NEW: Type application (type erasure) === *)
  | TApp (t1, _ty) ->
    let v1 = eval env t1 in
    (match v1 with
     | VTAbs (_x, body, clos_env) ->
       (* At runtime, type application is a no-op:
          we simply evaluate the body.
          Type information is erased. *)
       eval clos_env body
     | _ -> failwith "Type application of non-type-abstraction")

  (* === NEW: Pack (evaluate the inner term) === *)
  | Pack (witness, t1, exist_ty) ->
    let v1 = eval env t1 in
    VPack (witness, v1, exist_ty)

  (* === NEW: Unpack === *)
  | Unpack (_ty_var, tm_var, t1, t2) ->
    let v1 = eval env t1 in
    (match v1 with
     | VPack (_witness, inner_val, _exist_ty) ->
       (* Bind the inner value to the term variable.
          Type variable is erased at runtime. *)
       eval ((tm_var, inner_val) :: env) t2
     | _ -> failwith "Unpack of non-package")

  | IntLit n -> VInt n
  | BoolLit b -> VBool b
  | Succ t1 ->
    (match eval env t1 with
     | VInt n -> VInt (n + 1)
     | _ -> failwith "succ: not an int")
  | Pred t1 ->
    (match eval env t1 with
     | VInt 0 -> VInt 0
     | VInt n -> VInt (n - 1)
     | _ -> failwith "pred: not an int")
  | IsZero t1 ->
    (match eval env t1 with
     | VInt 0 -> VBool true
     | VInt _ -> VBool false
     | _ -> failwith "iszero: not an int")
  | If (t1, t2, t3) ->
    (match eval env t1 with
     | VBool true -> eval env t2
     | VBool false -> eval env t3
     | _ -> failwith "if: not a bool")
```

**Key design decision: type erasure.** In the evaluator, type abstraction creates a value (`VTAbs`), and type application simply evaluates the body of the type abstraction, discarding the type argument. This implements the type erasure semantics: types play no computational role at runtime.

**Remark on the evaluator design.** In a more faithful implementation of System F's operational semantics, `TApp` would perform a type substitution in the body before evaluation. However, since our evaluator uses an environment (closures) rather than substitution, and types are erased, we can simply evaluate the body in the closure's environment. The type information has already been checked by the type checker.

---

## 7. Testing

### 7.1 Polymorphic Identity

```ocaml
(* /\X. \x:X. x : forall X. X -> X *)
let poly_id = TAbs ("X", Abs ("x", TVar "X", Var "x"))

let () =
  let ty = typeof [] poly_id in
  assert (types_equal ty (TForall ("X", TArrow (TVar "X", TVar "X"))));
  Printf.printf "poly_id : %s\n" (string_of_ty ty)

(* poly_id [Nat] 42 = 42 *)
let test_id_nat = App (TApp (poly_id, TNat), IntLit 42)

let () =
  let ty = typeof [] test_id_nat in
  assert (types_equal ty TNat);
  let v = eval [] test_id_nat in
  assert (v = VInt 42);
  Printf.printf "poly_id [Nat] 42 = %s : %s\n"
    (string_of_value v) (string_of_ty ty)

(* poly_id [Bool] true = true *)
let test_id_bool = App (TApp (poly_id, TBool), BoolLit true)

let () =
  let ty = typeof [] test_id_bool in
  assert (types_equal ty TBool);
  let v = eval [] test_id_bool in
  assert (v = VBool true)
```

### 7.2 Polymorphic Constant Function

```ocaml
(* /\X. /\Y. \x:X. \y:Y. x  :  forall X. forall Y. X -> Y -> X *)
let poly_const =
  TAbs ("X", TAbs ("Y",
    Abs ("x", TVar "X",
      Abs ("y", TVar "Y", Var "x"))))

let () =
  let ty = typeof [] poly_const in
  let expected = TForall ("X", TForall ("Y",
    TArrow (TVar "X", TArrow (TVar "Y", TVar "X")))) in
  assert (types_equal ty expected);
  Printf.printf "poly_const : %s\n" (string_of_ty ty)

(* poly_const [Nat] [Bool] 42 true = 42 *)
let test_const =
  App (App (TApp (TApp (poly_const, TNat), TBool),
            IntLit 42),
       BoolLit true)

let () =
  let v = eval [] test_const in
  assert (v = VInt 42)
```

### 7.3 Self-Application

```ocaml
(* \x : (forall X. X -> X). x [forall X. X -> X] x *)
let self_app =
  let forall_id = TForall ("X", TArrow (TVar "X", TVar "X")) in
  Abs ("x", forall_id,
    App (TApp (Var "x", forall_id), Var "x"))

let () =
  let ty = typeof [] self_app in
  let forall_id = TForall ("X", TArrow (TVar "X", TVar "X")) in
  let expected = TArrow (forall_id, forall_id) in
  assert (types_equal ty expected);
  Printf.printf "self_app : %s\n" (string_of_ty ty)

(* self_app poly_id = poly_id *)
let test_self_app = App (self_app, poly_id)

let () =
  let ty = typeof [] test_self_app in
  let forall_id = TForall ("X", TArrow (TVar "X", TVar "X")) in
  assert (types_equal ty forall_id)
```

### 7.4 Existential Types: Counter ADT

```ocaml
(* Counter ADT type:
   exists X. { new: X, inc: X -> X, get: X -> Nat } *)

(* We encode records as nested pairs for simplicity:
   exists X. (X * ((X -> X) * (X -> Nat)))
   But for clarity, let us use a simpler version:
   exists X. X -> X    (just the increment function) *)

(* Simple existential example:
   {*Nat, \x:Nat. succ x} as exists X. X -> X *)
let counter_inc =
  Pack (TNat,
        Abs ("x", TNat, Succ (Var "x")),
        TExists ("X", TArrow (TVar "X", TVar "X")))

let () =
  let ty = typeof [] counter_inc in
  let expected = TExists ("X", TArrow (TVar "X", TVar "X")) in
  assert (types_equal ty expected);
  Printf.printf "counter_inc : %s\n" (string_of_ty ty)

(* Unpack and use: let {X, f} = counter_inc in ... *)
(* We cannot apply f to a Nat directly because X is abstract!
   But we can apply f to the result of another f, if we had
   a starting value. For a full counter, we would package
   the initial value too. *)

(* Full counter:
   exists X. (X * (X -> X) * (X -> Nat))
   Simplified with nested pairs:
   exists X. (X * ((X -> X) * (X -> Nat))) *)
let counter_adt_ty =
  TExists ("X",
    TArrow (TVar "X",           (* new: provide a dummy arg *)
    TArrow (TArrow (TVar "X", TVar "X"),   (* inc *)
    TArrow (TArrow (TVar "X", TNat),       (* get *)
    TNat))))                                (* result *)

(* Alternative approach: pack a record-like structure.
   Since we lack records, let's use a simpler test. *)

(* Pack Nat with the value 0 : exists X. X *)
let pack_zero =
  Pack (TNat, IntLit 0, TExists ("X", TVar "X"))

(* Unpack and convert to Nat --- this should fail!
   Because X is abstract inside the unpack body. *)
(* let {X, x} = pack_zero in succ x *)
(* This would fail: succ expects Nat but x : X *)

let test_unpack_fail () =
  try
    let _ = typeof []
      (Unpack ("X", "x", pack_zero, Succ (Var "x"))) in
    Printf.printf "ERROR: should have failed\n"
  with Type_error msg ->
    Printf.printf "Correctly rejected: %s\n" msg

let () = test_unpack_fail ()

(* Valid unpack: let {X, x} = pack_zero in 42 *)
let test_unpack_ok =
  Unpack ("X", "x", pack_zero, IntLit 42)

let () =
  let ty = typeof [] test_unpack_ok in
  assert (types_equal ty TNat);
  let v = eval [] test_unpack_ok in
  assert (v = VInt 42)
```

### 7.5 Type Variable Scope Errors

```ocaml
(* Verify that the type checker rejects ill-formed types *)

(* \x : X. x  -- X is not in scope *)
let test_unbound_tyvar () =
  try
    let _ = typeof []
      (Abs ("x", TVar "X", Var "x")) in
    Printf.printf "ERROR: should have failed\n"
  with Type_error msg ->
    Printf.printf "Correctly rejected unbound type var: %s\n" msg

let () = test_unbound_tyvar ()

(* Verify that the abstract type cannot escape unpack *)
(* let {X, x} = ... in x  -- result type is X, which escapes *)
let test_escape () =
  let pkg = Pack (TNat, IntLit 5, TExists ("X", TVar "X")) in
  try
    let _ = typeof []
      (Unpack ("X", "x", pkg, Var "x")) in
    Printf.printf "ERROR: type variable should not escape\n"
  with Type_error msg ->
    Printf.printf "Correctly rejected escape: %s\n" msg

let () = test_escape ()
```

---

## 8. Exercises

**Exercise 8.1.** Extend the pretty-printer to handle the new AST nodes. The printer for types should produce:

- `TVar "X"` as `X`
- `TForall ("X", TArrow (TVar "X", TVar "X"))` as `forall X. X -> X`
- `TExists ("X", TVar "X")` as `exists X. X`

**Exercise 8.2.** Implement Church booleans as System F terms and verify they type-check:

```ocaml
let cbool = TForall ("X", TArrow (TVar "X", TArrow (TVar "X", TVar "X")))

let ctrue = TAbs ("X", Abs ("t", TVar "X", Abs ("f", TVar "X", Var "t")))
let cfalse = TAbs ("X", Abs ("t", TVar "X", Abs ("f", TVar "X", Var "f")))
```

Verify that `typeof [] ctrue` and `typeof [] cfalse` both return `cbool`.

Then implement `cnot : CBool -> CBool`:

```ocaml
let cnot = Abs ("b", cbool,
  TAbs ("X", Abs ("t", TVar "X", Abs ("f", TVar "X",
    App (App (TApp (Var "b", TVar "X"), Var "f"), Var "t")))))
```

Test: `cnot ctrue` should evaluate to `cfalse` (or at least produce the same observable behavior).

**Exercise 8.3.** Implement a polymorphic pair constructor and projections. Define:

```
Pair = /\X. /\Y. \x:X. \y:Y. /\R. \f:(X -> Y -> R). f x y
fst  = /\X. /\Y. \p:(forall R. (X -> Y -> R) -> R). p [X] (\x:X. \y:Y. x)
```

Verify that `fst [Nat] [Bool] (Pair [Nat] [Bool] 42 true)` evaluates to `42`.

**Exercise 8.4.** Implement a counter ADT using existential types. The counter should support `new`, `inc`, and `get` operations. Provide two implementations (one using `Nat`, one using a different representation) and write a client that works with both.

**Exercise 8.5 (Challenge).** Implement a simple parser for System F terms and types. The grammar:

```
type ::= id                        (* type variable *)
       | type '->' type            (* arrow, right-associative *)
       | 'forall' id '.' type      (* universal *)
       | 'exists' id '.' type      (* existential *)
       | 'Nat' | 'Bool'            (* base types *)
       | '(' type ')'              (* grouping *)

term ::= id                        (* variable *)
       | '\' id ':' type '.' term  (* abstraction *)
       | '/\' id '.' term          (* type abstraction *)
       | term '[' type ']'         (* type application *)
       | term term                 (* application *)
       | '{*' type ',' term '}' 'as' type  (* pack *)
       | 'let' '{' id ',' id '}' '=' term 'in' term  (* unpack *)
       | int_literal | 'true' | 'false'
       | '(' term ')'
```

### 7.6 Polymorphic Composition

```ocaml
(* /\X. /\Y. /\Z. \g:(Y->Z). \f:(X->Y). \x:X. g (f x) *)
let poly_compose =
  TAbs ("X", TAbs ("Y", TAbs ("Z",
    Abs ("g", TArrow (TVar "Y", TVar "Z"),
      Abs ("f", TArrow (TVar "X", TVar "Y"),
        Abs ("x", TVar "X",
          App (Var "g", App (Var "f", Var "x"))))))))

let () =
  let ty = typeof [] poly_compose in
  let expected = TForall ("X", TForall ("Y", TForall ("Z",
    TArrow (TArrow (TVar "Y", TVar "Z"),
      TArrow (TArrow (TVar "X", TVar "Y"),
        TArrow (TVar "X", TVar "Z")))))) in
  assert (types_equal ty expected);
  Printf.printf "compose : %s\n" (string_of_ty ty)

(* Test: compose [Nat] [Nat] [Bool] iszero succ 0 = false *)
let test_compose =
  App (App (App (
    TApp (TApp (TApp (poly_compose, TNat), TNat), TBool),
    Abs ("x", TNat, IsZero (Var "x"))),    (* iszero *)
    Abs ("x", TNat, Succ (Var "x"))),      (* succ *)
    IntLit 0)

let () =
  let ty = typeof [] test_compose in
  assert (types_equal ty TBool);
  let v = eval [] test_compose in
  assert (v = VBool false);
  Printf.printf "compose iszero succ 0 = %s\n" (string_of_value v)
```

### 7.7 Existential Types: Full Counter ADT

```ocaml
(* For a more complete counter example, we encode the record
   {new: X, inc: X -> X, get: X -> Nat} as a function that
   takes three continuations and applies them appropriately.

   Alternatively, using Church-encoded pairs: *)

(* Simplified: pack (0, succ, id) as exists X. X * (X -> X) * (X -> Nat)
   We use nested function application to simulate records: *)

(* Counter interface as a Scott-encoded triple:
   \new. \inc. \get. body
   But for simplicity, test pack/unpack with simpler types. *)

(* Two implementations with same existential type *)
let counter_ty = TExists ("X", TArrow (TVar "X", TVar "X"))

(* Implementation 1: X = Nat, inc = succ *)
let counter_nat =
  Pack (TNat,
        Abs ("x", TNat, Succ (Var "x")),
        counter_ty)

(* Implementation 2: X = Bool, inc = not *)
let counter_bool =
  Pack (TBool,
        Abs ("x", TBool, If (Var "x", BoolLit false, BoolLit true)),
        counter_ty)

let () =
  let ty1 = typeof [] counter_nat in
  let ty2 = typeof [] counter_bool in
  assert (types_equal ty1 counter_ty);
  assert (types_equal ty2 counter_ty);
  Printf.printf "Both counters have type: %s\n" (string_of_ty ty1)

(* Use counter_nat: let {X, f} = counter_nat in 42 *)
let test_use_counter =
  Unpack ("X", "f", counter_nat, IntLit 42)

let () =
  let ty = typeof [] test_use_counter in
  assert (types_equal ty TNat);
  let v = eval [] test_use_counter in
  assert (v = VInt 42);
  Printf.printf "Unpack counter, return 42 = %s\n" (string_of_value v)
```

---

## 8. Pretty Printing

For debugging, a pretty printer is essential. Here is a basic implementation:

```ocaml
let rec string_of_ty (t : ty) : string =
  match t with
  | TVar x -> x
  | TArrow (t1, t2) ->
    let s1 = match t1 with
      | TArrow _ | TForall _ | TExists _ ->
        "(" ^ string_of_ty t1 ^ ")"
      | _ -> string_of_ty t1
    in
    s1 ^ " -> " ^ string_of_ty t2
  | TForall (x, t1) ->
    "forall " ^ x ^ ". " ^ string_of_ty t1
  | TExists (x, t1) ->
    "exists " ^ x ^ ". " ^ string_of_ty t1
  | TNat -> "Nat"
  | TBool -> "Bool"

let rec string_of_term (t : term) : string =
  match t with
  | Var x -> x
  | Abs (x, ty1, body) ->
    "(\\" ^ x ^ " : " ^ string_of_ty ty1 ^ ". "
    ^ string_of_term body ^ ")"
  | App (t1, t2) ->
    "(" ^ string_of_term t1 ^ " " ^ string_of_term t2 ^ ")"
  | TAbs (x, body) ->
    "(/\\" ^ x ^ ". " ^ string_of_term body ^ ")"
  | TApp (t1, ty1) ->
    "(" ^ string_of_term t1 ^ " [" ^ string_of_ty ty1 ^ "])"
  | Pack (wit, t1, ety) ->
    "{*" ^ string_of_ty wit ^ ", " ^ string_of_term t1
    ^ "} as " ^ string_of_ty ety
  | Unpack (tv, xv, t1, t2) ->
    "let {" ^ tv ^ ", " ^ xv ^ "} = "
    ^ string_of_term t1 ^ " in " ^ string_of_term t2
  | IntLit n -> string_of_int n
  | BoolLit b -> string_of_bool b
  | Succ t1 -> "(succ " ^ string_of_term t1 ^ ")"
  | Pred t1 -> "(pred " ^ string_of_term t1 ^ ")"
  | IsZero t1 -> "(iszero " ^ string_of_term t1 ^ ")"
  | If (t1, t2, t3) ->
    "(if " ^ string_of_term t1 ^ " then "
    ^ string_of_term t2 ^ " else " ^ string_of_term t3 ^ ")"

let string_of_value (v : value) : string =
  match v with
  | VInt n -> string_of_int n
  | VBool b -> string_of_bool b
  | VClosure (x, _, _) -> "<closure " ^ x ^ ">"
  | VTAbs (x, _, _) -> "<type-abs " ^ x ^ ">"
  | VPack (wit, v1, _) ->
    "{*" ^ string_of_ty wit ^ ", " ^ string_of_value v1 ^ "}"
```

---

## 9. Common Pitfalls

1. **Forgetting capture-avoidance.** Type substitution $[X \mapsto S]\,(\forall Y.\, T)$ must alpha-rename $Y$ if $Y \in \text{FTV}(S)$. Failing to do so silently produces incorrect types.

2. **Conflating type and term variables.** In our implementation, type variables and term variables live in the same context but with different bindings. Make sure `TAbs ("x", ...)` and `Abs ("x", ...)` do not interfere.

3. **Forgetting the escape check in T-Unpack.** The result type of an unpack must not mention the abstract type variable. Omitting this check allows the hidden type to leak, breaking data abstraction.

4. **Type erasure in the evaluator.** Type application in the evaluator should not attempt to perform type substitution in the term. Since we use closures (environment-based evaluation), the types are irrelevant at runtime. The type checker has already verified correctness.

5. **Alpha-equivalence in type comparison.** $\forall X.\, X \to X$ and $\forall Y.\, Y \to Y$ are the same type. The `types_equal` function must handle this.

---

## 11. Summary

In this recitation, we built a complete type checker and evaluator for System F with existential types. The key implementation components are:

1. **Type substitution** ($[X \mapsto S]\,T$) with capture avoidance.
2. **T-TAbs**: extend context with type variable, check body, wrap in $\forall$.
3. **T-TApp**: check for $\forall$ type, perform type substitution.
4. **T-Pack**: verify term matches witness instantiation, return existential type.
5. **T-Unpack**: open existential, check result type does not mention abstract variable.
6. **Evaluator**: type erasure --- type abstractions and applications are computationally trivial.

The implementation demonstrates that System F's type system is decidable (for type checking) and that type information can be completely erased at runtime without affecting computation.
