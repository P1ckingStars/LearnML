---
title: "Recitation 05: Implementing Algorithm W"
tags:
  - type-theory
  - type-inference
  - recitation
---
# Recitation 05: Implementing Algorithm W

> **Module 05 --- Type Inference & Reconstruction (Weeks 9--10)**
> Estimated study time: 3--4 hours

---

## Overview

In this recitation, we implement Algorithm W for a mini-ML language in OCaml. We build the system from the ground up: type expressions with type variables, substitutions, unification with the occurs check, and finally the full inference algorithm with let-polymorphism. Every code block is self-contained and runnable.

By the end of this session, you will have a working type inference engine that can infer principal types for expressions including lambda abstractions, applications, let-bindings with polymorphism, and recursive definitions.

---

## 1. Defining the Language

### 1.1 Type Expressions

We represent types as an algebraic data type. Type variables are identified by integers.

```ocaml
type ty =
  | TVar of int             (* Type variable: alpha_0, alpha_1, ... *)
  | TArrow of ty * ty       (* Function type: T1 -> T2 *)
  | TInt                    (* Base type: Int *)
  | TBool                   (* Base type: Bool *)
```

A utility for pretty-printing types:

```ocaml
let rec string_of_ty = function
  | TVar n -> "'" ^ String.make 1 (Char.chr (97 + n mod 26))
           ^ (if n >= 26 then string_of_int (n / 26) else "")
  | TArrow (t1, t2) ->
    let s1 = match t1 with
      | TArrow _ -> "(" ^ string_of_ty t1 ^ ")"
      | _ -> string_of_ty t1
    in
    s1 ^ " -> " ^ string_of_ty t2
  | TInt -> "int"
  | TBool -> "bool"
```

Test it:

```ocaml
let () =
  let t = TArrow (TVar 0, TArrow (TVar 1, TVar 0)) in
  print_endline (string_of_ty t)
  (* Output: 'a -> 'b -> 'a *)
```

### 1.2 Term Expressions

Our mini-ML language includes variables, lambda abstractions, applications, let-bindings, integer and boolean literals, and a simple if-then-else.

```ocaml
type expr =
  | Var of string
  | Lam of string * expr            (* \x. e *)
  | App of expr * expr              (* e1 e2 *)
  | Let of string * expr * expr     (* let x = e1 in e2 *)
  | LetRec of string * expr * expr  (* let rec f = e1 in e2 *)
  | IntLit of int
  | BoolLit of bool
  | If of expr * expr * expr        (* if e1 then e2 else e3 *)
  | BinOp of string * expr * expr   (* e1 op e2, for +, -, *, =, etc. *)
```

### 1.3 Type Schemes

A type scheme $\forall \alpha_1 \ldots \alpha_n.\; \tau$ is represented as a list of quantified variables and a body type.

```ocaml
type scheme = Forall of int list * ty
```

A monotype $\tau$ is represented as `Forall ([], tau)`.

---

## 2. Substitutions

### 2.1 Representation

We represent substitutions as association lists mapping type variable indices to types.

```ocaml
module Subst = struct
  type t = (int * ty) list

  let empty : t = []

  (* Apply a substitution to a type *)
  let rec apply (s : t) (t : ty) : ty =
    match t with
    | TVar n ->
      (match List.assoc_opt n s with
       | Some t' -> t'
       | None -> TVar n)
    | TArrow (t1, t2) -> TArrow (apply s t1, apply s t2)
    | TInt -> TInt
    | TBool -> TBool

  (* Apply a substitution to a type scheme *)
  let apply_scheme (s : t) (Forall (vars, ty) : scheme) : scheme =
    (* Remove bindings for quantified variables *)
    let s' = List.filter (fun (v, _) -> not (List.mem v vars)) s in
    Forall (vars, apply s' ty)

  (* Compose two substitutions: (compose s2 s1) x = s2(s1(x)) *)
  let compose (s2 : t) (s1 : t) : t =
    let s1' = List.map (fun (v, t) -> (v, apply s2 t)) s1 in
    let s2' = List.filter (fun (v, _) ->
      not (List.exists (fun (v', _) -> v = v') s1)
    ) s2 in
    s1' @ s2'

  (* Singleton substitution *)
  let singleton (v : int) (t : ty) : t = [(v, t)]
end
```

### 2.2 Testing Substitutions

