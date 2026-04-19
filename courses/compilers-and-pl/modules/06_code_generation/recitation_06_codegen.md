# Recitation 06: Code Generation Workshop

## Overview

This recitation provides hands-on practice with the core code generation concepts from Lectures 06a--06d. You will translate IR to x86-64 assembly, perform register allocation by hand using graph coloring, design stack frame layouts, and debug generated assembly code.

**Prerequisites:** Familiarity with three-address IR, liveness analysis, x86-64 assembly basics, and the System V AMD64 ABI.

---

## Exercise 1: Translating IR to x86-64 Assembly

### 1.1 Problem

Consider the following three-address IR for a function `f(a, b, c)` that computes `a*b + a*c - b`:

```
f(a, b, c):
    t1 = a * b
    t2 = a * c
    t3 = t1 + t2
    t4 = t3 - b
    return t4
```

Under the System V AMD64 ABI, `a` is in `RDI`, `b` is in `RSI`, `c` is in `RDX`.

**Task A.** Translate each IR instruction to x86-64 assembly using a naive approach (one instruction per IR operation, using `MOV` to manage the two-address constraint).

**Task B.** Optimize the translation by exploiting `LEA`, `IMUL` with three operands, and minimizing unnecessary moves.

### 1.2 Solution Sketch

**Naive translation (Task A):**

```nasm
f:
    ; t1 = a * b
    mov rax, rdi        ; rax = a
    imul rax, rsi       ; rax = a * b  (t1 in rax)
    mov r8, rax         ; save t1 in r8

    ; t2 = a * c
    mov rax, rdi        ; rax = a
    imul rax, rdx       ; rax = a * c  (t2 in rax)

    ; t3 = t1 + t2
    add r8, rax         ; r8 = t1 + t2  (t3 in r8)

    ; t4 = t3 - b
    sub r8, rsi         ; r8 = t3 - b  (t4 in r8)

    ; return t4
    mov rax, r8
    ret
```

**Optimized translation (Task B):**

```nasm
f:
    imul r8, rdi, 1     ; (unnecessary, but shows three-operand IMUL)
    ; Better:
    mov rax, rdi
    imul rax, rsi       ; rax = a * b
    imul rdi, rdx       ; rdi = a * c  (a no longer needed)
    add rax, rdi        ; rax = a*b + a*c
    sub rax, rsi        ; rax = a*b + a*c - b
    ret                 ; result already in rax
```

**Discussion points:**
- The optimized version uses 5 instructions vs 8 in the naive version.
- We can overwrite `RDI` after the last use of `a`.
- `IMUL r64, r/m64` is the two-operand form; `IMUL r64, r/m64, imm` is three-operand but only with an immediate.

---

## Exercise 2: Register Allocation by Hand (Graph Coloring)

### 2.1 Problem

Consider the following program (in SSA-like form with explicit live ranges):

```
1: a = 1
2: b = 2
3: c = a + b
4: d = a * 3
5: e = c + d
6: b = e - 1
7: f = b + c
8: return f
```

**Task A.** Compute the liveness of each variable at each program point.

**Task B.** Construct the interference graph.

**Task C.** Color the graph with $k = 3$ registers using Chaitin's simplification algorithm. Show the simplification order and the final coloring.

### 2.2 Solution Sketch

**Liveness analysis (backward):**

| Point | Live variables (after) |
|-------|----------------------|
| 8 | {f} |
| 7 | {b, c} |
| 6 | {c, e} |
| 5 | {b, c} -- wait, b is redefined at 6 so old b is dead |

Let us be more careful. Define LiveOut at each instruction:

```
Instruction 8: return f       -> LiveIn = {f}
Instruction 7: f = b + c      -> LiveIn = {b, c}
Instruction 6: b = e - 1      -> LiveIn = {c, e}  (b killed, c still needed at 7)
Instruction 5: e = c + d      -> LiveIn = {c, d}   (e killed, c carried forward)
Instruction 4: d = a * 3      -> LiveIn = {a, c}   (d killed)
Instruction 3: c = a + b      -> LiveIn = {a, b}   (c killed)
Instruction 2: b = 2          -> LiveIn = {a}       (b killed)
Instruction 1: a = 1          -> LiveIn = {}        (a killed)
```

Live ranges:
- `a`: defined at 1, used at 3, 4. Live at {1, 2, 3, 4}.
- `b` (first): defined at 2, used at 3. Live at {2, 3}.
- `c`: defined at 3, used at 5, 7. Live at {3, 4, 5, 6, 7}.
- `d`: defined at 4, used at 5. Live at {4, 5}.
- `e`: defined at 5, used at 6. Live at {5, 6}.
- `b` (second): defined at 6, used at 7. Live at {6, 7}.
- `f`: defined at 7, used at 8. Live at {7, 8}.

**Interference graph:**

Two variables interfere if one is live at the other's definition:

| Variable | Interferes with |
|----------|----------------|
| a | b(1st) (a live when b defined at 2), c (a live when c defined at 3) |
| b(1st) | a (b live when a is still live at 3) |
| c | a (at 3-4), d (c live when d defined at 4), e (c live when e defined at 5), b(2nd) (c live when b2 defined at 6), f (c live when f defined at 7) |
| d | c (d live at 4-5, c also live) |
| e | c (e live at 5-6, c also live) |
| b(2nd) | c (at 6-7), f (b2 live when f defined) |
| f | c, b(2nd) |

Edges: {a-b1, a-c, c-d, c-e, c-b2, c-f, b2-f}

Degree: a=2, b1=1, c=5, d=1, e=1, b2=2, f=2

**Simplification with $k = 3$:**

Remove nodes with degree $< 3$: b1 (deg 1), d (deg 1), e (deg 1), a (deg 2), b2 (deg 2), f (deg 2).

Actually, after removing b1 (deg 1): push b1, a's degree drops to 1.
After removing d (deg 1): c's degree drops to 4.
After removing e (deg 1): c's degree drops to 3.
After removing a (deg 1 after b1 removed): c's degree drops to 2.
After removing f (deg 2): b2's degree drops to 1, c's degree drops to 1.
Remove b2 then c.

Stack (bottom to top): b1, d, e, a, f, b2, c.

**Select (pop and color):**

- c: no neighbors colored yet. Assign R1.
- b2: neighbor c=R1. Assign R2.
- f: neighbors c=R1, b2=R2. Assign R3.
- a: neighbor c=R1. Assign R2.
- e: neighbor c=R1. Assign R2.
- d: neighbor c=R1. Assign R2.
- b1: neighbor a=R2. Assign R1.

Final coloring: a=R2, b1=R1, c=R1, d=R2, e=R2, b2=R2, f=R3.

**Verify:** Check no two interfering variables share a color. a(R2)-b1(R1) ok; a(R2)-c(R1) ok; c(R1)-d(R2) ok; c(R1)-e(R2) ok; c(R1)-b2(R2) ok; c(R1)-f(R3) ok; b2(R2)-f(R3) ok. All good.

---

## Exercise 3: Stack Frame Layout

### 3.1 Problem

Design the stack frame layout for the following C function under the System V AMD64 ABI:

```c
long compute(long a, long b, long c, long d, long e, long f,
             long g, long h) {
    long x = a + b;
    long y = c * d;
    long arr[4];
    arr[0] = x;
    arr[1] = y;
    arr[2] = e + f;
    arr[3] = g + h;
    long result = helper(arr, 4);  // calls another function
    return result + x;
}
```

**Task A.** Identify which arguments come in registers and which on the stack.

**Task B.** Draw the stack frame layout, including callee-saved registers, local variables, and alignment.

**Task C.** Calculate the total frame size and the RSP adjustment.

### 3.2 Solution Sketch

**Argument passing:**
- `a` = `RDI`, `b` = `RSI`, `c` = `RDX`, `d` = `RCX`, `e` = `R8`, `f` = `R9`
- `g` and `h` are passed on the stack (arguments 7 and 8):
  - `g` at `[RSP + 8]` (after return address), `h` at `[RSP + 16]` upon entry

**Callee-saved registers used:** We need `x` to survive the call to `helper`, so we will use a callee-saved register (e.g., `RBX`). We also need `RBP` if using a frame pointer.

**Stack frame (with frame pointer):**

```
High addresses
+---------------------------+
| h (8th arg)        [RBP+24] |
| g (7th arg)        [RBP+16] |
| return address     [RBP+8]  |
+---------------------------+
| saved RBP          [RBP]    | <-- RBP points here
| saved RBX          [RBP-8]  |
+---------------------------+
| x (local)          [RBP-16] |
| y (local)          [RBP-24] |
| arr[0]             [RBP-32] |
| arr[1]             [RBP-40] |
| arr[2]             [RBP-48] |
| arr[3]             [RBP-56] |
| (padding for 16B alignment) |
+---------------------------+  <-- RSP (16-byte aligned)
Low addresses
```

**Frame size calculation:**
- Saved RBP: 8 bytes
- Saved RBX: 8 bytes
- Locals (x, y): 16 bytes
- arr[4]: 32 bytes
- Total: 64 bytes from RBP
- RSP = RBP - 64. Since `RBP` is 16-byte aligned (return address + saved RBP = 16 bytes), RSP is also 16-byte aligned. But we must check: before `CALL helper`, RSP must be 16-byte aligned. Subtract 8 if needed.

**Prologue/epilogue:**

```nasm
compute:
    push rbp
    mov rbp, rsp
    push rbx            ; save callee-saved register
    sub rsp, 56         ; space for locals + arr + alignment
    ; ... function body ...
    add rsp, 56
    pop rbx
    pop rbp
    ret
```

---

## Exercise 4: Debugging Generated Assembly

### 4.1 Problem

