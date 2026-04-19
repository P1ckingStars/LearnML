# Lecture 10c: Machine Learning for Compilers

## Prerequisites

- Compiler optimization passes (Modules 05--08), basic machine learning concepts (supervised learning, reinforcement learning, neural networks).

---

## 1. Compiler Optimization as a Decision Problem

### 1.1 The Optimization Space

A compiler makes hundreds of decisions during compilation:
- **Phase ordering**: In what order should optimization passes be applied?
- **Inlining**: Which call sites should be inlined? To what depth?
- **Loop transformations**: Unroll? Tile? Vectorize? By what factor?
- **Register allocation**: Which heuristic for spill decisions?
- **Instruction scheduling**: What order minimizes pipeline stalls?

Each decision can be modeled as a choice from a set of alternatives $A_i$ at decision point $i$. The total search space is:

$$
\mathcal{S} = \prod_{i=1}^{n} |A_i|
$$

which is combinatorially explosive. Traditional compilers use **heuristics** (hand-crafted rules) to navigate this space.

### 1.2 Why ML?

Hand-crafted heuristics are:
- **Fragile**: Tuned for specific benchmarks, hardware, and workloads.
- **Suboptimal**: Cannot capture complex interactions between decisions.
- **Expensive to maintain**: Must be re-tuned for each new architecture.

ML can potentially:
- Learn complex decision functions from data.
- Adapt to new hardware and workloads.
- Discover non-obvious optimization strategies.

### 1.3 Formalization

The compiler optimization problem can be cast as:

$$
\text{argmax}_{\theta \in \Theta} \;\mathbb{E}_{P \sim \mathcal{D}} \left[ \text{metric}(P, \text{compile}(P; \theta)) \right]
$$

where $\theta$ parameterizes the optimization decisions, $\mathcal{D}$ is a distribution over programs, and $\text{metric}$ measures execution time, code size, energy, etc.

---

## 2. ML for Instruction Scheduling

### 2.1 The Problem

Given a basic block of instructions with data dependencies (a DAG), find an ordering that minimizes execution time on a pipelined processor.

**Optimal scheduling** is NP-hard in general (for multiple functional units). Compilers use **list scheduling** with a priority function.

### 2.2 Traditional List Scheduling

```
function ListSchedule(DAG, priority_function):
    ready = set of instructions with no unscheduled predecessors
    schedule = []
    cycle = 0

    while ready is not empty:
        best = argmax_{inst in ready} priority_function(inst, state)
        schedule.append((cycle, best))
        update ready set (add successors whose predecessors are all scheduled)
        cycle = next available cycle (considering latencies)

    return schedule
```

The **priority function** is where ML intervenes.

### 2.3 ML Approach

**Feature representation for an instruction $i$:**

$$
\phi(i) = [\text{opcode}, \text{latency}, \text{num\_successors}, \text{critical\_path\_length}, \text{depth}, \text{register\_pressure\_impact}, \ldots]
$$

**Training data:** Run the list scheduler with different priority functions on a corpus of basic blocks; record which choices led to the best schedules.

**Model:** A classifier or regressor that predicts the best instruction to schedule next:

$$
\hat{i} = \text{argmax}_{i \in \text{ready}} f_\theta(\phi(i), \psi(\text{state}))
$$

where $f_\theta$ is a neural network or decision tree, and $\psi(\text{state})$ encodes the current scheduling state.

### 2.4 Results

Early work (Moss et al., 1997) showed that decision trees trained on optimal schedules could match or slightly exceed hand-tuned heuristics. More recent work uses **graph neural networks (GNNs)** to capture the structure of the dependency DAG directly.

---

## 3. ML for Register Allocation Heuristics

### 3.1 The Problem

Register allocation maps an unbounded number of virtual registers to a fixed set of physical registers. When no physical register is available, a virtual register must be **spilled** to memory.

Key decisions:
- **Spill selection**: Which virtual register to spill?
- **Split points**: Where to split a live range?
- **Register assignment**: Which physical register to assign?

### 3.2 Reinforcement Learning Formulation

The register allocation problem can be modeled as a **Markov Decision Process (MDP)**:

- **State**: Current allocation state (interference graph, live ranges, available registers).
- **Action**: Choose a register to spill, split, or assign.
- **Reward**: Negative of the estimated cost (number of spill loads/stores, weighted by execution frequency).
- **Transition**: Deterministic (applying the action updates the allocation state).

$$
\pi^* = \text{argmax}_\pi \;\mathbb{E}\left[\sum_{t=0}^{T} \gamma^t r_t \;\middle|\; \pi\right]
$$

