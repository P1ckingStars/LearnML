# ClaudeUniversity

An open collection of rigorous, PhD-track courses built from first principles.

---

## Courses

| Course | Description | Duration |
|--------|-------------|----------|
| [Deep Learning](courses/deep-learning/README.md) | Theory, implementation, and frontiers of deep neural networks | 20 weeks |
| [ML Systems](courses/ml-systems/README.md) | From silicon to serving: hardware, compilers, distributed training, and production deployment | 20 weeks |
| [Compilers & Programming Languages](courses/compilers-and-pl/README.md) | Compiler construction, type theory, and PL design from first principles | 22 weeks |
| [Type Theory](courses/type-theory/README.md) | Foundations, systems, and frontiers of type theory | 20 weeks |
| [Formal Verification](courses/formal-verification/README.md) | Isabelle proof assistant: ZFC set theory formalization and C program verification | 20 weeks |

## Philosophy

- Full proofs and derivations, not hand-waving
- Build from scratch before using abstractions
- Connected to seminal research papers
- Research-oriented: read, replicate, and contribute

## Viewer

A Qt-based markdown book viewer with KaTeX math and syntax highlighting:

```bash
bazel run //viewer/qt:install -- ~/.local
mdbook-viewer courses/type-theory
```
