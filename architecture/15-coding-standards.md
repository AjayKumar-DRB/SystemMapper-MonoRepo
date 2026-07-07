# SystemMapper — Coding Standards

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [TypeScript Standards](#1-typescript-standards)
2. [ESLint Configuration](#2-eslint-configuration)
3. [Prettier Configuration](#3-prettier-configuration)
4. [Commit Conventions](#4-commit-conventions)
5. [Git Hooks](#5-git-hooks)
6. [Import Standards](#6-import-standards)
7. [Naming Conventions](#7-naming-conventions)
8. [Code Organization](#8-code-organization)

---

## 1. TypeScript Standards

### 1.1 Strict Mode

All `tsconfig.json` files extend a shared base configuration with strict mode enabled:

**`tsconfig.base.json` settings:**

| Setting | Value | Rationale |
|---------|-------|-----------|
| `strict` | `true` | Enables all strict type-checking options |
| `noImplicitAny` | `true` | No implicit `any` types allowed |
| `strictNullChecks` | `true` | Null and undefined are distinct types |
| `strictFunctionTypes` | `true` | Strict function parameter checking |
| `noImplicitReturns` | `true` | All code paths must return a value |
| `noFallthroughCasesInSwitch` | `true` | Switch cases must break or return |
| `noUncheckedIndexedAccess` | `true` | Indexed access returns `T | undefined` |
| `forceConsistentCasingInFileNames` | `true` | Prevent casing issues across OS |
| `esModuleInterop` | `true` | Clean default import interop |
| `skipLibCheck` | `true` | Skip type-checking .d.ts files for performance |
| `resolveJsonModule` | `true` | Allow importing JSON files |
| `declaration` | `true` | Generate .d.ts files for packages |
| `declarationMap` | `true` | Generate declaration maps for IDE navigation |

### 1.2 Type Rules

| Rule | Description |
|------|-------------|
| No `any` | Use `unknown` when the type is truly unknown. Use specific types otherwise. |
| No type assertions | Avoid `as Type` casts. Use type guards instead. |
| Prefer interfaces | Use `interface` for object shapes, `type` for unions/intersections. |
| Exhaustive switches | Use `never` type in default case to enforce exhaustive handling. |
| Readonly by default | Use `readonly` on properties that shouldn't be mutated. |
| No enums (in types package) | Use `const` enums or string literal unions for tree-shaking. Exception: enums in `@systemmapper/types` are allowed as they serve as the canonical enum source. |

---

## 2. ESLint Configuration

### 2.1 Base Configuration

The root `.eslintrc.js` extends:

1. `eslint:recommended`
2. `plugin:@typescript-eslint/recommended`
3. `plugin:@typescript-eslint/recommended-requiring-type-checking`
4. `prettier` (disables formatting rules that conflict with Prettier)

### 2.2 Key Rules

| Rule | Setting | Rationale |
|------|---------|-----------|
| `@typescript-eslint/no-explicit-any` | `error` | Enforce strict typing |
| `@typescript-eslint/no-unused-vars` | `error` (with `argsIgnorePattern: '^_'`) | Catch unused code, allow `_` prefix for intentionally unused params |
| `@typescript-eslint/explicit-function-return-type` | `warn` | Encourage explicit return types |
| `@typescript-eslint/no-floating-promises` | `error` | All promises must be awaited or returned |
| `@typescript-eslint/no-misused-promises` | `error` | Prevent passing async functions where sync is expected |
| `no-console` | `warn` | Use the logger utility instead |
| `no-restricted-imports` | Configured per-package | Prevent importing from internal paths of other packages |
| `import/no-cycle` | `error` | Prevent circular dependencies |
| `import/order` | `warn` | Enforce consistent import ordering |

### 2.3 Per-Package Overrides

- **`packages/risk-engine`**: Disallow imports from any `@systemmapper/*` package except `@systemmapper/types`.
- **`packages/types`**: Disallow any runtime imports. Only type imports allowed.
- **`apps/web`**: Add `plugin:react/recommended` and `plugin:react-hooks/recommended`.
- **`apps/api`, `apps/worker`**: Add NestJS-specific rules.

---

## 3. Prettier Configuration

### 3.1 `.prettierrc`

| Setting | Value | Rationale |
|---------|-------|-----------|
| `printWidth` | `100` | Wider than default for modern monitors |
| `tabWidth` | `2` | Standard for TypeScript/JavaScript projects |
| `useTabs` | `false` | Spaces for consistency |
| `semi` | `true` | Always use semicolons |
| `singleQuote` | `true` | Single quotes for JS/TS strings |
| `trailingComma` | `all` | Trailing commas reduce diff noise |
| `bracketSpacing` | `true` | Spaces in object literals |
| `arrowParens` | `always` | Always wrap arrow function params |
| `endOfLine` | `lf` | Unix-style line endings |

### 3.2 `.prettierignore`

```
node_modules/
dist/
build/
.next/
coverage/
*.wasm
pnpm-lock.yaml
```

---

## 4. Commit Conventions

### 4.1 Conventional Commits

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 4.2 Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(parser): add Python language support` |
| `fix` | Bug fix | `fix(graph): resolve circular dependency detection` |
| `docs` | Documentation | `docs(api): update REST endpoint docs` |
| `style` | Code style (formatting, no logic) | `style(shared): apply prettier formatting` |
| `refactor` | Code refactor (no feature/fix) | `refactor(risk-engine): extract scoring into strategy` |
| `test` | Add or update tests | `test(parser): add TypeScript extractor tests` |
| `chore` | Build, tooling, config | `chore(deps): update tree-sitter to 0.22` |
| `perf` | Performance improvement | `perf(graph): batch Memgraph MERGE operations` |
| `ci` | CI/CD changes | `ci: add lint workflow` |

### 4.3 Scopes

Scopes correspond to package and app names:

| Scope | Target |
|-------|--------|
| `api` | `apps/api` |
| `web` | `apps/web` |
| `worker` | `apps/worker` |
| `parser` | `packages/parser` |
| `graph` | `packages/graph` |
| `risk-engine` | `packages/risk-engine` |
| `analytics` | `packages/analytics` |
| `github` | `packages/github` |
| `database` | `packages/database` |
| `types` | `packages/types` |
| `shared` | `packages/shared` |
| `config` | `packages/config` |
| `ui` | `packages/ui` |
| `deps` | Dependency updates |
| `docker` | Docker/infra changes |

### 4.4 Commitlint Configuration

**`commitlint.config.js`:**

```
Rules:
- type-enum: Enforce allowed types
- scope-enum: Enforce allowed scopes
- subject-max-length: 72 characters
- body-max-line-length: 100 characters
- type-case: lowercase
- subject-case: lowercase
```

---

## 5. Git Hooks

### 5.1 Husky Setup

Git hooks are managed by Husky and installed automatically via `pnpm prepare`.

### 5.2 Hooks

| Hook | Tool | Action |
|------|------|--------|
| `pre-commit` | `lint-staged` | Lint and format staged files |
| `commit-msg` | `commitlint` | Validate commit message format |

### 5.3 lint-staged Configuration

```
"*.{ts,tsx}": ["eslint --fix", "prettier --write"],
"*.{json,md,yml,yaml}": ["prettier --write"]
```

This ensures:
1. Only staged files are linted (fast).
2. ESLint auto-fixes are applied.
3. Prettier formatting is applied.
4. The commit contains only properly formatted code.

---

## 6. Import Standards

### 6.1 Absolute Imports

All imports within an application use absolute paths, configured via `tsconfig.json` path aliases:

| Alias | Path | Used In |
|-------|------|---------|
| `@/` | `./src/` | `apps/api`, `apps/web`, `apps/worker` |
| `@modules/` | `./src/modules/` | `apps/api` |
| `@common/` | `./src/common/` | `apps/api` |
| `@components/` | `./src/components/` | `apps/web` |
| `@hooks/` | `./src/hooks/` | `apps/web` |
| `@lib/` | `./src/lib/` | `apps/web` |

### 6.2 Import Order

Imports are ordered in the following groups (enforced by `eslint-plugin-import`):

1. **Node built-ins** (`path`, `fs`, `crypto`)
2. **External packages** (`@nestjs/common`, `react`, `@octokit/rest`)
3. **Internal packages** (`@systemmapper/types`, `@systemmapper/database`)
4. **Absolute app imports** (`@/modules/auth`, `@components/layout`)
5. **Relative imports** (`./utils`, `../types`)

Each group is separated by a blank line.

### 6.3 No Circular Dependencies

Circular dependencies are strictly forbidden:

- ESLint's `import/no-cycle` rule is set to `error`.
- Turborepo's dependency graph enforces acyclic package dependencies.
- The `@systemmapper/types` package MUST have zero internal dependencies (only external type imports).
- If a circular dependency is detected, the developer must:
  1. Extract the shared type/function into `@systemmapper/types` or `@systemmapper/shared`.
  2. Use dependency inversion (depend on an interface, not a concrete implementation).
  3. Restructure the module boundaries.

---

## 7. Naming Conventions

### 7.1 File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Module file | `kebab-case.module.ts` | `auth.module.ts` |
| Controller | `kebab-case.controller.ts` | `repositories.controller.ts` |
| Service | `kebab-case.service.ts` | `repositories.service.ts` |
| Repository | `kebab-case.repository.ts` | `user.repository.ts` |
| Strategy | `kebab-case.strategy.ts` | `blast-radius.strategy.ts` |
| DTO | `kebab-case.dto.ts` | `create-organization.dto.ts` |
| Interface | `kebab-case.interface.ts` | `risk-strategy.interface.ts` |
| Test | `kebab-case.spec.ts` | `blast-radius.strategy.spec.ts` |
| E2E Test | `kebab-case.e2e-spec.ts` | `app.e2e-spec.ts` |
| Enum | `kebab-case.enum.ts` | `risk-level.enum.ts` |
| Type | `kebab-case.type.ts` | `risk-report.type.ts` |
| Constant | `kebab-case.const.ts` | `risk-weights.const.ts` |
| Utility | `kebab-case.util.ts` | `hash.util.ts` |
| React Component | `kebab-case.tsx` | `graph-canvas.tsx` |

### 7.2 Code Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Class | PascalCase | `BlastRadiusStrategy` |
| Interface | PascalCase with `I` prefix | `IRiskStrategy` |
| Function | camelCase | `calculateBlastRadius` |
| Variable | camelCase | `riskScore` |
| Constant | UPPER_SNAKE_CASE | `MAX_TRAVERSAL_DEPTH` |
| Enum | PascalCase | `RiskLevel` |
| Enum member | UPPER_SNAKE_CASE | `RiskLevel.HIGH` |
| Type alias | PascalCase | `RiskReport` |
| React Component | PascalCase | `GraphCanvas` |
| CSS class | kebab-case | `graph-canvas-container` |
| Database table | PascalCase (Prisma) | `Repository` |
| Database column | camelCase (Prisma) | `lastScannedAt` |
| Memgraph node label | PascalCase | `File`, `Class` |
| Memgraph relationship | UPPER_SNAKE_CASE | `IMPORTS`, `CALLS` |
| Memgraph property | camelCase | `filePath`, `repositoryId` |
| Queue name | kebab-case | `repository-scan` |
| Event type | UPPER_SNAKE_CASE | `REPOSITORY_CONNECTED` |

---

## 8. Code Organization

### 8.1 Clean Architecture Layers

Within each application, code follows Clean Architecture layers:

```
Frameworks & Drivers → Adapters → Application → Domain
(NestJS, Prisma)    (Controllers,  (Services,    (Types,
                     Repositories)  Use Cases)   Interfaces)
```

**Dependency Rule:** All dependencies point inward. Domain has zero external dependencies.

### 8.2 Feature-First Structure

Within `apps/api`, modules are organized by feature (not by technical layer):

```
✅ Correct: modules/auth/ contains controller, service, DTOs for auth
✗ Wrong:   controllers/auth.controller.ts + services/auth.service.ts
```

### 8.3 Package Independence

Each package under `packages/` must:

1. Have a single `index.ts` barrel export.
2. Export only its public API — internal modules are not exported.
3. Have its own `package.json` with explicit dependencies.
4. Have its own `tsconfig.json` extending the base.
5. Be independently buildable (`pnpm --filter @systemmapper/parser build`).
6. Be independently testable (`pnpm --filter @systemmapper/parser test`).

---

*End of Coding Standards. Continue to [16-testing-strategy.md](./16-testing-strategy.md) →*
