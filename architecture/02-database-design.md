# SystemMapper — Database Design

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Enumerations](#3-enumerations)
4. [Models](#4-models)
5. [Migration Strategy](#5-migration-strategy)
6. [Future Scalability](#6-future-scalability)

---

## 1. Overview

SystemMapper uses **Supabase PostgreSQL** as its primary relational database, accessed exclusively through **Prisma ORM**. The database stores all business metadata, user data, organizational structures, scan history, metrics, and operational state. It does NOT store the dependency graph (that lives in Memgraph) or parsed AST data (that is transient, processed, and stored as graph nodes).

### 1.1 Design Conventions

Every model follows these conventions:

| Convention | Implementation |
|-----------|---------------|
| Primary Key | `id` — UUID, auto-generated (`uuid()` default) |
| Timestamps | `createdAt` (DateTime, default `now()`), `updatedAt` (DateTime, `@updatedAt`) |
| Soft Deletes | `deletedAt` (DateTime?, nullable, null = active) |
| Foreign Keys | Named explicitly, cascading defined per relationship |
| Indexes | On all foreign keys, frequently queried fields, and composite lookups |
| Unique Constraints | On natural keys (email, slug, external IDs) |
| Naming | camelCase for fields, PascalCase for models, UPPER_SNAKE_CASE for enums |

---

## 2. Design Principles

### 2.1 Source of Truth

PostgreSQL is the **authoritative source of truth** for:

- All user and organizational data
- All repository metadata
- All scan history and job tracking
- All metrics and analytics data
- All configuration and settings
- All audit and compliance data

Memgraph mirrors a subset of this data (repository structure, file metadata) but PostgreSQL IDs are always the canonical identifiers.

### 2.2 Referential Integrity

All relationships use Prisma's `@relation` directive with explicit `onDelete` and `onUpdate` actions:

- **Cascade:** When deleting a parent, cascade to children (e.g., deleting an organization cascades to its members).
- **SetNull:** When deleting a referenced entity, set the FK to null (e.g., deleting a user sets `createdById` to null on their audit logs).
- **Restrict:** Prevent deletion if references exist (e.g., cannot delete a repository with active scans).

### 2.3 Soft Deletes

Most entities use soft deletes (`deletedAt` field). Hard deletes are reserved for:

- Webhook events (after processing)
- Job history (after retention period)
- Temporary data

All repository queries must filter by `deletedAt IS NULL` unless explicitly including deleted records. This is enforced via Prisma middleware.

---

## 3. Enumerations

### 3.1 `Role`

**Purpose:** Defines user roles within an organization.

| Value | Description |
|-------|-------------|
| `OWNER` | Organization creator, full admin rights, cannot be removed |
| `ADMIN` | Full admin rights, can manage members and settings |
| `MEMBER` | Standard access, can view and interact with repositories |
| `VIEWER` | Read-only access to repositories and dashboards |

### 3.2 `ScanStatus`

**Purpose:** Tracks the lifecycle of a repository scan.

| Value | Description |
|-------|-------------|
| `PENDING` | Scan has been queued but not yet started |
| `SCANNING` | File tree is being fetched from GitHub |
| `PARSING` | Source files are being parsed into ASTs |
| `BUILDING_GRAPH` | Dependency graph is being constructed in Memgraph |
| `CALCULATING_METRICS` | Metrics are being computed |
| `COMPLETED` | Scan finished successfully |
| `FAILED` | Scan failed with an error |
| `CANCELLED` | Scan was cancelled by user |

### 3.3 `JobStatus`

**Purpose:** Tracks individual background job lifecycle.

| Value | Description |
|-------|-------------|
| `QUEUED` | Job is in the queue |
| `ACTIVE` | Job is currently being processed |
| `COMPLETED` | Job finished successfully |
| `FAILED` | Job failed after all retries |
| `RETRYING` | Job failed and is being retried |
| `DEAD_LETTER` | Job moved to Dead Letter Queue |

### 3.4 `RiskLevel`

**Purpose:** Classifies the risk severity of a blast radius analysis.

| Value | Description |
|-------|-------------|
| `LOW` | Risk score 0–25. Minimal downstream impact. |
| `MEDIUM` | Risk score 26–50. Moderate downstream impact. |
| `HIGH` | Risk score 51–75. Significant downstream impact. |
| `CRITICAL` | Risk score 76–100. Extensive downstream impact. |

### 3.5 `NotificationType`

**Purpose:** Categorizes notification types.

| Value | Description |
|-------|-------------|
| `SCAN_COMPLETED` | Repository scan finished |
| `SCAN_FAILED` | Repository scan failed |
| `BLAST_RADIUS_HIGH` | High-risk blast radius detected |
| `BLAST_RADIUS_CRITICAL` | Critical-risk blast radius detected |
| `PR_COMMENT_POSTED` | Blast radius comment posted to PR |
| `REPOSITORY_CONNECTED` | New repository connected |
| `MEMBER_INVITED` | New member invited to organization |
| `ARCHITECTURE_VIOLATION` | Architecture violation detected |

### 3.6 `WebhookEventType`

**Purpose:** Tracks GitHub webhook event types.

| Value | Description |
|-------|-------------|
| `INSTALLATION` | App installed/uninstalled |
| `INSTALLATION_REPOSITORIES` | Repositories added/removed from installation |
| `PUSH` | Code pushed to branch |
| `PULL_REQUEST` | PR opened/updated/closed/merged |
| `PULL_REQUEST_REVIEW` | Review submitted on PR |

### 3.7 `Language`

**Purpose:** Enumerates supported programming languages.

| Value | Description |
|-------|-------------|
| `TYPESCRIPT` | TypeScript (.ts, .tsx) |
| `JAVASCRIPT` | JavaScript (.js, .jsx) |
| `PYTHON` | Python (.py) |
| `GO` | Go (.go) |
| `JAVA` | Java (.java) |
| `RUST` | Rust (.rs) |
| `UNKNOWN` | Unrecognized language |

### 3.8 `AuditAction`

**Purpose:** Categorizes audit log actions.

| Value | Description |
|-------|-------------|
| `CREATE` | Entity created |
| `UPDATE` | Entity updated |
| `DELETE` | Entity deleted |
| `LOGIN` | User logged in |
| `LOGOUT` | User logged out |
| `INVITE` | User invited |
| `REVOKE` | Access revoked |
| `SCAN_TRIGGERED` | Scan manually triggered |
| `SETTINGS_CHANGED` | Settings modified |
| `PERMISSION_CHANGED` | Permissions updated |

### 3.9 `MetricType`

**Purpose:** Categorizes the type of metric stored.

| Value | Description |
|-------|-------------|
| `FILE_COUNT` | Total number of files |
| `FUNCTION_COUNT` | Total number of functions |
| `CLASS_COUNT` | Total number of classes |
| `DEPENDENCY_COUNT` | Total number of dependencies |
| `CIRCULAR_DEPENDENCY_COUNT` | Number of circular dependencies |
| `AVG_DEPENDENCY_DEPTH` | Average dependency chain depth |
| `MAX_DEPENDENCY_DEPTH` | Maximum dependency chain depth |
| `ORPHAN_FILE_COUNT` | Files with no dependencies |
| `ARCHITECTURE_SCORE` | Overall architecture health (0-100) |
| `TECHNICAL_DEBT_SCORE` | Technical debt level (0-100) |
| `DEPENDENCY_DENSITY` | Dependency density ratio |
| `COMPLEXITY_SCORE` | Code complexity score |

### 3.10 `FeatureFlagType`

**Purpose:** Classifies feature flag types.

| Value | Description |
|-------|-------------|
| `BOOLEAN` | Simple on/off flag |
| `PERCENTAGE` | Percentage-based rollout |
| `USER_LIST` | Enabled for specific users |

### 3.11 `IntegrationType`

**Purpose:** Categorizes external integrations.

| Value | Description |
|-------|-------------|
| `GITHUB` | GitHub integration |
| `SLACK` | Slack notifications (future) |
| `JIRA` | Jira integration (future) |

---

## 4. Models

### 4.1 `User`

**Purpose:** Represents an authenticated user of the platform. Users authenticate via Supabase Auth (GitHub OAuth) and are linked to Supabase's `auth.users` table via `supabaseUserId`.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `supabaseUserId` | String | `@unique` | Link to Supabase auth.users |
| `email` | String | `@unique` | User's email address |
| `displayName` | String? | nullable | User's display name |
| `avatarUrl` | String? | nullable | URL to user's avatar |
| `githubUsername` | String? | `@unique` | GitHub username |
| `githubId` | Int? | `@unique` | GitHub numeric user ID |
| `lastLoginAt` | DateTime? | nullable | Last login timestamp |
| `isActive` | Boolean | `@default(true)` | Whether the account is active |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |
| `deletedAt` | DateTime? | nullable | Soft delete timestamp |

**Relationships:**

- Has many `OrganizationMember` (user can belong to multiple organizations)
- Has many `Notification` (user receives notifications)
- Has many `AuditLog` (user actions are logged)
- Has many `ApiKey` (user can create API keys)
- Has many `UserPreference` (user settings)
- Has many `SavedView` (saved architecture views)
- Has many `Comment` (user comments)

**Indexes:**

- `@@index([email])` — Fast email lookups
- `@@index([githubUsername])` — Fast GitHub username lookups
- `@@index([supabaseUserId])` — Fast auth lookups
- `@@index([deletedAt])` — Soft delete filtering

**Design Reasoning:** The `supabaseUserId` field links this user record to Supabase Auth's internal user table. This separation allows the application to maintain its own user metadata while delegating authentication entirely to Supabase. The `githubId` is stored as an integer matching GitHub's numeric user IDs, enabling fast lookups when processing webhook events.

---

### 4.2 `Organization`

**Purpose:** Represents a team or company that groups users and repositories. Organizations are the primary multi-tenancy boundary.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `name` | String | — | Display name |
| `slug` | String | `@unique` | URL-friendly identifier |
| `description` | String? | nullable | Organization description |
| `avatarUrl` | String? | nullable | Organization logo URL |
| `githubOrgLogin` | String? | `@unique` | GitHub organization login name |
| `githubOrgId` | Int? | `@unique` | GitHub numeric org ID |
| `plan` | String | `@default("free")` | Subscription plan (future) |
| `maxRepositories` | Int | `@default(10)` | Max repos allowed |
| `maxMembers` | Int | `@default(5)` | Max members allowed |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |
| `deletedAt` | DateTime? | nullable | Soft delete timestamp |

**Relationships:**

- Has many `OrganizationMember` (members of the organization)
- Has many `Repository` (repositories belonging to the org)
- Has many `GitHubInstallation` (GitHub App installations)
- Has many `ApiKey` (org-level API keys)
- Has many `AuditLog` (org-level audit trail)
- Has many `FeatureFlag` (org-level feature flags)

**Indexes:**

- `@@index([slug])` — Fast slug lookups
- `@@index([githubOrgLogin])` — Fast GitHub org lookups
- `@@index([deletedAt])` — Soft delete filtering

**Design Reasoning:** The `slug` provides human-readable URLs (`/orgs/my-company/...`). The `maxRepositories` and `maxMembers` fields support future plan-based limits. The `githubOrgLogin` links this organization to a GitHub organization, enabling automatic repository discovery when the GitHub App is installed on the org.

---

### 4.3 `OrganizationMember`

**Purpose:** Join table representing a user's membership in an organization, including their role.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String | FK → Organization | The organization |
| `userId` | String | FK → User | The user |
| `role` | Role (enum) | `@default(MEMBER)` | User's role in the org |
| `invitedBy` | String? | FK → User, nullable | Who invited this member |
| `invitedAt` | DateTime | `@default(now())` | When the invite was sent |
| `acceptedAt` | DateTime? | nullable | When the invite was accepted |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade)
- Belongs to `User` (onDelete: Cascade)
- Belongs to `User` as inviter (onDelete: SetNull)

**Indexes:**

- `@@unique([organizationId, userId])` — User can only be in an org once
- `@@index([organizationId])` — List members of an org
- `@@index([userId])` — List orgs a user belongs to

**Design Reasoning:** This is a many-to-many join table with additional metadata (role, invitation tracking). The composite unique constraint prevents duplicate memberships. Cascading delete on both `Organization` and `User` ensures cleanup when either entity is removed.

---

### 4.4 `Repository`

**Purpose:** Represents a GitHub repository that has been onboarded into SystemMapper.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String | FK → Organization | Owning organization |
| `name` | String | — | Repository name |
| `fullName` | String | — | GitHub full name (owner/repo) |
| `description` | String? | nullable | Repository description |
| `githubRepoId` | Int | `@unique` | GitHub numeric repo ID |
| `githubUrl` | String | — | GitHub URL |
| `defaultBranch` | String | `@default("main")` | Default branch name |
| `language` | String? | nullable | Primary language |
| `isPrivate` | Boolean | `@default(false)` | Whether the repo is private |
| `isActive` | Boolean | `@default(true)` | Whether scanning is active |
| `lastScannedAt` | DateTime? | nullable | Last successful scan timestamp |
| `lastScanId` | String? | nullable | FK → RepositoryScan |
| `fileCount` | Int | `@default(0)` | Current file count |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |
| `deletedAt` | DateTime? | nullable | Soft delete timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade)
- Has many `RepositoryScan` (scan history)
- Has many `ArchitectureSnapshot` (architecture history)
- Has many `PullRequest` (tracked PRs)
- Has many `Branch` (tracked branches)
- Has many `Commit` (tracked commits)
- Has many `RepositorySetting` (per-repo settings)
- Has many `RiskReport` (risk analysis results)
- Has many `BlastRadiusReport` (blast radius results)
- Has many `Metric` (repository metrics)
- Has many `ParserMetadata` (parser state)
- Has many `RepositoryPermission` (access control)
- Has one `RepositoryInstallation` (GitHub App installation link)
- Has many `SavedView` (saved architecture views)
- Has many `Comment` (discussion comments)
- Has many `RepositoryIntegration` (external integrations)

**Indexes:**

- `@@unique([organizationId, githubRepoId])` — Repo unique within org
- `@@index([organizationId])` — List repos in an org
- `@@index([githubRepoId])` — Lookup by GitHub ID
- `@@index([fullName])` — Lookup by full name
- `@@index([lastScannedAt])` — Sort by last scan
- `@@index([deletedAt])` — Soft delete filtering

**Design Reasoning:** The `fullName` field stores the GitHub `owner/repo` format for display and webhook matching. The `lastScannedAt` and `lastScanId` fields provide quick access to the most recent scan without querying the scans table. The `fileCount` is denormalized for dashboard performance.

---

### 4.5 `RepositoryInstallation`

**Purpose:** Links a repository to a GitHub App installation, tracking which installation provides access to which repository.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository, `@unique` | The repository |
| `installationId` | String | FK → GitHubInstallation | The GitHub installation |
| `isActive` | Boolean | `@default(true)` | Whether the installation is active |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `GitHubInstallation` (onDelete: Cascade)

**Indexes:**

- `@@index([installationId])` — List repos for an installation
- `@@index([repositoryId])` — Lookup installation for a repo

**Design Reasoning:** This is a join table between repositories and GitHub installations. A repository has exactly one installation (enforced by `@unique` on `repositoryId`), but an installation can cover many repositories.

---

### 4.6 `GitHubInstallation`

**Purpose:** Represents a GitHub App installation on a user's account or organization.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String | FK → Organization | Owning organization in SystemMapper |
| `githubInstallationId` | Int | `@unique` | GitHub's numeric installation ID |
| `githubAccountLogin` | String | — | GitHub account login name |
| `githubAccountId` | Int | — | GitHub account numeric ID |
| `githubAccountType` | String | — | "User" or "Organization" |
| `accessTokensUrl` | String | — | GitHub API URL for access tokens |
| `repositorySelection` | String | — | "all" or "selected" |
| `permissions` | Json | — | Granted permissions object |
| `events` | Json | — | Subscribed events array |
| `isActive` | Boolean | `@default(true)` | Whether the installation is active |
| `suspendedAt` | DateTime? | nullable | When the installation was suspended |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade)
- Has many `RepositoryInstallation` (repos using this installation)

**Indexes:**

- `@@index([githubInstallationId])` — Lookup by GitHub installation ID
- `@@index([organizationId])` — List installations for an org
- `@@index([githubAccountLogin])` — Lookup by GitHub account

**Design Reasoning:** The `permissions` and `events` fields are stored as JSON because their structure is defined by GitHub and may change. The `suspendedAt` field tracks GitHub-initiated suspension events. The `repositorySelection` field indicates whether the installation covers all repos or only selected ones.

---

### 4.7 `RepositoryScan`

**Purpose:** Tracks the lifecycle and results of a repository scan operation. Each scan is a complete snapshot of the parsing and graph building process.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository being scanned |
| `status` | ScanStatus (enum) | `@default(PENDING)` | Current scan status |
| `branch` | String | — | Branch being scanned |
| `commitSha` | String | — | Commit SHA at scan time |
| `triggerType` | String | — | "manual", "webhook", "schedule" |
| `triggeredBy` | String? | FK → User, nullable | User who triggered (if manual) |
| `totalFiles` | Int | `@default(0)` | Total files discovered |
| `parsedFiles` | Int | `@default(0)` | Files successfully parsed |
| `failedFiles` | Int | `@default(0)` | Files that failed parsing |
| `skippedFiles` | Int | `@default(0)` | Files skipped (unsupported language) |
| `nodesCreated` | Int | `@default(0)` | Graph nodes created |
| `relationshipsCreated` | Int | `@default(0)` | Graph relationships created |
| `durationMs` | Int? | nullable | Total scan duration in milliseconds |
| `errorMessage` | String? | nullable | Error details if failed |
| `errorStack` | String? | nullable | Error stack trace if failed |
| `startedAt` | DateTime? | nullable | When scanning began |
| `completedAt` | DateTime? | nullable | When scanning finished |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `User` as triggeredBy (onDelete: SetNull)
- Has many `ScanJob` (individual job records within the scan)
- Has one `ArchitectureSnapshot` (snapshot created at end of scan)

**Indexes:**

- `@@index([repositoryId])` — List scans for a repo
- `@@index([repositoryId, status])` — Find active scans
- `@@index([commitSha])` — Lookup scan by commit
- `@@index([createdAt])` — Sort by recency
- `@@index([status])` — Filter by status

**Design Reasoning:** The scan model tracks granular progress metrics (`totalFiles`, `parsedFiles`, `failedFiles`, `skippedFiles`) to support progress reporting in the UI. The `triggerType` field distinguishes between manual, webhook-triggered, and scheduled scans for audit purposes. The `durationMs` field enables performance monitoring.

---

### 4.8 `ArchitectureSnapshot`

**Purpose:** Represents a point-in-time snapshot of a repository's architecture. Snapshots enable historical comparison and evolution tracking.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this snapshot belongs to |
| `scanId` | String | FK → RepositoryScan, `@unique` | Scan that created this snapshot |
| `branch` | String | — | Branch at snapshot time |
| `commitSha` | String | — | Commit SHA at snapshot time |
| `graphVersion` | String | — | Graph schema version |
| `nodeCount` | Int | — | Total nodes in the graph at this point |
| `relationshipCount` | Int | — | Total relationships at this point |
| `fileCount` | Int | — | Total files at this point |
| `functionCount` | Int | — | Total functions at this point |
| `classCount` | Int | — | Total classes at this point |
| `dependencyCount` | Int | — | Total dependencies at this point |
| `circularDependencyCount` | Int | — | Circular dependencies at this point |
| `architectureScore` | Float? | nullable | Architecture health score (0-100) |
| `metadata` | Json? | nullable | Additional snapshot metadata |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `RepositoryScan` (onDelete: Cascade)

**Indexes:**

- `@@index([repositoryId])` — List snapshots for a repo
- `@@index([repositoryId, createdAt])` — Chronological snapshots
- `@@index([commitSha])` — Lookup snapshot by commit

**Design Reasoning:** Snapshots capture aggregate metrics at a point in time, enabling trend analysis without re-querying the graph. The `graphVersion` field tracks the schema version of the Memgraph graph, enabling migration-aware comparisons. The `metadata` JSON field allows storing additional context without schema changes.

---

### 4.9 `PullRequest`

**Purpose:** Tracks GitHub Pull Requests that have been analyzed by SystemMapper.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this PR belongs to |
| `githubPrId` | Int | — | GitHub's numeric PR ID |
| `githubPrNumber` | Int | — | PR number (e.g., #42) |
| `title` | String | — | PR title |
| `body` | String? | nullable | PR description |
| `state` | String | — | "open", "closed", "merged" |
| `authorGithubLogin` | String | — | PR author's GitHub login |
| `authorGithubId` | Int? | nullable | PR author's GitHub ID |
| `baseBranch` | String | — | Target branch |
| `headBranch` | String | — | Source branch |
| `headSha` | String | — | Latest commit SHA on the PR |
| `changedFilesCount` | Int | `@default(0)` | Number of files changed |
| `additions` | Int | `@default(0)` | Lines added |
| `deletions` | Int | `@default(0)` | Lines deleted |
| `commentId` | String? | nullable | GitHub comment ID (posted by SystemMapper) |
| `lastAnalyzedAt` | DateTime? | nullable | Last blast radius analysis time |
| `githubUrl` | String | — | GitHub PR URL |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Has many `PullRequestFile` (files changed in the PR)
- Has many `BlastRadiusReport` (blast radius analyses)

**Indexes:**

- `@@unique([repositoryId, githubPrNumber])` — PR unique within repo
- `@@index([repositoryId])` — List PRs for a repo
- `@@index([repositoryId, state])` — Filter PRs by state
- `@@index([headSha])` — Lookup PR by commit
- `@@index([createdAt])` — Sort by recency

**Design Reasoning:** The `commentId` field stores the GitHub comment ID so that subsequent analyses can update the existing comment rather than posting a new one. The `changedFilesCount`, `additions`, and `deletions` are denormalized from GitHub for dashboard display.

---

### 4.10 `PullRequestFile`

**Purpose:** Records individual files changed in a Pull Request, with change type and line counts.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `pullRequestId` | String | FK → PullRequest | Parent PR |
| `filename` | String | — | File path within the repo |
| `status` | String | — | "added", "modified", "removed", "renamed" |
| `additions` | Int | `@default(0)` | Lines added in this file |
| `deletions` | Int | `@default(0)` | Lines deleted in this file |
| `previousFilename` | String? | nullable | Previous name if renamed |
| `patch` | String? | nullable | File diff (truncated for large files) |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `PullRequest` (onDelete: Cascade)

**Indexes:**

- `@@index([pullRequestId])` — List files for a PR
- `@@index([filename])` — Lookup by filename
- `@@unique([pullRequestId, filename])` — File unique within PR

**Design Reasoning:** Storing individual file changes enables the blast radius engine to precisely identify which graph nodes are affected by a PR. The `previousFilename` field handles renames, which the graph must process as a node move operation.

---

### 4.11 `Commit`

**Purpose:** Tracks commits relevant to scans and PRs. Not every commit in the repository is stored — only those associated with scans or PR analyses.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this commit belongs to |
| `sha` | String | — | Full commit SHA |
| `message` | String | — | Commit message (first line) |
| `authorName` | String | — | Commit author name |
| `authorEmail` | String | — | Commit author email |
| `authorGithubLogin` | String? | nullable | Author's GitHub login |
| `committedAt` | DateTime | — | When the commit was made |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)

**Indexes:**

- `@@unique([repositoryId, sha])` — Commit unique within repo
- `@@index([repositoryId])` — List commits for a repo
- `@@index([sha])` — Lookup by SHA
- `@@index([committedAt])` — Sort chronologically

---

### 4.12 `Branch`

**Purpose:** Tracks branches in a repository that have been scanned or are associated with PRs.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this branch belongs to |
| `name` | String | — | Branch name |
| `headSha` | String | — | Current HEAD commit SHA |
| `isDefault` | Boolean | `@default(false)` | Whether this is the default branch |
| `isProtected` | Boolean | `@default(false)` | Whether the branch is protected |
| `lastScannedAt` | DateTime? | nullable | Last scan on this branch |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)

