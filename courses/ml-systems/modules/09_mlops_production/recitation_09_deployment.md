# Recitation 09: Deploying a Model with Containerization + Monitoring

## Overview

This recitation is a hands-on walkthrough of deploying a trained model to production. We will containerize a model server with Docker, set up monitoring with Prometheus and Grafana, implement health checks, and configure drift detection. By the end of this session, you will have a running deployment that mirrors real production setups.

**Prerequisites:** Lectures 09a--09c, Docker basics, Python HTTP frameworks.

**What you will build:**
1. A containerized model server (FastAPI + ONNX Runtime)
2. Prometheus metrics collection (latency, throughput, prediction distribution)
3. Grafana dashboards for visualization
4. A drift detection sidecar that monitors feature distributions

---

## 1. Model Server Implementation

### 1.1 Project Structure

```
ml-deploy/
  model_server/
    server.py          # FastAPI application
    model.py           # Model loading and inference
    monitoring.py       # Prometheus metrics
    drift.py           # Drift detection
  Dockerfile
  docker-compose.yaml
  prometheus.yaml
  grafana/
    dashboards/
      model_dashboard.json
  requirements.txt
  tests/
    test_server.py
    test_drift.py
```

### 1.2 The Model Wrapper

We wrap the model in a class that handles loading, preprocessing, and inference.

```python
# model_server/model.py
import numpy as np
import onnxruntime as ort
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

class ModelWrapper:
    """Wraps an ONNX model for inference with preprocessing."""

    def __init__(self, model_path: str, config_path: str):
        """
        Args:
            model_path: Path to .onnx model file.
            config_path: Path to JSON config with feature names,
                         normalization params, etc.
        """
        self.model_path = model_path
        self.config = self._load_config(config_path)
        self.session = self._load_model(model_path)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        logger.info(f"Model loaded from {model_path}")
        logger.info(f"Input: {self.input_name}, Output: {self.output_name}")

    def _load_config(self, config_path: str) -> dict:
        with open(config_path) as f:
            return json.load(f)

    def _load_model(self, model_path: str) -> ort.InferenceSession:
        opts = ort.SessionOptions()
        opts.graph_optimization_level = (
            ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )
        opts.intra_op_num_threads = 4

        providers = ["CPUExecutionProvider"]
        return ort.InferenceSession(model_path, opts, providers=providers)

    def preprocess(self, raw_features: dict) -> np.ndarray:
        """
        Preprocess raw features into model input format.

        Args:
            raw_features: Dict of feature_name -> value.
        Returns:
            Numpy array of shape (1, num_features).
        """
        feature_names = self.config["feature_names"]
        means = np.array(self.config["feature_means"])
        stds = np.array(self.config["feature_stds"])

        # Extract features in the correct order
        values = []
        for name in feature_names:
            val = raw_features.get(name)
            if val is None:
                # Use training mean as default for missing features
                idx = feature_names.index(name)
                val = means[idx]
                logger.warning(f"Missing feature '{name}', using mean={val}")
            values.append(float(val))

        features = np.array(values, dtype=np.float32).reshape(1, -1)

        # Standardize using training statistics
        features = (features - means) / (stds + 1e-8)

        return features

    def predict(self, features: np.ndarray) -> dict:
        """
        Run inference.

        Args:
            features: Preprocessed features of shape (batch, num_features).
        Returns:
            Dict with 'score' (float) and 'raw_output' (list).
        """
        output = self.session.run(
            [self.output_name],
            {self.input_name: features}
        )[0]

        # Assuming binary classification with sigmoid output
        score = float(output[0, 0])

        return {
            "score": score,
            "label": int(score > 0.5),
            "raw_output": output.tolist(),
        }
```

### 1.3 Prometheus Metrics

