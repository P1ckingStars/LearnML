---
title: "Glossary: Type Theory"
tags:
  - type-theory
  - reference
---
# Glossary: Type Theory

Over 150 key terms used in this course, organized alphabetically. Definitions aim for precision at a graduate level while remaining accessible.

---

## A

**Abstraction.**
A lambda term of the form (lambda x : T. e), which introduces a function binding the variable x of type T in the body e. Abstraction is the primary mechanism for defining functions in the lambda calculus.

**Abstract Binding Tree (ABT).**
A generalization of abstract syntax trees that explicitly tracks variable binding structure. ABTs represent the binding structure of a language in a canonical way, making substitution and alpha-equivalence structural rather than ad hoc. Used extensively in Harper's PFPL.

**Abstract Syntax Tree (AST).**
A tree representation of the syntactic structure of a program, where each node corresponds to a language construct. In a type theory implementation, the AST is typically defined as an algebraic data type in the metalanguage (e.g., OCaml).

**Adequacy.**
A property of a denotational semantics stating that if the denotation of a closed term is a value, then the term evaluates to a value under the operational semantics. Adequacy ensures that the denotational model faithfully reflects operational behavior.

**Ad-Hoc Polymorphism.**
Polymorphism where the implementation varies depending on the type of the argument. In Haskell, ad-hoc polymorphism is provided by type classes: the function (==) has type Eq a => a -> a -> Bool, and its implementation depends on which instance of Eq is selected. Contrasts with parametric polymorphism, where the implementation is uniform.

**Affine Type.**
A type whose values may be used at most once. In a substructural type system, an affine type system drops the contraction rule but retains weakening, permitting values to be discarded but not duplicated. Rust's ownership model is an affine type system.

**Algebraic Data Type (ADT).**
A composite type formed by sum (variant/tagged union) and product (record/tuple) types. In OCaml, the declaration `type expr = Var of string | Lam of string * expr | App of expr * expr` defines an ADT for lambda calculus expressions.

**Algebraic Effect.**
A computational effect (such as state, exceptions, or nondeterminism) presented as a set of operations with an algebraic signature. Algebraic effect handlers define the semantics of these operations, separating effect declaration from effect interpretation.

**Alpha-Equivalence.**
The relation identifying terms that differ only in the names of their bound variables. For example, (lambda x. x) and (lambda y. y) are alpha-equivalent. Formally, alpha-equivalence is the smallest congruence closed under consistent renaming of bound variables.

**Application.**
A lambda term of the form (e1 e2), representing the application of function e1 to argument e2. In the simply typed lambda calculus, if e1 : T1 -> T2 and e2 : T1, then (e1 e2) : T2.

---

**Arity.**
The number of arguments a function or type constructor takes. A function of type A -> B -> C has arity 2. A type constructor like Map has arity 2 (it takes two type arguments). In higher-kinded systems, arity is reflected in the kind.

---

## B

**Barendregt Convention.**
The convention that bound variables are always chosen to be distinct from free variables and from each other. This simplifies formal reasoning by ensuring that substitution never requires renaming. Most informal proofs implicitly adopt this convention.

**Beta-Reduction.**
The fundamental computation rule of the lambda calculus: (lambda x. e1) e2 reduces to e1[x := e2], where e1[x := e2] denotes the capture-avoiding substitution of e2 for x in e1. Beta-reduction is the mechanism by which functions are applied to their arguments.

**Bidirectional Type Checking.**
A type checking strategy that alternates between two modes: synthesis (inferring the type of a term from its structure) and checking (verifying that a term has a given type). Bidirectional checking reduces the annotation burden compared to fully explicit typing while avoiding the undecidability of full type inference for rich type systems.

**Binding.**
The association of a variable name with a definition or a type in a context. A binding occurrence of a variable is the position where it is introduced (e.g., in a lambda abstraction or let binding); a bound occurrence is a use of that variable within the scope of its binder.

**Bottom Type.**
The empty type, having no values. Often written as "void" or "bot." In the Curry-Howard correspondence, the bottom type corresponds to the proposition False. Any type is a supertype of the bottom type.

**Bounded Quantification.**
A form of universal quantification where the type variable is constrained to be a subtype of a given bound: forall a <: T. U. Bounded quantification, as in System F-sub, combines parametric polymorphism with subtyping. Full F-sub subtyping is undecidable (Pierce, 1994).

---

## C

**Calculus of Constructions (CoC).**
The typed lambda calculus at the apex of the lambda cube, combining dependent types, polymorphism (terms depending on types), type operators (types depending on types), and dependent function types (types depending on terms). Introduced by Coquand and Huet (1988). The core of the Coq proof assistant.

**Calculus of Inductive Constructions (CIC).**
The extension of the Calculus of Constructions with inductive types, providing the ability to define datatypes and their associated elimination principles. The foundational calculus of the Coq proof assistant.

**Canonical Forms Lemma.**
A lemma stating that every closed value of a given type has a specific syntactic shape. For example, every closed value of type T1 -> T2 is a lambda abstraction. Canonical forms lemmas are essential for proving the progress theorem.

**Capture-Avoiding Substitution.**
The substitution operation e1[x := e2] that replaces all free occurrences of x in e1 with e2, while renaming bound variables in e1 as necessary to avoid inadvertently capturing free variables of e2. Correct implementation of capture-avoiding substitution is one of the most error-prone aspects of language implementation.

**Church Encoding.**
A technique for representing data types (booleans, natural numbers, pairs, lists) as pure lambda terms. For example, Church numerals encode n as (lambda f. lambda x. f^n x). Church encodings demonstrate the expressiveness of the lambda calculus but are impractical for computation due to their efficiency characteristics.

**Church-Rosser Property.**
The property that if a term t reduces to both t1 and t2 (via possibly different reduction sequences), then there exists a term t3 to which both t1 and t2 reduce. Also called the confluence property. The Church-Rosser theorem states that beta-reduction in the untyped lambda calculus is confluent.

**Church-Style Typing.**
A typing discipline where terms carry explicit type annotations, particularly on lambda-bound variables: (lambda x : T. e). Contrasts with Curry-style typing, where terms are untyped and types are assigned externally. Church-style systems are more suitable for languages with subtyping or dependent types.

