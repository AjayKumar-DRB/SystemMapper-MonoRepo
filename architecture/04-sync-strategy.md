# SystemMapper — PostgreSQL ↔ Memgraph Synchronization Strategy

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Source of Truth](#2-source-of-truth)
3. [Entity Mapping](#3-entity-mapping)
4. [Node Identity](#4-node-identity)
5. [Synchronization Flows](#5-synchronization-flows)
6. [Incremental Graph Updates](#6-incremental-graph-updates)
7. [Snapshot Strategy](#7-snapshot-strategy)
8. [Graph Versioning](#8-graph-versioning)
9. [Rebuild Strategy](#9-rebuild-strategy)
10. [Rollback Strategy](#10-rollback-strategy)
11. [Failure Recovery](#11-failure-recovery)
12. [Idempotency](#12-idempotency)

---

## 1. Overview

SystemMapper uses a **dual-database architecture** where PostgreSQL (via Supabase) and Memgraph serve complementary roles. This document defines how these two databases work together, how data flows between them, and how consistency is maintained.

The fundamental design principle is: **PostgreSQL is the source of truth for business data; Memgraph is a derived, queryable projection of the architectural structure.**

Memgraph can always be rebuilt from PostgreSQL data combined with a re-parse of the source code. This means Memgraph data loss, while operationally costly (requiring a re-scan), does not result in permanent data loss.

---

## 2. Source of Truth

### 2.1 PostgreSQL Owns

| Data Category | Examples | Reasoning |
|---------------|----------|-----------|
| User identity | Users, organizations, members | ACID transactions for auth |
| Business metadata | Repos, scans, PRs, settings | Relational integrity |
| Operational state | Job status, scan progress | Transaction safety |
| Audit trail | Audit logs, webhook events | Compliance, immutability |
| Metrics | Time-series metrics | SQL aggregation strength |
| Configuration | Feature flags, settings | Transactional updates |
| Analysis results | Risk reports, blast radius reports | Business output |

### 2.2 Memgraph Owns

| Data Category | Examples | Reasoning |
|---------------|----------|-----------|
| Dependency graph | File, Class, Function nodes | Graph traversal performance |
| Relationships | IMPORTS, CALLS, EXTENDS | Path queries, cycle detection |
| Graph topology | Structure, hierarchy | Native graph operations |
| Traversal results | Blast radius paths | Real-time computation |

### 2.3 Shared Data (Synchronized)

| Data | PG Field | Memgraph Property | Sync Direction |
|------|----------|----------------|----------------|
| Repository ID | `Repository.id` | `node.repositoryId` | PG → Memgraph |
| File path | `ParserMetadata.filePath` | `File.filePath` | PG → Memgraph |
| Content hash | `ParserMetadata.contentHash` | `File.contentHash` | PG → Memgraph |
| Scan ID | `RepositoryScan.id` | `node.scanId` | PG → Memgraph |
| Node count | Computed from Memgraph | `ArchitectureSnapshot.nodeCount` | Memgraph → PG |
| Relationship count | Computed from Memgraph | `ArchitectureSnapshot.relationshipCount` | Memgraph → PG |

---

## 3. Entity Mapping

### 3.1 PostgreSQL → Memgraph Reference Table

| PostgreSQL Entity | Memgraph Node | Linking Property |
|-------------------|-----------|-----------------|
| `Repository` | `:Repository` | `repositoryId = Repository.id` |
| `ParserMetadata` | `:File` | `pgEntityId = ParserMetadata.id` |
| `RepositoryScan` | All nodes (via `scanId`) | `scanId = RepositoryScan.id` |
| `ArchitectureSnapshot` | All nodes (via `snapshotVersion`) | `snapshotVersion = ArchitectureSnapshot.id` |

### 3.2 Memgraph → PostgreSQL Reference Table

| Memgraph Node/Query | PostgreSQL Target | Usage |
|------------------|-------------------|-------|
| Blast radius traversal result | `BlastRadiusReport.affectedFiles` (JSON) | Stored as analysis output |
| Node count query | `ArchitectureSnapshot.nodeCount` | Stored as snapshot metric |
| Circular dependency detection | `RiskReport.circularDependenciesFound` | Stored as risk metric |
| Dependency statistics | `Metric` records | Stored as time-series metrics |

---

## 4. Node Identity

### 4.1 Deterministic Node ID Construction

Every Memgraph node's `nodeId` is deterministically constructed from its PostgreSQL-anchored properties:

```
nodeId = {repositoryId}:{nodeType}:{qualifiedPath}
```

**Rules:**

1. `repositoryId` comes from PostgreSQL's `Repository.id` (UUID).
2. `nodeType` is the Memgraph node label (File, Class, Function, etc.).
3. `qualifiedPath` is constructed from the file path and element name.
4. The same source code, parsed by the same parser version, always produces the same `nodeId`.

**This enables:**

- MERGE operations that create-or-update without duplicates.
- Stable references from PostgreSQL to Memgraph nodes.
- Idempotent graph rebuilds.

### 4.2 Node ID Examples

| Entity | Node ID Format |
|--------|---------------|
| File | `abc-123:File:src/services/user.service.ts` |
| Class | `abc-123:Class:src/services/user.service.ts:UserService` |
| Method | `abc-123:Method:src/services/user.service.ts:UserService.findById` |
| Function | `abc-123:Function:src/utils/hash.ts:hashPassword` |
| Interface | `abc-123:Interface:src/types/user.ts:IUser` |
| Package | `abc-123:Package:@nestjs/common` |
| Directory | `abc-123:Directory:src/services` |

---

## 5. Synchronization Flows

### 5.1 Immutable Snapshot Synchronization

SystemMapper uses an **Immutable Snapshot** pattern to ensure zero downtime and zero partial-state exposure during graph builds:

1. **New Namespace:** When a scan begins, a new snapshot version (e.g., `snapshot_v2`) is generated.
2. **Build Isolation:** The graph builder creates all nodes and relationships strictly within this new namespace.
3. **Live State Preservation:** While the build occurs, `snapshot_v1` remains the active graph. All API queries and blast radius calculations continue to run against `snapshot_v1`.
4. **Atomic Pointer Switch:** Only after the entire `snapshot_v2` graph is successfully built and validated in Memgraph, PostgreSQL commits the transaction and updates the active snapshot pointer on the `Repository` record to `snapshot_v2`.
5. **Garbage Collection:** Old snapshots (`snapshot_v1`) are retained for a configurable period for historical comparison, after which they are asynchronously deleted by a background cleanup job.

### 5.2 Initial Repository Onboard (Full Sync)

```
1. User connects repository → PostgreSQL: Create Repository record
2. Scan triggered → PostgreSQL: Create RepositoryScan (status=PENDING)
3. Worker: Download repo to temporary workspace
4. Worker: Initiate new graph snapshot (e.g., `v1`)
5. Worker: For each file:
   a. Parser microservices parse code → generate Canonical IR
   b. Memgraph: CREATE nodes and relationships tagged with snapshot `v1`
6. Worker: After all files processed:
   a. Memgraph: Query graph statistics for `v1`
   b. PostgreSQL: Create ArchitectureSnapshot metadata
   c. PostgreSQL: Update active pointer to `v1` atomically
   d. PostgreSQL: Update scan status to COMPLETED
7. Worker: Delete temporary workspace
```

### 5.3 Incremental Scan (Subsequent Pushes)

```
1. Webhook: push event received → PostgreSQL: Create WebhookEvent
2. Worker: Create RepositoryScan (triggerType=webhook)
3. Worker: Download repo state at HEAD to temporary workspace
4. Worker: Initiate new graph snapshot (e.g., `v2`)
5. Worker: 
   a. For unchanged files: COPY nodes/relationships from `v1` to `v2` namespace.
   b. For changed files: Parse and CREATE new nodes in `v2`.
   c. For deleted files: Do nothing (they are omitted from `v2`).
6. Post-update:
   a. Memgraph: Query updated graph statistics for `v2`
   b. PostgreSQL: Create ArchitectureSnapshot metadata
   c. PostgreSQL: Atomically update active pointer to `v2`
   d. PostgreSQL: Update scan status to COMPLETED
7. Worker: Delete temporary workspace
```

---

## 6. Temporary Workspace Downloader

### 6.1 Change Detection

The system uses **content hashing** to detect file changes:

1. Each file's content is hashed (SHA-256) and stored in `ParserMetadata.contentHash`.
2. On subsequent scans, the new content hash is compared to the stored hash.
3. Only files with changed hashes are re-parsed and re-graphed.

### 6.2 File-Level Atomicity

Graph updates are performed at the **file level**:

1. When a file changes, ALL nodes and relationships originating from that file are deleted.
2. The file is re-parsed.
3. New nodes and relationships are created from the fresh parse result.
4. This is done within a single Memgraph transaction to ensure atomicity.

**Why file-level?** Smaller granularity (function-level) would require complex diff logic between old and new ASTs. File-level is simpler, deterministic, and fast enough for the expected scale (thousands of files, not millions).

### 6.3 Orphan Cleanup

After incremental updates, orphan cleanup is performed:

1. **Orphan nodes:** Nodes whose source file no longer exists are deleted.
2. **Dangling relationships:** Relationships pointing to deleted nodes are automatically cleaned by Memgraph.
3. **Stale scan IDs:** Nodes with a `scanId` older than the current scan and not updated in the current scan are flagged for review.

---

## 7. Snapshot Strategy

### 7.1 Namespace Isolation

Instead of mutating a single live graph, Memgraph stores multiple snapshots simultaneously. A snapshot is isolated by attaching a `snapshotId` property to every node/relationship.

1. **Current state:** PostgreSQL's `Repository.activeSnapshotId` determines which graph nodes to query.
2. **Queries:** All Cypher queries must include `WHERE n.snapshotId = $activeSnapshotId`.

### 7.2 Historical Comparison

Because multiple snapshots exist simultaneously in Memgraph, historical comparison becomes trivial:

1. To compare architecture evolution, Cypher queries can match nodes across two different `snapshotId` values.
2. PostgreSQL still stores the aggregate metrics (file count, complexity) for fast timeline rendering without querying Memgraph.

### 7.3 Garbage Collection

Snapshots consume Memgraph storage. A background worker periodically identifies orphaned or expired snapshots (e.g., older than 30 days) and issues bulk DELETE queries to remove those nodes and relationships, reclaiming space.

---

## 8. Graph Versioning

### 8.1 Schema Version

The graph schema has a version number stored as a property on the `:Repository` node:

```
schemaVersion: "1.0.0"
```

When the graph schema changes (new node labels, new properties, new relationship types), the schema version is incremented.

### 8.2 Migration Strategy

When the graph schema changes:

1. **Additive changes** (new properties, new labels): No migration needed. New scans populate new properties. Old nodes missing the property return `null`.
2. **Breaking changes** (renamed properties, removed labels): Trigger a full graph rebuild for affected repositories. The rebuild uses the latest parser and graph builder.
3. **Schema version check:** Before any graph operation, verify the repository's `schemaVersion` matches the expected version. If outdated, queue a rebuild.

### 8.3 Version Compatibility

The `@systemmapper/graph` package maintains a `SCHEMA_VERSION` constant. Graph operations check:

```
IF node.schemaVersion < SCHEMA_VERSION THEN
  queue graph rebuild
  return stale data (with warning flag)
```

---

## 9. Rebuild Strategy

### 9.1 Full Rebuild

A full graph rebuild:

1. Delete ALL Memgraph nodes and relationships for the target repository.
2. Clear all `ParserMetadata` content hashes (forces re-parse of all files).
3. Trigger a new full scan.
4. The scan proceeds as an initial onboard (Section 5.1).

### 9.2 Rebuild Triggers

| Trigger | Description |
|---------|-------------|
| Manual | User clicks "Rebuild Graph" in repository settings |
| Schema migration | Graph schema version mismatch detected |
| Corruption | Graph health check detects inconsistencies |
| Parser update | Major parser version upgrade changes IR format |
| Recovery | After Memgraph data loss or restore |

### 9.3 Rebuild Safety

- Rebuilds are queued as a special job with higher priority.
- During a rebuild, the old graph data remains available until the new graph is fully built.
- A "rebuilding" flag on the repository prevents concurrent scans.
- After successful rebuild, a new snapshot is created.

---

## 10. Rollback Strategy

### 10.1 Graph Rollback

Memgraph does not natively support point-in-time rollback. Rollback is achieved through rebuild:

1. Identify the target commit SHA from PostgreSQL's `ArchitectureSnapshot` records.
2. Fetch the repository state at that commit via GitHub API.
3. Perform a full rebuild using the files at that commit.

### 10.2 PostgreSQL Rollback

PostgreSQL data is protected by Supabase's built-in backup and point-in-time recovery (future production concern). For development:

1. Prisma migrations provide forward-only schema changes.
2. Data rollback is achieved by creating reverse migrations.
3. Soft deletes enable logical rollback without data loss.

### 10.3 Coordinated Rollback

If both databases need to roll back:

1. Identify the target state (snapshot ID, commit SHA).
2. Roll back PostgreSQL to the target state (reverse migrations, data restore).
3. Trigger a Memgraph full rebuild from the rolled-back PostgreSQL state.

---

## 11. Failure Recovery

### 11.1 Failure Scenarios

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Memgraph write fails mid-scan | Orphaned partial snapshot | PostgreSQL transaction never commits. Active pointer remains unchanged. Partial `v2` nodes are cleaned up by garbage collection. Zero user impact. |
| PostgreSQL write fails mid-scan | Scan record incomplete | BullMQ retries the job; idempotent operations prevent duplicates |
| Memgraph becomes unavailable | No graph queries | API returns cached metrics from PostgreSQL; graph queries return error |
| PostgreSQL becomes unavailable | No business operations | Entire system is down; depends on Supabase availability |
| Worker crashes mid-scan | Jobs orphaned | BullMQ retries after timeout. Incomplete graph snapshot is safely discarded. |
| Network partition (PG ↔ Memgraph) | Inconsistent state | Retry mechanism; eventually consistent; rebuild if needed |

### 11.2 Consistency Guarantees

The system provides **eventual consistency** between PostgreSQL and Memgraph:

1. PostgreSQL is always updated first (source of truth).
2. Memgraph updates follow asynchronously via the worker.
3. If Memgraph updates fail, they are retried.
4. If retries exhaust, the scan is marked as FAILED in PostgreSQL.
5. Users can manually trigger a rebuild to restore consistency.

### 11.3 Health Check

A periodic health check (cleanup queue) verifies consistency:

1. Compare PostgreSQL `ParserMetadata` records with Memgraph `File` nodes.
2. Flag any discrepancies (missing nodes, extra nodes, hash mismatches).
3. Optionally trigger targeted repairs for specific files.
4. Report health status to the admin dashboard.

---

## 12. Idempotency

### 12.1 Idempotent Operations

All synchronization operations are designed to be idempotent:

| Operation | Idempotency Mechanism |
|-----------|----------------------|
| Create Memgraph node | `MERGE` on `nodeId` (creates if not exists, updates if exists) |
| Create relationship | `MERGE` on source+target+type (prevents duplicates) |
| Update ParserMetadata | Upsert on `(repositoryId, filePath)` composite unique |
| Create ArchitectureSnapshot | Check for existing snapshot with same `scanId` |
| Process webhook | Check `githubDeliveryId` for duplicate delivery |
| Calculate metrics | Idempotent by timestamp — same input produces same output |

### 12.2 Idempotency Keys

- **Webhook events:** `githubDeliveryId` (unique per delivery)
- **Scan jobs:** `scanId` + `filePath` (unique per file per scan)
- **Graph nodes:** `nodeId` (deterministic, unique per node)
- **Metrics:** `repositoryId` + `type` + `measuredAt` (unique per metric per timestamp)

### 12.3 Retry Safety

All retried operations are safe to execute multiple times:

1. Memgraph `MERGE` creates-or-updates, never duplicates.
2. PostgreSQL upserts use `ON CONFLICT` clauses.
3. GitHub comment updates use the stored `commentId` to update existing comments.
4. Metrics are timestamped, so recalculation overwrites the same record.

---

*End of Sync Strategy. Continue to [05-parser-architecture.md](./05-parser-architecture.md) →*
