'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Canvas, NodeInspector } from '@systemmapper/visualization';
import type { NodeData, BreadcrumbItem } from '@systemmapper/visualization';
import type cytoscape from 'cytoscape';
import { ControlPanel } from '@/components/graph/ControlPanel';
import { API_BASE_URL } from '@/lib/api';

export default function CanvasPage() {
  const params = useParams();
  const repositoryId = params.repositoryId as string;

  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isBranchesLoaded, setIsBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'project' | 'component'>('project');

  // Drill-down state for component view
  const [focusedFolderId, setFocusedFolderId] = useState<string | undefined>(undefined);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  // Fetch available branches for this repository
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/visualization/repository/${repositoryId}/branches`,
        );
        if (res.ok) {
          const data = (await res.json()) as string[];
          setBranches(data);
          if (data.length > 0) setSelectedBranch(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch branches', err);
      } finally {
        setIsBranchesLoaded(true);
      }
    }
    void fetchBranches();
  }, [repositoryId]);

  // Fetch graph data whenever branch, view, or focused folder changes
  const fetchGraph = useCallback(
    async (branch?: string, view?: 'project' | 'component', folderId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (branch) params.set('branch', branch);
        if (view) params.set('view', view);
        if (folderId) params.set('folderId', folderId);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        const res = await fetch(
          `${API_BASE_URL}/api/visualization/repository/${repositoryId}${queryString}`,
        );
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        const data = (await res.json()) as cytoscape.ElementDefinition[];

        if (Array.isArray(data)) {
          setElements(data);
          if (data.length === 0) {
            setError('No graph data found for this repository. It may still be processing.');
          }
        } else {
          console.error('Expected an array of elements but got:', data);
          setElements([]);
          setError('Unexpected response format from the server.');
        }
      } catch (err: unknown) {
        console.error('Failed to fetch graph', err);
        setError(err instanceof Error ? err.message : 'Failed to load graph data.');
      } finally {
        setIsLoading(false);
      }
    },
    [repositoryId],
  );

  useEffect(() => {
    if (!isBranchesLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGraph(selectedBranch || undefined, viewMode, focusedFolderId);
  }, [selectedBranch, viewMode, focusedFolderId, fetchGraph, isBranchesLoaded]);

  // When view changes, reset drill-down state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusedFolderId(undefined);
    setBreadcrumb([]);
  }, [viewMode]);

  const handleFolderDrillDown = useCallback((folderId: string, folderLabel: string) => {
    setFocusedFolderId(folderId);
    setBreadcrumb((prev) => {
      // Avoid duplicate breadcrumb entries
      const alreadyIdx = prev.findIndex((b) => b.id === folderId);
      if (alreadyIdx >= 0) return prev.slice(0, alreadyIdx + 1);
      return [...prev, { id: folderId, label: folderLabel }];
    });
  }, []);

  const handleBreadcrumbNavigate = useCallback((folderId: string | null) => {
    if (folderId === null) {
      // Go back to root
      setFocusedFolderId(undefined);
      setBreadcrumb([]);
    } else {
      // Navigate to a specific crumb
      setBreadcrumb((prev) => {
        const idx = prev.findIndex((b) => b.id === folderId);
        if (idx < 0) return prev;
        return prev.slice(0, idx + 1);
      });
      setFocusedFolderId(folderId);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4 font-sans">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        <div className="text-slate-500 text-sm font-medium">Loading graph…</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Branch selector toolbar */}
      {branches.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 1000,
            background: 'white',
            borderRadius: '8px',
            padding: '6px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
          }}
        >
          <span style={{ fontWeight: 600, color: '#475569' }}>Branch:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '13px',
              color: '#1e293b',
              background: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      {error ? (
        <div className="flex items-center justify-center h-full flex-col gap-3 font-sans">
          <div className="text-5xl">⚠️</div>
          <div className="text-slate-500 text-base text-center max-w-md">{error}</div>
        </div>
      ) : (
        <Canvas
          elements={elements}
          viewMode={viewMode}
          focusedFolderId={focusedFolderId}
          breadcrumb={breadcrumb}
          onFolderDrillDown={handleFolderDrillDown}
          onBreadcrumbNavigate={handleBreadcrumbNavigate}
          renderOverlay={(cy, layoutDir, setLayoutDir) => (
            <ControlPanel
              cy={cy}
              layoutDir={layoutDir}
              onLayoutDirChange={setLayoutDir}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}
        />
      )}

      <NodeInspector node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
