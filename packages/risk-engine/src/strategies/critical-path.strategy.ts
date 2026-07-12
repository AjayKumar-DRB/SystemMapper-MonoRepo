import { IRiskStrategy } from '../interfaces/risk-strategy.interface';
import { CriticalPathResult, RiskAnalysisInput, StrategyContext } from '../types';

export class CriticalPathStrategy implements IRiskStrategy<CriticalPathResult> {
  name = 'critical-path';
  description =
    'Identifies whether the changed files are on the critical path (longest dependency chain) of the repository.';

  analyze(input: RiskAnalysisInput, context: StrategyContext): CriticalPathResult {
    const { dependencyGraph, changedFiles } = input;

    // For MVP, we will use a simplified longest-path algorithm for DAGs.
    // Assuming the graph is mostly a DAG (cycles are handled separately).
    const inDegrees = new Map<string, number>();
    const topoOrder: string[] = [];
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string>();

    // Initialize
    for (const nodeId of dependencyGraph.adjacencyList.keys()) {
      inDegrees.set(nodeId, 0);
      distances.set(nodeId, 0);
    }

    // Calculate in-degrees
    for (const [u, neighbors] of dependencyGraph.adjacencyList.entries()) {
      for (const v of neighbors) {
        if (!inDegrees.has(v)) inDegrees.set(v, 0);
        inDegrees.set(v, inDegrees.get(v)! + 1);
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegrees.entries()) {
      if (degree === 0) queue.push(nodeId);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      topoOrder.push(u);

      const neighbors = dependencyGraph.adjacencyList.get(u) || [];
      for (const v of neighbors) {
        inDegrees.set(v, inDegrees.get(v)! - 1);
        if (inDegrees.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    // Longest path in DAG
    let maxDistance = 0;
    let maxNode = '';

    for (const u of topoOrder) {
      const neighbors = dependencyGraph.adjacencyList.get(u) || [];
      for (const v of neighbors) {
        const d = (distances.get(u) || 0) + 1;
        if (d > (distances.get(v) || 0)) {
          distances.set(v, d);
          predecessors.set(v, u);
          if (d > maxDistance) {
            maxDistance = d;
            maxNode = v;
          }
        }
      }
    }

    // Backtrack to find the critical path
    const criticalPath: string[] = [];
    let curr: string | undefined = maxNode;
    while (curr) {
      criticalPath.unshift(curr);
      curr = predecessors.get(curr);
    }

    // Check if any changed files are on this path
    const changedFileIds = new Set(
      changedFiles
        .map((f) => {
          const node = dependencyGraph.fileIndex.get(f.filePath);
          return node ? node.id : null;
        })
        .filter(Boolean),
    );

    const changedFilesOnCriticalPath: string[] = [];
    for (const nodeId of criticalPath) {
      if (changedFileIds.has(nodeId)) {
        changedFilesOnCriticalPath.push(nodeId);
      }
    }

    return {
      criticalPaths: criticalPath.length > 0 ? [criticalPath] : [],
      criticalPathLength: maxDistance,
      changedFilesOnCriticalPath,
      isOnCriticalPath: changedFilesOnCriticalPath.length > 0,
    };
  }
}
