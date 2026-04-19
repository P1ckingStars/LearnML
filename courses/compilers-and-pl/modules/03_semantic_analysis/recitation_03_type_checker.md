# Recitation 03: Implementing a Type Checker

## Overview

In this recitation, we build a type checker for a simply-typed functional language with let-polymorphism. We progress through four stages: (1) a basic type checker for a monomorphic language, (2) adding unification, (3) adding polymorphism, and (4) improving error reporting.

---

## 1. The Source Language: Mini-ML

### 1.1 Abstract Syntax

```
type expr =
    | IntLit of int
    | BoolLit of bool
    | Var of string
    | BinOp of op * expr * expr
    | If of expr * expr * expr
    | Lambda of string * expr           (* no annotation: infer *)
    | App of expr * expr
    | Let of string * expr * expr
    | LetRec of string * expr * expr

type op = Add | Sub | Mul | Lt | Eq | And | Or
```

### 1.2 Types

```
type ty =
    | TInt
    | TBool
    | TFun of ty * ty
    | TVar of tvar ref

and tvar =
    | Unbound of int * int     (* id, level *)
    | Link of ty               (* resolved *)

type scheme = Forall of int list * ty   (* quantified variables, body *)
```

The `TVar` uses a mutable reference for efficient unification (union-find style). The `level` field supports efficient generalization (discussed below).

---

## 2. Stage 1: Basic Type Checking (Monomorphic)

### 2.1 Environment

```
type env = (string * scheme) list

let lookup (name: string) (env: env): scheme =
    match List.assoc_opt name env with
    | Some s -> s
    | None -> error ("Unbound variable: " ^ name)
```

### 2.2 Core Type Checker

```
let current_id = ref 0
let current_level = ref 0

let fresh_tvar () =
    let id = !current_id in
    current_id := id + 1;
    TVar (ref (Unbound (id, !current_level)))

let rec typecheck (env: env) (expr: expr): ty =
    match expr with
    | IntLit _ -> TInt
    | BoolLit _ -> TBool

    | Var name ->
        let scheme = lookup name env in
        instantiate scheme

    | BinOp (op, e1, e2) ->
        let t1 = typecheck env e1 in
        let t2 = typecheck env e2 in
        typecheck_binop op t1 t2

    | If (cond, then_e, else_e) ->
        let tc = typecheck env cond in
        unify tc TBool;
        let tt = typecheck env then_e in
        let te = typecheck env else_e in
        unify tt te;
        tt

    | Lambda (param, body) ->
        let param_ty = fresh_tvar () in
        let body_ty = typecheck ((param, Forall([], param_ty)) :: env) body in
        TFun (param_ty, body_ty)

    | App (func, arg) ->
        let func_ty = typecheck env func in
        let arg_ty = typecheck env arg in
        let ret_ty = fresh_tvar () in
        unify func_ty (TFun (arg_ty, ret_ty));
        ret_ty

    | Let (name, rhs, body) ->
        incr current_level;
        let rhs_ty = typecheck env rhs in
        decr current_level;
        let scheme = generalize rhs_ty in
        typecheck ((name, scheme) :: env) body

    | LetRec (name, rhs, body) ->
        let rhs_ty = fresh_tvar () in
        incr current_level;
        let env' = (name, Forall([], rhs_ty)) :: env in
        let actual_ty = typecheck env' rhs in
        unify rhs_ty actual_ty;
        decr current_level;
        let scheme = generalize rhs_ty in
        typecheck ((name, scheme) :: env) body

and typecheck_binop op t1 t2 =
    match op with
    | Add | Sub | Mul ->
        unify t1 TInt; unify t2 TInt; TInt
    | Lt ->
        unify t1 TInt; unify t2 TInt; TBool
    | Eq ->
        unify t1 t2; TBool
    | And | Or ->
        unify t1 TBool; unify t2 TBool; TBool
```

---

## 3. Stage 2: Implementing Unification

### 3.1 Occurs Check and Path Compression

```
let rec resolve (ty: ty): ty =
    match ty with
    | TVar ({contents = Link t} as r) ->
        let t' = resolve t in
        r := Link t';          (* path compression *)
        t'
    | t -> t

let occurs_check (id: int) (ty: ty): unit =
    let rec check ty =
        match resolve ty with
        | TVar {contents = Unbound (id', _)} when id = id' ->
            error "Infinite type (occurs check)"
        | TVar {contents = Unbound _} -> ()
        | TFun (a, b) -> check a; check b
        | TInt | TBool -> ()
        | TVar {contents = Link _} -> assert false  (* resolved by resolve *)
    in check ty
```

