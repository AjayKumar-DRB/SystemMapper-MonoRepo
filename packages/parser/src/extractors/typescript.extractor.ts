import { ILanguageParser } from '../interfaces/language-parser.interface';
import { ParsedFile, Language, ImportDeclaration, ClassDeclaration, MethodDeclaration, FunctionDeclaration } from '@systemmapper/types';
import crypto from 'crypto';
import * as ts from 'typescript';

export class TypeScriptExtractor implements ILanguageParser {
  readonly language = Language.TYPESCRIPT;

  parse(filePath: string, content: string): ParsedFile {
    const startTime = Date.now();
    
    // Use TypeScript Compiler API for robust parsing without native compilation requirements
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const imports: ImportDeclaration[] = [];
    const classes: ClassDeclaration[] = [];
    const functions: FunctionDeclaration[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const source = (node.moduleSpecifier as ts.StringLiteral).text;
        const isExternal = !source.startsWith('.') && !source.startsWith('/');
        
        // Extract named imports: import { A, B } from '...'
        const importedNames: string[] = [];
        const importClause = node.importClause;
        if (importClause) {
          if (importClause.name) {
            importedNames.push(importClause.name.text); // default import
          }
          if (importClause.namedBindings) {
            if (ts.isNamedImports(importClause.namedBindings)) {
              importClause.namedBindings.elements.forEach(el => {
                importedNames.push(el.name.text);
              });
            } else if (ts.isNamespaceImport(importClause.namedBindings)) {
              importedNames.push(`* as ${importClause.namedBindings.name.text}`);
            }
          }
        }
        
        imports.push({
          source,
          importedNames,
          isExternal,
          startLine: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
        });
      } else if (ts.isClassDeclaration(node) && node.name) {
        const methods: MethodDeclaration[] = [];
        
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            methods.push({
              name: member.name.getText(sourceFile),
              className: node.name.text,
              isAsync: member.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
              startLine: sourceFile.getLineAndCharacterOfPosition(member.getStart()).line + 1,
              endLine: sourceFile.getLineAndCharacterOfPosition(member.getEnd()).line + 1,
            });
          }
        }

        classes.push({
          name: node.name.text,
          isExported: node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false,
          methods,
          startLine: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
        });
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push({
          name: node.name.text,
          isExported: node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false,
          isAsync: node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
          startLine: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          endLine: sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      filePath,
      language: this.language,
      contentHash,
      lineCount: content.split('\n').length,
      byteSize: Buffer.byteLength(content, 'utf8'),
      imports,
      classes,
      functions,
      parseTimeMs: Date.now() - startTime,
    };
  }
}
