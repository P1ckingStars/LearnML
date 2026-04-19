# Lecture 09a: ML System Design Patterns & Architecture

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Analyze** the categories of technical debt specific to machine learning systems as identified by Sculley et al. (2015), distinguishing ML-specific debt from traditional software engineering debt.
2. **Compare** batch prediction, online prediction, and streaming architectures, deriving latency-throughput tradeoffs for each and selecting the appropriate pattern for a given workload.
3. **Design** an end-to-end ML system architecture incorporating feature stores, model-as-service patterns, and feedback loops, justifying each component choice.
4. **Evaluate** the tradeoffs between microservice and monolithic architectures for ML workloads, including deployment independence, data coupling, and operational complexity.
5. **Synthesize** the ML lifecycle (experiment, deploy, monitor, retrain) into a coherent system design for a real-world case study such as recommendation or search ranking.

---

## 2. Motivation and Context

### 2.1 The Production Gap

Most ML education focuses on model development: architecture design, training algorithms, and evaluation metrics. Yet the model itself is typically a small fraction of a production ML system. Sculley et al. (2015) famously illustrated this with the "hidden technical debt" diagram: the ML code (the model) is a small box surrounded by vast infrastructure for data collection, feature extraction, configuration, serving, monitoring, and process management.

The practical consequence is stark. A team can train a state-of-the-art model in a week but spend months building the system around it. Organizations report that only 10--20% of effort in ML projects goes to model development; the remaining 80--90% is systems work.

### 2.2 Why Systems Thinking Matters for ML Researchers

Even in a research context, understanding production ML systems is essential:

- **Reproducibility** requires managing data versions, code versions, hyperparameters, and environment configurations as a system.
- **Scaling experiments** requires understanding batch processing pipelines, distributed compute orchestration, and resource management.
- **Real-world impact** requires bridging the gap between a trained model and a deployed system that serves users reliably.

### 2.3 Scope of This Lecture

This lecture covers the architectural patterns and design principles for ML systems. We will not focus on any single tool but rather on the recurring design patterns that appear across all production ML deployments, from small startups to hyperscale systems.

---

## 3. Technical Debt in ML Systems

### 3.1 Sculley et al. (2015): A Taxonomy

Sculley et al. identify several categories of ML-specific technical debt. We examine each in detail.

**Entanglement (CACE principle).** Changing Anything Changes Everything. In a traditional software system, modules have well-defined interfaces and can be modified independently. In an ML system, features, labels, hyperparameters, and data distributions are all entangled:

- Adding a new feature can change the learned importance of all existing features.
- Changing a data preprocessing step can shift the distribution that downstream models expect.
- Retraining on new data can change model behavior in unpredictable ways.

This means that ML systems have extremely high change amplification: a small change to one component can cascade through the entire system.

**Hidden Feedback Loops.** Many ML systems influence the data they subsequently train on. Consider a recommendation system:

```
User behavior → Training data → Model → Recommendations → User behavior → ...
```

This creates a feedback loop where the model's predictions shape its own future training distribution. Direct feedback loops (where the model's output directly influences its training data) are dangerous because they can cause the system to converge to degenerate equilibria.

**Correction Cascades.** When model A is built on top of model B's predictions, any change to model B requires revalidation of model A. If model C depends on model A, the cascade continues. This creates a fragile dependency chain.

**Data Dependencies.** Unlike code dependencies, data dependencies are often invisible. There is no compiler that warns you when an upstream data source changes format, distribution, or semantics. Sculley et al. identify two subcategories:

- **Unstable data dependencies**: upstream data sources that change without notice.
- **Underutilized data dependencies**: features that contribute negligibly to model quality but add maintenance burden and latency.

### 3.2 Quantifying Technical Debt

Technical debt in ML systems can be measured along several axes:

