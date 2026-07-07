# SystemMapper — Graph Package

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Neo4j driver Management](#2-neo4j-driver-management)
3. [Graph Repository Layer](#3-graph-repository-layer)
4. [Graph Builders](#4-graph-builders)
5. [Cypher Abstraction](#5-cypher-abstraction)
6. [Traversal Utilities](#6-traversal-utilities)
7. [Synchronization](#7-synchronization)
8. [Graph Persistence](#8-graph-persistence)

---

## 1. Overview

The `@systemmapper/graph` package encapsulates all Memgraph interactions. It provides a clean API for building, querying, and maintaining the dependency graph. No other package directly uses the Neo4j driver — all graph operations go through this package.

**Dependencies:**
- `@systemmapper/types` — Shared type definitions
- `@systemmapper/shared` — Utility functions
- `neo4j-driver` — Official Memgraph JavaScript driver

**Consumers:**
- `apps/api` — Read-only graph queries for visualization and search
- `apps/worker` — Read/write graph operations for building and updating

### 1.1 Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Single Responsibility** | Each repository handles one node type or query category |
| **Repository Pattern** | All Cypher queries are encapsulated in repository classes |
| **Builder Pattern** | Graph construction uses builder classes that produce Cypher MERGE operations |
| **Abstraction** | No raw Cypher strings outside the `queries/` and `repositories/` directories |
| **Idempotency** | All write operations use MERGE, not CREATE |
| **Transaction Safety** | Multi-step operations use Memgraph transactions |

---

## 2. Neo4j driver Management

### 2.1 Driver Lifecycle

The Neo4j driver is a singleton managed by the package:

1. **Initialization:** `createDriver(uri, username, password)` creates and verifies the driver connection.
2. **Session Creation:** `getSession(database?)` creates a new session for each operation.
3. **Shutdown:** `closeDriver()` gracefully closes the driver and all sessions.

### 2.2 Session Management

Sessions are short-lived and scoped to a single operation:

```
1. Get session from driver
2. Execute query/transaction within session
3. Close session (always, even on error)
```

Sessions use `try/finally` to guarantee cleanup.

### 2.3 Connection Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `maxConnectionPoolSize` | 50 | Sufficient for worker concurrency |
| `connectionAcquisitionTimeout` | 30000ms | Timeout for getting a connection from the pool |
| `connectionTimeout` | 5000ms | Timeout for establishing a new connection |
| `maxTransactionRetryTime` | 15000ms | Timeout for automatic transaction retries |

### 2.4 Health Check

The driver exposes a `verifyConnectivity()` method used by the health check endpoint:

1. Call `driver.verifyConnectivity()`.
2. If it resolves, Memgraph is healthy.
3. If it rejects, Memgraph is unavailable.

---

## 3. Graph Repository Layer

### 3.1 `BaseGraphRepository`

Abstract base class providing shared methods:

| Method | Description |
|--------|-------------|
| `runQuery(cypher, params)` | Execute a read query and return records |
| `runWrite(cypher, params)` | Execute a write query |
| `runInTransaction(fn)` | Execute multiple operations in a single transaction |
| `mergeNode(label, properties)` | MERGE a node by `nodeId` |
| `deleteNodesByProperty(label, key, value)` | Delete nodes matching a property |

### 3.2 `FileGraphRepository`

Handles all `:File` node operations:

| Method | Description |
|--------|-------------|
| `mergeFile(repositoryId, parsedFile)` | Create or update a File node |
| `deleteFileAndContents(repositoryId, filePath)` | Delete a File node and all contained nodes |
| `getFileByPath(repositoryId, filePath)` | Fetch a File node by path |
| `getFilesByRepository(repositoryId)` | List all files for a repository |

### 3.3 `ClassGraphRepository`

Handles all `:Class`, `:Interface`, `:Type`, `:Enum` node operations:

| Method | Description |
|--------|-------------|
| `mergeClass(repositoryId, classDecl, filePath)` | Create or update a Class node |
| `mergeInterface(repositoryId, ifaceDecl, filePath)` | Create or update an Interface node |
| `mergeType(repositoryId, typeDecl, filePath)` | Create or update a Type node |
| `mergeEnum(repositoryId, enumDecl, filePath)` | Create or update an Enum node |

### 3.4 `FunctionGraphRepository`

Handles `:Function`, `:Method`, `:Variable` node operations:

| Method | Description |
|--------|-------------|
| `mergeFunction(repositoryId, funcDecl, filePath)` | Create or update a Function node |
| `mergeMethod(repositoryId, methodDecl, filePath, className)` | Create or update a Method node |
| `mergeVariable(repositoryId, varDecl, filePath)` | Create or update a Variable node |

### 3.5 `RelationshipGraphRepository`

Handles all relationship creation:

| Method | Description |
|--------|-------------|
| `createImportsRelationship(sourceNodeId, targetNodeId, props)` | Create IMPORTS edge |
| `createCallsRelationship(sourceNodeId, targetNodeId, props)` | Create CALLS edge |
| `createContainsRelationship(parentNodeId, childNodeId)` | Create CONTAINS edge |
| `createExtendsRelationship(childNodeId, parentNodeId)` | Create EXTENDS edge |
| `createImplementsRelationship(classNodeId, ifaceNodeId)` | Create IMPLEMENTS edge |
| `createUsesRelationship(sourceNodeId, targetNodeId, props)` | Create USES edge |
| `deleteRelationshipsForFile(repositoryId, filePath)` | Delete all relationships from/to nodes in a file |

### 3.6 `TraversalGraphRepository`

Handles complex traversal queries:

| Method | Description |
|--------|-------------|
| `getBlastRadius(repositoryId, filePaths, maxDepth)` | Execute blast radius traversal |
| `getCircularDependencies(repositoryId)` | Detect circular import chains |
| `getDeadCode(repositoryId)` | Find unreferenced functions and classes |
| `getReverseDependencies(repositoryId, filePath, maxDepth)` | Find all dependents of a file |
| `getRepositoryStatistics(repositoryId)` | Aggregate node/relationship counts |
| `getVisualizationData(repositoryId, options)` | Get graph data formatted for visualization |
| `getMostConnectedNodes(repositoryId, limit)` | Find hub nodes (bottlenecks) |
| `getLongestDependencyChain(repositoryId)` | Find the critical path |

---

## 4. Graph Builders

### 4.1 `GraphBuilder`

The main builder that orchestrates graph construction from parsed IR:

**Input:** Array of `ParsedFile` IR objects + `repositoryId` + `scanId`

**Process:**
1. Create the `:Repository` node (MERGE).
2. For each `ParsedFile`:
   a. Create directory chain (`:Directory` nodes with `CONTAINS`).
   b. Create `:File` node with `CONTAINS` from parent directory.
   c. For each class: create `:Class` node with `CONTAINS` from file.
   d. For each method in class: create `:Method` node with `CONTAINS` from class.
   e. For each function: create `:Function` node with `CONTAINS` from file.
   f. For each interface, type, enum, variable: create corresponding nodes.
3. For each `ParsedFile`:
   a. For each import: create `:IMPORTS` relationship to the target file.
   b. For each class extending another: create `:EXTENDS` relationship.
   c. For each class implementing an interface: create `:IMPLEMENTS` relationship.
   d. For each function call: create `:CALLS` relationship.
   e. For each type usage: create `:USES` relationship.

**Two-pass approach:** Nodes are created in the first pass, relationships in the second pass. This ensures all target nodes exist before relationships are created.

### 4.2 `NodeBuilder`

Constructs node properties from parsed IR:

| Method | Input | Output |
|--------|-------|--------|
| `buildFileNode(repositoryId, parsedFile)` | ParsedFile | File node properties with deterministic nodeId |
| `buildClassNode(repositoryId, classDecl, filePath)` | ClassDeclaration + path | Class node properties |
| `buildFunctionNode(repositoryId, funcDecl, filePath)` | FunctionDeclaration + path | Function node properties |
| `buildMethodNode(repositoryId, methodDecl, filePath, className)` | MethodDeclaration + path + class | Method node properties |

Each builder method:
1. Generates a deterministic `nodeId` using `NodeIdGenerator`.
2. Maps IR fields to Memgraph node properties.
3. Adds temporal properties (`createdAt`, `updatedAt`, `scanId`).

### 4.3 `RelationshipBuilder`

Constructs relationship properties from parsed IR:

| Method | Input | Output |
|--------|-------|--------|
| `buildImportsRelationship(importDecl)` | ImportDeclaration | IMPORTS relationship properties |
| `buildCallsRelationship(callerNode, calleeNode, lines)` | Node pair + line numbers | CALLS relationship properties |
| `buildContainsRelationship(parentNode, childNode)` | Node pair | CONTAINS relationship properties |

---

## 5. Cypher Abstraction

### 5.1 `CypherBuilder`

A fluent builder for constructing Cypher queries programmatically:

| Method | Description |
|--------|-------------|
| `match(label, alias, properties)` | Add a MATCH clause |
| `optionalMatch(label, alias, properties)` | Add an OPTIONAL MATCH clause |
| `where(condition)` | Add a WHERE condition |
| `merge(label, alias, mergeProps, onCreateProps, onMatchProps)` | Add a MERGE with ON CREATE and ON MATCH |
| `create(label, alias, properties)` | Add a CREATE clause |
| `delete(alias)` | Add a DELETE clause |
| `returnFields(fields)` | Add a RETURN clause |
| `orderBy(field, direction)` | Add ORDER BY |
| `limit(count)` | Add LIMIT |
| `withParams(params)` | Set query parameters |
| `build()` | Return `{ query: string, params: Record<string, unknown> }` |

### 5.2 Usage Rules

1. All Cypher queries are built using `CypherBuilder` or stored as named query templates in the `queries/` directory.
2. No string concatenation for Cypher. All dynamic values use parameterized queries (`$paramName`).
3. Complex traversal queries (blast radius, cycle detection) are stored as template strings in dedicated query files.
4. Simple CRUD operations (merge node, delete node) use `CypherBuilder`.

---

## 6. Traversal Utilities

### 6.1 `BlastRadiusTraverser`

Executes the blast radius algorithm against Memgraph:

**Algorithm:**
1. Match changed file nodes.
2. Execute parameterized Cypher query with variable-length path traversal.
3. Apply depth limiting (`maxDepth`).
4. Return results with distance and affected components.

### 6.2 `DependencyGraphSerializer`

Converts Memgraph query results into the `DependencyGraphData` format consumed by the risk engine:

**Process:**
1. Query all file-level nodes and IMPORTS relationships for a repository.
2. Build the `nodes` array from node records.
3. Build the `edges` array from relationship records.
4. Build the `fileIndex` lookup map (filePath → node).
5. Build the `adjacencyList` and `reverseAdjacencyList`.
6. Return the complete `DependencyGraphData` object.

This serialization is the bridge between Memgraph and the risk engine. The risk engine never queries Memgraph directly — it receives this pre-serialized data.

### 6.3 `GraphStatisticsCollector`

Aggregates graph statistics for snapshots and metrics:

| Method | Description |
|--------|-------------|
| `getNodeCountByLabel(repositoryId)` | Count of each node type |
| `getRelationshipCountByType(repositoryId)` | Count of each relationship type |
| `getTotalNodeCount(repositoryId)` | Total nodes in the repository graph |
| `getTotalRelationshipCount(repositoryId)` | Total relationships |
| `getAverageImportsPerFile(repositoryId)` | Mean import count |
| `getMaxImportsPerFile(repositoryId)` | File with most imports |

---

## 7. Synchronization

### 7.1 `GraphSynchronizer`

Orchestrates the sync between PostgreSQL data and the Memgraph graph:

| Method | Description |
|--------|-------------|
| `fullSync(repositoryId, parsedFiles, scanId)` | Full graph build from all files |
| `incrementalSync(repositoryId, changed, deleted, added, scanId)` | Update only changed files |
| `verifyConsistency(repositoryId)` | Check PG ↔ Memgraph consistency |

### 7.2 `IncrementalUpdater`

Handles incremental graph updates:

**Process for each changed file:**
1. Delete all Memgraph nodes with `filePath` matching the changed file and `repositoryId`.
2. This automatically removes relationships connected to those nodes.
3. Re-create nodes from the new parsed IR.
4. Re-create relationships from the new parsed IR.
5. All operations are within a single Memgraph transaction.

**Process for deleted files:**
1. Delete all Memgraph nodes with the file's `filePath`.
2. No re-creation needed.

**Process for added files:**
1. Create new nodes from parsed IR.
2. Create relationships from parsed IR.

### 7.3 `GraphRebuilder`

Handles full graph rebuilds:

**Process:**
1. Delete ALL nodes and relationships for the repository: `MATCH (n {repositoryId: $id}) DETACH DELETE n`.
2. Run the full `GraphBuilder` with all parsed files.
3. Create a new `ArchitectureSnapshot` in PostgreSQL.

This is used for:
- Initial repository onboarding.
- Schema migration recovery.
- Manual rebuild triggered by admin.

---

## 8. Graph Persistence

### 8.1 Transaction Strategy

| Operation | Transaction Scope |
|-----------|------------------|
| Single file parse → graph update | One transaction per file |
| Full graph build | One transaction per batch of 50 files |
| Blast radius query | Single read transaction |
| Graph deletion | One transaction for DETACH DELETE |
| Statistics query | Single read transaction |

### 8.2 Batch Operations

For large repositories (1000+ files), graph operations are batched:

1. Nodes are created in batches of 50 files per transaction.
2. Relationships are created in a separate batch pass after all nodes exist.
3. Each batch is committed independently — partial builds are valid.
4. If a batch fails, it is retried. Already-merged nodes are unaffected (idempotent).

### 8.3 Index and Constraint Initialization

On first connection (or via a setup script), the following are created:

1. Uniqueness constraints on `nodeId` for all node labels.
2. Property indexes on `repositoryId`, `filePath`, `name`, `scanId`.
3. Full-text index on `name` and `qualifiedName` for code element search.

These are defined in `docker/memgraph/init-constraints.cypher` and applied:
- Automatically by the worker on startup (if not already present).
- Manually via `pnpm graph:init` script.

### 8.4 Schema Version Tracking

The graph schema version is stored on the `:Repository` node:

```
(:Repository {schemaVersion: "1.0.0"})
```

On worker startup:
1. Check the `schemaVersion` on all repository nodes.
2. If any repository's version is older than the current `SCHEMA_VERSION` constant, queue a rebuild.
3. After rebuild, the `schemaVersion` is updated to the current version.

---

*End of Graph Package. This concludes the SystemMapper Architecture Blueprint.*

---

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Executive Summary](./00-executive-summary.md) | Project overview, goals, tech stack |
| 01 | [Monorepo Structure](./01-monorepo-structure.md) | Turborepo layout, package details |
| 02 | [Database Design](./02-database-design.md) | PostgreSQL schema (30 models) |
| 03 | [Graph Design](./03-graph-design.md) | Memgraph node/relationship model |
| 04 | [Sync Strategy](./04-sync-strategy.md) | PostgreSQL ↔ Memgraph synchronization |
| 05 | [Parser Architecture](./05-parser-architecture.md) | Tree-sitter pipeline and IR |
| 06 | [Risk Engine](./06-risk-engine.md) | Strategy Pattern risk analysis |
| 07 | [Analytics Package](./07-analytics-package.md) | Metrics, scores, trends |
| 08 | [GitHub Package](./08-github-package.md) | GitHub App, OAuth, webhooks |
| 09 | [Queue Architecture](./09-queue-architecture.md) | BullMQ queues and DLQ |
| 10 | [Event Architecture](./10-event-architecture.md) | Domain events, sequence diagrams |
| 11 | [API Design](./11-api-design.md) | REST endpoints, RBAC, DTOs |
| 12 | [Shared Types](./12-shared-types.md) | Enums, interfaces, constants |
| 13 | [Folder Structure](./13-folder-structure.md) | Complete file tree |
| 14 | [Environment Variables](./14-environment-variables.md) | .env.example files |
| 15 | [Coding Standards](./15-coding-standards.md) | TypeScript, linting, commits |
| 16 | [Testing Strategy](./16-testing-strategy.md) | Unit, integration, coverage |
| 17 | [Roadmap](./17-roadmap.md) | 12-milestone implementation plan |
| 18 | [Diagrams](./18-diagrams.md) | Mermaid architecture diagrams |
| 19 | [ADRs](./19-adrs.md) | Architecture Decision Records |
| 20 | [Graph Package](./20-graph-package.md) | Memgraph abstraction layer |
