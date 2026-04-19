# Lecture 09d: Cost Optimization: Spot Instances, Autoscaling, Multi-Tenancy

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Analyze** the cost structure of cloud GPU compute across pricing tiers (on-demand, reserved, spot), computing total cost of ownership for training and inference workloads under different provisioning strategies.
2. **Design** a spot instance training strategy with checkpointing and preemption handling that minimizes cost while bounding expected training time, modeling the problem as a stochastic optimization.
3. **Derive** autoscaling policies for inference workloads, comparing request-based, utilization-based, and predictive scaling approaches and analyzing their stability properties.
4. **Evaluate** GPU sharing mechanisms (MPS, MIG, time-slicing) for multi-tenant inference, computing isolation-throughput tradeoffs and identifying workloads where each is appropriate.
5. **Construct** a cost model for an end-to-end ML system (training + inference), performing break-even analysis for on-premise vs. cloud deployment.

---

## 2. Motivation and Context

### 2.1 The Cost Crisis in ML

The cost of training and serving large ML models has grown exponentially:

| Model | Year | Estimated Training Cost |
|-------|------|------------------------|
| BERT-Large | 2018 | ~$3,000 |
| GPT-3 (175B) | 2020 | ~$4,600,000 |
| PaLM (540B) | 2022 | ~$8,000,000 |
| GPT-4 | 2023 | ~$100,000,000 (estimated) |
| Llama 3.1 405B | 2024 | ~$30,000,000 (estimated) |

But training is a one-time (or infrequent) cost. Inference is an ongoing cost that often dominates total expenditure. At scale, a model serving 10 million queries per day on A100 GPUs can cost $100K--500K per month.

### 2.2 Why Systems Engineers Must Understand Cost

Cost optimization is not a business concern to be delegated -- it is a systems design constraint. The choice between A100 and H100, between 8-bit and 16-bit inference, between batch and online serving, between cloud and on-prem -- all of these are joint systems-cost decisions.

A 2x improvement in serving efficiency (tokens per second per dollar) is often more impactful than a 2% improvement in model quality. This lecture provides the analytical tools to make these tradeoffs rigorously.

---

## 3. Cloud GPU Pricing

### 3.1 Pricing Tiers

Cloud providers offer three main pricing tiers for GPU instances:

**On-demand.** Pay per second/hour with no commitment. Full availability guarantee.

**Reserved.** Commit to 1-year or 3-year terms for 30--60% discount. Guaranteed capacity.

**Spot/Preemptible.** Bid on unused capacity for 60--90% discount. Can be terminated with little notice (30s -- 2min).

Representative pricing (approximate, 2025):

| Instance | GPU | On-Demand ($/hr) | 1-yr Reserved ($/hr) | Spot ($/hr) | Spot Discount |
|----------|-----|-------------------|-----------------------|-------------|---------------|
| p4d.24xlarge | 8x A100 40GB | $32.77 | $20.27 | $9.83 | 70% |
| p5.48xlarge | 8x H100 80GB | $98.32 | $62.20 | $29.50 | 70% |
| g5.xlarge | 1x A10G 24GB | $1.19 | $0.74 | $0.36 | 70% |
| g6.xlarge | 1x L4 24GB | $0.80 | $0.50 | $0.24 | 70% |

### 3.2 Total Cost of Ownership (TCO) Model

For a training job requiring $T$ GPU-hours:

**On-demand cost:**

$$C_{\text{on-demand}} = T \times p_{\text{od}}$$

**Reserved cost** (amortized over usage fraction $\rho$):

$$C_{\text{reserved}} = \frac{p_{\text{res}} \times 8760}{\rho \times 8760} \times T = \frac{p_{\text{res}}}{\rho} \times T$$

where $\rho$ is the utilization rate (fraction of reserved time actually used).

**Spot cost** (accounting for preemption overhead):

$$C_{\text{spot}} = T \times \frac{p_{\text{spot}}}{1 - f_{\text{waste}}}$$

where $f_{\text{waste}}$ is the fraction of compute wasted due to preemptions (work done since last checkpoint that must be redone).

### 3.3 Break-Even Analysis

**Reserved vs. on-demand.** Reserved instances are cheaper when utilization exceeds a threshold:

$$\rho_{\text{break-even}} = \frac{p_{\text{res}}}{p_{\text{od}}}$$

