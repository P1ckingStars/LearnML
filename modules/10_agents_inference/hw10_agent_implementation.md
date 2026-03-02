# Homework 10: Agents and Inference-Time Compute

**Estimated time: ~20 hours**

This homework covers the theoretical foundations and practical implementation of LLM agents, chain-of-thought reasoning, retrieval-augmented generation, and test-time compute scaling. It is divided into two equal parts: theoretical analysis (Part A) and implementation (Part B).

---

## Part A: Theory and Analysis (50%)

### Problem A.1: The Agent Loop as a POMDP (10%)

Consider an LLM agent with access to three tools: a calculator, a web search engine, and a Python code executor. The agent's task is to answer questions that may require any combination of these tools.

**(a)** (3%) Formally define the POMDP tuple $(\mathcal{S}, \mathcal{A}, \mathcal{O}, T, O, R, \gamma)$ for this agent. Be specific about what constitutes the state (including the information the agent cannot directly observe), the action space (including the format of tool calls), and the observation space.

**(b)** (3%) The agent's context window has a maximum length of $C$ tokens. Model the belief state as a distribution over $\mathcal{S}$ and show that after $t$ steps, the agent's effective belief state has fidelity:

$$\text{Fidelity}(b_t, b_t^*) \geq 1 - \frac{t \cdot \bar{o}}{C}$$

where $\bar{o}$ is the average observation length and $b_t^*$ is the true belief state with full history. State precisely what assumptions are needed for this bound.

**(c)** (4%) Design a **memory mechanism** that extends the agent beyond the context window limit. Formalize it as an augmented POMDP where the agent has an additional "write to memory" action and "read from memory" observation. Prove that this augmented agent can solve any POMDP that the original agent with unbounded context can solve, provided the memory has sufficient capacity. What is the minimum memory capacity needed?

### Problem A.2: Chain-of-Thought and Computational Complexity (10%)

**(a)** (4%) Prove that a transformer with $L$ layers, $H$ attention heads, head dimension $d_h$, and log-precision weights is contained in $\mathsf{TC}^0$. Your proof should explicitly:
1. Show that attention (matrix multiply, softmax, weighted sum) can be computed by $\mathsf{TC}^0$ circuits.
2. Show that the FFN layers (matrix multiply, ReLU/GELU) can be computed by $\mathsf{TC}^0$ circuits.
3. Argue that the composition of $L$ such layers remains in $\mathsf{TC}^0$.

**(b)** (3%) Now consider a transformer generating $T$ chain-of-thought tokens autoregressively. Prove that the computational class of this system is at least as powerful as $\mathsf{DTIME}(T \cdot \text{poly}(n))$ where $n$ is the input length. Specifically, show that such a system can simulate a Turing machine running for $T$ steps on input of length $n$.

**(c)** (3%) Graph connectivity is in $\mathsf{L}$ (logspace) but is believed to be outside $\mathsf{TC}^0$. Construct an explicit CoT trace that solves $s$-$t$ connectivity on a graph with $n$ nodes and $m$ edges. Your trace should:
1. Have length $O(n^2)$ tokens.
2. Be verifiable in $O(n + m)$ time (i.e., each step can be checked locally).
3. Handle both connected and disconnected cases.

Write the CoT trace for the specific example graph: $V = \{1, 2, 3, 4, 5\}$, $E = \{(1,2), (2,3), (4,5)\}$, query: is 1 connected to 3?

### Problem A.3: Optimal Best-of-N Threshold (10%)

Consider best-of-$N$ sampling with a reward model $R$ that has the following error model: $R(y) = R^*(y) + \epsilon$ where $R^*(y)$ is the true quality and $\epsilon \sim \mathcal{N}(0, \sigma_\epsilon^2)$ independently for each sample.

**(a)** (3%) Derive the expected true quality of the selected sample as a function of $N$:

$$Q(N) = \mathbb{E}[R^*(\hat{y}_N)]$$

where $\hat{y}_N = \arg\max_{i \in [N]} R(y_i)$. Express your answer in terms of the true quality distribution $R^*(y) \sim \mathcal{N}(\mu, \sigma^2)$ and the noise $\sigma_\epsilon$.

