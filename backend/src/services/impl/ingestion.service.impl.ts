/**
 * Service implementation for ingestion operations. Encapsulates domain workflows and provider/repository integration.
 */
import fs from 'node:fs/promises';
import { env } from '../../config/env.js';
import { ChunkRepository } from '../../repositories/chunk.repository.js';
import { DocumentRepository } from '../../repositories/document.repository.js';
import type { ChunkInsertInput, DocumentRecord } from '../../types/index.js';
import { chunkText } from '../../utils/chunker.js';
import { normalizeUploadedFilename } from '../../utils/filename.js';
import { logger } from '../../utils/logger.js';
import { EmbeddingServiceImpl } from './embedding.service.impl.js';
import type { IEmbeddingService } from './embedding.service.interface.js';
import type { IIngestionService, ListDocumentsInput } from './ingestion.service.interface.js';
import { ParserServiceImpl } from './parser.service.impl.js';
import type { IParserService } from './parser.service.interface.js';

/**
 * Implementation of the Ingestion Service.
 * Handles the complete lifecycle of document ingestion: from initial upload and storage,
 * through parsing, text chunking, and generation of vector embeddings.
 */
export class IngestionServiceImpl implements IIngestionService {
  constructor(
    private readonly documentRepository = new DocumentRepository(),
    private readonly chunkRepository = new ChunkRepository(),
    private readonly parserService: IParserService = new ParserServiceImpl(),
    private readonly embeddingService: IEmbeddingService = new EmbeddingServiceImpl(),
  ) { }

  /**
   * Creates a new document record in the database and triggers the background ingestion process.
   *
   * @param file - The uploaded file object from Express.Multer
   * @param userId - The ID of the user uploading the document
   * @param displayName - Optional custom name for the document
   * @returns The newly created DocumentRecord
   */
  async createAndIngest(file: Express.Multer.File, userId: string, displayName?: string): Promise<DocumentRecord> {
    const normalizedOriginalName = normalizeUploadedFilename(file.originalname);
    const document = await this.documentRepository.create({
      userId,
      name: displayName?.trim() || normalizedOriginalName,
      originalFilename: normalizedOriginalName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: file.path,
    });

    // Ingestion runs in background so upload response stays fast for the client.
    void this.runIngestion(document.id).catch((error) => {
      logger.error('Background ingestion failed', { documentId: document.id, error });
    });

    return document;
  }

  /**
   * Orchestrates the background processing of a document.
   * This includes parsing the file, splitting text into chunks, computing embeddings for each chunk,
   * and saving the chunks to the database. It updates the document's status throughout the process.
   *
   * @param documentId - The UUID of the document to process
   */
  async runIngestion(documentId: string): Promise<void> {
    const document = await this.documentRepository.findByIdAny(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    await this.documentRepository.updateStatus(documentId, 'processing', { errorMessage: null, chunkCount: 0 });
    // Reprocessing must clear previous chunks to avoid mixing stale vectors.
    await this.chunkRepository.deleteByDocumentId(documentId);

    try {
      const rawText = await this.parserService.parseFile(document.storagePath, document.mimeType);
      const chunks = chunkText(rawText, env.CHUNK_SIZE, env.CHUNK_OVERLAP);

      const chunkInputs: ChunkInsertInput[] = chunks.map((item, idx) => ({
        chunkIndex: idx,
        content: item.content,
        tokenCount: item.tokenCount,
        pageNumber: null,
      }));

      const embeddings = await this.embeddingService.embedTexts(chunks.map((item) => item.content));
      await this.chunkRepository.insertChunks(documentId, chunkInputs, embeddings);

      // Mark document ready only after chunks and embeddings are fully persisted.
      await this.documentRepository.updateStatus(documentId, 'ready', {
        chunkCount: chunks.length,
        errorMessage: null,
      });
    } catch (error) {
      // Persist failure reason so UI can display actionable ingestion errors.
      const message = error instanceof Error ? error.message : 'Unknown ingestion error';
      await this.documentRepository.updateStatus(documentId, 'failed', { errorMessage: message, chunkCount: 0 });
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of documents belonging to a specific user.
   *
   * @param userId - The ID of the user
   * @param params - Pagination parameters (page, limit)
   * @returns An object containing the array of documents and the total count
   */
  async listDocuments(userId: string, params: ListDocumentsInput): Promise<{ data: DocumentRecord[]; total: number }> {
    return this.documentRepository.list({ ...params, userId });
  }

  /**
   * Fetches a single document by its ID, ensuring it belongs to the specified user.
   *
   * @param userId - The ID of the user
   * @param id - The ID of the document
   * @returns The DocumentRecord or null if not found
   */
  async getDocumentById(userId: string, id: string): Promise<DocumentRecord | null> {
    return this.documentRepository.findById(id, userId);
  }

  /**
   * Deletes a document record from the database and removes the associated file from the filesystem.
   *
   * @param userId - The ID of the user requesting deletion
   * @param id - The ID of the document to delete
   * @returns True if deletion was successful, false otherwise
   */
  async deleteDocument(userId: string, id: string): Promise<boolean> {
    const document = await this.documentRepository.findById(id, userId);
    if (!document) {
      return false;
    }

    const deleted = await this.documentRepository.deleteById(id, userId);
    if (deleted) {
      await fs.rm(document.storagePath, { force: true });
    }

    return deleted;
  }

  /**
   * Retrieves all processed chunks and their embeddings for a specific document.
   *
   * @param userId - The ID of the user (to verify ownership)
   * @param documentId - The ID of the document
   * @returns An array of chunks associated with the document
   */
  async listChunks(userId: string, documentId: string) {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) {
      return [];
    }
    return this.chunkRepository.listByDocumentId(documentId);
  }

  /**
   * Triggers the ingestion process again for an existing document.
   * Useful when chunking strategies or embedding models have been updated.
   *
   * @param userId - The ID of the user
   * @param documentId - The ID of the document to reprocess
   */
  async reprocessDocument(userId: string, documentId: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) {
      throw new Error('Document not found');
    }
    // Reprocess is also fire-and-forget to keep API latency low.
    void this.runIngestion(documentId).catch((error) => {
      logger.error('Background reprocess failed', { documentId, error });
    });
  }
}
