import { IRiskStrategy } from '../interfaces/risk-strategy.interface';
import { DependencyAnalysisResult, RiskAnalysisInput, StrategyContext } from '../types';

export class DependencyAnalysisStrategy implements IRiskStrategy<DependencyAnalysisResult> {
  name = 'dependency-analysis';
  description = 'Calculates fan-in and fan-out coupling metrics for changed files.';

  analyze(input: RiskAnalysisInput, context: StrategyContext): DependencyAnalysisResult {
    const { changedFiles, dependencyGraph } = input;
    
    let totalFanIn = 0;
    let totalFanOut = 0;
    let maxFanIn = 0;
    let maxFanOut = 0;
    const highCouplingFiles: string[] = [];

    const COUPLING_THRESHOLD = 15;

    for (const file of changedFiles) {
      const node = dependencyGraph.fileIndex.get(file.filePath);
      if (!node) continue;

      const fanIn = (dependencyGraph.reverseAdjacencyList.get(node.id) || []).length;
      const fanOut = (dependencyGraph.adjacencyList.get(node.id) || []).length;

      totalFanIn += fanIn;
      totalFanOut += fanOut;

      if (fanIn > maxFanIn) maxFanIn = fanIn;
      if (fanOut > maxFanOut) maxFanOut = fanOut;

      if (fanIn + fanOut > COUPLING_THRESHOLD) {
        highCouplingFiles.push(file.filePath);
      }
    }

    const fileCount = changedFiles.length || 1; // Prevent division by zero

    return {
      directDependencies: totalFanOut,
      directDependents: totalFanIn,
      averageFanIn: totalFanIn / fileCount,
      averageFanOut: totalFanOut / fileCount,
      maxFanIn,
      maxFanOut,
      highCouplingFiles,
    };
  }
}
