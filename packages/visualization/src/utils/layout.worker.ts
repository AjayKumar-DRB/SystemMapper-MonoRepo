import { layoutHierarchicalGraph } from './layoutUtils';

self.onmessage = (e: MessageEvent) => {
  const { elements, layoutDir, collapsedNodesArray } = e.data;

  try {
    const collapsedNodes = new Set<string>(collapsedNodesArray);
    const layoutedElements = layoutHierarchicalGraph(elements, layoutDir, collapsedNodes);

    self.postMessage({ type: 'SUCCESS', layoutedElements });
  } catch (error: unknown) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
