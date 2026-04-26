/**
 * Service contract for parser operations. Defines behavior required by higher-level modules.
 */
export interface IParserService {
    parseFile(storagePath: string, mimeType: string): Promise<string>;
}