**Indexes:**

- `@@unique([repositoryId, name])` — Branch unique within repo
- `@@index([repositoryId])` — List branches for a repo

---

### 4.13 `RepositorySetting`

**Purpose:** Stores per-repository configuration settings as key-value pairs.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository these settings belong to |
| `key` | String | — | Setting key |
| `value` | String | — | Setting value (stored as string, parsed by consumer) |
| `description` | String? | nullable | Human-readable setting description |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)

**Indexes:**

- `@@unique([repositoryId, key])` — Setting unique per repo
- `@@index([repositoryId])` — List settings for a repo

**Design Reasoning:** Key-value pairs provide flexibility for adding new settings without schema migrations. Common settings include: `auto_scan_enabled`, `scan_branch`, `excluded_paths`, `max_depth`, `pr_comment_enabled`, `risk_threshold`.

---

### 4.14 `RiskReport`

**Purpose:** Stores the results of a risk analysis run, including the overall risk score and risk level. This is the parent record for all risk-related data.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository analyzed |
| `pullRequestId` | String? | FK → PullRequest, nullable | Associated PR (if triggered by PR) |
| `scanId` | String? | FK → RepositoryScan, nullable | Associated scan |
| `riskScore` | Float | — | Overall risk score (0-100) |
| `riskLevel` | RiskLevel (enum) | — | Classified risk level |
| `totalAffectedFiles` | Int | `@default(0)` | Files in blast radius |
| `totalAffectedFunctions` | Int | `@default(0)` | Functions in blast radius |
| `totalAffectedClasses` | Int | `@default(0)` | Classes in blast radius |
| `maxDependencyDepth` | Int | `@default(0)` | Deepest dependency chain |
| `circularDependenciesFound` | Int | `@default(0)` | Circular dependencies in blast radius |
| `architectureViolationsFound` | Int | `@default(0)` | Architecture violations found |
| `criticalPathsFound` | Int | `@default(0)` | Critical paths found |
| `suggestedReviewers` | Json? | nullable | Suggested reviewer list |
| `metadata` | Json? | nullable | Additional analysis metadata |
| `analyzedAt` | DateTime | `@default(now())` | When analysis was performed |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `PullRequest` (onDelete: SetNull)
- Belongs to `RepositoryScan` (onDelete: SetNull)
- Has many `BlastRadiusReport` (detailed blast radius data)

