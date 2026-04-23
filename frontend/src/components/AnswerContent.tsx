import type { ReactNode } from 'react';
import { normalizeMojibakeText } from '../lib/text';

type AnswerContentProps = {
  answer: string;
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

export function AnswerContent({ answer }: AnswerContentProps) {
  if (!answer) {
    return <p className="muted">No answer yet.</p>;
  }

  const lines = parseLines(normalizeMojibakeText(answer));
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

  return <div className="answer-content">{blocks}</div>;
}
