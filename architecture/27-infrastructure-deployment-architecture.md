# 27 — Infrastructure & Deployment Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## 1. Overview

The **Infrastructure & Deployment Architecture** ensures the Application Intelligence Platform can scale horizontally, remain highly available, and deploy seamlessly into various enterprise environments.

A core tenet of this architecture is **Cloud Independence**. The platform must not be tightly coupled to proprietary cloud services (e.g., AWS SQS, GCP PubSub) without an abstraction layer.

---

## 2. Core Infrastructure Components

The platform relies on the following core technologies, encapsulated via containerization:

- **Compute**: Node.js (Next.js for Frontend/API, NestJS for Workers).
- **Relational Database**: PostgreSQL (Stores operational metadata, configurations, RBAC).
- **Graph Store**: Memgraph (Default adapter for the Generic Graph Model).
- **In-Memory Store / Broker**: Redis (Powers BullMQ queues, caching, and rate limiting).
- **Search Store**: Elasticsearch or Typesense (Provides the first-class Search Engine).
- **Object Storage**: S3-compatible storage (MinIO for local, AWS S3 / GCS for production). Used for storing immutable Snapshot JSON payloads.

---

## 3. Cloud Provider Abstraction

To ensure vendor neutrality, the system uses adapters for external dependencies.

- **Queue System**: Default is `BullMQ` (Redis-backed). A future adapter could support AWS SQS or Kafka if required by an enterprise, though Redis is the standard.
- **Object Storage**: The `BlobStorageAdapter` interface wraps the S3 SDK, allowing seamless swapping between AWS, GCP, Azure, or MinIO.
- **Secret Management**: Instead of hardcoding `.env` files in production, secrets are fetched via a `SecretManagerAdapter` (supporting AWS Secrets Manager, HashiCorp Vault, etc.).

---

## 4. Deployment Topology

The system is designed for **Kubernetes Readiness**, allowing horizontal scaling of distinct workloads.

### Workload Separation
1. **Web App (Frontend)**: Next.js frontend serving React UI and Projection Models. Scales based on user traffic.
2. **API Gateway & Core API**: NestJS application handling HTTP requests, Authorization, and Graph Query translation. Scales based on read-heavy traffic.
3. **Queue Workers (Analysis Engines)**: Dedicated Node.js processes executing the First-Class Knowledge Graph Lifecycle (Parsing, Normalization, Graph Building). Highly CPU/Memory intensive. Scales horizontally based on the queue backlog (e.g., KEDA).
4. **Search Indexer**: A specialized worker observing the Event Bus to update the Search Store incrementally.

---

## 5. Background Processing & Queues

The platform relies heavily on asynchronous processing. The [Queue Architecture](./09-queue-architecture.md) defines specific queues.

### Horizontal Scaling of Workers
- **Concurrency**: Each worker node processes a configurable number of concurrent jobs.
- **Auto-Scaling**: Metrics from Redis (Queue Depth) determine how many Worker Pods are spun up.
- **Resource Limits**: Parsers (e.g., Tree-sitter) require strict memory limits to prevent out-of-memory (OOM) crashes on massively bloated source files.

---

## 6. Observability & Reliability

### Monitoring & Logging
- **Metrics**: API and Worker processes expose `/metrics` endpoints compatible with Prometheus (CPU, Memory, Event Loop Lag, Queue depths, Parser durations).
- **Logging**: All logs are emitted in JSON format (using Pino) for seamless ingestion into ELK/Datadog/CloudWatch.
- **Tracing**: OpenTelemetry (OTel) instrumentation is embedded in the Graph Query Engine and Parser Pipelines to trace a request from UI click -> API -> Memgraph Query -> Projection Engine.

### Health Checks
- **Liveness/Readiness Probes**: Exposed at `/health`. Verifies connections to Postgres, Redis, the Graph Store, and the Search Store.

### Backup Strategy & Disaster Recovery
- **Postgres**: Standard daily/continuous WAL archiving.
- **Graph Store**: Daily snapshots. Because the Graph Store can be fully reconstructed by re-running the Code Intelligence Pipeline over connected repositories, it can be treated as a highly durable cache.
- **Object Storage (Snapshots)**: Immutable blobs, naturally replicated across zones via the cloud provider.