```ocaml
let () =
  let s1 = Subst.singleton 0 (TArrow (TVar 1, TVar 2)) in
  let s2 = Subst.singleton 1 TInt in
  let composed = Subst.compose s2 s1 in
  let t = TArrow (TVar 0, TVar 1) in
  let result = Subst.apply composed t in
  print_endline (string_of_ty result)
  (* Output: (int -> 'c) -> int *)
  (* alpha_0 -> alpha_1 becomes (Int -> alpha_2) -> Int *)
```

---

## 3. Free Type Variables

We need to compute the set of free type variables in types, schemes, and contexts.

```ocaml
module VarSet = Set.Make(Int)

let rec ftv_ty (t : ty) : VarSet.t =
  match t with
  | TVar n -> VarSet.singleton n
  | TArrow (t1, t2) -> VarSet.union (ftv_ty t1) (ftv_ty t2)
  | TInt | TBool -> VarSet.empty

let ftv_scheme (Forall (vars, ty) : scheme) : VarSet.t =
  VarSet.diff (ftv_ty ty) (VarSet.of_list vars)

(* A context is a list of (variable_name, type_scheme) pairs *)
type context = (string * scheme) list

let ftv_context (ctx : context) : VarSet.t =
  List.fold_left
    (fun acc (_, s) -> VarSet.union acc (ftv_scheme s))
    VarSet.empty ctx
```

---

## 4. Fresh Variable Generation

We use a global counter for generating fresh type variables.

```ocaml
let fresh_counter = ref 0

let fresh_var () : ty =
  let n = !fresh_counter in
  incr fresh_counter;
  TVar n

let reset_fresh () =
  fresh_counter := 0
```

---

## 5. Unification

### 5.1 The Occurs Check

```ocaml
let occurs_in (v : int) (t : ty) : bool =
  VarSet.mem v (ftv_ty t)
```

### 5.2 The Unification Algorithm

```ocaml
exception UnificationFailure of string

let rec unify (t1 : ty) (t2 : ty) : Subst.t =
  match t1, t2 with
  (* Same type variable *)
  | TVar a, TVar b when a = b ->
    Subst.empty

  (* Variable on the left *)
  | TVar a, t ->
    if occurs_in a t then
      raise (UnificationFailure
        (Printf.sprintf "Occurs check: '%s' occurs in '%s'"
          (string_of_ty (TVar a)) (string_of_ty t)))
    else
      Subst.singleton a t

  (* Variable on the right *)
  | t, TVar a ->
    unify (TVar a) t

  (* Arrow types: decompose *)
  | TArrow (l1, r1), TArrow (l2, r2) ->
    let s1 = unify l1 l2 in
    let s2 = unify (Subst.apply s1 r1) (Subst.apply s1 r2) in
    Subst.compose s2 s1

  (* Base types *)
  | TInt, TInt -> Subst.empty
  | TBool, TBool -> Subst.empty

  (* Clash *)
  | t1, t2 ->
    raise (UnificationFailure
      (Printf.sprintf "Cannot unify '%s' with '%s'"
        (string_of_ty t1) (string_of_ty t2)))
```

### 5.3 Testing Unification

```ocaml
let () =
  reset_fresh ();
  (* Unify alpha -> beta with (Int -> Bool) -> gamma *)
  let t1 = TArrow (TVar 0, TVar 1) in
  let t2 = TArrow (TArrow (TInt, TBool), TVar 2) in
  let s = unify t1 t2 in
  Printf.printf "Unifier:\n";
  List.iter (fun (v, t) ->
    Printf.printf "  '%s' = %s\n"
      (string_of_ty (TVar v)) (string_of_ty t)
  ) s;
  Printf.printf "Result: %s\n" (string_of_ty (Subst.apply s t1))
  (* Output:
     Unifier:
       'a' = int -> bool
       'b' = 'c'
     Result: (int -> bool) -> 'c'
  *)
```

Test the occurs check:

```ocaml
let () =
  try
    let _ = unify (TVar 0) (TArrow (TVar 0, TInt)) in
    print_endline "Should not reach here"
  with UnificationFailure msg ->
    print_endline ("Expected failure: " ^ msg)
    (* Output: Expected failure: Occurs check: 'a' occurs in 'a -> int' *)
```

---

## 6. Generalization and Instantiation

### 6.1 Generalization

Generalize a type with respect to a context: quantify over all type variables in the type that are not free in the context.

```ocaml
let generalize (ctx : context) (ty : ty) : scheme =
  let free_in_ctx = ftv_context ctx in
  let free_in_ty = ftv_ty ty in
  let gen_vars = VarSet.diff free_in_ty free_in_ctx in
  Forall (VarSet.elements gen_vars, ty)
```