| Debt Category | Metric | Impact |
|--------------|--------|--------|
| Data dependencies | Number of upstream data sources | Each source is a point of failure |
| Feature entanglement | Number of features | Quadratic interaction complexity |
| Configuration complexity | Lines of config vs. lines of model code | Config errors are the most common production failures |
| Feedback loop depth | Number of hops from output to training input | Deeper loops are harder to debug |
| Pipeline freshness | Time between data generation and model update | Stale models degrade performance |

### 3.3 Mitigation Strategies

**Principled feature management.** Use feature stores (Section 5.2) to centralize feature computation, versioning, and documentation. Every feature should have an owner, a freshness SLA, and a documented schema.

**Explicit dependency tracking.** Treat data dependencies with the same rigor as code dependencies. Use data contracts that specify schema, distribution bounds, and freshness requirements.

**Modularity.** Isolate ML components behind well-defined APIs so that changes can be tested independently. The serving interface should be decoupled from the training pipeline.

**Continuous testing.** Test not just code but also data (schema validation, distribution checks) and models (performance regression tests, fairness checks).

---

## 4. ML System Architectures

### 4.1 Batch Prediction Architecture

In a batch prediction system, inference runs periodically (e.g., hourly, daily) over a large dataset, and results are stored for later retrieval.

```
[Data Warehouse] → [Batch Pipeline] → [Model Inference] → [Prediction Store] → [Serving API]
                                                                                       ↑
                                                                               [User Request]
```

**Characteristics:**

- **Latency**: High (predictions are precomputed; freshness depends on batch frequency).
- **Throughput**: Very high (batch processing amortizes overhead; GPU utilization near 100%).
- **Complexity**: Low serving complexity (just a key-value lookup).
- **Cost**: Efficient compute utilization (batch scheduling allows spot instances).

**When to use batch prediction:**

- Predictions can be precomputed for all (or most) entities.
- Freshness requirements are relaxed (minutes to hours acceptable).
- The input space is bounded and enumerable (e.g., product recommendations for all users).

**Formal latency model.** Let $T_{\text{batch}}$ be the batch computation time, $T_{\text{period}}$ the scheduling period, and $T_{\text{lookup}}$ the serving lookup time. The worst-case prediction freshness is:

$$T_{\text{fresh}} = T_{\text{period}} + T_{\text{batch}}$$

The serving latency is simply $T_{\text{lookup}}$, which is typically $O(1)$ for a key-value store.

**Example: Daily product recommendations.**

```python
# Pseudocode for a batch recommendation pipeline
class BatchRecommendationPipeline:
    def __init__(self, model_uri: str, feature_store: FeatureStore,
                 prediction_store: PredictionStore):
        self.model = load_model(model_uri)
        self.feature_store = feature_store
        self.prediction_store = prediction_store

    def run(self, user_ids: list[str], candidate_items: list[str]):
        """Generate recommendations for all users."""
        # 1. Fetch features in bulk (amortizes I/O)
        user_features = self.feature_store.get_batch(
            entity="user", ids=user_ids,
            features=["embedding", "history_30d", "demographic"]
        )
        item_features = self.feature_store.get_batch(
            entity="item", ids=candidate_items,
            features=["embedding", "category", "popularity"]
        )

        # 2. Score all (user, item) pairs
        for user_id in user_ids:
            scores = self.model.predict(
                user_features[user_id], item_features
            )  # Shape: (num_items,)

            # 3. Rank and store top-K
            top_k_indices = scores.argsort(descending=True)[:100]
            self.prediction_store.write(
                key=f"recs:{user_id}",
                value=candidate_items[top_k_indices],
                ttl=86400  # 24-hour expiry
            )
```

### 4.2 Online Prediction Architecture

In an online prediction system, inference happens synchronously in response to user requests.

```
[User Request] → [API Gateway] → [Feature Retrieval] → [Model Server] → [Response]
                                       ↑
                              [Feature Store (online)]
```

**Characteristics:**

