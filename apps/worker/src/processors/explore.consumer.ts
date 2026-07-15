import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { QueueNames } from '@systemmapper/types';
import { Logger } from '@nestjs/common';
import { GithubProvider } from '@systemmapper/vcs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface ExploreJobData {
  repositoryId: string;
  url: string;
  branch?: string;
}

interface ExploreJobResult {
  repositoryId: string;
  filesProcessed: number;
  branches: string[];
}

@Processor(QueueNames.SCAN)
export class ExploreConsumer extends WorkerHost {
  private readonly logger = new Logger(ExploreConsumer.name);
  private readonly githubProvider: GithubProvider;

  /** Directories to skip during analysis */
  private readonly SKIP_DIRS = [
    '.git',
    'node_modules',
    'coverage',
    'dist',
    'build',
    'out',
    '.cache',
    'tmp',
    'temp',
    '.next',
    '.nuxt',
    '.output',
    '.svelte-kit',
    '.astro',
    '.docusaurus',
    '.vuepress',
    '.serverless',
    'storybook-static',
    '.turbo',
    '.nx',
  ];

  constructor(
    @InjectQueue(QueueNames.PARSE) private readonly parseQueue: Queue,
  ) {
    super();
    this.githubProvider = new GithubProvider('', '');
  }

  async process(
    job: Job<ExploreJobData>,
  ): Promise<ExploreJobResult | undefined> {
    if (job.name !== 'repository-explore') {
      return undefined;
    }

    const { repositoryId, url, branch: requestedBranch } = job.data;

    if (!repositoryId || !url) {
      const errMsg = `Explore job ${job.id ?? 'unknown'} missing repositoryId or url.`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }

    this.logger.log(
      `Processing explore job ${job.id ?? 'unknown'} for ${repositoryId} (URL: ${url})`,
    );

    const urlParts = new URL(url).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) {
      throw new Error(
        'Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}',
      );
    }
    const owner = urlParts[0];
    const repo = urlParts[1];
    const token = process.env.GITHUB_TOKEN ?? undefined;

    const tempDir = path.join(
      os.tmpdir(),
      `systemmapper_${job.id ?? 'unknown'}_${Date.now().toString()}`,
    );
    this.logger.log(`Created temp directory: ${tempDir}`);

    try {
      await fs.mkdir(tempDir, { recursive: true });

      await job.updateProgress({ stage: 'cloning_repository', percent: 10 });
      this.logger.log(`Cloning ${owner}/${repo} into ${tempDir}...`);

      const { branches } = await this.githubProvider.cloneRepository(
        owner,
        repo,
        tempDir,
        {
          branch: requestedBranch,
          depth: 1,
          token,
        },
      );

      this.logger.log(`Clone complete. Found branches: ${branches.join(', ')}`);
      await job.updateProgress({
        stage: 'clone_complete',
        percent: 30,
        branches,
      });

      const branchesToProcess = requestedBranch
        ? [requestedBranch]
        : [branches[0] ?? 'main'];

      await job.updateProgress({ stage: 'scanning_files', percent: 40 });
      const allFiles = await this.crawlDirectory(tempDir);
      const parseableFiles = allFiles.filter((f) => this.isParseableFile(f));

      this.logger.log(
        `Found ${parseableFiles.length.toString()} parseable files to process.`,
      );

      const MAX_BATCH_SIZE = 300;
      const fileContents: { filePath: string; content: string }[] = [];

      let fileIndex = 0;
      for (const filePath of parseableFiles) {
        const percent =
          40 + Math.floor((fileIndex / parseableFiles.length) * 40);
        if (fileIndex % 50 === 0) {
          await job.updateProgress({ stage: 'reading_files', percent });
        }

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const relativePath = path
            .relative(tempDir, filePath)
            .replace(/\\/g, '/');
          fileContents.push({ filePath: relativePath, content });
        } catch (fileErr: unknown) {
          const message =
            fileErr instanceof Error ? fileErr.message : String(fileErr);
          this.logger.warn(`Failed to read file ${filePath}: ${message}`);
        }
        fileIndex++;
      }

      const allFilePaths = fileContents.map((f) => f.filePath);
      const batches: { filePath: string; content: string }[][] = [];

      for (let i = 0; i < fileContents.length; i += MAX_BATCH_SIZE) {
        batches.push(fileContents.slice(i, i + MAX_BATCH_SIZE));
      }

      this.logger.log(
        `Dispatching ${batches.length.toString()} batch parse job(s) covering ${fileContents.length.toString()} files.`,
      );

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const percent = 80 + Math.floor((batchIdx / batches.length) * 15);
        await job.updateProgress({ stage: 'dispatching_parse_jobs', percent });

        await this.parseQueue.add('repository-parse', {
          repositoryId,
          scanId: `explore_${job.id ?? 'unknown'}`,
          files: batches[batchIdx],
          allFilePaths,
          branch: branchesToProcess[0],
        });
      }

      await job.updateProgress({ stage: 'completed', percent: 100 });
      this.logger.log(
        `Explore job ${job.id ?? 'unknown'} complete. Dispatched ${batches.length.toString()} parse batch(es).`,
      );

      return { repositoryId, filesProcessed: fileContents.length, branches };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const errMsg = `Failed to explore repo ${url}: ${message}`;
      this.logger.error(errMsg, stack);
      throw new Error(errMsg);
    } finally {
      this.logger.log(`Cleaning up temp directory: ${tempDir}`);
      await fs
        .rm(tempDir, { recursive: true, force: true })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to clean up temp dir ${tempDir}: ${message}`,
          );
        });
    }
  }

  /**
   * Recursively walk a directory and return all file paths.
   */
  private async crawlDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (this.SKIP_DIRS.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.crawlDirectory(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private isParseableFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.java',
      '.go',
      '.cs',
      '.cpp',
      '.c',
      '.h',
    ].includes(ext);
  }
}
