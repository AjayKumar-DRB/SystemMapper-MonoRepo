export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface DependencyGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  fileIndex: Map<string, GraphNode>;
  adjacencyList: Map<string, string[]>;
  reverseAdjacencyList: Map<string, string[]>;
}

export interface ChangedFile {
  filePath: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  previousPath?: string;
}

export interface ArchitectureRule {
  type: 'LayerViolation' | 'ForbiddenImport' | 'ModuleBoundary';
  sourcePattern: string;
  targetPattern: string;
  description: string;
}

export interface AnalysisOptions {
  maxTraversalDepth: number;
  decayFactor: number;
  criticalFilePatterns: string[];
  architectureRules: ArchitectureRule[];
}

export interface RiskAnalysisInput {
  repositoryId: string;
  changedFiles: ChangedFile[];
  dependencyGraph: DependencyGraphData;
  options: AnalysisOptions;
}

export class StrategyContext {
  private previousResults = new Map<string, unknown>();

  setResult(strategyName: string, result: unknown): void {
    this.previousResults.set(strategyName, result);
  }

  getResult<T>(strategyName: string): T | undefined {
    return this.previousResults.get(strategyName) as T | undefined;
  }
}

export interface BlastRadiusResult {
  affectedFiles: string[];
  totalAffectedNodes: number;
  maxDepth: number;
}

export interface DependencyAnalysisResult {
  directDependencies: number;
  directDependents: number;
  averageFanIn: number;
  averageFanOut: number;
  maxFanIn: number;
  maxFanOut: number;
  highCouplingFiles: string[];
}

export interface Violation {
  rule: ArchitectureRule;
  sourceFile: string;
  targetFile: string;
}

export interface ArchitectureViolationResult {
  violations: Violation[];
  violationCount: number;
  severity: 'none' | 'warning' | 'error';
}

export interface Cycle {
  nodes: string[];
}

export interface CircularDependencyResult {
  cycles: Cycle[];
  cycleCount: number;
  changedFilesInCycles: string[];
  newCyclesIntroduced: boolean;
}

export interface CriticalPathResult {
  criticalPaths: string[][];
  changedFilesOnCriticalPath: string[];
  criticalPathLength: number;
  isOnCriticalPath: boolean;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubScore {
  name: string;
  score: number;
  weight: number;
}

export interface RiskScoringResult {
  overallScore: number;
  riskLevel: RiskLevel;
  subScores: SubScore[];
  explanation: string;
}

export interface RiskReport {
  repositoryId: string;
  analyzedAt: string;
  riskScore: number;
  riskLevel: RiskLevel;
  blastRadius: BlastRadiusResult;
  dependencyAnalysis: DependencyAnalysisResult;
  circularDependencies: CircularDependencyResult;
  architectureViolations: ArchitectureViolationResult;
  criticalPath: CriticalPathResult;
  scoring: RiskScoringResult;
  changedFiles: ChangedFile[];
  options: AnalysisOptions;
}