**Indexes:**

- `@@index([repositoryId])` — List reports for a repo
- `@@index([pullRequestId])` — List reports for a PR
- `@@index([riskLevel])` — Filter by risk level
- `@@index([analyzedAt])` — Sort by analysis time

---

### 4.15 `BlastRadiusReport`

**Purpose:** Stores the detailed blast radius analysis for a specific set of changed files.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `riskReportId` | String | FK → RiskReport | Parent risk report |
| `repositoryId` | String | FK → Repository | Repository analyzed |
| `pullRequestId` | String? | FK → PullRequest, nullable | Associated PR |
| `changedFiles` | Json | — | Array of changed file paths |
| `affectedFiles` | Json | — | Array of affected file objects |
| `affectedFunctions` | Json | — | Array of affected function objects |
| `affectedClasses` | Json | — | Array of affected class objects |
| `dependencyChains` | Json | — | Dependency chain data |
| `impactSummary` | Json | — | Summary of impacts by type |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `RiskReport` (onDelete: Cascade)
- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `PullRequest` (onDelete: SetNull)

**Indexes:**

- `@@index([riskReportId])` — Lookup by risk report
- `@@index([repositoryId])` — List blast radius data for a repo
- `@@index([pullRequestId])` — Lookup blast radius for a PR

**Design Reasoning:** The blast radius data is stored as JSON because its structure is complex and variable — the number of affected components differs per analysis. Using JSON avoids a highly normalized schema with many join tables that would be expensive to query for display.