```python
# model_server/monitoring.py
from prometheus_client import (
    Counter, Histogram, Gauge, Summary, Info,
    generate_latest, CONTENT_TYPE_LATEST,
)
import time
from functools import wraps

# Request metrics
REQUEST_COUNT = Counter(
    "model_server_requests_total",
    "Total number of prediction requests",
    ["method", "endpoint", "status"],
)

REQUEST_LATENCY = Histogram(
    "model_server_request_latency_seconds",
    "Request latency in seconds",
    ["endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

INFERENCE_LATENCY = Histogram(
    "model_server_inference_latency_seconds",
    "Model inference latency (excluding preprocessing)",
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
)

# Prediction metrics
PREDICTION_SCORE = Histogram(
    "model_server_prediction_score",
    "Distribution of prediction scores",
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

PREDICTION_LABEL = Counter(
    "model_server_prediction_label_total",
    "Count of predicted labels",
    ["label"],
)

# Feature metrics
FEATURE_VALUES = {}  # Dynamically created per feature

# System metrics
ACTIVE_REQUESTS = Gauge(
    "model_server_active_requests",
    "Number of requests currently being processed",
)

MODEL_INFO = Info(
    "model_server_model",
    "Information about the loaded model",
)


def track_request(endpoint: str):
    """Decorator to track request metrics."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            ACTIVE_REQUESTS.inc()
            start = time.perf_counter()
            status = "success"
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status = "error"
                raise
            finally:
                duration = time.perf_counter() - start
                REQUEST_COUNT.labels(
                    method="POST", endpoint=endpoint, status=status
                ).inc()
                REQUEST_LATENCY.labels(endpoint=endpoint).observe(duration)
                ACTIVE_REQUESTS.dec()
        return wrapper
    return decorator


def record_prediction(score: float, label: int):
    """Record prediction metrics."""
    PREDICTION_SCORE.observe(score)
    PREDICTION_LABEL.labels(label=str(label)).inc()


def record_features(features: dict):
    """Record feature values for monitoring."""
    for name, value in features.items():
        if name not in FEATURE_VALUES:
            FEATURE_VALUES[name] = Histogram(
                f"model_server_feature_{name}",
                f"Distribution of feature {name}",
                buckets=[0.1, 0.5, 1.0, 5.0, 10.0, 50.0, 100.0, float("inf")],
            )
        try:
            FEATURE_VALUES[name].observe(float(value))
        except (TypeError, ValueError):
            pass  # Skip non-numeric features
```

### 1.4 The FastAPI Server

```python
# model_server/server.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import time
import logging
import os

from model_server.model import ModelWrapper
from model_server.monitoring import (
    track_request, record_prediction, record_features,
    INFERENCE_LATENCY, MODEL_INFO,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/model.onnx")
CONFIG_PATH = os.environ.get("CONFIG_PATH", "/models/config.json")
model: ModelWrapper = None


from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = ModelWrapper(MODEL_PATH, CONFIG_PATH)
    MODEL_INFO.info({
        "model_path": MODEL_PATH,
        "config_path": CONFIG_PATH,
        "version": os.environ.get("MODEL_VERSION", "unknown"),
    })
    logger.info("Model loaded and ready to serve.")
    yield


app = FastAPI(title="ML Model Server", version="1.0.0", lifespan=lifespan)


class PredictRequest(BaseModel):
    features: dict
    request_id: str = None


class PredictResponse(BaseModel):
    score: float
    label: int
    model_version: str
    latency_ms: float
    request_id: str = None


@app.post("/predict", response_model=PredictResponse)
@track_request(endpoint="/predict")
async def predict(request: PredictRequest):
    """Run model inference on input features."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Record raw features for monitoring
    record_features(request.features)

    # Preprocess
    features = model.preprocess(request.features)

    # Inference with timing
    start = time.perf_counter()
    result = model.predict(features)
    inference_time = time.perf_counter() - start
    INFERENCE_LATENCY.observe(inference_time)

    # Record prediction metrics
    record_prediction(result["score"], result["label"])

    return PredictResponse(
        score=result["score"],
        label=result["label"],
        model_version=os.environ.get("MODEL_VERSION", "unknown"),
        latency_ms=inference_time * 1000,
        request_id=request.request_id,
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "healthy", "model_loaded": True}


@app.get("/ready")
async def ready():
    """Readiness check. Returns 200 only when the model is loaded."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not ready")
    return {"status": "ready"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
```

---

## 2. Containerization

### 2.1 Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY model_server/ model_server/

# Create model directory
RUN mkdir -p /models

# Non-root user for security
RUN useradd -m appuser
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "model_server.server:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--log-level", "info"]
```

### 2.2 Requirements

```
# requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
onnxruntime==1.17.0
numpy==1.26.3
prometheus-client==0.20.0
pydantic==2.6.0
scipy==1.12.0
```

### 2.3 Docker Compose with Monitoring Stack

```yaml
# docker-compose.yaml
version: "3.8"

