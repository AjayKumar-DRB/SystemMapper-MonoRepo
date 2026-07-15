import cytoscape from 'cytoscape';

declare module 'cytoscape-expand-collapse' {
  const expandCollapse: cytoscape.Ext;
  export default expandCollapse;
}

declare module 'cytoscape-dagre' {
  const dagre: cytoscape.Ext;
  export default dagre;
}

declare module 'cytoscape-elk' {
  const elk: cytoscape.Ext;
  export default elk;
}
