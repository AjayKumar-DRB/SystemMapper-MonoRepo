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
  } catch {}
  try {
    cytoscape.use(elk);
  } catch {}
}

export interface BreadcrumbItem {
  id: string;
  label: string;
}

export interface CanvasProps {
  elements: any[];
  viewMode?: 'project' | 'component';
  /** When set, the canvas is showing only the subtree of this folder */
  focusedFolderId?: string;
  /** Breadcrumb trail for navigating back out of drilled folders */
  breadcrumb?: BreadcrumbItem[];
  onFolderDrillDown?: (folderId: string, folderLabel: string) => void;
  onBreadcrumbNavigate?: (folderId: string | null) => void;
  renderOverlay?: (
    cy: cytoscape.Core | null,
    layoutDir: 'TB' | 'LR',
    setLayoutDir: (dir: 'TB' | 'LR') => void,
  ) => React.ReactNode;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  viewMode = 'project',
  focusedFolderId,
  breadcrumb = [],
  onFolderDrillDown,
  onBreadcrumbNavigate,
  renderOverlay,
}) => {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [layoutedElements, setLayoutedElements] = useState<any[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [layoutDir, setLayoutDir] = useState<'TB' | 'LR'>('TB');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const prevElementsRef = useRef<any[]>([]);

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

  // Handle single click to trace path to root
  const handleNodeClick = useCallback(
    (e: cytoscape.EventObject) => {
      const node = e.target;
      const path = traceToRoot(node.id(), elements);
      setSelectedPath(path);
    },
    [elements],
  );

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
  const cytoscapeLayout: any =
    viewMode === 'component'
      ? {
          name: 'dagre',
          rankDir: layoutDir,
          nodeSep: 40,
          rankSep: 80,
          edgeSep: 15,
          padding: 20,
          animate: true,
          animationDuration: 400,
          fit: false,
        }
      : { name: 'preset', fit: false };

  return (
    <div className="relative w-full h-screen bg-slate-50">
      {/* Loading Overlay */}
      {isLayouting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 font-sans backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 text-center">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <h2 className="text-slate-900 font-semibold text-base mb-1">Computing Layout…</h2>
            <p className="text-slate-500 text-sm">{elements.length} elements</p>
          </div>
        </div>
      )}

      {/* Breadcrumb (component view drill-down navigation) */}
      {viewMode === 'component' && breadcrumb.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white border border-slate-200 rounded-full shadow-md px-3 py-1.5 font-sans text-sm">
          <button
            onClick={() => onBreadcrumbNavigate?.(null)}
            className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors px-1"
          >
            🏠 All Folders
          </button>
          {breadcrumb.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span className="text-slate-400">›</span>
              <button
                onClick={() =>
                  onBreadcrumbNavigate?.(idx === breadcrumb.length - 1 ? crumb.id : crumb.id)
                }
                className={`px-2 py-0.5 rounded-full transition-colors font-medium ${
                  idx === breadcrumb.length - 1
                    ? 'bg-indigo-100 text-indigo-700 cursor-default'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
        <div className="bg-white rounded-xl shadow-md border border-slate-200 font-sans overflow-hidden min-w-[220px] flex flex-col">
          <AnimatePresence initial={false}>
            {isLegendOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="p-4 border-b border-slate-200">
                  <div className="flex flex-col gap-2 text-xs">
                    {viewMode === 'project' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-green-50 border-2 border-dashed border-green-500" />
                          <span className="text-slate-700">Folder</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-amber-50 border-2 border-amber-500" />
                          <span className="text-slate-700">External Package</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-0.5 bg-blue-300" />
                          <span className="text-slate-700">IMPORTS (rolled-up)</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-green-50 border-2 border-dashed border-green-500" />
                          <span className="text-slate-700">Folder (container)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-slate-50 border-2 border-slate-500" />
                          <span className="text-slate-700">File (component)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-0.5 bg-blue-300" />
                          <span className="text-slate-700">IMPORTS edge</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                    {viewMode === 'component' ? (
                      <>
                        <div>• Click: Highlight path</div>
                        <div>• Double-click folder: Drill in</div>
                      </>
                    ) : (
                      <>
                        <div>• Click: Trace path to root</div>
                        <div>• Double-click: Collapse/Expand</div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div
            onClick={() => setIsLegendOpen((o) => !o)}
            className="p-3 px-4 flex justify-between items-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <h3 className="text-sm font-semibold text-slate-900">Legend</h3>
            <span className="text-xs text-slate-500">{isLegendOpen ? '▼' : '▲'}</span>
          </div>
        </div>

        {/* Control Panel passed from parent */}
        {renderOverlay && renderOverlay(cyRef.current, layoutDir, setLayoutDir)}
      </div>

      {/* Path to Root UI (project view) */}
      {viewMode === 'project' && selectedPath.length > 0 && (
        <div className="absolute top-5 right-5 z-10 bg-white p-4 rounded-xl shadow-md border border-slate-200 font-sans max-w-[400px]">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">📍 Path to Root</h3>
          <div className="text-sm font-semibold text-slate-700 flex flex-wrap gap-2 items-center">
            {selectedPath
              .slice()
              .reverse()
              .map((nodeId, idx) => {
                const node = elements.find((e) => e.data.id === nodeId);
                return (
                  <React.Fragment key={nodeId}>
                    {idx > 0 && <span className="text-blue-400">→</span>}
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
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
            stylesheet={stylesheet as any}
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
