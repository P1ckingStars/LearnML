# Lecture 08b: Feature Stores & Data Versioning

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Articulate** the motivation for feature stores and describe the architectural split between online (low-latency serving) and offline (batch training) feature stores, including the consistency guarantees each provides.
2. **Compare** feature store systems (Feast, Tecton, Hopsworks) along dimensions of materialization strategy, storage backends, feature transformation support, and integration with ML training pipelines.
3. **Design** a data versioning strategy for ML experiments using DVC, lakeFS, or Delta Lake, reasoning about the tradeoffs between copy-on-write, content-addressable storage, and log-structured approaches.
4. **Implement** end-to-end dataset lineage tracking that connects raw data, transformation code, feature definitions, and model artifacts into a reproducible pipeline.
5. **Evaluate** the feature engineering lifecycle from prototyping to production, identifying where feature/training skew arises and how feature stores prevent it.

---

## 2. Motivation and Context

### 2.1 The Feature Management Problem

Consider a recommendation system at a large technology company. The model consumes hundreds of features: user demographics, click history, item embeddings, real-time session context, and aggregated statistics. These features are produced by dozens of teams, computed at different cadences (real-time, hourly, daily), and stored in different systems (Kafka streams, Hive tables, Redis caches).

Without a centralized system, three problems emerge:

**Feature/training skew.** The features used during training differ from those used during inference. A training pipeline computes `user_avg_session_length` from a Hive query with a 7-day window. The serving pipeline computes it from a Redis cache with a slightly different aggregation. The model sees data at inference time that is subtly different from what it trained on, causing silent accuracy degradation.

**Duplicated computation.** Multiple teams independently implement the same feature (e.g., "user 30-day purchase count") with slightly different semantics. This wastes engineering time and introduces inconsistencies.

**Reproducibility failure.** A model trained 3 months ago cannot be reproduced because the feature computation code has changed, the source data has been overwritten, and nobody recorded which exact version of each feature was used.

### 2.2 Why Data Versioning Is Hard for ML

Software engineering solved code versioning with Git. But ML has additional artifacts that must be versioned:

- **Training data**: Terabytes to petabytes, too large for Git.
- **Feature definitions**: Code that transforms raw data into features.
- **Feature values**: The materialized results of those transformations.
- **Hyperparameters and configuration**: Training scripts, model architecture definitions.
- **Model artifacts**: Weights, optimizer state, evaluation metrics.

The relationships between these artifacts form a DAG (directed acyclic graph) of dependencies. Changing any upstream node (raw data, feature code) should invalidate all downstream nodes. Git tracks code; we need something that tracks data, code, and their relationships together.

### 2.3 Scope

This lecture covers two interconnected systems: feature stores (how features are defined, computed, stored, and served) and data versioning (how datasets and their lineage are tracked over time). Together, they form the data management layer of a production ML system.

---

## 3. Feature Store Architecture

### 3.1 Core Abstraction: The Feature

A feature store's fundamental abstraction is the **feature definition**: a declarative specification of how a feature is computed from source data.

```python
# Feast feature definition example
from feast import Entity, Feature, FeatureView, FileSource, ValueType
from datetime import timedelta

# Define the data source
driver_stats_source = FileSource(
    path="s3://data-lake/driver_stats.parquet",
    timestamp_field="event_timestamp",
    created_timestamp_column="created",
)

# Define the entity (the "join key")
driver = Entity(
    name="driver_id",
    value_type=ValueType.INT64,
    description="Unique driver identifier",
)

# Define a feature view (a group of related features)
driver_stats_fv = FeatureView(
    name="driver_hourly_stats",
    entities=[driver],
    ttl=timedelta(days=1),
    schema=[
        Feature(name="conv_rate", dtype=ValueType.FLOAT),
        Feature(name="acc_rate", dtype=ValueType.FLOAT),
        Feature(name="avg_daily_trips", dtype=ValueType.INT32),
    ],
    online=True,
    source=driver_stats_source,
)
```

