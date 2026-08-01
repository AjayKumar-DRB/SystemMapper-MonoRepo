// Icon helpers
const createIcon = (svgContent: string, fill: string = '%2364748b') =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${fill}">${svgContent}</svg>`;

const ICONS = {
  folder: createIcon(
    '<path d="M216,72v24H40V72a8,8,0,0,1,8-8H93.33a8,8,0,0,1,4.8,1.6l27.74,20.8A8,8,0,0,0,130.67,88H208A8,8,0,0,1,216,72Z" opacity="0.2"/><path d="M216,72H130.67l-27.74-20.8A16,16,0,0,0,93.33,48H48A16,16,0,0,0,32,64V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V88A16,16,0,0,0,216,72ZM48,64H93.33l21.34,16H48ZM208,200H48V96H208V200Z"/>',
    '%2315803d',
  ),
  external: createIcon(
    '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM156.69,99.31l-32-32a8,8,0,0,0-11.32,0l-32,32a8,8,0,0,0,11.32,11.32L112,91.31V168a8,8,0,0,0,16,0V91.31l17.37,17.32a8,8,0,1,0,11.32-11.32Z"/>',
    '%23b45309',
  ),
  file: createIcon(
    '<path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/>',
    '%23475569',
  ),
  ts: createIcon(
    '<path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216ZM108,128v48a8,8,0,0,1-16,0V144H72a8,8,0,0,1,0-16h36ZM168,144a8,8,0,0,1,0,16h-4a8,8,0,0,0-8,8,8,8,0,0,0,8,8h4a24,24,0,0,0,0-48h-4a8,8,0,0,0-8,8,8,8,0,0,0,8,8h4A8,8,0,0,1,168,144Z"/>',
    '%232563eb',
  ),
  js: createIcon(
    '<path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216ZM100,128v40a24,24,0,0,1-48,0V128a8,8,0,0,1,16,0v40a8,8,0,0,0,16,0V128A8,8,0,0,1,100,128ZM168,144a8,8,0,0,1,0,16h-4a8,8,0,0,0-8,8,8,8,0,0,0,8,8h4a24,24,0,0,0,0-48h-4a8,8,0,0,0-8,8,8,8,0,0,0,8,8h4A8,8,0,0,1,168,144Z"/>',
    '%23ca8a04',
  ),
  py: createIcon(
    '<path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-64-56a8,8,0,0,1-8,8H112v24a8,8,0,0,1-16,0V136a8,8,0,0,1,8-8h24a24,24,0,0,1,24,24v8Zm-16,8a8,8,0,0,0-8-8H112v16h8A8,8,0,0,0,120,168Zm56,0h-8v24a8,8,0,0,1-16,0V136a8,8,0,0,1,16,0v16h8a8,8,0,0,1,0,16Z"/>',
    '%230284c7',
  ),
};

import cytoscape from 'cytoscape';

