/**
 * Repository for document persistence. Executes SQL operations and maps rows to domain records.
 */
import { query } from '../config/db.js';
import type { DocumentRecord, DocumentStatus } from '../types/index.js';

type CreateDocumentInput = {
  userId: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

type ListDocumentOptions = {
  userId: string;
  page: number;
  limit: number;
  status?: DocumentStatus;
};

type DbDocumentRow = {
  id: string;
  user_id: string | null;
  name: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: Date;
  updated_at: Date;
};

function mapDocument(row: DbDocumentRow): DocumentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: row.chunk_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Repository layer for managing Document records.
 * Provides database abstraction for creating, retrieving, updating, and deleting document metadata.
 */
export class DocumentRepository {
  /**
   * Creates a new document record in the database with an initial 'processing' status.
   *
   * @param input - Metadata about the uploaded document
   * @returns The created DocumentRecord
   */
  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const result = await query<DbDocumentRow>(
      `
      INSERT INTO documents (
        user_id,
        name,
        original_filename,
        mime_type,
        size_bytes,
        storage_path,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'processing')
      RETURNING *
      `,
      [input.userId, input.name, input.originalFilename, input.mimeType, input.sizeBytes, input.storagePath],
    );

    return mapDocument(result.rows[0]);
  }

  /**
   * Finds a specific document by ID, ensuring it belongs to the given user.
   *
   * @param id - The document ID
   * @param userId - The ID of the user requesting the document
   * @returns The DocumentRecord if found and authorized, null otherwise
   */
  async findById(id: string, userId: string): Promise<DocumentRecord | null> {
    const result = await query<DbDocumentRow>(`SELECT * FROM documents WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (result.rowCount === 0) {
      return null;
    }

    return mapDocument(result.rows[0]);
  }

  /**
   * Finds a specific document by ID across the entire system (admin/background job use).
   * Does NOT enforce user isolation.
   *
   * @param id - The document ID
   * @returns The DocumentRecord if found, null otherwise
   */
  async findByIdAny(id: string): Promise<DocumentRecord | null> {
    const result = await query<DbDocumentRow>(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapDocument(result.rows[0]);
  }

  /**
   * Retrieves a paginated list of documents for a specific user, optionally filtered by status.
   *
   * @param options - Pagination and filtering options
   * @returns An object containing the list of documents and the total count
   */
  async list(options: ListDocumentOptions): Promise<{ data: DocumentRecord[]; total: number }> {
    const offset = (options.page - 1) * options.limit;

    const whereClause = options.status ? 'WHERE user_id = $1 AND status = $2' : 'WHERE user_id = $1';
    const listParams = options.status
      ? [options.userId, options.status, options.limit, offset]
      : [options.userId, options.limit, offset];
    const countParams = options.status ? [options.userId, options.status] : [options.userId];

    const listSql = options.status
      ? `
        SELECT * FROM documents
        WHERE user_id = $1
          AND status = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `
      : `
        SELECT * FROM documents
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

    const [listResult, totalResult] = await Promise.all([
      query<DbDocumentRow>(listSql, listParams),
      query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM documents ${whereClause}`, countParams),
    ]);

    return {
      data: listResult.rows.map(mapDocument),
      total: Number(totalResult.rows[0].total),
    };
  }

  /**
   * Updates the processing status and associated metadata of a document.
   *
   * @param id - The document ID
   * @param status - The new status (e.g., 'ready', 'failed')
   * @param options - Optional error messages or chunk counts to update
   */
  async updateStatus(
    id: string,
    status: DocumentStatus,
    options?: { errorMessage?: string | null; chunkCount?: number },
  ): Promise<void> {
    await query(
      `
      UPDATE documents
      SET status = $2,
          error_message = $3,
          chunk_count = COALESCE($4, chunk_count),
          updated_at = NOW()
      WHERE id = $1
      `,
      [id, status, options?.errorMessage ?? null, options?.chunkCount ?? null],
    );
  }

  /**
   * Deletes a document record from the database, validating user ownership.
   *
   * @param id - The document ID
   * @param userId - The ID of the user requesting deletion
   * @returns True if deletion occurred, false if not found or unauthorized
   */
  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await query(`DELETE FROM documents WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
