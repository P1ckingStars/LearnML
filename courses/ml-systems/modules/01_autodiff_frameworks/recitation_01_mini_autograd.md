# Recitation 01: Building a C++ Autograd Engine with pybind11

## Overview

In this recitation, we build a minimal but complete reverse-mode automatic differentiation engine **in C++17** and expose it to Python via pybind11. By the end, you will have a working `minigrad` Python module backed by C++ code that can differentiate arbitrary compositions of elementary operations.

**Prerequisites:** Lecture 01a (computational graphs, forward/reverse AD), Lecture 01b (tensor basics), C++17 fluency, basic CMake knowledge.

**What we build:**
1. A C++ `Value` class (scalar) that tracks the computation graph using `shared_ptr`.
2. Forward operations (`+`, `*`, `relu`, `exp`) that record themselves on the autograd tape.
3. A `backward()` function that performs reverse-mode AD via topological sort.
4. A C++ `Tensor` class backed by a `Storage` with strided layout.
5. pybind11 bindings that let us use the engine from Python.
6. A Python gradient check to verify correctness.

---

## 1. Project Setup

Create the following directory structure:

```
minigrad/
├── CMakeLists.txt
├── include/
│   ├── value.h
│   └── tensor.h
├── src/
│   ├── value.cpp
│   └── tensor.cpp
├── bindings/
│   └── pybind_module.cpp
└── tests/
    └── test_value.py
```

Minimal `CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.20)
project(minigrad LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(pybind11 REQUIRED)

pybind11_add_module(minigrad
    src/value.cpp
    bindings/pybind_module.cpp
)
target_include_directories(minigrad PRIVATE include)
```

Build and test:

```bash
mkdir build && cd build
cmake .. -Dpybind11_DIR=$(python -m pybind11 --cmakedir)
cmake --build .
# This produces minigrad.cpython-*.so — a Python-importable module
cd .. && python -c "import minigrad; print('OK')"
```

---

## 2. The `Value` Class: Scalars with Gradients (C++)

We start with scalars. Each `Value` wraps a `double`, stores its gradient, and holds a backward function.

```cpp
// include/value.h
#pragma once
#include <vector>
#include <memory>
#include <functional>
#include <string>
#include <set>

class Value;
using ValuePtr = std::shared_ptr<Value>;

class Value : public std::enable_shared_from_this<Value> {
public:
    double data;
    double grad = 0.0;
    std::function<void()> _backward = []() {};
    std::vector<ValuePtr> _prev;
    std::string _op;

    explicit Value(double data, std::vector<ValuePtr> children = {},
                   std::string op = "")
        : data(data), _prev(std::move(children)), _op(std::move(op)) {}

    void backward();

    // Factory (convenience)
    static ValuePtr create(double data) {
        return std::make_shared<Value>(data);
    }
};

// Operations — return new ValuePtr
ValuePtr add(ValuePtr a, ValuePtr b);
ValuePtr mul(ValuePtr a, ValuePtr b);
ValuePtr pow_val(ValuePtr a, double exponent);
ValuePtr neg(ValuePtr a);
ValuePtr sub(ValuePtr a, ValuePtr b);
ValuePtr relu(ValuePtr a);
ValuePtr exp_val(ValuePtr a);
ValuePtr log_val(ValuePtr a);
```

Key design decisions:
- We use `shared_ptr` because the autograd graph creates shared ownership: a `_backward` closure captures references to parent `Value`s.
- `_prev` stores parent nodes for topological sorting.
- `grad` stores $\bar{v} = \partial \mathcal{L} / \partial v$ (the adjoint).

---

## 3. Arithmetic Operations (C++)

Each operation creates a new `Value` and defines a `_backward` lambda that implements the local chain rule.

