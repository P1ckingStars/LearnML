# Lecture 09c: Monitoring, Drift Detection, and Online Evaluation

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Classify** production ML failures into data drift, concept drift, and model degradation, providing formal definitions for each and explaining their distinct causal mechanisms.
2. **Derive** and **apply** statistical tests for distribution shift --- Kolmogorov-Smirnov, Population Stability Index, and Maximum Mean Discrepancy --- analyzing their statistical power, computational cost, and suitability for different data types.
3. **Design** a comprehensive monitoring system for an ML service, specifying which metrics to track at the data, model, and system levels, along with appropriate alerting thresholds.
4. **Analyze** online evaluation methods (A/B testing, multi-armed bandits, interleaving) using formal statistical frameworks, computing required sample sizes and interpreting results.
5. **Evaluate** deployment strategies (shadow deployment, canary release, blue-green) in terms of risk mitigation, resource cost, and time to full rollout.

---

## 2. Motivation and Context

### 2.1 The Silent Failure Mode

Traditional software fails loudly: a crash, an exception, a 500 error. ML systems can fail silently: the model continues to serve predictions, but the predictions are wrong. Revenue declines gradually, user engagement drifts downward, and by the time anyone notices, weeks of value have been lost.

This happens because ML models are fundamentally dependent on the data distribution they were trained on. When that distribution shifts --- and it will shift --- the model's learned mapping from features to predictions becomes incorrect.

### 2.2 Why Models Degrade

Several mechanisms cause production ML degradation:

1. **Data drift (covariate shift).** The input distribution $P(X)$ changes while the true labeling function $P(Y|X)$ remains the same. Example: a fraud detection model trained on desktop transactions is deployed to a mobile-first market where transaction patterns differ.

2. **Concept drift.** The relationship $P(Y|X)$ changes while $P(X)$ may or may not change. Example: user preferences shift due to a cultural event, and the recommendation model's learned relevance scores become stale.

3. **Data quality degradation.** An upstream data pipeline breaks, producing missing values, incorrect formats, or stale features. This is the most common cause of production ML failures.

4. **Feedback loops.** The model's predictions influence user behavior, which changes the training distribution, which changes model behavior. These loops can be self-reinforcing.

### 2.3 Monitoring vs. Observability

**Monitoring** answers: "Is the system healthy right now?" It tracks predefined metrics and triggers alerts when thresholds are violated.

**Observability** answers: "Why is the system unhealthy?" It provides the ability to diagnose novel failure modes using logs, traces, and structured metadata.

ML systems need both. Monitoring catches known failure patterns; observability enables debugging novel ones.

---

## 3. What to Monitor

### 3.1 The Monitoring Stack

ML monitoring operates at three levels:

```
┌─────────────────────────────────────────┐
│  Level 3: Business Metrics              │
│  (Revenue, CTR, engagement, churn)      │
├─────────────────────────────────────────┤
│  Level 2: Model Metrics                 │
│  (Prediction distribution, confidence,  │
│   feature importance, drift scores)     │
├─────────────────────────────────────────┤
│  Level 1: Infrastructure Metrics        │
│  (Latency, throughput, error rate,      │
│   GPU utilization, memory)              │
└─────────────────────────────────────────┘
```

**Level 1: Infrastructure.** These are standard service metrics:

| Metric | Description | Alert Threshold (example) |
|--------|-------------|--------------------------|
| p50/p99 latency | Inference latency | p99 > 2x baseline |
| Error rate | Fraction of failed requests | > 0.1% |
| Throughput | Requests per second | < 50% of expected |
| GPU utilization | Fraction of GPU compute used | < 10% or > 95% |
| GPU memory | VRAM usage | > 90% |
| Queue depth | Pending requests | > 100 |

**Level 2: Model.** These are ML-specific metrics:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Prediction distribution | Histogram of model outputs | KL divergence > 0.1 from baseline |
| Confidence distribution | Model confidence scores | Mean confidence drop > 10% |
| Feature distributions | Per-feature histograms | Drift score > threshold (per feature) |
| Missing feature rate | Fraction of null/missing features | > 1% for any critical feature |
| Prediction cardinality | Number of distinct predictions | Collapse to < 5 distinct values |

