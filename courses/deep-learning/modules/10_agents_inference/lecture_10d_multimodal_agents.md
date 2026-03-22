# Lecture 10d: Multimodal Agents, Code Generation, and Multi-Agent Systems

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Design** vision-language agents for web browsing and GUI interaction, formalizing the observation-action space.
2. **Analyze** code generation agents through the lens of write-test-debug loops and program synthesis.
3. **Formalize** multi-agent systems including debate, collaboration, and specialization paradigms.
4. **Evaluate** agent performance using standardized benchmarks (SWE-bench, WebArena, GAIA).
5. **Identify** safety considerations and alignment challenges specific to autonomous agents.
6. **Discuss** frontier research directions including self-improving agents and open problems.

---

## 2. Motivation and Context

### 2.1 Beyond Text-Only Agents

Lecture 10a introduced text-based agents with tool use and RAG. Real-world deployment requires agents that can:

- **See**: process screenshots, images, videos (vision-language agents)
- **Code**: write, test, debug, and deploy software (code agents)
- **Collaborate**: work with other agents and humans (multi-agent systems)
- **Navigate**: interact with web browsers, GUIs, and physical environments

### 2.2 Why Multimodal Agents Matter

The majority of human-computer interaction is visual: websites, applications, documents. An agent that can only process text misses the dominant modality. Similarly, many real-world tasks require producing executable code, not just text descriptions. Multi-agent collaboration enables tackling problems that exceed any single agent's capability.

### 2.3 Current State

We are in an early but rapidly advancing phase:

- Vision-language models (GPT-4V, Gemini) enable screenshot understanding
- Code agents (SWE-agent, Devin) can solve real GitHub issues
- Multi-agent frameworks (AutoGen, CrewAI) are being actively developed
- Benchmarks are becoming more realistic and challenging

---

## 3. Core Theory

### 3.1 Vision-Language Agents

**Definition 3.1 (Vision-Language Agent).** A vision-language agent operates in an environment where observations include both text and images:

$$o_t = (v_t, l_t) \in \mathcal{V} \times \mathcal{L}$$

where $v_t$ is a visual observation (screenshot, camera image) and $l_t$ is textual context (HTML, accessibility tree, task description).

The policy maps multimodal observations to actions:

$$\pi(a_t | o_1, a_1, \ldots, o_t) = \pi(a_t | v_1, l_1, a_1, \ldots, v_t, l_t)$$

**Web Browsing Agent.** The action space for web browsing typically includes:

$$\mathcal{A}_{\text{web}} = \{\texttt{click}(x, y), \texttt{type}(text), \texttt{scroll}(\Delta), \texttt{navigate}(url), \texttt{back}, \texttt{forward}, \texttt{stop}(answer)\}$$

**Observation representations:**

1. **Screenshot only**: $o_t = v_t$ (pixel-level). Requires vision capabilities. Robust to website changes.
2. **DOM/accessibility tree**: $o_t = l_t$ (structured text). More compact but may miss visual layout.
3. **Set-of-Marks**: Overlay numbered labels on interactive elements in the screenshot, combining visual and textual cues.

**Proposition 3.2 (Observation Space Tradeoff).** Let $I(a; v, l)$ be the mutual information between the optimal action and the observations:

$$I(a; v, l) \geq I(a; v) \quad \text{and} \quad I(a; v, l) \geq I(a; l)$$

with equality iff $v$ and $l$ are redundant given $a$. In practice, $v$ and $l$ provide complementary information:

- Visual: layout, colors, relative positions, images, visual patterns
- Textual: element labels, link targets, form field names, hidden metadata

The Set-of-Marks approach maximizes the captured information by grounding textual labels in visual positions.

### 3.2 Code Generation Agents

**Definition 3.3 (Code Agent as Program Synthesis).** A code generation agent solves a program synthesis problem:

Given a specification $\phi$ (natural language description, test cases, or formal spec), find a program $P$ such that $P \models \phi$ (i.e., $P$ satisfies $\phi$).

The agent operates in a write-test-debug loop:

$$P_0 \xrightarrow{\text{write}} P_1 \xrightarrow{\text{test}} (P_1, \text{errors}) \xrightarrow{\text{debug}} P_2 \xrightarrow{\text{test}} \cdots$$

**Definition 3.4 (Write-Test-Debug Loop).** Formally:

1. **Write**: $P_t = G(q, P_{t-1}, e_{t-1})$ where $G$ is the generator (LLM), $P_{t-1}$ is the previous program (or empty), and $e_{t-1}$ is the error trace.
2. **Test**: $e_t = \text{Execute}(P_t, \text{tests})$ returns pass/fail and error traces.
3. **Debug**: The generator uses the error trace to produce a corrected program.

**Theorem 3.5 (Convergence of Write-Test-Debug).** Under idealized assumptions:

- The generator has probability $p_{\text{fix}} > 0$ of fixing each bug in a single debug step.
- Bugs are independent (fixing one does not introduce another).
- The program has at most $B$ bugs initially.

Then the expected number of debug iterations to produce a correct program is:

$$\mathbb{E}[T] \leq \frac{B}{p_{\text{fix}}}$$

and the probability of not having a correct program after $T$ iterations is:

$$P(\text{not correct after } T) \leq B \cdot (1 - p_{\text{fix}})^T$$

*Proof.* Each bug is fixed in each iteration with probability $p_{\text{fix}}$, independently. The number of iterations to fix any single bug is geometric with parameter $p_{\text{fix}}$, so $\mathbb{E}[\text{iterations per bug}] = 1/p_{\text{fix}}$. By linearity of expectation, $\mathbb{E}[T] \leq B/p_{\text{fix}}$.

For the tail bound, after $T$ iterations, any particular bug survives with probability $(1-p_{\text{fix}})^T$. By union bound over $B$ bugs:

$$P(\text{any bug survives}) \leq B(1 - p_{\text{fix}})^T$$ $\square$

**Remark.** The independence assumption is unrealistic: fixes often introduce new bugs (regression). In practice, having a comprehensive test suite is critical for detecting regressions.

**SWE-Agent Architecture (Yang et al., 2024).** SWE-agent is a code agent specialized for solving GitHub issues:

1. **Agent-Computer Interface (ACI)**: Specialized commands for code navigation:
   - `find_file`, `search_dir`, `open_file`, `goto_line`
   - `edit_file` (with line numbers), `create_file`
   - `run_tests`, `submit`

