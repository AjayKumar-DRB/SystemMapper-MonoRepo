import { ILanguageParser } from '../interfaces/language-parser.interface';
import { TypeScriptExtractor } from '../extractors/typescript.extractor';
import { Language } from '@systemmapper/types';
import path from 'path';

export class LanguageRegistry {
  private parsers: Map<Language, ILanguageParser> = new Map();
  private extensionMap: Map<string, Language> = new Map();

  constructor() {
    this.registerParser(new TypeScriptExtractor(), ['.ts', '.tsx']);
  }

  private registerParser(parser: ILanguageParser, extensions: string[]) {
    this.parsers.set(parser.language, parser);
    for (const ext of extensions) {
      this.extensionMap.set(ext, parser.language);
    }
  }

  public detectLanguage(filePath: string): Language {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap.get(ext) || Language.UNKNOWN;
  }

  public getParser(language: Language): ILanguageParser | undefined {
    return this.parsers.get(language);
  }
}