**Closed Term.**
A term with no free variables. In the lambda calculus, (lambda x. x) is closed, while (lambda x. y) is open (y is free). Type safety theorems typically apply to closed, well-typed terms.

**Coinductive Type.**
A type defined by its observations (destructors) rather than its constructors. While inductive types support finite data and recursion, coinductive types support potentially infinite data (streams, infinite trees) and corecursion. The greatest fixed point of a type operator gives a coinductive type.

**Coherence.**
A property of a type system (particularly one with subtyping or type class instances) stating that all valid typing derivations for a given term yield the same behavior. Coherence ensures that the semantics of a program is independent of the particular derivation chosen by the type checker.

**Completeness (of type inference).**
A type inference algorithm is complete if whenever a term is typeable in the declarative type system, the algorithm successfully infers a type for it. Combined with soundness (the algorithm only infers types that are valid in the declarative system), completeness ensures that the algorithm exactly characterizes the typeable terms.

**Confluence.**
See Church-Rosser Property.

**Constructive Logic.**
A logic that rejects the law of the excluded middle (P or not P) and double negation elimination, requiring that proofs of existential statements provide explicit witnesses. Martin-Lof type theory and the Calculus of Constructions are based on constructive logic; a proof of (exists x : A. P(x)) must provide a concrete a : A and a proof of P(a).

**Context.**
A mapping from variable names to their types, recording the types of all variables currently in scope. Usually written as Gamma and extended by comma: Gamma, x : T. Typing judgments have the form Gamma |- e : T, read "in context Gamma, expression e has type T."

**Contraction (Structural Rule).**
The structural rule that allows a hypothesis to be used more than once. In a sequent calculus, contraction states that Gamma, A, A |- B implies Gamma, A |- B. Linear type systems disallow contraction, requiring that each resource be used exactly once.

**Contravariance.**
The property of a type constructor that reverses the subtyping direction. Function types are contravariant in their argument: if S <: T, then (T -> U) <: (S -> U). Contravariance arises because a function that accepts a supertype can safely replace one that accepts a subtype.

**Covariance.**
The property of a type constructor that preserves the subtyping direction. For example, List is covariant: if S <: T, then List S <: List T (assuming immutable lists). Function types are covariant in their return type.

**Cubical Type Theory.**
A variant of Martin-Lof type theory that adds an interval type and path types, giving computational content to the univalence axiom from homotopy type theory. In cubical type theory, paths are literal functions from the interval, and univalence computes rather than being an axiom.

**Curry-Howard Correspondence.**
The deep structural correspondence between proof systems and type systems: propositions correspond to types, proofs correspond to programs, and proof normalization corresponds to program evaluation. For example, implication (A implies B) corresponds to function types (A -> B), and modus ponens corresponds to function application.

**Curry-Howard-Lambek Correspondence.**
The extended correspondence that adds category theory as a third pillar: propositions/types correspond to objects, proofs/programs correspond to morphisms, and logical connectives/type constructors correspond to categorical constructions (products, coproducts, exponentials). Cartesian closed categories correspond to the simply typed lambda calculus.

**Curry-Style Typing.**
A typing discipline where terms are undecorated (no type annotations) and types are assigned to them externally by the type system. The simply typed lambda calculus in Curry style assigns types to untyped lambda terms. Curry-style systems are natural for type inference.

**Cut Elimination.**
The fundamental theorem of proof theory stating that every proof using the cut rule (which combines two proofs via a lemma) can be transformed into a direct proof without cut. In the Curry-Howard correspondence, cut elimination corresponds to beta-reduction / evaluation.

---

## D

**de Bruijn Index.**
A nameless representation of bound variables where each variable is represented by a natural number indicating the number of enclosing binders between the variable and its binding site. For example, (lambda. lambda. 1 0) represents (lambda x. lambda y. x y). De Bruijn indices eliminate alpha-equivalence issues and are standard in implementations.

**Decidability.**
A property of a problem or relation that admits an algorithm that always terminates with a yes/no answer. Type checking for the simply typed lambda calculus is decidable; type checking for System F (without annotations) is undecidable (Wells, 1999).

**Denotational Semantics.**
A method of giving meaning to programs by mapping them to mathematical objects (such as elements of domains or sets), in contrast to operational semantics, which defines meaning via reduction rules. Scott's domain theory provides denotational semantics for the lambda calculus.

**Dependent Function Type (Pi-Type).**
A generalization of function types where the return type may depend on the value of the argument: Pi(x : A). B(x). When B does not depend on x, this reduces to the ordinary function type A -> B. Pi-types are the fundamental type constructor in dependent type theory.

**Dependent Pair Type (Sigma-Type).**
A generalization of product types where the type of the second component may depend on the value of the first: Sigma(x : A). B(x). An element is a pair (a, b) where a : A and b : B(a). Sigma-types correspond to existential quantification under the Curry-Howard correspondence.

**Dependent Type.**
A type that depends on a value. For example, Vec(n) might denote the type of vectors of length n, where n is a natural number. Dependent types enable types to express precise specifications (e.g., a sort function returns a list of the same length as its input).

**Derivation.**
A tree-structured proof that a typing judgment holds, built by applying typing rules. Each node is an application of a typing rule, with the premises above and the conclusion below. A term is well-typed if and only if it has a derivation.

**Definitional Equality (Judgmental Equality).**
An equality between types or terms that is built into the type theory and checked automatically by the type checker. In dependent type theory, two terms are definitionally equal if they reduce to the same normal form. Definitional equality is decidable (assuming normalization) but not complete (not all observationally equal terms are definitionally equal).

**Dynamics.**
The component of a language definition that specifies how programs execute. Defined via operational semantics (transition rules specifying how terms reduce). Contrasts with statics (the type system).

---

## E

**Eager Evaluation.**
See Call-by-Value under Evaluation Strategy. In eager evaluation, function arguments are fully evaluated before the function body is entered. OCaml, ML, and most imperative languages use eager evaluation.

**Elaboration.**
The process of translating a high-level surface language into a fully explicit core language. In dependently typed languages, elaboration resolves implicit arguments, performs unification, desugars pattern matching, and inserts type coercions. The elaborator is typically the most complex component of a dependently typed language implementation.

**Effect Handler.**
A language construct that defines the semantics of algebraic effects. A handler catches operations performed by a computation and provides their implementation, analogous to how a try/catch block handles exceptions. Effect handlers generalize exception handling, state, coroutines, and other patterns.

