# Service Ports Configuration

I have successfully terminated the conflicting processes that were holding onto your ports (the orphaned Node and Docker processes) and updated the application's configuration to guarantee that **every single service now has a strictly unique port assigned**.

Here is the final map of the ports your application services use:

## Application Services

| Service | Type | Port | Source |
|---|---|---|---|
| **Frontend** | Next.js Web App | `3000` | Default Next.js port |
| **Backend API** | NestJS Server | `3001` | Configured in `apps/api/src/main.ts` |
| **Worker** | NestJS BullMQ Processor | `3002` | Configured in `apps/worker/src/main.ts` |

## Infrastructure Services (Docker Compose)

| Service | Type | Port | Source |
|---|---|---|---|
| **Memgraph Lab UI** | Database Web UI | `3003` | Configured in `docker-compose.yml` |
| **PostgreSQL** | Relational DB | `5432` | Standard Postgres Port |
| **Redis** | In-Memory / BullMQ | `6379` | Standard Redis Port |
| **Memgraph HTTP** | HTTP DB Interface | `7444` | Standard Memgraph HTTP Port |
| **Memgraph Bolt** | Primary DB Protocol | `7687` | Standard Memgraph Bolt Port |

> [!NOTE]
> Previously, the **Memgraph Lab UI** (inside your `docker-compose.yml`) was hardcoded to map to port `3001`, which directly conflicted with the backend API. I have remapped it to `3003` to resolve this collision permanently. The worker was also accidentally starting on `3000`, colliding with the frontend. It has been moved to `3002`.
