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
import type {
  ChangedFile,
  DependencyGraphData,
} from '@systemmapper/risk-engine';
import { MockGithubProvider, MarkdownGenerator } from '@systemmapper/vcs';
import { Logger } from '@nestjs/common';

interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  previous_filename?: string;
}

interface PrComment {
  id: string;
  body: string;
  user: string;
}

interface BlastRadiusJobData {
  repositoryId: string;
  installationId: string;
  prNumber: number;
  headSha: string;
}

@Processor(QueueNames.BLAST_RADIUS)
export class BlastRadiusConsumer extends WorkerHost {
  private readonly logger = new Logger(BlastRadiusConsumer.name);
  private readonly traversalRepo = new TraversalGraphRepository();
  private readonly githubProvider = new MockGithubProvider();

  async process(job: Job<BlastRadiusJobData>): Promise<void> {
    const { repositoryId, installationId, prNumber } = job.data;
    this.logger.log(
      `Processing Blast Radius job for Repo: ${repositoryId}, PR: #${prNumber.toString()}`,
    );

    try {
      // 1. Get Installation Token
      const token =
        await this.githubProvider.generateInstallationToken(installationId);
      const owner = 'owner';
      const repo = 'repo';

      // 2. Fetch modified files in the PR
      this.logger.debug(
        `Fetching changed files for PR #${prNumber.toString()}`,
      );
      const prFiles = await this.githubProvider.getPullRequestFiles(
        owner,
        repo,
        prNumber,
        token,
      );

      const changedFiles: ChangedFile[] = (prFiles as PrFile[]).map((f) => ({
        filePath: f.filename,
        status: f.status as ChangedFile['status'],
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
        dependencyGraph: rawGraph as DependencyGraphData,
        options: {
          maxTraversalDepth: 5,
          decayFactor: 0.7,
          criticalFilePatterns: [],
          architectureRules: [],
        },
      });

      this.logger.log(
        `Analysis complete! Score: ${report.riskScore.toString()} (${report.riskLevel})`,
      );

      // 5. Generate Markdown
      const markdownBody = MarkdownGenerator.generateBlastRadiusComment(report);

      // 6. Check for existing comment and Post/Update
      this.logger.debug(
        `Checking for existing SystemMapper comments on PR #${prNumber.toString()}`,
      );
      const existingComments = await this.githubProvider.getPullRequestComments(
        owner,
        repo,
        prNumber,
        token,
      );

      const botComment = (existingComments as PrComment[]).find(
        (c) =>
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process Blast Radius for PR #${prNumber.toString()}: ${message}`,
      );
      throw error;
    }
  }
}
