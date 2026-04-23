import { query } from '../config/db.js';
import type { ChunkInsertInput, ChunkSearchResult } from '../types/index.js';

type DbChunkSearchRow = {
  chunk_id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  score: number;
};

type DbChunkRow = {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  page_number: number | null;
  created_at: Date;
};

function toSqlVector(values: number[]): string {
  return `[${values.join(',')}]`;
}

export class ChunkRepository {
  async insertChunks(
    documentId: string,
    chunks: ChunkInsertInput[],
    embeddings: number[][],
  ): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings length mismatch');
    }

    const values: unknown[] = [];
    const rows = chunks.map((chunk, idx) => {
      const base = values.length;
      values.push(
        documentId,
        chunk.chunkIndex,
        chunk.content,
        chunk.tokenCount,
        chunk.pageNumber,
        toSqlVector(embeddings[idx]),
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${
        base + 6
      }::vector)`;
    });

    await query(
      `
      INSERT INTO document_chunks (
        document_id,
        chunk_index,
        content,
        token_count,
        page_number,
        embedding
      )
      VALUES ${rows.join(',\n')}
      ON CONFLICT (document_id, chunk_index) DO UPDATE
      SET content = EXCLUDED.content,
          token_count = EXCLUDED.token_count,
          page_number = EXCLUDED.page_number,
          embedding = EXCLUDED.embedding
      `,
      values,
    );
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
  }

  async listByDocumentId(documentId: string): Promise<DbChunkRow[]> {
    const result = await query<DbChunkRow>(
      `
      SELECT id, chunk_index, content, token_count, page_number, created_at
      FROM document_chunks
      WHERE document_id = $1
      ORDER BY chunk_index ASC
      `,
      [documentId],
    );
    return result.rows;
  }

  async searchSimilar(
    queryEmbedding: number[],
    topK: number,
    userId: string,
    documentIds?: string[],
  ): Promise<ChunkSearchResult[]> {
    const vectorLiteral = toSqlVector(queryEmbedding);
    const hasDocumentFilter = Boolean(documentIds && documentIds.length > 0);

    const sql = hasDocumentFilter
      ? `
        SELECT
          dc.id AS chunk_id,
          dc.document_id,
          d.name AS document_name,
          dc.chunk_index,
          dc.content,
          1 - (dc.embedding <=> $1::vector) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.status = 'ready'
          AND d.user_id = $2::uuid
          AND dc.document_id = ANY($3::uuid[])
        ORDER BY dc.embedding <=> $1::vector
        LIMIT $4
      `
      : `
        SELECT
          dc.id AS chunk_id,
          dc.document_id,
          d.name AS document_name,
          dc.chunk_index,
          dc.content,
          1 - (dc.embedding <=> $1::vector) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.status = 'ready'
          AND d.user_id = $2::uuid
        ORDER BY dc.embedding <=> $1::vector
        LIMIT $3
      `;

    const params = hasDocumentFilter
      ? [vectorLiteral, userId, documentIds, topK]
      : [vectorLiteral, userId, topK];
    const result = await query<DbChunkSearchRow>(sql, params);

    return result.rows.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentName: row.document_name,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: Number(row.score),
    }));
  }
}
