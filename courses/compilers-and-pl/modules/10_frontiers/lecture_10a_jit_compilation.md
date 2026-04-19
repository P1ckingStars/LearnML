# Lecture 10a: Just-In-Time Compilation

## Prerequisites

- Compiler pipeline (Modules 01--08), intermediate representations, basic optimization passes.

---

## 1. Interpretation vs. Compilation Trade-Offs

### 1.1 The Spectrum

| Approach | Startup time | Steady-state performance | Memory | Portability |
|----------|-------------|-------------------------|--------|-------------|
| Pure interpretation | Instant | Slow (10--100x native) | Low | High |
| Bytecode interpretation | Fast (compile to bytecode) | Moderate (3--10x native) | Moderate | High |
| Ahead-of-time (AOT) compilation | Slow | Fast (native) | High (code cache) | Low |
| JIT compilation | Fast start, warms up | Near-native (after warmup) | High | High |

### 1.2 The Key Insight

JIT compilation exploits **runtime information** unavailable to AOT compilers:
- **Actual types** of values (dynamic languages).
- **Hot paths** (which code is frequently executed).
- **Runtime constants** (e.g., configuration values, loaded classes).
- **Call targets** (for devirtualization).

### 1.3 The Fundamental Trade-Off

Compilation takes time and resources. The time spent compiling must be recovered through faster execution:

$$
T_{\text{total}} = T_{\text{interpret}} + T_{\text{compile}} + T_{\text{execute\_compiled}}
$$

For the JIT to be worthwhile: $T_{\text{interpret}} + T_{\text{compile}} + T_{\text{execute\_compiled}} < T_{\text{interpret\_all}}$.

---

## 2. Tracing JITs: Design and Implementation

### 2.1 Core Idea

A **tracing JIT** compiles individual execution traces (sequences of instructions along a particular control flow path) rather than entire methods.

### 2.2 The Tracing Algorithm

```
function TracingJIT(program):
    interpreter_state = initial_state(program)
    loop_headers = {}      // map from PC to execution count
    traces = {}            // map from PC to compiled trace

    while not done:
        pc = current_pc(interpreter_state)

        if pc in traces:
            result = execute_compiled(traces[pc], interpreter_state)
            if result == GUARD_FAILURE(side_exit_pc, state):
                interpreter_state = state
                // optionally: start recording a "bridge" trace from side_exit_pc
            continue

        if is_loop_header(pc):
            loop_headers[pc] = loop_headers.get(pc, 0) + 1
            if loop_headers[pc] >= HOT_THRESHOLD:
                trace = record_trace(pc, interpreter_state, program)
                compiled = optimize_and_compile(trace)
                traces[pc] = compiled
                continue

        interpreter_state = interpret_one(program, interpreter_state)
```

### 2.3 Trace Recording

During trace recording, the interpreter records the sequence of operations executed along a single path:

```
function record_trace(start_pc, state, program):
    trace = []
    pc = start_pc
    recording = true

    while recording:
        instruction = program[pc]
        trace.append(instruction)

        if is_branch(instruction):
            taken = evaluate_branch(instruction, state)
            trace.append(Guard(instruction.condition, taken))
            // record a guard: if future execution takes the other branch, exit the trace
            pc = taken ? instruction.true_target : instruction.false_target
        else:
            state = execute(instruction, state)
            pc = next_pc(pc)

        if pc == start_pc:
            recording = false  // loop completed; trace is a single iteration

    return trace
```

### 2.4 Guards and Side Exits

A **guard** is a runtime check inserted into the compiled trace. If the guard fails (the actual execution would take a different path than the recorded trace), execution transfers to a **side exit**:

$$
\text{guard}(x > 0) \quad \longrightarrow \quad \begin{cases} \text{continue trace} & \text{if } x > 0 \\ \text{side exit} & \text{otherwise} \end{cases}
$$

Side exits resume interpretation (or trigger compilation of a **bridge trace** connecting to another compiled trace).

### 2.5 Trace Optimization