---

### 4.16 `ScanJob`

**Purpose:** Tracks individual background jobs within a scan operation. A single scan consists of many jobs (one per file, plus graph building, metrics, etc.).

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `scanId` | String | FK → RepositoryScan | Parent scan |
| `queueName` | String | — | BullMQ queue name |
| `jobId` | String | — | BullMQ job ID |
| `status` | JobStatus (enum) | `@default(QUEUED)` | Current job status |
| `payload` | Json | — | Job input payload |
| `result` | Json? | nullable | Job output result |
| `errorMessage` | String? | nullable | Error details if failed |
| `attempts` | Int | `@default(0)` | Number of attempts |
| `maxAttempts` | Int | `@default(3)` | Maximum retry attempts |
| `startedAt` | DateTime? | nullable | When processing began |
| `completedAt` | DateTime? | nullable | When processing finished |
| `durationMs` | Int? | nullable | Processing duration |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `RepositoryScan` (onDelete: Cascade)

**Indexes:**

- `@@index([scanId])` — List jobs for a scan
- `@@index([scanId, status])` — Find active/failed jobs
- `@@index([queueName])` — Filter by queue
- `@@index([jobId])` — Lookup by BullMQ ID

---

### 4.17 `JobHistory`

**Purpose:** Historical record of all processed jobs, kept for a retention period for debugging and performance monitoring.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `queueName` | String | — | BullMQ queue name |
| `jobId` | String | — | BullMQ job ID |
| `status` | JobStatus (enum) | — | Final job status |
| `payload` | Json | — | Job input payload |
| `result` | Json? | nullable | Job output result |
| `errorMessage` | String? | nullable | Error details |
| `attempts` | Int | — | Total attempts |
| `durationMs` | Int? | nullable | Total processing time |
| `processedAt` | DateTime | `@default(now())` | When the job finished |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Indexes:**

