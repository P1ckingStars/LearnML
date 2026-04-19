# Lecture 09b: Experiment Tracking, Model Registry, and CI/CD for ML

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Design** an experiment tracking system that captures the minimal sufficient set of metadata (code version, data version, hyperparameters, metrics, artifacts) to ensure full reproducibility of any training run.
2. **Implement** a model registry workflow with versioning, staging environments, promotion criteria, and rollback procedures, articulating the invariants each stage must satisfy.
3. **Construct** a CI/CD pipeline for ML that tests data integrity, model quality, and infrastructure correctness, distinguishing ML-specific testing from traditional software testing.
4. **Evaluate** ML pipeline orchestration tools (Kubeflow, Airflow, Prefect) along axes of expressiveness, scalability, fault tolerance, and operational overhead.
5. **Apply** reproducibility best practices including deterministic training, environment pinning, and seed management, and explain the fundamental limits of reproducibility on GPU hardware.

---

## 2. Motivation and Context

### 2.1 The Reproducibility Crisis in ML

A 2019 survey found that fewer than 50% of published ML results could be reproduced, even by the original authors. The causes are systemic:

- Code and data versions are not tracked together.
- Hyperparameters are set in notebooks and forgotten.
- Environment differences (library versions, CUDA versions, hardware) cause numerical divergence.
- Random seeds are either not set or not propagated through all sources of randomness.

In production settings, the consequences are severe. If you cannot reproduce the model that is currently serving traffic, you cannot diagnose regressions, audit decisions, or roll back safely.

### 2.2 From Notebooks to Pipelines

The typical progression of ML development:

1. **Exploration**: Jupyter notebooks, ad-hoc scripts, manual experimentation.
2. **Consolidation**: Scripts with argument parsing, manual tracking in spreadsheets.
3. **Pipeline**: Automated training pipelines, experiment tracking, model registry.
4. **CI/CD**: Automated testing, validation, and deployment of both models and pipeline code.

Each transition reduces manual error and increases velocity, but also increases system complexity. This lecture covers the tools and patterns for stages 3 and 4.

### 2.3 What Makes ML CI/CD Different

Traditional CI/CD tests whether code is correct. ML CI/CD must additionally test whether:

- The data has the expected schema and distribution.
- The model achieves acceptable quality on a held-out validation set.
- The model's predictions are consistent with the previous version (no unexpected behavior changes).
- The infrastructure (serving, monitoring) correctly handles the new model.

These differences make ML CI/CD fundamentally more complex than software CI/CD.

---

## 3. Experiment Tracking

### 3.1 What to Track

A complete experiment record must capture everything needed to reproduce the result:

| Category | Specific Items | Rationale |
|----------|---------------|-----------|
| **Code** | Git commit hash, diff from HEAD | Exact code that ran |
| **Data** | Dataset version/hash, split indices | Exact data that was used |
| **Environment** | Docker image hash, pip freeze, CUDA version | Exact software environment |
| **Configuration** | All hyperparameters, model architecture spec | Exact settings |
| **Hardware** | GPU type, number of GPUs, node count | Affects numerical results |
| **Metrics** | Training loss curve, validation metrics, timing | Results to compare |
| **Artifacts** | Model checkpoints, predictions, plots | Outputs to inspect |
| **Lineage** | Parent experiment (if fine-tuning), data pipeline run ID | Provenance chain |

### 3.2 Tracking System Architecture

A well-designed experiment tracking system has three components:

**Tracking server.** A centralized service that stores experiment metadata, metrics, and artifact references.

**Client library.** A lightweight API that researchers call from training scripts to log parameters, metrics, and artifacts.

**UI.** A web interface for searching, comparing, and visualizing experiments.