For typical 40% discount: $\rho_{\text{break-even}} = 0.60/1.0 = 60\%$. If you use the GPU more than 60% of the time, reserved is cheaper.

**Spot vs. on-demand.** Spot is cheaper when the effective cost including waste is lower:

$$\frac{p_{\text{spot}}}{1 - f_{\text{waste}}} < p_{\text{od}}$$

$$f_{\text{waste}} < 1 - \frac{p_{\text{spot}}}{p_{\text{od}}}$$

For 70% spot discount ($p_{\text{spot}} / p_{\text{od}} = 0.3$): $f_{\text{waste}} < 0.7$. Spot remains cheaper as long as less than 70% of compute is wasted, which is achievable with good checkpointing.

---

## 4. Spot Instance Strategies

### 4.1 The Checkpointing Problem

Spot instances can be interrupted at any time. The fundamental question: how often should you checkpoint?

**Model.** Training proceeds in iterations. A checkpoint takes $T_c$ seconds and saves all state. A preemption wastes all work since the last checkpoint. Preemptions arrive as a Poisson process with rate $\lambda$ (interruptions per hour).

**Expected compute between preemptions:** $1/\lambda$ hours.

**Optimal checkpoint interval.** Let $\Delta$ be the checkpoint interval (hours). The expected time wasted per preemption is $\Delta/2$ (uniform distribution of preemption within the interval). The overhead of checkpointing is $T_c / \Delta$ per unit time (fraction of time spent checkpointing).

The effective throughput fraction (fraction of time doing useful work) is:

$$\eta(\Delta) = \frac{\Delta - T_c}{\Delta} \times \frac{1}{1 + \lambda \Delta / 2}$$

The first term accounts for checkpoint overhead; the second accounts for preemption waste.

Taking the derivative and setting to zero (ignoring $T_c$ for small checkpoints):

$$\Delta^* \approx \sqrt{\frac{2T_c}{\lambda}}$$

This is the classic "square root" rule: checkpoint more frequently when preemptions are more common or when checkpoints are cheaper.

**Numerical example.** Checkpoint time $T_c = 2$ minutes $= 1/30$ hour. Preemption rate $\lambda = 0.5$ per hour (expected 30 minutes between preemptions).

$$\Delta^* = \sqrt{\frac{2 \times (1/30)}{0.5}} = \sqrt{\frac{1}{7.5}} \approx 0.365 \text{ hours} \approx 22 \text{ minutes}$$

### 4.2 Fault-Tolerant Training Implementation

```python
import torch
import torch.distributed as dist
import os
import signal
import time
from pathlib import Path

class SpotInstanceTrainer:
    """Training loop with spot instance fault tolerance."""

    def __init__(self, model, optimizer, scheduler, checkpoint_dir: str,
                 checkpoint_interval_steps: int = 500):
        self.model = model
        self.optimizer = optimizer
        self.scheduler = scheduler
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_interval = checkpoint_interval_steps
        self.global_step = 0
        self.preempted = False

        # Register signal handlers for spot preemption
        # AWS sends SIGTERM with 2-minute warning
        # GCP sends SIGTERM with 30-second warning
        signal.signal(signal.SIGTERM, self._handle_preemption)

    def _handle_preemption(self, signum, frame):
        """Handle spot instance preemption signal."""
        print(f"[Step {self.global_step}] Preemption signal received. "
              f"Saving emergency checkpoint...")
        self._save_checkpoint(emergency=True)
        self.preempted = True

    def _save_checkpoint(self, emergency: bool = False):
        """Save training state to persistent storage."""
        checkpoint = {
            "global_step": self.global_step,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "rng_state": torch.random.get_rng_state(),
            "cuda_rng_state": torch.cuda.get_rng_state_all(),
        }

        tag = "emergency" if emergency else f"step_{self.global_step}"
        path = self.checkpoint_dir / f"checkpoint_{tag}.pt"

        # Save to local disk first (fast), then async copy to S3/GCS
        torch.save(checkpoint, path)

        # Atomic rename to prevent partial checkpoint reads
        final_path = self.checkpoint_dir / "checkpoint_latest.pt"
        path.rename(final_path)

        print(f"[Step {self.global_step}] Checkpoint saved to {final_path}")

    def _load_checkpoint(self) -> bool:
        """Load the latest checkpoint if it exists. Returns True if loaded."""
        path = self.checkpoint_dir / "checkpoint_latest.pt"
        if not path.exists():
            return False

        checkpoint = torch.load(path, map_location="cuda")
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        torch.random.set_rng_state(checkpoint["rng_state"])
        torch.cuda.set_rng_state_all(checkpoint["cuda_rng_state"])
        self.global_step = checkpoint["global_step"]

        print(f"Resumed from checkpoint at step {self.global_step}")
        return True

    def train(self, dataloader, total_steps: int):
        """Main training loop with checkpointing."""
        self._load_checkpoint()

        self.model.train()
        data_iter = iter(dataloader)

        while self.global_step < total_steps and not self.preempted:
            try:
                batch = next(data_iter)
            except StopIteration:
                data_iter = iter(dataloader)
                batch = next(data_iter)

            loss = self._train_step(batch)
            self.global_step += 1

            # Periodic checkpoint
            if self.global_step % self.checkpoint_interval == 0:
                self._save_checkpoint()

        if self.preempted:
            print("Training interrupted by preemption. "
                  "Restart to resume from checkpoint.")
            return False

        return True
```