**Level 3: Business.** These are the metrics that actually matter:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Conversion rate | Fraction of recommendations clicked | > 2 std dev below 7-day mean |
| Revenue per query | Revenue attributed to model | > 5% drop day-over-day |
| User engagement | Session length, return rate | Significant decline |

### 3.2 The Monitoring Latency Problem

A critical challenge: business metrics have delayed feedback. A search ranking model that starts returning poor results today may not show a revenue impact for days or weeks (due to user inertia, averaging effects, etc.).

```
Data pipeline breaks → Feature quality degrades → Model predictions worsen
                                                           ↓ (immediate)
                                                  Prediction distribution shifts
                                                           ↓ (hours)
                                                  Click-through rate drops
                                                           ↓ (days)
                                                  Revenue declines
                                                           ↓ (weeks)
                                                  Someone notices
```

This is why monitoring at all three levels is essential. Level 1 and 2 metrics provide early warning before Level 3 metrics are affected.

---

## 4. Statistical Tests for Drift Detection

### 4.1 Formal Problem Setup

Let $P$ be the reference (training) distribution and $Q$ be the current (production) distribution. We observe samples $\{x_1, \ldots, x_m\} \sim P$ (reference window) and $\{y_1, \ldots, y_n\} \sim Q$ (test window). We want to test:

$$H_0: P = Q \quad \text{vs.} \quad H_1: P \neq Q$$

### 4.2 Kolmogorov-Smirnov Test

The KS test compares the empirical CDFs of two samples. It is non-parametric and distribution-free.

**Definition.** The two-sample KS statistic is:

$$D_{m,n} = \sup_{x} |F_m(x) - G_n(x)|$$

where $F_m$ and $G_n$ are the empirical CDFs of the reference and test samples, respectively.

**Asymptotic distribution.** Under $H_0$, $\sqrt{\frac{mn}{m+n}} D_{m,n} \xrightarrow{d} K$, where $K$ follows the Kolmogorov distribution:

$$P(K \leq t) = 1 - 2\sum_{k=1}^{\infty} (-1)^{k-1} e^{-2k^2 t^2}$$

**Implementation:**

```python
from scipy import stats
import numpy as np

def detect_drift_ks(reference: np.ndarray, current: np.ndarray,
                    alpha: float = 0.05) -> dict:
    """
    Kolmogorov-Smirnov test for univariate drift detection.

    Args:
        reference: Reference (training) distribution samples, shape (m,)
        current: Current (production) distribution samples, shape (n,)
        alpha: Significance level

    Returns:
        Dictionary with test statistic, p-value, and drift decision.
    """
    statistic, p_value = stats.ks_2samp(reference, current)

    return {
        "test": "KS",
        "statistic": statistic,
        "p_value": p_value,
        "drift_detected": p_value < alpha,
        "reference_size": len(reference),
        "current_size": len(current),
    }
```

**Limitations:**
- Univariate only. For multivariate data, must be applied per-feature (losing correlation structure) or combined with Bonferroni correction.
- Sensitive to sample size: with very large samples, even tiny, practically insignificant shifts are detected.
- Does not quantify the magnitude of the shift.

### 4.3 Population Stability Index (PSI)

PSI is widely used in credit scoring and financial modeling. It quantifies the shift between two distributions by comparing their binned histograms.

**Definition.** Partition the feature range into $B$ bins. Let $p_i$ be the fraction of reference samples in bin $i$ and $q_i$ the fraction of current samples:

$$\text{PSI} = \sum_{i=1}^{B} (q_i - p_i) \ln\frac{q_i}{p_i}$$

Note that PSI is the symmetric KL divergence: $\text{PSI} = D_{\text{KL}}(Q \| P) + D_{\text{KL}}(P \| Q)$.

**Interpretation thresholds (industry standard):**

| PSI Value | Interpretation |
|-----------|---------------|
| < 0.1 | No significant shift |
| 0.1 -- 0.2 | Moderate shift, investigate |
| > 0.2 | Significant shift, action required |

