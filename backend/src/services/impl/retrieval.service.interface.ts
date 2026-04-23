import type { QueryResponse } from '../../types/index.js';

export type AskInput = {
  userId: string;
  conversationId?: string;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  topK?: number;
  documentIds?: string[];
};

export interface IRetrievalService {
  ask(input: AskInput): Promise<QueryResponse>;
}
