# Recitation 04: Attention Computation Walkthrough and Complexity Analysis

## Overview

This recitation provides step-by-step worked examples for core attention concepts, along with practical exercises and solutions. The goals are:

1. Demystify attention by computing it on small, concrete examples.
2. Develop fluency with FLOP and memory complexity analysis.
3. Understand KV cache mechanics through a worked generation example.
4. Build intuition for FlashAttention's tiling strategy.

---

## Section 1: Step-by-Step Attention Computation

### 1.1 Scaled Dot-Product Attention (Worked Example)

**Setup.** Consider $T = 3$ tokens with $d_k = 2$:

$$Q = \begin{pmatrix} 1 & 0 \\ 0 & 1 \\ 1 & 1 \end{pmatrix}, \quad K = \begin{pmatrix} 1 & 0 \\ 0 & 1 \\ 0.5 & 0.5 \end{pmatrix}, \quad V = \begin{pmatrix} 1 & 0 \\ 0 & 1 \\ 0.5 & 0.5 \end{pmatrix}$$

**Step 1: Compute raw scores** $S = QK^\top$:

$$S = \begin{pmatrix} 1 & 0 \\ 0 & 1 \\ 1 & 1 \end{pmatrix} \begin{pmatrix} 1 & 0 & 0.5 \\ 0 & 1 & 0.5 \end{pmatrix} = \begin{pmatrix} 1 & 0 & 0.5 \\ 0 & 1 & 0.5 \\ 1 & 1 & 1 \end{pmatrix}$$

**Step 2: Scale** by $1/\sqrt{d_k} = 1/\sqrt{2} \approx 0.707$:

$$\tilde{S} = \frac{S}{\sqrt{2}} = \begin{pmatrix} 0.707 & 0 & 0.354 \\ 0 & 0.707 & 0.354 \\ 0.707 & 0.707 & 0.707 \end{pmatrix}$$

**Step 3: Apply softmax** (row-wise):

For row 1: $\text{softmax}(0.707, 0, 0.354)$

$$e^{0.707} = 2.028, \quad e^0 = 1, \quad e^{0.354} = 1.425$$

$$Z_1 = 2.028 + 1 + 1.425 = 4.453$$

$$\alpha_1 = (0.455, 0.225, 0.320)$$

For row 2: $\text{softmax}(0, 0.707, 0.354)$

$$\alpha_2 = (0.225, 0.455, 0.320)$$

For row 3: $\text{softmax}(0.707, 0.707, 0.707)$ --- all equal!

$$\alpha_3 = (1/3, 1/3, 1/3) = (0.333, 0.333, 0.333)$$

So:

$$A = \begin{pmatrix} 0.455 & 0.225 & 0.320 \\ 0.225 & 0.455 & 0.320 \\ 0.333 & 0.333 & 0.333 \end{pmatrix}$$

**Step 4: Compute output** $O = AV$:

$$O = \begin{pmatrix} 0.455 & 0.225 & 0.320 \\ 0.225 & 0.455 & 0.320 \\ 0.333 & 0.333 & 0.333 \end{pmatrix} \begin{pmatrix} 1 & 0 \\ 0 & 1 \\ 0.5 & 0.5 \end{pmatrix}$$

Row 1: $(0.455 \cdot 1 + 0.225 \cdot 0 + 0.320 \cdot 0.5, \quad 0.455 \cdot 0 + 0.225 \cdot 1 + 0.320 \cdot 0.5) = (0.615, 0.385)$

Row 2: $(0.225 + 0 + 0.160, \quad 0 + 0.455 + 0.160) = (0.385, 0.615)$

Row 3: $(0.333 + 0 + 0.167, \quad 0 + 0.333 + 0.167) = (0.500, 0.500)$

$$O = \begin{pmatrix} 0.615 & 0.385 \\ 0.385 & 0.615 \\ 0.500 & 0.500 \end{pmatrix}$$

**Interpretation:**
- Token 1 (query $[1,0]$) attends most to key 1 ($[1,0]$), so its output is biased toward value 1.
- Token 2 (query $[0,1]$) attends most to key 2 ($[0,1]$), so its output is biased toward value 2.
- Token 3 (query $[1,1]$) attends equally to all keys (because its dot product with all keys is equal after scaling), so its output is the mean of all values.

### 1.2 Causal (Masked) Attention (Worked Example)

Using the same $Q, K, V$ but with a causal mask:

