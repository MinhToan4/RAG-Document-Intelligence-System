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

export class DocumentRepository {
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

  async findById(id: string, userId: string): Promise<DocumentRecord | null> {
    const result = await query<DbDocumentRow>(`SELECT * FROM documents WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (result.rowCount === 0) {
      return null;
    }

    return mapDocument(result.rows[0]);
  }

  async findByIdAny(id: string): Promise<DocumentRecord | null> {
    const result = await query<DbDocumentRow>(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return null;
    }
    return mapDocument(result.rows[0]);
  }

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

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await query(`DELETE FROM documents WHERE id = $1 AND user_id = $2`, [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