**Implementation:**

```python
def compute_psi(reference: np.ndarray, current: np.ndarray,
                n_bins: int = 10, eps: float = 1e-4) -> float:
    """
    Compute Population Stability Index between two distributions.

    Args:
        reference: Reference distribution samples, shape (m,)
        current: Current distribution samples, shape (n,)
        n_bins: Number of bins for histogram
        eps: Small constant to avoid division by zero

    Returns:
        PSI value (float).
    """
    # Use reference quantiles as bin edges for stability
    bin_edges = np.quantile(reference, np.linspace(0, 1, n_bins + 1))
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf

    # Compute bin fractions
    ref_counts = np.histogram(reference, bins=bin_edges)[0]
    cur_counts = np.histogram(current, bins=bin_edges)[0]

    ref_fracs = ref_counts / ref_counts.sum() + eps
    cur_fracs = cur_counts / cur_counts.sum() + eps

    # PSI = sum((q - p) * ln(q/p))
    psi = np.sum((cur_fracs - ref_fracs) * np.log(cur_fracs / ref_fracs))
    return psi
```

**Properties of PSI:**
- Non-negative: $\text{PSI} \geq 0$ with equality iff $P = Q$.
- Symmetric: $\text{PSI}(P, Q) = \text{PSI}(Q, P)$.
- Depends on binning: different bin choices yield different values.
- Not a proper distance metric (does not satisfy triangle inequality in general).

### 4.4 Maximum Mean Discrepancy (MMD)

MMD is a kernel-based distance between distributions that works in any dimension without binning.

**Definition.** Given a reproducing kernel Hilbert space (RKHS) $\mathcal{H}$ with kernel $k$:

$$\text{MMD}^2(P, Q) = \mathbb{E}_{x,x' \sim P}[k(x,x')] - 2\mathbb{E}_{x \sim P, y \sim Q}[k(x,y)] + \mathbb{E}_{y,y' \sim Q}[k(y,y')]$$

**Key property (Gretton et al., 2012).** If $k$ is a characteristic kernel (e.g., Gaussian RBF), then $\text{MMD}(P, Q) = 0 \iff P = Q$.

**Unbiased estimator.** Given samples $\{x_i\}_{i=1}^m$ from $P$ and $\{y_j\}_{j=1}^n$ from $Q$:

$$\widehat{\text{MMD}}^2_u = \frac{1}{m(m-1)}\sum_{i \neq i'} k(x_i, x_{i'}) - \frac{2}{mn}\sum_{i,j} k(x_i, y_j) + \frac{1}{n(n-1)}\sum_{j \neq j'} k(y_j, y_{j'})$$

**Implementation:**

```python
def compute_mmd_squared(X: np.ndarray, Y: np.ndarray,
                         bandwidth: float = None) -> float:
    """
    Compute the unbiased MMD^2 statistic with Gaussian RBF kernel.

    Args:
        X: Reference samples, shape (m, d)
        Y: Current samples, shape (n, d)
        bandwidth: RBF kernel bandwidth (sigma). If None, use median heuristic.

    Returns:
        Unbiased MMD^2 estimate.
    """
    from scipy.spatial.distance import cdist

    if bandwidth is None:
        # Median heuristic: sigma = median of pairwise distances
        all_dists = cdist(
            np.vstack([X, Y]), np.vstack([X, Y]), metric="sqeuclidean"
        )
        bandwidth = np.sqrt(np.median(all_dists[all_dists > 0]))

    gamma = 1.0 / (2 * bandwidth ** 2)

    m, n = len(X), len(Y)

    # Kernel matrices
    K_XX = np.exp(-gamma * cdist(X, X, metric="sqeuclidean"))
    K_YY = np.exp(-gamma * cdist(Y, Y, metric="sqeuclidean"))
    K_XY = np.exp(-gamma * cdist(X, Y, metric="sqeuclidean"))

    # Unbiased estimate: exclude diagonal for K_XX and K_YY
    np.fill_diagonal(K_XX, 0)
    np.fill_diagonal(K_YY, 0)

    mmd_sq = (K_XX.sum() / (m * (m - 1))
              - 2 * K_XY.sum() / (m * n)
              + K_YY.sum() / (n * (n - 1)))

    return mmd_sq
```