$$M = \begin{pmatrix} 1 & 0 & 0 \\ 1 & 1 & 0 \\ 1 & 1 & 1 \end{pmatrix}$$

**Masked scores** (set $-\infty$ where $M = 0$):

$$\tilde{S}_{\text{causal}} = \begin{pmatrix} 0.707 & -\infty & -\infty \\ 0 & 0.707 & -\infty \\ 0.707 & 0.707 & 0.707 \end{pmatrix}$$

**Softmax:**

Row 1: $\text{softmax}(0.707, -\infty, -\infty) = (1, 0, 0)$

Row 2: $\text{softmax}(0, 0.707, -\infty) = \left(\frac{1}{1 + 2.028}, \frac{2.028}{1 + 2.028}, 0\right) = (0.330, 0.670, 0)$

Row 3: Same as before (no masking): $(0.333, 0.333, 0.333)$

**Output:**

Row 1: $(1, 0) \cdot V_1 = (1, 0)$ --- token 1 only sees itself.

Row 2: $0.330 \cdot (1,0) + 0.670 \cdot (0,1) = (0.330, 0.670)$

Row 3: Same as unmasked: $(0.500, 0.500)$

**Key observation:** Token 1's output is *identical* to its value --- it has no other context. Token 2 sees tokens 1-2 only. Token 3 sees all tokens.

### 1.3 Multi-Head Attention (Worked Example)

Let $d_{\text{model}} = 4$, $h = 2$, so $d_k = 2$.

Input $X \in \mathbb{R}^{3 \times 4}$:

$$X = \begin{pmatrix} 1 & 0 & 0 & 1 \\ 0 & 1 & 1 & 0 \\ 1 & 1 & 0 & 0 \end{pmatrix}$$

**Head 1** uses the first 2 dimensions (conceptually, after $W_1^Q, W_1^K, W_1^V$ projections):
- Operates on a $d_k = 2$ subspace.
- Might learn to attend based on syntactic patterns.

**Head 2** uses a different 2D projection:
- Operates on a different $d_k = 2$ subspace.
- Might learn to attend based on semantic patterns.

Each head produces a $(3, 2)$ output. Concatenation gives $(3, 4)$, which is then projected by $W^O$ back to $(3, 4)$.

---

## Section 2: Complexity Analysis

### 2.1 FLOP Counting for Self-Attention

For a single head with $T$ tokens and $d_k$ dimensions:

| Operation | Shape computation | FLOPs |
|:----------|:------------------|:------|
| $Q = XW^Q$ | $(T, d) \times (d, d_k) \to (T, d_k)$ | $2Tdd_k$ |
| $K = XW^K$ | same | $2Tdd_k$ |
| $V = XW^V$ | same | $2Tdd_k$ |
| $S = QK^\top$ | $(T, d_k) \times (d_k, T) \to (T, T)$ | $2T^2 d_k$ |
| Scale + Softmax | element-wise on $(T, T)$ | $O(T^2)$ |
| $O = AV$ | $(T, T) \times (T, d_k) \to (T, d_k)$ | $2T^2 d_k$ |
| Output proj $W^O$ | $(T, d) \times (d, d) \to (T, d)$ | $2Td^2$ |

For $h$ heads with $d_k = d/h$:
- QKV projections: $3 \times 2Td \cdot d = 6Td^2$ (or equivalently $3 \times 2Td \cdot d_k \cdot h = 6Td^2$)
- Attention per head: $4T^2 d_k$ (for $S$ and $AV$)
- Total attention: $h \times 4T^2 d_k = 4T^2 d$
- Output proj: $2Td^2$

**Total MHA FLOPs: $8Td^2 + 4T^2d$**

### 2.2 FLOP Counting for FFN

$$\text{FFN}(x) = W_2 \, \text{ReLU}(W_1 x + b_1) + b_2$$

| Operation | FLOPs |
|:----------|:------|
| $W_1 x$ | $2T \cdot d \cdot d_{\text{ff}}$ |
| ReLU | $T \cdot d_{\text{ff}}$ (negligible) |
| $W_2 (\cdot)$ | $2T \cdot d_{\text{ff}} \cdot d$ |

With $d_{\text{ff}} = 4d$: **Total FFN FLOPs: $16Td^2$**

### 2.3 Full Transformer Layer

