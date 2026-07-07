# SystemMapper — Monorepo Structure

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Turborepo Configuration](#2-turborepo-configuration)
3. [Package Dependency Graph](#3-package-dependency-graph)
4. [Applications](#4-applications)
5. [Packages](#5-packages)
6. [Inter-Package Dependency Rules](#6-inter-package-dependency-rules)
7. [Build Pipeline](#7-build-pipeline)

---

## 1. Overview

SystemMapper uses a **Turborepo-managed pnpm workspace monorepo**. The monorepo is divided into two top-level directories:

- **`apps/`** — Deployable applications (web frontend, API server, background worker)
- **`packages/`** — Shared libraries consumed by applications and other packages

Every package is a first-class TypeScript package with its own `package.json`, `tsconfig.json`, and test configuration. Packages are referenced using pnpm workspace protocol (`workspace:*`) and Turborepo handles build ordering based on the dependency graph.

### 1.1 Naming Convention

All packages use the `@systemmapper/` npm scope:

| Directory | Package Name |
|-----------|-------------|
| `apps/web` | `@systemmapper/web` |
| `apps/api` | `@systemmapper/api` |
| `apps/worker` | `@systemmapper/worker` |
| `packages/analytics` | `@systemmapper/analytics` |
| `packages/config` | `@systemmapper/config` |
| `packages/database` | `@systemmapper/database` |
| `packages/github` | `@systemmapper/github` |
| `packages/graph` | `@systemmapper/graph` |
| `packages/parser` | `@systemmapper/parser` |
| `packages/risk-engine` | `@systemmapper/risk-engine` |
| `packages/shared` | `@systemmapper/shared` |
| `packages/types` | `@systemmapper/types` |
| `packages/ui` | `@systemmapper/ui` |

---

## 2. Turborepo Configuration

### 2.1 Root `turbo.json`

The root Turborepo configuration defines the task pipeline. Key tasks:

| Task | Description | Dependencies | Cache |
|------|------------|--------------|-------|
| `build` | Compile TypeScript, bundle applications | `^build` (depends on upstream builds) | Yes |
| `dev` | Start development servers | `^build` | No |
| `lint` | Run ESLint | None | Yes |
| `test` | Run Vitest | `^build` | Yes |
| `test:integration` | Run integration tests | `^build` | No |
| `type-check` | Run `tsc --noEmit` | `^build` | Yes |
| `clean` | Remove `dist/`, `node_modules/`, `.turbo/` | None | No |
| `db:generate` | Run `prisma generate` | None | Yes |
| `db:migrate` | Run `prisma migrate dev` | None | No |

### 2.2 Pipeline Dependency Rules

- `build` depends on `^build`: A package's build waits for all its dependency packages to build first.
- `dev` has no cache: Development servers always run fresh.
- `test` depends on `^build`: Tests require compiled dependencies.
- `lint` has no dependencies: Linting can run independently.

### 2.3 Root `pnpm-workspace.yaml`

Defines workspace packages:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 2.4 Shared Configuration

The root `package.json` contains:

- Shared devDependencies (ESLint, Prettier, TypeScript, Vitest)
- Root-level scripts for running tasks across all packages
- Husky configuration for git hooks
- Commitlint configuration

---

## 3. Package Dependency Graph

```
                    ┌──────────────────┐
                    │  @systemmapper/  │
                    │      types       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────────────────┐
              │              │                          │
              ▼              ▼                          ▼
    ┌─────────────┐  ┌──────────────┐          ┌──────────────┐
    │   shared    │  │    config    │          │      ui      │
    └──────┬──────┘  └──────┬───────┘          └──────┬───────┘
           │                │                         │
     ┌─────┼────────┬───────┼──────────┐              │
     │     │        │       │          │              │
     ▼     ▼        ▼       ▼          ▼              │
  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────────┐       │
  │parser││github││graph ││datab.││risk-eng. │       │
  └──┬───┘└──┬───┘└──┬───┘└──┬───┘└────┬─────┘       │
     │       │       │       │         │              │
     │       │       │       │    ┌────┘              │
     │       │       │       │    │                   │
     ▼       ▼       ▼       ▼    ▼                   │
  ┌──────────────────────────────────┐                │
  │          analytics               │                │
  └──────────────┬───────────────────┘                │
                 │                                    │
     ┌───────────┼──────────────────┐                 │
     │           │                  │                 │
     ▼           ▼                  ▼                 ▼
  ┌──────┐   ┌──────┐          ┌──────┐
  │  api │   │worker│          │ web  │
  └──────┘   └──────┘          └──────┘
```

### Dependency Rules

1. **`types`** has **zero** internal dependencies.
2. **`config`** depends only on `types`.
3. **`shared`** depends only on `types`.
4. **`ui`** depends on `types` and `shared`.
5. **`parser`**, **`github`**, **`graph`**, **`database`**, **`risk-engine`** depend on `types`, `shared`, and `config`.
6. **`analytics`** depends on `types`, `shared`, `risk-engine`, and `database`.
7. **Applications** (`api`, `worker`, `web`) may depend on any package.
8. **No package may depend on an application.**
9. **No circular dependencies between packages.**

---

## 4. Applications

### 4.1 `apps/web` — Web Frontend

**Package Name:** `@systemmapper/web`

**Purpose:** The Next.js web application providing the user-facing dashboard, architecture visualization, repository management, and team collaboration features.

**Responsibilities:**

- Server-side rendering of dashboard pages
- Client-side interactive architecture visualization (React Flow, Cytoscape.js)
- User authentication via Supabase Auth
- API consumption via React Query
- Repository management UI
- Blast radius visualization
- Metrics dashboards
- Settings and configuration pages
- Saved views management
- Notification display

**Dependencies:**

- `@systemmapper/types` — Shared type definitions
- `@systemmapper/shared` — Shared utilities (formatting, validation)
- `@systemmapper/ui` — Reusable UI components
- `@systemmapper/config` — Environment configuration

**Framework Dependencies:**

- `next` — App Router framework
- `react`, `react-dom` — UI rendering
- `@tanstack/react-query` — Server state management
- `reactflow` — Architecture graph visualization
- `cytoscape` — Advanced graph layouts
- `tailwindcss` — Utility CSS
- `@supabase/supabase-js` — Authentication client

**Public APIs:** None — this is a consumer-only application.

**Folder Structure:**

```
apps/web/
├── public/                    # Static assets
│   ├── favicon.ico
│   └── images/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth route group
│   │   │   ├── login/
│   │   │   ├── callback/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/       # Dashboard route group
│   │   │   ├── repositories/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── architecture/
│   │   │   │       ├── metrics/
│   │   │   │       ├── blast-radius/
│   │   │   │       ├── settings/
│   │   │   │       └── snapshots/
│   │   │   ├── organizations/
│   │   │   ├── settings/
│   │   │   ├── notifications/
│   │   │   └── layout.tsx
│   │   ├── api/               # Next.js API routes (BFF)
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   └── globals.css
│   ├── components/            # App-specific components
│   │   ├── architecture/      # Graph visualization components
│   │   ├── blast-radius/      # Blast radius display
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── layout/            # Shell, sidebar, header
│   │   ├── metrics/           # Metrics charts
│   │   └── repositories/     # Repository cards, lists
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-repositories.ts
│   │   ├── use-architecture.ts
│   │   ├── use-blast-radius.ts
│   │   └── use-metrics.ts
│   ├── lib/                   # Client-side utilities
│   │   ├── api-client.ts      # Typed API client
│   │   ├── supabase.ts        # Supabase client
│   │   ├── query-keys.ts      # React Query key factory
│   │   └── graph-utils.ts     # Graph data transforms
│   ├── providers/             # React context providers
│   │   ├── query-provider.tsx
│   │   ├── auth-provider.tsx
│   │   └── theme-provider.tsx
│   └── styles/                # Additional styles
├── .env.local                 # Local environment (gitignored)
├── .env.example               # Environment template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── package.json
```

**Examples of Usage:**

- A developer navigates to `/repositories/abc-123/architecture` → the page fetches the dependency graph from the API via React Query, transforms it into React Flow nodes/edges, and renders an interactive architecture diagram.
- A tech lead opens `/repositories/abc-123/blast-radius?pr=42` → the page fetches the blast radius report for PR #42 and highlights affected nodes on the graph.

---

### 4.2 `apps/api` — API Server

**Package Name:** `@systemmapper/api`

**Purpose:** The NestJS HTTP API server that serves as the backend for the web frontend, handles GitHub webhook events, and manages all business operations.

**Responsibilities:**

- REST API endpoints for all platform features
- GitHub webhook event reception and validation
- Authentication via Supabase JWT verification
- Authorization via RBAC guards
- Request validation via DTOs
- Job dispatching to BullMQ queues
- Orchestrating business operations across packages
- Error handling and response formatting
- API versioning (v1)

**Dependencies:**

- `@systemmapper/types` — Shared type definitions
- `@systemmapper/shared` — Shared utilities
- `@systemmapper/config` — Environment configuration
- `@systemmapper/database` — Prisma client and repositories
- `@systemmapper/github` — GitHub API client
- `@systemmapper/graph` — Graph read operations (for API queries)
- `@systemmapper/risk-engine` — Risk scoring (for on-demand calculations)
- `@systemmapper/analytics` — Metrics computation

**Framework Dependencies:**

- `@nestjs/core`, `@nestjs/common` — NestJS framework
- `@nestjs/platform-express` — Express HTTP adapter
- `@nestjs/bull` — BullMQ integration
- `@nestjs/passport` — Authentication
- `class-validator`, `class-transformer` — DTO validation
- `@supabase/supabase-js` — Auth verification

**Public APIs:** REST API endpoints (documented in [11-api-design.md](./11-api-design.md))

**Folder Structure:**

```
apps/api/
├── src/
│   ├── main.ts                    # Application bootstrap
│   ├── app.module.ts              # Root module
│   ├── common/                    # Cross-cutting concerns
│   │   ├── decorators/            # Custom decorators
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── api-version.decorator.ts
│   │   ├── filters/               # Exception filters
│   │   │   ├── http-exception.filter.ts
│   │   │   └── prisma-exception.filter.ts
│   │   ├── guards/                # Auth & RBAC guards
│   │   │   ├── auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── repository-access.guard.ts
│   │   ├── interceptors/          # Response transformation
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── middleware/            # HTTP middleware
│   │   │   ├── correlation-id.middleware.ts
│   │   │   └── request-logging.middleware.ts
│   │   ├── pipes/                 # Validation pipes
│   │   │   └── validation.pipe.ts
│   │   └── dto/                   # Shared DTOs
│   │       ├── pagination.dto.ts
│   │       └── api-response.dto.ts
│   ├── features/                  # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   └── dto/
│   │   ├── repositories/
│   │   │   ├── repositories.module.ts
│   │   │   ├── repositories.controller.ts
│   │   │   ├── repositories.service.ts
│   │   │   └── dto/
│   │   ├── organizations/
│   │   │   ├── organizations.module.ts
│   │   │   ├── organizations.controller.ts
│   │   │   ├── organizations.service.ts
│   │   │   └── dto/
│   │   ├── architecture/
│   │   │   ├── architecture.module.ts
│   │   │   ├── architecture.controller.ts
│   │   │   ├── architecture.service.ts
│   │   │   └── dto/
│   │   ├── blast-radius/
│   │   │   ├── blast-radius.module.ts
│   │   │   ├── blast-radius.controller.ts
│   │   │   ├── blast-radius.service.ts
│   │   │   └── dto/
│   │   ├── pull-requests/
│   │   │   ├── pull-requests.module.ts
│   │   │   ├── pull-requests.controller.ts
│   │   │   ├── pull-requests.service.ts
│   │   │   └── dto/
│   │   ├── metrics/
│   │   │   ├── metrics.module.ts
│   │   │   ├── metrics.controller.ts
│   │   │   ├── metrics.service.ts
│   │   │   └── dto/
│   │   ├── webhooks/
│   │   │   ├── webhooks.module.ts
│   │   │   ├── webhooks.controller.ts
│   │   │   ├── webhooks.service.ts
│   │   │   └── handlers/
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   └── notifications.service.ts
│   │   ├── settings/
│   │   │   ├── settings.module.ts
│   │   │   ├── settings.controller.ts
│   │   │   └── settings.service.ts
│   │   ├── saved-views/
│   │   │   ├── saved-views.module.ts
│   │   │   ├── saved-views.controller.ts
│   │   │   └── saved-views.service.ts
│   │   └── admin/
│   │       ├── admin.module.ts
│   │       ├── admin.controller.ts
│   │       └── admin.service.ts
│   └── queue/                     # Queue producers
│       ├── queue.module.ts
│       ├── producers/
│       │   ├── scan.producer.ts
│       │   ├── parse.producer.ts
│       │   ├── graph.producer.ts
│       │   ├── blast-radius.producer.ts
│       │   ├── metrics.producer.ts
│       │   └── notification.producer.ts
│       └── dto/
├── test/
│   ├── e2e/
│   └── fixtures/
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

**Examples of Usage:**

- Frontend sends `GET /api/v1/repositories/:id/architecture` → API fetches graph data from Memgraph via the `@systemmapper/graph` package, transforms it into a visualization-friendly format, and returns it.
- GitHub sends a `pull_request` webhook → API validates the webhook signature via `@systemmapper/github`, dispatches a `blast-radius` job to BullMQ, and returns `200 OK`.

---

### 4.3 `apps/worker` — Background Worker

**Package Name:** `@systemmapper/worker`

**Purpose:** A standalone NestJS application (no HTTP server) that processes background jobs from BullMQ queues. The worker handles all long-running, compute-intensive operations: repository scanning, AST parsing, graph building, blast radius calculation, metrics computation, and notification dispatch.

**Responsibilities:**

- Consuming jobs from all BullMQ queues
- Repository scanning (fetching file trees via GitHub API)
- AST parsing (invoking Tree-sitter via the parser package)
- Graph construction and updates (writing to Memgraph via the graph package)
- Blast radius calculation (invoking the risk engine)
- Metrics computation (invoking the analytics package)
- PR comment publishing (invoking the GitHub package)
- Notification dispatch
- Job progress reporting
- Error handling and retry logic
- Dead letter queue management
- Cleanup operations (stale data, orphaned graph nodes)

**Dependencies:**

- `@systemmapper/types` — Shared type definitions
- `@systemmapper/shared` — Shared utilities
- `@systemmapper/config` — Environment configuration
- `@systemmapper/database` — Prisma client and repositories
- `@systemmapper/github` — GitHub API operations
- `@systemmapper/parser` — AST parsing
- `@systemmapper/graph` — Memgraph graph operations
- `@systemmapper/risk-engine` — Blast radius and risk scoring
- `@systemmapper/analytics` — Metrics computation

**Framework Dependencies:**

- `@nestjs/core`, `@nestjs/common` — NestJS DI container
- `@nestjs/bull` — BullMQ consumer decorators
- `neo4j-driver` — Memgraph connection
- `tree-sitter` — AST parsing (via parser package)

**Folder Structure:**

```
apps/worker/
├── src/
│   ├── main.ts                    # Standalone app bootstrap
│   ├── worker.module.ts           # Root module
│   ├── common/                    # Worker-specific utilities
│   │   ├── base.processor.ts      # Base class for all processors
│   │   ├── job-logger.ts          # Structured job logging
│   │   └── progress-tracker.ts    # Job progress reporting
│   ├── processors/                # Queue consumers
│   │   ├── scan.processor.ts      # repository-scan queue
│   │   ├── parse.processor.ts     # repository-parse queue
│   │   ├── graph-build.processor.ts   # graph-build queue
│   │   ├── graph-update.processor.ts  # graph-update queue
│   │   ├── blast-radius.processor.ts  # blast-radius queue
│   │   ├── metrics.processor.ts       # metrics queue
│   │   ├── notification.processor.ts  # notifications queue
│   │   └── cleanup.processor.ts       # cleanup queue
│   ├── orchestrators/             # Multi-step job orchestration
│   │   ├── scan-orchestrator.ts   # Coordinates scan → parse → graph → metrics
│   │   └── pr-orchestrator.ts     # Coordinates blast-radius → comment
│   └── health/                    # Worker health checks
│       └── health.service.ts
├── test/
│   ├── processors/
│   └── fixtures/
├── .env.example
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

**Examples of Usage:**

- API dispatches a `repository-scan` job → Worker's `ScanProcessor` fetches the file tree via `@systemmapper/github`, identifies parseable files, and dispatches individual `repository-parse` jobs for each file.
- All parse jobs complete → Worker's `ScanOrchestrator` detects completion and dispatches a `graph-build` job to construct the Memgraph graph from the parsed IR.

---

## 5. Packages

### 5.1 `packages/types` — Shared Type Definitions

**Package Name:** `@systemmapper/types`

**Purpose:** The single source of truth for all TypeScript type definitions shared across the monorepo. This package contains zero runtime code — only type declarations, interfaces, enums, and constants.

**Responsibilities:**

- Define all shared interfaces and type aliases
- Define all shared enums
- Define all shared constants
- Define DTO shapes (without validation decorators — those live in the consuming app)
- Define event payload types
- Define queue job payload types
- Define graph node and relationship types
- Define risk report structures
- Define metric types

**Dependencies:** None. This package has zero internal dependencies.

**External Dependencies:** None. Zero runtime dependencies.

**Public APIs (Exports):**

- `interfaces/` — All shared interfaces
- `enums/` — All shared enumerations
- `constants/` — All shared constants
- `dto/` — DTO shape types
- `events/` — Event payload types
- `queue/` — Queue job payload types
- `graph/` — Graph node and relationship types
- `risk/` — Risk report types
- `metrics/` — Metric types
- `models/` — Domain model types

**Shared Types:** This IS the shared types package. All types defined here.

**Folder Structure:**

```
packages/types/
├── src/
│   ├── index.ts               # Barrel export
│   ├── models/                # Domain model interfaces
│   │   ├── user.ts
│   │   ├── organization.ts
│   │   ├── repository.ts
│   │   ├── scan.ts
│   │   ├── snapshot.ts
│   │   ├── pull-request.ts
│   │   ├── commit.ts
│   │   ├── branch.ts
│   │   ├── notification.ts
│   │   └── index.ts
│   ├── enums/                 # Shared enumerations
│   │   ├── scan-status.enum.ts
│   │   ├── risk-level.enum.ts
│   │   ├── job-status.enum.ts
│   │   ├── role.enum.ts
│   │   ├── permission.enum.ts
│   │   ├── language.enum.ts
│   │   ├── node-type.enum.ts
│   │   ├── relationship-type.enum.ts
│   │   ├── event-type.enum.ts
│   │   ├── notification-type.enum.ts
│   │   └── index.ts
│   ├── dto/                   # DTO shape types
│   │   ├── auth/
│   │   ├── repositories/
│   │   ├── organizations/
│   │   ├── architecture/
│   │   ├── blast-radius/
│   │   ├── metrics/
│   │   ├── pagination.ts
│   │   └── index.ts
│   ├── events/                # Event payload types
│   │   ├── repository-events.ts
│   │   ├── scan-events.ts
│   │   ├── graph-events.ts
│   │   ├── pr-events.ts
│   │   ├── metrics-events.ts
│   │   └── index.ts
│   ├── queue/                 # Queue job payloads
│   │   ├── scan-job.ts
│   │   ├── parse-job.ts
│   │   ├── graph-job.ts
│   │   ├── blast-radius-job.ts
│   │   ├── metrics-job.ts
│   │   ├── notification-job.ts
│   │   ├── cleanup-job.ts
│   │   └── index.ts
│   ├── graph/                 # Graph types
│   │   ├── nodes.ts
│   │   ├── relationships.ts
│   │   ├── traversal.ts
│   │   └── index.ts
│   ├── risk/                  # Risk report types
│   │   ├── blast-radius.ts
│   │   ├── risk-score.ts
│   │   ├── risk-report.ts
│   │   └── index.ts
│   ├── metrics/               # Metric types
│   │   ├── repository-metrics.ts
│   │   ├── architecture-metrics.ts
│   │   ├── trend.ts
│   │   └── index.ts
│   ├── interfaces/            # Shared interfaces
│   │   ├── repository-pattern.ts  # IRepository<T>
│   │   ├── strategy.ts           # IStrategy<TInput, TOutput>
│   │   ├── parser.ts             # IParser
│   │   ├── graph-repository.ts   # IGraphRepository
│   │   └── index.ts
│   └── constants/             # Shared constants
│       ├── queue-names.ts
│       ├── event-names.ts
│       ├── defaults.ts
│       └── index.ts
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In any package or application:
import { RiskLevel, ScanStatus } from '@systemmapper/types/enums';
import { IRepository } from '@systemmapper/types/interfaces';
import { BlastRadiusReport } from '@systemmapper/types/risk';
import { ScanJobPayload } from '@systemmapper/types/queue';
```

---

### 5.2 `packages/config` — Configuration Management

**Package Name:** `@systemmapper/config`

**Purpose:** Centralized environment variable parsing, validation, and typed access. Ensures every application and package accesses configuration through validated, typed objects rather than raw `process.env` strings.

**Responsibilities:**

- Parse environment variables from `.env` files
- Validate required variables exist and have valid formats
- Provide strongly-typed configuration objects
- Support environment-specific overrides (development, test)
- Centralize all configuration schemas
- Fail fast on missing or invalid configuration

**Dependencies:**

- `@systemmapper/types` — Configuration type definitions

**External Dependencies:**

- `zod` — Schema validation for environment variables
- `dotenv` — .env file loading

**Public APIs (Exports):**

- `DatabaseConfig` — PostgreSQL connection configuration
- `Neo4jConfig` — Memgraph connection configuration
- `RedisConfig` — Redis connection configuration
- `GitHubConfig` — GitHub App configuration
- `SupabaseConfig` — Supabase configuration
- `AppConfig` — General application configuration
- `QueueConfig` — BullMQ queue configuration
- `loadConfig(schema)` — Generic config loader function
- `validateConfig(config)` — Config validation function

**Folder Structure:**

```
packages/config/
├── src/
│   ├── index.ts               # Barrel export
│   ├── loader.ts              # Config loading utility
│   ├── validator.ts           # Zod-based validation
│   ├── schemas/               # Config schemas
│   │   ├── database.config.ts
│   │   ├── neo4j.config.ts
│   │   ├── redis.config.ts
│   │   ├── github.config.ts
│   │   ├── supabase.config.ts
│   │   ├── app.config.ts
│   │   ├── queue.config.ts
│   │   └── index.ts
│   └── types/                 # Config type exports
│       └── index.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In api/src/main.ts:
import { loadConfig, DatabaseConfig, Neo4jConfig } from '@systemmapper/config';

const dbConfig = loadConfig(DatabaseConfig);
// dbConfig.url is typed as string, validated as non-empty
// Throws at startup if DATABASE_URL is missing
```

---

### 5.3 `packages/database` — Database Access Layer

**Package Name:** `@systemmapper/database`

**Purpose:** Encapsulates all PostgreSQL access via Prisma. Provides the Prisma client, generated types, repository implementations, and database utilities. No other package or application should import `@prisma/client` directly.

**Responsibilities:**

- Host the Prisma schema (`schema.prisma`)
- Generate and export the Prisma client
- Provide repository implementations for each domain entity
- Handle database transactions
- Provide query builders for complex queries
- Manage database migrations
- Implement soft-delete logic
- Implement pagination utilities
- Implement filtering and sorting utilities

**Dependencies:**

- `@systemmapper/types` — Entity interfaces, repository interfaces
- `@systemmapper/shared` — Shared utilities
- `@systemmapper/config` — Database configuration

**External Dependencies:**

- `@prisma/client` — Generated Prisma client
- `prisma` — Prisma CLI (devDependency)

**Public APIs (Exports):**

- `PrismaService` — Managed Prisma client instance
- `UserRepository` — User CRUD operations
- `OrganizationRepository` — Organization CRUD operations
- `RepositoryRepository` — Repository CRUD operations
- `ScanRepository` — Scan job CRUD operations
- `SnapshotRepository` — Architecture snapshot operations
- `PullRequestRepository` — PR tracking operations
- `MetricsRepository` — Metrics storage and retrieval
- `NotificationRepository` — Notification operations
- `AuditLogRepository` — Audit log operations
- `WebhookEventRepository` — Webhook event storage
- `FeatureFlagRepository` — Feature flag operations
- `SavedViewRepository` — Saved view operations
- Transaction utilities
- Pagination helpers

**Folder Structure:**

```
packages/database/
├── prisma/
│   ├── schema.prisma          # Prisma schema
│   ├── migrations/            # Migration files
│   └── seed.ts                # Database seeding
├── src/
│   ├── index.ts               # Barrel export
│   ├── prisma.service.ts      # Prisma client lifecycle
│   ├── repositories/          # Repository implementations
│   │   ├── base.repository.ts # Base repository with common CRUD
│   │   ├── user.repository.ts
│   │   ├── organization.repository.ts
│   │   ├── repository.repository.ts
│   │   ├── scan.repository.ts
│   │   ├── snapshot.repository.ts
│   │   ├── pull-request.repository.ts
│   │   ├── metrics.repository.ts
│   │   ├── notification.repository.ts
│   │   ├── audit-log.repository.ts
│   │   ├── webhook-event.repository.ts
│   │   ├── feature-flag.repository.ts
│   │   ├── saved-view.repository.ts
│   │   ├── api-key.repository.ts
│   │   ├── comment.repository.ts
│   │   └── index.ts
│   ├── utils/                 # Database utilities
│   │   ├── pagination.ts      # Cursor & offset pagination
│   │   ├── filtering.ts       # Dynamic filter builder
│   │   ├── sorting.ts         # Dynamic sort builder
│   │   ├── soft-delete.ts     # Soft delete middleware
│   │   └── transaction.ts     # Transaction helper
│   └── generated/             # Prisma-generated types (gitignored)
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In api/src/features/repositories/repositories.service.ts:
import { RepositoryRepository } from '@systemmapper/database';

class RepositoriesService {
  constructor(private readonly repoRepository: RepositoryRepository) {}

  async findByOrganization(orgId: string, pagination: PaginationDto) {
    return this.repoRepository.findMany({
      where: { organizationId: orgId, deletedAt: null },
      ...pagination,
    });
  }
}
```

---

### 5.4 `packages/github` — GitHub Integration

**Package Name:** `@systemmapper/github`

**Purpose:** Encapsulates all interaction with the GitHub API. Provides GitHub App authentication, OAuth flow support, webhook verification, repository operations, and PR comment management.

**Responsibilities:**

- GitHub App JWT authentication
- Installation access token management
- OAuth flow (authorization URL generation, token exchange)
- Webhook signature verification (HMAC-SHA256)
- Repository file tree fetching
- Repository content fetching
- Pull Request data retrieval
- PR comment creation and updating
- Rate limit tracking and exponential backoff
- Retry logic for transient failures
- GitHub API response caching

**Dependencies:**

- `@systemmapper/types` — GitHub-related type definitions
- `@systemmapper/shared` — Shared utilities (retry, logging)
- `@systemmapper/config` — GitHub App configuration

**External Dependencies:**

- `@octokit/rest` — GitHub REST API client
- `@octokit/auth-app` — GitHub App authentication
- `@octokit/webhooks` — Webhook verification and typing
- `jsonwebtoken` — JWT generation for GitHub App

**Public APIs (Exports):**

- `GitHubAppService` — App-level authentication and operations
- `GitHubInstallationService` — Installation-scoped operations
- `GitHubOAuthService` — OAuth flow management
- `GitHubWebhookService` — Webhook verification and parsing
- `GitHubRepositoryService` — Repository content operations
- `GitHubPullRequestService` — PR operations
- `GitHubCommentService` — PR comment CRUD
- `GitHubRateLimiter` — Rate limit tracking

**Folder Structure:**

```
packages/github/
├── src/
│   ├── index.ts               # Barrel export
│   ├── services/
│   │   ├── app.service.ts     # GitHub App auth
│   │   ├── installation.service.ts # Installation tokens
│   │   ├── oauth.service.ts   # OAuth flow
│   │   ├── webhook.service.ts # Webhook handling
│   │   ├── repository.service.ts # Repo operations
│   │   ├── pull-request.service.ts # PR operations
│   │   ├── comment.service.ts # Comment CRUD
│   │   └── index.ts
│   ├── auth/
│   │   ├── jwt-generator.ts   # App JWT creation
│   │   ├── token-cache.ts     # Installation token cache
│   │   └── index.ts
│   ├── rate-limiter/
│   │   ├── rate-limiter.ts    # Rate limit tracker
│   │   ├── backoff.ts         # Exponential backoff
│   │   └── index.ts
│   ├── formatters/
│   │   ├── comment-formatter.ts  # PR comment markdown
│   │   ├── blast-radius-formatter.ts # Blast radius display
│   │   └── index.ts
│   ├── types/                 # Package-internal types
│   │   ├── webhook-payloads.ts
│   │   └── api-responses.ts
│   └── utils/
│       ├── retry.ts           # Retry with backoff
│       └── path-resolver.ts   # GitHub path utilities
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In worker/src/processors/scan.processor.ts:
import { GitHubRepositoryService } from '@systemmapper/github';

const fileTree = await githubRepoService.getFileTree(installationId, owner, repo);
const fileContent = await githubRepoService.getFileContent(installationId, owner, repo, path);
```

---

### 5.5 `packages/parser` — AST Parsing

**Package Name:** `@systemmapper/parser`

**Purpose:** Parses source code files into a normalized, language-agnostic Intermediate Representation (IR) using Tree-sitter. Supports multiple programming languages and handles parse errors gracefully.

**Responsibilities:**

- Initialize and manage Tree-sitter grammars
- Parse source files into ASTs
- Extract structural elements (imports, exports, classes, functions, methods, interfaces, types, enums, variables)
- Normalize language-specific AST structures into a common IR
- Support incremental parsing (re-parse only changed portions)
- Handle parse errors without aborting
- Report parse quality metrics (coverage, error count)
- Cache parsed results for unchanged files

**Dependencies:**

- `@systemmapper/types` — IR type definitions, parser interfaces
- `@systemmapper/shared` — Shared utilities

**External Dependencies:**

- `tree-sitter` — Parser runtime
- `tree-sitter-typescript` — TypeScript grammar
- `tree-sitter-javascript` — JavaScript grammar
- `tree-sitter-python` — Python grammar
- `tree-sitter-go` — Go grammar
- `tree-sitter-java` — Java grammar
- `tree-sitter-rust` — Rust grammar

**Public APIs (Exports):**

- `ParserService` — Main parsing entry point
- `LanguageParser` — Language-specific parser interface
- `TypeScriptParser` — TypeScript/JavaScript parsing
- `PythonParser` — Python parsing
- `GoParser` — Go parsing
- `JavaParser` — Java parsing
- `RustParser` — Rust parsing
- `IRBuilder` — Intermediate Representation construction
- `ParseResult` — Parsing output type
- `ParserError` — Parse error type

**Folder Structure:**

```
packages/parser/
├── src/
│   ├── index.ts               # Barrel export
│   ├── parser.service.ts      # Main parsing orchestrator
│   ├── ir/                    # Intermediate Representation
│   │   ├── ir-builder.ts      # IR construction
│   │   ├── ir-types.ts        # IR data structures
│   │   ├── ir-normalizer.ts   # Cross-language normalization
│   │   └── index.ts
│   ├── languages/             # Language-specific parsers
│   │   ├── base.parser.ts     # Base parser class
│   │   ├── typescript.parser.ts
│   │   ├── python.parser.ts
│   │   ├── go.parser.ts
│   │   ├── java.parser.ts
│   │   ├── rust.parser.ts
│   │   ├── language-registry.ts # Language detection & selection
│   │   └── index.ts
│   ├── extractors/            # Element extractors
│   │   ├── import.extractor.ts
│   │   ├── export.extractor.ts
│   │   ├── class.extractor.ts
│   │   ├── function.extractor.ts
│   │   ├── interface.extractor.ts
│   │   ├── type.extractor.ts
│   │   ├── enum.extractor.ts
│   │   ├── variable.extractor.ts
│   │   └── index.ts
│   ├── cache/                 # Parse result caching
│   │   ├── parse-cache.ts
│   │   └── content-hash.ts
│   ├── errors/                # Parser errors
│   │   ├── parse-error.ts
│   │   └── recovery.ts
│   └── utils/
│       ├── file-detector.ts   # Language detection by extension
│       └── tree-utils.ts      # AST traversal helpers
├── grammars/                  # Tree-sitter WASM grammars
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In worker/src/processors/parse.processor.ts:
import { ParserService } from '@systemmapper/parser';

const parseResult = await parserService.parseFile({
  filePath: 'src/services/user.service.ts',
  content: fileContent,
  language: 'typescript',
});
// parseResult.ir contains normalized IR with imports, classes, functions, etc.
```

---

### 5.6 `packages/graph` — Memgraph Graph Operations

**Package Name:** `@systemmapper/graph`

**Purpose:** Encapsulates all Memgraph interactions. Provides graph construction, querying, traversal, and synchronization. This package is the only component that directly communicates with Memgraph.

**Responsibilities:**

- Neo4j driver lifecycle management
- Graph node and relationship CRUD operations
- Graph construction from parsed IR
- Dependency graph traversal
- Blast radius graph queries
- Circular dependency detection
- Dead code detection
- Architecture snapshot creation and retrieval
- Graph versioning
- Incremental graph updates (add/remove/modify nodes)
- Cypher query abstraction
- Graph data export for visualization

**Dependencies:**

- `@systemmapper/types` — Graph node/relationship types
- `@systemmapper/shared` — Shared utilities
- `@systemmapper/config` — Memgraph configuration

**External Dependencies:**

- `neo4j-driver` — Official Memgraph JavaScript driver

**Public APIs (Exports):**

- `GraphService` — High-level graph operations
- `GraphRepository` — Low-level CRUD operations
- `GraphBuilder` — Construct graph from IR
- `GraphTraversal` — Traversal algorithms
- `GraphQuery` — Cypher query builder
- `SnapshotService` — Graph snapshots
- `GraphSyncService` — PostgreSQL ↔ Memgraph sync

**Folder Structure:**

```
packages/graph/
├── src/
│   ├── index.ts               # Barrel export
│   ├── driver/                # Neo4j driver management
│   │   ├── neo4j-driver.ts    # Driver initialization
│   │   ├── session-manager.ts # Session lifecycle
│   │   └── index.ts
│   ├── repository/            # Graph CRUD
│   │   ├── graph.repository.ts
│   │   ├── node.repository.ts
│   │   ├── relationship.repository.ts
│   │   └── index.ts
│   ├── builders/              # Graph construction
│   │   ├── graph-builder.ts   # IR → Graph nodes/relationships
│   │   ├── file-builder.ts    # File node builder
│   │   ├── class-builder.ts   # Class node builder
│   │   ├── function-builder.ts # Function node builder
│   │   ├── import-builder.ts  # Import relationship builder
│   │   └── index.ts
│   ├── traversal/             # Graph traversal
│   │   ├── blast-radius.traversal.ts
│   │   ├── dependency.traversal.ts
│   │   ├── circular.traversal.ts
│   │   ├── dead-code.traversal.ts
│   │   ├── critical-path.traversal.ts
│   │   └── index.ts
│   ├── queries/               # Cypher query templates
│   │   ├── query-builder.ts   # Dynamic Cypher construction
│   │   ├── blast-radius.queries.ts
│   │   ├── dependency.queries.ts
│   │   ├── health.queries.ts
│   │   ├── snapshot.queries.ts
│   │   └── index.ts
│   ├── sync/                  # PG ↔ Memgraph sync
│   │   ├── sync.service.ts
│   │   ├── entity-mapper.ts   # PG ID → Memgraph node mapping
│   │   └── index.ts
│   ├── snapshot/              # Graph snapshots
│   │   ├── snapshot.service.ts
│   │   └── index.ts
│   └── utils/
│       ├── cypher-sanitizer.ts
│       └── graph-transformers.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In worker/src/processors/graph-build.processor.ts:
import { GraphBuilder, GraphService } from '@systemmapper/graph';

await graphBuilder.buildFromIR(repositoryId, parsedIRResults);
await graphService.createSnapshot(repositoryId, commitSha);
```

---

### 5.7 `packages/risk-engine` — Risk Calculation Engine

**Package Name:** `@systemmapper/risk-engine`

**Purpose:** The core business logic package. Implements deterministic risk analysis using the Strategy Pattern. This package has **zero framework dependencies** and **zero database dependencies** — it operates on pure data structures and produces pure results.

**Responsibilities:**

- Blast radius calculation from dependency graph data
- Risk score computation (deterministic algorithm)
- Architecture violation detection
- Circular dependency impact assessment
- Critical path analysis
- Reviewer suggestion (based on file ownership patterns)
- Risk level classification (Low, Medium, High, Critical)
- Strategy orchestration
- Result aggregation

**Dependencies:**

- `@systemmapper/types` — Risk, graph, and metric type definitions

**External Dependencies:** None. Zero runtime dependencies.

**Public APIs (Exports):**

- `RiskEngine` — Main orchestrator
- `BlastRadiusStrategy` — Blast radius computation
- `DependencyAnalysisStrategy` — Dependency chain analysis
- `ArchitectureViolationStrategy` — Architecture rule checking
- `CircularDependencyStrategy` — Circular dependency detection
- `CriticalPathStrategy` — Critical path identification
- `ReviewerSuggestionStrategy` — Reviewer recommendation
- `RiskScoringStrategy` — Risk score aggregation
- `IRiskStrategy` — Strategy interface for extension
- `RiskReport` — Complete risk assessment output

**Folder Structure:**

```
packages/risk-engine/
├── src/
│   ├── index.ts               # Barrel export
│   ├── engine.ts              # RiskEngine orchestrator
│   ├── strategies/            # Strategy implementations
│   │   ├── strategy.interface.ts
│   │   ├── blast-radius.strategy.ts
│   │   ├── dependency-analysis.strategy.ts
│   │   ├── architecture-violation.strategy.ts
│   │   ├── circular-dependency.strategy.ts
│   │   ├── critical-path.strategy.ts
│   │   ├── reviewer-suggestion.strategy.ts
│   │   ├── risk-scoring.strategy.ts
│   │   └── index.ts
│   ├── models/                # Internal domain models
│   │   ├── dependency-graph.ts
│   │   ├── affected-component.ts
│   │   ├── risk-score.ts
│   │   ├── violation.ts
│   │   └── index.ts
│   ├── algorithms/            # Pure algorithms
│   │   ├── graph-traversal.ts # BFS/DFS for in-memory graphs
│   │   ├── cycle-detection.ts # Tarjan's algorithm
│   │   ├── scoring.ts         # Weighted scoring functions
│   │   ├── critical-path.ts   # Longest path algorithm
│   │   └── index.ts
│   ├── rules/                 # Architecture rules
│   │   ├── rule.interface.ts
│   │   ├── layer-violation.rule.ts
│   │   ├── circular-import.rule.ts
│   │   ├── god-class.rule.ts
│   │   ├── deep-nesting.rule.ts
│   │   └── index.ts
│   └── utils/
│       ├── weight-calculator.ts
│       └── report-builder.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In worker/src/processors/blast-radius.processor.ts:
import { RiskEngine, BlastRadiusStrategy } from '@systemmapper/risk-engine';

const engine = new RiskEngine([
  new BlastRadiusStrategy(),
  new DependencyAnalysisStrategy(),
  new CircularDependencyStrategy(),
  new RiskScoringStrategy(),
]);

const report = engine.analyze({
  changedFiles: prChangedFiles,
  dependencyGraph: graphData,
  repositoryMetrics: metrics,
});
// report is a deterministic RiskReport
```

---

### 5.8 `packages/analytics` — Analytics & Metrics

**Package Name:** `@systemmapper/analytics`

**Purpose:** Computes repository-level and architecture-level metrics. Provides trend analysis, health scoring, and complexity measurement.

**Responsibilities:**

- Calculate repository metrics (file count, function count, class count, etc.)
- Calculate architecture metrics (dependency depth, coupling, cohesion)
- Compute architecture health score
- Compute technical debt score
- Compute dependency density
- Track metric trends over time
- Provide metric comparison between snapshots
- Prepare data for future DORA metrics

**Dependencies:**

- `@systemmapper/types` — Metric types, interfaces
- `@systemmapper/shared` — Shared utilities
- `@systemmapper/database` — Metrics persistence

**External Dependencies:** None.

**Public APIs (Exports):**

- `MetricsCalculator` — Compute metrics from graph/scan data
- `ArchitectureScorer` — Calculate architecture health score
- `TechnicalDebtScorer` — Calculate technical debt score
- `TrendAnalyzer` — Analyze metric trends over time
- `ComplexityAnalyzer` — Compute complexity metrics
- `DependencyDensityCalculator` — Compute dependency density
- `SnapshotComparator` — Compare metrics between snapshots

**Folder Structure:**

```
packages/analytics/
├── src/
│   ├── index.ts               # Barrel export
│   ├── calculators/           # Metric calculators
│   │   ├── metrics.calculator.ts
│   │   ├── complexity.calculator.ts
│   │   ├── dependency-density.calculator.ts
│   │   ├── coupling.calculator.ts
│   │   ├── cohesion.calculator.ts
│   │   └── index.ts
│   ├── scorers/               # Health scoring
│   │   ├── architecture.scorer.ts
│   │   ├── technical-debt.scorer.ts
│   │   ├── repository-health.scorer.ts
│   │   └── index.ts
│   ├── analyzers/             # Analysis tools
│   │   ├── trend.analyzer.ts
│   │   ├── snapshot-comparator.ts
│   │   ├── evolution.analyzer.ts
│   │   └── index.ts
│   └── utils/
│       ├── aggregators.ts
│       └── normalizers.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Examples of Usage:**

```typescript
// In worker/src/processors/metrics.processor.ts:
import { MetricsCalculator, ArchitectureScorer } from '@systemmapper/analytics';

const metrics = metricsCalculator.calculate(scanResult, graphData);
const score = architectureScorer.score(metrics, graphData);

await metricsRepository.save(repositoryId, metrics);
```

---

### 5.9 `packages/shared` — Shared Utilities

**Package Name:** `@systemmapper/shared`

**Purpose:** Common utility functions, helpers, and cross-cutting concerns shared across all packages and applications. Contains no business logic — only generic utilities.

**Responsibilities:**

- Date/time utilities
- String formatting and manipulation
- Error classes and error handling utilities
- Logging utilities (structured logging interface)
- Retry logic (generic exponential backoff)
- ID generation (UUIDs, correlation IDs)
- Hash utilities (content hashing for cache keys)
- Validation helpers
- Pagination utilities
- Result type (Either/Result pattern)

**Dependencies:**

- `@systemmapper/types` — Shared type definitions

**External Dependencies:**

- `uuid` — UUID generation
- `date-fns` — Date manipulation

**Public APIs (Exports):**

- `Result<T, E>` — Result/Either type
- `AppError` — Base application error class
- `retry(fn, options)` — Generic retry with backoff
- `generateId()` — UUID generation
- `hashContent(content)` — Content hashing
- `formatDate(date)` — Date formatting
- `slugify(text)` — URL slug generation
- `paginate(items, options)` — Pagination helper
- `Logger` — Structured logging interface
- `CorrelationId` — Request correlation ID management

**Folder Structure:**

```
packages/shared/
├── src/
│   ├── index.ts               # Barrel export
│   ├── errors/                # Error classes
│   │   ├── app-error.ts
│   │   ├── not-found.error.ts
│   │   ├── unauthorized.error.ts
│   │   ├── validation.error.ts
│   │   ├── conflict.error.ts
│   │   └── index.ts
│   ├── utils/                 # Utility functions
│   │   ├── retry.ts
│   │   ├── hash.ts
│   │   ├── id-generator.ts
│   │   ├── date.ts
│   │   ├── string.ts
│   │   ├── slugify.ts
│   │   ├── pagination.ts
│   │   └── index.ts
│   ├── result/                # Result type
│   │   ├── result.ts
│   │   └── index.ts
│   ├── logging/               # Logging
│   │   ├── logger.ts
│   │   └── index.ts
│   └── correlation/           # Correlation ID
│       ├── correlation-id.ts
│       └── index.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

### 5.10 `packages/ui` — Shared UI Components

**Package Name:** `@systemmapper/ui`

**Purpose:** Reusable React components built on ShadCN UI and TailwindCSS. These are design-system-level components used by the web application.

**Responsibilities:**

- Provide themed, accessible UI components
- Wrap ShadCN UI components with SystemMapper styling
- Provide layout components (cards, panels, sidebars)
- Provide data display components (tables, lists, badges)
- Provide graph visualization primitives
- Provide chart components for metrics
- Export TailwindCSS configuration

**Dependencies:**

- `@systemmapper/types` — Type definitions for component props
- `@systemmapper/shared` — Formatting utilities

**External Dependencies:**

- `react`, `react-dom` — UI framework
- `tailwindcss` — CSS framework
- ShadCN UI components (installed, not imported as a package)
- `class-variance-authority` — Component variants
- `clsx` — Class name utilities
- `tailwind-merge` — TailwindCSS class merging

**Folder Structure:**

```
packages/ui/
├── src/
│   ├── index.ts               # Barrel export
│   ├── components/            # UI components
│   │   ├── button/
│   │   ├── card/
│   │   ├── badge/
│   │   ├── dialog/
│   │   ├── dropdown/
│   │   ├── input/
│   │   ├── table/
│   │   ├── tabs/
│   │   ├── tooltip/
│   │   ├── avatar/
│   │   ├── sidebar/
│   │   ├── command/
│   │   ├── skeleton/
│   │   └── index.ts
│   ├── charts/                # Chart components
│   │   ├── line-chart/
│   │   ├── bar-chart/
│   │   ├── donut-chart/
│   │   └── index.ts
│   ├── graph/                 # Graph visualization primitives
│   │   ├── graph-node/
│   │   ├── graph-edge/
│   │   ├── graph-controls/
│   │   ├── graph-minimap/
│   │   └── index.ts
│   ├── layout/                # Layout components
│   │   ├── page-header/
│   │   ├── page-content/
│   │   ├── section/
│   │   └── index.ts
│   └── utils/
│       ├── cn.ts              # clsx + tailwind-merge
│       └── variants.ts
├── tailwind.config.ts         # Shared TailwindCSS config
├── tsconfig.json
└── package.json
```

---

## 6. Inter-Package Dependency Rules

### 6.1 Allowed Dependencies Matrix

| Package | types | config | shared | database | github | graph | parser | risk-engine | analytics | ui |
|---------|:-----:|:------:|:------:|:--------:|:------:|:-----:|:------:|:-----------:|:---------:|:--:|
| **types** | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **config** | ✓ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **shared** | ✓ | ✗ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **database** | ✓ | ✓ | ✓ | — | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **github** | ✓ | ✓ | ✓ | ✗ | — | ✗ | ✗ | ✗ | ✗ | ✗ |
| **graph** | ✓ | ✓ | ✓ | ✗ | ✗ | — | ✗ | ✗ | ✗ | ✗ |
| **parser** | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | — | ✗ | ✗ | ✗ |
| **risk-engine** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| **analytics** | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | — | ✗ |
| **ui** | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — |

### 6.2 Enforcement

- Turborepo's dependency graph naturally enforces build ordering.
- ESLint with `eslint-plugin-import` configured with `no-restricted-imports` rules to prevent forbidden cross-package imports.
- A CI check (future) will validate the dependency graph against this matrix.
- The `risk-engine` package is intentionally isolated with only `types` as a dependency, ensuring it remains a pure business logic library.

---

## 7. Build Pipeline

### 7.1 Build Order

Turborepo automatically determines build order from package dependencies:

1. `@systemmapper/types` (no dependencies)
2. `@systemmapper/config`, `@systemmapper/shared` (depend on types)
3. `@systemmapper/risk-engine` (depends on types)
4. `@systemmapper/database`, `@systemmapper/github`, `@systemmapper/graph`, `@systemmapper/parser`, `@systemmapper/ui` (depend on types + shared/config)
5. `@systemmapper/analytics` (depends on database, types, shared)
6. `@systemmapper/api`, `@systemmapper/worker`, `@systemmapper/web` (depend on packages)

### 7.2 Build Caching

Turborepo caches build outputs based on:

- Source file content hashes
- Dependency build hashes
- Environment variable values
- Configuration file content

A cache hit skips the build entirely, producing near-instant rebuilds when only a subset of packages change.

### 7.3 Development Workflow

```bash
# Install all dependencies
pnpm install

# Start all applications in development mode
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run linting
pnpm lint

# Type check all packages
pnpm type-check

# Run only the API in development mode
pnpm --filter @systemmapper/api dev

# Run tests for a specific package
pnpm --filter @systemmapper/risk-engine test
```

---

*End of Monorepo Structure. Continue to [02-database-design.md](./02-database-design.md) →*
