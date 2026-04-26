/**
 * Custom React hook for conversations. Manages feature state, side effects, and API interactions.
 */
import { useCallback, useState } from 'react';
import { deleteConversation, fetchConversationMessages, fetchConversations } from '../lib/api';
import type { ConversationDetailResponse, ConversationSummary } from '../types';

/**
 * Custom React hook for managing chat conversations.
 * Allows fetching the list of conversations, loading messages for a specific conversation,
 * deleting conversations, and upserting an updated conversation into the list.
 *
 * @returns State and methods to interact with conversations
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches the full list of conversation summaries for the current user.
   */
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

  /**
   * Fetches the detailed message history for a given conversation.
   *
   * @param conversationId - The ID of the conversation to load
   * @returns The conversation details and its messages
   */
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

  /**
   * Deletes a conversation from the server and removes it from the local state.
   *
   * @param conversationId - The ID of the conversation to delete
   */
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

  /**
   * Upserts (updates or inserts) a conversation in the local state list.
   * Also re-sorts the list based on the last message timestamp.
   *
   * @param conversation - The conversation summary object to upsert
   */
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

