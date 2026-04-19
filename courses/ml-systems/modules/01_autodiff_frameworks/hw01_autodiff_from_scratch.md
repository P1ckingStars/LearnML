# Homework 01: Automatic Differentiation from Scratch

**Estimated time:** 25 hours
**Due date:** Two weeks from assignment
**Submission:** C++ source code with CMake build + pybind11 bindings + PDF of analytical derivations (Part A) + Python test notebook

---

## Overview

This homework has two parts of equal weight. Part A tests your mathematical understanding of automatic differentiation theory, computational graphs, and Jacobian structure. Part B requires you to implement a working autodiff engine **in C++** with pybind11 Python bindings — mirroring the architecture of real frameworks like PyTorch (C++ ATen core + Python frontend).

You will build a tape-based reverse-mode autodiff engine in C++17, manage memory with `shared_ptr`, implement operator overloading for a natural tensor API, and expose it to Python via pybind11 for gradient checking and MNIST training.

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. Cite any references you consult. You may NOT use any automatic differentiation library (PyTorch, JAX, TensorFlow, Autograd). You MAY use standard C++ libraries and pybind11. For numerical operations in C++, you implement your own (no Eigen, no BLAS calls).

---

## Part A: Mathematical and Analytical Problems (50%)

### Problem A1: Forward and Reverse Mode on a Computational Graph (15 points)

Consider the function $f: \mathbb{R}^3 \to \mathbb{R}$ defined by:

$$f(x_1, x_2, x_3) = \frac{x_1 x_2 + \sin(x_3)}{x_2 + \exp(x_1 x_3)}$$

**(a)** [3 points] Write the Wengert list (evaluation trace) for $f$, decomposing it into elementary operations. Your trace should have at most one binary or unary operation per line. Label each intermediate variable $v_i$.

**(b)** [4 points] Evaluate the Wengert list at the point $(x_1, x_2, x_3) = (1, 2, 0)$. Record the numerical value of every intermediate variable.

**(c)** [4 points] Perform a complete reverse-mode (backpropagation) pass on this evaluation trace. Show the adjoint $\bar{v}_i$ for every node, working from the output back to the inputs. Report the gradient $\nabla f = (\bar{x}_1, \bar{x}_2, \bar{x}_3)$.

**(d)** [4 points] Perform a complete forward-mode pass with tangent vector $\dot{x} = (1, 0, 0)$ to compute $\partial f / \partial x_1$. Show $\dot{v}_i$ for every node. Verify that your answer matches part (c).

---

### Problem A2: Jacobian Structure and Complexity (15 points)

**(a)** [5 points] Consider a function $f: \mathbb{R}^n \to \mathbb{R}^m$. The full Jacobian $J_f \in \mathbb{R}^{m \times n}$ can be computed column-by-column using forward-mode AD or row-by-row using reverse-mode AD.

Prove that forward-mode requires $n$ passes (each costing $O(W)$ where $W$ is the cost of evaluating $f$) and reverse-mode requires $m$ passes (each costing $O(W)$). Conclude that forward mode is preferred when $n < m$ and reverse mode when $m < n$.

**(b)** [5 points] Now consider the composition $h = g \circ f$ where $f: \mathbb{R}^n \to \mathbb{R}^k$ and $g: \mathbb{R}^k \to \mathbb{R}^m$. The Jacobian of $h$ is $J_h = J_g J_f$ where $J_g \in \mathbb{R}^{m \times k}$ and $J_f \in \mathbb{R}^{k \times n}$.

Computing $J_h$ directly as a matrix product has cost $O(mkn)$. Show that if we want only $J_h v$ for a given vector $v$ (i.e., a JVP), the cost is $O(mk + kn)$, and if we want only $u^\top J_h$ (a VJP), the cost is also $O(mk + kn)$. Explain why this is significant for deep networks with $L$ layers.

**(c)** [5 points] Consider a neural network loss function $\mathcal{L}(\theta)$ where $\theta \in \mathbb{R}^n$ with $n = 10^9$ (1 billion parameters). The network has $L = 100$ layers, each with a Jacobian of dimension approximately $d \times d$ where $d \approx 10^4$.

