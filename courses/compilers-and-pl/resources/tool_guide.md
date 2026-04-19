# Tool Guide

## LLVM Toolchain

### Core Tools

- `clang` -- C/C++ front-end, produces LLVM IR with `-emit-llvm`
- `llc` -- LLVM static compiler (IR to assembly/object code)
- `opt` -- LLVM optimizer (runs passes on IR)
- `llvm-dis` -- Disassembles bitcode (`.bc`) to human-readable IR (`.ll`)
- `llvm-as` -- Assembles human-readable IR to bitcode
- `llvm-link` -- Links multiple bitcode files
- `lli` -- LLVM interpreter / JIT executor

### Common Workflows

```bash
# C to LLVM IR
clang -S -emit-llvm -O0 input.c -o output.ll

# Optimize IR
opt -S -passes='mem2reg,instcombine,simplifycfg' input.ll -o optimized.ll

# IR to assembly
llc -march=x86-64 input.ll -o output.s

# View CFG as graph
opt -passes='dot-cfg' input.ll  # produces .dot files
dot -Tpdf .func_name.dot -o cfg.pdf

# View dominator tree
opt -passes='dot-dom' input.ll
```

## Flex and Bison

```bash
# Generate scanner
flex -o scanner.c scanner.l

# Generate parser
bison -d -o parser.c parser.y  # -d generates header file

# Compile together
gcc -o compiler scanner.c parser.c -lfl
```

## Debugging Tools

### GDB for Generated Code

```bash
# Compile with debug info
gcc -g -O0 generated.s -o program

# Debug
gdb ./program
(gdb) break main
(gdb) run
(gdb) layout asm      # show assembly
(gdb) info registers  # show register state
(gdb) x/16xw $rsp     # examine stack
```

### Valgrind for Memory Issues

```bash
valgrind --leak-check=full ./program
valgrind --tool=callgrind ./program  # profiling
```

## Graphviz

```bash
# Render a .dot file
dot -Tpdf graph.dot -o graph.pdf
dot -Tpng graph.dot -o graph.png

# Useful for: CFGs, dominator trees, automata, interference graphs
```

## Testing Compilers

- **Differential testing**: Compare output against a reference compiler
- **Fuzzing**: Use tools like CSmith (for C) or AFL to generate test programs
- **Property-based testing**: QuickCheck-style random program generation
