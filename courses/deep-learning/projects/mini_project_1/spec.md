# Mini-Project 1: Transformer Language Model

**Course:** Deep Learning (PhD Track)
**Due:** Week 8
**Weight:** 10% of final grade
**Format:** Individual

---

## Overview

In this project, you will build a transformer-based language model from scratch and conduct a systematic ablation study to understand how architectural choices affect model performance. The goal is not merely to reproduce existing results but to develop a deep, empirical understanding of transformer design decisions and their interactions.

You will train your models on a standard text corpus and produce a conference-quality report documenting your findings.

---

## Objectives

1. Implement a decoder-only transformer language model without relying on high-level library abstractions (e.g., `nn.TransformerDecoder` is not permitted; you must implement multi-head attention, positional encoding, and the feedforward blocks yourself).
2. Train the model on WikiText-103 or a comparable text corpus (e.g., OpenWebText subset, C4 subset).
3. Conduct a rigorous ablation study varying key architectural hyperparameters.
4. Analyze results and write a clear, well-structured report.

---

## Technical Requirements

### Model Architecture

Your transformer language model must include:

- **Token embedding layer** with tied input/output embeddings
- **Positional encoding** (sinusoidal or learned; you may also experiment with RoPE or ALiBi as an extension)
- **Multi-head causal self-attention** implemented from scratch
- **Position-wise feedforward network** with configurable hidden dimension
- **Layer normalization** (pre-norm or post-norm; document your choice)
- **Residual connections**
- **Dropout** for regularization

You may use PyTorch primitives (`nn.Linear`, `nn.LayerNorm`, `nn.Embedding`, etc.) but must compose the transformer architecture yourself.

### Ablation Study

You must systematically vary the following hyperparameters and report results for each configuration:

| Hyperparameter | Values to Test |
|---|---|
| Number of layers (depth) | 2, 4, 6, 8 |
| Model dimension (width) | 128, 256, 512 |
| Number of attention heads | 2, 4, 8 |

This yields up to 36 configurations. You are not required to run all 36 if compute is limited, but you must:

- Run at least **18 configurations** covering the full range of each hyperparameter
- Hold other hyperparameters constant when varying one dimension (controlled experiments)
- Justify any configurations you omit

Additional hyperparameters to hold fixed (or optionally vary as extensions):

- Context length: 256 or 512 tokens
- Feedforward hidden dimension: 4x model dimension
- Learning rate: use a sweep or standard schedule (warmup + cosine decay)
- Batch size: choose based on available compute
- Training tokens: at least 100M tokens per run (adjust if compute-constrained, but document)

### Training Details

- **Optimizer:** AdamW with weight decay
- **Learning rate schedule:** Linear warmup (e.g., 2000 steps) followed by cosine decay
- **Gradient clipping:** max norm 1.0
- **Mixed precision:** encouraged (FP16/BF16) for efficiency
- **Reproducibility:** set random seeds; report hardware and training time per configuration

### Evaluation

- **Primary metric:** Perplexity on the WikiText-103 validation and test sets
- **Secondary metrics:** bits-per-character (BPC) if applicable, training loss curves
- **Qualitative:** Include generated text samples from your best model (temperature 0.7 and 1.0, top-k and nucleus sampling)

---

## Deliverables

### 1. Report (NeurIPS Format, 6 pages max)

Your report must follow the NeurIPS 2024 LaTeX template and include:

1. **Abstract** (150 words max): Summarize your study and key findings.
2. **Introduction**: Motivation for the ablation study, brief background on transformers, research questions.
3. **Model Architecture**: Clear description with a figure. Specify every architectural choice.
4. **Experimental Setup**: Dataset, preprocessing, tokenization, training procedure, hardware, compute budget.
5. **Results and Analysis**:
   - Perplexity table for all configurations tested
   - Training/validation perplexity curves (select representative configurations)
   - Analysis of how depth, width, and number of heads independently and jointly affect performance
   - Parameter count vs. performance analysis (efficiency frontier)
   - At least one insight or surprising finding
6. **Generated Text Samples**: From your best model under different decoding strategies.
7. **Conclusion**: Summary of findings, limitations, future directions.
8. **References**

The 6-page limit excludes references and an optional appendix (2 pages max for supplementary figures/tables).

### 2. Code Submission

- Clean, well-documented Python code
- `README.md` with instructions to reproduce all experiments
- Configuration files for each ablation run
- Training and evaluation scripts
- A `requirements.txt` or `environment.yml`

