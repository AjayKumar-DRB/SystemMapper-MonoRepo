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

export const graphStylesheet = (layoutDir: 'TB' | 'LR'): any[] => [
  // ─── Base node: all node types
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-family': 'Inter, system-ui, sans-serif',
      'font-size': '11.5px',
      'font-weight': '600',
      'text-wrap': 'wrap',
      'text-max-width': '110px', // slightly less width for text due to icon
      'text-margin-x': 10, // push text to the right to make room for icon
      shape: 'round-rectangle',
      width: '160px',
      height: '40px',
      padding: '10px',
      'background-color': '#ffffff',
      'background-image': ICONS.file,
      'background-fit': 'none',
      'background-position-x': '12px',
      'background-position-y': '50%',
      'background-width': '20px',
      'background-height': '20px',
      color: '#334155',
      'border-width': '1px',
      'border-color': '#cbd5e1',
      'box-shadow': '0 2px 4px rgba(0,0,0,0.05)',
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
      'text-margin-x': 28, // Push text for folder icon
      'text-margin-y': 10,
      'font-size': '12px',
      'font-weight': '700',
      shape: 'round-rectangle',
      'background-color': '#f0fdf4',
      'background-opacity': 0.7,
      'background-image': ICONS.folder,
      'background-fit': 'none',
      'background-position-x': '12px',
      'background-position-y': '12px',
      'background-width': '16px',
      'background-height': '16px',
      'border-color': '#22c55e',
      'border-style': 'solid', // Solid instead of dashed for a cleaner modern look
      'border-width': '2px',
      color: '#15803d',
      padding: '40px 16px 16px 16px',
      'min-width': '180px',
      'min-height': '80px',
    },
  },

  // ─── Folder node (standalone)
  {
    selector: 'node[type = "folder"], node[type = "directory"]',
    style: {
      'background-color': '#f0fdf4',
      'background-image': ICONS.folder,
      'border-color': '#22c55e',
      color: '#15803d',
      'border-width': '2px',
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
      'background-color': '#ffffff',
      'border-color': '#94a3b8',
    },
  },

  // ─── External dependency node
  {
    selector: 'node[type = "external"]',
    style: {
      'background-color': '#fef3c7',
      'background-image': ICONS.external,
      'border-color': '#d97706',
      'border-width': '1px',
      color: '#92400e',
      'font-size': '10px',
      width: '140px',
      height: '36px',
    },
  },

  // ─── Project node
  {
    selector: 'node[type = "project"]',
    style: {
      'background-color': '#eff6ff',
      'background-image': ICONS.folder, // Project is just a root folder
      'border-color': '#3b82f6',
      color: '#1e3a8a',
      'font-size': '12px',
      height: '44px',
    },
  },

  // ─── Base edge styles
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'curve-style': 'taxi', // Orthogonal routing!
      'taxi-direction': 'auto',
      'taxi-turn': '12px', // Rounded corners
      'arrow-scale': 1.1,
      'line-color': '#94a3b8',
      'target-arrow-color': '#94a3b8',
      opacity: 0.85,
    },
  },

  // ─── CONTAINS edges
  {
    selector: 'edge[type = "CONTAINS"]',
    style: {
      'line-color': '#86efac',
      'target-arrow-color': '#86efac',
      'target-arrow-shape': 'triangle',
      'line-style': 'solid',
      width: 2,
    },
  },

  // ─── IMPORTS edges
  {
    selector: 'edge[type = "IMPORTS"]',
    style: {
      // Hide the label for cleaner modern look, or keep it subtle?
      // The user said: "leave the part where to code itself is shown, we do not need that."
      // Assuming they meant clean edges. The reference image has clean unlabelled edges.
      // We'll remove the 'imports' label to reduce visual noise.
      'line-color': '#93c5fd',
      'target-arrow-color': '#93c5fd',
      'target-arrow-shape': 'vee',
      'line-style': 'solid',
      width: 1.5,
      opacity: 0.8,
    },
  },

  // ─── Highlighted state
  {
    selector: '.highlighted',
    style: {
      'border-width': '3px',
      'border-color': '#ef4444',
      'line-color': '#ef4444',
      'target-arrow-color': '#ef4444',
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
      'border-color': '#6366f1',
    },
  },
];