### 3.3 MLGO for Register Allocation (Trofin et al., 2021)

Google's **MLGO** framework replaces LLVM's greedy register allocation heuristic (specifically, the **eviction policy**) with a trained ML model:

**Eviction decision:** When assigning a physical register to a live range $L$, and all physical registers are occupied by previously assigned live ranges, the allocator must decide which existing live range to **evict** (reassign or spill).

The ML model takes features of $L$ and each candidate evictee and outputs an eviction decision:

$$
\text{evict}(L, \text{candidates}) = f_\theta(\phi(L), \{\phi(c) \mid c \in \text{candidates}\})
$$

**Training:** Reinforcement learning with **policy gradient** methods. The reward is the negative number of spill instructions weighted by block frequency.

**Deployment:** The trained model is compiled to a small decision function embedded in LLVM. Inference overhead is negligible.

**Results:** Up to 2% reduction in dynamic instruction count on large Google workloads (Fuchsia, Chrome).

---

## 4. MLGO: ML-Guided Compiler Optimizations at Google

### 4.1 Framework Architecture

MLGO (Trofin et al., 2021) is a general framework for integrating ML models into LLVM:

```
Training phase:
  LLVM with logging -> Training data (state, action, reward)
  -> RL training -> Trained policy

Deployment phase:
  LLVM with ML policy (compiled to native code via TFLite or AOT)
  -> Optimized binary
```

### 4.2 Inlining Heuristic

MLGO also targets the **inlining decision**: should function $f$ be inlined at call site $c$?

**Features:**

$$
\phi(c) = [\text{callee\_size}, \text{call\_count}, \text{caller\_size}, \text{nest\_level}, \text{is\_recursive}, \ldots]
$$

**Training:** The RL agent receives a reward based on the final binary size (for code size optimization) or execution time (for performance optimization).

**Result:** 3--7% code size reduction on large C++ applications compared to LLVM's default inlining heuristic.

### 4.3 Challenges

1. **Training cost**: Each training iteration requires compiling and potentially running the program.
2. **Generalization**: Models trained on one codebase may not transfer to another.
3. **Regression risk**: ML models can produce catastrophic results on out-of-distribution inputs.
4. **Reproducibility**: ML-based compilation introduces nondeterminism.
5. **Debuggability**: When the ML model makes a bad decision, understanding why is difficult.

---

## 5. Autotuning: OpenTuner and TVM

### 5.1 Autotuning Concept

**Autotuning** systematically explores the space of compiler/transformation parameters to find the best configuration for a specific program and target.

$$
\theta^* = \text{argmin}_{\theta \in \Theta} \;\text{runtime}(\text{transform}(P, \theta), \text{target})
$$

### 5.2 OpenTuner (Ansel et al., 2014)

**OpenTuner** is a general-purpose autotuning framework that combines multiple search techniques:

- **Random search**: Explores broadly.
- **Simulated annealing**: Hill-climbing with random restarts.
- **Genetic algorithms**: Evolves populations of configurations.
- **Bandits**: A multi-armed bandit selects which search technique to use at each step.

The meta-search (bandit over search techniques) ensures robustness across different tuning spaces.

### 5.3 TVM: Optimizing Tensor Computations (Chen et al., 2018)

**TVM** is an end-to-end compiler for deep learning workloads that uses ML-guided autotuning.

**Architecture:**

```
DL model (PyTorch, TensorFlow, ONNX)
    |
    v
Relay IR (high-level graph IR)
    |-- Graph-level optimizations (operator fusion, layout optimization)
    v
TE (Tensor Expression) for each operator
    |-- Schedule space (tiling, unrolling, vectorization, parallelization)
    |-- Autotuner explores schedule space
    v
Low-level IR (TIR)
    |-- Code generation
    v
Target code (CUDA, OpenCL, LLVM, Metal, ...)
```

### 5.4 AutoTVM and Ansor

**AutoTVM** uses a **cost model** (a neural network or gradient-boosted tree) to predict the performance of a schedule without running it:

$$
\hat{t} = f_\theta(\phi(\text{schedule}))
$$

The autotuner uses this model to guide the search, running only the most promising candidates on hardware.

**Ansor** (Zheng et al., 2020) improves on AutoTVM by generating schedules via a set of **derivation rules** applied hierarchically, using a learned cost model to prune the search space.

### 5.5 Search Space Formalization

The schedule space for a tensor computation can be formalized as a tree of transformations:

$$
\text{Schedule} = \text{Base} \circ T_1 \circ T_2 \circ \ldots \circ T_k
$$

