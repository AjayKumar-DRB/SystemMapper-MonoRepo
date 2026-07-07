# SystemMapper — Testing Strategy

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Testing Pyramid](#2-testing-pyramid)
3. [Unit Tests](#3-unit-tests)
4. [Integration Tests](#4-integration-tests)
5. [Parser Tests](#5-parser-tests)
6. [Graph Tests](#6-graph-tests)
7. [Risk Engine Tests](#7-risk-engine-tests)
8. [API Tests](#8-api-tests)
9. [Worker Tests](#9-worker-tests)
10. [Test Infrastructure](#10-test-infrastructure)

---

## 1. Overview

### 1.1 Testing Framework

| Tool | Purpose |
|------|---------|
| **Jest** | Test runner, assertions, mocking |
| **ts-jest** | TypeScript support for Jest |
| **supertest** | HTTP endpoint testing for NestJS |
| **@nestjs/testing** | NestJS module testing utilities |
| **testcontainers** | Docker-based integration test containers |

### 1.2 Coverage Requirements

| Package | Min Coverage | Target |
|---------|-------------|--------|
| `risk-engine` | 90% | 95% |
| `parser` | 85% | 90% |
| `graph` | 80% | 85% |
| `analytics` | 80% | 85% |
| `github` | 70% | 80% |
| `shared` | 80% | 90% |
| `database` | 70% | 80% |
| `api` (unit) | 70% | 80% |
| `worker` (unit) | 70% | 80% |

### 1.3 Test Commands

| Command | Scope |
|---------|-------|
| `pnpm test` | Run all tests across monorepo |
| `pnpm --filter @systemmapper/risk-engine test` | Test specific package |
| `pnpm test:unit` | Unit tests only |
| `pnpm test:integration` | Integration tests only |
| `pnpm test:coverage` | Generate coverage report |
| `pnpm test:watch` | Watch mode |

---

## 2. Testing Pyramid

```
           ╱╲
          ╱  ╲         E2E Tests (Future)
         ╱    ╲        - Full system tests
        ╱──────╲       - Smoke tests
       ╱        ╲
      ╱ Integr.  ╲     Integration Tests
     ╱   Tests    ╲    - Database integration
    ╱──────────────╲   - Memgraph integration
   ╱                ╲  - API endpoint tests
  ╱   Unit Tests     ╲  Unit Tests
 ╱                    ╲ - Strategy tests
╱──────────────────────╲- Parser tests
                        - Utility tests
```

**Distribution:**
- **Unit Tests:** ~70% of all tests
- **Integration Tests:** ~25% of all tests
- **E2E Tests:** ~5% (future, not in MVP)

---

## 3. Unit Tests

### 3.1 What to Unit Test

| Component | What to Test | What NOT to Test |
|-----------|-------------|-----------------|
| Strategies | Algorithm correctness, edge cases | Database queries, API calls |
| Parsers/Extractors | IR output for known inputs | File I/O, Tree-sitter internals |
| Calculators | Metric computation accuracy | Database storage |
| Utilities | Pure function behavior | External dependencies |
| DTOs/Validators | Validation rules, edge cases | Framework internals |
| Error classes | Error formatting, codes | Error handling in controllers |

### 3.2 Unit Test Rules

1. **No I/O.** Unit tests never touch databases, APIs, queues, or the filesystem.
2. **No mocks (when possible).** The `risk-engine` and `analytics` packages are designed to need zero mocks. Other packages may mock external dependencies.
3. **Fast.** Each unit test should complete in <100ms. The full unit test suite should complete in <30 seconds.
4. **Deterministic.** No randomness, no time-dependent behavior, no order dependency between tests.
5. **Descriptive names.** Use `describe` blocks for the class/function and `it` blocks with behavior-driven descriptions:
   ```
   describe('BlastRadiusStrategy', () => {
     describe('analyze', () => {
       it('should return empty result when no files are changed', () => { ... })
       it('should include direct dependents in blast radius', () => { ... })
       it('should apply decay factor to transitive dependents', () => { ... })
     })
   })
   ```

---

## 4. Integration Tests

### 4.1 Database Integration Tests

**Target:** `packages/database` repositories

**Infrastructure:**
- Use `testcontainers` to spin up a PostgreSQL container per test suite.
- Run Prisma migrations on the test database.
- Seed with test fixtures.
- Tear down after the suite completes.

**What to Test:**
- CRUD operations on all repositories.
- Soft delete behavior.
- Cascade deletions.
- Unique constraint enforcement.
- Pagination and filtering queries.
- Complex joins (e.g., repository with latest scan, PR with risk report).

### 4.2 Memgraph Integration Tests

**Target:** `packages/graph` repositories and queries

**Infrastructure:**
- Use `testcontainers` to spin up a Memgraph container.
- Apply constraint and index creation scripts.
- Populate with test graph data.

**What to Test:**
- Node MERGE operations (create and update).
- Relationship creation.
- Blast radius traversal queries.
- Circular dependency detection queries.
- Dead code detection queries.
- Graph statistics queries.
- Incremental update operations (delete + rebuild for a file).

### 4.3 Redis Integration Tests

**Target:** Queue operations in `apps/worker`

**Infrastructure:**
- Use `testcontainers` to spin up a Redis container.
- Create BullMQ queues connected to the test Redis.

**What to Test:**
- Job creation and processing.
- Job retry behavior.
- Job completion callbacks.
- Queue priority ordering.

---

## 5. Parser Tests

### 5.1 Extractor Tests (Unit)

Each language extractor has its own test suite with fixture files:

**TypeScript Extractor Tests:**

| Test Case | Input Fixture | Expected Output |
|-----------|--------------|----------------|
| Simple imports | `import { A } from './a'` | 1 ImportDeclaration with source `./a`, importedNames `['A']` |
| Default import | `import A from './a'` | 1 ImportDeclaration with defaultImport `A` |
| Namespace import | `import * as A from './a'` | 1 ImportDeclaration with namespaceImport `A` |
| External import | `import { X } from 'lodash'` | 1 ImportDeclaration with isExternal `true` |
| Class declaration | `export class Foo { ... }` | 1 ClassDeclaration with isExported `true` |
| Abstract class | `abstract class Bar { ... }` | 1 ClassDeclaration with isAbstract `true` |
| Class with methods | `class Foo { bar() {} }` | 1 ClassDeclaration with 1 MethodDeclaration |
| Function | `export function foo() {}` | 1 FunctionDeclaration with isExported `true` |
| Arrow function | `export const foo = () => {}` | 1 FunctionDeclaration |
| Interface | `export interface IFoo {}` | 1 InterfaceDeclaration |
| Type alias | `export type Foo = { ... }` | 1 TypeDeclaration |
| Enum | `export enum Status { A, B }` | 1 EnumDeclaration with memberCount 2 |
| Syntax errors | `class { broken` | ParseResult with status `partial` and errors |

**Python Extractor Tests:**

| Test Case | Input Fixture | Expected Output |
|-----------|--------------|----------------|
| Import module | `import os` | 1 ImportDeclaration with source `os` |
| From import | `from os import path` | 1 ImportDeclaration with importedNames `['path']` |
| Class | `class Foo:` | 1 ClassDeclaration |
| Function | `def foo():` | 1 FunctionDeclaration |
| Inheritance | `class Foo(Bar):` | 1 ClassDeclaration with superClass `Bar` |

### 5.2 Pipeline Tests (Unit)

| Test Case | Description |
|-----------|-------------|
| Unknown language | Returns `skipped` status for `.xyz` files |
| Empty file | Returns `success` with empty declaration lists |
| Binary file detection | Returns `skipped` for detected binary files |
| Large file | Returns `skipped` for files exceeding MAX_FILE_SIZE |
| Full pipeline | End-to-end parse of a multi-declaration file |

### 5.3 Parser Integration Tests

| Test Case | Description |
|-----------|-------------|
| Real-world TypeScript file | Parse a complex TS file with classes, imports, exports |
| Cross-file imports | Parse two files and verify import resolution |
| Parse performance | Verify that a 1000-line file parses in <200ms |

---

## 6. Graph Tests

### 6.1 Graph Builder Tests (Unit)

| Test Case | Description |
|-----------|-------------|
| Build File node | Verify node properties from ParsedFile IR |
| Build Class node | Verify class node with correct properties |
| Build IMPORTS relationship | Verify edge between File nodes |
| Build CONTAINS relationship | Verify File → Class containment |
| Deterministic node IDs | Same input produces same nodeId |

### 6.2 Query Tests (Integration — requires Memgraph)

| Test Case | Graph Fixture | Expected |
|-----------|--------------|----------|
| Blast radius: no dependents | A → B, change A | Only A affected |
| Blast radius: direct dependent | A → B, change B | A and B affected |
| Blast radius: transitive | A → B → C, change C | A, B, C affected with distances |
| Blast radius: depth limit | Chain of 10, depth=3 | Only 3 hops |
| Circular dependency: simple | A → B → A | Cycle detected with [A, B] |
| Circular dependency: none | A → B → C (no cycle) | No cycles |
| Dead code: unused function | F with no incoming edges | F detected as dead |
| Dead code: used function | F with incoming CALLS | F NOT detected |

### 6.3 Sync Tests (Integration)

| Test Case | Description |
|-----------|-------------|
| Full graph build | Build graph from multiple ParsedFiles |
| Incremental update | Modify one file, verify graph is updated |
| File deletion | Delete a file, verify nodes and edges removed |
| Rebuild from scratch | Delete all nodes, rebuild, verify identical graph |

---

## 7. Risk Engine Tests

### 7.1 Strategy Tests (Unit — Zero Dependencies)

The risk engine's test suite is the most comprehensive because it's the core product:

**Blast Radius Strategy:**

| Test Case | Input | Expected |
|-----------|-------|----------|
| No changed files | Empty changes | `totalAffectedNodes: 0` |
| Single isolated file | 1 file, no edges | `totalAffectedNodes: 1` |
| Direct dependent | A imports B, B changed | A in blast radius at distance 1 |
| Decay factor | A→B→C, C changed, decay=0.7 | B weight=1.0, A weight=0.7 |
| Depth limit | Chain of 10, maxDepth=3 | Only 3 levels in result |
| Multiple changed files | A and B changed | Union of blast radii |

**Circular Dependency Strategy:**

| Test Case | Input | Expected |
|-----------|-------|----------|
| No cycles | DAG graph | `cycleCount: 0` |
| Simple cycle | A→B→A | `cycleCount: 1`, cycle contains [A, B] |
| Complex cycles | Multiple SCCs | All cycles detected |
| Changed file in cycle | Cycle exists, changed file is member | `newCyclesIntroduced: false` (existing) |

**Risk Scoring Strategy:**

| Test Case | Input | Expected |
|-----------|-------|----------|
| Zero risk | All empty results | `overallScore: 0`, `riskLevel: LOW` |
| Low risk | Small blast radius, no violations | Score 0-25, `riskLevel: LOW` |
| Medium risk | Moderate blast radius | Score 26-50, `riskLevel: MEDIUM` |
| High risk | Large blast radius + violations | Score 51-75, `riskLevel: HIGH` |
| Critical risk | Everything maxed out | Score 76-100, `riskLevel: CRITICAL` |
| Determinism | Same input twice | Identical scores |
| Weight validation | All weights sum to 1.0 | Sum of weights = 1.0 |

### 7.2 End-to-End Engine Test (Unit)

A full integration test (still no I/O — uses fixture data):

1. Create a realistic `DependencyGraphData` fixture with 50+ nodes.
2. Define a set of `ChangedFile` entries.
3. Run `RiskEngine.analyze()`.
4. Verify the complete `RiskReport` structure.
5. Snapshot test the full report.

### 7.3 Property-Based Tests

| Property | Test |
|----------|------|
| Score bounded | `0 <= score <= 100` for any valid input |
| Empty input yields zero | No changed files → score 0 |
| Monotonicity | Adding more changed files doesn't decrease the score |
| Determinism | Same input produces same output across 100 runs |

---

## 8. API Tests

### 8.1 Controller Tests (Unit)

Test each controller method in isolation using NestJS testing utilities:

1. Mock the service layer.
2. Invoke the controller method.
3. Assert the response shape and status code.
4. Assert that the correct service method was called with the right args.

### 8.2 Guard Tests (Unit)

| Test Case | Description |
|-----------|-------------|
| Valid JWT | Request passes auth guard |
| Missing JWT | Request returns 401 |
| Invalid JWT | Request returns 401 |
| Insufficient role | Request returns 403 |
| Correct role | Request passes role guard |

### 8.3 E2E Tests (Integration)

Using `supertest` with a NestJS test module:

| Test Suite | Tests |
|-----------|-------|
| Auth | OAuth flow, profile retrieval, logout |
| Repositories | CRUD operations, scan triggering |
| Architecture | Graph data retrieval, snapshot listing |
| Blast Radius | Report retrieval, on-demand analysis |
| Notifications | List, mark as read |
| Webhooks | Signature verification, event processing |

---

## 9. Worker Tests

### 9.1 Processor Tests (Unit)

Each processor is unit tested by mocking its dependencies:

| Processor | Mocked Dependencies | Key Tests |
|-----------|-------------------|-----------|
| `ScanProcessor` | GitHub service, database repos, queue | File tree fetching, change detection, job dispatching |
| `ParseProcessor` | Parser, database repos | Parse invocation, metadata update, error handling |
| `GraphBuildProcessor` | Graph builder, database repos | Node creation, relationship building, snapshot creation |
| `BlastRadiusProcessor` | Graph queries, risk engine, GitHub service | Full analysis flow, comment posting |
| `MetricsProcessor` | Graph queries, calculators, database repos | Metric computation and storage |
| `CleanupProcessor` | Database repos | Record purging, health checking |

### 9.2 Orchestration Tests (Integration)

Test the scan orchestration flow with mocked external services:

1. Trigger a scan.
2. Verify parse jobs are dispatched.
3. Simulate parse job completion.
4. Verify graph build job is dispatched.
5. Simulate graph build completion.
6. Verify metrics job is dispatched.

---

## 10. Test Infrastructure

### 10.1 Fixtures

Fixtures are stored in `test/fixtures/` within each package:

| Fixture Type | Location | Purpose |
|-------------|----------|---------|
| Source files | `packages/parser/test/fixtures/typescript/` | Input for parser tests |
| Graph data | `packages/risk-engine/test/fixtures/` | In-memory graph fixtures |
| Database seeds | `packages/database/prisma/seed.ts` | Test data for integration tests |
| API payloads | `apps/api/test/fixtures/` | Request/response fixtures |

### 10.2 Test Utilities

| Utility | Purpose |
|---------|---------|
| `createTestGraph(nodes, edges)` | Build a `DependencyGraphData` from simple definitions |
| `createTestChangedFiles(paths)` | Build `ChangedFile[]` from file paths |
| `createTestParsedFile(overrides)` | Build a `ParsedFile` with sensible defaults |
| `createTestRiskInput(overrides)` | Build a `RiskAnalysisInput` with defaults |

### 10.3 CI Integration

Tests run in CI via GitHub Actions:

1. **Lint** — ESLint + Prettier check.
2. **Unit Tests** — All unit tests across the monorepo.
3. **Integration Tests** — Database + Memgraph tests using service containers.
4. **Coverage** — Generate and upload coverage report.

---

*End of Testing Strategy. Continue to [17-roadmap.md](./17-roadmap.md) →*
