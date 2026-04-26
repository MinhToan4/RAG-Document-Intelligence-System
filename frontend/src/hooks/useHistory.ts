/**
 * Custom React hook for query history. Manages feature state, side effects, and API interactions.
 */
import { useState, useCallback } from 'react';
import { fetchQueryLogs } from '../lib/api';
import type { QuerySource } from '../types';

/**
 * Custom React hook for managing the user's query history.
 * Handles fetching the analytical logs of past queries and deleting specific logs.
 *
 * @returns State and methods to interact with query logs
 */
export type QueryLog = {
  id: string;
  question: string;
  modelName: string;
  topK: number;
  latencyMs: number;
  retrievedCount: number;
  createdAt: string;
  answer?: string;
  sources?: QuerySource[];
};

export function useHistory() {
  const [history, setHistory] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches the user's history of past queries from the server.
   * Updates the `history` state upon success.
   */
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchQueryLogs();
      setHistory(data as QueryLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deletes a specific query log entry from the server and removes it from the local state.
   *
   * @param id - The ID of the query log to delete
   */
  const deleteHistoryItem = useCallback(async (id: string) => {
    try {
      setError(null);
      const { deleteQueryLog } = await import('../lib/api');
      await deleteQueryLog(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  return {
    history,
    loading,
    error,
    fetchHistory,
    deleteHistoryItem,
  };
}
