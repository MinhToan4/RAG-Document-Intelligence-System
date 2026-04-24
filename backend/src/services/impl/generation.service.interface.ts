import type { ChunkSearchResult } from '../../types/index.js';
import type { SupportedQuestionLanguage } from '../../utils/language.js';

export type GenerationResult = {
  answer: string;
  model: string;
};

export interface IGenerationService {
  generateAnswer(
    question: string,
    chunks: ChunkSearchResult[],
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    language?: SupportedQuestionLanguage,
  ): Promise<GenerationResult>;
}
