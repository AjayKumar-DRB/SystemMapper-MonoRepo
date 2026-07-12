import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueNames } from '@systemmapper/types';
import { TraversalGraphRepository } from '@systemmapper/graph';
import {
  RiskEngine,
  BlastRadiusStrategy,
  DependencyAnalysisStrategy,
  CircularDependencyStrategy,
  ArchitectureViolationStrategy,
  CriticalPathStrategy,
  RiskScoringStrategy,
} from '@systemmapper/risk-engine';
import { MockGithubProvider, MarkdownGenerator } from '@systemmapper/vcs';
import { Logger } from '@nestjs/common';

@Processor(QueueNames.BLAST_RADIUS)
export class BlastRadiusConsumer extends WorkerHost {
  private readonly logger = new Logger(BlastRadiusConsumer.name);
  private readonly traversalRepo = new TraversalGraphRepository();
  // Using mock provider as requested for MVP
  private readonly githubProvider = new MockGithubProvider();

  async process(job: Job<any, any, string>): Promise<void> {
    const { repositoryId, installationId, prNumber, headSha } = job.data;
    this.logger.log(
      `Processing Blast Radius job for Repo: ${repositoryId}, PR: #${prNumber}`,
    );

    try {
      // 1. Get Installation Token
      const token =
        await this.githubProvider.generateInstallationToken(installationId);
      // Dummy owner/repo since we don't have them in the payload yet
      const owner = 'owner';
      const repo = 'repo';

      // 2. Fetch modified files in the PR
      this.logger.debug(`Fetching changed files for PR #${prNumber}`);
      const prFiles = await this.githubProvider.getPullRequestFiles(
        owner,
        repo,
        prNumber,
        token,
      );

      const changedFiles = prFiles.map((f: any) => ({
        filePath: f.filename,
        status: f.status as any,
        additions: f.additions,
        deletions: f.deletions,
        previousPath: f.previous_filename,
      }));

      // 3. Fetch full graph from Memgraph
      this.logger.debug(
        `Fetching full graph state from Memgraph for Repo: ${repositoryId}`,
      );
      const rawGraph = await this.traversalRepo.getFullGraph(repositoryId);

      // 4. Run Risk Engine
      this.logger.debug(`Executing Risk Engine Analysis`);
      const engine = new RiskEngine([
        new BlastRadiusStrategy(),
        new DependencyAnalysisStrategy(),
        new CircularDependencyStrategy(),
        new ArchitectureViolationStrategy(),
        new CriticalPathStrategy(),
        new RiskScoringStrategy(),
      ]);

      const report = engine.analyze({
        repositoryId,
        changedFiles,
        dependencyGraph: rawGraph,
        options: {
          maxTraversalDepth: 5,
          decayFactor: 0.7,
          criticalFilePatterns: [],
          architectureRules: [], // Can be populated from config later
        },
      });

      this.logger.log(
        `Analysis complete! Score: ${report.riskScore} (${report.riskLevel})`,
      );

      // 5. Generate Markdown
      const markdownBody = MarkdownGenerator.generateBlastRadiusComment(report);

      // 6. Check for existing comment and Post/Update
      this.logger.debug(
        `Checking for existing SystemMapper comments on PR #${prNumber}`,
      );
      const existingComments = await this.githubProvider.getPullRequestComments(
        owner,
        repo,
        prNumber,
        token,
      );

      // Look for a comment made by our bot
      const botComment = existingComments.find(
        (c: any) =>
          c.user === 'systemmapper-bot' ||
          c.body.includes('SystemMapper — Blast Radius Analysis'),
      );

      if (botComment) {
        this.logger.log(`Updating existing PR comment ID: ${botComment.id}`);
        await this.githubProvider.updatePullRequestComment(
          owner,
          repo,
          botComment.id,
          markdownBody,
          token,
        );
      } else {
        this.logger.log(`Posting new PR comment`);
        const commentId = await this.githubProvider.postPullRequestComment(
          owner,
          repo,
          prNumber,
          markdownBody,
          token,
        );
        this.logger.log(`Comment posted! ID: ${commentId}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process Blast Radius for PR #${prNumber}: ${error.message}`,
      );
      throw error;
    }
  }
}