**Effect System.**
A type-level mechanism for tracking the computational effects (such as mutation, I/O, exceptions, or nondeterminism) that a computation may perform. Effect annotations appear alongside types: a function of type A -[E]-> B takes an A and returns a B while possibly performing effects in E.

**Elaboration.**
The process of translating a high-level source language (with syntactic sugar, implicit arguments, and type inference) into a fully explicit core language. In dependently typed languages, elaboration resolves implicit arguments, performs unification, and inserts coercions.

**Elimination Form.**
A term construct that destructs or uses a value of a given type. For function types, the elimination form is application; for product types, projection; for sum types, case analysis. Elimination forms are dual to introduction forms.

**Environment.**
In an implementation, a data structure mapping variable names (or de Bruijn indices) to their values or types. A typing environment maps variables to types; an evaluation environment maps variables to values.

**Equi-Recursive Type.**
A treatment of recursive types where the recursive type mu a. T is considered definitionally equal to its unfolding T[a := mu a. T]. No explicit fold/unfold operations are needed. Contrasts with iso-recursive types. Equi-recursive types are used in OCaml's -rectypes mode.

**Eta-Expansion.**
The transformation of a term e of function type to (lambda x. e x), where x is fresh. Eta-expansion is the inverse of eta-reduction. In extensional type theories, eta-expansion and eta-reduction are both valid, making functions equal if and only if they agree on all inputs.

**Eta-Reduction.**
The reduction rule that transforms (lambda x. e x) to e, provided x does not occur free in e. Eta-reduction expresses the extensional principle that a function is fully determined by its behavior on arguments.

**Evaluation Strategy.**
The rule determining the order in which redexes are reduced. Call-by-value (CBV) evaluates arguments before substitution; call-by-name (CBN) substitutes unevaluated arguments; call-by-need (lazy evaluation) is CBN with sharing of results. The choice of evaluation strategy affects the semantics of the language.

**Evaluation Context.**
A term with a "hole" indicating the position where the next reduction step should occur. For call-by-value, evaluation contexts typically have the form E ::= [] | E e | v E | if E then e else e | let x = E in e. Evaluation contexts provide an elegant way to specify the reduction strategy of a language.

**Existential Type.**
A type of the form (exists a. T), packaging a type together with a value of that type, hiding the identity of the type. Existential types model abstract data types: the implementation type is hidden, and clients can only use values through the provided interface. In the Curry-Howard correspondence, existential types correspond to existential quantification.

**Exchange (Structural Rule).**
The structural rule that allows reordering of hypotheses in a context: if Gamma, A, B, Delta |- C, then Gamma, B, A, Delta |- C. Ordered type systems (used in some models of stack-based computation) drop exchange.

---

## F

**Fixpoint Combinator.**
A term fix (or Y) satisfying the equation fix f = f (fix f), enabling the definition of recursive functions. In the untyped lambda calculus, the Y combinator is (lambda f. (lambda x. f (x x)) (lambda x. f (x x))). In typed languages, fix is typically added as a primitive since the Y combinator is not typeable in the simply typed lambda calculus.

**Formal Verification.**
The process of proving that a program or system satisfies a formal specification, typically using a proof assistant (Coq, Lean, Agda) to produce machine-checked proofs. Contrasts with testing, which can only demonstrate the presence of bugs.

**Free Theorem.**
A theorem about a polymorphic function that follows solely from its type, derived using parametricity (Reynolds 1983, Wadler 1989). For example, every function of type forall a. [a] -> [a] must be a subsequence-preserving permutation of its input.

**Free Variable.**
A variable that occurs in a term but is not bound by any enclosing binder. In (lambda x. x y), x is bound and y is free. The set of free variables of a term is defined inductively: FV(x) = {x}, FV(lambda x. e) = FV(e) \ {x}, FV(e1 e2) = FV(e1) union FV(e2).

**Focusing.**
A proof-search discipline that organizes proof construction by alternating between two phases: an "invertible" phase (where all applicable invertible rules are applied eagerly) and a "non-invertible" phase (where a single non-invertible rule is chosen). Focusing eliminates redundant proof search and connects to the notion of polarity in type theory.

**Functor (ML Module System).**
A parameterized module, analogous to a function from structures to structures. In OCaml, `module F (M : S) = struct ... end` defines a functor that takes a module matching signature S and produces a new module. Not to be confused with the category-theoretic notion of functor, though there is a connection.

**Function Type (Arrow Type).**
The type of functions, written T1 -> T2, classifying terms that take an argument of type T1 and return a result of type T2. The function type constructor is contravariant in its domain and covariant in its codomain.

---

## G

**GADT (Generalized Algebraic Data Type).**
An extension of algebraic data types where different constructors may produce values at different type instantiations of the same family. For example, a type Expr(t) might have constructors IntLit : int -> Expr(int) and BoolLit : bool -> Expr(bool). GADTs enable type-safe interpreters and typed abstract syntax.

**Girard's Paradox.**
The inconsistency that arises from allowing Type : Type (a type of all types, including itself) in a dependent type theory. Analogous to Russell's paradox for sets, Girard's paradox shows that an impredicative universe containing itself makes every type inhabited, destroying logical consistency. This motivates the use of universe hierarchies.

**Gradual Typing.**
A type discipline that allows mixing statically typed and dynamically typed code within the same program. Type annotations are optional; unannotated code is assigned the dynamic type (?), and casts are inserted at boundaries between typed and untyped code. Soundness is enforced at runtime via contracts.

**Ground Type.**
A type with no type variables; a fully concrete type. For example, Int and Bool -> Int are ground types, while a -> a is not. Ground types are the "base case" in many inductive arguments about type systems.

---

## H

**Higher-Kinded Type.**
A type constructor that takes other type constructors as arguments. For example, a Functor type class is parameterized by a type constructor f of kind Type -> Type. Higher-kinded types enable abstraction over type constructors and are essential for generic programming patterns (monads, applicatives, traversables).

**Higher-Order Abstract Syntax (HOAS).**
A technique for representing variable binding in an object language by using the binding mechanisms of the metalanguage. In OCaml, a lambda abstraction might be represented as `Lam of (term -> term)`, using OCaml's function space to represent binding. HOAS avoids explicit substitution but complicates some analyses.

