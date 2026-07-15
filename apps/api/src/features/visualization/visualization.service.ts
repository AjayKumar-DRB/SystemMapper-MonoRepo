import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { QueueNames } from '@systemmapper/types';
import { TraversalGraphRepository } from '@systemmapper/graph';

// Represents a raw Neo4j/Memgraph node as returned by the driver
interface RawGraphNode {
  identity: { toString: () => string };
  labels: string[];
  properties: {
    nodeId?: string;
    name?: string;
    filePath?: string;
    fileName?: string;
    language?: string;
    branch?: string;
  };
}

// Represents a raw Neo4j/Memgraph relationship
interface RawGraphEdge {
  identity?: { toString: () => string };
  start?: { toString: () => string };
  end?: { toString: () => string };
  type: string;
  properties: Record<string, unknown>;
}

// The shape returned by traversal repo queries
interface RawGraph {
  nodes: RawGraphNode[];
  edges: RawGraphEdge[];
}

// A Cytoscape element (node or edge)
interface CytoscapeElement {
  data: Record<string, string | undefined>;
}

// The job data shape stored in the scan queue
interface ScanJobData {
  repositoryId: string;
  [key: string]: unknown;
}

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);
  private readonly traversalRepo = new TraversalGraphRepository();

  constructor(
    @InjectQueue(QueueNames.SCAN) private readonly scanQueue: Queue,
  ) {}

  async getRepositoryGraph(
    repositoryId: string,
    branch?: string,
    view: 'project' | 'component' = 'project',
    folderId?: string,
  ): Promise<CytoscapeElement[]> {
    this.logger.debug(
      `Fetching visualization graph for repo: ${repositoryId}, branch: ${branch ?? 'all'}, view: ${view}, folderId: ${folderId ?? 'none'}`,
    );

    // 1. Fetch raw graph from Memgraph
    const rawGraph = (
      folderId
        ? await this.traversalRepo.getSubtreeGraph(
            repositoryId,
            folderId,
            branch,
          )
        : await this.traversalRepo.getFullGraph(repositoryId, branch)
    ) as RawGraph;

    // 2. Pre-process IDs
    const idMap = new Map<string, string>();
    rawGraph.nodes.forEach((node: RawGraphNode) => {
      const nodeId = node.properties.nodeId ?? node.identity.toString();
      idMap.set(node.identity.toString(), nodeId);
    });

    // 3. Map GenericGraphModel to Cytoscape Elements
    const elements: CytoscapeElement[] = [];

    // Process Nodes
    const fileToFolderMap = new Map<string, string>();

    rawGraph.nodes.forEach((node: RawGraphNode) => {
      const labels = node.labels;
      const props = node.properties;
      const nodeId = props.nodeId ?? node.identity.toString();

      // Always include Folders in both views
      if (labels.includes('Folder') || labels.includes('Directory')) {
        elements.push({
          data: {
            id: nodeId,
            label: props.name,
            type: 'folder',
            branch: props.branch,
          },
        });
      } else if (labels.includes('File')) {
        const filePath = props.filePath ?? '';
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        let parentFolderId: string | undefined = undefined;

        if (dirPath !== '') {
          parentFolderId = `${repositoryId}:${branch ?? 'default'}:Folder:${dirPath}`;
          fileToFolderMap.set(nodeId, parentFolderId);
        }

        if (view === 'component') {
          elements.push({
            data: {
              id: nodeId,
              label: props.fileName ?? (filePath !== '' ? filePath : nodeId),
              type: 'file',
              language: props.language,
              branch: props.branch,
              filePath: filePath,
              parent: parentFolderId,
            },
          });
        }
      } else if (labels.includes('External') && view === 'project') {
        elements.push({
          data: {
            id: nodeId,
            label: props.name ?? nodeId,
            type: 'external',
          },
        });
      }
    });

    // Process Edges
    const projectFolderEdges = new Set<string>();

    rawGraph.edges.forEach((edge: RawGraphEdge) => {
      const edgeId =
        edge.identity?.toString() ??
        `${edge.start?.toString() ?? ''}-${edge.type}-${edge.end?.toString() ?? ''}`;
      const sourceId =
        idMap.get(edge.start?.toString() ?? '') ?? edge.start?.toString();
      const targetId =
        idMap.get(edge.end?.toString() ?? '') ?? edge.end?.toString();

      if (view === 'component') {
        if (edge.type === 'IMPORTS') {
          elements.push({
            data: {
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: edge.type,
            },
          });
        }
      } else {
        // project view
        if (edge.type === 'CONTAINS') {
          elements.push({
            data: {
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: edge.type,
            },
          });
        }

        if (edge.type === 'IMPORTS') {
          const sourceFolderId = sourceId
            ? fileToFolderMap.get(sourceId)
            : undefined;
          const targetFolderId = targetId
            ? fileToFolderMap.get(targetId)
            : undefined;

          if (
            sourceFolderId &&
            targetFolderId &&
            sourceFolderId !== targetFolderId
          ) {
            const folderEdgeId = `rolled-up-${sourceFolderId}-IMPORTS-${targetFolderId}`;
            if (!projectFolderEdges.has(folderEdgeId)) {
              projectFolderEdges.add(folderEdgeId);
              elements.push({
                data: {
                  id: folderEdgeId,
                  source: sourceFolderId,
                  target: targetFolderId,
                  type: 'IMPORTS',
                },
              });
            }
          }
        }
      }
    });

    return elements;
  }

  async getBranches(repositoryId: string): Promise<string[]> {
    this.logger.debug(`Fetching branches for repo: ${repositoryId}`);
    return this.traversalRepo.getBranches(repositoryId);
  }

  async dispatchExploreJob(repoUrl: string, branch?: string): Promise<string> {
    this.logger.log(
      `Dispatching explore job for URL: ${repoUrl}${branch ? ` (branch: ${branch})` : ''}`,
    );

    const repositoryId = `explore_${Date.now().toString()}_${Math.random().toString(36).substring(7)}`;

    const job = await this.scanQueue.add('repository-explore', {
      repositoryId,
      url: repoUrl,
      branch,
      triggerType: 'explore',
    });

    return job.id ?? repositoryId;
  }

  async getExploreJobStatus(jobId: string): Promise<{
    status: string;
    progress?: unknown;
    repositoryId?: string | null;
  }> {
    const job: Job<ScanJobData> | undefined =
      await this.scanQueue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    let repositoryId: string | null = null;
    if (state === 'completed') {
      repositoryId = job.data.repositoryId;
    }

    return {
      status: state,
      progress,
      repositoryId,
    };
  }
}
