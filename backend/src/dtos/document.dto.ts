/**
 * DTO and validation schema module for document payloads.
 */
import { z } from 'zod';
import type { DocumentRecord } from '../types/index.js';

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['processing', 'ready', 'failed']).optional(),
});

export const uploadDocumentBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});

export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>;
export type UploadDocumentBodyDto = z.infer<typeof uploadDocumentBodySchema>;

export type DocumentSummaryDto = {
  id: string;
  name: string;
  status: 'processing' | 'ready' | 'failed';
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ListDocumentsResponseDto = {
  data: DocumentSummaryDto[];
  total: number;
  page: number;
  limit: number;
};

export type UploadDocumentResponseDto = {
  id: string;
  name: string;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
};

export function toDocumentSummaryDto(document: DocumentRecord): DocumentSummaryDto {
  return {
    id: document.id,
    name: document.name,
    status: document.status,
    chunkCount: document.chunkCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toUploadDocumentResponseDto(document: DocumentRecord): UploadDocumentResponseDto {
  return {
    id: document.id,
    name: document.name,
    status: document.status,
    createdAt: document.createdAt,
  };
}
