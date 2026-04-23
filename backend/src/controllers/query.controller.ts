import { askQueryRequestSchema } from '../dtos/query.dto.js';
import { QueryLogRepository } from '../repositories/query_log.repository.js';
import { RetrievalServiceImpl } from '../services/impl/retrieval.service.impl.js';
import type { IRetrievalService } from '../services/impl/retrieval.service.interface.js';
import { asyncHandler } from '../utils/async-handler.js';

export class QueryController {
  constructor(
    private readonly retrievalService: IRetrievalService = new RetrievalServiceImpl(),
    private readonly queryLogRepository = new QueryLogRepository(),
  ) {}

  ask = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const payload = askQueryRequestSchema.parse(req.body);
    const result = await this.retrievalService.ask({
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
    const result = await this.retrievalService.ask({
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

    res.write(`data: ${JSON.stringify({ done: true, sources: result.sources, model: result.model })}\n\n`);
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