*Hint*: The observed reward is $R(y) \sim \mathcal{N}(\mu, \sigma^2 + \sigma_\epsilon^2)$. The selected sample maximizes the observed reward, but its true quality regresses toward the mean.

**(b)** (4%) Derive the **optimal stopping criterion**: given that each sample costs $c$ units of compute and each unit of true quality is worth $v$ units of value, find the optimal $N^*$ that maximizes:

$$\text{Utility}(N) = v \cdot Q(N) - c \cdot N$$

Show that $N^*$ satisfies:

$$\frac{dQ}{dN}\bigg|_{N=N^*} = \frac{c}{v}$$

and derive a closed-form approximation for $N^*$.

**(c)** (3%) Now consider an **adaptive** best-of-$N$ strategy where after each sample, the agent decides whether to sample more or stop. Let $R_{\max}^{(k)} = \max_{i \leq k} R(y_i)$ be the best observed reward after $k$ samples. Derive the optimal stopping rule using the theory of optimal stopping (secretary problem variant):

$$\text{Stop at sample } k \text{ if } R_{\max}^{(k)} \geq \tau_k$$

where $\tau_k$ is a threshold that depends on the remaining budget. Express $\tau_k$ in terms of the value of continuing to sample.

### Problem A.4: Self-Consistency via Concentration Inequalities (10%)

**(a)** (3%) Let $a^*$ be the correct answer and suppose the model produces $a^*$ with probability $p > 1/2$ and any specific incorrect answer with probability at most $q < p$. Using Hoeffding's inequality, prove that self-consistency with $K$ samples achieves error probability:

$$P(\text{error}) \leq (|\mathcal{A}| - 1) \cdot \exp\left(-2K(p - q)^2\right)$$

where $|\mathcal{A}|$ is the answer space size.

**(b)** (4%) Now suppose the chains are **not independent**: each pair of chains has correlation $\rho \geq 0$ in their correctness indicators. That is, $\text{Cov}(\mathbb{1}[a_i = a^*], \mathbb{1}[a_j = a^*]) = \rho \cdot p(1-p)$ for $i \neq j$.

Derive the variance of the vote count $V = \sum_k \mathbb{1}[a_k = a^*]$:

$$\text{Var}(V) = Kp(1-p)(1 + (K-1)\rho)$$

and use Chebyshev's inequality to bound the error probability. For what value of $\rho$ does self-consistency become no better than a single sample?

**(c)** (3%) Design a **diversified sampling** strategy that provably reduces $\rho$ below standard temperature sampling. Your strategy should:
1. Sample with different prompts/templates
2. Use different few-shot exemplars per chain
3. Formally model why this reduces correlation

Prove that your strategy achieves $\rho_{\text{diverse}} \leq \alpha \cdot \rho_{\text{standard}}$ for some $\alpha < 1$ under stated assumptions.

### Problem A.5: RAG Retrieval Quality Bounds (10%)

Consider a RAG system with corpus $\mathcal{D}$ of $N$ documents, a dual-encoder retriever with embedding dimension $d$, and top-$k$ retrieval.

**(a)** (3%) Define a relevance model: each query $q$ has a set of relevant documents $\text{Rel}(q) \subseteq \mathcal{D}$ with $|\text{Rel}(q)| = r$. The retriever has a **sensitivity** $\delta > 0$ such that for relevant documents, $\text{sim}(q, d) \geq \mu_+ $ and for irrelevant documents, $\text{sim}(q, d) \leq \mu_-$ where $\mu_+ - \mu_- = \delta$.

Prove that under this model, the top-$k$ retrieval achieves perfect recall (Recall@$k$ = 1) when:

$$k \geq r \quad \text{and} \quad \delta > 2\sigma_\epsilon \Phi^{-1}\left(1 - \frac{r}{2N}\right)$$

where $\sigma_\epsilon$ is the embedding noise and $\Phi^{-1}$ is the inverse normal CDF.

**(b)** (4%) Analyze the effect of **chunk size** on retrieval quality. Let the relevant information be a span of $s$ tokens within a document of length $D$ tokens. Chunks are of size $L$ with overlap $O$.

