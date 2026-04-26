/**
 * Repository for conversation persistence. Executes SQL operations and maps rows to domain records.
 */
import { query } from '../config/db.js';
import type { ConversationMessageRecord, ConversationRecord } from '../types/index.js';

type DbConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
  message_count: string;
};

type DbConversationMessageRow = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: unknown | null;
  model_name: string | null;
  created_at: Date;
};

function mapConversation(row: DbConversationRow): ConversationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastMessageAt: row.last_message_at ? row.last_message_at.toISOString() : null,
    messageCount: Number(row.message_count),
  };
}

function toJsonParameter(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function mapMessage(row: DbConversationMessageRow): ConversationMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    sources: row.sources,
    modelName: row.model_name,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Repository layer for managing Chat Conversations and Messages.
 * Provides abstraction for inserting and fetching conversation histories from PostgreSQL.
 */
export class ConversationRepository {
  /**
   * Creates a new conversation thread for a given user.
   *
   * @param userId - The UUID of the user creating the conversation
   * @param title - The auto-generated or user-provided title of the conversation
   * @returns The newly created ConversationRecord
   */
  async create(userId: string, title: string): Promise<ConversationRecord> {
    const result = await query<DbConversationRow>(
      `
      WITH inserted AS (
        INSERT INTO conversations (user_id, title)
        VALUES ($1, $2)
        RETURNING *
      )
      SELECT
        i.*,
        NULL::timestamptz AS last_message_at,
        '0'::text AS message_count
      FROM inserted i
      `,
      [userId, title],
    );
    return mapConversation(result.rows[0]);
  }

  /**
   * Retrieves a specific conversation by ID, verifying that it belongs to the specified user.
   * Joins with the messages table to calculate the last message timestamp and message count.
   *
   * @param conversationId - The UUID of the conversation
   * @param userId - The UUID of the user (for authorization)
   * @returns The ConversationRecord if found, null otherwise
   */
  async findByIdForUser(conversationId: string, userId: string): Promise<ConversationRecord | null> {
    const result = await query<DbConversationRow>(
      `
      SELECT
        c.*,
        MAX(m.created_at) AS last_message_at,
        COUNT(*) FILTER (WHERE m.role = 'user')::text AS message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.id = $1
        AND c.user_id = $2
      GROUP BY c.id
      `,
      [conversationId, userId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return mapConversation(result.rows[0]);
  }

  /**
   * Lists all conversations belonging to a user, ordered by the most recent activity.
   *
   * @param userId - The UUID of the user
   * @returns An array of ConversationRecords
   */
  async listByUser(userId: string): Promise<ConversationRecord[]> {
    const result = await query<DbConversationRow>(
      `
      SELECT
        c.*,
        MAX(m.created_at) AS last_message_at,
        COUNT(*) FILTER (WHERE m.role = 'user')::text AS message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY COALESCE(MAX(m.created_at), c.updated_at) DESC
      `,
      [userId],
    );
    return result.rows.map(mapConversation);
  }

  /**
   * Appends a new message (either from the user or the assistant) to a conversation.
   * Automatically updates the conversation's `updated_at` timestamp.
   *
   * @param input - The payload containing the message details (role, content, context sources, etc.)
   */
  async addMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: unknown;
    modelName?: string;
  }): Promise<void> {
    await query(
      `
      INSERT INTO messages (conversation_id, role, content, sources, model_name)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        input.conversationId,
        input.role,
        input.content,
        toJsonParameter(input.sources),
        input.modelName ?? null,
      ],
    );

    await query(
      `
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [input.conversationId],
    );
  }

  /**
   * Retrieves the full chronological message history of a specific conversation.
   * Ensures the conversation belongs to the requesting user before returning data.
   *
   * @param conversationId - The UUID of the conversation
   * @param userId - The UUID of the requesting user
   * @returns An array of ConversationMessageRecords representing the chat history
   */
  async listMessages(conversationId: string, userId: string): Promise<ConversationMessageRecord[]> {
    const result = await query<DbConversationMessageRow>(
      `
      SELECT
        m.id,
        m.conversation_id,
        m.role,
        m.content,
        m.sources,
        m.model_name,
        m.created_at
      FROM messages m
      INNER JOIN conversations c ON c.id = m.conversation_id
      WHERE m.conversation_id = $1
        AND c.user_id = $2
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [conversationId, userId],
    );
    return result.rows.map(mapMessage);
  }

  /**
   * Deletes a conversation and cascaded messages from the database.
   *
   * @param conversationId - The UUID of the conversation to delete
   * @param userId - The UUID of the requesting user (for authorization)
   * @returns True if deletion occurred, false otherwise
   */
  async deleteById(conversationId: string, userId: string): Promise<boolean> {
    const result = await query(
      `
      DELETE FROM conversations
      WHERE id = $1
        AND user_id = $2
      `,
      [conversationId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
