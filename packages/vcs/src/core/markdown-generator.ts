import { RiskReport, Violation } from '@systemmapper/risk-engine';

export class MarkdownGenerator {
  static generateBlastRadiusComment(report: RiskReport): string {
    const {
      riskScore,
      riskLevel,
      blastRadius,
      circularDependencies,
      architectureViolations,
      criticalPath,
    } = report;

    const emoji = this.getRiskEmoji(riskLevel);

    let markdown = `## 🎯 SystemMapper — Blast Radius Analysis\n\n`;
    markdown += `### Risk Level: ${emoji} ${riskLevel} (Score: ${riskScore}/100)\n\n`;

    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Affected Files | ${blastRadius.affectedFiles.length} |\n`;
    markdown += `| Max Dependency Depth | ${blastRadius.maxDepth} |\n`;
    markdown += `| Circular Dependencies | ${circularDependencies.cycleCount} |\n`;
    markdown += `| Architecture Violations | ${architectureViolations.violationCount} |\n`;
    markdown += `| Touches Critical Path | ${criticalPath.isOnCriticalPath ? 'Yes ⚠️' : 'No'} |\n\n`;

    if (blastRadius.affectedFiles.length > 0) {
      markdown += `### Top Affected Files\n`;
      const topFiles = blastRadius.affectedFiles.slice(0, 10);
      topFiles.forEach((file: string, index: number) => {
        markdown += `${index + 1}. \`${file}\`\n`;
      });
      if (blastRadius.affectedFiles.length > 10) {
        markdown += `*...and ${blastRadius.affectedFiles.length - 10} more*\n`;
      }
      markdown += `\n`;
    }

    if (circularDependencies.cycleCount > 0) {
      markdown += `### 🔄 Circular Dependencies Detected!\n`;
      markdown += `This PR introduces or modifies files in circular dependency loops, which can cause unpredictable bugs and initialization issues.\n\n`;
    }

    if (architectureViolations.violationCount > 0) {
      markdown += `### 🏗️ Architecture Violations\n`;
      architectureViolations.violations.forEach((v: Violation) => {
        markdown += `- \`${v.sourceFile}\` ❌ imports \`${v.targetFile}\` (Rule: ${v.rule.type})\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n`;
    markdown += `*Powered by SystemMapper*`;

    return markdown;
  }

  private static getRiskEmoji(level: string): string {
    switch (level) {
      case 'LOW':
        return '🟢';
      case 'MEDIUM':
        return '🟡';
      case 'HIGH':
        return '🟠';
      case 'CRITICAL':
        return '🔴';
      default:
        return '⚪';
    }
  }
}