- **Latency**: Low (must meet SLA, typically p99 < 100ms).
- **Throughput**: Variable (must handle peak traffic).
- **Complexity**: High (feature retrieval, model serving, and response all on the critical path).
- **Cost**: Must provision for peak load; GPU utilization often 20--40%.

**Latency budget decomposition.** For an online prediction with a 100ms SLA:

| Component | Budget | Notes |
|-----------|--------|-------|
| Network (client to server) | 20ms | Geographically distributed |
| Feature retrieval | 20ms | Online feature store, Redis/DynamoDB |
| Model inference | 40ms | GPU inference, batched if possible |
| Post-processing | 10ms | Ranking, filtering, business logic |
| Buffer | 10ms | Safety margin for tail latency |

**Dynamic batching.** A critical optimization for online serving is dynamic batching: accumulating requests over a short window and processing them as a batch.

Let $w$ be the batching window (wait time), $b$ be the resulting batch size, and $T_{\text{infer}}(b)$ be the inference time for a batch of size $b$. The per-request latency is:

$$T_{\text{request}} = w + T_{\text{infer}}(b) + T_{\text{overhead}}$$

The throughput is:

$$\text{Throughput} = \frac{b}{w + T_{\text{infer}}(b)}$$

For GPU models, $T_{\text{infer}}(b)$ is often nearly constant for $b \leq b_{\text{max}}$ (due to parallelism), so batching provides a near-linear throughput increase with minimal latency cost.

### 4.3 Streaming Architecture

Streaming architectures process events continuously as they arrive, maintaining running state and producing predictions in near-real-time.

```
[Event Stream (Kafka)] → [Stream Processor (Flink)] → [Feature Update] → [Model Inference]
                                                              ↓                    ↓
                                                     [Feature Store]      [Action/Alert]
```

**Characteristics:**

- **Latency**: Low to moderate (seconds to minutes, depending on window size).
- **Throughput**: High (continuous processing, no batch scheduling overhead).
- **Complexity**: Highest (stateful stream processing, exactly-once semantics, windowing logic).
- **Cost**: Continuous compute allocation; can be amortized across multiple consumers.

**When streaming is necessary:**

- Features depend on recent events (e.g., "number of transactions in the last 5 minutes" for fraud detection).
- The system must react to events within seconds.
- Batch processing would introduce unacceptable staleness.

**Windowing semantics.** Stream processing requires defining windows over the event stream:

- **Tumbling window**: Fixed-size, non-overlapping windows. Each event belongs to exactly one window.
- **Sliding window**: Fixed-size windows that advance by a step size. Events can belong to multiple windows.
- **Session window**: Dynamic windows defined by gaps in activity. Useful for user sessions.

For a feature $f$ computed over a tumbling window of size $W$ seconds:

$$f_t = \text{agg}(\{e_i : t - W < \text{timestamp}(e_i) \leq t\})$$

where $\text{agg}$ is an aggregation function (count, sum, mean, etc.).

### 4.4 Architecture Comparison

| Property | Batch | Online | Streaming |
|----------|-------|--------|-----------|
| Prediction freshness | Hours | Real-time | Seconds--minutes |
| Feature freshness | Hours | Mixed | Seconds |
| GPU utilization | 90%+ | 20--40% | 40--60% |
| Operational complexity | Low | Medium | High |
| Cost efficiency | High | Low | Medium |
| Failure impact | Delayed predictions | Request failure | Delayed/stale predictions |
| Typical use cases | Recommendations, risk scoring | Search ranking, ad bidding | Fraud detection, anomaly detection |

---

## 5. Design Patterns

### 5.1 Model-as-Service Pattern

The model is deployed as an independent service with a well-defined API (typically REST or gRPC).