- `@@index([queueName])` — Filter by queue
- `@@index([status])` — Filter by status
- `@@index([processedAt])` — Sort by processing time
- `@@index([createdAt])` — Retention cleanup

**Design Reasoning:** JobHistory is separated from ScanJob because it persists beyond the scan lifecycle. Old job history records are purged by the cleanup queue based on a retention policy (e.g., 30 days).

---

### 4.18 `WebhookEvent`

**Purpose:** Records incoming GitHub webhook events for auditability and debugging.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `githubDeliveryId` | String | `@unique` | GitHub's delivery UUID |
| `eventType` | WebhookEventType (enum) | — | Type of webhook event |
| `action` | String | — | Event action (e.g., "opened") |
| `repositoryId` | String? | FK → Repository, nullable | Associated repository |
| `installationId` | Int? | nullable | GitHub installation ID |
| `payload` | Json | — | Raw webhook payload |
| `processed` | Boolean | `@default(false)` | Whether the event was processed |
| `processedAt` | DateTime? | nullable | When the event was processed |
| `errorMessage` | String? | nullable | Error if processing failed |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: SetNull)

**Indexes:**

- `@@index([eventType])` — Filter by event type
- `@@index([processed])` — Find unprocessed events
- `@@index([githubDeliveryId])` — Idempotency check
- `@@index([createdAt])` — Sort chronologically

