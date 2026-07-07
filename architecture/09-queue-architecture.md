# SystemMapper — Queue Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Queue Infrastructure](#2-queue-infrastructure)
3. [Queue Definitions](#3-queue-definitions)
4. [Dead Letter Queue](#4-dead-letter-queue)
5. [Job Orchestration](#5-job-orchestration)
6. [Monitoring](#6-monitoring)

---

## 1. Overview

SystemMapper uses **BullMQ** backed by **Redis** for all background job processing. The queue architecture decouples the API server from compute-intensive operations (parsing, graph building, blast radius calculation) and enables reliable, retryable job processing.

### 1.1 Queue Naming Convention

All queue names use kebab-case with a `systemmapper:` prefix:

```
systemmapper:repository-scan
systemmapper:repository-parse
systemmapper:graph-build
systemmapper:graph-update
systemmapper:blast-radius
systemmapper:metrics
systemmapper:notifications
systemmapper:cleanup
systemmapper:retry
```

---

## 2. Queue Infrastructure

### 2.1 Redis Configuration

- **Single Redis instance** for development (Docker Compose).
- **Database 0** for BullMQ queues.
- **Database 1** for general caching (future).
- Max memory policy: `noeviction` (queues must not lose data).

### 2.2 BullMQ Configuration

All queues share these defaults:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `defaultJobOptions.attempts` | 3 | Retry failed jobs up to 3 times |
| `defaultJobOptions.backoff` | `{ type: 'exponential', delay: 5000 }` | Exponential backoff starting at 5s |
| `defaultJobOptions.removeOnComplete` | `{ count: 100 }` | Keep last 100 completed jobs |
| `defaultJobOptions.removeOnFail` | `{ count: 500 }` | Keep last 500 failed jobs |
| `limiter.max` | 10 | Max 10 concurrent jobs per queue |
| `limiter.duration` | 1000 | Per second |

---

## 3. Queue Definitions

### 3.1 `repository-scan`

**Purpose:** Initiates a full or incremental repository scan. Implements webhook debouncing, fetches the repository to a temporary workspace, and dispatches parse jobs to language-specific microservices.

| Aspect | Detail |
|--------|--------|
| **Producer** | API Server (webhook handler, manual trigger button) |
| **Consumer** | Core Orchestrator Worker |
| **Input** | `ScanJobPayload`: `{ repositoryId, scanId, branch, commitSha, triggerType, installationId }` |
| **Output** | Temporary workspace created; dispatched microservice parse jobs |
| **Process** | 1. **Debounce Check**: Cancel active/queued scans if a new push arrives within 10 min for the same PR. 2. **Downloader**: Download repo to `/tmp/systemmapper/<scan-id>`. 3. Dispatch `parse-<lang>` job for each changed/new file. 4. Update scan progress. |
| **Retries** | 3 attempts, exponential backoff |
| **Timeout** | 5 minutes |
| **Concurrency** | 5 concurrent scans |
| **Priority** | Normal (1) |

### 3.2 `parse-<language>` (Microservice Queues)

**Purpose:** Parses a single file using Tree-sitter and stores the parsed IR.

| Aspect | Detail |
|--------|--------|
| **Producer** | Worker — `ScanProcessor` (dispatches one job per file) |
| **Consumer** | Worker — `ParseProcessor` |
| **Input** | `ParseJobPayload`: `{ repositoryId, scanId, filePath, content, language, contentHash }` |
| **Output** | Parsed IR stored temporarily; `ParserMetadata` updated in PG |
| **Process** | 1. Invoke parser. 2. Store parse result. 3. Update `ParserMetadata`. 4. Report progress. |
| **Retries** | 2 attempts (parsing is deterministic, so retrying on error is unlikely to help unless it was a transient WASM issue) |
| **Timeout** | 30 seconds per file |
| **Concurrency** | 20 concurrent parse jobs |
| **Priority** | Normal (1) |

### 3.3 `graph-build`

**Purpose:** Builds the complete Memgraph dependency graph from all parsed IR data. Used for initial scans.

| Aspect | Detail |
|--------|--------|
| **Producer** | Worker — `ScanOrchestrator` (after all parse jobs complete) |
| **Consumer** | Worker — `GraphBuildProcessor` |
| **Input** | `GraphBuildJobPayload`: `{ repositoryId, scanId, parsedFileCount }` |
| **Output** | Memgraph graph created; `ArchitectureSnapshot` created in PG |
| **Process** | 1. Fetch all parsed IRs for the scan. 2. Build graph nodes. 3. Build graph relationships. 4. Create snapshot. 5. Dispatch `metrics` job. |
| **Retries** | 2 attempts |
| **Timeout** | 10 minutes |
| **Concurrency** | 3 concurrent builds |
| **Priority** | Normal (1) |

### 3.4 `graph-update`

**Purpose:** Incrementally updates the Memgraph graph for changed files only. Used for subsequent scans.

| Aspect | Detail |
|--------|--------|
| **Producer** | Worker — `ScanOrchestrator` (after parse jobs for changed files complete) |
| **Consumer** | Worker — `GraphUpdateProcessor` |
| **Input** | `GraphUpdateJobPayload`: `{ repositoryId, scanId, changedFiles, deletedFiles, addedFiles }` |
| **Output** | Memgraph graph updated; new `ArchitectureSnapshot` created |
| **Process** | 1. Delete nodes for removed/changed files. 2. Create nodes from new parse results. 3. Rebuild relationships. 4. Create snapshot. 5. Dispatch `metrics` job. |
| **Retries** | 3 attempts |
| **Timeout** | 5 minutes |
| **Concurrency** | 5 concurrent updates |
| **Priority** | Normal (1) |

### 3.5 `blast-radius`

**Purpose:** Calculates the blast radius and risk score for a Pull Request.

| Aspect | Detail |
|--------|--------|
| **Producer** | API Server (webhook handler for `pull_request` events) |
| **Consumer** | Worker — `BlastRadiusProcessor` |
| **Input** | `BlastRadiusJobPayload`: `{ repositoryId, pullRequestId, changedFiles, installationId }` |
| **Output** | `RiskReport` and `BlastRadiusReport` in PG; PR comment on GitHub |
| **Process** | 1. Query graph for dependency data. 2. Invoke risk engine. 3. Store reports. 4. Format PR comment. 5. Post/update GitHub comment. 6. Dispatch `notifications` job. |
| **Retries** | 3 attempts |
| **Timeout** | 2 minutes |
| **Concurrency** | 10 concurrent analyses |
| **Priority** | High (2) — blast radius should be fast for good developer experience |

### 3.6 `metrics`

**Purpose:** Computes and stores repository metrics after a scan completes.

| Aspect | Detail |
|--------|--------|
| **Producer** | Worker — `GraphBuildProcessor` or `GraphUpdateProcessor` |
| **Consumer** | Worker — `MetricsProcessor` |
| **Input** | `MetricsJobPayload`: `{ repositoryId, scanId, snapshotId }` |
| **Output** | `Metric` records in PG |
| **Process** | 1. Query graph statistics. 2. Invoke `MetricsCalculator`. 3. Invoke scorers. 4. Store all metric records. |
| **Retries** | 3 attempts |
| **Timeout** | 2 minutes |
| **Concurrency** | 10 concurrent calculations |
| **Priority** | Low (0) |

### 3.7 `notifications`

**Purpose:** Sends in-app notifications and future external notifications (Slack, email).

| Aspect | Detail |
|--------|--------|
| **Producer** | Any processor that generates a notifiable event |
| **Consumer** | Worker — `NotificationProcessor` |
| **Input** | `NotificationJobPayload`: `{ userId, organizationId, type, title, message, link, metadata }` |
| **Output** | `Notification` record in PG |
| **Process** | 1. Create notification record. 2. (Future) Send external notification. |
| **Retries** | 2 attempts |
| **Timeout** | 30 seconds |
| **Concurrency** | 20 concurrent sends |
| **Priority** | Low (0) |

### 3.8 `cleanup`

**Purpose:** Periodic maintenance — purge old records, check consistency, clean stale data.

| Aspect | Detail |
|--------|--------|
| **Producer** | Cron job (scheduled in worker startup) |
| **Consumer** | Worker — `CleanupProcessor` |
| **Input** | `CleanupJobPayload`: `{ cleanupType: 'webhook_events' \| 'job_history' \| 'notifications' \| 'health_check' }` |
| **Output** | Deleted records; health check report |
| **Process** | 1. Based on cleanup type, purge records older than retention period. 2. For health checks, verify PG ↔ Memgraph consistency. |
| **Retries** | 1 attempt |
| **Timeout** | 10 minutes |
| **Concurrency** | 1 (serial execution) |
| **Priority** | Low (0) |
| **Schedule** | Daily at 3:00 AM (configurable) |

### 3.9 `retry`

**Purpose:** Re-processes jobs that were moved from the Dead Letter Queue after manual review.

| Aspect | Detail |
|--------|--------|
| **Producer** | Admin API (manual retry trigger) |
| **Consumer** | Worker — `RetryProcessor` |
| **Input** | `RetryJobPayload`: `{ originalQueue, originalJobId, originalPayload, retryReason }` |
| **Output** | Re-dispatched job to the original queue |
| **Process** | 1. Log the retry attempt. 2. Re-dispatch the original payload to the original queue. |
| **Retries** | 1 attempt |
| **Timeout** | 30 seconds |
| **Concurrency** | 5 |
| **Priority** | Normal (1) |

---

## 4. Dead Letter Queue

### 4.1 DLQ Strategy

Jobs that exhaust all retry attempts are moved to a Dead Letter Queue (DLQ):

1. BullMQ's `removeOnFail` keeps the last 500 failed jobs per queue.
2. A failed job listener moves the job data to the `retry` queue with `status: 'dead_letter'`.
3. The `JobHistory` table records the failure with `status: DEAD_LETTER`.
4. Admins can view DLQ jobs in the admin dashboard.
5. Admins can manually retry or dismiss DLQ jobs.

### 4.2 DLQ Monitoring

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| DLQ depth > 10 | Warning | Review failed jobs |
| DLQ depth > 50 | Error | Investigate systemic failure |
| Same job failing repeatedly | Warning | Check job payload and dependencies |

---

## 5. Job Orchestration

### 5.1 Scan Orchestration Flow

```
repository-scan (Debounce & Download Repo to /tmp)
      │
      ├──→ parse-ts (file 1)
      ├──→ parse-ts (file 2)
      ├──→ parse-py (file 3)
      ├──→ parse-db (file 4)
      └──→ ...
            │
            ▼ (all parse jobs complete)
      graph-build OR graph-update
            │
            ▼
         metrics
            │
            ▼
      delete-workspace
            │
            ▼
       notifications
```

### 5.2 Completion Detection

The `ScanOrchestrator` tracks parse job completion using BullMQ's **flow producer** pattern:

1. Create a parent job (`repository-scan`).
2. Create child jobs (`repository-parse` × N) linked to the parent.
3. When all children complete, the parent's `onCompleted` callback fires.
4. The callback dispatches the next stage (`graph-build`).

Alternatively, if BullMQ flows are not used, completion detection uses:

1. Store total file count in the scan record.
2. Each parse job increments a counter (Redis `INCR`).
3. The last parse job to complete (counter == total) dispatches the graph build.

### 5.3 Blast Radius Orchestration Flow

```
blast-radius
     │
     ├──→ (query Memgraph for dependency data)
     ├──→ (invoke risk engine)
     ├──→ (store reports in PG)
     ├──→ (post GitHub comment)
     └──→ notifications
```

This is a single job with sequential steps, not a multi-job flow.

---

## 6. Monitoring

### 6.1 Queue Metrics

Each queue exposes the following metrics (via BullMQ's built-in introspection):

| Metric | Description |
|--------|-------------|
| `waiting` | Jobs waiting to be processed |
| `active` | Jobs currently being processed |
| `completed` | Jobs completed successfully |
| `failed` | Jobs that failed all retries |
| `delayed` | Jobs scheduled for future processing |
| `paused` | Jobs in paused queues |

### 6.2 Health Checks

The worker exposes health check endpoints (or logs):

| Check | Healthy Condition |
|-------|-------------------|
| Redis connection | Connected and responding to PING |
| Memgraph connection | Driver connected, session creatable |
| PG connection | Prisma client connected |
| Queue depth | Waiting jobs < 1000 per queue |
| Failed job rate | < 5% of total jobs in last hour |

---

*End of Queue Architecture. Continue to [10-event-architecture.md](./10-event-architecture.md) →*
