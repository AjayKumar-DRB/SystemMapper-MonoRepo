import { RiskAnalysisInput, RiskReport, StrategyContext } from './types';
import { IRiskStrategy } from './interfaces/risk-strategy.interface';

export class RiskEngine {
  constructor(private readonly strategies: IRiskStrategy<any>[]) {}

  analyze(input: RiskAnalysisInput): RiskReport {
    const context = new StrategyContext();

    for (const strategy of this.strategies) {
      const result = strategy.analyze(input, context);
      context.setResult(strategy.name, result);
    }

    // Extract all results from context and assemble the final report
    return {
      repositoryId: input.repositoryId,
      analyzedAt: new Date().toISOString(),
      riskScore: context.getResult<any>('risk-scoring')?.overallScore || 0,
      riskLevel: context.getResult<any>('risk-scoring')?.riskLevel || 'LOW',
      blastRadius: context.getResult('blast-radius')!,
      dependencyAnalysis: context.getResult('dependency-analysis')!,
      circularDependencies: context.getResult('circular-dependency')!,
      architectureViolations: context.getResult('architecture-violation')!,
      criticalPath: context.getResult('critical-path')!,
      scoring: context.getResult('risk-scoring')!,
      changedFiles: input.changedFiles,
      options: input.options,
    };
  }
}
