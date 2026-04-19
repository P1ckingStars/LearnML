# Capstone Milestone 1: Problem Statement

**Due:** Week 5
**Weight:** 5% of capstone grade (2% of final course grade)
**Format:** 2-page document (USENIX template, excluding references)

---

## Overview

The purpose of this milestone is to ensure you have identified a well-defined systems bottleneck or design problem, surveyed the relevant literature, and formulated a concrete plan of attack. A strong problem statement is the foundation of a successful systems research project. This milestone also serves as an early checkpoint: if your scope is too broad, too narrow, or insufficiently grounded in real performance data, the instructor can redirect you before significant effort is invested.

Unlike algorithm-focused research, ML systems projects must be motivated by concrete performance evidence. Your proposal must include preliminary profiling data or performance measurements that demonstrate the bottleneck you intend to address.

---

## Deliverables

### 1. Problem Statement Document (2 pages + references)

Your document must contain the following sections:

#### Research Question

State your research question clearly and precisely in 1-3 sentences. A good systems research question is:

- **Specific:** Not "make training faster" but "reduce the memory overhead of optimizer states in FSDP by 40% for 7B-parameter models through selective state sharding without degrading convergence."
- **Measurable:** You should be able to determine, at the end of the project, whether you answered the question. Define target metrics (latency, throughput, memory, accuracy).
- **Grounded:** The bottleneck must be real, demonstrated by profiling data, not hypothetical.
- **Feasible:** You should be able to make meaningful progress in 15 weeks with your available hardware and compute budget.

#### Motivation and Bottleneck Analysis

In 1-2 paragraphs, explain why this problem matters. Include:

- **Who is affected:** What practitioners, workloads, or hardware configurations encounter this bottleneck?
- **Quantitative evidence:** Present profiling data, roofline analysis, or published benchmarks that demonstrate the bottleneck. Show where time or memory is being spent.
- **Impact:** What would a solution enable? Faster training? Lower serving costs? Support for larger models on smaller hardware?

#### Related Work Survey

Summarize at least **10 relevant papers or systems** that contextualize your research question. For each, provide:

- A 2-3 sentence summary of the key contribution
- How it relates to your proposed work
- What gap or limitation it leaves that your project addresses

Organize the related work thematically, not as a flat list. Identify 2-3 threads in the literature (e.g., "kernel-level optimizations," "compiler-level approaches," "algorithmic approximations") and explain how your work fits into the landscape.

#### Proposed Approach

Describe your planned approach in sufficient detail that a knowledgeable reader could assess feasibility. Include:

- **High-level strategy:** What layer of the stack are you targeting (kernel, runtime, compiler, distributed)? What type of contribution (new system, optimization, benchmark)?
- **Key technical ideas:** What is the core insight? What makes your approach different from prior work?
- **Baselines:** What will you compare against? Include specific systems, libraries, or configurations.
- **Workloads and evaluation:** What models and datasets will you use? What metrics will you report (throughput, latency, memory, accuracy, scaling efficiency)?
- **Hardware configuration:** What GPUs, interconnect, and cluster configuration will you use?
- **Expected challenges:** What are the main risks? What might not work?

#### Expected Contributions

In a bulleted list, state 2-4 concrete contributions you expect to make. For example:

- "A fused Triton kernel for grouped-query attention that achieves 1.3x throughput over FlashAttention-2 for batch sizes under 8."
- "A comprehensive comparison of 5 KV cache eviction policies across 3 model sizes and 4 context lengths, identifying the Pareto frontier."
- "An automatic parallelism planner that selects near-optimal 3D parallelism configurations within 5% of exhaustive search in under 10 seconds."

#### Timeline

Provide a week-by-week plan from Week 5 to Week 20:

| Week | Planned Activity |
|---|---|
| 5-6 | [Specific tasks] |
| 7-8 | [Specific tasks] |
| 9-10 | [Specific tasks] |
| 11-12 | [Specific tasks] |
| 13-14 | [Specific tasks] |
| 15-16 | [Specific tasks] |
| 17-18 | [Specific tasks] |
| 19-20 | [Specific tasks] |

