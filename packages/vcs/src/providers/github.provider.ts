import { IVcsProvider } from '../interfaces/vcs-provider.interface';
import { Injectable } from '@nestjs/common';
import * as git from 'isomorphic-git';
import * as http from 'isomorphic-git/http/node';
import * as fs from 'fs';

/**
 * GithubProvider uses dynamic imports for @octokit/* packages because
 * they are pure ESM modules and cannot be statically required() in CommonJS.
 * Dynamic import() works from both CJS and ESM contexts.
 */
@Injectable()
export class GithubProvider implements IVcsProvider {
  constructor(
    private readonly appId: string,
    private readonly privateKey: string,
  ) {}

  async generateInstallationToken(installationId: string): Promise<string> {
    const { createAppAuth } = await import('@octokit/auth-app');
    const auth = createAppAuth({
      appId: this.appId,
      privateKey: this.privateKey,
    });

    const installationAuthentication = await auth({
      type: 'installation',
      installationId: parseInt(installationId, 10),
    });

    return installationAuthentication.token;
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - @octokit/webhooks-methods is ESM-only; dynamic import works at runtime
    const { verify } = await import('@octokit/webhooks-methods');
    return verify(secret, payload, signature);
  }

  async fetchFileTree(owner: string, repo: string, sha: string, token?: string): Promise<unknown[]> {
    const { Octokit } = await import('@octokit/rest');
    const octokit = token ? new Octokit({ auth: token }) : new Octokit();
    const response = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: sha,
      recursive: 'true',
    });
    return response.data.tree;
  }

  async fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    token?: string,
  ): Promise<string> {
    const { Octokit } = await import('@octokit/rest');
    const octokit = token ? new Octokit({ auth: token }) : new Octokit();
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: sha,
    });

    if (Array.isArray(response.data) || response.data.type !== 'file') {
      throw new Error('Requested path is not a single file');
    }

    if (!('content' in response.data)) {
      throw new Error('No content returned');
    }

    return Buffer.from(response.data.content, 'base64').toString('utf8');
  }

  async cloneRepository(
    owner: string,
    repo: string,
    destPath: string,
    options: { branch?: string; depth?: number; token?: string } = {},
  ): Promise<{ branches: string[] }> {
    const { branch, depth = 1, token } = options;
    const url = `https://github.com/${owner}/${repo}.git`;

    const onAuth = token ? () => ({ username: token, password: 'x-oauth-basic' }) : undefined;

    await git.clone({
      fs,
      http,
      dir: destPath,
      url,
      singleBranch: false,
      depth,
      noTags: true,
      ...(branch ? { ref: branch } : {}),
      ...(onAuth ? { onAuth } : {}),
    });

    // List all remote branches cached by the clone
    const branches = await git.listBranches({ fs, dir: destPath, remote: 'origin' });
    return { branches: branches.filter((b) => b !== 'HEAD') };
  }

  async checkoutBranch(dir: string, branch: string): Promise<void> {
    await git.checkout({ fs, dir, ref: branch });
  }

  async postPullRequestComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    token: string,
  ): Promise<string> {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });
    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    return response.data.id.toString();
  }

  async updatePullRequestComment(
    owner: string,
    repo: string,
    commentId: string,
    body: string,
    token: string,
  ): Promise<void> {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: parseInt(commentId, 10),
      body,
    });
  }

  async getPullRequestComments(
    owner: string,
    repo: string,
    prNumber: number,
    token: string,
  ): Promise<Array<{ id: string; body: string; user: string }>> {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });
    const response = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    return response.data.map((comment) => ({
      id: comment.id.toString(),
      body: comment.body || '',
      user: comment.user?.login || 'unknown',
    }));
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number,
    token: string,
  ): Promise<
    Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      previous_filename?: string;
    }>
  > {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    return response.data.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      previous_filename: file.previous_filename,
    }));
  }
}
