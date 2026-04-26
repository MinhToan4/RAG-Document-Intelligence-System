/**
 * Custom React hook for documents. Manages feature state, side effects, and API interactions.
 */
/**
 * Custom React hook for managing user documents.
 * Provides functions to fetch the document list, upload new files, delete existing ones,
 * and automatically polls for updates when a document is in the 'processing' state.
 *
 * @param enabled - Boolean flag to control whether the initial fetch and polling should run
 * @returns State and methods to interact with the document management system
 */
import { useCallback, useEffect, useState } from 'react';
import type { DocumentItem } from '../types';
import { deleteDocument, fetchDocuments, uploadDocument } from '../lib/api';

type RefreshOptions = {
  silent?: boolean;
};

export function useDocuments(enabled = true) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refreshes the list of documents from the server.
   *
   * @param options - Set { silent: true } to skip showing the loading spinner during refresh
   */
  const refresh = useCallback(async (options?: RefreshOptions) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchDocuments();
      setDocuments(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch documents';
      setError(message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Uploads a new document file to the backend.
   * Automatically refreshes the document list (silently) upon success.
   *
   * @param file - The file object to upload
   * @param name - Optional custom name for the document
   */
  const upload = useCallback(
    async (file: File, name?: string) => {
      setLoading(true);
      setError(null);
      try {
        await uploadDocument(file, name);
        await refresh({ silent: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  /**
   * Deletes a document by its ID.
   * Automatically refreshes the document list (silently) upon success.
   *
   * @param id - The ID of the document to delete
   */
  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        await deleteDocument(id);
        await refresh({ silent: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (!enabled) {
      setDocuments([]);
      setError(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const hasProcessingDocument = documents.some((document) => document.status === 'processing');
    if (!hasProcessingDocument) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [documents, enabled, refresh]);

  return {
    documents,
    loading,
    error,
    refresh,
    upload,
    remove,
  };
}