$$\text{FLOPs}_{\text{layer}} = \underbrace{8Td^2 + 4T^2d}_{\text{MHA}} + \underbrace{16Td^2}_{\text{FFN}} = 24Td^2 + 4T^2d$$

**Crossover point** (where MHA cost = FFN cost):

$$8Td^2 + 4T^2d = 16Td^2 \implies 4T^2d = 8Td^2 \implies T = 2d$$

For $d = 4096$: $T^* = 8192$.

For an $N$-layer Transformer: $\text{FLOPs}_{\text{total}} = N(24Td^2 + 4T^2d)$.

### 2.4 Memory Analysis

**Parameters per layer:**

| Component | Parameters |
|:----------|:----------|
| $W^Q, W^K, W^V$ | $3d^2$ |
| $W^O$ | $d^2$ |
| $W_1, b_1$ | $d \cdot d_{\text{ff}} + d_{\text{ff}} \approx 4d^2$ |
| $W_2, b_2$ | $d_{\text{ff}} \cdot d + d \approx 4d^2$ |
| LayerNorms (2) | $4d$ |
| **Total per layer** | $\approx 12d^2$ |

**Activations per layer** (needed for backward pass):

| Tensor | Shape | Elements |
|:-------|:------|:---------|
| Input $X$ | $(B, T, d)$ | $BTd$ |
| $Q, K, V$ (all heads) | $(B, h, T, d_k) \times 3$ | $3BTd$ |
| Attention scores $S$ | $(B, h, T, T)$ | $BhT^2$ |
| Attention weights $A$ | $(B, h, T, T)$ | $BhT^2$ |
| FFN intermediate | $(B, T, 4d)$ | $4BTd$ |
| **Total per layer** | | $\approx 8BTd + 2BhT^2$ |

The $2BhT^2 = 2BT^2 \cdot h$ term (from storing attention matrices) dominates when $T > 4d/h = 4d_k$. For $d_k = 128$: $T > 512$.

### 2.5 Self-Attention vs Cross-Attention Complexity

**Self-attention**: $Q, K, V$ all from the same input of length $T$.
- FLOPs: $O(T^2 d)$ for the attention, $O(Td^2)$ for projections.
- Memory: $O(T^2)$ for the attention matrix.

**Cross-attention**: $Q$ from decoder (length $T_{\text{dec}}$), $K, V$ from encoder (length $T_{\text{enc}}$).
- FLOPs: $O(T_{\text{dec}} \cdot T_{\text{enc}} \cdot d)$ for attention, $O((T_{\text{dec}} + T_{\text{enc}}) \cdot d^2)$ for projections.
- Memory: $O(T_{\text{dec}} \cdot T_{\text{enc}})$ for the attention matrix.

When $T_{\text{enc}} \gg T_{\text{dec}}$ (e.g., summarization: long document, short summary), cross-attention is cheaper than encoder self-attention.

---

## Section 3: KV Cache Worked Example

### 3.1 Setup

Consider a tiny model: $N = 1$ layer, $h = 2$ heads, $d_k = 2$, vocabulary = {a, b, c, d}.

Suppose we have already processed the prompt "a b" (positions 0 and 1) and want to generate the next token.

### 3.2 After Prefill (Processing "a b")

During the prefill phase, we process both tokens at once:

```
Input: [a, b]  ->  positions [0, 1]

For each head, we computed and cached:
  K_cache = [[k_a^(1), k_b^(1)],   # head 1: (2, d_k)
             [k_a^(2), k_b^(2)]]    # head 2: (2, d_k)

  V_cache = [[v_a^(1), v_b^(1)],   # head 1: (2, d_k)
             [v_a^(2), v_b^(2)]]    # head 2: (2, d_k)

Output after prefill: logits for next token
  -> Model predicts "c" as next token
```

### 3.3 Generation Step 1: Processing "c"

Now we process ONLY the new token "c" at position 2:

```
1. Embed "c" -> x_c ∈ ℝ^d

2. Compute Q, K, V for this single token:
   q_c = x_c W^Q    # (1, d_k) per head
   k_c = x_c W^K    # (1, d_k) per head
   v_c = x_c W^V    # (1, d_k) per head

3. Update cache:
   K_cache = [k_a, k_b, k_c]   # now (3, d_k) per head
   V_cache = [v_a, v_b, v_c]   # now (3, d_k) per head

4. Compute attention (token "c" attends to all cached tokens):
   scores = q_c @ K_cache^T / √d_k   # (1, 3) per head
   = [q_c·k_a, q_c·k_b, q_c·k_c] / √d_k

5. Apply causal mask (all positions ≤ 2 are visible): no masking needed.

6. Softmax -> attention weights α = [α_a, α_b, α_c]

7. Output = α_a·v_a + α_b·v_b + α_c·v_c    # (1, d_k) per head

8. Concatenate heads, project, FFN -> logits -> predict "d"
```