Derive the probability that the relevant span is fully contained in at least one chunk as a function of $s$, $L$, $O$, and $D$. Find the minimum $L$ that guarantees this probability is at least $1 - \delta$ for a given $\delta$.

**(c)** (3%) Prove that for the RAG pipeline with retriever recall $R_k$ and generator accuracy $G$ (given relevant context), the overall system accuracy satisfies:

$$\text{Acc}_{\text{RAG}} = R_k \cdot G + (1 - R_k) \cdot G_{\text{no\_context}}$$

where $G_{\text{no\_context}}$ is the generator's accuracy without relevant context. Under what conditions does RAG hurt compared to the generator alone (i.e., $\text{Acc}_{\text{RAG}} < G_{\text{no\_context}}$)?

---

## Part B: Implementation (50%)

### Problem B.1: ReAct Agent with Tool Use (15%)

Build a complete ReAct agent from scratch.

**(a)** (5%) Implement the core agent loop with the following tools:
- **Calculator**: Evaluate mathematical expressions (use Python's `ast` module for safe evaluation).
- **Web search**: Use a real search API (e.g., DuckDuckGo via the `duckduckgo-search` library, or mock it).
- **Code executor**: Safely execute Python code in a sandboxed environment (use `subprocess` with timeouts).

Your implementation should:
- Parse the LLM's structured output (thought/action/action_input format).
- Handle tool execution errors gracefully.
- Maintain conversation history within the context window.
- Stop after finding a final answer or reaching a maximum number of steps.

**(b)** (5%) Implement **structured output generation** with schema validation:
- Define JSON schemas for each tool's input.
- Implement constrained decoding that ensures the output conforms to the schema (you may use guided generation libraries like `outlines` or implement a simple version yourself).
- Add retry logic when the model produces malformed output.

**(c)** (5%) Evaluate your agent:
- Create a test set of 20 questions that require different tool combinations:
  - 5 questions requiring only calculation
  - 5 questions requiring only search
  - 5 questions requiring search + calculation
  - 5 questions requiring code execution
- Report: accuracy, average number of steps, average tool calls per question, failure analysis (categorize failures as tool errors, reasoning errors, or parsing errors).

**Deliverables**: Complete code with docstrings, test set with ground-truth answers, evaluation results in a table.

### Problem B.2: RAG Pipeline (10%)

Build an end-to-end RAG pipeline.

**(a)** (3%) Implement document processing:
- Load a corpus of at least 100 documents (use Wikipedia articles via the `wikipedia` library, or a subset of SQuAD passages).
- Implement three chunking strategies: (i) fixed-size, (ii) sentence-boundary-aware, (iii) recursive with semantic boundaries.
- Compare chunk size distributions and overlap statistics for each strategy.

**(b)** (4%) Implement the retrieval pipeline:
- Embed all chunks using a pretrained embedding model (e.g., `sentence-transformers/all-MiniLM-L6-v2`).
- Build a FAISS index (try both Flat and IVF).
- Implement BM25 as a baseline retriever.
- Implement hybrid retrieval: combine BM25 and dense scores with a tunable weight $\alpha$.
- Report Recall@{1, 5, 10, 20} for each retriever on a held-out query set.

**(c)** (3%) Implement the generation pipeline:
- Format retrieved chunks as context for the LLM.
- Implement basic answer extraction.
- Compare RAG answers against a no-retrieval baseline.
- Report exact match and F1 scores on at least 50 questions.

**Deliverables**: Complete pipeline code, retrieval comparison table, generation quality analysis.

### Problem B.3: Best-of-N with Reward Model (10%)

Implement best-of-N sampling with reward model scoring for math problem solving.

**(a)** (3%) Implement the best-of-N framework:
- Generate $N$ CoT solutions for each problem at temperature $T = 0.7$.
- Implement three scoring methods: (i) random selection (baseline), (ii) majority vote on final answer, (iii) reward model scoring.
- For the reward model, fine-tune a small classifier (e.g., `distilbert-base`) on (question, solution, correct/incorrect) triples, or use a pretrained reward model.

**(b)** (4%) Evaluate scaling behavior:
- Test with $N \in \{1, 2, 4, 8, 16, 32, 64\}$ on 100 GSM8K problems (or similar math dataset).
- Plot accuracy vs. $N$ for each scoring method.
- Plot accuracy vs. total compute (tokens generated) to create compute-normalized curves.
- Fit the scaling law $\text{Acc}(N) = a - b \cdot N^{-\alpha}$ and report the fitted parameters.

**(c)** (3%) Analyze reward hacking:
- Identify cases where the reward model selects an incorrect solution over a correct one.
- Compute the "hacking rate": how often does the RM-selected answer differ from the majority vote answer, and which is correct more often?
- Propose and implement one mitigation strategy (e.g., combining RM score with majority vote).

**Deliverables**: Implementation, scaling plots, reward hacking analysis with concrete examples.

### Problem B.4: Tree Search for Math Problem Solving (15%)

Implement and evaluate tree search methods for mathematical reasoning.

**(a)** (5%) Implement Tree of Thought:
- Implement the propose function: given a partial solution, generate $b$ candidate next steps.
- Implement the evaluate function: score each partial solution's promise using the LLM.
- Implement beam search over the thought tree with beam width $w$.
- Test on 50 math problems from GSM8K or MATH.

**(b)** (5%) Implement MCTS:
- Implement the full MCTS loop: selection (UCB1 and PUCT), expansion, simulation (rollout), backpropagation.
- Use a simple reward: 1 if the final answer is correct, 0 otherwise.
- Implement an optional PRM: train a step-level classifier on rollout data and use it to guide selection.
- Compare MCTS with UCB1 vs. PUCT vs. random selection.

**(c)** (5%) Comprehensive evaluation:
- Compare the following methods on the same 50 problems:
  1. Greedy decoding (baseline)
  2. Self-consistency ($K = 10$)
  3. Best-of-$N$ with reward model ($N = 10$)
  4. Tree of Thought (beam width 5, depth 5)
  5. MCTS (100 simulations)
- Report: accuracy, total LLM calls, total tokens generated, wall-clock time.
- Create a **Pareto frontier** plot: accuracy vs. compute for each method.
- Analyze: on which types of problems does each method excel? Categorize problems by difficulty and report per-category results.

**Deliverables**: Complete implementation of all methods, Pareto frontier plot, per-method and per-difficulty analysis tables, discussion of when each method is preferred.

---

## Submission Guidelines

1. **Code**: Submit all code as `.py` files with clear docstrings and type annotations. Include a `requirements.txt` file.

2. **Report**: Submit a PDF report (max 15 pages, excluding code appendix) containing:
   - Part A: Full proofs and derivations, clearly stated assumptions.
   - Part B: Implementation descriptions, experimental results (tables and plots), and analysis.

3. **Reproducibility**: Include a `README.md` with instructions for running all experiments. All random seeds should be fixed for reproducibility. Include a script that runs all experiments end-to-end.

4. **Compute Budget**: This homework is designed to be completable with access to:
   - A free-tier API (e.g., OpenAI API with ~$20 of credits, or an open-source model running locally).
   - A single GPU with 16GB VRAM for the reward model training.
   - If you lack API access, you may use a locally running model (e.g., Llama 3 8B via Ollama) and note the model used.

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A.1 POMDP | 10 | Correctness of formalization, rigor of proofs |
| A.2 Complexity | 10 | Completeness of proofs, explicit constructions |
| A.3 Best-of-N | 10 | Derivation correctness, closed-form quality |
| A.4 Self-consistency | 10 | Proper use of concentration inequalities |
| A.5 RAG bounds | 10 | Probabilistic analysis, practical insights |
| B.1 ReAct agent | 15 | Working implementation, evaluation quality |
| B.2 RAG pipeline | 10 | Complete pipeline, meaningful comparisons |
| B.3 Best-of-N | 10 | Scaling analysis, reward hacking insights |
| B.4 Tree search | 15 | All methods implemented, Pareto analysis |
| **Total** | **100** | |