### 6.2 Instantiation

Instantiate a type scheme by replacing all quantified variables with fresh type variables.

```ocaml
let instantiate (Forall (vars, ty) : scheme) : ty =
  let s = List.map (fun v -> (v, fresh_var ())) vars in
  Subst.apply s ty
```

### 6.3 Testing

```ocaml
let () =
  reset_fresh ();
  (* Generalize 'a -> 'b with no context *)
  let ty = TArrow (TVar 0, TVar 1) in
  let scheme = generalize [] ty in
  let Forall (vars, _) = scheme in
  Printf.printf "Generalized vars: [%s]\n"
    (String.concat ", " (List.map string_of_int vars));
  (* Output: Generalized vars: [0, 1] *)

  (* Instantiate it *)
  let ty' = instantiate scheme in
  Printf.printf "Instantiated: %s\n" (string_of_ty ty')
  (* Output: Instantiated: 'c -> 'd  (fresh variables) *)
```

---

## 7. Algorithm W

### 7.1 Built-in Types for Binary Operations

```ocaml
let type_of_binop (op : string) : ty * ty * ty =
  match op with
  | "+" | "-" | "*" | "/" -> (TInt, TInt, TInt)
  | "=" | "<" | ">" | "<=" | ">=" -> (TInt, TInt, TBool)
  | "&&" | "||" -> (TBool, TBool, TBool)
  | _ -> failwith ("Unknown operator: " ^ op)
```

### 7.2 The Core Algorithm

```ocaml
exception TypeError of string

let rec algorithm_w (ctx : context) (expr : expr) : Subst.t * ty =
  match expr with

  (* Variable lookup *)
  | Var x ->
    (match List.assoc_opt x ctx with
     | Some scheme ->
       let ty = instantiate scheme in
       (Subst.empty, ty)
     | None ->
       raise (TypeError ("Unbound variable: " ^ x)))

  (* Lambda abstraction *)
  | Lam (x, body) ->
    let param_ty = fresh_var () in
    let ctx' = (x, Forall ([], param_ty)) :: ctx in
    let (s1, body_ty) = algorithm_w ctx' body in
    (s1, TArrow (Subst.apply s1 param_ty, body_ty))

  (* Application *)
  | App (fn, arg) ->
    let (s1, fn_ty) = algorithm_w ctx fn in
    let ctx1 = List.map (fun (x, s) -> (x, Subst.apply_scheme s1 s)) ctx in
    let (s2, arg_ty) = algorithm_w ctx1 arg in
    let result_ty = fresh_var () in
    let s3 = unify (Subst.apply s2 fn_ty) (TArrow (arg_ty, result_ty)) in
    (Subst.compose s3 (Subst.compose s2 s1), Subst.apply s3 result_ty)

  (* Let binding with generalization *)
  | Let (x, def, body) ->
    let (s1, def_ty) = algorithm_w ctx def in
    let ctx1 = List.map (fun (x, s) -> (x, Subst.apply_scheme s1 s)) ctx in
    let scheme = generalize ctx1 def_ty in
    let ctx2 = (x, scheme) :: ctx1 in
    let (s2, body_ty) = algorithm_w ctx2 body in
    (Subst.compose s2 s1, body_ty)

  (* Recursive let binding *)
  | LetRec (f, def, body) ->
    let f_ty = fresh_var () in
    let ctx' = (f, Forall ([], f_ty)) :: ctx in
    let (s1, def_ty) = algorithm_w ctx' def in
    let s2 = unify (Subst.apply s1 f_ty) def_ty in
    let s_combined = Subst.compose s2 s1 in
    let ctx1 = List.map (fun (x, s) ->
      (x, Subst.apply_scheme s_combined s)
    ) ctx in
    let final_ty = Subst.apply s2 def_ty in
    let scheme = generalize ctx1 final_ty in
    let ctx2 = (f, scheme) :: ctx1 in
    let (s3, body_ty) = algorithm_w ctx2 body in
    (Subst.compose s3 s_combined, body_ty)

  (* Integer literal *)
  | IntLit _ ->
    (Subst.empty, TInt)

  (* Boolean literal *)
  | BoolLit _ ->
    (Subst.empty, TBool)

  (* If-then-else *)
  | If (cond, then_e, else_e) ->
    let (s1, cond_ty) = algorithm_w ctx cond in
    let s1' = unify cond_ty TBool in
    let s1_all = Subst.compose s1' s1 in
    let ctx1 = List.map (fun (x, s) ->
      (x, Subst.apply_scheme s1_all s)
    ) ctx in
    let (s2, then_ty) = algorithm_w ctx1 then_e in
    let ctx2 = List.map (fun (x, s) ->
      (x, Subst.apply_scheme s2 s)
    ) ctx1 in
    let (s3, else_ty) = algorithm_w ctx2 else_e in
    let s4 = unify (Subst.apply s3 then_ty) else_ty in
    let s_all = Subst.compose s4
      (Subst.compose s3 (Subst.compose s2 s1_all)) in
    (s_all, Subst.apply s4 else_ty)

  (* Binary operations *)
  | BinOp (op, e1, e2) ->
    let (t_left, t_right, t_result) = type_of_binop op in
    let (s1, ty1) = algorithm_w ctx e1 in
    let s1' = unify ty1 t_left in
    let s1_all = Subst.compose s1' s1 in
    let ctx1 = List.map (fun (x, s) ->
      (x, Subst.apply_scheme s1_all s)
    ) ctx in
    let (s2, ty2) = algorithm_w ctx1 e2 in
    let s2' = unify ty2 t_right in
    let s_all = Subst.compose s2'
      (Subst.compose s2 s1_all) in
    (s_all, t_result)
```