**Key efficiency**: We only compute the attention for 1 query against 3 keys, not a full $3 \times 3$ attention matrix. The FLOPs for this step are $O(d \cdot t)$ where $t = 3$ (number of cached positions), not $O(t^2 d)$.

### 3.4 Memory Accounting

After generating $t$ tokens (with $T_{\text{prompt}}$ prompt tokens):

| Component | Memory |
|:----------|:-------|
| Model parameters | $12Nd^2$ (fixed) |
| KV cache | $2N \times h \times (T_{\text{prompt}} + t) \times d_k$ |
| Current activations | $O(Nd)$ (negligible --- only 1 token) |

The KV cache grows linearly with $t$. For a 70B model generating 4K tokens:

$$\text{KV cache} = 2 \times 80 \times 8 \times 4096 \times 128 \times 2 \text{ bytes} = 1.34 \text{ GB}$$

---

## Section 4: FlashAttention Intuition

### 4.1 The Problem with Standard Attention

Standard attention on a GPU:

```
Step 1: S = Q @ K^T         # Write T×T matrix to HBM    (slow write)
Step 2: Load S from HBM     # Read T×T matrix from HBM   (slow read)
        A = softmax(S)
        Write A to HBM       # Write T×T matrix to HBM    (slow write)
Step 3: Load A from HBM     # Read T×T matrix from HBM   (slow read)
        O = A @ V
```

Total HBM accesses: $4T^2 + 2Td$ (reading/writing $S$, $A$, $Q$, $K$, $V$, $O$).

For $T = 4096$, $d = 128$: $4 \times 16M + 2 \times 512K \approx 65M$ floats moved to/from HBM.

### 4.2 FlashAttention Strategy

FlashAttention tiles the computation into blocks that fit in SRAM:

```
For each block of Q (size B_r × d):
    For each block of K, V (size B_c × d):
        - Load Q_block, K_block, V_block to SRAM (fast)
        - Compute partial attention in SRAM (fast)
        - Update running output using online softmax (fast)
        - Only write final output block to HBM (slow, but once)
```

The attention matrix $S$ is computed in blocks and **never fully materialized** in HBM.

### 4.3 Online Softmax Walkthrough

Suppose we have scores $s = [2, 1, 4, 3]$ and values $v = [v_1, v_2, v_3, v_4]$, processed in two blocks: $B_1 = [2, 1]$ and $B_2 = [4, 3]$.

**After Block 1** ($[2, 1]$):

$$m^{(1)} = 2, \quad d^{(1)} = e^{2-2} + e^{1-2} = 1 + 0.368 = 1.368$$

$$o^{(1)} = \frac{e^{2-2} v_1 + e^{1-2} v_2}{1.368} = \frac{v_1 + 0.368 v_2}{1.368}$$

**After Block 2** ($[4, 3]$):

$$m^{(2)} = \max(2, 4) = 4$$

$$d^{(2)} = 1.368 \cdot e^{2-4} + e^{4-4} + e^{3-4} = 1.368 \cdot 0.135 + 1 + 0.368 = 0.185 + 1.368 = 1.553$$

$$o^{(2)} = o^{(1)} \cdot \frac{1.368 \cdot e^{2-4}}{1.553} + \frac{e^{4-4} v_3 + e^{3-4} v_4}{1.553}$$

$$= o^{(1)} \cdot \frac{0.185}{1.553} + \frac{v_3 + 0.368 v_4}{1.553}$$

Let us verify: the exact result is:

$$\text{softmax}([2,1,4,3]) = \frac{1}{e^2 + e^1 + e^4 + e^3}[e^2, e^1, e^4, e^3]$$

$$= \frac{1}{7.389 + 2.718 + 54.598 + 20.086}[7.389, 2.718, 54.598, 20.086]$$

$$= \frac{1}{84.791}[7.389, 2.718, 54.598, 20.086] = [0.087, 0.032, 0.644, 0.237]$$

