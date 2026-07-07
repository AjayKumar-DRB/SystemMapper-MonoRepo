# SystemMapper — Risk Engine

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Constraints](#2-design-constraints)
3. [Strategy Pattern Architecture](#3-strategy-pattern-architecture)
4. [Strategy Interfaces](#4-strategy-interfaces)
5. [Strategy Implementations](#5-strategy-implementations)
6. [Risk Scoring Algorithm](#6-risk-scoring-algorithm)
7. [Extension Points](#7-extension-points)
8. [Testing Strategy](#8-testing-strategy)
9. [Data Contracts](#9-data-contracts)

---

## 1. Overview

The `@systemmapper/risk-engine` is the **core intellectual property** of SystemMapper. It is a pure TypeScript package that implements deterministic risk analysis for code changes. Given a dependency graph and a set of changed files, it produces a comprehensive risk report covering blast radius, dependency depth, circular dependencies, architecture violations, critical paths, and an aggregate risk score.

### 1.1 Core Principle: Determinism

The risk engine guarantees: **identical inputs always produce identical outputs.** There are no random elements, no probabilistic models, no LLM calls, and no external state. This makes every risk calculation:

- **Auditable:** Scores can be explained by tracing the algorithm step by step.
- **Reproducible:** Running the same analysis twice produces the same report.
- **Testable:** Every strategy can be unit tested with fixture data.
- **Trustworthy:** Developers can rely on scores because they are transparent and consistent.

---

## 2. Design Constraints

| Constraint | Rationale |
|-----------|-----------|
| **Zero framework dependencies** | No NestJS, no Express, no HTTP. Pure TypeScript. |
| **Zero database dependencies** | No Prisma, no Neo4j driver, no Redis. |
| **Zero I/O** | No file system access, no network calls, no environment variables. |
| **Only `@systemmapper/types`** | The single allowed internal dependency. |
| **Zero external runtime dependencies** | No npm packages at runtime. Dev dependencies (testing) are allowed. |
| **Pure functions** | All strategies are stateless. Input → Output, no side effects. |
| **Synchronous** | All computations are synchronous. No async, no promises, no callbacks. |

These constraints ensure the risk engine can be:

- Used in any context (server, worker, CLI, browser, test)
- Tested without mocks
- Understood without framework knowledge
- Maintained independently of the rest of the system

---

## 3. Strategy Pattern Architecture

### 3.1 Pattern Overview

The risk engine uses the **Strategy Pattern** to decompose risk analysis into independent, composable strategies. Each strategy analyzes one aspect of risk and produces a typed result. The `RiskEngine` orchestrator runs all registered strategies and aggregates their results into a final `RiskReport`.

```
                 ┌────────────────────┐
                 │    RiskEngine      │
                 │   (Orchestrator)   │
                 └────────┬───────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐  ┌──────▼──────┐  ┌────▼──────┐
    │  Blast    │  │ Dependency  │  │ Circular  │
    │  Radius   │  │ Analysis    │  │ Dependency│
    │  Strategy │  │ Strategy    │  │ Strategy  │
    └───────────┘  └─────────────┘  └───────────┘
          │               │               │
    ┌─────▼─────┐  ┌──────▼──────┐  ┌────▼──────┐
    │Architecture│  │ Critical   │  │ Reviewer  │
    │ Violation  │  │ Path       │  │ Suggestion│
    │ Strategy   │  │ Strategy   │  │ Strategy  │
    └───────────┘  └─────────────┘  └───────────┘
          │
    ┌─────▼─────┐
    │   Risk    │
    │  Scoring  │
    │  Strategy │
    └───────────┘
```

### 3.2 Execution Flow

1. **Caller** provides `RiskAnalysisInput` (changed files, dependency graph, repository metrics).
2. **RiskEngine** iterates over registered strategies in order.
3. Each **Strategy** receives the input and the results of previous strategies.
4. Each **Strategy** returns a typed result.
5. **RiskScoringStrategy** runs last, aggregating all strategy results into a final score.
6. **RiskEngine** assembles all strategy results into a `RiskReport`.

### 3.3 Strategy Registration

Strategies are registered via constructor injection:

```
const engine = new RiskEngine([
  new BlastRadiusStrategy(),
  new DependencyAnalysisStrategy(),
  new CircularDependencyStrategy(),
  new ArchitectureViolationStrategy(),
  new CriticalPathStrategy(),
  new ReviewerSuggestionStrategy(),
  new RiskScoringStrategy(),  // Must be last
]);
```

Strategies execute in registration order. `RiskScoringStrategy` must be last because it depends on all other strategy outputs.

---

## 4. Strategy Interfaces

### 4.1 `IRiskStrategy<TResult>`

The base interface for all strategies:

| Member | Type | Description |
|--------|------|-------------|
| `name` | string | Unique strategy identifier |
| `description` | string | Human-readable description |
| `analyze(input: RiskAnalysisInput, context: StrategyContext)` | TResult | Execute the analysis |

### 4.2 `RiskAnalysisInput`

The input provided to all strategies:

| Field | Type | Description |
|-------|------|-------------|
| `repositoryId` | string | Repository identifier |
| `changedFiles` | ChangedFile[] | Files changed in the PR |
| `dependencyGraph` | DependencyGraphData | Serialized dependency graph |
| `repositoryMetrics` | RepositoryMetrics? | Optional current metrics |
| `options` | AnalysisOptions | Configurable analysis parameters |

### 4.3 `ChangedFile`

| Field | Type | Description |
|-------|------|-------------|
| `filePath` | string | File path relative to repo root |
| `status` | "added" \| "modified" \| "removed" \| "renamed" | Change type |
| `additions` | number | Lines added |
| `deletions` | number | Lines deleted |
| `previousPath` | string? | Previous path if renamed |

### 4.4 `DependencyGraphData`

A serialized, in-memory representation of the dependency graph:

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | GraphNode[] | All nodes in the graph |
| `edges` | GraphEdge[] | All edges (relationships) |
| `fileIndex` | Map<string, GraphNode> | File path → node lookup |
| `adjacencyList` | Map<string, string[]> | Node ID → dependent node IDs |
| `reverseAdjacencyList` | Map<string, string[]> | Node ID → dependency node IDs |

### 4.5 `StrategyContext`

Accumulates results from previous strategies:

| Field | Type | Description |
|-------|------|-------------|
| `previousResults` | Map<string, unknown> | Strategy name → result map |
| `getResult<T>(strategyName: string)` | T? | Type-safe result accessor |

### 4.6 `AnalysisOptions`

Configurable parameters:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxTraversalDepth` | number | 5 | Maximum hops for blast radius |
| `decayFactor` | number | 0.7 | Weight decay per hop |
| `criticalFilePatterns` | string[] | ["**/index.*", "**/main.*"] | Files with higher risk weight |
| `architectureRules` | ArchitectureRule[] | [] | Custom architecture rules |
| `reviewerSuggestionLimit` | number | 3 | Max suggested reviewers |

---

## 5. Strategy Implementations

### 5.1 Blast Radius Strategy

**Purpose:** Calculate the set of components transitively affected by the changed files.

**Algorithm:**

1. For each changed file, find its node in the graph.
2. Perform BFS traversal along reverse dependency edges (who depends on me?).
3. Track each affected node with its distance from the changed file.
4. Apply decay factor: `weight = decayFactor ^ distance`.
5. Cap traversal at `maxTraversalDepth`.
6. Aggregate results, deduplicating nodes reached via multiple paths (keep shortest distance).

**Output: `BlastRadiusResult`**

| Field | Type | Description |
|-------|------|-------------|
| `affectedFiles` | AffectedFile[] | Files in the blast radius |
| `affectedFunctions` | AffectedFunction[] | Functions in the blast radius |
| `affectedClasses` | AffectedClass[] | Classes in the blast radius |
| `totalAffectedNodes` | number | Total unique affected nodes |
| `maxDepth` | number | Deepest dependency chain reached |
| `dependencyChains` | DependencyChain[] | Top N longest chains |

### 5.2 Dependency Analysis Strategy

**Purpose:** Analyze the dependency structure of the changed files.

**Algorithm:**

1. For each changed file, count direct dependencies (imports) and dependents (importers).
2. Calculate fan-in (how many files depend on this file) and fan-out (how many files this file depends on).
3. Identify high-coupling files (fan-in + fan-out above threshold).
4. Calculate average dependency depth across changed files.

**Output: `DependencyAnalysisResult`**

| Field | Type | Description |
|-------|------|-------------|
| `directDependencies` | number | Direct import count |
| `directDependents` | number | Files that import changed files |
| `averageFanIn` | number | Average files depending on each changed file |
| `averageFanOut` | number | Average dependencies per changed file |
| `maxFanIn` | number | Highest fan-in |
| `maxFanOut` | number | Highest fan-out |
| `highCouplingFiles` | string[] | Files with coupling above threshold |

### 5.3 Architecture Violation Strategy

**Purpose:** Detect architecture rule violations introduced by the changes.

**Algorithm:**

1. Load architecture rules from `AnalysisOptions`.
2. For each changed file, check if any new imports violate the rules.
3. Rules are defined as forbidden import patterns (e.g., domain layer must not import from infrastructure).
4. Check for layer violation, circular dependency introduction, and forbidden module access.

**Output: `ArchitectureViolationResult`**

| Field | Type | Description |
|-------|------|-------------|
| `violations` | Violation[] | List of detected violations |
| `violationCount` | number | Total violation count |
| `violationsByRule` | Map<string, Violation[]> | Violations grouped by rule |
| `severity` | "none" \| "warning" \| "error" | Overall severity |

### 5.4 Circular Dependency Strategy

**Purpose:** Detect circular dependencies involving the changed files.

**Algorithm:**

1. Extract the subgraph containing changed files and their transitive dependencies.
2. Run Tarjan's SCC algorithm on the subgraph.
3. Any SCC with size > 1 is a circular dependency.
4. Check if any changed file is part of an existing or newly introduced cycle.
5. Report all cycles with their member files.

**Output: `CircularDependencyResult`**

| Field | Type | Description |
|-------|------|-------------|
| `cycles` | Cycle[] | Detected circular dependency cycles |
| `cycleCount` | number | Total number of cycles |
| `changedFilesInCycles` | string[] | Changed files participating in cycles |
| `newCyclesIntroduced` | boolean | Whether the changes introduce new cycles |

### 5.5 Critical Path Strategy

**Purpose:** Identify whether the changed files are on the critical path (longest dependency chain) of the repository.

**Algorithm:**

1. Find the longest dependency chain in the graph (topological sort + longest path).
2. Check if any changed files are on this path.
3. Changed files on the critical path increase risk because they affect the most deeply nested dependencies.

**Output: `CriticalPathResult`**

| Field | Type | Description |
|-------|------|-------------|
| `criticalPaths` | string[][] | The critical path(s) |
| `changedFilesOnCriticalPath` | string[] | Changed files on the critical path |
| `criticalPathLength` | number | Length of the longest path |
| `isOnCriticalPath` | boolean | Whether any changed file is on the critical path |

### 5.6 Reviewer Suggestion Strategy

**Purpose:** Suggest code reviewers based on file ownership patterns.

**Algorithm:**

1. For each affected file (from blast radius), look up its ownership data.
2. Ownership is determined by:
   a. Most recent modifier (from commit history in the graph data)
   b. Most frequent modifier (highest commit count)
   c. Directory-level ownership patterns
3. Rank potential reviewers by their coverage of affected files.
4. Return top N reviewers.

**Output: `ReviewerSuggestionResult`**

| Field | Type | Description |
|-------|------|-------------|
| `suggestedReviewers` | SuggestedReviewer[] | Ranked reviewer list |
| `coverageByReviewer` | Map<string, string[]> | Reviewer → covered files |

### 5.7 Risk Scoring Strategy

**Purpose:** Aggregate all strategy results into a final risk score (0-100).

**Algorithm (Weighted Sum):**

```
riskScore =
  (blastRadiusScore × 0.30) +
  (dependencyScore × 0.20) +
  (circularDependencyScore × 0.15) +
  (architectureViolationScore × 0.15) +
  (criticalPathScore × 0.10) +
  (changeSizeScore × 0.10)
```

**Sub-scores:**

| Sub-score | Calculation |
|-----------|------------|
| `blastRadiusScore` | `min(100, totalAffectedNodes × 2)` |
| `dependencyScore` | `min(100, maxFanIn × 5 + maxFanOut × 3)` |
| `circularDependencyScore` | `cycleCount > 0 ? min(100, cycleCount × 25) : 0` |
| `architectureViolationScore` | `violationCount > 0 ? min(100, violationCount × 20) : 0` |
| `criticalPathScore` | `isOnCriticalPath ? 50 + (changedFilesOnCriticalPath.length × 10) : 0` |
| `changeSizeScore` | `min(100, totalLinesChanged / 10)` |

**Risk Level Classification:**

| Score Range | Level | Description |
|-------------|-------|-------------|
| 0–25 | `LOW` | Safe to merge with minimal review |
| 26–50 | `MEDIUM` | Moderate risk, standard review recommended |
| 51–75 | `HIGH` | Significant risk, thorough review required |
| 76–100 | `CRITICAL` | Extensive impact, senior reviewer recommended |

**Output: `RiskScoringResult`**

| Field | Type | Description |
|-------|------|-------------|
| `overallScore` | number | Final risk score (0-100) |
| `riskLevel` | RiskLevel | Classified risk level |
| `subScores` | SubScore[] | Individual component scores |
| `weights` | Map<string, number> | Weight applied to each sub-score |
| `explanation` | string | Human-readable score explanation |

---

## 6. Risk Scoring Algorithm

### 6.1 Weight Configuration

Default weights are hardcoded but can be overridden via `AnalysisOptions`:

| Component | Default Weight | Rationale |
|-----------|---------------|-----------|
| Blast Radius | 0.30 | Highest weight — direct measure of downstream impact |
| Dependency Coupling | 0.20 | High coupling increases change propagation risk |
| Circular Dependencies | 0.15 | Cycles create unpredictable cascading effects |
| Architecture Violations | 0.15 | Violations indicate structural degradation |
| Critical Path | 0.10 | Critical path changes have outsized impact |
| Change Size | 0.10 | Larger changes are statistically riskier |

### 6.2 Score Normalization

All sub-scores are normalized to the 0-100 range before weighting. The normalization functions use `min(100, ...)` to cap at 100, preventing any single factor from dominating.

### 6.3 Determinism Guarantee

The scoring algorithm is deterministic because:

1. All inputs are deterministic (graph data from Memgraph, changed files from GitHub).
2. All traversal algorithms (BFS, Tarjan's SCC) are deterministic for a given graph.
3. Weights are fixed constants.
4. No randomization, sampling, or probabilistic techniques are used.
5. Floating point arithmetic is deterministic for the same inputs on the same platform.

---

## 7. Extension Points

### 7.1 Custom Strategies

New strategies can be added by implementing the `IRiskStrategy` interface:

1. Define the strategy class implementing `IRiskStrategy<TResult>`.
2. Define the result type `TResult`.
3. Register the strategy in the `RiskEngine` constructor (before `RiskScoringStrategy`).
4. Update `RiskScoringStrategy` to incorporate the new strategy's result.

### 7.2 Future AI Explanation Strategy

The architecture explicitly supports a future `AIExplanationStrategy`:

1. It would implement `IRiskStrategy<AIExplanationResult>`.
2. It would receive the `StrategyContext` containing all deterministic analysis results.
3. It would call an LLM to generate natural language explanations of the risk analysis.
4. It would be **optional** — registered only when AI features are enabled.
5. It would NOT affect the risk score — only add explanatory text.

**Interface:**

| Member | Description |
|--------|-------------|
| `name` | `"ai-explanation"` |
| `analyze(input, context)` | Takes deterministic results, returns `AIExplanationResult` |

**AIExplanationResult:**

| Field | Type | Description |
|-------|------|-------------|
| `summary` | string | Natural language summary of the risk |
| `recommendations` | string[] | Suggested actions |
| `affectedAreaDescriptions` | Map<string, string> | Per-area explanations |
| `confidence` | number | LLM confidence score |
| `modelUsed` | string | Which LLM model was used |

### 7.3 Custom Architecture Rules

Users can define custom architecture rules that are checked by the `ArchitectureViolationStrategy`:

| Rule Type | Description |
|-----------|-------------|
| `LayerViolation` | Define allowed dependency directions between layers |
| `ForbiddenImport` | Forbid specific import patterns |
| `ModuleBoundary` | Define module boundaries that cannot be crossed |
| `MaxFanOut` | Maximum allowed fan-out per file |
| `MaxFileSize` | Maximum allowed lines per file |

---

## 8. Testing Strategy

### 8.1 Unit Testing Approach

Since the risk engine has zero dependencies, testing is trivially simple:

1. **Create fixture data:** In-memory `DependencyGraphData` objects.
2. **Call strategy.analyze():** Pass the fixture data.
3. **Assert on the result:** Verify scores, affected files, violation counts.

No mocks, no stubs, no test databases, no Docker containers. Pure input → output testing.

### 8.2 Test Categories

| Category | What It Tests | Fixture Type |
|----------|--------------|-------------|
| **Blast Radius** | Traversal depth, decay, affected files | Small graphs (10-50 nodes) |
| **Dependency Analysis** | Fan-in/fan-out, coupling detection | Small graphs |
| **Circular Dependencies** | Cycle detection, SCC algorithm | Graphs with known cycles |
| **Architecture Violations** | Rule matching, violation detection | Graphs with known violations |
| **Critical Path** | Longest path identification | DAGs with known critical paths |
| **Reviewer Suggestion** | Ownership resolution, ranking | Graphs with ownership metadata |
| **Risk Scoring** | Weight application, score ranges, normalization | Combined strategy results |
| **Integration** | Full engine run, end-to-end analysis | Large realistic graphs |

### 8.3 Property-Based Testing

The risk engine is well-suited for property-based testing:

| Property | Description |
|----------|-------------|
| **Score range** | `0 <= riskScore <= 100` for all valid inputs |
| **Monotonicity** | More changed files → equal or higher risk score |
| **Determinism** | Same input → same output, always |
| **Empty input** | No changed files → risk score of 0 |
| **Isolated changes** | File with no dependents → blast radius of 1 |
| **Symmetry** | Circular dependency A→B→A detected regardless of which file changed |

### 8.4 Snapshot Testing

Risk reports can be snapshot tested:

1. Create a known graph fixture.
2. Run the risk engine.
3. Snapshot the complete `RiskReport` as JSON.
4. On subsequent runs, compare against the snapshot.
5. Any change in the report requires explicit snapshot update.

---

## 9. Data Contracts

### 9.1 Input Contract

The risk engine receives data that has been serialized from Memgraph and PostgreSQL. The caller (worker or API) is responsible for:

1. Querying Memgraph for the dependency graph and serializing it into `DependencyGraphData`.
2. Querying GitHub for changed files and formatting them as `ChangedFile[]`.
3. Optionally querying PostgreSQL for current `RepositoryMetrics`.
4. Passing all data to the `RiskEngine.analyze()` method.

### 9.2 Output Contract

The `RiskReport` output is a complete, self-contained result:

| Field | Type | Description |
|-------|------|-------------|
| `repositoryId` | string | Repository analyzed |
| `analyzedAt` | string (ISO 8601) | Timestamp of analysis |
| `riskScore` | number | Overall score (0-100) |
| `riskLevel` | RiskLevel | Classified level |
| `blastRadius` | BlastRadiusResult | Blast radius details |
| `dependencyAnalysis` | DependencyAnalysisResult | Dependency details |
| `circularDependencies` | CircularDependencyResult | Cycle details |
| `architectureViolations` | ArchitectureViolationResult | Violation details |
| `criticalPath` | CriticalPathResult | Critical path details |
| `reviewerSuggestions` | ReviewerSuggestionResult | Suggested reviewers |
| `scoring` | RiskScoringResult | Score breakdown |
| `changedFiles` | ChangedFile[] | Input changed files |
| `options` | AnalysisOptions | Options used for this analysis |

The caller stores this report in PostgreSQL (`RiskReport` + `BlastRadiusReport` tables) and uses it to generate the PR comment.

---

*End of Risk Engine. Continue to [07-analytics-package.md](./07-analytics-package.md) →*
