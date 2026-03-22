# Environment Setup

## Hardware Requirements

- **Minimum**: Any modern machine with 8 GB RAM (sufficient for Modules 00–07)
- **Recommended**: 16 GB RAM (Isabelle sessions for large theories can be memory-intensive)
- **For seL4/l4v work (Module 10)**: 64-bit system with 32+ GB RAM

Isabelle runs on Linux, macOS, and Windows. Linux is recommended for the C verification modules.

## Software Setup

### 1. Install Isabelle

Download the latest Isabelle release from the official site. The course is developed against Isabelle2025.

```bash
# Linux (x86_64)
wget https://isabelle.in.tum.de/dist/Isabelle2025_linux.tar.gz
tar xzf Isabelle2025_linux.tar.gz
# Add to PATH
export PATH="$HOME/Isabelle2025/bin:$PATH"

# macOS
# Download the .dmg from https://isabelle.in.tum.de/
# Drag Isabelle2025.app to /Applications
# Symlink the CLI tool:
ln -s /Applications/Isabelle2025.app/Contents/Resources/Isabelle2025/bin/isabelle ~/bin/isabelle

# Verify installation
isabelle version
```

### 2. Launch Isabelle/jEdit

Isabelle ships with a customized jEdit IDE that provides real-time proof checking.

```bash
# Launch the IDE
isabelle jedit

# Or open a specific theory file
isabelle jedit MyTheory.thy
```

Key IDE features:
- **Real-time checking**: Proofs are checked as you type (colored underlines)
- **Output panel**: Shows proof state, errors, and messages
- **Sidekick panel**: Theory structure navigation
- **Ctrl+hover**: Shows type information and definitions
- **Ctrl+click**: Jump to definition

### 3. Configure Isabelle for ZF

By default, Isabelle loads the HOL session. To work with ZF:

```isabelle
(* At the top of your theory file *)
theory MyZFTheory
  imports ZF
begin
  (* Your ZF development here *)
end
```

Or to start jEdit with the ZF session:

```bash
isabelle jedit -l ZF MyZFTheory.thy
```

### 4. Install AutoCorres (for Modules 09–10)

AutoCorres2 is available through the Archive of Formal Proofs (AFP).

```bash
# Clone the AFP (Git mirror)
git clone https://github.com/isabelle-prover/mirror-afp-devel afp-devel
# Or download a tarball from https://www.isa-afp.org/download/

# Register AFP theories with Isabelle
echo "$HOME/afp-devel/thys" >> "$HOME/.isabelle/Isabelle2025/etc/components"

# Verify: this should build AutoCorres
isabelle build -b AutoCorres2
```

### 5. Install a C Compiler (for Modules 09–10)

The C parser requires a C preprocessor.

```bash
# Ubuntu/Debian
sudo apt install gcc cpp

# macOS
xcode-select --install

# Verify
gcc --version
cpp --version
```

### 6. (Optional) Clone the seL4 Verification Repository

For Module 10, you will study the seL4 proof repository.

```bash
# Clone the l4v repository
git clone https://github.com/seL4/l4v.git
cd l4v
# Follow setup instructions in l4v/README.md
```

**Warning**: Building l4v requires 32+ GB RAM and several hours. For most coursework, reading the theory files without building is sufficient.

### 7. (Optional) Install LaTeX

For written homework submissions:

```bash
# Ubuntu/Debian
sudo apt install texlive-full

# macOS
brew install --cask mactex

# Or use Overleaf (online, free tier available)
```

## Directory Structure for Submissions

```
LearnML/
├── submissions/
│   ├── hw00/
│   │   ├── hw00_solutions.pdf    # Written proofs
│   │   └── code/                 # Isabelle .thy files
│   ├── hw01/
│   │   ├── hw01_solutions.pdf
│   │   └── code/
│   │       └── Hw01.thy
│   ├── ...
│   ├── mini_project_1/
│   │   ├── report.pdf
│   │   └── code/
│   │       └── *.thy
│   └── capstone/
│       ├── report.pdf
│       └── code/
│           └── *.thy
```

Create this structure:

```bash
for i in $(seq -w 0 10); do
    mkdir -p submissions/hw${i}/code
done
mkdir -p submissions/{mini_project_1,mini_project_2,capstone}/code
```

## Useful Isabelle Commands

```bash
# Build a session (check all theories)
isabelle build -b HOL
isabelle build -b ZF

# Build a session with timing
isabelle build -b -o timing HOL

# Search for theorems from command line
isabelle find_theorems -s HOL "_ + _ = _ + _"

# Generate documentation
isabelle document -d output MySession

# Start a REPL (for quick experiments)
isabelle console -l ZF
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| jEdit is very slow | Increase JVM heap: `isabelle jedit -m 4g` |
| "Bad theory import" | Check that you are loading the correct session (`-l ZF` vs `-l HOL`) |
| ZF theories not found | Ensure Isabelle's ZF component is installed (it ships with standard Isabelle) |
| AutoCorres build fails | Check AFP path in components file; ensure correct Isabelle version |
| C parser errors | Ensure `cpp` is on your PATH; the C parser calls the preprocessor |
| Out of memory on l4v | Use 64-bit Isabelle with `-m 16g` or more |
| Proof state not updating | Check that the IDE is in continuous checking mode (Theories panel) |