(i) What is the cost of computing $\nabla_\theta \mathcal{L}$ using reverse-mode AD, in terms of the cost $W$ of one forward pass?

(ii) What would the cost be using forward-mode AD?

(iii) What would the cost be using numerical finite differences (central differences)?

Express all answers in terms of $W$ and $n$, and give approximate wall-clock times assuming $W = 1$ second.

---

### Problem A3: Dual Numbers and Higher-Order AD (10 points)

**(a)** [3 points] The dual number algebra $\mathbb{D} = \{a + b\epsilon \mid a, b \in \mathbb{R}, \epsilon^2 = 0\}$ can be extended to **hyper-dual numbers** $\mathbb{HD} = \{a + b\epsilon_1 + c\epsilon_2 + d\epsilon_1\epsilon_2\}$ where $\epsilon_1^2 = \epsilon_2^2 = 0$ but $\epsilon_1 \epsilon_2 \neq 0$.

Derive the multiplication rule for hyper-dual numbers. Then show that evaluating $f(a + \epsilon_1 + \epsilon_2)$ yields:
- Real part: $f(a)$
- $\epsilon_1$ part: $f'(a)$
- $\epsilon_2$ part: $f'(a)$
- $\epsilon_1\epsilon_2$ part: $f''(a)$

**(b)** [3 points] Explain how hyper-dual numbers can be used to compute the Hessian-vector product $H_f(x) \cdot v$ in a single forward pass. Compare this approach with the Pearlmutter (1994) method of computing $Hv$ via reverse-over-forward AD. What are the relative advantages?

**(c)** [4 points] Prove the following identity used for Hessian-vector products:

$$\nabla_x \left[ (\nabla_x f(x))^\top v \right] = H_f(x) \cdot v$$

where $H_f(x) = \nabla^2_x f(x)$ is the Hessian. Start from the definition of the Hessian and use the linearity of differentiation. Explicitly address why we need `create_graph=True` in PyTorch to make this work.

---

### Problem A4: Checkpointing Analysis (10 points)

**(a)** [4 points] Consider a sequential computation with $L$ layers: $h_0 \to h_1 \to \cdots \to h_L \to \mathcal{L}$. Standard reverse-mode AD stores all $L$ intermediate activations $h_0, \ldots, h_{L-1}$ during the forward pass, requiring $O(L)$ memory.

The **$\sqrt{L}$ checkpointing** strategy (Chen et al., 2016) divides the $L$ layers into $\sqrt{L}$ segments of $\sqrt{L}$ layers each. Only the activations at segment boundaries are stored during the forward pass. During the backward pass, each segment is recomputed from its boundary checkpoint.

Prove that this strategy requires $O(\sqrt{L})$ memory and increases computation by at most a factor of 2 (one extra forward pass per segment).

**(b)** [3 points] Generalize: if we are willing to use $k$ levels of recursive checkpointing, what is the memory requirement as a function of $L$ and $k$? What is the computational overhead? Show that with $k = \log_2(L)$ levels, the memory is $O(\log L)$ but the overhead is $O(L)$ (unacceptable).

**(c)** [3 points] In practice, checkpointing is often applied to the **layer level** (e.g., each Transformer block is checkpointed). For a Transformer with 32 layers, batch size 64, sequence length 2048, hidden dimension 4096, and float16 activations:

(i) Estimate the activation memory per layer (in bytes) during the forward pass. Account for the main intermediate tensors: attention scores, attention output, FFN hidden states.

(ii) Estimate the total activation memory with and without checkpointing.

(iii) Is the 2x compute overhead worth the memory savings? Justify with a specific scenario.

---

## Part B: Implementation (50%)

Build a working automatic differentiation engine **in C++17** with pybind11 Python bindings. This mirrors the real architecture of deep learning frameworks: a C++ core for performance-critical tensor operations and gradient computation, with a Python interface for user ergonomics.

