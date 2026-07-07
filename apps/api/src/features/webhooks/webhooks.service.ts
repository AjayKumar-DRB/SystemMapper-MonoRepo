import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { GithubProvider } from '@systemmapper/vcs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueNames } from '@systemmapper/types';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private githubProvider: GithubProvider;

  constructor(
    @InjectQueue(QueueNames.SCAN) private readonly scanQueue: Queue,
    @InjectQueue(QueueNames.BLAST_RADIUS) private readonly blastRadiusQueue: Queue,
  ) {
    // In a real app, appId and privateKey would be injected via ConfigService
    this.githubProvider = new GithubProvider(
      process.env.GITHUB_APP_ID || '',
      process.env.GITHUB_PRIVATE_KEY || '',
    );
  }

  async handleGithubWebhook(
    signature: string,
    event: string,
    payload: any,
    rawBody: Buffer,
  ): Promise<{ status: string }> {
    const secret = process.env.GITHUB_WEBHOOK_SECRET || '';

    // 1. Verify Signature
    const isValid = await this.githubProvider.verifyWebhookSignature(
      rawBody.toString('utf8'),
      signature,
      secret,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Route Event
    this.logger.log(`Received verified GitHub event: ${event}`);

    switch (event) {
      case 'push':
        await this.handlePushEvent(payload);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;
      default:
        this.logger.debug(`Ignoring unhandled event type: ${event}`);
    }

    return { status: 'ok' };
  }

  private async handlePushEvent(payload: any) {
    if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) {
      this.logger.debug('Push event ignored: Not default branch');
      return;
    }

    this.logger.log(`Queueing full scan for repository: ${payload.repository.full_name}`);
    await this.scanQueue.add('repository-scan', {
      repositoryId: payload.repository.id.toString(), // Needs mapping to internal DB ID eventually
      vcsRepoId: payload.repository.id.toString(),
      installationId: payload.installation.id.toString(),
      commitSha: payload.after,
      triggerType: 'webhook_push',
    });
  }

  private async handlePullRequestEvent(payload: any) {
    if (payload.action !== 'opened' && payload.action !== 'synchronize') {
      return;
    }

    this.logger.log(`Queueing blast radius analysis for PR #${payload.pull_request.number}`);
    await this.blastRadiusQueue.add('blast-radius-analysis', {
      repositoryId: payload.repository.id.toString(),
      vcsRepoId: payload.repository.id.toString(),
      installationId: payload.installation.id.toString(),
      prNumber: payload.pull_request.number,
      headSha: payload.pull_request.head.sha,
    });
  }
}