### 4.3 Multi-Zone and Multi-Region Spot Strategies

Spot instance availability and pricing vary across availability zones and regions. Advanced strategies:

**Diversification.** Request spot capacity across multiple zones/regions simultaneously. If one zone runs out, training continues in another.

**Capacity-optimized allocation.** Cloud providers offer allocation strategies that launch instances in pools with the most available capacity, reducing preemption probability.

**Instance type diversification.** For training jobs that can use different GPU types (e.g., A100 or H100), bid on multiple instance types. The scheduler selects whichever is cheapest and available.

**Expected cost with diversification.** If we bid on $k$ independent spot pools, each with preemption rate $\lambda_i$, the rate of losing all instances simultaneously is:

$$\lambda_{\text{all}} = \prod_{i=1}^k \lambda_i$$

For $k = 3$ pools with $\lambda_i = 0.5$/hr: $\lambda_{\text{all}} = 0.125$/hr (8 hours expected uptime vs. 2 hours for a single pool).

---

## 5. Autoscaling Inference

### 5.1 The Autoscaling Problem

Inference traffic is variable: diurnal patterns, weekday/weekend cycles, and unpredictable spikes. Provisioning for peak wastes money at trough; provisioning for average risks SLA violations at peak.

**Objective.** Minimize cost while maintaining latency SLA:

$$\min_{r(t)} \int_0^T c \cdot r(t)\, dt \quad \text{subject to} \quad L(r(t), \lambda(t)) \leq L_{\text{SLA}} \quad \forall t$$

where $r(t)$ is the number of replicas at time $t$, $c$ is the cost per replica per unit time, $\lambda(t)$ is the request rate, and $L(\cdot)$ is the latency function.

### 5.2 Reactive Scaling Policies

**Request-rate scaling.** Scale based on requests per second:

$$r(t) = \left\lceil \frac{\lambda(t)}{\text{throughput\_per\_replica}} \right\rceil + r_{\text{buffer}}$$

**Utilization-based scaling.** Scale based on GPU or CPU utilization:

```python
class UtilizationAutoscaler:
    """Autoscaler based on GPU utilization metrics."""

    def __init__(self, min_replicas: int, max_replicas: int,
                 target_utilization: float = 0.70,
                 scale_up_threshold: float = 0.80,
                 scale_down_threshold: float = 0.50,
                 cooldown_seconds: int = 300):
        self.min_replicas = min_replicas
        self.max_replicas = max_replicas
        self.target_utilization = target_utilization
        self.scale_up_threshold = scale_up_threshold
        self.scale_down_threshold = scale_down_threshold
        self.cooldown_seconds = cooldown_seconds
        self.last_scale_time = 0

    def compute_desired_replicas(self, current_replicas: int,
                                  current_utilization: float) -> int:
        """Compute desired replica count based on current utilization."""
        now = time.time()
        if now - self.last_scale_time < self.cooldown_seconds:
            return current_replicas  # In cooldown period

        # Proportional scaling
        desired = int(
            current_replicas * current_utilization / self.target_utilization
        )

        # Apply thresholds to avoid oscillation
        if current_utilization > self.scale_up_threshold:
            desired = max(desired, current_replicas + 1)
        elif current_utilization < self.scale_down_threshold:
            desired = min(desired, current_replicas - 1)
        else:
            desired = current_replicas  # No change in stable zone

        # Clamp to bounds
        desired = max(self.min_replicas, min(self.max_replicas, desired))

        if desired != current_replicas:
            self.last_scale_time = now

        return desired
```