Your project must build with CMake and produce a Python-importable module (e.g., `import minigrad`).

### B1: C++ Tensor and Storage (10 points)

Implement the core tensor infrastructure in C++:

```cpp
// include/storage.h
class Storage {
public:
    Storage(size_t size, DType dtype = DType::Float64);

    float64_t* data();
    const float64_t* data() const;
    size_t size() const;

private:
    std::vector<double> data_;
};

// include/tensor.h
class Tensor : public std::enable_shared_from_this<Tensor> {
public:
    // Factory methods
    static TensorPtr zeros(std::vector<int64_t> shape);
    static TensorPtr ones(std::vector<int64_t> shape);
    static TensorPtr randn(std::vector<int64_t> shape);  // Box-Muller
    static TensorPtr from_data(const double* data, std::vector<int64_t> shape);

    // Data access
    double* data();
    const std::vector<int64_t>& shape() const;
    const std::vector<int64_t>& strides() const;
    size_t numel() const;
    int64_t ndim() const;

    // Gradient tracking
    bool requires_grad() const;
    void set_requires_grad(bool flag);
    TensorPtr grad() const;

    // View operations (zero-copy — manipulate strides only)
    TensorPtr reshape(std::vector<int64_t> new_shape);
    TensorPtr transpose(int64_t dim0, int64_t dim1);

private:
    std::shared_ptr<Storage> storage_;
    size_t offset_;
    std::vector<int64_t> shape_;
    std::vector<int64_t> strides_;
    bool requires_grad_;
    TensorPtr grad_;

    // Autograd metadata
    std::shared_ptr<GradFunction> grad_fn_;
    friend class Autograd;
};
```

1. [3 points] **Storage with shared ownership**: Multiple tensors can share the same underlying `Storage` (views). Use `std::shared_ptr<Storage>` and implement offset-based indexing.

2. [4 points] **Strided layout**: Implement strided access so that `reshape` and `transpose` are zero-copy (modify `strides_` and `shape_` only, no data movement). Implement `is_contiguous()`.

3. [3 points] **Memory**: No memory leaks. Use RAII throughout. Run under `valgrind` or AddressSanitizer and report clean output.

### B2: Operations and Autograd Graph (15 points)

Implement operations as free functions that record themselves on the autograd tape:

```cpp
// include/ops.h

// Each op returns a new Tensor and (if inputs require grad)
// attaches a GradFunction node to the output.

TensorPtr add(TensorPtr a, TensorPtr b);       // elementwise, with broadcasting
TensorPtr mul(TensorPtr a, TensorPtr b);       // elementwise, with broadcasting
TensorPtr sub(TensorPtr a, TensorPtr b);
TensorPtr neg(TensorPtr a);
TensorPtr div(TensorPtr a, TensorPtr b);
TensorPtr matmul(TensorPtr a, TensorPtr b);    // 2D matrix multiply
TensorPtr relu(TensorPtr a);
TensorPtr sigmoid(TensorPtr a);
TensorPtr exp_op(TensorPtr a);
TensorPtr log_op(TensorPtr a);
TensorPtr sum(TensorPtr a, int64_t axis = -1, bool keepdims = false);

// include/autograd.h

// Base class for gradient functions
class GradFunction {
public:
    virtual ~GradFunction() = default;
    virtual std::vector<TensorPtr> apply(const TensorPtr& grad_output) = 0;
    std::vector<std::pair<TensorPtr, std::shared_ptr<GradFunction>>> inputs;
};

// Backward engine
void backward(TensorPtr root, TensorPtr grad_output = nullptr);
```

4. [5 points] **Operator implementations**: Each forward op computes the correct result and constructs a `GradFunction` subclass that captures the information needed for the backward pass. For example:

```cpp
class MulBackward : public GradFunction {
public:
    MulBackward(TensorPtr a, TensorPtr b) : saved_a(a), saved_b(b) {}
    std::vector<TensorPtr> apply(const TensorPtr& grad_output) override {
        // grad_a = grad_output * b, grad_b = grad_output * a
        // Handle broadcasting: reduce_grad to match original shapes
        ...
    }
private:
    TensorPtr saved_a, saved_b;
};
```

