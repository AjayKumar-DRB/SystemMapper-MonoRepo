import { ParsedFile, Language } from '@systemmapper/types';

export interface ILanguageParser {
  /**
   * Identifies the language this parser handles.
   */
  readonly language: Language;

  /**
   * Parses the source code string into the Canonical IR format.
   * @param filePath The path to the file (used for metadata)
   * @param content The raw source code string
   */
  parse(filePath: string, content: string): ParsedFile;
}
