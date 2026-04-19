# Homework 09: Deploy with A/B Testing & Monitoring

**Estimated Time: ~20 hours**

**Prerequisites:** Lectures 09a--09d, Recitation 09

---

## Overview

This homework has two parts. Part A focuses on analytical and design problems related to production ML systems: cost modeling, drift detection theory, and A/B test design. Part B focuses on implementation: you will deploy a model server with monitoring, implement drift detection, and run a simulated A/B test.

**Submission:** Submit a single PDF (Part A, typeset in LaTeX) and a code repository (Part B, with a README explaining how to run your experiments and a `results/` directory containing plots and analysis).

---

## Part A: Theory and Design (50%)

### Problem A.1: Cost Optimization Analysis (10%)

You are deploying a search ranking model with the following specifications:

- Model: 350M parameter transformer, FP16 inference.
- Traffic: 50,000 queries per second (QPS) at peak, 10,000 QPS at trough. Diurnal pattern with peak at 2 PM and trough at 4 AM.
- Latency SLA: p99 < 50ms.
- Each query requires scoring 100 candidate documents.
- Hardware: NVIDIA L4 GPU (24GB VRAM, 121 TFLOPS FP16, 300 GB/s bandwidth).
- A single L4 can serve 200 QPS for this model (measured empirically).

**(a)** (3%) Compute the number of GPUs required at peak and trough. If you provision for peak using on-demand instances at $0.80/hr per GPU, what is the monthly cost? What fraction of this cost is wasted during off-peak hours?

**(b)** (3%) Design a utilization-based autoscaling policy for this workload. Specify:
- Minimum and maximum replica counts.
- Scale-up and scale-down thresholds.
- Cooldown period.
- The expected diurnal cost savings compared to fixed provisioning.

Model the traffic as $\lambda(t) = 30000 + 20000 \cos\left(\frac{2\pi(t - 14)}{24}\right)$ QPS, where $t$ is the hour of the day. Compute the integral over 24 hours to find the daily cost under your autoscaling policy vs. fixed provisioning.

**(c)** (2%) A reserved instance (1-year commitment) costs $0.50/hr per GPU. At what utilization rate does reserved become cheaper than on-demand? Given your autoscaling policy from (b), should you use reserved instances for the base load and on-demand for burst, or on-demand for everything?

**(d)** (2%) The model team proposes quantizing the model from FP16 to INT8, which doubles throughput (400 QPS per GPU) with a 0.3% NDCG@10 degradation. Compute the annual cost savings. Frame this as a cost-quality tradeoff: what is the cost per 0.1% NDCG point?

### Problem A.2: Drift Detection Theory (15%)

**(a)** (5%) **Derive the PSI metric.** Starting from the KL divergence $D_{\text{KL}}(Q \| P) = \sum_i q_i \log \frac{q_i}{p_i}$, show that the Population Stability Index is the symmetrized KL divergence:

$$\text{PSI}(P, Q) = D_{\text{KL}}(Q \| P) + D_{\text{KL}}(P \| Q) = \sum_i (q_i - p_i) \log \frac{q_i}{p_i}$$

Prove that $\text{PSI}(P, Q) \geq 0$ with equality iff $P = Q$ (you may use the log-sum inequality or the non-negativity of KL divergence).

**(b)** (5%) **Multiple testing correction.** You monitor $d = 50$ features for drift, running a KS test on each with significance level $\alpha = 0.05$.

(i) What is the probability of at least one false alarm if no drift has occurred (all features are stationary)?

(ii) Apply the Bonferroni correction. What is the per-feature significance level? What is the family-wise error rate?

(iii) Apply the Benjamini-Hochberg procedure. Suppose the sorted p-values for your 50 features are $p_{(1)} = 0.0001, p_{(2)} = 0.0003, \ldots, p_{(5)} = 0.004, p_{(6)} = 0.08, \ldots, p_{(50)} = 0.99$. Which features would BH reject at FDR $= 0.05$? Show your work.

