import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { QueueNames } from '@systemmapper/types';
import { Logger } from '@nestjs/common';
import { GithubProvider } from '@systemmapper/vcs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

@Processor(QueueNames.SCAN)
export class ExploreConsumer extends WorkerHost {
  private readonly logger = new Logger(ExploreConsumer.name);
  private readonly githubProvider: GithubProvider;

  /** Directories to skip during analysis */
  private readonly SKIP_DIRS = [
    // Standard ignores
    '.git',
    'node_modules',
    'coverage',
    
    // Generic build outputs
    'dist',
    'build',
    'out',
    '.cache',
    'tmp',
    'temp',

    // Framework specific
    '.next',         // Next.js
    '.nuxt',         // Nuxt
    '.output',       // Nitro / Nuxt
    '.svelte-kit',   // SvelteKit
    '.astro',        // Astro
    '.docusaurus',   // Docusaurus
    '.vuepress',     // VuePress
    '.serverless',   // Serverless Framework
    'storybook-static', // Storybook

    // Monorepo specific
    '.turbo',        // Turborepo
    '.nx',           // Nx
  ];

  constructor(
    @InjectQueue(QueueNames.PARSE) private readonly parseQueue: Queue,
  ) {
    super();
    this.githubProvider = new GithubProvider('', '');
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name !== 'repository-explore') {
      return;
    }

    const { repositoryId, url, branch: requestedBranch } = job.data;

    if (!repositoryId || !url) {
      const errMsg = `Explore job ${job.id} missing repositoryId or url.`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }

    this.logger.log(`Processing explore job ${job.id} for ${repositoryId} (URL: ${url})`);

    const urlParts = new URL(url).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) {
      throw new Error('Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}');
    }
    const owner = urlParts[0];
    const repo = urlParts[1];
    const token = process.env.GITHUB_TOKEN || undefined;

    // Create a unique temp directory for this job
    const tempDir = path.join(os.tmpdir(), `systemmapper_${job.id}_${Date.now()}`);
    this.logger.log(`Created temp directory: ${tempDir}`);

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Stage 1: Clone repository (shallow, all branches)
      await job.updateProgress({ stage: 'cloning_repository', percent: 10 });
      this.logger.log(`Cloning ${owner}/${repo} into ${tempDir}...`);

      const { branches } = await this.githubProvider.cloneRepository(owner, repo, tempDir, {
        branch: requestedBranch,
        depth: 1,
        token,
      });

      this.logger.log(`Clone complete. Found branches: ${branches.join(', ')}`);
      await job.updateProgress({ stage: 'clone_complete', percent: 30, branches });

      // Stage 2: Determine which branches to process
      // For now, process only the checked-out (default/requested) branch
      // to keep jobs fast. Multi-branch can be a future enhancement.
      const branchesToProcess = requestedBranch ? [requestedBranch] : [branches[0] || 'main'];

      // Stage 2: Crawl files and build file content map
      await job.updateProgress({ stage: 'scanning_files', percent: 40 });
      const allFiles = await this.crawlDirectory(tempDir);
      const parseableFiles = allFiles.filter(f => this.isParseableFile(f));

      this.logger.log(`Found ${parseableFiles.length} parseable files to process.`);

      // Read all file contents into memory (with size guard)
      const MAX_BATCH_SIZE = 300;
      const fileContents: { filePath: string; content: string }[] = [];
      
      let fileIndex = 0;
      for (const filePath of parseableFiles) {
        const percent = 40 + Math.floor((fileIndex / parseableFiles.length) * 40);
        if (fileIndex % 50 === 0) {
          await job.updateProgress({ stage: 'reading_files', percent });
        }
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const relativePath = path.relative(tempDir, filePath).replace(/\\/g, '/');
          fileContents.push({ filePath: relativePath, content });
        } catch (fileErr: any) {
          this.logger.warn(`Failed to read file ${filePath}: ${fileErr.message}`);
        }
        fileIndex++;
      }

      // Dispatch in batches — each batch gets the FULL list of all file paths
      // so the import resolver can resolve cross-file imports correctly
      const allFilePaths = fileContents.map(f => f.filePath);
      const batches: { filePath: string; content: string }[][] = [];
      
      for (let i = 0; i < fileContents.length; i += MAX_BATCH_SIZE) {
        batches.push(fileContents.slice(i, i + MAX_BATCH_SIZE));
      }

      this.logger.log(`Dispatching ${batches.length} batch parse job(s) covering ${fileContents.length} files.`);

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const percent = 80 + Math.floor((batchIdx / batches.length) * 15);
        await job.updateProgress({ stage: 'dispatching_parse_jobs', percent });

        await this.parseQueue.add('repository-parse', {
          repositoryId,
          scanId: `explore_${job.id}`,
          files: batches[batchIdx],       // array of {filePath, content}
          allFilePaths,                   // full list for import resolution
          branch: branchesToProcess[0],
        });
      }

      await job.updateProgress({ stage: 'completed', percent: 100 });
      this.logger.log(`Explore job ${job.id} complete. Dispatched ${batches.length} parse batch(es).`);

      return { repositoryId, filesProcessed: fileContents.length, branches };
    } catch (error: any) {
      const errMsg = `Failed to explore repo ${url}: ${error.message}`;
      this.logger.error(errMsg, error.stack);
      throw new Error(errMsg);
    } finally {
      // Always clean up the temp directory
      this.logger.log(`Cleaning up temp directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err => {
        this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${err.message}`);
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
      // Skip unwanted directories
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
    return ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.cs', '.cpp', '.c', '.h'].includes(ext);
  }
}
