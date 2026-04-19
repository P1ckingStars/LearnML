# Lecture 08d: Runtime Systems

## 1. Introduction

A runtime system is the collection of software components that support program execution beyond what the processor hardware provides directly. It includes object layout and representation, dynamic dispatch mechanisms, memory management (GC, allocators), concurrency support (threads, scheduling), and interfaces to external code (FFI). The design of the runtime system profoundly affects both the performance and the expressiveness of a programming language.

This lecture surveys the key runtime system components that a compiler must understand and target.

---

## 2. Object Layout

### 2.1 Basic Object Representation

An object in memory consists of:
- **Header**: metadata (type information, GC mark bits, hash code, lock state).
- **Fields**: the object's data, laid out according to alignment rules.

```
Typical object layout (Java-like):
+------------------+
| Header (8-16 B)  |  Mark word + class pointer
+------------------+
| Field 1          |
| Field 2          |
| ...              |
| Field n          |
+------------------+
| Padding          |  (for alignment)
+------------------+
```

### 2.2 Header Design Tradeoffs

**Minimal header (C struct):** No header; type is known statically. Zero overhead but no dynamic dispatch or GC support.

**Single-word header (compact):** Pack type tag, GC bits, and other metadata into one machine word using bit fields.

```
64-bit header word:
[  GC bits (2) | Lock bits (2) | Hash (25) | Type pointer (35)  ]
```

**Two-word header (Java HotSpot):**
- Word 1 (*mark word*): GC age, lock state, identity hash code, forwarding pointer (overloaded based on object state).
- Word 2 (*class pointer*): pointer to the class metadata (vtable, field layout).

With compressed oops (ordinary object pointers), the class pointer uses 32 bits, saving 4 bytes per object.

### 2.3 Field Layout and Alignment

Fields are ordered to minimize padding while respecting alignment constraints:

```
struct Example {
    char a;      // 1 byte
    // 7 bytes padding (to align double)
    double b;    // 8 bytes
    int c;       // 4 bytes
    // 4 bytes padding (to align struct to 8 bytes)
};
// Total: 24 bytes

// Reordered:
struct Example_opt {
    double b;    // 8 bytes
    int c;       // 4 bytes
    char a;      // 1 byte
    // 3 bytes padding
};
// Total: 16 bytes (33% savings)
```

The compiler (or runtime) should reorder fields to minimize padding. Java HotSpot reorders fields within each alignment class (longs/doubles first, then ints/floats, then shorts/chars, then bytes).

### 2.4 Tagged Unions (Sum Types)

Languages with algebraic data types (ML, Haskell, Rust) represent sum types as tagged unions:

```
// Rust enum
enum Shape {
    Circle(f64),          // tag 0, payload: radius
    Rectangle(f64, f64),  // tag 1, payload: width, height
    Point,                // tag 2, no payload
}

// Memory layout:
+-------+----------+----------+
| Tag   | Payload 1 | Payload 2|
| (u8)  | (f64)    | (f64)    |
+-------+----------+----------+
// Size = max(payload sizes) + tag + padding
```

**Niche optimization (Rust):** for `Option<&T>`, the null pointer is used as the `None` tag, making `Option<&T>` the same size as `&T` (8 bytes instead of 16).

### 2.5 Fat Pointers

Some pointers carry extra metadata:

- **Slice pointers** (`&[T]`): pointer + length.
- **Trait object pointers** (`&dyn Trait`): pointer to data + pointer to vtable.
- **Go interface values**: type descriptor + data pointer.

```
Fat pointer layout (&[T]):
+------------------+------------------+
| Data pointer (8B)| Length (8B)      |
+------------------+------------------+

Trait object (&dyn Trait):
+------------------+------------------+
| Data pointer (8B)| VTable ptr (8B)  |
+------------------+------------------+
```

---

## 3. Virtual Tables and Dynamic Dispatch

### 3.1 The VTable

A *vtable* (virtual method table) is a per-class array of function pointers implementing dynamic dispatch for virtual methods.