(iv) Discuss the practical tradeoff between FWER control (Bonferroni) and FDR control (BH) in the context of drift monitoring. When might you prefer one over the other?

**(c)** (5%) **MMD power analysis.** The power of the MMD test depends on the sample size $n$, the true discrepancy $\text{MMD}(P, Q)$, and the kernel bandwidth $\sigma$.

(i) For the Gaussian RBF kernel $k(x, y) = \exp\left(-\frac{\|x - y\|^2}{2\sigma^2}\right)$, show that the MMD between two Gaussians $P = \mathcal{N}(\mu_1, \sigma_1^2 I)$ and $Q = \mathcal{N}(\mu_2, \sigma_2^2 I)$ in $\mathbb{R}^d$ is:

$$\text{MMD}^2(P, Q) = k_{\sigma}^{PP} - 2k_{\sigma}^{PQ} + k_{\sigma}^{QQ}$$

where $k_{\sigma}^{PQ} = \mathbb{E}_{x \sim P, y \sim Q}[k(x,y)]$. Compute $k_{\sigma}^{PQ}$ in closed form for the Gaussian case. (*Hint:* The convolution of two Gaussians is a Gaussian.)

(ii) Using your result from (i), plot $\text{MMD}^2$ as a function of the mean shift $\|\mu_1 - \mu_2\|$ for $d = 10$, $\sigma_1 = \sigma_2 = 1$, and kernel bandwidth $\sigma \in \{0.5, 1.0, 2.0, 5.0\}$. Discuss the effect of bandwidth on sensitivity to different shift magnitudes.

(iii) For a fixed kernel bandwidth $\sigma = 1.0$, estimate the sample size $n$ needed to detect a mean shift of $\|\Delta\mu\| = 0.5$ in $d = 10$ dimensions with power 0.8 at significance level 0.05. You may use a permutation test simulation or the asymptotic distribution of the MMD statistic.

### Problem A.3: A/B Test Design (10%)

You are launching a new recommendation model and need to design an A/B test.

**(a)** (3%) The primary metric is click-through rate (CTR). The current model achieves CTR = 4.2%. The minimum detectable effect (MDE) is a 0.2 percentage point increase (to 4.4%). The test should have power $1 - \beta = 0.80$ at significance $\alpha = 0.05$ (two-sided).

Compute the required sample size per group. How many days of traffic are needed at 1 million users per day with a 50/50 split?

**(b)** (3%) You also want to monitor a guardrail metric: revenue per user. Current mean = $2.50, standard deviation = $8.00. What sample size is needed to detect a $0.10 decline in revenue per user with power 0.80?

Compare this to the sample size from (a). Which metric is the binding constraint? What does this tell you about the sensitivity of A/B tests for different metric types?

**(c)** (2%) Discuss the network effect problem in A/B testing for recommendation systems. If a user in the treatment group shares a recommended item with a user in the control group, how does this bias the results? Propose a mitigation strategy.

**(d)** (2%) You are considering using Thompson Sampling instead of a fixed 50/50 split. Define the expected cumulative regret for a $K$-armed Bernoulli bandit with Thompson Sampling and compare it to the fixed allocation regret. Under what conditions is the bandit approach preferable?

### Problem A.4: System Design (15%)

**(a)** (8%) **Design a complete ML system for fraud detection.** The system must:

- Process 10,000 transactions per second.
- Return a fraud score within 100ms.
- Use features from both real-time (last 5 minutes of user activity) and batch (user profile, historical patterns) sources.
- Support model updates without downtime.
- Detect and alert on data drift.

Draw the system architecture (as a text diagram), specifying:
1. All data flows and storage systems.
2. The feature computation pipeline (batch and streaming).
3. The serving architecture (including how real-time and batch features are joined).
4. The monitoring and alerting stack.
5. The model update pipeline (from training to production).