**Stability analysis.** Reactive autoscalers can oscillate if not carefully tuned. The cooldown period prevents rapid scaling up and down. The stable zone (between scale-up and scale-down thresholds) provides hysteresis.

The system can be modeled as a feedback control loop:

```
[Demand λ(t)] → [Queue] → [Replicas r(t)] → [Utilization u(t)] → [Autoscaler] → [r(t+1)]
```

Oscillation occurs when the autoscaler gain is too high relative to the system's response time (time for a new replica to become ready and start serving).

### 5.3 Predictive Scaling

Predictive autoscaling uses historical traffic patterns to pre-provision capacity before demand increases.

**Time-series forecasting approach:**

1. Decompose traffic into trend, seasonal, and residual components.
2. Forecast the seasonal component (diurnal, weekly patterns).
3. Add a safety margin for the residual (noise) component.
4. Pre-scale based on the forecast.

```python
import math


class PredictiveAutoscaler:
    """Autoscaler that uses traffic forecasting to pre-provision capacity."""

    def __init__(self, forecast_model, throughput_per_replica: float,
                 safety_margin: float = 1.3, lead_time_minutes: int = 10):
        self.forecast_model = forecast_model
        self.throughput_per_replica = throughput_per_replica
        self.safety_margin = safety_margin
        self.lead_time = lead_time_minutes

    def compute_desired_replicas(self, current_time: float) -> int:
        """Predict traffic and compute required replicas."""
        # Forecast traffic at current_time + lead_time
        forecast_time = current_time + self.lead_time * 60
        predicted_qps = self.forecast_model.predict(forecast_time)

        # Add safety margin for prediction uncertainty
        target_qps = predicted_qps * self.safety_margin

        # Compute replicas needed
        replicas = int(
            math.ceil(target_qps / self.throughput_per_replica)
        )

        return replicas
```

**Advantage:** Avoids latency spikes during scaling events (replicas are ready before demand arrives).

**Disadvantage:** Requires accurate forecasting. Unpredictable spikes (viral events, breaking news) still need reactive fallback.

### 5.4 Scaling Comparison

| Approach | Latency Impact | Cost Efficiency | Handles Spikes | Complexity |
|----------|---------------|-----------------|----------------|-----------|
| Fixed (peak) | None | Low | Yes | None |
| Reactive (utilization) | Scale-up delay | Medium | With delay | Low |
| Reactive (request-based) | Scale-up delay | Medium | With delay | Low |
| Predictive | Minimal | High | With reactive fallback | High |
| Predictive + reactive | Minimal | Highest | Yes | Highest |

---

## 6. Multi-Tenancy: Sharing GPUs

### 6.1 Why Share GPUs?

Many inference workloads do not fully utilize a GPU. A small model serving 10 QPS on an A100 might use only 5% of the GPU's compute capacity. The remaining 95% is wasted.

Multi-tenancy places multiple workloads on the same GPU to improve utilization.

### 6.2 NVIDIA Multi-Process Service (MPS)

MPS allows multiple CUDA processes to share a single GPU context, enabling concurrent kernel execution.

**How MPS works:**
- Without MPS, each process gets exclusive access to the GPU in a time-sliced fashion.
- With MPS, a single GPU context is shared, and kernels from different processes can execute concurrently on different SMs.

**Configuration:**

```bash
# Start MPS daemon (on the host)
export CUDA_VISIBLE_DEVICES=0
nvidia-cuda-mps-control -d

# Each client process connects to MPS automatically
# Optional: limit GPU resources per client
echo "set_default_active_thread_percentage 50" | \
    nvidia-cuda-mps-control
```

**Characteristics:**
- Soft isolation: processes can interfere with each other's performance.
- No memory partitioning: all processes share the full GPU memory (risk of OOM from a rogue process).
- Good for trusted, cooperative workloads.

### 6.3 Multi-Instance GPU (MIG)

MIG (available on A100/H100) partitions a single GPU into up to 7 isolated instances, each with dedicated compute and memory.

**MIG partition profiles for A100 80GB:**

