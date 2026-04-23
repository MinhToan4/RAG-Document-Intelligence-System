import type { DocumentItem } from '../types';
import { normalizeMojibakeText } from '../lib/text';

type DocumentTableProps = {
  documents: DocumentItem[];
  loading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
};

function statusClass(status: DocumentItem['status']): string {
  if (status === 'ready') return 'status status-ready';
  if (status === 'processing') return 'status status-processing';
  return 'status status-failed';
}

export function DocumentTable({
  documents,
  loading,
  selectedIds,
  onToggleSelect,
  onDelete,
}: DocumentTableProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Documents</h2>
        {loading && <span className="muted">Refreshing...</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pick</th>
              <th>Name</th>
              <th>Status</th>
              <th>Chunks</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted center">
                  No documents yet
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={() => onToggleSelect(doc.id)}
                    />
                  </td>
                  <td>{normalizeMojibakeText(doc.name)}</td>
                  <td>
                    <span className={statusClass(doc.status)}>{doc.status}</span>
                  </td>
                  <td>{doc.chunkCount}</td>
                  <td>{new Date(doc.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="danger" onClick={() => void onDelete(doc.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
