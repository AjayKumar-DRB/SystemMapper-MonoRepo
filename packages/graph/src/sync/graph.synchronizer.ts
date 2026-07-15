import { ParsedFile } from '@systemmapper/types';
import { BaseGraphRepository } from '../repositories/base-graph.repository';
import { NodeBuilder } from '../builders/node.builder';

import { CypherBuilder } from '../cypher/cypher.builder';
import { MemgraphDriver } from '../driver/memgraph-driver';
import { ManagedTransaction } from 'neo4j-driver';

export class GraphSynchronizer extends BaseGraphRepository {
  async fullSync(
    repositoryId: string,
    parsedFiles: ParsedFile[],
    scanId: string,
    branch?: string,
    allFilePaths?: string[],
  ): Promise<void> {
    const session = await MemgraphDriver.getSession();

    // Use allFilePaths (entire repo) if available, otherwise fall back to just this batch.
    // This is essential for correct cross-file import resolution.
    const filePathsForResolution = allFilePaths || parsedFiles.map((f) => f.filePath);

    try {
      // For large graphs, batch processing should be used.
      // Here we implement a simplified transaction-based ingestion for MVP.
      await session.executeWrite(async (tx: ManagedTransaction) => {
        // Pass 0: Build Directories
        const createdDirs = new Set<string>();
        for (const file of parsedFiles) {
          const dirs = file.filePath.split('/');
          dirs.pop(); // remove filename
          let currentPath = '';
          let parentDirId: string | null = null;

          for (const dir of dirs) {
            currentPath = currentPath ? `${currentPath}/${dir}` : dir;
            const dirProps = NodeBuilder.buildDirectoryNode(
              repositoryId,
              currentPath,
              scanId,
              branch,
            );

            if (!createdDirs.has(currentPath)) {
              createdDirs.add(currentPath);
              await this.executeMerge(tx, 'Folder', dirProps);

              if (parentDirId) {
                await this.executeRelationship(tx, parentDirId, dirProps.nodeId, 'CONTAINS');
              }
            }
            parentDirId = dirProps.nodeId;
          }
        }

        // Pass 1: Build Nodes
        for (const file of parsedFiles) {
          const fileNode = NodeBuilder.buildFileNode(repositoryId, file, scanId, branch);
          await this.executeMerge(tx, 'File', fileNode);

          const dirPath = file.filePath.split('/').slice(0, -1).join('/');
          if (dirPath) {
            const parentDirId = NodeBuilder.buildDirectoryNode(
              repositoryId,
              dirPath,
              scanId,
              branch,
            ).nodeId;
            await this.executeRelationship(tx, parentDirId, fileNode.nodeId, 'CONTAINS');
          }

          for (const classDecl of file.classes) {
            const classNode = NodeBuilder.buildClassNode(
              repositoryId,
              classDecl,
              file.filePath,
              scanId,
              branch,
            );
            await this.executeMerge(tx, 'Class', classNode);
            await this.executeRelationship(tx, fileNode.nodeId, classNode.nodeId, 'CONTAINS');

            for (const method of classDecl.methods) {
              const methodNode = NodeBuilder.buildMethodNode(
                repositoryId,
                method,
                file.filePath,
                classDecl.name,
                scanId,
                branch,
              );
              await this.executeMerge(tx, 'Method', methodNode);
              await this.executeRelationship(tx, classNode.nodeId, methodNode.nodeId, 'CONTAINS');
            }
          }

          for (const func of file.functions) {
            const funcNode = NodeBuilder.buildFunctionNode(
              repositoryId,
              func,
              file.filePath,
              scanId,
              branch,
            );
            await this.executeMerge(tx, 'Function', funcNode);
            await this.executeRelationship(tx, fileNode.nodeId, funcNode.nodeId, 'CONTAINS');
          }
        }

        // Pass 2: Build Cross-File Relationships (Imports)
        // Use the complete repository file list for accurate resolution
        for (const file of parsedFiles) {
          const fileNodeId = NodeBuilder.buildFileNode(repositoryId, file, scanId, branch).nodeId;

          for (const imp of file.imports) {
            // Skip externals — they are not in the repo
            if (imp.isExternal) continue;

            const resolvedPath = this.resolveImport(
              file.filePath,
              imp.source,
              filePathsForResolution,
            );
            if (resolvedPath) {
              const targetNodeId = `${repositoryId}:${branch || 'default'}:File:${resolvedPath}`;
              await this.executeRelationship(tx, fileNodeId, targetNodeId, 'IMPORTS', {
                startLine: imp.startLine,
              });
            }
          }
        }
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Resolves an import source to an actual file path within the repo.
   * Handles: relative imports (./x, ../x), @/ path aliases, and index files.
   * Returns null for external packages (node_modules).
   */
  private resolveImport(
    currentFilePath: string,
    importSource: string,
    allFilePaths: string[],
  ): string | null {
    // Skip external packages entirely — they are not in the repo
    if (
      !importSource.startsWith('.') &&
      !importSource.startsWith('/') &&
      !importSource.startsWith('@/')
    ) {
      return null;
    }

    const allFilePathsSet = new Set(allFilePaths);
    const currentDir = currentFilePath.split('/').slice(0, -1).join('/');

    // Resolve @/ alias: treat as relative to the repo root (common in TS projects)
    let resolvedBase: string;
    if (importSource.startsWith('@/')) {
      resolvedBase = importSource.slice(2); // strip the @/
    } else {
      // Resolve relative path: ./foo or ../bar
      const segments = currentDir ? currentDir.split('/') : [];
      const importParts = importSource.split('/');

      for (const part of importParts) {
        if (part === '..') {
          segments.pop();
        } else if (part !== '.') {
          segments.push(part);
        }
      }
      resolvedBase = segments.join('/');
    }

    // Strip any existing extension to try all possible extensions
    const baseNoExt = resolvedBase.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/i, '');

    // Try direct file matches with common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
    for (const ext of extensions) {
      const candidate = `${baseNoExt}${ext}`;
      if (allFilePathsSet.has(candidate)) {
        return candidate;
      }
    }

    // Try index file in a directory: ./foo → ./foo/index.ts
    for (const ext of extensions) {
      const candidate = `${baseNoExt}/index${ext}`;
      if (allFilePathsSet.has(candidate)) {
        return candidate;
      }
    }

    // Not found in this batch — may resolve in a later batch
    return null;
  }

  private async executeMerge(
    tx: ManagedTransaction,
    label: string,
    properties: Record<string, unknown>,
  ) {
    const builder = new CypherBuilder()
      .merge(`${label}:Node`, 'n', `nodeId: $props.nodeId`)
      .set('n += $props');

    const { query, params } = builder.withParams({ props: properties }).build();
    await tx.run(query, params);
  }

  private async executeRelationship(
    tx: ManagedTransaction,
    sourceId: string,
    targetId: string,
    type: string,
    props: Record<string, unknown> = {},
  ) {
    const builder = new CypherBuilder()
      .match('Node', 's', 'nodeId: $sourceId')
      .match('Node', 't', 'nodeId: $targetId')
      .mergeRelationship('s', 't', type)
      .set('r += $props');

    const { query, params } = builder.withParams({ sourceId, targetId, props }).build();
    await tx.run(query, params);
  }
}
