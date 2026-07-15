import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueNames, ParsedFile } from '@systemmapper/types';
import { LanguageRegistry } from '@systemmapper/parser';
import { GraphSynchronizer } from '@systemmapper/graph';
import { Logger } from '@nestjs/common';

interface FileEntry {
  filePath: string;
  content: string;
}

interface ParserJobData {
  repositoryId: string;
  scanId: string;
  branch?: string;
  files?: FileEntry[];
  filePath?: string;
  content?: string;
  allFilePaths?: string[];
}

@Processor(QueueNames.PARSE)
export class ParserConsumer extends WorkerHost {
  private readonly logger = new Logger(ParserConsumer.name);
  private readonly registry = new LanguageRegistry();
  private readonly graphSynchronizer = new GraphSynchronizer();

  async process(job: Job<ParserJobData>): Promise<ParsedFile[]> {
    const { repositoryId, scanId, branch } = job.data;

    // Support new batched format: { files: [{filePath, content}], allFilePaths }
    // Also support legacy single-file format for backwards compatibility
    const filesToProcess: FileEntry[] = job.data.files ?? [
      {
        filePath: job.data.filePath ?? '',
        content: job.data.content ?? '',
      },
    ];

    // allFilePaths is the full repository file list for cross-file import resolution
    const allFilePaths: string[] =
      job.data.allFilePaths ?? filesToProcess.map((f) => f.filePath);

    if (!filesToProcess.length) {
      this.logger.warn(`Job ${job.id ?? 'unknown'} had no files to process.`);
      return [];
    }

    this.logger.log(
      `Processing parse job ${job.id ?? 'unknown'} for ${repositoryId}: ${filesToProcess.length.toString()} file(s) in batch (branch: ${branch ?? 'default'})`,
    );

    const parsedFiles: ParsedFile[] = [];

    for (const { filePath, content } of filesToProcess) {
      if (!filePath || !content) {
        this.logger.warn(
          `Skipping file with missing filePath or content in job ${job.id ?? 'unknown'}`,
        );
        continue;
      }

      const language = this.registry.detectLanguage(filePath);
      const parser = this.registry.getParser(language);
      if (!parser) {
        this.logger.debug(
          `No parser for ${filePath} (language: ${language}), skipping.`,
        );
        continue;
      }

      try {
        const ir = parser.parse(filePath, content);
        parsedFiles.push(ir);
        this.logger.debug(
          `Parsed ${filePath}: ${ir.classes.length.toString()} classes, ${ir.functions.length.toString()} functions, ${ir.imports.length.toString()} imports`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to parse ${filePath}: ${message}`);
        // Don't throw — continue processing remaining files in the batch
      }
    }

    if (parsedFiles.length === 0) {
      this.logger.warn(
        `No files were successfully parsed in job ${job.id ?? 'unknown'}`,
      );
      return [];
    }

    this.logger.log(
      `Successfully parsed ${parsedFiles.length.toString()}/${filesToProcess.length.toString()} files. Writing to Memgraph...`,
    );

    try {
      await this.graphSynchronizer.fullSync(
        repositoryId,
        parsedFiles,
        scanId,
        branch,
        allFilePaths,
      );
      this.logger.log(
        `Successfully persisted batch of ${parsedFiles.length.toString()} files to Memgraph.`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to sync batch to Memgraph: ${message}`, stack);
      throw error;
    }

    return parsedFiles;
  }
}
