import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueNames } from '@systemmapper/types';
import { TraversalGraphRepository } from '@systemmapper/graph';

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);
  private readonly traversalRepo = new TraversalGraphRepository();

  constructor(
    @InjectQueue(QueueNames.SCAN) private readonly scanQueue: Queue,
  ) {}

  async getRepositoryGraph(repositoryId: string, branch?: string, view: 'project' | 'component' = 'project', folderId?: string) {
    this.logger.debug(`Fetching visualization graph for repo: ${repositoryId}, branch: ${branch || 'all'}, view: ${view}, folderId: ${folderId || 'none'}`);
    
    // 1. Fetch raw graph from Memgraph
    // If folderId is specified (drill-down mode), use subtree query
    const rawGraph = folderId
      ? await this.traversalRepo.getSubtreeGraph(repositoryId, folderId, branch)
      : await this.traversalRepo.getFullGraph(repositoryId, branch);
    
    // 2. Pre-process IDs
    const idMap = new Map<string, string>();
    rawGraph.nodes.forEach((node: any) => {
      idMap.set(node.identity.toString(), node.properties.nodeId);
    });

    // 3. Map GenericGraphModel to Cytoscape Elements
    const elements: any[] = [];
    
    // Process Nodes
    const fileToFolderMap = new Map<string, string>();

    rawGraph.nodes.forEach((node: any) => {
      const labels = node.labels || [];
      const props = node.properties || {};
      const nodeId = props.nodeId || node.identity?.toString();
      
      // Always include Folders in both views
      if (labels.includes('Folder') || labels.includes('Directory')) {
        elements.push({
          data: {
            id: nodeId,
            label: props.name,
            type: 'folder',
            branch: props.branch,
          }
        });
      } 
      else if (labels.includes('File')) {
        const filePath = props.filePath || '';
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        let parentFolderId: string | undefined = undefined;
        
        if (dirPath && dirPath !== '') {
           parentFolderId = `${repositoryId}:${branch || 'default'}:Folder:${dirPath}`;
           fileToFolderMap.set(nodeId, parentFolderId);
        }

        if (view === 'component') {
          elements.push({
            data: {
              id: nodeId,
              label: props.fileName || filePath || nodeId,
              type: 'file',
              language: props.language,
              branch: props.branch,
              filePath: filePath,
              parent: parentFolderId, // Links to compound node!
            }
          });
        }
      } 
      else if (labels.includes('External') && view === 'project') {
        elements.push({
          data: {
            id: nodeId,
            label: props.name || nodeId,
            type: 'external',
          }
        });
      }
    });

    // Process Edges
    const projectFolderEdges = new Set<string>();

    rawGraph.edges.forEach((edge: any) => {
      const props = edge.properties || {};
      const edgeId = edge.identity?.toString() || `${edge.start?.toString()}-${edge.type}-${edge.end?.toString()}`;
      const sourceId = idMap.get(edge.start?.toString()) || edge.start?.toString();
      const targetId = idMap.get(edge.end?.toString()) || edge.end?.toString();

      if (view === 'component') {
        // Only show direct IMPORTS between files
        if (edge.type === 'IMPORTS') {
          elements.push({
            data: {
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: edge.type,
            }
          });
        }
      } else if (view === 'project') {
        // Show hierarchy
        if (edge.type === 'CONTAINS') {
          elements.push({
            data: {
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: edge.type,
            }
          });
        }
        
        // Roll up IMPORTS between files to their respective folders
        if (edge.type === 'IMPORTS') {
          const sourceFolderId = fileToFolderMap.get(sourceId);
          const targetFolderId = fileToFolderMap.get(targetId);
          
          if (sourceFolderId && targetFolderId && sourceFolderId !== targetFolderId) {
            const folderEdgeId = `rolled-up-${sourceFolderId}-IMPORTS-${targetFolderId}`;
            if (!projectFolderEdges.has(folderEdgeId)) {
              projectFolderEdges.add(folderEdgeId);
              elements.push({
                data: {
                  id: folderEdgeId,
                  source: sourceFolderId,
                  target: targetFolderId,
                  type: 'IMPORTS',
                }
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
    this.logger.log(`Dispatching explore job for URL: ${repoUrl}${branch ? ` (branch: ${branch})` : ''}`);
    
    // Generate a temporary unique ID for this exploration
    const repositoryId = `explore_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const job = await this.scanQueue.add('repository-explore', {
      repositoryId,
      url: repoUrl,
      branch,
      triggerType: 'explore',
    });

    return job.id!;
  }

  async getExploreJobStatus(jobId: string) {
    const job = await this.scanQueue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;
    
    // If completed, return the repositoryId so frontend can load it
    let repositoryId = null;
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
