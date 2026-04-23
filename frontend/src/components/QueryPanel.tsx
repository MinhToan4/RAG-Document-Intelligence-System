import { useState, type FormEvent } from 'react';
import type { QuerySource } from '../types';
import { normalizeMojibakeText } from '../lib/text';
import { AnswerContent } from './AnswerContent';

type QueryPanelProps = {
  loading: boolean;
  answer: string;
  model: string;
  sources: QuerySource[];
  selectedDocumentIds: string[];
  onSubmit: (payload: { question: string; topK: number; documentIds?: string[] }) => Promise<void>;
};

export function QueryPanel({
  loading,
  answer,
  model,
  sources,
  selectedDocumentIds,
  onSubmit,
}: QueryPanelProps) {
  const [question, setQuestion] = useState('');
  const [topK, setTopK] = useState(5);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }

    await onSubmit({
      question: question.trim(),
      topK,
      documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
    });
  };

  return (
    <div className="card">
      <h2>Ask Question</h2>
      <form onSubmit={handleSubmit} className="query-form">
        <label htmlFor="question">Question</label>
        <textarea
          id="question"
          placeholder="Doanh thu Q3 la bao nhieu?"
          value={question}
          disabled={loading}
          onChange={(event) => setQuestion(event.target.value)}
        />

        <label htmlFor="top-k">Top K</label>
        <input
          id="top-k"
          type="number"
          min={1}
          max={20}
          value={topK}
          disabled={loading}
          onChange={(event) => setTopK(Number(event.target.value))}
        />

        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? 'Generating...' : 'Ask'}
        </button>
      </form>

      <section className="answer">
        <div className="answer-header">
          <h3>Answer</h3>
          {model && <span className="muted">Model: {model}</span>}
        </div>
        <AnswerContent answer={answer} />
      </section>

      <section className="sources">
        <h3>Sources</h3>
        {sources.length === 0 ? (
          <p className="muted">No sources yet.</p>
        ) : (
          <ul>
            {sources.map((source) => (
              <li key={`${source.documentId}_${source.chunkIndex}`}>
                <div className="source-head">
                  <strong>{normalizeMojibakeText(source.documentName)}</strong>
                  <span>chunk {source.chunkIndex}</span>
                  <span>score {source.score.toFixed(3)}</span>
                </div>
                <p>{source.snippet}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