The online computation gives the same result (up to numerical precision), but we never needed to store all 4 scores simultaneously --- we processed them in blocks of 2.

### 4.4 Memory Savings

| Method | HBM Memory for Attention | SRAM Usage |
|:-------|:------------------------|:-----------|
| Standard | $O(T^2)$ for $S$ and $A$ | N/A |
| FlashAttention | $O(T)$ for $O$, $m$, $\ell$ | $O(B_r B_c + (B_r + B_c)d)$ |

For $T = 16384$, $d = 128$:
- Standard: $2 \times 16384^2 \times 2$ bytes $= 1$ GB just for $S$ and $A$.
- FlashAttention: $16384 \times 128 \times 2$ bytes $= 4$ MB for $O$, plus $O(T)$ for statistics.

---

## Section 5: Practice Exercises with Solutions

### Exercise 1: Compute Attention by Hand

Given:
$$Q = \begin{pmatrix} 2 & 0 \\ 1 & 1 \end{pmatrix}, \quad K = \begin{pmatrix} 1 & 1 \\ 0 & 2 \end{pmatrix}, \quad V = \begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}$$

Compute the scaled dot-product attention output (with $d_k = 2$).

<details>
<summary><strong>Solution</strong></summary>

**Step 1**: $S = QK^\top$

$$QK^\top = \begin{pmatrix} 2 & 0 \\ 1 & 1 \end{pmatrix}\begin{pmatrix} 1 & 0 \\ 1 & 2 \end{pmatrix} = \begin{pmatrix} 2 & 0 \\ 2 & 2 \end{pmatrix}$$

**Step 2**: Scale: $\tilde{S} = S/\sqrt{2}$

$$\tilde{S} = \begin{pmatrix} 1.414 & 0 \\ 1.414 & 1.414 \end{pmatrix}$$

**Step 3**: Softmax (row-wise):

Row 1: $\text{softmax}(1.414, 0) = \frac{(e^{1.414}, e^0)}{e^{1.414} + e^0} = \frac{(4.113, 1)}{5.113} = (0.804, 0.196)$

Row 2: $\text{softmax}(1.414, 1.414) = (0.5, 0.5)$

$$A = \begin{pmatrix} 0.804 & 0.196 \\ 0.5 & 0.5 \end{pmatrix}$$

**Step 4**: $O = AV$

$$O = \begin{pmatrix} 0.804 & 0.196 \\ 0.5 & 0.5 \end{pmatrix}\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix} = \begin{pmatrix} 0.804 & 0.196 \\ 0.5 & 0.5 \end{pmatrix}$$

Since $V = I$, the output equals the attention weights! This is a useful sanity check.
</details>

### Exercise 2: Causal Mask Application

Using the same $Q, K, V$ from Exercise 1, compute the output with a causal mask (lower triangular).

<details>
<summary><strong>Solution</strong></summary>

Causal mask: $M = \begin{pmatrix} 1 & 0 \\ 1 & 1 \end{pmatrix}$

Masked scores: $\tilde{S} = \begin{pmatrix} 1.414 & -\infty \\ 1.414 & 1.414 \end{pmatrix}$

Softmax:
- Row 1: $\text{softmax}(1.414, -\infty) = (1, 0)$
- Row 2: $\text{softmax}(1.414, 1.414) = (0.5, 0.5)$ (unchanged, both visible)

$O = \begin{pmatrix} 1 & 0 \\ 0.5 & 0.5 \end{pmatrix}$

Token 1 only sees itself, getting value $(1, 0)$. Token 2 sees both, getting the average.
</details>

### Exercise 3: FLOP Count

A model has $d_{\text{model}} = 512$, $h = 8$, $d_{\text{ff}} = 2048$, $N = 6$ layers.

**(a)** How many FLOPs for one forward pass with $T = 1024$?

**(b)** What fraction of FLOPs is spent on attention vs FFN?

<details>
<summary><strong>Solution</strong></summary>

**(a)** Per layer: $24Td^2 + 4T^2d$

$$= 24 \times 1024 \times 512^2 + 4 \times 1024^2 \times 512$$

$$= 24 \times 1024 \times 262144 + 4 \times 1048576 \times 512$$

$$= 6,442,450,944 + 2,147,483,648$$

$$= 8,589,934,592 \approx 8.6 \times 10^9 \text{ FLOPs per layer}$$

