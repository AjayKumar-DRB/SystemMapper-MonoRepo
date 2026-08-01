'use client';

import React from 'react';
import {
  WarningCircle,
  ShieldCheck,
  Graph,
  ArrowDown,
  ArrowUp,
  Minus,
} from '@phosphor-icons/react';

export interface MetricsSidebarProps {
  totalNodes: number;
  totalEdges: number;
  overallRiskScore?: number;
  overallRiskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  riskDelta?: number; // positive = increase, negative = decrease
  detectedIssuesCount?: number;
  securityScanAgo?: string;
}

const MiniBarChart = ({ value }: { value: number }) => {
  // Generate 8 bars increasing toward value
  const bars = Array.from({ length: 8 }, (_, i) => {
    const h = 20 + ((i + 1) / 8) * 60;
    const active = (i + 1) / 8 <= value / 100;
    return { h, active };
  });
  return (
    <div className="flex items-end gap-0.5 h-8">
      {bars.map((bar, i) => (
        <div
          key={i}
          className={`w-2.5 rounded-sm transition-colors ${
            bar.active
              ? 'bg-violet-500 dark:bg-violet-400'
              : 'bg-slate-200 dark:bg-slate-700'
          }`}
          style={{ height: `${bar.h}%` }}
        />
      ))}
    </div>
  );
};

export const MetricsSidebar: React.FC<MetricsSidebarProps> = ({
  totalNodes,
  totalEdges,
  overallRiskScore = 23,
  overallRiskLevel = 'MEDIUM',
  riskDelta = -4.8,
  detectedIssuesCount = 0,
  securityScanAgo = '8m ago',
}) => {
  const riskConfig = {
    HIGH: {
      label: 'High',
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      bar: 'bg-red-500',
    },
    MEDIUM: {
      label: 'Moderate',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
    },
    LOW: {
      label: 'Low',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
    },
  }[overallRiskLevel];

  const nodeBarWidth = Math.min(100, (totalNodes / 2000) * 100);
  const edgeBarWidth = Math.min(100, (totalEdges / 8000) * 100);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col gap-0 font-sans text-sm overflow-y-auto bg-white dark:bg-[#0E1117] border-r border-slate-200 dark:border-white/[0.06]">
      {/* ── System Risk ──────────────────────────────── */}
      <section className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500">
            Repository Health
          </span>
          <WarningCircle size={14} className="text-slate-300 dark:text-slate-600" />
        </div>

        {/* System Risk sub-section */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">System Risk</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">↗</span>
          </div>
          {/* Big score */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {overallRiskScore}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">/100</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${riskConfig.bg} ${riskConfig.text}`}
            >
              {riskConfig.label}
            </span>
          </div>

          {/* Delta */}
          <div className="flex items-center gap-1 mb-3 text-[11px] text-slate-400 dark:text-slate-500">
            {riskDelta < 0 ? (
              <ArrowDown size={12} className="text-emerald-500" />
            ) : riskDelta > 0 ? (
              <ArrowUp size={12} className="text-red-500" />
            ) : (
              <Minus size={12} />
            )}
            <span>
              {Math.abs(riskDelta).toFixed(1)}% from last scan
            </span>
          </div>

          {/* Mini bar chart */}
          <MiniBarChart value={overallRiskScore} />
        </div>
      </section>

      {/* ── Graph Architecture ───────────────────────── */}
      <section className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Graph size={12} />
            Graph Architecture
          </span>
          <span className="text-[10px] text-slate-300 dark:text-slate-600">↗</span>
        </div>

        <div className="space-y-3">
          {/* Nodes */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Nodes</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                {totalNodes.toLocaleString()}
              </span>
            </div>
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${nodeBarWidth}%` }}
              />
            </div>
          </div>

          {/* Connections */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Connections</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                {totalEdges.toLocaleString()}
              </span>
            </div>
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${edgeBarWidth}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Security Scan ────────────────────────────── */}
      <section className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Security Scan
          </span>
          <span className="text-[10px] text-slate-300 dark:text-slate-600">↗</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={16} weight="fill" className="text-emerald-500" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {detectedIssuesCount === 0 ? 'All clear' : `${detectedIssuesCount} issues`}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              Scanned {securityScanAgo}
            </div>
          </div>
        </div>
      </section>

      {/* ── Map Legend ───────────────────────────────── */}
      <section className="px-4 py-3">
        <div className="mb-2.5">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500">
            Map Legend
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border-2 border-violet-500 dark:border-violet-400 bg-transparent" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Folder / boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border-2 border-blue-500 dark:border-blue-400 bg-transparent" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Module / service</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">File / leaf node</span>
          </div>
        </div>
      </section>
    </aside>
  );
};
