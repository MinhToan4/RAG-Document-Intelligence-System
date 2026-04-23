import { useCallback, useState } from 'react';
import { deleteConversation, fetchConversationMessages, fetchConversations } from '../lib/api';
import type { ConversationDetailResponse, ConversationSummary } from '../types';

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchConversations();
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      setMessageLoading(true);
      setError(null);
      return await fetchConversationMessages(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setMessageLoading(false);
    }
  }, []);

  const removeConversation = useCallback(async (conversationId: string) => {
    try {
      setError(null);
      await deleteConversation(conversationId);
      setConversations((prev) => prev.filter((item) => item.id !== conversationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const upsertConversation = useCallback((conversation: ConversationSummary) => {
    setConversations((prev) => {
      const exists = prev.find((item) => item.id === conversation.id);
      if (!exists) {
        return [conversation, ...prev];
      }
      const updated = prev.map((item) => (item.id === conversation.id ? conversation : item));
      updated.sort((a, b) => {
        const aTime = a.lastMessageAt ?? a.updatedAt;
        const bTime = b.lastMessageAt ?? b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      return updated;
    });
  }, []);

  return {
    conversations,
    loading,
    messageLoading,
    error,
    loadConversations,
    loadConversationMessages,
    removeConversation,
    upsertConversation,
  };
}

export type ConversationDetail = ConversationDetailResponse;

