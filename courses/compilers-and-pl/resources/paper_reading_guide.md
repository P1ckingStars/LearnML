# Paper Reading Guide for Compilers & PL

## How to Read a PL/Compilers Paper

### First Pass (30 minutes)

1. Read the title, abstract, and introduction
2. Read section headings and look at figures/diagrams
3. Read the conclusion
4. Identify: What problem? What approach? What result?

### Second Pass (1-2 hours)

1. Read the paper in full, skipping dense proofs on first read
2. Annotate key definitions, theorems, and algorithms
3. Understand the examples -- they encode the core ideas
4. Note what you don't understand for the third pass

### Third Pass (2-4 hours)

1. Work through the proofs and algorithms in detail
2. Try to reconstruct the key results from memory
3. Implement a simplified version if applicable
4. Identify limitations and potential extensions

## PL/Compilers-Specific Tips

- **Type rules**: Read them as recipes. The premises above the line are what you need; the conclusion below is what you get.
- **Operational semantics**: Trace through examples by hand. Each rule is a single step of computation.
- **Algorithms**: Implement them. Pseudocode in papers often omits edge cases that matter.
- **Proofs by induction**: Identify the induction measure (structure, derivation height, reduction length).
- **Benchmarks**: Look at what is *not* measured. What workloads are missing? What metrics are omitted?

## Presentation Guidelines

- **15 minutes** presentation + **10 minutes** Q&A
- Structure: Problem, Prior Work, Key Insight, Technical Approach, Results, Limitations, Your Assessment
- Include at least one worked example demonstrating the core technique
- Prepare 2-3 discussion questions for the audience

## Key Venues

- **POPL**: Principles of Programming Languages (theory-heavy)
- **PLDI**: Programming Language Design and Implementation (systems + theory)
- **ICFP**: International Conference on Functional Programming
- **OOPSLA**: Object-Oriented Programming, Systems, Languages, and Applications
- **CC**: Compiler Construction
- **CGO**: Code Generation and Optimization
- **TOPLAS**: ACM Transactions on Programming Languages and Systems (journal)
