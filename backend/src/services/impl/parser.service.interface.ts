export interface IParserService {
  parseFile(storagePath: string, mimeType: string): Promise<string>;
}
