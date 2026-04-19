# Lecture 06c: Calling Conventions & Runtime Organization

## 1. Introduction

Calling conventions and runtime organization define the contract between a function and its callers: how arguments are passed, how results are returned, which registers must be preserved, and how the stack is structured. These conventions are not merely implementation details---they determine binary compatibility, enable separate compilation, and profoundly influence code generation strategy.

This lecture develops the formal and practical aspects of calling conventions across major platforms, then extends to advanced topics: closures, nested functions, exception handling, and coroutines.

---

## 2. Stack Frames and Activation Records

### 2.1 The Runtime Stack

The runtime stack is a LIFO data structure that grows (typically downward in memory) with each function call. Each function invocation creates an *activation record* (or *stack frame*) containing:

1. **Return address**: where to resume execution after the call.
2. **Saved registers**: callee-saved registers that the function modifies.
3. **Local variables**: variables that do not fit in registers or whose address is taken.
4. **Spill slots**: temporaries spilled by the register allocator.
5. **Outgoing arguments**: arguments to functions called by this function (on some ABIs).
6. **Frame pointer** (optional): pointer to a fixed location in the frame for easy access to locals and parameters.

### 2.2 Generic Stack Frame Layout

```
High addresses
+---------------------------+
|    Incoming arguments     |  (passed on the stack by the caller)
|    (if any beyond regs)   |
+---------------------------+
|    Return address          |  (pushed by CALL instruction on x86)
+---------------------------+  <-- Frame pointer (RBP) if used
|    Saved frame pointer     |
+---------------------------+
|    Callee-saved registers  |
+---------------------------+
|    Local variables         |
+---------------------------+
|    Spill slots             |
+---------------------------+
|    Outgoing arguments      |  (for calls made by this function)
+---------------------------+  <-- Stack pointer (RSP)
Low addresses
```

### 2.3 Frame Pointer vs Frame Pointer Omission

Traditionally, functions maintain a *frame pointer* (`RBP` on x86-64) that points to a fixed location in the frame, providing a stable base for accessing locals and parameters.

With *frame pointer omission* (the default in modern optimized code), the compiler accesses all frame slots relative to the *stack pointer* (`RSP`). This frees `RBP` for general use but requires the compiler to track the exact stack pointer offset at every instruction. Debug information (e.g., DWARF CFI) records these offsets for debuggers and unwinders.

**Tradeoff analysis:**

| Aspect | Frame Pointer | FP Omission |
|--------|--------------|-------------|
| Available registers | $k - 1$ | $k$ |
| Stack access | Simple (fixed offset from FP) | Complex (varying offset from SP) |
| Debugging | Easy | Requires unwind tables |
| Performance | Slightly worse (one fewer register, extra instructions) | Slightly better |

---

## 3. Major Calling Conventions

### 3.1 cdecl (32-bit x86)

The classic C calling convention for 32-bit x86:

- **Arguments**: pushed onto the stack right-to-left.
- **Return value**: in `EAX` (32-bit integers), `ST(0)` (floating point).
- **Caller-saved registers**: `EAX`, `ECX`, `EDX`.
- **Callee-saved registers**: `EBX`, `ESI`, `EDI`, `EBP`, `ESP`.
- **Stack cleanup**: caller pops arguments after the call.
- **Stack alignment**: 4-byte aligned.

```nasm
; cdecl call: result = foo(1, 2, 3)
push 3          ; third argument
push 2          ; second argument
push 1          ; first argument
call foo
add esp, 12     ; caller cleans up 3 * 4 bytes
; result in eax
```

### 3.2 System V AMD64 ABI

The standard calling convention for 64-bit Unix/Linux/macOS:

- **Integer/pointer arguments**: first 6 in `RDI`, `RSI`, `RDX`, `RCX`, `R8`, `R9` (in order).
- **Floating-point arguments**: first 8 in `XMM0`--`XMM7`.
- **Additional arguments**: pushed right-to-left on the stack.
- **Return value**: `RAX` (integer), `XMM0` (float). 128-bit values use `RAX:RDX` or `XMM0:XMM1`.
- **Caller-saved registers**: `RAX`, `RCX`, `RDX`, `RSI`, `RDI`, `R8`--`R11`, `XMM0`--`XMM15`.
- **Callee-saved registers**: `RBX`, `RBP`, `R12`--`R15`.
- **Stack alignment**: 16-byte aligned *before* the `CALL` instruction (so the stack is 16-byte aligned modulo 8 upon entry, since `CALL` pushes 8 bytes).
- **Red zone**: 128 bytes below `RSP` that leaf functions may use without adjusting `RSP`.

```nasm
; System V AMD64: result = foo(a, b, c)
mov rdi, a      ; first argument
mov rsi, b      ; second argument
mov rdx, c      ; third argument
call foo
; result in rax
```

### 3.3 Windows x64 Calling Convention

- **Integer/pointer arguments**: first 4 in `RCX`, `RDX`, `R8`, `R9`.
- **Floating-point arguments**: first 4 in `XMM0`--`XMM3`.
- **Shadow space**: caller must reserve 32 bytes of stack space for the callee to spill register arguments (even if there are fewer than 4 arguments).
- **Return value**: `RAX` (integer), `XMM0` (float).
- **Callee-saved registers**: `RBX`, `RBP`, `RDI`, `RSI`, `R12`--`R15`, `XMM6`--`XMM15`.
- **Stack alignment**: 16-byte aligned before `CALL`.
- **No red zone**.

### 3.4 Comparison

| Feature | cdecl (x86-32) | System V AMD64 | Windows x64 |
|---------|----------------|----------------|-------------|
| Register args (int) | 0 | 6 | 4 |
| Register args (float) | 0 | 8 | 4 |
| Callee-saved GPRs | 4 | 5 | 8 |
| Red zone | No | 128 bytes | No |
| Shadow space | No | No | 32 bytes |
| Stack cleanup | Caller | Caller | Caller |

---

## 4. Parameter Passing: Registers vs Stack

### 4.1 Performance Impact

Register-based parameter passing avoids memory operations for the first few arguments. On a modern out-of-order processor with L1 cache latency of ~4 cycles:

$$\text{Cost}_{\text{stack}} = C_{\text{push}} + C_{\text{load}} \approx 1 + 4 = 5 \text{ cycles per argument}$$
$$\text{Cost}_{\text{register}} = C_{\text{mov}} \approx 0\text{--}1 \text{ cycles (may be eliminated by renaming)}$$

For a function with 4 arguments called $10^9$ times, register passing saves on the order of $10^{10}$ cycles ($\approx$ seconds on a 3 GHz processor).

### 4.2 Passing Large Structures

Structures that exceed register size may be:
1. **Passed by value in multiple registers** (if small enough---System V AMD64 allows up to 2 eightbytes in registers).
2. **Passed by reference** (caller allocates space, passes a pointer).
3. **Passed on the stack** (copied by the caller).

The System V AMD64 ABI classifies each eightbyte (8-byte chunk) of a structure as INTEGER, SSE, MEMORY, or other classes, then determines the passing mechanism:

```
Classification Algorithm (simplified):
1. If size > 64 bytes, or contains unaligned fields: MEMORY (pass on stack)
2. For each eightbyte in the struct:
   a. If all fields are integer/pointer: INTEGER
   b. If any field is float/double: SSE
   c. Merge eightbyte classes according to rules
3. If total classification is (INTEGER, INTEGER): pass in 2 GPRs
4. If total classification is (SSE, SSE): pass in 2 XMM registers
5. If MEMORY: pass on stack (caller copies)
```

---

## 5. Callee-Saved vs Caller-Saved Registers

### 5.1 Definitions

- **Callee-saved (non-volatile)**: the callee must preserve the value. If the callee wants to use the register, it must save and restore it (typically via push/pop).
- **Caller-saved (volatile)**: the caller must assume the callee destroys the value. If the caller needs the value after the call, it must save it before the call.

### 5.2 Optimal Partitioning

The choice of which registers are callee-saved vs caller-saved affects performance. Consider a register $r$:

- If most callees use $r$: making it caller-saved avoids unnecessary save/restore in the callee.
- If most callers need $r$ across calls: making it callee-saved avoids saves in the caller.

