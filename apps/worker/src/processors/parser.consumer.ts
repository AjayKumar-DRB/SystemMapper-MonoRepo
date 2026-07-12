import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueNames, ParsedFile } from '@systemmapper/types';
import { LanguageRegistry } from '@systemmapper/parser';
import { GraphSynchronizer } from '@systemmapper/graph';
import { Logger } from '@nestjs/common';

@Processor(QueueNames.PARSE)
export class ParserConsumer extends WorkerHost {
  private readonly logger = new Logger(ParserConsumer.name);
  private readonly registry = new LanguageRegistry();
  private readonly graphSynchronizer = new GraphSynchronizer();

  async process(job: Job<any, any, string>): Promise<ParsedFile[] | void> {
    const { repositoryId, scanId, branch } = job.data;

    // Support new batched format: { files: [{filePath, content}], allFilePaths }
    // Also support legacy single-file format for backwards compatibility
    const filesToProcess: { filePath: string; content: string }[] = job.data
      .files
      ? job.data.files
      : [{ filePath: job.data.filePath, content: job.data.content }];

    // allFilePaths is the full repository file list for cross-file import resolution
    const allFilePaths: string[] =
      job.data.allFilePaths || filesToProcess.map((f: any) => f.filePath);

    if (!filesToProcess.length) {
      this.logger.warn(`Job ${job.id} had no files to process.`);
      return;
    }

    this.logger.log(
      `Processing parse job ${job.id} for ${repositoryId}: ${filesToProcess.length} file(s) in batch (branch: ${branch || 'default'})`,
    );

    const parsedFiles: ParsedFile[] = [];

    for (const { filePath, content } of filesToProcess) {
      if (!filePath || !content) {
        this.logger.warn(
          `Skipping file with missing filePath or content in job ${job.id}`,
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
          `Parsed ${filePath}: ${ir.classes.length} classes, ${ir.functions.length} functions, ${ir.imports.length} imports`,
        );
      } catch (err: any) {
        this.logger.error(`Failed to parse ${filePath}: ${err.message}`);
        // Don't throw — continue processing remaining files in the batch
      }
    }

    if (parsedFiles.length === 0) {
      this.logger.warn(`No files were successfully parsed in job ${job.id}`);
      return;
    }

    this.logger.log(
      `Successfully parsed ${parsedFiles.length}/${filesToProcess.length} files. Writing to Memgraph...`,
    );

    try {
      // fullSync receives all parsed files + the complete repo file list for import resolution
      await this.graphSynchronizer.fullSync(
        repositoryId,
        parsedFiles,
        scanId,
        branch,
        allFilePaths,
      );
      this.logger.log(
        `Successfully persisted batch of ${parsedFiles.length} files to Memgraph.`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to sync batch to Memgraph: ${error.message}`,
        error.stack,
      );
      throw error;
    }

    return parsedFiles;
  }
}
