# SystemMapper — Complete Folder Structure

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## 1. Root Structure

```
systemmapper/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── lint.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
├── packages/
│   ├── analytics/
│   ├── config/
│   ├── database/
│   ├── github/
│   ├── graph/
│   ├── parser/
│   ├── risk-engine/
│   ├── shared/
│   ├── types/
│   └── ui/
├── docker/
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   ├── worker.Dockerfile
│   └── memgraph/
│       └── init-constraints.cypher
├── .env.example
├── .eslintrc.js
├── .gitignore
├── .prettierrc
├── commitlint.config.js
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.base.json
└── turbo.json
```

---

## 2. `apps/api/` — NestJS Backend

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── repository-access.decorator.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── repository-access.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── middleware/
│   │   │   ├── correlation-id.middleware.ts
│   │   │   └── request-logger.middleware.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── utils/
│   │       ├── pagination.util.ts
│   │       └── response.util.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   └── github-oauth.strategy.ts
│   │   │   └── dto/
│   │   │       └── auth-response.dto.ts
│   │   ├── organizations/
│   │   │   ├── organizations.module.ts
│   │   │   ├── organizations.controller.ts
│   │   │   ├── organizations.service.ts
│   │   │   └── dto/
│   │   │       ├── create-organization.dto.ts
│   │   │       ├── update-organization.dto.ts
│   │   │       └── invite-member.dto.ts
│   │   ├── repositories/
│   │   │   ├── repositories.module.ts
│   │   │   ├── repositories.controller.ts
│   │   │   ├── repositories.service.ts
│   │   │   └── dto/
│   │   │       ├── connect-repository.dto.ts
│   │   │       ├── trigger-scan.dto.ts
│   │   │       └── repository-response.dto.ts
│   │   ├── architecture/
│   │   │   ├── architecture.module.ts
│   │   │   ├── architecture.controller.ts
│   │   │   └── architecture.service.ts
│   │   ├── blast-radius/
│   │   │   ├── blast-radius.module.ts
│   │   │   ├── blast-radius.controller.ts
│   │   │   └── blast-radius.service.ts
│   │   ├── pull-requests/
│   │   │   ├── pull-requests.module.ts
│   │   │   ├── pull-requests.controller.ts
│   │   │   └── pull-requests.service.ts
│   │   ├── metrics/
│   │   │   ├── metrics.module.ts
│   │   │   ├── metrics.controller.ts
│   │   │   └── metrics.service.ts
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   └── notifications.service.ts
│   │   ├── webhooks/
│   │   │   ├── webhooks.module.ts
│   │   │   ├── webhooks.controller.ts
│   │   │   ├── webhooks.service.ts
│   │   │   └── handlers/
│   │   │       ├── installation.handler.ts
│   │   │       ├── push.handler.ts
│   │   │       └── pull-request.handler.ts
│   │   ├── saved-views/
│   │   │   ├── saved-views.module.ts
│   │   │   ├── saved-views.controller.ts
│   │   │   └── saved-views.service.ts
│   │   ├── settings/
│   │   │   ├── settings.module.ts
│   │   │   ├── settings.controller.ts
│   │   │   └── settings.service.ts
│   │   ├── admin/
│   │   │   ├── admin.module.ts
│   │   │   ├── admin.controller.ts
│   │   │   └── admin.service.ts
│   │   └── github-integration/
│   │       ├── github-integration.module.ts
│   │       ├── github-integration.controller.ts
│   │       └── github-integration.service.ts
│   └── config/
│       └── app.config.ts
├── test/
│   ├── app.e2e-spec.ts
│   ├── jest-e2e.json
│   └── fixtures/
│       └── test-data.ts
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

---

## 3. `apps/web/` — Next.js Frontend

