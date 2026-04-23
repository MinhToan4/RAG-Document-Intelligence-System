import type { ChunkSearchResult } from '../types/index.js';

export function buildGroundedPrompt(question: string, chunks: ChunkSearchResult[]): string {
  const context = chunks
    .map(
      (chunk, idx) =>
        `[#${idx + 1}] [${chunk.documentName} - chunk ${chunk.chunkIndex}] (score ${chunk.score.toFixed(
          3,
        )})\n${chunk.content}`,
    )
    .join('\n\n');

  return [
    'You are a document QA assistant.',
    'Only answer using the provided context.',
    'If the context does not contain the answer, reply exactly:',
    '"No relevant information was found in the provided documents."',
    'Return the answer in clean markdown format with short sections and bullet points when appropriate.',
    'Do not output one long paragraph.',
    'When citing a source, use the exact document name from the context, for example: [Tổng hợp Kiến thức Cần Học.pdf - chunk 6]. Never output the literal text document_name.',
    'Keep citations concise and avoid repeating a citation-only line at the end unless it adds new information.',
    'Do not append a raw footer that repeats file names or chunk labels after the answer.',
    '',
    'Context:',
    context,
    '',
    'Question:',
    question,
  ].join('\n');
}