| Profile | GPU Memory | Compute SMs | Typical Use |
|---------|-----------|-------------|-------------|
| 1g.10gb | 10 GB | 1/7 | Small model inference |
| 2g.20gb | 20 GB | 2/7 | Medium model inference |
| 3g.40gb | 40 GB | 3/7 | Large model inference |
| 4g.40gb | 40 GB | 4/7 | Training small models |
| 7g.80gb | 80 GB | 7/7 | Full GPU (no partitioning) |

**Configuration:**

```bash
# Enable MIG mode (requires GPU reset)
sudo nvidia-smi -i 0 -mig 1

# Create MIG instances
sudo nvidia-smi mig -i 0 -cgi 9,9,9,9,9,9,9 -C
# This creates 7x 1g.10gb instances

# Or create mixed partitions
sudo nvidia-smi mig -i 0 -cgi 19,19,14 -C
# This creates 2x 3g.40gb + 1x 1g.10gb (if supported)

# List instances
nvidia-smi mig -lgi
```

**Characteristics:**
- Hard isolation: each instance has dedicated SMs and memory. A rogue process in one instance cannot affect another.
- Guaranteed performance: each instance has predictable throughput.
- Coarse granularity: only a fixed set of partition profiles is available.
- No dynamic resizing: changing partitions requires destroying and recreating instances.

### 6.4 Time-Slicing

The simplest GPU sharing mechanism: Kubernetes schedules multiple pods on the same GPU, and the NVIDIA driver time-slices access.

**Characteristics:**
- No isolation: all pods share GPU memory and compute.
- High overhead: context switching between processes is expensive.
- Useful for development and testing, not production.

### 6.5 Comparison

| Property | MPS | MIG | Time-Slicing |
|----------|-----|-----|-------------|
| Compute isolation | Soft | Hard | None |
| Memory isolation | None | Hard | None |
| Max concurrent tenants | ~48 (CUDA streams) | 7 (A100) | Unlimited |
| Performance overhead | Low (~5%) | None | High (10--30%) |
| Granularity | Fine | Coarse | N/A |
| GPU support | All CUDA GPUs | A100, H100+ | All |
| Best for | Trusted multi-model serving | Multi-tenant cloud | Dev/test |

---

## 7. Cost Modeling

### 7.1 Training Cost Estimation

The cost to train a model can be estimated from FLOPs:

**FLOPs for transformer training** (Kaplan et al., 2020):

$$C \approx 6 \times N \times D$$

where $N$ is the number of parameters and $D$ is the number of training tokens.

**GPU-hours** from FLOPs:

$$T_{\text{GPU-hours}} = \frac{C}{\text{GPU\_FLOPS} \times \text{MFU} \times 3600}$$

where MFU (Model FLOP Utilization) is the fraction of peak FLOPs actually achieved (typically 30--50% for large training runs).

**Dollar cost:**

$$\text{Cost} = T_{\text{GPU-hours}} \times N_{\text{GPUs}} \times p_{\text{per-GPU-hour}} \times \frac{1}{N_{\text{GPUs}}}$$

Wait --- that simplifies. The total GPU-hours is the sequential time times the number of GPUs. Let us be precise:

$$\text{Total GPU-hours} = \frac{C}{\text{GPU\_FLOPS} \times \text{MFU} \times 3600}$$

$$\text{Wall-clock hours} = \frac{\text{Total GPU-hours}}{N_{\text{GPUs}}}$$

$$\text{Cost} = \text{Total GPU-hours} \times p_{\text{per-GPU-hour}}$$

**Example: Training a 7B parameter model on 2T tokens.**

$$C = 6 \times 7 \times 10^9 \times 2 \times 10^{12} = 8.4 \times 10^{22} \text{ FLOPs}$$

On H100 GPUs (1,979 TFLOPS BF16, MFU = 0.40):

$$\text{Total GPU-hours} = \frac{8.4 \times 10^{22}}{1{,}979 \times 10^{12} \times 0.40 \times 3600} = 29{,}500 \text{ GPU-hours}$$

With 256 H100 GPUs:

$$\text{Wall-clock time} = \frac{29{,}500}{256} = 115 \text{ hours} \approx 4.8 \text{ days}$$

Cost at spot H100 price ($3.69/GPU-hour for p5 equivalent):

$$\text{Cost} = 29{,}500 \times 3.69 \approx \$109{,}000$$

