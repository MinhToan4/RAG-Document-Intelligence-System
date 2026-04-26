/**
 * HTTP controller for document endpoints. Validates request payloads and orchestrates backend services.
 */
import {
  listDocumentsQuerySchema,
  toDocumentSummaryDto,
  toUploadDocumentResponseDto,
  uploadDocumentBodySchema,
} from '../dtos/document.dto.js';
import { IngestionServiceImpl } from '../services/impl/ingestion.service.impl.js';
import type { IIngestionService } from '../services/interfaces/ingestion.service.interface.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Controller handling document ingestion, retrieval, and management.
 * Provides endpoints to upload files, list processed documents, get document details, and manage document chunks.
 */
export class DocumentController {
  constructor(private readonly ingestionService: IIngestionService = new IngestionServiceImpl()) { }

  /**
   * Handles uploading and ingesting a new document.
   * Requires a file upload and associated metadata. It parses, chunks, and stores the document vectors.
   */
  upload = asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: 'file is required' });
      return;
    }

    const body = uploadDocumentBodySchema.parse(req.body);
    const name = body.name;
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const created = await this.ingestionService.createAndIngest(req.file, userId, name);

    res.status(201).json(toUploadDocumentResponseDto(created));
  });

  /**
   * Retrieves a paginated list of documents uploaded by the authenticated user.
   */
  list = asyncHandler(async (req, res) => {
    const parsed = listDocumentsQuerySchema.parse(req.query);
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const result = await this.ingestionService.listDocuments(userId, parsed);

    res.json({
      data: result.data.map(toDocumentSummaryDto),
      total: result.total,
      page: parsed.page,
      limit: parsed.limit,
    });
  });

  /**
   * Fetches detailed information for a specific document by its ID.
   * Validates user ownership of the document.
   */
  detail = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const document = await this.ingestionService.getDocumentById(userId, id);

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.json(document);
  });

  /**
   * Deletes a specific document and its associated chunks from the system.
   * Checks for ownership before performing the deletion.
   */
  remove = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const deleted = await this.ingestionService.deleteDocument(userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.status(204).send();
  });

  /**
   * Retrieves all processed chunks and their embeddings for a given document.
   * This is useful for analyzing how the document was split during ingestion.
   */
  chunks = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const document = await this.ingestionService.getDocumentById(userId, req.params.id);
    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    const chunks = await this.ingestionService.listChunks(userId, req.params.id);
    res.json({
      documentId: req.params.id,
      count: chunks.length,
      data: chunks,
    });
  });

  /**
   * Triggers a reprocessing of an existing document.
   * This can be used if the chunking strategy or embedding model changes, and the document needs to be re-analyzed.
   */
  reprocess = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const document = await this.ingestionService.getDocumentById(userId, req.params.id);
    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    await this.ingestionService.reprocessDocument(userId, req.params.id);
    res.json({
      id: req.params.id,
      status: 'processing',
      message: 'Reprocessing started',
    });
  });
}
