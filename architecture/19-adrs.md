# SystemMapper — Architecture Decision Records

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [ADR-001: Dual-Database Architecture](#adr-001-dual-database-architecture)
2. [ADR-002: Tree-sitter for Parsing](#adr-002-tree-sitter-for-parsing)
3. [ADR-003: Deterministic Risk Engine](#adr-003-deterministic-risk-engine)
4. [ADR-004: Strategy Pattern for Risk Analysis](#adr-004-strategy-pattern-for-risk-analysis)
5. [ADR-005: File-Level Incremental Updates](#adr-005-file-level-incremental-updates)
6. [ADR-006: Turborepo Monorepo](#adr-006-turborepo-monorepo)
7. [ADR-007: BullMQ for Job Processing](#adr-007-bullmq-for-job-processing)
8. [ADR-008: PostgreSQL as Source of Truth](#adr-008-postgresql-as-source-of-truth)
9. [ADR-009: No LLM Dependency in MVP](#adr-009-no-llm-dependency-in-mvp)
10. [ADR-010: Supabase for Auth and Database](#adr-010-supabase-for-auth-and-database)
11. [ADR-011: Risk Engine Zero Dependencies](#adr-011-risk-engine-zero-dependencies)
12. [ADR-012: Content Hash Incremental Parsing](#adr-012-content-hash-incremental-parsing)

---

## ADR-001: Dual-Database Architecture

**Status:** Accepted

**Context:**
SystemMapper needs to store both relational business data (users, organizations, scans) and a complex dependency graph (files, imports, calls). These two data models have fundamentally different query patterns.

**Decision:**
Use PostgreSQL for relational/business data and Memgraph for the architectural dependency graph.

**Rationale:**
- PostgreSQL excels at ACID transactions, relational integrity, aggregation queries, and full-text search. It is the right tool for business metadata.
- Memgraph excels at graph traversals, path queries, cycle detection, and neighborhood queries. It is the right tool for dependency analysis.
- Attempting to model a dependency graph in PostgreSQL would require recursive CTEs that are orders of magnitude slower than native graph traversals.
- Attempting to model relational business data in Memgraph would sacrifice ACID guarantees and relational integrity.

**Consequences:**
- Two databases to manage, deploy, and monitor.
- A synchronization strategy is needed (documented in [04-sync-strategy.md](./04-sync-strategy.md)).
- Memgraph can be rebuilt from PostgreSQL + source code, so it is a derived store, not a source of truth.
- Developers need knowledge of both SQL/Prisma and Cypher.

---

## ADR-002: Tree-sitter for Parsing

**Status:** Accepted

**Context:**
The parser needs to extract structural elements (imports, classes, functions) from source code across multiple programming languages.

**Alternatives Considered:**
1. **TypeScript Compiler API** — Only supports TypeScript/JavaScript.
2. **Babel** — Only supports JavaScript/TypeScript. Slow for large files.
3. **SWC** — Only supports JavaScript/TypeScript. No AST query API.
4. **Tree-sitter** — Supports 100+ languages. Incremental parsing. Error recovery. WASM bindings.
5. **Language-specific parsers** — One parser per language. High maintenance burden.

**Decision:**
Use Tree-sitter with WASM bindings for all language parsing.

**Rationale:**
- Multi-language support from day one. Adding a new language requires only a grammar WASM file and an extractor.
- Built-in error recovery — continues parsing past syntax errors.
- Incremental parsing support (future optimization).
- Battle-tested at scale by GitHub (used in github.com code navigation).
- WASM bindings provide cross-platform support without native compilation.

**Consequences:**
- Each language needs a custom extractor to normalize the CST into the common IR.
- Tree-sitter CSTs are verbose — extractors must navigate deep node hierarchies.
- WASM binaries (~1-3MB per language) are bundled with the package.
- Tree-sitter's query language (S-expressions) has a learning curve.

---

## ADR-003: Deterministic Risk Engine

**Status:** Accepted

**Context:**
The risk engine calculates scores for pull requests. These scores are shown to developers and influence review decisions. Trust in the system requires predictable, explainable results.

**Decision:**
All risk calculations are deterministic. No LLM, no probabilistic models, no sampling.

**Rationale:**
- Deterministic scores are reproducible — the same PR always gets the same score.
- Deterministic scores are auditable — every score can be explained by tracing the algorithm.
- Deterministic scores are testable — expected outputs can be asserted in unit tests.
- Probabilistic or LLM-based scores would undermine trust ("why did the score change between runs?").
- AI can be added as an optional explanation layer in the future without affecting the core score.

**Consequences:**
- Scoring algorithms are simpler but may miss nuanced risk patterns that ML could detect.
- All algorithm parameters (weights, thresholds, decay factors) must be explicitly defined.
- Future AI features must be clearly separated from the deterministic core.

---

## ADR-004: Strategy Pattern for Risk Analysis

**Status:** Accepted

**Context:**
Risk analysis involves multiple independent analyses (blast radius, circular dependencies, architecture violations, etc.) that need to be composed into a final report.

**Decision:**
Use the Strategy Pattern to decompose risk analysis into independent, composable strategies.

**Rationale:**
- Each strategy is independently testable.
- New strategies can be added without modifying existing ones (Open/Closed Principle).
- The future AI explanation strategy can be inserted without changing the core engine.
- Strategy execution order is explicit and configurable.
- Each strategy has a well-defined input/output contract.

**Consequences:**
- Each strategy only sees the raw input and previous strategy results (via StrategyContext).
- The RiskScoringStrategy must run last and understand all other strategy outputs.
- Adding a new strategy requires updating the scoring aggregation.

---

## ADR-005: File-Level Incremental Updates

**Status:** Accepted

**Context:**
When a repository is scanned incrementally (after a push), the system needs to decide what to re-parse and re-graph.

**Alternatives Considered:**
1. **Full re-parse on every scan** — Simple but slow. O(n) for every scan.
2. **Function-level diff** — Complex AST diffing. Error-prone. Hard to maintain.
3. **File-level with content hash** — Re-parse only changed files. Good balance.

**Decision:**
Use file-level granularity with SHA-256 content hashing for incremental detection.

**Rationale:**
- Content hashing is simple, deterministic, and fast.
- File-level granularity avoids the complexity of AST diffing.
- Tree-sitter can parse a 10,000-line file in <100ms, so re-parsing an entire file is not a bottleneck.
- Graph updates are atomic at the file level: delete all nodes from the file, re-create from fresh parse.

**Consequences:**
- Unchanged files are completely skipped (fast).
- Changed files are fully re-parsed (slightly wasteful for small changes, but simple).
- No need to track which functions changed within a file.
- Graph operations are idempotent at the file level.

---

## ADR-006: Turborepo Monorepo

**Status:** Accepted

**Context:**
SystemMapper has 3 applications and 11 packages that share types, utilities, and configuration.

**Alternatives Considered:**
1. **Nx** — More features, steeper learning curve, heavier.
2. **Lerna** — Legacy, less maintained, limited caching.
3. **Turborepo** — Simple, fast, good caching, Vercel ecosystem.
4. **pnpm workspaces alone** — No build caching or task orchestration.

**Decision:**
Use Turborepo with pnpm workspaces.

**Rationale:**
- Turborepo's remote caching speeds up CI builds significantly.
- Simple configuration via `turbo.json`.
- Good integration with Vercel (project sponsor consideration for future).
- pnpm's strict node_modules structure prevents phantom dependencies.
- Lower learning curve than Nx.

**Consequences:**
- All packages must have properly declared dependencies in `package.json`.
- Build order is determined by the dependency graph in `turbo.json`.
- No code generation features (unlike Nx). Packages are created manually.

---

## ADR-007: BullMQ for Job Processing

**Status:** Accepted

**Context:**
Background jobs (parsing, graph building, blast radius) need to be processed reliably with retry support, priority queues, and monitoring.

**Alternatives Considered:**
1. **In-process async** — No retry, no persistence, no monitoring.
2. **RabbitMQ** — Powerful but complex setup, separate service.
3. **AWS SQS** — Cloud-only, not suitable for local development.
4. **BullMQ** — Redis-based, TypeScript-native, simple, feature-rich.

**Decision:**
Use BullMQ with Redis for all job processing.

**Rationale:**
- TypeScript-first with excellent type support.
- Redis is already needed and simple to set up in Docker.
- Built-in retry, backoff, priority, rate limiting, and monitoring.
- Flow producer pattern enables parent-child job relationships.
- Active maintenance and large community.

**Consequences:**
- Redis must be `noeviction` to prevent job loss.
- Single Redis instance is a bottleneck (acceptable for local development).
- BullMQ UI (Bull Board) can be added for job monitoring.

---

## ADR-008: PostgreSQL as Source of Truth

**Status:** Accepted

**Context:**
With two databases (PostgreSQL and Memgraph), a clear source of truth must be established.

**Decision:**
PostgreSQL is the source of truth for all business data. Memgraph is a derived projection that can be rebuilt.

**Rationale:**
- PostgreSQL provides ACID transactions, referential integrity, and backup/restore.
- If Memgraph data is lost, it can be fully rebuilt by re-scanning and re-parsing.
- If PostgreSQL data is lost, the system cannot recover (user data, scan history gone).
- This asymmetry makes PostgreSQL the natural source of truth.

**Consequences:**
- PostgreSQL is always written first, then Memgraph.
- Memgraph rebuild is a supported operation (manually triggered or automatic on schema migration).
- Business decisions (which repos are connected, which scans have run) are always in PostgreSQL.

---

## ADR-009: No LLM Dependency in MVP

**Status:** Accepted

**Context:**
AI/LLM features could add value (natural language explanations of risk, code review suggestions). However, they introduce nondeterminism, latency, cost, and third-party dependency.

**Decision:**
The MVP has zero LLM dependencies. All analysis is deterministic. AI is planned as an optional future layer.

**Rationale:**
- Deterministic analysis builds user trust.
- No API cost for LLM calls.
- No latency from external API calls.
- No dependency on OpenAI/Anthropic availability.
- The architecture explicitly supports a future `AIExplanationStrategy` that can be plugged in without modifying the core engine.

**Consequences:**
- Natural language explanations are template-based, not AI-generated.
- The `OPENAI_API_KEY` environment variable is present but unused in MVP.
- The risk engine's strategy pattern makes future AI integration straightforward.

---

## ADR-010: Supabase for Auth and Database

**Status:** Accepted

**Context:**
The application needs authentication (GitHub OAuth), a PostgreSQL database, and user management.

**Alternatives Considered:**
1. **Auth0** — Powerful but expensive for development.
2. **Firebase Auth** — Google ecosystem, no PostgreSQL.
3. **Self-managed JWT** — More work, security risks.
4. **Supabase** — Open-source, PostgreSQL-native, free tier, Auth + DB in one.

**Decision:**
Use Supabase for both authentication and the PostgreSQL database.

**Rationale:**
- Single service provides both auth and database.
- PostgreSQL-native means Prisma works directly.
- Free tier is generous for development.
- Self-hostable for future production deployment.
- Built-in Row Level Security (future use).

**Consequences:**
- Dependency on Supabase client libraries.
- JWT verification uses Supabase's JWT secret.
- Database connection uses Supabase's pooled connection string.
- For local development, Supabase CLI or cloud project is required.

---

## ADR-011: Risk Engine Zero Dependencies

**Status:** Accepted

**Context:**
The risk engine is the core intellectual property. It needs to be maximally portable, testable, and maintainable.

**Decision:**
The `@systemmapper/risk-engine` package has zero runtime dependencies beyond `@systemmapper/types`. No framework, no database, no I/O.

**Rationale:**
- Zero dependencies means zero mocks in tests.
- The engine can be used in any context: server, CLI, browser, WASM.
- No framework coupling means no framework migration cost.
- Pure functions are the easiest code to reason about and debug.
- Independent versioning — the engine can be published as a standalone npm package.

**Consequences:**
- All data must be serialized and passed into the engine.
- The caller (worker) is responsible for querying Memgraph and formatting the data.
- No async operations — all computations are synchronous.
- Algorithms must be implemented without external libraries (BFS, Tarjan's SCC, etc.).

---

## ADR-012: Content Hash Incremental Parsing

**Status:** Accepted

**Context:**
Re-parsing all files on every scan is wasteful. The system needs to detect which files have changed.

**Alternatives Considered:**
1. **Git diff** — Requires Git access, doesn't work for initial scans.
2. **File modification time** — Unreliable across systems.
3. **Content hash (SHA-256)** — Deterministic, reliable, fast.
4. **Tree-sitter incremental parse** — Complex, requires storing old trees.

**Decision:**
Use SHA-256 content hashing stored in `ParserMetadata.contentHash`.

**Rationale:**
- SHA-256 is deterministic — same content always produces the same hash.
- Comparing hashes is O(1) and avoids reading the file content twice.
- The hash is stored in PostgreSQL alongside parser metadata.
- This approach works for both initial scans and incremental scans.

**Consequences:**
- Every file's content hash is stored in PostgreSQL (~64 bytes per file).
- On incremental scans, all file hashes from GitHub are compared against stored hashes.
- Only files with different hashes are re-parsed and re-graphed.
- Renamed files (same content, different path) are detected as new files with the same hash.

---

*End of Architecture Decision Records. Continue to [20-graph-package.md](./20-graph-package.md) →*