**Computational cost.** The naive estimator is $O((m+n)^2 d)$, which is expensive for large samples. Approximations exist:

- **Random Fourier features** (Rahimi & Recht, 2007): approximate the kernel with $D$ random features, reducing cost to $O((m+n)D)$.
- **Block estimator**: divide samples into blocks, compute MMD per block, average. Reduces variance and cost.

### 4.5 Comparison of Drift Tests

| Property | KS Test | PSI | MMD |
|----------|---------|-----|-----|
| Dimensionality | Univariate | Univariate | Multivariate |
| Parametric | No | No | No |
| Captures correlations | No | No | Yes |
| Computational cost | $O((m+n)\log(m+n))$ | $O(m + n)$ | $O((m+n)^2)$ |
| Quantifies shift magnitude | No (binary) | Yes | Yes |
| Standard threshold | p-value | 0.1/0.2 | Permutation test |
| Industry adoption | Moderate | High (finance) | Research |

### 4.6 Multiple Testing Correction

When testing drift on $d$ features simultaneously, the probability of at least one false alarm grows with $d$. With $d$ independent tests at significance level $\alpha$:

$$P(\text{at least one false alarm}) = 1 - (1 - \alpha)^d$$

For $d = 100$ features and $\alpha = 0.05$: $P \approx 0.994$. Nearly guaranteed false alarm.

**Bonferroni correction.** Test each feature at level $\alpha / d$. Conservative (reduces power).

**Benjamini-Hochberg FDR control.** Order p-values $p_{(1)} \leq \cdots \leq p_{(d)}$. Find the largest $k$ such that $p_{(k)} \leq \frac{k}{d}\alpha$. Reject all hypotheses $1, \ldots, k$. Controls the false discovery rate at $\alpha$.

---

## 5. Feature Monitoring and Data Quality

### 5.1 Feature-Level Monitoring

Every input feature to a production model should be monitored:

```python
class FeatureMonitor:
    """Monitor feature distributions and data quality in production."""

    def __init__(self, reference_stats: dict, alert_config: dict):
        self.reference_stats = reference_stats
        self.alert_config = alert_config
        self.current_window = []

    def observe(self, features: dict):
        """Record a single observation."""
        self.current_window.append(features)

    def check(self) -> list[dict]:
        """Run all checks on the current window. Returns list of alerts."""
        alerts = []
        df = pd.DataFrame(self.current_window)

        for col in df.columns:
            # Null rate check
            null_rate = df[col].isnull().mean()
            if null_rate > self.alert_config.get("max_null_rate", 0.01):
                alerts.append({
                    "type": "null_rate",
                    "feature": col,
                    "value": null_rate,
                    "threshold": self.alert_config["max_null_rate"],
                })

            # Range check
            if col in self.reference_stats:
                ref = self.reference_stats[col]
                current_values = df[col].dropna().values

                if len(current_values) == 0:
                    alerts.append({"type": "all_null", "feature": col})
                    continue

                # Out-of-range check
                oor_rate = np.mean(
                    (current_values < ref["min"]) | (current_values > ref["max"])
                )
                if oor_rate > 0.05:
                    alerts.append({
                        "type": "out_of_range",
                        "feature": col,
                        "oor_rate": oor_rate,
                    })

                # Distribution drift check (PSI)
                psi = compute_psi(ref["sample"], current_values)
                if psi > self.alert_config.get("psi_threshold", 0.2):
                    alerts.append({
                        "type": "drift",
                        "feature": col,
                        "psi": psi,
                        "threshold": self.alert_config["psi_threshold"],
                    })

        self.current_window = []  # Reset window
        return alerts
```

### 5.2 Data Quality Dimensions

