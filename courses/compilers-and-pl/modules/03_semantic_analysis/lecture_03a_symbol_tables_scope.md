# Lecture 03a: Symbol Tables & Scope

## 1. Introduction

A **symbol table** is the central data structure used by a compiler to track the bindings between names (identifiers) and their attributes (type, scope level, memory location, etc.). Every phase of compilation---from semantic analysis through code generation---relies on the symbol table to resolve names and enforce scoping rules.

The fundamental operation is **name resolution**: given an occurrence of a name in the program, determine which declaration it refers to. The rules governing this resolution constitute the language's **scoping discipline**.

---

## 2. Static vs. Dynamic Scoping

### 2.1 Static (Lexical) Scoping

Under **static scoping**, the binding of a name is determined by the textual (lexical) structure of the program. A name refers to the closest enclosing declaration in the source text.

**Definition.** Let $x$ be a variable occurrence at program point $p$. Under static scoping, $x$ is bound to the declaration $d$ such that:
1. $d$ declares $x$,
2. $d$ is in a scope that encloses $p$, and
3. there is no other declaration $d'$ of $x$ in a scope that is both enclosed by the scope of $d$ and encloses $p$.

This is the scoping discipline used by virtually all modern languages: C, Java, Python, ML, Haskell, Rust.

**Example:**

```
let x = 10 in
  let f = fun y -> x + y in
    let x = 20 in
      f 5    (* Result: 15, not 25 *)
```

Under static scoping, `f` captures the binding `x = 10` from its definition site.

### 2.2 Dynamic Scoping

Under **dynamic scoping**, the binding of a name is determined by the runtime call stack. A free variable in a function body is resolved in the *calling* environment, not the *defining* environment.

**Definition.** Let $x$ be a free variable in a function $f$ invoked at runtime. Under dynamic scoping, $x$ is bound to the most recent active binding of $x$ on the call stack at the time of the invocation.

Dynamic scoping was used in early Lisps, Emacs Lisp, and some shell scripting languages (`bash` variable lookup).

**Example (dynamic scoping):**

```
let x = 10 in
  let f = fun y -> x + y in
    let x = 20 in
      f 5    (* Result: 25 under dynamic scoping *)
```

### 2.3 Formal Comparison

| Property | Static Scoping | Dynamic Scoping |
|----------|---------------|-----------------|
| Resolution time | Compile time | Runtime |
| Depends on | Lexical nesting | Call stack |
| Closures | Capture defining environment | Not meaningful |
| Reasoning | Local (modular) | Global (fragile) |
| Performance | Faster (compile-time offsets) | Slower (runtime lookup) |

**Theorem 2.1.** Under static scoping with no mutation, the binding of every variable occurrence can be determined at compile time.

*Proof.* By structural induction on the abstract syntax tree. At each node that introduces a scope (e.g., `let`, `fun`, block), bindings are pushed into the environment. At each variable reference, the environment is searched from innermost to outermost scope. Since the AST is fixed at compile time and the scoping rules depend only on tree structure, the resolution is fully determined statically. $\square$

### 2.4 Scope Holes

A **scope hole** occurs when an inner declaration of a name $x$ shadows an outer declaration, making the outer one inaccessible within the inner scope.

Formally, if scope $S_1 \subset S_2$ (where $S_1$ is nested inside $S_2$) and both declare a variable $x$, then the declaration in $S_1$ **shadows** the one in $S_2$ throughout $S_1$.

---

## 3. Block-Structured Symbol Tables

### 3.1 Scope Nesting and the Stack Discipline

In a language with **block structure** (e.g., C, Java, ML), scopes are nested and follow a stack discipline: scopes are entered and exited in LIFO order during a single pass over the AST.

We model the symbol table as a stack of **scope frames**:

$$\text{SymbolTable} = [\text{Frame}_0, \text{Frame}_1, \ldots, \text{Frame}_k]$$

where $\text{Frame}_0$ is the global scope and $\text{Frame}_k$ is the innermost currently active scope.

### 3.2 Operations

The symbol table supports the following operations:

```
OPEN-SCOPE():
    Push a new empty frame onto the scope stack.

CLOSE-SCOPE():
    Pop the topmost frame from the scope stack.

INSERT(name, attributes):
    Insert (name, attributes) into the topmost frame.
    Error if name already exists in the topmost frame (redeclaration).

LOOKUP(name):
    Search frames from topmost to bottommost.
    Return the first entry found, or UNDEFINED.
```

### 3.3 Complexity Analysis

Let $d$ be the depth of scope nesting and $n$ be the total number of declarations.

