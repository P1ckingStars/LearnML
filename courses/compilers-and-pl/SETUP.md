# Environment Setup

## Required Software

### Compiler Toolchain

- **GCC** (>= 12) or **Clang** (>= 15) -- for compiling C/C++ and as a reference compiler
- **LLVM** (>= 16) -- for IR exploration, writing passes, and the LLVM tools (`llc`, `opt`, `llvm-dis`, `llvm-as`)
- **Make** or **CMake** (>= 3.20)

### Language Runtimes

Choose your primary implementation language:

- **C/C++**: GCC or Clang (already covered above)
- **Rust**: `rustup` with latest stable toolchain
- **OCaml**: `opam` with OCaml >= 5.0
- **Haskell**: GHCup with GHC >= 9.4 and Cabal or Stack
- **Python** (>= 3.10): For prototyping and scripting only (not for performance-critical compiler code)

### Tools

- **Flex** (>= 2.6) and **Bison** (>= 3.8) -- for understanding generated scanners/parsers
- **GDB** or **LLDB** -- for debugging generated code
- **Graphviz** (`dot`) -- for visualizing CFGs, dominator trees, and automata
- **Git** (>= 2.30)

### Optional but Recommended

- **NASM** or **GAS** -- for writing and testing assembly
- **Valgrind** or **AddressSanitizer** -- for memory debugging
- **Coq** or **Lean 4** -- for Module 10 (verified compilers)
- **Koka** or **Eff** -- for Module 10 (effect handlers)

## Installation

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install build-essential llvm-16 clang-16 flex bison graphviz gdb
sudo apt install llvm-16-dev  # for writing LLVM passes
```

### macOS

```bash
brew install llvm flex bison graphviz
# Add LLVM to PATH
echo 'export PATH="/opt/homebrew/opt/llvm/bin:$PATH"' >> ~/.zshrc
```

### Verification

```bash
gcc --version        # Should show >= 12
llc --version        # Should show LLVM >= 16
flex --version       # Should show >= 2.6
bison --version      # Should show >= 3.8
dot -V               # Graphviz
```

## Editor Setup

Any editor with syntax highlighting for your chosen language. Recommended:

- **VS Code** with C/C++, LLVM IR, and language-specific extensions
- **Vim/Neovim** with LSP support
- **Emacs** with language modes

## Project Structure

Each homework creates artifacts in a consistent structure:

```
hw01/
  src/          # Source code
  test/         # Test cases
  Makefile      # Build system
  README.md     # Design decisions and notes
```
