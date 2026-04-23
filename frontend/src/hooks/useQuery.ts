import { useCallback, useEffect, useRef, useState } from 'react';
import { askQuestion } from '../lib/api';
import type { ChatMessage } from '../types';

function splitAnswerIntoChunks(answer: string): string[] {
  const normalized = answer.replace(/\r\n/g, '\n');
  const tokens = normalized.match(/\S+\s*/g);

  if (!tokens || tokens.length === 0) {
    return normalized ? [normalized] : [];
  }

  const wordCount = tokens.length;
  const burstSize = wordCount > 220 ? 10 : wordCount > 120 ? 7 : wordCount > 60 ? 5 : 3;

  const chunks: string[] = [];
  let currentChunk = '';
  let wordsInChunk = 0;

  for (const token of tokens) {
    currentChunk += token;
    if (/\S/.test(token.trim())) {
      wordsInChunk += 1;
    }

    if (wordsInChunk >= burstSize || /[.!?]\s*$/.test(currentChunk) || /\n\s*$/.test(currentChunk)) {
      chunks.push(currentChunk);
      currentChunk = '';
      wordsInChunk = 0;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function getChunkDelay(totalWordCount: number, chunkSize: number): number {
  const baseDelay = totalWordCount > 220 ? 16 : totalWordCount > 120 ? 20 : totalWordCount > 60 ? 26 : 34;
  return Math.min(85, baseDelay + Math.max(0, chunkSize - 1) * 4);
}

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

  const updateAssistantMessage = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((previous) =>
        previous.map((message) => (message.id === messageId ? updater(message) : message)),
      );
    },
    [],
  );

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

      const result = await askQuestion({
        ...payload,
        conversationId: conversationId ?? undefined,
        history: historyPayload,
      });

      if (activeRequestIdRef.current !== requestId || !mountedRef.current) {
        return;
      }

      const chunks = splitAnswerIntoChunks(result.answer);
      const totalWordCount = chunks.reduce(
        (count, chunk) => count + chunk.trim().split(/\s+/).filter(Boolean).length,
        0,
      );

      if (chunks.length === 0) {
        updateAssistantMessage(assistantMessageId, (message) => ({
          ...message,
          content: result.answer,
          sources: result.sources,
          model: result.model,
          isStreaming: false,
        }));
      } else {
        let renderedAnswer = '';

        for (const chunk of chunks) {
          if (activeRequestIdRef.current !== requestId || !mountedRef.current) {
            return;
          }

          renderedAnswer += chunk;
          updateAssistantMessage(assistantMessageId, (message) => ({
            ...message,
            content: renderedAnswer,
            sources: result.sources,
            model: result.model,
            isStreaming: true,
          }));

          if (renderedAnswer.length < result.answer.length) {
            const delay = getChunkDelay(totalWordCount, chunk.trim().split(/\s+/).filter(Boolean).length);
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, delay);
            });
          }
        }

        updateAssistantMessage(assistantMessageId, (message) => ({
          ...message,
          content: result.answer,
          sources: result.sources,
          model: result.model,
          isStreaming: false,
        }));
      }

      if (result.conversationId && activeRequestIdRef.current === requestId) {
        setConversationId(result.conversationId);
      }
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

  const clearSession = useCallback(() => {
    activeRequestIdRef.current += 1;
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

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