```python
# Model service interface (gRPC-style)
service ModelService {
    rpc Predict(PredictRequest) returns (PredictResponse);
    rpc GetModelInfo() returns (ModelInfo);
    rpc HealthCheck() returns (HealthStatus);
}

message PredictRequest {
    repeated float features = 1;
    string model_version = 2;  // Optional: pin to specific version
}

message PredictResponse {
    repeated float predictions = 1;
    string model_version = 2;
    float latency_ms = 3;
}
```

**Advantages:**
- Independent deployment: the model can be updated without redeploying the application.
- Independent scaling: model servers can autoscale based on inference load.
- Polyglot: the model can be in Python while the application is in Go or Java.

**Disadvantages:**
- Network latency: every prediction requires a network call.
- Serialization overhead: features must be serialized/deserialized.
- Operational complexity: another service to deploy, monitor, and maintain.

### 5.2 Feature Store Pattern

A feature store is a centralized system for managing, storing, and serving features.

```
                        ┌─────────────────────────┐
                        │      Feature Store       │
                        │                          │
[Batch Pipeline] ──────→│  Offline Store (Hive/S3) │──────→ [Training Pipeline]
                        │                          │
[Stream Pipeline] ─────→│  Online Store (Redis/DB) │──────→ [Serving Pipeline]
                        │                          │
                        │  Registry & Metadata     │──────→ [Discovery/Docs]
                        └─────────────────────────┘
```

**Why feature stores exist.** The fundamental problem is **train-serve skew**: features computed differently at training time and serving time. If training uses a batch SQL query to compute "user's average spend in the last 30 days" but serving uses a different implementation, subtle numerical differences can degrade model performance.

A feature store solves this by providing:

1. **Single definition**: each feature is defined once and computed consistently.
2. **Dual materialization**: features are materialized to both an offline store (for training) and an online store (for serving).
3. **Point-in-time correctness**: training data is constructed with features as they existed at prediction time, avoiding look-ahead bias.
4. **Discovery and reuse**: features are documented and searchable, enabling cross-team reuse.

**Point-in-time join.** This is perhaps the most critical capability. Given a set of labeled examples with timestamps $\{(t_i, y_i)\}$ and a feature source that produces values $\{(t_j, f_j)\}$, the point-in-time join retrieves:

$$f(t_i) = f_{j^*} \quad \text{where} \quad j^* = \arg\max_{j: t_j \leq t_i} t_j$$

That is, for each label timestamp, it retrieves the most recent feature value that was available at that time. Without this, future information leaks into training data.

### 5.3 Embedded Model Pattern

The model is compiled and embedded directly into the application binary (e.g., on-device, in a mobile app, or in a latency-sensitive service).

**Characteristics:**
- Zero network latency for inference.
- Model updates require application redeployment.
- Constrained to the application's compute resources.
- Useful for edge deployment, privacy-sensitive applications, and ultra-low-latency requirements.

**Implementation via ONNX Runtime or TFLite:**

```python
# Embedded model serving (ONNX Runtime example)
import onnxruntime as ort
import numpy as np

class EmbeddedModel:
    def __init__(self, model_path: str):
        self.session = ort.InferenceSession(
            model_path,
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        self.input_name = self.session.get_inputs()[0].name

    def predict(self, features: np.ndarray) -> np.ndarray:
        """Synchronous, in-process inference. No network call."""
        return self.session.run(
            None, {self.input_name: features.astype(np.float32)}
        )[0]
```

### 5.4 Pattern Selection Guide

| Factor | Model-as-Service | Feature Store + Online | Embedded | Batch |
|--------|-----------------|----------------------|----------|-------|
| Latency requirement | <100ms | <50ms | <10ms | Hours OK |
| Model update frequency | Hours | Hours | Days--weeks | Hours |
| Feature complexity | High | Very high | Low | Very high |
| Team independence | High | Medium | Low | Medium |
| Compute requirements | GPU server | GPU server | Edge device | GPU cluster |

---

## 6. Microservice vs. Monolith for ML

### 6.1 The Microservice Architecture

In a microservice ML architecture, each component is an independent service:

```
[Gateway] → [Feature Service] → [Embedding Service]
                ↓                        ↓
          [Ranking Service] ← [Candidate Generation Service]
                ↓
          [Response Service]
```

**Advantages:**
- Each service can be deployed, scaled, and updated independently.
- Different services can use different languages, frameworks, and hardware.
- Fault isolation: a failing embedding service does not crash the ranking service.

**Disadvantages:**
- Network latency accumulates across service calls.
- Distributed system complexity: distributed tracing, circuit breakers, retries.
- Data serialization overhead for large tensors.

### 6.2 The Monolith Architecture

In a monolith, the entire inference pipeline runs in a single process:

```python
class MonolithicPipeline:
    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.candidate_generator = CandidateGenerator()
        self.ranker = Ranker()
        self.filter = BusinessRuleFilter()

    def predict(self, request: Request) -> Response:
        features = self.feature_extractor.extract(request)
        candidates = self.candidate_generator.generate(features)
        scores = self.ranker.rank(candidates, features)
        results = self.filter.apply(scores)
        return Response(results)
```

**Advantages:**
- No network overhead between components.
- Simpler debugging and profiling (single process).
- Lower operational complexity.

**Disadvantages:**
- All components must be deployed together.
- Scaling requires replicating the entire pipeline.
- A bug in one component can crash the entire service.

### 6.3 Practical Guidance

Most production ML systems use a **hybrid** approach:

- The core inference path (feature extraction, model inference, post-processing) runs in a single service for latency.
- Supporting services (feature computation, model registry, experiment tracking) are separate microservices.
- The training pipeline is entirely separate from serving.

The decision framework:

| If you have... | Use... | Because... |
|----------------|--------|------------|
| Single model, single team | Monolith | Simplicity wins |
| Multiple models, multiple teams | Microservices | Deployment independence |
| Tight latency budget (<20ms) | Monolith or embedded | Network latency is unacceptable |
| Heterogeneous hardware | Microservices | Different services on different hardware |

---

## 7. The ML Lifecycle

### 7.1 Lifecycle Stages

The ML lifecycle is a continuous loop, not a linear pipeline:

```
Experiment → Validate → Deploy → Monitor → Retrain → Experiment → ...
```

Each stage has specific systems requirements:

**Experiment.** Data access, compute allocation, experiment tracking, hyperparameter search. Systems: Jupyter, W&B, Ray Tune.

**Validate.** Offline evaluation, A/B test design, shadow deployment setup. Systems: evaluation pipelines, statistical testing frameworks.

**Deploy.** Model packaging, canary rollout, traffic routing. Systems: Docker, Kubernetes, model registries.

**Monitor.** Prediction logging, drift detection, performance tracking. Systems: Prometheus, Grafana, custom drift detectors.

**Retrain.** Data pipeline refresh, automated training, regression testing. Systems: Airflow, Kubeflow, CI/CD pipelines.

### 7.2 Maturity Levels

Google's MLOps maturity model defines three levels:

**Level 0: Manual process.** Data scientists train models manually in notebooks. Models are deployed manually. No monitoring or automated retraining.

**Level 1: ML pipeline automation.** Training is automated via a pipeline. The pipeline produces a trained model artifact. Serving is automated. But the pipeline itself is static.

**Level 2: CI/CD pipeline automation.** The pipeline code itself is versioned and tested. Changes to the pipeline trigger automated testing, validation, and deployment. The entire system is continuously integrated and deployed.

| Capability | Level 0 | Level 1 | Level 2 |
|-----------|---------|---------|---------|
| Training | Manual | Automated pipeline | Automated pipeline |
| Deployment | Manual | Automated | Automated + canary |
| Monitoring | None | Basic metrics | Full observability |
| Retraining | Manual | Scheduled or triggered | Triggered + validated |
| Pipeline testing | None | None | Automated |

---

## 8. Case Studies

### 8.1 Recommendation System Architecture

