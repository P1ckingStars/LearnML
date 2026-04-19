---
title: "OCaml Patterns for Language Implementation"
tags:
  - type-theory
  - reference
---
# OCaml Patterns for Language Implementation

Production-tested patterns for implementing programming languages, type checkers, and interpreters in OCaml. This guide assumes familiarity with basic OCaml syntax and focuses on idioms that arise specifically in PL implementation.

---

## Table of Contents

1. [Project Setup with Dune](#project-setup-with-dune)
2. [Defining Abstract Syntax with Algebraic Data Types](#defining-abstract-syntax-with-algebraic-data-types)
3. [Pattern Matching Discipline](#pattern-matching-discipline)
4. [Environments and Contexts](#environments-and-contexts)
5. [Implementing Substitution](#implementing-substitution)
6. [De Bruijn Indices](#de-bruijn-indices)
7. [Implementing an Evaluator](#implementing-an-evaluator)
8. [Implementing a Type Checker](#implementing-a-type-checker)
9. [Unification and Type Inference](#unification-and-type-inference)
10. [Error Handling in Compilers](#error-handling-in-compilers)
11. [Pretty Printing](#pretty-printing)
12. [Modules and Functors for Extensibility](#modules-and-functors-for-extensibility)
13. [GADTs for Type-Safe ASTs](#gadts-for-type-safe-asts)
14. [Testing with Alcotest](#testing-with-alcotest)
15. [Common Pitfalls and Tips](#common-pitfalls-and-tips)

---

## Project Setup with Dune

### Minimal Project Structure

```
my-lang/
  bin/
    main.ml
    dune
  lib/
    syntax.ml
    eval.ml
    typecheck.ml
    env.ml
    pretty.ml
    dune
  test/
    test_eval.ml
    test_typecheck.ml
    dune
  dune-project
```

### dune-project

```lisp
(lang dune 3.0)
(name my_lang)
```

### lib/dune

```lisp
(library
 (name my_lang)
 (public_name my_lang)
 (libraries fmt))
```

### bin/dune

```lisp
(executable
 (name main)
 (public_name my_lang)
 (libraries my_lang))
```

### test/dune

```lisp
(test
 (name test_eval)
 (libraries my_lang alcotest))

(test
 (name test_typecheck)
 (libraries my_lang alcotest))
```

### Building and Running

```bash
dune build              # Build everything
dune exec my_lang       # Run the executable
dune test               # Run all tests
dune build @check       # Type-check without linking (fast feedback)
dune build -w           # Watch mode: rebuild on file changes
```

---

## Defining Abstract Syntax with Algebraic Data Types

### Basic Lambda Calculus AST

```ocaml
(** Syntax of the simply typed lambda calculus. *)

type ty =
  | TBool
  | TInt
  | TArrow of ty * ty
  (** T1 -> T2 *)

type expr =
  | Var of string
  | Lam of string * ty * expr
  (** lam x : T. e *)
  | App of expr * expr
  (** e1 e2 *)
  | IntLit of int
  | BoolLit of bool
  | If of expr * expr * expr
  (** if e1 then e2 else e3 *)
  | Let of string * expr * expr
  (** let x = e1 in e2 *)
```

### Key Principle: One Constructor per Language Form

Each syntactic form in the grammar should be exactly one constructor. Do not conflate distinct language forms into a single constructor with a tag:

```ocaml
(* BAD: using a tag to distinguish forms *)
type binop = Add | Sub | Mul
type expr =
  | BinOp of binop * expr * expr  (* conflates many operations *)

(* BETTER for a small language: separate constructors *)
type expr =
  | Add of expr * expr
  | Sub of expr * expr
  | Mul of expr * expr

(* ACCEPTABLE for a language with many operations: use BinOp with a separate op type,
   but be aware that the type checker and evaluator must handle all ops uniformly. *)
type binop = Add | Sub | Mul | Div | Mod | And | Or
type expr =
  | BinOp of binop * expr * expr
  | UnOp of unop * expr
  | ...
```

### Adding Source Locations

Attach source locations to every AST node for error reporting:

```ocaml
type loc = {
  file : string;
  line : int;
  col  : int;
}

type 'a located = {
  value : 'a;
  loc   : loc;
}

(** The AST with locations. *)
type expr =
  | Var of string
  | Lam of string * ty * expr located
  | App of expr located * expr located
  | IntLit of int
  | BoolLit of bool
  | If of expr located * expr located * expr located
  | Let of string * expr located * expr located
```

Alternatively, annotate every node uniformly:

```ocaml
type expr_node =
  | Var of string
  | Lam of string * ty * expr
  | App of expr * expr
  | IntLit of int
  | BoolLit of bool
  | If of expr * expr * expr
  | Let of string * expr * expr

and expr = {
  node : expr_node;
  loc  : loc;
}
```

---

## Pattern Matching Discipline

### Exhaustive Matching

Always match exhaustively. Never use a wildcard catch-all unless you have a strong reason:

```ocaml
(* BAD: wildcard hides missing cases when you add a new constructor *)
let rec eval env = function
  | Var x -> Env.lookup env x
  | App (e1, e2) -> apply (eval env e1) (eval env e2)
  | _ -> failwith "not implemented"

(* GOOD: match every constructor explicitly *)
let rec eval env = function
  | Var x -> Env.lookup env x
  | Lam (x, _ty, body) -> VClosure (env, x, body)
  | App (e1, e2) ->
    let v1 = eval env e1 in
    let v2 = eval env e2 in
    apply v1 v2
  | IntLit n -> VInt n
  | BoolLit b -> VBool b
  | If (e1, e2, e3) ->
    (match eval env e1 with
     | VBool true -> eval env e2
     | VBool false -> eval env e3
     | _ -> runtime_error "if condition must be a boolean")
  | Let (x, e1, e2) ->
    let v1 = eval env e1 in
    eval (Env.extend env x v1) e2
```

### Nested Pattern Matching

Use nested patterns to handle multiple levels of structure simultaneously:

```ocaml
(* Check if an expression is a value *)
let rec is_value = function
  | Lam _ | IntLit _ | BoolLit _ -> true
  | Var _ | App _ | If _ | Let _ -> false

(* Pattern match on the shape of a type *)
let rec check_subtype ty1 ty2 =
  match ty1, ty2 with
  | _, TTop -> true
  | TBot, _ -> true
  | TArrow (s1, s2), TArrow (t1, t2) ->
    check_subtype t1 s1 && check_subtype s2 t2
    (* note: contravariant in the domain! *)
  | TInt, TInt -> true
  | TBool, TBool -> true
  | _, _ -> false
```

### When to Use Guards

Use `when` guards for conditions that cannot be expressed as patterns:

```ocaml
let rec eval env = function
  | App (Var "fix", Lam (f, _, body)) ->
    (* Special case for fixpoint *)
    let rec fix_val = VClosure (Env.extend env f fix_val, "x", body) in
    fix_val
  | App (e1, e2) when is_value e1 && is_value e2 ->
    (* Both sides are values: apply *)
    apply (eval env e1) (eval env e2)
  | ...
```

---

## Environments and Contexts

### Association List (Simple)

For small languages and prototypes, association lists are the simplest choice:

```ocaml
module Env = struct
  type 'a t = (string * 'a) list

  let empty : 'a t = []

  let extend (env : 'a t) (x : string) (v : 'a) : 'a t =
    (x, v) :: env

  let lookup (env : 'a t) (x : string) : 'a =
    match List.assoc_opt x env with
    | Some v -> v
    | None -> failwith (Printf.sprintf "Unbound variable: %s" x)

  let lookup_opt (env : 'a t) (x : string) : 'a option =
    List.assoc_opt x env

  let mem (env : 'a t) (x : string) : bool =
    List.mem_assoc x env

  let remove (env : 'a t) (x : string) : 'a t =
    List.remove_assoc x env

  let to_list (env : 'a t) : (string * 'a) list = env

  let of_list (l : (string * 'a) list) : 'a t = l
end
```

### Map-Based Environment (Efficient)

For larger languages, use `Map.Make`:

```ocaml
module StringMap = Map.Make(String)

module Env = struct
  type 'a t = 'a StringMap.t

  let empty : 'a t = StringMap.empty

  let extend (env : 'a t) (x : string) (v : 'a) : 'a t =
    StringMap.add x v env

  let lookup (env : 'a t) (x : string) : 'a =
    match StringMap.find_opt x env with
    | Some v -> v
    | None -> failwith (Printf.sprintf "Unbound variable: %s" x)

  let lookup_opt (env : 'a t) (x : string) : 'a option =
    StringMap.find_opt x env

  let mem (env : 'a t) (x : string) : bool =
    StringMap.mem x env

  let merge (env1 : 'a t) (env2 : 'a t) : 'a t =
    StringMap.union (fun _key _v1 v2 -> Some v2) env1 env2
end
```

### Typing Context as an Environment

```ocaml
(** A typing context maps variable names to types. *)
type ctx = ty Env.t

let empty_ctx : ctx = Env.empty

let extend_ctx (ctx : ctx) (x : string) (t : ty) : ctx =
  Env.extend ctx x t

let lookup_ctx (ctx : ctx) (x : string) : ty =
  Env.lookup ctx x
```

---

## Implementing Substitution

### Named Substitution (Straightforward but Fragile)

```ocaml
(** Generate a fresh variable name not in the given set. *)
let fresh_var (avoid : StringSet.t) (base : string) : string =
  if not (StringSet.mem base avoid) then base
  else
    let rec try_suffix n =
      let candidate = base ^ string_of_int n in
      if StringSet.mem candidate avoid then try_suffix (n + 1)
      else candidate
    in
    try_suffix 0

(** Compute the set of free variables of an expression. *)
let rec free_vars = function
  | Var x -> StringSet.singleton x
  | Lam (x, _ty, body) -> StringSet.remove x (free_vars body)
  | App (e1, e2) -> StringSet.union (free_vars e1) (free_vars e2)
  | IntLit _ | BoolLit _ -> StringSet.empty
  | If (e1, e2, e3) ->
    StringSet.union (free_vars e1)
      (StringSet.union (free_vars e2) (free_vars e3))
  | Let (x, e1, e2) ->
    StringSet.union (free_vars e1) (StringSet.remove x (free_vars e2))

(** Capture-avoiding substitution: e[x := s] *)
let rec subst (x : string) (s : expr) (e : expr) : expr =
  match e with
  | Var y ->
    if String.equal y x then s else e
  | Lam (y, ty, body) ->
    if String.equal y x then
      (* x is shadowed by the binder; no substitution in body *)
      e
    else if StringSet.mem y (free_vars s) then
      (* y would capture a free variable of s; rename y *)
      let avoid = StringSet.union (free_vars s)
                    (StringSet.union (free_vars body)
                       (StringSet.singleton x)) in
      let y' = fresh_var avoid y in
      let body' = subst y (Var y') body in
      Lam (y', ty, subst x s body')
    else
      Lam (y, ty, subst x s body)
  | App (e1, e2) ->
    App (subst x s e1, subst x s e2)
  | IntLit _ | BoolLit _ -> e
  | If (e1, e2, e3) ->
    If (subst x s e1, subst x s e2, subst x s e3)
  | Let (y, e1, e2) ->
    if String.equal y x then
      Let (y, subst x s e1, e2)
    else if StringSet.mem y (free_vars s) then
      let avoid = StringSet.union (free_vars s)
                    (StringSet.union (free_vars e2)
                       (StringSet.singleton x)) in
      let y' = fresh_var avoid y in
      let e2' = subst y (Var y') e2 in
      Let (y', subst x s e1, subst x s e2')
    else
      Let (y, subst x s e1, subst x s e2)
```

**Gotcha:** Named substitution is error-prone. For any non-trivial language, prefer de Bruijn indices.

---

## De Bruijn Indices

### AST with De Bruijn Indices

```ocaml
(** Terms using de Bruijn indices for variable references. *)
type db_expr =
  | DBVar of int
  (** Variable reference: index into the context *)
  | DBLam of ty * db_expr
  (** Lambda abstraction: no variable name needed *)
  | DBApp of db_expr * db_expr
  | DBIntLit of int
  | DBBoolLit of bool
  | DBIf of db_expr * db_expr * db_expr
  | DBLet of db_expr * db_expr
  (** let _ = e1 in e2: the bound variable is index 0 in e2 *)
```

### Shifting

```ocaml
(** shift d c e: increment free variables in e by d, where "free"
    means index >= c (c tracks the number of enclosing binders). *)
let rec shift (d : int) (c : int) (e : db_expr) : db_expr =
  match e with
  | DBVar k ->
    if k >= c then DBVar (k + d) else DBVar k
  | DBLam (ty, body) ->
    DBLam (ty, shift d (c + 1) body)
  | DBApp (e1, e2) ->
    DBApp (shift d c e1, shift d c e2)
  | DBIntLit _ | DBBoolLit _ -> e
  | DBIf (e1, e2, e3) ->
    DBIf (shift d c e1, shift d c e2, shift d c e3)
  | DBLet (e1, e2) ->
    DBLet (shift d c e1, shift d (c + 1) e2)
```

### Substitution

```ocaml
(** subst j s e: replace variable j with s in e. *)
let rec db_subst (j : int) (s : db_expr) (e : db_expr) : db_expr =
  match e with
  | DBVar k ->
    if k = j then s
    else DBVar k
  | DBLam (ty, body) ->
    DBLam (ty, db_subst (j + 1) (shift 1 0 s) body)
  | DBApp (e1, e2) ->
    DBApp (db_subst j s e1, db_subst j s e2)
  | DBIntLit _ | DBBoolLit _ -> e
  | DBIf (e1, e2, e3) ->
    DBIf (db_subst j s e1, db_subst j s e2, db_subst j s e3)
  | DBLet (e1, e2) ->
    DBLet (db_subst j s e1, db_subst (j + 1) (shift 1 0 s) e2)
```

### Beta-Reduction with De Bruijn Indices

```ocaml
(** Beta-reduce: (lam. body) arg ~> body[0 := arg], then shift down. *)
let beta_reduce (body : db_expr) (arg : db_expr) : db_expr =
  shift (-1) 0 (db_subst 0 (shift 1 0 arg) body)
```

### Converting Named Terms to De Bruijn

```ocaml
(** Convert a named term to de Bruijn representation.
    [names] is a list of bound variable names, innermost first. *)
let rec to_debruijn (names : string list) (e : expr) : db_expr =
  match e with
  | Var x ->
    (match List.find_index (String.equal x) names with
     | Some i -> DBVar i
     | None -> failwith (Printf.sprintf "Unbound variable: %s" x))
  | Lam (x, ty, body) ->
    DBLam (ty, to_debruijn (x :: names) body)
  | App (e1, e2) ->
    DBApp (to_debruijn names e1, to_debruijn names e2)
  | IntLit n -> DBIntLit n
  | BoolLit b -> DBBoolLit b
  | If (e1, e2, e3) ->
    DBIf (to_debruijn names e1, to_debruijn names e2, to_debruijn names e3)
  | Let (x, e1, e2) ->
    DBLet (to_debruijn names e1, to_debruijn (x :: names) e2)
```

**Note:** `List.find_index` is available in OCaml 5.1+. For earlier versions, write a helper:

```ocaml
let find_index pred lst =
  let rec go i = function
    | [] -> None
    | x :: _ when pred x -> Some i
    | _ :: rest -> go (i + 1) rest
  in
  go 0 lst
```

---

## Implementing an Evaluator

### Values

```ocaml
type value =
  | VInt of int
  | VBool of bool
  | VClosure of value Env.t * string * expr
  (** A closure captures the environment at the point of definition. *)
```

### Big-Step Evaluator

```ocaml
(** Big-step evaluator: eval env e = v means e evaluates to v in env. *)
let rec eval (env : value Env.t) (e : expr) : value =
  match e with
  | IntLit n -> VInt n
  | BoolLit b -> VBool b
  | Var x -> Env.lookup env x
  | Lam (x, _ty, body) -> VClosure (env, x, body)
  | App (e1, e2) ->
    let v1 = eval env e1 in
    let v2 = eval env e2 in
    (match v1 with
     | VClosure (closure_env, x, body) ->
       eval (Env.extend closure_env x v2) body
     | _ -> failwith "Application of non-function")
  | If (cond, then_branch, else_branch) ->
    (match eval env cond with
     | VBool true -> eval env then_branch
     | VBool false -> eval env else_branch
     | _ -> failwith "If condition must be boolean")
  | Let (x, e1, e2) ->
    let v1 = eval env e1 in
    eval (Env.extend env x v1) e2
```

### Small-Step Evaluator

```ocaml
(** Small-step evaluator: step e = Some e' if e can take a step,
    or None if e is a value or stuck. *)
let rec step (e : expr) : expr option =
  match e with
  | IntLit _ | BoolLit _ | Lam _ -> None  (* values do not step *)
  | Var _ -> None  (* free variables are stuck *)
  | App (Lam (x, _ty, body), v2) when is_value v2 ->
    (* Beta-reduction *)
    Some (subst x v2 body)
  | App (v1, e2) when is_value v1 ->
    (* Evaluate the argument *)
    (match step e2 with
     | Some e2' -> Some (App (v1, e2'))
     | None -> None)
  | App (e1, e2) ->
    (* Evaluate the function *)
    (match step e1 with
     | Some e1' -> Some (App (e1', e2))
     | None -> None)
  | If (BoolLit true, e2, _e3) -> Some e2
  | If (BoolLit false, _e2, e3) -> Some e3
  | If (e1, e2, e3) ->
    (match step e1 with
     | Some e1' -> Some (If (e1', e2, e3))
     | None -> None)
  | Let (x, v1, e2) when is_value v1 ->
    Some (subst x v1 e2)
  | Let (x, e1, e2) ->
    (match step e1 with
     | Some e1' -> Some (Let (x, e1', e2))
     | None -> None)

(** Multi-step evaluation: keep stepping until stuck or a value. *)
let rec eval_multi (e : expr) : expr =
  match step e with
  | Some e' -> eval_multi e'
  | None -> e
```

**Gotcha:** The small-step evaluator above uses named substitution, which is slow and fragile. For a production implementation, use de Bruijn indices or an environment-based abstract machine.

---

## Implementing a Type Checker

### Basic Type Checker (Checking Mode)

```ocaml
(** Type checker for the simply typed lambda calculus.
    Returns the type of the expression or raises an exception. *)
let rec typecheck (ctx : ctx) (e : expr) : ty =
  match e with
  | IntLit _ -> TInt
  | BoolLit _ -> TBool
  | Var x ->
    (match Env.lookup_opt ctx x with
     | Some t -> t
     | None -> type_error (Printf.sprintf "Unbound variable: %s" x))
  | Lam (x, ty_param, body) ->
    let ty_body = typecheck (Env.extend ctx x ty_param) body in
    TArrow (ty_param, ty_body)
  | App (e1, e2) ->
    let ty_fn = typecheck ctx e1 in
    let ty_arg = typecheck ctx e2 in
    (match ty_fn with
     | TArrow (ty_param, ty_ret) ->
       if ty_equal ty_param ty_arg then ty_ret
       else type_error (Printf.sprintf
         "Argument type mismatch: expected %s, got %s"
         (string_of_ty ty_param) (string_of_ty ty_arg))
     | _ -> type_error (Printf.sprintf
         "Expected function type, got %s" (string_of_ty ty_fn)))
  | If (cond, then_branch, else_branch) ->
    let ty_cond = typecheck ctx cond in
    if not (ty_equal ty_cond TBool) then
      type_error "If condition must have type Bool";
    let ty_then = typecheck ctx then_branch in
    let ty_else = typecheck ctx else_branch in
    if ty_equal ty_then ty_else then ty_then
    else type_error (Printf.sprintf
      "Branch type mismatch: then has %s, else has %s"
      (string_of_ty ty_then) (string_of_ty ty_else))
  | Let (x, e1, e2) ->
    let ty1 = typecheck ctx e1 in
    typecheck (Env.extend ctx x ty1) e2

and ty_equal (t1 : ty) (t2 : ty) : bool =
  match t1, t2 with
  | TInt, TInt -> true
  | TBool, TBool -> true
  | TArrow (a1, r1), TArrow (a2, r2) ->
    ty_equal a1 a2 && ty_equal r1 r2
  | _, _ -> false

and type_error (msg : string) : 'a =
  failwith (Printf.sprintf "Type error: %s" msg)
```

### Bidirectional Type Checker

```ocaml
(** Bidirectional type checking: separate synthesis and checking modes. *)

(** Synthesize a type for the expression (type inference mode). *)
let rec synth (ctx : ctx) (e : expr) : ty =
  match e with
  | IntLit _ -> TInt
  | BoolLit _ -> TBool
  | Var x ->
    (match Env.lookup_opt ctx x with
     | Some t -> t
     | None -> type_error (Printf.sprintf "Unbound variable: %s" x))
  | Lam (x, ty_param, body) ->
    let ty_body = synth (Env.extend ctx x ty_param) body in
    TArrow (ty_param, ty_body)
  | App (e1, e2) ->
    let ty_fn = synth ctx e1 in
    (match ty_fn with
     | TArrow (ty_param, ty_ret) ->
       check ctx e2 ty_param;
       ty_ret
     | _ -> type_error "Expected function type in application")
  | Ann (e, ty) ->
    (* Type annotation: synthesize by checking against the annotation *)
    check ctx e ty;
    ty
  | If (cond, then_branch, else_branch) ->
    check ctx cond TBool;
    let ty_then = synth ctx then_branch in
    check ctx else_branch ty_then;
    ty_then
  | Let (x, e1, e2) ->
    let ty1 = synth ctx e1 in
    synth (Env.extend ctx x ty1) e2

(** Check that the expression has the given type (type checking mode). *)
and check (ctx : ctx) (e : expr) (expected : ty) : unit =
  match e, expected with
  | Lam (x, _ty_ann, body), TArrow (ty_param, ty_ret) ->
    (* Check a lambda against a function type: push the expected
       return type into the body. This is where checking mode shines:
       we do not need a type annotation on the lambda parameter. *)
    check (Env.extend ctx x ty_param) body ty_ret
  | If (cond, then_branch, else_branch), expected_ty ->
    check ctx cond TBool;
    check ctx then_branch expected_ty;
    check ctx else_branch expected_ty
  | _, _ ->
    (* Fall back to synthesis and compare *)
    let actual = synth ctx e in
    if not (ty_equal actual expected) then
      type_error (Printf.sprintf "Expected %s, got %s"
        (string_of_ty expected) (string_of_ty actual))
```

### Adding Subtyping

```ocaml
(** Subtyping check: is ty1 a subtype of ty2? *)
let rec is_subtype (ty1 : ty) (ty2 : ty) : bool =
  match ty1, ty2 with
  | _, TTop -> true
  | TBot, _ -> true
  | TInt, TInt -> true
  | TBool, TBool -> true
  | TArrow (s1, s2), TArrow (t1, t2) ->
    is_subtype t1 s1 && is_subtype s2 t2
    (* Contravariant in argument, covariant in return *)
  | TRecord fields1, TRecord fields2 ->
    (* Width + depth subtyping for records *)
    List.for_all (fun (label, ty2_field) ->
      match List.assoc_opt label fields1 with
      | Some ty1_field -> is_subtype ty1_field ty2_field
      | None -> false
    ) fields2
  | _, _ -> false
```

---

## Unification and Type Inference

### Type Variables and Mutable Cells

The standard approach to unification in ML-style type inference uses mutable reference cells for type variables:

```ocaml
(** Type representation for inference. Type variables are mutable cells
    that may be unified (linked) to other types. *)

type level = int
(** Binding level for let-polymorphism generalization. *)

type ty =
  | TInt
  | TBool
  | TArrow of ty * ty
  | TVar of tvar ref

and tvar =
  | Unbound of int * level
  (** Unbound type variable with unique id and binding level. *)
  | Link of ty
  (** Unified: this variable has been resolved to a type. *)

let next_id = ref 0

let fresh_tvar (level : level) : ty =
  let id = !next_id in
  incr next_id;
  TVar (ref (Unbound (id, level)))
```

### Occurs Check and Unification

```ocaml
exception UnificationError of string

(** Follow chains of links to find the representative type. *)
let rec repr (ty : ty) : ty =
  match ty with
  | TVar ({ contents = Link ty' } as r) ->
    let ty'' = repr ty' in
    r := Link ty'';  (* path compression *)
    ty''
  | _ -> ty

(** Check that type variable [id] does not occur in [ty].
    Also updates levels for let-polymorphism. *)
let rec occurs_check (id : int) (level : level) (ty : ty) : unit =
  match repr ty with
  | TVar ({ contents = Unbound (id', level') } as r) ->
    if id = id' then
      raise (UnificationError "Occurs check failed: infinite type")
    else
      (* Adjust level for generalization *)
      if level' > level then r := Unbound (id', level)
  | TArrow (t1, t2) ->
    occurs_check id level t1;
    occurs_check id level t2
  | TInt | TBool -> ()
  | TVar { contents = Link _ } ->
    assert false  (* repr should have resolved this *)

(** Unify two types, mutating type variables as needed. *)
let rec unify (t1 : ty) (t2 : ty) : unit =
  let t1 = repr t1 and t2 = repr t2 in
  match t1, t2 with
  | TInt, TInt -> ()
  | TBool, TBool -> ()
  | TArrow (a1, r1), TArrow (a2, r2) ->
    unify a1 a2;
    unify r1 r2
  | TVar ({ contents = Unbound (id, level) } as r), ty
  | ty, TVar ({ contents = Unbound (id, level) } as r) ->
    occurs_check id level ty;
    r := Link ty
  | _, _ ->
    raise (UnificationError
      (Printf.sprintf "Cannot unify %s with %s"
        (string_of_ty t1) (string_of_ty t2)))
```

### Generalization and Instantiation

```ocaml
type polytype =
  | Mono of ty
  | Poly of int list * ty
  (** Polymorphic type: list of quantified variable ids and the body. *)

(** Generalize a type at the given level: all type variables with level
    greater than [level] become universally quantified. *)
let generalize (level : level) (ty : ty) : polytype =
  let quantified = ref [] in
  let rec collect ty =
    match repr ty with
    | TVar { contents = Unbound (id, level') } when level' > level ->
      if not (List.mem id !quantified) then
        quantified := id :: !quantified
    | TArrow (t1, t2) -> collect t1; collect t2
    | _ -> ()
  in
  collect ty;
  if !quantified = [] then Mono ty
  else Poly (!quantified, ty)

(** Instantiate a polymorphic type by replacing quantified variables
    with fresh type variables. *)
let instantiate (level : level) (pt : polytype) : ty =
  match pt with
  | Mono ty -> ty
  | Poly (ids, ty) ->
    let subst = List.map (fun id -> (id, fresh_tvar level)) ids in
    let rec go ty =
      match repr ty with
      | TVar { contents = Unbound (id, _) } ->
        (match List.assoc_opt id subst with
         | Some fresh -> fresh
         | None -> ty)
      | TArrow (t1, t2) -> TArrow (go t1, go t2)
      | other -> other
    in
    go ty
```

### Type Inference (Algorithm W Style)

```ocaml
(** Infer the type of an expression using Algorithm W. *)
let rec infer (ctx : polytype Env.t) (level : level) (e : expr) : ty =
  match e with
  | IntLit _ -> TInt
  | BoolLit _ -> TBool
  | Var x ->
    let pt = Env.lookup ctx x in
    instantiate level pt
  | Lam (x, body) ->
    let ty_param = fresh_tvar level in
    let ctx' = Env.extend ctx x (Mono ty_param) in
    let ty_body = infer ctx' level body in
    TArrow (ty_param, ty_body)
  | App (e1, e2) ->
    let ty_fn = infer ctx level e1 in
    let ty_arg = infer ctx level e2 in
    let ty_ret = fresh_tvar level in
    unify ty_fn (TArrow (ty_arg, ty_ret));
    ty_ret
  | Let (x, e1, e2) ->
    let ty1 = infer ctx (level + 1) e1 in
    let pt1 = generalize level ty1 in
    infer (Env.extend ctx x pt1) level e2
  | If (cond, then_branch, else_branch) ->
    let ty_cond = infer ctx level cond in
    unify ty_cond TBool;
    let ty_then = infer ctx level then_branch in
    let ty_else = infer ctx level else_branch in
    unify ty_then ty_else;
    ty_then
```

**Note:** This version of `Lam` does not carry a type annotation, since the type is inferred. This corresponds to Curry-style terms.

---

## Error Handling in Compilers

### Using Result Types

```ocaml
(** Error type for type checking. *)
type type_error =
  | UnboundVar of string * loc
  | TypeMismatch of { expected : ty; actual : ty; loc : loc }
  | NotAFunction of { actual : ty; loc : loc }
  | OccursCheck of { var_id : int; ty : ty; loc : loc }

(** Use Result for recoverable errors. *)
let typecheck_safe (ctx : ctx) (e : expr) : (ty, type_error) result =
  try Ok (typecheck ctx e)
  with
  | Type_error err -> Error err
```

### Accumulating Multiple Errors

```ocaml
(** For better user experience, accumulate all errors rather than
    stopping at the first one. *)
type 'a check_result = {
  value : 'a option;
  errors : type_error list;
}

let ok v = { value = Some v; errors = [] }
let err e = { value = None; errors = [e] }
let combine r1 r2 f =
  match r1.value, r2.value with
  | Some v1, Some v2 ->
    { value = Some (f v1 v2); errors = r1.errors @ r2.errors }
  | _ ->
    { value = None; errors = r1.errors @ r2.errors }
```

### Custom Exception with Location

```ocaml
exception TypeError of {
  msg : string;
  loc : loc;
  expected : ty option;
  actual : ty option;
}

let type_error_at ~loc ~msg ?expected ?actual () =
  raise (TypeError { msg; loc; expected; actual })

(** Format a type error for display. *)
let format_type_error (e : exn) : string =
  match e with
  | TypeError { msg; loc; expected; actual } ->
    let base = Printf.sprintf "%s:%d:%d: Type error: %s"
      loc.file loc.line loc.col msg in
    let exp_str = match expected with
      | Some t -> Printf.sprintf "\n  Expected: %s" (string_of_ty t)
      | None -> "" in
    let act_str = match actual with
      | Some t -> Printf.sprintf "\n  Actual:   %s" (string_of_ty t)
      | None -> "" in
    base ^ exp_str ^ act_str
  | _ -> Printexc.to_string e
```

---

## Pretty Printing

### Using Format (stdlib)

```ocaml
open Format

let rec pp_ty fmt = function
  | TInt -> fprintf fmt "int"
  | TBool -> fprintf fmt "bool"
  | TArrow (t1, t2) ->
    fprintf fmt "(%a -> %a)" pp_ty t1 pp_ty t2
  | TVar { contents = Link ty } -> pp_ty fmt ty
  | TVar { contents = Unbound (id, _) } ->
    fprintf fmt "'t%d" id

let rec pp_expr fmt = function
  | Var x -> fprintf fmt "%s" x
  | IntLit n -> fprintf fmt "%d" n
  | BoolLit b -> fprintf fmt "%b" b
  | Lam (x, ty, body) ->
    fprintf fmt "@[<hov 2>(fun %s : %a ->@ %a)@]"
      x pp_ty ty pp_expr body
  | App (e1, e2) ->
    fprintf fmt "@[<hov 2>(%a@ %a)@]" pp_expr e1 pp_expr e2
  | If (e1, e2, e3) ->
    fprintf fmt "@[<hv>if %a@ then %a@ else %a@]"
      pp_expr e1 pp_expr e2 pp_expr e3
  | Let (x, e1, e2) ->
    fprintf fmt "@[<hv>let %s =@ %a in@ %a@]"
      x pp_expr e1 pp_expr e2

let string_of_ty ty =
  Format.asprintf "%a" pp_ty ty

let string_of_expr e =
  Format.asprintf "%a" pp_expr e
```

### Using the Fmt Library (Recommended)

The `fmt` library provides a cleaner API:

```ocaml
let pp_ty : ty Fmt.t = fun fmt ty ->
  match ty with
  | TInt -> Fmt.string fmt "int"
  | TBool -> Fmt.string fmt "bool"
  | TArrow (t1, t2) ->
    Fmt.pf fmt "(%a -> %a)" pp_ty t1 pp_ty t2

(** Combinators for common patterns *)
let pp_list_comma pp_elt =
  Fmt.list ~sep:Fmt.comma pp_elt

let pp_binding pp_ty fmt (name, ty) =
  Fmt.pf fmt "%s : %a" name pp_ty ty

let pp_ctx =
  pp_list_comma (pp_binding pp_ty)
```

### Minimizing Parentheses

```ocaml
(** Precedence-aware pretty printing to minimize parentheses.
    Higher precedence binds tighter. *)

let prec_of_ty = function
  | TArrow _ -> 1
  | _ -> 10  (* atoms have high precedence *)

let rec pp_ty_prec (outer_prec : int) fmt ty =
  let inner_prec = prec_of_ty ty in
  let needs_parens = inner_prec < outer_prec in
  if needs_parens then Format.fprintf fmt "(";
  (match ty with
   | TInt -> Format.fprintf fmt "int"
   | TBool -> Format.fprintf fmt "bool"
   | TArrow (t1, t2) ->
     (* Arrow is right-associative: left arg needs higher prec *)
     Format.fprintf fmt "%a -> %a"
       (pp_ty_prec (inner_prec + 1)) t1
       (pp_ty_prec inner_prec) t2);
  if needs_parens then Format.fprintf fmt ")"
```

---

## Modules and Functors for Extensibility

### Parameterizing over the Variable Representation

```ocaml
(** Module type for variable representations. *)
module type VAR = sig
  type t
  val equal : t -> t -> bool
  val compare : t -> t -> int
  val pp : Format.formatter -> t -> unit
end

module NamedVar : VAR = struct
  type t = string
  let equal = String.equal
  let compare = String.compare
  let pp fmt s = Format.fprintf fmt "%s" s
end

module DeBruijnVar : VAR = struct
  type t = int
  let equal = Int.equal
  let compare = Int.compare
  let pp fmt i = Format.fprintf fmt "#%d" i
end
```

### Functor for a Generic Lambda Calculus

```ocaml
module type LAMBDA = sig
  type var
  type ty
  type expr

  val var : var -> expr
  val lam : var -> ty -> expr -> expr
  val app : expr -> expr -> expr
end

module MakeLambda (V : VAR) = struct
  type var = V.t

  type ty =
    | TBase of string
    | TArrow of ty * ty

  type expr =
    | Var of var
    | Lam of var * ty * expr
    | App of expr * expr

  let var x = Var x
  let lam x ty body = Lam (x, ty, body)
  let app e1 e2 = App (e1, e2)
end
```

### Extensible ASTs with Polymorphic Variants

OCaml's polymorphic variants enable open recursion in ASTs:

```ocaml
(** Base language: variables, lambdas, applications *)
type 'a base_expr = [
  | `Var of string
  | `Lam of string * 'a * 'a
  | `App of 'a * 'a
]

(** Extension: let bindings *)
type 'a let_expr = [
  | 'a base_expr
  | `Let of string * 'a * 'a
]

(** Extension: conditionals *)
type 'a cond_expr = [
  | 'a let_expr
  | `If of 'a * 'a * 'a
  | `BoolLit of bool
]

(** Tie the recursive knot *)
type full_expr = full_expr cond_expr

(** Evaluators compose via open recursion *)
let eval_base (eval : 'a -> value) : 'a base_expr -> value = function
  | `Var x -> Env.lookup !current_env x
  | `Lam (x, _ty, body) -> VClosure (!current_env, x, body)
  | `App (e1, e2) -> apply (eval e1) (eval e2)
```

**Gotcha:** Polymorphic variants are powerful but can produce inscrutable type errors. Use them only when you need extensibility; for most course projects, standard variants are preferable.

---

## GADTs for Type-Safe ASTs

GADTs (Generalized Algebraic Data Types) enable the construction of typed abstract syntax trees where the OCaml type system enforces well-typedness of the object language.

### Typed Expression AST

```ocaml
(** A GADT where the type parameter tracks the object-language type. *)
type _ expr =
  | Int : int -> int expr
  | Bool : bool -> bool expr
  | Add : int expr * int expr -> int expr
  | Eq : int expr * int expr -> bool expr
  | If : bool expr * 'a expr * 'a expr -> 'a expr
  | Lam : ('a -> 'b expr) -> ('a -> 'b) expr
  (** HOAS: use OCaml functions to represent binding *)
  | App : ('a -> 'b) expr * 'a expr -> 'b expr
```

### Type-Safe Evaluator

```ocaml
(** This evaluator cannot fail at runtime -- well-typedness is
    guaranteed by the GADT. *)
let rec eval : type a. a expr -> a = function
  | Int n -> n
  | Bool b -> b
  | Add (e1, e2) -> eval e1 + eval e2
  | Eq (e1, e2) -> eval e1 = eval e2
  | If (cond, then_, else_) ->
    if eval cond then eval then_ else eval else_
  | Lam f -> fun x -> eval (f x)
  | App (f, arg) -> (eval f) (eval arg)
```

### Type Equality Witness

```ocaml
(** A witness that two types are equal. *)
type (_, _) eq = Refl : ('a, 'a) eq

(** Runtime type representation for type-safe casting. *)
type _ ty_rep =
  | TyInt : int ty_rep
  | TyBool : bool ty_rep
  | TyArrow : 'a ty_rep * 'b ty_rep -> ('a -> 'b) ty_rep

let rec ty_eq : type a b. a ty_rep -> b ty_rep -> (a, b) eq option =
  fun t1 t2 ->
  match t1, t2 with
  | TyInt, TyInt -> Some Refl
  | TyBool, TyBool -> Some Refl
  | TyArrow (a1, r1), TyArrow (a2, r2) ->
    (match ty_eq a1 a2, ty_eq r1 r2 with
     | Some Refl, Some Refl -> Some Refl
     | _ -> None)
  | _, _ -> None
```

**Gotcha:** GADTs require locally abstract types (the `type a.` syntax) in recursive functions. Without this annotation, OCaml cannot refine the type variable in each branch.

---

## Testing with Alcotest

### Basic Test Structure

```ocaml
(* test/test_typecheck.ml *)

let test_int_literal () =
  let result = typecheck empty_ctx (IntLit 42) in
  Alcotest.(check (of_pp pp_ty)) "int literal has type int"
    TInt result

let test_identity_function () =
  let expr = Lam ("x", TInt, Var "x") in
  let result = typecheck empty_ctx expr in
  Alcotest.(check (of_pp pp_ty)) "identity has type int -> int"
    (TArrow (TInt, TInt)) result

let test_application () =
  let id_fn = Lam ("x", TInt, Var "x") in
  let expr = App (id_fn, IntLit 42) in
  let result = typecheck empty_ctx expr in
  Alcotest.(check (of_pp pp_ty)) "id 42 has type int"
    TInt result
```

### Testing for Expected Failures

```ocaml
let test_type_error () =
  let expr = App (IntLit 42, IntLit 0) in
  Alcotest.check_raises "applying non-function raises error"
    (TypeError { msg = "Expected function type"; loc = dummy_loc;
                 expected = None; actual = Some TInt })
    (fun () -> ignore (typecheck empty_ctx expr))

(** Alternative: test that any TypeError is raised *)
let test_type_error_generic () =
  let expr = App (IntLit 42, IntLit 0) in
  let raised = ref false in
  (try ignore (typecheck empty_ctx expr)
   with TypeError _ -> raised := true);
  Alcotest.(check bool) "type error raised" true !raised
```

### Organizing Tests

```ocaml
let typecheck_tests = [
  "int literal", `Quick, test_int_literal;
  "identity function", `Quick, test_identity_function;
  "application", `Quick, test_application;
  "type error on non-function app", `Quick, test_type_error;
]

let eval_tests = [
  "eval int", `Quick, test_eval_int;
  "eval application", `Quick, test_eval_application;
  "eval let", `Quick, test_eval_let;
]

let () =
  Alcotest.run "my_lang" [
    "typecheck", typecheck_tests;
    "eval", eval_tests;
  ]
```

### Property-Based Testing with QCheck

```ocaml
(** Generate random well-typed expressions for property-based testing. *)

(* If a term type-checks, evaluating it should not raise an exception
   (type safety as a property test). *)
let test_type_safety =
  QCheck.Test.make
    ~name:"well-typed terms evaluate without errors"
    ~count:1000
    gen_well_typed_expr
    (fun (expr, expected_ty) ->
       let ty = typecheck empty_ctx expr in
       assert (ty_equal ty expected_ty);
       (* Should not raise *)
       let _v = eval Env.empty expr in
       true)
```

---

## Common Pitfalls and Tips

### Pitfall: Forgetting Capture-Avoidance in Substitution

Named substitution is the single most common source of bugs in PL implementations. Symptoms include:

- Programs that work most of the time but produce wrong results when variable names overlap.
- Mysterious failures when a bound variable has the same name as a free variable.

**Fix:** Use de Bruijn indices, or use a well-tested substitution library. If using named variables, write extensive tests with overlapping variable names:

```ocaml
(* Test case: (fun x -> fun y -> x) y should not capture y *)
let test_capture_avoidance () =
  let expr = App (Lam ("x", TInt, Lam ("y", TInt, Var "x")), Var "y") in
  (* After one step: fun y' -> y  (renamed to avoid capture) *)
  let result = step expr in
  match result with
  | Some (Lam (_, _, Var "y")) -> ()  (* y refers to the outer y, not the binder *)
  | _ -> Alcotest.fail "Capture-avoidance failed"
```

### Pitfall: Mutable State in Type Inference

Unification uses mutable state (type variable cells). This can cause subtle bugs:

- Forgetting to generalize at the right point, causing monomorphism.
- Accidentally sharing type variables between independent terms.
- Not resetting state between test cases.

**Fix:** Always create fresh type variables for each new inference context. Use `level`-based generalization (as shown above) to avoid the need for explicit free-variable computation.

### Pitfall: Non-Exhaustive Matches on Values

When pattern matching on a value type, it is tempting to use a wildcard for "impossible" cases:

```ocaml
(* BAD *)
let apply v1 v2 = match v1 with
  | VClosure (env, x, body) -> eval (Env.extend env x v2) body
  | _ -> assert false

(* GOOD: match all cases explicitly *)
let apply v1 v2 = match v1 with
  | VClosure (env, x, body) -> eval (Env.extend env x v2) body
  | VInt _ -> failwith "Runtime error: cannot apply an integer"
  | VBool _ -> failwith "Runtime error: cannot apply a boolean"
```

### Pitfall: Shadowing in Environments

Association-list environments handle shadowing naturally (the most recent binding wins), but map-based environments silently replace old bindings. Both are correct for variable lookup, but be careful when you need to inspect all bindings (e.g., for free variable computation or context printing).

### Tip: Use `[@warning "-8"]` Sparingly

OCaml allows you to suppress pattern match warnings with `[@warning "-8"]`. Never do this in production code. Incomplete matches are bugs waiting to happen.

### Tip: Separate Syntax from Semantics

Keep the AST definition in its own module with no dependencies on evaluation or type checking. This prevents circular dependencies and makes it easy to write multiple passes over the same AST:

```
syntax.ml     (* AST definition only, no logic *)
eval.ml       (* depends on syntax *)
typecheck.ml  (* depends on syntax *)
pretty.ml     (* depends on syntax *)
```

### Tip: Test the Metatheory Computationally

Before attempting a paper proof, test your metatheoretic claims computationally:

```ocaml
(** Computational test of preservation:
    for a well-typed term, each step preserves the type. *)
let test_preservation expr =
  let ty = typecheck empty_ctx expr in
  let rec check e =
    match step e with
    | None -> ()  (* reached a value or stuck *)
    | Some e' ->
      let ty' = typecheck empty_ctx e' in
      assert (ty_equal ty ty');
      check e'
  in
  check expr
```

### Tip: Use ppx_deriving for Boilerplate

The `ppx_deriving` preprocessor can auto-generate `show`, `eq`, `ord`, and other functions for your types:

```ocaml
type ty =
  | TInt
  | TBool
  | TArrow of ty * ty
[@@deriving show, eq, ord]

(* This generates:
   val pp_ty : Format.formatter -> ty -> unit
   val show_ty : ty -> string
   val equal_ty : ty -> ty -> bool
   val compare_ty : ty -> ty -> int
*)
```

Add to your dune file:

```lisp
(library
 (name my_lang)
 (preprocess (pps ppx_deriving.show ppx_deriving.eq ppx_deriving.ord)))
```

### Tip: Structuring a Multi-Pass Compiler

For a language with type checking, elaboration, and evaluation:

```
1. Parse:      string -> raw_ast
2. Desugar:    raw_ast -> core_ast        (remove syntactic sugar)
3. Typecheck:  core_ast -> typed_ast      (annotate with types)
4. Elaborate:  typed_ast -> target_ast    (insert coercions, resolve implicits)
5. Evaluate:   target_ast -> value        (or compile to bytecode/native)
```

Each pass takes a well-defined input and produces a well-defined output. Keep the types for each stage separate:

```ocaml
module Raw = struct
  type expr = ...   (* parser output *)
end

module Core = struct
  type expr = ...   (* after desugaring *)
end

module Typed = struct
  type expr = ...   (* with type annotations *)
end
```

This prevents confusion about which stage of processing a term belongs to.
