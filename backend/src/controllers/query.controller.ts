/**
 * HTTP controller for query endpoints. Validates request payloads and orchestrates backend services.
 */
import { askQueryRequestSchema } from '../dtos/query.dto.js';
import { AppError } from '../utils/app-error.js';
import { ConversationRepository } from '../repositories/conversation.repository.js';
import { QueryLogRepository } from '../repositories/query_log.repository.js';
import { RetrievalServiceImpl } from '../services/impl/retrieval.service.impl.js';
import type { IRetrievalService } from '../services/impl/retrieval.service.interface.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Controller handling RAG queries.
 * Manages user questions, conversation context resolution, query execution against the RAG system,
 * and streaming of responses.
 */
export class QueryController {
  constructor(
    private readonly retrievalService: IRetrievalService = new RetrievalServiceImpl(),
    private readonly conversationRepository = new ConversationRepository(),
    private readonly queryLogRepository = new QueryLogRepository(),
  ) { }

  /**
   * Generates a truncated title for a new conversation based on the user's initial question.
   * Ensures the title doesn't exceed a specific length while maintaining context.
   *
   * @param question - The initial user question
   * @returns A string representing the conversation title
   */
  private buildConversationTitle(question: string): string {
    const normalized = question.trim().replace(/\s+/g, ' ');
    if (normalized.length <= 120) {
      return normalized;
    }
    return `${normalized.slice(0, 117)}...`;
  }

  /**
   * Resolves the conversation context before executing a query.
   * If a conversationId is provided, it validates ownership. If not, it creates a new conversation.
   * It also fetches the historical messages of the conversation to provide context to the LLM.
   *
   * @param input - The user ID, question, optional conversation ID, and history
   * @returns The resolved conversation ID and message history
   */
  private async resolveConversationContext(input: {
    userId: string;
    question: string;
    conversationId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{
    conversationId: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }> {
    // If conversationId is provided, enforce ownership before continuing.
    const existingConversation = input.conversationId
      ? await this.conversationRepository.findByIdForUser(input.conversationId, input.userId)
      : null;

    if (input.conversationId && !existingConversation) {
      throw new AppError('Conversation not found', 404);
    }

    const conversation =
      existingConversation ??
      (await this.conversationRepository.create(input.userId, this.buildConversationTitle(input.question)));

    // Prefer persisted history so model context remains consistent across requests.
    const storedMessages = await this.conversationRepository.listMessages(conversation.id, input.userId);
    const storedHistory = storedMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    if (storedHistory.length > 0) {
      return {
        conversationId: conversation.id,
        history: storedHistory,
      };
    }

    return {
      conversationId: conversation.id,
      history: input.history ?? [],
    };
  }

  /**
   * Core logic for executing a retrieval-augmented generation query.
   * Coordinates context resolution, stores the user's question, calls the retrieval service to get an answer,
   * and stores the assistant's generated response in the conversation history.
   *
   * @param input - The query parameters including user details, question, and optional document filters
   * @returns The generated answer, sources, model used, and conversation ID
   */
  private async executeQuery(input: {
    userId: string;
    question: string;
    conversationId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    documentIds?: string[];
    topK?: number;
  }) {
    // Resolve/create a conversation first, then append the new user turn.
    const context = await this.resolveConversationContext({
      userId: input.userId,
      question: input.question,
      conversationId: input.conversationId,
      history: input.history,
    });

    await this.conversationRepository.addMessage({
      conversationId: context.conversationId,
      role: 'user',
      content: input.question,
    });

    const result = await this.retrievalService.ask({
      userId: input.userId,
      conversationId: context.conversationId,
      question: input.question,
      history: context.history,
      documentIds: input.documentIds,
      topK: input.topK,
    });

    // Persist assistant response so subsequent turns can reuse complete history.
    await this.conversationRepository.addMessage({
      conversationId: context.conversationId,
      role: 'assistant',
      content: result.answer,
      sources: result.sources,
      modelName: result.model,
    });

    return {
      ...result,
      conversationId: context.conversationId,
    };
  }

  /**
   * HTTP endpoint to ask a question synchronously.
   * Validates the request, executes the query, and returns the complete answer at once.
   */
  ask = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const payload = askQueryRequestSchema.parse(req.body);
    const result = await this.executeQuery({
      ...payload,
      userId,
    });
    res.json(result);
  });

  /**
   * HTTP endpoint to ask a question and stream the response via Server-Sent Events (SSE).
   * Useful for long-running generation tasks to provide real-time feedback to the user.
   */
  stream = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const payload = askQueryRequestSchema.parse(req.body);
    const result = await this.executeQuery({
      ...payload,
      userId,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Current streaming mode emits whitespace-preserving pseudo-tokens from final text.
    const tokens = result.answer.split(/(\s+)/).filter((item) => item.length > 0);

    for (const token of tokens) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        sources: result.sources,
        model: result.model,
        conversationId: result.conversationId,
      })}\n\n`,
    );
    res.end();
  });

  /**
   * Retrieves the query history (logs) for the authenticated user.
   * Returns a list of past queries, their answers, and associated metadata.
   */
  history = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const logs = await this.queryLogRepository.findByUserId(userId);
    res.json(logs);
  });

  /**
   * Deletes a specific query history log entry.
   * Requires the ID of the history entry and validates user ownership.
   */
  deleteHistory = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id;
    if (!id) {
      res.status(400).json({ message: 'Missing history id' });
      return;
    }

    const deleted = await this.queryLogRepository.deleteById(id, userId);
    if (!deleted) {
      res.status(404).json({ message: 'History entry not found or unauthorized' });
      return;
    }
    res.json({ success: true });
  });
}