export const graphStylesheet = (_layoutDir: 'TB' | 'LR'): cytoscape.StylesheetStyle[] => [
  // ─── Base node: all node types (Dark Charcoal theme)
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-family': 'Inter, system-ui, sans-serif',
      'font-size': '11.5px',
      'font-weight': 'bold',
      'text-wrap': 'wrap',
      'text-max-width': '110px',
      'text-margin-x': 10,
      shape: 'round-rectangle',
      width: '160px',
      height: '40px',
      padding: '10px',
      'background-color': '#1E293B',
      'background-image': ICONS.file,
      'background-fit': 'none',
      'background-position-x': '12px',
      'background-position-y': '50%',
      'background-width': '20px',
      'background-height': '20px',
      color: '#F8FAFC',
      'border-width': '1px',
      'border-color': '#334155',
      'transition-property': 'background-color, border-color, opacity, border-width',
      'transition-duration': 0.2,
    },
  },

  // ─── Compound/Parent node (folder acting as container)
  {
    selector: ':parent',
    style: {
      label: 'data(label)',
      'text-valign': 'top',
      'text-halign': 'left',
      'text-margin-x': 28,
      'text-margin-y': 10,
      'font-size': '12px',
      'font-weight': 'bold',
      shape: 'round-rectangle',
      'background-color': '#064e3b',
      'background-opacity': 0.35,
      'background-image': ICONS.folder,
      'background-fit': 'none',
      'background-position-x': '12px',
      'background-position-y': '12px',
      'background-width': '16px',
      'background-height': '16px',
      'border-color': '#2ECC71',
      'border-style': 'solid',
      'border-width': '1.5px',
      color: '#A7F3D0',
      padding: '40px 16px 16px 16px',
      'min-width': '180px',
      'min-height': '80px',
    },
  },

  // ─── Folder node (standalone)
  {
    selector: 'node[type = "folder"], node[type = "directory"]',
    style: {
      'background-color': '#064e3b',
      'background-image': ICONS.folder,
      'border-color': '#2ECC71',
      color: '#A7F3D0',
      'border-width': '1.5px',
    },
  },

  // ─── File nodes with specific extensions
  {
    selector: 'node[label $= ".ts"], node[label $= ".tsx"], node[language = "typescript"]',
    style: { 'background-image': ICONS.ts },
  },
  {
    selector: 'node[label $= ".js"], node[label $= ".jsx"], node[language = "javascript"]',
    style: { 'background-image': ICONS.js },
  },
  {
    selector: 'node[label $= ".py"], node[language = "python"]',
    style: { 'background-image': ICONS.py },
  },
  {
    selector: 'node[type = "file"]',
    style: {
      'background-color': '#1E293B',
      'border-color': '#475569',
    },
  },

  // ─── External dependency node
  {
    selector: 'node[type = "external"]',
    style: {
      'background-color': '#452a0a',
      'background-image': ICONS.external,
      'border-color': '#FFC107',
      'border-width': '1.5px',
      color: '#FDE68A',
      'font-size': '10px',
      width: '140px',
      height: '36px',
    },
  },

  // ─── Project node
  {
    selector: 'node[type = "project"]',
    style: {
      'background-color': '#0c4a6e',
      'background-image': ICONS.folder,
      'border-color': '#06D6FF',
      color: '#BAE6FD',
      'font-size': '12px',
      height: '44px',
    },
  },

  // ─── Base edge styles
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'curve-style': 'taxi',
      'taxi-direction': 'auto',
      'taxi-turn': '12px',
      'arrow-scale': 1.1,
      'line-color': '#475569',
      'target-arrow-color': '#475569',
      opacity: 0.85,
    },
  },

  // ─── CONTAINS edges
  {
    selector: 'edge[type = "CONTAINS"]',
    style: {
      'line-color': '#2ECC71',
      'target-arrow-color': '#2ECC71',
      'target-arrow-shape': 'triangle',
      'line-style': 'solid',
      width: 2,
    },
  },

  // ─── IMPORTS edges
  {
    selector: 'edge[type = "IMPORTS"]',
    style: {
      'line-color': '#38BDF8',
      'target-arrow-color': '#38BDF8',
      'target-arrow-shape': 'vee',
      'line-style': 'solid',
      width: 1.5,
      opacity: 0.8,
    },
  },

  // ─── Risk-score visual indicators
  {
    selector: 'node[riskLevel = "HIGH"], node[riskScore >= 70]',
    style: {
      'background-color': '#451215',
      'border-color': '#FF4757',
      'border-width': '2px',
      color: '#FECDD3',
    },
  },
  {
    selector: 'node[riskLevel = "MEDIUM"], node[riskScore >= 40][riskScore < 70]',
    style: {
      'background-color': '#452a0a',
      'border-color': '#FFC107',
      'border-width': '2px',
      color: '#FDE68A',
    },
  },

  // ─── Searched & Dimmed states for live node search
  {
    selector: '.searched',
    style: {
      'border-width': '3px',
      'border-color': '#06D6FF',
      'line-color': '#06D6FF',
      'target-arrow-color': '#06D6FF',
      'z-index': 9999,
      opacity: 1,
    },
  },
  {
    selector: '.dimmed',
    style: {
      opacity: 0.2,
    },
  },

  // ─── Highlighted / Selected state (Bright Teal Accent)
  {
    selector: '.highlighted, node:selected',
    style: {
      'border-width': '3px',
      'border-color': '#06D6FF',
      'line-color': '#06D6FF',
      'target-arrow-color': '#06D6FF',
      'z-index': 9999,
      opacity: 1,
      width: 3,
    },
  },

  // ─── Hovered state
  {
    selector: 'node:active',
    style: {
      'border-width': '3px',
      'border-color': '#06D6FF',
    },
  },
];
