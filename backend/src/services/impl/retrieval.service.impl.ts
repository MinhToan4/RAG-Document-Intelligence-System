/**
 * Service implementation for retrieval operations. Encapsulates domain workflows and provider/repository integration.
 */
import { env } from '../../config/env.js';
import { ChunkRepository } from '../../repositories/chunk.repository.js';
import { DocumentRepository } from '../../repositories/document.repository.js';
import { QueryLogRepository } from '../../repositories/query_log.repository.js';
import type { QueryResponse } from '../../types/index.js';
import {
  buildAvailableDocumentsAnswer,
  detectQuestionLanguage,
  fallbackAnswerForLanguage,
  isListAvailableDocumentsIntent,
} from '../../utils/language.js';
import { EmbeddingServiceImpl } from './embedding.service.impl.js';
import type { IEmbeddingService } from '../interfaces/embedding.service.interface.js';
import { GenerationServiceImpl } from './generation.service.impl.js';
import type { IGenerationService } from '../interfaces/generation.service.interface.js';
import type { AskInput, IRetrievalService } from '../interfaces/retrieval.service.interface.js';

/**
 * Implementation of the Retrieval Service.
 * Coordinates the RAG workflow by taking a user query, generating an embedding,
 * searching the vector database for relevant chunks, and passing them to the generation service.
 */
export class RetrievalServiceImpl implements IRetrievalService {
  constructor(
    private readonly embeddingService: IEmbeddingService = new EmbeddingServiceImpl(),
    private readonly generationService: IGenerationService = new GenerationServiceImpl(),
    private readonly chunkRepository = new ChunkRepository(),
    private readonly documentRepository = new DocumentRepository(),
    private readonly queryLogRepository = new QueryLogRepository(),
  ) { }

  /**
   * Executes a retrieval-augmented generation (RAG) query.
   * Handles special intents (like listing documents), embeds the query, retrieves relevant context chunks,
   * generates an answer using an LLM, and logs the query details.
   *
   * @param input - The query parameters including user question, topK, and history
   * @returns A QueryResponse containing the generated answer, source chunks, and the model used
   */
  async ask(input: AskInput): Promise<QueryResponse> {
    const startMs = Date.now();
    const topK = input.topK ?? env.TOP_K_DEFAULT;
    const questionLanguage = detectQuestionLanguage(input.question);
    const fallbackAnswer = fallbackAnswerForLanguage(questionLanguage);

    if (isListAvailableDocumentsIntent(input.question)) {
      const readyDocuments = await this.documentRepository.list({
        userId: input.userId,
        page: 1,
        limit: 200,
        status: 'ready',
      });

      const answerText = buildAvailableDocumentsAnswer(
        questionLanguage,
        readyDocuments.data.map((document) => document.name),
      );

      this.queryLogRepository.logQuery({
        userId: input.userId,
        question: input.question,
        modelName: 'system',
        topK,
        latencyMs: Date.now() - startMs,
        inputTokens: null,
        outputTokens: null,
        retrievedCount: 0,
        answer: answerText,
        sources: [],
      }).catch((err) => console.error('Failed to log query:', err));

      return {
        answer: answerText,
        sources: [],
        model: 'system',
      };
    }

    const queryEmbedding = await this.embeddingService.embedText(input.question);
    const chunks = await this.chunkRepository.searchSimilar(
      queryEmbedding,
      input.question,
      topK,
      input.userId,
      input.documentIds,
    );

    let answerText = fallbackAnswer;
    let usedModel = env.LLM_MODEL;

    if (chunks.length > 0) {
      const generationResult = await this.generationService.generateAnswer(
        input.question,
        chunks,
        input.history,
        questionLanguage,
      );
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