5. [5 points] **Broadcasting**: Implement `broadcast_shapes()` for the forward pass and `reduce_grad(grad, target_shape)` for the backward pass. Broadcasting must handle arbitrary rank differences and unit dimensions.

6. [5 points] **Backward engine**: Implement `backward()` using reverse topological order (Kahn's algorithm or DFS). Handle fan-out correctly (gradient accumulation when a tensor is used multiple times).

### B3: pybind11 Bindings (5 points)

Expose your C++ engine to Python:

```cpp
// bindings/pybind_module.cpp
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/numpy.h>
#include "tensor.h"
#include "ops.h"
#include "autograd.h"

namespace py = pybind11;

PYBIND11_MODULE(minigrad, m) {
    py::class_<Tensor, TensorPtr>(m, "Tensor")
        .def_static("from_numpy", [](py::array_t<double> arr) {
            // Convert NumPy array to Tensor
            ...
        })
        .def("numpy", [](const Tensor& t) {
            // Convert Tensor back to NumPy array
            ...
        })
        .def("backward", &backward)
        .def_property_readonly("shape", &Tensor::shape)
        .def_property_readonly("grad", &Tensor::grad)
        .def("requires_grad_", &Tensor::set_requires_grad)
        // ... expose all ops
        ;

    m.def("add", &add);
    m.def("matmul", &matmul);
    m.def("relu", &relu);
    // ... etc
}
```

7. [3 points] **NumPy interop**: Convert between `py::array_t<double>` and your `Tensor` (zero-copy where possible, copy when layouts differ).

8. [2 points] **Build system**: Provide a `CMakeLists.txt` that builds the shared library. `pip install .` or `cmake --build` should produce a working `minigrad` Python module.

### B4: Gradient Checking and Neural Network (10 points)

This part is in Python, using your pybind11 bindings.

9. [4 points] **Gradient checking** (Python): Implement `gradient_check(f, inputs, eps=1e-5)` using central differences. Test ALL operations from B2. Each test must cover:
   - A small random input (e.g., shape `(3, 4)`).
   - An input that exercises broadcasting (e.g., shapes `(3, 1)` and `(1, 4)`).
   - Fan-out (a tensor used twice in the graph).
   All relative errors must be < $10^{-4}$.

10. [6 points] **MNIST training** (Python): Using ONLY your `minigrad` module:
    - Implement `Linear`, `Sequential`, `SGD`, and `cross_entropy_loss` as thin Python wrappers around your C++ ops.
    - Train a 3-layer MLP (784 -> 128 -> 64 -> 10) on MNIST.
    - Report: training loss curve, final test accuracy (> 95%), comparison with PyTorch (loss curves should match).

### B5: Performance Analysis (10 points)

11. [5 points] **C++ instrumentation**: Add counters to your engine (compile-time flag `MINIGRAD_PROFILE`):
    - Number of `Storage` allocations per forward+backward.
    - Peak live `Storage` bytes.
    - Time in forward vs. backward (use `std::chrono`).
    Report these for the MNIST training.

12. [5 points] **Comparison with PyTorch CPU**: Benchmark your engine against PyTorch (CPU, no `torch.compile`) on the same MLP:
    - Wall-clock time per training iteration.
    - Peak memory.
    - Analyze the gap. Your engine should be within 5--20x of PyTorch CPU (since PyTorch uses MKL/OpenBLAS for matmul; you are using naive loops). Identify the top bottleneck in your implementation and discuss what PyTorch does differently at the C++ level.

---

## Submission Checklist

- [ ] Part A: PDF with complete derivations for A1-A4
- [ ] Part B: C++ project with:
  - [ ] `CMakeLists.txt` that builds `minigrad` Python module
  - [ ] `include/`: `tensor.h`, `storage.h`, `ops.h`, `autograd.h`
  - [ ] `src/`: `tensor.cpp`, `ops.cpp`, `autograd.cpp`
  - [ ] `bindings/pybind_module.cpp`
  - [ ] `tests/test_ops.cpp` (C++ unit tests with Catch2 or similar)
  - [ ] `tests/test_gradient.py` (gradient checks via pybind11)
  - [ ] `tests/test_mnist.py` (training + comparison)
  - [ ] Clean `valgrind` or ASan output (no leaks, no errors)
- [ ] Build instructions in a `README.md` inside the submission directory
- [ ] All Python tests runnable with `pytest tests/`

---

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Computational graph + AD passes | 15 | Correct Wengert list, correct adjoint/tangent values, verified consistency |
| A2: Jacobian complexity | 15 | Rigorous proofs, correct asymptotic analysis, insightful comparison |
| A3: Dual numbers + Hessians | 10 | Correct algebra, clear derivation, comparison of methods |
| A4: Checkpointing | 10 | Correct memory/compute analysis, reasonable estimation, justified argument |
| B1: C++ Tensor + Storage | 10 | Shared storage, strided layout, zero-copy views, no leaks |
| B2: Ops + Autograd graph | 15 | All ops correct, broadcasting, topological backward, fan-out |
| B3: pybind11 bindings | 5 | NumPy interop, clean build, importable module |
| B4: Gradient checks + MNIST | 10 | All ops pass, >95% accuracy, PyTorch match |
| B5: Performance analysis | 10 | Meaningful instrumentation, quantitative comparison, insightful analysis |
| **Total** | **100** | |

---

## Hints and Guidance

1. **Start with scalars in C++.** Get `add`, `mul`, and `backward()` working for 0-dimensional tensors first. Write a C++ `main()` test before touching pybind11.

2. **Use `shared_ptr` everywhere.** The autograd graph creates shared ownership (a `GradFunction` holds references to saved tensors, which may also be held by the user). `shared_ptr` handles this naturally; raw pointers will lead to use-after-free bugs.

3. **Broadcasting backward is the hardest part.** When `a + b` broadcasts (e.g., `a` has shape `{3, 1}` and `b` has shape `{1, 4}`), the output has shape `{3, 4}`. In the backward pass, `a`'s gradient must be summed over axis 1 and `b`'s over axis 0. Write `reduce_grad(grad, target_shape)` as a standalone function and test it thoroughly in C++ before proceeding.

4. **Use float64 for everything.** Gradient checking with float32 produces too much numerical noise. Real frameworks support multiple dtypes; you only need float64.

5. **pybind11 NumPy bridge.** Use `py::array_t<double>` with `py::buffer_info` to access NumPy data pointers. For contiguous tensors, you can share the buffer (zero-copy) using `py::array_t`'s buffer protocol. See the pybind11 documentation on NumPy arrays.

6. **Build tip.** A minimal `CMakeLists.txt`:
   ```cmake
   cmake_minimum_required(VERSION 3.20)
   project(minigrad)
   set(CMAKE_CXX_STANDARD 17)

   find_package(pybind11 REQUIRED)

   pybind11_add_module(minigrad
       src/tensor.cpp
       src/ops.cpp
       src/autograd.cpp
       bindings/pybind_module.cpp
   )
   target_include_directories(minigrad PRIVATE include)
   ```

7. **For cross-entropy loss**, use the log-sum-exp trick for numerical stability:
   $$\log \text{softmax}(z)_k = z_k - \log \sum_j \exp(z_j) = z_k - \left( m + \log \sum_j \exp(z_j - m) \right)$$
   where $m = \max_j z_j$. Implement this in Python using your C++ ops (exp, log, sum, sub).

8. **Profiling tip.** Compile with `-fsanitize=address` during development, then switch to `-O2` for benchmarking. The performance gap vs. PyTorch comes from two sources: (a) your matmul is naive triple-loop vs. PyTorch's MKL/OpenBLAS, and (b) your graph traversal has overhead from `shared_ptr` reference counting. Both are worth quantifying.
