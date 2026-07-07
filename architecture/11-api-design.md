# SystemMapper — API Design

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Conventions](#2-api-conventions)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Controller Specifications](#4-controller-specifications)
5. [Error Handling](#5-error-handling)
6. [Pagination, Filtering, Sorting](#6-pagination-filtering-sorting)

---

## 1. Overview

The SystemMapper API is a RESTful API served by the NestJS application at `apps/api`. All endpoints are prefixed with `/api/v1/`. The API serves the web frontend and will eventually support external integrations.

### 1.1 Base URL

```
http://localhost:3001/api/v1
```

### 1.2 Content Type

All requests and responses use `application/json`.

### 1.3 Versioning Strategy

API versioning uses URL path prefix (`/api/v1/`, `/api/v2/`). When breaking changes are introduced:

1. Add the new version (`v2`) alongside the old (`v1`).
2. Deprecate the old version with a response header: `X-API-Deprecated: true`.
3. Remove the old version after a migration period.

---

## 2. API Conventions

### 2.1 URL Patterns

| Pattern | Example | Description |
|---------|---------|-------------|
| Collection | `GET /repositories` | List resources |
| Single resource | `GET /repositories/:id` | Get a specific resource |
| Sub-resource | `GET /repositories/:id/scans` | List child resources |
| Action | `POST /repositories/:id/scan` | Trigger an action |
| Nested action | `POST /repositories/:id/scans/:scanId/retry` | Action on child |

### 2.2 HTTP Methods

| Method | Usage | Idempotent |
|--------|-------|-----------|
| `GET` | Read resources | Yes |
| `POST` | Create resources, trigger actions | No |
| `PUT` | Full update (replace) | Yes |
| `PATCH` | Partial update | No |
| `DELETE` | Soft delete | Yes |

### 2.3 Response Format

All successful responses follow a standard envelope:

**Single Resource:**

```json
{
  "data": { ... },
  "meta": { "requestId": "..." }
}
```

**Collection:**

```json
{
  "data": [ ... ],
  "meta": {
    "requestId": "...",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

**Error:**

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Repository not found",
    "statusCode": 404,
    "details": { ... }
  },
  "meta": { "requestId": "..." }
}
```

### 2.4 Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Internal server error |

---

## 3. Authentication & Authorization

### 3.1 Authentication

All API endpoints (except webhooks and health checks) require authentication via a JWT Bearer token:

```
Authorization: Bearer <supabase_jwt_token>
```

The JWT is issued by Supabase Auth and verified by the API using the Supabase JWT secret. The decoded token contains the user's `sub` (Supabase user ID) which is used to look up the `User` record.

### 3.2 RBAC Model

**Role Hierarchy:**

```
OWNER > ADMIN > MEMBER > VIEWER
```

**Permission Matrix:**

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|:-----:|:-----:|:------:|:------:|
| View repositories | ✓ | ✓ | ✓ | ✓ |
| View architecture | ✓ | ✓ | ✓ | ✓ |
| View metrics | ✓ | ✓ | ✓ | ✓ |
| View blast radius | ✓ | ✓ | ✓ | ✓ |
| Trigger scan | ✓ | ✓ | ✓ | ✗ |
| Save views | ✓ | ✓ | ✓ | ✗ |
| Post comments | ✓ | ✓ | ✓ | ✗ |
| Manage repo settings | ✓ | ✓ | ✗ | ✗ |
| Connect repositories | ✓ | ✓ | ✗ | ✗ |
| Manage members | ✓ | ✓ | ✗ | ✗ |
| Manage org settings | ✓ | ✓ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ |
| Delete organization | ✓ | ✗ | ✗ | ✗ |
| Manage API keys | ✓ | ✓ | ✗ | ✗ |
| Manage feature flags | ✓ | ✓ | ✗ | ✗ |

### 3.3 Authorization Guards

NestJS guards enforce authorization:

1. **`AuthGuard`** — Verifies JWT and attaches the user to the request.
2. **`RolesGuard`** — Checks the user's organization role against required roles.
3. **`RepositoryAccessGuard`** — Checks repository-level permissions.

Guards are applied via decorators:

```
@Roles(Role.ADMIN)        // Requires ADMIN or higher
@RepositoryAccess(Role.MEMBER)  // Requires MEMBER access to the repository
```

---

## 4. Controller Specifications

### 4.1 Auth Controller — `/api/v1/auth`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/auth/github` | Initiate GitHub OAuth flow | No |
| `GET` | `/auth/github/callback` | GitHub OAuth callback | No |
| `POST` | `/auth/logout` | Logout user | Yes |
| `GET` | `/auth/me` | Get current user profile | Yes |
| `PATCH` | `/auth/me` | Update current user profile | Yes |

### 4.2 Organizations Controller — `/api/v1/organizations`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/organizations` | List user's organizations | Yes | Any |
| `POST` | `/organizations` | Create organization | Yes | — |
| `GET` | `/organizations/:id` | Get organization details | Yes | Any |
| `PATCH` | `/organizations/:id` | Update organization | Yes | ADMIN |
| `DELETE` | `/organizations/:id` | Delete organization | Yes | OWNER |
| `GET` | `/organizations/:id/members` | List members | Yes | Any |
| `POST` | `/organizations/:id/members` | Invite member | Yes | ADMIN |
| `PATCH` | `/organizations/:id/members/:memberId` | Update member role | Yes | ADMIN |
| `DELETE` | `/organizations/:id/members/:memberId` | Remove member | Yes | ADMIN |

### 4.3 Repositories Controller — `/api/v1/repositories`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/repositories` | List repositories (org-scoped) | Yes | Any |
| `POST` | `/repositories` | Connect a repository | Yes | ADMIN |
| `GET` | `/repositories/:id` | Get repository details | Yes | Any |
| `PATCH` | `/repositories/:id` | Update repository settings | Yes | ADMIN |
| `DELETE` | `/repositories/:id` | Disconnect repository | Yes | ADMIN |
| `POST` | `/repositories/:id/scan` | Trigger manual scan | Yes | MEMBER |
| `GET` | `/repositories/:id/scans` | List scan history | Yes | Any |
| `GET` | `/repositories/:id/scans/:scanId` | Get scan details | Yes | Any |

### 4.4 Architecture Controller — `/api/v1/repositories/:id/architecture`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/repositories/:id/architecture` | Get current architecture graph | Yes | Any |
| `GET` | `/repositories/:id/architecture/snapshots` | List snapshots | Yes | Any |
| `GET` | `/repositories/:id/architecture/snapshots/:snapshotId` | Get snapshot details | Yes | Any |
| `GET` | `/repositories/:id/architecture/compare` | Compare two snapshots | Yes | Any |
| `GET` | `/repositories/:id/architecture/search` | Search graph nodes | Yes | Any |

**Query Parameters for Architecture Graph:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `depth` | number | 3 | Maximum traversal depth |
| `nodeTypes` | string[] | all | Filter by node types |
| `layout` | string | "hierarchical" | Layout algorithm |
| `focus` | string | — | Center on a specific node |
| `includeExternal` | boolean | false | Include external packages |

### 4.5 Blast Radius Controller — `/api/v1/repositories/:id/blast-radius`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/repositories/:id/blast-radius` | List blast radius reports | Yes | Any |
| `POST` | `/repositories/:id/blast-radius/analyze` | Run on-demand analysis | Yes | MEMBER |
| `GET` | `/repositories/:id/blast-radius/:reportId` | Get specific report | Yes | Any |

### 4.6 Pull Requests Controller — `/api/v1/repositories/:id/pull-requests`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/repositories/:id/pull-requests` | List tracked PRs | Yes | Any |
| `GET` | `/repositories/:id/pull-requests/:prId` | Get PR details with risk data | Yes | Any |

### 4.7 Metrics Controller — `/api/v1/repositories/:id/metrics`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/repositories/:id/metrics` | Get current metrics | Yes | Any |
| `GET` | `/repositories/:id/metrics/history` | Get metrics time series | Yes | Any |
| `GET` | `/repositories/:id/metrics/trends` | Get metric trends | Yes | Any |

### 4.8 Webhooks Controller — `/api/v1/webhooks`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/webhooks/github` | GitHub webhook receiver | Webhook signature |

### 4.9 Notifications Controller — `/api/v1/notifications`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/notifications` | List user notifications | Yes | Any |
| `PATCH` | `/notifications/:id/read` | Mark notification as read | Yes | Any |
| `POST` | `/notifications/read-all` | Mark all as read | Yes | Any |

### 4.10 Saved Views Controller — `/api/v1/repositories/:id/views`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/repositories/:id/views` | List saved views | Yes | Any |
| `POST` | `/repositories/:id/views` | Create saved view | Yes | MEMBER |
| `GET` | `/repositories/:id/views/:viewId` | Get saved view | Yes | Any |
| `PATCH` | `/repositories/:id/views/:viewId` | Update saved view | Yes | MEMBER |
| `DELETE` | `/repositories/:id/views/:viewId` | Delete saved view | Yes | MEMBER |

### 4.11 Settings Controller — `/api/v1/settings`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/settings/preferences` | Get user preferences | Yes | Any |
| `PATCH` | `/settings/preferences` | Update user preferences | Yes | Any |

### 4.12 Admin Controller — `/api/v1/admin`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/admin/jobs` | List recent jobs | Yes | ADMIN |
| `GET` | `/admin/jobs/failed` | List failed jobs | Yes | ADMIN |
| `POST` | `/admin/jobs/:jobId/retry` | Retry a failed job | Yes | ADMIN |
| `GET` | `/admin/audit-logs` | List audit logs | Yes | ADMIN |
| `GET` | `/admin/feature-flags` | List feature flags | Yes | ADMIN |
| `PATCH` | `/admin/feature-flags/:id` | Update feature flag | Yes | ADMIN |
| `GET` | `/admin/health` | System health check | No | — |

### 4.13 GitHub Integration Controller — `/api/v1/github`

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/github/installations` | List GitHub installations | Yes | ADMIN |
| `GET` | `/github/installations/:id/repositories` | List repos in installation | Yes | ADMIN |

---

## 5. Error Handling

### 5.1 Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body/params validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SCAN_IN_PROGRESS` | 409 | A scan is already running for this repo |
| `GRAPH_UNAVAILABLE` | 503 | Memgraph is not available |
| `GITHUB_API_ERROR` | 502 | GitHub API returned an error |

### 5.2 Global Exception Filter

A NestJS exception filter catches all uncaught exceptions and formats them into the standard error response. It:

1. Logs the full error with stack trace.
2. Strips internal details from the response.
3. Adds the `requestId` for correlation.
4. Returns the appropriate HTTP status code.

---

## 6. Pagination, Filtering, Sorting

### 6.1 Pagination

All list endpoints support offset-based pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 20 | Items per page (max: 100) |

**Response Meta:**

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### 6.2 Filtering

List endpoints support field-based filtering via query parameters:

```
GET /repositories?language=typescript&isActive=true
GET /repositories/:id/scans?status=COMPLETED&branch=main
GET /repositories/:id/metrics/history?type=ARCHITECTURE_SCORE&from=2024-01-01&to=2024-12-31
```

### 6.3 Sorting

List endpoints support sorting via the `sort` query parameter:

```
GET /repositories?sort=lastScannedAt:desc
GET /repositories/:id/scans?sort=createdAt:desc
GET /repositories/:id/pull-requests?sort=riskScore:desc
```

Format: `fieldName:asc|desc`. Multiple sort fields are comma-separated: `sort=riskLevel:desc,createdAt:desc`.

### 6.4 DTO Validation

All request bodies are validated using `class-validator` decorators on DTO classes. Validation failures return a 400 response with field-level error messages:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 400,
    "details": [
      { "field": "name", "message": "name must not be empty" },
      { "field": "slug", "message": "slug must be a valid URL slug" }
    ]
  }
}
```

---

*End of API Design. Continue to [12-shared-types.md](./12-shared-types.md) →*
