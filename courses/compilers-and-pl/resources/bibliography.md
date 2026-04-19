# Annotated Bibliography

## Foundational Textbooks

- **Aho, Lam, Sethi, Ullman. *Compilers: Principles, Techniques, and Tools* (2nd ed., 2006)**
  The "Dragon Book." Comprehensive reference for classical compiler construction. Strong on parsing theory and code generation.

- **Appel. *Modern Compiler Implementation in ML/Java/C* (1998)**
  Practical, project-oriented. Excellent treatment of SSA, register allocation, and functional language compilation.

- **Pierce. *Types and Programming Languages* (2002)**
  The standard reference for type systems. Covers simply typed lambda calculus through System F, subtyping, and recursive types.

- **Harper. *Practical Foundations for Programming Languages* (2nd ed., 2016)**
  Rigorous treatment of PL theory using judgments and derivations. Covers statics, dynamics, and advanced topics.

- **Sipser. *Introduction to the Theory of Computation* (3rd ed., 2012)**
  Clear exposition of automata, computability, and complexity. Essential background for Module 00.

- **Cooper & Torczon. *Engineering a Compiler* (3rd ed., 2022)**
  Practical compiler engineering with excellent coverage of optimization and code generation.

## Seminal Papers by Module

### Module 01: Lexical Analysis

- Thompson, K. (1968). "Programming Techniques: Regular Expression Search Algorithm." *CACM*.
- Hopcroft, J. (1971). "An $n \log n$ Algorithm for Minimizing States in a Finite Automaton."

### Module 02: Parsing

- Knuth, D. (1965). "On the Translation of Languages from Left to Right." *Information and Control*.
- Earley, J. (1970). "An Efficient Context-Free Parsing Algorithm." *CACM*.
- Ford, B. (2004). "Parsing Expression Grammars: A Recognition-Based Syntactic Foundation." *POPL*.

### Module 03: Semantic Analysis

- Milner, R. (1978). "A Theory of Type Polymorphism in Programming." *JCSS*.
- Damas, L. & Milner, R. (1982). "Principal Type-Schemes for Functional Programs." *POPL*.
- Cardelli, L. & Wegner, P. (1985). "On Understanding Types, Data Abstraction, and Polymorphism." *Computing Surveys*.

### Module 04: Type Theory & PL Foundations

- Church, A. (1936). "An Unsolvable Problem of Elementary Number Theory." *American Journal of Mathematics*.
- Plotkin, G. (1981). "A Structural Approach to Operational Semantics." Technical Report DAIMI FN-19.
- Howard, W. (1980). "The Formulae-as-Types Notion of Construction."
- Hoare, C.A.R. (1969). "An Axiomatic Basis for Computer Programming." *CACM*.

### Module 05: IR & SSA

- Cytron, R. et al. (1991). "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph." *TOPLAS*.
- Lattner, C. & Adve, V. (2004). "LLVM: A Compilation Framework for Lifelong Program Analysis & Transformation." *CGO*.
- Click, C. & Paleczny, M. (1995). "A Simple Graph-Based Intermediate Representation." *IR Workshop*.
- Lengauer, T. & Tarjan, R. (1979). "A Fast Algorithm for Finding Dominators in a Flowgraph." *TOPLAS*.

### Module 06: Code Generation

- Chaitin, G. et al. (1981). "Register Allocation via Coloring." *Computer Languages*.
- Briggs, P. et al. (1994). "Improvements to Graph Coloring Register Allocation." *TOPLAS*.
- Poletto, M. & Sarkar, V. (1999). "Linear Scan Register Allocation." *TOPLAS*.

### Module 07: Program Analysis

- Kildall, G. (1973). "A Unified Approach to Global Program Optimization." *POPL*.
- Andersen, L.O. (1994). "Program Analysis and Specialization for the C Programming Language." PhD thesis.
- Steensgaard, B. (1996). "Points-to Analysis in Almost Linear Time." *POPL*.
- Reps, T. et al. (1995). "Precise Interprocedural Dataflow Analysis via Graph Reachability." *POPL*.