Recorded traces are in SSA-like linear form, enabling aggressive optimizations:
- **Constant folding and propagation**: Many values are constants on a specific trace.
- **Type specialization**: Guards establish type information; operations can be specialized.
- **Dead guard elimination**: Redundant guards can be removed.
- **Allocation removal (escape analysis)**: If an object does not escape the trace, it can be scalar-replaced.
- **Loop invariant code motion**: Since the trace represents a loop body, invariants are lifted.

### 2.6 Advantages and Disadvantages

**Advantages:**
- Naturally focuses on hot paths.
- Linear trace form enables simple, effective optimizations.
- Works well for loops with predictable control flow.

**Disadvantages:**
- **Trace explosion**: Many different paths through a loop body generate many traces.
- **Trace stitching**: Connecting traces at merge points is complex.
- **Poor fit for irregular control flow** (e.g., interpreters with large switch statements).

### 2.7 Historical Example: TraceMonkey (Gal et al., 2009)

TraceMonkey was Firefox's tracing JIT for JavaScript. It recorded traces through the SpiderMonkey bytecode interpreter and compiled them to native code via Nanojit. Key lesson: tracing JITs work well for numeric loops but struggle with polymorphic, object-heavy JavaScript code, leading Mozilla to switch to a method JIT (IonMonkey).

---

## 3. Method JITs

### 3.1 Core Idea

A **method JIT** compiles entire methods (functions) to native code, applying traditional compiler optimizations.

### 3.2 Compilation Pipeline

```
Source code
    |
    v
Bytecode (from parser/AOT frontend)
    |
    v
[Interpreter: collect profiling info]
    |
    v
[JIT Compiler]
  |- Build IR (e.g., SSA form, sea of nodes)
  |- Apply optimizations (inlining, CSE, DCE, loop opts, ...)
  |- Register allocation
  |- Code generation
    |
    v
Native code (installed in code cache)
```

### 3.3 Advantages over Tracing

- Handles irregular control flow (many branches, exceptions) naturally.
- Optimizations operate on complete control flow graphs.
- Better at inter-procedural optimization (inlining entire callees).

---

## 4. Tiered Compilation

### 4.1 Concept

**Tiered compilation** uses multiple compilation tiers with increasing optimization levels. Code starts in a fast, low-quality tier and is promoted to higher tiers as it proves to be hot.

### 4.2 HotSpot JVM

The HotSpot JVM uses two compilers:

| Tier | Compiler | Optimization level | Compile time |
|------|----------|-------------------|-------------|
| 0 | Interpreter | None | N/A |
| 1--3 | C1 (client compiler) | Lightweight | Fast |
| 4 | C2 (server compiler) | Aggressive (escape analysis, loop unrolling, vectorization) | Slow |

Promotion policy: Method invocation counters and back-edge counters trigger compilation. Tier transitions:

$$
\text{Interpreter} \xrightarrow{\text{hot}} \text{C1} \xrightarrow{\text{very hot}} \text{C2}
$$

### 4.3 V8 (JavaScript)

V8's tiered architecture (as of recent versions):

| Tier | Component | Description |
|------|-----------|-------------|
| 0 | Ignition (interpreter) | Bytecode interpreter, collects type feedback |
| 1 | Sparkplug | Baseline compiler, no optimization (fast compile) |
| 2 | Maglev | Mid-tier optimizing compiler |
| 3 | TurboFan | Full optimizing compiler (sea-of-nodes IR) |

### 4.4 GraalVM and Partial Evaluation (Wurthinger et al., 2017)

**Truffle/GraalVM** uses a different approach: language implementors write an **AST interpreter** in Java, and the Graal compiler **partially evaluates** the interpreter with respect to the program being run.

$$
\text{pe}(\text{interp}, \text{prog}) = \text{compiled\_code}
$$

This is a practical realization of the **first Futamura projection** (see Lecture 09d). The resulting code is specialized for the specific program and can be aggressively optimized by Graal.

**Key technique: Self-optimizing ASTs.** AST nodes rewrite themselves based on observed types:

```
class AddNode extends Node:
    execute(frame):
        left = leftChild.execute(frame)
        right = rightChild.execute(frame)
        if left is Int and right is Int:
            replace self with IntAddNode
            return left + right
        else:
            replace self with GenericAddNode
            return genericAdd(left, right)
```

---

## 5. On-Stack Replacement (OSR)

### 5.1 The Problem

A long-running loop may be executing in interpreted mode. If the loop is identified as hot, we want to switch to compiled code **without waiting for the current invocation to finish**.

### 5.2 OSR Entry

**On-stack replacement** replaces the currently executing stack frame with a compiled version mid-execution.

```
function OSR_Entry(interpreted_frame, compiled_code):
    // 1. Map interpreter state to compiler's expected state
    mapping = compute_state_mapping(interpreted_frame, compiled_code)

    // 2. Create a compiled frame with the mapped state
    compiled_frame = create_frame(compiled_code, mapping)

    // 3. Transfer control to the compiled code at the appropriate point
    //    (typically the loop header where the trigger occurred)
    jump_to(compiled_code.osr_entry_point, compiled_frame)
```

### 5.3 Challenges

1. **State mapping**: The interpreter and compiler may represent local variables differently (e.g., interpreter uses an array; compiler uses registers).
2. **Optimization barriers**: The OSR entry point constrains optimizations -- the compiler must be able to reconstruct the expected state at that point.
3. **Multiple OSR points**: Supporting OSR at multiple loop headers increases complexity.

### 5.4 OSR Exit (for Deoptimization)

OSR also works in reverse: transferring from compiled code back to the interpreter. This is used for **deoptimization** (Section 6).

---

## 6. Deoptimization and Speculative Optimization

### 6.1 Speculative Optimization

JIT compilers make **speculative assumptions** based on profiling data:

- "This variable is always an integer" $\implies$ generate integer-only code.
- "This virtual call always targets `Foo.bar()`" $\implies$ inline `Foo.bar()`.
- "This branch is always taken" $\implies$ optimize for the taken path.

These assumptions are protected by **guards** (checks that the assumption still holds).

### 6.2 Deoptimization

When a guard fails, the compiled code is **invalid** for the current execution. **Deoptimization** transfers control back to the interpreter:

```
function Deoptimize(compiled_frame, guard_failure_point):
    // 1. Reconstruct interpreter state from compiled frame
    //    (using metadata recorded during compilation)
    debug_info = compiled_code.debug_info[guard_failure_point]
    interpreter_frame = reconstruct_state(compiled_frame, debug_info)

    // 2. Invalidate or recompile the compiled code
    mark_for_recompilation(compiled_code, guard_failure_point)

    // 3. Continue execution in interpreter
    resume_interpreter(interpreter_frame)
```

### 6.3 Uncommon Traps (HotSpot)

HotSpot uses **uncommon traps**: deoptimization points for rare events. The compiled code contains a trap instruction at the uncommon path. When hit:

1. The trap handler captures the compiled frame state.
2. The state is mapped back to interpreter frames.
3. Execution resumes in the interpreter.
4. If the trap fires frequently, the method is recompiled with less aggressive assumptions.

### 6.4 Formal Model of Speculative Optimization

Let $P$ be the original program and $P'$ the speculatively optimized program. Let $\phi$ be the speculation (a predicate on program states).

**Correctness condition:**

