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

export class IngestionServiceImpl implements IIngestionService {
  constructor(
    private readonly documentRepository = new DocumentRepository(),
    private readonly chunkRepository = new ChunkRepository(),
    private readonly parserService: IParserService = new ParserServiceImpl(),
    private readonly embeddingService: IEmbeddingService = new EmbeddingServiceImpl(),
  ) {}

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

    void this.runIngestion(document.id).catch((error) => {
      logger.error('Background ingestion failed', { documentId: document.id, error });
    });

    return document;
  }

  async runIngestion(documentId: string): Promise<void> {
    const document = await this.documentRepository.findByIdAny(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    await this.documentRepository.updateStatus(documentId, 'processing', { errorMessage: null, chunkCount: 0 });
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

      await this.documentRepository.updateStatus(documentId, 'ready', {
        chunkCount: chunks.length,
        errorMessage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ingestion error';
      await this.documentRepository.updateStatus(documentId, 'failed', { errorMessage: message, chunkCount: 0 });
      throw error;
    }
  }

  async listDocuments(userId: string, params: ListDocumentsInput): Promise<{ data: DocumentRecord[]; total: number }> {
    return this.documentRepository.list({ ...params, userId });
  }

  async getDocumentById(userId: string, id: string): Promise<DocumentRecord | null> {
    return this.documentRepository.findById(id, userId);
  }

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

  async listChunks(userId: string, documentId: string) {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) {
      return [];
    }
    return this.chunkRepository.listByDocumentId(documentId);
  }

  async reprocessDocument(userId: string, documentId: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId, userId);
    if (!document) {
      throw new Error('Document not found');
    }
    void this.runIngestion(documentId).catch((error) => {
      logger.error('Background reprocess failed', { documentId, error });
    });
  }
}
