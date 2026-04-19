# Lecture 01d: Lexer Optimization & Engineering

**Module 01 -- Lexical Analysis**
**Week 2**

---

## 1. DFA State Minimization in Practice

### 1.1 Review

Recall from Lecture 01a: Hopcroft's algorithm computes the minimum-state DFA in $O(n |\Sigma| \log n)$ time. In practice, however, the raw theoretical minimum may not be the most *efficient* DFA for scanning.

### 1.2 When Minimization Hurts

Minimization reduces state count but can increase transition table density. Consider a scanner for a language with 50 keywords: the minimized DFA for keyword recognition shares prefixes aggressively, producing states with many transitions. A trie-based DFA has more states but simpler transition structure.

**Trade-off:** Fewer states reduce table size, but the resulting states may have higher fan-out, reducing the effectiveness of table compression.

### 1.3 Practical Minimization Pipeline

```
1. Thompson's construction: RE -> NFA            O(|r|)
2. Subset construction:    NFA -> DFA             O(2^n) worst case
3. Remove unreachable states                      O(|Q| + |delta|)
4. Remove dead states (non-accepting sinks)       O(|Q| + |delta|)
5. Hopcroft minimization                          O(n |Sigma| log n)
6. Table compression                              (see Section 2)
```

Step 4 is important: dead states inflate the DFA without contributing to recognition. A *dead state* is one from which no accepting state is reachable.

---

## 2. Table Compression Techniques

### 2.1 The Problem

A DFA with $n$ states and alphabet size $|\Sigma| = k$ requires an $n \times k$ transition table. For Unicode ($k \approx 1.1 \times 10^6$) this is prohibitive. Even for ASCII ($k = 128$), tables for scanners with thousands of states consume significant memory.

### 2.2 Character Equivalence Classes

**Observation:** Many characters behave identically in all states. For example, all lowercase letters $a$--$z$ might transition to the same state from every DFA state.

**Definition 2.1.** Characters $a, b$ are *equivalent* if $\delta(q, a) = \delta(q, b)$ for every state $q$.

**Construction:** Partition $\Sigma$ into equivalence classes. Replace the $n \times |\Sigma|$ table with an $n \times c$ table plus a $|\Sigma| \to c$ mapping, where $c$ is the number of equivalence classes.

**Typical savings:** For a C-like language, $c \approx 30$--$50$ classes suffice, reducing table width from 128 (ASCII) to $\sim 40$.

### 2.3 Row Displacement (Comb-Vector) Compression

This is the classic technique used by lex/flex, adapted from the sparse-matrix method of Tarjan and Yao (1979).

**Idea:** Store the transition table in two arrays, `check[]` and `next[]`, with a displacement array `base[]`:

```
function lookup(state, char):
    offset = base[state] + equiv_class[char]
    if check[offset] == state:
        return next[offset]
    else:
        return default[state]  // default transition
```

**Construction:** For each state, find an offset `base[state]` such that its non-default transitions do not collide with other states' entries in the `check`/`next` arrays.

```
function CompressTable(DFA):
    // For each state, identify the most common transition target
    // as the "default" (reduces entries to store)
    for each state s:
        default[s] = most_common_target(s)
        entries[s] = {(c, t) : delta(s, c) = t and t != default[s]}

    // Pack states into check/next arrays using first-fit
    check = array of -1
    next = array of 0
    base = array of 0

    // Sort states by number of non-default entries (descending)
    // for better packing
    for each state s in sorted order:
        find smallest offset o >= 0 such that
            for all (c, t) in entries[s]:
                check[o + c] == -1
        base[s] = o
        for each (c, t) in entries[s]:
            check[o + c] = s
            next[o + c] = t

    return (base, check, next, default)
```

**Savings:** Reduces table from $O(n \cdot c)$ to $O(n + e)$ where $e$ is the total number of non-default transitions. Typical compression ratio: 5--20x.

### 2.4 Default State Chaining

