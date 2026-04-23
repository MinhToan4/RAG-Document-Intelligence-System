import type { ReactNode } from 'react';
import { normalizeMojibakeText } from '../lib/text';

type AnswerContentProps = {
  answer: string;
  isStreaming?: boolean;
};

function renderInlineBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`bold_${idx}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`text_${idx}`}>{part}</span>;
  });
}

function parseLines(answer: string): string[] {
  return answer
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function isCitationOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  return /^(?:\[[^\]]+\]\s*[;,]?\s*)+$/.test(trimmed);
}

function isRedundantChunkFooterLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  // Only match footer spam like "file.pdfchunk 3" (no dash, no brackets)
  // Do NOT match citations in format "[file.pdf - chunk 3]"
  if (trimmed.includes('[') || trimmed.includes(']')) {
    return false; // Keep lines with brackets (valid citation format)
  }

  return /\.(pdf|docx|txt)\s*chunk\s*\d+$/i.test(trimmed);
}

export function AnswerContent({ answer, isStreaming = false }: AnswerContentProps) {
  if (!answer) {
    if (isStreaming) {
      return (
        <div className="answer-content answer-content-streaming" aria-live="polite">
          <p className="answer-paragraph answer-streaming-line">
            <span className="answer-streaming-cursor" aria-hidden="true" />
          </p>
        </div>
      );
    }

    return <p className="muted">No answer yet.</p>;
  }

  const lines = parseLines(normalizeMojibakeText(answer)).filter(
    (line) => !isCitationOnlyLine(line) && !isRedundantChunkFooterLine(line),
  );
  const blocks: ReactNode[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);

    if (numberedMatch) {
      const listItems: ReactNode[] = [];
      const start = Number(numberedMatch[1]);
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = current.match(/^\d+\.\s+(.*)$/);
        if (!match) {
          break;
        }
        listItems.push(<li key={`ol_${index}`}>{renderInlineBold(match[1])}</li>);
        index += 1;
      }
      blocks.push(
        <ol key={`ol_block_${index}`} start={start}>
          {listItems}
        </ol>,
      );
      continue;
    }

    if (bulletMatch) {
      const listItems: ReactNode[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = current.match(/^[-*]\s+(.*)$/);
        if (!match) {
          break;
        }
        listItems.push(<li key={`ul_${index}`}>{renderInlineBold(match[1])}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul_block_${index}`}>{listItems}</ul>);
      continue;
    }

    blocks.push(
      <p key={`p_${index}`} className="answer-paragraph">
        {renderInlineBold(line)}
      </p>,
    );
    index += 1;
  }

  return (
    <div className={`answer-content ${isStreaming ? 'answer-content-streaming' : ''}`.trim()} aria-live="polite">
      {blocks}
      {isStreaming && <span className="answer-streaming-cursor" aria-hidden="true" />}
    </div>
  );
}