```
class Animal {
    virtual void speak();
    virtual void move();
};

class Dog : Animal {
    void speak() override;  // Dog::speak
    void move() override;   // Dog::move
    void fetch();            // non-virtual
};

VTable for Dog:
+-------------------+
| speak -> Dog::speak|
| move  -> Dog::move |
+-------------------+
```

### 3.2 Dispatch Mechanism

```
// Source: animal->speak()
// Compiled to (pseudo-assembly):

mov rax, [animal]           // load object pointer
mov rbx, [rax + VTABLE_OFF] // load vtable pointer from header
mov rcx, [rbx + SPEAK_OFF]  // load speak() function pointer from vtable
call rcx                     // indirect call
```

**Cost:** 2 dependent memory loads (object -> vtable -> function pointer) + indirect branch. On modern CPUs:
- Memory loads: potentially cache misses (~4 cycles L1, ~12 cycles L2, ~40+ cycles L3).
- Indirect branch: branch predictor often predicts correctly (monomorphic call sites), but mispredictions cost ~15--20 cycles.

### 3.3 Interface Dispatch

Languages with interfaces (Java) or traits (Rust) face a more complex dispatch problem: an object may implement many interfaces, and the method offset differs across interfaces.

**Java interface dispatch approaches:**
1. **Interface method table (itable)**: each class has a list of (interface, offset_table) pairs. Dispatch searches the list for the matching interface. Complexity: $O(k)$ where $k$ is the number of implemented interfaces.
2. **Inline caching**: at each call site, cache the most recently seen class and its method. Monomorphic sites hit the cache; polymorphic sites fall back to search.
3. **Hash-based dispatch**: hash the interface method ID to an itable entry. $O(1)$ expected time.

### 3.4 Devirtualization

The compiler can resolve virtual calls statically when the concrete type is known:

- **Class hierarchy analysis**: if only one class in the hierarchy overrides a method, the call can be devirtualized.
- **Type inference**: flow-sensitive type analysis may determine the exact runtime type.
- **Profile-guided devirtualization**: if profiling shows a call site is monomorphic (always the same type), insert a guarded direct call:

```
if (obj.getClass() == Dog.class) {
    Dog::speak(obj);      // direct call (fast)
} else {
    obj.speak();           // virtual dispatch (slow, rare)
}
```

---

## 4. Reflection and Runtime Type Information (RTTI)

### 4.1 RTTI