$$
\forall \sigma.\; \phi(\sigma) \implies [\![ P ]\!](\sigma) = [\![ P' ]\!](\sigma)
$$

$$
\forall \sigma.\; \neg\phi(\sigma) \implies \text{deoptimize}(\sigma) \text{ produces a state from which } [\![ P ]\!] \text{ can resume correctly}
$$

The combination of speculation + deoptimization is semantically equivalent to $P$:

$$
[\![ P_{\text{speculative}} ]\!] = [\![ P ]\!]
$$

---

## 7. Profile-Guided Optimization (PGO)

### 7.1 Concept

**Profile-guided optimization** uses runtime profiling data to guide AOT compilation decisions. The workflow:

1. **Instrumented build**: Compile with profiling counters inserted.
2. **Training run**: Execute the instrumented binary on representative inputs.
3. **Optimized build**: Recompile using the collected profile data.

### 7.2 PGO Optimizations

- **Basic block ordering**: Place hot blocks contiguously; cold blocks out-of-line.
- **Function inlining**: Inline hot call targets; avoid inlining cold ones.
- **Branch prediction hints**: Mark likely/unlikely branches.
- **Code layout**: Group hot functions together (improves instruction cache locality).
- **Partial inlining**: Inline only the hot path of a function.

### 7.3 AutoFDO (Google)

**AutoFDO** collects profiles from production using hardware performance counters (e.g., `perf` on Linux with Last Branch Records). This avoids the need for a separate instrumented build.

$$
\text{Source} \xrightarrow{\text{compile}} \text{Binary} \xrightarrow{\text{production run}} \text{Profile (perf data)} \xrightarrow{\text{compile with profile}} \text{Optimized Binary}
$$

### 7.4 BOLT (Facebook/Meta)

**BOLT** is a post-link optimizer that uses profile data to reorder basic blocks and functions in an already-compiled binary:

$$
\text{Binary} + \text{Profile} \xrightarrow{\text{BOLT}} \text{Optimized Binary}
$$

Typical speedups: 5--15% on large server applications due to improved instruction cache and branch prediction.

---

## 8. JIT for Dynamic Languages

### 8.1 The Challenge

Dynamic languages (JavaScript, Python, Ruby) lack static type information. Operations like `a + b` must dispatch based on the runtime types of `a` and `b`.

### 8.2 Type Specialization

The JIT collects **type feedback** (what types are actually observed) and generates specialized code:

```
// Generic (slow)
function add(a, b):
    if typeof(a) == Int and typeof(b) == Int:
        return int_add(a, b)
    elif typeof(a) == Float and typeof(b) == Float:
        return float_add(a, b)
    elif typeof(a) == String and typeof(b) == String:
        return string_concat(a, b)
    else:
        return generic_add(a, b)

// Specialized (fast), after observing a and b are always Int:
function add_specialized(a: Int, b: Int):
    guard(typeof(a) == Int)
    guard(typeof(b) == Int)
    return int_add(a, b)   // single machine instruction
```

### 8.3 Inline Caches (Deutsch & Schiffman, 1984)

An **inline cache (IC)** caches the result of a method lookup at a particular call site.

**Monomorphic IC** (one type):

```
// Before first call:
call_site: LOOKUP_AND_CACHE(obj, "method")

// After caching (obj was type Foo):
call_site:
    if typeof(obj) == Foo:
        call Foo_method(obj)    // fast path
    else:
        LOOKUP_AND_CACHE(obj, "method")  // slow path; update cache
```

**Polymorphic IC (PIC)**: Caches multiple type-to-method mappings (typically 2--8 entries).

**Megamorphic**: Too many types observed; fall back to a hash-table lookup.

### 8.4 Hidden Classes (V8) / Shapes (SpiderMonkey) / Maps (Self)

Dynamic objects can have properties added at runtime. **Hidden classes** (also called shapes or maps) are internal type descriptors that track the layout of an object.

```
// JavaScript:
let obj = {};      // hidden class HC0: {}
obj.x = 1;         // hidden class HC1: {x: offset 0}
obj.y = 2;         // hidden class HC2: {x: offset 0, y: offset 1}
```

Each hidden class stores:
- Property names and their offsets.
- **Transitions**: If property `p` is added, which hidden class results?

Objects with the same sequence of property additions share the same hidden class, enabling:
- **Fast property access**: Compile to a fixed-offset load (like a struct field access).
- **IC validity**: Check hidden class pointer instead of checking each property.

### 8.5 Formal Model: Abstract Interpretation for Type Feedback

Type feedback can be formalized as an **abstract interpretation** at runtime. For each program point $p$, the JIT maintains an abstract state $\hat{\sigma}_p$ from a type lattice:

$$
\hat{\sigma}_p \in \text{Types} = \{\bot, \text{Int}, \text{Float}, \text{String}, \text{Object}(HC), \ldots, \top\}
$$

As execution proceeds, $\hat{\sigma}_p$ is updated by joining observed types:

$$
\hat{\sigma}_p := \hat{\sigma}_p \sqcup \text{typeof}(v_{\text{observed}})
$$

When $\hat{\sigma}_p$ stabilizes (remains below $\top$), the JIT can speculate on the type.

---

## 9. Advanced Topics

### 9.1 Escape Analysis in JIT Compilers

**Escape analysis** determines whether an allocated object "escapes" the current compilation scope (e.g., is stored in a heap structure, passed to an un-inlined call, or returned).

If an object does not escape:
- Its fields can be **scalar-replaced** (kept in registers).
- Its allocation can be **eliminated**.
- Synchronization on it can be **elided**.

```
// Before escape analysis:
Point p = new Point(x, y);
int sum = p.x + p.y;

// After scalar replacement:
int p_x = x;
int p_y = y;
int sum = p_x + p_y;
```

### 9.2 Sea-of-Nodes IR (Click & Paleczny, 1995)

Used by HotSpot C2 and V8 TurboFan. Nodes represent both data flow and control flow in a unified graph. Benefits:
- Optimizations (GVN, CSE) are simplified -- no need to maintain instruction order.
- Dead code is naturally disconnected from the graph.
- Scheduling is a late, separate phase.

### 9.3 Polymorphic Inline Caches and Dispatch Chains

**Theorem (Performance model).** For a polymorphic call site with $k$ observed types, a PIC performs $O(k)$ comparisons in the worst case. When $k$ exceeds a threshold (typically 4--8), the PIC is replaced by a megamorphic dispatch (hash table lookup, $O(1)$ amortized but with higher constant factor).

---

## 10. Summary

| Concept | Key Insight |
|---------|------------|
| Tracing JIT | Compile hot execution paths (traces); guards protect speculative assumptions |
| Method JIT | Compile whole methods; handles complex control flow |
| Tiered compilation | Multiple optimization levels; promote hot code to higher tiers |
| OSR | Switch between interpretation and compiled code mid-execution |
| Deoptimization | Safely fall back to interpreter when speculation fails |
| PGO | Use profiling data to guide optimization decisions |
| Inline caches | Cache method lookup results per call site |
| Hidden classes | Internal type descriptors for dynamic objects; enable fast property access |

---

## References

1. Holzle, U., Chambers, C., & Ungar, D. (1991). "Optimizing dynamically-typed object-oriented languages with polymorphic inline caches." *ECOOP '91*, LNCS 512.
2. Gal, A., Eich, B., Shaver, M., et al. (2009). "Trace-based just-in-time type specialization for dynamic languages." *PLDI '09*.
3. Wurthinger, T., Wimmer, C., Humer, C., et al. (2017). "Practical partial evaluation for high-performance dynamic language runtimes." *PLDI '17*.
4. Deutsch, L. P. & Schiffman, A. M. (1984). "Efficient implementation of the Smalltalk-80 system." *POPL '84*.
5. Click, C. & Paleczny, M. (1995). "A simple graph-based intermediate representation." *IR '95 Workshop, ACM SIGPLAN Notices*.
6. Kotzmann, T., Wimmer, C., Mossenbock, H., et al. (2008). "Design of the Java HotSpot client compiler for Java 6." *ACM TACO*, 5(1).
7. Pall, M. (2009). "LuaJIT 2.0." (Tracing JIT for Lua.)
8. Bolz, C. F., Cuni, A., Fijalkowski, M., & Rigo, A. (2009). "Tracing the meta-level: PyPy's tracing JIT compiler." *ICOOOLPS '09*.
9. Chen, J., Hu, Y., & Li, L. (2019). "BOLT: A practical binary optimizer for data centers and beyond." *CGO '19*.
10. Fink, S. J. & Qian, F. (2003). "Design, implementation and evaluation of adaptive recompilation with on-stack replacement." *CGO '03*.
