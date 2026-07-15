import { IRiskStrategy } from '../interfaces/risk-strategy.interface';
import {
  ArchitectureViolationResult,
  RiskAnalysisInput,
  StrategyContext,
  Violation,
} from '../types';

export class ArchitectureViolationStrategy implements IRiskStrategy<ArchitectureViolationResult> {
  name = 'architecture-violation';
  description =
    'Detects architecture rule violations introduced by the changes based on configurable patterns.';

  analyze(input: RiskAnalysisInput, _context: StrategyContext): ArchitectureViolationResult {
    const { changedFiles, dependencyGraph, options } = input;
    const rules = options.architectureRules || [];
    const violations: Violation[] = [];

    // For every changed file, we check its outgoing dependencies (imports)
    for (const file of changedFiles) {
      const node = dependencyGraph.fileIndex.get(file.filePath);
      if (!node) continue;

      const outboundEdges = dependencyGraph.edges.filter(
        (e) => e.source === node.id && e.type === 'IMPORTS',
      );

      for (const edge of outboundEdges) {
        const targetNode = dependencyGraph.nodes.find((n) => n.id === edge.target);
        if (!targetNode) continue;

        const sourcePath = file.filePath;
        const targetPath = (targetNode.properties.filePath as string) || targetNode.id; // fallback to ID

        for (const rule of rules) {
          if (rule.type === 'ForbiddenImport' || rule.type === 'LayerViolation') {
            const sourceRegex = new RegExp(rule.sourcePattern);
            const targetRegex = new RegExp(rule.targetPattern);

            if (sourceRegex.test(sourcePath) && targetRegex.test(targetPath)) {
              violations.push({
                rule,
                sourceFile: sourcePath,
                targetFile: targetPath,
              });
            }
          }
        }
      }
    }

    return {
      violations,
      violationCount: violations.length,
      severity: violations.length > 0 ? 'error' : 'none',
    };
  }
}
