# SystemMapper — Implementation Roadmap

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Milestone 1 — Monorepo Setup](#2-milestone-1--monorepo-setup)
3. [Milestone 2 — Authentication](#3-milestone-2--authentication)
4. [Milestone 3 — GitHub Integration](#4-milestone-3--github-integration)
5. [Milestone 4 — Repository Scanning](#5-milestone-4--repository-scanning)
6. [Milestone 5 — Parser](#6-milestone-5--parser)
7. [Milestone 6 — Graph](#7-milestone-6--graph)
8. [Milestone 7 — Risk Engine](#8-milestone-7--risk-engine)
9. [Milestone 8 — Visualization](#9-milestone-8--visualization)
10. [Milestone 9 — PR Comments](#10-milestone-9--pr-comments)
11. [Milestone 10 — Metrics](#11-milestone-10--metrics)
12. [Milestone 11 — Analytics](#12-milestone-11--analytics)
13. [Milestone 12 — Production Readiness](#13-milestone-12--production-readiness)
14. [Milestone 13 — The Temporal Flow](#14-milestone-13--the-temporal-flow)

---

## 1. Overview

The roadmap is structured as 13 sequential milestones. Each milestone builds on the previous ones and can be verified independently. The total estimated implementation time is approximately **14-19 weeks** for a small team (2-3 developers).

### 1.1 Dependency Graph

```
M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8
                                  ↓      ↓
                                 M9     M10 → M11
                                  ↓
                                 M12 → M13
```

---

## 2. Milestone 1 — Monorepo Setup

### Objectives
- Initialize the Turborepo monorepo with pnpm.
- Configure all shared tooling (TypeScript, ESLint, Prettier, Husky, Commitlint).
- Create stub packages for all packages in `packages/`.
- Create stub applications for `apps/api`, `apps/web`, `apps/worker`.
- Set up Docker Compose with PostgreSQL, Memgraph, and Redis.
- Establish the `@systemmapper/types` package with foundational enums and interfaces.

### Deliverables
- [ ] `pnpm-workspace.yaml` with all workspace paths
- [ ] `turbo.json` with build, lint, test pipeline definitions
- [ ] `tsconfig.base.json` with strict TypeScript settings
- [ ] Root `.eslintrc.js`, `.prettierrc`, `commitlint.config.js`
- [ ] `.husky/` with pre-commit and commit-msg hooks
- [ ] `docker-compose.yml` with PostgreSQL, Memgraph, Redis containers
- [ ] All `packages/*/package.json` with correct names and dependencies
- [ ] `packages/types/` with all enums and foundational interfaces
- [ ] `packages/config/` with Zod validation schemas
- [ ] `packages/shared/` with base utilities (logger, hash, uuid)
- [ ] `.env.example` files for root, API, web, worker
- [ ] All apps bootstrapped and running (`pnpm dev`)

### Dependencies
- None (first milestone)

### Acceptance Criteria
- `pnpm install` succeeds with zero errors.
- `pnpm build` compiles all packages successfully.
- `pnpm lint` passes with zero errors.
- `docker compose up` starts PostgreSQL, Memgraph, and Redis.
- Each app starts without errors (even if it serves nothing useful yet).
- Committing with an invalid message format is rejected by commitlint.

### Estimated Complexity
**Medium** — 1-2 weeks. Mostly configuration but requires getting many tools to work together.

---

## 3. Milestone 2 — Authentication

### Objectives
- Set up Prisma with the database schema.
- Implement Supabase Auth integration.
- Build the GitHub OAuth login flow.
- Create the `User`, `Organization`, `OrganizationMember` models and repositories.
- Implement RBAC with JWT guards.

### Deliverables
- [ ] `packages/database/prisma/schema.prisma` with User, Organization, OrganizationMember models
- [ ] Prisma initial migration
- [ ] `packages/database/src/repositories/` with user, organization, member repositories
- [ ] `apps/api/src/modules/auth/` with controller, service, guards
- [ ] JWT verification middleware
- [ ] AuthGuard, RolesGuard implementations
- [ ] `apps/web/` with login page, OAuth callback, auth provider
- [ ] Protected route middleware on frontend

### Dependencies
- Milestone 1 (monorepo, Docker, types)

### Acceptance Criteria
- User can log in via GitHub OAuth.
- JWT token is issued and validated on subsequent requests.
- Unauthenticated requests return 401.
- User can create an organization.
- Organization roles (OWNER, ADMIN, MEMBER, VIEWER) are enforced.
- Protected API endpoints reject unauthorized users.

### Estimated Complexity
**Medium** — 1-2 weeks.

---

## 4. Milestone 3 — GitHub Integration

### Objectives
- Implement the `@systemmapper/github` package.
- Set up GitHub App authentication (JWT, installation tokens).
- Implement webhook receiver with signature verification.
- Build repository listing and installation management.

### Deliverables
- [ ] `packages/github/` — Authentication service, repository service, webhook service
- [ ] Token cache with Redis
- [ ] Webhook signature verifier
- [ ] `apps/api/src/modules/webhooks/` — Webhook controller and handlers
- [ ] `apps/api/src/modules/github-integration/` — Installation listing endpoint
- [ ] Prisma models: `GitHubInstallation`, `Repository`, `RepositoryInstallation`
- [ ] Webhook event storage and idempotency check
- [ ] Rate limiting utility

### Dependencies
- Milestone 2 (auth, database, organizations)

### Acceptance Criteria
- API can generate GitHub App JWT and installation tokens.
- Webhook endpoint receives and verifies GitHub events.
- Duplicate webhook deliveries are detected and ignored.
- User can view available GitHub installations.
- User can list repositories available for connection.
- Rate limit tracking prevents exceeding GitHub API limits.

### Estimated Complexity
**Medium-High** — 1-2 weeks. GitHub App auth is complex.

---

## 5. Milestone 4 — Repository Scanning

### Objectives
- Implement repository connection (onboarding).
- Set up BullMQ with Redis.
- Build the `repository-scan` queue and processor.
- Fetch file trees from GitHub.
- Implement incremental scan detection via content hashing.

### Deliverables
- [ ] `apps/api/src/modules/repositories/` — Connect, disconnect, trigger scan
- [ ] Prisma models: `RepositoryScan`, `ParserMetadata`
- [ ] BullMQ queue setup in worker
- [ ] `apps/worker/src/processors/scan.processor.ts`
- [ ] File tree fetching via GitHub API
- [ ] Content hash comparison for incremental detection
- [ ] Scan progress tracking and status updates
- [ ] `apps/web/` — Repository list, connect flow, scan status

### Dependencies
- Milestone 3 (GitHub package, webhook handling)

### Acceptance Criteria
- User can connect a GitHub repository.
- Triggering a scan fetches the file tree.
- Scan progress is trackable (status transitions from PENDING → SCANNING → COMPLETED).
- Incremental scans detect changed files by comparing content hashes.
- Failed scans are retried up to 3 times.

### Estimated Complexity
**Medium** — 1-2 weeks.

---

## 6. Milestone 5 — Parser

### Objectives
- Implement the `@systemmapper/parser` package.
- Build the Tree-sitter parsing pipeline.
- Implement TypeScript and JavaScript extractors (P0 languages).
- Build the `repository-parse` queue and processor.
- Store parsed IR and update ParserMetadata.

### Deliverables
- [ ] `packages/parser/` — Full parser pipeline implementation
- [ ] Tree-sitter WASM loading and language registry
- [ ] TypeScript extractor with import, class, function, interface extraction
- [ ] JavaScript extractor (shares much with TypeScript)
- [ ] IR builder and validator
- [ ] `apps/worker/src/processors/parse.processor.ts`
- [ ] Parser test suite with fixture files
- [ ] Python and Go extractors (P1 — can be deferred)

### Dependencies
- Milestone 4 (scanning, file content fetching)

### Acceptance Criteria
- TypeScript files are correctly parsed into IR.
- Imports, classes, functions, interfaces, types, enums are extracted.
- Parse errors in one file don't break other files.
- Parsed IR matches expected output for all test fixtures.
- Parse performance: <200ms per 1000-line file.
- Parser test coverage ≥ 85%.

### Estimated Complexity
**High** — 2-3 weeks. Core technical work.

---

## 7. Milestone 6 — Graph

### Objectives
- Implement the `@systemmapper/graph` package.
- Build the graph builder that converts parsed IR to Memgraph nodes/relationships.
- Implement graph queries (blast radius, circular dependencies, dead code).
- Build the `graph-build` and `graph-update` queues.
- Create architecture snapshots.

### Deliverables
- [ ] `packages/graph/` — Driver, repositories, builders, queries, sync
- [ ] Memgraph constraint and index setup
- [ ] Graph builder: IR → Memgraph nodes and relationships
- [ ] Cypher query implementations (blast radius, circular deps, etc.)
- [ ] `apps/worker/src/processors/graph-build.processor.ts`
- [ ] `apps/worker/src/processors/graph-update.processor.ts`
- [ ] Prisma model: `ArchitectureSnapshot`
- [ ] Graph integration test suite
- [ ] Incremental graph update logic

### Dependencies
- Milestone 5 (parser output, parsed IR)

### Acceptance Criteria
- Parsed IR is correctly translated to Memgraph nodes and relationships.
- File → Class → Method containment hierarchy is correct.
- IMPORTS relationships correctly link source and target files.
- Blast radius traversal returns correct affected files with distances.
- Circular dependency detection finds known cycles.
- Incremental updates correctly remove old nodes and add new ones.
- Architecture snapshots are created after each scan.

### Estimated Complexity
**High** — 2-3 weeks. Core technical work.

---

## 8. Milestone 7 — Risk Engine

### Objectives
- Implement the `@systemmapper/risk-engine` package.
- Build all strategy implementations.
- Implement the risk scoring algorithm.
- Integrate with the blast radius pipeline.

### Deliverables
- [ ] `packages/risk-engine/` — All strategies implemented
- [ ] BlastRadiusStrategy with BFS traversal
- [ ] DependencyAnalysisStrategy with fan-in/fan-out
- [ ] CircularDependencyStrategy with Tarjan's SCC
- [ ] ArchitectureViolationStrategy with rule matching
- [ ] CriticalPathStrategy with longest path
- [ ] ReviewerSuggestionStrategy with ownership
- [ ] RiskScoringStrategy with weighted aggregation
- [ ] `apps/worker/src/processors/blast-radius.processor.ts`
- [ ] Full test suite with fixtures (coverage ≥ 90%)
- [ ] Prisma models: `RiskReport`, `BlastRadiusReport`

### Dependencies
- Milestone 6 (graph queries, dependency data)

### Acceptance Criteria
- Risk engine produces correct scores for fixture data.
- All strategies produce deterministic results.
- Risk score is bounded to 0-100.
- Risk levels are correctly classified (LOW/MEDIUM/HIGH/CRITICAL).
- Engine has zero runtime dependencies beyond `@systemmapper/types`.
- Test coverage ≥ 90%.

### Estimated Complexity
**High** — 2 weeks. Complex algorithms but well-defined boundaries.

---

## 9. Milestone 8 — Visualization

### Objectives
- Build the architecture visualization frontend.
- Implement graph rendering with React Flow and Cytoscape.js.
- Build snapshot comparison views.
- Create the blast radius visualization.

### Deliverables
- [ ] `apps/web/src/components/architecture/` — Graph canvas, controls, legend
- [ ] React Flow integration for node-link diagram
- [ ] Cytoscape.js integration for layout algorithms
- [ ] Node detail panel (click a node → see properties)
- [ ] Zoom, pan, filter controls
- [ ] Snapshot selector and comparison view
- [ ] Blast radius visualization (highlight affected nodes)
- [ ] Saved views CRUD
- [ ] `apps/api/src/modules/architecture/` — Graph data endpoint
- [ ] `apps/api/src/modules/saved-views/` — Saved views CRUD

### Dependencies
- Milestone 6 (graph data), Milestone 7 (blast radius data)

### Acceptance Criteria
- Architecture graph renders with nodes and edges.
- Nodes are colored by type (file, class, function).
- Users can zoom, pan, and filter the graph.
- Clicking a node shows its properties.
- Blast radius is visually highlighted.
- Two snapshots can be compared side by side.
- Views can be saved and restored.

### Estimated Complexity
**High** — 2 weeks. Complex frontend work.

---

## 10. Milestone 9 — PR Comments

### Objectives
- Implement the full PR analysis pipeline.
- Build the blast radius comment template.
- Integrate comment publishing with GitHub.
- Handle PR updates (re-analysis on new commits).

### Deliverables
- [ ] `packages/github/src/templates/blast-radius-comment.template.ts`
- [ ] `packages/github/src/services/comment.service.ts`
- [ ] Webhook handlers for `pull_request.opened` and `pull_request.synchronize`
- [ ] PR comment create/update logic with commentId tracking
- [ ] End-to-end flow: webhook → analysis → comment
- [ ] Prisma models: `PullRequest`, `PullRequestFile`, `Comment`
- [ ] `apps/web/` — PR list view, PR detail with risk data

### Dependencies
- Milestone 7 (risk engine), Milestone 3 (GitHub package)

### Acceptance Criteria
- When a PR is opened, blast radius analysis runs automatically.
- A comment is posted on the PR with the risk report.
- When new commits are pushed, the comment is updated.
- The comment includes risk score, affected files, and suggested reviewers.
- Duplicate comments are prevented (one comment per PR).

### Estimated Complexity
**Medium** — 1 week. Integration work, the hard parts are done.

---

## 11. Milestone 10 — Metrics

### Objectives
- Implement the `@systemmapper/analytics` calculators and scorers.
- Build the metrics computation pipeline.
- Create the metrics dashboard frontend.

### Deliverables
- [ ] `packages/analytics/src/calculators/` — All metric calculators
- [ ] `packages/analytics/src/scorers/` — Architecture, tech debt, health scorers
- [ ] `apps/worker/src/processors/metrics.processor.ts`
- [ ] Prisma model: `Metric`
- [ ] `apps/api/src/modules/metrics/` — Metrics endpoints
- [ ] `apps/web/src/components/metrics/` — Dashboard, cards, charts
- [ ] Historical metric storage and retrieval

### Dependencies
- Milestone 6 (graph data for metric computation)

### Acceptance Criteria
- Metrics are computed after each scan.
- Architecture score, technical debt score, and complexity score are calculated.
- Metrics are stored with timestamps for historical tracking.
- Dashboard displays current metrics with trend indicators.
- Metric history is available as a time series.

### Estimated Complexity
**Medium** — 1-2 weeks.

---

## 12. Milestone 11 — Analytics

### Objectives
- Build trend analysis and snapshot comparison features.
- Implement evolution tracking.
- Create analytics views in the frontend.

### Deliverables
- [ ] `packages/analytics/src/analyzers/` — Trend, snapshot comparator, evolution
- [ ] Snapshot comparison API and UI
- [ ] Trend charts with direction indicators
- [ ] Repository evolution timeline
- [ ] `apps/api/` — Trend and comparison endpoints
- [ ] `apps/web/` — Analytics dashboard with charts

### Dependencies
- Milestone 10 (metrics data)

### Acceptance Criteria
- Two snapshots can be compared showing deltas for all metrics.
- Trends are correctly classified as improving/declining/stable.
- Evolution timeline shows repository growth over time.
- Analytics dashboard provides actionable insights.

### Estimated Complexity
**Medium** — 1 week.

---

## 13. Milestone 12 — Production Readiness

### Objectives
- Error handling hardening.
- Notification system.
- Admin dashboard.
- Audit logging.
- Performance optimization.
- Documentation.

### Deliverables
- [ ] Notification system (in-app)
- [ ] Admin dashboard (job management, feature flags, audit logs)
- [ ] Audit logging for all state changes
- [ ] Global error handling and logging
- [ ] API key management
- [ ] Cleanup scheduler (purge old webhooks, notifications)
- [ ] Health check endpoints
- [ ] README and developer documentation
- [ ] Performance profiling and optimization

### Dependencies
- All previous milestones

### Acceptance Criteria
- All error scenarios are handled gracefully.
- Users receive notifications for important events.
- Admins can view and retry failed jobs.
- Audit log captures all state-changing operations.
- System recovers from transient failures (Memgraph restart, Redis restart).
- Docker Compose starts the full system in under 60 seconds.

### Estimated Complexity
**Medium** — 1-2 weeks.

---

## 14. Milestone 13 — The Temporal Flow

### Objectives
- Implement the macro system view with hierarchical edge bundling.
- Build the component deep dive panel.
- Create the dependency risk flow targeting view.
- Develop the temporal playback time-machine mode.

### Deliverables
- [ ] Timeline scrubber UI component in `apps/web/src/components/architecture/temporal/`
- [ ] Snapshot delta API to efficiently fetch graph changes over time
- [ ] Canvas rendering optimizations (WebGL if needed) for large-scale temporal data
- [ ] Historical ownership and activity tracking API

### Dependencies
- Milestone 8 (Visualization), Milestone 11 (Analytics)

### Acceptance Criteria
- User can scrub through historical architecture snapshots smoothly.
- Macro view prevents visual clutter using edge bundling.
- Deep dive panel accurately reflects historical component state and ownership.
- Risk flow dynamically highlights paths across time.

### Estimated Complexity
**High** — 2-3 weeks. Requires advanced frontend performance tuning and complex time-series data aggregation.

---

*End of Roadmap. Continue to [18-diagrams.md](./18-diagrams.md) →*
