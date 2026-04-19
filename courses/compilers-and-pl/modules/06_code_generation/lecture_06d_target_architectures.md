# Lecture 06d: Target Architectures

## 1. Introduction

A compiler's code generator must intimately understand its target architecture: the instruction set, register file organization, addressing modes, memory model, and performance characteristics. This lecture surveys the major compilation targets encountered in modern practice, emphasizing the features that most impact code generation decisions.

The architectures covered span the spectrum from the complex (x86-64) to the clean (RISC-V), from the conventional (ARM64) to the unconventional (WebAssembly, GPU targets). Each presents unique challenges and opportunities for the compiler writer.

---

## 2. x86-64 Architecture and Instruction Set Essentials

### 2.1 Historical Context

The x86 architecture traces from the Intel 8086 (1978) through the 80386 (32-bit, 1985) to AMD's x86-64 extension (2003). It is a CISC architecture carrying decades of backward compatibility, resulting in a large and irregular instruction set.

### 2.2 Register File

| Register | Purpose (convention) | Callee-saved (System V) |
|----------|---------------------|------------------------|
| `RAX` | Return value, accumulator | No |
| `RBX` | General purpose | Yes |
| `RCX` | 4th argument (Windows), counter | No |
| `RDX` | 3rd argument, high multiply result | No |
| `RSI` | 2nd argument, source index | No |
| `RSP` | Stack pointer | Yes (by convention) |
| `RBP` | Frame pointer | Yes |
| `RDI` | 1st argument, destination index | No |
| `R8`--`R11` | Arguments 5--6, temporaries | No |
| `R12`--`R15` | General purpose | Yes |
| `XMM0`--`XMM15` | SSE/AVX floating point and SIMD | No (System V) |

Total: 16 GPRs, 16 (or 32 with AVX-512) SIMD registers.

### 2.3 Addressing Modes

x86-64 supports complex addressing:

$$\text{effective address} = \text{base} + \text{index} \times \text{scale} + \text{displacement}$$

where $\text{base}$ and $\text{index}$ are registers, $\text{scale} \in \{1, 2, 4, 8\}$, and $\text{displacement}$ is a 8/32-bit immediate.

This enables a single instruction to compute array element addresses:

```nasm
; a[i] where a is at RBX, i in RCX, element size 8
mov rax, [rbx + rcx*8]        ; base + index*scale
mov rax, [rbx + rcx*8 + 16]   ; base + index*scale + displacement
```

**Impact on instruction selection:** The rich addressing modes mean the instruction selector can fold multiple IR operations (add, shift/multiply, load) into a single instruction. CISC-aware instruction selection (BURG, DP) is particularly valuable here.

### 2.4 Key Features for Code Generation

- **Two-address form**: most ALU instructions are of the form `op dst, src` where `dst` is both source and destination. This requires the register allocator to insert copies or use `LEA` for non-destructive operations.
- **Variable-length instructions**: 1--15 bytes. Code size is harder to predict.
- **Condition codes (RFLAGS)**: many instructions set flags implicitly. The compiler must model flag liveness.
- **SIMD extensions**: SSE, AVX, AVX-512 provide 128/256/512-bit vector operations.
- **RIP-relative addressing**: position-independent code uses `[RIP + offset]` for global data.

### 2.5 Instruction Encoding Considerations

The x86-64 instruction encoding uses legacy prefixes, REX/VEX/EVEX prefixes, opcodes, ModR/M, SIB, and immediate bytes. Instructions using `R8`--`R15` or `XMM8`--`XMM15` require REX prefixes (1 extra byte), which can affect code size.

Some compilers prefer registers `RAX`--`RDI` for frequently-used values to avoid REX prefix overhead.

---

## 3. ARM64/AArch64 Overview

### 3.1 Architecture

ARM's AArch64 (introduced with ARMv8-A, 2011) is a clean 64-bit RISC design, a departure from the 32-bit ARM's conditional execution and barrel shifter complexity.

### 3.2 Register File

