# SystemMapper Implementation Roadmap (Modular & Priority-Ordered)

This roadmap focuses on strict modular task separation and prioritizes the core intelligence engine (VCS → Parser → Graph → Risk) over administrative features (Auth, User Management, Feature Gating) to ensure the highest-value capabilities are delivered first without dependency locks.

---

## Module 1: Core Database & Foundational Setup
*Priority: Critical | Dependency: None*

To avoid dependency locks, we first establish the absolute minimum persistence layer required by the core engines.

*   **Subtask 1.1: Base Prisma Schema**
    *   Setup `schema.prisma` with minimal tables: `Repository`, `ScanJob`, and `ArchitectureSnapshot`.
*   **Subtask 1.2: Redis & BullMQ Scaffolding**
    *   Initialize Redis connections and standard queue definitions (Scan, Parse, Graph).

---

## Module 2: VCS Integration (GitHub)
*Priority: Critical | Dependency: Module 1*

The engine needs source code to analyze. This module handles fetching the code and listening to repository events.

*   **Subtask 2.1: GitHub App Authentication**
    *   Implement JWT and Installation Token generation for GitHub API access.
*   **Subtask 2.2: Webhook Receiver & Verifier**
    *   Create endpoints to securely receive and verify `push` and `pull_request` webhook payloads.
*   **Subtask 2.3: Repository Download & Diff Fetching**
    *   Implement logic to fetch the specific files changed in a PR or download a shallow, temporary representation of the repository for full scans.
*   **Subtask 2.4: Scan Orchestrator Queue**
    *   Dispatch jobs to BullMQ when valid webhooks are received.

---

## Module 3: Code Parsing Engine
*Priority: Critical | Dependency: Module 2 (Mockable)*

Transforms raw source code into a standardized Intermediate Representation (IR). Can be built and tested independently using local fixture files.

*   **Subtask 3.1: Tree-sitter Environment Setup**
    *   Configure Tree-sitter WASM bindings inside the worker process.
*   **Subtask 3.2: TypeScript/JavaScript Extractors**
    *   Write grammars to extract modules, classes, functions, interfaces, and imports/exports.
*   **Subtask 3.3: IR (Intermediate Representation) Normalization**
    *   Map the raw AST outputs into the standardized, language-agnostic IR format.
*   **Subtask 3.4: Parsing Queue Consumer**
    *   Wire up the BullMQ consumer to ingest files from the VCS module, parse them, and pass the IR forward.

---

## Module 4: Graph Knowledge Engine
*Priority: Critical | Dependency: Module 3*

Takes the parsed IR and builds the architectural dependency graph in Memgraph.

*   **Subtask 4.1: Memgraph Connection & Schema**
    *   Setup the Neo4j/Bolt driver and define uniqueness constraints/indexes.
*   **Subtask 4.2: Graph Ingestion Builder**
    *   Write Cypher queries to `MERGE` nodes (Files, Classes) and create relationships (`IMPORTS`, `CALLS`).
*   **Subtask 4.3: Graph Synchronization Logic**
    *   Implement incremental updates (removing old nodes/edges when a file changes).
*   **Subtask 4.4: Graph Queries for Traversals**
    *   Write the foundational Cypher queries for shortest path, variable-length dependencies, and direct children.
*   **Subtask 4.5: Cross-Repository Dependency Resolution**
    *   Map HTTP calls in frontend repositories to API endpoints in backend repositories to stitch multiple codebases into a single unified map.

---

## Module 5: Risk & Blast Radius Engine
*Priority: High | Dependency: Module 4*

The core value proposition. Pure business logic operating on the graph data.

*   **Subtask 5.1: Blast Radius Traversal Algorithm**
    *   Given a changed file node, traverse the graph to find all downstream dependents.
*   **Subtask 5.2: Circular Dependency Detector**
    *   Implement Tarjan’s SCC algorithm or Cypher pathing to detect loops.
*   **Subtask 5.3: Deterministic Scoring System**
    *   Apply weighted scoring rules to calculate the 0-100 risk score.
*   **Subtask 5.4: Risk Report Generator**
    *   Format the engine's output into a structured JSON `BlastRadiusReport`.

---

## Module 6: Core Workflow (PR Automation)
*Priority: High | Dependency: Module 5 & Module 2*

Closes the loop by pushing intelligence back to the developer on GitHub.

*   **Subtask 6.1: Markdown Comment Templates**
    *   Design the visual layout of the automated GitHub PR comment.
