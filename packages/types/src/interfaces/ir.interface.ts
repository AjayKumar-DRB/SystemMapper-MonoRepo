export enum Language {
  TYPESCRIPT = 'TYPESCRIPT',
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
  GO = 'GO',
  UNKNOWN = 'UNKNOWN',
}

export interface ParsedFile {
  filePath: string;
  language: Language;
  contentHash: string;
  lineCount: number;
  byteSize: number;
  imports: ImportDeclaration[];
  classes: ClassDeclaration[];
  functions: FunctionDeclaration[];
  parseTimeMs: number;
}

export interface ImportDeclaration {
  source: string;
  /** Resolved absolute path within the repo (for relative imports like './v1' → 'src/v1.ts') */
  resolvedSource?: string;
  importedNames: string[];
  isExternal: boolean;
  startLine: number;
  endLine: number;
}

export interface ClassDeclaration {
  name: string;
  isExported: boolean;
  methods: MethodDeclaration[];
  startLine: number;
  endLine: number;
}

export interface FunctionDeclaration {
  name: string;
  isExported: boolean;
  isAsync: boolean;
  startLine: number;
  endLine: number;
}

export interface MethodDeclaration {
  name: string;
  className: string;
  isAsync: boolean;
  startLine: number;
  endLine: number;
}
