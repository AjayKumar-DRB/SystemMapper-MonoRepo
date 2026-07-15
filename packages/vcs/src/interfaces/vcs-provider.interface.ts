export interface IVcsProvider {
  /**
   * Generates a short-lived installation token for background API access.
   */
  generateInstallationToken(installationId: string): Promise<string>;

  /**
   * Verifies the cryptographic signature of an incoming webhook.
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean>;

  /**
   * Fetches the entire file tree for a given commit SHA.
   */
  fetchFileTree(owner: string, repo: string, sha: string, token?: string): Promise<unknown[]>;

  /**
   * Fetches the raw content of a specific file.
   */
  fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    token: string,
  ): Promise<string>;

  /**
   * Posts a new comment on a pull request.
   */
  postPullRequestComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    token: string,
  ): Promise<string>;

  /**
   * Updates an existing comment on a pull request.
   */
  updatePullRequestComment(
    owner: string,
    repo: string,
    commentId: string,
    body: string,
    token: string,
  ): Promise<void>;

  /**
   * Fetches existing comments on a pull request.
   */
  getPullRequestComments(
    owner: string,
    repo: string,
    prNumber: number,
    token: string,
  ): Promise<Array<{ id: string; body: string; user: string }>>;

  /**
   * Fetches the list of files modified in a pull request.
   */
  getPullRequestFiles(
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
  >;
}
