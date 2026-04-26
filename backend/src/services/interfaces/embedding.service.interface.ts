/**
 * Service contract for embedding operations. Defines behavior required by higher-level modules.
 */
export interface IEmbeddingService {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}