**Formal model.** Let $p_{\text{use}}$ be the probability that a function uses register $r$, and $p_{\text{live}}$ be the probability that $r$ is live across a call site. The expected cost is:

$$C_{\text{callee-saved}} = 2 \cdot p_{\text{use}} \cdot C_{\text{save/restore}}$$

$$C_{\text{caller-saved}} = 2 \cdot p_{\text{live}} \cdot C_{\text{save/restore}}$$

Making $r$ callee-saved is better when $p_{\text{use}} < p_{\text{live}}$, i.e., when the register is used less often than it is live across calls.

### 5.3 Impact on Register Allocation

The register allocator must model calling conventions:
- At each call site, all caller-saved registers interfere with values live across the call.
- Callee-saved registers used by the function must be saved in the prologue and restored in the epilogue.
- The allocator can reduce callee-save overhead by preferring caller-saved registers for short-lived values and callee-saved registers for values live across calls.

---

## 6. Closures and Static Links

### 6.1 The Problem of Free Variables

In languages with nested functions or first-class functions, an inner function may reference variables from enclosing scopes:

```
function outer(x):
    function inner(y):
        return x + y     // x is a free variable of inner
    return inner
```

When `inner` is called after `outer` has returned, how does it access `x`?

### 6.2 Closures

A *closure* is a pair $(\text{code}, \text{env})$ where:
- $\text{code}$ is a pointer to the function's machine code.
- $\text{env}$ is a pointer to (or copy of) the environment containing the free variables.

**Flat closures.** The environment is a record containing copies of all free variables:

```
Closure for inner:
+-------------------+
| code: &inner_code |
| env:              |
|   x: <value of x> |
+-------------------+
```

**Linked closures.** The environment contains a pointer to the enclosing activation record (or chain of records):

```
Closure for inner:
+-------------------+
| code: &inner_code |
| env: -> outer's   |
|        frame      |
+-------------------+
```

### 6.3 Static Links

A *static link* is a pointer in each activation record to the activation record of the lexically enclosing function. To access a variable $k$ levels up:

```
access(var at depth k):
    let frame = current_frame.static_link
    repeat (k - 1) times:
        frame = frame.static_link
    return frame[var.offset]
```

**Cost.** Accessing a variable at depth $k$ requires $k$ pointer dereferences: $O(k)$.

### 6.4 Displays

A *display* is a global array $D[0..d]$ where $D[i]$ points to the most recent activation record at nesting depth $i$. Accessing a variable at any depth requires exactly one indexed load: $O(1)$.

```
// On entry to function at depth i:
save D[i]
D[i] = current_frame

// On exit:
restore D[i]
```

**Tradeoff.** Displays require $O(1)$ access but $O(1)$ overhead per call/return at each nesting level. Static links require $O(k)$ access but no global state.

### 6.5 Lambda Lifting

An alternative to closures: *lambda lifting* transforms free variables into explicit parameters:

```
// Before lifting:
function outer(x):
    function inner(y): return x + y

// After lifting:
function inner(x, y): return x + y
function outer(x): ... inner(x, ...) ...
```

This eliminates the need for closures but changes the function's signature and may increase parameter-passing overhead.

---

## 7. Exception Handling

### 7.1 setjmp/longjmp

The simplest mechanism: `setjmp` saves the execution state (registers, stack pointer, program counter) into a `jmp_buf`, and `longjmp` restores it.

```c
jmp_buf buf;
if (setjmp(buf) == 0) {
    // normal path
    risky_operation();
} else {
    // exception path (reached via longjmp)
}

void risky_operation() {
    if (error) longjmp(buf, 1);
}
```

**Costs:**
- `setjmp`: saves ~20 registers, $O(1)$ cost per try block.
- `longjmp`: restores state, $O(1)$ cost per throw.
- **Problem**: every `try` block pays the `setjmp` cost even if no exception occurs. In C++ programs where exceptions are rare, this overhead is unacceptable.

### 7.2 Table-Based (Zero-Cost) Exception Handling

