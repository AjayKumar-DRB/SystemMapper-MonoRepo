export class RelationshipBuilder {
  static buildContains(parentNodeId: string, childNodeId: string) {
    return {
      source: parentNodeId,
      target: childNodeId,
      type: 'CONTAINS',
      props: {},
    };
  }

  static buildImports(sourceFileId: string, targetFileId: string, startLine: number) {
    return {
      source: sourceFileId,
      target: targetFileId,
      type: 'IMPORTS',
      props: {
        startLine,
      },
    };
  }
}