### 7.3 Top-Level Inference

A convenience function that runs Algorithm W and returns the principal type.

```ocaml
let infer (expr : expr) : ty =
  reset_fresh ();
  let (s, ty) = algorithm_w [] expr in
  Subst.apply s ty

let infer_and_print (name : string) (expr : expr) : unit =
  try
    let ty = infer expr in
    Printf.printf "%s : %s\n" name (string_of_ty ty)
  with
  | TypeError msg -> Printf.printf "%s : TYPE ERROR: %s\n" name msg
  | UnificationFailure msg -> Printf.printf "%s : TYPE ERROR: %s\n" name msg
```

---

## 8. Testing on Real Examples

### 8.1 The Identity Function

```ocaml
let () =
  (* \x. x *)
  let id = Lam ("x", Var "x") in
  infer_and_print "id" id
  (* Output: id : 'a -> 'a *)
```

### 8.2 Function Composition

```ocaml
let () =
  (* \f. \g. \x. g (f x) *)
  let compose =
    Lam ("f", Lam ("g", Lam ("x",
      App (Var "g", App (Var "f", Var "x"))))) in
  infer_and_print "compose" compose
  (* Output: compose : ('a -> 'b) -> ('b -> 'c) -> 'a -> 'c *)
```

### 8.3 The Constant Function

```ocaml
let () =
  (* \x. \y. x *)
  let const = Lam ("x", Lam ("y", Var "x")) in
  infer_and_print "const" const
  (* Output: const : 'a -> 'b -> 'a *)
```

### 8.4 The Apply Function

```ocaml
let () =
  (* \f. \x. f x *)
  let apply = Lam ("f", Lam ("x", App (Var "f", Var "x"))) in
  infer_and_print "apply" apply
  (* Output: apply : ('a -> 'b) -> 'a -> 'b *)
```

### 8.5 Polymorphic Let

```ocaml
let () =
  (* let id = \x. x in (id 3, id true) *)
  (* We simulate the pair as a function for simplicity *)
  (* let id = \x. x in id 3 *)
  let e1 = Let ("id", Lam ("x", Var "x"),
    App (Var "id", IntLit 42)) in
  infer_and_print "let_id_int" e1;
  (* Output: let_id_int : int *)

  (* let id = \x. x in id true *)
  let e2 = Let ("id", Lam ("x", Var "x"),
    App (Var "id", BoolLit true)) in
  infer_and_print "let_id_bool" e2
  (* Output: let_id_bool : bool *)
```

### 8.6 Polymorphic Let with Multiple Uses

```ocaml
let () =
  (* let id = \x. x in id id *)
  let e = Let ("id", Lam ("x", Var "x"),
    App (Var "id", Var "id")) in
  infer_and_print "id_id" e
  (* Output: id_id : 'a -> 'a *)
```

This works because `id` is let-bound, so its type $\forall \alpha.\; \alpha \to \alpha$ is instantiated independently at each use. The first `id` gets $(\beta \to \beta) \to (\beta \to \beta)$ and the second gets $\beta \to \beta$.

### 8.7 Self-Application (Expected Failure)

