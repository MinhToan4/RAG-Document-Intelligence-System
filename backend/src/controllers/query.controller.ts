import { askQueryRequestSchema } from '../dtos/query.dto.js';
import { AppError } from '../utils/app-error.js';
import { ConversationRepository } from '../repositories/conversation.repository.js';
import { QueryLogRepository } from '../repositories/query_log.repository.js';
import { RetrievalServiceImpl } from '../services/impl/retrieval.service.impl.js';
import type { IRetrievalService } from '../services/impl/retrieval.service.interface.js';
import { asyncHandler } from '../utils/async-handler.js';

export class QueryController {
  constructor(
    private readonly retrievalService: IRetrievalService = new RetrievalServiceImpl(),
    private readonly conversationRepository = new ConversationRepository(),
    private readonly queryLogRepository = new QueryLogRepository(),
  ) {}

  private buildConversationTitle(question: string): string {
    const normalized = question.trim().replace(/\s+/g, ' ');
    if (normalized.length <= 120) {
      return normalized;
    }
    return `${normalized.slice(0, 117)}...`;
  }

  private async resolveConversationContext(input: {
    userId: string;
    question: string;
    conversationId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{
    conversationId: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }> {
    const existingConversation = input.conversationId
      ? await this.conversationRepository.findByIdForUser(input.conversationId, input.userId)
      : null;

    if (input.conversationId && !existingConversation) {
      throw new AppError('Conversation not found', 404);
    }

    const conversation =
      existingConversation ??
      (await this.conversationRepository.create(input.userId, this.buildConversationTitle(input.question)));

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

  private async executeQuery(input: {
    userId: string;
    question: string;
    conversationId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    documentIds?: string[];
    topK?: number;
  }) {
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

  history = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const logs = await this.queryLogRepository.findByUserId(userId);
    res.json(logs);
  });

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