**Design Reasoning:** The `githubDeliveryId` ensures idempotent processing — if a webhook is delivered twice, the second delivery is detected and skipped. The full `payload` is stored for debugging and replay capabilities.

---

### 4.19 `Notification`

**Purpose:** In-app notifications for users about scan completions, risk alerts, and system events.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `userId` | String | FK → User | Recipient user |
| `organizationId` | String | FK → Organization | Organization context |
| `type` | NotificationType (enum) | — | Notification category |
| `title` | String | — | Notification title |
| `message` | String | — | Notification body |
| `link` | String? | nullable | Deep link URL |
| `metadata` | Json? | nullable | Additional data |
| `isRead` | Boolean | `@default(false)` | Whether the user has read it |
| `readAt` | DateTime? | nullable | When the user read it |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `User` (onDelete: Cascade)
- Belongs to `Organization` (onDelete: Cascade)

**Indexes:**

- `@@index([userId])` — List notifications for a user
- `@@index([userId, isRead])` — Unread notifications
- `@@index([createdAt])` — Sort chronologically

---

### 4.20 `AuditLog`

**Purpose:** Immutable audit trail of all significant actions performed in the system.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String | FK → Organization | Organization context |
| `userId` | String? | FK → User, nullable | Acting user (null for system actions) |
| `action` | AuditAction (enum) | — | Action performed |
| `entityType` | String | — | Type of entity affected |
| `entityId` | String | — | ID of entity affected |
| `previousValues` | Json? | nullable | State before change |
| `newValues` | Json? | nullable | State after change |
| `ipAddress` | String? | nullable | Client IP address |
| `userAgent` | String? | nullable | Client user agent |
| `correlationId` | String? | nullable | Request correlation ID |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade)
- Belongs to `User` (onDelete: SetNull)

**Indexes:**

- `@@index([organizationId])` — List logs for an org
- `@@index([userId])` — List logs by user
- `@@index([action])` — Filter by action type
- `@@index([entityType, entityId])` — Lookup by entity
- `@@index([createdAt])` — Sort chronologically
- `@@index([correlationId])` — Group by request

**Design Reasoning:** Audit logs are append-only (never updated or deleted). The `previousValues` and `newValues` fields enable change diffs. The `correlationId` links related audit entries from the same request.

---

### 4.21 `ApiKey`

**Purpose:** API keys for programmatic access to the SystemMapper API.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String | FK → Organization | Organization this key belongs to |
| `userId` | String | FK → User | User who created the key |
| `name` | String | — | Human-readable key name |
| `keyHash` | String | `@unique` | SHA-256 hash of the API key |
| `keyPrefix` | String | — | First 8 chars for identification |
| `scopes` | Json | — | Array of permitted scopes |
| `lastUsedAt` | DateTime? | nullable | Last usage timestamp |
| `expiresAt` | DateTime? | nullable | Expiration timestamp (null = never) |
| `isActive` | Boolean | `@default(true)` | Whether the key is active |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |
| `deletedAt` | DateTime? | nullable | Soft delete timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade)
- Belongs to `User` (onDelete: Cascade)

