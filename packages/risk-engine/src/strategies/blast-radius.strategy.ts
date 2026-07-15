import { IRiskStrategy } from '../interfaces/risk-strategy.interface';
import { BlastRadiusResult, RiskAnalysisInput, StrategyContext } from '../types';

export class BlastRadiusStrategy implements IRiskStrategy<BlastRadiusResult> {
  name = 'blast-radius';
  description =
    'Calculates the transitive impact radius of the changed files via BFS on reverse dependencies.';

  analyze(input: RiskAnalysisInput, _context: StrategyContext): BlastRadiusResult {
    const { changedFiles, dependencyGraph, options } = input;
    const maxDepth = options.maxTraversalDepth;
    const affectedNodes = new Set<string>();

    // Simple BFS on the reverse adjacency list (who depends on me)
    const queue: { nodeId: string; depth: number }[] = [];

    for (const file of changedFiles) {
      // Find the node ID for this file path
      const node = dependencyGraph.fileIndex.get(file.filePath);
      if (node) {
        queue.push({ nodeId: node.id, depth: 0 });
        affectedNodes.add(node.id);
      }
    }

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (depth >= maxDepth) continue;

      const dependents = dependencyGraph.reverseAdjacencyList.get(nodeId) || [];
      for (const depId of dependents) {
        if (!affectedNodes.has(depId)) {
          affectedNodes.add(depId);
          queue.push({ nodeId: depId, depth: depth + 1 });
        }
      }
    }

    // Convert Set back to array and get stats
    const affectedFiles = Array.from(affectedNodes);

    // In a full implementation we'd also determine if affected nodes are Functions/Classes
    // by reading the node labels, but here we simplify to file paths/node IDs for MVP.

    return {
      affectedFiles,
      totalAffectedNodes: affectedFiles.length,
      maxDepth: affectedFiles.length > 0 ? maxDepth : 0,
    };
  }
}