For each component, justify your technology choice and explain the failure modes you are designing for.

**(b)** (7%) **Analyze the feedback loop.** The fraud detection model's predictions influence which transactions are flagged for manual review. Reviewed transactions generate labels (fraud/not fraud). These labels become training data for the next model version.

(i) Formalize this feedback loop mathematically. Let $\hat{y}_t = f_\theta(x_t)$ be the model's fraud score and $r_t = \mathbf{1}[\hat{y}_t > \tau]$ be the review decision. The label $y_t$ is observed only if $r_t = 1$. Write the training loss as a function of the observed labels and show that this is a form of selection bias.

(ii) Propose two methods to mitigate this bias. For each, explain the mechanism, the cost (financial or statistical), and the tradeoff.

(iii) Suppose the review threshold is $\tau = 0.7$ and 10% of transactions are reviewed. Among reviewed transactions, 30% are truly fraudulent. Estimate the true fraud rate in the full population under the assumption that the model's ranking is well-calibrated. State your assumptions clearly.

---

## Part B: Implementation (50%)

### Problem B.1: Model Server with Monitoring (15%)

Implement a production-quality model server. You may use any ML model (a simple classifier is fine) and any serving framework (FastAPI, Flask, Triton, etc.). Your server must include:

**(a)** (5%) **Core serving:**
- `/predict` endpoint accepting JSON features and returning predictions.
- `/health` and `/ready` endpoints for Kubernetes-style health checks.
- Proper error handling (invalid input, model not loaded, etc.).
- Request ID tracking for debugging.

**(b)** (5%) **Prometheus metrics:**
- Request count (by status code).
- Request latency histogram (with appropriate bucket boundaries).
- Prediction score distribution histogram.
- Per-feature value distributions (for at least 5 features).
- Active request gauge.

**(c)** (5%) **Containerization:**
- Dockerfile that builds a production image.
- `docker-compose.yaml` that runs the model server, Prometheus, and Grafana.
- A Grafana dashboard (exported as JSON) showing: QPS, latency percentiles, prediction distribution, and feature distributions.
- Include a load test script that generates synthetic traffic.

**Deliverables:** Working code, Dockerfile, docker-compose.yaml, Grafana dashboard JSON, and a screenshot of the dashboard under load.

### Problem B.2: Drift Detection System (15%)

Implement a drift detection module that monitors feature distributions in real-time.

**(a)** (5%) Implement the following drift tests:
- Kolmogorov-Smirnov test (per feature).
- Population Stability Index (per feature).
- Maximum Mean Discrepancy (multivariate, on all features jointly).

Each test should accept a reference dataset and a current window of observations, and return a test statistic, p-value (where applicable), and a drift/no-drift decision.

**(b)** (5%) Integrate drift detection into your model server:
- Maintain a sliding window of recent observations (configurable window size).
- Run drift checks periodically (configurable interval).
- Expose drift metrics via the `/metrics` endpoint (PSI per feature, KS p-value per feature, MMD statistic).
- Log alerts when drift is detected.

**(c)** (5%) **Drift injection experiment.** Write a script that:
1. Sends 5 minutes of "normal" traffic (features drawn from the reference distribution).
2. Gradually injects drift (linearly shifting feature means over 5 minutes).
3. Sends 5 minutes of "drifted" traffic.

Record and plot:
- PSI over time for each feature.
- KS p-value over time for each feature.
- MMD statistic over time.
- The time at which each test first detects drift.

Which test detects drift earliest? Which is most robust to false alarms during the normal period? Discuss the tradeoffs.

### Problem B.3: A/B Testing Simulation (20%)

Implement a simulated A/B testing system.

**(a)** (8%) **A/B test engine.** Implement the following:

```python
class ABTestEngine:
    def __init__(self, variants: list[str], traffic_split: dict[str, float]):
        """Initialize with variant names and traffic allocation."""
        ...

    def assign_variant(self, user_id: str) -> str:
        """Deterministically assign a user to a variant (consistent hashing)."""
        ...

    def record_outcome(self, user_id: str, variant: str,
                       metrics: dict[str, float]):
        """Record an outcome (click, revenue, etc.) for a user."""
        ...

    def analyze(self) -> dict:
        """
        Compute for each metric:
        - Per-variant mean and confidence interval.
        - Lift (treatment - control) / control.
        - Two-sample t-test p-value.
        - Whether the result is statistically significant.
        - Required sample size vs. actual sample size.
        """
        ...
```

Requirements:
- User-variant assignment must be deterministic (same user always gets the same variant) and uniformly distributed.
- The analysis must correctly handle multiple metrics with Bonferroni correction.
- Include a `sequential_analyze` method that computes the test statistic after each batch of observations, for monitoring convergence.

**(b)** (7%) **Simulation.** Simulate an A/B test with the following setup:

- **Control (Model A):** CTR ~ Bernoulli(0.042), Revenue ~ LogNormal(0.5, 1.5)
- **Treatment (Model B):** CTR ~ Bernoulli(0.044), Revenue ~ LogNormal(0.52, 1.5)
- **1 million users per day, 50/50 split.**

Run the simulation for 14 days. Plot:
1. Cumulative CTR for each variant over time with 95% confidence bands.
2. The p-value of the CTR difference over time. Mark when statistical significance is first achieved.
3. Cumulative revenue per user for each variant over time.
4. The p-value of the revenue difference over time.

Answer: How many days are needed to detect the CTR difference? The revenue difference? Does this match your analytical calculation from Part A.3?

**(c)** (5%) **Thompson Sampling comparison.** Implement Thompson Sampling for the same scenario (CTR as the reward signal). Compare:
1. Cumulative regret over 14 days (Thompson Sampling vs. fixed 50/50 split).
2. Traffic allocation over time (what fraction of traffic goes to each variant?).
3. Statistical power: after 14 days, can you still draw valid conclusions about which variant is better? Discuss the challenges of statistical inference under adaptive allocation.

**Deliverables:** All code, a Jupyter notebook or PDF with plots and analysis, and a README with instructions.

---

## Grading Rubric

| Problem | Points | Key Criteria |
|---------|--------|-------------|
| A.1 | 10 | Correct cost calculations, justified autoscaling design |
| A.2 | 15 | Correct derivations, proper statistical reasoning |
| A.3 | 10 | Correct sample size calculations, thoughtful discussion |
| A.4 | 15 | Complete architecture, formal feedback loop analysis |
| B.1 | 15 | Working server, correct metrics, clean containerization |
| B.2 | 15 | Correct drift tests, working integration, insightful analysis |
| B.3 | 20 | Correct A/B engine, thorough simulation, bandit comparison |

**Total: 100 points**

---

## Collaboration Policy

You may discuss approaches with classmates, but all written derivations and code must be your own. Cite any external resources (papers, blog posts, code) that you reference. You may use standard libraries (scipy, numpy, scikit-learn, prometheus-client, fastapi) but must implement the core algorithms (drift tests, A/B test analysis, Thompson Sampling) yourself.

---

## Tips

1. **Start with Part B.1 early.** Getting the Docker setup working often takes longer than expected. The rest of Part B builds on it.
2. **For Part A.2(c)**, the closed-form Gaussian MMD calculation uses the fact that $\mathbb{E}_{x \sim \mathcal{N}(\mu, \Sigma)}[k(x, y)] = c \cdot k_{\text{wider}}(\mu, y)$ for appropriate constants. Derive this using the Gaussian integral identity.
3. **For Part B.3**, use consistent hashing (e.g., `hash(user_id + salt) % 1000 < 500`) for variant assignment. This ensures determinism and uniformity.
4. **Plot quality matters.** Label axes, include legends, use appropriate scales (log where needed), and write informative captions.