- **31 GPRs**: `X0`--`X30` (64-bit) or `W0`--`W30` (32-bit view). `X31` is the zero register (`XZR`) or stack pointer (`SP`) depending on context.
- **32 SIMD/FP registers**: `V0`--`V31` (128-bit), accessible as `D` (64-bit), `S` (32-bit), `H` (16-bit), `B` (8-bit).
- **`LR` (X30)**: link register (return address).
- **`FP` (X29)**: frame pointer (by convention).

### 3.3 Instruction Set Characteristics

- **Fixed 32-bit instruction encoding**: simplifies decoding and instruction cache behavior.
- **Load/store architecture**: only `LDR`/`STR` access memory; ALU operations work on registers only.
- **No condition codes on most instructions**: instead, conditional select (`CSEL`), conditional compare (`CCMP`), and conditional branch (`B.cond`) are used.
- **Shifted/extended register operands**: ALU instructions can incorporate a shift or extension of one operand:

```
ADD X0, X1, X2, LSL #3    // X0 = X1 + (X2 << 3)
ADD X0, X1, W2, SXTW      // X0 = X1 + sign_extend(W2)
```

- **PC-relative addressing**: `ADRP` + `ADD` for 4KB-granularity addressing within $\pm 4$ GB.
- **Compare and branch**: `CBZ`/`CBNZ`, `TBZ`/`TBNZ` fuse comparison and branch.

### 3.4 Impact on Code Generation

- The large register file (31 GPRs) reduces register pressure significantly compared to x86-64's 16.
- Fixed-width instructions simplify instruction scheduling and branch offset computation.
- The load/store nature separates memory operations from computation, aligning well with RISC-oriented instruction selectors (maximal munch is often sufficient).
- Shifted register operands enable folding of shifts into arithmetic, similar to x86's addressing modes but for computation.

---

## 4. RISC-V: The Open ISA

### 4.1 Overview

RISC-V is an open-source ISA originating from UC Berkeley (Waterman et al., 2011). It is modular: a small base integer ISA (RV32I/RV64I) plus standard extensions.

### 4.2 Base Integer ISA (RV64I)

- **32 GPRs**: `x0`--`x31`. `x0` is hardwired to zero.
- **32-bit fixed-width instructions** (base). Compressed extension (C) adds 16-bit instructions.
- **Load/store architecture** with simple addressing: `base + 12-bit-immediate`.
- **No condition codes**: branches compare two registers directly (`BEQ`, `BLT`, `BGE`, etc.).
- **No delayed branches or load delays**: clean pipeline semantics.

### 4.3 Standard Extensions

| Extension | Description |
|-----------|-------------|
| M | Integer multiply/divide |
| A | Atomic instructions (LR/SC, AMO) |
| F | Single-precision floating point (32 FP registers) |
| D | Double-precision floating point |
| C | Compressed (16-bit) instructions |
| V | Vector extension (scalable SIMD) |
| B | Bit manipulation |

The common combination RV64GC = RV64IMAFDC is the standard for general-purpose Linux systems.

### 4.4 Impact on Code Generation

- **Simplicity**: the small, orthogonal ISA means fewer instruction selection patterns, faster compile times.
- **No complex addressing modes**: every memory access is `load/store base+offset`, so the compiler must generate explicit address arithmetic. This simplifies instruction selection but may produce more instructions than x86.
- **Immediates**: 12-bit immediates for most instructions, 20-bit for `LUI`/`AUIPC`. Loading a 64-bit constant requires multiple instructions:

```
lui   rd, upper_20_bits
addi  rd, rd, lower_12_bits
// For 64-bit: additional shifts and adds
```

- **Vector extension**: uses a scalable vector model (vector length agnostic), requiring the compiler to generate loops that adapt to the hardware vector length at runtime.

### 4.5 Compiler Support

RISC-V is well-supported by GCC and LLVM. The clean ISA has made it a popular target for teaching compilers and for compiler research.

---

## 5. WebAssembly as a Compilation Target

### 5.1 Overview