```python
# Generic experiment tracking interface
class ExperimentTracker:
    def start_run(self, experiment_name: str, tags: dict = None) -> str:
        """Start a new run and return a run_id."""
        ...

    def log_params(self, params: dict):
        """Log hyperparameters (called once per run)."""
        ...

    def log_metrics(self, metrics: dict, step: int = None):
        """Log metrics (called repeatedly during training)."""
        ...

    def log_artifact(self, local_path: str, artifact_type: str):
        """Log a file artifact (model checkpoint, plot, etc.)."""
        ...

    def log_code(self, git_hash: str, git_diff: str = None):
        """Log the code version."""
        ...

    def log_data(self, data_hash: str, data_uri: str):
        """Log the data version."""
        ...

    def end_run(self, status: str = "COMPLETED"):
        """End the run and finalize metadata."""
        ...
```

### 3.3 MLflow: Architecture and Usage

MLflow is an open-source platform with four components: Tracking, Projects, Models, and Registry.

**MLflow Tracking** stores experiments as a hierarchy: Experiment > Run > (Params, Metrics, Artifacts).

```python
import mlflow
import mlflow.pytorch

# Configuration
mlflow.set_tracking_uri("http://mlflow-server:5000")
mlflow.set_experiment("search-ranking-v2")

with mlflow.start_run(run_name="lr-sweep-0.001") as run:
    # Log everything needed for reproducibility
    mlflow.log_params({
        "model": "cross-encoder",
        "learning_rate": 1e-3,
        "batch_size": 256,
        "num_epochs": 10,
        "optimizer": "AdamW",
        "weight_decay": 0.01,
        "warmup_steps": 1000,
        "max_seq_length": 512,
        "num_negatives": 7,
    })

    mlflow.log_param("data_version", "v2.3.1")
    mlflow.log_param("git_hash", get_git_hash())

    for epoch in range(10):
        train_loss = train_one_epoch(model, train_loader, optimizer)
        val_metrics = evaluate(model, val_loader)

        mlflow.log_metrics({
            "train_loss": train_loss,
            "val_ndcg@10": val_metrics["ndcg@10"],
            "val_mrr": val_metrics["mrr"],
        }, step=epoch)

    # Log the trained model as an artifact
    mlflow.pytorch.log_model(
        model, "model",
        registered_model_name="search-ranker"
    )

    # Log evaluation artifacts
    mlflow.log_artifact("confusion_matrix.png")
    mlflow.log_artifact("error_analysis.csv")
```

**Storage backend.** MLflow stores metadata in a relational database (PostgreSQL, MySQL, SQLite) and artifacts in blob storage (S3, GCS, Azure Blob, local filesystem).

### 3.4 Weights & Biases: System Tables and Sweep Architecture

W&B provides a hosted experiment tracking service with several capabilities beyond basic logging:

**System metrics.** W&B automatically captures GPU utilization, memory usage, CPU load, and network I/O during training, providing free infrastructure profiling.

**Hyperparameter sweeps.** W&B supports Bayesian optimization, grid search, and random search as first-class primitives:

```yaml
# sweep_config.yaml
method: bayes
metric:
  name: val_ndcg
  goal: maximize
parameters:
  learning_rate:
    distribution: log_uniform_values
    min: 1e-5
    max: 1e-2
  batch_size:
    values: [64, 128, 256, 512]
  weight_decay:
    distribution: log_uniform_values
    min: 1e-5
    max: 1e-1
  num_layers:
    values: [2, 4, 6, 8]
early_terminate:
  type: hyperband
  min_iter: 3
  eta: 3
```

**Tables and artifacts.** W&B Tables allow logging structured data (predictions, error cases, embeddings) with interactive filtering and visualization in the UI.

### 3.5 Comparison of Tracking Tools

| Feature | MLflow | W&B | Neptune |
|---------|--------|-----|---------|
| Open source | Yes | No (hosted) | No (hosted) |
| Self-hosted | Yes | Yes (enterprise) | No |
| Auto system metrics | No | Yes | Yes |
| Hyperparameter sweeps | Via plugins | Built-in (Bayesian) | Built-in |
| Collaboration | Basic | Strong (reports, teams) | Strong |
| Data versioning | Via plugins | Artifacts | Via plugins |
| Cost (small team) | Free | Free tier | Free tier |
| Cost (enterprise) | Infra cost | $$$ | $$$ |

