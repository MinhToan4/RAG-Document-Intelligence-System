import type {
  AuthResponse,
  AuthUser,
  ConversationDetailResponse,
  ConversationSummary,
  DocumentListResponse,
  QueryResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const ACCESS_TOKEN_KEY = 'rag.access_token';
const REFRESH_TOKEN_KEY = 'rag.refresh_token';
const USER_KEY = 'rag.user';
const AUTH_META_KEY = 'rag.auth_meta';
export const AUTH_SESSION_EXPIRED_EVENT = 'rag:auth-session-expired';

type AuthMeta = {
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

type ApiErrorShape = {
  message?: string;
};

async function extractErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `Request failed with ${response.status}`;
  }

  try {
    const payload = JSON.parse(text) as ApiErrorShape;
    if (payload.message && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch {
    // The server may return plain text for some endpoints.
  }

  return text;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return (await response.json()) as T;
}

async function parseAuthJson<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    clearAuth({ notifySessionExpired: true });
    throw new Error('Session expired. Please sign in again.');
  }
  return parseJson<T>(response);
}

function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function buildAuthHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getStoredAccessToken();
  if (!token) {
    return extra ?? {};
  }
  return {
    ...(extra ?? {}),
    Authorization: `Bearer ${token}`,
  };
}

function persistAuth(payload: AuthResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  const now = Date.now();
  localStorage.setItem(
    AUTH_META_KEY,
    JSON.stringify({
      accessTokenExpiresAt: now + payload.accessTokenExpiresIn * 1000,
      refreshTokenExpiresAt: now + payload.refreshTokenExpiresIn * 1000,
    } satisfies AuthMeta),
  );
}

export function getCurrentUser(): AuthUser | null {
  const meta = getAuthMeta();
  if (meta && meta.accessTokenExpiresAt <= Date.now()) {
    return null;
  }

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getAuthMeta(): AuthMeta | null {
  const raw = localStorage.getItem(AUTH_META_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthMeta;
    if (typeof parsed.accessTokenExpiresAt !== 'number' || typeof parsed.refreshTokenExpiresAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuth(options?: { notifySessionExpired?: boolean }) {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(AUTH_META_KEY);

  if (options?.notifySessionExpired) {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson<AuthResponse>(response);
  persistAuth(parsed);
  return parsed;
}

export async function login(payload: { username: string; password: string }): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const parsed = await parseJson<AuthResponse>(response);
  persistAuth(parsed);
  return parsed;
}

async function requestWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    clearAuth({ notifySessionExpired: true });
  }
  return response;
}

export async function updateProfile(payload: { fullName: string; password?: string }): Promise<AuthUser> {
  const response = await requestWithAuth(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  const user = await parseAuthJson<AuthUser>(response);
  const authLocal = localStorage.getItem(USER_KEY);
  if (authLocal) {
    try {
      const userLocal = JSON.parse(authLocal);
      const newUser = { ...userLocal, ...user };
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    } catch {
      // Ignored
    }
  }
  return user;
}

export async function fetchDocuments(): Promise<DocumentListResponse> {
  const response = await requestWithAuth(`${API_BASE}/api/documents?page=1&limit=50`, {
    headers: buildAuthHeaders(),
  });
  return parseAuthJson<DocumentListResponse>(response);
}

export async function uploadDocument(file: File, name?: string): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  if (name && name.trim().length > 0) {
    form.append('name', name.trim());
  }

  const response = await requestWithAuth(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: form,
  });

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await requestWithAuth(`${API_BASE}/api/documents/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });
  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
}

export async function askQuestion(payload: {
  question: string;
  conversationId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  documentIds?: string[];
  topK?: number;
}): Promise<QueryResponse> {
  const response = await requestWithAuth(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  return parseAuthJson<QueryResponse>(response);
}

export async function askQuestionStream(
  payload: {
    question: string;
    conversationId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    documentIds?: string[];
    topK?: number;
  },
  onToken: (token: string) => void,
  onComplete: (data: { sources: unknown; model: string; conversationId: string }) => void,
  onError: (error: Error) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/query/stream`, {
    method: 'POST',
    headers: buildAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    clearAuth({ notifySessionExpired: true });
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6); // Remove 'data: ' prefix
            const data = JSON.parse(jsonStr);

            if (data.done) {
              onComplete({
                sources: data.sources,
                model: data.model,
                conversationId: data.conversationId,
              });
            } else if (data.token) {
              onToken(data.token);
            }
          } catch (err) {
            console.error('Failed to parse SSE event:', err);
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const jsonStr = buffer.slice(6);
        const data = JSON.parse(jsonStr);
        if (data.done) {
          onComplete({
            sources: data.sources,
            model: data.model,
            conversationId: data.conversationId,
          });
        } else if (data.token) {
          onToken(data.token);
        }
      } catch (err) {
        console.error('Failed to parse final SSE event:', err);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error during streaming');
    onError(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function fetchQueryLogs(): Promise<unknown> {
  const response = await requestWithAuth(`${API_BASE}/api/query/history`, {
    headers: buildAuthHeaders(),
  });
  return parseAuthJson<unknown>(response);
}

export async function deleteQueryLog(id: string): Promise<void> {
  const response = await requestWithAuth(`${API_BASE}/api/query/history/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });
  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }
  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const parsedError = JSON.parse(errorBody);
      if (parsedError.message) {
        errorMessage = parsedError.message;
      }
    } catch {
      // Ignored
    }
    throw new Error(errorMessage);
  }
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const response = await requestWithAuth(`${API_BASE}/api/conversations`, {
    headers: buildAuthHeaders(),
  });
  return parseAuthJson<ConversationSummary[]>(response);
}

export async function fetchConversationMessages(conversationId: string): Promise<ConversationDetailResponse> {
  const response = await requestWithAuth(`${API_BASE}/api/conversations/${conversationId}/messages`, {
    headers: buildAuthHeaders(),
  });
  return parseAuthJson<ConversationDetailResponse>(response);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await requestWithAuth(`${API_BASE}/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });
  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
}
