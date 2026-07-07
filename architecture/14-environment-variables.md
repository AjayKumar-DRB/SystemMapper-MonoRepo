# SystemMapper — Environment Variables

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Root .env.example](#2-root-envexample)
3. [API .env.example](#3-api-envexample)
4. [Web .env.example](#4-web-envexample)
5. [Worker .env.example](#5-worker-envexample)
6. [Variable Reference](#6-variable-reference)

---

## 1. Overview

Every application in the monorepo has its own `.env.example` file. **All values are intentionally left blank** — no fake credentials, no placeholder values. Developers copy the `.env.example` to `.env` and fill in their own values.

### 1.1 Loading Strategy

Environment variables are loaded using the `@systemmapper/config` package which:

1. Reads `.env` files using `dotenv`.
2. Validates all required variables against a schema (Zod).
3. Provides typed, validated config objects to the application.
4. Fails fast at startup if any required variable is missing or invalid.

### 1.2 Security Rules

- `.env` files are listed in `.gitignore` and **never committed**.
- `.env.example` files are committed with **blank values only**.
- Sensitive variables (keys, secrets) are never logged, even at debug level.
- Docker Compose uses `.env` from the project root for container configuration.

---

## 2. Root .env.example

This file is used by Docker Compose and shared across all applications.

```env
# ============================================
# SystemMapper — Root Environment Variables
# ============================================
# Copy this file to .env and fill in your values.
# All values must be populated for local development.
# ============================================

# ── PostgreSQL (Supabase) ──────────────────
DATABASE_URL=
DIRECT_URL=

# ── Supabase ───────────────────────────────
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── Memgraph ──────────────────────────────────
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

# ── Redis ──────────────────────────────────
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=

# ── GitHub App ─────────────────────────────
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

# ── JWT ────────────────────────────────────
JWT_SECRET=

# ── Application ───────────────────────────
API_PORT=
WEB_PORT=
NODE_ENV=

# ── Future AI (not used in MVP) ────────────
OPENAI_API_KEY=
```

---

## 3. API .env.example

```env
# ============================================
# SystemMapper API — Environment Variables
# ============================================

# ── Server ─────────────────────────────────
PORT=
NODE_ENV=
CORS_ORIGIN=

# ── PostgreSQL (Supabase) ──────────────────
DATABASE_URL=
DIRECT_URL=

# ── Supabase Auth ──────────────────────────
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=

# ── Memgraph ──────────────────────────────────
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

# ── Redis ──────────────────────────────────
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=

# ── GitHub App ─────────────────────────────
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_CALLBACK_URL=

# ── Logging ────────────────────────────────
LOG_LEVEL=

# ── Future AI (not used in MVP) ────────────
OPENAI_API_KEY=
```

---

## 4. Web .env.example

```env
# ============================================
# SystemMapper Web — Environment Variables
# ============================================

# ── Next.js ────────────────────────────────
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
```

---

## 5. Worker .env.example

```env
# ============================================
# SystemMapper Worker — Environment Variables
# ============================================

# ── Server ─────────────────────────────────
NODE_ENV=

# ── PostgreSQL (Supabase) ──────────────────
DATABASE_URL=
DIRECT_URL=

# ── Memgraph ──────────────────────────────────
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

# ── Redis ──────────────────────────────────
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=

# ── GitHub App ─────────────────────────────
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=

# ── Worker Configuration ──────────────────
WORKER_CONCURRENCY=
SCAN_TIMEOUT_MS=
PARSE_TIMEOUT_MS=
GRAPH_BUILD_TIMEOUT_MS=

# ── Logging ────────────────────────────────
LOG_LEVEL=

# ── Future AI (not used in MVP) ────────────
OPENAI_API_KEY=
```

---

## 6. Variable Reference

| Variable | Used By | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | API, Worker | Yes | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | API, Worker | Yes | PostgreSQL direct connection (for migrations) |
| `SUPABASE_URL` | API, Web | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | API, Web | Yes | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Yes | Supabase service role key (server-side only) |
| `NEO4J_URI` | API, Worker | Yes | Memgraph connection URI (bolt://) |
| `NEO4J_USERNAME` | API, Worker | Yes | Memgraph username |
| `NEO4J_PASSWORD` | API, Worker | Yes | Memgraph password |
| `REDIS_HOST` | API, Worker | Yes | Redis hostname |
| `REDIS_PORT` | API, Worker | Yes | Redis port number |
| `REDIS_PASSWORD` | API, Worker | No | Redis password (if auth enabled) |
| `GITHUB_APP_ID` | API, Worker | Yes | GitHub App ID |
| `GITHUB_CLIENT_ID` | API, Web | Yes | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | API | Yes | GitHub OAuth Client Secret |
| `GITHUB_PRIVATE_KEY` | API, Worker | Yes | GitHub App private key (PEM) |
| `GITHUB_WEBHOOK_SECRET` | API | Yes | Webhook HMAC verification secret |
| `GITHUB_CALLBACK_URL` | API | Yes | OAuth callback URL |
| `JWT_SECRET` | API | Yes | Supabase JWT verification secret |
| `PORT` | API | No | API server port (default: 3001) |
| `WEB_PORT` | Web | No | Web server port (default: 3000) |
| `NODE_ENV` | All | No | development, production, test |
| `CORS_ORIGIN` | API | No | Allowed CORS origin |
| `LOG_LEVEL` | API, Worker | No | debug, info, warn, error |
| `WORKER_CONCURRENCY` | Worker | No | Max concurrent jobs (default: 10) |
| `SCAN_TIMEOUT_MS` | Worker | No | Scan timeout (default: 300000) |
| `PARSE_TIMEOUT_MS` | Worker | No | Parse timeout (default: 30000) |
| `GRAPH_BUILD_TIMEOUT_MS` | Worker | No | Graph build timeout (default: 600000) |
| `NEXT_PUBLIC_API_URL` | Web | Yes | Backend API URL for frontend |
| `NEXT_PUBLIC_APP_NAME` | Web | No | Application display name |
| `OPENAI_API_KEY` | API, Worker | No | Future AI features (not MVP) |

---

*End of Environment Variables. Continue to [15-coding-standards.md](./15-coding-standards.md) →*