**Higher-Rank Polymorphism.**
A type system that allows universal quantifiers to appear in positions other than the outermost level of a type. In rank-2 polymorphism, function arguments may have universally quantified types: f : (forall a. a -> a) -> Int. Higher-rank types require explicit annotations since type inference is undecidable beyond rank 1 (Hindley-Milner).

**Hindley-Milner (HM) Type System.**
The type system underlying ML-family languages, featuring let-polymorphism (polymorphic generalization only at let bindings), principal types (every typeable term has a most general type), and decidable type inference (Algorithm W / Algorithm J). The HM system is the sweet spot of expressiveness and decidability for parametric polymorphism.

**Homotopy Type Theory (HoTT).**
An interpretation of Martin-Lof type theory where types are viewed as spaces, terms as points, identity proofs as paths, and higher identity proofs as higher-dimensional paths. The univalence axiom (equivalent types are equal) and higher inductive types are the key innovations. Provides a synthetic foundation for homotopy theory.

**Higher Inductive Type (HIT).**
An extension of inductive types in homotopy type theory that allows constructors to produce not only points but also paths (equalities) and higher-dimensional paths. For example, the circle S^1 is defined by a point constructor `base : S^1` and a path constructor `loop : base = base`. HITs enable the construction of quotient types and cell complexes within type theory.

---

## I

**Identity Type.**
In Martin-Lof type theory, the type Id_A(a, b) (or a =_A b) whose inhabitants are proofs that a and b are equal elements of type A. Identity types are central to dependent type theory and homotopy type theory, where they carry higher structure (paths, paths between paths, etc.).

**Impredicativity.**
A definition is impredicative if it quantifies over a domain that includes the entity being defined. System F is impredicative: the type (forall a. a -> a) quantifies over all types, including itself. Impredicativity increases expressiveness but complicates semantics and can lead to paradoxes if not carefully controlled.

**Induction Principle.**
The elimination rule associated with an inductively defined type, allowing proofs by structural induction. For natural numbers, the induction principle states: to prove P(n) for all n, prove P(0) and prove that P(n) implies P(n+1). In dependent type theory, induction principles are derived automatically from inductive type definitions.

**Inductive Type.**
A type defined by a set of constructors, where the type may appear recursively in the arguments of its constructors (subject to positivity constraints). Natural numbers, lists, and trees are inductive types. In dependent type theory, each inductive type comes with an associated induction principle.

**Inference Rule.**
A rule of the form "from premises P1, ..., Pn, conclude C," typically written with the premises above a horizontal line and the conclusion below. Typing rules, evaluation rules, and proof rules are all expressed as inference rules. The set of inference rules defines a judgment inductively.

**Inhabitation.**
A type T is inhabited if there exists a closed term e such that |- e : T. In the Curry-Howard correspondence, an inhabited type corresponds to a provable proposition. The inhabitation problem (given T, does there exist e with |- e : T?) is decidable for simple types but undecidable for System F.

**Introduction Form.**
A term construct that creates a value of a given type. For function types, the introduction form is lambda abstraction; for product types, pairing; for sum types, injection. Introduction forms are dual to elimination forms.

**Invariance.**
A type parameter is invariant if it is neither covariant nor contravariant: there is no subtyping relationship between T[A] and T[B] even when A <: B. Mutable references are invariant: Ref[A] is not a subtype of Ref[B] even if A <: B, because a Ref[A] can be both read from (requiring covariance) and written to (requiring contravariance).

**Iso-Recursive Type.**
A treatment of recursive types where the recursive type mu a. T is isomorphic to (but not equal to) its unfolding T[a := mu a. T]. Explicit fold and unfold operations witness the isomorphism. Most programming languages (OCaml, Haskell) use iso-recursive types by default, with fold/unfold implicit in constructor application and pattern matching.

**Intersection Type.**
A type of the form T1 /\ T2, classifying terms that have both type T1 and type T2 simultaneously. Intersection types are more expressive than simple types (they can type all strongly normalizing terms) but type inference for intersection types is generally undecidable.

---

## J

**Judgment.**
A formal assertion about a term, type, or context. Common judgments include: Gamma |- e : T (e has type T in context Gamma), T type (T is a well-formed type), Gamma |- e1 ~> e2 (e1 steps to e2). Judgments are defined inductively by inference rules.

**Judgment Form.**
The syntactic template of a judgment, specifying what kinds of entities it relates. Examples: the typing judgment form Gamma |- e : T relates a context, a term, and a type; the subtyping judgment form Gamma |- S <: T relates a context and two types.

---

## K

**Kind.**
The "type of a type." In systems with type constructors, kinds classify type-level entities. The kind of ordinary types is * (or Type). A type constructor like List has kind $*$ -> *. In System F-omega, the kind system ensures that type-level expressions are well-formed.

**Knaster-Tarski Theorem.**
The theorem that every monotone function on a complete lattice has a least fixed point and a greatest fixed point. In type theory, the Knaster-Tarski theorem is used to define recursive types: the least fixed point gives inductive types (like lists), while the greatest fixed point gives coinductive types (like streams).

---

## L

**Lambda Abstraction.**
See Abstraction.

**Lambda Cube.**
Barendregt's classification of eight typed lambda calculi organized along three axes: (1) terms depending on types (polymorphism, as in System F), (2) types depending on types (type operators, as in System F-omega), and (3) types depending on terms (dependent types, as in LF). The eight corners range from the simply typed lambda calculus to the Calculus of Constructions.

**Let-Polymorphism.**
The restriction, used in ML-family type systems, that polymorphic generalization occurs only at let bindings, not at lambda abstractions. This restriction (the "let rule") ensures decidable type inference while retaining useful polymorphism. In the expression `let id = fun x -> x in (id 1, id true)`, id is polymorphic, but `(fun id -> (id 1, id true)) (fun x -> x)` is rejected.

**Linear Logic.**
Girard's refinement of classical logic (1987) that controls the structural rules of weakening and contraction. In linear logic, hypotheses must be used exactly once unless explicitly marked as reusable (via the exponential modality !A). Linear logic provides the logical foundation for linear type systems.

