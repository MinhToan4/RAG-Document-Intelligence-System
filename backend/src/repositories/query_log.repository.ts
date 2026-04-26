/**
 * Repository for query log persistence. Executes SQL operations and maps rows to domain records.
 */
import { query } from '../config/db.js';

export type QueryLogRecord = {
  id: string;
  userId: string | null;
  question: string;
  modelName: string;
  topK: number;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  retrievedCount: number;
  answer: string | null;
  sources: any | null;
  createdAt: string;
};

type DbQueryLogRow = {
  id: string;
  user_id: string | null;
  question: string;
  model_name: string;
  top_k: number;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  retrieved_count: number;
  answer: string | null;
  sources: any | null;
  created_at: Date;
};

/**
 * Repository layer for persisting analytical logs of user queries.
 * Records latency, tokens used, retrieved chunks, and the generated answers for monitoring and history purposes.
 */
export class QueryLogRepository {
  /**
   * Inserts a new log entry into the query_logs table asynchronously.
   *
   * @param input - The query execution metrics and context
   */
  async logQuery(input: Omit<QueryLogRecord, 'id' | 'createdAt'>): Promise<void> {
    await query(
      `
      INSERT INTO query_logs (user_id, question, model_name, top_k, latency_ms, input_tokens, output_tokens, retrieved_count, answer, sources)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        input.userId ?? null,
        input.question,
        input.modelName,
        input.topK,
        input.latencyMs,
        input.inputTokens ?? null,
        input.outputTokens ?? null,
        input.retrievedCount,
        input.answer ?? null,
        input.sources !== undefined ? JSON.stringify(input.sources) : null,
      ]
    );
  }

  /**
   * Retrieves the recent query history for a specific user.
   * Limited to the 100 most recent queries for performance.
   *
   * @param userId - The UUID of the user
   * @returns An array of QueryLogRecords representing past queries
   */
  async findByUserId(userId: string): Promise<QueryLogRecord[]> {
    const result = await query<DbQueryLogRow>(
      `
      SELECT *
      FROM query_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      question: row.question,
      modelName: row.model_name,
      topK: row.top_k,
      latencyMs: row.latency_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      retrievedCount: row.retrieved_count,
      answer: row.answer,
      sources: row.sources,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Deletes a specific query log entry, ensuring it belongs to the requesting user.
   *
   * @param id - The UUID of the query log to delete
   * @param userId - The UUID of the requesting user
   * @returns True if deletion was successful, false otherwise
   */
  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await query(
      `
      DELETE FROM query_logs
      WHERE id = $1 AND user_id = $2
      `,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