---

## 4. Model Registry

### 4.1 Purpose and Design

A model registry is a centralized store for trained model artifacts with versioning, staging, and metadata.

**Why not just use S3/GCS?** A blob store provides storage, but not:

- **Versioning semantics**: model v1, v2, v3 with a "latest" alias.
- **Stage transitions**: "staging" -> "production" -> "archived" lifecycle.
- **Metadata**: training run linkage, performance metrics, data lineage.
- **Access control**: who can promote a model to production?

### 4.2 Model Lifecycle States

```
[Registered] → [Staging] → [Production] → [Archived]
                   ↑                            │
                   └────────── [Rollback] ←─────┘
```

**Registered.** A new model version is uploaded. No quality guarantees.

**Staging.** The model has passed automated quality checks (offline metrics, regression tests). It is ready for further evaluation (shadow deployment, A/B test).

**Production.** The model is serving live traffic. Only one version is "production" at a time (or a weighted split during A/B tests).

**Archived.** The model is no longer serving but is retained for audit and rollback.

### 4.3 Promotion Criteria

Each stage transition should have explicit, automated criteria:

```python
# Model promotion criteria
class PromotionChecker:
    def check_registered_to_staging(self, model_version: ModelVersion) -> bool:
        """Automated checks before a model enters staging."""
        checks = [
            # 1. Offline metrics meet minimum thresholds
            model_version.metrics["val_ndcg@10"] >= 0.45,
            model_version.metrics["val_mrr"] >= 0.30,

            # 2. No regression vs. current production model
            model_version.metrics["val_ndcg@10"] >=
                self.production_model.metrics["val_ndcg@10"] - 0.01,

            # 3. Model passes invariant tests
            self.run_invariant_tests(model_version),

            # 4. Model size within deployment constraints
            model_version.artifact_size_mb <= 500,

            # 5. Inference latency within SLA
            self.benchmark_latency(model_version, p99_target_ms=40),

            # 6. Training data lineage is valid
            model_version.data_version in self.approved_data_versions,
        ]
        return all(checks)

    def check_staging_to_production(self, model_version: ModelVersion) -> bool:
        """Checks after shadow deployment / A/B test."""
        checks = [
            # 1. A/B test shows statistically significant improvement
            self.ab_test_result(model_version).p_value < 0.05,
            self.ab_test_result(model_version).lift > 0.0,

            # 2. No degradation in guardrail metrics
            self.ab_test_result(model_version).guardrail_violations == 0,

            # 3. Latency in production is within SLA
            self.production_latency(model_version).p99_ms <= 40,

            # 4. Error rate is acceptable
            self.production_error_rate(model_version) < 0.001,
        ]
        return all(checks)

    def run_invariant_tests(self, model_version: ModelVersion) -> bool:
        """Test model invariants that should always hold."""
        model = load_model(model_version)
        tests = [
            # Monotonicity: higher relevance score for known-relevant items
            self.test_monotonicity(model),
            # Consistency: similar inputs produce similar outputs
            self.test_consistency(model),
            # Bounds: outputs are in expected range
            self.test_output_bounds(model),
        ]
        return all(tests)
```

### 4.4 Rollback Procedures

Rollback must be fast and safe. Design principles:

1. **Keep previous versions deployed.** Run the previous production model on standby (warm pool). Rollback is a traffic routing change, not a deployment.
2. **Automate rollback triggers.** If error rate exceeds threshold or latency SLA is violated, automatically route traffic back to the previous version.
3. **Preserve the failed model.** Archive it for post-mortem analysis; do not delete it.