### Module 08: Memory Management

- McCarthy, J. (1960). "Recursive Functions of Symbolic Expressions and Their Computation by Machine."
- Cheney, C.J. (1970). "A Nonrecursive List Compacting Algorithm." *CACM*.
- Jung, R. et al. (2017). "RustBelt: Securing the Foundations of the Rust Programming Language." *POPL*.
- Tofte, M. & Talpin, J.-P. (1997). "Region-Based Memory Management." *Information and Computation*.

### Module 09: PL Paradigms

- Wadler, P. (1992). "Monads for Functional Programming."
- Hoare, C.A.R. (1978). "Communicating Sequential Processes." *CACM*.
- Milner, R. (1999). *Communicating and Mobile Systems: the Pi-Calculus*.
- Robinson, J.A. (1965). "A Machine-Oriented Logic Based on the Resolution Principle." *JACM*.

### Module 10: Frontier Topics

- Leroy, X. (2009). "Formal Verification of a Realistic Compiler." *CACM*.
- Lopes, N. et al. (2021). "Alive2: Bounded Translation Validation for LLVM." *PLDI*.
- Trofin, M. et al. (2021). "MLGO: A Machine Learning Guided Compiler Optimizations Framework." *arXiv*.
- Plotkin, G. & Pretnar, M. (2009). "Handlers of Algebraic Effects." *ESOP*.

### Module 11: Formal Verification & SMT

- Davis, M. & Putnam, H. (1960). "A Computing Procedure for Quantification Theory." *JACM*.
- Davis, M., Logemann, G. & Loveland, D. (1962). "A Machine Program for Theorem-Proving." *CACM*.
- Marques-Silva, J. & Sakallah, K. (1999). "GRASP: A Search Algorithm for Propositional Satisfiability." *IEEE Trans. Computers*.
- Moskewicz, M. et al. (2001). "Chaff: Engineering an Efficient SAT Solver." *DAC*.
- Een, N. & Sorensson, N. (2003). "An Extensible SAT-solver." *SAT*.
- Nelson, G. & Oppen, D. (1979). "Simplification by Cooperating Decision Procedures." *TOPLAS*.
- Nieuwenhuis, R., Oliveras, A. & Tinelli, C. (2006). "Solving SAT and SAT Modulo Theories: From an Abstract Davis-Putnam-Logemann-Loveland Procedure to DPLL(T)." *JACM*.
- de Moura, L. & Bjorner, N. (2008). "Z3: An Efficient SMT Solver." *TACAS*.
- Barrett, C. et al. (2009). "Satisfiability Modulo Theories." *Handbook of Satisfiability*, Ch. 26.
- Cousot, P. & Cousot, R. (1977). "Abstract Interpretation: A Unified Lattice Model for Static Analysis of Programs." *POPL*.
- Cousot, P. & Cousot, R. (1979). "Systematic Design of Program Analysis Frameworks." *POPL*.
- Mine, A. (2006). "The Octagon Abstract Domain." *Higher-Order and Symbolic Computation*.
- Blanchet, B. et al. (2003). "A Static Analyzer for Large Safety-Critical Software." *PLDI*.
- King, J. (1976). "Symbolic Execution and Program Testing." *CACM*.
- Godefroid, P., Klarlund, N. & Sen, K. (2005). "DART: Directed Automated Random Testing." *PLDI*.
- Cadar, C., Dunbar, D. & Engler, D. (2008). "KLEE: Unassisted and Automatic Generation of High-Coverage Tests." *OSDI*.
- Clarke, E. et al. (2003). "Counterexample-Guided Abstraction Refinement for Symbolic Model Checking." *JACM*.
- Biere, A. et al. (1999). "Symbolic Model Checking without BDDs." *TACAS*.
- Ball, T. et al. (2011). "Decade of Software Model Checking with SLAM." *CACM*.
- Kroening, D. & Strichman, O. (2016). *Decision Procedures: An Algorithmic Point of View* (2nd ed.). Springer.
