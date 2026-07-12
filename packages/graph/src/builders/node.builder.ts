import {
  ParsedFile,
  ClassDeclaration,
  FunctionDeclaration,
  MethodDeclaration,
  ImportDeclaration,
} from '@systemmapper/types';

export class NodeBuilder {
  static buildDirectoryNode(
    repositoryId: string,
    dirPath: string,
    scanId: string,
    branch?: string,
  ) {
    const nodeId = `${repositoryId}:${branch || 'default'}:Folder:${dirPath}`;
    return {
      nodeId,
      repositoryId,
      branch: branch || 'default',
      name: dirPath.split('/').pop() || dirPath,
      path: dirPath,
      scanId,
      updatedAt: new Date().toISOString(),
    };
  }

  static buildFileNode(
    repositoryId: string,
    parsedFile: ParsedFile,
    scanId: string,
    branch?: string,
  ) {
    const nodeId = `${repositoryId}:${branch || 'default'}:File:${parsedFile.filePath}`;
    return {
      nodeId,
      repositoryId,
      branch: branch || 'default',
      filePath: parsedFile.filePath,
      fileName: parsedFile.filePath.split('/').pop() || parsedFile.filePath,
      language: parsedFile.language,
      lineCount: parsedFile.lineCount,
      byteSize: parsedFile.byteSize,
      contentHash: parsedFile.contentHash,
      scanId,
      updatedAt: new Date().toISOString(),
    };
  }

  static buildClassNode(
    repositoryId: string,
    classDecl: ClassDeclaration,
    filePath: string,
    scanId: string,
    branch?: string,
  ) {
    const nodeId = `${repositoryId}:${branch || 'default'}:Class:${filePath}:${classDecl.name}`;
    return {
      nodeId,
      repositoryId,
      branch: branch || 'default',
      name: classDecl.name,
      filePath,
      isExported: classDecl.isExported,
      startLine: classDecl.startLine,
      endLine: classDecl.endLine,
      methodCount: classDecl.methods.length,
      scanId,
      updatedAt: new Date().toISOString(),
    };
  }

  static buildMethodNode(
    repositoryId: string,
    methodDecl: MethodDeclaration,
    filePath: string,
    className: string,
    scanId: string,
    branch?: string,
  ) {
    const nodeId = `${repositoryId}:${branch || 'default'}:Method:${filePath}:${className}.${methodDecl.name}`;
    return {
      nodeId,
      repositoryId,
      branch: branch || 'default',
      name: methodDecl.name,
      className,
      filePath,
      isAsync: methodDecl.isAsync,
      startLine: methodDecl.startLine,
      endLine: methodDecl.endLine,
      scanId,
      updatedAt: new Date().toISOString(),
    };
  }

  static buildFunctionNode(
    repositoryId: string,
    funcDecl: FunctionDeclaration,
    filePath: string,
    scanId: string,
    branch?: string,
  ) {
    const nodeId = `${repositoryId}:${branch || 'default'}:Function:${filePath}:${funcDecl.name}`;
    return {
      nodeId,
      repositoryId,
      branch: branch || 'default',
      name: funcDecl.name,
      filePath,
      isExported: funcDecl.isExported,
      isAsync: funcDecl.isAsync,
      startLine: funcDecl.startLine,
      endLine: funcDecl.endLine,
      scanId,
      updatedAt: new Date().toISOString(),
    };
  }
}
