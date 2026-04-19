---
title: "Recitation 08: Dependent Type Checker"
tags:
  - type-theory
  - dependent-types
  - recitation
---
# Recitation 08: Dependent Type Checker

> **Module 08 --- Dependent Types (Weeks 15--16)**
> Estimated time: 3--4 hours (guided implementation)

---

## Overview

In this recitation, we implement a type checker for a small dependently typed language in OCaml. The language supports:

- Pi types ($\Pi(x : A).\, B(x)$) --- dependent function types
- Sigma types ($\Sigma(x : A).\, B(x)$) --- dependent pair types
- A universe $\text{Type}$
- Lambda abstractions and applications
- Pairs and projections
- Natural numbers with an eliminator

The implementation demonstrates the key ideas from Lectures 08a--08d:

- Terms and types live in the same syntactic category.
- Type checking requires normalization (evaluation to values).
- Conversion checking compares values for definitional equality.
- Bidirectional type checking separates checking and inference.

---

## 1. Syntax

### 1.1 The Core Language

Our language has the following abstract syntax:

```ocaml
(** De Bruijn indices for variables *)
type index = int

(** Expressions: terms and types unified *)
type expr =
  | Var of index                          (* x *)
  | Ann of expr * expr                    (* (t : A) --- annotated term *)
  | Uni                                   (* Type --- the universe *)
  | Pi of string * expr * expr            (* Pi (x : A). B *)
  | Lam of string * expr                  (* lam x. t --- no annotation *)
  | App of expr * expr                    (* f a *)
  | Sigma of string * expr * expr         (* Sigma (x : A). B *)
  | Pair of expr * expr                   (* (a, b) *)
  | Fst of expr                           (* fst p *)
  | Snd of expr                           (* snd p *)
  | Nat                                   (* Nat type *)
  | Zero                                  (* 0 *)
  | Succ of expr                          (* succ n *)
  | NatElim of expr * expr * expr * expr  (* NatElim C c0 cs n *)
```

**Design decisions:**