```python
# Automated rollback controller
class RollbackController:
    def __init__(self, metrics_client, traffic_router, alerter):
        self.metrics_client = metrics_client
        self.traffic_router = traffic_router
        self.alerter = alerter
        self.rollback_thresholds = {
            "error_rate": 0.01,       # 1% error rate
            "p99_latency_ms": 100,    # 100ms p99
            "prediction_drift": 0.1,  # 10% KL divergence from baseline
        }

    def check_and_rollback(self, current_version: str, previous_version: str):
        metrics = self.metrics_client.get_current_metrics(current_version)

        violations = []
        for metric_name, threshold in self.rollback_thresholds.items():
            if metrics[metric_name] > threshold:
                violations.append(
                    f"{metric_name}={metrics[metric_name]:.4f} > {threshold}"
                )

        if violations:
            self.traffic_router.route_all_traffic(previous_version)
            self.alerter.send_alert(
                severity="critical",
                message=f"Auto-rollback from {current_version} to "
                        f"{previous_version}. Violations: {violations}"
            )
            return True
        return False
```

---

## 5. CI/CD for ML

### 5.1 The ML Testing Pyramid

Traditional software has a testing pyramid: unit tests (many, fast) > integration tests (moderate) > end-to-end tests (few, slow). ML extends this with additional layers:

```
                    /\
                   /  \  End-to-end (full pipeline run)
                  /    \
                 /------\  Model quality tests
                /        \
               /----------\  Data tests
              /            \
             /--------------\  Unit tests (code correctness)
            /________________\
```

**Unit tests.** Test individual functions: data transformations, feature engineering, model forward pass with known inputs.

**Data tests.** Test that input data meets expected schemas, distributions, and quality standards.

**Model quality tests.** Test that the trained model meets minimum quality thresholds and does not regress.

**End-to-end tests.** Test the entire pipeline from data ingestion to model serving.

### 5.2 Data Testing

Data is the most common source of production ML failures. Data tests should run at every pipeline execution and in CI:

```python
import great_expectations as ge

# Define data expectations
def validate_training_data(df: pd.DataFrame) -> bool:
    """Validate training data before model training."""
    suite = ge.dataset.PandasDataset(df)

    # Schema checks
    assert suite.expect_column_to_exist("user_id").success
    assert suite.expect_column_to_exist("item_id").success
    assert suite.expect_column_to_exist("label").success
    assert suite.expect_column_to_exist("timestamp").success

    # Type checks
    assert suite.expect_column_values_to_be_of_type(
        "label", "int64"
    ).success

    # Value range checks
    assert suite.expect_column_values_to_be_between(
        "label", min_value=0, max_value=1
    ).success

    # Distribution checks
    label_mean = df["label"].mean()
    assert 0.01 < label_mean < 0.50, (
        f"Label rate {label_mean:.3f} outside expected range [0.01, 0.50]"
    )

    # Completeness checks
    assert suite.expect_column_values_to_not_be_null(
        "user_id"
    ).success
    null_rate = df.isnull().mean()
    for col, rate in null_rate.items():
        assert rate < 0.05, f"Column {col} has {rate:.1%} null values"

    # Freshness checks
    max_timestamp = pd.to_datetime(df["timestamp"]).max()
    staleness = (pd.Timestamp.now() - max_timestamp).total_seconds() / 3600
    assert staleness < 48, f"Data is {staleness:.1f} hours stale"

    # Volume checks
    assert len(df) >= 10000, f"Only {len(df)} rows, expected >= 10000"

    return True
```

### 5.3 Model Testing

Model tests verify that a trained model behaves correctly:

```python
class ModelTests:
    """Tests to run on every trained model before promotion."""

    def test_minimum_quality(self, model, val_data):
        """Model must meet minimum quality thresholds."""
        metrics = evaluate(model, val_data)
        assert metrics["ndcg@10"] >= 0.40, \
            f"NDCG@10 = {metrics['ndcg@10']:.3f} < 0.40"
        assert metrics["mrr"] >= 0.25, \
            f"MRR = {metrics['mrr']:.3f} < 0.25"

    def test_no_regression(self, model, baseline_model, val_data):
        """Model must not regress significantly vs. baseline."""
        new_metrics = evaluate(model, val_data)
        base_metrics = evaluate(baseline_model, val_data)
        # Allow up to 1% regression (within noise)
        assert new_metrics["ndcg@10"] >= base_metrics["ndcg@10"] - 0.01

    def test_slice_performance(self, model, val_data):
        """Model must perform adequately on all important slices."""
        slices = {
            "new_users": val_data[val_data["user_age_days"] < 7],
            "power_users": val_data[val_data["user_age_days"] > 365],
            "mobile": val_data[val_data["platform"] == "mobile"],
            "desktop": val_data[val_data["platform"] == "desktop"],
        }
        for slice_name, slice_data in slices.items():
            metrics = evaluate(model, slice_data)
            assert metrics["ndcg@10"] >= 0.30, \
                f"Slice '{slice_name}': NDCG@10 = {metrics['ndcg@10']:.3f} < 0.30"

    def test_inference_latency(self, model, sample_inputs):
        """Model must meet latency SLA."""
        import time
        latencies = []
        for inp in sample_inputs:
            start = time.perf_counter()
            model.predict(inp)
            latencies.append((time.perf_counter() - start) * 1000)
        p99 = sorted(latencies)[int(0.99 * len(latencies))]
        assert p99 < 40, f"p99 latency = {p99:.1f}ms > 40ms"

    def test_directional_expectations(self, model):
        """Test that the model respects known invariants."""
        # Example: higher click-through rate should increase relevance score
        base_features = get_base_features()
        high_ctr = base_features.copy()
        high_ctr["historical_ctr"] = 0.9
        low_ctr = base_features.copy()
        low_ctr["historical_ctr"] = 0.01
        assert model.predict(high_ctr) > model.predict(low_ctr), \
            "Model violates CTR monotonicity"
```

### 5.4 CI/CD Pipeline Structure

A complete ML CI/CD pipeline:

```yaml
# .github/workflows/ml_pipeline.yaml (conceptual)
stages:
  # Stage 1: Code quality (triggered on every PR)
  code-quality:
    - lint (ruff, mypy)
    - unit-tests (pytest, fast)
    - security-scan (bandit, safety)

  # Stage 2: Data validation (triggered on data change or schedule)
  data-validation:
    - schema-check
    - distribution-check
    - freshness-check
    - volume-check

  # Stage 3: Training (triggered on code merge or data change)
  training:
    - download-data (with version pinning)
    - train-model (with seed, reproducible config)
    - log-to-experiment-tracker

  # Stage 4: Model validation (triggered after training)
  model-validation:
    - minimum-quality-check
    - regression-check (vs. current production)
    - slice-performance-check
    - latency-benchmark
    - invariant-tests
    - bias-and-fairness-audit

  # Stage 5: Staging deployment (triggered after validation passes)
  staging:
    - deploy-to-staging
    - integration-tests (end-to-end with staging services)
    - shadow-traffic-test (compare predictions with production)

  # Stage 6: Production deployment (triggered by approval or automation)
  production:
    - canary-deploy (1% traffic)
    - monitor-canary (30 min)
    - gradual-rollout (1% -> 10% -> 50% -> 100%)
    - post-deployment-monitoring
```

### 5.5 Testing Infrastructure

**Infrastructure tests** verify that the deployment environment is correct:

```python
def test_model_loads_in_serving_container():
    """Verify the model can be loaded in the production serving image."""
    import docker
    client = docker.from_env()
    container = client.containers.run(
        "model-server:latest",
        environment={"MODEL_URI": "s3://models/search-ranker/v42"},
        detach=True,
    )
    # Wait for health check
    health = wait_for_health(container, timeout=60)
    assert health == "healthy"
    # Send a test prediction
    response = send_prediction(container, SAMPLE_INPUT)
    assert response.status_code == 200
    assert "predictions" in response.json()
    container.stop()
```