RTTI allows runtime queries about object types:
- `instanceof` / `is` (Java, C#): check if an object is an instance of a class.
- `dynamic_cast` (C++): safe downcast.
- `typeid` (C++): get type information.

**Implementation:** each object's header contains a pointer to type metadata. Type checks traverse the class hierarchy or consult precomputed tables.

**Display encoding (Cohen, 1991):** each class stores an array of its ancestors at fixed depth offsets. `instanceof` checks: $\text{obj.display}[d] == \text{target\_class}$ where $d$ is the target class's depth. $O(1)$ time.

### 4.2 Reflection

Full reflection (Java, C#, Python) allows:
- Enumerating fields and methods at runtime.
- Invoking methods by name.
- Creating objects dynamically.

**Runtime cost:** reflection bypasses static type checking and vtable dispatch, using metadata lookups and dynamic invocation. Typically 10--100x slower than direct calls.

**Compiler implications:** reflection can invoke arbitrary code on arbitrary objects, limiting static analysis. The compiler must assume that reflectively accessible classes, methods, and fields cannot be removed or devirtualized without special analysis.

---

## 5. Green Threads and Lightweight Concurrency

### 5.1 OS Threads vs Green Threads

**OS threads**: managed by the operating system. Context switch involves kernel mode transition (~1--10 microseconds). Stack size typically 1--8 MB.

**Green threads** (user-level threads): managed by the language runtime. Context switch is a function call (~100 nanoseconds). Stack size can be much smaller (2--8 KB initially).

### 5.2 Implementation Approaches

**Stackful green threads (Go goroutines, Erlang processes):**
- Each green thread has its own stack, allocated on the heap.
- The runtime scheduler multiplexes green threads onto OS threads (M:N model).
- Stack growth: initially small, grown dynamically (Go uses copying stacks; earlier versions used segmented stacks).

```
Go's goroutine stack management:
1. Initial stack: 2 KB (or 8 KB)
2. On function entry, check if stack space is sufficient:
     if SP < stack_guard:
         runtime.morestack()  // allocate larger stack, copy contents
3. This enables millions of goroutines per process.
```

**Stackless green threads (Rust async, Python asyncio):**
- No separate stack; each "task" is a state machine (coroutine frame) allocated on the heap.
- Suspend points are explicitly marked (`await` in Rust/Python).
- The executor polls tasks when they are ready.

### 5.3 Scheduling

**Work-stealing scheduler (Blumofe & Leiserson, 1999):**
- Each OS thread has a local deque (double-ended queue) of ready green threads.
- When a thread runs out of work, it *steals* from another thread's deque.
- Provably $O(T_1 / P + T_\infty)$ expected time on $P$ processors, where $T_1$ is the total work and $T_\infty$ is the critical path length.

**Preemption:**
- Go 1.14+: asynchronous preemption via signals (SIGURG). The runtime can preempt goroutines at essentially any point, preventing long-running goroutines from starving others.
- Earlier Go: cooperative preemption at function calls only (the stack growth check doubles as a preemption point).

### 5.4 Runtime Support Requirements

Green threads require runtime support for:
1. **Stack management**: allocation, growth, and deallocation of per-thread stacks.
2. **Scheduler**: ready queue, work stealing, preemption.
3. **I/O integration**: non-blocking I/O (epoll/kqueue) with the scheduler waking threads when I/O completes.
4. **Synchronization primitives**: channels, mutexes, semaphores implemented atop the runtime scheduler.

---

## 6. Foreign Function Interfaces (FFI)

### 6.1 The Problem

Programs often need to call code written in other languages, especially C libraries. The FFI bridges the gap between different languages' runtime models: calling conventions, memory management, type representations, and error handling.

### 6.2 Key Challenges

1. **Calling convention mismatch**: the host language's calling convention may differ from C's (e.g., GC-managed stack vs raw stack).
2. **Type representation**: strings, arrays, and structs may have different layouts. Marshalling/unmarshalling is needed.
3. **Memory management**: who owns the memory? If a C function returns a pointer, is the caller or callee responsible for freeing it?
4. **GC interaction**: the GC must not move or collect objects that are referenced by foreign code.

### 6.3 Common FFI Patterns

**Pinning (Rust, .NET):** prevent the GC from moving an object while foreign code holds a reference.

```rust
// Rust FFI example:
extern "C" {
    fn c_process(data: *const u8, len: usize) -> i32;
}

fn call_c(data: &[u8]) -> i32 {
    unsafe { c_process(data.as_ptr(), data.len()) }
}
```

**JNI (Java Native Interface):**

```c
// C side of JNI:
JNIEXPORT jint JNICALL Java_MyClass_add(JNIEnv *env, jobject obj,
                                         jint a, jint b) {
    return a + b;
}
```

JNI requires explicit management of local and global references to Java objects from C code, to prevent GC collection of referenced objects.

**ctypes / cffi (Python):**

```python
import ctypes
lib = ctypes.CDLL("libm.so.6")
lib.sqrt.restype = ctypes.c_double
lib.sqrt.argtypes = [ctypes.c_double]
result = lib.sqrt(2.0)
```

### 6.4 Performance Overhead

FFI calls typically cost 10--100x more than native function calls due to:
- Marshalling/unmarshalling arguments.
- Transition between managed and unmanaged stack frames.
- GC safepoint insertion (for GC'd languages).
- Thread state transitions.

Go's cgo overhead is particularly notable (~200 ns per call) due to the need to switch from a goroutine stack to a C-compatible stack.

---

## 7. JIT Compilation Runtime Support

### 7.1 Overview

Just-in-time (JIT) compilers generate machine code at runtime, requiring runtime support infrastructure:

1. **Code cache**: executable memory for JIT-compiled code. Allocated via `mmap` with `PROT_EXEC` (on Unix) or `VirtualAlloc` with `PAGE_EXECUTE_READWRITE` (on Windows).
2. **Profiling instrumentation**: counters, edge profiles, and type profiles to guide optimization decisions.
3. **Deoptimization (on-stack replacement)**: revert from optimized code to interpreted/baseline code when speculative optimizations fail.

### 7.2 Tiered Compilation

Modern JIT compilers use multiple tiers:

| Tier | Speed | Code Quality | When Used |
|------|-------|-------------|-----------|
| Interpreter | Fastest startup | Lowest | First execution |
| Baseline JIT (C1) | Fast compile | Medium | After ~100 invocations |
| Optimizing JIT (C2) | Slow compile | Highest | After ~10,000 invocations |

**HotSpot (Java):** C1 compiler for quick baseline, C2 (or Graal) for aggressive optimization.

**V8 (JavaScript):** Sparkplug (baseline), Maglev (mid-tier), TurboFan (optimizing).

### 7.3 On-Stack Replacement (OSR)

OSR allows the runtime to switch from interpreter to JIT-compiled code (or vice versa) *in the middle of a function execution*, typically at loop back-edges.

**Forward OSR (interpreter to JIT):**
1. A loop's iteration count exceeds a threshold.
2. The JIT compiles the function.
3. The runtime creates a JIT stack frame matching the current interpreter state.
4. Execution continues in JIT-compiled code.

**Backward OSR (JIT to interpreter, deoptimization):**
1. An optimistic assumption fails (e.g., a speculative type check fails).
2. The runtime reconstructs the interpreter state from the JIT frame using debug metadata.
3. Execution continues in the interpreter.

### 7.4 Speculative Optimization

JIT compilers optimize based on observed runtime behavior:
- **Type specialization**: if `x` has always been an integer, compile the code assuming `x` is an integer. Insert a *guard* that deoptimizes if the assumption is violated.
- **Inline caching**: cache the resolved method for virtual calls.
- **Range check elimination**: if array indices are proven in-bounds by loop analysis, remove bounds checks.

```
// Speculative optimization with guard:
guard(x instanceof Integer)   // deoptimize if false
int_value = unbox(x)          // fast path: unboxed integer operations
result = int_value + 1
```

---

## 8. Summary

| Component | Key Design Decision | Impact |
|-----------|-------------------|--------|
| Object layout | Header size, field ordering | Memory density, cache behavior |
| Dynamic dispatch | VTable, interface tables, inline caches | Call overhead, devirtualization opportunities |
| RTTI/Reflection | Display encoding, metadata tables | Type check cost, analysis difficulty |
| Green threads | Stackful vs stackless, scheduler design | Concurrency scalability, overhead |
| FFI | Marshalling strategy, pinning | Interoperability, performance |
| JIT support | Tiered compilation, OSR, deopt | Startup time vs peak performance |

The runtime system is where the abstract semantics of a programming language meet the concrete reality of hardware. Every decision---from object header layout to GC write barriers to thread scheduling---ripples through the entire system's performance profile. Understanding these interactions is essential for compiler writers and language designers.

---

## References

1. Goldberg, A., & Robson, D. (1983). *Smalltalk-80: The Language and Its Implementation*. Addison-Wesley.
2. Ierusalimschy, R., de Figueiredo, L. H., & Celes, W. (2005). "The Implementation of Lua 5.0." *Journal of Universal Computer Science*, 11(7), 1159--1176.
3. Click, C., & Rose, J. (2002). "Fast Subtype Checking in the HotSpot JVM." *JGI Workshop*, 96--107.
4. Blumofe, R. D., & Leiserson, C. E. (1999). "Scheduling Multithreaded Computations by Work Stealing." *Journal of the ACM*, 46(5), 720--748.
5. Holzle, U., Chambers, C., & Ungar, D. (1991). "Optimizing Dynamically-Typed Object-Oriented Languages With Polymorphic Inline Caches." *ECOOP*, 21--38.
6. Wurthinger, T., et al. (2017). "Practical Partial Evaluation for High-Performance Dynamic Language Runtimes." *PLDI*, 662--676.
7. Appel, A. W. (2004). *Modern Compiler Implementation in ML*. Cambridge University Press. Chapter 14.
8. Jones, R., Hosking, A., & Moss, E. (2011). *The Garbage Collection Handbook*. CRC Press.