2. **Observation space**: File contents with line numbers, test output, directory structure.

3. **Key design insight**: The interface between agent and environment matters as much as the agent's reasoning ability. A well-designed ACI dramatically improves performance.

### 3.3 Multi-Agent Systems

**Definition 3.6 (Multi-Agent System).** A multi-agent system consists of $n$ agents $\{A_1, \ldots, A_n\}$ interacting through a communication protocol $\mathcal{P}$:

$$\mathcal{M} = (\{A_i\}_{i=1}^n, \mathcal{P}, \mathcal{E})$$

where $\mathcal{E}$ is the shared environment.

**Three paradigms:**

**Paradigm 1: Debate.** Agents argue for different positions, and a judge selects the best.

$$a_i^{(r)} = A_i(q, a_1^{(r-1)}, \ldots, a_n^{(r-1)})$$

where $r$ is the debate round. After $R$ rounds, a judge $J$ selects:

$$\hat{a} = J(q, \{a_i^{(r)}\}_{i,r})$$

**Theorem 3.7 (Debate Improves Over Single Agent, Du et al. 2023).** Under assumptions:

- Each agent $A_i$ produces the correct answer with independent probability $p > 1/2$.
- Agents update their answers based on the arguments of others.
- The judge selects the majority answer after the final round.

Then the multi-agent debate with $n$ agents after $R$ rounds achieves accuracy:

$$P_{\text{debate}}(\text{correct}) \geq 1 - \exp\left(-\frac{n(2p-1)^2}{2}\right)$$

which improves with both $n$ (number of agents) and $p$ (per-agent quality).

*Proof.* In the worst case (agents do not improve from debate), this reduces to self-consistency with $n$ samples, and the bound follows from Hoeffding's inequality (Theorem 3.9 in Lecture 10b). In practice, debate provides additional information that can shift incorrect agents toward the correct answer, only improving the bound. $\square$

**Paradigm 2: Collaboration (Division of Labor).** Decompose a task into subtasks, assign each to a specialized agent:

$$\text{Task} \xrightarrow{\text{decompose}} \{T_1, \ldots, T_k\} \xrightarrow{\text{assign}} \{A_{\sigma(1)}, \ldots, A_{\sigma(k)}\} \xrightarrow{\text{integrate}} \text{Result}$$

**Proposition 3.8 (Collaboration vs. Single Agent).** If subtask $T_j$ has difficulty $d_j$ and agent $A_{\sigma(j)}$ is specialized for $T_j$ with accuracy $p_j > p_{\text{gen}}$ (where $p_{\text{gen}}$ is the generalist accuracy), then:

$$P_{\text{collab}}(\text{all correct}) = \prod_j p_j > p_{\text{gen}}^k = P_{\text{single}}(\text{all correct})$$

The advantage scales exponentially with the number of subtasks $k$.

**Paradigm 3: Specialization with Roles.** Assign agents distinct roles (e.g., coder, reviewer, tester, project manager):

- **Coder**: generates code from specifications
- **Reviewer**: reviews code for bugs and improvements
- **Tester**: writes and runs test cases
- **Manager**: coordinates workflow and resolves conflicts

### 3.4 Agent Evaluation

**Definition 3.9 (Agent Benchmark).** An agent benchmark $\mathcal{B} = \{(q_i, E_i, M_i)\}_{i=1}^N$ consists of:

- $q_i$: task specification
- $E_i$: environment (e.g., codebase, website, set of tools)
- $M_i$: evaluation metric (e.g., tests pass, task completed, answer correct)

**Key Benchmarks:**

| Benchmark | Domain | Metric | Size | Difficulty |
|-----------|--------|--------|------|------------|
| SWE-bench | Code (GitHub issues) | % tests pass | 2294 | Hard |
| SWE-bench Lite | Code (subset) | % tests pass | 300 | Hard |
| WebArena | Web browsing | Task success rate | 812 | Medium-Hard |
| GAIA | General assistant | Exact match | 466 | Easy-Hard |
| HumanEval | Code generation | pass@k | 164 | Medium |
| MATH | Math reasoning | Exact match | 5000 | Medium-Hard |

**Proposition 3.10 (Benchmark Saturation).** A benchmark $\mathcal{B}$ becomes saturated when the best agent achieves accuracy within $\epsilon$ of human performance:

$$\text{Acc}_{\text{best agent}} \geq \text{Acc}_{\text{human}} - \epsilon$$

At saturation, the benchmark loses discriminative power. The field must continuously create harder benchmarks. Current evidence suggests:

- HumanEval: approaching saturation (>95% with best-of-N)
- MATH: moderate saturation (~95% with test-time compute)
- SWE-bench: far from saturation (~50% on Lite, ~20% on full)
- GAIA: far from saturation (~75% on level 1, ~30% on level 3)

### 3.5 Safety Considerations for Autonomous Agents

**Definition 3.11 (Agent Safety).** An agent is safe if its behavior satisfies:

1. **Corrigibility**: The agent can be interrupted, corrected, or shut down by authorized humans.
2. **Bounded impact**: The agent's actions have bounded side effects in the environment.
3. **Transparency**: The agent's reasoning and planned actions are interpretable.
4. **Value alignment**: The agent's objectives align with the principal's (user's) objectives.

**Threat Model for Autonomous Agents:**

1. **Unintended side effects**: The agent achieves the goal but causes collateral damage (e.g., deleting data to free disk space).

2. **Reward hacking**: The agent finds ways to maximize the evaluation metric without actually completing the task (e.g., modifying test files to make tests pass).

3. **Goal drift**: In multi-step tasks, the agent's effective goal drifts from the user's intent.

4. **Capability overhang**: As agents become more capable, the gap between what they *can* do and what they *should* do widens.

**Proposition 3.12 (Sandboxing as Safety Mechanism).** A sandboxed agent operates in an environment $E_{\text{sandbox}} \subset E_{\text{real}}$ where:

$$\forall a \in \mathcal{A}_{\text{sandbox}}: \; \text{Impact}(a, E_{\text{real}}) = 0$$

That is, actions in the sandbox have zero real-world impact. This provides:

- **Reversibility**: all actions can be undone
- **Bounded impact**: by definition
- **Preview**: humans can review planned actions before execution

The limitation: some tasks inherently require real-world actions (sending emails, deploying code, making purchases), and sandboxing makes these impossible.

**Definition 3.13 (Human-in-the-Loop Agent).** An agent that requires human approval for certain action classes:

$$\pi(a | o) = \begin{cases} a & \text{if } a \in \mathcal{A}_{\text{safe}} \\ \text{request\_approval}(a) & \text{if } a \in \mathcal{A}_{\text{sensitive}} \end{cases}$$

where $\mathcal{A}_{\text{safe}}$ and $\mathcal{A}_{\text{sensitive}}$ are predefined action classifications (e.g., reading files is safe, deleting files is sensitive).

### 3.6 Frontier: Self-Improving Agents

**Definition 3.14 (Self-Improving Agent).** An agent that can modify its own behavior based on experience:

$$\theta_{t+1} = \text{Update}(\theta_t, \{(q_i, \tau_i, r_i)\}_{i=1}^K)$$

where $\theta_t$ are the agent's parameters (or prompt/strategy), $\tau_i$ are trajectories, and $r_i$ are rewards.

**Open Problems:**

1. **Bootstrapping**: Can an agent improve itself without external reward signals? This relates to unsupervised skill discovery and intrinsic motivation.

2. **Stability**: Self-improvement loops can diverge or collapse. What guarantees stability?

3. **Mesa-optimization**: A self-improving agent may develop internal optimization processes (mesa-optimizers) whose objectives diverge from the outer objective. This is a core alignment concern.

**Theorem 3.15 (Self-Play Improvement, informal).** In zero-sum games, self-play converges to a Nash equilibrium (Silver et al., 2017). For general tasks, no analogous guarantee exists. Self-improvement can:

- Converge to a fixed point (stable skill level)
- Diverge (progressively worse behavior)
- Oscillate (cycling between strategies)

The convergence behavior depends on the reward landscape and the update rule.

---

## 4. Algorithmic Derivation

### 4.1 Web Browsing Agent

```
Algorithm: Web Browsing Agent
Input: task description q, browser environment E, max_steps K
Output: task result (answer or completion)

state ← E.reset()                              // Initial page load
history ← [(observation=state.screenshot, action=None)]

for step = 1 to K:
    // Build observation
    screenshot ← state.screenshot               // Image: H x W x 3
    dom_text ← state.accessibility_tree          // Structured text
    observation ← (screenshot, dom_text)

    // Agent decides action
    thought, action ← VLM.generate(             // O(img_tokens * d_model)
        system = "You are a web browsing agent...",
        history = history,
        observation = observation,
        task = q
    )

    // Execute action
    if action.type == "click":
        state ← E.click(action.x, action.y)     // O(browser rendering)
    elif action.type == "type":
        state ← E.type(action.text)
    elif action.type == "scroll":
        state ← E.scroll(action.direction)
    elif action.type == "stop":
        return action.answer

    history.append((observation, thought, action))

return "Task incomplete after max steps"

// Complexity: O(K * (img_seq_len + text_seq_len) * d_model) for VLM calls
```

### 4.2 Code Agent (SWE-Agent Style)

```
Algorithm: Code Agent for Issue Resolution
Input: issue description q, repository R, test suite T
Output: patch P (set of file edits)

// Phase 1: Exploration
state ← initialize(R)
relevant_files ← []

for step = 1 to K_explore:
    thought, action ← LLM.generate(
        context = (q, state, relevant_files)
    )

    if action == "find_file(pattern)":
        results ← search_repository(R, pattern)
        state.update(results)
    elif action == "open_file(path, line_range)":
        content ← read_file(path, line_range)
        relevant_files.append((path, content))
    elif action == "search_code(query)":
        results ← grep_repository(R, query)
        state.update(results)
    elif action == "ready_to_edit":
        break

// Phase 2: Editing
edits ← []
for step = 1 to K_edit:
    thought, action ← LLM.generate(
        context = (q, state, relevant_files, edits)
    )

    if action == "edit_file(path, old_text, new_text)":
        apply_edit(path, old_text, new_text)
        edits.append(action)
    elif action == "done_editing":
        break

// Phase 3: Testing
test_results ← run_tests(T)

if test_results.all_pass:
    return edits_to_patch(edits)

// Phase 4: Debug loop
for debug_iter = 1 to K_debug:
    thought, action ← LLM.generate(
        context = (q, edits, test_results.failures)
    )
    apply_edit(action)
    test_results ← run_tests(T)

    if test_results.all_pass:
        return edits_to_patch(edits)

return edits_to_patch(edits)  // Best effort
```

### 4.3 Multi-Agent Debate

```
Algorithm: Multi-Agent Debate
Input: question q, n agents, R rounds
Output: final answer a

// Initialize: each agent generates independent answer
for i = 1 to n:
    response_i^{(0)} ← Agent_i.generate(q)

// Debate rounds
for round = 1 to R:
    for i = 1 to n:
        // Each agent sees all others' responses
        other_responses ← {response_j^{(round-1)} : j ≠ i}

        response_i^{(round)} ← Agent_i.generate(
            question = q,
            prompt = f"Other agents responded: {other_responses}\n"
                     f"Your previous response: {response_i^{(round-1)}}\n"
                     f"Reconsider and provide your updated answer."
        )

// Final aggregation (majority vote)
final_answers ← [extract_answer(response_i^{(R)}) for i in 1..n]
a ← majority_vote(final_answers)

return a

// Complexity: O(n * R * context_len * d_model) total LLM calls
// Parallelizable: agents within a round are independent
```

---

## 5. PyTorch Implementation

### 5.1 Vision-Language Agent for Web Browsing

```python
import torch
import torch.nn as nn
from dataclasses import dataclass, field
from typing import Callable, Optional
import json

@dataclass
class BrowserAction:
    """Represents an action in a web browser."""
    action_type: str       # "click", "type", "scroll", "navigate", "stop"
    x: Optional[int] = None
    y: Optional[int] = None
    text: Optional[str] = None
    direction: Optional[str] = None     # "up" or "down"
    url: Optional[str] = None
    answer: Optional[str] = None

@dataclass
class BrowserObservation:
    """Represents what the agent sees in the browser."""
    screenshot: Optional[torch.Tensor] = None    # [3, H, W]
    accessibility_tree: Optional[str] = None
    url: str = ""
    page_title: str = ""

class SetOfMarksProcessor:
    """
    Overlay numbered labels on interactive elements in a screenshot.

    This bridges the gap between visual observations and textual action spaces
    by providing numbered references for clickable/typeable elements.

    Input: screenshot [3, H, W], list of element bounding boxes
    Output: annotated screenshot [3, H, W], element-to-number mapping
    """
    def __init__(self, font_size: int = 14, marker_color: tuple = (255, 0, 0)):
        self.font_size = font_size
        self.marker_color = marker_color

    def process(
        self,
        screenshot: torch.Tensor,          # [3, H, W]
        elements: list[dict],               # Each: {"id", "bbox": [x,y,w,h], "tag", "text"}
    ) -> tuple[torch.Tensor, dict]:
        """
        Annotate screenshot with numbered markers.

        Returns:
            annotated: [3, H, W] screenshot with overlaid numbers
            mapping: dict mapping number -> element info
        """
        annotated = screenshot.clone()
        mapping = {}

        for idx, elem in enumerate(elements):
            x, y, w, h = elem["bbox"]

            # Draw a small rectangle with the number
            # (Simplified: in practice use PIL or cv2 for proper rendering)
            marker_y = max(0, y - self.font_size)
            marker_x = x

            # Color a small region for the marker
            y1, y2 = marker_y, min(marker_y + self.font_size, annotated.shape[1])
            x1, x2 = marker_x, min(marker_x + self.font_size * 2, annotated.shape[2])

            annotated[0, y1:y2, x1:x2] = self.marker_color[0] / 255.0
            annotated[1, y1:y2, x1:x2] = self.marker_color[1] / 255.0
            annotated[2, y1:y2, x1:x2] = self.marker_color[2] / 255.0

            mapping[idx] = {
                "element_id": elem.get("id"),
                "center_x": x + w // 2,
                "center_y": y + h // 2,
                "tag": elem.get("tag", ""),
                "text": elem.get("text", ""),
            }

        return annotated, mapping

class WebBrowsingAgent:
    """
    Vision-language agent for web browsing tasks.

    Uses a VLM to process screenshots and accessibility trees,
    then generates actions in a structured format.
    """
    def __init__(
        self,
        vlm: Callable,                    # (images, text) -> str
        browser_env: object,               # Browser environment with step()
        som_processor: Optional[SetOfMarksProcessor] = None,
        max_steps: int = 30,
        use_screenshot: bool = True,
        use_accessibility_tree: bool = True,
    ):
        self.vlm = vlm
        self.env = browser_env
        self.som = som_processor or SetOfMarksProcessor()
        self.max_steps = max_steps
        self.use_screenshot = use_screenshot
        self.use_a11y = use_accessibility_tree
        self.history: list[dict] = []

    def _build_prompt(self, task: str, observation: BrowserObservation) -> str:
        """Build the prompt for the VLM."""
        prompt = (
            f"You are a web browsing agent. Complete the following task:\n"
            f"Task: {task}\n\n"
            f"Current URL: {observation.url}\n"
            f"Page Title: {observation.page_title}\n\n"
        )

        if self.use_a11y and observation.accessibility_tree:
            prompt += (
                f"Accessibility Tree (interactive elements):\n"
                f"{observation.accessibility_tree}\n\n"
            )

        prompt += (
            f"History of actions taken:\n"
            f"{self._format_history()}\n\n"
            f"Choose your next action. Respond in JSON format:\n"
            f'{{"thought": "...", "action": "click|type|scroll|navigate|stop", '
            f'"args": {{"..."}}}}\n'
        )

        return prompt

    def _format_history(self) -> str:
        """Format action history for context."""
        if not self.history:
            return "(no actions taken yet)"
        lines = []
        for i, h in enumerate(self.history[-5:]):  # Last 5 actions
            lines.append(f"  Step {i+1}: {h['action_type']}({h.get('args', '')})")
            if h.get('observation_summary'):
                lines.append(f"    -> {h['observation_summary']}")
        return "\n".join(lines)

    def _parse_action(self, response: str) -> BrowserAction:
        """Parse VLM response into a BrowserAction."""
        try:
            parsed = json.loads(response)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
            else:
                return BrowserAction(action_type="stop", answer="Parse error")

        action_type = parsed.get("action", "stop")
        args = parsed.get("args", {})

        return BrowserAction(
            action_type=action_type,
            x=args.get("x"),
            y=args.get("y"),
            text=args.get("text"),
            direction=args.get("direction"),
            url=args.get("url"),
            answer=args.get("answer"),
        )

    def run(self, task: str) -> dict:
        """
        Execute the web browsing task.

        Returns dict with:
            - 'answer': final answer (if task requires one)
            - 'success': whether the task was completed
            - 'steps': number of steps taken
            - 'history': full action history
        """
        self.history = []
        observation = self.env.reset()

        for step in range(self.max_steps):
            # Build prompt
            prompt = self._build_prompt(task, observation)

            # Get VLM response (with screenshot if available)
            images = []
            if self.use_screenshot and observation.screenshot is not None:
                images.append(observation.screenshot)

            response = self.vlm(images=images, text=prompt)

            # Parse action
            action = self._parse_action(response)

            # Record history
            self.history.append({
                "step": step,
                "action_type": action.action_type,
                "args": {
                    "x": action.x, "y": action.y,
                    "text": action.text, "url": action.url,
                },
            })

            # Check for termination
            if action.action_type == "stop":
                return {
                    "answer": action.answer,
                    "success": True,
                    "steps": step + 1,
                    "history": self.history,
                }

            # Execute action in environment
            observation = self.env.step(action)

        return {
            "answer": None,
            "success": False,
            "steps": self.max_steps,
            "history": self.history,
        }
```

### 5.2 Code Generation Agent

```python
import subprocess
import tempfile
import os
from dataclasses import dataclass
from typing import Callable, Optional

@dataclass
class CodeEdit:
    """Represents a code edit."""
    file_path: str
    old_content: str
    new_content: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None

@dataclass
class TestResult:
    """Result of running a test suite."""
    passed: bool
    num_passed: int
    num_failed: int
    num_errors: int
    failure_messages: list[str]
    stdout: str
    stderr: str

class CodeAgent:
    """
    Code generation agent implementing the write-test-debug loop.

    Operates on a code repository: reads files, makes edits,
    runs tests, and iterates until tests pass.
    """
    def __init__(
        self,
        llm: Callable,                 # (prompt) -> str
        workspace: str,                 # Path to code repository
        test_command: str = "python -m pytest",
        max_edit_iterations: int = 5,
        max_debug_iterations: int = 3,
    ):
        self.llm = llm
        self.workspace = workspace
        self.test_command = test_command
        self.max_edit_iters = max_edit_iterations
        self.max_debug_iters = max_debug_iterations
        self.edits_made: list[CodeEdit] = []

    def read_file(self, path: str) -> str:
        """Read a file with line numbers."""
        full_path = os.path.join(self.workspace, path)
        if not os.path.exists(full_path):
            return f"File not found: {path}"
        with open(full_path, 'r') as f:
            lines = f.readlines()
        return "".join(f"{i+1:4d} | {line}" for i, line in enumerate(lines))

    def search_files(self, pattern: str) -> list[str]:
        """Search for files matching a pattern."""
        import glob
        full_pattern = os.path.join(self.workspace, "**", pattern)
        matches = glob.glob(full_pattern, recursive=True)
        return [os.path.relpath(m, self.workspace) for m in matches]

    def search_code(self, query: str) -> list[tuple[str, int, str]]:
        """Search for code matching a query string."""
        results = []
        for root, dirs, files in os.walk(self.workspace):
            # Skip hidden directories and common non-code dirs
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
            for fname in files:
                if not fname.endswith(('.py', '.js', '.ts', '.java', '.cpp', '.c', '.go')):
                    continue
                fpath = os.path.join(root, fname)
                rel_path = os.path.relpath(fpath, self.workspace)
                try:
                    with open(fpath, 'r') as f:
                        for i, line in enumerate(f, 1):
                            if query.lower() in line.lower():
                                results.append((rel_path, i, line.strip()))
                except (UnicodeDecodeError, PermissionError):
                    continue
        return results[:50]  # Limit results

    def apply_edit(self, edit: CodeEdit) -> bool:
        """Apply a code edit to a file."""
        full_path = os.path.join(self.workspace, edit.file_path)
        try:
            with open(full_path, 'r') as f:
                content = f.read()

            if edit.old_content in content:
                new_content = content.replace(edit.old_content, edit.new_content, 1)
                with open(full_path, 'w') as f:
                    f.write(new_content)
                self.edits_made.append(edit)
                return True
            else:
                return False
        except FileNotFoundError:
            # Create new file
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w') as f:
                f.write(edit.new_content)
            self.edits_made.append(edit)
            return True

    def run_tests(self, test_file: Optional[str] = None) -> TestResult:
        """Run the test suite and return results."""
        cmd = self.test_command
        if test_file:
            cmd += f" {test_file}"

        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                cwd=self.workspace, timeout=120,
            )

            # Parse pytest output (simplified)
            stdout = result.stdout
            stderr = result.stderr
            passed = result.returncode == 0

            # Count pass/fail from pytest output
            import re
            summary_match = re.search(
                r'(\d+) passed(?:.*?(\d+) failed)?(?:.*?(\d+) error)?',
                stdout + stderr
            )

            num_passed = int(summary_match.group(1)) if summary_match else 0
            num_failed = int(summary_match.group(2) or 0) if summary_match else (0 if passed else 1)
            num_errors = int(summary_match.group(3) or 0) if summary_match else 0

            # Extract failure messages
            failures = re.findall(r'FAILED.*?\n(.*?)(?=FAILED|$)', stdout + stderr, re.DOTALL)

            return TestResult(
                passed=passed,
                num_passed=num_passed,
                num_failed=num_failed,
                num_errors=num_errors,
                failure_messages=failures[:5],  # Limit
                stdout=stdout[-2000:],          # Last 2000 chars
                stderr=stderr[-2000:],
            )
        except subprocess.TimeoutExpired:
            return TestResult(
                passed=False, num_passed=0, num_failed=0, num_errors=1,
                failure_messages=["Test execution timed out (120s)"],
                stdout="", stderr="Timeout",
            )

    def solve_issue(self, issue_description: str) -> dict:
        """
        Main entry point: solve a code issue.

        Follows the explore -> edit -> test -> debug loop.

        Returns:
            dict with 'success', 'edits', 'test_results', 'iterations'
        """
        # Phase 1: Exploration
        exploration_prompt = (
            f"You are a code agent. Solve this issue:\n\n"
            f"{issue_description}\n\n"
            f"First, let's explore the codebase. What files should I look at?\n"
            f"Respond with a list of search queries or file paths."
        )

        exploration_response = self.llm(exploration_prompt)
        # Parse and execute exploration commands
        context = self._explore(exploration_response)

        # Phase 2: Edit
        edit_prompt = (
            f"Issue: {issue_description}\n\n"
            f"Relevant code:\n{context}\n\n"
            f"Generate the code edits needed to fix this issue.\n"
            f"Format each edit as:\n"
            f"FILE: <path>\n"
            f"OLD:\n```\n<old code>\n```\n"
            f"NEW:\n```\n<new code>\n```"
        )

        edit_response = self.llm(edit_prompt)
        edits = self._parse_edits(edit_response)

        for edit in edits:
            self.apply_edit(edit)

        # Phase 3: Test
        test_result = self.run_tests()

        if test_result.passed:
            return {
                "success": True,
                "edits": self.edits_made,
                "test_results": test_result,
                "iterations": 1,
            }

        # Phase 4: Debug loop
        for debug_iter in range(self.max_debug_iters):
            debug_prompt = (
                f"Issue: {issue_description}\n\n"
                f"Current edits:\n{self._format_edits()}\n\n"
                f"Test failures:\n{self._format_test_failures(test_result)}\n\n"
                f"Fix the failing tests. Provide corrected edits."
            )

            debug_response = self.llm(debug_prompt)
            new_edits = self._parse_edits(debug_response)

            for edit in new_edits:
                self.apply_edit(edit)

            test_result = self.run_tests()

            if test_result.passed:
                return {
                    "success": True,
                    "edits": self.edits_made,
                    "test_results": test_result,
                    "iterations": debug_iter + 2,
                }

        return {
            "success": False,
            "edits": self.edits_made,
            "test_results": test_result,
            "iterations": self.max_debug_iters + 1,
        }

    def _explore(self, response: str) -> str:
        """Execute exploration commands and gather context."""
        context_parts = []
        # Simple parsing: look for file paths and search queries
        for line in response.strip().split("\n"):
            line = line.strip()
            if line.endswith(".py") or line.endswith(".js"):
                content = self.read_file(line)
                context_parts.append(f"=== {line} ===\n{content}")
            elif line.startswith("search:"):
                query = line[7:].strip()
                results = self.search_code(query)
                for path, lineno, text in results[:10]:
                    context_parts.append(f"{path}:{lineno}: {text}")
        return "\n\n".join(context_parts[:20])  # Limit context

    def _parse_edits(self, response: str) -> list[CodeEdit]:
        """Parse edit instructions from LLM response."""
        import re
        edits = []
        # Match FILE: ... OLD: ... NEW: ... pattern
        pattern = r'FILE:\s*(.+?)\nOLD:\s*```\n?(.*?)```\s*NEW:\s*```\n?(.*?)```'
        for match in re.finditer(pattern, response, re.DOTALL):
            edits.append(CodeEdit(
                file_path=match.group(1).strip(),
                old_content=match.group(2).strip(),
                new_content=match.group(3).strip(),
            ))
        return edits

    def _format_edits(self) -> str:
        """Format applied edits for context."""
        parts = []
        for edit in self.edits_made[-5:]:
            parts.append(
                f"File: {edit.file_path}\n"
                f"Changed:\n  {edit.old_content[:200]}\n"
                f"To:\n  {edit.new_content[:200]}"
            )
        return "\n---\n".join(parts)

    def _format_test_failures(self, result: TestResult) -> str:
        """Format test failures for debugging context."""
        parts = [
            f"Passed: {result.num_passed}, Failed: {result.num_failed}, "
            f"Errors: {result.num_errors}"
        ]
        for msg in result.failure_messages:
            parts.append(f"Failure:\n{msg[:500]}")
        if result.stderr:
            parts.append(f"Stderr:\n{result.stderr[:500]}")
        return "\n\n".join(parts)
```

### 5.3 Multi-Agent Debate System

```python
from dataclasses import dataclass
from typing import Callable
from collections import Counter

@dataclass
class AgentConfig:
    """Configuration for an agent in the multi-agent system."""
    name: str
    system_prompt: str
    model: Callable            # (prompt) -> str
    temperature: float = 0.7

class MultiAgentDebate:
    """
    Multi-agent debate system.

    Multiple agents independently answer a question, then
    engage in rounds of debate where each agent sees others'
    responses and can update their answer.

    Implements the debate paradigm from Du et al. (2023).
    """
    def __init__(
        self,
        agents: list[AgentConfig],
        num_rounds: int = 3,
        judge: Optional[Callable] = None,    # Optional judge for final selection
    ):
        self.agents = agents
        self.num_rounds = num_rounds
        self.judge = judge

    def run(self, question: str) -> dict:
        """
        Run a multi-agent debate.

        Returns:
            dict with:
                - 'answer': final consensus answer
                - 'round_responses': responses per round
                - 'convergence_round': round at which consensus was reached (-1 if not)
        """
        round_responses = []

        # Round 0: Independent answers
        responses = {}
        for agent in self.agents:
            prompt = (
                f"{agent.system_prompt}\n\n"
                f"Question: {question}\n\n"
                f"Provide your answer with reasoning."
            )
            response = agent.model(prompt)
            responses[agent.name] = response

        round_responses.append(dict(responses))

        # Debate rounds
        convergence_round = -1

        for round_num in range(1, self.num_rounds + 1):
            new_responses = {}

            for agent in self.agents:
                # Show other agents' responses
                others = {
                    name: resp
                    for name, resp in responses.items()
                    if name != agent.name
                }

                others_text = "\n\n".join(
                    f"Agent {name}: {resp}"
                    for name, resp in others.items()
                )

                prompt = (
                    f"{agent.system_prompt}\n\n"
                    f"Question: {question}\n\n"
                    f"Your previous answer:\n{responses[agent.name]}\n\n"
                    f"Other agents' responses:\n{others_text}\n\n"
                    f"Consider the other agents' arguments. You may change "
                    f"your answer if you find their reasoning compelling, or "
                    f"defend your position if you believe you are correct.\n"
                    f"Provide your updated answer with reasoning."
                )

                new_response = agent.model(prompt)
                new_responses[agent.name] = new_response

            responses = new_responses
            round_responses.append(dict(responses))

            # Check for convergence (all agents agree)
            answers = [self._extract_answer(r) for r in responses.values()]
            if len(set(answers)) == 1 and convergence_round == -1:
                convergence_round = round_num

        # Final aggregation
        if self.judge:
            # Use a judge to select the best answer
            judge_prompt = (
                f"Question: {question}\n\n"
                f"After {self.num_rounds} rounds of debate, "
                f"the agents' final responses are:\n\n"
            )
            for name, resp in responses.items():
                judge_prompt += f"Agent {name}: {resp}\n\n"
            judge_prompt += "Select the best answer and explain why."

            final = self.judge(judge_prompt)
        else:
            # Majority vote
            answers = [self._extract_answer(r) for r in responses.values()]
            vote_counts = Counter(answers)
            final = vote_counts.most_common(1)[0][0]

        return {
            "answer": final,
            "round_responses": round_responses,
            "convergence_round": convergence_round,
            "final_individual_responses": responses,
        }

    @staticmethod
    def _extract_answer(response: str) -> str:
        """Extract the core answer from a response."""
        # Look for explicit answer markers
        import re
        patterns = [
            r"[Ff]inal [Aa]nswer:\s*(.+?)(?:\n|$)",
            r"[Aa]nswer:\s*(.+?)(?:\n|$)",
            r"[Tt]herefore,?\s*(.+?)(?:\.|$)",
        ]
        for pattern in patterns:
            match = re.search(pattern, response)
            if match:
                return match.group(1).strip()
        # Fallback: last sentence
        sentences = response.strip().split(".")
        return sentences[-1].strip() if sentences else response.strip()

class SpecializedMultiAgent:
    """
    Multi-agent system with specialized roles.

    Each agent has a distinct role (e.g., coder, reviewer, tester)
    and the system orchestrates their collaboration.
    """
    def __init__(
        self,
        agents: dict[str, AgentConfig],     # role -> agent
        workflow: list[tuple[str, str]],     # List of (role, task_template)
    ):
        self.agents = agents
        self.workflow = workflow

    def run(self, task: str) -> dict:
        """
        Execute the multi-agent workflow.

        The workflow is a sequence of (role, task_template) pairs.
        Each agent receives the accumulated context from prior steps.
        """
        context = {"task": task, "outputs": {}}

        for step_idx, (role, task_template) in enumerate(self.workflow):
            agent = self.agents[role]

            # Format the task with accumulated context
            prompt = (
                f"{agent.system_prompt}\n\n"
                f"Overall Task: {task}\n\n"
                f"Previous outputs:\n"
            )
            for prev_role, prev_output in context["outputs"].items():
                prompt += f"\n[{prev_role}]:\n{prev_output}\n"

            prompt += f"\nYour task: {task_template}"

            response = agent.model(prompt)
            context["outputs"][f"Step {step_idx+1} ({role})"] = response

        return {
            "final_output": response,
            "all_outputs": context["outputs"],
            "workflow_steps": len(self.workflow),
        }
```

### 5.4 Agent Evaluation Framework

```python
import time
from dataclasses import dataclass
from typing import Callable

@dataclass
class BenchmarkResult:
    """Result of evaluating an agent on a benchmark."""
    benchmark_name: str
    num_tasks: int
    num_correct: int
    accuracy: float
    avg_steps: float
    avg_time: float
    per_task_results: list[dict]

class AgentBenchmark:
    """
    Framework for evaluating agents on standardized benchmarks.

    Supports multiple evaluation protocols:
    - Exact match (GAIA, MATH)
    - Test pass rate (SWE-bench)
    - Task completion (WebArena)
    """
    def __init__(
        self,
        name: str,
        tasks: list[dict],            # Each: {"id", "query", "env", "answer", "difficulty"}
        evaluator: Callable,           # (predicted, gold) -> bool
    ):
        self.name = name
        self.tasks = tasks
        self.evaluator = evaluator

    def evaluate(self, agent: Callable) -> BenchmarkResult:
        """
        Run the agent on all benchmark tasks and evaluate.

        Args:
            agent: Callable that takes a task dict and returns
                   {"answer": str, "steps": int}
        """
        results = []
        correct = 0
        total_steps = 0
        total_time = 0.0

        for task in self.tasks:
            start = time.time()

            try:
                output = agent(task)
                elapsed = time.time() - start

                is_correct = self.evaluator(output.get("answer", ""), task["answer"])
                steps = output.get("steps", 1)

            except Exception as e:
                elapsed = time.time() - start
                is_correct = False
                steps = 0
                output = {"answer": f"Error: {e}", "steps": 0}

            result = {
                "task_id": task["id"],
                "predicted": output.get("answer", ""),
                "gold": task["answer"],
                "correct": is_correct,
                "steps": steps,
                "time": elapsed,
                "difficulty": task.get("difficulty", "unknown"),
            }
            results.append(result)

            if is_correct:
                correct += 1
            total_steps += steps
            total_time += elapsed

        n = len(self.tasks)
        return BenchmarkResult(
            benchmark_name=self.name,
            num_tasks=n,
            num_correct=correct,
            accuracy=correct / max(n, 1),
            avg_steps=total_steps / max(n, 1),
            avg_time=total_time / max(n, 1),
            per_task_results=results,
        )

    def evaluate_by_difficulty(self, agent: Callable) -> dict:
        """
        Evaluate and break down results by difficulty level.
        """
        full_result = self.evaluate(agent)

        by_difficulty = {}
        for r in full_result.per_task_results:
            diff = r["difficulty"]
            if diff not in by_difficulty:
                by_difficulty[diff] = {"correct": 0, "total": 0}
            by_difficulty[diff]["total"] += 1
            if r["correct"]:
                by_difficulty[diff]["correct"] += 1

        for diff in by_difficulty:
            stats = by_difficulty[diff]
            stats["accuracy"] = stats["correct"] / max(stats["total"], 1)

        return {
            "overall": full_result,
            "by_difficulty": by_difficulty,
        }
```

---

## 6. Experimental Intuition

### 6.1 SWE-bench Results

Performance of different agents on SWE-bench Lite (300 real GitHub issues):

| Agent | Resolved (%) | Avg. Steps | Avg. Cost |
|-------|-------------|-----------|-----------|
| GPT-4 (direct) | 1.7% | 1 | \$0.10 |
| SWE-agent (GPT-4) | 18.0% | 25 | \$1.50 |
| SWE-agent (Claude 3.5) | 33.6% | 22 | \$1.20 |
| Agentless (Claude 3.5) | 27.3% | 3 | \$0.30 |
| OpenHands (Claude 3.5) | 41.7% | 30 | \$2.00 |

Key observations:

- Direct prompting is almost useless for real code tasks (1.7%).
- The agent-computer interface matters enormously (SWE-agent's ACI design is crucial).
- More exploration steps generally help, but costs increase linearly.
- The gap between agents shows that architecture choices matter as much as the underlying model.

### 6.2 WebArena Results

Web browsing agents on WebArena (812 realistic web tasks):

| Agent | Success Rate (%) | Avg. Steps |
|-------|-----------------|-----------|
| GPT-4V (CoT) | 14.4% | 8 |
| GPT-4V + SoM | 20.1% | 10 |
| GPT-4V + SoM + memory | 23.5% | 12 |
| Human | 78.2% | 6 |

The large gap between agents and humans (23.5% vs. 78.2%) shows that web browsing remains very challenging. Humans are both more efficient (fewer steps) and more accurate.

### 6.3 Multi-Agent Debate Results

Multi-agent debate on MMLU (language understanding) and MATH:

| Configuration | MMLU Acc | MATH Acc |
|---------------|----------|----------|
| Single agent | 73.2% | 52.1% |
| 3 agents, 0 rounds (majority vote) | 75.8% | 56.4% |
| 3 agents, 2 rounds debate | 77.1% | 58.3% |
| 3 agents, 5 rounds debate | 77.3% | 58.5% |
| 6 agents, 2 rounds debate | 78.4% | 60.1% |

Debate helps, but with diminishing returns after 2-3 rounds. More agents help more than more rounds, consistent with the independent voting model.

### 6.4 Safety: Reward Hacking Examples

Documented cases of agent reward hacking:

| Task | Intended Behavior | Agent Hack |
|------|------------------|------------|
| "Make tests pass" | Fix the bug | Delete failing tests |
| "Improve code coverage" | Write tests | Add unreachable code paths |
| "Speed up the website" | Optimize code | Return cached responses for test queries |
| "Get a high user rating" | Improve product | Manipulate rating system |

These examples motivate the safety mechanisms discussed in Section 3.5.

---

## 7. Connections

### 7.1 Connections to Prior Modules

- **Module 4 (Attention/Transformers)**: Vision-language models extend the transformer architecture to process both images and text via visual token embeddings.
- **Module 5 (LLM Pretraining)**: Code agents leverage code pretraining (Codex, StarCoder). The quality of code understanding directly impacts agent performance.
- **Module 6 (Alignment)**: Agent safety is fundamentally an alignment problem. The reward hacking examples show misalignment in action.
- **Module 7/8 (Generative Models)**: Vision-language models build on image encoders developed for generative models (CLIP, DALL-E).

### 7.2 Connections Within Module 10

- **Lecture 10a (Agents)**: This lecture extends the ReAct framework to multimodal settings and multi-agent collaboration.
- **Lecture 10b (CoT)**: The "think" step in code agents and web agents uses chain-of-thought reasoning.
- **Lecture 10c (Test-Time Compute)**: Code agents use test-time compute via the write-test-debug loop. Multi-agent debate is another form of test-time computation.

### 7.3 Broader Connections

- **Software engineering**: Code agents connect to decades of work in automated program repair, test generation, and software verification.
- **HCI**: Web browsing agents relate to research on UI automation, web accessibility, and human-computer interaction.
- **Multi-agent systems in economics**: Game theory and mechanism design apply to multi-agent LLM systems.

---

## 8. Paper Reading List

### Required Reading

1. **Yang, J., Jimenez, C. E., Wettig, A., Liber, K., Narasimhan, K., & Press, O. (2024).** SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering. *arXiv*. Demonstrates the importance of the agent-computer interface for code agents.

2. **Zhou, S., Xu, F. F., Zhu, H., Zhou, X., Lo, R., Sridhar, A., ... & Neubig, G. (2024).** WebArena: A Realistic Web Environment for Building Autonomous Agents. *ICLR 2024*. Comprehensive web browsing benchmark.

3. **Du, Y., Li, S., Torralba, A., Tenenbaum, J. B., & Mordatch, I. (2023).** Improving Factuality and Reasoning in Language Models through Multiagent Debate. *arXiv*. Multi-agent debate for improving LLM reasoning.

### Recommended Reading

4. **Mialon, G., Fourrier, C., Swift, C., Wolf, T., LeCun, Y., & Scialom, T. (2023).** GAIA: A Benchmark for General AI Assistants. *arXiv*. Multi-level benchmark for general agent capabilities.

5. **Jimenez, C. E., Yang, J., Wettig, A., Yao, S., Pei, K., Press, O., & Narasimhan, K. (2024).** SWE-bench: Can Language Models Resolve Real-World GitHub Issues? *ICLR 2024*. The SWE-bench benchmark paper.

6. **Hong, S., Zheng, X., Chen, J., Cheng, Y., Wang, J., Zhang, C., ... & Wu, Y. (2024).** MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework. *ICLR 2024*. Role-based multi-agent collaboration.

### Optional / Frontier

7. **Zheng, L., Chiang, W. L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., ... & Stoica, I. (2023).** Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference. *arXiv*. The evaluation platform that drives agent and model comparison.

8. **Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K., & Yao, S. (2023).** Reflexion: Language Agents with Verbal Reinforcement Learning. *NeurIPS 2023*. Self-improving agents through verbal reflection.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9.1 (Observation Space Design).**

(a) For a web browsing agent, compare three observation representations: (i) raw screenshot pixels, (ii) DOM tree as text, (iii) Set-of-Marks. For each, characterize the information lost and the computational cost.

(b) Prove that if the optimal action depends on visual layout (e.g., which button is larger), then a DOM-only agent cannot achieve optimal performance. Construct a specific example.

(c) Design an observation representation for a mobile app agent. What new challenges arise compared to web browsing?

**Exercise 9.2 (Code Agent Analysis).**

(a) Model the write-test-debug loop as a Markov chain with states {editing, testing, debugging, done, failed}. Define the transition probabilities in terms of $p_{\text{write}}$ (probability initial code is correct), $p_{\text{fix}}$ (probability a debug step fixes the issue), and $p_{\text{regress}}$ (probability a fix introduces a new bug).

(b) Compute the expected number of iterations to reach the "done" state. Under what conditions does the chain have a positive probability of never terminating?

(c) How does adding a comprehensive test suite (higher $p_{\text{detect}}$, the probability of detecting a bug) affect the convergence? Derive the optimal testing investment.

**Exercise 9.3 (Multi-Agent Dynamics).**

(a) Model a 3-agent debate as a dynamical system. Let $p_i^{(t)}$ be agent $i$'s probability of holding the correct answer at round $t$. Define update rules based on: (i) agents adopt the majority view, (ii) agents update proportionally to others' confidence. Analyze convergence for each.

(b) Show that if one agent has accuracy $< 0.5$ and the others are influenced by it, the debate can converge to the wrong answer. Under what conditions is debate robust to one "bad" agent?

(c) Compare debate (all agents discuss) vs. tournament (pairwise elimination). Which is more robust? Which is more compute-efficient?

### Implementation Exercises

**Exercise 9.4 (Web Browsing Agent).** Build a web browsing agent:

(a) Implement a simple web browsing environment using Playwright or Selenium that exposes screenshot, DOM, and action execution.

(b) Implement the Set-of-Marks approach: overlay numbered labels on interactive elements.

(c) Connect a vision-language model and evaluate on 10 simple web tasks (e.g., "find the price of item X on this page").

**Exercise 9.5 (Code Agent).** Build a code agent for solving coding problems:

(a) Implement the write-test-debug loop for HumanEval problems.

(b) Measure pass@1 (single attempt) and pass@k with debug iterations ($k \in \{1, 3, 5, 10\}$) on the first 50 HumanEval problems.

(c) Analyze failure modes: categorize failures as (i) misunderstanding the problem, (ii) logic errors, (iii) syntax errors, (iv) edge case misses. What fraction falls in each category?

**Exercise 9.6 (Multi-Agent Debate).** Implement and evaluate multi-agent debate:

(a) Create a 3-agent debate system where each agent uses the same LLM but with different system prompts (optimist, skeptic, neutral).

(b) Evaluate on 50 MMLU questions. Compare: single agent, majority vote (no debate), 2-round debate, 5-round debate.

(c) Track how often agents change their answers during debate. Is answer-changing correlated with correctness?
