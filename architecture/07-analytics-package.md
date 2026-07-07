# SystemMapper — Analytics Package

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Metric Categories](#2-metric-categories)
3. [Calculators](#3-calculators)
4. [Scorers](#4-scorers)
5. [Trend Analysis](#5-trend-analysis)
6. [Snapshot Comparison](#6-snapshot-comparison)
7. [Future DORA Metrics](#7-future-dora-metrics)

---

## 1. Overview

The `@systemmapper/analytics` package computes, stores, and analyzes repository-level and architecture-level metrics. It transforms raw data from scans and graphs into meaningful health indicators, scores, and trends.

**Dependencies:** `@systemmapper/types`, `@systemmapper/shared`, `@systemmapper/database`

---

## 2. Metric Categories

### 2.1 Repository Metrics

| Metric | Type | Description | Computation |
|--------|------|-------------|-------------|
| `FILE_COUNT` | Integer | Total source files | Count of File nodes in graph |
| `FUNCTION_COUNT` | Integer | Total functions/methods | Count of Function + Method nodes |
| `CLASS_COUNT` | Integer | Total classes | Count of Class nodes |
| `INTERFACE_COUNT` | Integer | Total interfaces | Count of Interface nodes |
| `DEPENDENCY_COUNT` | Integer | Total import relationships | Count of IMPORTS edges |
| `LINES_OF_CODE` | Integer | Total lines across all files | Sum of File.lineCount |

### 2.2 Architecture Metrics

| Metric | Type | Description | Computation |
|--------|------|-------------|-------------|
| `AVG_DEPENDENCY_DEPTH` | Float | Average import chain length | Mean of shortest paths from roots to leaves |
| `MAX_DEPENDENCY_DEPTH` | Float | Deepest import chain | Longest path in the dependency DAG |
| `CIRCULAR_DEPENDENCY_COUNT` | Integer | Number of circular import chains | Tarjan's SCC with size > 1 |
| `ORPHAN_FILE_COUNT` | Integer | Files with zero importers | Files with no inbound IMPORTS edges |
| `DEPENDENCY_DENSITY` | Float | Ratio of actual to possible edges | `edges / (nodes × (nodes - 1))` |
| `COUPLING_SCORE` | Float | Average fan-in + fan-out | Mean of `(inDegree + outDegree)` across files |
| `COHESION_SCORE` | Float | Intra-module dependency ratio | Internal imports / total imports per module |

### 2.3 Health Scores

| Score | Range | Description |
|-------|-------|-------------|
| `ARCHITECTURE_SCORE` | 0-100 | Overall architectural health (higher = healthier) |
| `TECHNICAL_DEBT_SCORE` | 0-100 | Technical debt level (higher = more debt) |
| `COMPLEXITY_SCORE` | 0-100 | Code complexity level (higher = more complex) |

---

## 3. Calculators

### 3.1 `MetricsCalculator`

**Purpose:** Compute all raw metrics from scan results and graph data.

**Input:** `ScanResult` (parsed file data) + `GraphStatistics` (node/edge counts from Memgraph)

**Process:**

1. Count files by language, directory, and type.
2. Count functions, classes, interfaces from parsed IR.
3. Sum lines of code across all files.
4. Query graph for dependency statistics (fan-in, fan-out, depth).
5. Return a `MetricsSnapshot` containing all computed values.

### 3.2 `ComplexityCalculator`

**Purpose:** Compute code complexity metrics.

**Metrics:**

- **Cyclomatic Complexity:** Number of independent paths through the code. Approximated from the parsed IR: `branches + loops + catch blocks + 1`.
- **Average Function Length:** Mean lines per function across the repository.
- **Large File Count:** Files exceeding a threshold (default: 500 lines).
- **God Class Count:** Classes with method count exceeding a threshold (default: 20 methods).
- **Deep Nesting Count:** Functions with nesting depth exceeding a threshold (default: 4 levels).

### 3.3 `DependencyDensityCalculator`

**Purpose:** Compute the density of the dependency graph.

**Formula:** `density = actualEdges / maxPossibleEdges`

Where `maxPossibleEdges = n × (n - 1)` for a directed graph with `n` nodes.

**Interpretation:**

- Density near 0: Loosely coupled (healthy)
- Density near 1: Everything depends on everything (unhealthy)
- Typical healthy range: 0.01 – 0.05

### 3.4 `CouplingCalculator`

**Purpose:** Compute coupling metrics per file and per module.

**Metrics:**

- **Afferent Coupling (Ca):** Number of files that depend on this file (fan-in).
- **Efferent Coupling (Ce):** Number of files this file depends on (fan-out).
- **Instability:** `Ce / (Ca + Ce)`. Range 0 (stable) to 1 (unstable).
- **Abstractness:** Ratio of abstract elements (interfaces, abstract classes) to total elements.

### 3.5 `CohesionCalculator`

**Purpose:** Compute module-level cohesion.

**Metric:** For each directory (treated as a module), calculate the ratio of intra-module imports to total imports. Higher ratio = higher cohesion = healthier module.

---

## 4. Scorers

### 4.1 `ArchitectureScorer`

**Purpose:** Compute a single 0-100 architecture health score.

**Formula (Weighted Average):**

```
architectureScore =
  100 -
  (circularDependencyPenalty × 0.25) -
  (orphanFilePenalty × 0.10) -
  (densityPenalty × 0.15) -
  (couplingPenalty × 0.20) -
  (depthPenalty × 0.15) -
  (cohesionPenalty × 0.15)
```

Each penalty is normalized to 0-100 and represents how far the metric deviates from the ideal.

**Interpretation:**

| Score | Rating | Description |
|-------|--------|-------------|
| 80-100 | Excellent | Well-structured, low coupling, high cohesion |
| 60-79 | Good | Minor issues, manageable complexity |
| 40-59 | Fair | Notable structural issues, refactoring recommended |
| 20-39 | Poor | Significant architectural problems |
| 0-19 | Critical | Severe structural issues, major refactoring needed |

### 4.2 `TechnicalDebtScorer`

**Purpose:** Estimate technical debt level based on code quality indicators.

**Inputs:**

- Circular dependency count
- God class count
- Large file count
- Deep nesting count
- Orphan file count
- Average complexity
- Architecture violation count

**Scoring:** Each indicator contributes a penalty proportional to its count and severity. The total is normalized to 0-100.

### 4.3 `RepositoryHealthScorer`

**Purpose:** Aggregate architecture score and technical debt score into an overall health score.

**Formula:** `healthScore = architectureScore × 0.6 + (100 - technicalDebtScore) × 0.4`

---

## 5. Trend Analysis

### 5.1 `TrendAnalyzer`

**Purpose:** Analyze how metrics change over time using `Metric` records from PostgreSQL.

**Capabilities:**

- **Time series:** Retrieve metrics for a given repository, type, and date range.
- **Direction detection:** Determine if a metric is improving, declining, or stable.
- **Rate of change:** Calculate the slope of the metric trend line (linear regression).
- **Anomaly detection:** Flag sudden spikes or drops (deviation > 2 standard deviations).
- **Period comparison:** Compare metrics between two time periods (e.g., this week vs last week).

### 5.2 `SnapshotComparator`

**Purpose:** Compare two `ArchitectureSnapshot` records and produce a diff report.

**Output: `SnapshotComparison`**

| Field | Type | Description |
|-------|------|-------------|
| `snapshotA` | SnapshotSummary | Older snapshot |
| `snapshotB` | SnapshotSummary | Newer snapshot |
| `delta` | MetricDelta[] | Change for each metric |
| `addedFiles` | number | Files added between snapshots |
| `removedFiles` | number | Files removed between snapshots |
| `overallTrend` | "improving" \| "declining" \| "stable" | Overall direction |

### 5.3 `EvolutionAnalyzer`

**Purpose:** Track the long-term evolution of a repository's architecture.

**Analysis:**

- Identify the rate of file growth over time.
- Track dependency density trends.
- Detect architectural drift (score declining over time).
- Identify periods of rapid change (refactoring sprints, feature pushes).

---

## 6. Snapshot Comparison

When two snapshots are compared, the following deltas are computed:

| Metric | Delta Formula |
|--------|--------------|
| File Count | `snapshotB.fileCount - snapshotA.fileCount` |
| Function Count | `snapshotB.functionCount - snapshotA.functionCount` |
| Class Count | `snapshotB.classCount - snapshotA.classCount` |
| Dependency Count | `snapshotB.dependencyCount - snapshotA.dependencyCount` |
| Circular Dependencies | `snapshotB.circularDependencyCount - snapshotA.circularDependencyCount` |
| Architecture Score | `snapshotB.architectureScore - snapshotA.architectureScore` |

Positive delta in Architecture Score = improvement. Positive delta in Circular Dependencies = regression.

---

## 7. Future DORA Metrics

The analytics package architecturally supports DORA metrics for future implementation:

| DORA Metric | Data Source | Status |
|-------------|------------|--------|
| **Deployment Frequency** | Merge events on default branch | Future — requires tracking merges |
| **Lead Time for Changes** | PR open → merge duration | Future — requires PR lifecycle tracking |
| **Mean Time to Recovery** | Revert PR detection | Future — requires revert pattern detection |
| **Change Failure Rate** | PRs that introduce regressions | Future — requires post-merge analysis |

The `Metric` model in PostgreSQL and the `MetricsCalculator` infrastructure can accommodate DORA metrics without schema changes — they are simply new `MetricType` enum values with appropriate calculators.

---

*End of Analytics Package. Continue to [08-github-package.md](./08-github-package.md) →*