| Operation | Naive (list of lists) | Hash table per scope |
|-----------|----------------------|---------------------|
| INSERT | $O(m)$ where $m$ = frame size | $O(1)$ amortized |
| LOOKUP | $O(d \cdot m)$ worst case | $O(d)$ worst case |
| OPEN-SCOPE | $O(1)$ | $O(1)$ |
| CLOSE-SCOPE | $O(1)$ | $O(m)$ (cleanup) |

---

## 4. Hash Table Implementations

### 4.1 Single Hash Table with Scope Chaining

Instead of maintaining a separate hash table per scope, a common implementation uses a **single global hash table** where each bucket is a stack of bindings. The most recent binding is at the top.

```
structure Entry:
    name: string
    attributes: TypeInfo
    scope_level: int
    next_in_bucket: Entry      // hash chain
    next_in_scope: Entry       // scope chain (for cleanup)

structure SymbolTable:
    table: array[HASH_SIZE] of Entry
    scope_stack: stack of Entry   // head of scope chain per level
    current_level: int

procedure OPEN_SCOPE(S):
    S.current_level := S.current_level + 1
    push null onto S.scope_stack

procedure CLOSE_SCOPE(S):
    entry := top of S.scope_stack
    while entry != null:
        remove entry from its hash bucket
        entry := entry.next_in_scope
    pop S.scope_stack
    S.current_level := S.current_level - 1

procedure INSERT(S, name, attrs):
    h := hash(name)
    // Check for redeclaration at current level
    e := S.table[h]
    while e != null:
        if e.name == name and e.scope_level == S.current_level:
            error("Redeclaration of " + name)
        e := e.next_in_bucket
    // Insert new entry
    new_entry := Entry(name, attrs, S.current_level)
    new_entry.next_in_bucket := S.table[h]
    S.table[h] := new_entry
    new_entry.next_in_scope := top of S.scope_stack
    set top of S.scope_stack to new_entry

procedure LOOKUP(S, name):
    h := hash(name)
    e := S.table[h]
    while e != null:
        if e.name == name:
            return e    // topmost binding (most recent scope)
        e := e.next_in_bucket
    return NOT_FOUND
```

**Key insight:** Because insertions go to the *front* of the hash chain and entries at higher scope levels are inserted later, `LOOKUP` naturally finds the innermost binding first.

**Complexity:** INSERT and LOOKUP are $O(1)$ amortized (assuming a good hash function). CLOSE_SCOPE is $O(m)$ where $m$ is the number of declarations in the closed scope.

### 4.2 Hash Function Considerations

For identifier hashing, common choices include:

- **FNV-1a hash**: Fast, good distribution for short strings.
- **DJB2 hash**: Simple, widely used.
- **Robin Hood hashing**: Open addressing with bounded probe lengths.

The hash table size should be a prime number or a power of two (with multiplicative hashing) to reduce collisions. In practice, compilers like GCC use hash tables with $2^{10}$ to $2^{14}$ buckets.

---

## 5. Tree-Based Implementations

### 5.1 Persistent (Functional) Symbol Tables

In some compiler architectures---especially those processing functional languages---a **persistent** symbol table is preferable. Rather than mutating the table, each scope extension produces a new version while sharing structure with the old one.

A balanced binary search tree (e.g., red-black tree, AVL tree) supports this naturally:

$$\text{LOOKUP}: O(\log n), \quad \text{INSERT}: O(\log n)$$

where $n$ is the total number of bindings. The key advantage is that old versions remain accessible, which is useful for:
- Backtracking in type inference
- Parallel or speculative compilation
- Maintaining environments for closures

### 5.2 Tries and Radix Trees

For languages with many long identifiers sharing common prefixes (e.g., Java fully qualified names), **trie** or **radix tree** (Patricia tree) implementations can be efficient:

$$\text{LOOKUP}: O(|k|), \quad \text{INSERT}: O(|k|)$$

where $|k|$ is the length of the key (identifier name). These are independent of the number of entries.

---

## 6. Name Resolution Algorithms

### 6.1 Single-Pass Name Resolution

For languages where every name must be declared before use (e.g., C, Pascal), name resolution can be performed in a single pass over the AST:

```
procedure RESOLVE(node, env):
    match node with
    | VarDecl(name, type, init):
        RESOLVE(init, env)
        INSERT(env, name, type)
    | VarRef(name):
        entry := LOOKUP(env, name)
        if entry == NOT_FOUND:
            error("Undeclared variable: " + name)
        node.resolved_to := entry
    | Block(stmts):
        OPEN_SCOPE(env)
        for stmt in stmts:
            RESOLVE(stmt, env)
        CLOSE_SCOPE(env)
    | FunDecl(name, params, body):
        INSERT(env, name, FunctionType(params, body))
        OPEN_SCOPE(env)
        for (pname, ptype) in params:
            INSERT(env, pname, ptype)
        RESOLVE(body, env)
        CLOSE_SCOPE(env)
```