**Linear Type.**
A type whose values must be used exactly once: they cannot be discarded (no weakening) or duplicated (no contraction). Linear types enforce resource discipline at the type level, ensuring that resources such as file handles, memory, or channel endpoints are properly managed.

**Logical Framework (LF).**
A dependent type theory designed as a metalanguage for specifying logics, type systems, and programming languages. LF uses the "judgments as types" methodology, encoding derivations of judgments as terms in the framework. Twelf is the primary implementation.

**Logical Relation.**
A proof technique where a family of relations (indexed by types) is defined inductively on the structure of types, and terms are shown to be related at their type. Logical relations are used to prove normalization, parametricity, and program equivalence. Tait's method for proving strong normalization of the simply typed lambda calculus is the prototypical example.

**Locally Nameless Representation.**
A hybrid variable representation combining named free variables with de Bruijn indices for bound variables. This approach avoids the need for alpha-conversion (since bound variables are nameless) while keeping free variables readable. A popular implementation technique that balances readability and correctness.

---

## M

**Martin-Lof Type Theory.**
Per Martin-Lof's foundational framework for constructive mathematics, where types are propositions, programs are proofs, and computation is proof normalization. Features dependent function types (Pi), dependent pair types (Sigma), identity types, and inductive types. The basis for Agda and (in extended form) Lean.

**Metatheory.**
Theorems about a formal system (e.g., a type system), as opposed to theorems within the system. Type safety (progress and preservation) is a metatheorem about a type system. Metatheoretic proofs are typically carried out by structural induction on derivations or terms.

**Module System.**
A language mechanism for organizing code into units with interfaces (signatures) and implementations (structures), supporting abstraction (hiding implementation details) and parameterization (functors). ML-style module systems feature structures, signatures, and functors, with type abstraction via signature ascription.

**Monad.**
A type constructor M with operations return : A -> M(A) and bind : M(A) -> (A -> M(B)) -> M(B) satisfying the monad laws (left identity, right identity, associativity). Monads model computational effects (state, exceptions, I/O, nondeterminism) in pure functional languages. In Haskell, monads are the primary mechanism for sequencing effects.

**Monotone Function.**
A function f between partially ordered sets that preserves order: if x <= y then f(x) <= f(y). In the context of type theory, monotonicity arises in fixed-point theorems (Knaster-Tarski) used to define recursive types and in the definition of denotational semantics on domains.

**Most General Unifier (MGU).**
The most general substitution that makes two terms (or types) syntactically equal. If sigma is an MGU of T1 and T2, then every other unifier of T1 and T2 is an instance of sigma (obtained by further substitution). The MGU is unique up to variable renaming. Robinson's algorithm computes the MGU in nearly linear time (using efficient union-find).

---

## N

**Natural Deduction.**
A proof system where each logical connective has introduction rules (for proving a proposition of that form) and elimination rules (for using a proof of that form). Under the Curry-Howard correspondence, natural deduction proofs correspond to typed lambda calculus terms: introduction rules correspond to constructors and elimination rules correspond to destructors.

**Nominal Typing.**
A type equivalence discipline where types are identified by their names rather than their structure. In nominal typing, two types with identical structure but different names are considered distinct. Contrasts with structural typing.

**Normal Form.**
A term that cannot be reduced further (contains no redexes). A term is in beta-normal form if it contains no beta-redex (applications of a lambda to an argument). Strong normalization guarantees that every reduction sequence reaches a normal form; weak normalization guarantees that at least one does.

**Normalization.**
The property that every well-typed term has a normal form. Weak normalization means at least one reduction sequence terminates; strong normalization means all reduction sequences terminate. The simply typed lambda calculus is strongly normalizing (Tait 1967). Strong normalization implies consistency via the Curry-Howard correspondence.

**Neutral Term.**
A term that is not a value (introduction form) but cannot be reduced because it is "blocked" on a variable. For example, the application (x e) is neutral when x is a variable. In normalization by evaluation, neutral terms are the terms that cannot be further evaluated.

**Normalization by Evaluation (NbE).**
A technique for computing normal forms by first evaluating a term in a semantic domain (producing a semantic value) and then "reading back" the semantic value into a syntactic normal form. NbE is the standard technique for implementing definitional equality checking in dependently typed languages.

---

## O

**Occurs Check.**
A check during unification that prevents a type variable from being unified with a type containing itself (e.g., a = a -> b). Without the occurs check, unification would produce infinite types. The occurs check ensures that type inference for Hindley-Milner terminates and produces finite types.

**Operational Semantics.**
A method of defining the meaning of programs via reduction rules that specify how terms compute step by step. Small-step semantics defines a single-step reduction relation; big-step (natural) semantics defines an evaluation relation mapping terms directly to values.

**Ordered Type.**
A type in a substructural system that drops the exchange rule in addition to contraction and/or weakening. Values of ordered types must be used in the order they appear in the context. Ordered types model stack-based computation.

**Opaque Type.**
A type whose definition is hidden by an abstraction boundary (such as a module signature). Clients of the module know the type exists but cannot see its definition, preventing them from depending on implementation details. Opaque types are the mechanism for information hiding in ML module systems.

---

## P

**Parametric Polymorphism.**
A form of polymorphism where a function operates uniformly on all type instantiations, without inspecting or branching on the type argument. Functions of type forall a. a -> a must behave identically regardless of the instantiation of a. This uniformity is formalized by Reynolds' parametricity theorem.

**Parametricity.**
The property that polymorphic functions respect all relations between types (Reynolds 1983). Formally, if R is a relation between types A and B, and f : forall a. F(a), then f_A and f_B are related by the relational interpretation of F at R. Parametricity implies representation independence and enables free theorems.

**Pattern Matching.**
A language construct that destructs a value of an algebraic data type by matching it against constructor patterns, binding the constructor arguments to variables. Pattern matching is the elimination form for algebraic data types and is fundamental to functional programming. In dependently typed languages, pattern matching can refine types.

**Polarity.**
The classification of type connectives as positive (defined by their introduction forms) or negative (defined by their elimination forms). Sum types and existential types are positive; function types and universal types are negative. Polarity plays a role in focusing, a technique for structuring proof search.

**Polymorphism.**
The ability of a type system to assign a single term multiple types. Parametric polymorphism (System F, ML) provides uniform behavior across all types; ad-hoc polymorphism (type classes, overloading) provides type-specific behavior; subtype polymorphism allows a term of a subtype to be used where a supertype is expected.