services:
  model-server:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./models:/models:ro
    environment:
      - MODEL_PATH=/models/model.onnx
      - CONFIG_PATH=/models/config.json
      - MODEL_VERSION=v1.0
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  prometheus:
    image: prom/prometheus:v2.49.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yaml:/etc/prometheus/prometheus.yml:ro
    depends_on:
      - model-server

  grafana:
    image: grafana/grafana:10.3.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on:
      - prometheus
```

### 2.4 Prometheus Configuration

```yaml
# prometheus.yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "model-server"
    static_configs:
      - targets: ["model-server:8000"]
    metrics_path: "/metrics"
    scrape_interval: 5s
```

---

## 3. Running the Deployment

### 3.1 Creating a Test Model

For this recitation, we create a simple ONNX model:

```python
# scripts/create_test_model.py
"""Create a simple ONNX model for testing the deployment pipeline."""
import torch
import torch.nn as nn
import json
import numpy as np

class SimpleClassifier(nn.Module):
    def __init__(self, n_features: int = 10):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_features, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x)

def main():
    n_features = 10
    model = SimpleClassifier(n_features)
    model.eval()

    # Export to ONNX
    dummy_input = torch.randn(1, n_features)
    torch.onnx.export(
        model, dummy_input, "models/model.onnx",
        input_names=["features"],
        output_names=["prediction"],
        dynamic_axes={"features": {0: "batch_size"}},
    )

    # Create config with feature statistics
    np.random.seed(42)
    feature_names = [f"feature_{i}" for i in range(n_features)]
    config = {
        "feature_names": feature_names,
        "feature_means": np.random.randn(n_features).tolist(),
        "feature_stds": np.abs(np.random.randn(n_features)).tolist(),
        "model_type": "binary_classifier",
        "threshold": 0.5,
    }

    with open("models/config.json", "w") as f:
        json.dump(config, f, indent=2)

    print("Model and config created in models/")

if __name__ == "__main__":
    main()
```

### 3.2 Launch Commands

```bash
# 1. Create the test model
mkdir -p models
python scripts/create_test_model.py

# 2. Build and start all services
docker compose up --build -d

# 3. Verify the model server is healthy
curl http://localhost:8000/health
# Expected: {"status":"healthy","model_loaded":true}

# 4. Send a test prediction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "feature_0": 0.5,
      "feature_1": -1.2,
      "feature_2": 0.8,
      "feature_3": 0.0,
      "feature_4": 1.5,
      "feature_5": -0.3,
      "feature_6": 0.7,
      "feature_7": -0.9,
      "feature_8": 0.2,
      "feature_9": 1.1
    },
    "request_id": "test-001"
  }'

# 5. Check Prometheus metrics
curl http://localhost:8000/metrics

# 6. Access Grafana at http://localhost:3000
#    Default login: admin / admin
#    Add Prometheus data source: http://prometheus:9090
```

### 3.3 Load Testing

```python
# scripts/load_test.py
"""Send synthetic traffic to the model server for monitoring testing."""
import requests
import numpy as np
import time
import threading
from concurrent.futures import ThreadPoolExecutor

SERVER_URL = "http://localhost:8000/predict"
N_FEATURES = 10

def send_request(request_id: int, drift: bool = False):
    """Send a single prediction request."""
    if drift:
        # Simulate drifted features (shifted mean)
        features = {
            f"feature_{i}": float(np.random.randn() + 3.0)  # Shifted
            for i in range(N_FEATURES)
        }
    else:
        features = {
            f"feature_{i}": float(np.random.randn())
            for i in range(N_FEATURES)
        }

    try:
        response = requests.post(
            SERVER_URL,
            json={"features": features, "request_id": str(request_id)},
            timeout=5,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}


def run_load_test(qps: float = 10, duration_seconds: int = 300,
                  drift_after_seconds: int = 150):
    """Run a load test with optional drift injection."""
    interval = 1.0 / qps
    request_id = 0
    start_time = time.time()

    print(f"Starting load test: {qps} QPS for {duration_seconds}s")
    print(f"Drift injection after {drift_after_seconds}s")

    with ThreadPoolExecutor(max_workers=20) as executor:
        while time.time() - start_time < duration_seconds:
            elapsed = time.time() - start_time
            drift = elapsed > drift_after_seconds

            if drift and request_id % 100 == 0:
                print(f"[{elapsed:.0f}s] Drift active. "
                      f"Sent {request_id} requests.")

            executor.submit(send_request, request_id, drift)
            request_id += 1
            time.sleep(interval)

    print(f"Load test complete. Sent {request_id} requests.")