### 6.2 Multi-Pass Name Resolution

Languages permitting forward references (e.g., Java methods, Haskell's `let rec`, mutually recursive definitions) require multiple passes:

**Pass 1:** Collect all declarations at each scope level without resolving references.

**Pass 2:** Resolve all references using the fully populated symbol table.

For mutually recursive types:

```
procedure RESOLVE_MUTUAL_RECURSION(decls, env):
    // Pass 1: Insert "forward declarations" (stubs)
    for decl in decls:
        INSERT(env, decl.name, PLACEHOLDER_TYPE)
    // Pass 2: Resolve bodies and fill in types
    for decl in decls:
        actual_type := RESOLVE_TYPE(decl.body, env)
        UPDATE(env, decl.name, actual_type)
    // Pass 3: Check consistency
    for decl in decls:
        VERIFY_TYPE(decl, env)
```

### 6.3 Qualified Name Resolution

For languages with modules or packages, names may be qualified: `Module.submodule.name`. Resolution proceeds hierarchically:

1. Resolve the leftmost component against the current scope.
2. Check that it refers to a module or namespace.
3. Resolve subsequent components within that module's exported scope.

```
procedure RESOLVE_QUALIFIED(path, env):
    current_env := env
    for i := 0 to |path| - 2:
        entry := LOOKUP(current_env, path[i])
        if entry is not a Module:
            error("Not a module: " + path[i])
        current_env := entry.exports
    return LOOKUP(current_env, path[|path| - 1])
```

---

## 7. Overloading and Name Mangling

### 7.1 Overloading

**Overloading** allows multiple declarations to share the same name, distinguished by their type signatures. The symbol table must store *all* bindings for an overloaded name, and resolution is deferred until type information is available.

**Definition.** A name $f$ is **overloaded** if there exist declarations $f : \tau_1, f : \tau_2, \ldots, f : \tau_k$ in the same scope, where $\tau_i \neq \tau_j$ for $i \neq j$.

The symbol table entry becomes a list:

$$\text{LOOKUP}(\texttt{f}) = \{(f, \tau_1), (f, \tau_2), \ldots, (f, \tau_k)\}$$

**Overload resolution** selects the appropriate declaration based on the types of the arguments at the call site. This may require:
- Exact matching
- Implicit conversions (widening)
- Most specific match (C++ overload resolution rules)

**Complexity:** Overload resolution in C++ is notoriously complex. The standard defines a partial order on "implicit conversion sequences" and selects the *best viable function*. In the worst case, this is exponential in the number of arguments (due to template argument deduction).

### 7.2 Name Mangling

**Name mangling** (or name decoration) is the process of encoding a function's name and type signature into a unique linker symbol. This is necessary to support overloading at the object code level.

**C++ Itanium ABI example:**

```
int foo(int, double)    -->  _Z3fooid
int foo(float)          -->  _Z3foof
```

The mangling scheme encodes:
- `_Z` prefix
- Length-prefixed function name
- Encoded parameter types (`i` = int, `d` = double, `f` = float)

### 7.3 Operator Overloading

Operator overloading extends the concept to built-in operators. The expression `a + b` is resolved based on the types of `a` and `b`:

$$\frac{\Gamma \vdash a : \tau_1 \quad \Gamma \vdash b : \tau_2 \quad (+) : \tau_1 \times \tau_2 \to \tau_3 \in \text{Overloads}(+)}{\Gamma \vdash a + b : \tau_3}$$

---

## 8. Modules and Namespaces

### 8.1 Module Systems

A **module** is a named collection of declarations with controlled visibility. Module systems introduce:

- **Export lists:** Which names are visible outside the module.
- **Import lists:** Which external names are brought into scope.
- **Qualified access:** `Module.name` syntax.
- **Renaming:** `import Module (foo as bar)`.

### 8.2 Symbol Table for Modules

Each module maintains its own symbol table. The global symbol table maps module names to their respective tables:

$$\text{GlobalTable}: \text{ModuleName} \to \text{SymbolTable}$$

An import statement `import M` extends the current scope with the exported bindings of $M$:

```
procedure IMPORT(current_env, module_name):
    mod := LOOKUP_MODULE(module_name)
    for (name, attrs) in mod.exports:
        INSERT(current_env, name, attrs)
```

An import with qualification `import qualified M` does *not* insert names into the current scope but allows `M.name` references.

### 8.3 Separate Compilation

For separately compiled modules, the compiler needs **interface files** (`.mli` in OCaml, `.hi` in Haskell, header files in C/C++) that describe the exported types and signatures without implementation details.

The symbol table for an imported module is reconstructed from the interface file:

```
procedure LOAD_INTERFACE(path):
    iface := parse_interface_file(path)
    mod_table := new SymbolTable()
    for decl in iface.declarations:
        INSERT(mod_table, decl.name, decl.type)
    return mod_table
```

---

## 9. Implementation Case Study: A Block-Structured Symbol Table

Below is a complete pseudocode implementation combining the techniques discussed.

```
class SymbolTable:
    HASH_SIZE = 1024

    class Entry:
        name: string
        type: Type
        scope_level: int
        is_defined: bool
        source_location: (int, int)
        prev_in_bucket: Entry
        prev_in_scope: Entry

    buckets: array[HASH_SIZE] of Entry
    scope_chain_heads: stack of Entry
    level: int = 0

    method enter_scope():
        level += 1
        scope_chain_heads.push(null)

    method exit_scope():
        head := scope_chain_heads.pop()
        while head != null:
            h := hash(head.name) mod HASH_SIZE
            buckets[h] := head.prev_in_bucket
            head := head.prev_in_scope
        level -= 1

    method insert(name, type, loc):
        h := hash(name) mod HASH_SIZE
        // Check for duplicate in current scope
        e := buckets[h]
        while e != null and e.scope_level == level:
            if e.name == name:
                raise RedeclarationError(name, loc, e.source_location)
            e := e.prev_in_bucket
        // Create and link entry
        entry := Entry(name, type, level, true, loc)
        entry.prev_in_bucket := buckets[h]
        buckets[h] := entry
        entry.prev_in_scope := scope_chain_heads.top()
        scope_chain_heads.set_top(entry)

    method lookup(name):
        h := hash(name) mod HASH_SIZE
        e := buckets[h]
        while e != null:
            if e.name == name:
                return e
            e := e.prev_in_bucket
        return null

    method lookup_current_scope(name):
        h := hash(name) mod HASH_SIZE
        e := buckets[h]
        while e != null and e.scope_level == level:
            if e.name == name:
                return e
            e := e.prev_in_bucket
        return null
```

---

## 10. Scope in Specific Language Paradigms

### 10.1 Object-Oriented Languages

In OO languages, name resolution involves:
1. Local scope (method body)
2. Class scope (fields, methods)
3. Superclass scope (inheritance chain)
4. Enclosing scope (for inner classes/lambdas)
5. Package/module scope

The lookup must respect **access modifiers** (public, private, protected).

### 10.2 Functional Languages with Let-Bindings

In ML-family languages, `let` and `let rec` differ:

- `let x = e1 in e2`: $x$ is *not* in scope in $e_1$ but *is* in scope in $e_2$.
- `let rec x = e1 in e2`: $x$ is in scope in *both* $e_1$ and $e_2$.

This distinction is critical for the symbol table implementation:

```
// Non-recursive let
procedure resolve_let(x, e1, e2, env):
    resolve(e1, env)                   // x NOT in scope here
    env' := extend(env, x, type_of(e1))
    resolve(e2, env')                  // x IS in scope here

// Recursive let
procedure resolve_letrec(x, e1, e2, env):
    env' := extend(env, x, fresh_type_var())  // x IS in scope
    resolve(e1, env')                          // x IS in scope here too
    resolve(e2, env')
```

### 10.3 Pattern Matching

Pattern matching introduces bindings:

```
match expr with
| Cons(x, xs) -> ...    (* x and xs are bound here *)
| Nil -> ...
```

Each pattern arm opens a new scope. Variables in patterns are declarations, not references. **Linearity check:** each variable appears at most once in a pattern (enforced during semantic analysis).

---

## 11. Summary

| Concept | Key Idea |
|---------|----------|
| Static scoping | Bindings determined by lexical structure |
| Dynamic scoping | Bindings determined by call stack |
| Block-structured table | Stack of scope frames |
| Hash table with chaining | Single table, scope-linked entries |
| Persistent tables | Functional (immutable) structures for backtracking |
| Overloading | Multiple bindings per name, resolved by type |
| Name mangling | Encoding signatures into linker symbols |
| Modules | Named, encapsulated collections of bindings |

---

## References

1. Aho, A.V., Lam, M.S., Sethi, R., & Ullman, J.D. (2006). *Compilers: Principles, Techniques, and Tools* (2nd ed.), Chapter 2 (Sections 2.7--2.8) and Chapter 7.
2. Appel, A.W. (1998). *Modern Compiler Implementation in ML*, Chapter 5: Semantic Analysis.
3. Cooper, K. & Torczon, L. (2011). *Engineering a Compiler* (2nd ed.), Chapter 4: Context-Sensitive Analysis.
4. Muchnick, S.S. (1997). *Advanced Compiler Design and Implementation*, Chapter 4.
5. Wirth, N. (1971). "The Design of a Pascal Compiler." *Software---Practice and Experience*, 1(4), 309--333.
