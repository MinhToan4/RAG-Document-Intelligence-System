type TextChunk = {
  content: string;
  tokenCount: number;
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function safeSliceBoundary(text: string, start: number, idealEnd: number): number {
  if (idealEnd >= text.length) {
    return text.length;
  }

  const boundaryWindow = text.slice(start, idealEnd);
  const sentenceEndRegex = /[.!?]\s+[A-Z0-9À-Ỵ]/g;
  let match: RegExpExecArray | null = null;
  let lastBoundary = -1;

  do {
    match = sentenceEndRegex.exec(boundaryWindow);
    if (match && typeof match.index === 'number') {
      lastBoundary = match.index + 1;
    }
  } while (match);

  if (lastBoundary > 0) {
    return start + lastBoundary;
  }

  const newlineBoundary = boundaryWindow.lastIndexOf('\n');
  if (newlineBoundary > boundaryWindow.length * 0.6) {
    return start + newlineBoundary;
  }

  const spaceBoundary = boundaryWindow.lastIndexOf(' ');
  if (spaceBoundary > boundaryWindow.length * 0.7) {
    return start + spaceBoundary;
  }

  return idealEnd;
}

export function chunkText(text: string, chunkSizeTokens: number, overlapTokens: number): TextChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const maxChars = chunkSizeTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const idealEnd = Math.min(cursor + maxChars, normalized.length);
    const end = safeSliceBoundary(normalized, cursor, idealEnd);
    const segment = normalized.slice(cursor, end).trim();

    if (segment.length > 0) {
      chunks.push({
        content: segment,
        tokenCount: estimateTokens(segment),
      });
    }

    if (end >= normalized.length) {
      break;
    }

    cursor = Math.max(end - overlapChars, cursor + 1);
  }

  return chunks;
}
