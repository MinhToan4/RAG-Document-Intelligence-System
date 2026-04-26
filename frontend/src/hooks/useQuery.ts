/**
 * Custom React hook for query execution. Manages feature state, side effects, and API interactions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { askQuestion, askQuestionStream } from '../lib/api';
import type { ChatMessage } from '../types';

/**
 * Custom React hook for managing RAG queries and chat conversations.
 * Handles maintaining conversation state, sending questions to the API via streaming,
 * and updating the chat UI progressively as the answer is generated.
 *
 * @returns State and methods to interact with the query system.
 */
export function useQuery() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestIdRef.current += 1;
    };
  }, []);

  /**
   * Utility to update a specific assistant message in the conversation history.
   *
   * @param messageId - The ID of the message to update
   * @param updater - A callback function that modifies the current message state
   */
  const updateAssistantMessage = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((previous) =>
        previous.map((message) => (message.id === messageId ? updater(message) : message)),
      );
    },
    [],
  );

  /**
   * Submits a new question to the backend and handles the streamed response.
   * Updates the local message history progressively as new tokens arrive.
   *
   * @param payload - The query parameters containing the question, optional specific documents, and topK chunks
   */
  const submit = async (payload: { question: string; documentIds?: string[]; topK?: number }) => {
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: payload.question,
    };

    const assistantMessageId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      },
    ]);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let renderedAnswer = '';

      await askQuestionStream(
        {
          ...payload,
          conversationId: conversationId ?? undefined,
          history: historyPayload,
        },
        (token) => {
          // Handle incoming token in real-time
          if (activeRequestIdRef.current !== requestId || !mountedRef.current) {
            return;
          }

          renderedAnswer += token;
          updateAssistantMessage(assistantMessageId, (message) => ({
            ...message,
            content: renderedAnswer,
            isStreaming: true,
          }));
        },
        (completeData) => {
          // Handle stream completion with metadata
          if (activeRequestIdRef.current !== requestId || !mountedRef.current) {
            return;
          }

          updateAssistantMessage(assistantMessageId, (message) => ({
            ...message,
            content: renderedAnswer,
            sources: completeData.sources,
            model: completeData.model,
            isStreaming: false,
          }));

          if (completeData.conversationId && activeRequestIdRef.current === requestId) {
            setConversationId(completeData.conversationId);
          }
        },
        (error) => {
          // Handle stream error
          if (activeRequestIdRef.current !== requestId || !mountedRef.current) {
            return;
          }
          console.error('Stream error:', error);
          setError(error.message);
          setMessages((previous) => previous.filter((message) => message.id !== assistantMessageId));
        },
      );
    } catch (err) {
      setMessages((previous) => previous.filter((message) => message.id !== assistantMessageId));
      const message = err instanceof Error ? err.message : 'Query failed';
      setError(message);
    } finally {
      if (activeRequestIdRef.current === requestId && mountedRef.current) {
        setLoading(false);
      }
    }
  };

  /**
   * Clears the current active conversation session and resets message history.
   */
  const clearSession = useCallback(() => {
    activeRequestIdRef.current += 1;
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  /**
   * Restores a previously saved conversation session into the active view.
   *
   * @param newMessages - The array of historical messages to restore
   * @param nextConversationId - The ID of the conversation to restore
   */
  const restoreSession = useCallback((newMessages: ChatMessage[], nextConversationId: string | null) => {
    activeRequestIdRef.current += 1;
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