### 3.2 Unification

```
let rec unify (t1: ty) (t2: ty): unit =
    let t1 = resolve t1 in
    let t2 = resolve t2 in
    if t1 == t2 then ()      (* physical equality: same node *)
    else match (t1, t2) with
    | (TInt, TInt) -> ()
    | (TBool, TBool) -> ()
    | (TFun (a1, r1), TFun (a2, r2)) ->
        unify a1 a2;
        unify r1 r2
    | (TVar ({contents = Unbound (id, level)} as r), t)
    | (t, TVar ({contents = Unbound (id, level)} as r)) ->
        occurs_check id t;
        adjust_levels level t;
        r := Link t
    | _ ->
        error ("Type mismatch: " ^ show_ty t1 ^ " vs " ^ show_ty t2)

(* Adjust levels for correct generalization *)
and adjust_levels (level: int) (ty: ty): unit =
    match resolve ty with
    | TVar ({contents = Unbound (id, level')} as r) ->
        if level' > level then
            r := Unbound (id, level)
    | TFun (a, b) ->
        adjust_levels level a;
        adjust_levels level b
    | _ -> ()
```

### 3.3 Understanding Levels

The **level** mechanism (due to Remy) efficiently determines which type variables can be generalized without computing free variables of the entire environment.

**Invariant:** A type variable at level $\ell$ was introduced at nesting depth $\ell$ of `let`-bindings. A variable can be generalized if its level is *greater than* the current level after leaving the `let`-body.

```
let x = (* level incremented to 1 *)
    e1   (* fresh vars here get level 1 *)
(* level decremented to 0 *)
(* generalize: vars at level > 0 can be generalized *)
in e2
```

---

## 4. Stage 3: Handling Polymorphism

### 4.1 Generalization

```
let generalize (ty: ty): scheme =
    let vars = ref [] in
    let rec collect ty =
        match resolve ty with
        | TVar {contents = Unbound (id, level)} when level > !current_level ->
            if not (List.mem id !vars) then
                vars := id :: !vars
        | TFun (a, b) -> collect a; collect b
        | _ -> ()
    in
    collect ty;
    Forall (!vars, ty)
```

### 4.2 Instantiation

```
let instantiate (scheme: scheme): ty =
    match scheme with
    | Forall ([], ty) -> ty       (* monomorphic: no copying needed *)
    | Forall (vars, ty) ->
        let mapping = List.map (fun id -> (id, fresh_tvar ())) vars in
        let rec subst ty =
            match resolve ty with
            | TVar {contents = Unbound (id, _)} ->
                (match List.assoc_opt id mapping with
                 | Some t -> t
                 | None -> ty)
            | TFun (a, b) -> TFun (subst a, subst b)
            | t -> t
        in subst ty
```

### 4.3 Testing Polymorphism

```
(* let id = fun x -> x in (id 42, id true) *)
let test_poly =
    Let ("id",
        Lambda ("x", Var "x"),
        (* We'd need pairs for the full test, but we can test: *)
        Let ("a", App (Var "id", IntLit 42),
            App (Var "id", BoolLit true)))
(* Expected: TBool *)

(* let compose = fun f -> fun g -> fun x -> f (g x)
   should get: (b -> c) -> (a -> b) -> a -> c *)
let test_compose =
    Let ("compose",
        Lambda ("f", Lambda ("g", Lambda ("x",
            App (Var "f", App (Var "g", Var "x"))))),
        Var "compose")
```

---

## 5. Stage 4: Error Reporting

### 5.1 Enriching Error Context

```
type location = { line: int; col: int; file: string }

type typed_error =
    | UnboundVar of string * location
    | TypeMismatch of ty * ty * location * string   (* expected, actual, loc, context *)
    | OccursCheck of int * ty * location
    | NotAFunction of ty * location

exception TypeError of typed_error

let format_error (err: typed_error): string =
    match err with
    | UnboundVar (name, loc) ->
        Printf.sprintf "%s:%d:%d: error: unbound variable '%s'"
            loc.file loc.line loc.col name
    | TypeMismatch (expected, actual, loc, ctx) ->
        Printf.sprintf "%s:%d:%d: error: type mismatch\n  expected: %s\n  actual:   %s\n  context:  %s"
            loc.file loc.line loc.col
            (show_ty expected) (show_ty actual) ctx
    | OccursCheck (id, ty, loc) ->
        Printf.sprintf "%s:%d:%d: error: infinite type: '%s occurs in %s"
            loc.file loc.line loc.col (show_tvar id) (show_ty ty)
    | NotAFunction (ty, loc) ->
        Printf.sprintf "%s:%d:%d: error: expected a function, got %s"
            loc.file loc.line loc.col (show_ty ty)
```