Cost at on-demand ($12.29/GPU-hour):

$$\text{Cost} = 29{,}500 \times 12.29 \approx \$363{,}000$$

### 7.2 Inference Cost Per Query

For online inference, cost per query depends on model size, batch size, and hardware:

$$\text{Cost per query} = \frac{p_{\text{per-GPU-hour}}}{\text{throughput (queries/hour)}}$$

**Throughput estimation for LLM inference:**

For autoregressive generation with $N$ parameters in FP16:

$$\text{Tokens/sec (memory-bound)} \approx \frac{\text{Memory Bandwidth (GB/s)}}{2N \times 10^{-9}} \times B$$

where $B$ is the batch size (assuming the model fits in memory).

For an H100 (3.35 TB/s bandwidth) serving a 7B model:

$$\text{Tokens/sec (per query, B=1)} \approx \frac{3350}{14} \approx 239 \text{ tokens/sec}$$

$$\text{Tokens/sec (B=32)} \approx 239 \times 32 \approx 7{,}650 \text{ tokens/sec total}$$

If each query generates 200 tokens:

$$\text{Queries/hour (B=32)} = \frac{7{,}650}{200} \times 3600 = 137{,}700 \text{ queries/hour}$$

$$\text{Cost per query} = \frac{\$12.29}{137{,}700} \approx \$0.000089 \approx \$0.089 \text{ per 1K queries}$$

### 7.3 On-Prem vs. Cloud Break-Even

**On-prem cost model:**

$$C_{\text{prem}} = C_{\text{hardware}} + C_{\text{datacenter}} \times T + C_{\text{ops}} \times T + C_{\text{power}} \times T$$

where $T$ is the time horizon (years).

**Cloud cost model:**

$$C_{\text{cloud}} = p_{\text{reserved}} \times \text{hours} \times T$$

**Break-even analysis.** An H100 GPU costs approximately $30,000. With a 3-year amortization, data center costs (power, cooling, networking, rack space), and operations staff:

| Cost Component | On-Prem (3-year) | Cloud Reserved (3-year) |
|---------------|-------------------|------------------------|
| Hardware (1x H100) | $30,000 | $0 |
| Power + cooling (3 yr) | $15,000 | Included |
| Networking + rack | $5,000 | Included |
| Ops staff (fractional) | $10,000 | $0 |
| Cloud compute | $0 | $164,000 (at $6.25/hr) |
| **Total** | **$60,000** | **$164,000** |

This suggests on-prem is 2.7x cheaper -- but only at high utilization. If the GPU sits idle 60% of the time:

$$C_{\text{prem,effective}} = \frac{\$60{,}000}{0.40} = \$150{,}000$$

At this point, cloud with reserved instances is competitive, and cloud with spot instances may be cheaper. The break-even utilization is:

$$\rho_{\text{break-even}} = \frac{C_{\text{prem}}}{C_{\text{cloud}}} = \frac{60{,}000}{164{,}000} \approx 37\%$$

### 7.4 Cost Optimization Decision Framework

```python
def recommend_compute_strategy(
    workload_type: str,          # "training" or "inference"
    gpu_hours_per_month: float,
    latency_sla_ms: float,       # None for training
    fault_tolerance: bool,       # Can the workload handle interruptions?
    time_horizon_years: float,
    utilization_rate: float,     # Expected utilization of reserved/on-prem
) -> str:
    """Recommend a compute provisioning strategy."""

    if workload_type == "training":
        if fault_tolerance and gpu_hours_per_month > 1000:
            return "spot_instances"
        elif gpu_hours_per_month > 5000 and time_horizon_years >= 1:
            return "reserved_instances"
        else:
            return "on_demand"

    elif workload_type == "inference":
        yearly_gpu_hours = gpu_hours_per_month * 12

        # On-prem break-even: ~$2.30/GPU-hr amortized
        on_prem_cost_per_hr = 60000 / (3 * 8760 * utilization_rate)

        # Reserved break-even
        reserved_cost_per_hr = 6.25  # Example H100 reserved

        if (yearly_gpu_hours > 8760 * 0.5 and  # >50% utilization
            time_horizon_years >= 3 and
            on_prem_cost_per_hr < reserved_cost_per_hr):
            return "on_premises"
        elif yearly_gpu_hours > 8760 * 0.3:     # >30% utilization
            return "reserved_instances"
        else:
            return "on_demand_with_autoscaling"
```