Modern C++ compilers use *table-based* exception handling, which has zero overhead on the non-exceptional path.

**Key idea.** The compiler generates static tables mapping program counter ranges to exception-handling actions. No runtime code executes at `try` boundaries.

**Components:**
1. **Unwind tables**: for each function, map PC ranges to stack frame layout (how to restore callee-saved registers, find the return address, etc.).
2. **Language-specific data area (LSDA)**: maps PC ranges to catch clauses, cleanup actions, and exception type filters.
3. **Personality function**: called by the unwinder to determine whether a frame can handle the exception.

**Exception dispatch (two-phase):**

```
Phase 1: Search
  Starting from the throwing frame, walk up the call stack:
    For each frame:
      Consult the LSDA to find matching catch clauses
      If found: record the handler location, proceed to Phase 2
  If no handler found: call terminate()

Phase 2: Cleanup and Unwind
  Starting from the throwing frame again:
    For each frame up to the handler:
      Execute cleanup actions (destructors)
      Restore callee-saved registers using unwind tables
      Pop the frame
    Transfer control to the handler
```

**Cost analysis:**
- Normal execution: *zero* additional instructions.
- Exception throw: $O(d)$ where $d$ is the number of stack frames to unwind. Each frame requires table lookups and register restoration. Typically very expensive (thousands of cycles), but exceptions are intended to be rare.

### 7.3 DWARF Unwinding

The DWARF debugging format (widely used on Unix/Linux) includes *Call Frame Information (CFI)* that describes how to restore the previous frame at each instruction address.

**DWARF CFI encodes rules as a virtual machine program:**

```
DW_CFA_def_cfa:        RSP + 8     // CFA = RSP + 8 at function entry
DW_CFA_offset:         RBP, -16    // RBP saved at CFA - 16
DW_CFA_advance_loc:    4           // advance PC by 4 bytes
DW_CFA_def_cfa_reg:    RBP         // after PUSH RBP; MOV RBP, RSP
```

The DWARF unwinder interprets these programs to reconstruct the call stack. This enables:
- Exception handling (as described above).
- Stack traces for debugging (`backtrace()`).
- Profiling (sampling-based profilers walk the stack).

### 7.4 Structured Exception Handling (Windows SEH)

Windows uses a different mechanism:
- Each function has an *exception handler* registered in a table (`.pdata` section).
- The handler receives the exception record and decides to handle, continue searching, or execute cleanup.
- Unwind information is stored in `.xdata` sections.

---

## 8. Coroutines and Continuations at the Machine Level

### 8.1 Coroutines

A *coroutine* is a generalization of a subroutine that can suspend execution and be resumed later. Unlike threads, coroutines are cooperatively scheduled.

**Machine-level implementation:**

Each coroutine needs:
1. Its own stack (or stack segment).
2. A saved execution context (registers, PC, stack pointer).

**Context switch:**

```
coroutine_switch(from, to):
    // Save current state
    push callee-saved registers onto from.stack
    from.sp = RSP
    from.pc = <return address>

    // Restore target state
    RSP = to.sp
    pop callee-saved registers from to.stack
    jump to.pc
```

This is essentially `setjmp`/`longjmp` between two stacks.

### 8.2 Stackful vs Stackless Coroutines

**Stackful coroutines** (e.g., Lua, Go goroutines):
- Each coroutine has a complete stack.
- Can suspend from any depth in the call chain.
- Stack may be heap-allocated and growable (Go uses segmented or copying stacks).

**Stackless coroutines** (e.g., C++20 coroutines, Rust async):
- The compiler transforms the coroutine into a state machine.
- Suspend points become states; local variables become fields in a struct.
- No separate stack needed; the coroutine frame is a heap-allocated object.

**State machine transformation:**

```
// Source:
async fn example() {
    let a = compute1();
    yield;
    let b = compute2(a);
    yield;
    return a + b;
}

// Transformed:
struct ExampleCoroutine {
    state: int,
    a: int,
    b: int,
}

fn resume(self: &mut ExampleCoroutine) -> CoroutineResult {
    match self.state {
        0 => { self.a = compute1(); self.state = 1; return Yielded; }
        1 => { self.b = compute2(self.a); self.state = 2; return Yielded; }
        2 => { self.state = 3; return Done(self.a + self.b); }
    }
}
```