WebAssembly (Wasm) is a portable binary instruction format designed as a compilation target for the web. It is a *stack machine* with structured control flow, fundamentally different from register-based ISAs.

### 5.2 Execution Model

- **Stack-based**: instructions push and pop values from an implicit operand stack.
- **Typed**: four value types: `i32`, `i64`, `f32`, `f64` (plus `v128` for SIMD).
- **Structured control flow**: no arbitrary `goto`; control flow uses `block`, `loop`, `if/else`, `br` (branch to enclosing block).
- **Linear memory**: a single flat byte array accessed by `load`/`store` with offset.
- **No registers exposed**: the "registers" are *locals* (typed local variables).

### 5.3 Example

```wasm
;; int add(int a, int b) { return a + b; }
(func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add)
```

### 5.4 Challenges for Code Generation

1. **No register allocation needed**: the Wasm engine handles register allocation. The compiler targets the abstract stack machine.
2. **Structured control flow recovery**: if the source IR uses arbitrary CFGs (with irreducible control flow), the compiler must *reloop*---convert the CFG back to structured control flow. Algorithms include the Relooper (Zakai, 2011) and Stackifier approaches.

**The Relooper Algorithm (simplified):**

```
Algorithm: Relooper(CFG)
Input: Control flow graph with labeled blocks
Output: Structured Wasm control flow

1. If there is a single entry with a single block: emit it
2. If there is a single entry that dominates all blocks:
   Emit the entry block
   Recursively Reloop the successors
3. If there is a loop (back edge to current entry):
   Emit loop { ... }
   Place the loop body inside, continue after
4. Otherwise (multiple entries, irreducible):
   Introduce a dispatch variable
   Emit block { block { ... br_table on dispatch } }
```

3. **No unstructured jumps**: `goto`-heavy code (e.g., from compiling C's `switch` with complex fallthrough or Duff's device) requires dispatch tables or the above relooping.

4. **Memory model**: Wasm's linear memory is byte-addressable but does not support pointer arithmetic on the stack in the traditional sense. Compiling C to Wasm requires placing the "stack" in linear memory.

### 5.5 Wasm Extensions

- **Multi-value**: functions can return multiple values.
- **Reference types**: `externref`, `funcref` for garbage-collected references.
- **GC proposal**: structured heap types, enabling direct compilation of GC'd languages.
- **Threads**: shared memory with atomic operations.
- **SIMD**: 128-bit SIMD operations.
- **Exception handling**: try/catch/throw instructions.

---

## 6. GPU Targets: PTX and SPIR-V Basics

### 6.1 GPU Execution Model

GPUs execute thousands of threads in parallel, organized hierarchically:
- **Threads**: individual execution units.
- **Warps/wavefronts**: groups of 32 (NVIDIA) or 64 (AMD) threads executing in lockstep (SIMT: Single Instruction, Multiple Threads).
- **Thread blocks/workgroups**: groups of warps sharing fast local memory.
- **Grid**: the complete set of thread blocks.

### 6.2 NVIDIA PTX

PTX (Parallel Thread Execution) is NVIDIA's virtual ISA for CUDA:

- **Register-based** with an unlimited number of typed virtual registers.
- **Typed instructions**: `add.s32`, `mul.f64`, etc.
- **Predicated execution**: most instructions can be guarded by a predicate register.
- **Memory spaces**: global, shared, local, constant, texture, each with different latency characteristics.
- **Special registers**: `%tid.x` (thread ID), `%ctaid.x` (block ID), `%nctaid.x` (grid size).