Total: $6 \times 8.6 \times 10^9 = 5.15 \times 10^{10} \approx 51.5$ GFLOPs.

**(b)** MHA FLOPs per layer: $8Td^2 + 4T^2d = 8 \times 1024 \times 262144 + 2,147,483,648 = 2.15G + 2.15G = 4.29G$

FFN FLOPs per layer: $16Td^2 = 16 \times 1024 \times 262144 = 4.29G$

Attention fraction: $4.29/(4.29 + 4.29) = 50\%$. At $T = 1024 = 2d$, attention and FFN costs are approximately equal (this is the crossover point since $T = 2d$).
</details>

### Exercise 4: KV Cache Memory

A model has $N = 32$, $h = 32$, $d_k = 128$, using GQA with $g = 4$ KV heads. Compute the KV cache memory for:

**(a)** Batch size 1, sequence length 4096 (FP16).

**(b)** Batch size 32, sequence length 2048 (FP16).

**(c)** At what sequence length does the KV cache exceed the model weight memory (assuming a 7B parameter model in FP16 = 14 GB)?

<details>
<summary><strong>Solution</strong></summary>

KV cache memory = $2 \times N \times g \times T \times d_k \times B \times 2$ bytes

**(a)**: $2 \times 32 \times 4 \times 4096 \times 128 \times 1 \times 2 = 2 \times 32 \times 4 \times 4096 \times 128 \times 2 = 268,435,456$ bytes $= 256$ MB.

**(b)**: $2 \times 32 \times 4 \times 2048 \times 128 \times 32 \times 2 = 4,294,967,296$ bytes $= 4$ GB.

**(c)**: Solve $2 \times 32 \times 4 \times T \times 128 \times B \times 2 = 14 \times 10^9$

For $B = 1$: $65536 T = 14 \times 10^9 \implies T = 213,623$. So at ~214K tokens, the KV cache alone equals the model size.

For $B = 32$: $T = 213623 / 32 = 6675$. Already at 6.7K tokens per request, the KV cache matches the model size.
</details>

### Exercise 5: FlashAttention Block Sizes

An A100 GPU has 20 MB of SRAM. You want to compute attention with $d_k = 128$ in FP16 (2 bytes per element).

**(a)** What is the maximum block size $B$ if $B_r = B_c = B$ and we need to store $Q_{\text{block}}$, $K_{\text{block}}$, $V_{\text{block}}$, $S_{\text{block}}$ simultaneously in SRAM?

**(b)** How many outer loop iterations are needed for $T = 4096$?

<details>
<summary><strong>Solution</strong></summary>

**(a)** SRAM budget: 20 MB = $20 \times 10^6$ bytes = $10^7$ FP16 elements.

Storage needed:
- $Q_{\text{block}}$: $B \times 128$
- $K_{\text{block}}$: $B \times 128$
- $V_{\text{block}}$: $B \times 128$
- $S_{\text{block}}$: $B \times B$
- $O_{\text{block}}$: $B \times 128$ (partial output)

Total elements: $4 \times 128B + B^2 = 512B + B^2$

Solve $B^2 + 512B \leq 10^7$:

$B = \frac{-512 + \sqrt{512^2 + 4 \times 10^7}}{2} = \frac{-512 + \sqrt{262144 + 40000000}}{2} = \frac{-512 + 6346}{2} = 2917$

So $B \leq 2917$. In practice, FlashAttention uses powers of 2, so $B = 2048$ or $B = 1024$.

**(b)** With $B = 2048$: $\lceil 4096/2048 \rceil = 2$ blocks per dimension, so $2 \times 2 = 4$ tile computations total.

With $B = 1024$: $4 \times 4 = 16$ tile computations.
</details>

### Exercise 6: Linear vs Quadratic Attention

You need to process sequences of length $T = 65536$ with $d = 512$.

**(a)** How many FLOPs does standard self-attention take?

**(b)** How many FLOPs does linear attention take (with $m = d = 512$)?

**(c)** What is the speedup factor?

<details>
<summary><strong>Solution</strong></summary>

**(a)** Standard: $4T^2 d = 4 \times 65536^2 \times 512 = 4 \times 4.295 \times 10^9 \times 512 = 8.80 \times 10^{12}$ FLOPs.