---

## 6. ML Pipelines

### 6.1 Pipeline Concepts

An ML pipeline is a directed acyclic graph (DAG) of steps that transforms data into a deployed model:

```
[Data Ingestion] → [Data Validation] → [Feature Engineering] → [Training]
                                                                     ↓
                                              [Deployment] ← [Model Validation]
```

Each step should be:
- **Idempotent**: running twice produces the same result.
- **Hermetic**: no implicit dependencies on external state.
- **Cacheable**: if inputs have not changed, reuse the cached output.

### 6.2 Orchestration Tools

**Apache Airflow.** The most widely used pipeline orchestrator. DAGs are defined in Python. Strong scheduling, monitoring, and alerting. Weakness: designed for data pipelines, not ML-specific concepts (no native model registry, experiment tracking).

```python
# Airflow DAG for ML training pipeline
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.amazon.aws.operators.sagemaker import (
    SageMakerTrainingOperator,
)
from datetime import datetime, timedelta

default_args = {
    "owner": "ml-team",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    "search_ranking_training",
    default_args=default_args,
    schedule_interval="0 2 * * 1",  # Every Monday at 2 AM
    start_date=datetime(2025, 1, 1),
    catchup=False,
) as dag:

    validate_data = PythonOperator(
        task_id="validate_data",
        python_callable=validate_training_data,
    )

    train_model = PythonOperator(
        task_id="train_model",
        python_callable=train_and_log,
    )

    validate_model = PythonOperator(
        task_id="validate_model",
        python_callable=run_model_validation,
    )

    promote_model = PythonOperator(
        task_id="promote_model",
        python_callable=promote_to_staging,
    )

    validate_data >> train_model >> validate_model >> promote_model
```

**Kubeflow Pipelines.** ML-native pipeline system built on Kubernetes. Native support for GPU resources, model artifacts, and experiment tracking. Weakness: requires Kubernetes, steep learning curve.

**Prefect.** Modern orchestrator with Pythonic API, good error handling, and dynamic workflows. Weakness: smaller ecosystem than Airflow.

### 6.3 Pipeline Tool Comparison

| Feature | Airflow | Kubeflow | Prefect |
|---------|---------|----------|---------|
| ML-native | No | Yes | Partial |
| Kubernetes required | No | Yes | No |
| Dynamic DAGs | Limited | Limited | Yes |
| GPU support | Via plugins | Native | Via infra |
| Community size | Very large | Large | Medium |
| Learning curve | Medium | Steep | Low |
| Scheduling | Strong | Basic | Good |
| UI | Good | Good | Good |

---

## 7. Reproducibility

### 7.1 Sources of Non-Determinism

Achieving bit-for-bit reproducibility in deep learning is surprisingly difficult. Sources of randomness:

| Source | Mitigation | Residual Risk |
|--------|-----------|---------------|
| Weight initialization | Set `torch.manual_seed(seed)` | None |
| Data shuffling | Set DataLoader `generator` seed | None |
| Dropout | Seeded via global seed | None |
| Data augmentation | Seed random/numpy generators | None |
| cuDNN algorithms | `torch.backends.cudnn.deterministic = True` | 5--10% slowdown |
| Atomics in CUDA kernels | `torch.use_deterministic_algorithms(True)` | Some ops unavailable |
| Floating-point non-associativity | Cannot fully mitigate on GPU | Fundamental limit |
| Multi-GPU reduction order | Fixed communication pattern | Small numerical differences |

### 7.2 Deterministic Training Setup

```python
import torch
import numpy as np
import random
import os

def set_deterministic(seed: int = 42):
    """Configure all sources of randomness for reproducibility."""
    # Python
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)

    # NumPy
    np.random.seed(seed)

    # PyTorch
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

    # cuDNN
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

    # PyTorch deterministic algorithms
    torch.use_deterministic_algorithms(True)

    # Environment variable for CUBLAS
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
```

### 7.3 Environment Pinning