**Positivity Condition.**
A well-formedness requirement on inductive type definitions that ensures consistency and the existence of initial algebras. A type variable a occurs positively in T if it appears only in positive positions (covariant positions, never to the left of an odd number of arrows). Violating positivity allows encoding of nontermination and logical inconsistency.

**Predicativity.**
A definition is predicative if it does not quantify over a domain that includes the entity being defined. In a predicative type system, types at level n can only quantify over types at levels below n. Martin-Lof type theory (without a Prop universe) is predicative; System F is impredicative.

**Preservation (Subject Reduction).**
A metatheorem stating that if a well-typed term takes a step of evaluation, the resulting term is also well-typed at the same type. Formally: if Gamma |- e : T and e ~> e', then Gamma |- e' : T. Together with progress, preservation establishes type safety.

**Principal Type.**
The most general type assignable to a term. A type scheme sigma is principal for a term e if (1) the term has type sigma, and (2) every other type of e is a substitution instance of sigma. The Damas-Milner theorem states that every typeable ML term has a principal type.

**Product Type.**
A type of pairs (or tuples), written T1 x T2. Values are pairs (v1, v2), and the elimination forms are projections fst and snd. Under the Curry-Howard correspondence, product types correspond to conjunction (A and B).

**Progress.**
A metatheorem stating that a well-typed closed term is either a value or can take a step of evaluation. Formally: if |- e : T, then either e is a value or there exists e' such that e ~> e'. Progress ensures that well-typed programs do not get "stuck."

**Proof Irrelevance.**
The principle that two proofs of the same proposition are considered equal. In a proof-irrelevant type theory, the identity of a proof does not matter, only its existence. Lean's Prop universe is proof-irrelevant; in homotopy type theory, proof irrelevance is replaced by the subtler notion of truncation.

**Propositional Equality.**
An equality that is witnessed by a term (a proof) rather than being a built-in judgment. In Martin-Lof type theory, the identity type Id_A(a, b) represents propositional equality: a proof of this type is evidence that a and b are equal. Propositional equality is weaker than definitional equality (not all propositionally equal terms are definitionally equal) but more flexible (it can express equalities that depend on runtime values).

**Proof Term.**
A term that serves as a proof of a proposition under the Curry-Howard correspondence. For example, the identity function (lambda x. x) is a proof of the proposition A -> A (A implies A). In proof assistants, writing a program is literally constructing a proof.

---

## Q

**Quantifier (Universal and Existential).**
In type theory, universal quantification (forall a. T) classifies terms that work for all type instantiations, while existential quantification (exists a. T) classifies terms that work for some (hidden) type instantiation. Universal types are introduced by type abstraction and eliminated by type application; existential types are introduced by packing a type with a term and eliminated by opening.

**Quotient Type.**
A type formed by identifying elements of an existing type according to an equivalence relation. The quotient A / R has the same elements as A, but elements related by R are considered equal. Lean supports quotient types natively; in Coq, they can be simulated via setoids or higher inductive types.

---

## R

**Rank (of a type).**
A measure of the nesting depth of universal quantifiers in a type. Rank 0: no quantifiers. Rank 1 (prenex): quantifiers only at the outermost level (Hindley-Milner). Rank 2: quantifiers may appear as function argument types. Rank k: quantifiers may be nested k levels deep. Type inference is decidable for rank 1, decidable for rank 2, and undecidable for rank 3 and above.

**Recursive Type.**
A type defined in terms of itself, written mu a. T where a may appear in T. For example, the type of lists: mu L. Unit + (A x L). Recursive types can be iso-recursive (with explicit fold/unfold) or equi-recursive (with implicit unfolding). Most algebraic data types in functional languages are iso-recursive types.

**Redex (Reducible Expression).**
A subterm of the form (lambda x. e1) e2 that can be beta-reduced. More generally, any subterm that matches the left-hand side of a reduction rule. A normal form is a term with no redexes.

**Reducibility Candidate.**
A set of terms satisfying certain closure conditions (strong normalization, closure under reduction, closure under neutral expansion), used in Girard's proof of strong normalization for System F. Reducibility candidates generalize Tait's method to impredicative polymorphism by quantifying over all reducibility candidates rather than defining them by induction on types.

**Refinement Type.**
A type of the form {x : T | phi(x)}, classifying values of type T that satisfy the predicate phi. Refinement types enable specifications more expressive than simple types but less burdensome than full dependent types. Liquid Haskell and F* use refinement types.

**Relational Parametricity.**
See Parametricity.

**Representation Independence.**
The property that two implementations of an abstract data type are interchangeable if they satisfy the same specification, regardless of their internal representation. Parametricity implies representation independence for polymorphic programs: a client using a value of type exists a. T cannot distinguish two implementations with different representation types.

**Relevant Type.**
A type in a substructural system that drops weakening (values must be used at least once) but retains contraction (values may be duplicated). A relevant type system prevents resources from being silently discarded.

**Row Polymorphism.**
A form of polymorphism over record fields (or variant labels), where a row variable stands for "the rest of the fields." For example, a function typed as {name : string; rho} -> string accepts any record with at least a name field, where rho ranges over additional fields. Used in OCaml's object types and polymorphic variants.

---

## S

**Safety (Type Safety).**
The property that well-typed programs do not exhibit undefined behavior. Decomposed into progress (well-typed programs do not get stuck) and preservation (types are preserved by evaluation). Milner's slogan: "well-typed programs do not go wrong."

**Sequent Calculus.**
A proof system where the basic judgment has the form Gamma |- Delta (from hypotheses Gamma, conclude one of Delta). The sequent calculus is symmetric between introduction and elimination rules (left and right rules) and features the cut rule. Gentzen's Hauptsatz (cut elimination) shows that proofs can be transformed to cut-free form.

**Session Type.**
A type assigned to a communication channel that describes the protocol of interactions (sequence of sends, receives, choices, and loops). Session types ensure at compile time that communicating processes follow complementary protocols. Duality of session types corresponds to the complementary views of client and server.

**Singleton Type.**
A type containing exactly one value. In dependent type theory, the singleton type S(a) at type A contains only the value a. Singleton types are used in module systems for type sharing (ensuring two abstract types are equal) and in type refinement.