**(b)** Linear: $O(Tmd) = O(Td^2)$. More precisely, computing $S = K^\top V$ is $2Td^2 = 2 \times 65536 \times 512^2 = 3.44 \times 10^{10}$. Computing $QS$ for all queries is another $2Td^2 = 3.44 \times 10^{10}$. Total: $\approx 6.87 \times 10^{10}$ FLOPs.

**(c)** Speedup: $8.80 \times 10^{12} / 6.87 \times 10^{10} = 128\times$.

This matches $T / d = 65536 / 512 = 128$. The speedup of linear over quadratic attention is approximately $T/d$ (since $T^2d$ vs $Td^2$).
</details>

### Exercise 7: GQA Parameter Count

**(a)** For MHA with $d = 4096$, $h = 32$: how many parameters for QKV projections?

**(b)** For GQA with $d = 4096$, $h = 32$ query heads, $g = 8$ KV heads: how many parameters?

**(c)** What percentage of parameters are saved?

<details>
<summary><strong>Solution</strong></summary>

**(a)** MHA: $W^Q$: $d \times hd_k = d \times d = d^2$. Same for $W^K$, $W^V$. Plus $W^O$: $d^2$. Total: $4d^2 = 4 \times 4096^2 = 67,108,864 \approx 67$M parameters.

**(b)** GQA: $W^Q$: $d \times hd_k = d^2$ (same). $W^K$: $d \times gd_k = d \times g \times (d/h) = d^2 g/h$. Same for $W^V$. $W^O$: $d^2$.

Total: $d^2 + 2d^2 g/h + d^2 = d^2(2 + 2g/h)$

With $g = 8$, $h = 32$: $d^2(2 + 2 \times 8/32) = d^2(2 + 0.5) = 2.5d^2 = 2.5 \times 4096^2 = 41,943,040 \approx 42$M.

**(c)** Savings: $(67M - 42M)/67M = 37.5\%$.

But the main benefit is not parameter savings --- it is the $4\times$ reduction in KV cache memory.
</details>

### Exercise 8: Verify Understanding (Conceptual)

Answer each question in 1-2 sentences.

**(a)** Why can't we just use a larger $d_k$ instead of multiple heads?

**(b)** Why does FlashAttention save memory but not FLOPs?

**(c)** Why is the KV cache size independent of the number of query heads in GQA?

**(d)** Why does causal linear attention need a sequential loop while non-causal linear attention does not?

<details>
<summary><strong>Solution</strong></summary>

**(a)** Multiple heads allow the model to attend to different aspects of the input simultaneously (e.g., one head for syntax, another for semantics). A single large-$d_k$ head can only produce one attention pattern per layer, regardless of dimension.

**(b)** FlashAttention computes exactly the same mathematical operations as standard attention ($O(T^2d)$ FLOPs). It saves memory by not materializing the $T \times T$ attention matrix in HBM, instead computing it in blocks in fast SRAM and accumulating the output using online softmax.

**(c)** In GQA, all query heads within a group share the same $K$ and $V$. The KV cache stores $K, V$ for each *KV head*, not each query head. Since the number of KV heads is $g < h$, the cache size is $O(g)$, independent of $h$.

**(d)** In causal linear attention, the running statistics $S_t = \sum_{s \leq t} \phi(k_s) v_s^\top$ depend on the prefix up to position $t$. This requires processing positions in order (sequentially). In non-causal linear attention, $S = \sum_{s=1}^T \phi(k_s) v_s^\top$ is a single global sum that can be computed in one pass, then queried for all positions in parallel.
</details>

---

## Section 6: Summary of Key Formulas

| Quantity | Formula |
|:---------|:--------|
| Scaled dot-product attention | $\text{softmax}(QK^\top / \sqrt{d_k}) V$ |
| MHA FLOPs (per layer) | $8Td^2 + 4T^2d$ |
| FFN FLOPs (per layer) | $16Td^2$ ($d_{\text{ff}} = 4d$) |
| Attention-FFN crossover | $T^* = 2d$ |
| Total layer FLOPs | $24Td^2 + 4T^2d$ |
| KV cache memory | $2NhTd_k \cdot B \cdot \text{bytes}$ |
| GQA KV cache | $2NgTd_k \cdot B \cdot \text{bytes}$ (replace $h$ with $g$) |
| Linear attention FLOPs | $O(Tmd)$ where $m$ = feature dimension |
| FlashAttention memory | $O(T)$ (instead of $O(T^2)$) |
| FlashAttention FLOPs | $O(T^2d)$ (same as standard) |
