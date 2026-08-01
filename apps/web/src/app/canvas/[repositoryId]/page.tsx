'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Canvas, NodeInspector } from '@systemmapper/visualization';
import type { NodeData, BreadcrumbItem } from '@systemmapper/visualization';
import type cytoscape from 'cytoscape';
import {
  GitBranch,
  MagnifyingGlass,
  Terminal,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import { useTheme } from 'next-themes';
import { ControlPanel } from '@/components/graph/ControlPanel';
import { MetricsSidebar } from '@/components/graph/MetricsSidebar';
import { API_BASE_URL } from '@/lib/api';

export default function CanvasPage() {
  const params = useParams();
  const repositoryId = params.repositoryId as string;
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isBranchesLoaded, setIsBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'project' | 'component'>('project');
  const [searchQuery, setSearchQuery] = useState('');

  // Drill-down state for component view
  const [focusedFolderId, setFocusedFolderId] = useState<string | undefined>(undefined);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  // Fetch branches
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

  const fetchGraph = useCallback(
    async (branch?: string, view?: 'project' | 'component', folderId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams();
        if (branch) p.set('branch', branch);
        if (view) p.set('view', view);
        if (folderId) p.set('folderId', folderId);
        const qs = p.toString() ? `?${p.toString()}` : '';
        const res = await fetch(
          `${API_BASE_URL}/api/visualization/repository/${repositoryId}${qs}`,
        );
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = (await res.json()) as cytoscape.ElementDefinition[];
        if (Array.isArray(data)) {
          setElements(data);
          if (data.length === 0)
            setError('No graph data found. The repository may still be processing.');
        } else {
          setElements([]);
          setError('Unexpected response format from the server.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load graph data.');
      } finally {
        setIsLoading(false);
      }
    },
    [repositoryId],
  );

  useEffect(() => {
    if (!isBranchesLoaded) return;
    void fetchGraph(selectedBranch || undefined, viewMode, focusedFolderId);
  }, [selectedBranch, viewMode, focusedFolderId, fetchGraph, isBranchesLoaded]);

  useEffect(() => {
    setFocusedFolderId(undefined);
    setBreadcrumb([]);
  }, [viewMode]);

  const handleFolderDrillDown = useCallback((folderId: string, folderLabel: string) => {
    setFocusedFolderId(folderId);
    setBreadcrumb((prev) => {
      const idx = prev.findIndex((b) => b.id === folderId);
      if (idx >= 0) return prev.slice(0, idx + 1);
      return [...prev, { id: folderId, label: folderLabel }];
    });
  }, []);

  const handleBreadcrumbNavigate = useCallback((folderId: string | null) => {
    if (folderId === null) {
      setFocusedFolderId(undefined);
      setBreadcrumb([]);
    } else {
      setBreadcrumb((prev) => {
        const idx = prev.findIndex((b) => b.id === folderId);
        return idx < 0 ? prev : prev.slice(0, idx + 1);
      });
      setFocusedFolderId(folderId);
    }
  }, []);

  const handleSelectNodeById = useCallback(
    (nodeId: string) => {
      const el = elements.find((e) => e.data.id === nodeId);
      if (el) {
        const d = el.data;
        setSelectedNode({
          id: nodeId,
          label: d.label || nodeId,
          type: d.type || 'component',
          language: d.language,
          path: d.path || d.label || nodeId,
          fanIn: d.fanIn || 0,
          fanOut: d.fanOut || 0,
          riskScore: d.riskScore,
          riskLevel: d.riskLevel,
        });
      }
    },
    [elements],
  );

  const nodeCount = elements.filter((e) => !e.data.source).length;
  const edgeCount = elements.filter((e) => e.data.source).length;

  const repoLabel = decodeURIComponent(repositoryId).replace(/_/g, ' ');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-[#0E1117] gap-3 font-sans">
        <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400 dark:text-slate-500">Loading graph…</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-white dark:bg-[#0E1117] overflow-hidden flex flex-col font-sans">

      {/* ── Top Navbar ──────────────────────────────────── */}
      <header className="h-11 flex-shrink-0 flex items-center px-3 gap-3 bg-white dark:bg-[#0E1117] border-b border-slate-200 dark:border-white/[0.06] z-30">

        {/* Logo */}
        <Link
          href="/explore"
          className="flex items-center gap-2 mr-1 no-underline group"
        >
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" fill="white" />
              <circle cx="2.5" cy="2.5" r="1.5" fill="white" opacity="0.6" />
              <circle cx="11.5" cy="2.5" r="1.5" fill="white" opacity="0.6" />
              <circle cx="2.5" cy="11.5" r="1.5" fill="white" opacity="0.6" />
              <circle cx="11.5" cy="11.5" r="1.5" fill="white" opacity="0.6" />
              <line x1="7" y1="7" x2="2.5" y2="2.5" stroke="white" strokeWidth="0.8" opacity="0.5" />
              <line x1="7" y1="7" x2="11.5" y2="2.5" stroke="white" strokeWidth="0.8" opacity="0.5" />
              <line x1="7" y1="7" x2="2.5" y2="11.5" stroke="white" strokeWidth="0.8" opacity="0.5" />
              <line x1="7" y1="7" x2="11.5" y2="11.5" stroke="white" strokeWidth="0.8" opacity="0.5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
            system mapper
          </span>
        </Link>

        {/* Breadcrumb / Tab */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors border-none bg-transparent cursor-pointer truncate max-w-xs">
            {repoLabel}
          </button>
          <span className="text-slate-300 dark:text-slate-700 text-xs">/</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/[0.07] border border-slate-200 dark:border-white/[0.08]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-violet-500">
              <circle cx="6" cy="6" r="2" />
              <circle cx="2" cy="2" r="1.2" opacity="0.6" />
              <circle cx="10" cy="2" r="1.2" opacity="0.6" />
              <circle cx="2" cy="10" r="1.2" opacity="0.6" />
              <circle cx="10" cy="10" r="1.2" opacity="0.6" />
            </svg>
            System Graph
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer">
            <MagnifyingGlass size={15} />
          </button>

          {/* Branch selector */}
          {branches.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08]">
              <GitBranch size={13} className="text-violet-500" />
              <span className="text-slate-500 dark:text-slate-500 hidden sm:block">Branch:</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent outline-none cursor-pointer border-none text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[120px]"
              >
                {branches.map((b) => (
                  <option key={b} value={b} className="bg-white dark:bg-[#1a1d27] text-slate-800 dark:text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Terminal icon */}
          <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer">
            <Terminal size={15} />
          </button>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors border-none bg-transparent cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>
      </header>

      {/* ── View Tabs Bar ───────────────────────────────── */}
      <div className="flex-shrink-0 h-9 flex items-center gap-1 px-4 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#0E1117]">
        {(['Dependency map', 'Risk overlay', 'Blast radius'] as const).map((tab, i) => (
          <button
            key={tab}
            onClick={() => i === 0 && setViewMode('project')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors border-none cursor-pointer ${
              i === 0
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.1]'
                : 'bg-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Main: Sidebar + Canvas + Inspector ─────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <MetricsSidebar
          totalNodes={nodeCount}
          totalEdges={edgeCount}
          overallRiskScore={23}
          overallRiskLevel="MEDIUM"
          riskDelta={-4.8}
          detectedIssuesCount={0}
          securityScanAgo="8m ago"
        />

        {/* Center: Graph Canvas */}
        <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-[#0B0E14]">
          {error ? (
            <div className="flex items-center justify-center h-full flex-col gap-3 text-sm">
              <div className="text-4xl">⚠️</div>
              <div className="text-slate-500 dark:text-slate-400 text-center max-w-md">{error}</div>
            </div>
          ) : (
            <Canvas
              elements={elements}
              viewMode={viewMode}
              focusedFolderId={focusedFolderId}
              breadcrumb={breadcrumb}
              searchQuery={searchQuery}
              onFolderDrillDown={handleFolderDrillDown}
              onBreadcrumbNavigate={handleBreadcrumbNavigate}
              onNodeSelect={setSelectedNode}
              renderOverlay={(cy, layoutDir, setLayoutDir) => (
                <ControlPanel
                  cy={cy}
                  layoutDir={layoutDir}
                  onLayoutDirChange={setLayoutDir}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
              )}
            />
          )}
        </div>

        {/* Right: Node Inspector (conditional) */}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSelectNode={handleSelectNodeById}
            onGenerateFixPR={(nodeData) => {
              alert(`Generating Fix PR for: ${nodeData.label}`);
            }}
          />
        )}
      </main>
    </div>
  );
}
