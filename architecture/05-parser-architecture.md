# SystemMapper — Parser Architecture

**Document Version:** 1.0.0
**Last Updated:** 2026-06-27
**Parent Document:** [00-executive-summary.md](./00-executive-summary.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tree-sitter Architecture](#2-tree-sitter-architecture)
3. [Supported Languages](#3-supported-languages)
4. [AST Normalization](#4-ast-normalization)
5. [Intermediate Representation](#5-intermediate-representation)
6. [Parser Pipeline](#6-parser-pipeline)
7. [Incremental Parsing](#7-incremental-parsing)
8. [Error Recovery](#8-error-recovery)
9. [Caching Strategy](#9-caching-strategy)
10. [Extension Points](#10-extension-points)

---

## 1. Overview

The parser subsystem is responsible for transforming source code files into a normalized, language-agnostic Intermediate Representation (IR). To support horizontal scaling and language-specific tools, the system uses a **Microservice Architecture** per language ecosystem (e.g., TS/JS Microservice, Python Microservice, Database Intelligence Microservice).

These microservices use a **hybrid parsing approach**:
1. **Tree-sitter** is used for extremely fast syntax parsing and structural extraction.
2. **Semantic Compiler APIs** (like the TypeScript Compiler API) are optionally used for semantic enrichment, cross-file type resolution, and precise call graph analysis.

The output from these microservices is the Canonical IR, which is consumed by the `@systemmapper/graph` builder to construct the Memgraph dependency graph.

### 1.1 Design Goals

| Goal | Implementation |
|------|---------------|
| **Microservice Isolation** | Each language runs in its own scalable microservice |
| **Language-agnostic output** | All microservices produce the same Canonical IR format |
| **Hybrid Analysis** | Combine fast AST parsing with deep semantic compiler APIs |
| **Fault-tolerant** | Parse errors in one file don't break others |
| **Extensible** | Adding a new language requires only a new microservice |
| **Deterministic** | Same input always produces the same output |

---

## 2. Tree-sitter Architecture

### 2.1 Why Tree-sitter

Tree-sitter was selected over alternatives (Babel, TypeScript Compiler API, SWC) for several reasons:

| Criterion | Tree-sitter | Babel/TS Compiler | SWC |
|-----------|------------|-------------------|-----|
| Multi-language | ✅ 100+ grammars | ❌ JS/TS only | ❌ JS/TS only |
| Incremental parsing | ✅ Native | ❌ Full re-parse | ❌ Full re-parse |
| Error recovery | ✅ Continues parsing | ❌ Aborts on error | ❌ Aborts on error |
| Performance | ✅ C/WASM, O(n) | ⚠️ JS, slower | ✅ Rust, fast |
| AST consistency | ✅ Concrete syntax trees | ⚠️ Varies | ⚠️ Varies |
| Memory efficiency | ✅ Efficient tree structure | ⚠️ Large ASTs | ✅ Efficient |

### 2.2 WASM Bindings

Tree-sitter runs in Node.js via WASM bindings (`web-tree-sitter`). Each language grammar is compiled to WASM and loaded at runtime. This provides:

- Cross-platform compatibility (no native compilation required)
- Sandboxed execution (WASM memory isolation)
- Easy distribution (WASM files are bundled with the package)

### 2.3 Parser Initialization

```
Parser Initialization Flow:
1. Load Tree-sitter WASM runtime
2. For each supported language:
   a. Load the language grammar WASM file
   b. Create a Tree-sitter parser instance
   c. Set the language on the parser
   d. Register the parser in the LanguageRegistry
3. Parser is ready to accept files
```

### 2.4 Grammar Management

Grammars are stored in `packages/parser/grammars/` as pre-compiled `.wasm` files. The grammar versions are pinned to ensure deterministic parsing across environments.

| Grammar | File | Source |
|---------|------|--------|
| TypeScript | `tree-sitter-typescript.wasm` | `tree-sitter-typescript` |
| TSX | `tree-sitter-tsx.wasm` | `tree-sitter-typescript` |
| JavaScript | `tree-sitter-javascript.wasm` | `tree-sitter-javascript` |
| Python | `tree-sitter-python.wasm` | `tree-sitter-python` |
| Go | `tree-sitter-go.wasm` | `tree-sitter-go` |
| Java | `tree-sitter-java.wasm` | `tree-sitter-java` |
| Rust | `tree-sitter-rust.wasm` | `tree-sitter-rust` |

---

## 3. Supported Languages & Microservices

### 3.1 MVP Microservices

| Microservice | Languages/Formats | Primary Engine | Semantic Enrichment |
|--------------|------------------|----------------|---------------------|
| **TS/JS Service** | TS, JS, TSX, JSX | Tree-sitter | TypeScript Compiler API |
| **Python Service** | Python (.py) | Tree-sitter | TBD |
| **Database Intel** | .sql, .prisma, Mongoose | Tree-sitter | Schema inference |
| **Go Service** | Go (.go) | Tree-sitter | `go/types` |

### 3.2 Language Detection & Routing

Language detection follows this priority:
1. **File extension** — Mapped via a static lookup table.
2. **Shebang line** — For extensionless scripts.
3. **File name** — For special files (e.g., `schema.prisma`).

Once a language is detected, the core orchestrator routes the file path to the correct microservice queue via BullMQ.

### 3.3 Semantic Enrichment (Hybrid Approach)

Tree-sitter parses a single file at a time, making accurate cross-file type inference impossible for languages like TypeScript. To solve this, the parser microservices use a two-stage approach:
1. **Fast Structural Parse**: Tree-sitter builds the AST and extracts imports, exports, functions, and classes.
2. **Semantic Enrichment**: If the microservice has a compiler API available (e.g., `ts.Program`), it uses it to resolve ambiguous types across files and enrich the call graph.

---

## 4. AST Normalization

### 4.1 Problem

Each language's Tree-sitter grammar produces a different concrete syntax tree (CST) with different node type names, tree structures, and conventions. For example:

- TypeScript: `import_statement` → `import_clause` → `named_imports`
- Python: `import_from_statement` → `dotted_name`
- Go: `import_declaration` → `import_spec_list`

### 4.2 Solution: Language-Agnostic Normalization

Each language extractor normalizes its CST into a common set of **Normalized AST Node Types**:

| Normalized Type | Description |
|----------------|-------------|
| `ImportDeclaration` | An import statement (source, imported names) |
| `ExportDeclaration` | An export statement (exported name, source) |
| `ClassDeclaration` | A class definition (name, methods, properties, superclass) |
| `InterfaceDeclaration` | An interface definition (name, methods, properties) |
| `TypeDeclaration` | A type alias (name, kind) |
| `EnumDeclaration` | An enum definition (name, members) |
| `FunctionDeclaration` | A standalone function (name, parameters, return type) |
| `MethodDeclaration` | A class method (name, class, visibility, parameters) |
| `VariableDeclaration` | A module-level variable (name, type, is constant) |
| `NamespaceDeclaration` | A namespace or module scope (name, contents) |

### 4.3 Normalization Rules

1. **Every extractor produces the same output shape.** The IR format is identical regardless of source language.
2. **Language-specific details are preserved in metadata.** The `metadata` field on each IR node can carry language-specific information.
3. **Qualified names are resolved.** Import paths are resolved to relative paths within the repository (not absolute or node_modules paths).
4. **Line numbers are preserved.** Every IR node carries its start and end line numbers from the source file.
5. **Scope is tracked.** Each declaration knows whether it's exported, private, or local.

---

## 5. Intermediate Representation

### 5.1 IR Structure

The IR is a flat, serializable data structure for each parsed file:

#### `ParsedFile` (Top-level IR for a single file)

| Field | Type | Description |
|-------|------|-------------|
| `filePath` | string | Relative path from repo root |
| `language` | Language (enum) | Detected programming language |
| `contentHash` | string | SHA-256 of file content |
| `lineCount` | number | Total lines in the file |
| `byteSize` | number | File size in bytes |
| `imports` | ImportDeclaration[] | All imports in the file |
| `exports` | ExportDeclaration[] | All exports in the file |
| `classes` | ClassDeclaration[] | All class definitions |
| `interfaces` | InterfaceDeclaration[] | All interface definitions |
| `types` | TypeDeclaration[] | All type aliases |
| `enums` | EnumDeclaration[] | All enum definitions |
| `functions` | FunctionDeclaration[] | All standalone functions |
| `variables` | VariableDeclaration[] | All module-level variables |
| `namespaces` | NamespaceDeclaration[] | All namespace declarations |
| `errors` | ParseError[] | Any parse errors encountered |
| `metadata` | Record<string, unknown> | Language-specific metadata |
| `parseTimeMs` | number | Time taken to parse this file |

#### `ImportDeclaration`

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Import source path or module name |
| `resolvedPath` | string? | Resolved relative path (if internal) |
| `isExternal` | boolean | Whether the import is from an external package |
| `importedNames` | string[] | Named imports (empty for namespace/default) |
| `defaultImport` | string? | Default import name |
| `namespaceImport` | string? | Namespace import name (`* as X`) |
| `isTypeOnly` | boolean | Whether it's a type-only import |
| `startLine` | number | Line number |
| `endLine` | number | End line number |

#### `ClassDeclaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Class name |
| `isAbstract` | boolean | Whether the class is abstract |
| `isExported` | boolean | Whether the class is exported |
| `superClass` | string? | Parent class name |
| `implementedInterfaces` | string[] | Implemented interface names |
| `methods` | MethodDeclaration[] | Class methods |
| `properties` | PropertyDeclaration[] | Class properties |
| `startLine` | number | Start line |
| `endLine` | number | End line |
| `lineCount` | number | Lines of code |
| `complexity` | number | Cyclomatic complexity estimate |

#### `FunctionDeclaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Function name |
| `isExported` | boolean | Whether the function is exported |
| `isAsync` | boolean | Whether the function is async |
| `parameters` | ParameterInfo[] | Parameter list |
| `returnType` | string? | Return type annotation |
| `startLine` | number | Start line |
| `endLine` | number | End line |
| `lineCount` | number | Lines of code |
| `complexity` | number | Cyclomatic complexity estimate |
| `calledFunctions` | string[] | Names of functions called within |
| `usedTypes` | string[] | Names of types referenced within |

#### `MethodDeclaration`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Method name |
| `className` | string | Owning class name |
| `visibility` | "public" \| "private" \| "protected" | Access modifier |
| `isStatic` | boolean | Whether the method is static |
| `isAsync` | boolean | Whether the method is async |
| `isAbstract` | boolean | Whether the method is abstract |
| `parameters` | ParameterInfo[] | Parameter list |
| `returnType` | string? | Return type annotation |
| `startLine` | number | Start line |
| `endLine` | number | End line |
| `lineCount` | number | Lines of code |
| `complexity` | number | Cyclomatic complexity estimate |
| `calledFunctions` | string[] | Names of functions called within |
| `usedTypes` | string[] | Names of types referenced within |

### 5.2 IR Design Principles

1. **Flat, not nested.** The IR is a flat list of declarations per file, not a nested tree. This simplifies graph construction and serialization.
2. **Serializable.** The IR is a plain JavaScript object — no classes, no methods, no circular references. It can be serialized to JSON.
3. **Cross-referenceable.** Each declaration has a `name` that can be matched against import/export names to build the dependency graph.
4. **Metadata-preserving.** Line numbers, visibility, and language-specific details are preserved for accurate graph node properties.
5. **Error-tolerant.** Parse errors are collected but don't prevent the rest of the file from being represented in the IR.

---

## 6. Microservice Parser Pipeline

### 6.1 Pipeline Stages

```
┌─────────────┐   ┌────────────────┐   ┌────────────────┐   ┌────────────┐
│ Orchestrator │ → │ Microservice   │ → │ Semantic       │ → │ Canonical  │
│ (BullMQ)     │   │ (Tree-sitter)  │   │ Enrichment API │   │ IR Builder │
└─────────────┘   └────────────────┘   └────────────────┘   └────────────┘
```

### 6.2 Stage Details

#### Stage 1: Job Routing (Core)
- **Input:** Temporary workspace path, file lists
- **Process:** Group files by language and dispatch BullMQ jobs to language-specific queues.

#### Stage 2: Tree-sitter Parse
- **Input:** File content from temporary workspace
- **Process:** Parse into a concrete syntax tree (CST) and extract basic structures.

#### Stage 3: Semantic Enrichment (Optional)
- **Input:** Basic structures + Compiler API (e.g., TypeScript `TypeChecker`)
- **Process:** Resolve cross-file types, inheritance, and dynamic references.

#### Stage 4: IR Normalization
- **Input:** Enriched language-specific objects
- **Process:** Translate into the Canonical IR using the definitions from `@systemmapper/types`.
- **Output:** Validated Canonical IR returned to the core orchestrator.

---

## 7. Incremental Parsing

### 7.1 Content Hash Comparison

The primary mechanism for incremental parsing:

1. Before parsing a file, compute its SHA-256 content hash.
2. Compare against the stored hash in `ParserMetadata.contentHash` (PostgreSQL).
3. If the hash matches → skip parsing. The file hasn't changed.
4. If the hash differs → re-parse the entire file.

### 7.2 File-Level Granularity

Incremental parsing operates at the **file level**, not the function or line level. This is a deliberate simplification:

- **Simpler logic:** No need to diff ASTs or track which functions changed within a file.
- **Deterministic:** Re-parsing the entire file produces a fresh, complete IR.
- **Fast enough:** Tree-sitter can parse a 10,000-line TypeScript file in <100ms. File-level re-parsing is not a bottleneck.

### 7.3 Tree-sitter Incremental Parsing (Future)

Tree-sitter supports true incremental parsing where you provide the old tree and the edit ranges, and it only re-parses the affected portions. This is planned for a future optimization:

1. Store the serialized Tree-sitter tree alongside the parsed IR.
2. On file change, provide the old tree and the diff to Tree-sitter.
3. Tree-sitter produces an updated tree with only the changed subtrees re-parsed.
4. Re-extract only the affected declarations.

This optimization is not needed for MVP but the architecture supports it.

---

## 8. Error Recovery

### 8.1 Tree-sitter Error Recovery

Tree-sitter has built-in error recovery:

- When it encounters a syntax error, it inserts an `ERROR` node in the CST.
- Parsing continues past the error. The rest of the file is still parsed correctly.
- `MISSING` nodes are inserted where expected tokens are absent.

### 8.2 Extractor Error Recovery

Language extractors handle errors at the declaration level:

1. Each declaration extraction is wrapped in a try-catch.
2. If extraction fails for one class/function, the error is logged and the extractor moves to the next declaration.
3. The `ParseResult` is marked as `partial` rather than `failed`.

### 8.3 Pipeline Error Recovery

The pipeline handles errors at the file level:

1. If language detection fails → `skipped` status.
2. If Tree-sitter crashes (should never happen) → `failed` status with error.
3. If extraction produces zero declarations → `partial` status (file may be empty or unparseable).
4. If validation fails → error added to list but IR is still returned.

### 8.4 Error Categorization

| Error Category | Severity | Impact |
|---------------|----------|--------|
| `SYNTAX_ERROR` | Warning | File partially parsed; some elements may be missing |
| `EXTRACTION_ERROR` | Warning | Specific declaration couldn't be extracted |
| `RESOLUTION_ERROR` | Info | Import path couldn't be resolved to a file |
| `LANGUAGE_ERROR` | Error | Language couldn't be detected or grammar unavailable |
| `SIZE_ERROR` | Info | File too large, skipped |
| `BINARY_ERROR` | Info | Binary file detected, skipped |

---

## 9. Caching Strategy

### 9.1 Parse Result Cache

Parsed IRs are **not cached** in memory or on disk within the parser package. Instead:

1. The worker stores the content hash in PostgreSQL (`ParserMetadata.contentHash`).
2. On subsequent scans, the worker checks the hash **before** calling the parser.
3. If the hash matches, the worker skips the file entirely — the parser is never invoked.

This design keeps the parser stateless and side-effect-free.

### 9.2 Grammar Cache

Tree-sitter WASM grammars are loaded once at parser initialization and kept in memory for the lifetime of the worker process. Grammar loading is expensive (~50ms per grammar), so it should happen once at startup, not per-file.

### 9.3 Parser Instance Cache

Tree-sitter parser instances (one per language) are created once and reused across files. The parser instance is stateless between parses — calling `parse()` with new source code does not depend on any previous state.

---

## 10. Extension Points

### 10.1 Adding a New Language

To add support for a new language:

1. **Obtain the Tree-sitter grammar WASM** file from the language's tree-sitter package.
2. **Create a new language extractor** (e.g., `ruby.parser.ts`) that implements the `LanguageParser` interface.
3. **Implement CST-to-IR extraction** using Tree-sitter query patterns specific to the language.
4. **Register the language** in the `LanguageRegistry` with its extensions and parser.
5. **Add tests** covering import extraction, class extraction, function extraction, and error cases.

The existing parser pipeline requires **zero modification** to support a new language. Only the extractor needs to be written.

### 10.2 Adding New IR Elements

To extract new types of code elements (e.g., decorators, annotations, generics):

1. Add the new element type to the IR type definitions in `@systemmapper/types`.
2. Add the new field to `ParsedFile`.
3. Update each language extractor to extract the new element.
4. Update the IR builder to include the new element.
5. No changes needed to the pipeline, cache, or validation logic.

### 10.3 Custom Extraction Rules

For project-specific extraction needs (e.g., detecting NestJS decorators, React hooks):

1. Create a **post-processor** that runs after the standard extraction pipeline.
2. Post-processors receive the `ParsedFile` IR and can augment it with additional metadata.
3. Post-processors are registered in the parser configuration and run in order.
4. This enables domain-specific extraction without modifying the core parser.

---

*End of Parser Architecture. Continue to [06-risk-engine.md](./06-risk-engine.md) →*
