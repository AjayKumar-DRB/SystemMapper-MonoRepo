# SystemMapper — Architecture Diagrams

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overall Architecture](#1-overall-architecture)
2. [Package Dependencies](#2-package-dependencies)
3. [ER Diagram](#3-er-diagram)
4. [Graph Model](#4-graph-model)
5. [Queue Flow](#5-queue-flow)
6. [Repository Scan Flow](#6-repository-scan-flow)
7. [Blast Radius Flow](#7-blast-radius-flow)
8. [PR Comment Flow](#8-pr-comment-flow)
9. [Clean Architecture Layers](#9-clean-architecture-layers)

---

## 1. Overall Architecture

```mermaid
graph TB
    subgraph "Frontend"
        WEB["Next.js Web App<br/>(apps/web)"]
    end

    subgraph "Backend"
        API["NestJS API<br/>(apps/api)"]
    end

    subgraph "Worker"
        WORKER["NestJS Worker<br/>(apps/worker)"]
    end

    subgraph "Infrastructure"
        PG["Supabase PostgreSQL"]
        NEO["Memgraph"]
        REDIS["Redis + BullMQ"]
    end

    subgraph "External"
        GH["GitHub API"]
        GHWH["GitHub Webhooks"]
    end

    WEB -->|"REST API"| API
    API -->|"Read/Write"| PG
    API -->|"Enqueue Jobs"| REDIS
    API -->|"Read Graph"| NEO
    GHWH -->|"Webhook Events"| API

    REDIS -->|"Process Jobs"| WORKER
    WORKER -->|"Read/Write"| PG
    WORKER -->|"Build Graph"| NEO
    WORKER -->|"Fetch Code"| GH
    WORKER -->|"Post Comments"| GH

    WEB -->|"Auth"| PG
```

---

## 2. Package Dependencies

```mermaid
graph TD
    subgraph "Applications"
        API["apps/api"]
        WEB["apps/web"]
        WORKER["apps/worker"]
    end

    subgraph "Domain Packages"
        RE["risk-engine"]
        PARSER["parser"]
        GRAPH["graph"]
        ANALYTICS["analytics"]
        GITHUB["github"]
    end

    subgraph "Infrastructure Packages"
        DB["database"]
        CONFIG["config"]
        SHARED["shared"]
        TYPES["types"]
        UI["ui"]
    end

    API --> DB
    API --> GITHUB
    API --> GRAPH
    API --> CONFIG
    API --> SHARED
    API --> TYPES

    WEB --> UI
    WEB --> TYPES

    WORKER --> DB
    WORKER --> GITHUB
    WORKER --> GRAPH
    WORKER --> PARSER
    WORKER --> RE
    WORKER --> ANALYTICS
    WORKER --> CONFIG
    WORKER --> SHARED
    WORKER --> TYPES

    RE --> TYPES
    PARSER --> TYPES
    PARSER --> SHARED
    GRAPH --> TYPES
    GRAPH --> SHARED
    ANALYTICS --> TYPES
    ANALYTICS --> SHARED
    ANALYTICS --> DB
    GITHUB --> TYPES
    GITHUB --> SHARED
    GITHUB --> CONFIG

    DB --> TYPES
    DB --> SHARED
    CONFIG --> TYPES
    SHARED --> TYPES
    UI --> TYPES
```

---

## 3. ER Diagram

```mermaid
erDiagram
    User ||--o{ OrganizationMember : "belongs to"
    Organization ||--o{ OrganizationMember : "has members"
    Organization ||--o{ Repository : "owns"
    Organization ||--o{ ApiKey : "has keys"

    Repository ||--o{ RepositoryScan : "scanned by"
    Repository ||--o{ ArchitectureSnapshot : "has snapshots"
    Repository ||--o{ PullRequest : "has PRs"
    Repository ||--o{ Metric : "has metrics"
    Repository ||--o{ ParserMetadata : "has file metadata"
    Repository ||--o{ SavedView : "has views"
    Repository ||--|| RepositorySettings : "has settings"

    GitHubInstallation ||--o{ RepositoryInstallation : "installs"
    Repository ||--o{ RepositoryInstallation : "installed via"

    RepositoryScan ||--o{ ArchitectureSnapshot : "produces"
    RepositoryScan ||--o{ RiskReport : "produces"

    PullRequest ||--o{ PullRequestFile : "changes"
    PullRequest ||--o{ RiskReport : "analyzed by"
    PullRequest ||--o{ Comment : "has comments"

    RiskReport ||--|| BlastRadiusReport : "contains"

    User ||--o{ Notification : "receives"
    User ||--o{ UserPreferences : "has"
    User ||--o{ AuditLog : "performs"
    User ||--o{ SavedView : "creates"

    User {
        string id PK
        string email
        int githubId
        string githubUsername
        string displayName
    }

    Organization {
        string id PK
        string name
        string slug
    }

    Repository {
        string id PK
        string name
        string fullName
        int githubRepoId
        string defaultBranch
    }

    RepositoryScan {
        string id PK
        string status
        string triggerType
        int totalFiles
        int parsedFiles
    }

    PullRequest {
        string id PK
        int githubPrNumber
        string title
        string status
        float riskScore
    }

    RiskReport {
        string id PK
        float riskScore
        string riskLevel
    }
```

---

## 4. Graph Model

```mermaid
graph LR
    subgraph "Structural"
        REPO["Repository"]
        DIR["Directory"]
        FILE["File"]
    end

    subgraph "Code Elements"
        CLASS["Class"]
        IFACE["Interface"]
        FUNC["Function"]
        METHOD["Method"]
        TYPE["Type"]
        ENUM["Enum"]
        VAR["Variable"]
    end

    subgraph "External"
        PKG["Package"]
        EXT["ExternalService"]
    end

    subgraph "Infrastructure"
        API_EP["APIEndpoint"]
        DB_TBL["DatabaseTable"]
        QUEUE_N["Queue"]
    end

    REPO -->|CONTAINS| DIR
    DIR -->|CONTAINS| DIR
    DIR -->|CONTAINS| FILE
    FILE -->|CONTAINS| CLASS
    FILE -->|CONTAINS| FUNC
    FILE -->|CONTAINS| IFACE
    FILE -->|CONTAINS| TYPE
    FILE -->|CONTAINS| ENUM
    CLASS -->|CONTAINS| METHOD

    FILE -->|IMPORTS| FILE
    FILE -->|IMPORTS| PKG
    FUNC -->|CALLS| FUNC
    METHOD -->|CALLS| METHOD
    METHOD -->|CALLS| FUNC
    CLASS -->|EXTENDS| CLASS
    CLASS -->|IMPLEMENTS| IFACE
    FUNC -->|USES| TYPE
    CLASS -->|EXPOSES| API_EP
    METHOD -->|QUERIES| DB_TBL
    METHOD -->|EMITS| QUEUE_N
    FUNC -->|CONNECTS_TO| EXT
```

---

## 5. Queue Flow

```mermaid
graph LR
    subgraph "Producers"
        API_P["API Server"]
        CRON["Scheduler"]
        ADMIN["Admin"]
    end

    subgraph "Queues"
        Q1["repository-scan"]
        Q2["repository-parse"]
        Q3["graph-build"]
        Q4["graph-update"]
        Q5["blast-radius"]
        Q6["metrics"]
        Q7["notifications"]
        Q8["cleanup"]
        Q9["retry"]
    end

    subgraph "DLQ"
        DLQ_Q["Dead Letter Queue"]
    end

    API_P -->|"webhook/manual"| Q1
    API_P -->|"PR webhook"| Q5

    Q1 -->|"per file"| Q2
    Q2 -->|"all parsed"| Q3
    Q2 -->|"incremental"| Q4
    Q3 --> Q6
    Q4 --> Q6
    Q5 --> Q7
    Q6 --> Q7

    CRON --> Q8
    ADMIN --> Q9

    Q1 -.->|"max retries"| DLQ_Q
    Q2 -.->|"max retries"| DLQ_Q
    Q3 -.->|"max retries"| DLQ_Q
    Q5 -.->|"max retries"| DLQ_Q

    Q9 -->|"re-dispatch"| Q1
    Q9 -->|"re-dispatch"| Q2
    Q9 -->|"re-dispatch"| Q3
    Q9 -->|"re-dispatch"| Q5
```

---

## 6. Repository Scan Flow

```mermaid
sequenceDiagram
    participant U as User/Webhook
    participant API as API Server
    participant Q as BullMQ
    participant W as Worker
    participant GH as GitHub API
    participant PG as PostgreSQL
    participant N4 as Memgraph

    U->>API: Trigger Scan
    API->>PG: Create RepositoryScan (PENDING)
    API->>Q: Enqueue repository-scan
    API-->>U: 202 Accepted

    Q->>W: Process repository-scan
    W->>PG: Update scan (SCANNING)
    W->>GH: Fetch file tree
    GH-->>W: File list + SHAs

    W->>PG: Compare content hashes
    Note over W: Identify changed files

    loop Each changed file
        W->>Q: Enqueue repository-parse
    end

    loop Each parse job
        Q->>W: Process repository-parse
        W->>W: Tree-sitter parse
        W->>PG: Update ParserMetadata
    end

    Note over W: All files parsed

    W->>Q: Enqueue graph-build/update
    Q->>W: Process graph job
    W->>N4: Build/update graph
    W->>PG: Create ArchitectureSnapshot
    W->>PG: Update scan (COMPLETED)

    W->>Q: Enqueue metrics
    Q->>W: Process metrics
    W->>N4: Query statistics
    W->>PG: Store Metric records
```

---

## 7. Blast Radius Flow

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant API as API Server
    participant Q as BullMQ
    participant W as Worker
    participant PG as PostgreSQL
    participant N4 as Memgraph
    participant RE as Risk Engine

    GH->>API: Webhook: pull_request.opened
    API->>API: Verify webhook signature
    API->>PG: Create/Update PullRequest
    API->>PG: Store PullRequestFiles
    API->>Q: Enqueue blast-radius
    API-->>GH: 200 OK

    Q->>W: Process blast-radius
    W->>N4: Query dependency graph
    N4-->>W: Graph data (nodes + edges)

    W->>RE: RiskEngine.analyze(changedFiles, graphData)
    Note over RE: Execute all strategies
    RE->>RE: BlastRadiusStrategy
    RE->>RE: DependencyAnalysisStrategy
    RE->>RE: CircularDependencyStrategy
    RE->>RE: ArchitectureViolationStrategy
    RE->>RE: CriticalPathStrategy
    RE->>RE: ReviewerSuggestionStrategy
    RE->>RE: RiskScoringStrategy
    RE-->>W: RiskReport

    W->>PG: Store RiskReport
    W->>PG: Store BlastRadiusReport

    W->>W: Format comment markdown
    W->>GH: POST/PATCH PR comment
    GH-->>W: Comment ID
    W->>PG: Update PullRequest.commentId
```

---

## 8. PR Comment Flow

```mermaid
sequenceDiagram
    participant W as Worker
    participant PG as PostgreSQL
    participant GH as GitHub API

    W->>PG: Fetch PullRequest
    PG-->>W: PR record

    alt No existing comment
        W->>GH: POST /repos/{o}/{r}/issues/{n}/comments
        GH-->>W: {id: 12345}
        W->>PG: Save commentId = 12345
    else Has existing comment
        W->>GH: PATCH /repos/{o}/{r}/issues/comments/12345
        GH-->>W: Updated
    end

    Note over W,GH: Comment contains:<br/>Risk Score, Affected Files,<br/>Dependency Chains,<br/>Suggested Reviewers
```

---

## 9. Clean Architecture Layers

```mermaid
graph TB
    subgraph "Layer 4: Frameworks & Drivers"
        NEST["NestJS"]
        NEXT["Next.js"]
        PRISMA["Prisma"]
        NEO4J_D["Neo4j driver"]
        BULLMQ["BullMQ"]
        OCTOKIT["Octokit"]
        TREESIT["Tree-sitter"]
    end

    subgraph "Layer 3: Interface Adapters"
        CTRL["Controllers"]
        REPOS["Repositories"]
        GATEWAYS["Gateways"]
        PRESENT["Presenters/DTOs"]
    end

    subgraph "Layer 2: Application"
        UC["Use Cases / Services"]
        ORCH["Orchestrators"]
        PROC["Processors"]
    end

    subgraph "Layer 1: Domain"
        ENT["Entities / Types"]
        STRAT["Strategies"]
        IFACES["Interfaces"]
        CONST["Constants"]
    end

    NEST --> CTRL
    NEXT --> PRESENT
    PRISMA --> REPOS
    NEO4J_D --> REPOS
    BULLMQ --> PROC
    OCTOKIT --> GATEWAYS
    TREESIT --> GATEWAYS

    CTRL --> UC
    REPOS --> UC
    GATEWAYS --> UC
    PRESENT --> UC

    UC --> ENT
    UC --> STRAT
    ORCH --> UC
    PROC --> UC

    STRAT --> ENT
    STRAT --> IFACES
    IFACES --> ENT
    ENT --> CONST

    style ENT fill:#2d5016,color:#fff
    style STRAT fill:#2d5016,color:#fff
    style IFACES fill:#2d5016,color:#fff
    style CONST fill:#2d5016,color:#fff
```

**Dependency Rule:** Arrows point inward. Layer 1 (Domain) has zero dependencies on outer layers. Each layer only depends on the layer immediately inside it.

---

*End of Diagrams. Continue to [19-adrs.md](./19-adrs.md) →*