```
apps/web/
├── public/
│   ├── favicon.ico
│   └── images/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── callback/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── repositories/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── architecture/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── blast-radius/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── pull-requests/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   └── [prId]/
│   │   │   │       │       └── page.tsx
│   │   │   │       ├── metrics/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── scans/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── settings/
│   │   │   │           └── page.tsx
│   │   │   ├── organizations/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [orgId]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── members/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── settings/
│   │   │   │           └── page.tsx
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   └── api/
│   │       └── health/
│   │           └── route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav-item.tsx
│   │   ├── architecture/
│   │   │   ├── graph-canvas.tsx
│   │   │   ├── graph-controls.tsx
│   │   │   ├── graph-legend.tsx
│   │   │   ├── node-detail-panel.tsx
│   │   │   └── snapshot-selector.tsx
│   │   ├── blast-radius/
│   │   │   ├── blast-radius-view.tsx
│   │   │   ├── affected-files-list.tsx
│   │   │   └── risk-score-badge.tsx
│   │   ├── metrics/
│   │   │   ├── metrics-dashboard.tsx
│   │   │   ├── metric-card.tsx
│   │   │   ├── trend-chart.tsx
│   │   │   └── score-gauge.tsx
│   │   └── shared/
│   │       ├── data-table.tsx
│   │       ├── loading-skeleton.tsx
│   │       ├── empty-state.tsx
│   │       └── error-boundary.tsx
│   ├── hooks/
│   │   ├── use-repositories.ts
│   │   ├── use-architecture.ts
│   │   ├── use-blast-radius.ts
│   │   ├── use-metrics.ts
│   │   ├── use-auth.ts
│   │   └── use-notifications.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── supabase.ts
│   │   ├── query-client.ts
│   │   └── utils.ts
│   ├── providers/
│   │   ├── auth-provider.tsx
│   │   ├── query-provider.tsx
│   │   └── theme-provider.tsx
│   └── types/
│       └── next-auth.d.ts
├── .env.example
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. `apps/worker/` — NestJS Worker

```
apps/worker/
├── src/
│   ├── main.ts
│   ├── worker.module.ts
│   ├── processors/
│   │   ├── scan.processor.ts
│   │   ├── parse.processor.ts
│   │   ├── graph-build.processor.ts
│   │   ├── graph-update.processor.ts
│   │   ├── blast-radius.processor.ts
│   │   ├── metrics.processor.ts
│   │   ├── notification.processor.ts
│   │   ├── cleanup.processor.ts
│   │   └── retry.processor.ts
│   ├── orchestrators/
│   │   ├── scan.orchestrator.ts
│   │   └── blast-radius.orchestrator.ts
│   ├── schedulers/
│   │   └── cleanup.scheduler.ts
│   └── config/
│       └── worker.config.ts
├── test/
│   ├── processors/
│   │   ├── scan.processor.spec.ts
│   │   ├── parse.processor.spec.ts
│   │   └── blast-radius.processor.spec.ts
│   └── fixtures/
│       └── test-data.ts
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

---

## 5. `packages/types/`

```
packages/types/
├── src/
│   ├── index.ts
│   ├── enums/
│   │   ├── index.ts
│   │   ├── role.enum.ts
│   │   ├── scan-status.enum.ts
│   │   ├── risk-level.enum.ts
│   │   ├── language.enum.ts
│   │   ├── metric-type.enum.ts
│   │   ├── event-type.enum.ts
│   │   ├── queue-name.enum.ts
│   │   ├── graph-node-type.enum.ts
│   │   └── graph-relation-type.enum.ts
│   ├── interfaces/
│   │   ├── index.ts
│   │   ├── user.interface.ts
│   │   ├── organization.interface.ts
│   │   ├── repository.interface.ts
│   │   ├── scan.interface.ts
│   │   ├── pull-request.interface.ts
│   │   ├── architecture.interface.ts
│   │   └── notification.interface.ts
│   ├── dto/
│   │   ├── index.ts
│   │   ├── request.dto.ts
│   │   └── response.dto.ts
│   ├── graph/
│   │   ├── index.ts
│   │   ├── graph-node.type.ts
│   │   ├── graph-edge.type.ts
│   │   └── dependency-graph.type.ts
│   ├── events/
│   │   ├── index.ts
│   │   └── domain-event.type.ts
│   ├── queue/
│   │   ├── index.ts
│   │   └── job-payloads.type.ts
│   ├── risk/
│   │   ├── index.ts
│   │   ├── risk-report.type.ts
│   │   ├── blast-radius.type.ts
│   │   └── analysis-options.type.ts
│   ├── metrics/
│   │   ├── index.ts
│   │   └── metric.type.ts
│   └── constants/
│       ├── index.ts
│       ├── risk-weights.const.ts
│       └── defaults.const.ts
├── package.json
└── tsconfig.json
```

---

## 6. `packages/database/`