if __name__ == "__main__":
    run_load_test(qps=10, duration_seconds=300, drift_after_seconds=150)
```

---

## 4. Drift Detection Sidecar

### 4.1 Implementation

```python
# model_server/drift.py
"""Drift detection module that monitors feature distributions."""
import numpy as np
from scipy import stats
from collections import deque
import threading
import time
import logging

logger = logging.getLogger(__name__)

class DriftDetector:
    """Monitors feature distributions and detects drift using PSI and KS tests."""

    def __init__(self, reference_data: dict, window_size: int = 1000,
                 check_interval_seconds: int = 60,
                 psi_threshold: float = 0.2, ks_alpha: float = 0.01):
        """
        Args:
            reference_data: Dict of feature_name -> np.ndarray of reference values.
            window_size: Number of recent observations to keep per feature.
            check_interval_seconds: How often to run drift checks.
            psi_threshold: PSI threshold for alerting.
            ks_alpha: KS test significance level.
        """
        self.reference_data = reference_data
        self.window_size = window_size
        self.check_interval = check_interval_seconds
        self.psi_threshold = psi_threshold
        self.ks_alpha = ks_alpha

        # Sliding windows for each feature
        self.windows = {
            name: deque(maxlen=window_size)
            for name in reference_data
        }

        self.drift_results = {}
        self._lock = threading.Lock()

    def observe(self, features: dict):
        """Record an observation."""
        with self._lock:
            for name, value in features.items():
                if name in self.windows:
                    try:
                        self.windows[name].append(float(value))
                    except (TypeError, ValueError):
                        pass

    def check_drift(self) -> dict:
        """Run drift detection on all features. Returns drift report."""
        report = {}

        with self._lock:
            for name, window in self.windows.items():
                if len(window) < 100:
                    continue  # Not enough data

                current = np.array(window)
                reference = self.reference_data[name]

                # PSI
                psi = self._compute_psi(reference, current)

                # KS test
                ks_stat, ks_pvalue = stats.ks_2samp(reference, current)

                drifted = (
                    psi > self.psi_threshold or
                    ks_pvalue < self.ks_alpha
                )

                report[name] = {
                    "psi": float(psi),
                    "ks_statistic": float(ks_stat),
                    "ks_pvalue": float(ks_pvalue),
                    "drifted": drifted,
                    "n_samples": len(current),
                }

                if drifted:
                    logger.warning(
                        f"DRIFT DETECTED on feature '{name}': "
                        f"PSI={psi:.4f}, KS p-value={ks_pvalue:.4e}"
                    )

        self.drift_results = report
        return report

    def _compute_psi(self, reference: np.ndarray, current: np.ndarray,
                     n_bins: int = 10, eps: float = 1e-4) -> float:
        """Compute Population Stability Index."""
        bin_edges = np.quantile(reference, np.linspace(0, 1, n_bins + 1))
        bin_edges[0] = -np.inf
        bin_edges[-1] = np.inf

        ref_counts = np.histogram(reference, bins=bin_edges)[0]
        cur_counts = np.histogram(current, bins=bin_edges)[0]

        ref_fracs = ref_counts / ref_counts.sum() + eps
        cur_fracs = cur_counts / cur_counts.sum() + eps

        psi = np.sum(
            (cur_fracs - ref_fracs) * np.log(cur_fracs / ref_fracs)
        )
        return float(psi)

    def start_background_monitoring(self):
        """Start a background thread that periodically checks for drift."""
        def _monitor_loop():
            while True:
                time.sleep(self.check_interval)
                try:
                    report = self.check_drift()
                    drifted_features = [
                        name for name, info in report.items()
                        if info["drifted"]
                    ]
                    if drifted_features:
                        logger.warning(
                            f"Drift detected in {len(drifted_features)} "
                            f"features: {drifted_features}"
                        )
                except Exception as e:
                    logger.error(f"Drift check failed: {e}")

        thread = threading.Thread(target=_monitor_loop, daemon=True)
        thread.start()
        logger.info(
            f"Drift monitoring started "
            f"(interval={self.check_interval}s, "
            f"window={self.window_size})"
        )
```

---

## 5. Testing

### 5.1 Server Tests

```python
# tests/test_server.py
"""Tests for the model server."""
from fastapi.testclient import TestClient
import pytest
import os

# Set model paths for testing
os.environ["MODEL_PATH"] = "models/model.onnx"
os.environ["CONFIG_PATH"] = "models/config.json"

