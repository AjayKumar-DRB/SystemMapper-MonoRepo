import { BaseGraphRepository } from './base-graph.repository';

export interface BlastRadiusResult {
  nodes: any[];
  edges: any[];
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
    const query = `
      MATCH (source:File {repositoryId: $repositoryId, filePath: $filePath})
      CALL memgraph.bfs(source, "IMPORTS>", maxDepth) YIELD path
      WITH nodes(path) AS nodes, relationships(path) AS rels
      RETURN collect(distinct nodes) AS nodes, collect(distinct rels) AS edges
    `;

    // In a real memgraph environment we'd use Memgraph's specific BFS/DFS path finding,
    // or standard neo4j path syntax `MATCH path = (source)-[:IMPORTS*1..maxDepth]->(target)`.

    const standardNeo4jQuery = `
      MATCH path = (source:File {repositoryId: $repositoryId, filePath: $filePath})<-[:IMPORTS*1..${maxDepth}]-(target:File)
      WITH nodes(path) AS nodes, relationships(path) AS rels
      UNWIND nodes AS node
      UNWIND rels AS rel
      RETURN collect(distinct node) AS nodes, collect(distinct rel) AS edges
    `;

    const results = await this.runQuery<any>(standardNeo4jQuery, { repositoryId, filePath });

    if (results.length === 0) {
      return { nodes: [], edges: [] };
    }

    return {
      nodes: results[0].nodes || [],
      edges: results[0].edges || [],
    };
  }

  async getRepositoryStatistics(repositoryId: string) {
    const query = `
      MATCH (n {repositoryId: $repositoryId})
      RETURN count(n) as totalNodes
    `;
    const results = await this.runQuery<any>(query, { repositoryId });
    return results[0] || { totalNodes: 0 };
  }

  async getFullGraph(repositoryId: string, branch?: string): Promise<any> {
    const branchFilter = branch ? `WHERE n.branch = $branch` : '';
    const query = `
      MATCH (n {repositoryId: $repositoryId})
      ${branchFilter}
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN collect(distinct n) as nodes, collect(distinct r) as edges
    `;
    const results = await this.runQuery<any>(query, {
      repositoryId,
      ...(branch ? { branch } : {}),
    });
    if (results.length === 0) return { nodes: [], edges: [] };

    return {
      nodes: results[0].nodes || [],
      edges: results[0].edges || [],
      fileIndex: new Map(),
      adjacencyList: new Map(),
      reverseAdjacencyList: new Map(),
    };
  }

  /**
   * Returns all nodes and edges within the subtree of a specific folder.
   * Used by the Component View drill-down feature.
   */
  async getSubtreeGraph(repositoryId: string, folderId: string, branch?: string): Promise<any> {
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

    const results = await this.runQuery<any>(query, { folderId, ...branchParam });
    if (results.length === 0) return { nodes: [], edges: [] };

    return {
      nodes: results[0].nodes || [],
      edges: results[0].edges || [],
    };
  }

  async getBranches(repositoryId: string): Promise<string[]> {
    const query = `
      MATCH (n:File {repositoryId: $repositoryId})
      WHERE n.branch IS NOT NULL
      RETURN collect(distinct n.branch) as branches
    `;
    const results = await this.runQuery<any>(query, { repositoryId });
    if (results.length === 0) return [];
    return results[0].branches || [];
  }
}