The following x86-64 assembly was generated for a function that should compute $n! = n \times (n-1) \times \cdots \times 1$, but it produces incorrect results for $n > 1$. Find and fix the bugs.

```nasm
factorial:
    push rbp
    mov rbp, rsp
    ; n is in rdi
    cmp rdi, 1
    jle .base_case

    ; Recursive case
    mov rax, rdi        ; save n
    dec rdi             ; n - 1
    call factorial      ; factorial(n-1)
    imul rax, rdi       ; n * factorial(n-1)  <-- BUG
    jmp .done

.base_case:
    mov rax, 1

.done:
    pop rbp
    ret
```

### 4.2 Analysis

**Bug 1:** After `call factorial`, `RDI` has been *destroyed* (it is caller-saved). The `imul rax, rdi` multiplies by whatever garbage is in `RDI`, not by the original `n`.

**Bug 2:** The original value of `n` (in `RAX` before the call) is also destroyed by the `call` (the recursive call returns its result in `RAX`).

**Fix:** Save `n` across the call using a callee-saved register or the stack.

```nasm
factorial:
    push rbp
    mov rbp, rsp
    push rbx            ; save callee-saved register

    mov rbx, rdi        ; save n in rbx (callee-saved)
    cmp rdi, 1
    jle .base_case

    dec rdi             ; n - 1
    call factorial      ; rax = factorial(n-1)
    imul rax, rbx       ; rax = n * factorial(n-1)
    jmp .done

.base_case:
    mov rax, 1

.done:
    pop rbx             ; restore callee-saved register
    pop rbp
    ret
```

### 4.3 Debugging Techniques

1. **GDB single-stepping**: `stepi` / `nexti` to step through assembly instructions. Examine register values with `info registers`.
2. **Breakpoints on labels**: `break factorial` to stop at function entry.
3. **Print register at call/return**: `display $rax`, `display $rdi` to monitor values.
4. **Stack inspection**: `x/8gx $rsp` to examine 8 quad-words on the stack.
5. **Compiler-generated assembly comparison**: compile with `gcc -S -O0` and compare with your generated code.

---

## Exercise 5: Instruction Selection Practice

### 5.1 Problem

Given the following IR expression tree, apply (a) maximal munch and (b) the DP algorithm to select x86-64 instructions. Assume the following patterns and costs:

| Pattern | Instruction | Cost |
|---------|------------|------|
| P1: `REG` | (leaf) | 0 |
| P2: `CONST` | `mov r, imm` | 1 |
| P3: `ADD(r, r)` | `add r, r` | 1 |
| P4: `ADD(r, CONST)` | `add r, imm` | 1 |
| P5: `MUL(r, r)` | `imul r, r` | 3 |
| P6: `MUL(r, CONST)` | `imul r, r, imm` | 2 |
| P7: `MEM(r)` | `mov r, [r]` | 1 |
| P8: `MEM(ADD(r, CONST))` | `mov r, [r+disp]` | 1 |
| P9: `MEM(ADD(r, MUL(r, CONST)))` | `mov r, [r+r*s]` | 1 |

**IR tree** for `MEM(ADD(x, MUL(i, 8)))`:

```
        MEM
         |
        ADD
       /   \
      x    MUL
          /   \
         i     8
```

### 5.2 Solution

**Maximal munch (top-down, largest match first):**

At the root `MEM`: P9 matches `MEM(ADD(r, MUL(r, CONST)))` with `CONST=8`. This covers the entire tree with leaves `x` and `i`. Cost: 1 + 0 + 0 = 1.

Emit: `mov result, [x + i*8]`

**DP (bottom-up):**

- Node `8` (CONST): P2, cost = 1
- Node `i` (REG): P1, cost = 0
- Node `x` (REG): P1, cost = 0
- Node `MUL(i, 8)`:
  - P5: cost = 3 + 0 + 1 = 4 (but need to load 8 into reg first... actually P2 cost is for producing a register result)
  - P6: cost = 2 + 0 = 2 (MUL(r, CONST))
  - Best: P6, cost = 2
- Node `ADD(x, MUL)`:
  - P3: cost = 1 + 0 + 2 = 3
  - Best: P3, cost = 3
- Node `MEM(ADD)`:
  - P7: cost = 1 + 3 = 4
  - P8: does not match (child of ADD is not CONST)
  - P9: MEM(ADD(r, MUL(r, CONST))). cost = 1 + 0 + 0 = 1
  - Best: P9, cost = 1

Both methods yield the same result here. The DP method verifies optimality.

---

## Summary

These exercises cover the essential skills for implementing a compiler backend:

1. **IR to assembly translation** requires understanding the target ISA and ABI.
2. **Register allocation by hand** builds intuition for the graph coloring algorithm.
3. **Stack frame design** requires careful attention to alignment, calling conventions, and register saving.
4. **Assembly debugging** is a critical practical skill for compiler development.
5. **Instruction selection** demonstrates how pattern matching exploits complex ISA features.

Practice these exercises with different IR programs and target constraints to build fluency.
