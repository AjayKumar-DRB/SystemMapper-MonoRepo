import { IVcsProvider } from '../interfaces/vcs-provider.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockGithubProvider implements IVcsProvider {
  private readonly logger = new Logger(MockGithubProvider.name);

  // In-memory store for mocked comments
  private mockComments: Array<{ id: string; body: string; user: string; prNumber: number }> = [];
  private commentIdCounter = 1;

  async generateInstallationToken(installationId: string): Promise<string> {
    this.logger.debug(`[MOCK] Generating token for installation ${installationId}`);
    return 'mock-token-123';
  }

  async verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string,
  ): Promise<boolean> {
    this.logger.debug(`[MOCK] Verifying webhook signature`);
    return true; // Always valid in mock mode
  }

  async fetchFileTree(
    owner: string,
    repo: string,
    sha: string,
    _token: string,
  ): Promise<unknown[]> {
    this.logger.debug(`[MOCK] Fetching file tree for ${owner}/${repo}@${sha}`);
    return [];
  }

  async fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    _token: string,
  ): Promise<string> {
    this.logger.debug(`[MOCK] Fetching file content for ${owner}/${repo}/${path}@${sha}`);
    return `// Mock content for ${path}`;
  }

  async postPullRequestComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    _token: string,
  ): Promise<string> {
    this.logger.debug(`[MOCK] Posting PR comment to ${owner}/${repo}#${prNumber}`);
    const id = (this.commentIdCounter++).toString();
    this.mockComments.push({
      id,
      body,
      user: 'systemmapper-bot',
      prNumber,
    });
    return id;
  }

  async updatePullRequestComment(
    owner: string,
    repo: string,
    commentId: string,
    body: string,
    _token: string,
  ): Promise<void> {
    this.logger.debug(`[MOCK] Updating PR comment ${commentId} in ${owner}/${repo}`);
    const comment = this.mockComments.find((c) => c.id === commentId);
    if (comment) {
      comment.body = body;
    }
  }

  async getPullRequestComments(
    owner: string,
    repo: string,
    prNumber: number,
    _token: string,
  ): Promise<Array<{ id: string; body: string; user: string }>> {
    this.logger.debug(`[MOCK] Fetching comments for PR ${owner}/${repo}#${prNumber}`);
    return this.mockComments.filter((c) => c.prNumber === prNumber);
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number,
    _token: string,
  ): Promise<
    Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      previous_filename?: string;
    }>
  > {
    this.logger.debug(`[MOCK] Fetching files for PR ${owner}/${repo}#${prNumber}`);
    // Mock changed files for testing
    return [
      {
        filename: 'src/services/user.service.ts',
        status: 'modified',
        additions: 15,
        deletions: 2,
      },
      {
        filename: 'src/controllers/user.controller.ts',
        status: 'modified',
        additions: 5,
        deletions: 0,
      },
    ];
  }
}