```ptx
.visible .entry vector_add(
    .param .u64 a, .param .u64 b, .param .u64 c, .param .u32 n
) {
    .reg .u32 %r<5>;
    .reg .u64 %rd<4>;
    .reg .f32 %f<3>;

    mov.u32     %r0, %tid.x;
    mov.u32     %r1, %ctaid.x;
    mov.u32     %r2, %ntid.x;
    mad.lo.u32  %r3, %r1, %r2, %r0;    // global thread index

    ld.param.u64 %rd0, [a];
    ld.param.u64 %rd1, [b];
    ld.param.u64 %rd2, [c];

    cvt.u64.u32 %rd3, %r3;
    shl.b64     %rd3, %rd3, 2;          // * sizeof(float)

    add.u64     %rd0, %rd0, %rd3;
    add.u64     %rd1, %rd1, %rd3;
    add.u64     %rd2, %rd2, %rd3;

    ld.global.f32 %f0, [%rd0];
    ld.global.f32 %f1, [%rd1];
    add.f32       %f2, %f0, %f1;
    st.global.f32 [%rd2], %f2;

    ret;
}
```

PTX is further compiled to SASS (the actual hardware ISA) by NVIDIA's `ptxas` compiler. PTX serves a role analogous to LLVM IR: a stable, machine-independent representation that abstracts over GPU microarchitecture generations.

### 6.3 SPIR-V

SPIR-V is the standard intermediate representation for Vulkan shaders and OpenCL kernels:

- **SSA-based**: every value has a single definition.
- **Structured control flow**: similar to Wasm, with merge blocks and loop constructs.
- **Type-rich**: strongly typed with composite types, pointer types, image types.
- **Capability model**: modules declare required capabilities (e.g., `Shader`, `Float64`).

SPIR-V is consumed by GPU drivers, which perform their own optimization and register allocation for the specific hardware.

### 6.4 Code Generation for GPUs

Key differences from CPU code generation:

1. **Massive parallelism**: the compiler must reason about thousands of concurrent threads.
2. **Register pressure = occupancy**: more registers per thread means fewer concurrent threads (lower occupancy). The register allocator must balance register usage against parallelism.
3. **Memory hierarchy**: explicit management of shared memory, coalesced global memory access patterns.
4. **Divergence**: when threads in a warp take different branches, both paths execute (with masking). The compiler should minimize divergence.
5. **No traditional call stack**: function calls are typically inlined; recursion is limited or unsupported.

---

## 7. Cross-Compilation Considerations

### 7.1 Definition

*Cross-compilation* is compilation on a *host* machine for a different *target* machine. The host and target may differ in ISA, OS, ABI, or all three.

### 7.2 Challenges

1. **ABI differences**: struct layout, alignment, calling conventions, and type sizes may differ between host and target.
2. **Endianness**: big-endian vs little-endian affects constant encoding, memory layout.
3. **Type sizes**: `int` may be 32-bit on the target but 64-bit on the host; `long` varies between LP64 (Unix) and LLP64 (Windows).
4. **Floating-point semantics**: the host's FP behavior (rounding, NaN handling) may differ from the target's. Cross-compilation must use target-correct semantics.
5. **Standard libraries**: the cross-compiler must link against target sysroot libraries, not host libraries.

### 7.3 Compiler Architecture for Cross-Compilation

A well-designed compiler separates target-independent and target-dependent phases:

```
Source -> [Frontend] -> IR -> [Optimizer] -> IR -> [Backend] -> Target code
          (common)         (common)              (target-specific)
```

Only the backend needs to change for a new target. This is the architecture of LLVM, GCC, and most modern compilers.

### 7.4 Multi-Target Compilation in LLVM

LLVM's approach:
- **Target description files (`.td`)**: TableGen descriptions specify registers, instructions, calling conventions, and instruction selection patterns.
- **Target-independent code generation framework**: `SelectionDAG`, `GlobalISel`, register allocation, scheduling.
- **Target-specific passes**: lowering, legalization, target-specific peephole optimizations.

Adding a new LLVM backend requires:
1. Defining the register file and instruction set in TableGen.
2. Implementing `TargetLowering` (how to legalize IR operations).
3. Implementing `TargetInstrInfo`, `TargetRegisterInfo`.
4. Writing instruction selection patterns.
5. Defining the calling convention.

---

## 8. Architecture Comparison Summary