```cpp
// src/value.cpp
#include "value.h"
#include <cmath>
#include <algorithm>

ValuePtr add(ValuePtr a, ValuePtr b) {
    auto out = std::make_shared<Value>(
        a->data + b->data, std::vector<ValuePtr>{a, b}, "+");

    // Capture a, b, out by shared_ptr — prevents dangling references.
    auto out_weak = std::weak_ptr<Value>(out);
    out->_backward = [a, b, out_weak]() {
        auto out = out_weak.lock();
        // d(a + b)/da = 1, d(a + b)/db = 1
        a->grad += 1.0 * out->grad;
        b->grad += 1.0 * out->grad;
    };
    return out;
}

ValuePtr mul(ValuePtr a, ValuePtr b) {
    auto out = std::make_shared<Value>(
        a->data * b->data, std::vector<ValuePtr>{a, b}, "*");

    auto out_weak = std::weak_ptr<Value>(out);
    out->_backward = [a, b, out_weak]() {
        auto out = out_weak.lock();
        // d(a * b)/da = b, d(a * b)/db = a
        a->grad += b->data * out->grad;
        b->grad += a->data * out->grad;
    };
    return out;
}

ValuePtr relu(ValuePtr a) {
    auto out = std::make_shared<Value>(
        std::max(0.0, a->data), std::vector<ValuePtr>{a}, "relu");

    auto out_weak = std::weak_ptr<Value>(out);
    out->_backward = [a, out_weak]() {
        auto out = out_weak.lock();
        a->grad += (a->data > 0 ? 1.0 : 0.0) * out->grad;
    };
    return out;
}

ValuePtr exp_val(ValuePtr a) {
    double ex = std::exp(a->data);
    auto out = std::make_shared<Value>(
        ex, std::vector<ValuePtr>{a}, "exp");

    auto out_weak = std::weak_ptr<Value>(out);
    out->_backward = [a, ex, out_weak]() {
        auto out = out_weak.lock();
        // d(exp(a))/da = exp(a)
        a->grad += ex * out->grad;
    };
    return out;
}

ValuePtr pow_val(ValuePtr a, double exponent) {
    auto out = std::make_shared<Value>(
        std::pow(a->data, exponent), std::vector<ValuePtr>{a}, "**");

    auto out_weak = std::weak_ptr<Value>(out);
    out->_backward = [a, exponent, out_weak]() {
        auto out = out_weak.lock();
        a->grad += exponent * std::pow(a->data, exponent - 1) * out->grad;
    };
    return out;
}

ValuePtr neg(ValuePtr a) {
    return mul(a, Value::create(-1.0));
}

ValuePtr sub(ValuePtr a, ValuePtr b) {
    return add(a, neg(b));
}

ValuePtr log_val(ValuePtr a) {
    auto out = std::make_shared<Value>(
        std::log(a->data), std::vector<ValuePtr>{a}, "log");

    auto out_weak = std::weak_ptr<Value>(out);
    out->_backward = [a, out_weak]() {
        auto out = out_weak.lock();
        a->grad += (1.0 / a->data) * out->grad;
    };
    return out;
}
```

**Why `+=` in `_backward`?** A `Value` may be used multiple times (fan-out in the graph). The multivariate chain rule says we must **sum** the gradient contributions from all consumers.

**Why `weak_ptr` for `out`?** The backward lambda is stored *inside* `out`. If the lambda captured `out` by `shared_ptr`, we would create a reference cycle (out -> lambda -> out). Using `weak_ptr` breaks the cycle.

---

## 4. The Backward Pass: Topological Sort (C++)

```cpp
// src/value.cpp (continued)

void Value::backward() {
    // Step 1: Build topological order via DFS
    std::vector<Value*> topo;
    std::set<Value*> visited;

    std::function<void(Value*)> build_topo = [&](Value* v) {
        if (visited.count(v)) return;
        visited.insert(v);
        for (auto& parent : v->_prev) {
            build_topo(parent.get());
        }
        topo.push_back(v);
    };

    build_topo(this);

    // Step 2: Seed the output gradient
    this->grad = 1.0;

    // Step 3: Traverse in reverse topological order
    for (auto it = topo.rbegin(); it != topo.rend(); ++it) {
        (*it)->_backward();
    }
}
```

This is identical to the Python algorithm — topological sort is language-agnostic. The C++ version uses raw pointers for traversal (the `shared_ptr`s in `_prev` keep objects alive).

---

## 5. pybind11 Bindings

Now expose the C++ engine to Python:

```cpp
// bindings/pybind_module.cpp
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/functional.h>
#include "value.h"

namespace py = pybind11;

PYBIND11_MODULE(minigrad, m) {
    m.doc() = "Minimal C++ autograd engine";

    py::class_<Value, ValuePtr>(m, "Value")
        .def(py::init([](double data) {
            return std::make_shared<Value>(data);
        }), py::arg("data"))
        .def_readwrite("data", &Value::data)
        .def_readwrite("grad", &Value::grad)
        .def("backward", &Value::backward)
        .def("__repr__", [](const Value& v) {
            return "Value(data=" + std::to_string(v.data)
                 + ", grad=" + std::to_string(v.grad) + ")";
        });

    // Expose operations as free functions
    m.def("add", &add, "Element-wise addition");
    m.def("mul", &mul, "Element-wise multiplication");
    m.def("pow", &pow_val, "Power");
    m.def("neg", &neg, "Negation");
    m.def("sub", &sub, "Subtraction");
    m.def("relu", &relu, "ReLU activation");
    m.def("exp", &exp_val, "Exponential");
    m.def("log", &log_val, "Natural logarithm");

    // Convenience: add operator overloads via Python-side wrappers
    // (Alternatively, define __add__ etc. directly on the class)
}
```

