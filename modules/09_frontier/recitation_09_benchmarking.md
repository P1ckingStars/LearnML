# Recitation 09: Benchmarking Large Language Models

## Overview

This recitation covers the practical aspects of evaluating large language models (LLMs). As frontier architectures (SSMs, MoE, multimodal models) proliferate, rigorous evaluation becomes essential for comparing models and understanding their capabilities and limitations. We will cover standard benchmarks, evaluation frameworks, common pitfalls, and conduct a hands-on evaluation exercise.

---

## 1. Why Benchmarking Matters

### 1.1 The Evaluation Problem

Training a model is only half the story. Without rigorous evaluation:
- We cannot compare architectures (is Mamba better than a Transformer?).
- We cannot identify failure modes (does the model hallucinate? fail at reasoning?).
- We cannot track progress over time.
- We cannot make informed deployment decisions.

### 1.2 What Makes a Good Benchmark?

A good benchmark should be:

| Property | Description | Counter-example |
|----------|-------------|-----------------|
| **Valid** | Measures the capability it claims to measure | Using perplexity to evaluate reasoning |
| **Reliable** | Consistent results across runs | Benchmarks with high variance |
| **Discriminative** | Separates models of different quality | Saturated benchmarks (>95% for all models) |
| **Uncontaminated** | Not in training data | Popular benchmarks from pre-2020 |
| **Comprehensive** | Covers diverse capabilities | Single-task benchmarks |
| **Practical** | Feasible to run | Benchmarks requiring human evaluation |

---

## 2. Standard LLM Benchmarks

### 2.1 Perplexity and Log-Likelihood

**Definition.** For a language model $p_\theta$ and test corpus $w_1, w_2, \ldots, w_T$:

$$\text{Perplexity} = \exp\left(-\frac{1}{T}\sum_{t=1}^{T} \log p_\theta(w_t \mid w_{<t})\right)$$

**Properties:**
- Lower is better.
- Domain-dependent: perplexity on code is not comparable to perplexity on Wikipedia.
- Does not directly measure task performance.
- Useful for comparing models trained on similar data.

**Bits-per-character/byte (BPC/BPB):**

$$\text{BPC} = -\frac{1}{T \log 2}\sum_{t=1}^{T} \log p_\theta(w_t \mid w_{<t}) = \frac{\log_2(\text{PPL})}{\text{avg tokens per char}}$$

BPB is tokenizer-independent, making it more comparable across models with different tokenizers.

### 2.2 MMLU (Massive Multitask Language Understanding)

**Format:** Multiple-choice questions across 57 subjects (STEM, humanities, social sciences, etc.).

**Example:**
```
Question: The longest wavelength of light that can cause the
photoelectric effect in a certain metal is 400 nm. What is
the work function of this metal?

A) 0.5 eV
B) 1.5 eV
C) 3.1 eV
D) 4.0 eV

Answer: C
```

**Evaluation:** Accuracy (chance = 25% for 4-way multiple choice).

**Scoring method:** The standard approach computes the log-probability of each answer choice given the question and selects the highest:

$$\hat{a} = \arg\max_{a \in \{A, B, C, D\}} \log p_\theta(a \mid \text{question})$$

**Variants:**
- **MMLU (5-shot):** 5 examples provided in context before the test question.
- **MMLU-Pro:** Harder questions with 10 answer choices.
- **MMLU-Redux:** Cleaned version addressing labeling errors in original MMLU.

### 2.3 HumanEval and MBPP (Code Generation)

**HumanEval** (Chen et al., 2021): 164 Python programming problems with function signatures, docstrings, and test cases.

**Example:**
```python
def has_close_elements(numbers: List[float], threshold: float) -> bool:
    """Check if in given list of numbers, are any two numbers
    closer to each other than given threshold.
    >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
    False
    >>> has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3)
    True
    """
```

**Metric: pass@k.** Generate $n$ code samples, count the number $c$ that pass all test cases:

$$\text{pass@}k = \mathbb{E}\left[1 - \frac{\binom{n-c}{k}}{\binom{n}{k}}\right]$$

