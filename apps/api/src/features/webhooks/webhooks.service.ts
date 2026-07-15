import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { GithubProvider } from '@systemmapper/vcs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueNames } from '@systemmapper/types';

// GitHub webhook payload shapes
interface GithubRepository {
  id: number;
  full_name: string;
  default_branch: string;
}

interface GithubInstallation {
  id: number;
}

interface GithubPushPayload {
  ref: string;
  after: string;
  repository: GithubRepository;
  installation: GithubInstallation;
}

interface GithubPullRequest {
  number: number;
  head: { sha: string };
}

interface GithubPullRequestPayload {
  action: string;
  pull_request: GithubPullRequest;
  repository: GithubRepository;
  installation: GithubInstallation;
}

type GithubWebhookPayload =
  GithubPushPayload | GithubPullRequestPayload | Record<string, unknown>;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private githubProvider: GithubProvider;

  constructor(
    @InjectQueue(QueueNames.SCAN) private readonly scanQueue: Queue,
    @InjectQueue(QueueNames.BLAST_RADIUS)
    private readonly blastRadiusQueue: Queue,
  ) {
    this.githubProvider = new GithubProvider(
      process.env.GITHUB_APP_ID ?? '',
      process.env.GITHUB_PRIVATE_KEY ?? '',
    );
  }

  async handleGithubWebhook(
    signature: string,
    event: string,
    payload: GithubWebhookPayload,
    rawBody: Buffer,
  ): Promise<{ status: string }> {
    const secret = process.env.GITHUB_WEBHOOK_SECRET ?? '';

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
        await this.handlePushEvent(payload as GithubPushPayload);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(payload as GithubPullRequestPayload);
        break;
      default:
        this.logger.debug(`Ignoring unhandled event type: ${event}`);
    }

    return { status: 'ok' };
  }

  private async handlePushEvent(payload: GithubPushPayload): Promise<void> {
    if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) {
      this.logger.debug('Push event ignored: Not default branch');
      return;
    }

    this.logger.log(
      `Queueing full scan for repository: ${payload.repository.full_name}`,
    );
    await this.scanQueue.add('repository-scan', {
      repositoryId: payload.repository.id.toString(),
      vcsRepoId: payload.repository.id.toString(),
      installationId: payload.installation.id.toString(),
      commitSha: payload.after,
      triggerType: 'webhook_push',
    });
  }

  private async handlePullRequestEvent(
    payload: GithubPullRequestPayload,
  ): Promise<void> {
    if (payload.action !== 'opened' && payload.action !== 'synchronize') {
      return;
    }

    this.logger.log(
      `Queueing blast radius analysis for PR #${payload.pull_request.number.toString()}`,
    );
    await this.blastRadiusQueue.add('blast-radius-analysis', {
      repositoryId: payload.repository.id.toString(),
      vcsRepoId: payload.repository.id.toString(),
      installationId: payload.installation.id.toString(),
      prNumber: payload.pull_request.number,
      headSha: payload.pull_request.head.sha,
    });
  }
}