Reproducibility requires exact environment specification:

```dockerfile
# Dockerfile for reproducible training
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# Pin system packages
RUN apt-get update && apt-get install -y \
    python3.11=3.11.5-1 \
    python3-pip=23.0.1+dfsg-1ubuntu0.1 \
    && rm -rf /var/lib/apt/lists/*

# Pin Python packages (exact versions)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# requirements.txt should use == for all packages:
# torch==2.2.0
# transformers==4.38.1
# numpy==1.26.3
# ...
```

**Hash-based verification.** For critical reproducibility, verify package integrity:

```python
# Verify environment matches expected hash
import hashlib
import subprocess

def get_environment_hash() -> str:
    """Compute a hash of the full Python environment."""
    freeze = subprocess.check_output(
        ["pip", "freeze"], text=True
    )
    return hashlib.sha256(freeze.encode()).hexdigest()[:16]
```

### 7.4 The Fundamental Limit: Floating-Point Non-Associativity

Even with all seeds set and deterministic algorithms enabled, GPU computations are not fully reproducible across different hardware because floating-point addition is not associative:

$$(a + b) + c \neq a + (b + c) \quad \text{in general for IEEE 754 floats}$$

The order in which GPU threads accumulate partial sums depends on scheduling, which depends on hardware. This means:

- The same code on the same GPU will produce identical results (with deterministic settings).
- The same code on a different GPU model may produce slightly different results.
- Multi-GPU training introduces additional non-determinism from reduction order.

**Practical consequence.** Reproducibility should be measured in terms of metric variance, not bit-for-bit identity. A well-configured training run should produce validation metrics within a small confidence interval across reruns.

---

## Key Takeaways

1. **Track everything.** An experiment that cannot be reproduced cannot be trusted. Log code version, data version, environment, hyperparameters, and metrics for every training run.
2. **The model registry is the contract between training and serving.** It enforces versioning, staging, and promotion criteria that prevent untested models from reaching production.
3. **ML CI/CD extends the testing pyramid.** Beyond code tests, ML systems require data tests, model quality tests, and infrastructure tests. Each layer catches a different category of failure.
4. **Pipeline orchestration is plumbing, but critical plumbing.** Choose an orchestrator that matches your team's expertise and infrastructure. Airflow for data-heavy teams, Kubeflow for Kubernetes-native teams, Prefect for simplicity.
5. **Reproducibility has fundamental limits on GPUs.** Set seeds and use deterministic algorithms, but measure reproducibility in terms of metric confidence intervals, not bit-for-bit identity.

---

## Further Reading

1. **Zaharia, M., Chen, A., Davidson, A., et al.** (2018). "Accelerating the Machine Learning Lifecycle with MLflow." *IEEE Data Engineering Bulletin.*
   - Design and architecture of MLflow.

2. **Biewald, L.** (2020). "Experiment Tracking with Weights and Biases." *W&B White Paper.*
   - Design philosophy and architecture of W&B.

3. **Breck, E., Cai, S., Nielsen, E., Salib, M., and Sculley, D.** (2017). "The ML Test Score: A Rubric for ML Production Readiness and Technical Debt Reduction." *NeurIPS Workshop on Reliable ML in the Wild.*
   - Google's framework for assessing ML production readiness.

4. **Sato, D., Wider, A., and Windheuser, C.** (2019). "Continuous Delivery for Machine Learning." *ThoughtWorks Technology Radar.*
   - Practical patterns for ML CI/CD.

5. **Pham, H.V., et al.** (2020). "Problems and Opportunities in Training Deep Learning Software Systems: An Analysis of Variance." *ASE 2020.*
   - Empirical study of non-determinism in deep learning training.

6. **Polyzotis, N., Roy, S., Whang, S.E., and Zinkevich, M.** (2019). "Data Lifecycle Challenges in Production Machine Learning." *SIGMOD Record.*
   - Data management challenges throughout the ML lifecycle.