| Feature | x86-64 | ARM64 | RISC-V (RV64GC) | WebAssembly | PTX |
|---------|--------|-------|------------------|-------------|-----|
| Type | CISC | RISC | RISC | Stack machine | Virtual RISC |
| GPRs | 16 | 31 | 31 | N/A (locals) | Unlimited virtual |
| Instruction width | Variable (1--15B) | Fixed 32b | Fixed 32b (+ 16b compressed) | Variable (LEB128) | Variable |
| Addressing modes | Complex (base+idx*scale+disp) | Simple (base+offset, base+reg) | Simple (base+offset) | Linear memory offset | Multiple memory spaces |
| Condition codes | RFLAGS register | NZCV flags (limited use) | None (compare-and-branch) | None | Predicate registers |
| SIMD | SSE/AVX/AVX-512 | NEON/SVE | V extension | 128-bit SIMD | Warp-level SIMT |
| Instruction selection complexity | High | Medium | Low | Low (different kind) | Medium |

---

## 9. Practical Considerations for Compiler Writers

### 9.1 Instruction Scheduling

Out-of-order processors (x86-64, modern ARM64) can reorder instructions in hardware, reducing the compiler's scheduling burden. In-order processors (some ARM cores, older RISC-V implementations, GPU shader processors) depend on the compiler for instruction scheduling.

### 9.2 Alignment and Padding

- x86-64: function entry alignment (typically 16 bytes) improves instruction fetch. `NOP` padding is used.
- ARM64: 4-byte natural alignment. Literal pools must be reachable by PC-relative loads.
- RISC-V: 2-byte alignment with C extension, 4-byte otherwise.

### 9.3 Position-Independent Code (PIC)

Shared libraries require position-independent code:
- **x86-64**: `RIP`-relative addressing for data, PLT/GOT for external functions.
- **ARM64**: `ADRP`+`ADD` for page-relative addressing, GOT for externals.
- **RISC-V**: `AUIPC`+`ADDI` for PC-relative addressing.
- **WebAssembly**: inherently position-independent (module-relative).

### 9.4 Code Size Optimization

For embedded targets, code size matters:
- RISC-V's C extension reduces code size by 25--30% (comparable to ARM Thumb-2).
- x86-64's variable-length encoding is naturally compact for common operations.
- ARM64 lacks a compact encoding, leading to relatively large code for embedded use.
- WebAssembly modules can be compressed (gzip/brotli) for network transfer.

---

## 10. Summary

Each target architecture presents a distinct set of constraints and opportunities for the compiler backend. The x86-64's complexity rewards sophisticated instruction selection; ARM64's large register file and clean design favor straightforward code generation; RISC-V's simplicity and extensibility make it an ideal compiler research platform; WebAssembly's stack-based model and structured control flow require different code generation strategies; and GPU targets demand reasoning about massive parallelism and memory hierarchies.

A well-architected compiler, with clean separation between target-independent optimization and target-specific code generation, can support multiple backends with shared infrastructure---the approach pioneered by GCC and perfected by LLVM.

---

## References

1. Intel Corporation. *Intel 64 and IA-32 Architectures Software Developer Manuals*.
2. ARM Limited. *ARM Architecture Reference Manual, ARMv8-A*.
3. Waterman, A., & Asanovic, K. (Eds.). *The RISC-V Instruction Set Manual*. Available at https://riscv.org/specifications/.
4. Haas, A., Rossberg, A., Schuff, D. L., et al. (2017). "Bringing the Web up to Speed with WebAssembly." *PLDI*, 185--200.
5. Zakai, A. (2011). "Emscripten: An LLVM-to-JavaScript Compiler." *OOPSLA Companion*, 301--312.
6. NVIDIA Corporation. *PTX ISA Reference*. Available at https://docs.nvidia.com/cuda/parallel-thread-execution/.
7. The Khronos Group. *SPIR-V Specification*. Available at https://www.khronos.org/registry/SPIR-V/.
8. Lattner, C., & Adve, V. (2004). "LLVM: A Compilation Framework for Lifelong Program Analysis and Transformation." *CGO*, 75--88.
9. Muchnick, S. S. (1997). *Advanced Compiler Design and Implementation*. Morgan Kaufmann.