Include buffer time for unexpected delays. Systems projects are especially prone to hardware issues, driver bugs, and cluster availability problems -- plan for these.

### 2. Team Formation (if applicable)

If working in a team, submit:

- Team member names and email addresses
- A brief statement of each member's relevant background and skills (e.g., CUDA experience, compiler background, distributed systems knowledge)
- Planned division of responsibilities

### 3. Preliminary Profiling Data

Provide initial profiling evidence for the bottleneck you intend to address. This may include:

- PyTorch Profiler traces showing time breakdown
- Nsight Compute or Nsight Systems profiles
- Roofline analysis for the target workload
- Published benchmark data with your own analysis

The profiling data need not be exhaustive, but it must demonstrate that the bottleneck is real and that you know how to measure it.

### 4. Preliminary Literature Collection

Provide a BibTeX file or reference list with at least 15 papers you plan to read (this is a superset of the 10 you summarize in the document). You do not need to have read all 15 yet, but you should have identified them.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Research Question** | 20% | Question is clear, specific, measurable, and grounded in real performance data. It is neither too broad nor too narrow. |
| **Bottleneck Analysis** | 20% | Profiling data or quantitative evidence is presented. The bottleneck is real, not hypothetical. The motivation is compelling. |
| **Related Work** | 20% | At least 10 papers/systems are surveyed. Summaries are accurate and informative. The survey identifies a clear gap that the project addresses. Organization is thematic. |
| **Proposed Approach** | 25% | The plan is technically sound and feasible. Baselines are appropriate. Workloads and metrics are well-chosen. Hardware requirements are realistic. Risks are acknowledged. |
| **Writing and Planning** | 15% | Document is clear, well-organized, and professional. Timeline is realistic and specific. Milestones are concrete. Buffer time is included. |

---

## Feedback Process

After submission, you will receive:

1. **Written feedback** from the instructor or a TA within one week, covering:
   - Assessment of scope and feasibility
   - Suggestions for baselines or benchmarks you may have missed
   - Concerns about the proposed approach or hardware requirements
   - Recommendations for adjustments

2. **A brief meeting** (15 minutes) with the instructor or TA to discuss feedback and refine the plan. Sign up for a slot on the course calendar.

You are expected to incorporate this feedback into your subsequent milestones. Ignoring feedback without justification will be penalized in later milestones.

---

## Common Issues and How to Avoid Them

### Problem Too Broad

- Bad: "Optimize distributed training."
- Better: "Reduce AllReduce communication overhead for gradient synchronization in data-parallel training of 7B-parameter models on 8xA100 by overlapping communication with backward computation."
- Fix: Add constraints (specific hardware, specific model size, specific metric target).

### Problem Too Narrow

- Bad: "Tune the number of Triton warps for a single kernel."
- Better: "Develop an auto-tuning framework for Triton kernels that explores warp count, tile size, and pipeline depth jointly, reducing tuning time by 10x compared to grid search."
- Fix: Ensure the contribution generalizes beyond a single configuration.

### No Profiling Evidence

- Bad: "I think attention is slow because the paper says O(n^2)."
- Better: "Profiling LLaMA-7B inference with batch size 1 and context length 4096 shows that 62% of time is spent in attention, with memory bandwidth utilization at only 34% of peak."
- Fix: Run a profiler. Attach the output.

### Missing Baselines

- Bad: "We will show our kernel is fast."
- Better: "We will compare against cuBLAS GEMM, FlashAttention-2, and the default torch.compile output on three model architectures."
- Fix: Always define what you are comparing against before you start.

### Unrealistic Timeline

- Bad: "Weeks 5-18: implement and benchmark. Week 19: write paper."
- Better: See the template above with specific weekly tasks.
- Fix: Allocate at least 4 weeks for writing and revision. Writing always takes longer than you expect.

---

## Submission

Submit via the course portal by **Week 5, Friday 11:59 PM**:

1. Problem statement document as PDF (USENIX format, 2 pages + references)
2. Profiling data (screenshots, traces, or a short profiling report appendix)
3. BibTeX file or reference list (15+ papers)
4. Team formation document (if applicable)
