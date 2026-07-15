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
} from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ControlPanelProps {
  cy: cytoscape.Core | null;
  layoutDir: 'TB' | 'LR';
  onLayoutDirChange: (dir: 'TB' | 'LR') => void;
  viewMode: 'project' | 'component';
  onViewModeChange: (view: 'project' | 'component') => void;
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
      className={`flex items-center justify-center p-2 rounded-md transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
      onClick={onClick}
    >
      <Icon
        weight={weight || (isActive ? 'fill' : 'bold')}
        size={16}
        color={isActive ? '#3b82f6' : undefined}
      />
    </TooltipTrigger>
    <TooltipContent side="top" sideOffset={8}>
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
    <div className="flex gap-2 w-full font-sans">
      {/* Zoom Controls */}
      <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200 p-1 gap-1">
        <TooltipButton
          onClick={handleZoomIn}
          icon={MagnifyingGlassPlus}
          weight="duotone"
          tooltip="Zoom In"
        />
        <div className="px-2 text-xs font-semibold text-slate-600 min-w-[45px] text-center">
          {zoomLevel}%
        </div>
        <TooltipButton
          onClick={handleZoomOut}
          icon={MagnifyingGlassMinus}
          weight="duotone"
          tooltip="Zoom Out"
        />
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <TooltipButton onClick={handleFit} icon={CornersOut} tooltip="Fit to Screen" />
      </div>

      {/* Orientation Toggle */}
      <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200 p-1">
        <TooltipButton
          onClick={handleToggleDir}
          icon={layoutDir === 'TB' ? ArrowsOutLineHorizontal : ArrowsOutLineVertical}
          tooltip="Toggle Layout Direction"
        />
      </div>

      {/* Lock Toggle */}
      <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200 p-1">
        <TooltipButton
          onClick={handleToggleLock}
          icon={isLocked ? LockKey : LockKeyOpen}
          tooltip={isLocked ? 'Unlock Nodes' : 'Lock Nodes'}
          isActive={isLocked}
        />
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-200 p-1 gap-1 ml-auto">
        <TooltipButton
          onClick={() => onViewModeChange('project')}
          icon={TreeStructure}
          tooltip="Project View (Folders & Architecture)"
          isActive={viewMode === 'project'}
        />
        <div className="w-px h-4 bg-slate-200 mx-1" />
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