**Small-Step Semantics.**
An operational semantics that defines computation one step at a time via a transition relation e ~> e'. Each rule specifies how a single redex is reduced. Small-step semantics is preferred for proving type safety because preservation can be stated as a single-step property.

**Soundness (of a type system).**
The property that the type system correctly predicts the behavior of programs: if the type system accepts a program, then the program does not exhibit the class of errors the type system is designed to prevent. Type safety (progress + preservation) is a common formulation of soundness for type systems.

**Statics.**
The component of a language definition that specifies which programs are well-formed, via typing rules. The statics assigns types to terms and checks that they are used consistently. Contrasts with dynamics (operational semantics).

**Strengthening.**
A property of a type system stating that unused hypotheses in a context can be removed: if Gamma, x : S, Delta |- e : T and x does not occur free in e, then Gamma, Delta |- e : T. Strengthening holds for most standard type systems but fails for some substructural systems.

**Strong Normalization.**
The property that all reduction sequences from a given term are finite (terminate in a normal form). The simply typed lambda calculus is strongly normalizing; System F is strongly normalizing; the untyped lambda calculus is not. Strong normalization is typically proved using logical relations or reducibility candidates.

**Structural Induction.**
A proof technique for properties of inductively defined structures (terms, types, derivations). To prove a property P holds for all terms, prove P for each base case (variables, constants) and prove P for each compound case (application, abstraction) assuming P holds for all immediate subterms.

**Structural Typing.**
A type equivalence discipline where types are identified by their structure rather than their names. Two types with the same structure are considered equivalent regardless of how they are named. OCaml's polymorphic variants and object types use structural typing; most algebraic data types use nominal typing.

**Stuck Term.**
A closed term that is neither a value nor able to take a step according to the operational semantics. For example, the application (42 true) is stuck because 42 is not a function. Type safety guarantees that well-typed closed terms are never stuck.

**Subject Expansion.**
The converse of preservation: if e ~> e' and |- e' : T, then |- e : T. Subject expansion fails for most type systems (a well-typed result does not imply a well-typed source), but holds in certain settings.

**Subkinding.**
A subtyping-like relation at the kind level. If kappa1 is a subkind of kappa2, then any type of kind kappa1 can be used where kind kappa2 is expected. Subkinding is used in module systems with singleton kinds.

**Substitution.**
The operation of replacing all free occurrences of a variable x in a term e with another term e', written e[x := e']. Substitution must be capture-avoiding to preserve the intended binding structure. Defining substitution correctly is one of the most technically demanding aspects of formal language theory.

**Substitution Lemma.**
A metatheorem stating that typing is preserved under substitution: if Gamma, x : S |- e : T and Gamma |- e' : S, then Gamma |- e[x := e'] : T. The substitution lemma is essential for proving the preservation theorem.

**Subtyping.**
A preorder relation S <: T on types, meaning that any value of type S can safely be used where a value of type T is expected. Subtyping is introduced into the type system via the subsumption rule: if Gamma |- e : S and S <: T, then Gamma |- e : T. Function types are contravariant in their domain and covariant in their codomain with respect to subtyping.

**Sum Type.**
A type representing a disjoint union, written T1 + T2. Values are tagged with a constructor: inl(v1) or inr(v2). The elimination form is case analysis (pattern matching). Under the Curry-Howard correspondence, sum types correspond to disjunction (A or B).

**System F.**
The polymorphic lambda calculus, independently discovered by Girard (1972) and Reynolds (1974). System F extends the simply typed lambda calculus with universal type quantification: terms can abstract over types (type-level lambda) and be applied to types (type application). The type forall a. a -> a is the type of the polymorphic identity function.

**System F-omega.**
An extension of System F with type-level computation: type constructors (functions from types to types) and higher kinds. System F-omega is used as a target for elaboration in languages like Haskell.

**System F-sub.**
An extension of System F with subtyping and bounded quantification (forall a <: T. U), combining parametric polymorphism with subtype polymorphism. Full F-sub subtyping is undecidable (Pierce, 1994); kernel F-sub is decidable.

---

## T

**Tait's Method.**
See Logical Relation. Specifically, Tait's method proves strong normalization of the simply typed lambda calculus by defining a family of "reducibility" predicates indexed by types and showing all well-typed terms satisfy their type's predicate.

**Term.**
A syntactic expression in a lambda calculus or programming language. Terms are defined by a grammar and classified by types. In the simply typed lambda calculus, terms include variables, abstractions, and applications.

**Top Type.**
The type of which every type is a subtype. In a subtype lattice, Top is the greatest element. Every value belongs to the top type. Often written as "Top" or "Any."

**Totality.**
The property that a function is defined on all inputs and always terminates. In dependent type theory (Agda, Coq), all functions must be total to ensure logical consistency. Totality is enforced by termination checking (ensuring recursive calls decrease on a well-founded measure) and coverage checking (ensuring all cases are handled).

**Type Abstraction.**
A term-level construct that abstracts over a type: (Lambda a. e) introduces a universally quantified type. Type abstraction is the introduction form for universal types (forall a. T) in System F.

**Type Application.**
A term-level construct that instantiates a universally quantified type: (e [T]) applies a polymorphic term e to a type T. Type application is the elimination form for universal types in System F.

**Type Checking.**
The process of verifying that a fully annotated term has a given type. Type checking for the simply typed lambda calculus with annotations is decidable and straightforward. In contrast, type inference infers types for unannotated terms.

**Type Class.**
A mechanism for ad-hoc polymorphism, allowing functions to have different implementations for different types while maintaining a uniform interface. Introduced in Haskell (Wadler and Blott, 1989). Type classes define a set of operations and their signatures; instances provide implementations for specific types.

**Type Constructor.**
A function at the type level that takes types as arguments and produces types. List is a type constructor of kind Type -> Type; Map is of kind Type -> Type -> Type. Type constructors are the type-level analog of functions.

**Type Erasure.**
The property that types can be removed from a program without affecting its runtime behavior. In languages with type erasure (ML, Haskell, Java generics), types are used only for static checking and carry no runtime overhead. Type erasure fails for languages with runtime type dispatch or dependent types that affect control flow.

**Type Family.**
A function from types to types defined by equations, used in Haskell (type families) and Coq (fixpoints on types). Type families enable type-level computation, allowing types to depend on other types in a more flexible way than simple parameterization.