A large-scale recommendation system (e.g., YouTube, Netflix) typically follows a multi-stage architecture:

**Stage 1: Candidate Generation.**
- Retrieves $O(100\text{--}1000)$ candidates from $O(10^6\text{--}10^9)$ items.
- Uses lightweight models: two-tower (user embedding + item embedding with dot product), approximate nearest neighbor search.
- Latency budget: 10--20ms.
- Architecture: batch-precomputed item embeddings + online user embedding + ANN index (FAISS, ScaNN).

**Stage 2: Ranking.**
- Scores $O(100\text{--}1000)$ candidates with a heavier model.
- Uses rich features: user history, item metadata, context, cross-features.
- Latency budget: 30--50ms.
- Architecture: online prediction with feature store lookups.

**Stage 3: Re-ranking and Business Logic.**
- Applies diversity, freshness, and policy constraints.
- Typically rule-based or lightweight optimization.
- Latency budget: 5--10ms.

**Total system:**

```
[User Request] → [User Embedding (online)] → [ANN Search] → [Feature Enrichment]
                                                                      ↓
                      [Response] ← [Business Logic] ← [Ranking Model]
```

### 8.2 Search Ranking Architecture

Search ranking systems (e.g., Google, Bing) have similar multi-stage architectures but with important differences:

- **Query understanding** is a critical first step (query expansion, intent classification, entity recognition).
- **Inverted index retrieval** replaces ANN search for the first stage.
- **Learning-to-rank** models use features that combine query, document, and query-document interaction signals.

The latency requirements are typically stricter: p99 < 200ms for the entire search results page, including document retrieval, snippet generation, and rendering.

---

## Key Takeaways

1. **ML systems are mostly not ML.** The model is a small fraction of the total system. Understanding the surrounding infrastructure (data pipelines, feature stores, serving, monitoring) is essential.
2. **Technical debt in ML is insidious.** Data dependencies, feedback loops, and entanglement create maintenance burdens that are invisible in code reviews. The CACE principle (Changing Anything Changes Everything) demands systematic change management.
3. **Architecture choice depends on latency and freshness.** Batch prediction is simplest and most cost-effective; online prediction is necessary for interactive applications; streaming is required when features depend on recent events.
4. **Feature stores solve train-serve skew.** The single most impactful infrastructure investment for ML teams is a feature store that ensures consistent feature computation between training and serving.
5. **The ML lifecycle is a loop.** Production ML systems require continuous monitoring, evaluation, and retraining. A system that cannot be updated is a system that will degrade.

---

## Further Reading

1. **Sculley, D., Holt, G., Golovin, D., et al.** (2015). "Hidden Technical Debt in Machine Learning Systems." *NeurIPS 2015.*
   - The foundational paper on ML systems debt. Required reading for any ML practitioner.

2. **Amershi, S., Begel, A., Bird, C., et al.** (2019). "Software Engineering for Machine Learning: A Case Study." *ICSE-SEIP 2019.*
   - Microsoft's experience with production ML, covering the full lifecycle.

3. **Paleyes, A., Urma, R.-G., and Lawrence, N.D.** (2022). "Challenges in Deploying Machine Learning: A Survey of Case Studies." *ACM Computing Surveys.*
   - Comprehensive survey of deployment challenges across industries.

4. **Polyzotis, N., Roy, S., Whang, S.E., and Zinkevich, M.** (2019). "Data Lifecycle Challenges in Production Machine Learning." *SIGMOD Record.*
   - Google's perspective on data management for ML systems.

5. **Li, J., et al.** (2023). "The Data-Centric AI Paradigm." *arXiv.*
   - Modern perspective on treating data as a first-class citizen in ML systems.

6. **Covington, P., Adams, J., and Sargin, E.** (2016). "Deep Neural Networks for YouTube Recommendations." *RecSys 2016.*
   - Classic system design case study for large-scale recommendations.
