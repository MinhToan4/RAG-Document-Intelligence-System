/**
 * HTTP controller for conversation endpoints. Validates request payloads and orchestrates backend services.
 */
import { ConversationRepository } from '../repositories/conversation.repository.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Controller handling user conversations.
 * Responsible for listing conversations, retrieving messages within a conversation, and deleting conversations.
 */
export class ConversationController {
  constructor(private readonly conversationRepository = new ConversationRepository()) {}

  /**
   * Retrieves a list of all conversations for the authenticated user.
   * Requires a valid user session.
   */
  list = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const conversations = await this.conversationRepository.listByUser(userId);
    res.json(conversations);
  });

  /**
   * Retrieves all messages for a specific conversation.
   * Validates user authorization and ensures the conversation belongs to the user before returning the messages.
   */
  listMessages = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const conversationId = req.params.id;
    if (!conversationId) {
      res.status(400).json({ message: 'Missing conversation id' });
      return;
    }

    const conversation = await this.conversationRepository.findByIdForUser(conversationId, userId);
    if (!conversation) {
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    const messages = await this.conversationRepository.listMessages(conversationId, userId);
    res.json({
      conversation,
      messages,
    });
  });

  /**
   * Deletes a specific conversation by ID.
   * Ensures that the conversation belongs to the authenticated user before deletion.
   */
  delete = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const conversationId = req.params.id;
    if (!conversationId) {
      res.status(400).json({ message: 'Missing conversation id' });
      return;
    }

    const deleted = await this.conversationRepository.deleteById(conversationId, userId);
    if (!deleted) {
      res.status(404).json({ message: 'Conversation not found or unauthorized' });
      return;
    }

    res.json({ success: true });
  });
}