**Type Inference.**
The process of automatically determining the types of unannotated (or partially annotated) terms. In the Hindley-Milner system, type inference is decidable and produces principal types. Type inference for System F is undecidable.

**Type-Level Programming.**
The practice of encoding computations at the type level, using type families, GADTs, or dependent types to perform computation during type checking. Type-level programming enables richer static guarantees but can make type errors difficult to understand.

**Type Scheme.**
In Hindley-Milner type inference, a type with universally quantified type variables at the outermost level: forall a1 ... an. T, where T contains no quantifiers. Type schemes are the syntactic restriction that makes HM type inference decidable with principal types. Let-bound variables have type schemes; lambda-bound variables have monomorphic types.

**Type Soundness.**
See Safety (Type Safety). The fundamental metatheorem that a well-designed type system should satisfy.

**Typing Rule.**
An inference rule that specifies the conditions under which a term can be assigned a type. Each typing rule has a conclusion (the judgment being derived) and zero or more premises (the sub-judgments that must hold). The collection of typing rules for a language defines the type system.

---

## U

**Unification.**
An algorithm that, given two terms (or types) with variables, finds the most general substitution (most general unifier, MGU) that makes them syntactically equal. Robinson's unification algorithm (1965) is the core engine of Hindley-Milner type inference. Unification can be extended to handle higher-order terms, equational theories, and constraints.

**Unit Type.**
A type with exactly one value, usually written () or unit. The unit type corresponds to the trivial proposition True under the Curry-Howard correspondence. Functions returning unit are used for side effects.

**Universal Type.**
A type of the form forall a. T, classifying terms that work for all types. The introduction form is type abstraction (Lambda a. e); the elimination form is type application (e [T]). Universal types are the basis of parametric polymorphism.

**Universe.**
In dependent type theory, a type whose elements are themselves types. The type Type_0 (or Set) is the universe of small types; Type_1 contains Type_0 and types built from it; and so on. The universe hierarchy Type_0 : Type_1 : Type_2 : ... prevents Girard's paradox (which would arise from Type : Type).

**Univalence Axiom.**
In homotopy type theory, the axiom stating that the identity type (A = B) in the universe of types is equivalent to the type of equivalences (A simeq B). Informally: equivalent types are equal. Univalence implies function extensionality and provides a powerful principle for transporting proofs and constructions across equivalent types.

**Universe Polymorphism.**
A mechanism that allows definitions to be parameterized over universe levels, so that a single definition works at all universe levels. Without universe polymorphism, definitions at Type_0 would need to be duplicated at Type_1, Type_2, etc. Coq and Lean support universe polymorphism.

---

## V

**Value.**
A term that is fully evaluated and cannot be reduced further. In a call-by-value language, values include lambda abstractions, constants (numbers, booleans), and constructors applied to values. The distinction between values and non-values determines what substitution can occur during evaluation.

**Value Restriction.**
A restriction in ML-type languages requiring that only syntactic values (not arbitrary expressions) be assigned polymorphic types at let bindings. The value restriction prevents unsoundness arising from the interaction of polymorphism with mutable references. Introduced by Wright (1995).

**Variance.**
The behavior of a type constructor with respect to subtyping. A type constructor F is covariant if A <: B implies F(A) <: F(B); contravariant if A <: B implies F(B) <: F(A); invariant if neither holds. Function types are contravariant in the argument and covariant in the result.

**View (Dependent Pattern Matching).**
A mechanism that allows pattern matching through an alternative decomposition of a data type, beyond its original constructors. Views provide custom perspectives on data: for example, viewing a natural number as either even or odd, rather than as zero or successor.

---

## W

**Weak Head Normal Form (WHNF).**
A term is in weak head normal form if it is a lambda abstraction, a constructor application, or a variable applied to arguments (a neutral term). WHNF evaluation reduces only the outermost redex, stopping when a lambda or constructor is reached. Call-by-name and call-by-need strategies evaluate to WHNF.

**Weakening (Structural Rule).**
The structural rule that allows adding unused hypotheses to a context: if Gamma |- e : T, then Gamma, x : S |- e : T. Linear type systems disallow weakening, requiring that all resources in the context be consumed.

**Well-Founded Induction.**
A proof principle based on well-founded relations (relations with no infinite descending chains). In dependent type theory, recursive function definitions must be shown to decrease on a well-founded measure to ensure termination. Structural recursion is a special case where the measure is the size of the argument.

**Well-Typed.**
A term e is well-typed in context Gamma if there exists a type T such that the judgment Gamma |- e : T is derivable using the typing rules. A closed term is well-typed if |- e : T for some T.

**Well-Founded Relation.**
A relation R on a set A such that there is no infinite descending chain a_0 R a_1 R a_2 R ... . Well-foundedness is the basis for structural recursion and induction: to define a function by recursion or prove a property by induction, one must show that recursive calls are made on strictly smaller arguments with respect to a well-founded relation.

**Widening.**
In the context of abstract interpretation and type inference, a technique for accelerating the convergence of fixed-point iterations by overapproximating intermediate results. In type theory, widening sometimes refers to the implicit coercion from a subtype to a supertype via subsumption.

---

## X

**XOR Type.**
An uncommon term occasionally used for a type that is the exclusive disjunction of two types, where exactly one component is present. Not standard terminology; most type theorists use sum types (which allow both branches) with additional constraints if exclusivity is needed.

---

## Y

**Y Combinator.**
The fixed-point combinator Y = (lambda f. (lambda x. f (x x)) (lambda x. f (x x))) in the untyped lambda calculus, satisfying Y f = f (Y f) for all f. The Y combinator is not typeable in the simply typed lambda calculus or System F, since these systems are strongly normalizing. Typed languages add a fix primitive instead.

---

## Z

**Zipper.**
A data structure that represents a position within a tree (or other recursive data structure) together with the surrounding context, enabling efficient navigation and local updates. Zippers are used in functional implementations of editors, cursors in abstract syntax trees, and contexts in evaluation.

**Zonking.**
In type inference implementations, the process of traversing a type and following all unification variable links to produce a fully resolved type. After type inference is complete, all type variables should be either bound (quantified) or resolved (linked to concrete types). Zonking ensures the output type contains no unresolved links.