from model_server.server import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_ready_endpoint():
    response = client.get("/ready")
    assert response.status_code == 200


def test_predict_valid_input():
    response = client.post("/predict", json={
        "features": {f"feature_{i}": 0.5 for i in range(10)},
        "request_id": "test-1",
    })
    assert response.status_code == 200
    data = response.json()
    assert "score" in data
    assert 0.0 <= data["score"] <= 1.0
    assert data["label"] in [0, 1]
    assert data["request_id"] == "test-1"


def test_predict_missing_feature():
    """Missing features should be handled gracefully (filled with mean)."""
    response = client.post("/predict", json={
        "features": {"feature_0": 0.5},  # Only one feature
        "request_id": "test-2",
    })
    assert response.status_code == 200


def test_metrics_endpoint():
    """Metrics endpoint should return Prometheus format."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "model_server_requests_total" in response.text


def test_prediction_consistency():
    """Same input should produce same output (deterministic model)."""
    features = {f"feature_{i}": float(i) * 0.1 for i in range(10)}
    results = []
    for _ in range(5):
        response = client.post("/predict", json={
            "features": features,
        })
        results.append(response.json()["score"])
    assert all(r == results[0] for r in results), \
        f"Non-deterministic predictions: {results}"
```

### 5.2 Drift Detection Tests

```python
# tests/test_drift.py
"""Tests for drift detection."""
import numpy as np
import pytest
from model_server.drift import DriftDetector


@pytest.fixture
def detector():
    np.random.seed(42)
    reference = {
        "feature_0": np.random.randn(1000),
        "feature_1": np.random.randn(1000),
    }
    return DriftDetector(
        reference_data=reference,
        window_size=500,
        psi_threshold=0.2,
        ks_alpha=0.01,
    )


def test_no_drift(detector):
    """Same distribution should not trigger drift."""
    np.random.seed(123)
    for _ in range(500):
        detector.observe({
            "feature_0": float(np.random.randn()),
            "feature_1": float(np.random.randn()),
        })

    report = detector.check_drift()
    for name, info in report.items():
        assert not info["drifted"], \
            f"False positive on {name}: PSI={info['psi']:.4f}"


def test_drift_detected(detector):
    """Shifted distribution should trigger drift."""
    for _ in range(500):
        detector.observe({
            "feature_0": float(np.random.randn() + 5.0),  # Large shift
            "feature_1": float(np.random.randn()),          # No shift
        })

    report = detector.check_drift()
    assert report["feature_0"]["drifted"], \
        "Failed to detect drift on shifted feature"
    assert not report["feature_1"]["drifted"], \
        "False positive on unshifted feature"
```

---

## 6. Exercises

### Exercise 9R.1: Extend the Model Server

Add the following to the model server:

**(a)** A `/predict/batch` endpoint that accepts a list of feature dicts and returns a list of predictions. Measure the throughput improvement over individual requests.

**(b)** Request ID tracking: log each request with its ID, features, prediction, and latency to a structured log (JSON lines format). This log will be used for offline analysis and debugging.

### Exercise 9R.2: Grafana Dashboard

Create a Grafana dashboard that displays:

1. Request rate (QPS) over time.
2. Latency percentiles (p50, p90, p99) over time.
3. Prediction score distribution histogram.
4. Feature drift PSI scores over time (one line per feature).
5. Error rate over time.

### Exercise 9R.3: Multi-Model Deployment

Extend the docker-compose setup to run two model versions simultaneously (v1 and v2). Add an Nginx reverse proxy that routes traffic:
- 90% to v1 (control)
- 10% to v2 (canary)

Log which version served each request and compute metrics per version.

### Exercise 9R.4: Alerting Rules

Add Prometheus alerting rules for:
1. Error rate > 1% for 5 minutes.
2. p99 latency > 500ms for 5 minutes.
3. Prediction score mean deviates from baseline by more than 20%.

Write the rules in Prometheus alerting rule format and test them by injecting failures.

---

## 7. Discussion Questions

1. What happens if the model file is corrupted or missing at startup? How should the server handle this gracefully in a Kubernetes environment?

2. The current drift detector uses a fixed reference window. What are the tradeoffs of using a sliding reference window that updates over time?

3. In a multi-replica deployment, each replica computes drift independently. How would you aggregate drift signals across replicas?

4. The Prometheus metrics are pulled (scraped) every 5 seconds. What information is lost compared to a push-based metrics system? When does this matter?
