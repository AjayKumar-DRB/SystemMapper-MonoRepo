import React, { useEffect, useState } from 'react';
import type cytoscape from 'cytoscape';
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  CornersOut,
  LockKey,
  LockKeyOpen,
  ArrowsOutLineVertical,
  ArrowsOutLineHorizontal,
  TreeStructure,
  FileCode,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ControlPanelProps {
  cy: cytoscape.Core | null;
  layoutDir: 'TB' | 'LR';
  onLayoutDirChange: (dir: 'TB' | 'LR') => void;
  viewMode: 'project' | 'component';
  onViewModeChange: (view: 'project' | 'component') => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

interface TooltipButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  tooltip: string;
  isActive?: boolean;
  weight?: 'fill' | 'bold' | 'duotone' | 'regular' | 'light' | 'thin';
}

const TooltipButton = ({
  onClick,
  icon: Icon,
  tooltip,
  isActive = false,
  weight,
}: TooltipButtonProps) => (
  <Tooltip>
    <TooltipTrigger
      className={`flex items-center justify-center p-2 rounded-lg transition-all border cursor-pointer ${
        isActive
          ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30'
          : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white'
      }`}
      onClick={onClick}
    >
      <Icon
        weight={weight || (isActive ? 'fill' : 'bold')}
        size={16}
      />
    </TooltipTrigger>
    <TooltipContent side="top" sideOffset={8} className="text-xs">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  cy,
  layoutDir,
  onLayoutDirChange,
  viewMode,
  onViewModeChange,
  searchQuery = '',
  onSearchQueryChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!cy) return;

    const updateZoom = () => {
      setZoomLevel(Math.round(cy.zoom() * 100));
    };

    cy.on('zoom', updateZoom);
    updateZoom();

    return () => {
      cy.removeListener('zoom', updateZoom);
    };
  }, [cy]);

  const handleZoomIn = () => {
    if (cy) {
      cy.zoom({
        level: cy.zoom() + 0.15,
        position: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    }
  };

  const handleZoomOut = () => {
    if (cy) {
      cy.zoom({
        level: cy.zoom() - 0.15,
        position: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    }
  };

  const handleFit = () => cy && cy.fit(undefined, 50);

  const handleToggleLock = () => {
    if (!cy) return;
    const newLockState = !isLocked;
    cy.autolock(newLockState);
    setIsLocked(newLockState);
  };

  const handleToggleDir = () => {
    onLayoutDirChange(layoutDir === 'TB' ? 'LR' : 'TB');
  };

  return (
    <div className="flex gap-2 w-full font-sans items-center">
      {/* Live Search Bar */}
      {onSearchQueryChange && (
        <div className="relative flex items-center bg-white dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 w-52 sm:w-60 transition-all shadow-sm focus-within:border-violet-400 dark:focus-within:border-violet-500/60">
          <MagnifyingGlass size={14} className="text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search files or paths..."
            className="w-full text-xs bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange('')}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-transparent border-none cursor-pointer p-0 ml-1 flex items-center justify-center"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Zoom Controls */}
      <div className="flex items-center bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-1 gap-1">
        <TooltipButton onClick={handleZoomIn} icon={MagnifyingGlassPlus} weight="duotone" tooltip="Zoom In" />
        <div className="px-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 min-w-[40px] text-center font-mono">
          {zoomLevel}%
        </div>
        <TooltipButton onClick={handleZoomOut} icon={MagnifyingGlassMinus} weight="duotone" tooltip="Zoom Out" />
        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1" />
        <TooltipButton onClick={handleFit} icon={CornersOut} tooltip="Fit to Screen" />
      </div>

      {/* Orientation Toggle */}
      <div className="flex items-center bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-1">
        <TooltipButton
          onClick={handleToggleDir}
          icon={layoutDir === 'TB' ? ArrowsOutLineHorizontal : ArrowsOutLineVertical}
          tooltip="Toggle Layout Direction"
        />
      </div>

      {/* Lock Toggle */}
      <div className="flex items-center bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-1">
        <TooltipButton
          onClick={handleToggleLock}
          icon={isLocked ? LockKey : LockKeyOpen}
          tooltip={isLocked ? 'Unlock Nodes' : 'Lock Nodes'}
          isActive={isLocked}
        />
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center bg-white dark:bg-slate-900/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-1 gap-1 ml-auto">
        <TooltipButton
          onClick={() => onViewModeChange('project')}
          icon={TreeStructure}
          tooltip="Project View (Folders & Architecture)"
          isActive={viewMode === 'project'}
        />
        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1" />
        <TooltipButton
          onClick={() => onViewModeChange('component')}
          icon={FileCode}
          tooltip="Component View (Files & Imports)"
          isActive={viewMode === 'component'}
        />
      </div>
    </div>
  );
};
