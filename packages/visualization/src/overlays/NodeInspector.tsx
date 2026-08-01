'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  WarningCircle,
  ShieldCheck,
  ArrowSquareOut,
  X,
  Copy,
  Check,
  Folder,
  Package,
  Wrench,
  Warning,
} from '@phosphor-icons/react';

export interface RelatedNode {
  id: string;
  label: string;
  type?: string;
}

export interface NodeData {
  id: string;
  label: string;
  type: string;
  language?: string;
  path?: string;
  fanIn?: number;
  fanOut?: number;
  riskScore?: number;
  riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  hotspotScore?: number;
  blastRadiusPercent?: number;
  issues?: string[];
  dependents?: RelatedNode[];
  dependencies?: RelatedNode[];
}

export interface NodeInspectorProps {
  node: NodeData | null;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
  onGenerateFixPR?: (node: NodeData) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  onClose,
  onSelectNode,
  onGenerateFixPR,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'dependents' | 'dependencies'>(
    'overview',
  );

  const handleCopyPath = () => {
    if (!node) return;
    void navigator.clipboard.writeText(node.path || node.label);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRiskBadge = () => {
    if (!node) return null;
    const level =
      node.riskLevel ||
      (node.riskScore && node.riskScore >= 70
        ? 'HIGH'
        : node.riskScore && node.riskScore >= 40
          ? 'MEDIUM'
          : 'LOW');

    if (level === 'HIGH')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
          <WarningCircle size={12} weight="fill" /> High
        </span>
      );
    if (level === 'MEDIUM')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
          <WarningCircle size={12} weight="fill" /> Moderate
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
        <ShieldCheck size={12} weight="fill" /> Low
      </span>
    );
  };

  const hotspotScore = node?.hotspotScore ?? Math.min(100, (node?.fanIn ?? 0) * 12 + (node?.fanOut ?? 0) * 8);
  const blastRadius = node?.blastRadiusPercent ?? Math.min(100, (node?.fanIn ?? 0) * 18);
  const autoIssues = node?.issues ?? [
    'Deeply nested dependency chain detected',
    'No test coverage in adjacent modules',
  ];

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-64 flex-shrink-0 flex flex-col font-sans text-sm bg-white dark:bg-[#0E1117] border-l border-slate-200 dark:border-white/[0.06] overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {node.type === 'folder' || node.type === 'directory' ? (
                  <Folder size={14} weight="fill" />
                ) : node.type === 'external' ? (
                  <Package size={14} weight="fill" />
                ) : (
                  <FileCode size={14} weight="fill" />
                )}
              </div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                {node.type}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors border-none bg-transparent cursor-pointer"
            >
              <X size={15} weight="bold" />
            </button>
          </div>

          {/* Node Name + Path */}
          <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 className="m-0 text-base font-bold text-slate-900 dark:text-white truncate">
              {node.label}
            </h2>
            {node.path && node.path !== node.label && (
              <button
                onClick={handleCopyPath}
                className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors bg-transparent border-none p-0 cursor-pointer font-mono"
              >
                {node.path}
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-white/[0.06] px-3 pt-1">
            {(['overview', 'dependents', 'dependencies'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[11px] px-2 pb-2 pt-1 capitalize font-medium transition-colors border-none bg-transparent cursor-pointer border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab === 'dependents'
                  ? `Dependents`
                  : tab === 'dependencies'
                    ? `Dependencies`
                    : 'Overview'}
              </button>
            ))}
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="px-4 py-3 space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-1">
                      Dependents
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {node.fanIn ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-1">
                      Dependencies
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {node.fanOut ?? 0}
                    </div>
                  </div>
                </div>

                {/* Hotspot score */}
                <div>
                  <div className="flex justify-between items-center mb-1.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Hotspot score</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {hotspotScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${hotspotScore}%` }}
                    />
                  </div>
                </div>

                {/* Blast radius */}
                <div>
                  <div className="flex justify-between items-center mb-1.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Blast radius</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {blastRadius}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${blastRadius}%` }}
                    />
                  </div>
                </div>

                {/* Risk badge */}
                {node.riskScore !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Risk level</span>
                    {getRiskBadge()}
                  </div>
                )}

                {/* Auto-detected issues */}
                {autoIssues.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500 mb-2">
                      Auto-Detected Issues
                    </div>
                    <div className="space-y-1.5">
                      {autoIssues.map((issue, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400"
                        >
                          <Warning
                            size={13}
                            weight="fill"
                            className="text-amber-500 flex-shrink-0 mt-0.5"
                          />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dependents' && (
              <div className="px-4 py-3 space-y-1.5">
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                  {node.dependents?.length ?? node.fanIn ?? 0} files depend on this
                </div>
                {node.dependents && node.dependents.length > 0 ? (
                  node.dependents.map((dep) => (
                    <button
                      key={dep.id}
                      onClick={() => onSelectNode?.(dep.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-white/[0.06] bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.04] text-left group cursor-pointer transition-colors"
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate">
                        {dep.label}
                      </span>
                      <ArrowSquareOut
                        size={13}
                        className="text-slate-300 dark:text-slate-600 group-hover:text-violet-500 flex-shrink-0"
                      />
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                    No dependents found.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dependencies' && (
              <div className="px-4 py-3 space-y-1.5">
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                  This file imports {node.dependencies?.length ?? node.fanOut ?? 0} module(s)
                </div>
                {node.dependencies && node.dependencies.length > 0 ? (
                  node.dependencies.map((dep) => (
                    <button
                      key={dep.id}
                      onClick={() => onSelectNode?.(dep.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-white/[0.06] bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.04] text-left group cursor-pointer transition-colors"
                    >
                      <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate">
                        {dep.label}
                      </span>
                      <ArrowSquareOut
                        size={13}
                        className="text-slate-300 dark:text-slate-600 group-hover:text-violet-500 flex-shrink-0"
                      />
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                    No dependencies found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-white/[0.06] space-y-2">
            <button
              onClick={() => onGenerateFixPR?.(node)}
              className="w-full py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] border-none cursor-pointer shadow-md shadow-violet-500/20"
            >
              <Wrench size={14} weight="bold" />
              Generate Fix PR
            </button>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">
              Creates a draft PR with suggested improvements
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
