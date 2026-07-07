# SystemMapper — Executive Summary

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Status:** Draft — Approved for Implementation
**Author:** Principal Software Architect

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Vision Statement](#2-vision-statement)
3. [Problem Statement](#3-problem-statement)
4. [Primary Goals](#4-primary-goals)
5. [Non-Goals (MVP)](#5-non-goals-mvp)
6. [Project Principles](#6-project-principles)
7. [Technology Stack](#7-technology-stack)
8. [Architecture Philosophy](#8-architecture-philosophy)
9. [System Context](#9-system-context)
10. [Stakeholders](#10-stakeholders)
11. [Document Index](#11-document-index)
12. [Glossary](#12-glossary)

---

## 1. Project Overview

**SystemMapper** is an Engineering Intelligence Platform designed to provide deep, automated architectural insights into software systems. The platform operates by scanning GitHub repositories, parsing source code into Abstract Syntax Trees (ASTs) using Tree-sitter, constructing a rich architectural dependency graph within Memgraph, and storing all business metadata, user data, and operational state in PostgreSQL (via Supabase).

The platform's core differentiator is its **deterministic blast radius analysis** — the ability to calculate, with mathematical precision, the downstream impact of any code change (Pull Request) by traversing the architectural dependency graph. This analysis is then surfaced directly within the developer's workflow via automated Pull Request comments on GitHub.

Beyond blast radius, SystemMapper provides:

- **Interactive architecture visualization** using React Flow and Cytoscape.js, enabling teams to explore their codebase's structure visually.
- **Historical architecture snapshots** that capture the state of the dependency graph at specific points in time, enabling architectural evolution tracking.
- **Repository-level metrics** covering complexity, dependency density, and architectural health.
- **Team collaboration features** including shared views, notifications, and role-based access control.

### 1.1 MVP Boundary

The Minimum Viable Product (MVP) is explicitly scoped to operate **without any Large Language Model (LLM) dependency**. All risk calculations, scoring algorithms, and architectural analyses are deterministic — they produce identical outputs for identical inputs. This is a foundational design constraint that ensures reproducibility, testability, and auditability of all platform outputs.

AI-powered features (natural language explanations of blast radius, suggested refactoring, automated code review summaries) are architecturally planned as a future **optional explanation layer** that augments but never replaces the deterministic core.

### 1.2 Deployment Scope

The MVP targets **local development only**. The entire platform runs via Docker Compose on a developer's machine. Production deployment infrastructure (Kubernetes, cloud services, CI/CD pipelines) is explicitly out of scope for this architecture document but the system is designed with future cloud deployment in mind.

---

## 2. Vision Statement

> **Empower engineering teams to understand, measure, and improve their software architecture through deterministic analysis, rich visualization, and automated risk assessment — without relying on AI black boxes.**

SystemMapper transforms the implicit knowledge trapped in codebases into explicit, queryable, visualizable architectural intelligence. It makes the invisible connections between components visible and the downstream impact of changes quantifiable.

---

## 3. Problem Statement

Modern software systems suffer from several interconnected problems:

| Problem | Impact |
|---------|--------|
| **Invisible Dependencies** | Developers cannot see how components are connected across service boundaries, leading to unexpected breakages. |
| **Unknown Blast Radius** | Pull Request reviewers have no way to quantitatively assess the downstream impact of a code change. |
| **Architecture Drift** | Systems gradually deviate from their intended architecture, accumulating technical debt that is invisible until it becomes critical. |
| **Knowledge Silos** | Architectural knowledge lives in developers' heads, not in queryable systems. Team departures cause knowledge loss. |
| **No Historical Context** | There is no record of how the architecture evolved over time, making it impossible to correlate architectural changes with quality outcomes. |
| **Manual Risk Assessment** | Code review relies on individual reviewers' mental models, which are incomplete and inconsistent. |
| **Metric Gaps** | Teams lack quantitative metrics for architectural health, dependency complexity, and technical debt. |

SystemMapper addresses each of these problems through automated analysis, graph-based reasoning, and deterministic scoring.

---

## 4. Primary Goals

The MVP must deliver the following capabilities:

### 4.1 GitHub App Integration

- Register as a GitHub App with appropriate permissions.
- Support OAuth-based user authentication via GitHub.
- Receive and process webhook events (push, pull_request, installation).
- Respect GitHub API rate limits with exponential backoff.

### 4.2 Repository Onboarding

- Users install the GitHub App on their organization or personal repositories.
- The platform discovers and lists available repositories.
- Users select repositories to onboard into SystemMapper.
- Onboarding triggers an initial full scan.

### 4.3 Repository Scanning

- Clone or fetch repository contents via the GitHub API (not git clone).
- Traverse the repository file tree.
- Identify parseable source files by language and extension.
- Queue files for AST parsing.
- Track scan progress and status.

### 4.4 AST Parsing

- Parse source files using Tree-sitter grammars.
- Extract structural elements: modules, classes, functions, methods, interfaces, types, enums, variables, imports, exports.
- Normalize AST output into a language-agnostic Intermediate Representation (IR).
- Support incremental parsing (only re-parse changed files on subsequent scans).
- Handle parse errors gracefully without aborting the entire scan.

### 4.5 Dependency Graph Generation

- Transform the normalized IR into Memgraph graph nodes and relationships.
- Build a multi-layered dependency graph: file-level, module-level, class-level, function-level.
- Resolve import paths to actual graph nodes.
- Detect and record: imports, function calls, class inheritance, interface implementations, type usage, variable references.

### 4.6 Blast Radius Analysis

- Given a set of changed files (from a Pull Request), traverse the dependency graph to identify all directly and transitively affected components.
- Calculate a deterministic risk score based on: number of affected components, depth of dependency chain, criticality of affected components, presence of circular dependencies.
- Generate a structured Blast Radius Report containing affected files, affected functions, affected classes, dependency chains, risk score, and risk level.

### 4.7 Pull Request Comments

- Automatically post a formatted comment on GitHub Pull Requests containing the Blast Radius Report.
- Update the comment when the PR is updated (new commits pushed).
- Include visual indicators (risk level badges, affected component counts).
- Link back to the SystemMapper dashboard for detailed exploration.

### 4.8 Interactive Architecture Visualization

- Render the dependency graph as an interactive, zoomable, pannable diagram.
- Support multiple layout algorithms (hierarchical, force-directed, radial).
- Allow filtering by: file type, module, dependency depth, component type.
- Highlight blast radius visually on the graph.
- Support node clicking for detailed component information.

### 4.9 Historical Architecture Snapshots

- Capture a full snapshot of the dependency graph at each scan.
- Store snapshot metadata (timestamp, commit SHA, branch, scan ID) in PostgreSQL.
- Enable comparison between snapshots to identify architectural changes over time.
- Provide a timeline view of architectural evolution.

### 4.10 Repository Metrics

- Calculate and store: file count, function count, class count, dependency count, average dependency depth, circular dependency count, orphan file count, complexity score, architecture score.
- Update metrics after each scan.
- Display metrics on the repository dashboard.

### 4.11 Team Collaboration

- Organization-based multi-tenancy.
- Role-based access control (Owner, Admin, Member, Viewer).
- Repository-level permissions.
- Saved views (persisted graph filter/layout configurations).
- Notifications for scan completions, risk alerts, and PR comments.

---

## 5. Non-Goals (MVP)

The following are explicitly **not** in scope for the MVP:

| Non-Goal | Rationale |
|----------|-----------|
| LLM-powered explanations | MVP must be fully deterministic. AI is a future layer. |
| Production deployment | MVP runs locally via Docker Compose only. |
| Multi-cloud support | No cloud-specific infrastructure. |
| Real-time collaboration | Not needed for initial version. WebSocket support planned for future. |
| Custom parser grammars | MVP uses built-in Tree-sitter grammars only. |
| Self-hosted GitHub Enterprise | MVP targets github.com only. |
| GitLab / Bitbucket | GitHub-only for MVP. Multi-provider is a future feature. |
| DORA metrics | Architecturally planned but not implemented in MVP. |
| Automated refactoring suggestions | Future AI-powered feature. |
| Code generation | Out of scope entirely. |
| Mobile application | Web-only for MVP. |
| Public API | API exists but is not documented or versioned for external consumption in MVP. |

---

## 6. Project Principles

These principles are non-negotiable and must be adhered to across all packages, applications, and services.

### 6.1 Strict TypeScript

- `strict: true` in all `tsconfig.json` files.
- No `any` types unless absolutely unavoidable and explicitly documented.
- All function parameters and return types must be explicitly typed.
- No implicit type coercion.

### 6.2 No Duplicated Types

- All shared types live in the `@systemmapper/types` package.
- No type definition may exist in more than one package.
- DTOs, interfaces, enums, and constants are centralized.

### 6.3 No Duplicated Business Logic

- Business logic lives in dedicated packages (`risk-engine`, `analytics`, `parser`, `graph`).
- Applications (`web`, `api`, `worker`) are thin orchestration layers that compose package functionality.
- If logic is used by more than one application, it must be extracted into a package.

### 6.4 Dependency Injection

- NestJS applications use NestJS's built-in DI container.
- Pure packages (e.g., `risk-engine`) use constructor injection without framework dependency.
- All services depend on interfaces (abstractions), not concrete implementations.

### 6.5 SOLID Principles

- **Single Responsibility:** Every class, module, and package has one reason to change.
- **Open/Closed:** Systems are open for extension (new strategies, new parsers) but closed for modification.
- **Liskov Substitution:** All implementations of an interface are interchangeable.
- **Interface Segregation:** No client is forced to depend on interfaces it doesn't use.
- **Dependency Inversion:** High-level modules depend on abstractions, not low-level modules.

### 6.6 Clean Architecture

- The dependency rule flows inward: Frameworks → Application → Domain.
- Domain entities and business rules have zero framework dependencies.
- Use cases orchestrate domain logic.
- Adapters (repositories, controllers, gateways) translate between the domain and external systems.

### 6.7 Repository Pattern

- All database access goes through repository interfaces.
- Repositories are defined as interfaces in the domain layer.
- Implementations live in the infrastructure layer.
- This enables testing with in-memory repositories.

### 6.8 Feature-First Architecture

- Within each application, code is organized by feature, not by technical layer.
- Example: `features/repositories/` contains the controller, service, DTOs, and tests for the repository feature.
- Shared infrastructure (guards, interceptors, filters) lives in a `common/` directory.

### 6.9 Single Responsibility Packages

- Each package in `packages/` has exactly one domain concern.
- `parser` does not know about `risk-engine`.
- `graph` does not know about `github`.
- Cross-cutting concerns flow through shared types and event contracts.

---

## 7. Technology Stack

### 7.1 Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14+ (App Router) | React framework with server-side rendering, file-based routing |
| TypeScript | 5.x | Type-safe JavaScript |
| TailwindCSS | 3.x | Utility-first CSS framework |
| ShadCN UI | Latest | Accessible, composable UI component library |
| React Query (TanStack Query) | 5.x | Server state management, caching, synchronization |
| React Flow | 11.x | Node-based graph visualization for architecture diagrams |
| Cytoscape.js | 3.x | Advanced graph analysis and alternative visualization |

**Rationale:** Next.js App Router provides server components for initial page loads (reducing client-side JavaScript), while React Query handles all client-side data fetching with built-in caching, deduplication, and background refetching. React Flow provides a polished, interactive node-graph experience suitable for architecture visualization, while Cytoscape.js offers a more analysis-oriented graph rendering engine for complex traversals and layouts.

### 7.2 Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| NestJS | 10.x | Enterprise Node.js framework with DI, modules, decorators |
| TypeScript | 5.x | Type-safe JavaScript |
| Prisma | 5.x | Type-safe ORM for PostgreSQL |
| class-validator | Latest | DTO validation via decorators |
| class-transformer | Latest | DTO transformation |
| Passport | Latest | Authentication middleware |
| @nestjs/bull | Latest | BullMQ integration for job queues |

**Rationale:** NestJS is chosen for its strong opinions on architecture (modules, providers, guards, interceptors), built-in dependency injection, and first-class TypeScript support. Its module system maps naturally to Clean Architecture's layer separation. Prisma provides type-safe database access with auto-generated types that feed into the shared types package.

### 7.3 Worker

| Technology | Version | Purpose |
|-----------|---------|---------|
| NestJS (Standalone) | 10.x | Worker process using NestJS DI without HTTP server |
| BullMQ | 4.x | Redis-backed job queue processing |
| Tree-sitter | Latest | AST parsing via WASM bindings |
| neo4j-driver | 5.x | Neo4j Bolt protocol driver |

**Rationale:** The worker runs as a standalone NestJS application (no HTTP listener) that consumes jobs from BullMQ queues. Using NestJS's DI container in the worker ensures consistent dependency resolution and testability. The worker is the only component that directly interacts with Tree-sitter and Memgraph, keeping these concerns isolated from the API server.

### 7.4 Data Stores

| Technology | Version | Purpose |
|-----------|---------|---------|
| Supabase PostgreSQL | Latest | Primary relational database, user auth, business data |
| Memgraph Community Edition | 5.x | Graph database for dependency graphs |
| Redis | 7.x | Job queue backing store, caching |

**Rationale:** Supabase provides PostgreSQL with built-in authentication, row-level security, and real-time capabilities (for future use). Memgraph is the industry standard for graph databases and provides Cypher — a powerful graph query language essential for dependency traversal, blast radius calculation, and circular dependency detection. Redis backs BullMQ for reliable job queue processing.

### 7.5 Infrastructure

| Technology | Version | Purpose |
|-----------|---------|---------|
| pnpm | 8.x | Fast, disk-efficient package manager with workspace support |
| Turborepo | Latest | High-performance monorepo build system with caching |
| Docker Compose | 3.x | Local development orchestration |
| ESLint | 8.x | TypeScript linting |
| Prettier | 3.x | Code formatting |
| Husky | 8.x | Git hooks |
| Commitlint | Latest | Conventional commit enforcement |
| Vitest | Latest | Unit and integration testing |

---

## 8. Architecture Philosophy

### 8.1 Clean Architecture Layers

SystemMapper follows a four-layer Clean Architecture:

```
┌─────────────────────────────────────────────┐
│            Frameworks & Drivers             │
│  (Next.js, NestJS, Prisma, Neo4j driver,   │
│   BullMQ, Tree-sitter, React Flow)          │
├─────────────────────────────────────────────┤
│         Interface Adapters                   │
│  (Controllers, Repositories, Presenters,    │
│   Gateways, Queue Producers/Consumers)      │
├─────────────────────────────────────────────┤
│         Application (Use Cases)              │
│  (Scan Repository, Calculate Blast Radius,  │
│   Generate Metrics, Post PR Comment)        │
├─────────────────────────────────────────────┤
│              Domain (Entities)               │
│  (Repository, File, DependencyGraph,        │
│   BlastRadius, RiskScore, Metric)           │
└─────────────────────────────────────────────┘
```

**Dependency Rule:** Dependencies point inward only. The Domain layer has zero external dependencies. The Application layer depends only on Domain. Interface Adapters depend on Application and Domain. Frameworks depend on everything above.

### 8.2 Package Independence

Each package in `packages/` is designed as an independent unit that can be:

- Developed in isolation
- Tested without other packages running
- Versioned independently (future)
- Replaced without affecting other packages (as long as the interface contract is maintained)

### 8.3 Event-Driven Decoupling

Applications communicate through events and job queues rather than direct function calls. This ensures:

- The API server doesn't need to wait for parsing to complete.
- The worker can process jobs asynchronously at its own pace.
- New consumers can be added without modifying producers.
- Failed jobs can be retried without affecting the rest of the system.

### 8.4 Deterministic Core

The `risk-engine` package is the heart of the system. It is designed as a **pure function library** — given the same inputs (dependency graph data, changed files), it always produces the same outputs (risk score, blast radius). This makes it:

- Trivially testable (no mocks needed for the core logic)
- Reproducible (scores can be audited and verified)
- Framework-independent (no NestJS, no database, no side effects)

---

## 9. System Context

### 9.1 External Systems

| System | Integration | Direction |
|--------|------------|-----------|
| GitHub API | REST API v3, GraphQL v4 | Bidirectional |
| GitHub Webhooks | Inbound HTTP | Inbound |
| GitHub OAuth | OAuth 2.0 | Outbound |
| Supabase Auth | REST API, JWT | Bidirectional |
| Memgraph | Bolt Protocol | Bidirectional |
| Redis | TCP | Bidirectional |

### 9.2 Users

| User Type | Description |
|-----------|-------------|
| Developer | Views architecture, checks blast radius on PRs |
| Tech Lead | Monitors metrics, reviews architectural health |
| Engineering Manager | Tracks metrics trends, views team-level dashboards |
| Platform Admin | Manages organization settings, permissions, integrations |

---

## 10. Stakeholders

| Stakeholder | Concern |
|-------------|---------|
| Development Team | Clear module boundaries, testability, developer experience |
| Product Owner | Feature completeness, MVP scope, future extensibility |
| DevOps (Future) | Containerization, resource requirements, observability hooks |
| Security | Authentication, authorization, data isolation, audit logging |
| End Users | Performance, accuracy of blast radius, visualization quality |

---

## 11. Document Index

This architecture blueprint consists of the following documents:

| Document | File | Description |
|----------|------|-------------|
| Executive Summary | `00-executive-summary.md` | This document |
| Monorepo Structure | `01-monorepo-structure.md` | Turborepo layout, package purposes, dependencies, APIs |
| Database Design | `02-database-design.md` | Complete Prisma schema specification |
| Graph Design | `03-graph-design.md` | Memgraph node types, relationships, Cypher queries |
| Sync Strategy | `04-sync-strategy.md` | PostgreSQL ↔ Memgraph synchronization |
| Parser Architecture | `05-parser-architecture.md` | Tree-sitter pipeline, AST normalization |
| Risk Engine | `06-risk-engine.md` | Strategy pattern, scoring, interfaces |
| Analytics Package | `07-analytics-package.md` | Metrics, trends, scoring |
| GitHub Package | `08-github-package.md` | App integration, webhooks, OAuth |
| Queue Architecture | `09-queue-architecture.md` | BullMQ queues, DLQ, retry policies |
| Event Architecture | `10-event-architecture.md` | Domain events, sequence diagrams |
| API Design | `11-api-design.md` | REST API specification, RBAC, DTOs |
| Shared Types | `12-shared-types.md` | Interfaces, enums, constants |
| Folder Structure | `13-folder-structure.md` | Complete directory tree |
| Environment Variables | `14-environment-variables.md` | .env.example for all apps |
| Coding Standards | `15-coding-standards.md` | Linting, formatting, conventions |
| Testing Strategy | `16-testing-strategy.md` | Test categories, tools, patterns |
| Roadmap | `17-roadmap.md` | 12-milestone implementation plan |
| Diagrams | `18-diagrams.md` | All Mermaid diagrams |
| ADRs | `19-adrs.md` | Architecture Decision Records |
| Graph Package | `20-graph-package.md` | Graph repository, builders, traversal |
| Temporal Flow Architecture | `29-temporal-flow-architecture.md` | Time-machine view of architectural evolution |

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **AST** | Abstract Syntax Tree — a tree representation of source code structure |
| **Blast Radius** | The set of components transitively affected by a code change |
| **Cypher** | Memgraph's declarative graph query language |
| **DI** | Dependency Injection — a design pattern for achieving inversion of control |
| **DLQ** | Dead Letter Queue — a queue for messages that cannot be processed |
| **DTO** | Data Transfer Object — a typed structure for data moving between layers |
| **IR** | Intermediate Representation — a normalized, language-agnostic format for parsed code |
| **MVP** | Minimum Viable Product |
| **RBAC** | Role-Based Access Control |
| **SOLID** | Five principles of object-oriented design (SRP, OCP, LSP, ISP, DIP) |
| **Tree-sitter** | An incremental parsing system for programming languages |
| **Turborepo** | A high-performance build system for JavaScript/TypeScript monorepos |

---

*End of Executive Summary. Continue to [01-monorepo-structure.md](./01-monorepo-structure.md) →*
