import { BaseGraphRepository } from './base-graph.repository';

export interface BlastRadiusResult {
  nodes: unknown[];
  edges: unknown[];
}

export class TraversalGraphRepository extends BaseGraphRepository {
  /**
   * Executes the blast radius traversal query to find all dependent files up to a max depth.
   */
  async getBlastRadius(
    repositoryId: string,
    filePath: string,
    maxDepth: number = 3,
  ): Promise<BlastRadiusResult> {

    // In a real memgraph environment we'd use Memgraph's specific BFS/DFS path finding,
    // or standard neo4j path syntax `MATCH path = (source)-[:IMPORTS*1..maxDepth]->(target)`.

    const standardNeo4jQuery = `
      MATCH path = (source:File {repositoryId: $repositoryId, filePath: $filePath})<-[:IMPORTS*1..${maxDepth}]-(target:File)
      WITH nodes(path) AS nodes, relationships(path) AS rels
      UNWIND nodes AS node
      UNWIND rels AS rel
      RETURN collect(distinct node) AS nodes, collect(distinct rel) AS edges
    `;

    const results = await this.runQuery<Record<string, unknown>>(standardNeo4jQuery, { repositoryId, filePath });

    if (results.length === 0) {
      return { nodes: [], edges: [] };
    }

    return {
      nodes: (results[0].nodes as unknown[]) || [],
      edges: (results[0].edges as unknown[]) || [],
    };
  }

  async getRepositoryStatistics(repositoryId: string) {
    const query = `
      MATCH (n {repositoryId: $repositoryId})
      RETURN count(n) as totalNodes
    `;
    const results = await this.runQuery<Record<string, unknown>>(query, { repositoryId });
    return results[0] || { totalNodes: 0 };
  }

  async getFullGraph(repositoryId: string, branch?: string): Promise<unknown> {
    const branchFilter = branch ? `WHERE n.branch = $branch` : '';
    const query = `
      MATCH (n {repositoryId: $repositoryId})
      ${branchFilter}
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN collect(distinct n) as nodes, collect(distinct r) as edges
    `;
    const results = await this.runQuery<Record<string, unknown>>(query, {
      repositoryId,
      ...(branch ? { branch } : {}),
    });
    if (results.length === 0) return { nodes: [], edges: [] };

    return {
      nodes: (results[0].nodes as unknown[]) || [],
      edges: (results[0].edges as unknown[]) || [],
      fileIndex: new Map(),
      adjacencyList: new Map(),
      reverseAdjacencyList: new Map(),
    };
  }

  /**
   * Returns all nodes and edges within the subtree of a specific folder.
   * Used by the Component View drill-down feature.
   */
  async getSubtreeGraph(repositoryId: string, folderId: string, branch?: string): Promise<unknown> {
    const branchParam = branch ? { branch } : {};

    // Find the root folder node, then collect everything reachable via CONTAINS,
    // plus IMPORTS edges between any file nodes in that subtree.
    const query = `
      MATCH (root:Folder {nodeId: $folderId})
      OPTIONAL MATCH path = (root)-[:CONTAINS*0..]->(descendant)
      WITH collect(distinct root) + collect(distinct descendant) AS subtreeNodes
      UNWIND subtreeNodes AS n
      OPTIONAL MATCH (n)-[r]->(m)
      WHERE m IN subtreeNodes
      RETURN collect(distinct n) AS nodes, collect(distinct r) AS edges
    `;

    const results = await this.runQuery<Record<string, unknown>>(query, { folderId, ...branchParam });
    if (results.length === 0) return { nodes: [], edges: [] };

    return {
      nodes: (results[0].nodes as unknown[]) || [],
      edges: (results[0].edges as unknown[]) || [],
    };
  }

  async getBranches(repositoryId: string): Promise<string[]> {
    const query = `
      MATCH (n:File {repositoryId: $repositoryId})
      WHERE n.branch IS NOT NULL
      RETURN collect(distinct n.branch) as branches
    `;
    const results = await this.runQuery<Record<string, unknown>>(query, { repositoryId });
    if (results.length === 0) return [];
    return (results[0].branches as string[]) || [];
  }
}