**Indexes:**

- `@@index([keyHash])` — Fast key lookup on authentication
- `@@index([organizationId])` — List keys for an org
- `@@index([userId])` — List keys by user
- `@@index([deletedAt])` — Soft delete filtering

**Design Reasoning:** The actual API key is never stored — only its hash. The `keyPrefix` allows users to identify which key is which without exposing the full key. Scopes enable fine-grained permission control.

---

### 4.22 `FeatureFlag`

**Purpose:** Feature flags for gradual feature rollout and A/B testing.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String? | FK → Organization, nullable | Org scope (null = global) |
| `key` | String | — | Flag identifier |
| `name` | String | — | Human-readable flag name |
| `description` | String? | nullable | Flag description |
| `type` | FeatureFlagType (enum) | `@default(BOOLEAN)` | Flag type |
| `value` | Json | — | Flag value (boolean, percentage, user list) |
| `isEnabled` | Boolean | `@default(false)` | Whether the flag is active |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade, optional)

**Indexes:**

- `@@unique([organizationId, key])` — Flag unique per org
- `@@index([key])` — Fast key lookup
- `@@index([isEnabled])` — Filter active flags

---

### 4.23 `UserPreference`

**Purpose:** Stores user-specific preferences and settings.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `userId` | String | FK → User | User these preferences belong to |
| `key` | String | — | Preference key |
| `value` | Json | — | Preference value |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `User` (onDelete: Cascade)

**Indexes:**

- `@@unique([userId, key])` — Preference unique per user
- `@@index([userId])` — List preferences for a user

**Design Reasoning:** Common preferences include: `theme`, `defaultLayout`, `notificationEmail`, `emailDigest`, `compactView`, `defaultGraphDepth`.

---

### 4.24 `SavedView`

**Purpose:** Persisted architecture visualization configurations that users can save and share.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this view belongs to |
| `userId` | String | FK → User | User who created the view |
| `name` | String | — | View name |
| `description` | String? | nullable | View description |
| `filters` | Json | — | Graph filter configuration |
| `layout` | Json | — | Graph layout configuration |
| `viewport` | Json? | nullable | Camera position and zoom |
| `highlightedNodes` | Json? | nullable | Pre-highlighted nodes |
| `isShared` | Boolean | `@default(false)` | Whether the view is shared with the org |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |
| `deletedAt` | DateTime? | nullable | Soft delete timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `User` (onDelete: Cascade)

**Indexes:**

- `@@index([repositoryId])` — List views for a repo
- `@@index([userId])` — List views by user
- `@@index([repositoryId, isShared])` — List shared views
- `@@index([deletedAt])` — Soft delete filtering

---

### 4.25 `Metric`

**Purpose:** Time-series metric storage for repository and architecture metrics.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this metric belongs to |
| `snapshotId` | String? | FK → ArchitectureSnapshot, nullable | Associated snapshot |
| `type` | MetricType (enum) | — | Metric category |
| `value` | Float | — | Metric value |
| `metadata` | Json? | nullable | Additional metric context |
| `measuredAt` | DateTime | `@default(now())` | When the metric was captured |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `ArchitectureSnapshot` (onDelete: SetNull)

**Indexes:**

- `@@index([repositoryId, type])` — Query metrics by type for a repo
- `@@index([repositoryId, type, measuredAt])` — Time-series queries
- `@@index([snapshotId])` — Metrics for a snapshot
- `@@index([measuredAt])` — Sort by time

**Design Reasoning:** Metrics are stored as individual records rather than a wide table because the set of metric types grows over time. The `measuredAt` field enables time-series queries and trend analysis. The combination of `repositoryId + type + measuredAt` is the primary query pattern.

---

### 4.26 `Comment`

**Purpose:** Discussion comments on repositories, architecture views, or specific components.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository context |
| `userId` | String | FK → User | Comment author |
| `parentId` | String? | FK → Comment, nullable | Parent comment (for threading) |
| `body` | String | — | Comment content (Markdown) |
| `entityType` | String? | nullable | Type of entity commented on |
| `entityId` | String? | nullable | ID of entity commented on |
| `isResolved` | Boolean | `@default(false)` | Whether the comment is resolved |
| `resolvedBy` | String? | FK → User, nullable | User who resolved it |
| `resolvedAt` | DateTime? | nullable | When it was resolved |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |
| `deletedAt` | DateTime? | nullable | Soft delete timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `User` (onDelete: Cascade)
- Belongs to `Comment` as parent (onDelete: Cascade, self-referencing)
- Has many `Comment` as replies (self-referencing)

**Indexes:**

- `@@index([repositoryId])` — List comments for a repo
- `@@index([userId])` — List comments by user
- `@@index([parentId])` — List replies
- `@@index([entityType, entityId])` — Comments on specific entity
- `@@index([deletedAt])` — Soft delete filtering

---

### 4.27 `ParserMetadata`

**Purpose:** Tracks parser state for each file in a repository, enabling incremental parsing by detecting which files have changed since the last parse.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this file belongs to |
| `filePath` | String | — | File path within the repo |
| `language` | Language (enum) | — | Detected programming language |
| `contentHash` | String | — | SHA-256 hash of file content |
| `lastParsedAt` | DateTime? | nullable | Last successful parse time |
| `lastParseScanId` | String? | FK → RepositoryScan, nullable | Scan that last parsed this file |
| `lineCount` | Int | `@default(0)` | Number of lines in the file |
| `byteSize` | Int | `@default(0)` | File size in bytes |
| `hasParseErrors` | Boolean | `@default(false)` | Whether parsing had errors |
| `parseErrorCount` | Int | `@default(0)` | Number of parse errors |
| `nodeCount` | Int | `@default(0)` | Graph nodes generated from this file |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `RepositoryScan` as lastParseScan (onDelete: SetNull)