| Dimension | Definition | Example Check |
|-----------|-----------|---------------|
| Completeness | All expected values are present | Null rate < threshold |
| Consistency | Values agree across sources | Feature store vs. raw data |
| Accuracy | Values reflect reality | Geo-coordinates within country bounds |
| Timeliness | Values are sufficiently fresh | Timestamp within SLA |
| Uniqueness | No spurious duplicates | Unique key constraint |
| Schema conformance | Values match expected types/formats | Column types, enum values |

---

## 6. Online Evaluation

### 6.1 A/B Testing

A/B testing is the gold standard for causal evaluation of model changes.

**Setup.** Users are randomly assigned to control (current model) or treatment (new model). After sufficient data is collected, compare a metric of interest.

**Formal framework.** Let $\mu_C$ and $\mu_T$ be the expected metric values for control and treatment. Test:

$$H_0: \mu_T - \mu_C = 0 \quad \text{vs.} \quad H_1: \mu_T - \mu_C \neq 0$$

**Sample size calculation.** For a two-sample z-test with significance $\alpha$ and power $1 - \beta$:

$$n = \frac{2\sigma^2(z_{\alpha/2} + z_\beta)^2}{\delta^2}$$

where $\sigma^2$ is the metric variance and $\delta$ is the minimum detectable effect (MDE).

**Example:** For a click-through rate with baseline $p_C = 0.05$, MDE $\delta = 0.002$ (4% relative lift), $\alpha = 0.05$, $\beta = 0.20$:

$$\sigma^2 = p_C(1 - p_C) = 0.05 \times 0.95 = 0.0475$$

$$n = \frac{2 \times 0.0475 \times (1.96 + 0.84)^2}{0.002^2} = \frac{2 \times 0.0475 \times 7.84}{0.000004} \approx 186{,}200$$

This means approximately 186,000 users per group, or 372,400 total.

**Guardrail metrics.** In addition to the primary metric, monitor guardrail metrics that must not degrade:

- Latency (p50, p99)
- Error rate
- Revenue per user
- User satisfaction proxies

If any guardrail is violated, the experiment is stopped regardless of the primary metric result.

### 6.2 Multi-Armed Bandits

Bandits address a limitation of A/B tests: during the experiment, a suboptimal treatment is shown to many users.

**The exploration-exploitation tradeoff.** A/B tests explore uniformly (50/50 split). Bandits adaptively shift traffic toward better-performing arms.

**Thompson Sampling.** Maintain a posterior distribution over each arm's reward rate. At each step, sample from each posterior and choose the arm with the highest sample.

For Bernoulli rewards (e.g., click/no-click):

```python
class ThompsonSamplingABTest:
    """Bayesian A/B test using Thompson Sampling."""

    def __init__(self, n_arms: int):
        # Beta(1, 1) = Uniform prior
        self.alpha = np.ones(n_arms)  # Successes + 1
        self.beta = np.ones(n_arms)   # Failures + 1

    def select_arm(self) -> int:
        """Sample from each arm's posterior and select the best."""
        samples = [
            np.random.beta(self.alpha[i], self.beta[i])
            for i in range(len(self.alpha))
        ]
        return int(np.argmax(samples))

    def update(self, arm: int, reward: float):
        """Update posterior with observed reward."""
        if reward > 0:
            self.alpha[arm] += 1
        else:
            self.beta[arm] += 1

    def get_allocation(self, n_samples: int = 10000) -> np.ndarray:
        """Estimate current traffic allocation via Monte Carlo."""
        counts = np.zeros(len(self.alpha))
        for _ in range(n_samples):
            counts[self.select_arm()] += 1
        return counts / counts.sum()
```

**Advantages over A/B testing:**
- Reduces regret: fewer users see inferior variants.
- Adapts to changing conditions.

**Disadvantages:**
- Harder to compute valid p-values and confidence intervals.
- Non-stationary allocation complicates analysis.
- Requires real-time feedback (delayed rewards are problematic).

### 6.3 Interleaving

Interleaving is particularly effective for ranking systems (search, recommendations). Instead of showing different rankings to different users, merge the rankings and show an interleaved result to the same user.

**Team Draft Interleaving (Radlinski et al., 2008).** Given ranked lists $L_A$ and $L_B$:

1. Randomly pick which team (A or B) goes first.
2. Alternating teams, each picks the next item from their list that is not already in the interleaved list.
3. The user sees the interleaved list. Credit the team for each clicked item.

**Advantage:** Interleaving is 10--100x more sensitive than A/B testing because within-user comparisons eliminate user-level variance.

**Formal sensitivity analysis.** Let $\sigma^2_{\text{AB}}$ be the variance of the A/B test estimator and $\sigma^2_{\text{int}}$ be the variance of the interleaving estimator. For ranking systems:

$$\frac{\sigma^2_{\text{AB}}}{\sigma^2_{\text{int}}} = 1 + \frac{\sigma^2_{\text{between-user}}}{\sigma^2_{\text{within-user}}}$$

Since between-user variance is typically much larger than within-user variance, interleaving can require 10--100x fewer samples.

---

## 7. Deployment Strategies

### 7.1 Shadow Deployment

Run the new model in parallel with the production model. Serve the production model's predictions to users but log both models' predictions for comparison.

```
[Request] → [Production Model] → [Response to user]
         └→ [Shadow Model]     → [Logged for analysis]
```

**Advantages:** Zero user impact; can compare predictions at scale before any traffic is shifted.

**Disadvantages:** Does not evaluate user-facing behavior (e.g., a ranking model's predictions must be served to observe clicks). Double the compute cost.

### 7.2 Canary Release

Deploy the new model to a small fraction of traffic (e.g., 1--5%) and monitor for issues before expanding.

```python
class CanaryRolloutController:
    """Manages gradual rollout of a new model version."""

    def __init__(self, stages: list[dict]):
        """
        Args:
            stages: List of {"traffic_pct": float, "duration_min": int,
                             "success_criteria": callable}
        """
        self.stages = stages
        self.current_stage = 0

    async def execute_rollout(self, new_version: str, old_version: str):
        """Execute the canary rollout."""
        for i, stage in enumerate(self.stages):
            self.current_stage = i
            pct = stage["traffic_pct"]

            # Route traffic
            await self.route_traffic(new_version, pct, old_version, 100 - pct)

            # Monitor for the specified duration
            await asyncio.sleep(stage["duration_min"] * 60)

            # Check success criteria
            metrics = await self.collect_metrics(new_version)
            if not stage["success_criteria"](metrics):
                await self.route_traffic(old_version, 100, new_version, 0)
                raise RolloutFailed(
                    f"Stage {i} failed at {pct}% traffic. "
                    f"Metrics: {metrics}. Rolling back."
                )

        # Full rollout complete
        await self.route_traffic(new_version, 100, old_version, 0)

# Example usage
stages = [
    {"traffic_pct": 1,   "duration_min": 30,
     "success_criteria": lambda m: m["error_rate"] < 0.01},
    {"traffic_pct": 5,   "duration_min": 60,
     "success_criteria": lambda m: m["error_rate"] < 0.01 and m["p99_ms"] < 100},
    {"traffic_pct": 25,  "duration_min": 120,
     "success_criteria": lambda m: m["p99_ms"] < 100 and m["drift_score"] < 0.2},
    {"traffic_pct": 50,  "duration_min": 240,
     "success_criteria": lambda m: m["ab_test_pvalue"] < 0.1},
    {"traffic_pct": 100, "duration_min": 0,
     "success_criteria": lambda m: True},
]
```

### 7.3 Blue-Green Deployment

Maintain two identical production environments ("blue" and "green"). One serves live traffic while the other is updated. Switch traffic atomically.

**Advantages:** Instant rollback (switch back to the previous environment). Full-scale testing before user exposure.

**Disadvantages:** Double the infrastructure cost. No gradual rollout (all-or-nothing switch, though can be combined with canary).

### 7.4 Strategy Comparison

| Strategy | Risk | Cost | Feedback Quality | Rollback Speed |
|----------|------|------|------------------|---------------|
| Shadow | None | 2x compute | No user interaction | N/A |
| Canary | Low | 1.01--1.5x | Full user interaction | Seconds |
| Blue-Green | Medium | 2x infra | Full user interaction | Seconds |
| A/B Test | Low | 1x | Full, with statistical rigor | Minutes |

---

## 8. Alerting and Incident Response

### 8.1 Alert Design Principles

**Actionable.** Every alert should have a clear response action. If the on-call engineer cannot do anything about an alert, it should not page.

**Appropriate urgency.** Use severity levels:

| Severity | Response Time | Example |
|----------|--------------|---------|
| P0 (Critical) | Immediate | Model returning errors for >1% of traffic |
| P1 (High) | <1 hour | Significant prediction drift detected |
| P2 (Medium) | <1 business day | Feature staleness approaching SLA |
| P3 (Low) | Next sprint | Minor distribution shift in low-importance feature |

**Low false-positive rate.** Alert fatigue is a serious problem. If engineers learn to ignore alerts, real incidents will be missed. Target <5% false-positive rate for P0/P1 alerts.

### 8.2 ML Incident Response Playbook

```
1. DETECT
   - Alert fires (automated) or user reports issue.
   - Determine: is this a data issue, model issue, or infra issue?

2. TRIAGE
   - Check infrastructure metrics: latency, error rate, GPU health.
   - Check data pipeline: freshness, schema, completeness.
   - Check model metrics: prediction distribution, drift scores.

3. MITIGATE
   - If model issue: rollback to previous model version.
   - If data issue: switch to fallback features or cached predictions.
   - If infra issue: scale up, restart, or failover.

4. DIAGNOSE
   - Root cause analysis: what changed? (Data source, code, config, external)
   - Timeline: when did the issue start?
   - Impact: how many users/requests were affected?

5. RESOLVE
   - Fix the root cause.
   - Validate the fix in staging.
   - Deploy and monitor.

6. POST-MORTEM
   - Document the incident.
   - Identify prevention measures.
   - Update monitoring and alerts.
```

---

## Key Takeaways

1. **ML systems fail silently.** Unlike software bugs that crash, model degradation produces subtly wrong predictions. Proactive monitoring at the data, model, and business levels is the only defense.
2. **Drift detection requires the right tool for the job.** KS tests are simple and fast for univariate features. PSI provides interpretable magnitude. MMD captures multivariate structure. Use multiple tests and correct for multiple comparisons.
3. **Monitor the fastest-moving signal.** Data quality and feature distribution shifts are detectable within minutes. Model prediction drift is detectable within hours. Business metric changes take days. Build monitoring from the bottom up.
4. **A/B testing is the gold standard but expensive.** Sample size requirements can be enormous for small effect sizes. Interleaving is 10--100x more efficient for ranking systems. Bandits reduce regret during experimentation.
5. **Deployment is not a single event.** Shadow deployments, canary releases, and gradual rollouts reduce risk. Always have a fast rollback path.

---

## Further Reading

1. **Gretton, A., Borgwardt, K.M., Rasch, M.J., Scholkopf, B., and Smola, A.** (2012). "A Kernel Two-Sample Test." *JMLR.*
   - The foundational paper on MMD for distribution testing.

2. **Rabanser, S., Gunnemann, S., and Lipton, Z.C.** (2019). "Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift." *NeurIPS 2019.*
   - Comprehensive empirical comparison of drift detection methods.

3. **Radlinski, F., Kurup, M., and Joachims, T.** (2008). "How Does Clickthrough Data Reflect Retrieval Quality?" *CIKM 2008.*
   - The team-draft interleaving method for ranking evaluation.

4. **Kohavi, R., Tang, D., and Xu, Y.** (2020). *Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing.* Cambridge University Press.
   - The definitive guide to A/B testing at scale.

5. **Lu, J., Liu, A., Dong, F., Gu, F., Gama, J., and Zhang, G.** (2019). "Learning under Concept Drift: A Review." *IEEE TKDE.*
   - Survey of concept drift detection and adaptation methods.

6. **Klaise, J., Van Looveren, A., Vacanti, G., and Coca, A.** (2021). "Monitoring Machine Learning Models in Production: A Survey and Taxonomy." *arXiv.*
   - Taxonomy of ML monitoring approaches.
