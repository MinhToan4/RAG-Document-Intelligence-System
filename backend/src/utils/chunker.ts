/**
 * Utility module for chunker. Provides reusable helper functions across backend features.
 */
import { get_encoding, type Tiktoken } from 'tiktoken';

type TextChunk = {
  content: string;
  tokenCount: number;
};

const SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];
const utf8Decoder = new TextDecoder();

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken | null {
  if (encoder) {
    return encoder;
  }
  try {
    encoder = get_encoding('cl100k_base');
    return encoder;
  } catch {
    return null;
  }
}

function estimateTokensFallback(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function tokenCount(text: string): number {
  const encoding = getEncoder();
  if (!encoding) {
    return estimateTokensFallback(text);
  }
  return encoding.encode(text).length;
}

function decodeTokens(encoding: Tiktoken, tokenIds: Uint32Array | number[]): string {
  const ids = tokenIds instanceof Uint32Array ? tokenIds : Uint32Array.from(tokenIds);
  return utf8Decoder.decode(encoding.decode(ids));
}

function tailByTokens(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) {
    return '';
  }
  const encoding = getEncoder();
  if (!encoding) {
    const fallbackChars = overlapTokens * 4;
    return text.slice(Math.max(0, text.length - fallbackChars)).trim();
  }

  const ids = encoding.encode(text);
  if (ids.length <= overlapTokens) {
    return text;
  }

  const tailIds = ids.slice(ids.length - overlapTokens);
  return decodeTokens(encoding, tailIds).trim();
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitRecursively(text: string, maxTokens: number, level = 0): string[] {
  const cleaned = text.trim();
  if (!cleaned) {
    return [];
  }

  if (tokenCount(cleaned) <= maxTokens) {
    return [cleaned];
  }

  if (level >= SEPARATORS.length) {
    return splitHardByTokens(cleaned, maxTokens);
  }

  const separator = SEPARATORS[level];
  const parts = cleaned.split(separator);
  if (parts.length <= 1) {
    return splitRecursively(cleaned, maxTokens, level + 1);
  }

  const merged: string[] = [];
  let buffer = '';

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const candidate = buffer ? `${buffer}${separator}${part}` : part;
    if (tokenCount(candidate) <= maxTokens) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      merged.push(buffer.trim());
    }

    if (tokenCount(part) <= maxTokens) {
      buffer = part;
    } else {
      merged.push(...splitRecursively(part, maxTokens, level + 1));
      buffer = '';
    }
  }

  if (buffer.trim()) {
    merged.push(buffer.trim());
  }

  return merged.flatMap((item) =>
    tokenCount(item) <= maxTokens ? [item] : splitRecursively(item, maxTokens, level + 1),
  );
}

function splitHardByTokens(text: string, maxTokens: number): string[] {
  const encoding = getEncoder();
  if (!encoding) {
    const maxChars = maxTokens * 4;
    const output: string[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const next = text.slice(cursor, cursor + maxChars).trim();
      if (next) {
        output.push(next);
      }
      cursor += maxChars;
    }
    return output;
  }

  const ids = encoding.encode(text);
  const output: string[] = [];
  let cursor = 0;
  while (cursor < ids.length) {
    const slice = ids.slice(cursor, cursor + maxTokens);
    const piece = decodeTokens(encoding, slice).trim();
    if (piece) {
      output.push(piece);
    }
    cursor += maxTokens;
  }
  return output;
}

/**
 * Core text chunking utility for RAG ingestion.
 * Splits large documents into smaller, semantically coherent chunks based on token count,
 * while maintaining a specified overlap between consecutive chunks to preserve context.
 *
 * @param text - The raw text of the document to be chunked
 * @param chunkSizeTokens - The target maximum number of tokens per chunk
 * @param overlapTokens - The number of tokens to overlap between adjacent chunks
 * @returns An array of TextChunk objects containing the split content and exact token count
 */
export function chunkText(text: string, chunkSizeTokens: number, overlapTokens: number): TextChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const segments = splitRecursively(normalized, chunkSizeTokens);
  if (segments.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < segments.length) {
    let current = '';
    let currentTokens = 0;
    let end = cursor;

    while (end < segments.length) {
      const nextSegment = segments[end];
      const candidate = current ? `${current}\n\n${nextSegment}` : nextSegment;
      const candidateTokens = tokenCount(candidate);
      if (candidateTokens > chunkSizeTokens && current) {
        break;
      }
      current = candidate;
      currentTokens = candidateTokens;
      end += 1;
      if (candidateTokens >= chunkSizeTokens) {
        break;
      }
    }

    const finalChunk = current.trim();
    if (finalChunk) {
      chunks.push({
        content: finalChunk,
        tokenCount: currentTokens || tokenCount(finalChunk),
      });
    }

    if (end >= segments.length) {
      break;
    }

    const overlapText = tailByTokens(finalChunk, overlapTokens);
    if (!overlapText) {
      cursor = end;
      continue;
    }

    let rewind = end;
    let accumulated = '';
    while (rewind > cursor) {
      const prev = segments[rewind - 1];
      const candidate = accumulated ? `${prev}\n\n${accumulated}` : prev;
      if (tokenCount(candidate) > overlapTokens) {
        break;
      }
      accumulated = candidate;
      rewind -= 1;
    }

    cursor = rewind < end ? rewind : end;
  }

  return chunks;
}
