# SystemMapper — Memgraph Graph Design

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Node Types](#3-node-types)
4. [Relationship Types](#4-relationship-types)
5. [Indexes and Constraints](#5-indexes-and-constraints)
6. [Traversal Strategy](#6-traversal-strategy)
7. [Cypher Queries](#7-cypher-queries)

---

## 1. Overview

Memgraph serves as the **architectural dependency graph** for SystemMapper. It stores the structural relationships between code elements (files, modules, classes, functions) extracted during AST parsing. The graph is purpose-built for fast traversal queries that would be prohibitively expensive in a relational database — specifically blast radius calculation, circular dependency detection, and dead code identification.

Memgraph does NOT store:

- User data, authentication, or authorization information
- Business metadata (scan history, metrics, settings)
- Transient job state

Memgraph DOES store:

- Repository structure (directories, files)
- Code elements (classes, functions, interfaces, types, enums, variables)
- Dependencies between elements (imports, calls, inheritance, usage)
- Architectural layers and boundaries

### 1.1 Infrastructure & Performance Framing

Because we use an "Ephemeral Delta" architecture—where PostgreSQL is the persistent source of truth and the graph database acts as an ephemeral layer for main branch and PR deltas—Memgraph's RAM limits are perfectly suited for our low-memory footprint. Memgraph's primary constraint is RAM capacity, whereas legacy graph databases like Neo4j were constrained by JVM heap pre-allocation and disk I/O. Furthermore, Memgraph operates at sub-millisecond latencies for our specific use case because it is a C/C++ in-memory database that avoids disk page cache misses entirely.

### 1.2 Graph Namespace Strategy

Each repository's graph is namespaced using a `repositoryId` property on every node. This enables:

- Multi-repository support in a single Memgraph instance
- Per-repository graph operations (rebuild, delete, snapshot)
- Cross-repository queries (future)

### 1.2 Property Naming Convention

- Node labels: `PascalCase` (e.g., `File`, `Class`, `Function`)
- Relationship types: `UPPER_SNAKE_CASE` (e.g., `IMPORTS`, `CALLS`, `EXTENDS`)
- Properties: `camelCase` (e.g., `filePath`, `className`, `repositoryId`)

---

## 2. Design Principles

### 2.1 Node Identity

Every node has a deterministic `nodeId` property composed of:

```
{repositoryId}:{nodeType}:{qualifiedName}
```

Examples:

- `repo-123:File:src/services/user.service.ts`
- `repo-123:Class:src/services/user.service.ts:UserService`
- `repo-123:Function:src/utils/hash.ts:hashPassword`

This ensures:

- **Idempotency:** Rebuilding the graph produces identical node IDs.
- **Merge support:** `MERGE` operations can upsert nodes without duplicates.
- **Cross-reference:** PostgreSQL can reference Memgraph nodes via `nodeId`.

### 2.2 PostgreSQL Reference

Every node carries a `pgEntityId` property (nullable) that references the corresponding PostgreSQL entity ID (when one exists). This enables bidirectional lookup between the two databases.

### 2.3 Temporal Properties

Every node and relationship carries:

- `createdAt` — ISO 8601 timestamp of creation
- `updatedAt` — ISO 8601 timestamp of last update
- `scanId` — The RepositoryScan ID that created/updated this node
- `snapshotVersion` — The snapshot version this node belongs to

---

## 3. Node Types

### 3.1 `Repository`

**Purpose:** Root node representing a GitHub repository. All other nodes in a repository's graph are reachable from this node via CONTAINS chains.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | Deterministic ID: `{repositoryId}:Repository:{fullName}` |
| `repositoryId` | String | Yes | PostgreSQL Repository ID |
| `pgEntityId` | String | Yes | Same as repositoryId |
| `name` | String | Yes | Repository name |
| `fullName` | String | Yes | GitHub full name (owner/repo) |
| `defaultBranch` | String | Yes | Default branch |
| `language` | String | No | Primary language |
| `scanId` | String | Yes | Last scan ID |
| `snapshotVersion` | String | Yes | Current snapshot version |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.2 `Workspace`

**Purpose:** Represents a logical workspace or project within a monorepo. Maps to a `package.json` or similar project root.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Workspace:{path}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Workspace name |
| `path` | String | Yes | Relative path from repo root |
| `packageManager` | String | No | npm, pnpm, yarn, etc. |
| `version` | String | No | Package version |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.3 `Directory`

**Purpose:** Represents a filesystem directory in the repository.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Directory:{path}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Directory name |
| `path` | String | Yes | Full relative path |
| `depth` | Integer | Yes | Nesting depth from root |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.4 `File`

**Purpose:** Represents a source code file. This is the most common node type and the primary unit of dependency tracking.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:File:{filePath}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `pgEntityId` | String | No | ParserMetadata ID in PostgreSQL |
| `filePath` | String | Yes | Full relative path |
| `fileName` | String | Yes | File name with extension |
| `extension` | String | Yes | File extension (.ts, .py, etc.) |
| `language` | String | Yes | Programming language |
| `lineCount` | Integer | Yes | Number of lines |
| `byteSize` | Integer | Yes | File size in bytes |
| `contentHash` | String | Yes | SHA-256 of file content |
| `hasParseErrors` | Boolean | Yes | Whether parsing had errors |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.5 `Module`

**Purpose:** Represents a module (e.g., an ES module, Python module, Go package). A file may export one or more modules.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Module:{filePath}:{moduleName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Module name |
| `filePath` | String | Yes | Source file path |
| `isDefault` | Boolean | No | Whether it's a default export |
| `exportCount` | Integer | Yes | Number of exports |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.6 `Package`

**Purpose:** Represents an external package dependency (npm package, pip package, go module).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Package:{packageName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Package name |
| `version` | String | No | Version constraint |
| `isExternal` | Boolean | Yes | Always `true` for packages |
| `registry` | String | No | npm, pypi, etc. |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.7 `Namespace`

**Purpose:** Represents a namespace or module scope (e.g., C# namespace, Java package, TypeScript namespace).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Namespace:{qualifiedName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Namespace name |
| `qualifiedName` | String | Yes | Fully qualified namespace |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.8 `Class`

**Purpose:** Represents a class definition.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Class:{filePath}:{className}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Class name |
| `qualifiedName` | String | Yes | Fully qualified name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `endLine` | Integer | Yes | Ending line number |
| `isAbstract` | Boolean | No | Whether the class is abstract |
| `isExported` | Boolean | Yes | Whether the class is exported |
| `visibility` | String | No | public, private, protected |
| `methodCount` | Integer | Yes | Number of methods |
| `propertyCount` | Integer | Yes | Number of properties |
| `lineCount` | Integer | Yes | Lines of code |
| `complexity` | Integer | No | Cyclomatic complexity |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.9 `Interface`

**Purpose:** Represents an interface definition (TypeScript, Java, Go).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Interface:{filePath}:{interfaceName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Interface name |
| `qualifiedName` | String | Yes | Fully qualified name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `endLine` | Integer | Yes | Ending line number |
| `isExported` | Boolean | Yes | Whether the interface is exported |
| `methodCount` | Integer | Yes | Number of method signatures |
| `propertyCount` | Integer | Yes | Number of property signatures |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.10 `Type`

**Purpose:** Represents a type alias or type definition.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Type:{filePath}:{typeName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Type name |
| `qualifiedName` | String | Yes | Fully qualified name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `endLine` | Integer | Yes | Ending line number |
| `isExported` | Boolean | Yes | Whether the type is exported |
| `kind` | String | No | "alias", "union", "intersection", "literal" |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.11 `Enum`

**Purpose:** Represents an enumeration definition.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Enum:{filePath}:{enumName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Enum name |
| `qualifiedName` | String | Yes | Fully qualified name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `endLine` | Integer | Yes | Ending line number |
| `isExported` | Boolean | Yes | Whether the enum is exported |
| `memberCount` | Integer | Yes | Number of enum members |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.12 `Function`

**Purpose:** Represents a standalone function (not a class method).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Function:{filePath}:{functionName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Function name |
| `qualifiedName` | String | Yes | Fully qualified name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `endLine` | Integer | Yes | Ending line number |
| `isExported` | Boolean | Yes | Whether the function is exported |
| `isAsync` | Boolean | No | Whether the function is async |
| `parameterCount` | Integer | Yes | Number of parameters |
| `lineCount` | Integer | Yes | Lines of code |
| `complexity` | Integer | No | Cyclomatic complexity |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.13 `Method`

**Purpose:** Represents a method within a class.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Method:{filePath}:{className}.{methodName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Method name |
| `qualifiedName` | String | Yes | Fully qualified name |
| `className` | String | Yes | Owning class name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `endLine` | Integer | Yes | Ending line number |
| `visibility` | String | No | public, private, protected |
| `isStatic` | Boolean | No | Whether the method is static |
| `isAsync` | Boolean | No | Whether the method is async |
| `isAbstract` | Boolean | No | Whether the method is abstract |
| `parameterCount` | Integer | Yes | Number of parameters |
| `lineCount` | Integer | Yes | Lines of code |
| `complexity` | Integer | No | Cyclomatic complexity |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.14 `Variable`

**Purpose:** Represents a module-level variable, constant, or exported value.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Variable:{filePath}:{variableName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Variable name |
| `filePath` | String | Yes | Source file path |
| `startLine` | Integer | Yes | Starting line number |
| `isExported` | Boolean | Yes | Whether the variable is exported |
| `isConstant` | Boolean | No | Whether it's a const declaration |
| `typeAnnotation` | String | No | Type annotation (if present) |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.15 `APIEndpoint`

**Purpose:** Represents an HTTP API endpoint (REST route, GraphQL resolver).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:APIEndpoint:{method}:{path}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `method` | String | Yes | HTTP method (GET, POST, PUT, DELETE) |
| `path` | String | Yes | Route path |
| `filePath` | String | Yes | Source file containing the endpoint |
| `handlerName` | String | No | Handler function/method name |
| `className` | String | No | Controller class name |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.16 `DatabaseTable`

**Purpose:** Represents a database table referenced in the codebase (e.g., Prisma model, SQLAlchemy model).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:DatabaseTable:{tableName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Table name |
| `filePath` | String | No | Schema definition file |
| `columnCount` | Integer | No | Number of columns |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.17 `DatabaseColumn`

**Purpose:** Represents a column within a database table.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:DatabaseColumn:{tableName}.{columnName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Column name |
| `tableName` | String | Yes | Parent table name |
| `dataType` | String | No | Column data type |
| `isNullable` | Boolean | No | Whether the column is nullable |
| `isPrimaryKey` | Boolean | No | Whether it's a primary key |
| `isForeignKey` | Boolean | No | Whether it's a foreign key |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.18 `Queue`

**Purpose:** Represents a message queue referenced in the codebase.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Queue:{queueName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Queue name |
| `technology` | String | No | Queue technology (BullMQ, SQS, etc.) |
| `filePath` | String | No | File where queue is defined |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.19 `Topic`

**Purpose:** Represents a pub/sub topic or event channel.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Topic:{topicName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Topic name |
| `technology` | String | No | Messaging technology |
| `filePath` | String | No | File where topic is defined |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.20 `ExternalService`

**Purpose:** Represents an external service dependency (API, database, third-party service).

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:ExternalService:{serviceName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Service name |
| `url` | String | No | Service URL |
| `type` | String | No | "api", "database", "cache", "storage" |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.21 `EnvironmentVariable`

**Purpose:** Represents an environment variable referenced in the codebase.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:EnvironmentVariable:{varName}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Variable name |
| `filePaths` | List[String] | No | Files that reference this variable |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

### 3.22 `Configuration`

**Purpose:** Represents a configuration file or configuration block.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `nodeId` | String | Yes | `{repositoryId}:Configuration:{filePath}` |
| `repositoryId` | String | Yes | Parent repository ID |
| `name` | String | Yes | Config file name |
| `filePath` | String | Yes | File path |
| `format` | String | No | json, yaml, toml, env |
| `scanId` | String | Yes | Last scan ID |
| `createdAt` | DateTime | Yes | Creation timestamp |
| `updatedAt` | DateTime | Yes | Last update timestamp |

---

## 4. Relationship Types

### 4.1 `CONTAINS`

**Purpose:** Structural containment. Directory contains files, file contains classes, class contains methods.

| Property | Type | Description |
|----------|------|-------------|
| `order` | Integer | Order within parent (for file ordering) |

**Valid Source → Target:**

- Repository → Workspace
- Repository → Directory
- Workspace → Directory
- Directory → Directory
- Directory → File
- File → Class
- File → Interface
- File → Type
- File → Enum
- File → Function
- File → Variable
- Class → Method
- Namespace → Class
- Namespace → Interface
- DatabaseTable → DatabaseColumn

---

### 4.2 `IMPORTS`

**Purpose:** File-level import relationships. File A imports from File B.

| Property | Type | Description |
|----------|------|-------------|
| `importedNames` | List[String] | Specific named imports |
| `isDefault` | Boolean | Whether it's a default import |
| `isNamespace` | Boolean | Whether it's a namespace import (`import * as`) |
| `importPath` | String | The import path as written in source |
| `startLine` | Integer | Line number of the import statement |

**Valid Source → Target:**

- File → File
- File → Module
- File → Package
- Module → Module
- Module → Package

---

### 4.3 `CALLS`

**Purpose:** Function/method invocation. Function A calls Function B.

| Property | Type | Description |
|----------|------|-------------|
| `callCount` | Integer | Number of call sites |
| `lines` | List[Integer] | Line numbers of call sites |

**Valid Source → Target:**

- Function → Function
- Function → Method
- Method → Function
- Method → Method

---

### 4.4 `USES`

**Purpose:** General usage relationship. A component uses (references) another component.

| Property | Type | Description |
|----------|------|-------------|
| `usageType` | String | "type_reference", "value_reference", "parameter" |
| `lines` | List[Integer] | Line numbers of usage |

**Valid Source → Target:**

- Function → Type
- Function → Interface
- Function → Enum
- Function → Variable
- Method → Type
- Method → Interface
- Method → Enum
- Method → Variable
- Class → Type
- Class → Interface
- Class → Enum

---

### 4.5 `DEPENDS_ON`

**Purpose:** Abstract dependency. Used for package-level and module-level dependencies.

| Property | Type | Description |
|----------|------|-------------|
| `dependencyType` | String | "runtime", "devDependency", "peerDependency" |
| `versionConstraint` | String | Semver constraint |

**Valid Source → Target:**

- Package → Package
- Workspace → Package
- Module → Module
- File → ExternalService

---

### 4.6 `IMPLEMENTS`

**Purpose:** Interface implementation. Class A implements Interface B.

| Property | Type | Description |
|----------|------|-------------|
| `isPartial` | Boolean | Whether it's a partial implementation |

**Valid Source → Target:**

- Class → Interface

---

### 4.7 `EXTENDS`

**Purpose:** Inheritance. Class A extends Class B.

| Property | Type | Description |
|----------|------|-------------|
| (none) | | |

**Valid Source → Target:**

- Class → Class
- Interface → Interface

---

### 4.8 `READS`

**Purpose:** Data read operation. A component reads from a data source.

| Property | Type | Description |
|----------|------|-------------|
| `operation` | String | "select", "find", "get", "query" |

**Valid Source → Target:**

- Function → DatabaseTable
- Method → DatabaseTable
- Function → EnvironmentVariable
- Method → EnvironmentVariable
- Function → Configuration
- Method → Configuration

---

### 4.9 `WRITES`

**Purpose:** Data write operation. A component writes to a data source.

| Property | Type | Description |
|----------|------|-------------|
| `operation` | String | "insert", "update", "delete", "create" |

**Valid Source → Target:**

- Function → DatabaseTable
- Method → DatabaseTable

---

### 4.10 `CONNECTS_TO`

**Purpose:** Network connectivity. A component connects to an external service.

| Property | Type | Description |
|----------|------|-------------|
| `protocol` | String | "http", "grpc", "tcp", "websocket" |

**Valid Source → Target:**

- Function → ExternalService
- Method → ExternalService
- Class → ExternalService
- APIEndpoint → ExternalService

---

### 4.11 `AUTHENTICATES`

**Purpose:** Authentication flow. A component authenticates against a service.

| Property | Type | Description |
|----------|------|-------------|
| `mechanism` | String | "jwt", "oauth", "api_key", "basic" |

**Valid Source → Target:**

- Function → ExternalService
- Method → ExternalService
- Class → ExternalService

---

### 4.12 `QUERIES`

**Purpose:** Database query execution. A component queries a specific table or column.

| Property | Type | Description |
|----------|------|-------------|
| `queryType` | String | "select", "insert", "update", "delete", "aggregate" |
| `columns` | List[String] | Specific columns queried |

**Valid Source → Target:**

- Function → DatabaseTable
- Method → DatabaseTable
- Function → DatabaseColumn
- Method → DatabaseColumn

---

### 4.13 `EMITS`

**Purpose:** Event/message emission. A component emits events to a queue or topic.

| Property | Type | Description |
|----------|------|-------------|
| `eventName` | String | Name of the emitted event |

**Valid Source → Target:**

- Function → Queue
- Method → Queue
- Function → Topic
- Method → Topic

---

### 4.14 `SUBSCRIBES`

**Purpose:** Event/message subscription. A component subscribes to a queue or topic.

| Property | Type | Description |
|----------|------|-------------|
| `eventName` | String | Name of the subscribed event |

**Valid Source → Target:**

- Function → Queue
- Method → Queue
- Function → Topic
- Method → Topic
- Class → Queue
- Class → Topic

---

### 4.15 `EXPOSES`

**Purpose:** API exposure. A class or function exposes an API endpoint.

| Property | Type | Description |
|----------|------|-------------|
| (none) | | |

**Valid Source → Target:**

- Class → APIEndpoint
- Function → APIEndpoint
- Method → APIEndpoint

---

### 4.16 `OWNS`

**Purpose:** Ownership relationship. An organizational unit owns a component.

| Property | Type | Description |
|----------|------|-------------|
| `ownershipType` | String | "team", "individual", "shared" |

**Valid Source → Target:**

- Workspace → Directory
- Workspace → File

---

## 5. Indexes and Constraints

### 5.1 Uniqueness Constraints

Every node type has a uniqueness constraint on `nodeId`:

```
CREATE CONSTRAINT ON (n:Repository) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Repository(nodeId);
CREATE CONSTRAINT ON (n:Workspace) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Workspace(nodeId);
CREATE CONSTRAINT ON (n:Directory) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Directory(nodeId);
CREATE CONSTRAINT ON (n:File) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :File(nodeId);
CREATE CONSTRAINT ON (n:Module) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Module(nodeId);
CREATE CONSTRAINT ON (n:Package) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Package(nodeId);
CREATE CONSTRAINT ON (n:Namespace) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Namespace(nodeId);
CREATE CONSTRAINT ON (n:Class) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Class(nodeId);
CREATE CONSTRAINT ON (n:Interface) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Interface(nodeId);
CREATE CONSTRAINT ON (n:Type) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Type(nodeId);
CREATE CONSTRAINT ON (n:Enum) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Enum(nodeId);
CREATE CONSTRAINT ON (n:Function) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Function(nodeId);
CREATE CONSTRAINT ON (n:Method) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Method(nodeId);
CREATE CONSTRAINT ON (n:Variable) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Variable(nodeId);
CREATE CONSTRAINT ON (n:APIEndpoint) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :APIEndpoint(nodeId);
CREATE CONSTRAINT ON (n:DatabaseTable) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :DatabaseTable(nodeId);
CREATE CONSTRAINT ON (n:DatabaseColumn) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :DatabaseColumn(nodeId);
CREATE CONSTRAINT ON (n:Queue) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Queue(nodeId);
CREATE CONSTRAINT ON (n:Topic) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Topic(nodeId);
CREATE CONSTRAINT ON (n:ExternalService) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :ExternalService(nodeId);
CREATE CONSTRAINT ON (n:EnvironmentVariable) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :EnvironmentVariable(nodeId);
CREATE CONSTRAINT ON (n:Configuration) ASSERT n.nodeId IS UNIQUE;
CREATE INDEX ON :Configuration(nodeId);
```

### 5.2 Property Indexes

```
// Repository-scoped lookups (most common query pattern)
CREATE INDEX ON :File(repositoryId);
CREATE INDEX ON :Class(repositoryId);
CREATE INDEX ON :Function(repositoryId);
CREATE INDEX ON :Method(repositoryId);
CREATE INDEX ON :Interface(repositoryId);
CREATE INDEX ON :Directory(repositoryId);

// File path lookups
CREATE INDEX ON :File(filePath);
CREATE INDEX ON :Class(filePath);
CREATE INDEX ON :Function(filePath);

// Scan-scoped lookups
CREATE INDEX ON :File(scanId);

// Name-based lookups
CREATE INDEX ON :Class(name);
CREATE INDEX ON :Function(name);
CREATE INDEX ON :Interface(name);

// Content hash (for incremental updates)
CREATE INDEX ON :File(contentHash);
```

### 5.3 Full-Text Indexes

```
// Search by name across all code elements
CREATE FULLTEXT INDEX search_codeElements FOR (n:Class|Interface|Function|Method|Type|Enum|Variable)
ON EACH [n.name, n.qualifiedName];
```

---

## 6. Traversal Strategy

### 6.1 Blast Radius Traversal

**Algorithm:** Bidirectional BFS starting from changed file nodes.

**Forward traversal (downstream impact):**

1. Start with changed File nodes.
2. Find all nodes contained within those files (classes, functions, methods).
3. Traverse outbound `CALLS`, `USES`, `IMPORTS` relationships to find direct dependents.
4. Continue traversal to configurable depth (default: 5 hops).
5. Collect all affected nodes with their distance from the changed files.

**Reverse traversal (upstream dependencies):**

1. From each changed file, traverse inbound `IMPORTS` relationships.
2. Identify all files that import from the changed files.
3. Recursively traverse importers to find the full reverse dependency tree.

**Depth limiting:** Traversal is depth-limited to prevent explosion on highly connected graphs. Default depth: 5. Configurable per repository.

**Weight calculation:** Each hop reduces the weight by a decay factor (default: 0.7). A node 1 hop away has weight 1.0, 2 hops has 0.7, 3 hops has 0.49, etc.

### 6.2 Circular Dependency Detection

**Algorithm:** Tarjan's Strongly Connected Components (SCC) algorithm applied to the file-level import graph.

1. Project the graph to file-level `IMPORTS` relationships only.
2. Run SCC detection.
3. Any SCC with more than one node is a circular dependency.
4. Report all cycles with their member nodes and paths.

### 6.3 Dead Code Detection

**Algorithm:** Unreachable node detection.

1. Start from all exported File nodes (files that are imported by at least one other file).
2. Also start from all API Endpoint nodes.
3. Traverse all `IMPORTS`, `CALLS`, `USES` relationships.
4. Any Function, Class, or Method node not reached is potentially dead code.
5. Filter out test files, configuration files, and entry points.

### 6.4 Critical Path Analysis

**Algorithm:** Longest path in the dependency DAG.

1. Build a DAG of file-level imports.
2. Perform topological sort.
3. Calculate the longest path from any source to any sink.
4. The critical path identifies the deepest dependency chain.
5. Nodes on the critical path are high-impact change targets.

---

## 7. Cypher Queries

### 7.1 Blast Radius

```cypher
// Find all files directly and transitively affected by changes to specific files
// Parameters: $repositoryId, $changedFilePaths, $maxDepth
MATCH (changed:File)
WHERE changed.repositoryId = $repositoryId
  AND changed.filePath IN $changedFilePaths

// Find all nodes in the changed files
MATCH (changed)-[:CONTAINS*0..]->(element)

// Traverse outbound dependencies with depth limit
MATCH path = (element)-[:CALLS|USES|IMPORTS*1..$maxDepth]->(affected)
WHERE affected.repositoryId = $repositoryId

// Collect unique affected files
MATCH (affectedFile:File)-[:CONTAINS*0..]->(affected)
WHERE affectedFile.repositoryId = $repositoryId

RETURN DISTINCT
  affectedFile.filePath AS affectedFilePath,
  affectedFile.nodeId AS nodeId,
  min(length(path)) AS distance,
  collect(DISTINCT affected.name) AS affectedComponents
ORDER BY distance ASC
```

### 7.2 Reverse Dependency (Who depends on me?)

```cypher
// Find all files that directly or transitively import a given file
// Parameters: $repositoryId, $filePath, $maxDepth
MATCH (target:File {repositoryId: $repositoryId, filePath: $filePath})
MATCH path = (dependent:File)-[:IMPORTS*1..$maxDepth]->(target)
WHERE dependent.repositoryId = $repositoryId
RETURN DISTINCT
  dependent.filePath AS dependentFilePath,
  length(path) AS distance
ORDER BY distance ASC
```

### 7.3 Circular Dependencies

```cypher
// Detect all circular import chains in a repository
// Parameters: $repositoryId
MATCH path = (f1:File)-[:IMPORTS*2..10]->(f1)
WHERE f1.repositoryId = $repositoryId
WITH path, nodes(path) AS pathNodes, length(path) AS cycleLength
WHERE cycleLength >= 2
RETURN DISTINCT
  [n IN pathNodes | n.filePath] AS cyclePath,
  cycleLength
ORDER BY cycleLength ASC
```

### 7.4 Dead Code Detection

```cypher
// Find functions and classes that are never imported or called
// Parameters: $repositoryId
MATCH (f:Function {repositoryId: $repositoryId, isExported: true})
WHERE NOT (f)<-[:CALLS]-()
  AND NOT (f)<-[:USES]-()
  AND NOT (f)<-[:IMPORTS]-()
  AND NOT f.filePath CONTAINS 'test'
  AND NOT f.filePath CONTAINS 'spec'
  AND NOT f.filePath CONTAINS '__test__'
RETURN f.filePath AS filePath, f.name AS functionName, 'Function' AS nodeType
UNION
MATCH (c:Class {repositoryId: $repositoryId, isExported: true})
WHERE NOT (c)<-[:USES]-()
  AND NOT (c)<-[:IMPORTS]-()
  AND NOT (c)<-[:EXTENDS]-()
  AND NOT (c)<-[:IMPLEMENTS]-()
  AND NOT c.filePath CONTAINS 'test'
  AND NOT c.filePath CONTAINS 'spec'
RETURN c.filePath AS filePath, c.name AS functionName, 'Class' AS nodeType
ORDER BY filePath
```

### 7.5 Unused Components

```cypher
// Find files with no incoming imports (orphan files)
// Parameters: $repositoryId
MATCH (f:File {repositoryId: $repositoryId})
WHERE NOT (f)<-[:IMPORTS]-()
  AND NOT f.filePath CONTAINS 'index'
  AND NOT f.filePath CONTAINS 'main'
  AND NOT f.filePath CONTAINS 'app'
  AND NOT f.filePath CONTAINS 'test'
  AND NOT f.filePath CONTAINS 'spec'
  AND NOT f.filePath CONTAINS 'config'
  AND NOT f.filePath ENDS WITH '.d.ts'
RETURN f.filePath AS orphanFile, f.lineCount AS lineCount
ORDER BY f.lineCount DESC
```

### 7.6 Architecture Violations — Layer Violations

```cypher
// Find imports that violate the layer structure
// (e.g., domain importing from infrastructure)
// Parameters: $repositoryId, $violatingPattern, $violatedPattern
MATCH (source:File {repositoryId: $repositoryId})-[r:IMPORTS]->(target:File {repositoryId: $repositoryId})
WHERE source.filePath CONTAINS $violatingPattern
  AND target.filePath CONTAINS $violatedPattern
RETURN
  source.filePath AS sourceFile,
  target.filePath AS targetFile,
  r.importPath AS importPath,
  r.startLine AS line
```

### 7.7 Repository Health — Dependency Statistics

```cypher
// Calculate repository-level dependency statistics
// Parameters: $repositoryId
MATCH (f:File {repositoryId: $repositoryId})
OPTIONAL MATCH (f)-[r:IMPORTS]->(imported)
WITH f, count(r) AS importCount
RETURN
  count(f) AS totalFiles,
  sum(importCount) AS totalImports,
  avg(importCount) AS avgImportsPerFile,
  max(importCount) AS maxImportsPerFile,
  percentileCont(importCount, 0.5) AS medianImportsPerFile,
  percentileCont(importCount, 0.9) AS p90ImportsPerFile
```

### 7.8 Most Connected Nodes (Hub Analysis)

```cypher
// Find the most connected nodes (potential bottlenecks)
// Parameters: $repositoryId, $limit
MATCH (n {repositoryId: $repositoryId})
WHERE n:Class OR n:Function OR n:File
WITH n, size([(n)-[]-() | 1]) AS connectionCount
ORDER BY connectionCount DESC
LIMIT $limit
RETURN
  n.nodeId AS nodeId,
  n.name AS name,
  labels(n)[0] AS nodeType,
  n.filePath AS filePath,
  connectionCount
```

### 7.9 Dependency Depth (Longest Chain)

```cypher
// Find the longest import chain in the repository
// Parameters: $repositoryId
MATCH path = (start:File {repositoryId: $repositoryId})-[:IMPORTS*]->(end:File)
WHERE NOT ()-[:IMPORTS]->(start) // start is a root (no incoming imports)
  AND start.repositoryId = $repositoryId
  AND end.repositoryId = $repositoryId
WITH path, length(path) AS chainLength
ORDER BY chainLength DESC
LIMIT 10
RETURN
  [n IN nodes(path) | n.filePath] AS chain,
  chainLength
```

### 7.10 Component Overview for Visualization

```cypher
// Get the complete graph for visualization (file-level)
// Parameters: $repositoryId
MATCH (f:File {repositoryId: $repositoryId})
OPTIONAL MATCH (f)-[r:IMPORTS]->(target:File {repositoryId: $repositoryId})
RETURN
  collect(DISTINCT {
    id: f.nodeId,
    label: f.fileName,
    filePath: f.filePath,
    language: f.language,
    lineCount: f.lineCount
  }) AS nodes,
  collect(DISTINCT CASE WHEN r IS NOT NULL THEN {
    source: f.nodeId,
    target: target.nodeId,
    type: type(r)
  } END) AS edges
```

---

*End of Graph Design. Continue to [04-sync-strategy.md](./04-sync-strategy.md) →*