where each $T_i$ is a transformation (e.g., tile loop $j$ by factor $f$, vectorize loop $l$, parallelize loop $m$). The search space is:

$$
|\mathcal{S}| = \prod_{i} |\text{options}(T_i)|
$$

which can reach $10^{10}$ or more for complex operators.

---

## 6. Learned Index Structures and Their Compilation

### 6.1 Concept (Kraska et al., 2018)

**Learned indexes** replace traditional data structure-based indexes (B-trees, hash tables) with ML models that predict the position of a key:

$$
\text{pos} = f_\theta(\text{key}) \approx \text{CDF}(\text{key}) \times N
$$

where $f_\theta$ is a neural network approximating the cumulative distribution function of the key distribution, and $N$ is the number of entries.

### 6.2 Compilation of Learned Models

For low-latency inference, the learned model is compiled to native code:
- Small neural networks (e.g., 2-layer, 8--32 neurons) are unrolled into straight-line arithmetic.
- Piece-wise linear approximations are compiled to branch-free code using SIMD.
- The compiled model replaces the tree traversal of a B-tree.

### 6.3 Relevance to Compilers

This represents a broader trend: **replacing algorithmic components with learned models**, then compiling those models for efficient execution. The compiler becomes both the consumer of ML models and the beneficiary of ML-guided optimization.

---

## 7. Neural Program Synthesis

### 7.1 Problem Statement

Given a specification (input-output examples, natural language, or formal spec), automatically generate a program that meets it:

$$
\text{synthesize} : \text{Spec} \to \text{Program}
$$

### 7.2 Approaches

**Enumerative search with neural guidance:**

```
function NeuralSynthesize(spec, grammar):
    worklist = [empty_program]
    model = trained_neural_model

    while worklist is not empty:
        partial = worklist.pop_highest_priority()
        if is_complete(partial) and satisfies(partial, spec):
            return partial
        expansions = grammar.expand(partial)
        for each e in expansions:
            priority = model.score(e, spec)
            worklist.insert(e, priority)

    return FAILURE
```

**Sequence-to-sequence models:** Treat synthesis as translation (spec $\to$ program). Trained on large corpora of (spec, program) pairs.

**Reinforcement learning:** The agent constructs the program token by token, receiving a reward when the program passes test cases.

### 7.3 DeepCoder (Balog et al., 2017)

**DeepCoder** uses a neural network to predict which DSL functions are likely needed, then uses this prediction to prune the search space of an enumerative synthesizer:

$$
P(\text{function } f \text{ appears}) = \sigma(W \cdot \text{encode}(\text{I/O examples}) + b)
$$

### 7.4 Limitations

- **Correctness**: Neural synthesizers often produce programs that are correct on the examples but wrong in general. Formal verification of synthesized programs is an open challenge.
- **Scalability**: Current techniques work for small programs (tens of lines) in restricted DSLs.
- **Generalization**: Models struggle with specifications that differ significantly from training data.

---

## 8. Large Language Models for Code

### 8.1 Code Generation

Large language models (LLMs) -- GPT-4, Claude, Codex, StarCoder, CodeLlama -- can generate code from natural language descriptions, complete partial programs, and translate between languages.

### 8.2 Optimization Suggestion

LLMs can suggest optimizations:
- **Identifying performance bottlenecks** in code.
- **Suggesting algorithmic improvements** (e.g., replacing $O(n^2)$ with $O(n \log n)$).
- **Applying known optimization patterns** (loop fusion, memoization).

### 8.3 Compiler-Specific Applications

- **Bug finding**: LLMs trained on compiler bug reports can predict likely miscompilation patterns.
- **Pass ordering**: Suggest optimization pass sequences based on IR characteristics.
- **Peephole optimization discovery**: Generate candidate rewrite rules, then verify with Alive2.

### 8.4 Formal Limitations

**Theorem (informal).** LLMs provide no formal correctness guarantees. Any code generated by an LLM must be independently verified (by testing, type checking, or formal verification) to be trustworthy.

This is a fundamental limitation: LLMs are statistical models that approximate the distribution of code, not logical engines that reason about correctness.

### 8.5 The Verification Gap

The most promising approach combines LLM generation with formal verification:

$$
\text{LLM generates candidate} \xrightarrow{\text{verifier}} \text{Accept or reject}
$$

This "generate and verify" loop leverages the creativity of LLMs while maintaining the guarantees of formal methods.

---

## 9. Program Representation for ML

### 9.1 The Representation Problem

To apply ML to programs, we need to convert programs to a format suitable for ML models.

### 9.2 Common Representations

