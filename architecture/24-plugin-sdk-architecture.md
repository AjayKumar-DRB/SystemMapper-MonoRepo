# 24 — Plugin SDK & Extension System

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## 1. Overview

The **Plugin SDK & Extension System** is the universal extension mechanism for the Application Intelligence Platform. To ensure the core architecture remains vendor-agnostic and infinitely extensible, almost all external interactions are mediated through plugins.

By establishing strict Plugin Contracts, the system allows internal teams and external contributors to extend capabilities without modifying core business logic.

---

## 2. Supported Plugin Categories

The platform supports the following extensible categories:
1. **Language Plugins**: Parse source code (e.g., JavaScript, Python, Go) into Language IR.
2. **Framework Plugins**: Identify patterns like Routes and Controllers (e.g., React, NestJS, Spring Boot).
3. **ORM Plugins**: Identify database models and queries (e.g., Prisma, Hibernate).
4. **Database Plugins**: Connect to live databases to extract schemas (e.g., Postgres, MongoDB).
5. **Graph Store Plugins**: Persist the Generic Graph Model (e.g., Memgraph, Memgraph).
6. **Git Provider Plugins**: Connect to VCS (e.g., GitHub, GitLab, Bitbucket).
7. **AI Provider Plugins**: Execute LLM inference (e.g., OpenAI, Anthropic, Gemini).
8. **Visualization Providers**: Custom rendering layers.
9. **Search Providers**: Connect to external indices (e.g., Elasticsearch, Algolia).
10. **Authentication Providers**: SSO integrations (e.g., Okta, Auth0).

---

## 3. Plugin Registration & Discovery

### Plugin Metadata
Every plugin must export a canonical metadata manifest:
```typescript
interface PluginManifest {
  id: string; // e.g., "@systemmapper/plugin-language-typescript"
  version: string;
  category: PluginCategory;
  author: string;
  capabilities: string[];
  dependencies?: Record<string, string>; // e.g., requires specific SDK version
}
```

### Discovery Mechanism
Plugins are discovered dynamically at boot. The platform scans configured plugin directories (or `npm` modules) and registers them into the central `PluginRegistry`. 
- Capability negotiation occurs during registration. If a workspace contains Python code, the registry dynamically resolves and activates the Python Language Plugin.

---

## 4. Plugin Contracts & Interfaces

To ensure stability, the SDK provides strictly typed interfaces that all plugins must implement.

### Example: Language Plugin Contract
```typescript
interface ILanguagePlugin {
  manifest: PluginManifest;
  
  // Capability check
  canParse(fileExtension: string): boolean;
  
  // Core parsing lifecycle
  parse(fileContext: IFileContext): Promise<LanguageIR>;
  
  // Extension hooks
  extractImports?(ast: ASTNode): Dependency[];
  extractExports?(ast: ASTNode): Symbol[];
  extractClasses?(ast: ASTNode): ClassDeclaration[];
}
```

### Example: Graph Store Plugin Contract
```typescript
interface IGraphStorePlugin {
  connect(config: StoreConfig): Promise<void>;
  writeNodes(nodes: GenericGraphNode[]): Promise<void>;
  writeEdges(edges: GenericGraphEdge[]): Promise<void>;
  executeQuery(query: GraphQuery): Promise<GraphResult>;
}
```

---

## 5. Plugin Lifecycle

The platform manages the execution lifecycle of all plugins:
1. **Init**: Plugins are instantiated and receive environment variables/configuration.
2. **Negotiate**: The platform asks plugins if they can handle a specific task (e.g., "Can you parse `.tsx` files?").
3. **Execute**: The plugin performs its isolated task and yields results.
4. **Teardown**: The plugin is gracefully shut down, releasing resources (e.g., DB connections).

---

## 6. Extension Hooks & Dependency Management

### Hooks
Plugins can register into platform lifecycle hooks (similar to Webpack). 
- *Pre-Analysis Hook*: A Git plugin pulls the latest code.
- *Post-Analysis Hook*: A notification plugin sends a Slack message when graph analysis completes.

### Backward Compatibility
The Plugin SDK is versioned independently of the platform (e.g., `v1.x.x`). The core platform will guarantee backward compatibility for older SDK versions by using internal adapters, ensuring plugins do not break during minor platform upgrades.
