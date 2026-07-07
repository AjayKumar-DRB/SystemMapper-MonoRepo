import { RiskAnalysisInput, StrategyContext } from '../types';

export interface IRiskStrategy<TResult> {
  readonly name: string;
  readonly description: string;
  analyze(input: RiskAnalysisInput, context: StrategyContext): TResult;
}