**Optimization:** When state $s_1$ differs from state $s_2$ in only a few transitions, set $\text{default}[s_1] = s_2$ and only store the differing transitions for $s_1$. Lookup chains through defaults:

```
function lookup_chained(state, char):
    s = state
    while s != NONE:
        offset = base[s] + equiv_class[char]
        if check[offset] == s:
            return next[offset]
        s = default[s]
    return error_state
```

This is effective when many states share similar transition patterns (common in keyword-heavy scanners).

### 2.5 Comparison of Compression Methods

| Method | Table Size | Lookup Time | Implementation Complexity |
|--------|-----------|-------------|--------------------------|
| Full table | $O(n \cdot \lvert\Sigma\rvert)$ | $O(1)$ | Low |
| Equiv. classes | $O(n \cdot c)$ | $O(1)$ | Low |
| Row displacement | $O(n + e)$ | $O(1)$ expected | Medium |
| Default chaining | $O(e')$ | $O(d)$ chain length | Medium |
| Perfect hashing per state | $O(e)$ | $O(1)$ | High |

---

## 3. Just-in-Time Lexer Generation

### 3.1 Motivation

In some applications, the token patterns are not known at compile time:
- Programmable editors (user-defined syntax highlighting).
- Protocol analyzers (patterns loaded from configuration).
- Domain-specific languages embedded in data files.

### 3.2 Architecture

A JIT lexer generator compiles regular expressions to machine code at runtime:

```
1. Parse regex string -> AST
2. Thompson's construction -> NFA
3. Subset construction -> DFA (lazy or eager)
4. Emit native code for DFA (x86, ARM, etc.)
5. Execute generated code on input
```

### 3.3 Code Generation Strategies

**Strategy 1 -- Threaded code:** Each DFA state is a small code block. Transitions are implemented as computed gotos (GCC extension) or tail calls.

```c
// Generated code (conceptual)
&&state_0:
    c = *input++;
    if (c >= 'a' && c <= 'z') goto &&state_1;
    if (c == '+') goto &&state_5;
    goto &&error;

&&state_1:
    c = *input++;
    if (c >= 'a' && c <= 'z') goto &&state_1;
    if (c >= '0' && c <= '9') goto &&state_1;
    // accept: IDENTIFIER
    last_accept = input;
    goto &&state_done;
```

**Strategy 2 -- Binary decision trees:** For each state, generate a balanced binary decision tree over the character ranges, achieving $O(\log c)$ transitions where $c$ is the number of distinct character ranges.

### 3.4 RE2 and re2c

**RE2** (Google): A regex library that guarantees linear-time matching by using DFA/NFA simulation. Supports lazy DFA caching with bounded memory.

**re2c** (Bumbulis and Cowan, 1993): A lexer generator that produces direct-coded scanners as C/C++ source. Generates code with `goto` statements rather than table lookups.

---

## 4. Parallel Lexing

### 4.1 The Challenge

Lexical analysis is inherently sequential: the token starting position depends on where the previous token ended. Parallelizing seems impossible at first glance.

### 4.2 Speculative Parallel Scanning

**Approach (Barve and Vandierendonck, 2020; Mytkowicz et al., 2014):** Divide the input into chunks. Assign each chunk to a thread. Each thread speculatively scans its chunk starting from every possible scanner state.

**Key insight:** The DFA has a finite number of states $n$. If we run the DFA on a chunk for all $n$ possible start states, we produce a *transition function* for that chunk: a map from start state to (end state, token sequence).

```
function ParallelLex(input, num_threads):
    chunks = split(input, num_threads)
    // Phase 1: Speculatively scan each chunk for all start states
    parallel for i = 0 to num_threads - 1:
        for each start_state s in Q:
            result[i][s] = scan_chunk(chunks[i], s)

    // Phase 2: Sequential composition
    current_state = q_0
    for i = 0 to num_threads - 1:
        output tokens from result[i][current_state]
        current_state = result[i][current_state].end_state
```

**Complexity:** Phase 1 is $O(|input| / p \cdot |Q|)$ per thread with $p$ threads. Phase 2 is $O(p)$. Speedup is approximately $p / |Q|$, which is beneficial when $|Q|$ is small relative to $p$.

### 4.3 DFA Composition Approach

A more elegant formulation uses *DFA transition composition*. Each chunk maps to a function $f_i: Q \to Q$ (the DFA transition function over the chunk). These functions can be composed associatively, enabling parallel reduction:

$$f_{\text{total}} = f_k \circ f_{k-1} \circ \cdots \circ f_1$$

Using parallel prefix scan, this composition takes $O(\log k)$ parallel steps, each involving function composition (a lookup table of size $|Q|$).

### 4.4 SIMD-Accelerated Scanning

For specific sub-tasks, SIMD instructions can accelerate scanning:

- **Whitespace skipping:** Use SIMD to check 16/32/64 bytes at once for whitespace characters.
- **Delimiter detection:** Find the next occurrence of a delimiter character using `PCMPISTRI`/`PCMPISTRM` (SSE4.2) or NEON equivalents.
- **Character classification:** Use `PSHUFB` as a 16-entry lookup table to classify characters into equivalence classes.

**Example (AVX2 whitespace skip):**

```c
__m256i spaces = _mm256_set1_epi8(' ');
__m256i tabs   = _mm256_set1_epi8('\t');
__m256i newlines = _mm256_set1_epi8('\n');

while (pos + 32 <= len) {
    __m256i chunk = _mm256_loadu_si256((__m256i*)(input + pos));
    __m256i is_space = _mm256_cmpeq_epi8(chunk, spaces);
    __m256i is_tab   = _mm256_cmpeq_epi8(chunk, tabs);
    __m256i is_nl    = _mm256_cmpeq_epi8(chunk, newlines);
    __m256i is_ws    = _mm256_or_si256(is_space,
                         _mm256_or_si256(is_tab, is_nl));
    int mask = _mm256_movemask_epi8(is_ws);
    if (mask != 0xFFFFFFFF) {
        pos += __builtin_ctz(~mask);
        break;
    }
    pos += 32;
}
```

---

## 5. Benchmarking and Profiling Scanners

### 5.1 Metrics

- **Throughput:** MB/s of source code processed. Modern scanners achieve 100--500 MB/s.
- **Tokens/second:** Accounting for token density (more tokens per byte in C than in verbose languages).
- **Memory footprint:** Table size + input buffer + token buffer.
- **Startup time:** Table generation (for JIT scanners) or loading time.

### 5.2 Profiling Approach

```
1. Use a large, representative corpus of source files.
2. Measure wall-clock time, CPU cycles, cache misses, branch mispredictions.
3. Profile per-function: tokenize loop, character classification,
   keyword lookup, string scanning, number scanning.
4. Identify hotspots: typically the main dispatch loop and
   identifier/number scanning.
```

### 5.3 Common Bottlenecks

| Bottleneck | Symptom | Solution |
|-----------|---------|----------|
| Table cache misses | High L1/L2 miss rate | Compress tables, use direct coding |
| Branch mispredictions | High branch miss rate in dispatch | Use computed gotos, reduce state fan-out |
| Character-at-a-time I/O | Low throughput | Buffer input, use memory-mapped files |
| Keyword lookup | Slow identifier processing | Perfect hashing, sorted arrays, tries |
| UTF-8 decoding | Overhead per character | SIMD decoding, equivalence classes for ASCII fast path |

### 5.4 Benchmarking Methodology

- **Warm up:** Run the scanner several times before measuring to fill caches.
- **Multiple runs:** Report median of $\geq 10$ runs to account for variance.
- **Vary input:** Test on small files, large files, pathological inputs, and typical codebases.
- **Compare fairly:** Use the same input, same machine, same optimization level.

---

## 6. Case Studies: Tokenizing Real Programming Languages

### 6.1 C Language

**Challenges:**
- Trigraphs and digraphs (deprecated but must be handled).
- The preprocessor interleaves with lexical analysis (`#include`, `#define`, macro expansion).
- Context sensitivity: `>>` is two right-shift operators or two closing angle brackets depending on context (less of an issue in C than C++).

**GCC's scanner:** Hand-written in C (`libcpp/lex.cc`). Uses a large switch statement for dispatch. Handles preprocessor directives inline. Achieves approximately 200--400 MB/s.

### 6.2 Python

**Challenges:**
- Significant indentation: the scanner must track indentation levels and emit INDENT/DEDENT tokens. This requires a stack (not regular).
- String prefixes: `r"..."`, `b"..."`, `f"..."`, `rb"..."`, etc.
- Triple-quoted strings: may span multiple lines.
- Implicit line continuation inside brackets.

**CPython's scanner:** Hand-written in C (`Parser/tokenize.c`). Maintains an indentation stack. Handles all string variants with dedicated state machines.

### 6.3 Rust

**Challenges:**
- Raw strings: `r#"..."#`, `r##"..."##`, etc. with variable number of `#` delimiters. Recognizing the closing delimiter requires counting (not regular).
- Nested block comments: `/* ... /* ... */ ... */`. Requires a counter.
- Lifetime annotations: `'a`, `'static` -- the `'` character is also used for character literals.
- Unicode identifiers.

**rustc's scanner:** Hand-written in Rust (`compiler/rustc_lexer/src/lib.rs`). Clean, well-documented implementation. Handles all edge cases with explicit state tracking.

### 6.4 Performance Comparison

Approximate single-threaded throughput on modern hardware (2024):

| Scanner | Language Being Scanned | Throughput |
|---------|----------------------|-----------|
| GCC libcpp | C/C++ | ~300 MB/s |
| Clang lexer | C/C++ | ~350 MB/s |
| rustc lexer | Rust | ~250 MB/s |
| tree-sitter (generated) | Various | ~150--250 MB/s |
| flex (table-driven) | Various | ~50--100 MB/s |
| re2c (direct-coded) | Various | ~200--400 MB/s |

Note: These numbers are approximate and depend heavily on the input characteristics and hardware.

---

## 7. Advanced Topic: Incremental Lexing

### 7.1 Motivation

In IDEs, users edit source files continuously. Re-lexing the entire file on every keystroke is wasteful. Incremental lexing re-tokenizes only the changed region.

### 7.2 Approach

Maintain a list of tokens with their start/end positions and the scanner state at the start of each token. When an edit occurs:

1. Find the first token whose span overlaps or follows the edit point.
2. Restart scanning from that token's start position (using the saved scanner state from the previous token).
3. Scan forward until the new token stream converges with the old one (same state, same position).

**Convergence guarantee:** Since the DFA is deterministic, once the scanner reaches the same state at the same input position, all subsequent tokens are identical.

### 7.3 Complexity

If the edit affects $k$ characters, incremental re-lexing typically processes $O(k + c)$ characters where $c$ is a small constant (the "convergence tail"). In the worst case (e.g., opening a block comment), it may need to re-lex to the end of the file.

---

## References

1. Bumbulis, P. and Cowan, D. D. "RE2C: A More Versatile Scanner Generator." *ACM Letters on Programming Languages and Systems*, 2(1--4):70--84, 1993.
2. Cox, R. "Regular Expression Matching in the Wild." https://swtch.com/~rsc/regexp/, 2007--2010.
3. Mytkowicz, T., Musuvathi, M., and Schulte, W. "Data-parallel finite-state machines." *ASPLOS*, 2014.
4. Tarjan, R. E. and Yao, A. C. "Storing a sparse table." *Communications of the ACM*, 22(11):606--611, 1979.
5. Cooper, K. D. and Torczon, L. *Engineering a Compiler*, 3rd ed. Morgan Kaufmann, 2022. Chapters 2--3.
6. Paxson, V. "Flex -- Fast Lexical Analyzer Generator." Documentation, 1995.
7. Google. "RE2: A regular expression library." https://github.com/google/re2.
