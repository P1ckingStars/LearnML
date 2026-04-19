# How to Read ML Systems Papers Effectively

A guide for PhD-track students on systematically reading, evaluating, and presenting research papers in machine learning systems.

---

## Table of Contents

1. [How Systems Papers Differ from Algorithm Papers](#how-systems-papers-differ-from-algorithm-papers)
2. [The Three-Pass Method for Systems Papers](#the-three-pass-method-for-systems-papers)
3. [Evaluating Systems Claims](#evaluating-systems-claims)
4. [Presenting Systems Papers](#presenting-systems-papers)
5. [Paper Summary Template](#paper-summary-template)
6. [Staying Current](#staying-current)
7. [Common Red Flags](#common-red-flags)
8. [Building Systems Research Taste](#building-systems-research-taste)

---

## How Systems Papers Differ from Algorithm Papers

ML systems papers have a fundamentally different structure and evaluation methodology than algorithm papers. Understanding these differences is critical for reading them effectively.

### Key Differences

| Aspect | Algorithm Paper | Systems Paper |
|---|---|---|
| **Contribution** | New method, loss function, architecture | New system, optimization, abstraction, or benchmark |
| **Evaluation** | Accuracy on standard benchmarks | Throughput, latency, memory, scaling efficiency |
| **Hardware** | Often implicit or secondary | Central -- results depend on specific hardware |
| **Reproducibility** | Re-run with same hyperparameters | Re-run with same hardware, software stack, and configuration |
| **Baselines** | Other algorithms on same data | Other systems on same hardware and workload |
| **Key insight** | Mathematical or algorithmic | Systems-level: exploiting hardware features, rethinking abstractions, removing bottlenecks |

### What to Look For in Systems Papers

- **What bottleneck is being addressed?** Every good systems paper starts with a profiling insight.
- **What hardware feature is being exploited?** Systems contributions often leverage specific hardware capabilities (Tensor Cores, NVLink, SRAM hierarchy).
- **What is the trade-off?** Systems optimizations always trade something: memory for compute, latency for throughput, generality for performance.
- **What is the system architecture?** Look for the architecture diagram early. Understand the major components and data flow before diving into details.

---

## The Three-Pass Method for Systems Papers

Reading a systems paper in a single linear pass is inefficient. Adapt the standard three-pass method for the systems context.

### Pass 1: Survey (5-10 minutes)

**Goal:** Determine whether the paper is relevant and where it fits in the systems landscape.

Read only:

- Title, abstract, and introduction
- Section headings
- Architecture diagrams and performance figures (look at the axes, not just the curves)
- Conclusion

After Pass 1, you should be able to answer:

- What bottleneck does this paper address?
- What layer of the stack does it target (kernel, compiler, runtime, distributed, serving)?
- What hardware is it evaluated on?
- What is the claimed speedup or improvement?
- What system or library does it compare against?

**Decision point:** Stop here if the paper is outside your interest, the hardware is irrelevant to you, or the claimed improvements are on a different workload than you care about.

### Pass 2: Comprehension (1-2 hours)

**Goal:** Understand the system design and evaluation methodology.

Read the full paper, focusing on:

- **Bottleneck analysis.** How do the authors demonstrate the problem? What profiling data or analysis do they present? Is the bottleneck real or hypothetical?
- **System architecture.** Understand the architecture diagram. Trace the data flow. Identify where communication happens, where memory is allocated, and where computation occurs.
- **Key design decisions.** What trade-offs did the authors make? Why did they choose this approach over alternatives?
- **Implementation details.** What language, framework, and hardware-specific features are used? Are there implementation limitations not mentioned in the abstract?
- **Evaluation setup.** What hardware, software versions, workloads, and baselines are used? Are the baselines current and well-tuned? Are the workloads representative?
- **Performance results.** Read every table and figure. Look at absolute numbers, not just relative speedups. Check whether the baselines are reasonable. Look for the workloads where the system does NOT win.
- **Scaling analysis.** How does performance change with model size, batch size, sequence length, or number of GPUs?

Annotate as you go:

- Star the key performance numbers
- Circle the hardware configuration details
- Write question marks next to workloads or baselines that seem missing
- Note where the system underperforms and whether the authors discuss it

### Pass 3: Reproduction (3-5 hours, for important papers only)

**Goal:** Deeply understand the system by thinking through how you would build it.

Reserved for papers central to your research:

- **Trace the critical path.** For the main workload, trace the execution from input to output. Where are the kernel launches? Where are the communication points? Where are the synchronization barriers?
- **Verify the performance model.** If the paper presents a performance model or roofline analysis, check the math. Does the claimed arithmetic intensity match the algorithm? Does the predicted throughput match the observed throughput?
- **Identify hardware assumptions.** What hardware features does this system depend on? Would it work on different hardware? What about older or newer GPUs?
- **Challenge the evaluation.** What workloads are missing? What baselines are conspicuously absent? What would happen at a different scale?
- **Think about generalization.** Would this technique apply to other operators, models, or hardware? What are the limits of the approach?

After Pass 3, you should be able to:

- Present the paper from memory
- Explain the system design and why each component exists
- Identify which performance improvements come from the algorithm vs. the implementation
- Propose concrete extensions or improvements

---

## Evaluating Systems Claims

Systems papers make specific types of claims. Evaluate each on appropriate criteria.

### Types of Systems Claims

| Claim Type | What to Look For |
|---|---|
| **Speedup over baseline** | Same hardware, same workload, fair baseline tuning, wall-clock time (not just FLOPs), warmup runs excluded, variance reported |
| **Memory reduction** | Peak memory (not just model size), comparison at same batch size, accounting for fragmentation |
| **Scaling efficiency** | Ideal baseline clearly defined, communication overhead separated, strong scaling vs. weak scaling distinguished |
| **Generality** | Evaluated on multiple workloads, multiple hardware configurations, not just the workload the system was designed for |
| **Accuracy preservation** | Numerical comparison with reference implementation, convergence curves match baseline, same final accuracy/perplexity |

### Checklist for Evaluation Sections

- [ ] Is the hardware configuration fully specified (GPU model, memory, interconnect, driver version, CUDA version)?
- [ ] Are workloads representative of real use cases (not just synthetic benchmarks)?
- [ ] Are baselines current and well-tuned? (Comparing against an old version of PyTorch or an unoptimized kernel is misleading.)
- [ ] Is wall-clock time reported, not just theoretical FLOPs or algorithmic complexity?
- [ ] Are warmup runs excluded from timing measurements?
- [ ] Is variance reported across multiple runs?
- [ ] Is the comparison fair in terms of precision (FP16 vs. FP32), batch size, and sequence length?
- [ ] Are absolute numbers reported, not just relative speedups? (A 10x speedup from 0.1ms to 0.01ms is very different from 10s to 1s.)
- [ ] Are there workloads where the system does not win? Is this discussed?
- [ ] Is the code available for reproduction?

### Checklist for Scaling Claims

- [ ] Is the scaling efficiency properly defined (throughput at N GPUs / (N * throughput at 1 GPU))?
- [ ] Is the communication overhead measured separately from computation?
- [ ] Is the interconnect bandwidth specified (NVLink vs. PCIe vs. InfiniBand)?
- [ ] Are results shown at multiple scales (2, 4, 8, 16, ... GPUs)?
- [ ] Is it clear whether the results are strong scaling (fixed total work) or weak scaling (fixed per-GPU work)?

### Common Rhetorical Moves to Watch For

- **Cherry-picked workloads.** Showing results only on the workloads where the system wins.
- **Stale baselines.** Comparing against old versions of production systems (e.g., PyTorch 1.x when 2.x exists).
- **FLOPs instead of wall-clock time.** Reporting theoretical FLOPs improvement without measuring actual throughput.
- **Relative speedups without absolute numbers.** A 2x speedup over a slow baseline is less impressive than a 1.2x speedup over a fast one.
- **Different precision.** Comparing FP8 results against FP32 baselines without noting the precision difference.
- **Synthetic benchmarks.** Evaluating on contrived workloads that do not reflect real model architectures or deployment scenarios.
- **Ignoring overhead.** Reporting only kernel time while ignoring compilation time, data loading, or framework overhead.

---

## Presenting Systems Papers

### Structure for a 30-Minute Presentation

1. **Bottleneck and motivation (5 min).** What is the problem? Show the profiling data that motivates the work. Explain why existing systems fail to address it.
2. **System architecture (7 min).** Walk through the architecture diagram. Explain each component and the data flow. This is the core of a systems paper presentation.
3. **Key design insight (5 min).** What is the core technical idea? Why does it work? What hardware feature or algorithmic insight enables it?
4. **Evaluation highlights (5 min).** Present the most important performance results. Discuss both wins and losses.
5. **Critical analysis (5 min).** Your evaluation: What are the strengths and limitations? What workloads are missing? What hardware assumptions limit generality?
6. **Discussion and open questions (3 min).** Connections to other systems, potential extensions, deployment considerations.

### Presentation Tips

- **Show the architecture diagram early.** The audience needs a mental model of the system before they can understand the details.
- **Explain the hardware.** Not everyone knows the difference between NVLink and PCIe, or why shared memory matters. Provide enough context.
- **Focus on the "why," not the "what."** Do not just say "they use tiling." Explain why tiling helps: it keeps data in shared memory, reducing HBM traffic by a factor of the tile size.
- **Read the numbers critically.** When presenting performance tables, point out where the system loses and discuss why.
- **Connect to your audience's work.** If labmates work on related systems, draw explicit connections.

### Good Discussion Questions

- "What would happen if you ran this on a different GPU (e.g., H100 instead of A100)?"
- "At what batch size or sequence length does this optimization stop helping?"
- "How would this system interact with torch.compile or other compiler optimizations?"
- "What is the deployment overhead (compilation time, configuration complexity)?"
- "Is the speedup worth the implementation complexity?"

---

## Paper Summary Template

Use this template for every systems paper you read at Pass 2 depth or beyond.

```markdown
# [Paper Title]

**Authors:** [Names]
**Venue:** [Conference/Journal, Year]
**Link:** [URL]
**Date Read:** [YYYY-MM-DD]
**Pass Depth:** [1 / 2 / 3]

## Bottleneck Addressed
[One paragraph: What performance bottleneck does this paper target? What is the evidence?]

## System Design
[One paragraph: What is the system architecture? What is the key design insight?]

## Hardware and Software
[GPU model, interconnect, CUDA version, framework version, other relevant configuration]

## Key Performance Numbers
[List the 3-5 most important performance results with specific numbers]

## Strengths
- [Bullet points focusing on systems contributions]

## Weaknesses
- [Bullet points: missing baselines, limited hardware, narrow workloads]

## Hardware Dependencies
- [What hardware features does this system depend on?]
- [Would it work on different hardware?]

## Connections
- [How does this relate to other systems you know?]
- [Potential applications to your own work]

## Key Takeaways
- [2-3 bullet points: What will you remember in 6 months?]

## BibTeX
@inproceedings{...}
```

---

## Staying Current

The ML systems literature evolves rapidly. Hardware generations change every 2 years, and systems that are state-of-the-art today may be obsolete tomorrow.

### Daily/Weekly Habits (30-60 min/day)

- **ArXiv scanning.** Follow cs.LG, cs.DC, cs.PF, and cs.AR on arXiv. Use Semantic Scholar alerts for keywords: "GPU optimization," "distributed training," "inference serving," "ML compiler."
- **Twitter/X and Bluesky.** Follow systems researchers and GPU performance engineers. Systems results often appear on social media before papers.
- **Industry blogs.** Follow NVIDIA Developer Blog, PyTorch Blog, Meta AI Infrastructure, Google AI Infrastructure.
- **Paper reading groups.** Attend at least one weekly reading group focused on systems papers.

### Monthly Habits

- **Conference proceedings.** Skim accepted paper lists for MLSys, OSDI, SOSP, EuroSys, ASPLOS, ISCA, NeurIPS Systems Track.
- **Release notes.** Read release notes for PyTorch, CUDA, Triton, vLLM, TensorRT-LLM, and DeepSpeed. Performance improvements are often in the release notes, not in papers.
- **Reproduce a benchmark.** Run a benchmark from a recent paper on your hardware. The numbers will not match (different hardware, software versions, workloads) and understanding why is educational.

### Prioritization Heuristic

| Priority | Criteria | Pass Depth |
|---|---|---|
| **Must read** | Directly relevant to your system/hardware; from MLSys/OSDI/SOSP; widely adopted | Pass 3 |
| **Should read** | Adjacent systems area; introduces techniques you might use | Pass 2 |
| **Good to know** | Interesting but different hardware or workload | Pass 1 |
| **Skip** | Incremental; different hardware generation; superseded by a newer system | -- |

---

## Common Red Flags

Be especially skeptical when you encounter:

- **No code release** for a systems paper claiming significant speedups
- **Evaluation only on synthetic workloads** that do not reflect real model architectures
- **Comparison against only the authors' own prior system** rather than community baselines
- **Missing hardware details** (GPU model, interconnect, driver version, CUDA version)
- **Speedups reported only as percentages** without absolute wall-clock times
- **No variance or error bars** on performance measurements
- **Different precision** (FP8 vs. FP16) or **different batch size** between the proposed system and baselines without clear disclosure
- **Compilation time or setup overhead** not mentioned or excluded from benchmarks
- **Results only at one scale** (single GPU, single model size, single sequence length)
- **Throughput reported without latency**, or vice versa, in a serving context

---

## Building Systems Research Taste

Reading systems papers is not just about extracting techniques; it is about developing judgment for what makes a good system.

Over time, you should build intuitions for:

- **What makes a bottleneck worth attacking** vs. what will be solved by the next hardware generation
- **When a custom kernel is justified** vs. when torch.compile will get close enough
- **Which optimizations compose** vs. which are mutually exclusive or interfere
- **Which benchmarks are meaningful** vs. which are misleading
- **When complexity is justified** vs. when a simpler system with 90% of the performance is the right engineering choice

This taste is developed by reading widely, benchmarking carefully, profiling your own code, and building real systems. There are no shortcuts, but deliberate practice in critical reading of systems papers accelerates the process.

---

## Recommended Meta-Resources

- S. Keshav, "How to Read a Paper," ACM SIGCOMM Computer Communication Review, 2007.
- T. Roscoe, "Writing Reviews for Systems Conferences," 2007.
- NVIDIA, "CUDA C++ Best Practices Guide" (for understanding GPU performance claims).
- NVIDIA, "Nsight Compute Kernel Profiling Guide" (for understanding profiling data in papers).
- J. Heiser, "Systems Benchmarking Crimes," SIGOPS, 2019 (common methodological errors in systems evaluation).
