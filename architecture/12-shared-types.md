# SystemMapper — Shared Types Package

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Enums](#2-enums)
3. [Domain Interfaces](#3-domain-interfaces)
4. [DTOs](#4-dtos)
5. [Graph Types](#5-graph-types)
6. [Event Types](#6-event-types)
7. [Queue Payloads](#7-queue-payloads)
8. [Risk Report Types](#8-risk-report-types)
9. [Metric Types](#9-metric-types)
10. [Constants](#10-constants)
11. [Canonical IR Types](#11-canonical-ir-types)

---

## 1. Overview

The `@systemmapper/types` package is the **single source of truth** for all TypeScript types shared across the monorepo. It has **zero runtime dependencies** — it exports only type definitions, interfaces, enums, and constants.

**Design Rules:**
- No classes. Only interfaces and type aliases.
- No functions. Only type-level utilities.
- No runtime code. Only exports used at compile time (except enums and constants).
- No framework-specific types. No NestJS, no Prisma, no React types.

---

## 2. Enums

### 2.1 Core Enums

| Enum | Values | Usage |
|------|--------|-------|
| `Role` | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | Organization member roles |
| `ScanStatus` | `PENDING`, `QUEUED`, `SCANNING`, `PARSING`, `BUILDING_GRAPH`, `CALCULATING_METRICS`, `COMPLETED`, `FAILED`, `CANCELLED` | Scan lifecycle |
| `ScanTriggerType` | `MANUAL`, `WEBHOOK`, `SCHEDULED`, `RETRY` | What initiated the scan |
| `RiskLevel` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Risk classification |
| `PullRequestStatus` | `OPEN`, `CLOSED`, `MERGED` | PR lifecycle |
| `FileChangeStatus` | `ADDED`, `MODIFIED`, `REMOVED`, `RENAMED` | File change type in PRs |
| `NotificationType` | `SCAN_COMPLETE`, `SCAN_FAILED`, `HIGH_RISK_PR`, `MEMBER_INVITED`, `REPO_CONNECTED` | Notification categories |
| `Language` | `TYPESCRIPT`, `JAVASCRIPT`, `PYTHON`, `GO`, `JAVA`, `RUST`, `UNKNOWN` | Supported languages |
| `MetricType` | `FILE_COUNT`, `FUNCTION_COUNT`, `CLASS_COUNT`, `DEPENDENCY_COUNT`, `ARCHITECTURE_SCORE`, `TECHNICAL_DEBT_SCORE`, `COMPLEXITY_SCORE`, `DEPENDENCY_DENSITY`, `CIRCULAR_DEPENDENCY_COUNT` | Metric categories |
| `EventType` | `REPOSITORY_CONNECTED`, `REPOSITORY_QUEUED`, `REPOSITORY_PARSED`, `GRAPH_CREATED`, `GRAPH_UPDATED`, `SNAPSHOT_CREATED`, `PULL_REQUEST_OPENED`, `PULL_REQUEST_UPDATED`, `BLAST_RADIUS_CALCULATED`, `COMMENT_PUBLISHED`, `METRICS_CALCULATED`, `NOTIFICATION_SENT` | Domain events |
| `QueueName` | `REPOSITORY_SCAN`, `REPOSITORY_PARSE`, `GRAPH_BUILD`, `GRAPH_UPDATE`, `BLAST_RADIUS`, `METRICS`, `NOTIFICATIONS`, `CLEANUP`, `RETRY` | BullMQ queue names |
| `GraphNodeType` | `REPOSITORY`, `WORKSPACE`, `DIRECTORY`, `FILE`, `MODULE`, `PACKAGE`, `NAMESPACE`, `CLASS`, `INTERFACE`, `TYPE`, `ENUM`, `FUNCTION`, `METHOD`, `VARIABLE`, `API_ENDPOINT`, `DATABASE_TABLE`, `DATABASE_COLUMN`, `QUEUE`, `TOPIC`, `EXTERNAL_SERVICE`, `ENVIRONMENT_VARIABLE`, `CONFIGURATION` | Memgraph node labels |
| `GraphRelationType` | `IMPORTS`, `CALLS`, `USES`, `OWNS`, `DEPENDS_ON`, `IMPLEMENTS`, `EXTENDS`, `READS`, `WRITES`, `CONTAINS`, `CONNECTS_TO`, `AUTHENTICATES`, `QUERIES`, `EMITS`, `SUBSCRIBES`, `EXPOSES` | Memgraph relationship types |
| `AuditAction` | `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `SCAN_TRIGGERED`, `MEMBER_INVITED`, `MEMBER_REMOVED`, `SETTINGS_CHANGED` | Audit log actions |
| `WebhookEventStatus` | `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`, `IGNORED` | Webhook processing status |

---

## 3. Domain Interfaces

### 3.1 User Domain

```
IUser {
  id: string
  email: string
  githubId: number
  githubUsername: string
  displayName: string
  avatarUrl: string | null
}
```

### 3.2 Organization Domain

```
IOrganization {
  id: string
  name: string
  slug: string
  githubOrgId: number | null
  githubOrgName: string | null
  avatarUrl: string | null
}

IOrganizationMember {
  id: string
  userId: string
  organizationId: string
  role: Role
  user: IUser
}
```

### 3.3 Repository Domain

```
IRepository {
  id: string
  organizationId: string
  name: string
  fullName: string
  githubRepoId: number
  defaultBranch: string
  language: string | null
  description: string | null
  isActive: boolean
  lastScannedAt: string | null
  lastScanStatus: ScanStatus | null
}

IRepositoryScan {
  id: string
  repositoryId: string
  status: ScanStatus
  triggerType: ScanTriggerType
  branch: string
  commitSha: string | null
  totalFiles: number
  parsedFiles: number
  failedFiles: number
  skippedFiles: number
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  errorMessage: string | null
}
```

### 3.4 Pull Request Domain

```
IPullRequest {
  id: string
  repositoryId: string
  githubPrNumber: number
  title: string
  authorGithubUsername: string
  status: PullRequestStatus
  baseBranch: string
  headBranch: string
  riskScore: number | null
  riskLevel: RiskLevel | null
  commentId: string | null
}

IPullRequestFile {
  id: string
  pullRequestId: string
  filePath: string
  status: FileChangeStatus
  additions: number
  deletions: number
}
```

### 3.5 Architecture Domain

```
IArchitectureSnapshot {
  id: string
  repositoryId: string
  scanId: string
  nodeCount: number
  relationshipCount: number
  fileCount: number
  functionCount: number
  classCount: number
  architectureScore: number | null
  createdAt: string
}
```

---

## 4. DTOs

### 4.1 Request DTOs

```
CreateOrganizationDto {
  name: string
  slug: string
}

ConnectRepositoryDto {
  githubRepoId: number
  installationId: number
}

TriggerScanDto {
  branch?: string
}

CreateSavedViewDto {
  name: string
  graphConfig: Record<string, unknown>
  filters: Record<string, unknown>
}

UpdatePreferencesDto {
  theme?: 'light' | 'dark' | 'system'
  defaultGraphLayout?: string
  emailNotifications?: boolean
}

InviteMemberDto {
  email: string
  role: Role
}
```

### 4.2 Response DTOs

```
PaginatedResponse<T> {
  data: T[]
  meta: {
    pagination: PaginationMeta
    requestId: string
  }
}

PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

ApiResponse<T> {
  data: T
  meta: { requestId: string }
}

ApiError {
  error: {
    code: string
    message: string
    statusCode: number
    details?: unknown
  }
  meta: { requestId: string }
}
```

---

## 5. Graph Types

```
GraphNode {
  nodeId: string
  nodeType: GraphNodeType
  name: string
  filePath?: string
  repositoryId: string
  properties: Record<string, unknown>
}

GraphEdge {
  sourceId: string
  targetId: string
  relationType: GraphRelationType
  properties: Record<string, unknown>
}

DependencyGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  fileIndex: Record<string, GraphNode>
  adjacencyList: Record<string, string[]>
  reverseAdjacencyList: Record<string, string[]>
}

GraphVisualizationData {
  nodes: VisualizationNode[]
  edges: VisualizationEdge[]
  metadata: {
    totalNodes: number
    totalEdges: number
    depth: number
    layout: string
  }
}

VisualizationNode {
  id: string
  label: string
  type: GraphNodeType
  group: string
  metadata: Record<string, unknown>
}

VisualizationEdge {
  id: string
  source: string
  target: string
  type: GraphRelationType
  animated: boolean
}
```

---

## 6. Event Types

```
DomainEvent<T> {
  eventId: string
  eventType: EventType
  timestamp: string
  correlationId: string
  source: string
  payload: T
}

RepositoryConnectedPayload {
  repositoryId: string
  organizationId: string
  githubRepoId: number
  fullName: string
  installationId: number
}

BlastRadiusCalculatedPayload {
  repositoryId: string
  pullRequestId: string
  riskReportId: string
  riskScore: number
  riskLevel: RiskLevel
  affectedFileCount: number
}

// (Other event payloads follow the same pattern per 10-event-architecture.md)
```

---

## 7. Queue Payloads

```
ScanJobPayload {
  repositoryId: string
  scanId: string
  branch: string
  commitSha: string | null
  triggerType: ScanTriggerType
  installationId: number
}

ParseJobPayload {
  repositoryId: string
  scanId: string
  filePath: string
  content: string
  language: Language
  contentHash: string
}

GraphBuildJobPayload {
  repositoryId: string
  scanId: string
  parsedFileCount: number
}

GraphUpdateJobPayload {
  repositoryId: string
  scanId: string
  changedFiles: string[]
  deletedFiles: string[]
  addedFiles: string[]
}

BlastRadiusJobPayload {
  repositoryId: string
  pullRequestId: string
  changedFiles: ChangedFile[]
  installationId: number
}

MetricsJobPayload {
  repositoryId: string
  scanId: string
  snapshotId: string
}

NotificationJobPayload {
  userId: string
  organizationId: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  metadata: Record<string, unknown>
}

CleanupJobPayload {
  cleanupType: 'webhook_events' | 'job_history' | 'notifications' | 'health_check'
}

RetryJobPayload {
  originalQueue: QueueName
  originalJobId: string
  originalPayload: unknown
  retryReason: string
}
```

---

## 8. Risk Report Types

```
RiskReport {
  repositoryId: string
  analyzedAt: string
  riskScore: number
  riskLevel: RiskLevel
  blastRadius: BlastRadiusResult
  dependencyAnalysis: DependencyAnalysisResult
  circularDependencies: CircularDependencyResult
  architectureViolations: ArchitectureViolationResult
  criticalPath: CriticalPathResult
  reviewerSuggestions: ReviewerSuggestionResult
  scoring: RiskScoringResult
  changedFiles: ChangedFile[]
  options: AnalysisOptions
}

BlastRadiusResult {
  affectedFiles: AffectedFile[]
  totalAffectedNodes: number
  maxDepth: number
  dependencyChains: DependencyChain[]
}

AffectedFile {
  filePath: string
  distance: number
  weight: number
  affectedComponents: string[]
}

ChangedFile {
  filePath: string
  status: FileChangeStatus
  additions: number
  deletions: number
  previousPath?: string
}

RiskScoringResult {
  overallScore: number
  riskLevel: RiskLevel
  subScores: SubScore[]
  explanation: string
}

SubScore {
  name: string
  score: number
  weight: number
  weightedScore: number
}
```

---

## 9. Metric Types

```
MetricSnapshot {
  repositoryId: string
  measuredAt: string
  metrics: MetricValue[]
}

MetricValue {
  type: MetricType
  value: number
  unit: string
}

MetricTimeSeries {
  type: MetricType
  dataPoints: MetricDataPoint[]
}

MetricDataPoint {
  timestamp: string
  value: number
}

MetricTrend {
  type: MetricType
  direction: 'improving' | 'declining' | 'stable'
  changePercent: number
  currentValue: number
  previousValue: number
}
```

---

## 10. Constants

```
RISK_SCORE_WEIGHTS = {
  blastRadius: 0.30,
  dependencyCoupling: 0.20,
  circularDependencies: 0.15,
  architectureViolations: 0.15,
  criticalPath: 0.10,
  changeSize: 0.10,
}

DEFAULT_ANALYSIS_OPTIONS = {
  maxTraversalDepth: 5,
  decayFactor: 0.7,
  reviewerSuggestionLimit: 3,
}

MAX_FILE_SIZE_BYTES = 1_048_576  // 1 MB
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20
SCAN_TIMEOUT_MS = 300_000  // 5 minutes
PARSE_TIMEOUT_MS = 30_000  // 30 seconds
GRAPH_BUILD_TIMEOUT_MS = 600_000  // 10 minutes
```

## 11. Canonical IR Types

```
CanonicalNode {
  type: GraphNodeType
  name: string
  location: SourceLocation
  modifiers: string[]
  metadata: Record<string, unknown>
}

SourceLocation {
  filePath: string
  startLine: number
  endLine: number
}

CanonicalEdge {
  sourceType: GraphNodeType
  sourceName: string
  targetType: GraphNodeType
  targetName: string
  relationType: GraphRelationType
  isDynamic: boolean
}

CanonicalIR {
  nodes: CanonicalNode[]
  edges: CanonicalEdge[]
}
```

---

*End of Shared Types Package. Continue to [13-folder-structure.md](./13-folder-structure.md) →*
