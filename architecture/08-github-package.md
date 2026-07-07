# SystemMapper — GitHub Package

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [GitHub App Architecture](#2-github-app-architecture)
3. [OAuth Flow](#3-oauth-flow)
4. [Webhook Architecture](#4-webhook-architecture)
5. [Repository Operations](#5-repository-operations)
6. [PR Comment Publishing](#6-pr-comment-publishing)
7. [Rate Limiting](#7-rate-limiting)
8. [Retry Strategy](#8-retry-strategy)

---

## 1. Overview

The `@systemmapper/github` package encapsulates all GitHub API interactions. It handles authentication (GitHub App JWT, installation tokens, OAuth), webhook processing, repository content access, and PR comment management.

**Dependencies:** `@systemmapper/types`, `@systemmapper/shared`, `@systemmapper/config`

**External Dependencies:** `@octokit/rest`, `@octokit/auth-app`, `@octokit/webhooks`, `jsonwebtoken`

---

## 2. GitHub App Architecture

### 2.1 GitHub App Registration

SystemMapper registers as a GitHub App with the following permissions:

| Permission | Access | Reason |
|-----------|--------|--------|
| Repository contents | Read | Fetch file tree and content |
| Pull requests | Read & Write | Read PR data, post comments |
| Metadata | Read | Repository metadata |
| Webhooks | Read & Write | Receive push and PR events |
| Members | Read | Organization membership |

### 2.2 Subscribed Events

| Event | Usage |
|-------|-------|
| `installation` | Track app install/uninstall |
| `installation_repositories` | Track repo add/remove from installation |
| `push` | Trigger incremental scans |
| `pull_request` | Trigger blast radius analysis |

### 2.3 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Layers                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: GitHub App JWT                                    │
│  ┌──────────────────────────────────────────┐               │
│  │ Generated from App ID + Private Key      │               │
│  │ Valid for 10 minutes                     │               │
│  │ Used to: List installations, get tokens  │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  Layer 2: Installation Access Token                         │
│  ┌──────────────────────────────────────────┐               │
│  │ Generated from JWT + Installation ID     │               │
│  │ Valid for 1 hour                         │               │
│  │ Used to: Access repos, post comments     │               │
│  │ Cached with TTL (50 minutes)             │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  Layer 3: User OAuth Token                                  │
│  ┌──────────────────────────────────────────┐               │
│  │ Generated from OAuth flow                │               │
│  │ Represents user's identity               │               │
│  │ Used to: Verify user identity at login   │               │
│  │ Stored in Supabase Auth                  │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Token Management

**JWT Generation:**

1. Read the App's private key from configuration.
2. Sign a JWT with `iss` = App ID, `exp` = 10 minutes from now.
3. Use the JWT for app-level API calls.

**Installation Token Caching:**

1. When an installation token is needed, check the cache.
2. If cached and not expired (with 10-minute safety margin), use the cached token.
3. If not cached or expired, generate a new JWT, request an installation token, cache it with TTL.
4. Cache key: `github:installation-token:{installationId}`.

---

## 3. OAuth Flow

### 3.1 Flow

1. **Initiate:** Frontend redirects to GitHub OAuth URL with `client_id` and `redirect_uri`.
2. **Callback:** GitHub redirects back with an authorization `code`.
3. **Exchange:** Backend exchanges the `code` for an access token using `client_id` and `client_secret`.
4. **Profile:** Backend uses the access token to fetch the user's GitHub profile (`/user`).
5. **Link:** Backend creates or updates the `User` record, linking `githubId` and `githubUsername`.
6. **Auth:** Backend creates a Supabase Auth session for the user.

### 3.2 Security

- The OAuth `state` parameter must be verified to prevent CSRF attacks.
- The `client_secret` is never exposed to the frontend.
- The authorization `code` is single-use and short-lived (10 minutes).
- Access tokens are used only server-side for initial profile fetch, then discarded.

---

## 4. Webhook Architecture

### 4.1 Webhook Verification

All incoming webhooks are verified using HMAC-SHA256:

1. Extract the `X-Hub-Signature-256` header from the request.
2. Compute `HMAC-SHA256(webhookSecret, requestBody)`.
3. Compare the computed signature with the header value.
4. Reject the request if signatures don't match (return 401).

### 4.2 Webhook Processing Pipeline

```
Webhook Received
       │
       ▼
┌──────────────┐
│   Verify     │ ← HMAC-SHA256 signature check
│   Signature  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Idempotency │ ← Check githubDeliveryId
│    Check     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Store     │ ← Save to WebhookEvent table
│   Event      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Dispatch   │ ← Route to appropriate handler
│   to Handler │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Return    │ ← 200 OK immediately
│    200 OK    │
└──────────────┘
```

### 4.3 Webhook Handlers

| Event | Action | Handler |
|-------|--------|---------|
| `installation.created` | Store installation, discover repos | `InstallationCreatedHandler` |
| `installation.deleted` | Deactivate installation | `InstallationDeletedHandler` |
| `installation.suspended` | Suspend installation | `InstallationSuspendedHandler` |
| `installation_repositories.added` | Add repos to installation | `ReposAddedHandler` |
| `installation_repositories.removed` | Remove repos from installation | `ReposRemovedHandler` |
| `push` | Queue incremental scan | `PushHandler` |
| `pull_request.opened` | Queue blast radius analysis | `PullRequestOpenedHandler` |
| `pull_request.synchronize` | Re-queue blast radius (new commits) | `PullRequestUpdatedHandler` |
| `pull_request.closed` | Update PR status | `PullRequestClosedHandler` |

---

## 5. Repository Operations

### 5.1 `GitHubRepositoryService`

**File Tree Fetching:**

1. Use `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=true`.
2. This returns the entire file tree in a single API call.
3. Filter to source files only (by extension).
4. The SHA comes from the default branch's HEAD.

**File Content Fetching:**

1. Use `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}`.
2. Content is returned Base64-encoded.
3. Decode and pass to the parser.
4. For files > 1MB, use the Git Blob API instead.

**Batch Fetching:**

1. For large repositories, fetch files in parallel batches (10 concurrent requests).
2. Respect rate limits between batches.
3. Use the installation access token for all requests.

### 5.2 Repository Sync

When a repository is onboarded:

1. Fetch the repository metadata from GitHub (name, description, default branch, language).
2. Create or update the `Repository` record in PostgreSQL.
3. Fetch the file tree.
4. Queue a `repository-scan` job with the file list.

---

## 6. PR Comment Publishing

### 6.1 Comment Format

The blast radius comment follows a standardized Markdown template:

```markdown
## 🎯 SystemMapper — Blast Radius Analysis

### Risk Level: 🟡 MEDIUM (Score: 47/100)

| Metric | Value |
|--------|-------|
| Affected Files | 12 |
| Affected Functions | 34 |
| Max Dependency Depth | 4 |
| Circular Dependencies | 0 |
| Architecture Violations | 1 |

### Top Affected Files
1. `src/services/user.service.ts` (distance: 1)
2. `src/controllers/user.controller.ts` (distance: 2)
3. ...

### Suggested Reviewers
- @developer-a (covers 8/12 affected files)
- @developer-b (covers 5/12 affected files)

---
*Powered by [SystemMapper](link) • [View Full Report](link)*
```

### 6.2 Comment CRUD

**Create Comment:**

1. Use `POST /repos/{owner}/{repo}/issues/{pr_number}/comments`.
2. Store the returned `comment_id` in `PullRequest.commentId`.

**Update Comment:**

1. Check if `PullRequest.commentId` exists.
2. If yes, use `PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}`.
3. If no (comment was deleted), create a new one.

**Idempotency:**

- Only one SystemMapper comment per PR (identified by `commentId`).
- Updates replace the entire comment body.
- If the PR is updated (new commits), the comment is updated with the new analysis.

---

## 7. Rate Limiting

### 7.1 GitHub API Limits

| Limit Type | Limit | Scope |
|-----------|-------|-------|
| GitHub App Installation | 5,000 requests/hour | Per installation |
| OAuth User | 5,000 requests/hour | Per user |
| Search API | 30 requests/minute | Per user/installation |
| Content Creation | 80 requests/minute | Per repository |

### 7.2 Rate Limit Tracking

1. Extract `X-RateLimit-Remaining` and `X-RateLimit-Reset` from every GitHub API response.
2. Store remaining requests and reset time in memory.
3. Before each request, check remaining requests.
4. If remaining < 100, switch to conservative mode (add 1-second delay between requests).
5. If remaining < 10, pause requests until reset time.

### 7.3 Secondary Rate Limits

GitHub also enforces undocumented secondary rate limits based on request concurrency and content creation volume. Mitigation:

- Limit concurrent requests to 10.
- Add 100ms delay between sequential requests.
- Add 1-second delay between comment operations.

---

## 8. Retry Strategy

### 8.1 Retry Policy

| Status Code | Retry | Delay |
|-------------|-------|-------|
| 401 | Once (refresh token) | Immediate |
| 403 (rate limit) | Yes | Until `X-RateLimit-Reset` |
| 403 (secondary) | Yes | Exponential backoff (60s start) |
| 404 | No | — |
| 422 | No | — |
| 500 | Yes, 3 times | Exponential backoff (1s, 2s, 4s) |
| 502, 503 | Yes, 3 times | Exponential backoff (1s, 2s, 4s) |
| Network error | Yes, 3 times | Exponential backoff (1s, 2s, 4s) |

### 8.2 Exponential Backoff

```
delay = baseDelay × (2 ^ attemptNumber) + jitter
```

Where:

- `baseDelay` = 1000ms
- `attemptNumber` = 0, 1, 2, ...
- `jitter` = random(0, 500ms) to prevent thundering herd

### 8.3 Circuit Breaker (Future)

For production, a circuit breaker pattern would protect against prolonged GitHub outages:

- **Closed:** Normal operation, all requests pass through.
- **Open:** After N consecutive failures, stop sending requests for a cooldown period.
- **Half-Open:** After cooldown, allow one test request. If it succeeds, close the circuit.

---

*End of GitHub Package. Continue to [09-queue-architecture.md](./09-queue-architecture.md) →*
