/**
 * Shared frontend type declarations used across components, hooks, and utilities.
 */
export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type DocumentItem = {
  id: string;
  name: string;
  status: DocumentStatus;
  chunkCount: number;
  createdAt: string;
  updatedAt?: string;
};

export type DocumentListResponse = {
  data: DocumentItem[];
  total: number;
  page: number;
  limit: number;
};

export type QuerySource = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  snippet: string;
  score: number;
};

export type QueryResponse = {
  answer: string;
  sources: QuerySource[];
  model: string;
  conversationId?: string;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: QuerySource[];
  model?: string;
  isStreaming?: boolean;
};

export type ConversationSummary = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: QuerySource[] | null;
  modelName: string | null;
  createdAt: string;
};

export type ConversationDetailResponse = {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
};