*   **Subtask 6.2: GitHub PR API Publisher**
    *   Implement the API calls to post, update, and manage comments on PRs.
*   **Subtask 6.3: End-to-End Pipeline Integration**
    *   Connect Webhook → Download → Parse → Graph → Risk → PR Comment.

---

## Module 7: Visualization Frontend
*Priority: High | Dependency: Module 4 (API layer needed)*

The visual interface for developers to explore the architecture.

*   **Subtask 7.1: UI Shell & Canvas Scaffold**
    *   Setup the React Flow and Cytoscape.js canvas components in the Next.js app.
*   **Subtask 7.2: Layout Algorithms (Dagre/ELK)**
    *   Implement hierarchical layouts for complex dependency chains.
*   **Subtask 7.3: Interactive Overlays & Controls**
    *   Add minimaps, zoom/pan controls, and click-to-inspect node details.
*   **Subtask 7.4: Graph Data API Endpoint**
    *   Create the NestJS API endpoint that fetches the graph from Memgraph and serves it to the frontend.
*   **Subtask 7.5: Explore Mode (Public Repo Viewer)**
    *   Implement a "Guest Mode" input to parse and visualize public GitHub repository URLs anonymously without requiring the GitHub App installation.

---

## Module 8: Authentication & Single Sign-On (SSO)
*Priority: Medium | Dependency: Module 1*

Securing the platform. Pushed down the priority list so the core engine can be built without login walls.

*   **Subtask 8.1: Supabase Auth & GitHub OAuth SSO**
    *   Configure the OAuth provider and Next.js frontend login flow.
*   **Subtask 8.2: JWT Validation Guards**
    *   Implement NestJS guards to protect sensitive API endpoints.
*   **Subtask 8.3: User Context Injection**
    *   Ensure the authenticated user's ID is attached to all subsequent database calls.

---

## Module 9: User Management & Feature Gating
*Priority: Low | Dependency: Module 8*

Administrative features for organizations.

*   **Subtask 9.1: Multi-tenant Organization Models**
    *   Expand the database schema to handle Organizations and Memberships.
*   **Subtask 9.2: Role-Based Access Control (RBAC)**
    *   Implement `RolesGuard` in NestJS to differentiate between Owners, Admins, and Viewers.
*   **Subtask 9.3: Feature Flagging / Gating**
    *   Implement logic to restrict repository counts or specific features based on organization tiers.
*   **Subtask 9.4: Organization Dashboard UI**
    *   Build settings pages for users to manage team invites and repository access.

---

## Module 10: Metrics & Analytics
*Priority: Low | Dependency: Module 4*

Historical tracking and repository health insights.

*   **Subtask 10.1: Architecture Snapshot Storage**
    *   Serialize and save graph states periodically.
*   **Subtask 10.2: Metric Calculators**
    *   Compute complexity, dependency density, and architectural drift.
*   **Subtask 10.3: Analytics Dashboard UI**
    *   Build trend charts and snapshot comparison views.

---

## Module 11: VS Code Extension Integration
*Priority: Medium | Dependency: Module 5 & Module 7*

Bring the Risk Engine and Visualization directly into the developer's local IDE environment.

*   **Subtask 11.1: Extension Scaffolding**
    *   Initialize a new VS Code Extension project in the monorepo.
*   **Subtask 11.2: Local In-Memory Graph Adapter**
    *   Create an in-memory fallback for the graph data so the extension doesn't require a local Memgraph instance.
*   **Subtask 11.3: Local Parsing & Analysis**
    *   Run `@systemmapper/parser` on local file changes and feed the local graph into `@systemmapper/risk-engine`.
*   **Subtask 11.4: Webview Visualization**
    *   Mount the `@systemmapper/visualization` React components inside a VS Code Webview panel to render the blast radius locally.

---

## Module 12: Real-time Infrastructure (WebSockets)
*Priority: Medium | Dependency: Module 7*

Upgrade the exploration and scanning experience from HTTP polling to a real-time WebSocket connection.

*   **Subtask 12.1: NestJS WebSocket Gateway**
    *   Implement `@WebSocketGateway()` in the API app to manage active client connections and rooms based on `jobId` or `repositoryId`.
*   **Subtask 12.2: BullMQ Job Event Broadcaster**
    *   Listen to BullMQ job events (progress, completed, failed) in the worker and broadcast them to the WebSocket gateway using Redis Pub/Sub.
*   **Subtask 12.3: Frontend WebSocket Client**
    *   Refactor the Next.js `/explore` page to subscribe to the WebSocket channel instead of polling the REST API for status updates.