- We use **de Bruijn indices** for variables. This avoids alpha-conversion issues entirely.
- Lambda abstractions carry a name hint (for pretty-printing) but no type annotation. The type is provided by the checking judgment.
- Annotated terms `Ann(t, A)` allow switching from checking to synthesis mode.
- `Uni` is the universe. We use a single universe (`Type : Type`) for simplicity. This is inconsistent (Girard's paradox) but suffices for our implementation exercise. A production system would use a universe hierarchy.

### 1.2 Values and the Semantic Domain

For normalization by evaluation (NbE), we need a separate value domain:

```ocaml
(** Values: the semantic domain *)
type value =
  | VNeutral of neutral              (* stuck computation *)
  | VUni                             (* Type *)
  | VPi of string * value * closure  (* Pi (x : A). B *)
  | VLam of string * closure         (* lam x. t *)
  | VSigma of string * value * closure (* Sigma (x : A). B *)
  | VPair of value * value           (* (a, b) *)
  | VNat                             (* Nat *)
  | VZero                            (* 0 *)
  | VSucc of value                   (* succ v *)

(** Neutral values: computations stuck on a free variable *)
and neutral =
  | NVar of int                      (* free variable (de Bruijn level) *)
  | NApp of neutral * value          (* stuck application *)
  | NFst of neutral                  (* stuck first projection *)
  | NSnd of neutral                  (* stuck second projection *)
  | NNatElim of value * value * value * neutral  (* stuck NatElim *)

(** Closures: a term together with its environment *)
and closure = {
  name : string;
  env : env;
  body : expr;
}

(** Environments: lists of values, indexed by de Bruijn index *)
and env = value list
```

**Key points:**

- **Closures** represent functions: a `closure` is a term `body` paired with an environment `env` in which to evaluate it. When applied to a value `v`, we evaluate `body` in the environment `v :: env`.
- **Neutral values** are computations that are "stuck" because they are waiting on a free variable. For example, `NApp(NVar 0, VZero)` represents the stuck application of a free variable to zero.
- **De Bruijn levels** are used for free variables in the value domain (as opposed to de Bruijn indices in the syntax). This simplifies quotation.

---

## 2. Evaluation

### 2.1 The Evaluator

Evaluation maps a syntactic term (with an environment) to a semantic value. This is the first half of NbE.

```ocaml
(** Apply a closure to a value *)
let apply_closure (cl : closure) (v : value) : value =
  eval (v :: cl.env) cl.body

(** Evaluate a term in an environment *)
and eval (env : env) (t : expr) : value =
  match t with
  | Var i ->
    (try List.nth env i
     with _ -> failwith (Printf.sprintf "Unbound variable: index %d" i))
  | Ann (t, _) ->
    eval env t  (* annotations are erased during evaluation *)
  | Uni ->
    VUni
  | Pi (x, a, b) ->
    VPi (x, eval env a, { name = x; env; body = b })
  | Lam (x, body) ->
    VLam (x, { name = x; env; body })
  | App (f, a) ->
    let vf = eval env f in
    let va = eval env a in
    do_app vf va
  | Sigma (x, a, b) ->
    VSigma (x, eval env a, { name = x; env; body = b })
  | Pair (a, b) ->
    VPair (eval env a, eval env b)
  | Fst p ->
    do_fst (eval env p)
  | Snd p ->
    do_snd (eval env p)
  | Nat -> VNat
  | Zero -> VZero
  | Succ n -> VSucc (eval env n)
  | NatElim (c, c0, cs, n) ->
    do_nat_elim (eval env c) (eval env c0) (eval env cs) (eval env n)

(** Apply a value to another value *)
and do_app (f : value) (a : value) : value =
  match f with
  | VLam (_, cl) -> apply_closure cl a
  | VNeutral ne -> VNeutral (NApp (ne, a))
  | _ -> failwith "do_app: not a function"

(** First projection *)
and do_fst (p : value) : value =
  match p with
  | VPair (a, _) -> a
  | VNeutral ne -> VNeutral (NFst ne)
  | _ -> failwith "do_fst: not a pair"

(** Second projection *)
and do_snd (p : value) : value =
  match p with
  | VPair (_, b) -> b
  | VNeutral ne -> VNeutral (NSnd ne)
  | _ -> failwith "do_snd: not a pair"

(** Natural number eliminator *)
and do_nat_elim (c : value) (c0 : value) (cs : value) (n : value) : value =
  match n with
  | VZero -> c0
  | VSucc n' ->
    (* cs n' (natElim c c0 cs n') *)
    let ih = do_nat_elim c c0 cs n' in
    do_app (do_app cs n') ih
  | VNeutral ne -> VNeutral (NNatElim (c, c0, cs, ne))
  | _ -> failwith "do_nat_elim: not a Nat"
```

### 2.2 Discussion

**Why evaluate?** In a dependently typed language, types can contain arbitrary computations. To check whether two types are equal, we must reduce them. Evaluation to values handles all beta-reductions at once.

**Stuck computations.** When a function applied to a free variable cannot reduce further, the result is a neutral value. For example, evaluating `App(Var 0, Zero)` where `Var 0` is free produces `VNeutral (NApp (NVar 0, VZero))`.

**Type annotations are erased.** The `Ann(t, A)` form is used only during type checking; evaluation ignores the annotation. This is sound because well-typed terms do not get stuck.

---

## 3. Quotation (Reading Back)

### 3.1 Quote and Read-back

Quotation converts values back to syntactic terms in normal form. This is the second half of NbE.

```ocaml
(** Quote a value to a term in normal form.
    [depth] is the current binding depth (number of lambdas/pis we're under). *)
let rec quote (depth : int) (v : value) : expr =
  match v with
  | VNeutral ne ->
    quote_neutral depth ne
  | VUni ->
    Uni
  | VPi (x, a, cl) ->
    let va = quote depth a in
    let vb = quote (depth + 1) (apply_closure cl (VNeutral (NVar depth))) in
    Pi (x, va, vb)
  | VLam (x, cl) ->
    (* Eta-expand: apply to a fresh variable and quote the result *)
    let body = quote (depth + 1) (apply_closure cl (VNeutral (NVar depth))) in
    Lam (x, body)
  | VSigma (x, a, cl) ->
    let va = quote depth a in
    let vb = quote (depth + 1) (apply_closure cl (VNeutral (NVar depth))) in
    Sigma (x, va, vb)
  | VPair (a, b) ->
    Pair (quote depth a, quote depth b)
  | VNat -> Nat
  | VZero -> Zero
  | VSucc n -> Succ (quote depth n)

(** Quote a neutral value *)
and quote_neutral (depth : int) (ne : neutral) : expr =
  match ne with
  | NVar level ->
    (* Convert de Bruijn level to de Bruijn index *)
    Var (depth - level - 1)
  | NApp (f, a) ->
    App (quote_neutral depth f, quote depth a)
  | NFst p ->
    Fst (quote_neutral depth p)
  | NSnd p ->
    Snd (quote_neutral depth p)
  | NNatElim (c, c0, cs, n) ->
    NatElim (quote depth c, quote depth c0, quote depth cs,
             quote_neutral depth n)
```

**Key point: eta expansion for functions.** When quoting a `VLam`, we apply the closure to a fresh variable (a neutral `NVar depth`) and quote the body. This produces an eta-long normal form: every function is of the form $\lambda x.\, \text{body}$, even if the original term was just a variable.

**De Bruijn levels vs. indices.** Free variables in values use *levels* (counting from the outermost binder inward), while the syntax uses *indices* (counting from the innermost binder outward). The conversion is `index = depth - level - 1`.

---

## 4. Conversion Checking

### 4.1 Definitional Equality

Two values are definitionally equal if they have the same normal form. We implement this by comparing values directly, without going through quotation (which is equivalent but less efficient).

```ocaml
(** Check whether two values are convertible at a given depth *)
let rec conv (depth : int) (v1 : value) (v2 : value) : bool =
  match v1, v2 with
  | VUni, VUni -> true
  | VNat, VNat -> true
  | VZero, VZero -> true
  | VSucc n1, VSucc n2 -> conv depth n1 n2

  | VPi (_, a1, cl1), VPi (_, a2, cl2) ->
    conv depth a1 a2
    && let fresh = VNeutral (NVar depth) in
       conv (depth + 1) (apply_closure cl1 fresh) (apply_closure cl2 fresh)

  | VLam (_, cl1), VLam (_, cl2) ->
    let fresh = VNeutral (NVar depth) in
    conv (depth + 1) (apply_closure cl1 fresh) (apply_closure cl2 fresh)

  (* Eta for functions: compare f with lam x. f x *)
  | VLam (_, cl), v | v, VLam (_, cl) ->
    let fresh = VNeutral (NVar depth) in
    conv (depth + 1) (apply_closure cl fresh) (do_app v fresh)

  | VSigma (_, a1, cl1), VSigma (_, a2, cl2) ->
    conv depth a1 a2
    && let fresh = VNeutral (NVar depth) in
       conv (depth + 1) (apply_closure cl1 fresh) (apply_closure cl2 fresh)

  | VPair (a1, b1), VPair (a2, b2) ->
    conv depth a1 a2 && conv depth b1 b2

  (* Eta for pairs: compare p with (fst p, snd p) *)
  | VPair (a, b), v | v, VPair (a, b) ->
    conv depth a (do_fst v) && conv depth b (do_snd v)

  | VNeutral ne1, VNeutral ne2 ->
    conv_neutral depth ne1 ne2

  | _, _ -> false

(** Check whether two neutral values are convertible *)
and conv_neutral (depth : int) (ne1 : neutral) (ne2 : neutral) : bool =
  match ne1, ne2 with
  | NVar l1, NVar l2 -> l1 = l2
  | NApp (f1, a1), NApp (f2, a2) ->
    conv_neutral depth f1 f2 && conv depth a1 a2
  | NFst p1, NFst p2 -> conv_neutral depth p1 p2
  | NSnd p1, NSnd p2 -> conv_neutral depth p1 p2
  | NNatElim (c1, c01, cs1, n1), NNatElim (c2, c02, cs2, n2) ->
    conv depth c1 c2 && conv depth c01 c02
    && conv depth cs1 cs2 && conv_neutral depth n1 n2
  | _, _ -> false
```

### 4.2 Eta Rules

The conversion checker implements two eta rules:

1. **Eta for functions:** A lambda `VLam(_, cl)` is convertible with a value `v` if, for a fresh variable `x`, `cl(x)` is convertible with `v(x)`.
2. **Eta for pairs:** A pair `VPair(a, b)` is convertible with a value `v` if `a` converts with `fst v` and `b` converts with `snd v`.

These eta rules are crucial for making the type checker accept programs that are "obviously" equal.

---

## 5. Type Checking (Bidirectional)

### 5.1 Contexts

The type checker maintains a context mapping variables to their types (as values):

```ocaml
(** Type checking context *)
type ctx = {
  types : value list;    (* types of variables, indexed by de Bruijn index *)
  depth : int;           (* current binding depth = number of bindings *)
  env : env;             (* evaluation environment for defined variables *)
}

let empty_ctx : ctx = { types = []; depth = 0; env = [] }

(** Extend context with a new binding *)
let extend (ctx : ctx) (name : string) (ty : value) : ctx =
  let var = VNeutral (NVar ctx.depth) in
  { types = ty :: ctx.types;
    depth = ctx.depth + 1;
    env = var :: ctx.env }

(** Look up the type of a variable *)
let lookup (ctx : ctx) (i : index) : value =
  try List.nth ctx.types i
  with _ -> failwith (Printf.sprintf "Unbound variable: index %d" i)
```

### 5.2 The Type Checker

```ocaml
(** Ensure two values are convertible, raising an error if not *)
let ensure_conv (ctx : ctx) (expected : value) (actual : value) : unit =
  if not (conv ctx.depth expected actual) then
    failwith (Printf.sprintf "Type mismatch:\n  expected: %s\n  actual:   %s"
                (show_expr (quote ctx.depth expected))
                (show_expr (quote ctx.depth actual)))

(** Evaluate a term in the checker's environment *)
let eval_in (ctx : ctx) (t : expr) : value =
  eval ctx.env t

(** Check that a term has a given type.
    check ctx t ty  checks  ctx |- t <= ty *)
let rec check (ctx : ctx) (t : expr) (ty : value) : unit =
  match t, ty with
  (* Lam checks against Pi *)
  | Lam (x, body), VPi (_, a, b_cl) ->
    let ctx' = extend ctx x a in
    let b = apply_closure b_cl (VNeutral (NVar ctx.depth)) in
    check ctx' body b

  (* Pair checks against Sigma *)
  | Pair (a, b), VSigma (_, ty_a, ty_b_cl) ->
    check ctx a ty_a;
    let va = eval_in ctx a in
    let ty_b = apply_closure ty_b_cl va in
    check ctx b ty_b

  (* Zero checks against Nat *)
  | Zero, VNat -> ()

  (* Succ n checks against Nat *)
  | Succ n, VNat ->
    check ctx n VNat

  (* Fall-through: infer the type and check convertibility *)
  | _, _ ->
    let inferred = infer ctx t in
    ensure_conv ctx ty inferred

(** Infer the type of a term.
    infer ctx t  computes  ctx |- t => ty *)
and infer (ctx : ctx) (t : expr) : value =
  match t with
  | Var i ->
    lookup ctx i

  | Ann (t, a) ->
    (* Check that a is a type (i.e., a : Type), then check t : a *)
    let _ = check_is_type ctx a in
    let va = eval_in ctx a in
    check ctx t va;
    va

  | Uni ->
    (* Type : Type --- inconsistent but simple *)
    VUni

  | Pi (x, a, b) ->
    check_is_type ctx a;
    let va = eval_in ctx a in
    let ctx' = extend ctx x va in
    check_is_type ctx' b;
    VUni

  | Sigma (x, a, b) ->
    check_is_type ctx a;
    let va = eval_in ctx a in
    let ctx' = extend ctx x va in
    check_is_type ctx' b;
    VUni

  | App (f, a) ->
    let tf = infer ctx f in
    begin match tf with
    | VPi (_, ta, tb_cl) ->
      check ctx a ta;
      let va = eval_in ctx a in
      apply_closure tb_cl va
    | _ ->
      failwith "infer App: function does not have Pi type"
    end

  | Fst p ->
    let tp = infer ctx p in
    begin match tp with
    | VSigma (_, a, _) -> a
    | _ -> failwith "infer Fst: argument does not have Sigma type"
    end

  | Snd p ->
    let tp = infer ctx p in
    begin match tp with
    | VSigma (_, _, b_cl) ->
      let vp = eval_in ctx p in
      apply_closure b_cl (do_fst vp)
    | _ -> failwith "infer Snd: argument does not have Sigma type"
    end

  | Nat -> VUni

  | NatElim (c, c0, cs, n) ->
    (* c : Nat -> Type *)
    check ctx c (VPi ("n", VNat, { name = "n"; env = []; body = Uni }));
    let vc = eval_in ctx c in
    (* c0 : c 0 *)
    check ctx c0 (do_app vc VZero);
    (* cs : Pi (k : Nat). c k -> c (succ k) *)
    let cs_ty = VPi ("k", VNat,
      { name = "k"; env = [];
        body =
          let c_shifted = shift_expr 1 0 c in
          Pi ("_",
              App (c_shifted, Var 0),
              App (shift_expr 1 0 c_shifted, Succ (Var 1))) }) in
    (* Alternative: build the step type using values directly *)
    let cs_ty_v =
      VPi ("k", VNat,
        { name = "k"; env = [vc];
          body = Pi ("ih", App (Var 1, Var 0),
                          App (Var 2, Succ (Var 1))) })
    in
    ignore cs_ty;  (* use the value-based version *)
    check ctx cs cs_ty_v;
    (* n : Nat *)
    check ctx n VNat;
    let vn = eval_in ctx n in
    do_app vc vn

  | Lam _ ->
    failwith "infer: cannot infer type of unannotated lambda"

  | Pair _ ->
    failwith "infer: cannot infer type of unannotated pair"

  | Zero ->
    VNat

  | Succ n ->
    check ctx n VNat;
    VNat

(** Check that an expression is a valid type (i.e., it has type Type) *)
and check_is_type (ctx : ctx) (a : expr) : unit =
  let sort = infer ctx a in
  match sort with
  | VUni -> ()
  | _ -> failwith "check_is_type: expression is not a type"

(** Shift de Bruijn indices in an expression *)
and shift_expr (amount : int) (cutoff : int) (e : expr) : expr =
  match e with
  | Var i -> if i >= cutoff then Var (i + amount) else Var i
  | Ann (t, a) -> Ann (shift_expr amount cutoff t, shift_expr amount cutoff a)
  | Uni -> Uni
  | Pi (x, a, b) ->
    Pi (x, shift_expr amount cutoff a, shift_expr amount (cutoff + 1) b)
  | Lam (x, body) -> Lam (x, shift_expr amount (cutoff + 1) body)
  | App (f, a) -> App (shift_expr amount cutoff f, shift_expr amount cutoff a)
  | Sigma (x, a, b) ->
    Sigma (x, shift_expr amount cutoff a, shift_expr amount (cutoff + 1) b)
  | Pair (a, b) -> Pair (shift_expr amount cutoff a, shift_expr amount cutoff b)
  | Fst p -> Fst (shift_expr amount cutoff p)
  | Snd p -> Snd (shift_expr amount cutoff p)
  | Nat -> Nat
  | Zero -> Zero
  | Succ n -> Succ (shift_expr amount cutoff n)
  | NatElim (c, c0, cs, n) ->
    NatElim (shift_expr amount cutoff c, shift_expr amount cutoff c0,
             shift_expr amount cutoff cs, shift_expr amount cutoff n)
```

### 5.3 Discussion of Key Rules

**Lambda checking.** When checking `Lam(x, body)` against `VPi(_, a, b_cl)`, we:

1. Extend the context with a fresh variable of type `a`.
2. Apply the codomain closure `b_cl` to the fresh variable to get the expected type of `body`.
3. Check `body` against this expected type.

This is where bidirectional type checking shines: the lambda needs no type annotation because the Pi type provides all the information.

**Application inference.** When inferring the type of `App(f, a)`:

1. Infer the type of `f`, which must be `VPi(_, ta, tb_cl)`.
2. Check `a` against `ta`.
3. The result type is `tb_cl` applied to the *value* of `a` --- this is where the dependency kicks in.

**Second projection.** The type of `Snd(p)` is `B(Fst(p))` --- the codomain of the Sigma type applied to the *first projection of $p$*. This is the dependent typing of the second projection in action.

---

## 6. Testing

### 6.1 Helper Functions

```ocaml
(** Pretty printer (simplified) *)
let rec show_expr (e : expr) : string =
  match e with
  | Var i -> Printf.sprintf "v%d" i
  | Ann (t, a) -> Printf.sprintf "(%s : %s)" (show_expr t) (show_expr a)
  | Uni -> "Type"
  | Pi (x, a, b) -> Printf.sprintf "(Pi (%s : %s). %s)" x (show_expr a) (show_expr b)
  | Lam (x, body) -> Printf.sprintf "(lam %s. %s)" x (show_expr body)
  | App (f, a) -> Printf.sprintf "(%s %s)" (show_expr f) (show_expr a)
  | Sigma (x, a, b) -> Printf.sprintf "(Sigma (%s : %s). %s)" x (show_expr a) (show_expr b)
  | Pair (a, b) -> Printf.sprintf "(%s, %s)" (show_expr a) (show_expr b)
  | Fst p -> Printf.sprintf "(fst %s)" (show_expr p)
  | Snd p -> Printf.sprintf "(snd %s)" (show_expr p)
  | Nat -> "Nat"
  | Zero -> "0"
  | Succ n -> Printf.sprintf "(succ %s)" (show_expr n)
  | NatElim (c, c0, cs, n) ->
    Printf.sprintf "(NatElim %s %s %s %s)"
      (show_expr c) (show_expr c0) (show_expr cs) (show_expr n)
```

### 6.2 Test Cases

```ocaml
(** Test 1: The polymorphic identity function *)
(* id : Pi (A : Type). A -> A *)
(* id = lam A. lam x. x *)
let id_type = Pi ("A", Uni, Pi ("x", Var 0, Var 1))
let id_term = Lam ("A", Lam ("x", Var 0))

let test_id () =
  let ty = eval [] id_type in
  check empty_ctx id_term ty;
  Printf.printf "Test 1 (id): PASSED\n"

(** Test 2: Natural number successor *)
(* succ_fn : Nat -> Nat *)
(* succ_fn = lam n. succ n *)
let succ_type = Pi ("n", Nat, Nat)
let succ_term = Lam ("n", Succ (Var 0))

let test_succ () =
  let ty = eval [] succ_type in
  check empty_ctx succ_term ty;
  Printf.printf "Test 2 (succ): PASSED\n"

(** Test 3: Addition via NatElim *)
(* add : Nat -> Nat -> Nat *)
(* add = lam m. lam n. NatElim (lam _. Nat) n (lam _ ih. succ ih) m *)
let add_type = Pi ("m", Nat, Pi ("n", Nat, Nat))
let add_term =
  Lam ("m", Lam ("n",
    NatElim (
      Lam ("_", Nat),           (* motive: lam _. Nat *)
      Var 0,                     (* base case: n *)
      Lam ("k", Lam ("ih",      (* step: lam k ih. succ ih *)
        Succ (Var 0))),
      Var 1                      (* scrutinee: m *)
    )))

let test_add () =
  let ty = eval [] add_type in
  check empty_ctx add_term ty;
  Printf.printf "Test 3 (add): PASSED\n"

(** Test 4: Dependent pair --- a Nat paired with a proof *)
(* pair_type : Sigma (n : Nat). Nat *)
(* pair_term : (succ (succ zero), succ zero) *)
let sig_type = Sigma ("n", Nat, Nat)
let sig_term = Pair (Succ (Succ Zero), Succ Zero)

let test_sigma () =
  let ty = eval [] sig_type in
  check empty_ctx sig_term ty;
  Printf.printf "Test 4 (sigma): PASSED\n"

(** Test 5: Dependent function --- identity on any type *)
(* Given A : Type and a : A, return (a, a) : Sigma (x : A). A *)
let dep_pair_fn_type =
  Pi ("A", Uni, Pi ("a", Var 0, Sigma ("x", Var 1, Var 2)))
let dep_pair_fn_term =
  Lam ("A", Lam ("a", Pair (Var 0, Var 0)))

let test_dep_pair () =
  let ty = eval [] dep_pair_fn_type in
  check empty_ctx dep_pair_fn_term ty;
  Printf.printf "Test 5 (dep pair fn): PASSED\n"

(** Test 6: First and second projection *)
(* fst_fn : Pi (A : Type). Pi (B : A -> Type). Sigma (x : A). B x -> A *)
let fst_fn_type =
  Pi ("A", Uni,
    Pi ("B", Pi ("_", Var 0, Uni),
      Pi ("p", Sigma ("x", Var 1, App (Var 1, Var 0)),
        Var 2)))
let fst_fn_term =
  Lam ("A", Lam ("B", Lam ("p", Fst (Var 0))))

let test_fst () =
  let ty = eval [] fst_fn_type in
  check empty_ctx fst_fn_term ty;
  Printf.printf "Test 6 (fst): PASSED\n"

(** Test 7: Conversion checking --- (1 + 1) should equal 2 *)
let test_conv () =
  let one = VSucc VZero in
  let two = VSucc (VSucc VZero) in
  (* Evaluate 1 + 1 *)
  let add_one_one =
    eval [] (App (App (add_term, Succ Zero), Succ Zero))
  in
  assert (conv 0 add_one_one two);
  ignore one;
  Printf.printf "Test 7 (conv 1+1=2): PASSED\n"

(** Run all tests *)
let () =
  test_id ();
  test_succ ();
  test_add ();
  test_sigma ();
  test_dep_pair ();
  test_fst ();
  test_conv ();
  Printf.printf "\nAll tests passed.\n"
```

### 6.3 Length-Indexed Vectors (Extended Exercise)

To test dependent types more thoroughly, we can encode length-indexed vectors. Since our language does not have user-defined inductive types, we encode `Vec A n` using the Church encoding within our universe:

```ocaml
(* Vec : Type -> Nat -> Type *)
(* Vec A n = Pi (V : Nat -> Type). V 0 -> (Pi k. A -> V k -> V (succ k)) -> V n *)
let vec_type =
  Lam ("A", Lam ("n",
    Pi ("V", Pi ("_", Nat, Uni),
      Pi ("vnil", App (Var 0, Zero),
        Pi ("vcons", Pi ("k", Nat, Pi ("_", Var 4, Pi ("_", App (Var 3, Var 1),
                        App (Var 4, Succ (Var 2))))),
          App (Var 2, Var 3))))))

(* This is: lam A n. Pi V. V 0 -> (Pi k. A -> V k -> V (succ k)) -> V n *)
(* Check that Vec : Type -> Nat -> Type *)
let vec_outer_type = Pi ("A", Uni, Pi ("n", Nat, Uni))
```

This encoding demonstrates the interplay between Pi types, natural numbers, and the universe in a dependently typed setting.

---

## 7. Brief Tour: Coq and Lean

### 7.1 Coq/Rocq

The type checker we built is a miniature version of what Coq's kernel does. Key differences in production:

1. **Universe hierarchy.** Coq has `Prop`, `Set`, and `Type_i` for $i = 0, 1, 2, \ldots$, with universe polymorphism and constraint inference.
2. **Inductive types.** Coq's kernel checks inductive type declarations for strict positivity and generates eliminators automatically.
3. **Fixpoints and guard checking.** Recursive functions must pass a syntactic guard condition ensuring structural recursion on an inductive argument.
4. **Module system.** Coq has a full module system with signatures, functors, and module-level abstraction.

**Example interaction (Coq):**

```coq
(* Define vectors *)
Inductive Vec (A : Type) : nat -> Type :=
  | vnil : Vec A 0
  | vcons : forall n, A -> Vec A n -> Vec A (S n).

(* Safe head function *)
Definition vhead {A : Type} {n : nat} (v : Vec A (S n)) : A :=
  match v with
  | vcons _ _ a _ => a
  end.

(* Prove that 0 + n = n *)
Theorem plus_O_n : forall n, 0 + n = n.
Proof. reflexivity. Qed.

(* Prove that n + 0 = n (requires induction) *)
Theorem plus_n_O : forall n, n + 0 = n.
Proof.
  induction n.
  - reflexivity.
  - simpl. rewrite IHn. reflexivity.
Qed.
```

### 7.2 Lean 4

Lean 4 uses a similar kernel but with some different design choices:

```lean
-- Define vectors
inductive Vec (A : Type) : Nat -> Type where
  | nil : Vec A 0
  | cons : {n : Nat} -> A -> Vec A n -> Vec A (n + 1)

-- Safe head function
def Vec.head : Vec A (n + 1) -> A
  | .cons a _ => a

-- Prove that 0 + n = n
theorem Nat.zero_add (n : Nat) : 0 + n = n := rfl

-- Prove that n + 0 = n
theorem Nat.add_zero : (n : Nat) -> n + 0 = n
  | 0 => rfl
  | n + 1 => congrArg Nat.succ (Nat.add_zero n)
```

### 7.3 Comparing Our Implementation to Production Systems

| Feature | Our checker | Coq/Lean |
|---|---|---|
| Universes | Type : Type | Hierarchy with constraints |
| Inductive types | Nat only (primitive) | General inductive types |
| Pattern matching | NatElim only | Full dependent pattern matching |
| Termination | No check | Structural recursion / well-founded |
| Tactics | None | Rich tactic languages |
| Elaboration | None | Implicit arguments, coercions, etc. |
| Performance | Toy | Highly optimized |

Our implementation captures the essential *kernel* operations: evaluation, conversion checking, and bidirectional type checking. A production system adds layers of elaboration, tactic interpretation, and optimization on top of this core.

---

## 8. Exercises

### Exercise 8.1

Extend the type checker with the **Bool** type:

```ocaml
| Bool                              (* Bool type *)
| True                              (* true *)
| False                             (* false *)
| BoolElim of expr * expr * expr * expr  (* BoolElim C ct cf b *)
```

Add the appropriate cases to `eval`, `quote`, `conv`, `check`, and `infer`. The elimination rule should be:

$$\frac{\Gamma \vdash b : \text{Bool} \qquad \Gamma, x : \text{Bool} \vdash C(x) \; \text{type} \qquad \Gamma \vdash c_t : C(\text{true}) \qquad \Gamma \vdash c_f : C(\text{false})}{\Gamma \vdash \text{BoolElim}(C, c_t, c_f, b) : C(b)}$$

### Exercise 8.2

Implement a `normalize` function that takes a context and an expression and returns its normal form as an expression:

```ocaml
let normalize (ctx : ctx) (e : expr) : expr =
  quote ctx.depth (eval_in ctx e)
```

Test it on various terms to verify that normalization works correctly. For instance, verify that $(\lambda x.\, x)\; 3$ normalizes to $3$.

### Exercise 8.3

Extend the language with **let-bindings**:

```ocaml
| Let of string * expr * expr * expr  (* let x : A = t in body *)
```

The typing rule is:

$$\frac{\Gamma \vdash A : \text{Type} \qquad \Gamma \vdash t : A \qquad \Gamma, x : A \vdash \text{body} : B}{\Gamma \vdash \text{let}\; x : A = t\; \text{in}\; \text{body} : B[t/x]}$$

Hint: evaluate `t` to a value and extend both the type context and the evaluation environment.

### Exercise 8.4

Write a test that verifies the dependent typing of the second projection. Define a Sigma type $\Sigma(b : \text{Bool}).\, C(b)$ where $C(\text{true}) = \text{Nat}$ and $C(\text{false}) = \text{Bool}$, construct a pair, and verify that `snd` returns the correct type.

### Exercise 8.5

The current `NatElim` type checking constructs the step type using a closure trick. Rewrite the `NatElim` case in `infer` to build the step type entirely using values and closures, avoiding the `shift_expr` function.

---

## 9. Summary

In this recitation, we built a complete (if minimal) type checker for a dependently typed language. The key components are:

1. **Syntax** with terms and types unified.
2. **Evaluation** (NbE, part 1): terms + environment $\to$ values.
3. **Quotation** (NbE, part 2): values $\to$ normal-form terms.
4. **Conversion checking:** comparing values for definitional equality, with eta rules.
5. **Bidirectional type checking:** separating checking ($\Leftarrow$) and inference ($\Rightarrow$).

The implementation is approximately 300 lines of OCaml and demonstrates all the core ideas from the lectures:

- Types and terms are in the same syntactic category.
- Type checking requires normalization (evaluation).
- The type of a function application depends on the *value* of the argument.
- The type of the second projection of a dependent pair depends on the *value* of the first component.

---

## Further Reading

1. **Loh, A., McBride, C., and Swierstra, W.** (2010). "A Tutorial Implementation of a Dependently Typed Lambda Calculus." *Fundamenta Informaticae*, 102(2):177--207. The gold-standard tutorial, implementing a similar system in Haskell.

2. **Coquand, T.** (1996). "An Algorithm for Type-Checking Dependent Types." *Science of Computer Programming*, 26(1-3):167--177.

3. **Abel, A.** (2008). "Normalization by Evaluation for Martin-Lof Type Theory with One Universe." In *MFPS XXIV*.

4. **Kovacs, A.** (2022). "elaboration-zoo." GitHub repository. A collection of increasingly sophisticated type checker implementations. https://github.com/AndrasKovacs/elaboration-zoo

5. **Christiansen, D.** (2019). "Bidirectional Type Checking." Lecture notes and tutorial. A gentle introduction to bidirectional type checking for dependent types.
