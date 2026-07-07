import { layoutHierarchicalGraph } from './layoutUtils';
import { ElementDefinition } from 'cytoscape';

self.onmessage = (e: MessageEvent) => {
  const { elements, layoutDir, collapsedNodesArray } = e.data;
  
  try {
    const collapsedNodes = new Set<string>(collapsedNodesArray);
    const layoutedElements = layoutHierarchicalGraph(elements, layoutDir, collapsedNodes);
    
    self.postMessage({ type: 'SUCCESS', layoutedElements });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', error: error.message });
  }
};
