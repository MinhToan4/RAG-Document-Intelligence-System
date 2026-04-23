import type { DocumentRecord, DocumentStatus } from '../../types/index.js';

export type ListDocumentsInput = {
  page: number;
  limit: number;
  status?: DocumentStatus;
};

export interface IIngestionService {
  createAndIngest(file: Express.Multer.File, userId: string, displayName?: string): Promise<DocumentRecord>;
  runIngestion(documentId: string): Promise<void>;
  listDocuments(userId: string, params: ListDocumentsInput): Promise<{ data: DocumentRecord[]; total: number }>;
  getDocumentById(userId: string, id: string): Promise<DocumentRecord | null>;
  deleteDocument(userId: string, id: string): Promise<boolean>;
  listChunks(userId: string, documentId: string): Promise<
    Array<{
      id: string;
      chunk_index: number;
      content: string;
      token_count: number | null;
      page_number: number | null;
      created_at: Date;
    }>
  >;
  reprocessDocument(userId: string, documentId: string): Promise<void>;
}