### 8.3 Continuations

A *continuation* captures the "rest of the computation" at a given point. First-class continuations (as in Scheme's `call/cc`) require capturing the entire stack.

**Implementation strategies:**
1. **Stack copying**: copy the entire stack when capturing a continuation, restore it when invoking. Simple but expensive: $O(n)$ per capture where $n$ is the stack size.
2. **Heap-allocated frames**: allocate every activation record on the heap. Capturing a continuation is just saving a pointer. This is the approach used in some functional language implementations (e.g., SML/NJ).
3. **Segmented stacks with copy-on-write**: amortize the cost of continuation capture using virtual memory tricks.

**Cost comparison:**

| Strategy | Capture Cost | Invoke Cost | Normal Call Overhead |
|----------|-------------|-------------|---------------------|
| Stack copying | $O(n)$ | $O(n)$ | None |
| Heap frames | $O(1)$ | $O(1)$ | Significant (every call allocates) |
| Segmented + COW | Amortized $O(1)$ | $O(1)$ | Moderate |

### 8.4 Delimited Continuations

*Delimited continuations* capture only a *portion* of the stack (up to a delimiter/prompt), avoiding the cost of full stack capture. They are strictly more expressive than `call/cc` and easier to implement efficiently.

```
reset {
    // ... code ...
    shift(k => {
        // k is a continuation capturing the stack up to the enclosing reset
        k(42)  // invoke the continuation with value 42
    })
    // ... more code ...
}
```

---

## 9. Tail Call Optimization

### 9.1 Definition

A *tail call* is a function call that is the last action in a function. In tail position, the caller's frame is no longer needed, so it can be reused.

```
function factorial(n, acc):
    if n == 0: return acc
    return factorial(n - 1, n * acc)   // tail call
```

### 9.2 Implementation

```nasm
; Without TCO:
factorial:
    ...
    call factorial     ; pushes return address, allocates new frame
    ret

; With TCO:
factorial:
    ...
    ; Overwrite current frame's arguments with new arguments
    mov rdi, new_n
    mov rsi, new_acc
    jmp factorial      ; reuse current frame
```

### 9.3 Requirements

TCO requires:
1. The call is in tail position (nothing happens after the call returns).
2. The callee's frame is no larger than the caller's (or can be made to fit).
3. Callee-saved registers have been restored.
4. The calling convention supports it (some conventions make TCO difficult due to shadow space or argument cleanup requirements).

**Theorem 9.1.** Tail call optimization transforms $O(n)$ stack space recursive functions into $O(1)$ stack space iterative loops.

---

## 10. Summary

Calling conventions are the glue that enables interoperability between separately compiled modules, languages, and even different compilers. The choices made---register vs stack arguments, callee vs caller saving, frame pointer presence---ripple through the entire code generation pipeline. Advanced runtime features---closures, exceptions, coroutines---build on the same stack machinery but require increasingly sophisticated compiler support and metadata.

---

## References

1. System V Application Binary Interface, AMD64 Architecture Processor Supplement. Available at https://gitlab.com/x86-psABIs/x86-64-ABI.
2. Microsoft x64 Calling Convention. Microsoft Docs.
3. DWARF Debugging Information Format, Version 5. DWARF Standards Committee.
4. Appel, A. W. (2004). *Modern Compiler Implementation in ML*. Cambridge University Press. Chapter 6.
5. Muchnick, S. S. (1997). *Advanced Compiler Design and Implementation*. Morgan Kaufmann. Chapter 5.
6. Leroy, X. (1990). "The ZINC Experiment: An Economical Implementation of the ML Language." Technical Report 117, INRIA.
7. Ierusalimschy, R., de Figueiredo, L. H., & Celes, W. (2005). "The Implementation of Lua 5.0." *Journal of Universal Computer Science*, 11(7).
8. Moura, A. L., & Ierusalimschy, R. (2009). "Revisiting Coroutines." *ACM TOPLAS*, 31(2).