| Representation | Description | ML Model |
|----------------|-------------|----------|
| Token sequences | Source code or IR as token sequences | RNNs, Transformers |
| AST | Abstract syntax tree | Tree-RNNs, Tree-Transformers |
| CFG/DFG | Control/data flow graphs | Graph Neural Networks (GNNs) |
| Inst2Vec | Learned embeddings of IR instructions | Embedding layer + downstream model |
| ProGraML | Combined CFG + DFG + call graph | GNN (message passing) |

### 9.3 Graph Neural Networks for Compiler IR

**ProGraML** (Cummins et al., 2021) represents LLVM IR as a graph with three types of edges:
1. **Control flow** edges (between basic blocks).
2. **Data flow** edges (def-use chains).
3. **Call** edges (caller-callee).

A GNN processes this graph via message passing:

$$
h_v^{(k+1)} = \text{UPDATE}\left(h_v^{(k)}, \text{AGGREGATE}\left(\{h_u^{(k)} \mid u \in \mathcal{N}(v)\}\right)\right)
$$

where $h_v^{(k)}$ is the embedding of node $v$ at layer $k$, and $\mathcal{N}(v)$ is the set of neighbors of $v$.

After $K$ rounds of message passing, the node embeddings capture both local instruction semantics and global program structure.

### 9.4 Inst2Vec (Ben-Nun et al., 2018)

**Inst2Vec** adapts Word2Vec to LLVM IR instructions. Each instruction is mapped to a dense vector via an embedding trained on skip-gram objectives over sequences of IR instructions:

$$
\max_\theta \sum_{i} \sum_{-c \leq j \leq c, j \neq 0} \log P(w_{i+j} \mid w_i; \theta)
$$

where $w_i$ is the $i$-th instruction and $c$ is the context window.

---

## 10. Summary

| Application | ML Technique | Key Result |
|-------------|-------------|-----------|
| Instruction scheduling | Supervised learning (decision trees, GNNs) | Match or exceed hand-tuned heuristics |
| Register allocation | Reinforcement learning (policy gradient) | 2% fewer dynamic instructions (MLGO) |
| Inlining | RL | 3--7% code size reduction (MLGO) |
| Autotuning (TVM) | Cost model + search | Near-expert-level kernel performance |
| Neural synthesis | Seq2seq, RL, search + neural guidance | Small DSL programs from examples |
| LLMs for code | Transformers (GPT, etc.) | Code generation, no formal guarantees |

**Open challenges:**
1. **Generalization**: Models trained on one domain/architecture often fail on others.
2. **Correctness**: No ML approach provides formal guarantees; verification is needed.
3. **Training cost**: RL for compilers requires many compilation-execution cycles.
4. **Interpretability**: Understanding *why* a model makes a decision is crucial for adoption.
5. **Integration**: Fitting ML models into existing compiler infrastructure without disrupting workflows.

---

## References

1. Cummins, C., Petoumenos, P., Wang, Z., & Leather, H. (2017). "End-to-end deep learning of optimization heuristics." *PACT '17*.
2. Trofin, M., Qian, Y., Brevdo, E., Lin, Z., Chober, K., & Li, D. (2021). "MLGO: A machine learning guided compiler optimization framework." *arXiv:2101.04808*.
3. Chen, T., Moreau, T., Jiang, Z., et al. (2018). "TVM: An automated end-to-end optimizing compiler for deep learning." *OSDI '18*.
4. Ansel, J., Kamil, S., Veeramachaneni, K., et al. (2014). "OpenTuner: An extensible framework for program autotuning." *PACT '14*.
5. Zheng, L., Jia, C., Sun, M., et al. (2020). "Ansor: Generating high-performance tensor programs for deep learning." *OSDI '20*.
6. Kraska, T., Beutel, A., Chi, E. H., Dean, J., & Polyzotis, N. (2018). "The case for learned index structures." *SIGMOD '18*.
7. Balog, M., Gaunt, A. L., Brockschmidt, M., Nowozin, S., & Tarlow, D. (2017). "DeepCoder: Learning to write programs." *ICLR '17*.
8. Moss, J. E. B., Utgoff, P. E., et al. (1997). "Learning to schedule straight-line code." *NeurIPS '97*.
9. Cummins, C., Fisches, Z., Ben-Nun, T., Hoefler, T., O'Boyle, M., & Leather, H. (2021). "ProGraML: A graph-based program representation for data flow analysis and compiler optimizations." *ICML '21*.
10. Ben-Nun, T., Jakobovits, A. S., & Hoefler, T. (2018). "Neural code comprehension: A learnable representation of code semantics." *NeurIPS '18*.
