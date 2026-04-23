import { useCallback, useState } from 'react';
import { askQuestion } from '../lib/api';
import type { ChatMessage } from '../types';

export function useQuery() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (payload: { question: string; documentIds?: string[]; topK?: number }) => {
    setLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: payload.question,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await askQuestion({
        ...payload,
        conversationId: conversationId ?? undefined,
        history: historyPayload,
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
        model: result.model,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (result.conversationId) {
        setConversationId(result.conversationId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const clearSession = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  const restoreSession = useCallback((newMessages: ChatMessage[], nextConversationId: string | null) => {
    setMessages(newMessages);
    setConversationId(nextConversationId);
    setError(null);
  }, []);

  return {
    messages,
    conversationId,
    loading,
    error,
    submit,
    clearSession,
    restoreSession,
  };
}