```
packages/database/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   └── .gitkeep
│   └── seed.ts
├── src/
│   ├── index.ts
│   ├── client.ts
│   ├── repositories/
│   │   ├── index.ts
│   │   ├── base.repository.ts
│   │   ├── user.repository.ts
│   │   ├── organization.repository.ts
│   │   ├── repository.repository.ts
│   │   ├── scan.repository.ts
│   │   ├── pull-request.repository.ts
│   │   ├── snapshot.repository.ts
│   │   ├── risk-report.repository.ts
│   │   ├── metric.repository.ts
│   │   ├── notification.repository.ts
│   │   ├── webhook-event.repository.ts
│   │   ├── audit-log.repository.ts
│   │   ├── saved-view.repository.ts
│   │   └── parser-metadata.repository.ts
│   └── utils/
│       ├── pagination.util.ts
│       └── soft-delete.util.ts
├── package.json
└── tsconfig.json
```

---

## 7. `packages/parser/`

```
packages/parser/
├── grammars/
│   ├── tree-sitter-typescript.wasm
│   ├── tree-sitter-tsx.wasm
│   ├── tree-sitter-javascript.wasm
│   ├── tree-sitter-python.wasm
│   ├── tree-sitter-go.wasm
│   ├── tree-sitter-java.wasm
│   └── tree-sitter-rust.wasm
├── src/
│   ├── index.ts
│   ├── parser.ts
│   ├── pipeline/
│   │   ├── parser-pipeline.ts
│   │   ├── language-detector.ts
│   │   ├── ir-builder.ts
│   │   └── ir-validator.ts
│   ├── extractors/
│   │   ├── base.extractor.ts
│   │   ├── typescript.extractor.ts
│   │   ├── javascript.extractor.ts
│   │   ├── python.extractor.ts
│   │   ├── go.extractor.ts
│   │   ├── java.extractor.ts
│   │   └── rust.extractor.ts
│   ├── registry/
│   │   └── language-registry.ts
│   └── utils/
│       ├── import-resolver.ts
│       ├── complexity-calculator.ts
│       └── hash.util.ts
├── test/
│   ├── extractors/
│   │   ├── typescript.extractor.spec.ts
│   │   ├── python.extractor.spec.ts
│   │   └── go.extractor.spec.ts
│   ├── pipeline/
│   │   └── parser-pipeline.spec.ts
│   └── fixtures/
│       ├── typescript/
│       │   ├── simple-class.ts
│       │   ├── complex-imports.ts
│       │   └── error-syntax.ts
│       ├── python/
│       │   └── simple-module.py
│       └── go/
│           └── simple-package.go
├── package.json
└── tsconfig.json
```

---

## 8. `packages/graph/`

```
packages/graph/
├── src/
│   ├── index.ts
│   ├── driver/
│   │   ├── neo4j-driver.ts
│   │   └── memgraph-session.ts
│   ├── repositories/
│   │   ├── base.graph-repository.ts
│   │   ├── file.graph-repository.ts
│   │   ├── class.graph-repository.ts
│   │   ├── function.graph-repository.ts
│   │   ├── relationship.graph-repository.ts
│   │   └── traversal.graph-repository.ts
│   ├── builders/
│   │   ├── graph-builder.ts
│   │   ├── node-builder.ts
│   │   └── relationship-builder.ts
│   ├── queries/
│   │   ├── blast-radius.query.ts
│   │   ├── circular-dependency.query.ts
│   │   ├── dead-code.query.ts
│   │   ├── statistics.query.ts
│   │   └── visualization.query.ts
│   ├── sync/
│   │   ├── graph-synchronizer.ts
│   │   ├── incremental-updater.ts
│   │   └── graph-rebuilder.ts
│   └── utils/
│       ├── cypher-builder.ts
│       ├── node-id-generator.ts
│       └── schema-version.ts
├── test/
│   ├── builders/
│   │   └── graph-builder.spec.ts
│   ├── queries/
│   │   └── blast-radius.query.spec.ts
│   └── fixtures/
│       └── test-graph-data.ts
├── package.json
└── tsconfig.json
```

---

## 9. `packages/risk-engine/`

