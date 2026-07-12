import { IRiskStrategy } from '../interfaces/risk-strategy.interface';
import {
  RiskScoringResult,
  RiskAnalysisInput,
  StrategyContext,
  BlastRadiusResult,
  DependencyAnalysisResult,
  CircularDependencyResult,
  ArchitectureViolationResult,
  CriticalPathResult,
  RiskLevel,
} from '../types';

export class RiskScoringStrategy implements IRiskStrategy<RiskScoringResult> {
  name = 'risk-scoring';
  description = 'Aggregates all strategy results into a final risk score (0-100).';

  analyze(input: RiskAnalysisInput, context: StrategyContext): RiskScoringResult {
    const blastRadius = context.getResult<BlastRadiusResult>('blast-radius');
    const dependency = context.getResult<DependencyAnalysisResult>('dependency-analysis');
    const circular = context.getResult<CircularDependencyResult>('circular-dependency');
    const architecture = context.getResult<ArchitectureViolationResult>('architecture-violation');
    const criticalPath = context.getResult<CriticalPathResult>('critical-path');

    // Default weights
    const weights = {
      blastRadius: 0.3,
      dependency: 0.2,
      circular: 0.15,
      architecture: 0.15,
      criticalPath: 0.1,
      changeSize: 0.1,
    };

    // Calculate Sub-scores (0-100)
    const blastRadiusScore = blastRadius ? Math.min(100, blastRadius.totalAffectedNodes * 2) : 0;

    const dependencyScore = dependency
      ? Math.min(100, dependency.maxFanIn * 5 + dependency.maxFanOut * 3)
      : 0;

    const circularScore =
      circular && circular.cycleCount > 0 ? Math.min(100, circular.cycleCount * 25) : 0;

    const architectureScore =
      architecture && architecture.violationCount > 0
        ? Math.min(100, architecture.violationCount * 20)
        : 0;

    const criticalPathScore =
      criticalPath && criticalPath.isOnCriticalPath
        ? Math.min(100, 50 + criticalPath.changedFilesOnCriticalPath.length * 10)
        : 0;

    const totalLinesChanged = input.changedFiles.reduce(
      (sum, f) => sum + f.additions + f.deletions,
      0,
    );
    const changeSizeScore = Math.min(100, totalLinesChanged / 10);

    // Final weighted sum
    const overallScore = Math.round(
      blastRadiusScore * weights.blastRadius +
        dependencyScore * weights.dependency +
        circularScore * weights.circular +
        architectureScore * weights.architecture +
        criticalPathScore * weights.criticalPath +
        changeSizeScore * weights.changeSize,
    );

    // Classification
    let riskLevel: RiskLevel = 'LOW';
    if (overallScore > 25) riskLevel = 'MEDIUM';
    if (overallScore > 50) riskLevel = 'HIGH';
    if (overallScore > 75) riskLevel = 'CRITICAL';

    return {
      overallScore,
      riskLevel,
      subScores: [
        { name: 'Blast Radius', score: blastRadiusScore, weight: weights.blastRadius },
        { name: 'Dependencies', score: dependencyScore, weight: weights.dependency },
        { name: 'Circular Dependencies', score: circularScore, weight: weights.circular },
        { name: 'Architecture', score: architectureScore, weight: weights.architecture },
        { name: 'Critical Path', score: criticalPathScore, weight: weights.criticalPath },
        { name: 'Change Size', score: changeSizeScore, weight: weights.changeSize },
      ],
      explanation: `Calculated risk score of ${overallScore} (${riskLevel}).`,
    };
  }
}
