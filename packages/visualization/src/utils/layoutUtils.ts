import dagre from 'dagre';
import { ElementDefinition } from 'cytoscape';

/**
 * Builds a parent-child hierarchy map from the flat elements
 */
const buildHierarchy = (elements: ElementDefinition[]): Map<string, string[]> => {
  const hierarchy = new Map<string, string[]>();

  elements.forEach((edge) => {
    if (edge.data.source && edge.data.target && edge.data.type === 'CONTAINS') {
      const parent = edge.data.source;
      const child = edge.data.target;
      const children = hierarchy.get(parent) || [];
      children.push(child);
      hierarchy.set(parent, children);
    }
  });

  return hierarchy;
};

/**
 * Calculate the depth level of each node in the hierarchy
 */
const calculateNodeLevels = (
  elements: ElementDefinition[],
  hierarchy: Map<string, string[]>,
): Map<string, number> => {
  const levels = new Map<string, number>();

  // Find all children
  const allChildren = new Set<string>();
  for (const children of hierarchy.values()) {
    children.forEach((c) => allChildren.add(c));
  }

  // Roots are nodes that are not children
  const roots = elements
    .filter((el) => !el.data.source && !el.data.target)
    .filter((el) => !allChildren.has(el.data.id!));

  const calculateLevel = (nodeId: string, currentLevel: number) => {
    if (levels.has(nodeId) && levels.get(nodeId)! >= currentLevel) {
      return; // Already processed at this or deeper level
    }

    levels.set(nodeId, currentLevel);

    const children = hierarchy.get(nodeId) || [];
    children.forEach((childId) => {
      calculateLevel(childId, currentLevel + 1);
    });
  };

  roots.forEach((root) => calculateLevel(root.data.id!, 0));

  return levels;
};

/**
 * Traces a node to its top-level parent (project node)
 */
export const traceToRoot = (nodeId: string, elements: ElementDefinition[]): string[] => {
  const path: string[] = [nodeId];

  // Build child -> parent map
  const parentMap = new Map<string, string>();
  elements.forEach((edge) => {
    if (edge.data.source && edge.data.target && edge.data.type === 'CONTAINS') {
      parentMap.set(edge.data.target, edge.data.source);
    }
  });

  let currentId = nodeId;
  while (parentMap.has(currentId)) {
    const parentId = parentMap.get(currentId)!;
    path.unshift(parentId);
    currentId = parentId;
  }

  return path;
};

export const layoutHierarchicalGraph = (
  elements: ElementDefinition[],
  layoutDir: 'LR' | 'TB',
  collapsedNodes: Set<string>,
): ElementDefinition[] => {
  const nodes = elements.filter((el) => !el.data.source && !el.data.target);
  const edges = elements.filter((el) => el.data.source && el.data.target);

  const hierarchy = buildHierarchy(edges);
  const nodeLevels = calculateNodeLevels(nodes, hierarchy);

  // Determine which nodes should be visible
  const visibleNodeIds = new Set<string>();
  nodes.forEach((node) => {
    const path = traceToRoot(node.data.id!, elements);
    const hasCollapsedAncestor = path.some(
      (ancestorId) => ancestorId !== node.data.id && collapsedNodes.has(ancestorId),
    );

    if (!hasCollapsedAncestor) {
      visibleNodeIds.add(node.data.id!);
    }
  });

  const visibleNodes = nodes.filter((n) => visibleNodeIds.has(n.data.id!));

  // Create Dagre graph with STRICT ranking
  const dagreGraph = new dagre.graphlib.Graph({
    compound: false,
    multigraph: false,
  });

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: layoutDir,
    ranker: 'network-simplex', // Far more robust for large, cyclic codebases
    nodesep: 100, // Horizontal spacing between nodes
    ranksep: 150, // Vertical spacing between levels
    edgesep: 50,
    marginx: 60,
    marginy: 60,
  });

  // Add all visible nodes with rank constraint
  visibleNodes.forEach((node) => {
    const isFolder =
      node.data.type === 'folder' || node.data.type === 'directory' || node.data.type === 'project';
    const level = nodeLevels.get(node.data.id!) || 0;

    dagreGraph.setNode(node.data.id!, {
      label: node.data.label,
      width: 180,
      height: isFolder ? 60 : 50,
      // We explicitly DO NOT force rank here for network-simplex on massive cyclic graphs
      // rank: level,
    });
  });

  // Add structural edges to Dagre (CONTAINS)
  const containsEdges = edges.filter((e) => e.data.type === 'CONTAINS');
  containsEdges.forEach((edge) => {
    if (visibleNodeIds.has(edge.data.source!) && visibleNodeIds.has(edge.data.target!)) {
      try {
        dagreGraph.setEdge(edge.data.source!, edge.data.target!, { weight: 10 }); // Higher weight for structural edges
      } catch (err) {
        console.warn(`Failed to add structural edge:`, err);
      }
    }
  });

  // Filter and add functional edges
  const functionalEdges = edges.filter((e) => e.data.type !== 'CONTAINS');
  functionalEdges.forEach((edge) => {
    if (visibleNodeIds.has(edge.data.source!) && visibleNodeIds.has(edge.data.target!)) {
      try {
        dagreGraph.setEdge(edge.data.source!, edge.data.target!, { weight: 1 });
      } catch (err) {
        console.warn(`Failed to add edge ${edge.data.id}:`, err);
      }
    }
  });

  // Run layout
  let layoutSuccess = true;
  try {
    dagre.layout(dagreGraph);
  } catch (error) {
    console.error('❌ Hierarchical layout failed (fallback to original elements):', error);
    layoutSuccess = false;
  }

  // Update original elements array with positions
  const updatedElements: ElementDefinition[] = [];

  // Add visible nodes with their calculated positions (or defaults)
  visibleNodes.forEach((node, i) => {
    if (layoutSuccess) {
      const dagreNode = dagreGraph.node(node.data.id!);
      if (dagreNode && !isNaN(dagreNode.x) && !isNaN(dagreNode.y)) {
        updatedElements.push({
          ...node,
          position: { x: dagreNode.x, y: dagreNode.y },
        });
        return;
      }
    }

    // Fallback: Just spread them out so they don't overlap totally
    updatedElements.push({
      ...node,
      position: { x: (i % 20) * 150, y: Math.floor(i / 20) * 100 },
    });
  });

  // Add edges between visible nodes
  edges.forEach((edge) => {
    if (visibleNodeIds.has(edge.data.source!) && visibleNodeIds.has(edge.data.target!)) {
      updatedElements.push(edge);
    }
  });

  return updatedElements;
};