This declaration captures:
- **What** the feature is (name, type, description).
- **Where** it comes from (source table/file).
- **How** it relates to entities (join key).
- **When** it expires (TTL for online serving).

### 3.2 Online vs. Offline Stores

The dual-store architecture is the defining pattern of feature stores:

```
                    +-----------------+
                    | Feature Registry|    (metadata: definitions, schemas,
                    |   (metadata)    |     lineage, ownership)
                    +--------+--------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +--------v--------+
     |  Offline Store   |          |  Online Store   |
     |  (batch access)  |          | (low-latency)   |
     +---------+--------+          +--------+--------+
               |                            |
     +---------v--------+          +--------v--------+
     | Data Warehouse   |          | Key-Value Store  |
     | (BigQuery, S3,   |          | (Redis, DynamoDB,|
     |  Redshift, Hive) |          |  Bigtable)       |
     +------------------+          +-----------------+
               |                            |
     +---------v--------+          +--------v--------+
     | Training Pipeline|          | Serving Pipeline |
     | (batch reads)    |          | (point lookups)  |
     +------------------+          +-----------------+
```

**Offline store**: Optimized for batch reads. Training pipelines query the offline store to construct training datasets. Typical query: "Give me features X, Y, Z for all users who had a conversion event in the last 30 days." This is a large-scale join operation, often implemented as a point-in-time join to prevent data leakage.

**Online store**: Optimized for low-latency point lookups. Serving pipelines query the online store to get features for a single entity at inference time. Typical query: "Give me the current features for user_id=12345." Latency requirement: < 10ms at p99.

**Materialization**: The process of computing feature values and writing them to the stores. This can be:
- **Batch materialization**: A scheduled job (e.g., hourly Spark job) computes features and writes to both stores.
- **Stream materialization**: A streaming job (Flink, Spark Streaming) computes features from event streams in real-time.

### 3.3 Point-in-Time Joins

The most subtle and critical operation in a feature store is the **point-in-time join** (also called a temporal join). When constructing a training dataset, you must ensure that each training example uses only features that were available at the time the label was observed. Using future features is data leakage.

```
Timeline for entity_id = 42:

  feature_A updated    feature_B updated    label observed    feature_A updated
        |                    |                   |                  |
   t=100               t=150                t=200              t=250

Correct join at t=200:  feature_A(t=100), feature_B(t=150)
Incorrect (leakage):    feature_A(t=250)  <-- this is in the future!
```

Implementation requires an **as-of join**: for each (entity, label_timestamp) pair, find the most recent feature value with `feature_timestamp <= label_timestamp`.

```sql
-- Point-in-time join in SQL (conceptual)
SELECT
    labels.entity_id,
    labels.label,
    labels.label_timestamp,
    features.feature_value,
    features.feature_timestamp
FROM labels
LEFT JOIN LATERAL (
    SELECT feature_value, feature_timestamp
    FROM features
    WHERE features.entity_id = labels.entity_id
      AND features.feature_timestamp <= labels.label_timestamp
    ORDER BY features.feature_timestamp DESC
    LIMIT 1
) features ON TRUE;
```

This is expensive at scale. Feast implements it using a sort-merge approach; Tecton uses Spark/Databricks for distributed execution.

### 3.4 Feature Transformation Tiers

Feature stores support transformations at different tiers, trading off flexibility for performance:

**Tier 1: Precomputed (batch).** Features are computed by an external pipeline (Spark, SQL, Python) and registered with the store. The store only handles storage and serving. This is what Feast primarily supports.

**Tier 2: Managed transformations (batch + stream).** The feature store itself orchestrates the transformation. You write the transformation logic; the store handles scheduling, scaling, and consistency.

```python
# Tecton managed transformation example
@batch_feature_view(
    sources=[transactions_batch_source],
    entities=[user],
    mode="spark_sql",
    online=True,
    offline=True,
    batch_schedule=timedelta(days=1),
)
def user_transaction_features(transactions):
    return f"""
        SELECT
            user_id,
            COUNT(*) AS transaction_count_30d,
            AVG(amount) AS avg_transaction_amount_30d,
            MAX(amount) AS max_transaction_amount_30d
        FROM {transactions}
        WHERE timestamp >= current_timestamp() - INTERVAL 30 DAYS
        GROUP BY user_id
    """
```

