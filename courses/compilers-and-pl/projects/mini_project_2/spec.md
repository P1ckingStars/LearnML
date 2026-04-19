# Mini-Project 2: Optimizer & Code Generator

**Due**: End of Week 14
**Weight**: 10% of final grade
**Team Size**: Individual or pairs

---

## Overview

Extend a provided compiler IR framework with optimization passes and a code generator targeting x86-64. You will take three-address code as input and produce executable assembly.

## Phases

### Phase 1: IR Construction & SSA (25 points)

- Build control flow graphs from three-address code
- Compute dominator trees (Lengauer-Tarjan or iterative)
- Construct SSA form using dominance frontiers
- Implement phi function placement and variable renaming

### Phase 2: Optimization Passes (35 points)

Implement at least three of the following:

- Sparse conditional constant propagation (SCCP)
- Dead code elimination on SSA
- Global value numbering (GVN)
- Loop-invariant code motion (LICM)
- Copy propagation
- Strength reduction

Each pass must:
- Be correct (not change program semantics)
- Include test cases demonstrating the optimization
- Print before/after IR for inspection

### Phase 3: Code Generation (40 points)

- SSA destruction (phi elimination)
- Instruction selection for x86-64 (subset of instructions)
- Register allocation: implement linear scan or graph coloring
- Stack frame layout and calling convention (System V AMD64)
- Emit AT&T syntax assembly that can be assembled by GAS

## Testing

- Provided: 15 benchmark programs with expected outputs
- Your optimized code must produce identical outputs to unoptimized code
- Measure speedup from optimizations on provided benchmarks

## Deliverables

1. Source code for all phases
2. Test suite with additional test cases
3. Benchmark results (execution time with/without optimizations)
4. Writeup (~3 pages): optimization design choices, register allocation strategy, benchmark analysis

## Grading Rubric

| Component | Points |
|-----------|--------|
| SSA construction correctness | 25 |
| Optimization correctness | 20 |
| Optimization effectiveness | 15 |
| Code generation correctness | 25 |
| Register allocation | 10 |
| Writeup and benchmarks | 5 |
