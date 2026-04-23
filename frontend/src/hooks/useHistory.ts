import { useState, useCallback } from 'react';
import { fetchQueryLogs } from '../lib/api';
import type { QuerySource } from '../types';

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