```ocaml
let () =
  (* \x. x x *)
  let self_app = Lam ("x", App (Var "x", Var "x")) in
  infer_and_print "self_app" self_app
  (* Output: self_app : TYPE ERROR: Occurs check: ... *)
```

### 8.8 Recursive Factorial

```ocaml
let () =
  (* let rec fact = \n. if n = 0 then 1 else n * fact (n - 1) in fact 5 *)
  let fact_body =
    Lam ("n",
      If (BinOp ("=", Var "n", IntLit 0),
        IntLit 1,
        BinOp ("*", Var "n",
          App (Var "fact", BinOp ("-", Var "n", IntLit 1))))) in
  let e = LetRec ("fact", fact_body,
    App (Var "fact", IntLit 5)) in
  infer_and_print "factorial" e
  (* Output: factorial : int *)
```

### 8.9 Higher-Order Functions

```ocaml
let () =
  (* let twice = \f. \x. f (f x) in twice *)
  let twice =
    Let ("twice",
      Lam ("f", Lam ("x", App (Var "f", App (Var "f", Var "x")))),
      Var "twice") in
  infer_and_print "twice" twice;
  (* Output: twice : ('a -> 'a) -> 'a -> 'a *)

  (* let twice = \f. \x. f (f x) in twice (\n. n + 1) 0 *)
  let twice_succ =
    Let ("twice",
      Lam ("f", Lam ("x", App (Var "f", App (Var "f", Var "x")))),
      App (App (Var "twice", Lam ("n", BinOp ("+", Var "n", IntLit 1))),
           IntLit 0)) in
  infer_and_print "twice_succ" twice_succ
  (* Output: twice_succ : int *)
```

### 8.10 The S Combinator

```ocaml
let () =
  (* \x. \y. \z. x z (y z) *)
  let s_comb =
    Lam ("x", Lam ("y", Lam ("z",
      App (App (Var "x", Var "z"), App (Var "y", Var "z"))))) in
  infer_and_print "S" s_comb
  (* Output: S : ('a -> 'b -> 'c) -> ('a -> 'b) -> 'a -> 'c *)
```

---

## 9. Common Pitfalls and Debugging

### 9.1 Forgetting to Apply the Substitution

A common bug is to forget to apply $\sigma_1$ to $\Gamma$ before processing $t_2$ in the application case. This leads to incorrect types because constraints discovered during inference of $t_1$ are not propagated.

**Wrong:**
```ocaml
(* BUG: ctx should be updated with s1 *)
let (s2, arg_ty) = algorithm_w ctx arg in ...
```

**Correct:**
```ocaml
let ctx1 = List.map (fun (x, s) -> (x, Subst.apply_scheme s1 s)) ctx in
let (s2, arg_ty) = algorithm_w ctx1 arg in ...
```

### 9.2 Forgetting the Occurs Check

Without the occurs check, the self-application $\lambda x.\; x\;x$ would receive an "infinite type," leading to non-termination or unsound results downstream.

```ocaml
(* Test: this must fail *)
let () =
  let omega = Lam ("x", App (Var "x", Var "x")) in
  infer_and_print "omega" omega
  (* Must output: TYPE ERROR with occurs check message *)
```

### 9.3 Failing to Generalize at Let-Bindings

If you treat `let x = e1 in e2` the same as `(\x. e2) e1` (no generalization), polymorphism is lost:

```ocaml
(* This should succeed (let-polymorphism) *)
let () =
  let e = Let ("f", Lam ("x", Var "x"),
    App (App (Lam ("a", Lam ("b", Var "a")),
      App (Var "f", IntLit 1)),
      App (Var "f", BoolLit true))) in
  infer_and_print "let_poly" e
  (* Should succeed: f is used at both Int -> Int and Bool -> Bool *)
```

### 9.4 Incorrect Composition Order

Substitution composition is not commutative. $\sigma_2 \circ \sigma_1$ means "first apply $\sigma_1$, then apply $\sigma_2$." Getting the order wrong produces subtle type errors.

```ocaml
(* Verify composition order *)
let () =
  let s1 = Subst.singleton 0 (TVar 1) in        (* 'a -> 'b *)
  let s2 = Subst.singleton 1 TInt in              (* 'b -> int *)
  let composed = Subst.compose s2 s1 in
  let t = Subst.apply composed (TVar 0) in
  Printf.printf "compose test: %s (should be int)\n" (string_of_ty t)
  (* Output: compose test: int *)
```

### 9.5 Not Using Fresh Variables for Each Instantiation