After building, we can use this from Python:

```python
import minigrad as mg

a = mg.Value(2.0)
b = mg.Value(3.0)
c = mg.mul(a, b)    # c = 6
d = mg.add(c, a)    # d = 8 (a used twice — fan-out!)
e = mg.pow(d, 2)    # e = 64

e.backward()

print(f"a.grad = {a.grad}")  # 64.0
print(f"b.grad = {b.grad}")  # 32.0
```

---

## 6. Testing: Gradient Check from Python

```python
# tests/test_value.py
import minigrad as mg

def numerical_grad(f, val, eps=1e-7):
    """Central differences."""
    val.data += eps
    f_plus = f().data
    val.data -= 2 * eps
    f_minus = f().data
    val.data += eps  # restore
    return (f_plus - f_minus) / (2 * eps)

def test_fan_out():
    """Test: a is used twice in the graph."""
    a = mg.Value(2.0)
    b = mg.Value(3.0)
    c = mg.mul(a, b)
    d = mg.add(c, a)  # a used twice
    e = mg.pow(d, 2)
    e.backward()
    # e = (a*b + a)^2
    # de/da = 2(a*b + a)(b + 1) = 2*8*4 = 64
    # de/db = 2(a*b + a)*a = 2*8*2 = 32
    assert abs(a.grad - 64.0) < 1e-6, f"Expected 64, got {a.grad}"
    assert abs(b.grad - 32.0) < 1e-6, f"Expected 32, got {b.grad}"
    print("PASS: fan_out")

def test_transcendental():
    """Test exp, log, relu against numerical gradient."""
    x = mg.Value(1.5)
    f = lambda: mg.relu(mg.add(mg.exp(x), mg.log(x)))

    result = f()
    result.backward()
    analytical = x.grad

    numerical = numerical_grad(f, x)
    err = abs(analytical - numerical)
    assert err < 1e-5, f"Gradient error: {err}"
    print(f"PASS: transcendental (error={err:.2e})")

test_fan_out()
test_transcendental()
```

---

## 7. Extending to Tensors: Storage and Strides (C++)

For the homework, you will extend this to tensors. Here is the key idea:

```cpp
// include/tensor.h (sketch for homework — not a complete implementation)
#pragma once
#include <memory>
#include <vector>
#include <cstdint>

class Storage {
public:
    explicit Storage(size_t size) : data_(size, 0.0) {}

    double* data() { return data_.data(); }
    const double* data() const { return data_.data(); }
    size_t size() const { return data_.size(); }

private:
    std::vector<double> data_;
};

class Tensor;
using TensorPtr = std::shared_ptr<Tensor>;

class Tensor : public std::enable_shared_from_this<Tensor> {
public:
    // Create a tensor that owns a new Storage
    static TensorPtr zeros(std::vector<int64_t> shape);
    static TensorPtr from_data(const double* data,
                               std::vector<int64_t> shape);

    // Data access
    double& at(std::vector<int64_t> indices);
    double* data() { return storage_->data() + offset_; }

    // Shape/stride
    const std::vector<int64_t>& shape() const { return shape_; }
    const std::vector<int64_t>& strides() const { return strides_; }
    int64_t numel() const;

    // View operations (zero-copy — modify strides only)
    TensorPtr reshape(std::vector<int64_t> new_shape);
    TensorPtr transpose(int64_t dim0, int64_t dim1);
    bool is_contiguous() const;

    // Autograd
    bool requires_grad = false;
    TensorPtr grad;
    // ... GradFunction pointer for backward

private:
    std::shared_ptr<Storage> storage_;
    size_t offset_ = 0;
    std::vector<int64_t> shape_;
    std::vector<int64_t> strides_;
};
```

**Key insight: views share `Storage`.** When you call `transpose()`, the new `Tensor` points to the same `Storage` but has different `strides_`. No data is copied. This is exactly how PyTorch works under the hood (see `c10::TensorImpl`).

To compute the flat index for multi-dimensional access:

```cpp
size_t flat_index(const std::vector<int64_t>& indices,
                  const std::vector<int64_t>& strides) {
    size_t idx = 0;
    for (size_t i = 0; i < indices.size(); ++i) {
        idx += indices[i] * strides[i];
    }
    return idx;
}
```

---

## 8. pybind11 NumPy Bridge

The bridge between C++ tensors and Python is through NumPy's buffer protocol:

```cpp
// From NumPy array to C++ Tensor
TensorPtr tensor_from_numpy(py::array_t<double> arr) {
    py::buffer_info buf = arr.request();
    auto* ptr = static_cast<double*>(buf.ptr);
    std::vector<int64_t> shape(buf.shape.begin(), buf.shape.end());
    return Tensor::from_data(ptr, shape);
}

// From C++ Tensor to NumPy array
py::array_t<double> tensor_to_numpy(TensorPtr t) {
    if (!t->is_contiguous()) {
        // Must copy — NumPy can't handle non-contiguous with arbitrary strides
        // (In practice you'd make it contiguous first)
    }
    // Return a view (zero-copy) if contiguous:
    auto shape = t->shape();
    auto strides = t->strides();
    // Convert element strides to byte strides
    std::vector<ssize_t> byte_strides(strides.size());
    for (size_t i = 0; i < strides.size(); ++i) {
        byte_strides[i] = strides[i] * sizeof(double);
    }

    // The capsule prevents the Storage from being freed while NumPy uses it
    auto storage = t->storage_shared();  // get shared_ptr<Storage>
    auto capsule = py::capsule(new std::shared_ptr<Storage>(storage),
        [](void* p) { delete static_cast<std::shared_ptr<Storage>*>(p); });

    return py::array_t<double>(
        std::vector<ssize_t>(shape.begin(), shape.end()),
        byte_strides,
        t->data(),
        capsule
    );
}
```

The `capsule` trick is important: it ensures the C++ `Storage` stays alive as long as the NumPy array exists. This is zero-copy data sharing between C++ and Python.

---

## 9. What Comes Next (Homework 01)

In the homework, you will:

1. **Complete the `Tensor` class** with all required operations (add, mul, matmul, relu, sum, reshape, transpose) — each with a correct backward.
2. **Handle broadcasting** in both forward (shape inference) and backward (gradient reduction via `reduce_grad(grad, target_shape)`).
3. **Build the full pybind11 module** so that Python code like this works:

```python
import minigrad as mg
import numpy as np

A = mg.Tensor.from_numpy(np.random.randn(3, 4))
A.requires_grad = True
B = mg.Tensor.from_numpy(np.random.randn(4, 5))
B.requires_grad = True

C = mg.matmul(A, B)          # (3, 5)
D = mg.relu(C)                # (3, 5)
loss = mg.sum(D)              # scalar
loss.backward()

print(A.grad.numpy())  # (3, 4) gradient
```

4. **Train an MLP on MNIST** using your engine (thin Python wrappers for `Linear`, `SGD`, `cross_entropy_loss` calling your C++ ops).
5. **Profile and compare** against PyTorch CPU.

---

## Summary

In this recitation, we built:

1. A **C++ `Value` class** with `shared_ptr`-based ownership and `std::function` backward closures.
2. **Operations** (add, mul, pow, relu, exp, log) that record the autograd tape.
3. A **topological-sort backward pass** — same algorithm as Python, but in C++.
4. **pybind11 bindings** that expose the C++ engine as a Python module.
5. **Python-side gradient checks** verifying the C++ engine against numerical differentiation.

The key C++ patterns you learned:
- **`shared_ptr` for graph ownership**: Autograd graphs have shared ownership (backward closures reference saved tensors). `shared_ptr` handles this; raw pointers would cause use-after-free.
- **`weak_ptr` to break cycles**: A backward lambda stored inside a `Value` must not hold a `shared_ptr` to that same `Value`.
- **`std::function` for type-erased closures**: Each operation's backward logic is different, but they all share the `void()` signature.
- **pybind11 buffer protocol**: Zero-copy data sharing between C++ arrays and NumPy via capsules.

**Exercises:**
1. Add `sigmoid` and `tanh` operations to the `Value` class. Write gradient checks for both.
2. Compile with `-fsanitize=address` and verify no memory errors during the fan-out test.
3. Add a `Tensor::matmul` operation with the correct backward (grad_a = grad_out @ B^T, grad_b = A^T @ grad_out). Test with gradient checking.
4. Benchmark `Value`-based scalar autograd vs. a pure Python implementation. How much faster is C++?