```
packages/risk-engine/
├── src/
│   ├── index.ts
│   ├── risk-engine.ts
│   ├── strategies/
│   │   ├── blast-radius.strategy.ts
│   │   ├── dependency-analysis.strategy.ts
│   │   ├── circular-dependency.strategy.ts
│   │   ├── architecture-violation.strategy.ts
│   │   ├── critical-path.strategy.ts
│   │   ├── reviewer-suggestion.strategy.ts
│   │   └── risk-scoring.strategy.ts
│   ├── algorithms/
│   │   ├── bfs-traversal.ts
│   │   ├── tarjan-scc.ts
│   │   ├── topological-sort.ts
│   │   └── longest-path.ts
│   └── interfaces/
│       ├── risk-strategy.interface.ts
│       ├── strategy-context.interface.ts
│       └── analysis-input.interface.ts
├── test/
│   ├── strategies/
│   │   ├── blast-radius.strategy.spec.ts
│   │   ├── dependency-analysis.strategy.spec.ts
│   │   ├── circular-dependency.strategy.spec.ts
│   │   ├── architecture-violation.strategy.spec.ts
│   │   ├── critical-path.strategy.spec.ts
│   │   ├── reviewer-suggestion.strategy.spec.ts
│   │   └── risk-scoring.strategy.spec.ts
│   ├── risk-engine.spec.ts
│   └── fixtures/
│       ├── simple-graph.fixture.ts
│       ├── circular-graph.fixture.ts
│       └── complex-graph.fixture.ts
├── package.json
└── tsconfig.json
```

---

## 10. `packages/github/`

```
packages/github/
├── src/
│   ├── index.ts
│   ├── github-app.ts
│   ├── services/
│   │   ├── authentication.service.ts
│   │   ├── repository.service.ts
│   │   ├── pull-request.service.ts
│   │   ├── comment.service.ts
│   │   └── webhook.service.ts
│   ├── utils/
│   │   ├── token-cache.ts
│   │   ├── rate-limiter.ts
│   │   ├── retry.ts
│   │   └── signature-verifier.ts
│   └── templates/
│       └── blast-radius-comment.template.ts
├── test/
│   ├── services/
│   │   ├── repository.service.spec.ts
│   │   └── comment.service.spec.ts
│   └── utils/
│       └── signature-verifier.spec.ts
├── package.json
└── tsconfig.json
```

---

## 11. `packages/analytics/`

```
packages/analytics/
├── src/
│   ├── index.ts
│   ├── calculators/
│   │   ├── metrics.calculator.ts
│   │   ├── complexity.calculator.ts
│   │   ├── dependency-density.calculator.ts
│   │   ├── coupling.calculator.ts
│   │   └── cohesion.calculator.ts
│   ├── scorers/
│   │   ├── architecture.scorer.ts
│   │   ├── technical-debt.scorer.ts
│   │   └── repository-health.scorer.ts
│   ├── analyzers/
│   │   ├── trend.analyzer.ts
│   │   ├── snapshot-comparator.ts
│   │   └── evolution.analyzer.ts
│   └── interfaces/
│       ├── calculator.interface.ts
│       └── scorer.interface.ts
├── test/
│   ├── calculators/
│   │   └── metrics.calculator.spec.ts
│   └── scorers/
│       └── architecture.scorer.spec.ts
├── package.json
└── tsconfig.json
```

---

## 12. `packages/shared/`

```
packages/shared/
├── src/
│   ├── index.ts
│   ├── utils/
│   │   ├── hash.util.ts
│   │   ├── date.util.ts
│   │   ├── slug.util.ts
│   │   ├── uuid.util.ts
│   │   └── logger.util.ts
│   ├── errors/
│   │   ├── base.error.ts
│   │   ├── not-found.error.ts
│   │   ├── validation.error.ts
│   │   ├── unauthorized.error.ts
│   │   └── conflict.error.ts
│   └── validators/
│       ├── email.validator.ts
│       └── slug.validator.ts
├── package.json
└── tsconfig.json
```

---

## 13. `packages/config/`

```
packages/config/
├── src/
│   ├── index.ts
│   ├── schemas/
│   │   ├── api.config.schema.ts
│   │   ├── worker.config.schema.ts
│   │   ├── database.config.schema.ts
│   │   ├── neo4j.config.schema.ts
│   │   ├── redis.config.schema.ts
│   │   ├── github.config.schema.ts
│   │   └── supabase.config.schema.ts
│   └── loader.ts
├── package.json
└── tsconfig.json
```

---

## 14. `packages/ui/`

```
packages/ui/
├── src/
│   ├── index.ts
│   └── components/
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown.tsx
│       ├── input.tsx
│       ├── table.tsx
│       ├── badge.tsx
│       ├── avatar.tsx
│       ├── tooltip.tsx
│       └── skeleton.tsx
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

*End of Folder Structure. Continue to [14-environment-variables.md](./14-environment-variables.md) →*