**Tier 3: On-demand transformations.** Features computed at request time from raw inputs. Necessary for features that depend on the inference request itself (e.g., "time since user's last action" requires knowing the current time).

### 3.5 System Comparison

| Feature | Feast | Tecton | Hopsworks |
|---------|-------|--------|-----------|
| License | Apache 2.0 | Commercial | AGPL / Commercial |
| Offline store | File, BigQuery, Redshift, Snowflake | Spark/Databricks, Rift (proprietary) | Hudi on S3/HDFS |
| Online store | Redis, DynamoDB, SQLite, Postgres | DynamoDB, Bigtable | RonDB (NDB Cluster) |
| Transformations | External only | Managed (batch, stream, on-demand) | Managed (Spark, Flink, Python) |
| Streaming | Via external pipeline | Native (Kinesis, Kafka) | Native (Kafka, Spark Streaming) |
| Point-in-time join | Yes | Yes | Yes |
| Feature monitoring | Basic (via plugins) | Built-in drift detection | Built-in |
| Scale | Medium (single-node registry) | Large (managed SaaS) | Large (distributed) |

---

## 4. Data Versioning

### 4.1 Why Git Alone Is Insufficient

Git stores the entire history of every file in the repository. For a 100 GB dataset:
- `git add` computes a SHA-1 hash and stores the full file as a blob.
- Every modification creates a new 100 GB blob.
- `git clone` downloads the entire history.

Git LFS (Large File Storage) mitigates this by storing large files in a separate server, but it lacks dataset-level semantics (versioning, branching, diffing at the row/column level).

### 4.2 DVC (Data Version Control)

DVC extends Git with data versioning. The key idea: store metadata (pointers) in Git, and actual data in a remote storage backend (S3, GCS, Azure Blob, SSH).

```bash
# Initialize DVC in a Git repository
dvc init

# Track a large dataset
dvc add data/training_set.parquet
# Creates: data/training_set.parquet.dvc  (pointer file, tracked by Git)
# Moves data to: .dvc/cache/  (content-addressable store)

# Push data to remote storage
dvc remote add -d myremote s3://my-bucket/dvc-cache
dvc push

# Reproduce a pipeline
dvc repro  # re-runs stages whose inputs have changed
```

**The `.dvc` file** is a small YAML file containing the MD5 hash, size, and path of the tracked file:

```yaml
outs:
- md5: a1b2c3d4e5f6...
  size: 107374182400
  path: training_set.parquet
```

**DVC Pipelines** define a DAG of processing stages:

```yaml
# dvc.yaml
stages:
  preprocess:
    cmd: python preprocess.py --input raw/ --output processed/
    deps:
      - raw/
      - preprocess.py
    outs:
      - processed/
  train:
    cmd: python train.py --data processed/ --model model.pkl
    deps:
      - processed/
      - train.py
    outs:
      - model.pkl
    metrics:
      - metrics.json:
          cache: false
```

`dvc repro` executes the pipeline, skipping stages whose inputs have not changed (like `make`). Combined with Git, this provides full reproducibility: `git checkout v1.0 && dvc checkout` restores both code and data to the exact state of version 1.0.

### 4.3 lakeFS: Git-Like Operations on Data Lakes

lakeFS provides Git-like branching, committing, and merging for object storage (S3, GCS, Azure Blob). It implements a metadata layer on top of the object store, intercepting S3 API calls.

```
lakefs://my-repo/main/datasets/training.parquet     (main branch)
lakefs://my-repo/experiment-42/datasets/training.parquet  (branch)
```

**Key operations:**