### 5.2 Pretty-Printing Types

```
let show_ty (ty: ty): string =
    let next_name = ref 0 in
    let names = Hashtbl.create 16 in
    let get_name id =
        match Hashtbl.find_opt names id with
        | Some n -> n
        | None ->
            let n = String.make 1 (Char.chr (Char.code 'a' + !next_name)) in
            incr next_name;
            Hashtbl.add names id n;
            "'" ^ n
    in
    let rec go ty =
        match resolve ty with
        | TInt -> "int"
        | TBool -> "bool"
        | TVar {contents = Unbound (id, _)} -> get_name id
        | TFun (a, b) ->
            let a_str = match resolve a with
                | TFun _ -> "(" ^ go a ^ ")"
                | _ -> go a
            in
            a_str ^ " -> " ^ go b
        | TVar {contents = Link _} -> assert false
    in go ty
```

---

## 6. Exercises

### Exercise 1: Extend with Pairs

Add pair types `(a, b)` with operations `fst` and `snd`:

```
type ty = ... | TPair of ty * ty
type expr = ... | Pair of expr * expr | Fst of expr | Snd of expr
```

Implement the typing rules:

$$\frac{\Gamma \vdash e_1 : \tau_1 \quad \Gamma \vdash e_2 : \tau_2}{\Gamma \vdash (e_1, e_2) : \tau_1 \times \tau_2}$$

$$\frac{\Gamma \vdash e : \tau_1 \times \tau_2}{\Gamma \vdash \texttt{fst}\; e : \tau_1} \qquad \frac{\Gamma \vdash e : \tau_1 \times \tau_2}{\Gamma \vdash \texttt{snd}\; e : \tau_2}$$

### Exercise 2: Extend with Lists

Add list types with `Nil`, `Cons`, and `match`:

```
type ty = ... | TList of ty
type expr = ... | Nil | Cons of expr * expr
           | Match of expr * expr * string * string * expr
           (* match e with Nil -> e1 | Cons(h, t) -> e2 *)
```

### Exercise 3: Add Recursive Types

Implement equi-recursive types by removing the occurs check. Test with:

```
(* fix : (a -> a) -> a *)
let fix = fun f -> (fun x -> f (x x)) (fun x -> f (x x))
```

Discuss: What types does the system infer? Is the principal type property preserved?

### Exercise 4: Error Recovery

Modify the type checker to continue after the first error, collecting all type errors in the program. This requires careful handling of failed unifications (inserting error types and continuing).

---

## 7. Testing Strategy

```
let run_test (name: string) (expr: expr) (expected: string): unit =
    current_id := 0;
    current_level := 0;
    try
        let ty = typecheck [] expr in
        let result = show_ty ty in
        if result = expected then
            Printf.printf "PASS: %s : %s\n" name result
        else
            Printf.printf "FAIL: %s\n  expected: %s\n  got:      %s\n"
                name expected result
    with e ->
        Printf.printf "FAIL: %s raised %s\n" name (Printexc.to_string e)

let () =
    run_test "int literal" (IntLit 42) "int";
    run_test "identity" (Lambda ("x", Var "x")) "'a -> 'a";
    run_test "apply id to int"
        (App (Lambda ("x", Var "x"), IntLit 42)) "int";
    run_test "let-polymorphism"
        (Let ("id", Lambda ("x", Var "x"),
            Let ("_", App (Var "id", IntLit 42),
                App (Var "id", BoolLit true))))
        "bool";
    run_test "compose"
        (Let ("compose",
            Lambda ("f", Lambda ("g", Lambda ("x",
                App (Var "f", App (Var "g", Var "x"))))),
            Var "compose"))
        "('a -> 'b) -> ('c -> 'a) -> 'c -> 'b"
```

---

## References

1. Remy, D. (1992). "Extension of ML Type System with a Sorted Equational Theory on Types." Research Report 1766, INRIA.
2. Oleg Kiselyov. "How OCaml type checker works." (Blog post / tutorial.)
3. Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press, Chapters 22--23.
