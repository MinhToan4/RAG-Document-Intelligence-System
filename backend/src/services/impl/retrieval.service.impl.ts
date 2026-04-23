import { env } from '../../config/env.js';
import { ChunkRepository } from '../../repositories/chunk.repository.js';
import { QueryLogRepository } from '../../repositories/query_log.repository.js';
import type { QueryResponse } from '../../types/index.js';
import { EmbeddingServiceImpl } from './embedding.service.impl.js';
import type { IEmbeddingService } from './embedding.service.interface.js';
import { GenerationServiceImpl } from './generation.service.impl.js';
import type { IGenerationService } from './generation.service.interface.js';
import type { AskInput, IRetrievalService } from './retrieval.service.interface.js';

export class RetrievalServiceImpl implements IRetrievalService {
  constructor(
    private readonly embeddingService: IEmbeddingService = new EmbeddingServiceImpl(),
    private readonly generationService: IGenerationService = new GenerationServiceImpl(),
    private readonly chunkRepository = new ChunkRepository(),
    private readonly queryLogRepository = new QueryLogRepository(),
  ) { }

  async ask(input: AskInput): Promise<QueryResponse> {
    const startMs = Date.now();
    const topK = input.topK ?? env.TOP_K_DEFAULT;
    const queryEmbedding = await this.embeddingService.embedText(input.question);
    const chunks = await this.chunkRepository.searchSimilar(
      queryEmbedding,
      input.question,
      topK,
      input.userId,
      input.documentIds,
    );

    let answerText = 'No relevant information was found in the provided documents.';
    let usedModel = env.LLM_MODEL;

    if (chunks.length > 0) {
      const generationResult = await this.generationService.generateAnswer(input.question, chunks, input.history);
      answerText = generationResult.answer;
      usedModel = generationResult.model;
    }

    const latencyMs = Date.now() - startMs;

    const formattedSources = chunks.map((chunk) => ({
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      snippet: chunk.content.slice(0, 220),
      score: Number(chunk.score.toFixed(4)),
    }));

    // Run logging asynchronously to avoid blocking the user response
    this.queryLogRepository.logQuery({
      userId: input.userId,
      question: input.question,
      modelName: usedModel,
      topK,
      latencyMs,
      inputTokens: null, // Hard to capture uniformly across providers for streaming
      outputTokens: null,
      retrievedCount: chunks.length,
      answer: answerText,
      sources: formattedSources,
    }).catch(err => console.error('Failed to log query:', err));

    return {
      answer: answerText,
      sources: formattedSources,
      model: usedModel,
    };
  }
}
