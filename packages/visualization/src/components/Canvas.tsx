import React, { useState, useEffect, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import elk from 'cytoscape-elk';
import { motion, AnimatePresence } from 'framer-motion';
import { traceToRoot } from '../utils/layoutUtils';
import { graphStylesheet } from '../utils/graphStyles';

// Register layout extensions once
if (typeof window !== 'undefined') {
  try {
    cytoscape.use(dagre);
  } catch {
    // ignore
  }
  try {
    cytoscape.use(elk);
  } catch {
    // ignore
  }
}

import { NodeData } from '../overlays/NodeInspector';

export interface BreadcrumbItem {
  id: string;
  label: string;
}

export interface CanvasProps {
  elements: cytoscape.ElementDefinition[];
  viewMode?: 'project' | 'component';
  /** When set, the canvas is showing only the subtree of this folder */
  focusedFolderId?: string;
  /** Breadcrumb trail for navigating back out of drilled folders */
  breadcrumb?: BreadcrumbItem[];
  searchQuery?: string;
  onFolderDrillDown?: (folderId: string, folderLabel: string) => void;
  onBreadcrumbNavigate?: (folderId: string | null) => void;
  onNodeSelect?: (node: NodeData | null) => void;
  renderOverlay?: (
    cy: cytoscape.Core | null,
    layoutDir: 'TB' | 'LR',
    setLayoutDir: (dir: 'TB' | 'LR') => void,
  ) => React.ReactNode;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  viewMode = 'project',
  breadcrumb = [],
  searchQuery = '',
  onFolderDrillDown,
  onBreadcrumbNavigate,
  onNodeSelect,
  renderOverlay,
}) => {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [layoutedElements, setLayoutedElements] = useState<cytoscape.ElementDefinition[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [layoutDir, setLayoutDir] = useState<'TB' | 'LR'>('TB');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const prevElementsRef = useRef<cytoscape.ElementDefinition[]>([]);

  // Initialize Web Worker for project view layout
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../utils/layout.worker.ts', import.meta.url));
    } catch (err) {
      console.warn('Failed to initialize Web Worker, layout will run on main thread', err);
    }
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!elements || elements.length === 0) {
      setLayoutedElements([]);
      setIsLayouting(false);
      return;
    }

    if (viewMode === 'component') {
      // Component view: pass raw elements directly, Cytoscape+dagre will handle compound layout
      setLayoutedElements(elements);
      setIsLayouting(false);
      return;
    }

    // Project view: use manual dagre layout via web worker
    let currentCollapsed = collapsedNodes;
    if (elements !== prevElementsRef.current) {
      // In project view, start with all nodes expanded
      currentCollapsed = new Set<string>();
      setCollapsedNodes(currentCollapsed);
      prevElementsRef.current = elements;
    }

    setIsLayouting(true);

    if (workerRef.current) {
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'SUCCESS') {
          setLayoutedElements(e.data.layoutedElements);
        } else {
          console.error('Layout worker failed:', e.data.error);
          setLayoutedElements(elements);
        }
        setIsLayouting(false);
      };
      workerRef.current.postMessage({
        elements,
        layoutDir,
        collapsedNodesArray: Array.from(currentCollapsed),
      });
    } else {
      import('../utils/layoutUtils').then(({ layoutHierarchicalGraph }) => {
        setTimeout(() => {
          const result = layoutHierarchicalGraph(elements, layoutDir, currentCollapsed);
          setLayoutedElements(result);
          setIsLayouting(false);
        }, 50);
      });
    }
  }, [elements, layoutDir, viewMode]);

  // Handle double-click: in component view drill down into folder; in project view collapse
  const handleNodeDoubleClick = useCallback(
    (e: cytoscape.EventObject) => {
      const node = e.target;
      const nodeType = node.data('type');
      const nodeId = node.id();

      if (viewMode === 'component' && (nodeType === 'folder' || nodeType === 'directory')) {
        // Drill down into this folder
        onFolderDrillDown?.(nodeId, node.data('label') || nodeId);
      } else if (viewMode === 'project') {
        setCollapsedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
      }
    },
    [viewMode, onFolderDrillDown],
  );

  // Handle single click to trace path to root and notify node selection
  const handleNodeClick = useCallback(
    (e: cytoscape.EventObject) => {
      const node = e.target;
      const path = traceToRoot(node.id(), elements);
      setSelectedPath(path);

      if (onNodeSelect) {
        const data = node.data();
        const incomingEdges = node.incomers('edge');
        const outgoingEdges = node.outgoers('edge');

        const dependents = incomingEdges.map((edge: cytoscape.EdgeSingular) => {
          const src = edge.source();
          return {
            id: src.id(),
            label: src.data('label') || src.id(),
            type: src.data('type') || 'component',
          };
        });

        const dependencies = outgoingEdges.map((edge: cytoscape.EdgeSingular) => {
          const tgt = edge.target();
          return {
            id: tgt.id(),
            label: tgt.data('label') || tgt.id(),
            type: tgt.data('type') || 'component',
          };
        });

        const nodeData: NodeData = {
          id: node.id(),
          label: data.label || node.id(),
          type: data.type || 'component',
          language: data.language,
          path: data.path || data.label || node.id(),
          fanIn: data.fanIn ?? dependents.length,
          fanOut: data.fanOut ?? dependencies.length,
          riskScore: data.riskScore,
          riskLevel: data.riskLevel,
          dependents,
          dependencies,
        };

        onNodeSelect(nodeData);
      }
    },
    [elements, onNodeSelect],
  );

  // Live node search highlight effect
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (!searchQuery || searchQuery.trim() === '') {
      cy.batch(() => {
        cy.elements().removeClass('dimmed').removeClass('searched');
      });
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    cy.batch(() => {
      cy.elements().removeClass('searched').addClass('dimmed');
      const matches = cy.nodes().filter((node) => {
        const label = (node.data('label') || '').toLowerCase();
        const id = (node.id() || '').toLowerCase();
        const path = (node.data('path') || '').toLowerCase();
        return label.includes(q) || id.includes(q) || path.includes(q);
      });
      matches.removeClass('dimmed').addClass('searched');
      matches.connectedEdges().removeClass('dimmed').addClass('searched');
    });
  }, [searchQuery, layoutedElements]);

  // Highlight selected path
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.elements().removeClass('highlighted');
    if (selectedPath.length > 0) {
      selectedPath.forEach((nodeId) => cy.getElementById(nodeId).addClass('highlighted'));
      for (let i = 0; i < selectedPath.length - 1; i++) {
        cy.edges(`[source = "${selectedPath[i + 1]}"][target = "${selectedPath[i]}"]`).addClass(
          'highlighted',
        );
      }
    }
  }, [selectedPath, layoutedElements]);

  // Focus on start of graph when layout finishes
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    const focusOnStart = () => {
      if (cy.nodes().length === 0) return;

      const targetZoom = 1.0;
      const nodes = cy.nodes();
      let bb = nodes.boundingBox();

      // Try to find the "start" nodes
      const roots = nodes.roots();
      if (roots.length > 0) {
        bb = roots.boundingBox();
      } else {
        if (layoutDir === 'TB') {
          let minY = Infinity;
          nodes.forEach((n) => {
            const y = n.position('y');
            if (y < minY) minY = y;
          });
          const startNodes = nodes.filter((n) => Math.abs(n.position('y') - minY) < 100);
          if (startNodes.length > 0) bb = startNodes.boundingBox();
        } else {
          let minX = Infinity;
          nodes.forEach((n) => {
            const x = n.position('x');
            if (x < minX) minX = x;
          });
          const startNodes = nodes.filter((n) => Math.abs(n.position('x') - minX) < 100);
          if (startNodes.length > 0) bb = startNodes.boundingBox();
        }
      }

      const width = cy.width();
      const height = cy.height();

      let panX = width / 2 - (bb.x1 + bb.w / 2) * targetZoom;
      let panY = height / 2 - (bb.y1 + bb.h / 2) * targetZoom;

      if (layoutDir === 'TB') {
        panY = 100 - bb.y1 * targetZoom; // 100px padding from top
      } else {
        panX = 100 - bb.x1 * targetZoom; // 100px padding from left
      }

      cy.animate({
        zoom: targetZoom,
        pan: { x: panX, y: panY },
        duration: 400,
        easing: 'ease-in-out-cubic',
      });
    };

    cy.on('layoutstop', focusOnStart);

    // For preset layout which might not always trigger layoutstop in react-cytoscapejs
    if (viewMode === 'project' && !isLayouting && layoutedElements.length > 0) {
      setTimeout(focusOnStart, 50);
    }

    return () => {
      cy.removeListener('layoutstop', focusOnStart);
    };
  }, [layoutedElements, layoutDir, isLayouting, viewMode]);

  const stylesheet = graphStylesheet(layoutDir);

  // Choose layout config based on view mode
  const cytoscapeLayout =
    viewMode === 'component'
      ? ({
          name: 'dagre',
          rankDir: layoutDir,
          nodeSep: 40,
          rankSep: 80,
          edgeSep: 15,
          padding: 20,
          animate: true,
          animationDuration: 400,
          fit: false,
        } as cytoscape.LayoutOptions)
      : ({ name: 'preset', fit: false } as cytoscape.LayoutOptions);

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-50 dark:bg-[#0B0E14]">
      {/* Loading Overlay */}
      {isLayouting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0F1419]/80 font-sans backdrop-blur-md">
          <div className="bg-[#182232] p-6 rounded-2xl shadow-2xl border border-white/10 text-center max-w-xs">
            <div className="w-8 h-8 border-3 border-slate-700 border-t-[#06D6FF] rounded-full animate-spin mx-auto mb-3" />
            <h2 className="text-white font-bold text-base mb-1">Computing Layout…</h2>
            <p className="text-slate-400 text-xs font-mono">{elements.length} elements</p>
          </div>
        </div>
      )}

      {/* Breadcrumb (component view drill-down navigation) */}
      {viewMode === 'component' && breadcrumb.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-[#182232]/90 border border-white/10 rounded-full shadow-xl px-4 py-2 font-sans text-xs backdrop-blur-md">
          <button
            onClick={() => onBreadcrumbNavigate?.(null)}
            className="text-[#06D6FF] hover:text-cyan-300 font-bold transition-colors px-1 border-none bg-transparent cursor-pointer"
          >
            🏠 All Folders
          </button>
          {breadcrumb.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span className="text-slate-500">›</span>
              <button
                onClick={() =>
                  onBreadcrumbNavigate?.(idx === breadcrumb.length - 1 ? crumb.id : crumb.id)
                }
                className={`px-2.5 py-0.5 rounded-full transition-colors font-medium border-none bg-transparent cursor-pointer ${
                  idx === breadcrumb.length - 1
                    ? 'bg-[#06D6FF]/20 text-[#06D6FF] font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Bottom-left overlay: Legend + Control Panel */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-2">
        {/* Legend */}
        <div className="bg-[#182232]/90 backdrop-blur-md rounded-xl shadow-xl border border-white/10 font-sans overflow-hidden min-w-[240px] flex flex-col">
          <AnimatePresence initial={false}>
            {isLegendOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="p-4 border-b border-white/10">
                  <div className="flex flex-col gap-2 text-xs">
                    {viewMode === 'project' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#064e3b] border border-[#2ECC71]" />
                          <span className="text-slate-200">Folder</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#452a0a] border border-[#FFC107]" />
                          <span className="text-slate-200">External Package</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#451215] border border-[#FF4757]" />
                          <span className="text-slate-200">High Risk Node</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#064e3b] border border-[#2ECC71]" />
                          <span className="text-slate-200">Folder (container)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#1E293B] border border-[#475569]" />
                          <span className="text-slate-200">File (component)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-0.5 bg-[#06D6FF]" />
                          <span className="text-slate-200">Selected Glow</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div
            onClick={() => setIsLegendOpen((o) => !o)}
            className="p-3 px-4 flex justify-between items-center cursor-pointer bg-white/5 hover:bg-white/10 transition-colors"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Visual Legend
            </h3>
            <span className="text-xs text-slate-400">{isLegendOpen ? '▼' : '▲'}</span>
          </div>
        </div>

        {/* Control Panel passed from parent */}
        {renderOverlay && renderOverlay(cyRef.current, layoutDir, setLayoutDir)}
      </div>

      {/* Path to Root UI (project view) */}
      {viewMode === 'project' && selectedPath.length > 0 && (
        <div className="absolute top-5 right-5 z-20 bg-[#182232]/90 backdrop-blur-xl p-4 rounded-xl shadow-xl border border-white/10 font-sans max-w-[400px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
            📍 Path to Root
          </h3>
          <div className="text-xs font-medium text-slate-200 flex flex-wrap gap-2 items-center">
            {selectedPath
              .slice()
              .reverse()
              .map((nodeId, idx) => {
                const node = elements.find((e) => e.data.id === nodeId);
                return (
                  <React.Fragment key={nodeId}>
                    {idx > 0 && <span className="text-[#06D6FF]">→</span>}
                    <span className="bg-black/40 px-2.5 py-1 rounded-md text-white font-mono text-[11px] border border-white/5">
                      {node?.data.label || nodeId}
                    </span>
                  </React.Fragment>
                );
              })}
          </div>
        </div>
      )}

      {/* Cytoscape Canvas */}
      <div
        className={`w-full h-full transition-opacity duration-200 ${isLayouting ? 'opacity-0' : 'opacity-100'}`}
      >
        {layoutedElements.length > 0 && (
          <CytoscapeComponent
            elements={layoutedElements}
            layout={cytoscapeLayout}
            stylesheet={stylesheet as unknown as cytoscape.StylesheetStyle[]}
            className="w-full h-full"
            wheelSensitivity={0.2}
            cy={(cy) => {
              cyRef.current = cy;
              cy.removeAllListeners();
              cy.on('tap', 'node', handleNodeClick);
              cy.on('dblclick', 'node', handleNodeDoubleClick);
            }}
          />
        )}
      </div>
    </div>
  );
};