### 3. Trained Model Checkpoint

- Checkpoint for your best-performing model
- Script to load and generate text from the checkpoint

---

## Milestones

### Week 6: Proposal + Initial Implementation (5% of project grade)

Submit a 1-page proposal including:

- Dataset choice and preprocessing plan
- Model architecture diagram
- Ablation study plan (which configurations, in what order)
- Compute budget estimate
- Evidence of a working forward pass (screenshot or log showing loss decreasing for at least 100 steps)

### Week 8: Final Report + Code (95% of project grade)

Submit the full report, code, and checkpoint as described above.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Implementation Correctness** | 30% | Model architecture is correct and faithful to the transformer specification. Attention masking is properly causal. Training loop is bug-free. Code is clean and readable. |
| **Experimental Design** | 25% | Ablation study is well-structured with proper controls. Sufficient configurations are tested. Training is run long enough for meaningful comparisons. Hyperparameters are documented. |
| **Analysis Quality** | 25% | Results are thoroughly analyzed, not merely reported. Trends are identified and explained. Parameter efficiency is discussed. At least one non-obvious insight is presented. Limitations are acknowledged. |
| **Writing Quality** | 20% | Report is clear, concise, and well-organized. Figures and tables are properly formatted and informative. Related work is appropriately cited. The report reads as a coherent scientific document. |

### Grade Descriptors

- **A (90-100%):** Correct implementation with insightful analysis. Report is of near-publishable quality. Ablation study reveals non-trivial interactions between hyperparameters.
- **B (80-89%):** Correct implementation with solid analysis. Report is well-written. Ablation is thorough but analysis may lack depth.
- **C (70-79%):** Implementation works but may have minor issues. Analysis is superficial. Report is adequate but not polished.
- **D/F (<70%):** Significant implementation bugs. Missing or incomplete ablation. Report is poorly written or incomplete.

---

## Helpful Guidance

### Getting Started

1. Start with the smallest configuration (2 layers, 128 dim, 2 heads) and verify it trains correctly.
2. Implement logging early (use Weights & Biases, TensorBoard, or similar).
3. Write your evaluation code before running the full ablation.
4. Budget your compute: estimate time per configuration and plan accordingly.

### Common Pitfalls

- **Forgetting causal masking:** This will silently produce artificially low perplexity. Verify your attention mask is correct.
- **Not normalizing perplexity correctly:** Ensure you compute perplexity over the same tokenization for all models.
- **Training too briefly:** Undertrained models make ablation comparisons meaningless. Ensure all models reach a reasonable degree of convergence.
- **Ignoring parameter count:** A 512-dim, 8-layer model has far more parameters than a 128-dim, 2-layer model. Discuss efficiency, not just raw perplexity.
- **Cherry-picking generated samples:** Show representative samples, not just the best ones.

### Suggested Reading

- Vaswani et al., "Attention Is All You Need" (2017)
- Radford et al., "Language Models are Unsupervised Multitask Learners" (GPT-2, 2019)
- Kaplan et al., "Scaling Laws for Neural Language Models" (2020)
- Xiong et al., "On Layer Normalization in the Transformer Architecture" (2020)
- Su et al., "RoFormer: Enhanced Transformer with Rotary Position Embedding" (2021)

### Compute Expectations

On a single modern GPU (A100 or equivalent):

- Smallest configuration (2L, 128d, 2h): approximately 1-2 hours
- Largest configuration (8L, 512d, 8h): approximately 8-12 hours
- Full ablation (18+ runs): approximately 50-100 GPU-hours

Plan accordingly. If you have limited compute, prioritize breadth (more configurations, shorter training) over depth (fewer configurations, longer training), but ensure models are trained long enough to be comparable.

---

## Academic Integrity

- You must implement the transformer architecture yourself. Using pre-built transformer modules from libraries (HuggingFace, fairseq, etc.) is not permitted.
- You may use standard utilities: data loaders, tokenizers, optimizers, logging tools.
- Cite any code you reference or adapt.
- Your report must be your own writing. LLM-assisted writing is permitted for editing and polishing but not for generating analytical content.

---

## Submission

Submit via the course portal by **Week 8, Friday 11:59 PM**:

1. Report as PDF (NeurIPS format)
2. Code as a zip archive or link to a private repository
3. Best model checkpoint (upload or provide download link)
4. A `README.md` with reproduction instructions