**Indexes:**

- `@@unique([repositoryId, filePath])` — File unique within repo
- `@@index([repositoryId])` — List files for a repo
- `@@index([repositoryId, language])` — Filter by language
- `@@index([contentHash])` — Content-based lookup
- `@@index([hasParseErrors])` — Find files with parse errors

**Design Reasoning:** The `contentHash` enables incremental parsing: if a file's content hash hasn't changed since the last parse, it can be skipped. The `parseErrorCount` and `hasParseErrors` fields enable quality monitoring.

---

### 4.28 `RepositoryIntegration`

**Purpose:** Tracks external service integrations configured for a repository (currently GitHub, future: Slack, Jira).

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository this integration belongs to |
| `type` | IntegrationType (enum) | — | Integration type |
| `configuration` | Json | — | Integration-specific configuration |
| `isActive` | Boolean | `@default(true)` | Whether the integration is active |
| `lastSyncedAt` | DateTime? | nullable | Last successful sync |
| `errorMessage` | String? | nullable | Last error message |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)

**Indexes:**

- `@@unique([repositoryId, type])` — One integration per type per repo
- `@@index([repositoryId])` — List integrations for a repo
- `@@index([type])` — Filter by integration type

---

### 4.29 `TeamRole`

**Purpose:** Custom team roles with fine-grained permissions, extending the basic Role enum.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `organizationId` | String | FK → Organization | Organization this role belongs to |
| `name` | String | — | Role name |
| `description` | String? | nullable | Role description |
| `permissions` | Json | — | Array of permission strings |
| `isSystem` | Boolean | `@default(false)` | Whether this is a system-defined role |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Organization` (onDelete: Cascade)

**Indexes:**

- `@@unique([organizationId, name])` — Role name unique per org
- `@@index([organizationId])` — List roles for an org

---

### 4.30 `RepositoryPermission`

**Purpose:** Fine-grained per-repository access control for organization members.

**Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `repositoryId` | String | FK → Repository | Repository |
| `userId` | String | FK → User | User |
| `role` | Role (enum) | `@default(VIEWER)` | Access level for this repo |
| `grantedBy` | String? | FK → User, nullable | User who granted access |
| `createdAt` | DateTime | `@default(now())` | Record creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last update timestamp |

**Relationships:**

- Belongs to `Repository` (onDelete: Cascade)
- Belongs to `User` (onDelete: Cascade)
- Belongs to `User` as grantedBy (onDelete: SetNull)

**Indexes:**

- `@@unique([repositoryId, userId])` — Permission unique per repo-user pair
- `@@index([repositoryId])` — List permissions for a repo
- `@@index([userId])` — List repo access for a user

---

## 5. Migration Strategy

### 5.1 Prisma Migration Workflow

1. **Development Migrations:** Use `prisma migrate dev` to create and apply migrations during development. Each migration is stored in `packages/database/prisma/migrations/` as a SQL file with a timestamp-based directory name.

2. **Migration Naming:** Use descriptive names: `prisma migrate dev --name add_blast_radius_reports`.

3. **Migration Review:** All migration SQL files must be reviewed in PRs before merging. Destructive operations (column drops, table drops) require explicit approval.

4. **Rollback Strategy:** Prisma does not natively support down migrations. For rollbacks:
   - Create a new migration that reverses the change.
   - In critical cases, use raw SQL migrations via `prisma migrate resolve`.

5. **Data Migrations:** For data transformations (not schema changes), create standalone scripts in `packages/database/prisma/data-migrations/`.

### 5.2 Migration Best Practices

| Practice | Implementation |
|----------|---------------|
| Never rename columns | Add new column, migrate data, drop old column |
| Never drop columns in a single migration | Deprecate first, verify no usage, then drop |
| Always add indexes separately | Large table index creation can lock tables |
| Use `@default` for new required columns | Prevents insertion failures during deployment |
| Test migrations against production-like data | Use realistic data volumes in test environments |

### 5.3 Seeding

The `packages/database/prisma/seed.ts` file provides initial data for development:

- Default feature flags
- System-defined team roles
- Test organization and user (development only)

---

## 6. Future Scalability

### 6.1 Partitioning Candidates

As data grows, these tables are candidates for partitioning:

| Table | Partition Strategy | Partition Key |
|-------|--------------------|---------------|
| `Metric` | Range by `measuredAt` | Monthly |
| `AuditLog` | Range by `createdAt` | Monthly |
| `JobHistory` | Range by `processedAt` | Monthly |
| `WebhookEvent` | Range by `createdAt` | Monthly |

### 6.2 Read Replicas

High-read tables that could benefit from read replicas:

- `Metric` — Dashboard queries
- `RepositoryScan` — History views
- `ArchitectureSnapshot` — Comparison queries

### 6.3 Materialized Views

Candidates for materialized views to improve dashboard performance:

- Repository dashboard metrics (latest metrics per repository)
- Organization-level aggregates (total repos, total scans, average scores)
- Trending metrics (week-over-week changes)

### 6.4 Data Retention

| Entity | Retention Policy |
|--------|-----------------|
| `WebhookEvent` | 90 days (raw payload purge) |
| `JobHistory` | 30 days |
| `AuditLog` | 1 year (compliance) |
| `Metric` | Indefinite (aggregated) |
| `Notification` | 90 days (read notifications) |

---

*End of Database Design. Continue to [03-graph-design.md](./03-graph-design.md) →*