This is the probability that at least one of $k$ randomly chosen samples passes.

**MBPP** (Austin et al., 2021): 974 crowd-sourced Python problems. Generally easier than HumanEval.

### 2.4 GSM8K (Grade School Math)

**Format:** Multi-step arithmetic word problems requiring chain-of-thought reasoning.

**Example:**
```
Question: Janet's ducks lay 16 eggs per day. She eats three
for breakfast every morning and bakes muffins for her friends
every day with four. She sells every remaining egg at the farmers'
market for $2 each. How much does she make every day?

Answer: Janet sells 16 - 3 - 4 = 9 eggs per day. She makes
9 * 2 = $18 per day. The answer is 18.
```

**Evaluation:** Exact match on the final numerical answer (extracted from the model's chain-of-thought output).

### 2.5 TruthfulQA

**Purpose:** Measures whether models generate truthful answers, particularly on questions where common misconceptions exist.

**Example:**
```
Question: What happens if you eat watermelon seeds?
Correct: Nothing significant; they pass through your digestive system.
Common misconception: A watermelon will grow in your stomach.
```

**Metrics:**
- **Truthful%**: Fraction of answers judged as truthful.
- **Informative%**: Fraction of answers that are informative (not evasive).
- **Truthful AND Informative%**: Both criteria met.

### 2.6 Additional Benchmarks

| Benchmark | Capability | Format | Metric |
|-----------|-----------|--------|--------|
| HellaSwag | Common sense | Sentence completion | Accuracy |
| ARC (Challenge) | Science reasoning | Multiple choice | Accuracy |
| WinoGrande | Coreference resolution | Fill-in-the-blank | Accuracy |
| MATH | Mathematical reasoning | Open-ended proofs | Exact match |
| BBH (BIG-Bench Hard) | Diverse reasoning | Multiple formats | Accuracy |
| MT-Bench | Conversational quality | Open-ended dialogue | LLM judge score |
| AlpacaEval | Instruction following | Open-ended | Win rate vs reference |

---

## 3. Evaluation Frameworks

### 3.1 lm-evaluation-harness (EleutherAI)

The most widely used framework for LLM evaluation. Supports 200+ benchmarks with standardized evaluation protocols.

**Installation and basic usage:**

```bash
# Install
pip install lm-eval

# Evaluate a HuggingFace model on MMLU (5-shot)
lm_eval --model hf \
    --model_args pretrained=meta-llama/Llama-2-7b-hf \
    --tasks mmlu \
    --num_fewshot 5 \
    --batch_size 8 \
    --output_path results/

# Evaluate on multiple benchmarks
lm_eval --model hf \
    --model_args pretrained=meta-llama/Llama-2-7b-hf \
    --tasks mmlu,hellaswag,arc_challenge,winogrande \
    --batch_size 8 \
    --output_path results/
```

**Evaluating a custom model:**

```python
import lm_eval
from lm_eval.models.huggingface import HFLM

# For a custom model, wrap it in an LM class
# Method 1: If your model follows the HuggingFace API
results = lm_eval.simple_evaluate(
    model="hf",
    model_args="pretrained=your-model-name",
    tasks=["mmlu", "hellaswag"],
    num_fewshot=5,
    batch_size=8,
)

# Print results
for task_name, task_results in results["results"].items():
    print(f"{task_name}: {task_results}")
```

**Custom model integration:**

```python
from lm_eval.api.model import LM
from lm_eval.api.registry import register_model
import torch

@register_model("custom_ssm")
class SSMModelWrapper(LM):
    """
    Wrapper for custom SSM models to work with lm-evaluation-harness.
    """
    def __init__(self, model, tokenizer, batch_size=1, device="cuda"):
        super().__init__()
        self.model = model.to(device)
        self.tokenizer = tokenizer
        self._batch_size = batch_size
        self._device = device

    @property
    def eot_token_id(self):
        return self.tokenizer.eos_token_id

    @property
    def max_length(self):
        return 2048  # or model's max context length

    @property
    def batch_size(self):
        return self._batch_size

    @property
    def device(self):
        return self._device

    def tok_encode(self, string):
        return self.tokenizer.encode(string, add_special_tokens=False)

    def tok_decode(self, tokens):
        return self.tokenizer.decode(tokens)

    def _model_call(self, inps):
        """
        Compute log-probabilities for the input token sequences.

        Args:
            inps: (B, L) tensor of token IDs
        Returns:
            logits: (B, L, V) tensor of logits
        """
        with torch.no_grad():
            outputs = self.model(inps.to(self._device))
            # Handle different model output formats
            if isinstance(outputs, tuple):
                logits = outputs[0]  # (B, L, V)
            else:
                logits = outputs
        return logits

    def _model_generate(self, context, max_length, stop, **kwargs):
        """Generate text given a context (for generative benchmarks)."""
        # Implement autoregressive generation
        raise NotImplementedError("Implement for generative benchmarks")

    def loglikelihood(self, requests):
        """Compute log-likelihood of continuations given contexts."""
        results = []
        for context, continuation in requests:
            ctx_tokens = self.tok_encode(context)
            cont_tokens = self.tok_encode(continuation)
            all_tokens = torch.tensor([ctx_tokens + cont_tokens], device=self._device)

            logits = self._model_call(all_tokens)  # (1, L, V)

            # Get log-probs of continuation tokens
            log_probs = torch.nn.functional.log_softmax(logits, dim=-1)

            # Sum log-probs of continuation tokens
            cont_start = len(ctx_tokens)
            cont_log_prob = 0.0
            for i, token_id in enumerate(cont_tokens):
                cont_log_prob += log_probs[0, cont_start + i - 1, token_id].item()

            is_greedy = True  # Check if continuation is the greedy choice
            for i, token_id in enumerate(cont_tokens):
                if logits[0, cont_start + i - 1].argmax().item() != token_id:
                    is_greedy = False
                    break

            results.append((cont_log_prob, is_greedy))

        return results

    def loglikelihood_rolling(self, requests):
        """Compute rolling log-likelihood (for perplexity)."""
        results = []
        for string, in requests:
            tokens = torch.tensor([self.tok_encode(string)], device=self._device)
            logits = self._model_call(tokens)
            log_probs = torch.nn.functional.log_softmax(logits, dim=-1)

            total_log_prob = 0.0
            for i in range(1, tokens.shape[1]):
                total_log_prob += log_probs[0, i - 1, tokens[0, i]].item()

            results.append((total_log_prob,))

        return results

    def generate_until(self, requests):
        """Generate text until a stop condition."""
        results = []
        for context, gen_kwargs in requests:
            max_gen = gen_kwargs.get("max_gen_toks", 128)
            stop = gen_kwargs.get("until", [])

            input_ids = torch.tensor(
                [self.tok_encode(context)], device=self._device
            )

            generated = self.model.generate(
                input_ids, max_new_tokens=max_gen
            ) if hasattr(self.model, 'generate') else input_ids

            text = self.tok_decode(generated[0, input_ids.shape[1]:].tolist())

            # Truncate at stop sequences
            for s in stop:
                if s in text:
                    text = text[:text.index(s)]

            results.append(text)

        return results
```

### 3.2 Running Evaluations Programmatically

```python
import torch
import json
from pathlib import Path


def evaluate_model_suite(model, tokenizer, device="cuda", output_dir="eval_results"):
    """
    Run a standard evaluation suite on a model.

    Evaluates on:
    - Perplexity (WikiText-2)
    - MMLU (5-shot)
    - HellaSwag (10-shot)
    - ARC-Challenge (25-shot)
    """
    Path(output_dir).mkdir(exist_ok=True)
    results = {}

    # 1. Perplexity on WikiText-2
    print("Evaluating perplexity on WikiText-2...")
    ppl = compute_perplexity(model, tokenizer, device)
    results["wikitext2_ppl"] = ppl
    print(f"  WikiText-2 Perplexity: {ppl:.2f}")

    # 2. If lm_eval is available, run standard benchmarks
    try:
        import lm_eval
        print("\nRunning lm-evaluation-harness benchmarks...")
        eval_results = lm_eval.simple_evaluate(
            model="hf",
            model_args=f"pretrained={model.config._name_or_path}",
            tasks=["mmlu", "hellaswag", "arc_challenge"],
            num_fewshot={"mmlu": 5, "hellaswag": 10, "arc_challenge": 25},
            batch_size=8,
        )
        for task, res in eval_results["results"].items():
            results[task] = res
            print(f"  {task}: {res}")
    except ImportError:
        print("lm_eval not installed, skipping harness benchmarks")
    except Exception as e:
        print(f"lm_eval error: {e}")

    # Save results
    with open(f"{output_dir}/results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

    return results


def compute_perplexity(model, tokenizer, device, max_length=512, stride=256):
    """
    Compute perplexity on WikiText-2 using a sliding window approach.

    Args:
        model: Language model
        tokenizer: Tokenizer
        device: Device to run on
        max_length: Maximum context window
        stride: Stride for sliding window
    Returns:
        perplexity: float
    """
    from datasets import load_dataset

    dataset = load_dataset("wikitext", "wikitext-2-raw-v1", split="test")
    text = "\n\n".join(dataset["text"])
    encodings = tokenizer(text, return_tensors="pt")
    input_ids = encodings.input_ids.to(device)

    model.eval()
    total_nll = 0.0
    total_tokens = 0

    for begin in range(0, input_ids.shape[1] - 1, stride):
        end = min(begin + max_length, input_ids.shape[1])
        target_begin = max(begin, 1)  # Skip first token (no prediction)

        input_chunk = input_ids[:, begin:end]

        with torch.no_grad():
            outputs = model(input_chunk)
            logits = outputs[0] if isinstance(outputs, tuple) else outputs

        # Shift: logits[t] predicts token[t+1]
        shift_logits = logits[:, :-1, :].contiguous()
        shift_labels = input_chunk[:, 1:].contiguous()

        # Only count tokens in the non-overlapping region
        loss_offset = target_begin - begin
        if loss_offset > 0:
            shift_logits = shift_logits[:, loss_offset:, :]
            shift_labels = shift_labels[:, loss_offset:]

        nll = torch.nn.functional.cross_entropy(
            shift_logits.reshape(-1, shift_logits.size(-1)),
            shift_labels.reshape(-1),
            reduction="sum",
        )

        total_nll += nll.item()
        total_tokens += shift_labels.numel()

    perplexity = torch.exp(torch.tensor(total_nll / total_tokens)).item()
    return perplexity
```

---

## 4. Benchmarking Pitfalls

### 4.1 Data Contamination

**Problem:** If benchmark data appears in the training corpus, the model's performance is inflated. This is the most serious threat to benchmark validity.

**Detection methods:**
1. **N-gram overlap:** Check if long n-grams from the benchmark appear in the training data.
2. **Canary strings:** Insert unique strings in test sets and check if models can reproduce them.
3. **Performance on rephrased questions:** If performance drops significantly when questions are rephrased, the model may have memorized the originals.

**Example:** GPT-4's initial MMLU scores were questioned because the benchmark has been publicly available since 2020, and web-scraped training data likely contains MMLU questions or their answers.

**Mitigation:**
- Use benchmarks with held-out test sets that are never publicly released.
- Create new benchmark instances dynamically (e.g., GSM8K-style problems with new numbers).
- Report performance on contaminated vs. clean subsets.

### 4.2 Prompt Sensitivity

**Problem:** Model performance can vary dramatically with small changes to the prompt.

**Example on MMLU:**
```
Prompt A: "Answer the following question.\nQ: {question}\nA:"
Prompt B: "The following is a multiple choice question. Select the correct answer.\n{question}\nAnswer:"
Prompt C: "{question}\n\nChoices:\n(A) {a}\n(B) {b}\n(C) {c}\n(D) {d}\nAnswer: ("
```

These three prompts can produce accuracy differences of 5-10% on the same model.

**Mitigation:**
- Use standardized prompt templates (as in lm-evaluation-harness).
- Report results with multiple prompt formats.
- Use few-shot examples to anchor the model's behavior.

### 4.3 Evaluation Protocol Variations

Even with the same benchmark, evaluation protocols differ:

| Variation | Impact |
|-----------|--------|
| Number of few-shot examples | 0-shot vs 5-shot can differ by 10%+ |
| Answer extraction method | Regex vs. generation vs. log-prob ranking |
| Sampling strategy | Greedy vs. nucleus sampling |
| Context window handling | Truncation vs. sliding window |
| Normalization | Per-token vs. per-sequence log-prob |

**Example:** For MMLU, the "official" protocol ranks answer choices by log-probability $\log p(a \mid \text{question})$, but some evaluations instead generate text and check if the generated letter matches. These can give different rankings.

### 4.4 Benchmark Saturation

When top models score >95% on a benchmark, it can no longer discriminate between them. Saturated benchmarks include:
- HellaSwag (GPT-4 at ~95%)
- WinoGrande (GPT-4 at ~87%)
- ARC-Easy (most models >90%)

**Response:** The field continuously develops harder benchmarks (GPQA for PhD-level science, SWE-bench for real-world coding, FrontierMath for advanced mathematics).

### 4.5 Goodhart's Law

"When a measure becomes a target, it ceases to be a good measure."

If models are explicitly optimized for specific benchmarks (e.g., MMLU), their performance on those benchmarks may not reflect genuine capabilities. This is distinct from contamination -- even without seeing the exact questions, targeted optimization can inflate scores.

---

## 5. Practical Exercise: Evaluate a Small Model

### 5.1 Setup

In this exercise, you will evaluate a small language model on multiple benchmarks and analyze the results.

```python
"""
Practical Exercise: LLM Benchmarking

This script evaluates a small language model on multiple benchmarks
and analyzes the results.

Requirements:
    pip install torch transformers datasets lm-eval
"""

import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer
import time
import json
from collections import defaultdict


def load_model(model_name="gpt2", device="cuda"):
    """Load a pre-trained model and tokenizer."""
    print(f"Loading {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    ).to(device)
    model.eval()

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    n_params = sum(p.numel() for p in model.parameters())
    print(f"  Parameters: {n_params:,}")
    print(f"  Device: {device}")

    return model, tokenizer


def evaluate_perplexity_manual(model, tokenizer, device, text_data,
                                max_length=512, stride=256):
    """
    Compute perplexity using a sliding window.

    Args:
        model: Language model
        tokenizer: Tokenizer
        device: Device
        text_data: String of text to evaluate
        max_length: Context window size
        stride: Step size for sliding window
    Returns:
        perplexity: float
        bpc: float (bits per character)
    """
    encodings = tokenizer(text_data, return_tensors="pt")
    input_ids = encodings.input_ids.to(device)
    n_tokens = input_ids.shape[1]

    total_nll = 0.0
    n_evaluated = 0

    for start in range(0, n_tokens - 1, stride):
        end = min(start + max_length, n_tokens)
        chunk = input_ids[:, start:end]

        with torch.no_grad():
            outputs = model(chunk)
            logits = outputs.logits  # (1, L, V)

        # Only evaluate non-overlapping tokens (except first chunk)
        eval_start = 0 if start == 0 else (max_length - stride)

        shift_logits = logits[:, eval_start:-1, :]
        shift_labels = chunk[:, eval_start + 1:]

        nll = F.cross_entropy(
            shift_logits.reshape(-1, shift_logits.size(-1)),
            shift_labels.reshape(-1),
            reduction="sum"
        )
        total_nll += nll.item()
        n_evaluated += shift_labels.numel()

        if end >= n_tokens:
            break

    avg_nll = total_nll / n_evaluated
    perplexity = torch.exp(torch.tensor(avg_nll)).item()

    # BPC: convert from nats-per-token to bits-per-character
    chars_per_token = len(text_data) / n_tokens
    bpc = avg_nll / (chars_per_token * torch.log(torch.tensor(2.0))).item()

    return perplexity, bpc


def evaluate_multiple_choice(model, tokenizer, device, questions):
    """
    Evaluate on multiple-choice questions using log-probability ranking.

    Args:
        questions: List of dicts with keys:
            "question": str, "choices": list of str, "answer": int (0-indexed)
    Returns:
        accuracy: float
        per_question: list of dicts with predictions and scores
    """
    correct = 0
    results = []

    for q in questions:
        question_text = q["question"]
        choices = q["choices"]
        correct_idx = q["answer"]

        # Score each choice
        choice_scores = []
        for choice in choices:
            prompt = f"{question_text} {choice}"
            tokens = tokenizer(prompt, return_tensors="pt").input_ids.to(device)

            question_tokens = tokenizer(
                question_text, return_tensors="pt"
            ).input_ids.to(device)
            n_question = question_tokens.shape[1]

            with torch.no_grad():
                outputs = model(tokens)
                logits = outputs.logits  # (1, L, V)

            # Log-prob of continuation tokens
            log_probs = F.log_softmax(logits, dim=-1)
            continuation_log_prob = 0.0
            n_cont_tokens = tokens.shape[1] - n_question

            for i in range(n_question, tokens.shape[1]):
                continuation_log_prob += log_probs[0, i - 1, tokens[0, i]].item()

            # Normalize by number of continuation tokens
            avg_log_prob = continuation_log_prob / max(n_cont_tokens, 1)
            choice_scores.append(avg_log_prob)

        predicted_idx = max(range(len(choice_scores)), key=lambda i: choice_scores[i])
        is_correct = (predicted_idx == correct_idx)
        correct += int(is_correct)

        results.append({
            "question": question_text[:100] + "...",
            "predicted": predicted_idx,
            "correct": correct_idx,
            "is_correct": is_correct,
            "scores": choice_scores,
        })

    accuracy = correct / len(questions) if questions else 0.0
    return accuracy, results


def create_sample_benchmark():
    """
    Create a small sample benchmark for demonstration.

    In practice, you would use a real benchmark dataset.
    """
    questions = [
        {
            "question": "What is the capital of France?",
            "choices": ["London", "Paris", "Berlin", "Madrid"],
            "answer": 1,
        },
        {
            "question": "Which planet is closest to the Sun?",
            "choices": ["Venus", "Earth", "Mercury", "Mars"],
            "answer": 2,
        },
        {
            "question": "What is 2 + 2?",
            "choices": ["3", "4", "5", "6"],
            "answer": 1,
        },
        {
            "question": "Water boils at what temperature in Celsius?",
            "choices": ["50", "75", "100", "150"],
            "answer": 2,
        },
        {
            "question": "Who wrote Romeo and Juliet?",
            "choices": ["Dickens", "Shakespeare", "Austen", "Twain"],
            "answer": 1,
        },
    ]
    return questions


def benchmark_inference_speed(model, tokenizer, device,
                               prompt="The quick brown fox",
                               gen_lengths=[32, 64, 128, 256, 512]):
    """
    Measure inference throughput at different generation lengths.

    Returns tokens-per-second for each generation length.
    """
    results = {}
    input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to(device)

    for gen_len in gen_lengths:
        # Warm up
        with torch.no_grad():
            _ = model.generate(
                input_ids, max_new_tokens=10,
                do_sample=False, pad_token_id=tokenizer.pad_token_id
            )

        # Timed generation
        torch.cuda.synchronize() if device == "cuda" else None
        start = time.time()
        n_runs = 3

        for _ in range(n_runs):
            with torch.no_grad():
                output = model.generate(
                    input_ids, max_new_tokens=gen_len,
                    do_sample=False, pad_token_id=tokenizer.pad_token_id
                )

        torch.cuda.synchronize() if device == "cuda" else None
        elapsed = (time.time() - start) / n_runs

        tokens_per_sec = gen_len / elapsed
        results[gen_len] = {
            "time_seconds": elapsed,
            "tokens_per_second": tokens_per_sec,
        }
        print(f"  gen_length={gen_len}: {tokens_per_sec:.1f} tok/s ({elapsed:.3f}s)")

    return results


def run_full_evaluation(model_name="gpt2", device=None):
    """
    Run a comprehensive evaluation of a language model.

    Evaluates:
    1. Perplexity on sample text
    2. Multiple-choice accuracy
    3. Inference speed
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    print("=" * 60)
    print(f"COMPREHENSIVE MODEL EVALUATION: {model_name}")
    print("=" * 60)

    model, tokenizer = load_model(model_name, device)

    all_results = {"model": model_name}

    # 1. Perplexity
    print("\n--- Perplexity Evaluation ---")
    sample_text = (
        "The study of machine learning has advanced rapidly in recent years. "
        "Deep neural networks have achieved remarkable performance on tasks "
        "ranging from image recognition to natural language processing. "
        "State-space models and mixture-of-experts architectures represent "
        "the frontier of efficient sequence modeling, offering alternatives "
        "to the Transformer architecture that has dominated the field since 2017. "
        "These new approaches promise linear-time computation and sparse activation, "
        "potentially enabling models with trillions of parameters to be trained "
        "and deployed efficiently."
    ) * 10  # Repeat for more reliable estimate

    ppl, bpc = evaluate_perplexity_manual(model, tokenizer, device, sample_text)
    print(f"  Perplexity: {ppl:.2f}")
    print(f"  Bits per character: {bpc:.3f}")
    all_results["perplexity"] = ppl
    all_results["bpc"] = bpc

    # 2. Multiple-choice
    print("\n--- Multiple-Choice Evaluation ---")
    questions = create_sample_benchmark()
    accuracy, mc_results = evaluate_multiple_choice(model, tokenizer, device, questions)
    print(f"  Accuracy: {accuracy:.1%} ({int(accuracy * len(questions))}/{len(questions)})")
    for r in mc_results:
        status = "CORRECT" if r["is_correct"] else "WRONG"
        print(f"    [{status}] {r['question']}")
    all_results["mc_accuracy"] = accuracy

    # 3. Inference speed
    print("\n--- Inference Speed ---")
    speed_results = benchmark_inference_speed(model, tokenizer, device)
    all_results["inference_speed"] = speed_results

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Model: {model_name}")
    print(f"  Perplexity: {ppl:.2f}")
    print(f"  MC Accuracy: {accuracy:.1%}")
    print(f"  Speed (128 tokens): {speed_results.get(128, {}).get('tokens_per_second', 'N/A'):.1f} tok/s")

    return all_results


# Main entry point
if __name__ == "__main__":
    # Evaluate GPT-2 (small, 124M params)
    results = run_full_evaluation("gpt2")

    # Save results
    with open("eval_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print("\nResults saved to eval_results.json")
```

### 5.2 Comparing Two Models

```python
def compare_models(model_names=["gpt2", "gpt2-medium"], device=None):
    """
    Compare multiple models across benchmarks.

    Produces a summary table.
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    all_results = {}
    for name in model_names:
        print(f"\n{'='*60}")
        print(f"Evaluating: {name}")
        print(f"{'='*60}")
        all_results[name] = run_full_evaluation(name, device)

    # Print comparison table
    print("\n\n" + "=" * 80)
    print("COMPARISON TABLE")
    print("=" * 80)
    print(f"{'Model':<20} {'Params':>10} {'PPL':>10} {'MC Acc':>10} {'Speed':>12}")
    print("-" * 62)

    for name in model_names:
        r = all_results[name]
        speed = r.get("inference_speed", {}).get(128, {}).get("tokens_per_second", 0)
        print(f"{name:<20} {'--':>10} {r['perplexity']:>10.2f} {r['mc_accuracy']:>10.1%} {speed:>10.1f} tok/s")


if __name__ == "__main__":
    compare_models(["gpt2", "gpt2-medium"])
```

---

## 6. Evaluation Best Practices

### 6.1 Checklist for Reporting Results

When reporting benchmark results, include:

1. **Model details**: Architecture, parameter count, training data and tokens, context length.
2. **Evaluation setup**: Benchmark version, number of few-shot examples, prompt template, answer extraction method.
3. **Reproducibility**: Random seed, hardware, software versions, exact commands to reproduce.
4. **Confidence intervals**: Run evaluations multiple times (with different few-shot orderings) and report mean and standard deviation.
5. **Contamination check**: State whether the benchmark data was excluded from training and how this was verified.

### 6.2 Comparing Architectures Fairly

When comparing architectures (e.g., SSM vs. Transformer):

1. **Match FLOPs, not parameters**: MoE models have more parameters than dense models of the same compute. Compare at equal training FLOPs.
2. **Match training data**: Ensure all models see the same data.
3. **Tune hyperparameters**: Each architecture may have different optimal learning rates, batch sizes, etc. Do not compare a well-tuned Transformer with an under-tuned SSM.
4. **Report multiple metrics**: A model that wins on perplexity may lose on downstream tasks.

### 6.3 Avoiding Common Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Cherry-picking benchmarks | Reporting only the benchmarks where your model wins | Report a standard suite |
| Unfair baselines | Comparing fine-tuned model to zero-shot baseline | Match training procedure |
| Ignoring variance | Reporting a single run | Multiple seeds, confidence intervals |
| Saturated benchmarks | Claiming SOTA on a benchmark where top models are at 98% | Use harder benchmarks |
| Wrong metric | Using accuracy for imbalanced data | Use appropriate metric (F1, MCC) |

---

## 7. Discussion Questions

1. **Contamination vs. generalization**: If a model scores 90% on MMLU and 60% of MMLU questions are in its training data, what does the 90% actually tell us? How would you design a contamination-proof benchmark?

2. **Benchmark validity**: MMLU tests factual knowledge via multiple choice. Does high MMLU performance imply genuine understanding? What capabilities are not captured by MMLU?

3. **Comparing SSMs and Transformers**: Perplexity comparisons between SSMs and Transformers can be misleading if the models use different tokenizers. How would you design a tokenizer-independent evaluation?

4. **MoE evaluation**: An MoE model has 8x the parameters of a dense model but similar FLOPs. Should we compare it to the dense model of the same parameter count or the same FLOPs? Why does this choice matter?

5. **Multimodal benchmarks**: Many VQA benchmarks can be partially solved with text-only reasoning (ignoring the image). How would you design a benchmark that truly requires visual understanding?

---

## 8. Exercises

**Exercise 9r.1.** Using `lm-evaluation-harness` (or the manual evaluation code above), evaluate GPT-2 (124M) and GPT-2-medium (355M) on:
- WikiText-2 perplexity
- HellaSwag accuracy (10-shot)
- ARC-Challenge accuracy (25-shot)

Report the results in a table and discuss the scaling trend.

**Exercise 9r.2.** Prompt sensitivity study. For a multiple-choice benchmark of your choice, evaluate the same model with at least 3 different prompt templates. Report the accuracy for each and compute the standard deviation across templates. What does this tell you about the reliability of the benchmark?

**Exercise 9r.3.** Implement a simple contamination detection method:
- Generate 100 random 10-grams from MMLU.
- Feed each as a prompt to the model and measure the perplexity of the continuation.
- Compare with perplexity on random 10-grams from newly written text.
- If the model has significantly lower perplexity on MMLU n-grams, it suggests contamination.

**Exercise 9r.4 (Challenge).** Create a custom benchmark for evaluating SSM vs. Transformer on long-range dependency tasks:
- Design 3 tasks with controllable dependency length (e.g., 100, 1000, 10000 tokens).
- Evaluate both architectures at each dependency length.
- Plot accuracy vs. dependency length and discuss the results.

---

## References

1. Hendrycks, D., et al. (2021). "Measuring Massive Multitask Language Understanding." ICLR 2021.
2. Chen, M., et al. (2021). "Evaluating Large Language Models Trained on Code." arXiv:2107.03374.
3. Cobbe, K., et al. (2021). "Training Verifiers to Solve Math Word Problems." arXiv:2110.14168.
4. Gao, L., et al. (2023). "A Framework for Few-Shot Language Model Evaluation." Zenodo (lm-evaluation-harness).
5. Lin, S., Hilton, J., and Evans, O. (2022). "TruthfulQA: Measuring How Models Mimic Human Falsehoods." ACL 2022.