```python
import lakefs_client
from lakefs_client.client import LakeFSClient

client = LakeFSClient(configuration)

# Create a branch for an experiment
client.branches.create_branch(
    repository="ml-data",
    branch_creation={"name": "experiment-42", "source": "main"},
)

# Make changes (upload new data, modify files)
client.objects.upload_object(
    repository="ml-data",
    branch="experiment-42",
    path="datasets/training_v2.parquet",
    content=data,
)

# Commit changes
client.commits.commit(
    repository="ml-data",
    branch="experiment-42",
    commit_creation={"message": "Add filtered training set v2"},
)

# Merge back to main after validation
client.refs.merge_into_branch(
    repository="ml-data",
    source_ref="experiment-42",
    destination_branch="main",
)
```

**Copy-on-write semantics**: Creating a branch does not copy data. lakeFS maintains a metadata tree (similar to Git's tree objects) that points to the same underlying objects. Only modified objects are written as new copies.

**Advantages over DVC**: lakeFS operates at the storage layer, so any tool that reads/writes S3 (Spark, Presto, PyTorch) works with lakeFS without modification. DVC requires explicit `dvc push/pull` commands.

### 4.4 Delta Lake

Delta Lake (from Databricks) adds ACID transactions, schema enforcement, and time travel to data lakes. Built on Parquet files with a JSON transaction log.

```
delta_table/
  _delta_log/
    00000000000000000000.json   # Initial table creation
    00000000000000000001.json   # Insert 1000 rows
    00000000000000000002.json   # Update 50 rows
    00000000000000000003.json   # Delete 10 rows
  part-00000-...snappy.parquet  # Data files
  part-00001-...snappy.parquet
```

**Time travel** enables exact dataset reproduction:

```python
from delta.tables import DeltaTable

# Read the table as it was at a specific version
df_v3 = spark.read.format("delta").option("versionAsOf", 3).load("delta_table/")

# Read the table as it was at a specific timestamp
df_old = spark.read.format("delta") \
    .option("timestampAsOf", "2025-01-15") \
    .load("delta_table/")
```

**Schema evolution**: Delta Lake enforces schema on write but supports evolution:

```python
# Adding a new column
df_new.write.format("delta") \
    .mode("append") \
    .option("mergeSchema", "true") \
    .save("delta_table/")
```

### 4.5 Versioning Strategy Comparison

| Dimension | DVC | lakeFS | Delta Lake |
|-----------|-----|--------|------------|
| Granularity | File-level | Object-level | Row-level |
| Branching model | Git branches (code) + DVC pointers | Native branches on data | Version numbers + time travel |
| Storage overhead | Full copy per version (dedup via content-addressing) | Copy-on-write (metadata only) | Log-structured (append-only Parquet) |
| Integration | CLI tool, requires `dvc pull` | S3-compatible API (transparent) | Spark, Presto, Trino native |
| Schema support | None (opaque files) | None (opaque objects) | Full (Parquet schema + enforcement) |
| Best for | Small-medium datasets, Git-centric workflows | Data lake environments, multi-tool access | Structured data, data warehouse patterns |

---

## 5. Dataset Lineage and Reproducibility

### 5.1 The Lineage DAG

A complete ML experiment has a dependency graph:

```
Raw Data (v2.1)
    |
    v
Preprocessing Code (commit abc123)
    |
    v
Cleaned Data (hash: 7f3a...)
    |
    +---> Feature Eng. Code (commit def456) ---> Feature Set (hash: 9c2b...)
    |                                                |
    v                                                v
Labels (v1.3)                              Training Config (lr=1e-4, ...)
    |                                                |
    +------------------------------------------------+
    |
    v
Model Artifact (hash: 4d8e...)
    |
    v
Evaluation Metrics (accuracy: 0.847, F1: 0.823)
```

Every node must be identifiable (content hash or version number) and every edge must be recorded. Reproducibility means: given the root nodes (raw data + code), you can reconstruct every downstream artifact.

### 5.2 Implementing Lineage Tracking

A practical approach combines multiple tools:

```python
import mlflow
import hashlib

def compute_data_hash(path: str) -> str:
    """Content-addressable hash for a data file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def train_with_lineage(data_path: str, config: dict):
    with mlflow.start_run():
        # Log data lineage
        data_hash = compute_data_hash(data_path)
        mlflow.log_param("data_path", data_path)
        mlflow.log_param("data_hash", data_hash)
        mlflow.log_param("data_version", "v2.1")  # from DVC or lakeFS

        # Log code lineage
        git_commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"]
        ).decode().strip()
        mlflow.log_param("git_commit", git_commit)

        # Log all hyperparameters
        mlflow.log_params(config)

        # Train
        model = train(data_path, config)

        # Log model artifact
        mlflow.pytorch.log_model(model, "model")

        # Log metrics
        metrics = evaluate(model, test_data)
        mlflow.log_metrics(metrics)
```

### 5.3 The Feature/Training Skew Problem

Feature/training skew is one of the most insidious bugs in ML systems. It occurs when the feature values a model sees during training differ from those during inference:

**Source 1: Code skew.** Training features are computed in Python/PySpark; serving features are computed in Java/C++. Subtle differences in floating-point operations, null handling, or edge cases cause divergence.

**Source 2: Data skew.** Training uses historical data from a warehouse; serving uses real-time data from a stream. The aggregation windows, data freshness, or sampling methods differ.

**Source 3: Temporal skew.** Training uses features computed offline (e.g., "user's average purchase amount over last 30 days" computed once daily). Serving uses the same feature but computed with a different data cutoff.

**Prevention**: Feature stores address all three sources by ensuring that the same feature definition (code) and the same materialized values are used in both training and serving.

---

## 6. The Feature Engineering Lifecycle

### 6.1 Phase 1: Prototyping

Data scientists explore features in notebooks, using Pandas on sampled data:

```python
# Notebook exploration
df = pd.read_parquet("sample_transactions.parquet")
df["user_30d_spend"] = df.groupby("user_id")["amount"].transform(
    lambda x: x.rolling("30D").sum()
)
```

At this stage, features are ad-hoc, not versioned, and not shareable.

### 6.2 Phase 2: Productionization

The feature is formalized as a feature store definition:

```python
@stream_feature_view(
    source=transaction_stream,
    entities=[user],
    online=True,
    offline=True,
    feature_start_time=datetime(2023, 1, 1),
    batch_schedule=timedelta(days=1),
)
def user_spending_features(transactions: DataFrame):
    return transactions.groupBy("user_id").agg(
        F.sum(
            F.when(
                F.col("timestamp") >= F.current_timestamp() - F.expr("INTERVAL 30 DAYS"),
                F.col("amount")
            ).otherwise(0)
        ).alias("user_30d_spend"),
        F.count("*").alias("user_30d_transaction_count"),
    )
```

### 6.3 Phase 3: Monitoring

Once in production, features must be monitored for drift:

- **Schema violations**: Unexpected nulls, type mismatches.
- **Distribution drift**: The feature distribution shifts from the training distribution (e.g., mean spend increases due to inflation).
- **Freshness violations**: The feature has not been updated within its expected cadence.

```python
# Feature monitoring with Great Expectations
import great_expectations as gx

context = gx.get_context()
suite = context.add_expectation_suite("user_spending_features")

suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="user_30d_spend", min_value=0, max_value=100000
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnMeanToBeBetween(
        column="user_30d_spend", min_value=50, max_value=500
    )
)
```

### 6.4 Phase 4: Deprecation

Features have lifecycles. When a feature is deprecated:
1. Mark it as deprecated in the registry with a sunset date.
2. Identify all models consuming the feature.
3. Retrain those models without the feature (or with a replacement).
4. Remove the feature definition and stop materialization.

---

## 7. Advanced Topics

### 7.1 Feature Platforms at Scale

At large technology companies, feature stores serve billions of feature lookups per second:

**Architecture at scale (conceptual)**:

```
[Event Streams (Kafka)]  -->  [Stream Processing (Flink)]  -->  [Online Store (Bigtable)]
                                     |                                    |
                                     v                                    v
                              [Offline Store (BigQuery)]         [Model Serving]
                                     |
                                     v
                              [Training Pipeline]
```

Key engineering challenges:
- **Consistency**: When a feature is updated in the online store, the offline store must eventually reflect the same value (eventual consistency is usually acceptable).
- **Backfill**: When a new feature is defined, historical values must be computed for the entire history (backfill job). This can take hours for features over billions of entities.
- **Cost**: Storing the last N versions of every feature for every entity at the granularity needed for point-in-time joins is expensive. TTL policies and tiered storage help manage cost.

### 7.2 Embedding Features

Modern ML systems increasingly use learned embeddings as features (e.g., user embeddings from a recommendation model, text embeddings from a language model). This creates a circular dependency: the embedding model depends on features, and features include embeddings from other models.

Feature stores must handle embedding features specially:
- **Size**: Embeddings are dense vectors (768--4096 dimensions), much larger than scalar features.
- **Update cadence**: Embeddings may be recomputed daily or weekly as the embedding model is retrained.
- **Approximate nearest neighbor (ANN)**: Online serving may require not just the embedding itself but ANN search results, requiring integration with vector databases.

### 7.3 Data Contracts

A data contract is a formal agreement between the producer and consumer of a feature:

```yaml
# data_contract.yaml
feature: user_30d_spend
owner: payments-team
sla:
  freshness: 1 hour
  availability: 99.9%
schema:
  type: float64
  nullable: false
  range: [0, 1000000]
  unit: USD
consumers:
  - fraud-detection-model
  - recommendation-model
change_policy:
  breaking_changes: require 30-day notice and consumer approval
```

Data contracts formalize the expectations that downstream consumers have of upstream data producers, enabling safe evolution of features.

---

## Key Takeaways

1. **Feature stores solve the training/serving skew problem** by ensuring the same feature definitions and materialized values are used in both contexts.
2. **The online/offline dual-store architecture** reflects the fundamental tradeoff between low-latency point lookups (serving) and high-throughput batch reads (training).
3. **Point-in-time joins are the critical operation** for constructing correct training datasets without data leakage.
4. **Data versioning extends Git's model to large artifacts** using content-addressable storage (DVC), copy-on-write metadata layers (lakeFS), or log-structured storage (Delta Lake).
5. **Lineage tracking connects raw data to model predictions**, enabling reproducibility, debugging, and regulatory compliance.
6. **Feature engineering is a lifecycle**, not a one-time activity. Features must be monitored, maintained, and eventually deprecated.

---

## Further Reading

1. **Feast Documentation.** https://docs.feast.dev/ --- Open-source feature store reference. Study the architecture overview and the point-in-time join implementation.

2. **Tecton Blog: "What is a Feature Store?"** https://www.tecton.ai/blog/what-is-a-feature-store/ --- Authoritative introduction from the creators of Feast (who later founded Tecton).

3. **Iterative.ai.** (2020). "DVC: Data Version Control." https://dvc.org/doc --- Official DVC documentation with pipeline and experiment tracking.

4. **Zaremba, M. et al.** (2023). "lakeFS: A Scalable Data Version Control System." *SIGMOD 2023 Industry Track.* --- Design of lakeFS, including the copy-on-write metadata layer and S3 gateway.

5. **Armbrust, M. et al.** (2020). "Delta Lake: High-Performance ACID Table Storage over Cloud Object Stores." *VLDB 2020.* --- Design of Delta Lake's transaction log and time travel.

6. **Schelter, S., Lange, D., Schmidt, P., Celikel, M., Biessmann, F., and Grafberger, A.** (2018). "Automating Large-Scale Data Quality Verification." *VLDB 2018.* --- Amazon's Deequ system for automated data quality monitoring, directly applicable to feature monitoring.

7. **Sculley, D. et al.** (2015). "Hidden Technical Debt in Machine Learning Systems." *NeurIPS 2015.* --- The foundational paper on ML systems technical debt; Section 4 discusses data dependencies and feature management.
