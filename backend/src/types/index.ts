export type DocumentStatus = 'processing' | 'ready' | 'failed';
export type UserRole = 'ROLE_USER' | 'ROLE_ADMIN';

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRecord = {
  id: string;
  userId: string | null;
  name: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChunkInsertInput = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber: number | null;
};

export type ChunkSearchResult = {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  score: number;
};

export type QueryResponse = {
  answer: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    snippet: string;
    score: number;
  }>;
  model: string;
  conversationId?: string;
};

export type ConversationRecord = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
};

export type ConversationMessageRecord = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: unknown | null;
  modelName: string | null;
  createdAt: string;
};

export type JwtTokenType = 'ACCESS' | 'REFRESH';

export type AuthClaims = {
  sub: string;
  userId: string;
  email: string;
  scope: UserRole | string;
  tokenType: JwtTokenType;
};