---

## 8. Putting It All Together

### 8.1 Cost-Optimized ML System Architecture

A well-optimized ML system uses different compute tiers for different workloads:

| Workload | Compute Tier | Rationale |
|----------|-------------|-----------|
| Exploratory training | Spot instances | Fault-tolerant, cost-sensitive |
| Production retraining | Reserved (with spot fallback) | Predictable schedule, needs reliability |
| Real-time inference (base load) | Reserved or on-prem | Continuous, high utilization |
| Real-time inference (burst) | On-demand autoscale | Unpredictable, short-lived |
| Batch inference | Spot instances | Fault-tolerant, schedulable |
| Development / CI | Spot instances | Ephemeral, cost-sensitive |

### 8.2 Cost Monitoring

Cost monitoring should be as rigorous as performance monitoring:

```python
class CostMonitor:
    """Track and alert on ML infrastructure costs."""

    def __init__(self, budget_per_day: float, alert_threshold: float = 0.9):
        self.budget_per_day = budget_per_day
        self.alert_threshold = alert_threshold

    def compute_daily_cost(self, usage: dict) -> dict:
        """Compute daily cost breakdown."""
        costs = {}

        # Training costs
        costs["training_spot"] = (
            usage["training_spot_gpu_hours"] * usage["spot_price_per_hour"]
        )
        costs["training_ondemand"] = (
            usage["training_od_gpu_hours"] * usage["od_price_per_hour"]
        )

        # Inference costs
        costs["inference_reserved"] = (
            usage["inference_reserved_gpus"] * 24 *
            usage["reserved_price_per_hour"]
        )
        costs["inference_burst"] = (
            usage["inference_burst_gpu_hours"] * usage["od_price_per_hour"]
        )

        # Storage costs
        costs["storage"] = usage["storage_gb"] * 0.023 / 30  # S3 pricing

        costs["total"] = sum(costs.values())

        # Cost efficiency metrics
        costs["cost_per_1k_predictions"] = (
            (costs["inference_reserved"] + costs["inference_burst"]) /
            max(usage["total_predictions"] / 1000, 1)
        )

        return costs
```

---

## Key Takeaways

1. **Spot instances offer 60--90% savings but require engineering.** Checkpointing, preemption handling, and multi-zone diversification make spot instances practical for training. The optimal checkpoint interval follows a square-root rule.
2. **Autoscaling is a control theory problem.** Reactive scaling is simple but introduces latency spikes. Predictive scaling requires accurate forecasting. The best systems combine both with hysteresis to prevent oscillation.
3. **GPU sharing is essential for cost efficiency.** MIG provides hard isolation for multi-tenant inference. MPS enables fine-grained sharing for trusted workloads. Time-slicing is only appropriate for development.
4. **Cost per query is the key inference metric.** It captures hardware cost, model efficiency, and utilization in a single number. Optimizing it requires joint consideration of model size, quantization, batching, and hardware choice.
5. **On-prem vs. cloud depends on utilization.** At high utilization (>50%), on-prem is significantly cheaper. At low or variable utilization, cloud flexibility wins. Most organizations use a hybrid approach.

---

## Further Reading

1. **Kaplan, J., McCandlish, S., Henighan, T., et al.** (2020). "Scaling Laws for Neural Language Models." *arXiv:2001.08361.*
   - Provides the compute estimation formulas used for training cost modeling.

2. **Patterson, D., Gonzalez, J., Le, Q., et al.** (2021). "Carbon Emissions and Large Neural Network Training." *arXiv:2104.10350.*
   - Analysis of the energy and carbon cost of training large models.

3. **NVIDIA.** (2024). "Multi-Instance GPU User Guide."
   - Official documentation for MIG configuration and management.

4. **Harlap, A., Narayanan, D., Phanishayee, A., et al.** (2018). "PipeDream: Generalized Pipeline Parallelism for DNN Training." *SOSP 2018.*
   - Includes analysis of checkpointing overhead in distributed training.

5. **Amazon Web Services.** (2024). "EC2 Spot Instance Advisor."
   - Real-time spot instance interruption frequencies and savings estimates.

6. **Graefe, G.** (2023). "The Economics of GPU Computing for Machine Learning." *PVLDB.*
   - Formal cost modeling framework for ML workloads.
