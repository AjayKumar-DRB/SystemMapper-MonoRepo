import { IRiskStrategy } from '../interfaces/risk-strategy.interface';
import { CircularDependencyResult, Cycle, RiskAnalysisInput, StrategyContext } from '../types';

export class CircularDependencyStrategy implements IRiskStrategy<CircularDependencyResult> {
  name = 'circular-dependency';
  description = 'Detects circular dependencies involving the changed files using Tarjan SCC algorithm.';

  analyze(input: RiskAnalysisInput, context: StrategyContext): CircularDependencyResult {
    const { dependencyGraph, changedFiles } = input;
    
    // We will find all cycles in the graph and see if any changed file is part of them.
    // In a massive graph, we'd limit Tarjan's to a subgraph, but here we run it on the provided dependencyGraph.
    const cycles = this.findCycles(dependencyGraph.adjacencyList);
    
    const changedFileIds = new Set(changedFiles.map(f => {
      const node = dependencyGraph.fileIndex.get(f.filePath);
      return node ? node.id : null;
    }).filter(Boolean));

    let newCyclesIntroduced = false;
    const changedFilesInCycles = new Set<string>();

    for (const cycle of cycles) {
      for (const nodeId of cycle.nodes) {
        if (changedFileIds.has(nodeId)) {
          changedFilesInCycles.add(nodeId);
          // Simplified logic: assume if a changed file is in a cycle, it might have contributed to it.
          // True historical tracking requires comparing previous graph state.
          newCyclesIntroduced = true; 
        }
      }
    }

    return {
      cycles,
      cycleCount: cycles.length,
      changedFilesInCycles: Array.from(changedFilesInCycles),
      newCyclesIntroduced
    };
  }

  // Tarjan's Strongly Connected Components algorithm
  private findCycles(adjacencyList: Map<string, string[]>): Cycle[] {
    let index = 0;
    const stack: string[] = [];
    const indices = new Map<string, number>();
    const lowLinks = new Map<string, number>();
    const onStack = new Set<string>();
    const sccs: Cycle[] = [];

    const strongConnect = (v: string) => {
      indices.set(v, index);
      lowLinks.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      const neighbors = adjacencyList.get(v) || [];
      for (const w of neighbors) {
        if (!indices.has(w)) {
          strongConnect(w);
          lowLinks.set(v, Math.min(lowLinks.get(v)!, lowLinks.get(w)!));
        } else if (onStack.has(w)) {
          lowLinks.set(v, Math.min(lowLinks.get(v)!, indices.get(w)!));
        }
      }

      if (lowLinks.get(v) === indices.get(v)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== v);
        
        // Only SCCs with size > 1 are cycles (ignoring self-loops)
        if (scc.length > 1) {
          sccs.push({ nodes: scc });
        }
      }
    };

    for (const v of adjacencyList.keys()) {
      if (!indices.has(v)) {
        strongConnect(v);
      }
    }

    return sccs;
  }
}