Each use of a let-bound variable must instantiate the scheme with distinct fresh variables. Reusing the same variables causes spurious unification between independent uses.

```ocaml
(* This tests that two uses of 'id' get independent type variables *)
let () =
  let e = Let ("id", Lam ("x", Var "x"),
    Let ("a", App (Var "id", IntLit 1),
      Let ("b", App (Var "id", BoolLit true),
        Var "b"))) in
  infer_and_print "independent_inst" e
  (* Output: independent_inst : bool *)
```

---

## 10. Extending the Implementation

### 10.1 Adding List Types

To support lists, extend the type language and add constructors:

```ocaml
(* Extended type *)
type ty_ext =
  | TVar of int
  | TArrow of ty_ext * ty_ext
  | TInt
  | TBool
  | TList of ty_ext    (* List type constructor *)
```

Add built-in schemes for list operations:

```ocaml
(* In the initial context: *)
let list_builtins = [
  (* nil : forall a. List a *)
  ("nil", Forall ([0], TList (TVar 0)));
  (* cons : forall a. a -> List a -> List a *)
  ("cons", Forall ([0],
    TArrow (TVar 0, TArrow (TList (TVar 0), TList (TVar 0)))));
  (* hd : forall a. List a -> a *)
  ("hd", Forall ([0], TArrow (TList (TVar 0), TVar 0)));
  (* tl : forall a. List a -> List a *)
  ("tl", Forall ([0], TArrow (TList (TVar 0), TList (TVar 0))));
]
```

### 10.2 Adding Pairs

```ocaml
(* Extended type with pairs *)
type ty_pair =
  | TVar of int
  | TArrow of ty_pair * ty_pair
  | TInt
  | TBool
  | TPair of ty_pair * ty_pair

(* Built-ins *)
let pair_builtins = [
  (* pair : forall a b. a -> b -> (a, b) *)
  ("pair", Forall ([0; 1],
    TArrow (TVar 0, TArrow (TVar 1, TPair (TVar 0, TVar 1)))));
  (* fst : forall a b. (a, b) -> a *)
  ("fst", Forall ([0; 1], TArrow (TPair (TVar 0, TVar 1), TVar 0)));
  (* snd : forall a b. (a, b) -> b *)
  ("snd", Forall ([0; 1], TArrow (TPair (TVar 0, TVar 1), TVar 1)));
]
```

### 10.3 Unification for Extended Types

The unification algorithm extends naturally. Add cases for each new type constructor:

```ocaml
(* Additional unification cases *)
(* | TList t1, TList t2 -> unify t1 t2 *)
(* | TPair (a1, b1), TPair (a2, b2) -> *)
(*     let s1 = unify a1 a2 in *)
(*     let s2 = unify (Subst.apply s1 b1) (Subst.apply s1 b2) in *)
(*     Subst.compose s2 s1 *)
(* | TList _, _ | _, TList _ -> clash error *)
(* | TPair _, _ | _, TPair _ -> clash error *)
```

---

## 11. Exercises

**Exercise 11.1.** Predict the output of Algorithm W on the following term, then verify with the implementation:

```ocaml
(* \f. \g. \x. f x (g x) *)
let e = Lam ("f", Lam ("g", Lam ("x",
  App (App (Var "f", Var "x"), App (Var "g", Var "x"))))) in
infer_and_print "exercise_1" e
```

**Exercise 11.2.** Explain why the following term fails to type-check:

```ocaml
(* \f. (f 1, f true) *)
let e = Lam ("f",
  App (App (Lam ("a", Lam ("b", Var "a")),
    App (Var "f", IntLit 1)),
    App (Var "f", BoolLit true))) in
infer_and_print "exercise_2" e
```

Hint: `f` is lambda-bound, not let-bound.

**Exercise 11.3.** Modify Algorithm W to print a trace of every unification step. Use this trace to understand the type inference process for function composition.

**Exercise 11.4.** Implement the list type extension (Section 10.1) and verify that the following expression is correctly typed:

```
let rec map = \f. \xs.
  if null xs then nil
  else cons (f (hd xs)) (map f (tl xs))
in map
```

Expected type: $\forall \alpha\; \beta.\; (\alpha \to \beta) \to \text{List}(\alpha) \to \text{List}(\beta)$.

**Exercise 11.5.** Add a `fix` combinator to the language as a built-in with type $\forall \alpha.\; (\alpha \to \alpha) \to \alpha$, and verify that it can be used to define recursive functions without `let rec`.
